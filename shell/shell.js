// Interface d'accueil de Labo Élève.
const api = window.labo;
const $ = (s) => document.querySelector(s);

const MATIERES = {
  maths: { nom: 'Mathématiques', couleur: '#5865f2' },
  'physique-chimie': { nom: 'Physique-Chimie', couleur: '#e8590c' },
  bureautique: { nom: 'Bureautique', couleur: '#2563eb' },
  documents: { nom: 'Documents du cours', couleur: '#0891b2' },
  etablissement: { nom: 'Établissement', couleur: '#0f766e' },
  internet: { nom: 'Internet', couleur: '#d97706' },
  exercices: { nom: 'Exercices en ligne', couleur: '#e03131' },
};
const nomMatiere = (m) => MATIERES[m]?.nom || (m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Autre');

// Niveaux d'étude. Un outil indique les siens dans « niveaux » de son manifest.json
// (ex. ["2pro", "1pro"]). Sans ce champ, il est proposé à tous les niveaux.
const NIVEAUX = [
  { id: 'cap1', famille: 'CAP', sigle: 'CAP 1', nom: '1re année de CAP', court: 'CAP 1re année', couleur: '#0ea5e9' },
  { id: 'cap2', famille: 'CAP', sigle: 'CAP 2', nom: '2e année de CAP', court: 'CAP 2e année', couleur: '#14b8a6' },
  { id: '2pro', famille: 'Bac professionnel', sigle: '2de pro', nom: 'Seconde professionnelle', court: '2de pro', couleur: '#5865f2' },
  { id: '1pro', famille: 'Bac professionnel', sigle: '1re pro', nom: 'Première professionnelle', court: '1re pro', couleur: '#8b5cf6' },
  { id: 'tpro', famille: 'Bac professionnel', sigle: 'Tle pro', nom: 'Terminale professionnelle', court: 'Tle pro', couleur: '#e8590c' },
];
const niveauParId = (id) => NIVEAUX.find((n) => n.id === id);
const pourNiveau = (o, id) => !Array.isArray(o.niveaux) || !o.niveaux.length || o.niveaux.includes(id);

function texteNiveaux(o) {
  if (!Array.isArray(o.niveaux) || !o.niveaux.length) return o.niveau || '';
  const connus = NIVEAUX.filter((n) => o.niveaux.includes(n.id));
  if (connus.length === NIVEAUX.length) return 'Tous niveaux';
  if (connus.length && connus.every((n) => n.famille === 'CAP') && connus.length === 2) return 'CAP';
  if (connus.length === 3 && connus.every((n) => n.famille !== 'CAP')) return 'Bac pro';
  return connus.map((n) => n.court).join(' · ');
}

const ID_NUMWORKS = 'calculatrice-numworks';

const etat = {
  outils: [],
  numworks: { installe: false }, // émulateur NumWorks téléchargé par l'élève sur ce PC
  logiciels: {}, // ex. { word: { installe: true, nom: 'Microsoft Word' } }
  niveau: lireLocal('niveau', null), // id d'un niveau, 'tous', ou null (pas encore choisi)
  filtre: 'tous',
  recherche: '',
  outilOuvert: null,
  favoris: new Set(lireLocal('favoris', [])),
  nouveaux: new Set(lireLocal('nouveaux', [])),
};

// ---------- Stockage local (préférences de l'élève) ----------
function lireLocal(cle, defaut) {
  try { const v = localStorage.getItem('labo.' + cle); return v ? JSON.parse(v) : defaut; } catch { return defaut; }
}
function ecrireLocal(cle, valeur) {
  try { localStorage.setItem('labo.' + cle, JSON.stringify(valeur)); } catch { /* ignoré */ }
}

// ---------- Thème ----------
const THEMES = ['systeme', 'light', 'dark'];
const ICONES_THEME = {
  systeme: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};
const NOMS_THEME = { systeme: 'Thème : automatique', light: 'Thème : clair', dark: 'Thème : sombre' };
let theme = lireLocal('theme', 'systeme');

function appliquerTheme() {
  const racine = document.documentElement;
  if (theme === 'systeme') delete racine.dataset.theme; else racine.dataset.theme = theme;
  $('#btn-theme').innerHTML = ICONES_THEME[theme];
  $('#btn-theme').title = NOMS_THEME[theme];
  transmettreTheme();
}
function transmettreTheme() {
  for (const id of ['#cadre', '#cadre2']) {
    try {
      const doc = $(id).contentDocument;
      if (!doc?.documentElement) continue;
      if (theme === 'systeme') delete doc.documentElement.dataset.theme;
      else doc.documentElement.dataset.theme = theme;
    } catch { /* outil d'une autre origine : ignoré */ }
  }
}
$('#btn-theme').addEventListener('click', () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  ecrireLocal('theme', theme);
  appliquerTheme();
});

