// Classes, élèves, enseignants et contenus partagés.
// Tout est rangé dans le dossier partagé de l'établissement (le même que celui des mises à jour) :
//   <dossier partagé>/Classes/professeurs.json         comptes des enseignants (nom, matière, empreinte du mot de passe)
//   <dossier partagé>/Classes/<id>/classe.json         nom, niveau, matière, enseignant, élèves, thèmes et contenu
//   <dossier partagé>/Classes/<id>/fichiers/...        documents déposés par l'enseignant
//   <dossier partagé>/Classes/<id>/travaux/<travail>/<élève>.json   copies des travaux à rendre (réponses + historique),
//                                                       écrites par le PC de l'élève (copie locale gardée s'il n'y a pas de réseau)
//   <dossier partagé>/Classes/<id>/Copies des élèves/<NOM Prénom>/…   chaque document enregistré par l'élève (dernière version)
// Les PC élèves ne font que lire ; seul un enseignant connecté (Labo Prof) écrit, et seulement dans ses classes.
//
// Un élève peut être inscrit dans plusieurs classes (une par enseignant et par matière) : il choisit sa classe
// et son nom au premier passage dans chaque matière. Ses inscriptions sont mémorisées sur son PC.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ID = /^[a-z0-9-]{1,60}$/;
const NIVEAUX = ['cap1', 'cap2', '2pro', '1pro', 'tpro'];
const MATIERES = ['maths', 'physique-chimie', 'francais', 'histoire-geo', 'anglais', 'espagnol', 'allemand', 'italien', 'arts-appliques', 'eps',
  'pse', 'eco-gestion', 'eco-droit', 'enseignement-pro', 'co-intervention-maths', 'co-intervention-francais', 'chef-oeuvre', 'autre'];
