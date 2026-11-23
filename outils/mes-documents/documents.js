// Outil « Mes documents » : liste les documents de l'élève et ouvre les PDF
// dans le lecteur PDF.js intégré, qui permet d'écrire, dessiner et surligner.
(function () {
  const api = window.parent && window.parent.labo && window.parent.labo.documents;
  const $ = (id) => document.getElementById(id);

  const TYPES = {
    pdf: { libelle: 'PDF', couleur: '#dc2626' },
    docx: { libelle: 'DOC', couleur: '#2563eb' }, doc: { libelle: 'DOC', couleur: '#2563eb' }, odt: { libelle: 'ODT', couleur: '#2563eb' },
    xlsx: { libelle: 'XLS', couleur: '#16a34a' }, xls: { libelle: 'XLS', couleur: '#16a34a' }, ods: { libelle: 'ODS', couleur: '#16a34a' }, csv: { libelle: 'CSV', couleur: '#16a34a' },
    pptx: { libelle: 'PPT', couleur: '#ea580c' }, ppt: { libelle: 'PPT', couleur: '#ea580c' }, odp: { libelle: 'ODP', couleur: '#ea580c' },
    png: { libelle: 'IMG', couleur: '#7c3aed' }, jpg: { libelle: 'IMG', couleur: '#7c3aed' }, jpeg: { libelle: 'IMG', couleur: '#7c3aed' }, gif: { libelle: 'IMG', couleur: '#7c3aed' }, webp: { libelle: 'IMG', couleur: '#7c3aed' },
    txt: { libelle: 'TXT', couleur: '#475569' },
  };
  const IMAGES = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  const urlDocument = (nom) => '/documents/' + encodeURIComponent(nom);
  const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function taille(o) {
    if (o < 1024) return o + ' o';
    if (o < 1024 * 1024) return Math.round(o / 1024) + ' Ko';
    return (o / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';
  }
  function dateTexte(iso) {
    const d = new Date(iso);
    const auj = new Date();
    if (d.toDateString() === auj.toDateString()) return "aujourd'hui à " + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  // ---------- Liste ----------
  async function afficherListe() {
    const docs = api ? await api.lister() : [];
    $('vide').hidden = docs.length > 0;
    $('liste').innerHTML = docs.map((d) => {
      const t = TYPES[d.ext] || { libelle: (d.ext || '?').toUpperCase().slice(0, 4), couleur: '#64748b' };
      return `<div class="doc" role="button" tabindex="0" data-nom="${echapper(d.nom)}" style="--c:${t.couleur}">
        <div class="type">${t.libelle}</div>
        <div class="infos">
          <div class="nom" title="${echapper(d.nom)}">${echapper(d.nom)}${/ - complété\./.test(d.nom) ? '<span class="badge-complete">complété</span>' : ''}</div>
          <div class="meta">${dateTexte(d.date)} · ${taille(d.taille)}</div>
          <div class="actions-doc">
            <button class="btn" data-ouvrir>Ouvrir</button>
            <button class="btn" data-envoyer hidden title="Envoyer une copie de ce document à ton professeur">📤 Au prof</button>
            <button class="btn suppr" data-supprimer>Supprimer</button>
          </div>
        </div>
      </div>`;
    }).join('');
    // Élève inscrit dans une classe : chaque document peut être envoyé à son professeur.
    if ((await Doc.infoProf()).disponible) document.querySelectorAll('[data-envoyer]').forEach((b) => { b.hidden = false; });
  }

  $('liste').addEventListener('click', async (e) => {
    const carte = e.target.closest('.doc');
    if (!carte) return;
    const nom = carte.dataset.nom;
    if (e.target.closest('[data-envoyer]')) { Doc.retenirEnvoi(nom, true); await Doc.envoyerProf(nom); return; }
    if (e.target.closest('[data-supprimer]')) {
      if (!confirm(`Mettre « ${nom} » à la corbeille ?`)) return;
      await api.supprimer(nom);
      return afficherListe();
    }
    ouvrir(nom);
  });
  $('liste').addEventListener('keydown', (e) => {
    const carte = e.target.closest('.doc');
    if (carte && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ouvrir(carte.dataset.nom); }
  });
  $('btn-importer').addEventListener('click', async () => { await api.importer(); afficherListe(); });
  $('btn-nouveau-texte').addEventListener('click', () => ouvrirDans('traitement-de-texte'));
  $('btn-nouveau-tableau').addEventListener('click', () => ouvrirDans('tableur'));
  $('btn-dossier').addEventListener('click', () => api.ouvrirDossier());

  // L'application prévient quand un document arrive (téléchargement ou enregistrement).
  window.addEventListener('labo:documents', (e) => {
    afficherListe();
    if (docOuvert && e.detail && / - complété\./.test(e.detail.nom)) {
      $('etat-enregistrement').textContent = `✓ Enregistré sous « ${e.detail.nom} »`;
      if (enregistrementDemande) { enregistrementDemande = false; Doc.proposerEnvoiProf(e.detail.nom); } // PDF annoté
      tailleEnregistree = stockage()?.size ?? 0;
    }
  });

  // ---------- Lecteur ----------
  let docOuvert = null;
  let tailleEnregistree = 0;
  const app = () => $('lecteur').contentWindow && $('lecteur').contentWindow.PDFViewerApplication;
  const stockage = () => app() && app().pdfDocument && app().pdfDocument.annotationStorage;

  const TEXTE = ['docx', 'txt'];
  const TABLEUR = ['xlsx', 'xls', 'ods', 'csv'];
  const ouvrirDans = (outil, nom) => window.parent.ouvrirOutil(outil, nom ? { ouvrir: nom } : {});

  function ouvrir(nom) {
    const ext = (nom.split('.').pop() || '').toLowerCase();
    if (TEXTE.includes(ext)) return ouvrirDans('traitement-de-texte', nom);
    if (/\.cartes\.csv$/i.test(nom)) return ouvrirDans('cartes-memoire', nom); // paquet de cartes mémoire
    if (TABLEUR.includes(ext)) return ouvrirDans('tableur', nom);
    if (ext === 'py') return ouvrirDans('python', nom);
    docOuvert = nom;
    tailleEnregistree = 0;
    $('nom-doc').textContent = nom;
    $('etat-enregistrement').textContent = '';
    $('vue-liste').hidden = true;
    $('vue-lecteur').hidden = false;
    const estPdf = ext === 'pdf';
    $('btn-enregistrer').hidden = !estPdf;
    $('astuce').hidden = !estPdf;
    $('lecteur').hidden = !estPdf;
    $('apercu-autre').hidden = estPdf;
    if (estPdf) {
      $('lecteur').src = `pdfjs/web/viewer.html?file=${encodeURIComponent(urlDocument(nom))}#locale=fr`;
    } else if (IMAGES.includes(ext)) {
      $('apercu-autre').innerHTML = `<img src="${urlDocument(nom)}" alt="${echapper(nom)}">`;
    } else {
      $('apercu-autre').innerHTML = `<div class="carte-info"><h2>Format non pris en charge</h2>
        <p>Les fichiers ${echapper(ext.toUpperCase())} ne peuvent pas s'ouvrir dans Labo Élève. Labo Élève ouvre les PDF, les images, les documents Word (.docx), les tableaux (.xlsx, .xls, .ods, .csv) et les programmes Python (.py).${ext === 'doc' || ext === 'odt' ? ' Demande à ton professeur une version .docx ou PDF.' : ''}</p></div>`;
    }
  }

  // Une fois le lecteur chargé : on retire les boutons inutiles (ouvrir un autre fichier).
  $('lecteur').addEventListener('load', () => {
    try {
      const d = $('lecteur').contentDocument;
      const style = d.createElement('style');
      style.textContent = '#openFile, #secondaryOpenFile { display: none !important; }';
      d.head.append(style);
    } catch { /* lecteur pas encore prêt */ }
  });

  let enregistrementDemande = false;
  async function enregistrer() {
    const a = app();
    if (!a || !a.pdfDocument) return;
    $('etat-enregistrement').textContent = 'Enregistrement…';
    enregistrementDemande = true;
    await a.downloadOrSave(); // le fichier « … - complété.pdf » est rangé dans Mes documents
  }
  $('btn-enregistrer').addEventListener('click', enregistrer);

  function fermer() {
    const s = stockage();
    if (s && s.size !== tailleEnregistree && !confirm('Tu as peut-être des modifications non enregistrées. Revenir quand même à la liste ?')) return;
    docOuvert = null;
    $('lecteur').src = 'about:blank';
    $('vue-lecteur').hidden = true;
    $('vue-liste').hidden = false;
    afficherListe();
  }
  $('btn-retour').addEventListener('click', fermer);

  // Appelé par l'application avant de fermer l'outil.
  window.laboAvantFermeture = () => {
    const s = docOuvert && stockage();
    return !s || s.size === tailleEnregistree || confirm('Ton PDF a peut-être des modifications non enregistrées. Quitter quand même ?');
  };

  // Ctrl+S enregistre aussi
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 's' && docOuvert) { e.preventDefault(); enregistrer(); }
  });

  // ---------- Démarrage ----------
  afficherListe().then(() => {
    const aOuvrir = new URLSearchParams(location.search).get('ouvrir');
    if (aOuvrir) ouvrir(aOuvrir);
  });
})();