// ---------- Utilitaires ----------
function echapper(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function couleurOutil(o) {
  return /^#[0-9a-f]{3,8}$/i.test(o.couleur || '') ? o.couleur : (MATIERES[o.matiere]?.couleur || '#5865f2');
}
function htmlIcone(o) {
  const ic = o.icone || '🧪';
  if (/\.(svg|png|jpe?g|webp)$/i.test(ic)) {
    return `<img src="app://local/outils/${encodeURIComponent(o.id)}/${encodeURI(ic)}" alt="">`;
  }
  return echapper(ic);
}
function normaliser(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function toast(titre, texte = '', type = '', action = null) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<strong>${echapper(titre)}</strong>${echapper(texte)}`;
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-action';
    b.textContent = action.libelle;
    b.addEventListener('click', () => { el.remove(); action.faire(); });
    el.append(b);
  }
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('sortie'); setTimeout(() => el.remove(), 350); }, action ? 8000 : 5200);
}

// ---------- Accueil ----------
function salutation() {
  const h = new Date().getHours();
  $('#salutation').textContent = h < 5 || h >= 18 ? 'Bonsoir !' : 'Bonjour !';
}

function outilsDuNiveau() {
  const visibles = etat.outils.filter((o) => !o.interne); // outils internes (ex. travail à rendre) : ouverts depuis un thème
  if (!etat.niveau || etat.niveau === 'tous') return visibles;
  return visibles.filter((o) => pourNiveau(o, etat.niveau));
}

// Un outil est-il proposé en ce moment ? (mode focus, examen, recherche internet activée…)
function outilAutorise(o) {
  if (o.application && (etat.classe?.actif || etat.classe?.examen || (etat.classe?.focus && !o.autoriseEnFocus))) return false; // Redy : autorisé en mode focus
  if (o.site === 'recherche' && !etat.rechercheWeb) return false; // l'enseignant ne l'a pas activée
  if (etat.classe?.examen && !etat.classe.examen.outils.includes(o.id)) return false; // examen : outils autorisés seulement
  return true;
}

function outilsVisibles() {
  const q = normaliser(etat.recherche);
  return outilsDuNiveau().filter((o) => {
    if (etat.filtre === 'favoris' && !etat.favoris.has(o.id)) return false;
    if (!outilAutorise(o)) return false;
    if (etat.filtre !== 'tous' && etat.filtre !== 'favoris' && o.matiere !== etat.filtre) return false;
    if (!q) return true;
    return normaliser([o.titre, o.description, texteNiveaux(o), nomMatiere(o.matiere), ...(o.motsCles || [])].join(' ')).includes(q);
  });
}

function afficherFiltres() {
  const base = outilsDuNiveau();
  const comptes = {};
  for (const o of base) comptes[o.matiere] = (comptes[o.matiere] || 0) + 1;
  const puces = [['tous', 'Tout', base.length]];
  for (const m of Object.keys(comptes).sort((a, b) => nomMatiere(a).localeCompare(nomMatiere(b)))) {
    puces.push([m, nomMatiere(m), comptes[m]]);
  }
  const nbFavoris = base.filter((o) => etat.favoris.has(o.id)).length;
  if (nbFavoris) puces.push(['favoris', '★ Favoris', nbFavoris]);
  if (!puces.some(([id]) => id === etat.filtre)) etat.filtre = 'tous';
  $('#filtres').innerHTML = puces
    .map(([id, nom, n]) => `<button class="puce ${id === etat.filtre ? 'active' : ''}" data-filtre="${echapper(id)}">${echapper(nom)} <span class="compte">${n}</span></button>`)
    .join('');
}

// Carte d'un outil (accueil, thèmes)
function htmlCarte(o, i, favori = true) {
  return `
    <article class="carte" tabindex="0" role="button" data-id="${echapper(o.id)}" style="--c:${couleurOutil(o)}; animation-delay:${Math.min(i, 12) * 30}ms">
      <div class="haut">
        <div class="tuile">${htmlIcone(o)}</div>
        ${!favori ? '' : `<button class="favori ${etat.favoris.has(o.id) ? 'oui' : ''}" data-favori="${echapper(o.id)}" title="Favori" aria-label="Ajouter aux favoris">
          <svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>
        </button>`}
      </div>
      <div>
        <h2>${echapper(o.titre)}</h2>
        <p>${echapper(o.description || '')}</p>
      </div>
      <div class="bas">
        <span class="badge">${echapper(nomMatiere(o.matiere))}</span>
        ${texteNiveaux(o) ? `<span class="badge neutre">${echapper(texteNiveaux(o))}</span>` : ''}
        ${etat.nouveaux.has(o.id) ? '<span class="badge nouveau">Nouveau</span>' : ''}
        ${o.id === ID_NUMWORKS && !etat.numworks.installe ? '<span class="badge neutre">À télécharger</span>' : ''}
        ${o.application && !etat.logiciels[o.application]?.installe ? '<span class="badge neutre">Non installé</span>' : ''}
        ${o.pad ? '<span class="badge neutre">En ligne</span>' : ''}
        <span class="version">v${echapper(o.version)}</span>
      </div>
    </article>`;
}

function afficherGrille() {
  const liste = outilsVisibles().sort((a, b) =>
    (etat.favoris.has(b.id) - etat.favoris.has(a.id)) || a.titre.localeCompare(b.titre, 'fr'));
  $('#grille').innerHTML = liste.map((o, i) => htmlCarte(o, i)).join('');
  $('#vide').hidden = liste.length > 0;
  $('#vide').textContent = etat.recherche || etat.filtre !== 'tous'
    ? 'Aucun outil ne correspond à ta recherche.'
    : 'Pas encore d\'outil pour ce niveau. Ton professeur pourra en ajouter.';
}

function rafraichirAccueil() {
  const n = niveauParId(etat.niveau);
  $('#niveau-actuel').textContent = n ? n.nom : 'Tous les niveaux';
  afficherFiltres();
  afficherGrille();
}

// ---------- Choix du niveau ----------
function afficherChoixNiveau() {
  const familles = [...new Set(NIVEAUX.map((n) => n.famille))];
  let i = 0;
  $('#niveaux').innerHTML = familles.map((f) => `
    <section class="famille-niveaux">
      <h2>${echapper(f)}</h2>
      <div class="rangee-niveaux">
        ${NIVEAUX.filter((n) => n.famille === f).map((n) => {
          const nb = etat.outils.filter((o) => pourNiveau(o, n.id)).length;
          return `<button class="carte-niveau ${etat.niveau === n.id ? 'actuel' : ''}" data-niveau="${n.id}" style="--c:${n.couleur}; animation-delay:${i++ * 50}ms">
            <span class="sigle">${echapper(n.sigle)}</span>
            <span class="nom-niveau">${echapper(n.nom)}</span>
            <span class="nb">${nb} outil${nb > 1 ? 's' : ''}</span>
          </button>`;
        }).join('')}
      </div>
    </section>`).join('');
  $('#accueil').hidden = true;
  $('#vue-outil').hidden = true;
  $('#choix-niveau').hidden = false;
}

function choisirNiveau(id) {
  etat.niveau = id;
  etat.filtre = 'tous';
  ecrireLocal('niveau', id);
  $('#choix-niveau').hidden = true;
  $('#accueil').hidden = false;
  rafraichirAccueil();
}

$('#niveaux').addEventListener('click', (e) => {
  const b = e.target.closest('[data-niveau]');
  if (b) choisirNiveau(b.dataset.niveau);
});
$('#btn-tous-niveaux').addEventListener('click', () => choisirNiveau('tous'));
$('#btn-niveau').addEventListener('click', afficherChoixNiveau);

async function chargerOutils() {
  etat.outils = await api.listerOutils();
  etat.numworks = await api.numworks.etat();
  await majLogiciels();
  rafraichirAccueil();
  afficherInstalles();
  if (!$('#choix-niveau').hidden) afficherChoixNiveau();
}

$('#filtres').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtre]');
  if (!b) return;
  etat.filtre = b.dataset.filtre;
  rafraichirAccueil();
});
$('#recherche').addEventListener('input', (e) => { etat.recherche = e.target.value; afficherGrille(); });

$('#grille').addEventListener('click', (e) => {
  const fav = e.target.closest('[data-favori]');
  if (fav) {
    e.stopPropagation();
    const id = fav.dataset.favori;
    etat.favoris.has(id) ? etat.favoris.delete(id) : etat.favoris.add(id);
    ecrireLocal('favoris', [...etat.favoris]);
    rafraichirAccueil();
    return;
  }
  const carte = e.target.closest('.carte');
  if (carte) ouvrirOutil(carte.dataset.id);
});
$('#grille').addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('carte')) {
    e.preventDefault();
    ouvrirOutil(e.target.dataset.id);
  }
});

// ---------- Logiciels installés (Word, Excel…) ----------
async function majLogiciels() {
  const ids = [...new Set(etat.outils.map((o) => o.application).filter(Boolean))];
  const etats = await Promise.all(ids.map((a) => api.logiciel.etat(a)));
  etat.logiciels = Object.fromEntries(ids.map((a, i) => [a, etats[i]]));
}

// ---------- Ouverture d'un outil ----------
async function ouvrirOutil(id, parametres = {}) {
  const o = etat.outils.find((x) => x.id === id);
  if (!o) return;
  // Site intégré (Office, ENT, Pronote) : adresse fournie par l'application.
  const site = o.office || o.site;
  const urlSite = site ? await api.office.url(site) : null;
  if (site === 'recherche' && !urlSite) {
    return toast('Recherche internet désactivée', 'Ton professeur ne l\'a pas activée pour ta classe.', 'erreur');
  }
  if (site && !urlSite) {
    return toast('Pronote n\'est pas encore configuré', 'Ton professeur doit indiquer l\'adresse Pronote du lycée dans l\'Espace professeur.', 'erreur');
  }
  // Un outil « logiciel » installé se lance directement, dans sa propre fenêtre.
  if (o.application) {
    const r = await api.logiciel.lancer(o.application);
    if (r.ok) {
      if (etat.nouveaux.delete(id)) ecrireLocal('nouveaux', [...etat.nouveaux]);
      toast(`${r.nom} s'ouvre…`, 'Il apparaît dans une fenêtre à part.', 'info');
      return;
    }
    if (r.bloque) return; // mode classe : le message est déjà affiché
  }
  etat.outilOuvert = o;
  if (etat.nouveaux.delete(id)) ecrireLocal('nouveaux', [...etat.nouveaux]);
  $('#outil-titre').textContent = o.titre;
  // Le bouton « Retour » dit où il ramène (le thème de l'élève, ou l'espace professeur).
  $('#btn-retour-texte').textContent = etat.retourEspaceProf ? 'Retour à Labo Prof' : (window.libelleRetour && window.libelleRetour()) || 'Accueil';
  // Outil créé par une autre personne : son nom reste visible (crédit de l'auteur).
  $('#outil-auteur').textContent = o.auteur ? `par ${o.auteur}${o.licence ? ` · licence ${o.licence}` : ''}` : '';
  $('#outil-icone').innerHTML = htmlIcone(o);
  $('#outil-icone').style.setProperty('--c', couleurOutil(o));
  // Office en ligne : affiché dans le navigateur intégré, sans fenêtre à part.
  const officeVue = $('#cadre-office');
  $('#btn-precedent').hidden = !site;
  $('#btn-cote-a-cote').hidden = false;
  $('#btn-nouvelle-recherche').hidden = site !== 'recherche';
  if (site) {
    $('#cadre').hidden = true;
    officeVue.hidden = false;
    if (officeVue.dataset.appli !== site || (site === 'lien' && officeVue.dataset.url !== urlSite)) { officeVue.dataset.appli = site; officeVue.dataset.url = urlSite; officeVue.src = urlSite; }
  } else {
    officeVue.hidden = true;
    $('#cadre').hidden = false;
    const requete = new URLSearchParams({ v: o.version, ...parametres }).toString();
    $('#cadre').src = o.pad || `app://local/outils/${encodeURIComponent(o.id)}/${encodeURI(o.entree)}?${requete}`;
  }
  $('#accueil').hidden = true;
  $('#vue-outil').hidden = false;
  document.title = `${o.titre} — Labo Élève`;
}
// Un outil peut demander confirmation (document non enregistré…) : vrai si on peut le fermer.
function peutFermer(id) {
  try {
    const avant = $(id).contentWindow.laboAvantFermeture;
    return typeof avant !== 'function' || avant();
  } catch { return true; /* outil d'une autre origine (pad) */ }
}

