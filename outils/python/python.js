// Outil Python : éditeur (CodeMirror), exécution hors ligne (Skulpt), console avec input(), tortue,
// exemples, exercices vérifiés automatiquement, enregistrement .py dans Mes documents.
(function () {
  const $ = (id) => document.getElementById(id);
  const { EXEMPLES, EXERCICES } = window.PythonDonnees;
  const lire = (cle, defaut) => { try { const v = localStorage.getItem('python:' + cle); return v === null ? defaut : JSON.parse(v); } catch { return defaut; } };
  const ecrire = (cle, v) => { try { localStorage.setItem('python:' + cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
  const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Éditeur ----------
  const DEPART = '# Mon programme Python\nprint("Bonjour !")\n';
  const editeur = CodeMirror($('editeur'), {
    value: lire('brouillon', DEPART),
    mode: { name: 'python', version: 3 },
    lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
    matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true, lineWrapping: false,
    extraKeys: {
      Tab: (cm) => (cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('    ', 'end')),
      'Shift-Tab': (cm) => cm.indentSelection('subtract'),
      'Ctrl-/': 'toggleComment',
      'Ctrl-Enter': () => executer(),
      F5: () => executer(),
      'Ctrl-S': () => enregistrer(),
    },
  });
  const fichier = { nom: 'programme.py', modifie: false, nouveau: true };
  function majTitre() {
    $('nom-fichier').textContent = fichier.nom;
    $('etat-fichier').textContent = fichier.modifie ? '· non enregistré' : '';
  }
  let ligneMarquee = null;
  editeur.on('change', () => {
    fichier.modifie = true; majTitre();
    ecrire('brouillon', editeur.getValue()); // le travail est gardé si l'outil est fermé par erreur
    if (ligneMarquee !== null) { editeur.removeLineClass(ligneMarquee, 'background', 'ligne-erreur'); ligneMarquee = null; }
  });
  function marquerLigne(n) {
    if (ligneMarquee !== null) editeur.removeLineClass(ligneMarquee, 'background', 'ligne-erreur');
    ligneMarquee = null;
    if (!n || n > editeur.lineCount()) return;
    ligneMarquee = n - 1;
    editeur.addLineClass(ligneMarquee, 'background', 'ligne-erreur');
    editeur.scrollIntoView({ line: ligneMarquee, ch: 0 }, 80);
  }

  // Taille du texte
  let taille = lire('taille', 16);
  function appliquerTaille() {
    document.documentElement.style.setProperty('--taille-code', taille + 'px');
    document.documentElement.style.setProperty('--taille-console', (taille - 1) + 'px');
    editeur.refresh();
  }
  $('btn-plus').addEventListener('click', () => { taille = Math.min(28, taille + 2); ecrire('taille', taille); appliquerTaille(); });
  $('btn-moins').addEventListener('click', () => { taille = Math.max(12, taille - 2); ecrire('taille', taille); appliquerTaille(); });
  appliquerTaille();

  // ---------- Console ----------
  const console_ = $('console');
  function ajouter(texte, classe) {
    const aide = console_.querySelector('.aide-console');
    if (aide) aide.remove();
    if (classe) { const s = document.createElement('span'); s.className = classe; s.textContent = texte; console_.append(s); }
    else console_.append(document.createTextNode(texte));
    console_.scrollTop = console_.scrollHeight;
  }
  function afficherErreur(e, code) {
    const t = window.ErreursPython.traduire(e, code);
    const bloc = document.createElement('span');
    bloc.className = 'erreur-py';
    bloc.innerHTML = `<b>❌ ${echapper(t.titre)}${t.ligne ? ` — ligne ${t.ligne}` : ''}</b><br>${echapper(t.texte)}${t.conseil ? `<span class="conseil">💡 ${echapper(t.conseil)}</span>` : ''}<span class="original">${echapper(t.original)}</span>`;
    const aide = console_.querySelector('.aide-console');
    if (aide) aide.remove();
    console_.append(bloc);
    console_.scrollTop = console_.scrollHeight;
    marquerLigne(t.ligne);
    return t;
  }
  $('btn-effacer').addEventListener('click', () => { console_.textContent = ''; });

  // input() : un champ apparaît dans la console, à la suite de la question.
  let entreeEnCours = null;
  function demanderEntree(question) {
    return new Promise((resoudre) => {
      if (question) ajouter(String(question));
      const champ = document.createElement('input');
      champ.className = 'entree';
      champ.setAttribute('aria-label', 'Réponse');
      console_.append(champ);
      console_.scrollTop = console_.scrollHeight;
      champ.focus();
      entreeEnCours = { champ, resoudre };
      champ.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const v = champ.value;
        champ.replaceWith(Object.assign(document.createElement('span'), { className: 'reponse', textContent: v }));
        ajouter('\n');
        entreeEnCours = null;
        resoudre(v);
      });
    });
  }

  // ---------- Exécution (Skulpt) ----------
  let enCours = false, arretDemande = false;
  const ARRET = Object.assign(new Error('Programme arrêté'), { arretLabo: true }); // lancé pour interrompre Skulpt
  const lireModule = (nom) => {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[nom] === undefined) throw new Error(`Fichier introuvable : « ${nom} »`);
    return Sk.builtinFiles.files[nom];
  };
  const utiliseTortue = (code) => /^\s*(import\s+turtle|from\s+turtle\s+import)/m.test(code);

  /**
   * Exécute du code Python. options : { sortie(texte), entree(question) → Promise, tortue: bool }
   * Renvoie une promesse { ok, erreur }.
   */
  function lancer(code, options) {
    arretDemande = false;
    Sk.configure({
      output: options.sortie,
      read: lireModule,
      __future__: Sk.python3,
      inputfun: options.entree,
      inputfunTakesPrompt: true,
      yieldLimit: 100,          // rend la main à l'écran régulièrement (le bouton Arrêter reste utilisable)
      execLimit: options.limite || null,
      killableWhile: true,
      killableFor: true,
    });
    if (options.tortue) {
      $('tortue').innerHTML = '';
      const r = $('tortue').getBoundingClientRect();
      (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'tortue';
      Sk.TurtleGraphics.width = Math.max(300, Math.floor(r.width) - 8);
      Sk.TurtleGraphics.height = Math.max(240, Math.floor(r.height) - 8);
      Sk.TurtleGraphics.animate = true;
    }
    return Sk.misceval.asyncToPromise(
      () => Sk.importMainWithBody('<stdin>', false, code, true),
      { '*': () => { if (arretDemande) throw ARRET; } },
    ).then(() => ({ ok: true }), (erreur) => ({ ok: false, erreur }));
  }

  async function executer() {
    if (enCours) return;
    const code = editeur.getValue();
    marquerLigne(null);
    const tortue = utiliseTortue(code);
    $('zone-tortue').hidden = !tortue;
    if (tortue) await new Promise((r) => requestAnimationFrame(r)); // la zone doit avoir sa taille
    console_.textContent = '';
    enCours = true;
    $('btn-executer').disabled = true;
    $('btn-arreter').disabled = false;
    const debut = performance.now();
    const r = await lancer(code, { sortie: (t) => ajouter(t), entree: demanderEntree, tortue });
    enCours = false;
    $('btn-executer').disabled = false;
    $('btn-arreter').disabled = true;
    if (entreeEnCours) { entreeEnCours.champ.remove(); entreeEnCours = null; }
    if (r.ok) ajouter(`\n— Programme terminé (${((performance.now() - debut) / 1000).toFixed(2).replace('.', ',')} s) —\n`, 'fin');
    else if (r.erreur === ARRET || (r.erreur && r.erreur.arretLabo)) ajouter('\n— Programme arrêté —\n', 'info');
    else afficherErreur(r.erreur, code);
    editeur.focus();
  }
  function arreter() {
    if (!enCours) return;
    arretDemande = true;
    // Un input() en attente : on le débloque pour que l'arrêt soit pris en compte.
    if (entreeEnCours) { const { champ, resoudre } = entreeEnCours; champ.remove(); entreeEnCours = null; resoudre(''); }
  }
  $('btn-executer').addEventListener('click', executer);
  $('btn-arreter').addEventListener('click', arreter);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') { e.preventDefault(); executer(); }
    if (e.key === 'Escape' && enCours) { e.preventDefault(); arreter(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); }
  });

  // ---------- Menus ----------
  function basculerMenu(menu, remplir) {
    const ouvert = !menu.hidden;
    document.querySelectorAll('.menu').forEach((m) => { m.hidden = true; });
    if (ouvert) return;
    if (remplir) remplir(menu);
    menu.hidden = false;
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu-conteneur')) document.querySelectorAll('.menu').forEach((m) => { m.hidden = true; }); });
  const confirmerPerte = () => !fichier.modifie || editeur.getValue().trim() === '' || confirm('Ton programme n\'est pas enregistré. Le remplacer quand même ?');
  function charger(code, nom = 'programme.py', nouveau = true) {
    editeur.setValue(code);
    fichier.nom = nom; fichier.nouveau = nouveau; fichier.modifie = false;
    majTitre();
    editeur.clearHistory();
    editeur.focus();
  }

  $('btn-exemples').addEventListener('click', () => basculerMenu($('menu-exemples'), (m) => {
    m.innerHTML = EXEMPLES.map((ex, i) => `<button data-ex="${i}">${echapper(ex.titre)}</button>`).join('');
    m.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => {
      m.hidden = true;
      if (!confirmerPerte()) return;
      quitterExercice();
      charger(EXEMPLES[+b.dataset.ex].code, 'exemple.py');
    }));
  }));
  $('btn-nouveau').addEventListener('click', () => { if (!confirmerPerte()) return; quitterExercice(); charger(''); });

  // ---------- Enregistrer / ouvrir (Mes documents) ----------
  async function enregistrer() {
    if (!Doc.disponible()) return Doc.message('Ouvre cet outil depuis Labo Élève pour enregistrer.', 'erreur');
    let nom = fichier.nom;
    if (fichier.nouveau) {
      nom = await Doc.demanderNom('Nom du programme', fichier.nom.replace(/\.py$/i, ''));
      if (!nom) return;
      if (!/\.py$/i.test(nom)) nom += '.py';
    }
    try {
      const reel = await Doc.enregistrer(nom, new TextEncoder().encode(editeur.getValue()), true);
      fichier.nom = reel; fichier.nouveau = false; fichier.modifie = false;
      majTitre();
      Doc.message(`Enregistré dans Mes documents : ${reel}`);
    } catch (e) { Doc.message(e.message, 'erreur'); }
  }
  async function ouvrirFichier(nom) {
    try {
      const octets = await Doc.lire(nom);
      quitterExercice();
      charger(new TextDecoder().decode(octets).replace(/\r\n/g, '\n'), nom, false);
    } catch (e) { Doc.message(e.message, 'erreur'); }
  }
  $('btn-enregistrer').addEventListener('click', enregistrer);
  $('btn-ouvrir').addEventListener('click', () => basculerMenu($('menu-ouvrir'), async (m) => {
    m.innerHTML = '<div class="vide">Recherche…</div>';
    let liste = [];
    try { liste = (await window.parent.labo.documents.lister()) || []; } catch { /* hors de Labo Élève */ }
    const noms = liste.map((d) => (typeof d === 'string' ? d : d.nom)).filter((n) => /\.py$/i.test(n)).sort((a, b) => a.localeCompare(b, 'fr'));
    m.innerHTML = noms.length ? noms.map((n) => `<button data-nom="${echapper(n)}">🐍 ${echapper(n)}</button>`).join('') : '<div class="vide">Aucun programme .py dans Mes documents.</div>';
    m.querySelectorAll('[data-nom]').forEach((b) => b.addEventListener('click', () => { m.hidden = true; if (confirmerPerte()) ouvrirFichier(b.dataset.nom); }));
  }));
  window.laboAvantFermeture = () => !fichier.modifie || editeur.getValue().trim() === '' || confirm('Ton programme n\'est pas enregistré. Quitter quand même ?\n(Il reste aussi gardé en brouillon dans l\'outil Python.)');

  // ---------- Exercices ----------
  let reussis = new Set(lire('reussis', []));
  let exercice = null;
  function majScore() { $('score').textContent = `${reussis.size}/${EXERCICES.length}`; }
  majScore();
  function afficherListeExercices() {
    $('liste-ex').innerHTML = EXERCICES.map((ex, i) => `<button data-i="${i}" class="${reussis.has(ex.id) ? 'reussi' : ''}">
      <span class="num">${i + 1}. ${echapper(ex.notion)}</span><span class="t">${echapper(ex.titre)}</span></button>`).join('');
    $('liste-ex').querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { $('dlg-exercices').hidden = true; commencerExercice(EXERCICES[+b.dataset.i]); }));
    $('dlg-exercices').hidden = false;
  }
  $('btn-exercices').addEventListener('click', afficherListeExercices);
  $('btn-fermer-exercices').addEventListener('click', () => { $('dlg-exercices').hidden = true; });
  $('dlg-exercices').addEventListener('click', (e) => { if (e.target === $('dlg-exercices')) $('dlg-exercices').hidden = true; });

  function commencerExercice(ex) {
    if (!confirmerPerte()) return;
    exercice = ex;
    $('ex-notion').textContent = ex.notion;
    $('ex-titre').textContent = ex.titre;
    $('ex-enonce').innerHTML = ex.enonce; // textes écrits dans exercices.js (pas de contenu extérieur)
    $('ex-indice').innerHTML = '💡 ' + ex.indice;
    $('ex-indice').hidden = true;
    $('ex-resultats').hidden = true;
    $('bandeau-exercice').hidden = false;
    charger(lire('ex:' + ex.id, ex.depart), `exercice-${ex.id}.py`);
    editeur.setCursor(editeur.lineCount(), 0);
    editeur.refresh();
  }
  function quitterExercice() { exercice = null; $('bandeau-exercice').hidden = true; editeur.refresh(); }
  $('btn-quitter-ex').addEventListener('click', quitterExercice);
  $('btn-indice').addEventListener('click', () => { $('ex-indice').hidden = !$('ex-indice').hidden; });
  editeur.on('change', () => { if (exercice) ecrire('ex:' + exercice.id, editeur.getValue()); });

  // Compare deux résultats écrits comme Python les affiche (repr) ; les nombres à 1e-6 près.
  function egaux(obtenu, attendu) {
    const a = Number(obtenu), b = Number(attendu);
    if (obtenu.trim() !== '' && !Number.isNaN(a) && !Number.isNaN(b)) return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
    return obtenu.trim() === attendu.trim();
  }
  const normaliser = (t) => t.toLowerCase().replace(/\s+/g, ' ');

  async function verifier() {
    if (!exercice || enCours) return;
    const ex = exercice, code = editeur.getValue();
    const liste = $('ex-resultats');
    liste.hidden = false;
    liste.innerHTML = '<li>Vérification…</li>';
    marquerLigne(null);
    console_.textContent = '';
    enCours = true; $('btn-verifier').disabled = true; $('btn-executer').disabled = true;
    const lignes = [];
    let toutBon = true;
    try {
      for (const mot of ex.interdit || []) {
        if (code.replace(/#.*$/gm, '').includes(mot)) { lignes.push(['ko', `Interdit dans cet exercice : « ${mot.replace('(', '')} »`]); toutBon = false; }
      }
      if (ex.type === 'sortie') {
        for (const cas of ex.cas) {
          let sortie = '';
          const reponses = [...cas.entrees];
          const r = await lancer(code, { sortie: (t) => { sortie += t; }, entree: (q) => { if (q) sortie += q; const v = reponses.length ? reponses.shift() : ''; sortie += v + '\n'; return Promise.resolve(v); }, limite: 5000 });
          const quand = cas.entrees.length ? `Avec ${cas.entrees.map((x) => `« ${x} »`).join(', ')}` : 'Affichage';
          if (!r.ok) { lignes.push(['ko', `${quand} : le programme s'arrête sur une erreur (voir la console).`]); ajouter(sortie); afficherErreur(r.erreur, code); toutBon = false; break; }
          const n = normaliser(sortie);
          const manque = cas.contient.filter((c) => !n.includes(normaliser(c)));
          const enTrop = (cas.absent || []).filter((c) => n.includes(normaliser(c)));
          if (!manque.length && !enTrop.length) lignes.push(['ok', `${quand} : ✔ correct`]);
          else {
            toutBon = false;
            lignes.push(['ko', `${quand} : ${manque.length ? `on attendait « ${manque.join(' », « ')} » dans l'affichage` : `« ${enTrop.join(' », « ')} » ne devrait pas s'afficher`}`]);
          }
          ajouter(`${quand} :\n`, 'info'); ajouter(sortie + (sortie.endsWith('\n') ? '' : '\n'));
        }
      } else {
        // Le programme de l'élève, puis chaque appel de fonction ; les résultats sont repérés par des marqueurs.
        const tests = ex.cas.map((c, i) => `try:\n    print("§R${i}§" + repr(${c.expr}))\nexcept Exception as _e:\n    print("§E${i}§" + type(_e).__name__ + " : " + str(_e))`).join('\n');
        let sortie = '';
        const r = await lancer(`${code}\nprint("§DEBUT§")\n${tests}\n`, { sortie: (t) => { sortie += t; }, entree: () => Promise.resolve(''), limite: 5000 });
        if (!r.ok) {
          toutBon = false;
          lignes.push(['ko', 'Le programme s\'arrête sur une erreur (voir la console).']);
          const avant = sortie.split('§DEBUT§')[0];
          if (avant) ajouter(avant);
          afficherErreur(r.erreur, code);
        } else {
          if (!sortie.includes('§DEBUT§')) toutBon = false;
          ex.cas.forEach((c, i) => {
            const ok = new RegExp(`§R${i}§(.*)`).exec(sortie), ko = new RegExp(`§E${i}§(.*)`).exec(sortie);
            const libelle = c.message || `${c.expr}`;
            if (ok && egaux(ok[1], c.attendu)) lignes.push(['ok', `${libelle} → ${c.message ? 'oui' : ok[1]} ✔`]);
            else {
              toutBon = false;
              if (ko) lignes.push(['ko', `${libelle} → erreur : ${ko[1]}`]);
              else if (ok && ok[1] === 'None') lignes.push(['ko', `${libelle} → None : la fonction ne renvoie rien. Il manque « return ».`]);
              else lignes.push(['ko', `${libelle} → ${ok ? ok[1] : '?'} (attendu : ${c.message ? 'oui' : c.attendu})`]);
            }
          });
          const avant = sortie.split('§DEBUT§')[0];
          if (avant.trim()) ajouter(avant);
        }
      }
    } finally {
      enCours = false; $('btn-verifier').disabled = false; $('btn-executer').disabled = false;
    }
    if (toutBon) {
      lignes.push(['bravo', '🎉 Bravo, exercice réussi !']);
      reussis.add(ex.id); ecrire('reussis', [...reussis]); majScore();
    }
    liste.innerHTML = lignes.map(([c, t]) => `<li class="${c}">${echapper(t)}</li>`).join('');
  }
  $('btn-verifier').addEventListener('click', verifier);

  // ---------- Largeur éditeur / console ----------
  $('separateur').addEventListener('pointerdown', (ev) => {
    const zone = $('espace-travail'), r = zone.getBoundingClientRect();
    zone.classList.add('glisse');
    try { ev.target.setPointerCapture(ev.pointerId); } catch { /* sans capture */ }
    const bouger = (m) => {
      const part = Math.min(0.8, Math.max(0.3, (m.clientX - r.left) / r.width));
      document.querySelector('.cote-editeur').style.flex = `0 0 ${(part * 100).toFixed(1)}%`;
      editeur.refresh();
    };
    const fin = () => { zone.classList.remove('glisse'); ev.target.removeEventListener('pointermove', bouger); ev.target.removeEventListener('pointerup', fin); };
    ev.target.addEventListener('pointermove', bouger);
    ev.target.addEventListener('pointerup', fin);
  });

  // ---------- Démarrage ----------
  const parametres = new URLSearchParams(location.search);
  if (parametres.get('ouvrir')) ouvrirFichier(parametres.get('ouvrir'));
  else { fichier.modifie = false; majTitre(); }
  editeur.focus();
  window.laboPython = { executer, verifier, editeur, commencerExercice, EXERCICES }; // utilisé par les tests
})();
