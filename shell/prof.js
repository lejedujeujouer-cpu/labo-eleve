// Espace professeur : classes, élèves, dossiers, Digipads et documents.
// Les données sont écrites dans le dossier partagé ; les PC élèves les lisent.
(function () {
  const P = api.prof;
  const corps = $('#prof-corps');
  const ICONES = { dossier: '📁', pad: '🧩', document: '📄', travail: '📝' };
  const ICONES_EXT = { py: '🐍', pdf: '📕', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', ods: '📊', csv: '📊', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', webp: '🖼' };
  const outilDe = (n) => etat.outils.find((o) => o.id === n.outil);
  const iconeElement = (n) => (n.type === 'document' ? ICONES_EXT[(n.nom.split('.').pop() || '').toLowerCase()] || '📄'
    : n.type === 'dossier' ? echapper(n.icone || '📁') : n.type === 'outil' ? (outilDe(n) ? htmlIcone(outilDe(n)) : '🧰') : ICONES[n.type]);
  const nomElement = (n) => (n.type === 'outil' ? (outilDe(n) || { titre: n.outil + ' (outil non installé)' }).titre : n.nom);
  const optionsMatieres = () => [['', 'Matière non précisée'], ...Object.entries(MATIERES_ECOLE).map(([id, m]) => [id, `${m.icone} ${m.nom}`])];
  const initiales = (nom) => nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('');
  const nomNiveau = (id) => (NIVEAUX.find((n) => n.id === id) || {}).nom || 'Niveau non précisé';
  // Plusieurs matières par classe (ex. maths ET physique-chimie) : la principale en premier.
  const iconesMatieres = (c) => matieresDe(c).map((m) => infoMatiere(m).icone).join('');
  const nomsMatieres = (c) => matieresDe(c).map((m) => infoMatiere(m).nom).join(' + ');
  const casesMatieres = (cochees) => Object.entries(MATIERES_ECOLE).map(([id, m]) => [id, `${m.icone} ${m.nom}`, cochees.includes(id)]);
  // Matière d'un thème placé à la racine : la sienne si la classe l'a encore, sinon la principale.
  const matiereNoeud = (c, n) => (n.matiere && matieresDe(c).includes(n.matiere) ? n.matiere : matieresDe(c)[0] || null);
  const AIDE_DOSSIER_COMMUN = 'Ton collègue doit utiliser Labo Prof avec le même dossier partagé que toi (lecteur réseau du lycée, ou dossier OneDrive / Google Drive partagé entre vous). S\'il n\'apparaît pas dans la liste, c\'est qu\'il n\'a pas encore créé son compte enseignant dans ce dossier.';

  const vue = { classes: [], classeId: null, onglet: 'contenu', chemin: [] }; // chemin : ids des dossiers ouverts

  // ---------- Petite fenêtre de saisie (window.prompt n'existe pas dans l'application) ----------
  function saisir(titre, champs, valider = 'Valider') {
    return new Promise((resoudre) => {
      const dlg = $('#dlg-saisie');
      $('#saisie-titre').textContent = titre;
      $('#saisie-valider').textContent = valider;
      $('#saisie-erreur').textContent = '';
      $('#saisie-champs').innerHTML = champs.map((c, i) => {
        const id = `saisie-${i}`;
        if (c.type === 'textarea') return `<label>${echapper(c.label)}<textarea id="${id}" placeholder="${echapper(c.placeholder || '')}">${echapper(c.valeur || '')}</textarea></label>`;
        if (c.type === 'cases') return `<div><b style="font-size:13px">${echapper(c.label)}</b><div class="saisie-cases" id="${id}">${c.options.map(([v, t, coche]) => `<label><input type="checkbox" value="${echapper(v)}" ${coche ? 'checked' : ''}> ${echapper(t)}</label>`).join('')}</div></div>`;
        if (c.type === 'select') return `<label>${echapper(c.label)}<select id="${id}">${c.options.map(([v, t]) => `<option value="${echapper(v)}" ${v === c.valeur ? 'selected' : ''}>${echapper(t)}</option>`).join('')}</select></label>`;
        return `<label>${echapper(c.label)}<input id="${id}" type="${c.type || 'text'}" value="${echapper(c.valeur || '')}" placeholder="${echapper(c.placeholder || '')}" autocomplete="off"></label>`;
      }).join('');
      const fermer = (v) => { dlg.close(); resoudre(v); };
      const valeur = (c, i) => (c.type === 'cases' ? [...document.querySelectorAll(`#saisie-${i} input:checked`)].map((x) => x.value) : $(`#saisie-${i}`).value);
      $('#form-saisie').onsubmit = (e) => { e.preventDefault(); fermer(champs.map(valeur)); };
      $('#saisie-annuler').onclick = () => fermer(null);
      dlg.oncancel = () => resoudre(null);
      dlg.showModal();
      setTimeout(() => { const premier = $('#saisie-0'); if (premier) { premier.focus(); if (premier.select) premier.select(); } }, 30);
    });
  }
  const optionsNiveaux = () => [['', 'Niveau non précisé'], ...NIVEAUX.map((n) => [n.id, n.nom])];
  const verifier = (r) => { if (!r.ok) toast('Action impossible', r.message, 'erreur'); return r.ok; };

  // ---------- Navigation ----------
  async function ouvrirEspace() {
    $('#accueil').hidden = true;
    $('#vue-outil').hidden = true;
    $('#choix-niveau').hidden = true;
    $('#espace-prof').hidden = false;
    document.title = 'Labo Prof';
    await afficher();
  }
  function fermerEspace() {
    $('#espace-prof').hidden = true;
    $('#accueil').hidden = false;
    document.title = etat.edition === 'prof' ? 'Labo Prof — outils des élèves' : 'Labo Élève';
    window.rafraichirMaClasse && window.rafraichirMaClasse();
  }
  $('#btn-espace-prof').addEventListener('click', ouvrirEspace);
  window.ouvrirEspaceProf = ouvrirEspace;

  // ---------- Créer un outil (H5P, activité en ligne, page web, lien) ----------
  // L'outil est rangé dans le dossier partagé : il apparaît dans « Ajouter des outils » et sur les PC des élèves.
  const ICONES_OUTIL = ['🧩', '📝', '❓', '🎯', '🧠', '🎮', '📚', '🔢', '📐', '📊', '⚡', '🧪', '🔬', '🌍', '🎬', '🗣️', '✏️', '⭐'];
  const TYPES_OUTIL = [
    ['h5p', '📦 Une activité H5P (fichier .h5p) : fonctionne sans Internet'],
    ['integration', '🧩 Une activité en ligne à intégrer : LearningApps, Wordwall, Genially, GeoGebra, H5P en ligne…'],
    ['page', '🖥️ Une page web ou un dossier .zip : simulation, exercice HTML…'],
    ['lien', '🔗 Un lien vers un site (ouvert dans l\'application, limité à ce site)'],
  ];
  async function creerOutil(c, parentId, fil, matiere, apres) {
    const crees = ((await api.outilsCrees.lister()) || {}).outils || [];
    const t = await saisir('🛠 Créer un outil', [{ label: 'Que veux-tu proposer à tes élèves ?', type: 'select', valeur: 'h5p',
      options: [...TYPES_OUTIL, ...(crees.length ? [['supprimer', `🗑 Supprimer un outil que j'ai créé (${crees.length})`]] : [])] }], 'Continuer');
    if (!t) return;
    if (t[0] === 'supprimer') {
      const v = await saisir('Supprimer un outil créé', [{ label: 'Outil', type: 'select', options: crees.map((o) => [o.id, o.titre]), valeur: crees[0].id }], 'Supprimer');
      const o = v && crees.find((x) => x.id === v[0]);
      if (!o || !confirm(`Supprimer l'outil « ${o.titre} » ? Il disparaîtra aussi des PC des élèves.`)) return;
      const r = await api.outilsCrees.supprimer(o.id);
      if (!verifier(r)) return;
      toast('Outil supprimé', o.titre, 'info');
      await chargerOutils();
      return;
    }
    const type = t[0];
    const aide = {
      integration: { label: 'Lien ou code d\'intégration', placeholder: 'https://… ou <iframe src="https://…"></iframe> (LearningApps : « Afficher › Intégrer »)' },
      lien: { label: 'Adresse du site', placeholder: 'https://…' },
    }[type];
    const champs = [
      { label: 'Nom de l\'outil (affiché aux élèves)', placeholder: 'ex. Quiz : les fractions' },
      { label: 'Description courte (facultatif)', type: 'textarea', placeholder: 'ex. Associe chaque fraction à sa représentation.' },
      ...(aide ? [aide] : []),
      { label: 'Matière', type: 'select', valeur: MATIERES[matiere] ? matiere : 'exercices', options: Object.entries(MATIERES).map(([id, x]) => [id, x.nom]) },
      { label: 'Niveaux (aucun coché = tous)', type: 'cases', options: NIVEAUX.map((n) => [n.id, n.nom, false]) },
      { label: 'Icône', type: 'select', valeur: ICONES_OUTIL[0], options: [...ICONES_OUTIL.map((i) => [i, i]), ['image', '🖼 Mon image (PNG, JPG, SVG…)']] },
      { label: 'Couleur', type: 'color', valeur: '#5865f2' },
      { label: '', type: 'cases', options: [['ici', `Ajouter aussi cet outil dans ${fil.length ? '« ' + fil[fil.length - 1].nom + ' »' : 'la classe ' + c.nom}`, true]] },
    ];
    const v = await saisir(TYPES_OUTIL.find((x) => x[0] === type)[1].split(' :')[0], champs, type === 'h5p' || type === 'page' ? 'Choisir le fichier…' : 'Créer l\'outil');
    if (!v) return;
    const i = aide ? 1 : 0;
    const r = await api.outilsCrees.creer({ type, titre: v[0], description: v[1], url: aide ? v[2] : '', matiere: v[2 + i], niveaux: v[3 + i], icone: v[4 + i], couleur: v[5 + i] });
    if (r && r.annule) return;
    if (!verifier(r)) return;
    await chargerOutils();
    toast('Outil créé', r.partage ? `« ${r.titre} » est dans « Ajouter des outils ». Tes élèves le reçoivent à la prochaine ouverture de Labo Élève.` : `« ${r.titre} » est sur ce PC seulement : choisis le dossier partagé dans les réglages pour l'envoyer aux élèves.`, 'info');
    if (v[6 + i].includes('ici')) apres(await P.ajouterOutils(c.id, parentId, [r.id]));
  }
  $('#btn-prof-retour').addEventListener('click', fermerEspace);
  $('#btn-prof-verrouiller').addEventListener('click', async () => { await P.verrouiller(); toast('Espace professeur verrouillé', '', 'info'); fermerEspace(); });
  $('#btn-prof-mdp').addEventListener('click', async () => {
    const v = await saisir('Changer le mot de passe professeur', [{ label: 'Nouveau mot de passe (8 caractères minimum)', type: 'password' }, { label: 'Confirme-le', type: 'password' }]);
    if (!v) return;
    if (v[0] !== v[1]) return toast('Mot de passe non modifié', 'Les deux mots de passe sont différents.', 'erreur');
    if (verifier(await P.changerMotDePasse(v[0]))) toast('Mot de passe modifié', 'Il sert sur tous les PC qui utilisent ce dossier partagé.', 'info');
  });

  async function afficher() {
    const e = await api.classes.etat();
    $('#btn-prof-verrouiller').hidden = !e.profDeverrouille;
    $('#btn-prof-mdp').hidden = !e.profDeverrouille;
    $('#btn-prof-profil').hidden = !e.profDeverrouille;
    vue.prof = e.prof;
    if (e.prof) $('#btn-prof-profil').textContent = `👤 ${e.prof.nom}${e.prof.matiere ? ' · ' + infoMatiere(e.prof.matiere).nom : ''}`;
    if (!e.accessible) return afficherDossier(e);
    if (!e.profDeverrouille) return afficherConnexion(e);
    if (e.prof.aCompleter) return completerProfil(true);
    vue.classes = await api.classes.lister();
    if (!vue.classes.some((c) => c.id === vue.classeId)) { vue.classeId = (vue.classes.find((c) => !c.archive) || vue.classes[0])?.id || null; vue.chemin = []; }
    await afficherTableau();
  }

  // ---------- 1. Dossier partagé ----------
  function afficherDossier(e) {
    corps.innerHTML = `<div class="prof-centre">
      <h2>Dossier partagé de l'établissement</h2>
      <p>Les classes, les listes d'élèves et tes documents sont enregistrés dans un dossier commun à tous les PC (lecteur réseau du lycée, dossier ENT synchronisé…). Choisis-le sur ton ordinateur, puis choisis le même dossier sur les PC des élèves.</p>
      ${e.dossier ? `<p class="aide-code erreur">Le dossier choisi est introuvable : ${echapper(e.dossier)}</p>` : ''}
      <div class="rangee"><button class="principal" id="prof-choisir-dossier">Choisir le dossier partagé</button></div>
      <p class="note-prof">Conseil : donne aux élèves un accès en <b>lecture seule</b> à ce dossier.</p>
    </div>`;
    $('#prof-choisir-dossier').addEventListener('click', async () => { await api.choisirDossierMaj(); afficher(); });
  }

  // ---------- 2. Mot de passe ----------
  // Chaque enseignant a son compte (nom + mot de passe) et ne voit que ses classes.
  let connexion = { mode: 'choix', compte: null };
  function afficherConnexion(e) {
    if (!e.comptes.length || connexion.mode === 'creer') return afficherCreationCompte(e);
    if (connexion.mode === 'mdp' && connexion.compte) return afficherMotDePasse(e, connexion.compte);
    corps.innerHTML = `<div class="prof-centre">
      <h2>Qui es-tu ?</h2>
      <p>Choisis ton compte enseignant.</p>
      <div class="comptes-prof">${e.comptes.map((c) => `<button class="compte-prof" data-compte="${c.id}" style="--c:${infoMatiere(c.matiere).couleur}">
        <span class="ic">${c.matiere ? infoMatiere(c.matiere).icone : '👤'}</span><span><b>${echapper(c.nom)}</b><br><small>${echapper(c.matiere ? infoMatiere(c.matiere).nom : 'Matière non précisée')}</small></span></button>`).join('')}</div>
      <div class="rangee"><button class="secondaire" id="prof-nouveau-compte">+ Je suis un nouvel enseignant</button></div>
      <p class="note-prof">Dossier partagé : ${echapper(e.dossier)}</p>
    </div>`;
    corps.querySelectorAll('[data-compte]').forEach((b) => b.addEventListener('click', () => { connexion = { mode: 'mdp', compte: e.comptes.find((c) => c.id === b.dataset.compte) }; afficher(); }));
    $('#prof-nouveau-compte').addEventListener('click', () => { connexion = { mode: 'creer', compte: null }; afficher(); });
  }
  function afficherMotDePasse(e, compte) {
    corps.innerHTML = `<div class="prof-centre">
      <h2>${compte.matiere ? infoMatiere(compte.matiere).icone + ' ' : ''}${echapper(compte.nom)}</h2>
      <p>Entre ton mot de passe.</p>
      <form id="form-connexion" class="prof-champs">
        <input class="champ-prof" type="password" id="mdp-1" placeholder="Mot de passe" autocomplete="off">
        <p class="aide-code erreur" id="mdp-erreur"></p>
        <div class="rangee"><button class="secondaire" type="button" id="prof-autre-compte">← Autre compte</button><button class="principal" type="submit">Entrer</button></div>
      </form>
    </div>`;
    $('#mdp-1').focus();
    $('#prof-autre-compte').addEventListener('click', () => { connexion = { mode: 'choix', compte: null }; afficher(); });
    $('#form-connexion').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const r = await P.connecter(compte.id, $('#mdp-1').value);
      if (!r.ok) { $('#mdp-erreur').textContent = r.message; return; }
      connexion = { mode: 'choix', compte: null };
      afficher();
    });
  }
  function afficherCreationCompte(e) {
    const premier = !e.comptes.length;
    corps.innerHTML = `<div class="prof-centre">
      <h2>${premier ? 'Crée ton compte enseignant' : 'Nouveau compte enseignant'}</h2>
      <p>Ton nom est affiché aux élèves (ex. « M. Dupont »). Ta matière est proposée pour tes classes.${premier ? '' : ' Un collègue déjà inscrit valide ton compte avec son mot de passe : un élève ne peut donc pas se créer de compte.'}</p>
      <form id="form-connexion" class="prof-champs">
        <input class="champ-prof" id="cpt-nom" placeholder="Nom affiché aux élèves (ex. M. Dupont)" autocomplete="off" maxlength="50">
        <select class="champ-prof" id="cpt-matiere">${optionsMatieres().map(([v, t]) => `<option value="${v}">${echapper(t)}</option>`).join('')}</select>
        <input class="champ-prof" type="password" id="mdp-1" placeholder="Mot de passe (8 caractères minimum)" autocomplete="off">
        <input class="champ-prof" type="password" id="mdp-2" placeholder="Confirme le mot de passe" autocomplete="off">
        ${premier ? '' : '<input class="champ-prof" type="password" id="mdp-collegue" placeholder="Mot de passe d\'un collègue déjà inscrit" autocomplete="off">'}
        <p class="aide-code erreur" id="mdp-erreur"></p>
        <div class="rangee">${premier ? '' : '<button class="secondaire" type="button" id="prof-autre-compte">← Retour</button>'}<button class="principal" type="submit">Créer mon compte</button></div>
      </form>
      <p class="note-prof">Dossier partagé : ${echapper(e.dossier)}</p>
    </div>`;
    $('#cpt-nom').focus();
    $('#prof-autre-compte')?.addEventListener('click', () => { connexion = { mode: 'choix', compte: null }; afficher(); });
    $('#form-connexion').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if ($('#mdp-1').value !== $('#mdp-2').value) { $('#mdp-erreur').textContent = 'Les deux mots de passe sont différents.'; return; }
      const r = await P.creerCompte({ nom: $('#cpt-nom').value, matiere: $('#cpt-matiere').value, mdp: $('#mdp-1').value, mdpCollegue: $('#mdp-collegue') ? $('#mdp-collegue').value : '' });
      if (!r.ok) { $('#mdp-erreur').textContent = r.message; return; }
      connexion = { mode: 'choix', compte: null };
      toast('Compte créé', `Bienvenue ${r.prof.nom} !`, 'info');
      afficher();
    });
  }
  // Nom affiché aux élèves et matière (obligatoire pour l'ancien compte unique, à sa première connexion).
  async function completerProfil(obligatoire) {
    const v = await saisir(obligatoire ? 'Complète ton profil enseignant' : 'Mon profil', [
      { label: 'Nom affiché aux élèves (ex. M. Dupont, Mme Martin)', valeur: vue.prof && !vue.prof.aCompleter ? vue.prof.nom : '' },
      { label: 'Ta matière', type: 'select', options: optionsMatieres(), valeur: (vue.prof && vue.prof.matiere) || '' },
    ], 'Enregistrer');
    if (!v) { if (obligatoire) { await P.verrouiller(); afficher(); } return; }
    if (verifier(await P.profil({ nom: v[0], matiere: v[1] }))) toast('Profil enregistré', 'Ton nom et ta matière sont affichés à tes élèves.', 'info');
    afficher();
  }
  $('#btn-prof-profil').addEventListener('click', () => completerProfil(false));
  // ---------- 3. Classes ----------
  const classeActive = () => vue.classeComplete;
  async function afficherTableau() {
    vue.classeComplete = vue.classeId ? await api.classes.lire(vue.classeId) : null;
    // Classes de l'année / classes clôturées (« Années précédentes », de la plus récente à la plus ancienne)
    const actives = vue.classes.filter((c) => !c.archive), anciennes = vue.classes.filter((c) => c.archive);
    const annees = [...new Set(anciennes.map((c) => c.archive.annee))].sort().reverse();
    corps.innerHTML = `<div class="prof-grille">
      <aside class="prof-classes">
        <h3>Mes classes</h3>
        ${actives.length ? actives.map((c) => `<button class="classe-item ${c.id === vue.classeId ? 'actif' : ''}" data-classe="${c.id}"><b>${matieresDe(c).length ? iconesMatieres(c) + ' ' : ''}${echapper(c.nom)}</b><span>${echapper(matieresDe(c).length ? nomsMatieres(c) + ' · ' : '')}${echapper(nomNiveau(c.niveau))} · ${c.eleves.length} élève${c.eleves.length > 1 ? 's' : ''}</span>${c.coEnseignant ? `<span>👥 Co-enseignant · classe de ${echapper((c.prof || '').split(' et ')[0])}</span>` : ''}</button>`).join('') : '<p class="prof-vide">Aucune classe pour l\'instant.</p>'}
        <button class="principal" id="prof-nouvelle-classe">+ Nouvelle classe</button>
        <button class="secondaire" id="prof-etablissement" title="Réglages communs à tout l'établissement">🏫 Pronote et ENT</button>
        ${actives.some((c) => !c.coEnseignant) ? '<button class="lien" id="prof-cloturer-toutes" title="Fin d\'année : toutes tes classes passent dans « Années précédentes », en lecture seule">🗄 Clôturer toutes mes classes</button>' : ''}
        ${anciennes.length ? `<h3 class="titre-annees">🗄 Années précédentes</h3>${annees.map((a) => `<p class="annee-prof">${echapper(a)}</p>${anciennes.filter((c) => c.archive.annee === a).map((c) => `<button class="classe-item archivee ${c.id === vue.classeId ? 'actif' : ''}" data-classe="${c.id}"><b>${matieresDe(c).length ? iconesMatieres(c) + ' ' : ''}${echapper(c.nom)}</b><span>${echapper(matieresDe(c).length ? nomsMatieres(c) + ' · ' : '')}${c.eleves.length} élève${c.eleves.length > 1 ? 's' : ''}${c.coEnseignant ? ' · 👥 co-enseignant' : ''}</span></button>`).join('')}`).join('')}` : ''}
      </aside>
      <section class="prof-detail" id="prof-detail"></section>
    </div>`;
    corps.querySelectorAll('[data-classe]').forEach((b) => b.addEventListener('click', () => { vue.classeId = b.dataset.classe; vue.chemin = []; vue.matiere = null; afficherTableau(); }));
    $('#prof-nouvelle-classe').addEventListener('click', nouvelleClasse);
    $('#prof-etablissement').addEventListener('click', reglerEtablissement);
    $('#prof-cloturer-toutes')?.addEventListener('click', cloturerToutes);
    afficherDetail();
  }

  // ---------- Mode examen ----------
  const OUTILS_EXAMEN_DEFAUT = ['calculatrice-numworks', 'tableur', 'calculatrice'];
  async function lancerExamen(c) {
    const choix = etat.outils
      .filter((o) => !o.application && !o.pad && !o.office && !o.interne && (!o.site || o.examen)) // pas de logiciel externe ni de site (sauf exerciseur)
      .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
      .map((o) => [o.id, o.titre, OUTILS_EXAMEN_DEFAUT.includes(o.id)]);
    const v = await saisir(`Lancer un examen — ${c.nom}`, [
      { label: 'Titre de l\'examen', placeholder: 'ex. Évaluation — Loi d\'Ohm', valeur: '' },
      { label: 'Outils autorisés pendant l\'examen', type: 'cases', options: choix },
    ], 'Lancer l\'examen');
    if (!v) return;
    const r = await P.demarrerExamen(c.id, { titre: v[0], outils: v[1] });
    if (!verifier(r)) return;
    toast('🎓 Examen lancé', `Les PC de ${c.nom} passent en mode examen dans les 5 secondes. L'application y est verrouillée jusqu'à la fin.`, 'info');
    vue.classeComplete = r.classe;
    vue.onglet = 'eleves';
    afficherDetail();
  }

  // Examen sans réseau : titre, outils et code ; copié sur les PC des élèves quand ils voient le dossier partagé.
  async function preparerExamenHorsReseau(c) {
    const p = c.examenPrepare;
    const outilsCoches = p ? p.outils : OUTILS_EXAMEN_DEFAUT;
    const choix = etat.outils
      .filter((o) => !o.application && !o.pad && !o.office && !o.interne && (!o.site || o.examen))
      .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
      .map((o) => [o.id, o.titre, outilsCoches.includes(o.id)]);
    const codeAuHasard = String(Math.floor(1000 + Math.random() * 9000));
    const v = await saisir(`Préparer un examen sans réseau — ${c.nom}`, [
      { label: 'Titre de l\'examen', placeholder: 'ex. Évaluation — Loi d\'Ohm', valeur: p ? p.titre : '' },
      { label: 'Code à taper sur chaque PC pour démarrer l\'examen (4 à 8 chiffres)', valeur: p ? p.code : codeAuHasard },
      { label: 'Outils autorisés pendant l\'examen', type: 'cases', options: choix },
    ], 'Enregistrer');
    if (!v) return;
    const r = await P.preparerExamen(c.id, { titre: v[0], code: v[1], outils: v[2] });
    if (!verifier(r)) return;
    toast('📴 Examen sans réseau prêt', `Code : ${r.classe.examenPrepare.code}. Chaque PC doit ouvrir Labo Élève dans la classe avec le réseau une fois avant l'examen (ça suffit pour qu'il connaisse le code).`, 'info');
    vue.classeComplete = r.classe;
    afficherDetail();
  }

  // Adresse Pronote de l'établissement : enregistrée dans le dossier partagé, valable pour tous les PC.
  async function reglerEtablissement() {
    const actuel = await api.classes.etablissement();
    const v = await saisir('Pronote et ENT de l\'établissement', [
      { label: 'Adresse de Pronote (élèves) — ouvre Pronote dans ton navigateur et copie l\'adresse, ex. https://0570000a.index-education.net/pronote/eleve.html', type: 'url', valeur: actuel.pronote || '', placeholder: 'https://…index-education.net/pronote/eleve.html' },
    ], 'Enregistrer');
    if (!v) return;
    const r = await P.modifierEtablissement({ pronote: v[0] });
    if (verifier(r)) toast('Réglage enregistré', r.etablissement.pronote ? 'La carte Pronote fonctionne maintenant sur tous les PC des élèves.' : 'Adresse Pronote retirée.', 'info');
  }

  async function nouvelleClasse() {
    const v = await saisir('Nouvelle classe', [
      { label: 'Nom de la classe', placeholder: 'ex. 2nde MELEC A' },
      { label: 'Niveau', type: 'select', options: optionsNiveaux(), valeur: '' },
      { label: 'Matières enseignées dans cette classe (une ou plusieurs, ex. Mathématiques et Physique-Chimie). Chacune a ses propres thèmes ; les élèves la choisissent comme une carte.', type: 'cases', options: casesMatieres(vue.prof && vue.prof.matiere ? [matiereActuelle(vue.prof.matiere)] : []) },
    ], 'Créer');
    if (!v) return;
    // La matière du compte reste la principale si elle est cochée.
    const principale = vue.prof && v[2].includes(matiereActuelle(vue.prof.matiere)) ? matiereActuelle(vue.prof.matiere) : v[2][0] || '';
    const r = await P.creerClasse({ nom: v[0], niveau: v[1], matiere: principale, matieres: v[2] });
    if (!verifier(r)) return;
    vue.classeId = r.classe.id;
    vue.matiere = null;
    vue.onglet = 'eleves';
    vue.classes = await api.classes.lister();
    afficherTableau();
  }

  // ---------- Co-enseignants : un collègue qui a un compte dans le même dossier partagé ----------
  async function gererCoEnseignants(c) {
    const e = await api.classes.etat();
    const proprio = (c.enseignants || []).find((x) => x.proprietaire);
    if (!c.estProprietaire) {
      await saisir(`Co-enseignants — ${c.nom}`, [{ label: `Cette classe a été créée par ${proprio ? proprio.nom : 'un collègue'}. Lui seul peut inviter ou retirer des collègues. Enseignants : ${(c.enseignants || []).map((x) => x.nom).join(', ')}.`, type: 'cases', options: [] }], 'Fermer');
      return;
    }
    const collegues = e.comptes.filter((x) => x.id !== vue.prof.id && !x.aCompleter);
    const actuels = (c.coEnseignants || []);
    const v = await saisir(`Co-enseignants — ${c.nom}`, [{
      label: collegues.length ? `Coche les collègues qui gèrent aussi cette classe (élèves, thèmes, documents, travaux, examen, suivi en direct). Seul toi peux supprimer la classe. ${AIDE_DOSSIER_COMMUN}` : `Aucun autre compte enseignant dans ce dossier partagé pour l'instant. ${AIDE_DOSSIER_COMMUN}`,
      type: 'cases', options: collegues.map((x) => [x.id, `${x.matiere ? infoMatiere(x.matiere).icone + ' ' : ''}${x.nom}`, actuels.includes(x.id)]),
    }], 'Enregistrer');
    if (!v) return;
    const voulus = v[0];
    for (const id of voulus.filter((x) => !actuels.includes(x))) if (!verifier(await P.ajouterCoEnseignant(c.id, id))) return;
    for (const id of actuels.filter((x) => !voulus.includes(x))) if (!verifier(await P.retirerCoEnseignant(c.id, id))) return;
    if (voulus.length !== actuels.length || voulus.some((x) => !actuels.includes(x))) toast('Co-enseignants enregistrés', voulus.length ? 'Tes collègues voient maintenant cette classe dans « Mes classes » (avec leur propre compte).' : 'Plus aucun collègue sur cette classe.', 'info');
    vue.classes = await api.classes.lister();
    afficherTableau();
  }

  // ---------- Fin d'année : clôturer (archiver) une classe ----------
  const EXPLICATION_CLOTURE = 'La classe passe dans « Années précédentes », en lecture seule : plus de mode focus, d\'examen ni de suivi, plus de nouveaux travaux ni de copies. Rien n\'est supprimé : tes élèves retrouvent ses documents, Digipads et travaux dans « 📚 Mes années précédentes », et peuvent s\'inscrire dans leurs nouvelles classes. Tu pourras la rouvrir en cas d\'erreur.';
  async function cloturerClasse(c) {
    const { annee } = await P.anneeScolaire();
    const v = await saisir(`🗄 Clôturer l'année — ${c.nom}`, [{ label: `${EXPLICATION_CLOTURE} Année scolaire :`, valeur: annee, placeholder: 'ex. 2025-2026' }], 'Clôturer la classe');
    if (!v) return;
    const r = await P.cloturerClasse(c.id, v[0]);
    if (!verifier(r)) return;
    toast('🗄 Classe clôturée', `${c.nom} est rangée dans « Années précédentes » (${r.classe.archive.annee}).`, 'info');
    vue.classes = await api.classes.lister();
    vue.onglet = 'contenu';
    afficherTableau();
  }
  async function cloturerToutes() {
    const { annee } = await P.anneeScolaire();
    const miennes = vue.classes.filter((c) => !c.archive && !c.coEnseignant);
    const v = await saisir('🗄 Clôturer toutes mes classes', [{ label: `Fin d'année : tes ${miennes.length} classe${miennes.length > 1 ? 's' : ''} (${miennes.map((c) => c.nom).join(', ')}). ${EXPLICATION_CLOTURE} Les classes où tu es seulement co-enseignant ne changent pas. Année scolaire :`, valeur: annee }], 'Tout clôturer');
    if (!v) return;
    const r = await P.cloturerToutes(v[0]);
    if (!verifier(r)) return;
    toast('🗄 Année clôturée', `${r.clotures} classe${r.clotures > 1 ? 's' : ''} rangée${r.clotures > 1 ? 's' : ''} dans « Années précédentes » (${r.annee}).`, 'info');
    vue.classes = await api.classes.lister();
    afficher();
  }
  // Classe clôturée : consultation seulement (et « Rouvrir » pour l'enseignant qui l'a créée).
  function afficherDetailArchive(c) {
    const zone = $('#prof-detail');
    if (vue.onglet !== 'contenu' && vue.onglet !== 'eleves' && vue.onglet !== 'copies') vue.onglet = 'contenu';
    zone.innerHTML = `
      <div class="detail-entete">
        <h2>${echapper(c.nom)}</h2>
        <span class="note-prof" style="margin:0">${matieresDe(c).length ? `${iconesMatieres(c)} ${echapper(nomsMatieres(c))} · ` : ''}${echapper(nomNiveau(c.niveau))}</span>
        <span class="espace"></span>
        ${c.estProprietaire ? '<button class="principal" id="prof-rouvrir">↩ Rouvrir la classe</button><button class="lien" id="prof-suppr-classe" style="color:#e5484d">Supprimer la classe</button>' : ''}
      </div>
      <div class="bandeau-archive">🗄 <b>Classe clôturée — année ${echapper(c.archive.annee)}</b> (le ${new Date(c.archive.date).toLocaleDateString('fr-FR')}). Lecture seule : tes élèves la retrouvent dans « 📚 Mes années précédentes ».${c.estProprietaire ? ' En cas d\'erreur, clique sur « Rouvrir la classe ».' : ' Seul l\'enseignant qui a créé la classe peut la rouvrir.'}</div>
      <div class="onglets-prof">
        <button data-onglet="contenu" class="${vue.onglet === 'contenu' ? 'actif' : ''}">🗂 Thèmes et documents</button>
        <button data-onglet="eleves" class="${vue.onglet === 'eleves' ? 'actif' : ''}">👥 Élèves (${(c.eleves || []).length})</button>
        <button data-onglet="copies" class="${vue.onglet === 'copies' ? 'actif' : ''}">📂 Copies des élèves</button>
      </div>
      <div id="prof-onglet"></div>`;
    zone.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => { vue.onglet = b.dataset.onglet; afficherDetail(); }));
    $('#prof-rouvrir')?.addEventListener('click', async () => {
      if (!confirm(`Rouvrir la classe « ${c.nom} » ?\n\nElle revient dans « Mes classes » et redevient modifiable ; ses élèves la retrouvent parmi leurs matières.`)) return;
      if (verifier(await P.rouvrirClasse(c.id))) { toast('Classe rouverte', `${c.nom} est de nouveau dans « Mes classes ».`, 'info'); vue.classes = await api.classes.lister(); afficherTableau(); }
    });
    $('#prof-suppr-classe')?.addEventListener('click', async () => {
      if (!confirm(`Supprimer définitivement la classe « ${c.nom} », sa liste d'élèves et tous ses documents du dossier partagé ?\n\nSes élèves ne pourront plus la consulter dans « Mes années précédentes ». Cette action est irréversible.`)) return;
      if (verifier(await P.supprimerClasse(c.id))) { vue.classeId = null; afficher(); }
    });
    if (vue.onglet === 'eleves') {
      $('#prof-onglet').innerHTML = (c.eleves || []).length ? `<div class="liste-eleves">${c.eleves.map((e) => `<div class="eleve"><span class="pastille-nom">${echapper(initiales(e.nom))}</span><span style="min-width:0;flex:1">${echapper(e.nom)}</span></div>`).join('')}</div>` : '<p class="prof-vide">Aucun élève.</p>';
    } else if (vue.onglet === 'copies') afficherCopies(c); else afficherContenu(c);
  }

  function afficherDetail() {
    const zone = $('#prof-detail');
    const c = classeActive();
    if (!c) { zone.innerHTML = '<div class="prof-vide"><h2>Bienvenue !</h2><p>Commence par créer une classe, puis ajoute tes élèves et tes documents.</p></div>'; return; }
    if (c.archive) return afficherDetailArchive(c);
    zone.innerHTML = `
      <div class="detail-entete">
        <h2>${echapper(c.nom)}</h2>
        <select id="prof-niveau">${optionsNiveaux().map(([v, t]) => `<option value="${v}" ${v === (c.niveau || '') ? 'selected' : ''}>${echapper(t)}</option>`).join('')}</select>
        <button class="secondaire" id="prof-matieres" title="Matières de la classe : chacune apparaît comme une carte chez les élèves, avec ses propres thèmes">${matieresDe(c).length ? `${iconesMatieres(c)} ${echapper(nomsMatieres(c))}` : '📚 Matière non précisée'}</button>
        <button class="secondaire" id="prof-co" title="Collègues qui gèrent aussi cette classe avec leur propre compte">👥 ${(c.enseignants || []).length > 1 ? `${c.enseignants.length} enseignants` : 'Co-enseignants'}</button>
        <label class="case-focus" title="Labo Élève s'ouvre en plein écran verrouillé ; l'élève ne peut que le fermer, après confirmation, et tu es prévenu de l'heure.">
          <input type="checkbox" id="prof-mode-focus" ${c.modeFocus !== false ? 'checked' : ''}> Mode focus pour les élèves</label>
        <label class="case-focus" title="Ajoute l'outil « Recherche internet » chez les élèves de cette classe (moteur Qwant, filtre parental strict). Jamais pendant un examen.">
          <input type="checkbox" id="prof-recherche" ${c.rechercheInternet === true ? 'checked' : ''}> 🌐 Recherche internet</label>
        <span class="espace"></span>
        ${c.examen ? '' : '<button class="bouton-examen" id="prof-examen">🎓 Mode examen</button>'}
        ${c.examenPrepare ? '' : '<button class="bouton-examen" id="prof-examen-code" title="Pour une salle sans réseau : l\'examen démarre quand tu tapes un code sur chaque PC.">📴 Examen sans réseau</button>'}
        <button class="lien" id="prof-renommer-classe">Renommer</button>
        ${c.estProprietaire === false ? '' : '<button class="lien" id="prof-cloturer" title="Fin d\'année : la classe passe en lecture seule dans « Années précédentes »">🗄 Clôturer l\'année</button>'}
        ${c.estProprietaire === false ? '<button class="lien" id="prof-quitter-classe" style="color:#e5484d">Quitter cette classe</button>' : '<button class="lien" id="prof-suppr-classe" style="color:#e5484d">Supprimer la classe</button>'}
      </div>
      ${(c.enseignants || []).length > 1 ? `<p class="note-prof" style="margin:-4px 0 10px">👥 Classe gérée par ${c.enseignants.map((x) => `<b>${echapper(x.nom)}</b>${x.proprietaire ? ' (a créé la classe)' : ''}`).join(', ')}. Chacun se connecte avec son compte et voit les mêmes élèves, thèmes, travaux, copies et examens.</p>` : ''}
      ${c.examen ? `<div class="examen-prof"><span style="font-size:24px">🎓</span><div><b>Examen en cours : ${echapper(c.examen.titre)}</b><br>
        <span class="note-prof" style="margin:0">Depuis ${new Date(c.examen.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · Outils autorisés : ${echapper(c.examen.outils.map((id) => (etat.outils.find((o) => o.id === id) || { titre: id }).titre).join(', '))}</span></div>
        <span class="espace"></span><button class="principal" id="prof-fin-examen">Terminer l'examen</button></div>` : ''}
      ${c.examenPrepare ? `<div class="examen-prof"><span style="font-size:24px">📴</span><div><b>Examen sans réseau prêt : ${echapper(c.examenPrepare.titre)}</b> · Code : <b class="code-examen">${echapper(c.examenPrepare.code)}</b><br>
        <span class="note-prof" style="margin:0">Sur chaque PC : bouton « 🎓 Examen » de Labo Élève, puis ce code. Fin de l'examen : bouton 🔒 Professeur et ton mot de passe. · Outils : ${echapper(c.examenPrepare.outils.map((id) => (etat.outils.find((o) => o.id === id) || { titre: id }).titre).join(', '))}</span></div>
        <span class="espace"></span><button class="lien" id="prof-examen-code-modifier">Modifier</button><button class="lien" id="prof-examen-code-retirer" style="color:#e5484d">Retirer</button></div>` : ''}
      <div class="onglets-prof">
        <button data-onglet="contenu" class="${vue.onglet === 'contenu' ? 'actif' : ''}">🗂 Thèmes et documents</button>
        <button data-onglet="eleves" class="${vue.onglet === 'eleves' ? 'actif' : ''}">👥 Élèves (${(c.eleves || []).length})</button>
        <button data-onglet="copies" class="${vue.onglet === 'copies' ? 'actif' : ''}" title="Tout ce que les élèves enregistrent, rangé par élève">📂 Copies des élèves</button>
        <button data-onglet="evaluations" class="${vue.onglet === 'evaluations' ? 'actif' : ''}" title="QCM et automatismes adaptés à chaque élève, suivi en direct">📝 Évaluations</button>
        <button data-onglet="notes" class="${vue.onglet === 'notes' ? 'actif' : ''}" title="Système de notation, carnet de notes par période, appréciations">📊 Notes</button>
      </div>
      <div id="prof-onglet"></div>`;
    zone.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => { vue.onglet = b.dataset.onglet; afficherDetail(); }));
    $('#prof-matieres').addEventListener('click', async () => {
      const v = await saisir(`Matières — ${c.nom}`, [{ label: 'Coche les matières de cette classe. Chacune a ses propres thèmes et apparaît comme une carte chez les élèves. Les thèmes d\'une matière décochée passent dans la matière principale (la première).', type: 'cases', options: casesMatieres(matieresDe(c)) }], 'Enregistrer');
      if (!v) return;
      if (verifier(await P.modifierClasse(c.id, { matieres: v[0] }))) { vue.matiere = null; vue.classes = await api.classes.lister(); afficherTableau(); }
    });
    $('#prof-co').addEventListener('click', () => gererCoEnseignants(c));
    $('#prof-cloturer')?.addEventListener('click', () => cloturerClasse(c));
    $('#prof-quitter-classe')?.addEventListener('click', async () => {
      if (!confirm(`Quitter la classe « ${c.nom} » ?\n\nTu ne la verras plus dans « Mes classes ». Rien n'est supprimé : l'enseignant qui l'a créée pourra t'inviter de nouveau.`)) return;
      if (verifier(await P.retirerCoEnseignant(c.id, vue.prof.id))) { vue.classeId = null; afficher(); }
    });
    $('#prof-niveau').addEventListener('change', async (e) => { if (verifier(await P.modifierClasse(c.id, { niveau: e.target.value }))) { vue.classes = await api.classes.lister(); afficherTableau(); } });
    $('#prof-mode-focus').addEventListener('change', async (e) => {
      if (verifier(await P.modifierClasse(c.id, { modeFocus: e.target.checked }))) {
        vue.classeComplete = await api.classes.lire(c.id);
        toast(e.target.checked ? 'Mode focus activé' : 'Mode focus désactivé', `Pour la classe ${c.nom}. Les PC des élèves l'appliquent dans les 30 secondes.`, 'info');
      }
    });
    $('#prof-recherche').addEventListener('change', async (e) => {
      if (verifier(await P.modifierClasse(c.id, { rechercheInternet: e.target.checked }))) {
        vue.classeComplete = await api.classes.lire(c.id);
        toast(e.target.checked ? 'Recherche internet activée' : 'Recherche internet désactivée', `Pour la classe ${c.nom}. Les PC des élèves l'appliquent dans les 5 secondes.`, 'info');
      }
    });
    $('#prof-examen')?.addEventListener('click', () => lancerExamen(c));
    $('#prof-examen-code')?.addEventListener('click', () => preparerExamenHorsReseau(c));
    $('#prof-examen-code-modifier')?.addEventListener('click', () => preparerExamenHorsReseau(c));
    $('#prof-examen-code-retirer')?.addEventListener('click', async () => {
      if (!confirm(`Retirer l'examen sans réseau « ${c.examenPrepare.titre} » ?\n\nLe code ne marchera plus. Les PC encore en examen le termineront dès qu'ils retrouveront le réseau (sinon : bouton 🔒 Professeur).`)) return;
      if (verifier(await P.retirerExamenPrepare(c.id))) { vue.classeComplete = await api.classes.lire(c.id); afficherDetail(); }
    });
    $('#prof-fin-examen')?.addEventListener('click', async () => {
      if (c.examen.evaluation) {
        if (!confirm(`Terminer l'évaluation « ${c.examen.titre} » ? Les corrections sont rendues aux élèves qui n'ont pas encore la leur, puis l'examen s'arrête.`)) return;
        if (verifier(await api.evaluations.terminer(c.examen.evaluation))) { toast('Évaluation terminée', 'Corrections rendues ; les élèves retrouvent leurs outils.', 'info'); vue.classeComplete = await api.classes.lire(c.id); afficherDetail(); }
        return;
      }
      if (!confirm(`Terminer l'examen « ${c.examen.titre} » ? Tous les outils redeviendront disponibles pour les élèves de ${c.nom}.`)) return;
      if (verifier(await P.arreterExamen(c.id))) { toast('Examen terminé', 'Les élèves retrouvent tous leurs outils (dans les 5 secondes).', 'info'); vue.classeComplete = await api.classes.lire(c.id); afficherDetail(); }
    });
    $('#prof-renommer-classe').addEventListener('click', async () => {
      const v = await saisir('Renommer la classe', [{ label: 'Nom de la classe', valeur: c.nom }], 'Renommer');
      if (v && verifier(await P.modifierClasse(c.id, { nom: v[0] }))) { vue.classes = await api.classes.lister(); afficherTableau(); }
    });
    $('#prof-suppr-classe')?.addEventListener('click', async () => {
      if (!confirm(`Supprimer définitivement la classe « ${c.nom} », sa liste d'élèves et tous ses documents du dossier partagé ?\n\nCette action est irréversible.`)) return;
      if (verifier(await P.supprimerClasse(c.id))) { vue.classeId = null; afficher(); }
    });
    if (vue.onglet === 'eleves') afficherEleves(c); else if (vue.onglet === 'copies') afficherCopies(c);
    else if (vue.onglet === 'evaluations' && window.afficherEvaluationsClasse) window.afficherEvaluationsClasse(c, $('#prof-onglet'));
    else if (vue.onglet === 'notes' && window.afficherNotesClasse) window.afficherNotesClasse(c, $('#prof-onglet'));
    else afficherContenu(c);
  }

  // ---------- Élèves ----------
  // ---------- Copies des élèves : chaque document enregistré par un élève, rangé dans un dossier à son nom ----------
  async function afficherCopies(c) {
    const zone = $('#prof-onglet');
    const r = await P.copiesLister(c.id);
    if (vue.onglet !== 'copies') return;
    if (!verifier(r)) return;
    const date = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const total = r.eleves.reduce((n, e) => n + e.fichiers.length, 0);
    zone.innerHTML = `
      <div class="barre-contenu"><span class="note-prof" style="margin:0;flex:1">Les documents que tes élèves choisissent de t'envoyer arrivent ici, dans un dossier à leur nom, en dernière version : en enregistrant (case « Envoyer aussi une copie à … », ou réponse « Oui » à la question), ou avec le bouton « 📤 Au prof » de leurs Mes documents (traitement de texte, tableur, PDF annoté, Python, cartes mémoire…). ${total} document${total > 1 ? 's' : ''}.</span>
        <button class="secondaire" id="prof-copies-actualiser">↻ Actualiser</button>
        <button class="principal" id="prof-copies-dossier">📂 Ouvrir le dossier</button></div>
      <div class="elements">${r.eleves.map((e) => `
        <div class="element copies-eleve">
          <span class="ic">${e.fichiers.length ? '📂' : '📁'}</span>
          <div style="min-width:0;flex:1"><div class="nom-el">${echapper(e.nom)}${e.inscrit ? '' : ' <span class="note-prof" style="margin:0">(plus dans la liste)</span>'}</div>
            <div class="meta-el">${e.fichiers.length ? `${e.fichiers.length} document${e.fichiers.length > 1 ? 's' : ''} · dernier enregistrement ${date(e.fichiers[0].date)}` : 'Rien d\'enregistré pour l\'instant'}</div>
            ${e.fichiers.length ? `<div class="fichiers-eleve">${e.fichiers.map((f) => `<button class="lien" data-ouvrir="${echapper(e.nom)}" data-fichier="${echapper(f.nom)}" title="Ouvrir avec le logiciel du PC">${ICONES_EXT[(f.nom.split('.').pop() || '').toLowerCase()] || '📄'} ${echapper(f.nom)} <small>${date(f.date)} · ${tailleTexte(f.taille)}</small></button>`).join('')}</div>` : ''}
          </div>
          <div class="actions-el">${e.fichiers.length ? `<button data-dossier="${echapper(e.nom)}">Ouvrir son dossier</button>` : ''}</div>
        </div>`).join('') || '<p class="prof-vide">Aucun élève dans cette classe.</p>'}</div>`;
    $('#prof-copies-actualiser').addEventListener('click', () => afficherCopies(c));
    $('#prof-copies-dossier').addEventListener('click', async () => verifier(await P.copiesOuvrir(c.id)));
    zone.querySelectorAll('[data-dossier]').forEach((b) => b.addEventListener('click', async () => verifier(await P.copiesOuvrir(c.id, b.dataset.dossier))));
    zone.querySelectorAll('[data-ouvrir]').forEach((b) => b.addEventListener('click', async () => verifier(await P.copiesOuvrir(c.id, b.dataset.ouvrir, b.dataset.fichier))));
  }

  async function afficherEleves(c) {
    const zone = $('#prof-onglet');
    const eleves = c.eleves || [];
    const s = await api.suivi.etat();
    const connexions = s.ok ? s.connexions.filter((x) => x.classeId === c.id) : [];
    const parEleve = (id) => connexions.filter((x) => x.eleveId === id);
    const nbConnectes = new Set(connexions.map((x) => x.eleveId)).size;
    const doublons = eleves.filter((e) => parEleve(e.id).length > 1);
    const changements = connexions.filter((x) => x.ancien);
    const refuses = s.ok ? s.refus.filter((x) => x.classe === c.nom) : [];
    const statut = !s.ok ? '' : s.actif
      ? `<span class="suivi-etat actif">● Suivi en direct actif</span> <span class="note-prof" style="margin:0">${nbConnectes} / ${eleves.length} élève${eleves.length > 1 ? 's' : ''} connecté${nbConnectes > 1 ? 's' : ''}</span>`
      : `<span class="suivi-etat">● Suivi en direct indisponible${s.erreur ? ` : ${echapper(s.erreur)}` : ''}</span>`;
    zone.innerHTML = `
      <div class="barre-contenu">
        <button class="principal" id="prof-ajout-eleves">+ Ajouter des élèves</button>
        <button class="secondaire" id="prof-csv-eleves" title="Fichier CSV exporté de Pronote (liste des élèves de la classe)">📄 Importer la liste Pronote (CSV)</button>
        <span style="align-self:center;display:flex;gap:10px;align-items:center;flex-wrap:wrap">${statut}</span>
      </div>
      ${changements.map((x) => `<div class="alerte-doublon">⚠ L'ordinateur <b>${echapper(x.nomPoste)}</b> était celui de <b>${echapper(x.ancien.nom)}</b>${x.ancien.classe && x.ancien.classe !== x.classe ? ` (${echapper(x.ancien.classe)})` : ''}, mais il est maintenant connecté au nom de <b>${echapper(x.nom)}</b>, sans que tu l'aies libéré.
        <div class="rangee" style="margin-top:8px"><button class="secondaire" data-accepter="${x.poste}">C'est normal (il appartient maintenant à ${echapper(x.nom)})</button><button class="principal" data-deconnecter="${x.eleveId}|${x.poste}">Déconnecter</button></div></div>`).join('')}
      ${doublons.length ? `<div class="alerte-doublon">⚠ ${doublons.map((e) => `<b>${echapper(e.nom)}</b>`).join(', ')} ${doublons.length > 1 ? 'sont connectés' : 'est connecté(e)'} sur plusieurs ordinateurs. Déconnecte l'ordinateur qui n'est pas le sien.</div>` : ''}
      ${eleves.length ? `<div class="liste-eleves">${eleves.map((e) => {
        const cx = parEleve(e.id);
        return `<div class="eleve ${cx.length > 1 || cx.some((x) => x.ancien) ? 'doublon' : ''}"><span class="pastille-nom">${echapper(initiales(e.nom))}</span>
          <span style="min-width:0;flex:1">${echapper(e.nom)}
            ${cx.length ? cx.map((x) => `<span class="poste">${cx.length > 1 || x.ancien ? '⚠' : '🟢'} ${echapper(x.nomPoste)}${x.examen ? ' · 🎓 en examen' : ''}${x.ancien ? ` <i>(PC de ${echapper(x.ancien.nom)})</i>` : ''} <button class="liberer" data-deconnecter="${x.eleveId}|${x.poste}" title="Renvoyer cet ordinateur à l'écran d'identification">Déconnecter</button></span>`).join('')
              : '<span class="poste">hors ligne</span>'}</span>
          <button class="suppr" data-suppr-eleve="${e.id}" title="Retirer de la classe">×</button></div>`;
      }).join('')}</div>`
        : '<p class="prof-vide">Aucun élève. Clique sur « Ajouter des élèves » : tu peux coller toute la liste d\'un coup (par exemple depuis Pronote ou un tableur), un élève par ligne.</p>'}
      ${journalClasse(s, c)}
      ${refuses.length ? `<div class="refus"><b>Ordinateurs déconnectés pendant cette séance</b>${refuses.map((x) => `<div>${echapper(x.nom)} sur ${echapper(x.nomPoste)} <button class="lien" data-autoriser="${echapper(x.cle)}">Autoriser à nouveau</button></div>`).join('')}</div>` : ''}
      <p class="note-prof">Chaque élève choisit sa classe puis son nom au démarrage. Tant que l'espace professeur est ouvert sur ton PC, tu vois en direct sur quel ordinateur chaque élève est connecté (mise à jour toutes les 15 secondes). Si un même nom apparaît sur deux ordinateurs, clique sur <b>Déconnecter</b> à côté de celui qui n'est pas le bon : il revient à l'écran d'identification et ne peut plus reprendre ce nom pendant la séance.</p>`;
    zone.querySelectorAll('[data-deconnecter]').forEach((b) => b.addEventListener('click', async () => {
      const [eleveId, poste] = b.dataset.deconnecter.split('|');
      const x = connexions.find((y) => y.eleveId === eleveId && y.poste === poste);
      if (!x) return;
      if (!confirm(`Déconnecter ${x.nom} de l'ordinateur ${x.nomPoste} ?`)) return;
      if (verifier(await api.suivi.deconnecter(eleveId, poste))) { toast('Ordinateur déconnecté', `${x.nomPoste} revient à l'écran d'identification (dans 15 secondes au plus).`, 'info'); afficherEleves(c); }
    }));
    zone.querySelectorAll('[data-accepter]').forEach((b) => b.addEventListener('click', async () => {
      if (verifier(await api.suivi.accepter(b.dataset.accepter))) { toast('C\'est noté', 'Cet ordinateur appartient maintenant à cet élève.', 'info'); afficherEleves(c); }
    }));
    zone.querySelectorAll('[data-autoriser]').forEach((b) => b.addEventListener('click', async () => { if (verifier(await api.suivi.autoriser(b.dataset.autoriser))) afficherEleves(c); }));
    $('#prof-ajout-eleves').addEventListener('click', async () => {
      const v = await saisir(`Ajouter des élèves — ${c.nom}`, [{ label: 'Un élève par ligne (ex. « DUPONT Léa »). Tu peux coller directement une liste copiée depuis Pronote ou un tableur.', type: 'textarea', placeholder: 'DUPONT Léa\nMARTIN Hugo\n…' }], 'Ajouter');
      if (!v) return;
      // Copie depuis Pronote ou un tableur : seule la première colonne (le nom) est gardée ; la ligne d'en-tête est ignorée.
      const noms = v[0].split(/\r?\n/).map((n) => n.split('\t')[0].trim()).filter((n) => n && !/^(nom|élève|eleve|nom prénom|nom et prénom)s?$/i.test(n));
      const r = await P.ajouterEleves(c.id, noms);
      if (!verifier(r)) return;
      toast('Élèves ajoutés', `${r.ajoutes} élève${r.ajoutes > 1 ? 's' : ''} ajouté${r.ajoutes > 1 ? 's' : ''} (les doublons sont ignorés).`, 'info');
      vue.classes = await api.classes.lister();
      afficherTableau();
    });
    // Import de la liste Pronote (CSV) : aperçu, l'enseignant coche les élèves à ajouter
    $('#prof-csv-eleves').addEventListener('click', async () => {
      const r = await P.elevesCsv(c.id);
      if (r.annule || !verifier(r)) return;
      if (!r.noms.length) { toast('Aucun élève trouvé', `Le fichier « ${r.fichier} » ne contient pas de liste de noms reconnue.`, 'erreur'); return; }
      const deja = new Set(eleves.map((x) => x.nom.toLowerCase()));
      const dlg = document.createElement('dialog');
      dlg.className = 'dialogue';
      dlg.innerHTML = `<div class="dialogue-contenu"><header><h2>📄 Liste Pronote — ${echapper(c.nom)}</h2><button class="icone-btn" data-fermer aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
        <p class="note-prof">${r.noms.length} élève(s) trouvé(s) dans « ${echapper(r.fichier)} » (${echapper(r.colonnes)}). Décoche ceux à ne pas ajouter ; ceux déjà dans la classe ne sont pas cochés.</p>
        <label class="case"><input type="checkbox" id="csv-tous" checked> Tout cocher</label>
        <div class="csv-liste">${r.noms.map((n, i) => `<label class="case ${deja.has(n.toLowerCase()) ? 'deja' : ''}"><input type="checkbox" data-csv="${i}" ${deja.has(n.toLowerCase()) ? 'disabled' : 'checked'}> ${echapper(n)}${deja.has(n.toLowerCase()) ? ' <span class="note-prof" style="display:inline">(déjà dans la classe)</span>' : ''}</label>`).join('')}</div>
        <div class="rangee"><span class="espace"></span><button class="principal" id="csv-ok">Ajouter les élèves cochés</button></div></div>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('close', () => dlg.remove());
      dlg.querySelector('[data-fermer]').addEventListener('click', () => dlg.close());
      dlg.querySelector('#csv-tous').addEventListener('change', (ev) => dlg.querySelectorAll('[data-csv]:not(:disabled)').forEach((x) => { x.checked = ev.target.checked; }));
      dlg.querySelector('#csv-ok').addEventListener('click', async () => {
        const noms = [...dlg.querySelectorAll('[data-csv]:checked')].map((x) => r.noms[+x.dataset.csv]);
        if (!noms.length) { dlg.close(); return; }
        const a = await P.ajouterEleves(c.id, noms);
        if (!verifier(a)) return;
        dlg.close();
        toast('Élèves ajoutés', `${a.ajoutes} élève${a.ajoutes > 1 ? 's' : ''} ajouté${a.ajoutes > 1 ? 's' : ''} depuis la liste Pronote.`, 'info');
        vue.classes = await api.classes.lister();
        afficherTableau();
      });
      dlg.showModal();
    });
    zone.querySelectorAll('[data-suppr-eleve]').forEach((b) => b.addEventListener('click', async () => {
      const e = eleves.find((x) => x.id === b.dataset.supprEleve);
      if (!confirm(`Retirer ${e.nom} de la classe ?`)) return;
      if (verifier(await P.supprimerEleve(c.id, e.id))) { vue.classes = await api.classes.lister(); afficherTableau(); }
    }));
  }

  const heureCourte = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dureeCourte = (ms) => { const sec = Math.round(ms / 1000); return sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} s`; };
  function texteEvenement(ev) {
    if (ev.type === 'fermeture') return { css: 'fermeture', texte: `${ev.nom} a fermé Labo Élève` };
    if (ev.type === 'reseau') return { css: 'grave', texte: `${ev.nom} a perdu la connexion pendant ${dureeCourte(ev.dureeMs)}${ev.examen ? ' (pendant l\'examen)' : ''}` };
    if (ev.type === 'perdu-examen') return { css: 'grave', texte: `${ev.nom} ne répond plus pendant l'examen (réseau coupé ?)` };
    if (ev.type === 'examen-leve') return { css: 'fermeture', texte: `Examen terminé sur l'ordinateur de ${ev.nom} avec ton mot de passe` };
    if (ev.type === 'examen-local') return { css: 'fermeture', texte: `Examen sans réseau démarré avec le code sur l'ordinateur de ${ev.nom}` };
    if (ev.type === 'fermeture-urgence') return { css: 'fermeture', texte: `Labo Élève de ${ev.nom} a été fermé par un enseignant (fermeture d'urgence)` };
    if (ev.type === 'fermeture-forcee') return { css: 'grave', texte: `Labo Élève de ${ev.nom} a été fermé de force (Gestionnaire des tâches ?)` };
    return { css: 'grave', texte: `${ev.nom} a quitté Labo Élève pendant ${dureeCourte(ev.dureeMs)}` };
  }
  function journalClasse(s, c) {
    const liste = s.ok ? (s.journal || []).filter((ev) => ev.classeId === c.id) : [];
    if (!liste.length) return '';
    return `<div class="journal-seance"><h4>🕒 Journal de la séance</h4><ul>${liste.map((ev) => {
      const t = texteEvenement(ev);
      return `<li class="${t.css}"><span class="heure">${heureCourte(ev.a)}</span><span>${echapper(t.texte)} <span class="note-prof" style="display:inline">· ${echapper(ev.nomPoste)}</span></span></li>`;
    }).join('')}</ul></div>`;
  }

  // ---------- Contenu : dossiers, Digipads, documents ----------
  // Classe à plusieurs matières : on travaille dans une matière à la fois (onglets de matières).
  function matiereVue(c) {
    const l = matieresDe(c);
    if (l.length < 2) return null;
    if (!l.includes(vue.matiere)) vue.matiere = l[0];
    return vue.matiere;
  }
  const racineVue = (c) => (matiereVue(c) ? '@' + matiereVue(c) : null);
  function dossierCourant(c) {
    const m = matiereVue(c);
    let liste = (c.contenu || []).filter((n) => !m || matiereNoeud(c, n) === m), parent = null;
    const fil = [];
    for (const id of vue.chemin) {
      const d = liste.find((n) => n.id === id && n.type === 'dossier');
      if (!d) break;
      fil.push(d); parent = d; liste = d.enfants || [];
    }
    vue.chemin = fil.map((d) => d.id);
    return { liste, parentId: parent ? parent.id : racineVue(c), fil };
  }
  function tousLesDossiers(noeuds, prefixe = '', racine = null) {
    return noeuds.flatMap((n) => (n.type === 'dossier' ? [{ id: n.id, nom: prefixe + n.nom, racine: racine || n.id }, ...tousLesDossiers(n.enfants || [], prefixe + n.nom + ' › ', racine || n.id)] : []));
  }
  const tailleTexte = (o) => (!o ? '' : o < 1024 * 1024 ? Math.max(1, Math.round(o / 1024)) + ' Ko' : (o / 1048576).toFixed(1).replace('.', ',') + ' Mo');

  // Travail à rendre : placer les cases ou suivre les réponses, dans l'outil « Travail à rendre » ; retour ici ensuite.
  function ouvrirTravail(mode, c, n) {
    $('#espace-prof').hidden = true;
    etat.retourEspaceProf = true;
    ouvrirOutil('travail-pdf', { mode, classe: c.id, travail: n.id });
  }

  function afficherContenu(c) {
    const zone = $('#prof-onglet');
    const { liste, parentId, fil } = dossierCourant(c);
    const m = matiereVue(c);
    const matiereThemes = m || c.matiere; // thèmes proposés : ceux de la matière affichée
    const aDesThemes = (c.contenu || []).some((n) => n.type === 'dossier' && (!m || matiereNoeud(c, n) === m));
    const lecture = !!c.archive; // classe clôturée : on consulte seulement
    zone.innerHTML = `
      ${m ? `<div class="onglets-prof onglets-matieres">${matieresDe(c).map((x) => `<button data-matiere-vue="${x}" class="${x === m ? 'actif' : ''}" style="--c:${infoMatiere(x).couleur}">${infoMatiere(x).icone} ${echapper(infoMatiere(x).nom)}</button>`).join('')}</div>` : ''}
      ${fil.length ? `<div class="barre-retour"><button class="bouton-retour" data-aller="${fil.length > 1 ? fil[fil.length - 2].id : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>${fil.length > 1 ? `Retour : ${echapper(fil[fil.length - 2].nom)}` : 'Retour aux thèmes'}</button></div>` : ''}
      <div class="fil">
        <button data-aller="">🏠 ${echapper(c.nom)}${m ? ' · ' + echapper(infoMatiere(m).nom) : ''}</button>
        ${fil.map((d, i) => (i === fil.length - 1 ? `<span>›</span><span class="courant">${echapper(d.nom)}</span>` : `<span>›</span><button data-aller="${d.id}">${echapper(d.nom)}</button>`)).join('')}
      </div>
      ${!fil.length && !aDesThemes && !lecture ? `<div class="themes-proposes">
        <b>Tes élèves voient pour l'instant les thèmes proposés${matiereThemes ? ' pour ' + echapper(infoMatiere(matiereThemes).nom) : ''} :</b>
        <div>${themesParDefaut(matiereThemes).map((t) => `<span class="puce-theme" style="--c:${t.couleur}">${t.icone} ${echapper(t.nom)}</span>`).join('')}</div>
        <button class="principal" id="prof-themes-defaut">Utiliser ces thèmes et les modifier</button>
        <span class="note-prof" style="margin:0">Ou crée tes propres thèmes avec « Nouveau thème » : dès qu'il y en a un, les thèmes proposés disparaissent.</span>
      </div>` : ''}
      <div class="barre-contenu" ${lecture ? 'hidden' : ''}>
        <button class="secondaire" id="prof-ajout-dossier">📁 ${fil.length ? 'Nouveau dossier' : 'Nouveau thème'}</button>
        <button class="secondaire" id="prof-ajout-outils">🧰 Ajouter des outils</button>
        <button class="secondaire" id="prof-creer-outil" title="Importer une activité H5P, LearningApps, Wordwall, une page web… comme un nouvel outil">🛠 Créer un outil</button>
        <button class="secondaire" id="prof-ajout-pad">🧩 Ajouter un Digipad</button>
        <button class="principal" id="prof-ajout-docs">📄 Ajouter des documents</button>
        <button class="principal" id="prof-ajout-travail" title="Un PDF que les élèves remplissent dans Labo Élève ; tu suis leurs réponses et leurs modifications">📝 Travail à rendre (PDF)</button>
      </div>
      <div class="elements">
        ${liste.length ? liste.map((n, i) => `
          <div class="element ${n.type}" data-id="${n.id}">
            <span class="ic" ${n.type === 'dossier' && n.couleur ? `style="background:color-mix(in srgb, ${n.couleur} 18%, var(--surface));border-color:${n.couleur}"` : ''}>${iconeElement(n)}</span>
            <div style="min-width:0"><div class="nom-el">${echapper(nomElement(n))}</div>
              <div class="meta-el">${n.type === 'dossier' ? `${fil.length ? 'Dossier' : 'Thème'} · ${(n.enfants || []).length} élément${(n.enfants || []).length > 1 ? 's' : ''}` : n.type === 'pad' ? echapper(n.lien) : n.type === 'outil' ? 'Outil' : n.type === 'travail' ? `Travail à rendre (PDF) · ${(n.champs || []).length ? `${n.champs.length} case${n.champs.length > 1 ? 's' : ''} à remplir` : '<b style="color:#c2410c">cases à placer</b>'}` : `Document · ${tailleTexte(n.taille)}`}</div></div>
            <div class="actions-el">${lecture ? (n.type === 'travail' ? '<button data-action="suivi" title="Revoir les copies des élèves">👀 Voir les copies</button>' : '') : `
              <button data-action="haut" title="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button data-action="bas" title="Descendre" ${i === liste.length - 1 ? 'disabled' : ''}>↓</button>
              ${n.type === 'dossier' ? '<button data-action="style">Icône</button>' : ''}
              ${n.type === 'travail' ? '<button data-action="cases" title="Placer les questions sur le PDF (comme une évaluation « exercice »)">📐 Placer les questions</button><button data-action="suivi" title="Voir les réponses des élèves en direct et leurs modifications">👀 Suivre les réponses</button>' : ''}
              ${n.type === 'outil' ? '' : '<button data-action="renommer">Renommer</button>'}
              <button data-action="deplacer">Déplacer</button>
              <button data-action="supprimer" class="danger">Supprimer</button>`}
            </div>
          </div>`).join('') : `<p class="prof-vide">${fil.length ? 'Ce thème est vide. Ajoute des outils, des documents ou un Digipad.' : 'Aucun thème pour l\'instant. Crée des thèmes (par chapitre, par compétence…) et ranges-y les outils, documents et Digipads de tes élèves.'}</p>`}
      </div>
      <p class="note-prof">Les élèves de la classe voient les thèmes en grandes icônes, puis leur contenu : seulement les outils que tu y as rangés. Un document qu'ils ouvrent est copié dans leurs « Mes documents » : ils peuvent le compléter sans modifier l'original.</p>`;

    zone.querySelectorAll('[data-matiere-vue]').forEach((b) => b.addEventListener('click', () => { vue.matiere = b.dataset.matiereVue; vue.chemin = []; afficherDetail(); }));
    zone.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.aller;
      vue.chemin = id ? vue.chemin.slice(0, vue.chemin.indexOf(id) + 1) : [];
      afficherDetail();
    }));
    const apres = async (r) => { if (verifier(r)) { vue.classes = await api.classes.lister(); vue.classeComplete = r.classe || await api.classes.lire(c.id); afficherDetail(); } };
    $('#prof-ajout-dossier').addEventListener('click', async () => {
      const v = await saisir(fil.length ? 'Nouveau dossier' : 'Nouveau thème', [
        { label: fil.length ? 'Nom du dossier' : 'Nom du thème', placeholder: 'ex. Électricité, Fonctions, TP n°3…' },
        { label: 'Icône', type: 'select', options: ICONES_THEMES.map((i) => [i, i]), valeur: ICONES_THEMES[0] },
        { label: 'Couleur', type: 'color', valeur: COULEURS_THEMES[vue.classeComplete && (vue.classeComplete.contenu || []).length % COULEURS_THEMES.length || 0] },
      ], 'Créer');
      if (v) apres(await P.ajouterDossier(c.id, parentId, v[0], { icone: v[1], couleur: v[2] }));
    });
    $('#prof-ajout-outils').addEventListener('click', async () => {
      const presents = new Set(liste.filter((n) => n.type === 'outil').map((n) => n.outil));
      const choix = etat.outils.filter((o) => !presents.has(o.id) && !o.interne).sort((a, b) => a.titre.localeCompare(b.titre, 'fr')).map((o) => [o.id, o.titre, false]);
      if (!choix.length) return toast('Tous les outils sont déjà là', '', 'info');
      const v = await saisir(`Ajouter des outils${fil.length ? ' — ' + fil[fil.length - 1].nom : ''}`, [{ label: 'Coche les outils à proposer aux élèves ici', type: 'cases', options: choix }], 'Ajouter');
      if (v && v[0].length) apres(await P.ajouterOutils(c.id, parentId, v[0]));
    });
    $('#prof-creer-outil').addEventListener('click', () => creerOutil(c, parentId, fil, m || c.matiere, apres));
    $('#prof-themes-defaut')?.addEventListener('click', async () => apres(await P.themesDefaut(c.id, themesParDefaut(matiereThemes), m)));
    $('#prof-ajout-pad').addEventListener('click', async () => {
      const v = await saisir('Ajouter un Digipad', [{ label: 'Nom affiché aux élèves', placeholder: 'ex. Ressources du chapitre' }, { label: 'Lien du pad', type: 'url', placeholder: 'https://digipad.app/p/…' }], 'Ajouter');
      if (v) apres(await P.ajouterPad(c.id, parentId, { nom: v[0], lien: v[1] }));
    });
    $('#prof-ajout-travail').addEventListener('click', async () => {
      const r = await P.travailCreer(c.id, parentId);
      if (!verifier(r) || !r.travail) return;
      vue.classeComplete = r.classe;
      toast('Travail ajouté', 'Place maintenant les cases que les élèves devront remplir.', 'info');
      ouvrirTravail('edition', c, r.travail);
    });
    $('#prof-ajout-docs').addEventListener('click', async () => {
      const r = await P.ajouterDocuments(c.id, parentId);
      if (r.ok && r.ajoutes) toast('Documents ajoutés', `${r.ajoutes} document${r.ajoutes > 1 ? 's' : ''} partagé${r.ajoutes > 1 ? 's' : ''} avec la classe.`, 'info');
      apres(r);
    });

    zone.querySelectorAll('.element').forEach((el) => {
      const n = liste.find((x) => x.id === el.dataset.id);
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-action]');
        if (!b) { if (n.type === 'dossier') { vue.chemin = [...vue.chemin, n.id]; afficherDetail(); } return; }
        e.stopPropagation();
        const a = b.dataset.action;
        if (a === 'haut' || a === 'bas') apres(await P.ordonner(c.id, n.id, a === 'haut' ? -1 : 1));
        else if (a === 'cases') ouvrirTravail('edition', c, n);
        else if (a === 'suivi') ouvrirTravail('suivi', c, n);
        else if (a === 'style') {
          const v = await saisir(`Icône du thème « ${n.nom} »`, [
            { label: 'Icône', type: 'select', options: ICONES_THEMES.map((i) => [i, i]), valeur: n.icone || '📁' },
            { label: 'Couleur', type: 'color', valeur: n.couleur || '#5865f2' },
          ], 'Enregistrer');
          if (v) apres(await P.styleDossier(c.id, n.id, { icone: v[0], couleur: v[1] }));
        }
        else if (a === 'renommer') { const v = await saisir('Renommer', [{ label: 'Nouveau nom', valeur: n.nom }], 'Renommer'); if (v) apres(await P.renommer(c.id, n.id, v[0])); }
        else if (a === 'supprimer') {
          const quoi = n.type === 'dossier' ? `« ${n.nom} » et tout son contenu` : `« ${nomElement(n)} »`;
          if (confirm(`Supprimer ${quoi} ? Les élèves ne le verront plus.`)) apres(await P.supprimer(c.id, n.id));
        } else if (a === 'deplacer') {
          // Classe à plusieurs matières : on peut aussi déplacer vers les thèmes d'une autre matière.
          const racines = m ? matieresDe(c).map((x) => ['@' + x, `🏠 ${infoMatiere(x).icone} ${infoMatiere(x).nom} (racine)`]) : [['', `🏠 ${c.nom} (racine)`]];
          const prefixe = (d) => (m ? infoMatiere(matiereNoeud(c, (c.contenu || []).find((r) => r.id === d.racine) || {})).icone + ' ' : '');
          const dossiers = tousLesDossiers(c.contenu || []).filter((d) => d.id !== n.id);
          const v = await saisir(`Déplacer « ${nomElement(n)} »`, [{ label: 'Vers', type: 'select', options: [...racines, ...dossiers.map((d) => [d.id, '📁 ' + prefixe(d) + d.nom])], valeur: parentId || '' }], 'Déplacer');
          if (v) apres(await P.deplacer(c.id, n.id, v[0] || null));
        }
      });
    });
  }

  window.ouvrirEspaceProf = ouvrirEspace;
  window.saisirProf = saisir; // petite fenêtre de saisie, réutilisée côté élève

  // ---------- Suivi en direct : actualisation et alerte « même élève sur deux PC » ----------
  const alertesVues = new Set();
  let dernierEvenement = 0;
  setInterval(async () => {
    const s = await api.suivi.etat();
    if (!s.ok) return;
    // Fermetures et sorties des élèves (mode focus)
    for (const ev of [...(s.journal || [])].reverse()) {
      if (ev.n <= dernierEvenement) continue;
      dernierEvenement = ev.n;
      const t = texteEvenement(ev);
      const titre = ev.type === 'fermeture' ? `🔔 ${ev.nom} a fermé Labo Élève à ${heureCourte(ev.a)}` : `⚠ ${t.texte}`;
      toast(titre, `${ev.classe} · ${ev.nomPoste}${ev.type === 'fermeture' ? '' : ` · à ${heureCourte(ev.a)}`}`, ev.type === 'fermeture' ? 'info' : 'erreur', {
        libelle: 'Voir', faire: () => { vue.classeId = ev.classeId; vue.onglet = 'eleves'; ouvrirEspace(); },
      });
    }
    // Liste des élèves à jour si l'onglet est affiché
    if (!$('#espace-prof').hidden && vue.onglet === 'eleves' && classeActive() && !$('#dlg-saisie').open) afficherEleves(classeActive());
    // Alerte, où que soit le professeur dans l'application
    const parEleve = new Map();
    for (const x of s.connexions) parEleve.set(x.eleveId, [...(parEleve.get(x.eleveId) || []), x]);
    for (const x of s.connexions.filter((y) => y.ancien)) {
      const cle = 'changement:' + x.poste + ':' + x.eleveId;
      if (alertesVues.has(cle)) continue;
      alertesVues.add(cle);
      toast(`⚠ ${x.nomPoste} : ordinateur de ${x.ancien.nom}`, `Il est maintenant connecté au nom de ${x.nom}, sans que tu l'aies libéré.`, 'erreur', {
        libelle: 'Voir', faire: () => { vue.classeId = x.classeId; vue.onglet = 'eleves'; ouvrirEspace(); },
      });
    }
    for (const [eleveId, liste] of parEleve) {
      if (liste.length < 2) { alertesVues.delete(eleveId); continue; }
      const cle = eleveId + ':' + liste.map((x) => x.poste).sort().join(',');
      if (alertesVues.has(cle)) continue;
      alertesVues.add(cle);
      toast(`⚠ ${liste[0].nom} est connecté(e) sur ${liste.length} ordinateurs`, liste.map((x) => x.nomPoste).join(' et '), 'erreur', {
        libelle: 'Voir', faire: () => { vue.classeId = liste[0].classeId; vue.onglet = 'eleves'; ouvrirEspace(); },
      });
    }
  }, 5000);
  window.profOutils = { saisir, verifier, rafraichir: async () => { if (vue.classeId) { vue.classeComplete = await api.classes.lire(vue.classeId); afficherDetail(); } }, ongletActif: () => vue.onglet };
})();