// ---------- Deux outils côte à côte ----------
// Le deuxième côté accueille un outil du Labo, un Digipad ou un document de la classe (pas les sites web :
// Office, Pronote, recherche… restent seuls, dans le côté principal).
etat.outil2 = null;
const urlOutil = (o, parametres = {}) => o.pad || `app://local/outils/${encodeURIComponent(o.id)}/${encodeURI(o.entree)}?${new URLSearchParams({ v: o.version, ...parametres })}`;
const pourVolet2 = (o) => !!o && !o.application && !o.office && !o.site && outilAutorise(o);
function elementsVolet2() {
  // En classe, l'élève retrouve ce que son professeur a rangé dans ses thèmes (voir eleve.js).
  const deLaClasse = window.elementsClassePourVolet2 ? window.elementsClassePourVolet2() : null;
  if (deLaClasse) return deLaClasse;
  return [{ groupe: 'Outils', elements: outilsVisibles().filter(pourVolet2).map((o) => ({ titre: o.titre, outil: o })) }];
}
function ouvrirChoixVolet2() {
  if (!etat.outilOuvert) return;
  const groupes = elementsVolet2().map((g) => ({ ...g, elements: g.elements.filter((e) => !e.outil || pourVolet2(e.outil)) })).filter((g) => g.elements.length);
  $('#volet2-principal').textContent = etat.outilOuvert.titre;
  const liste = [];
  const zone = $('#choix-volet2');
  zone.innerHTML = groupes.length ? groupes.map((g) => `<div class="groupe">${echapper(g.groupe)}</div>${g.elements.map((e) => {
    liste.push(e);
    const ic = e.outil ? htmlIcone(e.outil) : echapper(e.icone || '📄');
    const c = e.outil ? couleurOutil(e.outil) : e.couleur || '#0891b2';
    return `<button type="button" data-i="${liste.length - 1}" style="--c:${c}"><span class="mini-icone" style="--c:${c}">${ic}</span><span>${echapper(e.titre)}</span></button>`;
  }).join('')}`).join('') : '<p>Aucun autre outil disponible.</p>';
  zone.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { $('#dlg-volet2').close(); ouvrirVolet2(liste[+b.dataset.i]); }));
  $('#dlg-volet2').showModal();
}
async function ouvrirVolet2(e) {
  if (etat.outil2 && !peutFermer('#cadre2')) return;
  let src = e.src, titre = e.titre, icone = e.icone || '📄', couleur = e.couleur || '#0891b2';
  if (e.outil) { src = urlOutil(e.outil, e.parametres); icone = null; couleur = couleurOutil(e.outil); }
  if (e.charger) { const r = await e.charger(); if (!r) return; ({ src } = r); if (r.outil) { src = urlOutil(r.outil, r.parametres); icone = null; couleur = couleurOutil(r.outil); e = { ...e, outil: r.outil }; } }
  etat.outil2 = { id: e.outil ? e.outil.id : 'element-classe', titre };
  $('#volet2-titre').textContent = titre;
  $('#volet2-icone').innerHTML = e.outil ? htmlIcone(e.outil) : echapper(icone);
  $('#volet2-icone').style.setProperty('--c', couleur);
  $('#cadre2').src = src;
  $('#volet2').hidden = false;
  $('#separateur-volets').hidden = false;
  $('#zone-volets').classList.add('double');
  $('#btn-cote-a-cote').classList.add('actif');
}
function fermerVolet2(force = false) {
  if (!etat.outil2) return true;
  if (!force && !peutFermer('#cadre2')) return false;
  $('#cadre2').src = 'about:blank';
  $('#volet2').hidden = true;
  $('#separateur-volets').hidden = true;
  $('#zone-volets').classList.remove('double', 'inverse');
  $('#btn-cote-a-cote').classList.remove('actif');
  etat.outil2 = null;
  return true;
}
$('#btn-cote-a-cote').addEventListener('click', ouvrirChoixVolet2);
// Un outil demande d'ouvrir un outil autorisé à côté (ex. calculatrice pendant une évaluation « exercice »).
window.capturerOutilACote = async () => {
  if (!etat.outil2 || $('#volet2').hidden) return { ok: false, message: 'Ouvre d’abord un outil à côté (GeoGebra, NumWorks…), puis capture-le.' };
  const r = $('#cadre2').getBoundingClientRect();
  return window.labo.ecran.capturer({ x: r.left, y: r.top, width: r.width, height: r.height });
};
window.ouvrirOutilACote = (id) => { const o = etat.outils.find((x) => x.id === id); if (!pourVolet2(o)) return false; if (etat.outil2 && etat.outil2.id === id) return true; ouvrirVolet2({ outil: o, titre: o.titre }); return true; };
$('#btn-volet2-changer').addEventListener('click', ouvrirChoixVolet2);
$('#btn-volet2-fermer').addEventListener('click', () => fermerVolet2());
$('#btn-volet2-inverser').addEventListener('click', () => $('#zone-volets').classList.toggle('inverse')); // sans recharger les outils
$('#cadre2').addEventListener('load', transmettreTheme);
// Largeur des deux côtés : on fait glisser le séparateur (entre 25 % et 75 %).
$('#separateur-volets').addEventListener('pointerdown', (ev) => {
  const zone = $('#zone-volets');
  const r = zone.getBoundingClientRect();
  const inverse = zone.classList.contains('inverse');
  zone.classList.add('glisse');
  try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* sans capture : on suit quand même la souris */ }
  const bouger = (m) => {
    const x = (m.clientX - r.left) / r.width;
    const part = Math.min(0.75, Math.max(0.25, inverse ? x : 1 - x));
    zone.style.setProperty('--largeur2', (part * 100).toFixed(1) + '%');
  };
  const fin = () => { zone.classList.remove('glisse'); ev.target.removeEventListener('pointermove', bouger); ev.target.removeEventListener('pointerup', fin); ecrireLocal('largeurVolet2', zone.style.getPropertyValue('--largeur2')); };
  ev.target.addEventListener('pointermove', bouger);
  ev.target.addEventListener('pointerup', fin);
});
{ const l = lireLocal('largeurVolet2', ''); if (/^\d+(\.\d+)?%$/.test(l)) $('#zone-volets').style.setProperty('--largeur2', l); }

// Un labo (chimie, physique, maths) ouvre un site ajouté par l'enseignant : dans le navigateur intégré, limité à ce site.
// « manip » (facultatif) : expérience du professeur à rouvrir au retour.
window.ouvrirLienLabo = async (url, titre, retourId, manip) => {
  if (!(await api.office.lien(url))) return toast('Lien invalide', url, 'erreur');
  await ouvrirOutil('site-labo');
  $('#outil-titre').textContent = titre || 'Site';
  etat.retourOutil = retourId ? { id: retourId, parametres: manip ? { manip: String(manip) } : {} } : null;
};

