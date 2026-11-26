// Côté élève : inscription (classe puis nom, une fois par matière), choix de la matière, puis thèmes de la classe.
// Les thèmes sont créés par l'enseignant (outils, documents, Digipads rangés par lui) ; tant qu'il n'en a pas
// créé, l'élève voit les thèmes proposés pour la matière (voir themes.js).
(function () {
  const ICONES_EXT = { py: '🐍', pdf: '📕', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', ods: '📊', csv: '📊', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', webp: '🖼' };
  const OUTIL_PAR_EXT = { cartes: 'cartes-memoire', py: 'python', docx: 'traitement-de-texte', txt: 'traitement-de-texte', xlsx: 'tableur', xls: 'tableur', ods: 'tableur', csv: 'tableur' };
  const initiales = (nom) => nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('');
  const nomNiveau = (id) => (NIVEAUX.find((n) => n.id === id) || {}).nom || '';
  const prenomDe = (nom) => { const mots = nom.split(/\s+/); const p = mots.find((m) => m !== m.toUpperCase()) || mots[mots.length - 1]; return p; };
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  // Une classe peut avoir plusieurs matières (ex. maths ET physique-chimie) : une carte par matière.
  const cartesMatieres = () => inscriptions.flatMap((ins) => { const l = matieresDe(ins); return (l.length ? l : [null]).map((m) => ({ ins, matiere: m })); });
  const matiereNoeud = (c, n) => (n.matiere && matieresDe(c).includes(n.matiere) ? n.matiere : matieresDe(c)[0] || null);

  etat.eleve = null;            // inscription active : { classeId, classe, matiere, prof, eleveId, nom, niveau }
  let inscriptions = [];        // toutes les matières de l'élève sur ce PC (année en cours)
  let anciennes = [];           // classes clôturées où l'élève était inscrit (« Mes années précédentes »)
  etat.archive = null;          // classe d'une année précédente affichée (lecture seule)
  let classes = [];
  let chemin = [];              // thèmes / dossiers ouverts

  function montrer(vue) {
    for (const id of ['choix-eleve', 'choix-niveau', 'accueil', 'vue-outil', 'espace-prof']) $('#' + id).hidden = id !== vue;
    document.body.classList.toggle('mode-themes', !!(etat.eleve || etat.archive) && !etat.classe?.examen);
  }
  // Bouton « Mes années précédentes » sous les pages de choix (s'il y a des classes clôturées).
  function boutonAnnees() {
    if (!anciennes.length) return;
    $('#eleve-continuer').innerHTML = `<button class="secondaire bouton-annees" id="btn-annees">📚 Mes années précédentes <small>(${pluriel(anciennes.length, 'classe')})</small></button>`;
    $('#btn-annees').addEventListener('click', afficherAnnees);
  }

  // ---------- Démarrage ----------
  window.demarrerIdentification = async function () {
    // Élève déjà inscrit sur cet ordinateur : connexion automatique.
    const memo = await api.classes.identite();
    anciennes = (memo && memo.anciennes) || [];
    etat.archive = null;
    if (memo && memo.inscriptions && memo.inscriptions.length) {
      inscriptions = memo.inscriptions;
      if (cartesMatieres().length > 1) afficherMatieres();
      else entrer(inscriptions[0]);
      return true;
    }
    if (memo && memo.indisponible) return false; // dossier partagé inaccessible : accueil normal, sans classe
    inscriptions = [];
    classes = await api.classes.lister();
    if (!classes.length && !anciennes.length) return false;
    afficherIdentification(); // nouvelle année : nouvelles classes, et accès aux anciennes
    return true;
  };

  function preparerChoix(titre, sousTitre, { retour = false, sansClasse = false, recherche = false } = {}) {
    montrer('choix-eleve');
    $('#eleve-titre').textContent = titre;
    $('#eleve-sous-titre').textContent = sousTitre;
    $('#eleve-continuer').innerHTML = '';
    $('#btn-eleve-retour').hidden = !retour;
    $('#btn-sans-classe').hidden = !sansClasse;
    $('#recherche-eleve').hidden = !recherche;
  }

  // ---------- 1. Choix de la matière ----------
  function afficherMatieres() {
    const prenom = inscriptions[0] ? prenomDe(inscriptions[0].nom) : '';
    etat.archive = null;
    preparerChoix(`Bonjour ${prenom} ! Quelle matière ?`, 'Choisis la matière du cours : tu retrouveras les thèmes préparés par ton professeur.');
    const cartes = cartesMatieres();
    $('#eleve-choix').innerHTML = `<div class="rangee-niveaux rangee-matieres">${cartes.map(({ ins, matiere }, i) => {
      const m = infoMatiere(matiere);
      return `<button class="carte-niveau carte-matiere" data-matiere="${ins.classeId}|${matiere || ''}" style="--c:${m.couleur}; animation-delay:${i * 50}ms">
        <span class="ic-matiere">${m.icone}</span>
        <span class="sigle">${echapper(matiere ? m.nom : ins.classe)}</span>
        <span class="nom-niveau">${echapper([ins.prof, ins.classe].filter(Boolean).join(' · '))}</span>
      </button>`;
    }).join('')}
      <button class="carte-niveau carte-matiere ajout" data-ajout-matiere style="--c:#64748b; animation-delay:${cartes.length * 50}ms">
        <span class="ic-matiere">＋</span><span class="sigle">Nouvelle matière</span><span class="nom-niveau">Premier cours avec un autre professeur</span>
      </button></div>`;
    $('#eleve-choix').querySelectorAll('[data-matiere]').forEach((b) => b.addEventListener('click', () => {
      const [classeId, matiere] = b.dataset.matiere.split('|');
      entrer(inscriptions.find((x) => x.classeId === classeId), matiere || null);
    }));
    $('#eleve-choix').querySelector('[data-ajout-matiere]').addEventListener('click', () => afficherIdentification());
    boutonAnnees();
  }
  window.afficherMatieres = afficherMatieres;

  // ---------- Mes années précédentes : classes clôturées, en lecture ----------
  const retourAnnees = () => (inscriptions.length ? (cartesMatieres().length > 1 ? afficherMatieres() : entrer(inscriptions[0])) : afficherIdentification());
  async function afficherAnnees() {
    const memo = await api.classes.identite();
    anciennes = (memo && memo.anciennes) || anciennes;
    etat.archive = null;
    preparerChoix('📚 Mes années précédentes', 'Les classes que tes professeurs ont clôturées : relis leurs documents, Digipads et travaux (sans rien modifier).', { retour: true });
    $('#btn-eleve-retour').textContent = inscriptions.length ? '← Retour à mes matières' : '← Retour';
    $('#btn-eleve-retour').onclick = retourAnnees;
    if (!anciennes.length) { $('#eleve-choix').innerHTML = '<p class="vide">Aucune classe clôturée pour l\'instant.</p>'; return; }
    // Par année (la plus récente d'abord), puis une carte par matière.
    const annees = [...new Set(anciennes.map((a) => a.archive.annee))].sort().reverse();
    let n = 0;
    $('#eleve-choix').innerHTML = annees.map((annee) => `<h3 class="annee-eleve">🗄 Année ${echapper(annee)}</h3>
      <div class="rangee-niveaux rangee-matieres">${anciennes.filter((a) => a.archive.annee === annee).flatMap((ins) => { const l = matieresDe(ins); return (l.length ? l : [null]).map((matiere) => {
        const m = infoMatiere(matiere);
        return `<button class="carte-niveau carte-matiere ancienne" data-ancienne="${ins.classeId}|${matiere || ''}" style="--c:${m.couleur}; animation-delay:${n++ * 40}ms">
          <span class="ic-matiere">${m.icone}</span><span class="sigle">${echapper(matiere ? m.nom : ins.classe)}</span>
          <span class="nom-niveau">${echapper([ins.prof, ins.classe].filter(Boolean).join(' · '))}</span></button>`;
      }); }).join('')}</div>`).join('');
    $('#eleve-choix').querySelectorAll('[data-ancienne]').forEach((b) => b.addEventListener('click', () => {
      const [classeId, matiere] = b.dataset.ancienne.split('|');
      ouvrirAncienne(anciennes.find((x) => x.classeId === classeId), matiere || null);
    }));
  }
  window.afficherAnnees = afficherAnnees;
  function ouvrirAncienne(ins, matiere) {
    if (!ins) return;
    etat.archive = { ...ins, matiere };
    chemin = [];
    montrer('accueil');
    $('#salutation').textContent = `Bonjour ${prenomDe(ins.nom)} !`;
    rafraichirMaClasse();
  }

  // ---------- 2. Inscription : classe puis nom ----------
  async function afficherIdentification() {
    classes = await api.classes.lister();
    const inscrit = new Set(inscriptions.map((i) => i.classeId));
    // Une seule classe par professeur et par matière : on ne propose pas les autres classes déjà couvertes.
    const cles = (x) => (matieresDe(x).length ? matieresDe(x) : ['']).map((m) => `${x.profId}|${m}`);
    const couvert = new Set(inscriptions.flatMap(cles));
    const proposees = classes.filter((c) => !inscrit.has(c.id) && !cles(c).some((k) => couvert.has(k)));
    etat.archive = null;
    if (inscriptions.length) preparerChoix('Nouvelle matière : quelle est ta classe ?', 'Choisis la classe de ce cours, puis ton nom.', { retour: true });
    else if (anciennes.length) preparerChoix('Nouvelle année : quelle est ta classe ?', 'Choisis ta nouvelle classe, puis ton nom. Tes anciennes classes restent dans « Mes années précédentes ».');
    else preparerChoix('Bonjour ! Quelle est ta classe ?', 'Choisis ta classe, puis ton nom.', { sansClasse: true });
    boutonAnnees();
    $('#btn-eleve-retour').textContent = '← Retour à mes matières';
    $('#btn-eleve-retour').onclick = () => (cartesMatieres().length > 1 || !etat.eleve ? afficherMatieres() : entrer(etat.eleve, etat.eleve.matiere));
    // un professeur qui utilise un autre dossier Nuage : l'élève colle son lien, ses classes apparaissent
    const ajoutLien = window.ajouterLienNuage ? '<div class="ajout-lien"><button type="button" class="secondaire" id="btn-ajout-lien">☁ Ajouter le lien Nuage d’un autre professeur</button><span>Ta classe n’est pas dans la liste ? Ton professeur t’a peut-être donné un lien Nuage.</span></div>' : '';
    const brancherAjout = () => $('#btn-ajout-lien')?.addEventListener('click', async () => { if (await window.ajouterLienNuage()) afficherIdentification(); });
    if (!proposees.length) {
      $('#eleve-choix').innerHTML = '<p class="vide">Aucune autre classe pour l\'instant. Ton professeur doit d\'abord créer sa classe dans Labo Prof.</p>' + ajoutLien;
      brancherAjout();
      return;
    }
    $('#eleve-choix').innerHTML = `<div class="rangee-niveaux">${proposees.map((c, i) => {
      const liste = matieresDe(c);
      const m = liste.length ? infoMatiere(liste[0]) : null;
      const n = NIVEAUX.find((x) => x.id === c.niveau);
      return `<button class="carte-niveau" data-classe="${c.id}" style="--c:${m ? m.couleur : n ? n.couleur : '#5865f2'}; animation-delay:${i * 40}ms">
        <span class="sigle">${liste.map((x) => infoMatiere(x).icone).join('')}${liste.length ? ' ' : ''}${echapper(c.nom)}</span>
        <span class="nom-niveau">${echapper([liste.map((x) => infoMatiere(x).nom).join(' + '), c.prof].filter(Boolean).join(' · ') || nomNiveau(c.niveau) || 'Classe')}</span>
        <span class="nb">${pluriel(c.eleves.length, 'élève')}</span></button>`;
    }).join('')}</div>`;
    $('#eleve-choix').insertAdjacentHTML('beforeend', ajoutLien); brancherAjout();
    $('#eleve-choix').querySelectorAll('[data-classe]').forEach((b) => b.addEventListener('click', () => afficherNoms(classes.find((c) => c.id === b.dataset.classe))));
  }

  function afficherNoms(classe) {
    const icones = matieresDe(classe).map((x) => infoMatiere(x).icone).join('');
    preparerChoix(`${icones ? icones + ' ' : ''}${classe.nom}`, 'Clique sur ton nom.', { retour: true, recherche: classe.eleves.length >= 12 });
    $('#btn-eleve-retour').textContent = '← Changer de classe';
    $('#btn-eleve-retour').onclick = () => afficherIdentification();
    const champ = $('#recherche-eleve');
    champ.value = '';
    // Déjà inscrit dans une autre matière : son nom est proposé en premier.
    const dejaNoms = new Set(inscriptions.map((i) => normaliser(i.nom)));
    const dessiner = () => {
      const q = normaliser(champ.value);
      const eleves = classe.eleves.filter((e) => normaliser(e.nom).includes(q))
        .sort((a, b) => (dejaNoms.has(normaliser(b.nom)) - dejaNoms.has(normaliser(a.nom))));
      $('#eleve-choix').innerHTML = eleves.length
        ? `<div class="choix-eleves">${eleves.map((e, i) => `<button class="carte-eleve ${dejaNoms.has(normaliser(e.nom)) ? 'suggere' : ''}" data-eleve="${e.id}" style="animation-delay:${Math.min(i, 20) * 15}ms"><span class="pastille-nom">${echapper(initiales(e.nom))}</span><span>${echapper(e.nom)}</span></button>`).join('')}</div>
          <p class="note-prof" style="text-align:center">Attention : ton choix est <b>définitif</b> sur cet ordinateur. Seul ton professeur pourra le changer.</p>`
        : `<p class="vide">${classe.eleves.length ? 'Aucun nom ne correspond.' : 'Ton professeur n\'a pas encore ajouté d\'élèves dans cette classe.'}</p>`;
      $('#eleve-choix').querySelectorAll('[data-eleve]').forEach((b) => b.addEventListener('click', () => choisirEleve(classe, classe.eleves.find((e) => e.id === b.dataset.eleve))));
    };
    champ.oninput = dessiner;
    dessiner();
    if (!champ.hidden) champ.focus();
  }

  $('#btn-sans-classe').addEventListener('click', async () => {
    const r = await api.classes.identifier(null);
    if (!r.ok) return toast('Impossible', r.message, 'erreur');
    etat.eleve = null;
    montrer(etat.niveau ? 'accueil' : 'choix-niveau');
    if (etat.niveau) rafraichirAccueil(); else afficherChoixNiveau();
    rafraichirMaClasse();
  });

  async function choisirEleve(classe, eleve) {
    if (!confirm(`Tu es bien ${eleve.nom} ?\n\nCe choix est définitif sur cet ordinateur : seul ton professeur pourra le changer.`)) return;
    const r = await api.classes.identifier({ classeId: classe.id, eleveId: eleve.id });
    if (!r.ok) return toast('Impossible de choisir ce nom', r.message, 'erreur');
    inscriptions = [...inscriptions.filter((i) => i.classeId !== r.eleve.classeId), r.eleve];
    // Classe à plusieurs matières : l'élève choisit la matière du cours.
    if (matieresDe(r.eleve).length > 1) afficherMatieres(); else entrer(r.eleve);
  }

  // ---------- 3. Accueil de la matière : ses thèmes ----------
  async function entrer(ins, matiere = null) {
    const r = await api.classes.identifier({ classeId: ins.classeId, eleveId: ins.eleveId }); // matière active + signal à l'enseignant
    if (!r.ok) { toast('Impossible d\'ouvrir cette matière', r.message, 'erreur'); return; }
    const liste = matieresDe(r.eleve);
    ouvrirMatiere({ ...r.eleve, matiere: liste.includes(matiere) ? matiere : liste[0] || r.eleve.matiere || null });
  }
  function ouvrirMatiere(eleve) {
    etat.eleve = eleve;
    etat.archive = null;
    etat.niveau = eleve.niveau || 'tous'; // le niveau vient de la classe
    etat.filtre = 'tous';
    chemin = [];
    montrer('accueil');
    $('#salutation').textContent = `Bonjour ${prenomDe(eleve.nom)} !`;
    rafraichirAccueil();
    rafraichirMaClasse();
  }

  // Thèmes de la classe, ou thèmes proposés pour la matière si l'enseignant n'en a pas encore créé.
  // Classe à plusieurs matières : seulement les thèmes de la matière choisie.
  function arborescence(classe, matiere = null) {
    const liste = matieresDe(classe);
    const m = liste.includes(matiere) ? matiere : liste[0] || null;
    const contenu = liste.length > 1 ? (classe.contenu || []).filter((n) => matiereNoeud(classe, n) === m) : classe.contenu || [];
    if (contenu.some((n) => n.type === 'dossier')) return contenu;
    const defaut = themesParDefaut(m).map((t, i) => ({
      id: `defaut-${i}`, type: 'dossier', nom: t.nom, icone: t.icone, couleur: t.couleur,
      enfants: t.outils.map((o) => ({ id: `defaut-${i}-${o}`, type: 'outil', outil: o })),
    }));
    return [...defaut, ...contenu];
  }
  const outilDe = (n) => etat.outils.find((o) => o.id === n.outil);
  // Un élément est-il visible ? (outil installé et autorisé, thème non vide)
  function visible(n) {
    if (n.type === 'outil') { const o = outilDe(n); return !!o && outilAutorise(o); }
    if (n.type === 'dossier') return (n.enfants || []).some(visible);
    return true;
  }
  function compter(n) {
    const enfants = (n.enfants || []).filter(visible);
    const outils = enfants.filter((x) => x.type === 'outil').length, autres = enfants.length - outils;
    return [outils && pluriel(outils, 'outil'), autres && pluriel(autres, 'document')].filter(Boolean).join(' · ') || 'Vide';
  }
  const iconeElement = (n) => (n.type === 'dossier' ? n.icone || '📁' : n.type === 'pad' ? '🧩' : n.type === 'travail' ? '📝' : ICONES_EXT[(n.nom.split('.').pop() || '').toLowerCase()] || '📄');

  let nbEvaluations = 0, entrainementOuvert = false; // évaluations de maths déjà passées sur ce PC (bouton « Mes évaluations »)
  async function rafraichirMaClasse() {
    try { const r = await api.evaluations.mesEvaluations(); nbEvaluations = r.ok ? r.evaluations.length : 0; } catch { nbEvaluations = 0; }
    try { const n = api.evaluations.mesNotes ? await api.evaluations.mesNotes() : null; if (n && n.ok) nbEvaluations += Object.keys(n.periodes || {}).length; } catch { /* notes indisponibles */ } // notes montrées par le professeur
    try { const x = api.evaluations.entrContenu ? await api.evaluations.entrContenu() : null; entrainementOuvert = !!(x && x.ok && x.chapitres.length); } catch { entrainementOuvert = false; } // entraînement ouvert par le professeur
    const zone = $('#ma-classe');
    const enExamen = !!etat.classe?.examen;
    if (enExamen) etat.archive = null; // un examen l'emporte sur la consultation des années précédentes
    const vue = etat.archive || etat.eleve; // classe affichée : année en cours, ou année précédente (lecture seule)
    $('#btn-niveau').hidden = !!vue;
    document.body.classList.toggle('mode-themes', !!vue && !enExamen);
    const phrase = document.querySelector('.bandeau p');
    if (!phrase.dataset.origine) phrase.dataset.origine = phrase.textContent;
    phrase.textContent = etat.archive ? 'Année précédente : relis les documents, Digipads et travaux de cette classe (sans les modifier).'
      : vue && !enExamen ? 'Choisis un thème : tu y trouveras les outils et les documents préparés par ton professeur.' : phrase.dataset.origine;
    if (!vue || enExamen) { zone.hidden = true; if (etat.eleve) api.focus.actualiser(); return; }
    const classe = await api.classes.lire(vue.classeId);
    classeAffichee = classe;
    if (!classe) { zone.hidden = true; document.body.classList.remove('mode-themes'); return; }
    // La classe active vient d'être clôturée par le professeur : retour au choix des matières.
    if (classe.archive && !etat.archive) { etat.eleve = null; toast('🗄 Classe clôturée', `Ton professeur a clôturé « ${classe.nom} ». Tu la retrouves dans « Mes années précédentes ».`, 'info'); window.demarrerIdentification(); return; }
    api.focus.actualiser(); // l'enseignant a peut-être changé le réglage « mode focus » de la classe
    zone.hidden = false;
    const matiere = matieresDe(classe).includes(vue.matiere) ? vue.matiere : matieresDe(classe)[0] || null;
    const m = infoMatiere(matiere);
    // Thème / dossier courant
    let liste = arborescence(classe, matiere);
    const fil = [];
    for (const id of chemin) {
      const d = liste.find((n) => n.id === id && n.type === 'dossier');
      if (!d) break;
      fil.push(d); liste = d.enfants || [];
    }
    chemin = fil.map((d) => d.id);
    const visibles = liste.filter(visible);
    const themes = visibles.filter((n) => n.type === 'dossier');
    const outils = visibles.filter((n) => n.type === 'outil');
    const docs = visibles.filter((n) => n.type !== 'dossier' && n.type !== 'outil');
    const courant = fil[fil.length - 1];
    themeCourant = courant || null; // pour le bouton « Retour » de la barre d'un outil
    const autres = cartesMatieres().length > 1;

    zone.innerHTML = `
      <div class="entete-matiere" style="--c:${m.couleur}">
        <span class="ic-matiere">${m.icone}</span>
        <div class="titres-matiere"><h2>${echapper(matiere ? m.nom : classe.nom)}</h2>
          <p>${echapper([classe.prof, classe.nom].filter(Boolean).join(' · '))}${classe.horsLigne ? ' · hors ligne' : ''}${etat.archive ? ` · 🗄 année ${echapper(classe.archive ? classe.archive.annee : etat.archive.archive.annee)} (lecture seule)` : ''}</p></div>
        <span class="espace" style="flex:1"></span>
        ${etat.archive ? '<button class="secondaire" id="btn-retour-annees">← Mes années précédentes</button>'
          : `${autres ? '<button class="secondaire" id="btn-changer-matiere">⇄ Changer de matière</button>' : '<button class="lien" id="btn-ajout-matiere">+ Ajouter une matière</button>'}
        ${anciennes.length ? '<button class="lien" id="btn-annees-entete">📚 Mes années précédentes</button>' : ''}
        ${nbEvaluations ? '<button class="lien" id="btn-mes-evals">📝 Mes évaluations</button>' : ''}${entrainementOuvert ? '<button class="lien" id="btn-entrainement">🏋️ S’entraîner</button>' : ''}
        <button class="lien" id="btn-changer-eleve" title="Réservé au professeur">🔒 Changer d'élève</button>`}
      </div>
      ${courant ? `<div class="barre-retour"><button class="bouton-retour" id="btn-retour-theme" title="Revenir en arrière (touche Retour arrière, Alt + ← ou bouton « précédent » de la souris)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>${fil.length > 1 ? `Retour : ${echapper(fil[fil.length - 2].nom)}` : 'Retour aux thèmes'}</button>
        <div class="fil"><button data-aller="">🏠 Thèmes</button>${fil.map((d, i) => (i === fil.length - 1 ? `<span>›</span><span class="courant">${echapper(d.nom)}</span>` : `<span>›</span><button data-aller="${d.id}">${echapper(d.nom)}</button>`)).join('')}</div></div>
        <h3 class="titre-theme" style="--c:${courant.couleur || m.couleur}"><span>${iconeElement(courant)}</span>${echapper(courant.nom)}</h3>` : ''}
      ${themes.length ? `<div class="grille-themes">${themes.map((t, i) => `
        <button class="tuile-theme" data-theme="${t.id}" style="--c:${t.couleur || m.couleur}; animation-delay:${i * 40}ms">
          <span class="ic">${iconeElement(t)}</span><span class="nom">${echapper(t.nom)}</span><span class="nb">${compter(t)}</span>
        </button>`).join('')}</div>` : ''}
      ${outils.length ? `<div class="grille grille-theme">${outils.map((n, i) => htmlCarte(outilDe(n), i, false)).join('')}</div>` : ''}
      ${docs.length ? `${courant || themes.length ? `<h4 class="sous-titre-theme">${courant ? 'Documents' : 'Aussi dans ta classe'}</h4>` : ''}
        <div class="elements">${docs.map((n) => `
        <div class="element ${n.type}" data-id="${n.id}" role="button" tabindex="0">
          <span class="ic">${iconeElement(n)}</span>
          <div style="min-width:0"><div class="nom-el">${echapper(n.nom)}</div>
            <div class="meta-el">${n.type === 'pad' ? 'Digipad du professeur' : n.type === 'travail' ? (etat.archive ? 'Travail · relire ma copie' : 'Travail à rendre · à remplir ici') : 'Document · ouvrir et compléter'}</div></div>
        </div>`).join('')}</div>` : ''}
      ${!visibles.length ? `<p class="vide-classe">${courant ? 'Ce thème est vide pour l\'instant.' : 'Ton professeur n\'a encore rien préparé ici.'}</p>` : ''}`;

    $('#btn-changer-eleve')?.addEventListener('click', changerEleve);
    $('#btn-retour-annees')?.addEventListener('click', afficherAnnees);
    $('#btn-retour-theme')?.addEventListener('click', () => window.retourTheme());
    $('#btn-annees-entete')?.addEventListener('click', afficherAnnees);
    $('#btn-mes-evals')?.addEventListener('click', () => ouvrirOutil('evaluation-maths'));
    $('#btn-entrainement')?.addEventListener('click', () => ouvrirOutil('evaluation-maths', { mode: 'entrainement' }));
    $('#btn-changer-matiere')?.addEventListener('click', afficherMatieres);
    $('#btn-ajout-matiere')?.addEventListener('click', () => afficherIdentification());
    zone.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => { const id = b.dataset.aller; chemin = id ? chemin.slice(0, chemin.indexOf(id) + 1) : []; rafraichirMaClasse(); }));
    zone.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => { chemin = [...chemin, b.dataset.theme]; rafraichirMaClasse(); }));
    zone.querySelectorAll('.grille-theme .carte').forEach((c) => {
      c.addEventListener('click', () => ouvrirOutil(c.dataset.id));
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirOutil(c.dataset.id); } });
    });
    zone.querySelectorAll('.element').forEach((el) => {
      const n = docs.find((x) => x.id === el.dataset.id);
      const ouvrir = () => ouvrirElement(classe, n);
      el.addEventListener('click', ouvrir);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } });
    });
  }
  window.rafraichirMaClasse = rafraichirMaClasse;

  // ---------- Retour en arrière : un niveau de thème à la fois ----------
  let themeCourant = null;
  // Remonte d'un thème (ou revient aux années précédentes) ; false s'il n'y a rien au-dessus.
  window.retourTheme = () => {
    if (!(etat.eleve || etat.archive) || $('#accueil').hidden) return false;
    if (chemin.length) { chemin = chemin.slice(0, -1); rafraichirMaClasse(); return true; }
    if (etat.archive) { afficherAnnees(); return true; }
    return false;
  };
  // Texte du bouton « Retour » quand un outil est ouvert : le thème d'où vient l'élève.
  window.libelleRetour = () => ((etat.eleve || etat.archive) ? (themeCourant ? `Retour : ${themeCourant.nom}` : 'Retour aux thèmes') : null);

  // Pour « Côte à côte » : tout ce que le professeur a rangé dans les thèmes de la matière, groupé par thème.
  let classeAffichee = null;
  window.elementsClassePourVolet2 = () => {
    if (!(etat.archive || etat.eleve) || etat.classe?.examen || !classeAffichee) return null;
    const groupes = [];
    const classe = classeAffichee;
    const parcourir = (noeuds, nom) => {
      const elements = [], sousThemes = [];
      for (const n of noeuds) {
        if (!visible(n)) continue;
        if (n.type === 'dossier') sousThemes.push(n);
        else if (n.type === 'outil') elements.push({ titre: outilDe(n).titre, outil: outilDe(n) });
        else if (n.type === 'pad') elements.push({ titre: n.nom, icone: '🧩', couleur: '#0891b2', src: n.lien });
        else if (n.type === 'travail') { const t = etat.outils.find((o) => o.id === 'travail-pdf'); if (t) elements.push({ titre: n.nom, icone: '📝', charger: () => ({ outil: t, parametres: { mode: 'eleve', classe: classe.id, travail: n.id } }) }); }
        else elements.push({ titre: n.nom, icone: iconeElement(n), charger: () => chargerDocument(classe, n) });
      }
      if (elements.length) groupes.push({ groupe: nom, elements });
      for (const d of sousThemes) parcourir(d.enfants || [], d.nom); // un groupe par thème, dans l'ordre du professeur
    };
    parcourir(arborescence(classe, (etat.archive || etat.eleve).matiere), 'Ma classe');
    const doc = etat.outils.find((o) => o.id === 'mes-documents');
    const dejaLa = groupes.some((g) => g.elements.some((e) => e.outil && e.outil.id === 'mes-documents'));
    if (doc && outilAutorise(doc) && !dejaLa) groupes.push({ groupe: 'Mes documents', elements: [{ titre: doc.titre, outil: doc }] });
    return groupes;
  };
  async function chargerDocument(classe, n) {
    const r = await api.classes.recuperer(classe.id, n.id);
    if (!r.ok) { toast('Document indisponible', r.message, 'erreur'); return null; }
    const ext = /\.cartes\.csv$/i.test(r.nom) ? 'cartes' : (r.nom.split('.').pop() || '').toLowerCase(); // paquet de cartes mémoire
    const outil = etat.outils.find((o) => o.id === (OUTIL_PAR_EXT[ext] || 'mes-documents'));
    return outil ? { outil, parametres: { ouvrir: r.nom } } : null;
  }

  // Un enseignant, sur le PC de l'élève, efface tous ses noms (toutes les matières) avec son mot de passe.
  async function changerEleve() {
    const v = await window.saisirProf('Changer d\'élève sur cet ordinateur', [{ label: 'Mot de passe d\'un professeur', type: 'password' }], 'Valider');
    if (!v) return;
    const r = await api.classes.libererCePc(v[0]);
    if (!r.ok) return toast('Changement refusé', r.message, 'erreur');
    etat.eleve = null;
    inscriptions = [];
    anciennes = [];
    etat.archive = null;
    $('#salutation').textContent = 'Bonjour !';
    toast('Ordinateur libéré', 'Un élève peut maintenant choisir son nom.', 'info');
    afficherIdentification();
  }

  // L'enseignant a déconnecté ce PC de SA classe : les autres matières restent.
  api.suivi.surDeconnexion(async ({ message }) => {
    etat.eleve = null;
    try { $('#cadre').src = 'about:blank'; } catch { /* ignoré */ }
    if (window.fermerVolet2) window.fermerVolet2(true);
    etat.outilOuvert = null;
    $('#salutation').textContent = 'Bonjour !';
    inscriptions = [];
    if (!(await window.demarrerIdentification())) afficherIdentification();
    toast('Déconnecté par ton professeur', message, 'erreur');
  });

  // Examen lancé dans une autre de tes classes : on bascule dans cette matière.
  api.classes.surActive((eleve) => {
    if (etat.eleve && etat.eleve.classeId === eleve.classeId) return;
    inscriptions = [...inscriptions.filter((i) => i.classeId !== eleve.classeId), eleve];
    ouvrirMatiere(eleve);
  });

  async function ouvrirElement(classe, n) {
    if (n.type === 'pad') return ouvrirPad(n);
    if (n.type === 'travail') return ouvrirOutil('travail-pdf', { mode: 'eleve', classe: classe.id, travail: n.id });
    // Document : copié dans « Mes documents », puis ouvert dans le bon outil.
    const r = await api.classes.recuperer(classe.id, n.id);
    if (!r.ok) return toast('Document indisponible', r.message, 'erreur');
    const ext = /\.cartes\.csv$/i.test(r.nom) ? 'cartes' : (r.nom.split('.').pop() || '').toLowerCase(); // paquet de cartes mémoire
    ouvrirOutil(OUTIL_PAR_EXT[ext] || 'mes-documents', { ouvrir: r.nom });
  }

  function ouvrirPad(n) {
    etat.outilOuvert = { id: 'pad-classe', titre: n.nom };
    $('#outil-titre').textContent = n.nom;
    $('#outil-icone').textContent = '🧩';
    $('#outil-icone').style.setProperty('--c', '#0891b2');
    $('#cadre').src = n.lien;
    $('#accueil').hidden = true;
    $('#vue-outil').hidden = false;
    document.title = `${n.nom} — Labo Élève`;
  }

  // Les thèmes se mettent à jour tout seuls (l'enseignant peut ajouter un document pendant la séance).
  setInterval(() => { if ((etat.eleve || etat.archive) && !$('#accueil').hidden) rafraichirMaClasse(); }, 30_000);
})();