// Anciennes classes « co-intervention » (une seule matière avant) : deviennent « co-intervention maths ».
const ALIAS_MATIERES = { 'co-intervention': 'co-intervention-maths' };
const COMPTE_HISTORIQUE = 'prof-historique'; // ancien mot de passe unique (avant les comptes enseignants)
const matiereValide = (m) => { const x = ALIAS_MATIERES[m] || m; return MATIERES.includes(x) ? x : null; };
const MAX_MATIERES = 6;
// Liste de matières propre : valides, sans doublon, la principale en premier.
function listeMatieres(liste, principale = null) {
  const l = [...new Set((Array.isArray(liste) ? liste : [liste]).map(matiereValide).filter(Boolean))];
  const p = matiereValide(principale);
  if (p && l.includes(p)) { l.splice(l.indexOf(p), 1); l.unshift(p); }
  return l.slice(0, MAX_MATIERES);
}
// Mise à niveau d'une classe lue sur le disque (anciennes versions : une seule « matiere », pas de co-enseignants).
// « matiere » reste la matière principale (lue par les anciennes versions de Labo Élève).
function normaliserClasse(c) {
  if (!c || typeof c !== 'object') return c;
  const matieres = listeMatieres([c.matiere, ...(Array.isArray(c.matieres) ? c.matieres : [])], c.matiere);
  c.matiere = matieres[0] || null;
  c.matieres = matieres;
  c.coEnseignants = [...new Set((Array.isArray(c.coEnseignants) ? c.coEnseignants : []).filter((x) => typeof x === 'string' && x && x !== c.profId))];
  return c;
}
// Fin d'année : une classe clôturée garde tout (élèves, thèmes, documents, copies) mais passe en lecture seule.
// Rien n'est déplacé ni supprimé : « archive: { annee, date, par } » est simplement ajouté à classe.json.
const estArchivee = (c) => !!(c && c.archive);
// Année scolaire en cours : de septembre à août (ex. « 2025-2026 » jusqu'au 31 août 2026).
function anneeScolaire(d = new Date()) { const y = d.getFullYear(); return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`; }
const anneeValide = (a) => { const t = String(a || '').trim().replace(/\s+/g, ' ').slice(0, 20); return /^[\w\- /]+$/.test(t) ? t : anneeScolaire(); };
// Matière d'un élément placé à la racine des thèmes : la sienne si la classe l'a encore, sinon la principale.
const matiereNoeud = (c, n) => (n && n.matiere && (c.matieres || []).includes(n.matiere) ? n.matiere : c.matiere || null);
const couleurValide = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : null);
const iconeValide = (i) => { const t = String(i || '').trim(); return t && [...t].length <= 4 && !/[<>&"']/.test(t) ? t : null; };

function creerEspaceClasses({ ipcMain, dialog, obtenirFenetre, lireConfig, pendantDialogue, dossierDocuments, cheminLibre, nomFichierSur, urlPadValide, dossierDonnees, surIdentification = () => {}, surDeverrouillage = () => {}, surVerrouillage = () => {}, surLiberation = () => {}, surExamenLeve = () => {}, surExamenLocal = () => {}, ouvrirChemin = () => {}, edition = 'prof' }) {
  const MESSAGE_ELEVE = "L'espace professeur se trouve dans l'application Labo Prof, installée sur l'ordinateur de l'enseignant.";
  let profConnecte = null; // id du compte enseignant connecté (Labo Prof)
  let eleveActuel = null;  // inscription active de l'élève : { classeId, classe, matiere, prof, profId, eleveId, nom }

  const racine = () => { const d = lireConfig().dossierMaj; return d ? path.join(d, 'Classes') : null; };
  const dossierClasse = (id) => path.join(racine(), id);
  const fichierClasse = (id) => path.join(dossierClasse(id), 'classe.json');
  const nouvelId = (texte) => {
    const base = String(texte || 'x').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
    return `${base}-${crypto.randomBytes(3).toString('hex')}`;
  };
  const idCourt = () => crypto.randomBytes(4).toString('hex');

  function lireJson(f, defaut) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return defaut; } }
  function ecrireJson(f, valeur) { // écriture atomique : un PC élève ne lit jamais un fichier à moitié écrit
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(valeur, null, 2));
    fs.renameSync(tmp, f);
  }

  // ---------- Comptes enseignants ----------
  const fichierComptes = () => path.join(racine(), 'professeurs.json');
  const fichierAncienMdp = () => path.join(racine(), 'professeur.json');
  function lireComptes() {
    if (!racine()) return [];
    const d = lireJson(fichierComptes(), null);
    if (d && Array.isArray(d.comptes)) return d.comptes;
    // Ancienne version : un seul mot de passe pour tout l'espace professeur → devient un compte « à compléter ».
    const ancien = lireJson(fichierAncienMdp(), null);
    if (ancien && ancien.sel && ancien.empreinte) return [{ id: COMPTE_HISTORIQUE, nom: null, matiere: null, sel: ancien.sel, empreinte: ancien.empreinte }];
    return [];
  }
  const ecrireComptes = (comptes) => ecrireJson(fichierComptes(), { comptes });
  const comptePublic = (c) => ({ id: c.id, nom: c.nom || 'Compte professeur (à compléter)', matiere: matiereValide(c.matiere), aCompleter: !c.nom });
  const compteConnecte = () => (profConnecte ? lireComptes().find((c) => c.id === profConnecte) || null : null);
  const proprietaire = (classe) => classe.profId || COMPTE_HISTORIQUE;
  // Le propriétaire et les collègues qu'il a invités gèrent la classe (élèves, thèmes, travaux, examen, suivi).
  const enseignantsDe = (classe) => [proprietaire(classe), ...(classe.coEnseignants || [])];
  const peutGerer = (classe, profId) => !!profId && enseignantsDe(classe).includes(profId);
  const nomsCoEnseignants = (classe, comptes = null) => {
    const liste = comptes || lireComptes();
    if (!liste.length && Array.isArray(classe.coNoms)) return classe.coNoms; // PC élève hors ligne
    return (classe.coEnseignants || []).map((id) => (liste.find((c) => c.id === id) || {}).nom).filter(Boolean);
  };
  const nomsProfs = (classe, comptes = null) => [nomProf(classe, comptes), ...nomsCoEnseignants(classe, comptes)].filter(Boolean).join(' et ') || null;
  const nomProf = (classe, comptes = null) => classe.profNom || ((comptes || lireComptes()).find((c) => c.id === proprietaire(classe)) || {}).nom || null;

  // ---------- Identité de l'élève sur ce PC (inscriptions) ----------
  // Chaque nom choisi est mémorisé sur l'ordinateur : l'élève est reconnecté automatiquement et ne peut plus
  // en changer. Seul un enseignant peut l'effacer (déconnexion à distance ou mot de passe sur place).
  const fichierIdentite = () => path.join(dossierDonnees(), 'eleve.json');
  function lireIdentite() {
    if (edition !== 'eleve') return null;
    const m = lireJson(fichierIdentite(), null);
    if (!m) return null;
    if (Array.isArray(m.inscriptions)) return m.inscriptions.length ? m : null;
    if (m.classeId) return { inscriptions: [{ classeId: m.classeId, eleveId: m.eleveId, date: m.date }], active: m.classeId }; // ancienne version
    return null;
  }
  function ecrireIdentite(m) {
    fs.mkdirSync(dossierDonnees(), { recursive: true });
    fs.writeFileSync(fichierIdentite(), JSON.stringify(m));
  }
  const resume = (c, el) => ({
    classeId: c.id, classe: c.nom, niveau: c.niveau || null, matiere: c.matiere || null, matieres: c.matieres || [], prof: nomsProfs(c), profId: proprietaire(c), profIds: enseignantsDe(c),
    eleveId: el.id, nom: el.nom, horsLigne: !!c.horsLigne,
  });

  function definirActif(inscription) {
    eleveActuel = inscription || null;
    surIdentification(eleveActuel);
  }
  // Inscriptions encore valables (un élève retiré de sa classe par l'enseignant perd cette inscription).
  function identiteMemorisee() {
    const m = lireIdentite();
    if (!m) return null;
    const valables = [], anciennes = [];
    let changement = false;
    for (const ins of m.inscriptions) {
      const c = classeDeLEleve(ins.classeId);
      if (!c) { if (dossierAccessible()) changement = true; continue; } // classe supprimée (ou momentanément illisible)
      const el = (c.eleves || []).find((e) => e.id === ins.eleveId);
      if (!el) { changement = true; continue; }
      // Classe clôturée : l'inscription reste (« Mes années précédentes ») mais ne compte plus parmi les matières.
      if (estArchivee(c)) anciennes.push({ ...resume(c, el), archive: c.archive }); else valables.push(resume(c, el));
    }
    if (changement) {
      const restantes = m.inscriptions.filter((i) => [...valables, ...anciennes].some((v) => v.classeId === i.classeId));
      if (!restantes.length) { oublierIdentite(); return null; }
      ecrireIdentite({ ...m, inscriptions: restantes, active: restantes.some((i) => i.classeId === m.active) ? m.active : restantes[0].classeId });
    }
    if (!valables.length && !anciennes.length) return { indisponible: true, inscriptions: [], anciennes: [] }; // dossier partagé inaccessible et rien en mémoire
    if (!valables.length) { if (eleveActuel) definirActif(null); return { inscriptions: [], anciennes, active: null }; } // nouvelle année : rien d'actif
    const active = valables.find((v) => v.classeId === m.active) || valables[0];
    if (!eleveActuel || eleveActuel.classeId !== active.classeId) definirActif(active);
    return { inscriptions: valables, anciennes, active: active.classeId };
  }
  function oublierIdentite() {
    fs.rmSync(fichierIdentite(), { force: true });
    definirActif(null);
  }
  // L'enseignant déconnecte l'élève de SA classe seulement (les autres matières restent).
  function oublierInscription(classeId) {
    const m = lireIdentite();
    if (!m) return;
    const restantes = m.inscriptions.filter((i) => i.classeId !== classeId);
    if (!restantes.length) { oublierIdentite(); return; }
    ecrireIdentite({ ...m, inscriptions: restantes, active: restantes[0].classeId });
    eleveActuel = null;
    identiteMemorisee();
  }
  // Rend une inscription active (changement de matière, ou examen lancé dans une autre classe).
  function activer(classeId) {
    const m = lireIdentite();
    if (!m || !m.inscriptions.some((i) => i.classeId === classeId)) return null;
    if (m.active !== classeId) ecrireIdentite({ ...m, active: classeId });
    const ins = m.inscriptions.find((i) => i.classeId === classeId);
    const c = classeDeLEleve(classeId);
    const el = c && (c.eleves || []).find((e) => e.id === ins.eleveId);
    if (!el || estArchivee(c)) return null;
    definirActif(resume(c, el));
    return eleveActuel;
  }

  // ---------- Réglages de l'établissement (lus par tous les PC) ----------
  const fichierEtablissement = () => (racine() ? path.join(racine(), 'etablissement.json') : null);
  const lireEtablissement = () => (fichierEtablissement() && lireJson(fichierEtablissement(), {})) || {};

  function etat() {
    const dossier = lireConfig().dossierMaj || null;
    const accessible = !!dossier && fs.existsSync(dossier);
    const comptes = accessible ? lireComptes() : [];
    const c = compteConnecte();
    return {
      dossier, accessible,
      motDePasseDefini: comptes.length > 0,
      comptes: comptes.map(comptePublic),
      profDeverrouille: !!c,
      prof: c ? comptePublic(c) : null,
    };
  }

  function listerClasses() {
    const r = racine();
    if (!r || !fs.existsSync(r)) return [];
    return fs.readdirSync(r, { withFileTypes: true })
      .filter((e) => e.isDirectory() && ID.test(e.name))
      .map((e) => lireJson(path.join(r, e.name, 'classe.json'), null))
      .filter((c) => c && c.id && c.nom)
      .map(normaliserClasse)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  }
  // Anciennes classes (une seule matière, « co-intervention ») : réécrites au nouveau format quand un de
  // leurs enseignants se connecte. Les anciennes versions de Labo Élève lisent toujours « matiere ».
  function migrerClasses() {
    const r = racine();
    if (!r || !profConnecte || !fs.existsSync(r)) return 0;
    let n = 0;
    for (const e of fs.readdirSync(r, { withFileTypes: true })) {
      if (!e.isDirectory() || !ID.test(e.name)) continue;
      const f = path.join(r, e.name, 'classe.json');
      const brut = lireJson(f, null);
      if (!brut || !brut.id || !brut.nom) continue;
      const avant = JSON.stringify(brut);
      const c = normaliserClasse(JSON.parse(avant));
      if (JSON.stringify(c) === avant || !peutGerer(c, profConnecte)) continue;
      try { ecrireJson(f, c); n++; } catch { /* fichier momentanément inaccessible */ }
    }
    return n;
  }
  function lireClasse(id) {
    if (typeof id !== 'string' || !ID.test(id) || !racine()) return null;
    return normaliserClasse(lireJson(fichierClasse(id), null));
  }

  // ---------- Copie des classes de l'élève sur son PC (fonctionne sans réseau) ----------
  // Un élève qui coupe son réseau ne doit sortir ni du mode examen ni du mode focus : si le dossier partagé
  // est inaccessible, on garde les derniers réglages connus de ses classes (et les empreintes des mots de passe
  // enseignants, pour qu'un enseignant puisse agir sur place).
  const fichierMemo = () => path.join(dossierDonnees(), 'classe-memo.json');
  let memoEcrit = '';
  const dossierAccessible = () => { const r = racine(); return !!r && fs.existsSync(r); };
  function lireMemo() {
    const m = lireJson(fichierMemo(), {}) || {};
    if (m.classe && !m.classes) { // ancienne version : une seule classe
      m.classes = { [m.classe.id]: m.classe };
      m.profs = m.prof ? [{ id: COMPTE_HISTORIQUE, ...m.prof }] : [];
      m.examensLeves = m.examenLeve ? [m.examenLeve] : [];
      delete m.classe; delete m.prof; delete m.examenLeve;
    }
    return { classes: {}, profs: [], examensLeves: [], ...m };
  }
  function ecrireMemo(m) {
    const t = JSON.stringify(m);
    if (t === memoEcrit) return;
    fs.mkdirSync(dossierDonnees(), { recursive: true });
    fs.writeFileSync(fichierMemo(), t);
    memoEcrit = t;
  }
  function classeDeLEleve(id) {
    const ident = lireIdentite();
    const c = lireClasse(id);
    if (!ident || !ident.inscriptions.some((i) => i.classeId === id)) return c;
    const m = lireMemo();
    if (c) {
      const comptes = lireComptes();
      const profs = comptes.length ? comptes.map(({ id: i, sel, empreinte: e, n }) => ({ id: i, sel, empreinte: e, n })) : m.profs;
      ecrireMemo({ ...m, classes: { ...m.classes, [id]: { ...c, profNom: nomProf(c, comptes), coNoms: nomsCoEnseignants(c, comptes) } }, profs });
      return c;
    }
    if (dossierAccessible()) return null; // classe vraiment supprimée par l'enseignant
    return m.classes[id] ? normaliserClasse({ ...m.classes[id], horsLigne: true }) : null;
  }
  // Examen en cours dans l'une des classes de l'élève (l'examen l'emporte sur la matière choisie).
  function examenEleve() {
    const m = lireIdentite();
    if (!m) return null;
    const leves = lireMemo().examensLeves;
    for (const i of m.inscriptions) {
      const c = classeDeLEleve(i.classeId) || {};
      const e = c.examen;
      if (e && Array.isArray(e.outils) && !estArchivee(c) && !leves.includes(e.debut)) return { classeId: i.classeId, examen: e };
    }
    // Examen démarré sur ce PC avec le code de l'enseignant (sans réseau).
    const local = lireMemo().examenLocal;
    if (local && local.examen && !leves.includes(local.examen.debut)) {
      const c = classeDeLEleve(local.classeId);
      const p = c && c.examenPrepare;
      // Réseau revenu et l'enseignant a retiré cet examen (ou clôturé la classe) : il se termine sur ce PC.
      if (dossierAccessible() && (!c || !p || p.id !== local.prepareId || estArchivee(c))) {
        const m2 = lireMemo();
        ecrireMemo({ ...m2, examenLocal: null, examensLeves: [...m2.examensLeves, local.examen.debut].slice(-20) });
        return null;
      }
      return { classeId: local.classeId, examen: local.examen, local: true };
    }
    return null;
  }

  // L'enseignant tape le code de l'examen préparé : l'examen démarre sur ce PC, même sans réseau
  // (les réglages de l'examen ont été copiés sur le PC la dernière fois qu'il a vu le dossier partagé).
  let essaisCode = 0, codeBloqueJusqua = 0;
  function demarrerExamenParCode(code) {
    if (edition !== 'eleve') return { ok: false, message: 'Réservé à Labo Élève.' };
    if (Date.now() < codeBloqueJusqua) return { ok: false, message: 'Trop d\'essais. Réessaie dans une minute.' };
    const ident = lireIdentite();
    if (!ident || !ident.inscriptions.length) return { ok: false, message: 'Cet ordinateur n\'est inscrit dans aucune classe.' };
    if (examenEleve()) return { ok: false, message: 'Un examen est déjà en cours sur cet ordinateur.' };
    const saisi = String(code || '').replace(/\s/g, '');
    for (const i of ident.inscriptions) {
      const c = classeDeLEleve(i.classeId);
      const p = c && !estArchivee(c) && c.examenPrepare;
      if (!p || !Array.isArray(p.outils) || String(p.code) !== saisi) continue;
      essaisCode = 0;
      const m = lireMemo();
      ecrireMemo({ ...m, examenLocal: { classeId: i.classeId, prepareId: p.id, examen: { titre: p.titre, outils: p.outils, debut: new Date().toISOString(), horsReseau: true } } });
      surExamenLocal();
      return { ok: true, titre: p.titre };
    }
    if (++essaisCode >= 10) { codeBloqueJusqua = Date.now() + 60_000; essaisCode = 0; }
    return { ok: false, message: 'Code inconnu. L\'examen doit avoir été préparé dans Labo Prof, et ce PC doit avoir ouvert Labo Élève avec le réseau depuis.' };
  }

  // ---------- Arborescence : thèmes (dossiers), outils, Digipads, documents ----------
  const trouver = (noeuds, id, parent = null) => {
    for (const n of noeuds) {
      if (n.id === id) return { noeud: n, parent, liste: noeuds };
      if (n.type === 'dossier') { const r = trouver(n.enfants || [], id, n); if (r) return r; }
    }
    return null;
  };
  const enfantsDe = (classe, parentId) => {
    classe.contenu = classe.contenu || [];
    if (!parentId) return classe.contenu;
    const r = trouver(classe.contenu, parentId);
    if (!r || r.noeud.type !== 'dossier') throw new Error('Dossier introuvable.');
    r.noeud.enfants = r.noeud.enfants || [];
    return r.noeud.enfants;
  };
  // parentId « @maths » : racine des thèmes de cette matière (classe à plusieurs matières).
  function cible(c, parentId) {
    if (typeof parentId === 'string' && parentId.startsWith('@')) {
      const m = matiereValide(parentId.slice(1));
      if (!m || !(c.matieres || []).includes(m)) throw new Error('Cette matière n\'est pas dans la classe.');
      c.contenu = c.contenu || [];
      return { liste: c.contenu, matiere: m };
    }
    return { liste: enfantsDe(c, parentId), matiere: null };
  }
  // Éléments présents à cet endroit (à la racine d'une matière : seulement ceux de cette matière).
  const elementsVisibles = (c, t) => (t.matiere ? t.liste.filter((n) => matiereNoeud(c, n) === t.matiere) : t.liste);
  function pousser(c, parentId, noeud) {
    const t = cible(c, parentId);
    if (t.matiere) noeud.matiere = t.matiere; else delete noeud.matiere;
    t.liste.push(noeud);
    return noeud;
  }
  // Avant de changer les matières : les éléments sans matière gardent la principale actuelle.
  const figerMatieres = (c) => { for (const n of c.contenu || []) if (!n.matiere && c.matiere) n.matiere = c.matiere; };
  const tousLesFichiers = (noeuds) => noeuds.flatMap((n) => (n.type === 'dossier' ? tousLesFichiers(n.enfants || []) : n.type === 'document' || n.type === 'travail' ? [n.fichier] : []));

  // ---------- Travaux à rendre (PDF à compléter) ----------
  const TYPES_CHAMPS = ['texte', 'zone', 'case'];
  const nombre01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; };
  function champsValides(champs) {
    if (!Array.isArray(champs)) throw new Error('Cases invalides.');
    return champs.slice(0, 400).map((c, i) => ({
      id: ID.test(String(c.id || '')) ? String(c.id) : 'c' + idCourt(),
      page: Math.max(1, Math.min(500, Math.floor(Number(c.page) || 1))),
      x: nombre01(c.x), y: nombre01(c.y), l: Math.max(0.005, nombre01(c.l)), h: Math.max(0.005, nombre01(c.h)),
      type: TYPES_CHAMPS.includes(c.type) ? c.type : 'texte',
      nom: String(c.nom || `Case ${i + 1}`).trim().slice(0, 60) || `Case ${i + 1}`,
    }));
  }
  const dossierCopies = (classeId, travailId) => path.join(dossierClasse(classeId), 'travaux', travailId);
  const fichierCopie = (classeId, travailId, eleveId) => path.join(dossierCopies(classeId, travailId), eleveId + '.json');
  // Copie de l'élève : réponses, historique horodaté, date de rendu. Taille bornée.
  function copieValide(c) {
    const valeurs = {};
    for (const [k, v] of Object.entries((c && c.valeurs) || {}).slice(0, 400)) {
      if (!ID.test(k)) continue;
      valeurs[k] = typeof v === 'boolean' ? v : String(v ?? '').slice(0, 20000); // une réponse au format « exercice » (JSON) peut faire plusieurs lignes
    }
    const historique = (Array.isArray(c && c.historique) ? c.historique : []).slice(-5000).map((h) => ({
      t: String(h.t || '').slice(0, 30), c: String(h.c || '').slice(0, 60),
      a: typeof h.a === 'boolean' ? h.a : String(h.a ?? '').slice(0, 2000), n: typeof h.n === 'boolean' ? h.n : String(h.n ?? '').slice(0, 2000),
      ...(h.e ? { e: String(h.e).slice(0, 30) } : {}),
    })).filter((h) => !Number.isNaN(Date.parse(h.t)));
    return { valeurs, historique, rendu: c && c.rendu && !Number.isNaN(Date.parse(c.rendu)) ? c.rendu : null };
  }
  // Remarques de l'enseignant sur la copie (par question : validé / à compléter / faux + commentaire), dans un fichier à part :
  // l'élève qui enregistre sa copie ne les efface pas. Gardées aussi sur le PC de l'élève (sans réseau).
  const fichierRetour = (classeId, travailId, eleveId) => path.join(dossierCopies(classeId, travailId), 'retours', eleveId + '.json');
  const VERDICTS_TRAVAIL = ['juste', 'partiel', 'faux'];
  function retourValide(r = {}) {
    const questions = {};
    for (const [k, v] of Object.entries((r && r.questions) || {}).slice(0, 200)) {
      if (!ID.test(k) || !v) continue;
      const x = { ...(VERDICTS_TRAVAIL.includes(v.v) ? { v: v.v } : {}), ...(String(v.c || '').trim() ? { c: String(v.c).trim().slice(0, 1000) } : {}) };
      if (Object.keys(x).length) questions[k] = x;
    }
    return { questions, general: String((r && r.general) || '').trim().slice(0, 2000) };
  }
  const plusRecente = (a, b) => (!a ? b : !b ? a : Date.parse(b.maj || 0) > Date.parse(a.maj || 0) ? b : a);
  const dossierLocalTravaux = () => path.join(dossierDonnees(), 'travaux');
  const fichierLocal = (classeId, travailId) => path.join(dossierLocalTravaux(), `${classeId}--${travailId}.json`);
  // Envoie au dossier partagé les copies enregistrées sur ce PC pendant une coupure du réseau.
  function synchroniserCopies() {
    if (!dossierAccessible()) return;
    let fichiers = [];
    try { fichiers = fs.readdirSync(dossierLocalTravaux()).filter((f) => f.endsWith('.json')); } catch { return; }
    for (const f of fichiers) {
      const local = lireJson(path.join(dossierLocalTravaux(), f), null);
      if (!local || !local.aEnvoyer || !local.classeId || !local.travailId || !local.eleveId) continue;
      try {
        if (!fs.existsSync(dossierClasse(local.classeId))) continue;
        const cible = fichierCopie(local.classeId, local.travailId, local.eleveId);
        const partage = lireJson(cible, null);
        if (partage && Date.parse(partage.maj || 0) > Date.parse(local.maj || 0)) { ecrireJson(path.join(dossierLocalTravaux(), f), { ...partage, aEnvoyer: false }); continue; }
        fs.mkdirSync(path.dirname(cible), { recursive: true });
        const { aEnvoyer, ...copie } = local;
        ecrireJson(cible, copie);
        ecrireJson(path.join(dossierLocalTravaux(), f), { ...local, aEnvoyer: false });
      } catch { /* réseau encore indisponible */ }
    }
  }
  if (edition === 'eleve') setInterval(() => { synchroniserCopies(); envoyerCopiesEnAttente(); }, 30_000);

  // ---------- Copies des élèves (tout document enregistré dans Labo Élève) ----------
  const DOSSIER_COPIES = 'Copies des élèves';
  const fichierAttenteCopies = () => path.join(dossierDonnees(), 'copies-a-envoyer.json');
  const dossierCopiesEleve = (classeId, nom) => path.join(dossierClasse(classeId), DOSSIER_COPIES, nomFichierSur(nom));
  function envoyerCopie(x) {
    try {
      if (!dossierAccessible() || !fs.existsSync(dossierClasse(x.classeId))) return false;
      const source = path.join(dossierDocuments(), x.fichier);
      if (!fs.existsSync(source)) return true; // supprimé depuis : plus rien à envoyer
      const dossier = dossierCopiesEleve(x.classeId, x.nom || x.eleveId);
      fs.mkdirSync(dossier, { recursive: true });
      fs.copyFileSync(source, path.join(dossier, x.fichier));
      return true;
    } catch { return false; }
  }
  function envoyerCopiesEnAttente() {
    const liste = lireJson(fichierAttenteCopies(), []);
    if (!Array.isArray(liste) || !liste.length) return;
    const reste = liste.filter((x) => !envoyerCopie(x));
    if (reste.length !== liste.length) ecrireJson(fichierAttenteCopies(), reste);
  }
  // L'élève choisit d'envoyer un document de « Mes documents » à l'enseignant de la matière en cours.
  function infoEnvoiProf() {
    if (edition !== 'eleve' || !eleveActuel) return { disponible: false };
    return { disponible: true, prof: eleveActuel.prof || 'ton professeur', classe: eleveActuel.classe || '', nom: eleveActuel.nom || '' };
  }
  function copierPourLeProf(chemin) {
    if (edition !== 'eleve' || !eleveActuel) return { ok: false, message: 'Choisis d\'abord ta classe.' };
    const x = { classeId: eleveActuel.classeId, eleveId: eleveActuel.eleveId, nom: eleveActuel.nom, fichier: path.basename(chemin), t: new Date().toISOString() };
    if (envoyerCopie(x)) return { ok: true, envoye: true, prof: eleveActuel.prof || '' };
    // Réseau coupé : envoyé plus tard (la dernière version du fichier sera copiée).
    const liste = lireJson(fichierAttenteCopies(), []).filter((y) => !(y.classeId === x.classeId && y.fichier === x.fichier));
    liste.push(x);
    fs.mkdirSync(dossierDonnees(), { recursive: true });
    ecrireJson(fichierAttenteCopies(), liste.slice(-500));
    return { ok: true, envoye: false, prof: eleveActuel.prof || '' };
  }
  const noeudOutil = (outil) => ({ id: idCourt(), type: 'outil', outil });
  const outilValide = (o) => typeof o === 'string' && ID.test(o);

  // ---------- Mots de passe ----------
  // Empreinte scrypt (le mot de passe n'est jamais enregistré). n = coût : 65536 pour les mots de passe créés
  // ou changés depuis la version 1.1 (plus long à « deviner » à partir du dossier partagé), 16384 pour les anciens.
  const COUT_MDP = 65536;
  const empreinte = (mdp, sel, n = 16384) => crypto.scryptSync(String(mdp), sel, 32, { N: n, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString('hex');
  const correspond = (compte, mdp) => {
    try { return crypto.timingSafeEqual(Buffer.from(compte.empreinte, 'hex'), Buffer.from(empreinte(mdp, compte.sel, compte.n || 16384), 'hex')); } catch { return false; }
  };
  let essais = 0, bloqueJusqua = 0;
  // compteId : vérifier ce compte précis (connexion à Labo Prof) ; sinon, n'importe quel enseignant (action sur un PC élève).
  function verifierMotDePasse(mdp, compteId = null) {
    if (Date.now() < bloqueJusqua) return { ok: false, message: 'Trop d\'essais. Réessaie dans une minute.' };
    // Sans réseau, le PC élève vérifie avec les empreintes mémorisées (jamais les mots de passe eux-mêmes).
    let comptes = dossierAccessible() ? lireComptes() : [];
    if (!comptes.length && edition === 'eleve') comptes = lireMemo().profs;
    if (!comptes.length) return { ok: false, message: 'Aucun compte enseignant n\'existe encore.' };
    const candidats = compteId ? comptes.filter((c) => c.id === compteId) : comptes;
    if (!candidats.length) return { ok: false, message: 'Compte introuvable.' };
    const compte = candidats.find((c) => correspond(c, mdp));
    if (compte) { essais = 0; return { ok: true, compte }; }
    if (++essais >= 5) { bloqueJusqua = Date.now() + 60_000; essais = 0; }
    return { ok: false, message: 'Mot de passe incorrect.' };
  }
  const REFUS_AUTRE = 'Cette classe appartient à un autre enseignant (qui ne t\'a pas invité comme co-enseignant).';
  const REFUS_ARCHIVE = (c) => `Cette classe est clôturée (année ${c.archive.annee}) : elle est en lecture seule. Rouvre-la pour la modifier.`;
  const exigerProf = () => {
    if (edition !== 'prof') throw new Error(MESSAGE_ELEVE);
    if (!profConnecte) throw new Error('Espace professeur verrouillé.');
  };

  // Toutes les écritures passent par ici : enseignant connecté, et seulement dans ses propres classes.
  function modifierClasse(id, transformation, { memeArchivee = false } = {}) {
    exigerProf();
    const classe = lireClasse(id);
    if (!classe) throw new Error('Classe introuvable.');
    if (!peutGerer(classe, profConnecte)) throw new Error(REFUS_AUTRE);
    if (estArchivee(classe) && !memeArchivee) throw new Error(REFUS_ARCHIVE(classe));
    const resultat = transformation(classe);
    classe.modifie = new Date().toISOString();
    ecrireJson(fichierClasse(id), classe);
    return resultat === undefined ? classe : resultat;
  }
  const gerer = (canal, fn) => ipcMain.handle(canal, async (_e, ...args) => {
    try { const r = await fn(...args); return { ok: true, ...(r && typeof r === 'object' && !Array.isArray(r) ? r : { valeur: r }) }; }
    catch (e) { return { ok: false, message: e.message }; }
  });
  const nomPropre = (n, max = 80) => { const t = String(n || '').trim().replace(/\s+/g, ' ').slice(0, max); if (!t) throw new Error('Le nom est vide.'); return t; };
  const mdpValide = (mdp) => { if (String(mdp || '').length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.'); };
  const resumeClasse = (c, comptes) => ({
    id: c.id, nom: c.nom, niveau: c.niveau, matiere: c.matiere || null, matieres: c.matieres || [], profId: proprietaire(c), profIds: enseignantsDe(c),
    archive: c.archive || null,
    prof: nomsProfs(c, comptes), coEnseignant: edition === 'prof' && !!profConnecte && proprietaire(c) !== profConnecte,
    eleves: (c.eleves || []).map((e) => ({ id: e.id, nom: e.nom })),
  });
  // Détail lu par Labo Prof : qui gère la classe.
  const enseignantsPublics = (c, comptes) => enseignantsDe(c).map((id, i) => ({ id, nom: (comptes.find((x) => x.id === id) || {}).nom || (i === 0 ? nomProf(c, comptes) : null) || 'Compte supprimé', proprietaire: i === 0 }));
  const verifierProprietaire = (c) => { if (proprietaire(c) !== profConnecte) throw new Error('Seul l\'enseignant qui a créé la classe peut faire cela.'); };
  // ecriture : refusée si la classe est clôturée (la lecture reste possible).
  const classeGeree = (id, { ecriture = false } = {}) => {
    exigerProf();
    const c = lireClasse(id);
    if (!c) throw new Error('Classe introuvable.');
    if (!peutGerer(c, profConnecte)) throw new Error(REFUS_AUTRE);
    if (ecriture && estArchivee(c)) throw new Error(REFUS_ARCHIVE(c));
    return c;
  };

  function enregistrerIPC() {
    // ----- Lecture (élèves et enseignants) -----
    ipcMain.handle('classes:etat', () => etat());
    // Labo Prof : les classes de l'enseignant connecté. Labo Élève : toutes les classes (pour s'inscrire).
    ipcMain.handle('classes:lister', () => {
      const comptes = lireComptes();
      let liste = listerClasses();
      if (edition === 'prof') liste = profConnecte ? liste.filter((c) => peutGerer(c, profConnecte)) : [];
      else liste = liste.filter((c) => !estArchivee(c)); // l'élève ne s'inscrit que dans les classes de l'année
      return liste.map((c) => resumeClasse(c, comptes));
    });
    ipcMain.handle('classes:lire', (_e, id) => {
      const c = edition === 'prof' ? lireClasse(id) : classeDeLEleve(id);
      if (!c) return null;
      const r = { ...c, matiere: c.matiere || null, prof: nomsProfs(c) };
      if (edition === 'prof') {
        const comptes = lireComptes();
        Object.assign(r, { enseignants: enseignantsPublics(c, comptes), estProprietaire: proprietaire(c) === profConnecte, coEnseignant: !!profConnecte && proprietaire(c) !== profConnecte });
      }
      return r;
    });

    // L'élève récupère un document de l'enseignant : copie dans « Mes documents ».
    // ----- Travail à rendre : côté élève (fonctionne aussi sans réseau) -----
    gerer('travail:ouvrir', (classeId, travailId) => {
      const ident = lireIdentite();
      if (!ident || !ident.inscriptions.some((i) => i.classeId === classeId)) throw new Error('Choisis d\'abord ta classe.');
      const ins = ident.inscriptions.find((i) => i.classeId === classeId);
      const classe = classeDeLEleve(classeId);
      const r = classe && trouver(classe.contenu || [], travailId);
      if (!r || r.noeud.type !== 'travail') throw new Error('Ce travail n\'existe plus.');
      const n = r.noeud;
      // PDF : depuis le dossier partagé (et gardé sur ce PC), sinon la copie gardée.
      const cache = path.join(dossierLocalTravaux(), `${classeId}--${travailId}.pdf`);
      let octets = null;
      try {
        const source = path.join(dossierClasse(classeId), n.fichier);
        if (dossierAccessible() && source.startsWith(dossierClasse(classeId) + path.sep) && fs.existsSync(source)) {
          octets = fs.readFileSync(source);
          fs.mkdirSync(dossierLocalTravaux(), { recursive: true });
          fs.writeFileSync(cache, octets);
        }
      } catch { /* réseau coupé */ }
      if (!octets && fs.existsSync(cache)) octets = fs.readFileSync(cache);
      if (!octets) throw new Error('Le document n\'est pas disponible sans réseau (il n\'a jamais été ouvert sur ce PC).');
      synchroniserCopies();
      let partage = null;
      try { if (dossierAccessible()) partage = lireJson(fichierCopie(classeId, travailId, ins.eleveId), null); } catch { /* réseau coupé */ }
      const local = lireJson(fichierLocal(classeId, travailId), null);
      const copie = plusRecente(local && local.eleveId === ins.eleveId ? local : null, partage);
      const moi = (classe.eleves || []).find((x) => x.id === ins.eleveId);
      const cacheRetour = path.join(dossierLocalTravaux(), `${classeId}--${travailId}--retour.json`);
      let retour = null;
      try { if (dossierAccessible()) { retour = lireJson(fichierRetour(classeId, travailId, ins.eleveId), null); if (retour) { fs.mkdirSync(dossierLocalTravaux(), { recursive: true }); ecrireJson(cacheRetour, { ...retour, eleveId: ins.eleveId }); } else fs.rmSync(cacheRetour, { force: true }); } } catch { /* réseau coupé */ }
      if (!retour) { const l = lireJson(cacheRetour, null); if (l && l.eleveId === ins.eleveId) retour = l; }
      return { retour, travail: { id: n.id, nom: n.nom, champs: n.champs || [], questions: n.questions || [] }, octets: new Uint8Array(octets), copie: copie || null, eleve: { nom: moi ? moi.nom : '' },
        lectureSeule: estArchivee(classe), annee: estArchivee(classe) ? classe.archive.annee : null };
    });
    gerer('travail:enregistrer', (classeId, travailId, donnees) => {
      const ident = lireIdentite();
      const ins = ident && ident.inscriptions.find((i) => i.classeId === classeId);
      if (!ins || !ID.test(String(travailId))) throw new Error('Choisis d\'abord ta classe.');
      const c = copieValide(donnees);
      const cl = classeDeLEleve(classeId);
      if (estArchivee(cl)) throw new Error(`Cette classe est clôturée (année ${cl.archive.annee}) : ta copie ne se modifie plus.`);
      // Un travail rendu ne se modifie plus, sauf si l'enseignant l'a rouvert.
      let partage = null;
      try { if (dossierAccessible()) partage = lireJson(fichierCopie(classeId, travailId, ins.eleveId), null); } catch { /* réseau coupé */ }
      const local = lireJson(fichierLocal(classeId, travailId), null);
      const actuelle = plusRecente(local, partage);
      if (actuelle && actuelle.rendu && !c.rendu) throw new Error('Ce travail est déjà rendu.');
      const classe = classeDeLEleve(classeId);
      const eleve = classe && (classe.eleves || []).find((x) => x.id === ins.eleveId);
      const copie = { classeId, travailId, eleveId: ins.eleveId, nom: eleve ? eleve.nom : '', poste: os.hostname(), maj: new Date().toISOString(), ...c };
      let envoye = false;
      try {
        if (dossierAccessible() && fs.existsSync(dossierClasse(classeId))) {
          fs.mkdirSync(dossierCopies(classeId, travailId), { recursive: true });
          ecrireJson(fichierCopie(classeId, travailId, ins.eleveId), copie);
          envoye = true;
        }
      } catch { /* réseau coupé : gardé sur ce PC */ }
      fs.mkdirSync(dossierLocalTravaux(), { recursive: true });
      ecrireJson(fichierLocal(classeId, travailId), { ...copie, aEnvoyer: !envoye });
      return { envoye, maj: copie.maj };
    });

    gerer('classes:recuperer', (classeId, elementId) => {
      const classe = edition === 'eleve' ? classeDeLEleve(classeId) : lireClasse(classeId); // hors ligne : la classe mémorisée
      const r = classe && trouver(classe.contenu || [], elementId);
      if (!r || r.noeud.type !== 'document') throw new Error('Document introuvable.');
      const source = path.join(dossierClasse(classeId), r.noeud.fichier);
      const existant = path.join(dossierDocuments(), nomFichierSur(r.noeud.nom));
      // Sans réseau (ou fichier disparu) : la copie déjà récupérée sur ce PC, s'il y en a une.
      if (!source.startsWith(dossierClasse(classeId) + path.sep) || !fs.existsSync(source)) {
        if (fs.existsSync(existant)) return { nom: path.basename(existant) };
        throw new Error(dossierAccessible() ? 'Le fichier n\'est plus disponible dans le dossier partagé.' : 'Ce document n\'est pas disponible sans réseau (il n\'a jamais été ouvert sur ce PC).');
      }
      fs.mkdirSync(dossierDocuments(), { recursive: true });
      // Déjà récupéré et inchangé ? On réutilise la copie (évite « fiche (2).pdf », « fiche (3).pdf »…).
      if (fs.existsSync(existant) && fs.statSync(existant).size === fs.statSync(source).size) return { nom: path.basename(existant) };
      const dest = cheminLibre(nomFichierSur(r.noeud.nom));
      fs.copyFileSync(source, dest);
      return { nom: path.basename(dest) };
    });

    ipcMain.handle('classes:identite', () => identiteMemorisee());

    // Inscription dans une classe (premier passage dans une matière), ou changement de matière.
    ipcMain.handle('classes:identifier', (_e, ident) => {
      if (edition !== 'eleve') return { ok: false, message: 'Réservé à Labo Élève.' };
      const m = lireIdentite() || { inscriptions: [], active: null };
      if (!ident) { // « continuer sans classe » : seulement si l'élève n'est inscrit nulle part
        if (m.inscriptions.length) return { ok: false, message: 'Un élève est déjà enregistré sur cet ordinateur.' };
        definirActif(null);
        return { ok: true };
      }
      const deja = m.inscriptions.find((i) => i.classeId === ident.classeId);
      if (deja && deja.eleveId !== ident.eleveId) return { ok: false, message: 'Tu es déjà inscrit(e) dans cette classe sous un autre nom. Seul ton professeur peut le changer.' };
      const classe = deja ? classeDeLEleve(ident.classeId) : lireClasse(ident.classeId);
      const eleve = classe && (classe.eleves || []).find((e) => e.id === ident.eleveId);
      if (!eleve) return { ok: false, message: 'Élève introuvable.' };
      if (estArchivee(classe)) return { ok: false, message: `Cette classe est clôturée (année ${classe.archive.annee}). Retrouve-la dans « Mes années précédentes ».` };
      if (!deja) {
        // Une seule classe par enseignant et par matière.
        for (const i of m.inscriptions) {
          const autre = classeDeLEleve(i.classeId);
          if (!autre || estArchivee(autre)) continue; // nouvelle année : l'ancienne classe ne bloque plus
          const communes = autre && (autre.matieres.length && classe.matieres.length ? autre.matieres.some((x) => classe.matieres.includes(x)) : (autre.matiere || null) === (classe.matiere || null));
          if (autre && proprietaire(autre) === proprietaire(classe) && communes) {
            return { ok: false, message: `Tu es déjà inscrit(e) avec ce professeur dans la classe ${autre.nom}.` };
          }
        }
        m.inscriptions.push({ classeId: classe.id, eleveId: eleve.id, date: new Date().toISOString() });
      }
      m.active = classe.id;
      ecrireIdentite(m);
      classeDeLEleve(classe.id); // copie pour le hors ligne
      definirActif(resume(classe, eleve));
      return { ok: true, eleve: eleveActuel };
    });

    // Un enseignant, sur le PC de l'élève, efface tous les noms mémorisés (avec son mot de passe).
    ipcMain.handle('classes:liberer-ce-pc', (_e, mdp) => {
      const v = verifierMotDePasse(mdp);
      if (!v.ok) return v;
      surLiberation(mdp); // preuve que c'est bien un enseignant qui a libéré ce PC
      oublierIdentite();
      return { ok: true };
    });

    // Un enseignant termine l'examen sur ce PC avec son mot de passe (utile si le réseau est coupé).
    ipcMain.handle('classes:examen-code', (_e, code) => demarrerExamenParCode(code));
    ipcMain.handle('classes:terminer-examen', (_e, mdp) => {
      const ex = examenEleve();
      if (!ex) return { ok: false, message: 'Aucun examen en cours sur cet ordinateur.' };
      const v = verifierMotDePasse(mdp);
      if (!v.ok) return v;
      const m = lireMemo();
      ecrireMemo({ ...m, examensLeves: [...m.examensLeves, ex.examen.debut].slice(-20), examenLocal: ex.local ? null : m.examenLocal });
      surExamenLeve();
      return { ok: true };
    });

    ipcMain.handle('classes:etablissement', () => lireEtablissement());
    gerer('prof:etablissement-modifier', ({ pronote } = {}) => {
      exigerProf();
      const r = { ...lireEtablissement() };
      if (pronote !== undefined) {
        const u = String(pronote || '').trim();
        if (u && !/^https:\/\/[^\s/]+\.[^\s/]+/i.test(u)) throw new Error('L\'adresse Pronote doit commencer par https:// (copie-la depuis ton navigateur).');
        r.pronote = u || null;
      }
      ecrireJson(fichierEtablissement(), r);
      return { etablissement: r };
    });

    // ----- Comptes enseignants -----
    // Création : le premier compte est libre ; les suivants doivent être validés par le mot de passe
    // d'un collègue déjà inscrit (un élève qui récupérerait Labo Prof ne peut pas se créer de compte).
    gerer('prof:creer-compte', ({ nom, matiere, mdp, mdpCollegue } = {}) => {
      if (edition !== 'prof') throw new Error(MESSAGE_ELEVE);
      if (!etat().accessible) throw new Error('Choisis d\'abord le dossier partagé.');
      const comptes = lireComptes();
      if (comptes.length) {
        const v = verifierMotDePasse(mdpCollegue);
        if (!v.ok) throw new Error(v.message === 'Mot de passe incorrect.' ? 'Le mot de passe du collègue est incorrect.' : v.message);
      }
      mdpValide(mdp);
      const n = nomPropre(nom, 50);
      if (comptes.some((c) => (c.nom || '').toLowerCase() === n.toLowerCase())) throw new Error('Un compte porte déjà ce nom.');
      const sel = crypto.randomBytes(16).toString('hex');
      const compte = { id: nouvelId('prof-' + n), nom: n, matiere: matiereValide(matiere), sel, n: COUT_MDP, empreinte: empreinte(mdp, sel, COUT_MDP), cree: new Date().toISOString() };
      ecrireComptes([...comptes, compte]);
      profConnecte = compte.id;
      surDeverrouillage(mdp, compte.id);
      migrerClasses();
      return { prof: comptePublic(compte) };
    });
    gerer('prof:connecter', (compteId, mdp) => {
      if (edition !== 'prof') throw new Error(MESSAGE_ELEVE);
      const v = verifierMotDePasse(mdp, String(compteId || ''));
      if (!v.ok) throw new Error(v.message);
      profConnecte = v.compte.id;
      surDeverrouillage(mdp, v.compte.id);
      migrerClasses();
      return { prof: comptePublic(v.compte) };
    });
    ipcMain.handle('prof:deverrouiller', () => ({ ok: false, message: edition === 'prof' ? 'Choisis ton compte.' : MESSAGE_ELEVE }));
    ipcMain.handle('prof:verrouiller', () => { profConnecte = null; surVerrouillage(); return true; });
    // Profil : nom affiché aux élèves (« M. Dupont ») et matière enseignée.
    gerer('prof:profil', ({ nom, matiere } = {}) => {
      exigerProf();
      const comptes = lireComptes();
      const c = comptes.find((x) => x.id === profConnecte);
      if (!c) throw new Error('Compte introuvable.');
      const n = nomPropre(nom, 50);
      if (comptes.some((x) => x.id !== c.id && (x.nom || '').toLowerCase() === n.toLowerCase())) throw new Error('Un autre compte porte déjà ce nom.');
      c.nom = n;
      if (matiere !== undefined) c.matiere = matiereValide(matiere);
      ecrireComptes(comptes);
      // Les classes de l'enseignant affichent son nom (même sur un PC élève hors ligne).
      for (const classe of listerClasses().filter((x) => proprietaire(x) === c.id)) {
        classe.profNom = c.nom;
        if (!classe.matiere && c.matiere) { classe.matiere = c.matiere; classe.matieres = [c.matiere]; }
        if (!classe.profId) classe.profId = c.id;
        ecrireJson(fichierClasse(classe.id), classe);
      }
      return { prof: comptePublic(c) };
    });
    gerer('prof:changer-mdp', (nouveau) => {
      exigerProf();
      mdpValide(nouveau);
      const comptes = lireComptes();
      const c = comptes.find((x) => x.id === profConnecte);
      if (!c) throw new Error('Compte introuvable.');
      c.sel = crypto.randomBytes(16).toString('hex');
      c.n = COUT_MDP;
      c.empreinte = empreinte(nouveau, c.sel, COUT_MDP);
      ecrireComptes(comptes);
    });

    // ----- Classes -----
    gerer('prof:classe-creer', ({ nom, niveau, matiere, matieres } = {}) => {
      exigerProf();
      const prof = compteConnecte();
      // Une ou plusieurs matières (ex. maths ET physique-chimie) ; sans choix : la matière du compte.
      let liste = listeMatieres(Array.isArray(matieres) ? matieres : [matiere], matiere || (prof && prof.matiere));
      if (!liste.length && prof && matiereValide(prof.matiere)) liste = [matiereValide(prof.matiere)];
      const classe = {
        id: nouvelId(nom), nom: nomPropre(nom, 40), niveau: NIVEAUX.includes(niveau) ? niveau : null,
        matiere: liste[0] || null, matieres: liste, profId: profConnecte, profNom: prof && prof.nom, coEnseignants: [],
        eleves: [], contenu: [], cree: new Date().toISOString(),
      };
      ecrireJson(fichierClasse(classe.id), classe);
      return { classe };
    });
    gerer('prof:classe-modifier', (id, { nom, niveau, matiere, matieres, modeFocus, rechercheInternet } = {}) => modifierClasse(id, (c) => {
      if (modeFocus !== undefined) c.modeFocus = !!modeFocus;
      if (rechercheInternet !== undefined) c.rechercheInternet = !!rechercheInternet;
      if (nom !== undefined) c.nom = nomPropre(nom, 40);
      if (niveau !== undefined) c.niveau = NIVEAUX.includes(niveau) ? niveau : null;
      if (matiere !== undefined || matieres !== undefined) {
        // La principale reste la même si elle est toujours cochée.
        const liste = matieres !== undefined ? listeMatieres(matieres, c.matiere) : listeMatieres([matiere, ...c.matieres.slice(1)], matiere);
        figerMatieres(c);
        c.matieres = liste;
        c.matiere = liste[0] || null;
      }
      return { classe: c };
    }));
    // ----- Co-enseignants : collègues qui gèrent la classe avec leur propre compte -----
    gerer('prof:co-enseignant-ajouter', (id, compteId) => modifierClasse(id, (c) => {
      verifierProprietaire(c);
      const compte = lireComptes().find((x) => x.id === compteId);
      if (!compte) throw new Error('Ce collègue n\'a pas de compte dans ce dossier partagé.');
      if (compte.id === proprietaire(c)) throw new Error('Tu es déjà l\'enseignant de cette classe.');
      if (!c.coEnseignants.includes(compte.id)) c.coEnseignants.push(compte.id);
      return { classe: c };
    }));
    // Retirer un co-enseignant : le propriétaire, ou le collègue lui-même (« quitter la classe »).
    gerer('prof:co-enseignant-retirer', (id, compteId) => modifierClasse(id, (c) => {
      if (proprietaire(c) !== profConnecte && compteId !== profConnecte) throw new Error('Seul l\'enseignant qui a créé la classe peut retirer un co-enseignant.');
      c.coEnseignants = c.coEnseignants.filter((x) => x !== compteId);
      return { classe: c };
    }));
    // ----- Mode examen : tous les élèves connectés de la classe passent en examen -----
    gerer('prof:examen-demarrer', (id, { titre, outils } = {}) => modifierClasse(id, (c) => {
      const liste = (Array.isArray(outils) ? outils : []).filter(outilValide);
      if (!liste.length) throw new Error('Choisis au moins un outil autorisé pendant l\'examen.');
      c.examen = { titre: String(titre || '').trim().slice(0, 60) || 'Examen', outils: liste, debut: new Date().toISOString() };
      return { classe: c };
    }));
    // Examen sans réseau : préparé à l'avance, il démarre sur chaque PC quand l'enseignant y tape le code.
    gerer('prof:examen-preparer', (id, { titre, outils, code } = {}) => modifierClasse(id, (c) => {
      const liste = (Array.isArray(outils) ? outils : []).filter(outilValide);
      if (!liste.length) throw new Error('Choisis au moins un outil autorisé pendant l\'examen.');
      const k = String(code || '').replace(/\s/g, '');
      if (!/^\d{4,8}$/.test(k)) throw new Error('Le code doit contenir de 4 à 8 chiffres.');
      c.examenPrepare = { id: idCourt(), titre: String(titre || '').trim().slice(0, 60) || 'Examen', outils: liste, code: k, cree: new Date().toISOString() };
      return { classe: c };
    }));
    gerer('prof:examen-preparer-retirer', (id) => modifierClasse(id, (c) => { c.examenPrepare = null; return { classe: c }; }));
    gerer('prof:examen-arreter', (id) => modifierClasse(id, (c) => { c.examen = null; return { classe: c }; }));

    // ----- Fin d'année : clôturer (archiver) ou rouvrir. Seul l'enseignant qui a créé la classe. -----
    const cloturer = (c, annee) => {
      c.archive = { annee: anneeValide(annee), date: new Date().toISOString(), par: profConnecte };
      c.examen = null; c.examenPrepare = null; // plus d'examen : les PC des élèves sont libérés
    };
    gerer('prof:annee-scolaire', () => ({ annee: anneeScolaire() }));
    gerer('prof:classe-cloturer', (id, annee) => modifierClasse(id, (c) => {
      verifierProprietaire(c);
      if (estArchivee(c)) throw new Error(`Cette classe est déjà clôturée (année ${c.archive.annee}).`);
      cloturer(c, annee);
      return { classe: c };
    }));
    gerer('prof:classe-rouvrir', (id) => modifierClasse(id, (c) => {
      verifierProprietaire(c);
      delete c.archive;
      return { classe: c };
    }, { memeArchivee: true }));
    gerer('prof:classes-cloturer-toutes', (annee) => {
      exigerProf();
      const a = anneeValide(annee);
      let n = 0;
      for (const c of listerClasses().filter((x) => proprietaire(x) === profConnecte && !estArchivee(x))) { modifierClasse(c.id, (x) => cloturer(x, a)); n++; }
      return { clotures: n, annee: a };
    });

    gerer('prof:classe-supprimer', (id) => {
      exigerProf();
      const c = lireClasse(id);
      if (!c) throw new Error('Classe introuvable.');
      if (proprietaire(c) !== profConnecte) throw new Error(peutGerer(c, profConnecte) ? 'Seul l\'enseignant qui a créé la classe peut la supprimer.' : REFUS_AUTRE);
      fs.rmSync(dossierClasse(id), { recursive: true, force: true });
    });

    // ----- Élèves -----
    gerer('prof:eleves-ajouter', (id, noms) => modifierClasse(id, (c) => {
      const existants = new Set((c.eleves || []).map((e) => e.nom.toLowerCase()));
      const ajoutes = [];
      for (const brut of (Array.isArray(noms) ? noms : []).slice(0, 200)) {
        const nom = String(brut || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        if (!nom || existants.has(nom.toLowerCase())) continue;
        existants.add(nom.toLowerCase());
        ajoutes.push({ id: idCourt(), nom });
      }
      c.eleves = [...(c.eleves || []), ...ajoutes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      return { classe: c, ajoutes: ajoutes.length };
    }));
    // Liste des élèves exportée de Pronote (ou d'un tableur) en CSV : on retrouve les noms, l'enseignant choisit ensuite qui ajouter.
    gerer('prof:eleves-csv', async (id) => {
      classeGeree(id, { ecriture: true });
      const choix = await pendantDialogue(() => dialog.showOpenDialog(obtenirFenetre(), {
        title: 'Choisir la liste des élèves exportée de Pronote', buttonLabel: 'Choisir', properties: ['openFile'],
        filters: [{ name: 'Liste d’élèves (CSV)', extensions: ['csv', 'txt'] }],
      }));
      if (choix.canceled || !choix.filePaths.length) return { annule: true };
      const octets = fs.readFileSync(choix.filePaths[0]);
      if (octets.length > 2 * 1024 * 1024) throw new Error('Fichier trop lourd pour une liste d’élèves.');
      return { ...require('./liste-eleves').nomsDuCsv(octets), fichier: path.basename(choix.filePaths[0]) };
    });
    gerer('prof:eleve-supprimer', (id, eleveId) => modifierClasse(id, (c) => { c.eleves = (c.eleves || []).filter((e) => e.id !== eleveId); return { classe: c }; }));

    // ----- Contenu : thèmes (dossiers), outils, Digipads, documents -----
    gerer('prof:ajouter-dossier', (id, parentId, nom, { icone, couleur } = {}) => modifierClasse(id, (c) => {
      pousser(c, parentId, { id: idCourt(), type: 'dossier', nom: nomPropre(nom), icone: iconeValide(icone), couleur: couleurValide(couleur), enfants: [] });
      return { classe: c };
    }));
    gerer('prof:style-dossier', (id, elementId, { icone, couleur } = {}) => modifierClasse(id, (c) => {
      const r = trouver(c.contenu || [], elementId);
      if (!r || r.noeud.type !== 'dossier') throw new Error('Thème introuvable.');
      if (icone !== undefined) r.noeud.icone = iconeValide(icone);
      if (couleur !== undefined) r.noeud.couleur = couleurValide(couleur);
      return { classe: c };
    }));
    gerer('prof:ajouter-outils', (id, parentId, outils) => modifierClasse(id, (c) => {
      const presents = new Set(elementsVisibles(c, cible(c, parentId)).filter((n) => n.type === 'outil').map((n) => n.outil));
      let ajoutes = 0;
      for (const o of (Array.isArray(outils) ? outils : []).filter(outilValide)) {
        if (presents.has(o)) continue;
        presents.add(o);
        pousser(c, parentId, noeudOutil(o));
        ajoutes++;
      }
      return { classe: c, ajoutes };
    }));
    // Thèmes proposés pour la matière, copiés dans la classe pour que l'enseignant les modifie.
    // matiere : pour une classe à plusieurs matières, les thèmes de cette matière seulement.
    gerer('prof:themes-defaut', (id, themes, matiere = null) => modifierClasse(id, (c) => {
      c.contenu = c.contenu || [];
      const m = matiere ? matiereValide(matiere) : null;
      if (matiere && (!m || !c.matieres.includes(m))) throw new Error('Cette matière n\'est pas dans la classe.');
      if (c.contenu.some((n) => n.type === 'dossier' && (!m || matiereNoeud(c, n) === m))) throw new Error(m ? 'Cette matière a déjà des thèmes.' : 'Cette classe a déjà des thèmes.');
      const nouveaux = (Array.isArray(themes) ? themes : []).slice(0, 20).map((t) => ({
        id: idCourt(), type: 'dossier', nom: nomPropre(t && t.nom), icone: iconeValide(t.icone), couleur: couleurValide(t.couleur),
        ...(m ? { matiere: m } : {}),
        enfants: (Array.isArray(t.outils) ? t.outils : []).filter(outilValide).map(noeudOutil),
      }));
      c.contenu = [...nouveaux, ...c.contenu];
      return { classe: c };
    }));
    gerer('prof:ajouter-pad', (id, parentId, { nom, lien } = {}) => modifierClasse(id, (c) => {
      if (!urlPadValide(lien)) throw new Error('Le lien doit commencer par https:// (copie le lien de ton pad).');
      pousser(c, parentId, { id: idCourt(), type: 'pad', nom: nomPropre(nom), lien: String(lien).trim() });
      return { classe: c };
    }));
    gerer('prof:ajouter-documents', async (id, parentId) => {
      classeGeree(id, { ecriture: true });
      const choix = await pendantDialogue(() => dialog.showOpenDialog(obtenirFenetre(), {
        title: 'Ajouter des documents pour la classe', buttonLabel: 'Ajouter', properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'xlsx', 'xls', 'ods', 'csv', 'txt', 'py', 'png', 'jpg', 'jpeg', 'gif', 'webp'] }, { name: 'Tous les fichiers', extensions: ['*'] }],
      }));
      if (choix.canceled) return { classe: lireClasse(id), ajoutes: 0 };
      return modifierClasse(id, (c) => {
        cible(c, parentId); // vérifie la destination avant de copier
        const dossier = path.join(dossierClasse(id), 'fichiers');
        fs.mkdirSync(dossier, { recursive: true });
        for (const src of choix.filePaths) {
          const elementId = idCourt();
          const nom = nomFichierSur(path.basename(src));
          const relatif = path.join('fichiers', `${elementId}-${nom}`);
          fs.copyFileSync(src, path.join(dossierClasse(id), relatif));
          pousser(c, parentId, { id: elementId, type: 'document', nom, fichier: relatif, taille: fs.statSync(src).size, ajoute: new Date().toISOString() });
        }
        return { classe: c, ajoutes: choix.filePaths.length };
      });
    });
    // ----- Copies des élèves : consulter et ouvrir -----
    const classeDuProf = classeGeree;
    gerer('prof:copies-lister', (id) => {
      const c = classeDuProf(id);
      const base = path.join(dossierClasse(id), DOSSIER_COPIES);
      const lireDossier = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
      const dossiers = lireDossier(base).filter((e) => e.isDirectory()).map((e) => e.name);
      const noms = [...new Set([...(c.eleves || []).map((e) => nomFichierSur(e.nom)), ...dossiers])].sort((a, b) => a.localeCompare(b, 'fr'));
      return { eleves: noms.map((nom) => ({
        nom,
        inscrit: (c.eleves || []).some((e) => nomFichierSur(e.nom) === nom),
        fichiers: lireDossier(path.join(base, nom)).filter((e) => e.isFile()).map((e) => {
          const st = fs.statSync(path.join(base, nom, e.name));
          return { nom: e.name, taille: st.size, date: st.mtime.toISOString() };
        }).sort((a, b) => b.date.localeCompare(a.date)),
      })) };
    });
    gerer('prof:copies-ouvrir', (id, eleve = null, fichier = null) => {
      classeDuProf(id);
      const base = path.join(dossierClasse(id), DOSSIER_COPIES);
      const cible = path.join(base, ...(eleve ? [nomFichierSur(eleve)] : []), ...(fichier ? [nomFichierSur(fichier)] : []));
      if (cible !== base && !cible.startsWith(base + path.sep)) throw new Error('Chemin refusé.');
      fs.mkdirSync(fichier ? path.dirname(cible) : cible, { recursive: true });
      ouvrirChemin(cible);
      return {};
    });

    // ----- Travail à rendre : côté enseignant -----
    gerer('prof:travail-creer', async (id, parentId) => {
      classeGeree(id, { ecriture: true });
      const choix = await pendantDialogue(() => dialog.showOpenDialog(obtenirFenetre(), {
        title: 'Choisir le PDF du travail à rendre', buttonLabel: 'Choisir', properties: ['openFile'],
        filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
      }));
      if (choix.canceled || !choix.filePaths.length) return { classe: lireClasse(id), travail: null };
      const src = choix.filePaths[0];
      if (fs.readFileSync(src).subarray(0, 5).toString() !== '%PDF-') throw new Error('Ce fichier n\'est pas un PDF.');
      let travail = null;
      const r = modifierClasse(id, (c) => {
        const dossier = path.join(dossierClasse(id), 'fichiers');
        fs.mkdirSync(dossier, { recursive: true });
        const elementId = idCourt();
        const nom = nomFichierSur(path.basename(src));
        const relatif = path.join('fichiers', `${elementId}-${nom}`);
        fs.copyFileSync(src, path.join(dossierClasse(id), relatif));
        travail = { id: elementId, type: 'travail', nom: nom.replace(/\.pdf$/i, ''), fichier: relatif, taille: fs.statSync(src).size, champs: [], ajoute: new Date().toISOString() };
        pousser(c, parentId, travail);
        return { classe: c };
      });
      return { ...r, travail };
    });
    const travailDuProf = (id, travailId) => {
      const c = classeGeree(id);
      const r = trouver(c.contenu || [], travailId);
      if (!r || r.noeud.type !== 'travail') throw new Error('Travail introuvable.');
      return { c, n: r.noeud };
    };
    gerer('prof:travail-lire', (id, travailId) => {
      const { c, n } = travailDuProf(id, travailId);
      const source = path.join(dossierClasse(id), n.fichier);
      if (!source.startsWith(dossierClasse(id) + path.sep) || !fs.existsSync(source)) throw new Error('Le PDF n\'est plus dans le dossier partagé.');
      return { travail: { id: n.id, nom: n.nom, champs: n.champs || [], questions: n.questions || [] }, classe: { id: c.id, nom: c.nom }, octets: new Uint8Array(fs.readFileSync(source)) };
    });
    gerer('prof:travail-champs', (id, travailId, champs) => modifierClasse(id, (c) => {
      const r = trouver(c.contenu || [], travailId);
      if (!r || r.noeud.type !== 'travail') throw new Error('Travail introuvable.');
      r.noeud.champs = champsValides(champs);
      return { champs: r.noeud.champs };
    }));
    // Questions placées sur le PDF (même format que l'évaluation « exercice » : zone, zone de réponse, type de réponse).
    gerer('prof:travail-questions', (id, travailId, questions) => modifierClasse(id, (c) => {
      const r = trouver(c.contenu || [], travailId);
      if (!r || r.noeud.type !== 'travail') throw new Error('Travail introuvable.');
      r.noeud.questions = require('./evaluations').zonesValides(questions);
      return { questions: r.noeud.questions };
    }));
    // Copies de tous les élèves de la classe (élèves sans copie : « pas commencé »).
    gerer('prof:travail-copies', (id, travailId) => {
      const { c } = travailDuProf(id, travailId);
      return { copies: (c.eleves || []).map((e) => {
        const copie = lireJson(fichierCopie(id, travailId, e.id), null);
        const retour = lireJson(fichierRetour(id, travailId, e.id), null);
        return { eleveId: e.id, nom: e.nom, retour, copie: copie ? { valeurs: copie.valeurs || {}, historique: copie.historique || [], maj: copie.maj || null, rendu: copie.rendu || null, poste: copie.poste || '' } : null };
      }) };
    });
    // L'enseignant permet à un élève de modifier de nouveau un travail rendu.
    // Remarques par question ; « rouvrir » : l'élève peut de nouveau modifier son travail, puis le rendre.
    gerer('prof:travail-retour', (id, travailId, eleveId, retour, rouvrir) => {
      const { c: cl } = travailDuProf(id, travailId);
      if (estArchivee(cl)) throw new Error(REFUS_ARCHIVE(cl));
      if (!ID.test(String(eleveId)) || !(cl.eleves || []).some((e) => e.id === eleveId)) throw new Error('Élève inconnu.');
      const r = { ...retourValide(retour), statut: rouvrir ? 'a-retravailler' : 'valide', date: new Date().toISOString() };
      const f = fichierRetour(id, travailId, String(eleveId));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      ecrireJson(f, r);
      if (rouvrir) {
        const fc = fichierCopie(id, travailId, String(eleveId));
        const copie = lireJson(fc, null);
        if (copie && copie.rendu) {
          copie.historique = [...(copie.historique || []), { t: new Date().toISOString(), c: '', a: '', n: '', e: 'rouvert' }];
          ecrireJson(fc, { ...copie, rendu: null, maj: new Date().toISOString() });
        }
      }
      return { retour: r };
    });
    gerer('prof:travail-rouvrir', (id, travailId, eleveId) => {
      const { c: cl } = travailDuProf(id, travailId);
      if (estArchivee(cl)) throw new Error(REFUS_ARCHIVE(cl));
      if (!ID.test(String(eleveId))) throw new Error('Élève inconnu.');
      const f = fichierCopie(id, travailId, String(eleveId));
      const copie = lireJson(f, null);
      if (!copie) throw new Error('Pas de copie pour cet élève.');
      copie.historique = [...(copie.historique || []), { t: new Date().toISOString(), c: '', a: '', n: '', e: 'rouvert' }];
      ecrireJson(f, { ...copie, rendu: null, maj: new Date().toISOString() });
      return {};
    });

    gerer('prof:renommer', (id, elementId, nom) => modifierClasse(id, (c) => {
      const r = trouver(c.contenu || [], elementId);
      if (!r) throw new Error('Élément introuvable.');
      if (r.noeud.type === 'outil') throw new Error('Un outil garde son nom.');
      let nouveau = nomPropre(nom);
      // Un document garde son extension, pour que l'élève puisse toujours l'ouvrir.
      if (r.noeud.type === 'document') { const ext = path.extname(r.noeud.nom); if (ext && !nouveau.toLowerCase().endsWith(ext.toLowerCase())) nouveau += ext; nouveau = nomFichierSur(nouveau); }
      r.noeud.nom = nouveau;
      return { classe: c };
    }));
    gerer('prof:supprimer', (id, elementId) => modifierClasse(id, (c) => {
      const r = trouver(c.contenu || [], elementId);
      if (!r) throw new Error('Élément introuvable.');
      r.liste.splice(r.liste.indexOf(r.noeud), 1);
      for (const f of r.noeud.type === 'dossier' ? tousLesFichiers(r.noeud.enfants || []) : r.noeud.type === 'document' || r.noeud.type === 'travail' ? [r.noeud.fichier] : []) {
        const chemin = path.join(dossierClasse(id), f);
        if (chemin.startsWith(dossierClasse(id) + path.sep)) fs.rmSync(chemin, { force: true });
      }
      return { classe: c };
    }));
    gerer('prof:deplacer', (id, elementId, cibleId) => modifierClasse(id, (c) => {
      const r = trouver(c.contenu || [], elementId);
      if (!r) throw new Error('Élément introuvable.');
      if (cibleId && (cibleId === elementId || (r.noeud.type === 'dossier' && trouver(r.noeud.enfants || [], cibleId)))) throw new Error('Impossible de déplacer un dossier dans lui-même.');
      cible(c, cibleId || null); // vérifie la destination avant de retirer l'élément
      r.liste.splice(r.liste.indexOf(r.noeud), 1);
      pousser(c, cibleId || null, r.noeud);
      return { classe: c };
    }));
    gerer('prof:ordonner', (id, elementId, sens) => modifierClasse(id, (c) => {
      const r = trouver(c.contenu || [], elementId);
      if (!r) throw new Error('Élément introuvable.');
      // À la racine d'une classe à plusieurs matières : on échange avec le voisin de la même matière.
      const memeMatiere = r.liste !== c.contenu ? () => true : (n) => matiereNoeud(c, n) === matiereNoeud(c, r.noeud);
      const pas = sens < 0 ? -1 : 1, i = r.liste.indexOf(r.noeud);
      let j = i + pas;
      while (j >= 0 && j < r.liste.length && !memeMatiere(r.liste[j])) j += pas;
      if (j >= 0 && j < r.liste.length) [r.liste[i], r.liste[j]] = [r.liste[j], r.liste[i]];
      return { classe: c };
    }));
  }

  // Adresses des pads de toutes les classes (autorisés dans l'application, même en mode classe).
  function hotesPadsClasses() {
    const hotes = new Set();
    const parcourir = (noeuds) => noeuds.forEach((n) => { if (n.type === 'pad') { try { hotes.add(new URL(n.lien).hostname); } catch { /* ignoré */ } } else if (n.type === 'dossier') parcourir(n.enfants || []); });
    for (const c of listerClasses()) parcourir(c.contenu || []);
    return hotes;
  }

  return {
    enregistrerIPC, hotesPadsClasses, racine, verifierMotDePasse, copierPourLeProf, infoEnvoiProf, lireClasse, listerClasses, oublierIdentite, oublierInscription, activer, examenEleve,
    eleve: () => eleveActuel,
    modifierClasse,
    estProfDeverrouille: () => !!profConnecte,
    profConnecte: () => profConnecte,
    focusClasse: (id) => { const c = classeDeLEleve(id) || {}; return c.modeFocus !== false && !estArchivee(c); }, // activé par défaut, et sans réseau
    rechercheClasse: (id) => { const c = classeDeLEleve(id) || {}; return c.rechercheInternet === true && !estArchivee(c); }, // désactivée par défaut
    urlPronote: () => lireEtablissement().pronote || null,
  };
}

module.exports = { creerEspaceClasses, MATIERES, normaliserClasse };