async function fermerOutil() {
  if (!peutFermer('#cadre') || !peutFermer('#cadre2')) return;
  fermerVolet2(true);
  $('#cadre').src = 'about:blank';
  $('#cadre-office').hidden = true;
  $('#cadre').hidden = false;
  etat.outilOuvert = null;
  $('#vue-outil').hidden = true;
  $('#accueil').hidden = false;
  document.title = 'Labo Élève';
  etat.numworks = await api.numworks.etat();
  afficherGrille();
  if (window.rafraichirMaClasse) window.rafraichirMaClasse();
  // Site ouvert depuis un labo : retour au labo.
  if (etat.retourOutil) { const r = etat.retourOutil; etat.retourOutil = null; ouvrirOutil(r.id, r.parametres); return; }
  // Outil ouvert depuis l'espace professeur (cases ou suivi d'un travail) : on y revient.
  if (etat.retourEspaceProf) { etat.retourEspaceProf = false; if (window.ouvrirEspaceProf) window.ouvrirEspaceProf(); }
}
$('#cadre').addEventListener('load', transmettreTheme);
$('#btn-retour').addEventListener('click', fermerOutil);
// Sites intégrés : revenir à la page précédente (ex. retour au Médiacentre après un manuel numérique).
$('#btn-precedent').addEventListener('click', () => api.office.precedent());
$('#btn-nouvelle-recherche').addEventListener('click', async () => {
  const url = await api.office.url('recherche');
  if (url) $('#cadre-office').loadURL(url);
});
api.recherche.surBlocage(({ ia }) => toast(ia ? 'Assistant IA bloqué' : 'Site bloqué', ia ? 'Les robots conversationnels (ChatGPT, Gemini…) ne sont pas autorisés : cherche et lis toi-même tes sources.' : 'Cette adresse ne peut pas être ouverte ici.', 'erreur'));
// Le professeur active ou désactive la recherche internet pour la classe.
api.recherche.surEtat((autorisee) => {
  if (autorisee === etat.rechercheWeb) return;
  etat.rechercheWeb = autorisee;
  rafraichirAccueil();
  if (!autorisee && etat.outilOuvert && etat.outilOuvert.site === 'recherche') {
    $('#cadre-office').dataset.appli = '';
    $('#cadre-office').src = 'about:blank';
    etat.outilOuvert = null;
    $('#vue-outil').hidden = true;
    $('#accueil').hidden = false;
    toast('Recherche internet désactivée', 'Ton professeur a désactivé la recherche sur Internet.', 'info');
  } else if (autorisee) toast('Recherche internet activée', 'Ton professeur t\'autorise à faire des recherches sur Internet.', 'info');
});
$('#btn-recharger').addEventListener('click', () => {
  if (!etat.outilOuvert) return;
  if (etat.outilOuvert.office || etat.outilOuvert.site) $('#cadre-office').reload();
  else $('#cadre').contentWindow.location.reload();
});
$('#btn-plein-ecran').addEventListener('click', basculerPleinEcran);
function basculerPleinEcran() {
  if (etat.classe?.actif || etat.classe?.focus) return; // déjà en plein écran verrouillé
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') { e.preventDefault(); basculerPleinEcran(); }
  if (e.key === 'Escape' && etat.outilOuvert && !document.fullscreenElement && !$('#dlg-reglages').open) fermerOutil();
  if (e.ctrlKey && e.key.toLowerCase() === 'f' && !etat.outilOuvert) { e.preventDefault(); $('#recherche').focus(); }
  // Retour en arrière : Alt + ← (ferme aussi l'outil), ou Retour arrière dans les thèmes seulement
  // (dans un outil, Retour arrière sert à effacer).
  const saisie = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (e.altKey && e.key === 'ArrowLeft') { if (revenirEnArriere()) e.preventDefault(); }
  else if (e.key === 'Backspace' && !saisie && !etat.outilOuvert && !document.querySelector('dialog[open]')) { if (window.retourTheme && window.retourTheme()) e.preventDefault(); }
});
// Bouton « précédent » de la souris (sur le côté) : même effet.
window.addEventListener('mouseup', (e) => { if (e.button === 3 && revenirEnArriere()) e.preventDefault(); });
function revenirEnArriere() {
  if (document.querySelector('dialog[open]')) return false;
  if (etat.outilOuvert && !$('#vue-outil').hidden) { fermerOutil(); return true; }
  return !!(window.retourTheme && window.retourTheme());
}

// ---------- Installation / mises à jour ----------
function afficherRapport(rapport) {
  const res = rapport?.resultats || [];
  if (rapport?.message && !res.length) toast('Mises à jour', rapport.message, 'info');
  let rienDeNeuf = res.length > 0;
  for (const r of res) {
    if (r.statut === 'installe') { toast('Nouvel outil ajouté', `${r.titre} (v${r.version})`); etat.nouveaux.add(r.id); rienDeNeuf = false; }
    else if (r.statut === 'mis-a-jour') { toast('Outil mis à jour', `${r.titre} : v${r.ancienneVersion} → v${r.version}`); etat.nouveaux.add(r.id); rienDeNeuf = false; }
    else if (r.statut === 'refuse') { toast(`« ${r.titre} » non installé`, r.message, 'erreur'); rienDeNeuf = false; }
    else if (r.statut === 'annule') { rienDeNeuf = false; }
    else if (r.statut === 'retire') { toast('Outil retiré', `${r.titre} a été retiré par ton professeur.`, 'info'); rienDeNeuf = false; }
    else if (r.statut === 'erreur') { toast(`Impossible d'ajouter « ${r.titre} »`, r.message, 'erreur'); rienDeNeuf = false; }
  }
  if (rienDeNeuf) toast('Tout est à jour', res.length === 1 ? `${res[0].titre} est déjà en version ${res[0].versionActuelle}.` : 'Aucune nouveauté trouvée.', 'info');
  ecrireLocal('nouveaux', [...etat.nouveaux]);
}

async function apresInstallation(rapport) {
  afficherRapport(rapport);
  await chargerOutils();
}

api.surChangement(apresInstallation);

// ---------- Nouvelle version de l'application ----------
// Le bandeau apparaît quand une version plus récente (signée) est dans le dossier partagé.
async function installerNouvelleVersion() {
  const boutons = document.querySelectorAll('[data-maj-installer], #btn-maj-appli');
  boutons.forEach((b) => { b.disabled = true; });
  toast('Mise à jour', 'Clique sur « Oui » dans la fenêtre de Windows. L\'application va redémarrer.', 'info');
  const r = await api.appli.majInstaller();
  if (!r.ok) { toast('Mise à jour non installée', r.message, 'erreur'); boutons.forEach((b) => { b.disabled = false; }); }
}
function afficherBandeauMaj(m) {
  if (!m || !m.disponible) return;
  let b = document.getElementById('bandeau-maj');
  if (!b) {
    b = document.createElement('div');
    b.id = 'bandeau-maj';
    b.className = 'bandeau-maj';
    document.body.appendChild(b);
  }
  b.innerHTML = `<span>🎁 <b>Nouvelle version ${echapper(m.nouvelle)}</b> de ${etat.edition === 'prof' ? 'Labo Prof' : 'Labo Élève'} disponible${m.notes ? ' : ' + echapper(m.notes) : '.'}</span>
    <button class="principal" data-maj-installer>Installer</button><button class="lien" data-maj-plus-tard>Plus tard</button>`;
  b.querySelector('[data-maj-installer]').addEventListener('click', installerNouvelleVersion);
  b.querySelector('[data-maj-plus-tard]').addEventListener('click', () => b.remove());
}
api.appli.surMaj(afficherBandeauMaj);
$('#btn-maj-appli').addEventListener('click', installerNouvelleVersion);
async function afficherVersionAppli() {
  const m = await api.appli.majEtat();
  $('#version-appli').textContent = m.disponible ? `Version installée : ${m.version}. Nouvelle version disponible : ${m.nouvelle}.` : `Version installée : ${m.version}. ${m.probleme || 'C\'est la dernière version.'}`;
  $('#btn-maj-appli').hidden = !m.disponible;
}

