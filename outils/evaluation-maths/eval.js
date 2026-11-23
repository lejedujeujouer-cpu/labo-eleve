// Évaluation côté élève : questions (QCM puis calculs), calculatrice qui garde les étapes, chrono, copie, correction.
(function () {
  const api = window.parent && window.parent.labo && window.parent.labo.evaluations;
  const app = document.getElementById('app');
  const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const C = window.CalculSur;
  let session = null, questions = [], reponses = {}, calculs = [], courant = 0, fini = false, minuterie = null, attenteCorrection = null, surveillance = null;
  const valides = new Set(); // questions dont l'élève a validé la réponse

  function ecran(ic, titre, texte) { app.innerHTML = `<div class="centre"><div class="ic">${ic}</div><h1>${echapper(titre)}</h1><p>${texte}</p></div>`; }

  // Évaluation « exercice » (feuille PDF) : exercice.js (module, chargé après ce script)
  const exercice = () => (window.EvalExercice ? Promise.resolve(window.EvalExercice) : new Promise((ok) => window.addEventListener('exercice-pret', () => ok(window.EvalExercice), { once: true })));
  async function charger() {
    if (!api) return ecran('⚠️', 'Évaluation indisponible', 'Ouvre cet outil depuis Labo Élève.');
    const prm = new URLSearchParams(location.search);
    if (prm.get('mode') === 'zones') return (await exercice()).editerZones(prm.get('eval'));
    if (prm.get('mode') === 'corriger') return (await exercice()).corriger(prm.get('sid'), prm.get('eleve'));
    if (/^travail-/.test(prm.get('mode') || '')) return (await exercice()).travail(prm.get('mode'), prm.get('classe'), prm.get('travail'));
    if (prm.get('mode') === 'module-zones') return (await exercice()).moduleZones(prm.get('module'));
    if (prm.get('mode') === 'entrainement') return window.Entrainement.accueil();
    const sidRelire = prm.get('sid');
    if (sidRelire) return relire(sidRelire);
    const r = await api.monSujet();
    if (!r.ok && /Aucune évaluation en cours/.test(r.message)) return mesEvaluations();
    if (!r.ok) { ecran('⏳', 'Évaluation', echapper(r.message)); setTimeout(charger, 3000); return; }
    session = r.session; questions = r.questions || [];
    if (r.copie) { reponses = r.copie.reponses || {}; calculs = r.copie.calculs || []; fini = !!r.copie.fini; (r.copie.valides || []).forEach((n) => valides.add(n)); }
    // Ouverture automatique (début d'examen, relance) alors que la copie est déjà rendue : retour au choix de la matière.
    if (fini && new URLSearchParams(location.search).get('auto') === '1' && window.parent && window.parent.retourMatieresEleve) {
      ecran('✅', 'Copie déjà rendue', 'Retour à tes matières…');
      window.parent.retourMatieresEleve();
      return;
    }
    if (fini || session.etat === 'terminee') return attendreCorrection();
    if (r.exercice) return (await exercice()).eleve(r);
    const premiere = questions.findIndex((_q, n) => !valides.has(n)); courant = premiere >= 0 ? premiere : 0;
    afficher();
    demarrerChrono();
    surveillerFin();
  }

  // ---------- Enregistrement automatique ----------
  let delai = null;
  function enregistrer(immediat = false) {
    clearTimeout(delai);
    const faire = () => api.enregistrerCopie({ reponses, calculs, fini, valides: [...valides] });
    if (immediat) return faire();
    delai = setTimeout(faire, 700);
  }

  // ---------- Chrono ----------
  const finChrono = () => (session.dureeMin > 0 ? Date.parse(session.debut) + session.dureeMin * 60000 : null);
  function demarrerChrono() {
    clearInterval(minuterie);
    const maj = () => {
      const el = document.getElementById('chrono');
      const fin = finChrono();
      if (!el || !fin) return;
      const reste = Math.max(0, Math.round((fin - Date.now()) / 1000));
      el.textContent = `⏱ ${String(Math.floor(reste / 60)).padStart(2, '0')}:${String(reste % 60).padStart(2, '0')}`;
      el.classList.toggle('urgent', reste <= 300);
      if (reste === 0 && !fini) rendre('chrono');
    };
    maj();
    minuterie = setInterval(maj, 1000);
  }

  // ---------- Affichage d'une question ----------
  // QCM : l'énoncé, les réponses en grandes tuiles (2 × 2) et « Je ne sais pas » en haut à droite.
  // Calcul : l'énoncé, la réponse et, juste à côté, la calculatrice (chaque calcul est gardé avec la question).
  const JSP = 'jsp';
  const repondu = (n) => { const v = reponses[n]; return v !== undefined && v !== '' && !(Array.isArray(v) && !v.length); };
  const LETTRES = 'ABCDEFGH';
  const EQ = window.Equations;
  const sansEtiquette = (t, imgs) => (imgs && imgs.length ? String(t).split(' ; ').filter((x) => !/^image [A-H]$/.test(x)).join(' ; ') : t); // réponse « image seule »
  const etapesHtml = (t) => (EQ && EQ.etapesHtml ? EQ.etapesHtml(t) : echapper(t));
  const tm = (t) => (EQ && EQ.texteAvecMaths ? EQ.texteAvecMaths(t) : echapper(t)); // phrase : nombres, calculs et inconnues en écriture mathématique
  const maths = (t) => { try { return EQ && String(t || '').trim() ? EQ.rendre(String(t)).replace(/<mi>R<\/mi><mi>é<\/mi><mi>p<\/mi>/g, '<mtext>Rép</mtext>') : echapper(t); } catch { return echapper(t); } };
  // Palette d'écriture mathématique : [texte inséré, position du curseur, bouton (écriture « Word »)]
  const PALETTE = [['()/()', 1, 'a/b', 'Fraction'], ['^()', 2, 'x^2', 'Puissance'], ['_()', 2, 'x_1', 'Indice'], ['√()', 2, '√(x)', 'Racine'], ['()', 1, '(x)', 'Parenthèses'],
    ['×', 1, '×'], ['÷', 1, '÷'], ['−', 1, '−'], ['±', 1, '±'], ['=', 1, '='], ['≈', 1, '≈'], ['≠', 1, '≠'], ['≤', 1, '≤'], ['≥', 1, '≥'], ['π', 1, 'π'], ['°', 1, '°'], ['Δ', 1, 'Δ'], ['→', 1, '→'], ['⇒', 1, '⇒']];
  const paletteHtml = () => `<div class="palette-maths">${PALETTE.map(([t, pos, b, nom], i) => `<button type="button" data-palette="${i}" title="${echapper(nom || b)}">${b.length > 1 && EQ ? EQ.rendre(b) : echapper(b)}</button>`).join('')}</div>`;
  let champMaths = null; // dernier champ d'écriture mathématique utilisé (réponse ou brouillon)
  function insererMaths(champ, t, pos) {
    if (!champ) return;
    const d = champ.selectionStart ?? champ.value.length, f = champ.selectionEnd ?? champ.value.length;
    champ.value = champ.value.slice(0, d) + t + champ.value.slice(f);
    champ.focus(); champ.setSelectionRange(d + pos, d + pos);
    champ.dispatchEvent(new Event('input'));
  }
  const partieDe = (q) => q.partie || (q.type === 'qcm' ? 'cours' : 'automatisme');
  let sidImages = null; // relecture d'une évaluation passée
  const imagesChargees = new Map();
  async function chargerImages() {
    for (const img of app.querySelectorAll('img[data-image]')) {
      const n = img.dataset.image;
      if (!imagesChargees.has(n)) { const r = await api.image(n, sidImages); imagesChargees.set(n, r.ok ? r.url : ''); }
      img.src = imagesChargees.get(n);
    }
  }
  function numeros(marques) {
    return questions.map((q, n) => `${n > 0 && partieDe(questions[n - 1]) !== partieDe(q) ? '<span class="sep"></span>' : ''}<button data-aller="${n}" class="${marques ? (marques[n] ? 'juste' : 'faux') : reponses[n] === JSP ? 'jsp' : valides.has(n) ? 'valide' : repondu(n) ? 'repondu' : ''} ${n === courant ? 'courant' : ''}" title="Question ${n + 1}${valides.has(n) ? ' (validée)' : ''}">${valides.has(n) && !marques ? '✓' : ''}${n + 1}</button>`).join('');
  }
  function afficher() {
    const q = questions[courant];
    const nbRep = questions.filter((_q, n) => repondu(n)).length;
    const jsp = reponses[courant] === JSP;
    const coches = jsp ? [] : [].concat(reponses[courant] ?? []).map(Number);
    const zoneValider = `<div class="zone-valider">${valides.has(courant)
            ? `<span class="etat-valide">✔ Réponse validée${jsp ? ' (je ne sais pas)' : ''}</span><span class="aide">Tu peux encore la modifier : elle sera prise en compte.</span><button class="btn" id="valider">Question suivante →</button>`
            : `<span class="aide">${repondu(courant) ? 'Vérifie ta réponse, puis valide-la.' : 'Réponds, puis valide (ou clique sur « Je ne sais pas »).'}</span><button class="btn principal grand" id="valider" ${repondu(courant) ? '' : 'disabled'}>✔ Valider ma réponse</button>`}</div>`;
    app.innerHTML = `<div class="ev">
      <div class="entete"><h1>📝 ${echapper(session.titre)}</h1><span class="note">${valides.size} / ${questions.length} validée(s)</span>${finChrono() ? '<span class="chrono" id="chrono"></span>' : ''}</div>
      <div class="numeros">${numeros()}</div>
      <div class="zone-question">
        <div class="carte ${q.type}">
          <div class="carte-tete">
            <div><div class="partie">${partieDe(q) === 'cours' ? '📖 Cours' : '🔢 Automatisme'} — question ${courant + 1} / ${questions.length}</div><div class="notion">${echapper(q.notion)}</div></div>
            <button class="jsp ${jsp ? 'actif' : ''}" id="jsp" title="Tu ne connais pas la réponse : dis-le plutôt que de répondre au hasard">🤷 Je ne sais pas</button>
          </div>
          <div class="enonce">${tm(q.enonce)}</div>
          ${q.image ? `<img class="illus" data-image="${echapper(q.image)}" alt="Illustration de la question">` : ''}
          ${q.type === 'qcm'
            ? `<div class="tuiles">${q.choix.map((c, i) => { const im = q.choixImages && q.choixImages[i]; const t = im && /^image [A-H]$/.test(c) ? '' : c;
              return `<button class="tuile ${coches.includes(i) ? 'choisie' : ''} ${im ? 'avec-image' : ''}" data-choix="${i}"><span class="lettre">${LETTRES[i]}</span>${im ? `<img class="tuile-img" data-image="${echapper(im)}" alt="Réponse ${LETTRES[i]}">` : ''}${t ? `<span>${tm(t)}</span>` : ''}</button>`; }).join('')}</div>
               <p class="aide">${q.multiple ? 'Plusieurs réponses sont justes : clique sur toutes les bonnes.' : 'Une seule réponse est juste.'}</p>`
            : `<div class="ligne-calc">
                <div class="bloc-reponse">
                  <label for="rep">Ta réponse</label>
                  <div class="reponse-calc"><input id="rep" class="champ-maths" type="text" autocomplete="off" spellcheck="false" value="${jsp ? '' : echapper(reponses[courant] ?? '')}" placeholder="${jsp ? 'Je ne sais pas' : 'ex. 12,5 ou 3/4'}">${q.unite ? `<b>${echapper(q.unite)}</b>` : ''}</div>
                  <div class="apercu-maths" id="rep-apercu"></div>
                  <p class="aide">Écris le nombre (avec une virgule si besoin) ou une fraction (ex. 3/4).</p>
                  ${zoneValider}
                </div>
                ${session.calculatrice ? `<div class="cote-calc">
                  <div class="detail"><h3>📝 Détail de mes calculs <small>brouillon / justification</small></h3><div id="journal"></div>
                    <div class="saisie-brouillon"><div class="modes"><button type="button" class="${modeNote === 'maths' ? 'actif' : ''}" data-mode-note="maths" title="Écrire une équation, un calcul">∑ Maths</button><button type="button" class="${modeNote === 'texte' ? 'actif' : ''}" data-mode-note="texte" title="Écrire une phrase">Abc Texte</button></div>
                    <div class="apercu-maths" id="note-apercu"></div>
                    <div class="note-ligne"><input id="note" class="champ-maths" type="text" autocomplete="off" spellcheck="false" placeholder="${modeNote === 'maths' ? 'ex. 2x + 3 = 7   ·   x^2   ·   (a+b)/2' : 'Écrire une phrase de justification…'}"><button class="btn petit" id="ajout-note" title="Ajouter cette ligne au brouillon">＋</button></div>
                    ${paletteHtml()}</div></div>
                  <div class="calc">
                    <div class="ecran"><div class="saisie-rendu" id="saisie-rendu"></div><input id="saisie" type="text" autocomplete="off" spellcheck="false" placeholder="Tape un calcul, ex. 2,5 × (3 + 4)²"><div id="resultat" aria-live="polite"></div></div>
                    <div class="options"><span>Angles :</span><span class="bascule"><button id="mode-deg" class="${degres ? 'actif' : ''}">Degrés</button><button id="mode-rad" class="${degres ? '' : 'actif'}">Radians</button></span></div>
                    <div class="touches" id="touches">${M.TOUCHES}</div>
                    <button class="btn principal vers-reponse" id="vers-reponse" disabled>↳ Mettre le résultat dans ma réponse</button>
                  </div>
                </div>` : ''}
              </div>`}
          ${q.type === 'qcm' ? zoneValider : ''}
        </div>
      </div>
      <div class="pied">
        <button class="btn" id="prec" ${courant === 0 ? 'disabled' : ''}>← Précédente</button>
        <button class="btn" id="suiv" ${courant === questions.length - 1 ? 'disabled' : ''}>Suivante →</button>
        <span class="espace"></span>
        <button class="btn" id="rendre">Terminer l'évaluation…</button>
      </div>
    </div>`;
    brancher();
    afficherJournal();
    demarrerChrono();
    chargerImages();
    const champ = document.getElementById('rep'); if (champ && !jsp) champ.focus();
  }
  let dernierResultat = null, degres = true, repCalc = 0, modeNote = 'maths';
  const M = window.CalculatriceMoteur;
  function brancher() {
    const q = questions[courant];
    app.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => { courant = +b.dataset.aller; afficher(); }));
    document.getElementById('prec').addEventListener('click', () => { courant--; afficher(); });
    document.getElementById('suiv').addEventListener('click', () => { courant++; afficher(); });
    document.getElementById('rendre').addEventListener('click', () => afficherConfirmation());
    document.getElementById('valider').addEventListener('click', () => { if (repondu(courant)) valider(); });
    document.getElementById('jsp').addEventListener('click', () => {
      if (reponses[courant] === JSP) { reponses[courant] = q.multiple ? [] : ''; valides.delete(courant); enregistrer(); afficher(); return; }
      reponses[courant] = JSP; valider();
    });
    app.querySelectorAll('[data-choix]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.choix;
      if (q.multiple) {
        const actuel = reponses[courant] === JSP ? [] : [].concat(reponses[courant] ?? []).map(Number);
        reponses[courant] = actuel.includes(i) ? actuel.filter((x) => x !== i) : [...actuel, i].sort();
      } else reponses[courant] = i;
      valides.delete(courant); // réponse changée : à valider de nouveau
      enregistrer(); afficher();
    }));
    const rep = document.getElementById('rep');
    if (rep) {
      const apercuRep = () => { document.getElementById('rep-apercu').innerHTML = /[\/^√_]/.test(rep.value) ? maths(rep.value) : ''; };
      apercuRep();
      rep.addEventListener('focus', () => { champMaths = rep; });
      rep.addEventListener('input', () => {
        reponses[courant] = rep.value.trim(); apercuRep(); document.getElementById('jsp').classList.remove('actif');
        if (valides.has(courant)) { valides.delete(courant); majValider(); }
        const b = document.getElementById('valider'); if (b && !valides.has(courant)) b.disabled = !repondu(courant);
        majNumeros(); enregistrer();
      });
      rep.addEventListener('keydown', (e) => { if (e.key === 'Enter' && repondu(courant)) { e.preventDefault(); valider(); } });
    }
    // Calculatrice (la même que l'outil Calculatrice de Labo Élève)
    const saisie = document.getElementById('saisie');
    if (!saisie) return;
    const resultat = document.getElementById('resultat');
    const apercu = () => {
      document.getElementById('saisie-rendu').innerHTML = saisie.value.trim() ? maths(saisie.value) : '';
      const t = saisie.value.trim(); resultat.className = '';
      if (!t) { resultat.textContent = ''; return; }
      try { resultat.textContent = '= ' + M.formater(M.evaluer(t, { degres, rep: repCalc })); resultat.style.opacity = '.55'; } catch { resultat.textContent = ''; }
    };
    const inserer = (texte) => {
      const d = saisie.selectionStart ?? saisie.value.length, f = saisie.selectionEnd ?? saisie.value.length;
      if (!saisie.value && calculs.some((c) => c.q === courant && !c.note) && /^[+×÷−^²%]/.test(texte)) texte = 'Rép' + texte; // repart du résultat précédent
      saisie.value = saisie.value.slice(0, d) + texte + saisie.value.slice(f);
      const pos = d + texte.length; saisie.focus(); saisie.setSelectionRange(pos, pos); apercu();
    };
    const touches = document.getElementById('touches');
    touches.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    touches.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.i) return inserer(b.dataset.i);
      if (b.dataset.a === 'egal') calculer();
      else if (b.dataset.a === 'tout') { saisie.value = ''; resultat.textContent = ''; saisie.focus(); }
      else if (b.dataset.a === 'retour') { saisie.value = saisie.value.slice(0, -1); apercu(); saisie.focus(); }
    });
    saisie.addEventListener('input', apercu);
    saisie.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calculer(); }
      else if (e.key === 'Escape') { saisie.value = ''; resultat.textContent = ''; }
    });
    const mode = (deg) => { degres = deg; document.getElementById('mode-deg').classList.toggle('actif', deg); document.getElementById('mode-rad').classList.toggle('actif', !deg); apercu(); saisie.focus(); };
    document.getElementById('mode-deg').addEventListener('click', () => mode(true));
    document.getElementById('mode-rad').addEventListener('click', () => mode(false));
    document.getElementById('vers-reponse').addEventListener('click', () => {
      if (dernierResultat === null) return;
      rep.value = dernierResultat; reponses[courant] = dernierResultat; valides.delete(courant); majValider();
      document.getElementById('jsp').classList.remove('actif'); majNumeros(); enregistrer(); rep.focus();
    });
    // Détail des calculs : ajouter une phrase de justification, supprimer une ligne
    const note = document.getElementById('note');
    const apercuNote = () => { document.getElementById('note-apercu').innerHTML = modeNote === 'maths' && note.value.trim() ? maths(note.value) : ''; };
    note.addEventListener('input', apercuNote);
    note.addEventListener('focus', () => { champMaths = note; });
    champMaths = champMaths && document.body.contains(champMaths) ? champMaths : note;
    const ajouterNote = () => { const t = note.value.trim(); if (!t) return; calculs.push({ q: courant, note: true, ...(modeNote === 'maths' ? { math: true } : {}), expr: t.slice(0, 160), res: '', t: new Date().toISOString() }); note.value = ''; apercuNote(); afficherJournal(); enregistrer(); note.focus(); };
    app.querySelectorAll('[data-mode-note]').forEach((b) => b.addEventListener('click', () => {
      modeNote = b.dataset.modeNote;
      app.querySelectorAll('[data-mode-note]').forEach((x) => x.classList.toggle('actif', x === b));
      note.placeholder = modeNote === 'maths' ? 'ex. 2x + 3 = 7   ·   x^2   ·   (a+b)/2' : 'Écrire une phrase de justification…';
      apercuNote(); note.focus();
    }));
    app.querySelectorAll('[data-palette]').forEach((b) => {
      b.addEventListener('mousedown', (e) => e.preventDefault()); // garde le curseur dans le champ
      b.addEventListener('click', () => { const [t, pos] = PALETTE[+b.dataset.palette]; insererMaths(champMaths || note, t, pos); });
    });
    document.getElementById('ajout-note').addEventListener('click', ajouterNote);
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterNote(); } });
    document.getElementById('journal').addEventListener('click', (e) => {
      const b = e.target.closest('[data-suppr]'); if (!b) return;
      calculs.splice(+b.dataset.suppr, 1); afficherJournal(); enregistrer();
    });
  }
  // Valider : la question est marquée « validée », puis on passe à la suivante non validée ; tout est validé → confirmation.
  function valider() {
    valides.add(courant);
    enregistrer();
    const n = questions.length;
    for (let k = 1; k <= n; k++) { const j = (courant + k) % n; if (!valides.has(j)) { courant = j; afficher(); return; } }
    afficherConfirmation();
  }
  function majValider() {
    const z = app.querySelector('.zone-valider'); if (!z) return;
    z.innerHTML = `<span class="aide">Réponse modifiée : valide-la de nouveau.</span><button class="btn principal grand" id="valider" ${repondu(courant) ? '' : 'disabled'}>✔ Valider ma réponse</button>`;
    document.getElementById('valider').addEventListener('click', () => { if (repondu(courant)) valider(); });
    majNumeros();
  }
  // Page de confirmation avant de rendre la copie
  function afficherConfirmation() {
    const etatQ = (n) => (reponses[n] === JSP ? ['jsp', '🤷 Je ne sais pas'] : valides.has(n) ? ['valide', '✔ Validée'] : repondu(n) ? ['nonvalide', '⚠ Réponse non validée'] : ['vide', '✘ Sans réponse']);
    const manquantes = questions.filter((_q, n) => !valides.has(n)).length;
    app.innerHTML = `<div class="ev"><div class="entete"><h1>📝 ${echapper(session.titre)}</h1>${finChrono() ? '<span class="chrono" id="chrono"></span>' : ''}</div>
      <div class="zone-question"><div class="carte confirmation">
        <h2>${manquantes ? 'Tu n’as pas validé toutes les questions' : '🎉 Tu as répondu à toutes les questions'}</h2>
        <p class="aide">${manquantes ? `${manquantes} question(s) ne sont pas validées : tu peux y revenir, ou terminer quand même (ta réponse actuelle compte).` : 'Vérifie une dernière fois si tu veux, puis confirme que ton évaluation est terminée.'}</p>
        <div class="liste-confirmation">${questions.map((q, n) => { const [c, t] = etatQ(n); return `<button class="ligne-conf ${c}" data-revoir="${n}"><b>Question ${n + 1}</b><span>${t}</span></button>`; }).join('')}</div>
        <div class="rangee-conf"><button class="btn" id="revoir">← Revoir mes réponses</button><button class="btn principal grand" id="terminer">✔ Confirmer : mon évaluation est terminée</button></div>
      </div></div></div>`;
    demarrerChrono();
    app.querySelectorAll('[data-revoir]').forEach((b) => b.addEventListener('click', () => { courant = +b.dataset.revoir; afficher(); }));
    document.getElementById('revoir').addEventListener('click', () => { const p = questions.findIndex((_q, n) => !valides.has(n)); courant = p >= 0 ? p : 0; afficher(); });
    document.getElementById('terminer').addEventListener('click', () => rendre(true));
  }
  // Si le professeur termine l'évaluation (ou rend les corrections) pendant que l'élève répond : la correction s'affiche.
  function surveillerFin() {
    clearInterval(surveillance);
    surveillance = setInterval(async () => {
      if (fini) { clearInterval(surveillance); return; }
      const r = await api.maCorrection(session.sid);
      if (r.ok && r.correction) { fini = true; clearInterval(surveillance); clearInterval(minuterie); afficherCorrection(r.correction); }
    }, 6000);
  }
  function majNumeros() {
    const z = app.querySelector('.numeros'); if (z) { z.innerHTML = numeros(); z.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => { courant = +b.dataset.aller; afficher(); })); }
    const n = app.querySelector('.entete .note'); if (n) n.textContent = `${valides.size} / ${questions.length} validée(s)`;
  }
  // « = » : le calcul et son résultat s'ajoutent au détail de la question (le professeur voit ces étapes)
  function calculer() {
    const saisie = document.getElementById('saisie'), resultat = document.getElementById('resultat');
    const t = saisie.value.trim();
    if (!t) return;
    try {
      const v = M.evaluer(t, { degres, rep: repCalc });
      repCalc = v;
      dernierResultat = M.formater(v).replace(/[  \s]/g, '');
      resultat.style.opacity = '1'; resultat.className = '';
      resultat.textContent = '= ' + M.formater(v);
      document.getElementById('vers-reponse').disabled = false;
      calculs.push({ q: courant, expr: t, res: M.formater(v), t: new Date().toISOString() });
      saisie.value = '';
      afficherJournal(); enregistrer();
    } catch (e) {
      resultat.style.opacity = '1'; resultat.className = 'erreur'; resultat.textContent = e.message;
    }
  }
  function afficherJournal() {
    const j = document.getElementById('journal'); if (!j) return;
    const lignes = calculs.map((c, i) => ({ c, i })).filter((x) => x.c.q === courant && x.c.res !== 'erreur');
    j.innerHTML = lignes.length ? lignes.map(({ c, i }) => `<div class="ligne-detail ${c.note ? 'note-detail' : ''}">${c.note ? (c.math ? `<span class="maths">${maths(c.expr)}</span>` : `<span>✏️ ${echapper(c.expr)}</span>`) : `<span class="maths">${maths(c.expr)}</span><b>= ${echapper(c.res)}</b>`}<button class="suppr" data-suppr="${i}" title="Supprimer cette ligne">✕</button></div>`).join('')
      : '<p class="aide">Tes calculs s’ajoutent ici quand tu appuies sur « = ». Tu peux aussi écrire une phrase de justification.</p>';
    j.scrollTop = j.scrollHeight;
  }

  // ---------- Rendre la copie ----------
  async function rendre(chronoFini) {
    if (fini) return;
    fini = true;
    clearInterval(minuterie); clearInterval(surveillance);
    await enregistrer(true);
    // retour à la page des matières (la correction sera dans « Mes évaluations »)
    if (window.parent && window.parent.finEvaluationEleve) { ecran('✅', 'Copie rendue', 'Retour à tes matières…'); window.parent.finEvaluationEleve(); return; }
    attendreCorrection(chronoFini);
  }
  function attendreCorrection(chronoFini) {
    clearInterval(attenteCorrection);
    const verifier = async () => {
      let r = await api.maCorrection(session.sid);
      if (!r.ok) r = await api.maCorrection();
      if (r.ok && r.correction) { clearInterval(attenteCorrection); afficherCorrection(r.correction); return; }
      ecran('✅', chronoFini === 'chrono' ? 'Temps écoulé : copie rendue' : 'Copie rendue', session.correction === 'manuelle'
        ? 'Ton professeur va corriger ta copie : ta correction s\'affichera ici, et dans « 📝 Mes évaluations ».'
        : session.correction === 'fin-heure'
        ? 'Ta correction s\'affichera ici à la fin de l\'évaluation, pour toute la classe en même temps.'
        : 'Ta correction arrive dans quelques secondes…');
    };
    verifier();
    attenteCorrection = setInterval(verifier, 4000);
  }
  // « Pour réussir la prochaine fois » : ce qu'il faut revoir, et ce qui est acquis
  function encadreRevoir(c) {
    let b = c.bilan;
    if (!b) { // ancienne correction (sans bilan) : regroupement simple par notion
      const n = {};
      c.lignes.forEach((l) => { const x = (n[l.notion] = n[l.notion] || { notion: l.notion, total: 0, faux: 0, questions: [], conseils: [] }); x.total++; if (!l.juste) { x.faux++; x.questions.push(l.n + 1); } });
      b = { aRevoir: Object.values(n).filter((x) => x.faux), reussies: Object.values(n).filter((x) => !x.faux).map((x) => x.notion) };
    }
    if (!b.aRevoir.length && !b.reussies.length) return '';
    return `<div class="a-revoir">
      <h2>📌 Pour réussir la prochaine fois</h2>
      ${b.aRevoir.length ? b.aRevoir.map((x) => `<div class="revoir-notion">
        <div class="revoir-tete">🔁 <b>${echapper(x.notion)}</b> <span class="aide" style="margin:0">— ${x.faux} erreur${x.faux > 1 ? 's' : ''} sur ${x.total} · question${x.questions.length > 1 ? 's' : ''} ${x.questions.map((q) => `<a href="#q${q - 1}" data-q="${q - 1}">${q}</a>`).join(', ')}</span></div>
        ${x.conseils.length ? `<ul>${x.conseils.map((t) => `<li>${echapper(t)}</li>`).join('')}</ul>` : ''}
      </div>`).join('') : '<p>Rien à revoir : continue comme ça !</p>'}
      ${b.reussies.length ? `<p class="revoir-ok">✅ Tu maîtrises : ${b.reussies.map((t) => `<b>${echapper(t)}</b>`).join(', ')}</p>` : ''}
    </div>`;
  }
  function afficherCorrection(c) {
    if (c.modele === 'exercice') { exercice().then((x) => x.correction(c, { sid: sidImages || (session && session.sid) })); return; }
    const marques = c.lignes.map((l) => l.juste);
    app.innerHTML = `<div class="principal-zone" style="height:100vh">
      <div class="entete"><h1>📝 Correction — ${echapper(c.titre)}</h1></div>
      <div class="numeros">${numeros(marques)}</div>
      <div class="question">
        <p class="bilan">${c.faux ? `${c.faux} réponse${c.faux > 1 ? 's' : ''} à revoir sur ${c.total}` : `🎉 Tout est juste (${c.total} questions) !`}</p>
        ${encadreRevoir(c)}
        ${c.lignes.map((l) => `<div class="correction-ligne ${l.juste ? 'juste' : 'faux'}" id="q${l.n}">
          <div class="tete">${l.juste ? '✔' : '✘'} Question ${l.n + 1} · <span class="notion">${echapper(l.notion)}</span></div>
          <p>${tm(l.enonce)}</p>${l.image ? `<img class="illus petite" data-image="${echapper(l.image)}" alt="">` : ''}
          <div class="deux-colonnes">
            <div class="col-eleve">
              <div class="col-titre">Ta réponse</div>
              <div class="${l.juste ? 'bonne' : 'mauvaise'} val">${tm(sansEtiquette(l.reponse, l.imagesReponse))}${(l.imagesReponse || []).map((n) => `<img class="illus mini" data-image="${echapper(n)}" alt="">`).join('')}</div>
              ${l.calculs && l.calculs.filter((x) => x.res !== 'erreur').length ? `<div class="col-titre">Tes calculs</div><div class="calculs-col">${l.calculs.filter((x) => x.res !== 'erreur').map((x) => `<div>${x.note ? (x.math ? maths(x.expr) : `✏️ ${echapper(x.expr)}`) : `${maths(x.expr)} = ${echapper(x.res)}`}</div>`).join('')}</div>` : ''}
            </div>
            <div class="col-correction">
              <div class="col-titre">${l.juste ? '✔ C’est juste' : 'Bonne réponse'}</div>
              <div class="bonne val">${tm(sansEtiquette(l.attendu, l.imagesAttendu))}${(l.imagesAttendu || []).map((n) => `<img class="illus mini" data-image="${echapper(n)}" alt="">`).join('')}</div>
              ${l.explication ? (l.juste
                ? `<details class="explication-juste"><summary>💡 Voir l'explication</summary><div class="explication">${etapesHtml(l.explication)}</div></details>`
                : `<div class="col-titre">💡 Explication</div><div class="explication">${etapesHtml(l.explication)}</div>`) : ''}
            </div>
          </div>
        </div>`).join('')}
      </div></div>`;
    app.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => document.getElementById('q' + b.dataset.aller).scrollIntoView({ behavior: 'smooth' })));
    app.querySelectorAll('.a-revoir [data-q]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('q' + a.dataset.q).scrollIntoView({ behavior: 'smooth' }); }));
    chargerImages();
  }

  // ---------- Hors évaluation : relire ses corrections ----------
  async function mesEvaluations() {
    const r = await api.mesEvaluations();
    const liste = (r.ok && r.evaluations) || [];
    // Notes de la période, quand le professeur les a montrées
    const rn = api.mesNotes ? await api.mesNotes() : null;
    const notes = rn && rn.ok ? Object.entries(rn.periodes || {}).sort((x, y) => +x[0] - +y[0]).map(([, p]) => p) : [];
    const frn = (n) => (n === null || n === undefined ? '—' : String(Math.round(n * 100) / 100).replace('.', ','));
    const blocNotes = notes.length ? `<h2 class="mes-notes-titre">📊 Mes notes</h2>${notes.map((p) => `<details class="correction-ligne mes-notes" open><summary class="tete"><span>${echapper(p.nom)}</span><b class="${p.note >= 10 ? 'bonne' : 'note-basse'}">${frn(p.note)} / 20</b></summary>
      <div class="mes-notes-parties">${p.parties.map((x) => `<div class="mes-notes-partie"><div><b>${echapper(x.nom)}</b> : ${frn(x.score)} / ${frn(x.points)}</div><div class="barre"><span style="width:${x.score === null ? 0 : Math.max(0, Math.min(100, (x.score / x.points) * 100))}%"></span></div>${x.detail && x.detail.length ? `<ul>${x.detail.map((t) => `<li>${echapper(t)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>
      ${(p.competences || []).length ? `<div class="mes-comp"><b>🎯 Mes compétences</b>${p.competences.map((k) => `<div class="mes-comp-l"><span>${echapper(k.nom)}</span><span class="niv ${k.atteint ? 'ok' : 'ko'}">${echapper(k.niveau)} ${k.atteint ? '▲' : '▼'}</span><small>visé : ${echapper(k.vise)}</small></div>`).join('')}</div>` : ''}
      ${(p.objectifs || []).length ? `<div class="mes-comp"><b>🏁 Mes objectifs</b>${p.objectifs.map((o) => `<div class="mes-comp-l"><span>${echapper(o.nom)}${o.sequence ? ` <small>(${echapper(o.sequence)})</small>` : ''}</span><span>${{ atteint: '✅ Atteint', 'en-cours': '◐ En cours', 'non-atteint': '❌ Non atteint' }[o.etat] || ''}</span></div>`).join('')}</div>` : ''}
      ${p.appreciation ? `<p class="mes-notes-appr">💬 ${echapper(p.appreciation)}</p>` : ''}</details>`).join('')}<h2 class="mes-notes-titre">📝 Mes évaluations</h2>` : '';
    app.innerHTML = `<div class="principal-zone" style="height:100vh"><div class="entete"><h1>📝 Mes évaluations</h1></div><div class="question">${blocNotes}
      ${liste.length ? liste.map((x) => `<div class="correction-ligne" style="cursor:pointer" data-sid="${echapper(x.sid)}"><div class="tete">${echapper(x.titre)}</div>
        <p class="aide">${new Date(x.date).toLocaleDateString('fr-FR')} · ${x.corrigee ? 'correction disponible' : 'correction pas encore rendue par ton professeur'}</p></div>`).join('')
        : '<p class="aide">Aucune évaluation passée sur cet ordinateur pour l’instant.</p>'}
    </div></div>`;
    app.querySelectorAll('[data-sid]').forEach((d) => d.addEventListener('click', () => relire(d.dataset.sid)));
  }
  async function relire(sid) {
    const r = await api.maCorrection(sid);
    if (!r.ok) return ecran('⚠️', 'Évaluation', echapper(r.message));
    if (!r.correction) return ecran('⏳', 'Correction pas encore disponible', 'Ton professeur ne l’a pas encore rendue. Reviens plus tard.');
    sidImages = sid;
    if (r.correction.modele === 'exercice') return (await exercice()).correction(r.correction, { sid, retour: mesEvaluations });
    questions = r.correction.lignes.map((l) => ({ type: l.type, partie: l.partie }));
    afficherCorrection(r.correction);
    const t = app.querySelector('.entete'); if (t) t.insertAdjacentHTML('beforeend', '<button class="btn" id="retour-liste">← Mes évaluations</button>');
    document.getElementById('retour-liste')?.addEventListener('click', mesEvaluations);
  }

  window.evaluation = { etat: () => ({ courant, reponses, calculs, fini, questions }) }; // pour les tests
  charger();
})();