$('#btn-reglages').addEventListener('click', async () => {
  await afficherReglages();
  afficherVersionAppli();
  $('#dlg-reglages').showModal();
});
$('#btn-importer').addEventListener('click', async () => apresInstallation(await api.importerOutils()));
$('#btn-importer-dossier').addEventListener('click', async () => apresInstallation(await api.importerDossier()));
$('#btn-choisir-maj').addEventListener('click', async () => { afficherConfig(await api.choisirDossierMaj()); });
$('#btn-oublier-maj').addEventListener('click', async () => { afficherConfig(await api.oublierDossierMaj()); });
$('#btn-verifier-maj').addEventListener('click', async () => apresInstallation(await api.verifierMaj()));
$('#btn-ouvrir-dossier').addEventListener('click', () => api.ouvrirDossierOutils());

// ---------- Dossier partagé sur Nuage : coller le lien de partage ----------
const heureCourte = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
function texteNuage(e) {
  if (!e || !e.actif) return '';
  if (e.erreur) return `${e.horsLigne ? '📴 Hors ligne' : '⚠️ ' + e.erreur} — tes changements sont gardés sur ce PC et partiront au retour du réseau.`;
  const att = e.attente ? ` · ⏳ ${e.attente} fichier(s) en attente de la clé de ton professeur (il doit ouvrir Labo Prof une fois)` : '';
  return (e.derniere ? `☁ Synchronisé avec Nuage à ${heureCourte(e.derniere)} · 🔒 copies et notes chiffrées` : '☁ Synchronisation en cours…') + att;
}
function majEtatNuage(e) {
  const el = document.getElementById('nuage-etat'); if (!el) return;
  el.hidden = !(e && e.actif); el.textContent = texteNuage(e); el.classList.toggle('erreur', !!(e && (e.erreur || e.attente)));
  const c = document.getElementById('nuage-cle'); if (c) c.hidden = !(e && e.actif && e.compteProf);
  // autres liens (élève : un par professeur)
  const l = document.getElementById('nuage-autres');
  if (l) {
    const s = (e && e.supp) || [];
    l.hidden = !s.length;
    l.innerHTML = s.length ? '<b>Autres liens Nuage :</b>' + s.map((x) => `<div class="nuage-lien"><span>${x.erreur ? '⚠️' : '☁'} ${x.lien.replace(/^https:\/\//, '')}</span><button type="button" class="lien" data-retirer-lien="${x.lien}">Retirer</button></div>`).join('') : '';
  }
}
if (api.nuage) api.nuage.surEtat(majEtatNuage);
// Élève : lien Nuage d'un autre professeur (s'ajoute aux liens déjà enregistrés)
window.ajouterLienNuage = function () {
  return new Promise((fin) => {
    const d = document.createElement('dialog'); d.className = 'dialogue dlg-nuage';
    d.innerHTML = `<form method="dialog" class="dialogue-contenu">
      <h2>☁ Lien Nuage de ton professeur</h2>
      <p>Colle le lien que ton professeur t’a donné (il commence par <b>https://nuage</b>…). Ses classes apparaîtront dans la liste.</p>
      <label>Lien<input id="ajout-lien" type="url" placeholder="https://nuage06.apps.education.fr/index.php/s/…" autocomplete="off" spellcheck="false"></label>
      <label>Mot de passe du lien <small>(si ton professeur t’en a donné un)</small><input id="ajout-mdp" type="password" autocomplete="off"></label>
      <p class="aide" id="ajout-msg"></p>
      <div class="rangee"><button type="button" class="secondaire" id="ajout-annuler">Annuler</button><button type="button" class="principal" id="ajout-ok">Ajouter</button></div></form>`;
    document.body.append(d);
    const fermer = (v) => { d.close(); d.remove(); fin(v); };
    d.querySelector('#ajout-annuler').addEventListener('click', () => fermer(null));
    d.querySelector('#ajout-ok').addEventListener('click', async () => {
      const msg = d.querySelector('#ajout-msg'), ok = d.querySelector('#ajout-ok'), lien = d.querySelector('#ajout-lien').value.trim(); if (!lien) return;
      ok.disabled = true; msg.classList.remove('erreur'); msg.textContent = '⏳ Vérification du lien et téléchargement des classes…';
      const r = await api.nuage.ajouterLien(lien, d.querySelector('#ajout-mdp').value);
      ok.disabled = false;
      if (!r.ok) { msg.textContent = '⚠️ ' + r.message; msg.classList.add('erreur'); return; }
      toast('☁ Lien ajouté', 'Les classes de ce professeur sont disponibles.', 'succes');
      fermer(r);
    });
    d.showModal(); d.querySelector('#ajout-lien').focus();
  });
};
window.choisirLienNuage = function () {
  return new Promise((fin) => {
    const d = document.createElement('dialog'); d.className = 'dialogue dlg-nuage';
    d.innerHTML = `<form method="dialog" class="dialogue-contenu">
      <h2>☁ Dossier partagé sur Nuage</h2>
      <p>Colle le <b>lien de partage</b> du dossier (Nuage d’apps.education.fr : <i>Partager → Lien de partage</i>, avec les permissions <b>Lire, Créer, Modifier</b>). Les élèves n’ont pas besoin de compte : le même lien suffit sur leur PC.</p>
      <label>Lien<input id="nuage-lien" type="url" placeholder="https://nuage06.apps.education.fr/index.php/s/…" autocomplete="off" spellcheck="false" required></label>
      <label>Mot de passe du lien <small>(seulement si le lien en a un)</small><input id="nuage-mdp" type="password" autocomplete="off"></label>
      <label class="case" id="nuage-copier-l" hidden><input type="checkbox" id="nuage-copier" checked> Copier le contenu de mon dossier partagé actuel dans Nuage (classes, documents…)</label>
      <p class="aide" id="nuage-msg"></p>
      <div class="rangee"><button type="button" class="secondaire" id="nuage-annuler">Annuler</button><button type="button" class="principal" id="nuage-ok">Utiliser ce lien</button></div></form>`;
    document.body.append(d);
    api.lireConfig().then((c) => { if (c && c.dossierMaj && !c.nuage) d.querySelector('#nuage-copier-l').hidden = false; if (c && c.nuage) d.querySelector('#nuage-lien').value = c.nuage.lien; });
    const fermer = (v) => { d.close(); d.remove(); fin(v); };
    d.querySelector('#nuage-annuler').addEventListener('click', () => fermer(null));
    d.querySelector('#nuage-ok').addEventListener('click', async () => {
      const msg = d.querySelector('#nuage-msg'), ok = d.querySelector('#nuage-ok');
      const lien = d.querySelector('#nuage-lien').value.trim(); if (!lien) return;
      ok.disabled = true; msg.textContent = '⏳ Vérification du lien et première synchronisation…'; msg.classList.remove('erreur');
      const copier = !d.querySelector('#nuage-copier-l').hidden && d.querySelector('#nuage-copier').checked;
      const r = await api.nuage.definir(lien, d.querySelector('#nuage-mdp').value, copier);
      ok.disabled = false;
      if (!r.ok) { msg.textContent = '⚠️ ' + r.message; msg.classList.add('erreur'); return; }
      toast('☁ Nuage relié', r.erreur ? 'Lien enregistré ; la synchronisation reprendra au retour du réseau.' : `Dossier synchronisé (${r.recus} reçu(s), ${r.envoyes} envoyé(s)).`, 'succes');
      fermer(r);
    });
    d.showModal(); d.querySelector('#nuage-lien').focus();
  });
};
document.getElementById('nuage-autres')?.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-retirer-lien]'); if (!b) return;
  if (!confirm('Retirer ce lien ? Les classes de ce professeur ne seront plus disponibles sur ce PC.')) return;
  await api.nuage.retirerLien(b.dataset.retirerLien); majEtatNuage(await api.nuage.etat());
});
$('#btn-nuage').addEventListener('click', async () => { if (await window.choisirLienNuage()) { afficherConfig(await api.lireConfig()); } });
// Clé de l'enseignant : sans elle, impossible de relire les copies chiffrées (nouveau PC, réinstallation)
function demanderMotDePasse(titre, texte) {
  return new Promise((fin) => {
    const d = document.createElement('dialog'); d.className = 'dialogue dlg-nuage';
    d.innerHTML = `<form method="dialog" class="dialogue-contenu"><h2>${titre}</h2><p>${texte}</p>
      <label>Mot de passe<input id="cle-mdp" type="password" autocomplete="new-password"></label>
      <div class="rangee"><button type="button" class="secondaire" id="cle-annuler">Annuler</button><button type="button" class="principal" id="cle-ok">Continuer</button></div></form>`;
    document.body.append(d);
    const fermer = (v) => { d.close(); d.remove(); fin(v); };
    d.querySelector('#cle-annuler').addEventListener('click', () => fermer(null));
    d.querySelector('#cle-ok').addEventListener('click', () => fermer(d.querySelector('#cle-mdp').value));
    d.showModal(); d.querySelector('#cle-mdp').focus();
  });
}
document.getElementById('btn-cle-sauver')?.addEventListener('click', async () => {
  const mdp = await demanderMotDePasse('🔑 Sauvegarder ma clé Nuage', 'Choisis un mot de passe (8 caractères ou plus) pour protéger le fichier de sauvegarde. Garde ce fichier sur une clé USB : il te permettra de relire les copies chiffrées sur un nouvel ordinateur.');
  if (mdp === null) return;
  const r = await api.nuage.exporterCle(mdp);
  if (r.ok) toast('🔑 Clé sauvegardée', r.fichier, 'succes'); else if (!r.annule) toast('Sauvegarde impossible', r.message, 'erreur');
});
document.getElementById('btn-cle-restaurer')?.addEventListener('click', async () => {
  const mdp = await demanderMotDePasse('🔑 Restaurer ma clé Nuage', 'Le mot de passe choisi au moment de la sauvegarde.');
  if (mdp === null) return;
  const r = await api.nuage.importerCle(mdp);
  if (r.ok) { toast('🔑 Clé restaurée', 'Les copies chiffrées vont être relues à la prochaine synchronisation.', 'succes'); api.nuage.synchroniser(); }
  else if (!r.annule) toast('Restauration impossible', r.message, 'erreur');
});

function afficherConfig(config) {
  const d = config?.dossierMaj;
  $('#chemin-maj').textContent = config?.nuage ? '☁ Nuage : ' + config.nuage.lien : (d || 'Aucun dossier choisi');
  if (api.nuage) api.nuage.etat().then(majEtatNuage);
  $('#btn-verifier-maj').disabled = !d;
  $('#btn-oublier-maj').hidden = !d;
}

async function afficherReglages() {
  afficherConfig(await api.lireConfig());
  const infos = await api.infos();
  $('#infos-app').textContent = `${infos.nom} v${infos.version}`;
  afficherInstalles();
}

function afficherInstalles() {
  const liste = [...etat.outils].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  $('#liste-installes').innerHTML = liste.map((o) => `
    <li>
      <span class="mini-icone" style="--c:${couleurOutil(o)}">${htmlIcone(o)}</span>
      <span>${echapper(o.titre)}<br><span class="meta">v${echapper(o.version)} · ${o.source === 'integre' ? 'inclus' : (o.remplaceIntegre ? 'mis à jour' : 'ajouté')}</span></span>
      ${o.pad && o.source === 'utilisateur' ? `<button type="button" class="lien lien-normal" data-exporter="${echapper(o.id)}">Exporter pour les élèves</button>` : ''}
      ${o.source === 'utilisateur' ? `<button type="button" class="lien" data-supprimer="${echapper(o.id)}">${o.remplaceIntegre ? 'Revenir à la version d\'origine' : 'Supprimer'}</button>` : ''}
    </li>${o.id === ID_NUMWORKS ? `
    <li>
      <span class="mini-icone" style="--c:${couleurOutil(o)}">${htmlIcone(o)}</span>
      <span>Émulateur NumWorks<br><span class="meta">${etat.numworks.installe ? `trouvé sur ce PC${etat.numworks.version ? ' · v' + echapper(etat.numworks.version) : ''}` : 'pas encore téléchargé'}</span></span>
      ${etat.numworks.installe ? '<button type="button" class="lien" data-retirer-numworks>Retirer</button>' : ''}
    </li>` : ''}`).join('');
}
$('#liste-installes').addEventListener('click', async (e) => {
  if (e.target.closest('[data-retirer-numworks]')) {
    if (!confirm('Retirer l\'émulateur NumWorks de Labo Élève ? Tu pourras le retrouver en le téléchargeant à nouveau.')) return;
    await api.numworks.retirer();
    toast('Émulateur retiré', 'Calculatrice NumWorks', 'info');
    await chargerOutils();
    return;
  }
  const b = e.target.closest('[data-supprimer]');
  if (!b) return;
  const o = etat.outils.find((x) => x.id === b.dataset.supprimer);
  if (!o || !confirm(o.remplaceIntegre ? `Revenir à la version d'origine de « ${o.titre} » ?` : `Supprimer l'outil « ${o.titre} » ?`)) return;
  await api.supprimerOutil(o.id);
  toast(o.remplaceIntegre ? 'Version d\'origine restaurée' : 'Outil supprimé', o.titre, 'info');
  await chargerOutils();
});

// ---------- Digipad et documents ----------
const ID_DOCUMENTS = 'mes-documents';

$('#btn-creer-pad').addEventListener('click', async () => {
  const niveaux = [...document.querySelectorAll('#pad-niveaux input:checked')].map((c) => c.value);
  const r = await api.pad.creer({ titre: $('#pad-titre').value, lien: $('#pad-lien').value, description: $('#pad-description').value, niveaux });
  const aide = $('#aide-pad');
  if (!r.ok) { aide.className = 'aide-code erreur'; aide.textContent = r.message; return; }
  aide.className = 'aide-code';
  aide.textContent = `Carte « ${r.titre} » ajoutée. Clique sur « Exporter pour les élèves » ci-dessous pour la distribuer.`;
  $('#pad-titre').value = $('#pad-lien').value = $('#pad-description').value = '';
  etat.nouveaux.add(r.id);
  ecrireLocal('nouveaux', [...etat.nouveaux]);
  await chargerOutils();
});

$('#liste-installes').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-exporter]');
  if (!b) return;
  e.stopPropagation();
  const r = await api.pad.exporter(b.dataset.exporter);
  if (r.ok) toast('Carte exportée', `Distribue ce fichier aux élèves ou dépose-le dans le dossier de mises à jour : ${r.fichier}`, 'info');
  else if (!r.annule) toast('Export impossible', r.message, 'erreur');
});

api.documents.surTelechargement(({ nom, ok }) => {
  if (!ok) return toast('Téléchargement interrompu', nom, 'erreur');
  // L'outil « Mes documents » ouvert se met à jour tout seul.
  for (const id of ['#cadre', '#cadre2']) { try { $(id).contentWindow.dispatchEvent(new CustomEvent('labo:documents', { detail: { nom } })); } catch { /* autre origine */ } }
  if (etat.outilOuvert?.id === ID_DOCUMENTS) return;
  toast('Document enregistré', `« ${nom} » est dans Mes documents.`, '', { libelle: 'Ouvrir', faire: () => ouvrirOutil(ID_DOCUMENTS, { ouvrir: nom }) });
});

// ---------- Mode classe ----------
etat.classe = { actif: false, codeDefini: false, sorties: 0 };
let codeSession = null; // code enseignant saisi, gardé seulement pendant que l'espace enseignant est ouvert

function dureeTexte(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
function heureTexte(iso) {
  const d = new Date(iso);
  const h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? h : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${h.slice(0, 5)}`;
}

function afficherEtatClasse() {
  const c = etat.classe;
  document.querySelectorAll('[data-ouvrir-classe]').forEach((b) => {
    b.hidden = !c.actif;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Mode classe${c.sorties ? ` <span class="nb">${c.sorties}</span>` : ''}`;
  });
  $('#btn-reglages').hidden = c.actif || c.focus || !!c.examen;
  $('#btn-espace-prof').hidden = c.actif || !!c.examen;
  $('#btn-examen-code').hidden = etat.edition !== 'eleve' || c.actif || !!c.examen;
  afficherExamen(c.examen);
  // Mode focus : bouton « Terminer » (en mode classe, la fermeture reste bloquée).
  document.querySelectorAll('[data-terminer]').forEach((b) => { b.hidden = !c.focus; });
  $('#code-confirmation').hidden = c.codeDefini;
  $('#btn-activer-classe').textContent = c.codeDefini ? 'Activer le mode classe' : 'Créer le code et activer';
  const aide = $('#aide-code');
  aide.className = 'aide-code';
  aide.textContent = c.codeDefini
    ? 'Entre ton code enseignant pour activer le mode classe.'
    : 'Choisis un code de 4 à 8 chiffres et note-le bien : il sera demandé pour quitter le mode classe.';
}

async function chargerEtatClasse() {
  etat.classe = await api.classe.etat();
  afficherEtatClasse();
}

$('#btn-activer-classe').addEventListener('click', async () => {
  const code = $('#code-activation').value.trim();
  const aide = $('#aide-code');
  if (!etat.classe.codeDefini && code !== $('#code-confirmation').value.trim()) {
    aide.className = 'aide-code erreur';
    aide.textContent = 'Les deux codes ne sont pas identiques.';
    return;
  }
  const r = await api.classe.activer(code);
  if (!r.ok) { aide.className = 'aide-code erreur'; aide.textContent = r.message; return; }
  $('#code-activation').value = $('#code-confirmation').value = '';
  $('#dlg-reglages').close();
  etat.classe = r;
  afficherEtatClasse();
  toast('Mode classe activé', 'Labo Élève est verrouillé en plein écran. Ton code permet d\'en sortir.', 'info');
});

// Espace enseignant
document.querySelectorAll('[data-ouvrir-classe]').forEach((b) => b.addEventListener('click', () => {
  codeSession = null;
  $('#classe-verrou').hidden = false;
  $('#classe-panneau').hidden = true;
  $('#erreur-code').textContent = '';
  $('#code-enseignant').value = '';
  $('#dlg-classe').showModal();
  $('#code-enseignant').focus();
}));
$('#dlg-classe').addEventListener('close', () => { codeSession = null; $('#code-enseignant').value = ''; });

async function deverrouiller() {
  const code = $('#code-enseignant').value.trim();
  const r = await api.classe.journal(code);
  if (!r.ok) {
    $('#erreur-code').className = 'aide-code erreur';
    $('#erreur-code').textContent = r.message;
    return;
  }
  codeSession = code;
  $('#classe-verrou').hidden = true;
  $('#classe-panneau').hidden = false;
  afficherJournal(r.journal);
}
$('#btn-deverrouiller').addEventListener('click', deverrouiller);
$('#code-enseignant').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); deverrouiller(); } });

const LIBELLES = {
  activation: () => ['info', 'Mode classe activé'],
  desactivation: () => ['info', 'Mode classe désactivé'],
  sortie: (e) => ['grave', `A quitté l'application pendant ${dureeTexte(e.dureeMs)}`],
  'fermeture-forcee': (e) => ['grave', `Application fermée de force${e.retour ? `, relancée à ${heureTexte(e.retour)}` : ''}`],
  'tentative-fermeture': () => ['', 'A essayé de fermer l\'application (bloqué)'],
  'code-errone': () => ['', 'Code enseignant incorrect saisi'],
  blocage: (e) => ['', e.quoi === 'logiciel' ? 'A voulu ouvrir un logiciel externe (bloqué)' : 'A voulu ouvrir un site web (bloqué)'],
  'arret-pc': () => ['info', 'Ordinateur éteint ou session fermée'],
  'dialogue-fichier': (e) => ['info', `Fenêtre de choix de fichier ouverte (${dureeTexte(e.dureeMs)})`],
  veille: (e) => ['info', `Ordinateur verrouillé ou en veille (${dureeTexte(e.dureeMs)}) : pas compté comme une sortie`],
  'examen-debut': (e) => ['info', `Début de l'examen${e.titre ? ` « ${e.titre} »` : ''}`],
  'examen-fin': () => ['info', 'Fin de l\'examen'],
};

function afficherJournal(evenements) {
  // Du plus récent au plus ancien (une fermeture forcée est notée au redémarrage, avec l'heure de la coupure).
  const journal = [...evenements].sort((x, y) => new Date(y.a) - new Date(x.a));
  const depuis = journal.findIndex((e) => e.type === 'activation');
  const seance = depuis === -1 ? journal : journal.slice(0, depuis + 1);
  const sorties = seance.filter((e) => e.type === 'sortie');
  const total = sorties.reduce((t, e) => t + (e.dureeMs || 0), 0);
  const forcees = seance.filter((e) => e.type === 'fermeture-forcee').length;
  $('#resume-classe').innerHTML = `
    <div class="stat-classe"><b>${sorties.length}</b>sortie${sorties.length > 1 ? 's' : ''}</div>
    <div class="stat-classe"><b>${dureeTexte(total)}</b>hors de l'application</div>
    <div class="stat-classe"><b>${forcees}</b>fermeture${forcees > 1 ? 's' : ''} forcée${forcees > 1 ? 's' : ''}</div>`;
  $('#journal-classe').innerHTML = journal.length
    ? journal.map((e) => {
      const [classeCss, texte] = (LIBELLES[e.type] || (() => ['', e.type]))(e);
      return `<li class="${classeCss}"><span class="heure">${heureTexte(e.a)}</span><span>${echapper(texte)}</span></li>`;
    }).join('')
    : '<li><span class="vide-journal">Aucun événement.</span></li>';
}

$('#btn-quitter-classe').addEventListener('click', async () => {
  const r = await api.classe.desactiver(codeSession);
  if (!r.ok) return toast('Erreur', r.message, 'erreur');
  $('#dlg-classe').close();
  etat.classe = r;
  afficherEtatClasse();
  toast('Mode classe désactivé', 'L\'élève peut de nouveau fermer l\'application.', 'info');
});
$('#btn-effacer-journal').addEventListener('click', async () => {
  if (!confirm('Effacer tout le journal du mode classe ?')) return;
  const r = await api.classe.effacer(codeSession);
  if (r.ok) { afficherJournal([]); await chargerEtatClasse(); }
});
// Changer le code (window.prompt n'existe pas dans l'application : champ intégré)
$('#btn-changer-code').addEventListener('click', () => {
  $('#rangee-nouveau-code').hidden = false;
  $('#nouveau-code').value = '';
  $('#nouveau-code').focus();
});
$('#btn-valider-code').addEventListener('click', async () => {
  const nouveau = $('#nouveau-code').value.trim();
  const r = await api.classe.changerCode(codeSession, nouveau);
  if (!r.ok) return toast('Code non modifié', r.message, 'erreur');
  codeSession = nouveau;
  $('#rangee-nouveau-code').hidden = true;
  toast('Code enseignant modifié', 'Utilise le nouveau code dès maintenant.', 'info');
});

// Alerte quand l'élève revient après être sorti
let minuterieAlerte = null;
api.classe.surSortie((ev) => {
  etat.classe.sorties = ev.total;
  afficherEtatClasse();
  $('#alerte-texte').textContent = `Sortie à ${new Date(ev.a).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, pendant ${dureeTexte(ev.dureeMs)}.`;
  $('#alerte-sortie').hidden = false;
  const bouton = $('#btn-alerte-ok');
  bouton.disabled = true;
  clearTimeout(minuterieAlerte);
  minuterieAlerte = setTimeout(() => { bouton.disabled = false; bouton.focus(); }, 3000);
});
$('#btn-alerte-ok').addEventListener('click', () => { $('#alerte-sortie').hidden = true; });

// ---------- Mode examen ----------
function afficherExamen(examen) {
  const bandeau = $('#bandeau-examen');
  $('#badge-examen').hidden = !examen;
  bandeau.hidden = !examen;
  if (!examen) return;
  const noms = examen.outils.map((id) => (etat.outils.find((o) => o.id === id) || {}).titre).filter(Boolean);
  const heure = new Date(examen.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  bandeau.innerHTML = `<span class="ic">🎓</span><div><b>Mode examen : ${echapper(examen.titre)}</b>
    <span>Depuis ${heure} · Outils autorisés : ${echapper(noms.join(', ') || '—')} · L'application ne peut pas être fermée avant la fin de l'examen.</span></div>
    ${examen.evaluation ? '<button class="principal" data-ouvrir-evaluation>📝 Ouvrir l&#39;évaluation</button>' : ''}
    <button class="lien fin-examen-local" data-fin-examen-local title="Réservé au professeur (par exemple si le réseau est coupé)">🔒 Professeur</button>`;
}
// Le professeur termine l'examen sur ce PC avec son mot de passe (réseau coupé, élève qui a fini…).
$('#bandeau-examen').addEventListener('click', async (e) => {
  if (e.target.closest('[data-ouvrir-evaluation]')) { ouvrirOutil('evaluation-maths'); return; }
  if (!e.target.closest('[data-fin-examen-local]')) return;
  const v = await window.saisirProf('Terminer l\'examen sur cet ordinateur', [{ label: 'Mot de passe du professeur', type: 'password' }], 'Terminer l\'examen');
  if (!v) return;
  const r = await api.classes.terminerExamen(v[0]);
  if (!r.ok) return toast('Refusé', r.message, 'erreur');
  toast('Examen terminé sur cet ordinateur', 'Ton professeur en est informé.', 'info');
  api.focus.actualiser();
});
// Examen sans réseau : l'enseignant tape le code de l'examen préparé dans Labo Prof.
$('#btn-examen-code').addEventListener('click', async () => {
  const v = await window.saisirProf('Démarrer l\'examen sur cet ordinateur', [{ label: 'Code de l\'examen (donné dans Labo Prof)', type: 'password' }], 'Démarrer l\'examen');
  if (!v) return;
  const r = await api.classes.examenParCode(v[0]);
  if (!r.ok) return toast('Examen non démarré', r.message, 'erreur');
  toast('🎓 Examen démarré', `« ${r.titre} » — fin de l'examen : bouton 🔒 Professeur.`, 'info');
  api.focus.actualiser();
});
let examenPrecedent = null;
function changementExamen(examen) {
  const debut = examen && !examenPrecedent, fin = !examen && examenPrecedent;
  const finEvaluation = fin && examenPrecedent.evaluation;
  examenPrecedent = examen;
  if (debut) {
    // Un outil non autorisé est fermé immédiatement (sans demander : c'est l'examen qui commence).
    if (etat.outil2 && !examen.outils.includes(etat.outil2.id)) fermerVolet2(true);
    if (etat.outilOuvert && !examen.outils.includes(etat.outilOuvert.id)) {
      fermerVolet2(true);
      $('#cadre').src = 'about:blank';
      $('#cadre-office').hidden = true;
      $('#cadre').hidden = false;
      etat.outilOuvert = null;
      $('#vue-outil').hidden = true;
      $('#accueil').hidden = false;
    }
    if ($('#dlg-terminer').open) $('#dlg-terminer').close();
    etat.filtre = 'tous';
    if (examen.evaluation) setTimeout(() => ouvrirOutil('evaluation-maths', { auto: '1' }), 300); // évaluation de maths : elle s'ouvre directement (sauf copie déjà rendue)
    toast('🎓 Début de l\'examen', `« ${examen.titre} » : seuls les outils autorisés sont disponibles.`, 'info');
  }
  if (fin) toast('Fin de l\'examen', finEvaluation ? 'Ta correction est dans « 📝 Mes évaluations ».' : 'Tous les outils sont de nouveau disponibles.', 'info');
  if (finEvaluation) { retourMatieres(); return; } // évaluation terminée : l'élève revient au choix de sa matière
  if (debut || fin) { rafraichirAccueil(); if (window.rafraichirMaClasse) window.rafraichirMaClasse(); }
}

// Fin d'une évaluation (copie rendue par l'élève, ou évaluation terminée par le professeur) :
// l'évaluation se ferme et l'élève revient sur la page où il choisit sa matière.
async function retourMatieres() {
  if (etat.edition !== 'eleve') return;
  if (etat.outilOuvert && etat.outilOuvert.id === 'evaluation-maths') await fermerOutil();
  rafraichirAccueil();
  setTimeout(() => { if (window.afficherMatieres && !etat.outilOuvert) window.afficherMatieres(); }, 400);
}
window.retourMatieresEleve = () => retourMatieres();
window.finEvaluationEleve = () => {
  toast('✅ Copie rendue', 'Ta correction sera dans « 📝 Mes évaluations » (dans ta matière).', 'info');
  retourMatieres();
};

// ---------- Mode focus : fermeture avec confirmation ----------
api.focus.surEtat((d) => { etat.classe = d; afficherEtatClasse(); changementExamen(d.examen); rafraichirAccueil(); });
async function demanderFermeture() {
  // Un outil ouvert peut signaler un document non enregistré.
  if (etat.outilOuvert && !peutFermer('#cadre')) return;
  if (etat.outil2 && !peutFermer('#cadre2')) return;
  $('#dlg-terminer').showModal();
}
document.querySelectorAll('[data-terminer]').forEach((b) => b.addEventListener('click', demanderFermeture));
api.focus.surDemandeFermeture(demanderFermeture); // Alt+F4
$('#btn-continuer-travail').addEventListener('click', () => $('#dlg-terminer').close());
$('#btn-confirmer-fermeture').addEventListener('click', async () => {
  $('#btn-confirmer-fermeture').disabled = true;
  $('#btn-confirmer-fermeture').textContent = 'Fermeture…';
  await api.focus.fermer();
});

api.classe.surBlocage(({ quoi }) => {
  if (quoi === 'fermer-examen') toast('Examen en cours', 'L\'application ne peut pas être fermée avant la fin de l\'examen. Ton professeur y mettra fin.', 'erreur');
  else if (quoi === 'fermer') toast('Mode classe', 'L\'application ne peut pas être fermée pendant la séance.', 'erreur');
  else if (quoi === 'logiciel') toast('Bloqué en mode classe', 'Les logiciels externes sont désactivés pendant la séance.', 'erreur');
  else toast('Bloqué en mode classe', 'Les sites web sont désactivés pendant la séance.', 'erreur');
});

// ---------- Démarrage ----------
appliquerTheme();
salutation();
if (etat.niveau !== 'tous' && !niveauParId(etat.niveau)) etat.niveau = null;
if (api) {
  chargerEtatClasse();
  Promise.all([chargerOutils(), api.infos(), api.recherche.etat()]).then(async ([, infos, recherche]) => {
    etat.rechercheWeb = recherche;
    rafraichirAccueil();
    etat.edition = infos.edition;
    if (etat.classe) afficherEtatClasse();
    document.body.classList.add('edition-' + infos.edition);
    if (infos.edition === 'prof') {
      // Labo Prof : pas d'identification d'élève, on arrive directement sur « Mes classes ».
      document.title = 'Labo Prof';
      document.querySelectorAll('.marque .nom').forEach((e) => { e.textContent = 'Labo Prof'; });
      document.querySelectorAll('.marque .sous-titre').forEach((e) => { e.textContent = 'Espace enseignant · outils des élèves'; });
      $('#salutation').textContent = 'Outils des élèves';
      document.querySelector('.bandeau p').textContent = 'Tu vois ici les outils tels que les élèves les voient : essaie-les avant de les utiliser en classe.';
      if (!etat.niveau) etat.niveau = 'tous';
      document.querySelector('#btn-espace-prof').lastChild.textContent = ' Mes classes';
      document.querySelector('#btn-prof-retour').lastChild.textContent = ' Outils des élèves';
      document.querySelector('#espace-prof .titre-outil').textContent = 'Labo Prof — mes classes';
      window.ouvrirEspaceProf();
      return;
    }
    // Des classes existent dans le dossier partagé : l'élève s'identifie d'abord (voir eleve.js).
    if (window.demarrerIdentification && await window.demarrerIdentification()) return;
    if (etat.niveau) $('#accueil').hidden = false;
    else afficherChoixNiveau();
  });
} else $('#grille').innerHTML = '<p class="vide">Cette page doit être ouverte depuis l\'application Labo Élève.</p>';
