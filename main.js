// Processus principal de Labo Élève (Electron).
// - sert l'interface et les outils via le protocole interne app://local/
// - gère l'installation / mise à jour / suppression des outils

const { app, BrowserWindow, protocol, ipcMain, dialog, shell, Menu, net, webFrameMain, session, globalShortcut, clipboard, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, spawn } = require('child_process');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { creerModeClasse } = require('./mode-classe');
const { creerEspaceClasses } = require('./espace-classes');
const { creerNuage, analyserLien } = require('./nuage');
const { creerTrousseau } = require('./chiffrement');
const { creerSuivi } = require('./suivi');
const { creerOffice } = require('./office');
const { creerEvaluations } = require('./evaluations');
const { dossierSigne, verifier, empreinteFichier } = require('./signature');

// Clé publique du développeur : vérifie les outils et les mises à jour reçus par le dossier partagé.
const CLE_PUBLIQUE = (() => { try { return fs.readFileSync(path.join(__dirname, 'signature-publique.pem'), 'utf8'); } catch { return null; } })();
// Outils « sans code » : Digipad (pad-…) et outils créés dans Labo Prof (cree-…). Ils n'ont pas besoin de signature :
// l'application ne sert de leur dossier que l'icône (et, pour un outil créé, une page qu'elle génère elle-même).
const estRestreint = (m) => !!m && ((m.creeParProf === true && /^cree-/.test(m.id)) || (typeof m.pad === 'string' && /^pad-/.test(m.id)));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Deux applications construites à partir du même code :
// - « Labo Élève » pour les PC des élèves (pas d'espace professeur) ;
// - « Labo Prof » pour le PC de l'enseignant (classes, suivi en direct, examens), avec ses propres données.
const EDITION = (process.argv.includes('--prof') || process.env.LABO_EDITION === 'prof' || require('./package.json').edition === 'prof') ? 'prof' : 'eleve';
const NOM_APPLI = EDITION === 'prof' ? 'Labo Prof' : 'Labo Élève';
// Même identifiant que les raccourcis créés par l'installeur : Windows regroupe ainsi la fenêtre
// avec l'icône épinglée dans la barre des tâches (bonne icône, bon nom, relance de la bonne appli).
// Version de TEST (kit enseignant : npm run test-prof / test-eleve) : données à part (« Labo Prof (test) »),
// à côté de l'application installée, sans proposition de mise à jour.
const MODE_TEST = process.argv.includes('--test') || process.env.LABO_TEST === '1';
if (process.platform === 'win32') app.setAppUserModelId((EDITION === 'prof' ? 'fr.ecole.labo-prof' : 'fr.ecole.labo-eleve') + (MODE_TEST ? '.test' : ''));
if (MODE_TEST) app.setPath('userData', path.join(app.getPath('appData'), `${NOM_APPLI} (test)`));
if (EDITION === 'prof' && MODE_TEST) app.setName('Labo Prof');
else if (EDITION === 'prof') {
  app.setName('Labo Prof');
  // Première ouverture de Labo Prof : on reprend le dossier partagé déjà choisi dans Labo Élève.
  try {
    const config = path.join(app.getPath('userData'), 'config.json');
    const ancienne = path.join(app.getPath('appData'), 'Labo Élève', 'config.json');
    if (!fs.existsSync(config) && fs.existsSync(ancienne)) {
      fs.mkdirSync(path.dirname(config), { recursive: true });
      fs.copyFileSync(ancienne, config);
    }
  } catch { /* on demandera le dossier partagé */ }
}

const ID_VALIDE = /^[a-z0-9][a-z0-9-]*$/;
const DOSSIER_APP = __dirname;
const OUTILS_INTEGRES = path.join(DOSSIER_APP, 'outils');
const outilsUtilisateur = () => path.join(app.getPath('userData'), 'outils');
const fichierConfig = () => path.join(app.getPath('userData'), 'config.json');

let fenetre = null;
let fichiersEnAttente = []; // fichiers .outil ouverts avant que la fenêtre soit prête
let espace = null; // classes et élèves (créé au démarrage)
let suivi = null; // suivi en direct (créé au démarrage)
const classe = creerModeClasse({
  app, ipcMain, obtenirFenetre: () => fenetre, obtenirEleve: () => espace && espace.eleve(),
  surEvenement: (ev) => suivi && suivi.ajouterEvenement(ev), // sorties et fermetures forcées -> professeur
});
const office = creerOffice({
  app, session, shell, obtenirFenetre: () => fenetre, gererTelechargement: (e, item) => gererTelechargement(e, item), classe,
  obtenirUrlPronote: () => espace && espace.urlPronote(), // réglée par le professeur, pour tout l'établissement
  rechercheAutorisee: () => rechercheAutorisee(),
});

// Recherche internet : autorisée par le professeur pour la classe de l'élève (désactivée par défaut),
// jamais pendant un examen ni en mode classe. Toujours autorisée dans Labo Prof.
function rechercheAutorisee() {
  if (EDITION === 'prof') return true;
  if (classe.examenActif() || classe.estActif()) return false;
  const e = espace && espace.eleve();
  if (e) return espace.rechercheClasse(e.classeId);
  return true; // élève sans classe : aucun professeur ne la règle
}
let derniereRecherche = null;
function signalerRecherche() {
  const r = rechercheAutorisee();
  if (r === derniereRecherche) return;
  derniereRecherche = r;
  if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('recherche:etat', r);
}

// Mode focus : actif pour un élève identifié, si la classe de la matière choisie l'autorise (réglage de l'enseignant).
// Mode examen : lancé par un enseignant pour l'une des classes de l'élève ; l'élève bascule alors dans cette matière.
const majFocus = () => {
  if (EDITION !== 'eleve' || !espace) return signalerRecherche(); // jamais de focus ni d'examen sur le PC de l'enseignant
  const ex = espace.examenEleve();
  const avant = espace.eleve();
  if (ex && (!avant || avant.classeId !== ex.classeId)) {
    const active = espace.activer(ex.classeId);
    if (active && fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('classes:active', active);
  }
  const e = espace.eleve();
  classe.definirFocus(!!e && espace.focusClasse(e.classeId));
  classe.definirExamen(ex ? ex.examen : null);
  signalerRecherche();
};
// Le dossier partagé est relu toutes les 5 secondes : l'examen démarre et s'arrête vite sur tous les PC.
setInterval(() => { if (espace && espace.eleve()) majFocus(); }, 5000);

// Boîte de dialogue « Ouvrir » (ne compte pas comme une sortie en mode classe).
const ouvrirDialogue = (options) => classe.pendantDialogue(() => dialog.showOpenDialog(fenetre, options));

// ---------- Configuration ----------

function lireConfigBrute() {
  try {
    return JSON.parse(fs.readFileSync(fichierConfig(), 'utf8'));
  } catch {
    return { dossierMaj: null };
  }
}
// Dossier partagé sur Nuage (lien de partage) : toute l'application travaille dans la copie locale synchronisée.
let nuage = null;
let dernierCompteProf = null; // enseignant connecté sur ce PC (pour sa clé)
// Clés de chiffrement de ce PC (enseignant ou élève) : la clé privée est protégée par Windows (safeStorage)
let trousseau = null;
const obtenirTrousseau = () => trousseau || (trousseau = creerTrousseau({
  dossierDonnees: () => app.getPath('userData'), nomFichierSur,
  protection: safeStorage.isEncryptionAvailable() ? { chiffrer: (t) => safeStorage.encryptString(t).toString('base64'), dechiffrer: (t) => safeStorage.decryptString(Buffer.from(t, 'base64')) } : null,
}));
const obtenirNuage = () => nuage || (nuage = creerNuage({ dossierDonnees: () => app.getPath('userData'), journal: (m) => console.log(m), trousseau: obtenirTrousseau() }));
// Autres liens Nuage (élève : un lien par enseignant) : un moteur de synchronisation et une copie locale par lien
const nuagesSupp = new Map(); // jeton → moteur
const miroirDeLien = (lien) => { const a = analyserLien(lien); return a ? path.join(app.getPath('userData'), 'nuage', a.jeton) : null; };
const miroirNuage = (c) => (c && c.nuage ? miroirDeLien(c.nuage.lien) : null);
const liensSupp = (c) => { const p = c && c.nuage && analyserLien(c.nuage.lien); const vus = new Set(p ? [p.jeton] : []);
  return (Array.isArray(c && c.nuagesSupp) ? c.nuagesSupp : []).filter((x) => { const a = x && analyserLien(x.lien); if (!a || vus.has(a.jeton)) return false; vus.add(a.jeton); return true; }); };
function demarrerNuagesSupp() {
  const voulus = new Map(liensSupp(lireConfigBrute()).map((x) => [analyserLien(x.lien).jeton, x]));
  for (const [j, m] of nuagesSupp) if (!voulus.has(j)) { m.arreter(); nuagesSupp.delete(j); }
  for (const [j, x] of voulus) {
    if (nuagesSupp.has(j)) continue;
    const m = creerNuage({ dossierDonnees: () => app.getPath('userData'), journal: (t) => console.log(t), trousseau: obtenirTrousseau() });
    m.surChangement((e) => { if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('nuage:etat', { ...obtenirNuage().infos(), supp: [...nuagesSupp.values()].map((y) => y.infos()) }); });
    nuagesSupp.set(j, m); m.demarrer(x);
  }
}
const tousLesNuages = () => [...(nuage && nuage.infos().actif ? [nuage] : []), ...nuagesSupp.values()];
// publie la clé publique de l'enseignant ou de l'élève dans le dossier partagé (si Nuage est utilisé)
function publierCle(id) {
  try {
    const c = lireConfigBrute(), e = /^eleve:([^:]+):/.exec(id);
    const miroirs = [miroirNuage(c), ...liensSupp(c).map((x) => miroirDeLien(x.lien))].filter(Boolean);
    // la clé d'un élève va dans le dossier où se trouve sa classe ; celle de l'enseignant, dans son dossier
    const m = e ? miroirs.find((x) => fs.existsSync(path.join(x, 'Classes', e[1]))) : miroirs[0];
    if (m) { obtenirTrousseau().publier(m, id); tousLesNuages().forEach((n) => n.synchroniser()); }
  } catch (err) { console.log('clé : ' + err.message); }
}
function lireConfig() {
  const c = lireConfigBrute();
  const m = miroirNuage(c);
  const supp = liensSupp(c).map((x) => miroirDeLien(x.lien));
  supp.forEach((x) => { try { fs.mkdirSync(x, { recursive: true }); } catch { /* disque */ } });
  const plus = { dossiersSupp: supp, nuagesSupp: liensSupp(c).map((x) => ({ lien: analyserLien(x.lien).lien })) }; // les mots de passe ne sortent pas
  if (m) { try { fs.mkdirSync(m, { recursive: true }); } catch { /* disque */ } return { ...c, ...plus, dossierMaj: m, nuage: { lien: c.nuage.lien } }; }
  return { ...c, ...plus };
}

function ecrireConfig(config) {
  fs.mkdirSync(path.dirname(fichierConfig()), { recursive: true });
  fs.writeFileSync(fichierConfig(), JSON.stringify(config, null, 2));
}

// ---------- Outils ----------

function comparerVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function lireManifeste(dossier) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dossier, 'manifest.json'), 'utf8'));
    if (!m || typeof m.id !== 'string' || !ID_VALIDE.test(m.id) || !m.titre) return null;
    if (m.pad !== undefined && !urlPadValide(m.pad)) return null;
    m.entree = m.entree || 'index.html';
    m.version = String(m.version || '1.0.0');
    return m;
  } catch {
    return null;
  }
}

function scannerDossier(base, source) {
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dossier = path.join(base, d.name);
      const m = lireManifeste(dossier);
      return m && m.id === d.name ? { ...m, source, dossier } : null;
    })
    .filter(Boolean);
}

// Retourne une Map id -> outil (la version la plus récente l'emporte).
function outilsDisponibles() {
  const integres = scannerDossier(OUTILS_INTEGRES, 'integre');
  const ajoutes = scannerDossier(outilsUtilisateur(), 'utilisateur');
  const carte = new Map();
  for (const o of integres) carte.set(o.id, o);
  for (const o of ajoutes) {
    const existant = carte.get(o.id);
    if (!existant || comparerVersions(o.version, existant.version) >= 0) {
      carte.set(o.id, { ...o, remplaceIntegre: !!existant });
    }
  }
  return carte;
}

// Cherche les dossiers contenant un manifest.json (racine, ou jusqu'à 2 niveaux).
function trouverRacines(dossier, profondeur = 0) {
  if (fs.existsSync(path.join(dossier, 'manifest.json'))) return [dossier];
  if (profondeur >= 2) return [];
  return fs
    .readdirSync(dossier, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== '__MACOSX')
    .flatMap((d) => trouverRacines(path.join(dossier, d.name), profondeur + 1));
}

// options.partage : vient du dossier partagé (installation automatique) → signature exigée, sauf outil sans code.
// options.confirmer(m) : installation manuelle d'un outil non signé → demander à l'utilisateur.
function installerDepuisDossier(src, options = {}) {
  const m = lireManifeste(src);
  if (!m) throw new Error(`manifest.json absent ou invalide dans « ${path.basename(src)} »`);
  if (!m.pad && !fs.existsSync(path.join(src, m.entree))) {
    throw new Error(`Le fichier d'entrée « ${m.entree} » est introuvable pour « ${m.titre} »`);
  }
  const actuel = outilsDisponibles().get(m.id);
  const base = { id: m.id, titre: m.titre, version: m.version };
  if (actuel && comparerVersions(m.version, actuel.version) <= 0) {
    return { ...base, statut: 'deja-a-jour', versionActuelle: actuel.version };
  }
  if (!estRestreint(m) && !dossierSigne(CLE_PUBLIQUE, src, m)) {
    if (options.partage) return { ...base, statut: 'refuse', message: 'Outil non signé : il n\'est pas installé automatiquement sur les PC depuis le dossier partagé.' };
    if (!options.confirmer || !options.confirmer(m)) return { ...base, statut: 'annule' };
  }
  const dest = path.join(outilsUtilisateur(), m.id);
  fs.mkdirSync(outilsUtilisateur(), { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  return { ...base, statut: actuel ? 'mis-a-jour' : 'installe', ancienneVersion: actuel?.version };
}

// Installe un fichier .outil/.zip ou un dossier. Retourne une liste de résultats.
function installerChemin(chemin, options = {}) {
  const nom = path.basename(chemin);
  try {
    if (fs.statSync(chemin).isDirectory()) {
      const racines = trouverRacines(chemin);
      if (!racines.length) throw new Error('aucun manifest.json trouvé');
      return racines.map((r) => installerDepuisDossier(r, options));
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'labo-eleve-'));
    try {
      extraireZipSur(chemin, tmp); // refuse les chemins qui sortiraient du dossier
      const racines = trouverRacines(tmp);
      if (!racines.length) throw new Error('aucun manifest.json dans l\'archive');
      return racines.map((r) => installerDepuisDossier(r, options));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } catch (e) {
    return [{ titre: nom, statut: 'erreur', message: e.message }];
  }
}

function verifierDossierMaj() {
  const { dossierMaj } = lireConfig();
  if (!dossierMaj) return { resultats: [], message: 'Aucun dossier de mises à jour configuré.' };
  if (!fs.existsSync(dossierMaj)) {
    return { resultats: [], message: `Dossier de mises à jour introuvable : ${dossierMaj}` };
  }
  const entrees = fs.readdirSync(dossierMaj, { withFileTypes: true });
  const resultats = [];
  for (const e of entrees) {
    const chemin = path.join(dossierMaj, e.name);
    if (e.isDirectory() && (e.name === 'Classes' || e.name === 'Labos' || e.name === DOSSIER_MAJ_APPLI)) continue; // classes, labos, mises à jour de l'application
    if (e.isDirectory() && e.name.startsWith('.')) continue; // outil en cours de création
    if (e.isDirectory() || /\.(outil|zip)$/i.test(e.name)) resultats.push(...installerChemin(chemin, { partage: true }));
  }
  // Outil créé par l'enseignant puis supprimé du dossier partagé : on le retire aussi de ce PC.
  for (const o of scannerDossier(outilsUtilisateur(), 'utilisateur')) {
    if (!o.creeParProf || fs.existsSync(path.join(dossierMaj, o.id))) continue;
    fs.rmSync(o.dossier, { recursive: true, force: true });
    resultats.push({ id: o.id, titre: o.titre, statut: 'retire' });
  }
  return { resultats: EDITION === 'prof' ? resultats : resultats.filter((r) => r.statut !== 'refuse') };
}

// ---------- Mises à jour de l'application (dossier partagé › « Mise à jour de l'application ») ----------
// Le développeur publie les installeurs avec « npm run publier » : version.json (version, fichiers, empreintes SHA-256)
// et version.sig (signature). L'application ne propose que des mises à jour signées, plus récentes que la sienne.
const DOSSIER_MAJ_APPLI = 'Mise à jour de l\'application';
const VERSION_APPLI = String(require('./package.json').version || '0.0.0'); // version de Labo Élève / Labo Prof (pas celle d'Electron)
function majApplication() {
  if (MODE_TEST) return { disponible: false, version: VERSION_APPLI, probleme: 'Version de test : pas de mise à jour automatique.' };
  const { dossierMaj } = lireConfig();
  if (!dossierMaj) return { disponible: false, version: VERSION_APPLI };
  const dossier = path.join(dossierMaj, DOSSIER_MAJ_APPLI);
  try {
    const texte = fs.readFileSync(path.join(dossier, 'version.json'), 'utf8');
    if (!verifier(CLE_PUBLIQUE, texte, fs.readFileSync(path.join(dossier, 'version.sig'), 'utf8'))) return { disponible: false, version: VERSION_APPLI, probleme: 'Mise à jour ignorée : signature invalide.' };
    const info = JSON.parse(texte);
    const fiche = info && info[EDITION];
    if (!fiche || typeof info.version !== 'string' || !/^[\w .-]+\.exe$/i.test(fiche.fichier || '') || !/^[0-9a-f]{64}$/.test(fiche.sha256 || '')) return { disponible: false, version: VERSION_APPLI };
    if (comparerVersions(info.version, VERSION_APPLI) <= 0) return { disponible: false, version: VERSION_APPLI };
    return { disponible: true, version: VERSION_APPLI, nouvelle: info.version, notes: texteCourt(info.notes, 400), fichier: path.join(dossier, fiche.fichier), sha256: fiche.sha256 };
  } catch { return { disponible: false, version: VERSION_APPLI }; }
}
async function installerMajApplication() {
  const maj = majApplication();
  if (!maj.disponible) return { ok: false, message: maj.probleme || 'Aucune mise à jour disponible.' };
  if (classe.examenActif()) return { ok: false, message: 'Impossible pendant un examen.' };
  if (classe.estActif() || classe.focusActif()) return { ok: false, message: 'Impossible pendant la séance (mode classe ou focus) : réessaie après.' };
  // Copie locale, puis vérification de l'empreinte sur la copie (le fichier partagé pourrait changer entre-temps)
  const copie = path.join(os.tmpdir(), `labo-maj-${EDITION}-${maj.nouvelle.replace(/[^\w.-]/g, '')}.exe`);
  await fs.promises.copyFile(maj.fichier, copie);
  if (empreinteFichier(copie) !== maj.sha256) { fs.rmSync(copie, { force: true }); return { ok: false, message: 'Le fichier de mise à jour est abîmé ou a été modifié : installation refusée.' }; }
  // Installation silencieuse ; Windows demande l'autorisation (fenêtre « Oui / Non »), puis l'application redémarre.
  const r = await new Promise((resoudre) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Start-Process -FilePath '${copie.replace(/'/g, "''")}' -ArgumentList '/S','--force-run' -Verb RunAs`], { windowsHide: true });
    p.on('exit', (code) => resoudre(code));
    p.on('error', () => resoudre(-1));
  });
  if (r !== 0) return { ok: false, message: 'Installation annulée (autorisation de Windows refusée).' };
  setTimeout(() => { classe.autoriserFermeture(); app.quit(); }, 1500);
  return { ok: true };
}

function notifierChangement(rapport) {
  if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('outils:change', rapport);
}

function fichiersDansArguments(argv) {
  return argv.filter((a) => /\.(outil|zip)$/i.test(a) && fs.existsSync(a));
}

const confirmerNonSigne = (m) => dialog.showMessageBoxSync(fenetre && !fenetre.isDestroyed() ? fenetre : undefined, {
  type: 'warning', buttons: ['Ne pas installer', 'Installer quand même'], defaultId: 0, cancelId: 0, noLink: true,
  title: 'Outil non signé', message: `« ${m.titre} » n'est pas signé par le créateur de Labo Élève.`,
  detail: 'Un outil peut lire et modifier tes documents. N\'installe que des outils dont tu connais l\'origine (ton professeur, par exemple).',
}) === 1;

function installerFichiersOuverts(fichiers) {
  if (!fichiers.length) return;
  const resultats = fichiers.flatMap((c) => installerChemin(c, { confirmer: confirmerNonSigne }));
  notifierChangement({ resultats });
}

// ---------- Calculatrice NumWorks (copie personnelle de l'élève) ----------
// L'émulateur n'est pas fourni avec l'application : chaque élève le télécharge
// lui-même sur le site officiel. L'application le cherche sur le PC et l'affiche
// seulement s'il est présent.

const dossierExternes = () => path.join(app.getPath('userData'), 'externes');

// ---------- Ressources des labos (liens et simulateurs ajoutés par l'enseignant) ----------
const dossierLabosLocal = (labo) => path.join(app.getPath('userData'), 'labos', labo);
const dossierLabosPartage = (labo) => { const d = lireConfig().dossierMaj; return d ? path.join(d, 'Labos', labo) : null; };
// ressources.json : { ressources: [liens, simulateurs], experiences: [expériences du professeur], masques: [id des manipulations fournies masquées] }.
// Ancien format (avant les expériences) : un simple tableau de ressources, toujours accepté en lecture.
const contenuLabo = (r) => {
  if (Array.isArray(r)) return { ressources: r, experiences: [], masques: [] };
  const tableau = (t) => (Array.isArray(t) ? t : []);
  return { ressources: tableau(r && r.ressources), experiences: tableau(r && r.experiences), masques: tableau(r && r.masques).filter((x) => typeof x === 'string') };
};
const lireRessources = (dossier) => { try { return contenuLabo(JSON.parse(fs.readFileSync(path.join(dossier, 'ressources.json'), 'utf8'))); } catch { return contenuLabo([]); } };
// Éléments qui ont un simulateur installé (dossier simulateurs/<id>) : ressources « simulateur » et expériences « simulateur ».
const avecSimulateur = (c) => [...c.ressources.filter((x) => x.type === 'simulateur'), ...c.experiences.filter((x) => x.contenu === 'simulateur')].filter((x) => ID_VALIDE.test(String(x.id)));
// Copie sur ce PC la liste et les simulateurs du dossier partagé (s'il est accessible).
function synchroniserLabo(labo) {
  const partage = dossierLabosPartage(labo), local = dossierLabosLocal(labo);
  if (!partage || !fs.existsSync(partage)) return lireRessources(local);
  const contenu = lireRessources(partage);
  try {
    fs.mkdirSync(path.join(local, 'simulateurs'), { recursive: true });
    const simulateurs = avecSimulateur(contenu);
    for (const r of simulateurs) {
      const src = path.join(partage, 'simulateurs', r.id), dest = path.join(local, 'simulateurs', r.id);
      const marque = path.join(dest, '.labo-version');
      const attendue = String(r.fichier || r.ajoute); // « fichier » : date du dernier fichier choisi (expérience modifiée)
      let version = ''; try { version = fs.readFileSync(marque, 'utf8'); } catch { /* pas encore copié */ }
      if (version !== attendue && fs.existsSync(src)) {
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(src, dest, { recursive: true });
        fs.writeFileSync(marque, attendue);
      }
    }
    // simulateurs retirés par l'enseignant
    const gardes = new Set(simulateurs.map((x) => x.id));
    for (const d of fs.readdirSync(path.join(local, 'simulateurs'))) if (!gardes.has(d)) fs.rmSync(path.join(local, 'simulateurs', d), { recursive: true, force: true });
    fs.writeFileSync(path.join(local, 'ressources.json'), JSON.stringify(contenu, null, 2));
  } catch { /* copie incomplète : on réessaiera */ }
  cacheIntegrations.t = 0;
  return contenu;
}
const peutGererLabos = () => EDITION === 'prof' && !!espace && espace.estProfDeverrouille();
function modifierRessources(labo, transformation) {
  if (!peutGererLabos()) throw new Error('Réservé à l\'enseignant connecté dans Labo Prof.');
  const partage = dossierLabosPartage(labo);
  if (!partage) throw new Error('Choisis d\'abord le dossier partagé du lycée (Réglages).');
  fs.mkdirSync(partage, { recursive: true });
  const contenu = lireRessources(partage);
  const r = transformation(contenu.ressources, partage, contenu);
  fs.writeFileSync(path.join(partage, 'ressources.json'), JSON.stringify(contenu, null, 2));
  synchroniserLabo(labo);
  return r;
}
// Lien d'intégration : une adresse https, ou un code <iframe …> collé (GeoGebra, PhET, LearningApps…) dont on garde le src.
function adresseIntegration(texte) {
  let t = String(texte || '').trim();
  const iframe = /<iframe\b[^>]*?\ssrc\s*=\s*(["'])(.*?)\1/is.exec(t) || /<iframe\b[^>]*?\ssrc\s*=\s*([^\s>]+)/is.exec(t);
  if (iframe) t = (iframe[2] ?? iframe[1]).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  else if (/</.test(t)) throw new Error('Code d\'intégration non reconnu : colle l\'adresse, ou le code <iframe …> donné par le site.');
  if (t.startsWith('//')) t = 'https:' + t;
  let u; try { u = new URL(t); } catch { throw new Error('Adresse d\'intégration invalide (elle doit commencer par https://).'); }
  if (u.protocol !== 'https:') throw new Error('Le lien d\'intégration doit être une adresse sécurisée (https://).');
  return u.href;
}
// Hôtes des liens d'intégration enregistrés dans les labos (copies sur ce PC) : seuls autorisés à s'afficher
// dans un labo malgré X-Frame-Options / frame-ancestors (comme les pads).
const cacheIntegrations = { t: 0, hotes: new Set() };
function hotesIntegrationsLabos() {
  if (Date.now() - cacheIntegrations.t > 2000) {
    const hotes = new Set();
    try {
      for (const labo of fs.readdirSync(path.join(app.getPath('userData'), 'labos'))) {
        if (!ID_VALIDE.test(labo)) continue;
        for (const x of lireRessources(dossierLabosLocal(labo)).experiences) {
          if (x.contenu !== 'integration') continue;
          try { const u = new URL(x.url); if (u.protocol === 'https:') hotes.add(u.hostname); } catch { /* ignoré */ }
        }
      }
    } catch { /* aucun labo copié */ }
    for (const o of outilsDisponibles().values()) { // outils créés par l'enseignant (lien d'intégration)
      if (!o.creeParProf || !o.integration) continue;
      try { const u = new URL(o.integration); if (u.protocol === 'https:') hotes.add(u.hostname); } catch { /* ignoré */ }
    }
    cacheIntegrations.t = Date.now(); cacheIntegrations.hotes = hotes;
  }
  return cacheIntegrations.hotes;
}
function estUrlIntegrationLabo(u) {
  try { const url = new URL(u); return url.protocol === 'https:' && hotesIntegrationsLabos().has(url.hostname); } catch { return false; }
}
const idRessource = () => crypto.randomBytes(4).toString('hex');
// Copie un simulateur (page HTML, ou archive .zip contenant une page) dans « dossier » ; renvoie la page d'entrée.
function installerSimulateur(src, dossier) {
  fs.mkdirSync(dossier, { recursive: true });
  let entree = 'index.html';
  if (/\.zip$/i.test(src)) {
    const zip = new AdmZip(src);
    for (const e of zip.getEntries()) { // pas de chemin qui sort du dossier
      const cible = path.normalize(path.join(dossier, e.entryName));
      if (!cible.startsWith(dossier + path.sep)) { fs.rmSync(dossier, { recursive: true, force: true }); throw new Error('Archive refusée (chemins invalides).'); }
    }
    zip.extractAllTo(dossier, true);
    const pages = [];
    const chercher = (d, prof) => { for (const x of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, x.name); if (x.isFile() && /\.html?$/i.test(x.name)) pages.push(path.relative(dossier, p)); else if (x.isDirectory() && prof < 2) chercher(p, prof + 1); } };
    chercher(dossier, 0);
    pages.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length || (/index\.html?$/i.test(b) - /index\.html?$/i.test(a)));
    if (!pages.length) { fs.rmSync(dossier, { recursive: true, force: true }); throw new Error('Aucune page HTML dans cette archive.'); }
    entree = pages.find((p) => /(^|[\\/])index\.html?$/i.test(p)) || pages[0];
  } else fs.copyFileSync(src, path.join(dossier, 'index.html'));
  return { entree: entree.split(path.sep).join('/'), source: path.basename(src) };
}
const texteCourt = (t, max) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------- GeoGebra déjà installé sur le PC ----------
// GeoGebra n'est pas fourni avec Labo Élève : on affiche, dans l'application, la version que l'élève
// a installée (GeoGebra Classic 6, Calculatrice GeoGebra…). Son moteur web est dans « resources/app/html ».
let cacheGeogebra = { t: 0, dossier: null, version: null };
function trouverGeogebra() {
  if (Date.now() - cacheGeogebra.t < 10_000) return cacheGeogebra;
  const candidats = [];
  const racines = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
  for (const r of racines) {
    let entrees = [];
    try { entrees = fs.readdirSync(r, { withFileTypes: true }); } catch { continue; }
    for (const e of entrees) {
      if (!e.isDirectory() || !/geogebra/i.test(e.name)) continue;
      const base = path.join(r, e.name);
      const dossiers = [base];
      try { for (const s of fs.readdirSync(base, { withFileTypes: true })) if (s.isDirectory() && /^app-\d/.test(s.name)) dossiers.push(path.join(base, s.name)); } catch { /* ignoré */ }
      for (const d of dossiers) {
        const html = path.join(d, 'resources', 'app', 'html');
        if (!fs.existsSync(path.join(html, 'web3d', 'web3d.nocache.js'))) continue;
        let version = (/app-([\d.]+)/.exec(d) || [])[1] || '';
        try { version = (/latestVersion\s*=\s*"([\d.]+)"/.exec(fs.readFileSync(path.join(html, 'classic.html'), 'utf8').slice(0, 4000)) || [])[1] || version; } catch { /* ignoré */ }
        candidats.push({ dossier: html, version });
      }
    }
  }
  const comparer = (a, b) => {
    const x = a.version.split('.').map(Number), y = b.version.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
    return 0;
  };
  candidats.sort((a, b) => comparer(b, a));
  cacheGeogebra = { t: Date.now(), dossier: null, version: null, ...(candidats[0] || {}) };
  return cacheGeogebra;
}
const dossierNumworks = () => path.join(dossierExternes(), 'numworks');
const NOM_NUMWORKS = /^(numworks.*emulator.*|calculator-graphing.*)\.(zip|html?)$/i;

function etatNumworks() {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(dossierNumworks(), 'info.json'), 'utf8'));
    if (fs.existsSync(path.join(dossierNumworks(), 'emulateur.html'))) return { installe: true, ...info };
  } catch { /* absent */ }
  return { installe: false };
}

function estEmulateurNumworks(html) {
  const debut = html.subarray(0, 4000).toString('utf8');
  return /<title>\s*NumWorks/i.test(debut) && /id="calculator"/.test(debut);
}

function lireEmulateur(fichier) {
  if (/\.html?$/i.test(fichier)) return fs.readFileSync(fichier);
  const zip = new AdmZip(fichier);
  const entree = zip.getEntries().find((e) => !e.isDirectory && /\.html?$/i.test(e.entryName));
  return entree ? entree.getData() : null;
}

function installerNumworks(fichier) {
  let html;
  try { html = lireEmulateur(fichier); } catch { html = null; }
  if (!html || !estEmulateurNumworks(html)) {
    return { ok: false, message: `« ${path.basename(fichier)} » n'est pas l'émulateur NumWorks.` };
  }
  const version = (/(\d+\.\d+\.\d+)/.exec(path.basename(fichier)) || [])[1] || null;
  fs.mkdirSync(dossierNumworks(), { recursive: true });
  fs.writeFileSync(path.join(dossierNumworks(), 'emulateur.html'), html);
  const info = { version, source: fichier, date: new Date().toISOString() };
  fs.writeFileSync(path.join(dossierNumworks(), 'info.json'), JSON.stringify(info, null, 2));
  return { ok: true, ...info };
}

// Cherche l'émulateur dans Téléchargements, Bureau et Documents (le plus récent l'emporte).
function chercherNumworks() {
  const dossiers = ['downloads', 'desktop', 'documents'].map((d) => { try { return app.getPath(d); } catch { return null; } });
  const candidats = [];
  for (const d of new Set(dossiers.filter(Boolean))) {
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isFile() && NOM_NUMWORKS.test(e.name)) {
          const chemin = path.join(d, e.name);
          candidats.push({ chemin, date: fs.statSync(chemin).mtimeMs });
        }
      }
    } catch { /* dossier inaccessible */ }
  }
  candidats.sort((a, b) => b.date - a.date);
  for (const c of candidats) {
    const r = installerNumworks(c.chemin);
    if (r.ok) return r;
  }
  return { ok: false, message: 'Émulateur introuvable dans Téléchargements, Bureau ou Documents.' };
}

// ---------- Logiciels installés sur le PC (Redy) ----------
// Ces logiciels ne peuvent pas s'afficher dans Labo Élève : l'application vérifie
// seulement s'ils sont installés et les lance. Seuls ceux de cette liste sont autorisés.

const LOGICIELS = {
  // Redy, logiciel gratuit de Jeulin pour les TP : il ne s'inscrit pas forcément dans « App Paths »,
  // on le cherche aussi dans les raccourcis du menu Démarrer et dans les dossiers d'installation.
  redy: [
    { nom: 'Redy', exe: 'Redy.exe', args: [], motif: /redy/i, dossiers: /^(jeulin|redy)/i, focus: true },
  ],
};

function cheminDansRegistre(exe) {
  for (const racine of ['HKCU', 'HKLM']) {
    try {
      const sortie = execFileSync('reg', ['query', `${racine}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`, '/ve'], {
        encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
      });
      const m = /REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/m.exec(sortie);
      if (m) {
        const chemin = m[1].replace(/^"|"$/g, '').replace(/%([^%]+)%/g, (_t, v) => process.env[v] || '');
        if (fs.existsSync(chemin)) return chemin;
      }
    } catch { /* clé absente */ }
  }
  return null;
}

// Raccourci du menu Démarrer dont le nom correspond (ex. « Redy.lnk ») → programme visé.
function cheminParRaccourci(motif) {
  const menus = [
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop'),
    path.join(os.homedir(), 'Desktop'),
  ];
  const parcourir = (dossier, profondeur) => {
    let entrees = [];
    try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); } catch { return null; }
    for (const e of entrees) {
      const p = path.join(dossier, e.name);
      if (e.isFile() && /\.lnk$/i.test(e.name) && motif.test(e.name) && !/d[ée]sinstall|uninstall/i.test(e.name)) {
        try { const cible = shell.readShortcutLink(p).target; if (/\.exe$/i.test(cible) && fs.existsSync(cible)) return cible; } catch { /* raccourci illisible */ }
      } else if (e.isDirectory() && profondeur > 0) {
        const r = parcourir(p, profondeur - 1);
        if (r) return r;
      }
    }
    return null;
  };
  for (const m of menus) { const r = parcourir(m, 2); if (r) return r; }
  return null;
}
// Dossier d'installation (Program Files\Jeulin\…) contenant un programme dont le nom correspond.
function cheminParDossier(dossiers, motif) {
  const bases = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean);
  const chercherExe = (dossier, profondeur) => {
    let entrees = [];
    try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); } catch { return null; }
    const exe = entrees.find((e) => e.isFile() && /\.exe$/i.test(e.name) && motif.test(e.name) && !/unins|setup|install|update/i.test(e.name));
    if (exe) return path.join(dossier, exe.name);
    if (profondeur > 0) for (const e of entrees) if (e.isDirectory()) { const r = chercherExe(path.join(dossier, e.name), profondeur - 1); if (r) return r; }
    return null;
  };
  for (const b of bases) {
    let entrees = [];
    try { entrees = fs.readdirSync(b, { withFileTypes: true }); } catch { continue; }
    for (const e of entrees) if (e.isDirectory() && dossiers.test(e.name)) { const r = chercherExe(path.join(b, e.name), 3); if (r) return r; }
  }
  return null;
}
const cacheLogiciels = new Map(); // la recherche dans les dossiers prend un peu de temps : gardée 30 s
function trouverLogiciel(id) {
  if (process.platform !== 'win32' || !LOGICIELS[id]) return { installe: false };
  const c = cacheLogiciels.get(id);
  if (c && Date.now() - c.t < 30_000 && (!c.r.chemin || fs.existsSync(c.r.chemin))) return c.r;
  let r = { installe: false };
  for (const l of LOGICIELS[id]) {
    const chemin = cheminDansRegistre(l.exe) || (l.motif && (cheminParRaccourci(l.motif) || cheminParDossier(l.dossiers, l.motif)));
    if (chemin) { r = { installe: true, nom: l.nom, chemin, args: l.args, focus: !!l.focus }; break; }
  }
  cacheLogiciels.set(id, { t: Date.now(), r });
  return r;
}

// ---------- Pads (Digipad…) et « Mes documents » ----------

const dossierDocuments = () => path.join(app.getPath('documents'), 'Labo Élève');
const EXT_PAR_TYPE = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.oasis.opendocument.text': '.odt',
  'application/vnd.oasis.opendocument.spreadsheet': '.ods',
  'text/csv': '.csv', 'text/plain': '.txt',
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
};
const EXT_DOCUMENT = /\.(pdf|docx?|xlsx?|odt|ods|odp|pptx?|csv|txt|py|png|jpe?g|gif|webp)$/i;

function urlPadValide(u) {
  try { const url = new URL(String(u)); return url.protocol === 'https:' && !!url.hostname; } catch { return false; }
}
let cacheHotes = { t: 0, hotes: new Set() };
function hotesPads() {
  if (Date.now() - cacheHotes.t > 2000) {
    const hotes = new Set([...outilsDisponibles().values()].filter((o) => o.pad).map((o) => new URL(o.pad).hostname));
    if (espace) for (const h of espace.hotesPadsClasses()) hotes.add(h);
    cacheHotes = { t: Date.now(), hotes };
  }
  return cacheHotes.hotes;
}
function estUrlDePad(u) {
  try { const url = new URL(u); return url.protocol === 'https:' && hotesPads().has(url.hostname); } catch { return false; }
}

// Un pad est-il affiché dans le cadre de l'outil ? (adresse mémorisée à chaque chargement du cadre)
let urlCadreOutil = '';
const padAffiche = () => estUrlDePad(urlCadreOutil);

// L'adresse désigne-t-elle un fichier (et non une page web) ? D'après l'extension,
// sinon d'après la réponse du serveur (type de contenu, pièce jointe).
async function estUnFichier(u) {
  try { if (EXT_DOCUMENT.test(new URL(u).pathname)) return true; } catch { return false; }
  try {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), 6000);
    const r = await net.fetch(u, { method: 'HEAD', signal: controleur.signal });
    clearTimeout(minuterie);
    const type = (r.headers.get('content-type') || '').toLowerCase();
    const disposition = (r.headers.get('content-disposition') || '').toLowerCase();
    return disposition.includes('attachment') || (!!type && !type.includes('text/html'));
  } catch { return false; }
}

function nomFichierSur(nom) {
  const propre = path.basename(String(nom)).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return propre && propre !== '.' && propre !== '..' ? propre.slice(0, 180) : 'document';
}
function cheminDocument(nom) {
  if (typeof nom !== 'string' || nom !== path.basename(nom)) return null;
  const chemin = path.join(dossierDocuments(), nom);
  return fs.existsSync(chemin) ? chemin : null;
}
// Chemin libre dans « Mes documents » : « fiche.pdf », sinon « fiche (2).pdf »…
function cheminLibre(nom) {
  const ext = path.extname(nom);
  const base = path.basename(nom, ext);
  let chemin = path.join(dossierDocuments(), nom);
  for (let i = 2; fs.existsSync(chemin); i++) chemin = path.join(dossierDocuments(), `${base} (${i})${ext}`);
  return chemin;
}
function listerDocuments() {
  try {
    return fs.readdirSync(dossierDocuments(), { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith('~$') && !e.name.startsWith('.'))
      .map((e) => {
        const st = fs.statSync(path.join(dossierDocuments(), e.name));
        return { nom: e.name, taille: st.size, date: st.mtime.toISOString(), ext: path.extname(e.name).slice(1).toLowerCase() };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch { return []; }
}

const ICONE_PAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="24" height="22" rx="3"/><rect x="8" y="9" width="7" height="6" rx="1" fill="#fff" fill-opacity=".9"/><rect x="17" y="9" width="7" height="10" rx="1"/><rect x="8" y="17" width="7" height="6" rx="1"/></svg>\n';
const NIVEAUX_VALIDES = ['cap1', 'cap2', '2pro', '1pro', 'tpro'];

function creerPad({ titre, lien, description, niveaux }) {
  titre = String(titre || '').trim();
  if (!titre) return { ok: false, message: 'Donne un titre à la carte.' };
  if (!urlPadValide(lien)) return { ok: false, message: 'Le lien doit commencer par https:// (copie le lien de ton pad).' };
  const slug = titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'pad';
  const id = `pad-${slug}-${crypto.randomBytes(2).toString('hex')}`;
  const manifeste = {
    id, titre,
    description: String(description || '').trim() || 'Les documents du professeur, à consulter et à télécharger.',
    matiere: 'documents',
    niveaux: (Array.isArray(niveaux) ? niveaux : []).filter((n) => NIVEAUX_VALIDES.includes(n)),
    version: '1.0.0',
    icone: 'icone.svg',
    couleur: '#0891b2',
    pad: String(lien).trim(),
    motsCles: ['digipad', 'documents', 'cours', 'pad'],
  };
  if (!manifeste.niveaux.length) delete manifeste.niveaux;
  const dossier = path.join(outilsUtilisateur(), id);
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, 'manifest.json'), JSON.stringify(manifeste, null, 2));
  fs.writeFileSync(path.join(dossier, 'icone.svg'), ICONE_PAD);
  return { ok: true, id, titre };
}

// ---------- Outils créés par l'enseignant (Labo Prof › Créer un outil) ----------
// Un outil créé est un dossier d'outil ordinaire (manifest.json, icône, index.html) rangé à la racine du
// dossier partagé : chaque PC élève l'installe comme une mise à jour. Le contenu fourni par l'enseignant
// (activité H5P, page HTML, dossier .zip) est dans « contenu/ » et s'affiche depuis app://contenus/<id>/,
// une origine séparée de l'application (il n'a pas accès à Labo Élève).
const TYPES_OUTIL_CREE = ['h5p', 'integration', 'page', 'lien'];
const MATIERES_OUTIL_CREE = ['maths', 'physique-chimie', 'bureautique', 'documents', 'exercices', 'internet', 'etablissement'];
const echapperHtml = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peutCreerOutils = () => EDITION === 'prof' && !!espace && espace.estProfDeverrouille();

function iconeEmoji(emoji, couleur) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${couleur}"/><text x="32" y="44" font-size="34" text-anchor="middle" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">${echapperHtml(emoji)}</text></svg>\n`;
}
// Extrait une archive en refusant tout chemin qui sortirait du dossier de destination.
function extraireZipSur(src, dossier) {
  const zip = new AdmZip(src);
  for (const e of zip.getEntries()) {
    const cible = path.normalize(path.join(dossier, e.entryName));
    if (!cible.startsWith(dossier + path.sep)) throw new Error('Archive refusée (chemins invalides).');
  }
  fs.mkdirSync(dossier, { recursive: true });
  zip.extractAllTo(dossier, true);
}
// Fichier .h5p (archive) : contenu + bibliothèques H5P nécessaires, lu hors ligne par h5p-standalone.
function installerH5P(src, contenu) {
  const dossier = path.join(contenu, 'h5p');
  try { extraireZipSur(src, dossier); } catch (e) { throw new Error(/refusée/.test(e.message) ? e.message : 'Ce fichier n\'est pas une activité H5P valide.'); }
  let h5p;
  try { h5p = JSON.parse(fs.readFileSync(path.join(dossier, 'h5p.json'), 'utf8')); } catch { throw new Error('Ce fichier n\'est pas une activité H5P (h5p.json absent).'); }
  if (!fs.existsSync(path.join(dossier, 'content', 'content.json'))) throw new Error('Activité H5P incomplète (content.json absent).');
  const manquantes = (h5p.preloadedDependencies || []).map((d) => `${d.machineName}-${d.majorVersion}.${d.minorVersion}`).filter((n) => !fs.existsSync(path.join(dossier, n)));
  if (manquantes.length) throw new Error(`Ce fichier H5P ne contient pas les bibliothèques nécessaires (${manquantes.slice(0, 3).join(', ')}). Télécharge-le avec « Réutiliser › Télécharger en .h5p » sur le site, ou exporte-le depuis Lumi.`);
  const page = [
    '<!doctype html>',
    '<html lang="fr"><head><meta charset="utf-8"><title>' + echapperHtml(h5p.title || 'Activité H5P') + '</title>',
    '<style>html,body{margin:0;background:#fff;font-family:system-ui,sans-serif}#h5p{max-width:1100px;margin:0 auto;padding:12px}</style>',
    '<script src="_lecteur/main.bundle.js"></script></head>',
    '<body><div id="h5p"></div>',
    '<script>',
    "new H5PStandalone.H5P(document.getElementById('h5p'), {",
    "  h5pJsonPath: 'h5p', frameJs: '_lecteur/frame.bundle.js', frameCss: '_lecteur/styles/h5p.css',",
    '  frame: false, copyright: false, export: false, icon: false, fullScreen: true,',
    '}).catch(function (e) {',
    "  var p = document.createElement('p'); p.style.cssText = 'padding:24px;font-size:16px';",
    "  p.textContent = 'Impossible d\\u2019afficher cette activité H5P : ' + String((e && e.message) || e);",
    "  document.body.innerHTML = ''; document.body.appendChild(p);",
    '});',
    '</script></body></html>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(contenu, 'lecteur-h5p.html'), page);
  return { entree: 'lecteur-h5p.html', source: path.basename(src) };
}
function pageOutilCree(m, cible) {
  const tete = '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><title>' + echapperHtml(m.titre) + '</title>\n'
    + '<style>html,body{margin:0;height:100%;background:#fff;font-family:system-ui,"Segoe UI",sans-serif}iframe{border:0;width:100%;height:100%;display:block}'
    + '.lien{max-width:560px;margin:12vh auto;text-align:center;padding:24px}.lien .ic{font-size:56px}.lien p{color:#475569;line-height:1.5}'
    + '.lien button{font:inherit;font-size:17px;font-weight:600;padding:12px 22px;border-radius:10px;border:0;background:' + m.couleur + ';color:#fff;cursor:pointer}</style></head><body>\n';
  if (m.typeCree === 'lien') {
    return tete + '<div class="lien"><div class="ic">🔗</div><h1>' + echapperHtml(m.titre) + '</h1>'
      + (m.description ? '<p>' + echapperHtml(m.description) + '</p>' : '')
      + '<p>Cette activité se fait sur le site <b>' + echapperHtml(new URL(m.lienSite).hostname) + '</b>.</p><button id="ouvrir">🔗 Ouvrir le site</button></div>\n'
      + '<script>document.getElementById("ouvrir").addEventListener("click", function () { if (window.parent.ouvrirLienLabo) window.parent.ouvrirLienLabo('
      + JSON.stringify(m.lienSite) + ', ' + JSON.stringify(m.titre) + ', ' + JSON.stringify(m.id) + '); });</script></body></html>\n';
  }
  return tete + '<iframe src="' + echapperHtml(cible) + '" title="' + echapperHtml(m.titre) + '" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads allow-modals" allow="fullscreen; autoplay; clipboard-write; accelerometer; gyroscope" referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>\n';
}
// Crée l'outil ; les fichiers (activité, image de l'icône) sont choisis ici, dans des fenêtres de Windows.
async function creerOutilProf(d = {}) {
  if (!peutCreerOutils()) throw new Error('Réservé à l\'enseignant connecté dans Labo Prof.');
  const titre = texteCourt(d.titre, 60);
  if (!titre) throw new Error('Donne un nom à ton outil.');
  const type = TYPES_OUTIL_CREE.includes(d.type) ? d.type : null;
  if (!type) throw new Error('Choisis le type d\'outil.');
  const couleur = /^#[0-9a-f]{6}$/i.test(d.couleur || '') ? d.couleur : '#5865f2';
  let integration = '', lienSite = '';
  if (type === 'integration') integration = adresseIntegration(d.url);
  if (type === 'lien') {
    let u; try { u = new URL(String(d.url || '').trim()); } catch { throw new Error('Adresse invalide (elle doit commencer par https://).'); }
    if (!/^https?:$/.test(u.protocol)) throw new Error('Adresse invalide (elle doit commencer par https://).');
    lienSite = u.href;
  }
  let fichier = null, image = null;
  if (type === 'h5p' || type === 'page') {
    const choix = await ouvrirDialogue(type === 'h5p'
      ? { title: 'Choisir l\'activité H5P', buttonLabel: 'Choisir', properties: ['openFile'], filters: [{ name: 'Activité H5P', extensions: ['h5p'] }] }
      : { title: 'Choisir la page (HTML) ou le dossier compressé (.zip)', buttonLabel: 'Choisir', properties: ['openFile'], filters: [{ name: 'Page web ou archive', extensions: ['html', 'htm', 'zip'] }] });
    if (choix.canceled || !choix.filePaths.length) return { annule: true };
    fichier = choix.filePaths[0];
  }
  if (d.icone === 'image') {
    const choix = await ouvrirDialogue({ title: 'Choisir l\'image de l\'icône', buttonLabel: 'Choisir', properties: ['openFile'], filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'] }] });
    if (choix.canceled || !choix.filePaths.length) return { annule: true };
    image = choix.filePaths[0];
    if (fs.statSync(image).size > 2 * 1024 * 1024) throw new Error('Image trop lourde (2 Mo au maximum).');
  }
  const slug = titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'outil';
  const id = `cree-${slug}-${crypto.randomBytes(2).toString('hex')}`;
  const { dossierMaj } = lireConfig();
  const partage = !!dossierMaj && fs.existsSync(dossierMaj);
  const base = partage ? dossierMaj : outilsUtilisateur();
  const final = path.join(base, id);
  const tmp = path.join(base, `.${id}-creation`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const m = {
      id, titre,
      description: texteCourt(d.description, 240) || 'Activité proposée par ton professeur.',
      matiere: MATIERES_OUTIL_CREE.includes(d.matiere) ? d.matiere : 'exercices',
      niveaux: (Array.isArray(d.niveaux) ? d.niveaux : []).filter((n) => NIVEAUX_VALIDES.includes(n)),
      version: '1.0.0', icone: 'icone.svg', couleur, entree: 'index.html',
      motsCles: ['professeur', { h5p: 'h5p', integration: 'activité en ligne', page: 'page', lien: 'site' }[type]],
      creeParProf: true, typeCree: type, cree: new Date().toISOString(),
    };
    if (!m.niveaux.length) delete m.niveaux;
    let cible = '';
    if (type === 'h5p') { const r = installerH5P(fichier, path.join(tmp, 'contenu')); m.source = r.source; m.contenuEntree = r.entree; cible = `app://contenus/${id}/${r.entree}`; }
    if (type === 'page') { const r = installerSimulateur(fichier, path.join(tmp, 'contenu')); m.source = r.source; m.contenuEntree = r.entree; cible = `app://contenus/${id}/${r.entree.split('/').map(encodeURIComponent).join('/')}`; }
    if (type === 'integration') { m.integration = integration; cible = integration; }
    if (type === 'lien') m.lienSite = lienSite;
    if (image) { const ext = path.extname(image).toLowerCase().replace('.jpeg', '.jpg'); m.icone = 'icone' + ext; fs.copyFileSync(image, path.join(tmp, m.icone)); }
    else fs.writeFileSync(path.join(tmp, 'icone.svg'), iconeEmoji([...String(d.icone || '🧩')].slice(0, 2).join(''), couleur));
    fs.writeFileSync(path.join(tmp, 'index.html'), pageOutilCree(m, cible));
    fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(m, null, 2));
    fs.renameSync(tmp, final);
  } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
  if (partage) installerDepuisDossier(final); // tout de suite sur ce PC ; les élèves l'auront à la prochaine vérification
  cacheIntegrations.t = 0;
  return { id, titre, partage };
}
function listerOutilsCrees() {
  return [...outilsDisponibles().values()].filter((o) => o.creeParProf).map((o) => ({ id: o.id, titre: o.titre, typeCree: o.typeCree, cree: o.cree }));
}
function supprimerOutilCree(id) {
  if (!peutCreerOutils()) throw new Error('Réservé à l\'enseignant connecté dans Labo Prof.');
  const o = typeof id === 'string' && ID_VALIDE.test(id) ? outilsDisponibles().get(id) : null;
  if (!o || !o.creeParProf) throw new Error('Outil introuvable.');
  const { dossierMaj } = lireConfig();
  if (dossierMaj) fs.rmSync(path.join(dossierMaj, id), { recursive: true, force: true }); // retiré aussi des PC élèves
  fs.rmSync(path.join(outilsUtilisateur(), id), { recursive: true, force: true });
  return {};
}

// ---------- Protocole app://local/ ----------

function resoudreChemin(urlTexte) {
  const url = new URL(urlTexte);
  const morceaux = decodeURIComponent(url.pathname).split('/').filter(Boolean);
  // app://externe/<id>/… : logiciels tiers présents sur le PC de l'élève (origine séparée de l'application).
  if (url.hostname === 'externe') {
    const id = morceaux.shift();
    if (!id || !ID_VALIDE.test(id)) return null;
    if (id === 'geogebra') {
      // Notre page de démarrage, servie à côté du moteur web de GeoGebra (même origine).
      if (morceaux.join('/') === 'labo-geogebra.html') return path.join(OUTILS_INTEGRES, 'geogebra', 'lanceur.html');
      const g = trouverGeogebra();
      if (!g.dossier) return null;
      const fichier = path.normalize(path.join(g.dossier, ...morceaux));
      return fichier.startsWith(g.dossier + path.sep) ? fichier : null;
    }
    const base = path.join(dossierExternes(), id);
    const fichier = path.normalize(path.join(base, ...morceaux));
    return fichier.startsWith(base + path.sep) ? fichier : null;
  }
  // app://simulateurs/<labo>/<id>/… : simulateur installé par l'enseignant (copie sur ce PC), origine séparée.
  if (url.hostname === 'simulateurs') {
    const labo = morceaux.shift(), id = morceaux.shift();
    if (!labo || !id || !ID_VALIDE.test(labo) || !ID_VALIDE.test(id)) return null;
    const base = path.join(dossierLabosLocal(labo), 'simulateurs', id);
    const fichier = path.normalize(path.join(base, ...(morceaux.length ? morceaux : ['index.html'])));
    return fichier.startsWith(base + path.sep) ? fichier : null;
  }
  // app://contenus/<id>/… : contenu d'un outil créé par l'enseignant (origine séparée) ; _lecteur = lecteur H5P.
  if (url.hostname === 'contenus') {
    const id = morceaux.shift();
    const outil = id && ID_VALIDE.test(id) && outilsDisponibles().get(id);
    if (!outil || !outil.creeParProf) return null;
    let base = path.join(outil.dossier, 'contenu');
    if (morceaux[0] === '_lecteur') { morceaux.shift(); base = path.join(DOSSIER_APP, 'commun', 'biblio', 'h5p-standalone'); }
    const fichier = path.normalize(path.join(base, ...(morceaux.length ? morceaux : ['index.html'])));
    return fichier.startsWith(base + path.sep) ? fichier : null;
  }
  if (url.hostname !== 'local') return null;
  const zone = morceaux.shift();
  let base;
  if (zone === 'shell') base = path.join(DOSSIER_APP, 'shell');
  else if (zone === 'commun') base = path.join(DOSSIER_APP, 'commun');
  else if (zone === 'documents') base = dossierDocuments();
  else if (zone === 'outils') {
    const id = morceaux.shift();
    const outil = id && outilsDisponibles().get(id);
    if (!outil) return null;
    base = outil.dossier;
    if (outil.source === 'utilisateur' && estRestreint(outil)) {
      const ic = String(outil.icone || '');
      if (!/^[\w.-]+\.(svg|png|jpe?g|webp|gif)$/i.test(ic) || morceaux.join('/') !== ic) return null;
    }
  } else return null;
  const fichier = path.normalize(path.join(base, ...morceaux));
  if (fichier !== base && !fichier.startsWith(base + path.sep)) return null;
  return fichier;
}

const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.ftl': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
};

// app://local/outils/cree-…/index.html : page fabriquée ici (les champs du manifeste sont revérifiés).
function pageVirtuelle(urlTexte) {
  const url = new URL(urlTexte);
  if (url.hostname !== 'local') return null;
  const m = /^\/outils\/([a-z0-9-]+)\/index\.html$/.exec(url.pathname);
  if (!m) return null;
  const o = outilsDisponibles().get(m[1]);
  if (!o || o.source !== 'utilisateur' || !o.creeParProf || !estRestreint(o)) return null;
  const sur = { id: o.id, titre: texteCourt(o.titre, 60) || 'Outil', description: texteCourt(o.description, 240), typeCree: o.typeCree,
    couleur: /^#[0-9a-f]{6}$/i.test(o.couleur || '') ? o.couleur : '#5865f2' };
  let cible = '';
  try {
    if (o.typeCree === 'integration') cible = adresseIntegration(o.integration);
    else if (o.typeCree === 'lien') { const u = new URL(o.lienSite); if (!/^https?:$/.test(u.protocol)) throw new Error(); sur.lienSite = u.href; }
    else if (o.typeCree === 'h5p' || o.typeCree === 'page') {
      const e = String(o.contenuEntree || (o.typeCree === 'h5p' ? 'lecteur-h5p.html' : 'index.html'));
      if (e.split('/').some((x) => !x || x === '..' || x === '.')) throw new Error();
      cible = `app://contenus/${o.id}/${e.split('/').map(encodeURIComponent).join('/')}`;
    } else throw new Error();
  } catch { return '<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">Cet outil est abîmé : demande à ton professeur de le recréer.</p>'; }
  return pageOutilCree(sur, cible);
}

// Les fichiers sont lus directement (fonctionne aussi dans l'archive app.asar de la version installée).
function enregistrerProtocole() {
  protocol.handle('app', async (requete) => {
    try {
      const page = pageVirtuelle(requete.url);
      if (page) return new Response(page, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      const fichier = resoudreChemin(requete.url);
      if (!fichier) return new Response('Introuvable', { status: 404 });
      const contenu = await fs.promises.readFile(fichier);
      const type = TYPES_MIME[path.extname(fichier).toLowerCase()] || 'application/octet-stream';
      return new Response(contenu, { status: 200, headers: { 'Content-Type': type } });
    } catch {
      return new Response('Introuvable', { status: 404 });
    }
  });
}

// ---------- IPC ----------

function enregistrerIPC() {
  // Image pour une réponse : capture d'une partie de la fenêtre (l'outil ouvert à côté) ou image du presse-papiers
  const imageReponse = (img) => { if (img.isEmpty()) return null; const t = img.getSize(); return (t.width > 1600 ? img.resize({ width: 1600, quality: 'best' }) : img).toDataURL(); };
  ipcMain.handle('ecran:capturer', async (e, r = {}) => {
    try {
      const n = (v) => Math.max(0, Math.round(Number(v) || 0));
      const rect = { x: n(r.x), y: n(r.y), width: n(r.width), height: n(r.height) };
      if (rect.width < 20 || rect.height < 20) return { ok: false, message: 'Rien à capturer : ouvre d’abord un outil à côté.' };
      const image = imageReponse(await e.sender.capturePage(rect));
      return image ? { ok: true, image } : { ok: false, message: 'Capture vide.' };
    } catch (err) { return { ok: false, message: 'Capture impossible : ' + err.message }; }
  });
  ipcMain.handle('ecran:presse-papier', () => {
    if (!clipboard || typeof clipboard.readImage !== 'function') return { ok: false, message: 'Appuie sur Ctrl+V pour coller ton image (après l’avoir copiée).' };
    const image = imageReponse(clipboard.readImage());
    return image ? { ok: true, image } : { ok: false, message: 'Aucune image copiée : copie d’abord une image (ou fais une capture), puis clique sur « Coller ».' };
  });
  ipcMain.handle('outils:lister', () =>
    [...outilsDisponibles().values()].map(({ dossier, ...o }) => o)
  );

  ipcMain.handle('outils:importer', async () => {
    const choix = await ouvrirDialogue({
      title: 'Ajouter un outil',
      buttonLabel: 'Ajouter',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Outils Labo Élève', extensions: ['outil', 'zip'] }],
    });
    if (choix.canceled) return { resultats: [] };
    return { resultats: choix.filePaths.flatMap((c) => installerChemin(c, { confirmer: confirmerNonSigne })) };
  });

  ipcMain.handle('outils:importer-dossier', async () => {
    const choix = await ouvrirDialogue({
      title: 'Ajouter un outil depuis un dossier',
      buttonLabel: 'Ajouter',
      properties: ['openDirectory'],
    });
    if (choix.canceled) return { resultats: [] };
    return { resultats: installerChemin(choix.filePaths[0], { confirmer: confirmerNonSigne }) };
  });

  ipcMain.handle('outils:supprimer', (_e, id) => {
    if (typeof id !== 'string' || !ID_VALIDE.test(id)) return false;
    fs.rmSync(path.join(outilsUtilisateur(), id), { recursive: true, force: true });
    return true;
  });

  ipcMain.handle('config:lire', () => lireConfig());
  // Mise à jour de l'application
  ipcMain.handle('appli:maj-etat', () => { const { fichier, sha256, ...m } = majApplication(); return m; });
  ipcMain.handle('appli:maj-installer', async () => { try { return await installerMajApplication(); } catch (e) { return { ok: false, message: e.message }; } });

  // Ressources des labos
  const laboValide = (labo) => { if (typeof labo !== 'string' || !ID_VALIDE.test(labo)) throw new Error('Labo inconnu.'); return labo; };
  const gererLabo = (canal, fn) => ipcMain.handle(canal, async (_e, ...args) => { try { return { ok: true, ...(await fn(...args)) }; } catch (e) { return { ok: false, message: e.message }; } });
  gererLabo('labos:lister', (labo) => ({ ...synchroniserLabo(laboValide(labo)), peutGerer: peutGererLabos(), partage: !!dossierLabosPartage(labo) }));
  // Masquer / réafficher une manipulation fournie avec le labo
  gererLabo('labos:masquer', (labo, manipId, masquer) => modifierRessources(laboValide(labo), (_l, _p, contenu) => {
    if (typeof manipId !== 'string' || !/^[a-z0-9-]{1,40}$/i.test(manipId)) throw new Error('Manipulation inconnue.');
    contenu.masques = contenu.masques.filter((x) => x !== manipId);
    if (masquer) contenu.masques.push(manipId);
    return { masques: contenu.masques };
  }));
  // Créer ou modifier une expérience du professeur (lien d'intégration, lien externe ou simulateur installé, avec protocole)
  gererLabo('labos:experience', async (labo, d = {}) => {
    laboValide(labo);
    if (!peutGererLabos()) throw new Error('Réservé à l\'enseignant connecté dans Labo Prof.');
    const titre = texteCourt(d.titre, 80);
    if (!titre) throw new Error('Donne un titre à ton expérience.');
    const contenuType = ['integration', 'lien', 'simulateur'].includes(d.contenu) ? d.contenu : null;
    if (!contenuType) throw new Error('Choisis le contenu de l\'expérience.');
    let url = '';
    if (contenuType === 'integration') url = adresseIntegration(d.url);
    if (contenuType === 'lien') {
      let u; try { u = new URL(String(d.url || '').trim()); } catch { throw new Error('Adresse invalide (elle doit commencer par https://).'); }
      if (!/^https?:$/.test(u.protocol)) throw new Error('Adresse invalide (elle doit commencer par https://).');
      url = u.href;
    }
    const etapes = String(d.protocole || '').split(/\r?\n/).map((l) => texteCourt(l, 300)).filter(Boolean).slice(0, 40);
    const NIVEAUX = ['CAP', '2de', '1re', 'Tle'];
    const fiche = {
      titre, theme: texteCourt(d.theme, 60), niveaux: (Array.isArray(d.niveaux) ? d.niveaux : []).filter((n) => NIVEAUX.includes(n)),
      objectif: texteCourt(d.objectif, 600), contenu: contenuType, url, etapes,
    };
    const existante = d.id ? lireRessources(dossierLabosPartage(labo) || dossierLabosLocal(labo)).experiences.find((x) => x.id === d.id) : null;
    if (d.id && !existante) throw new Error('Expérience introuvable.');
    // Simulateur : on choisit le fichier à la création, ou à la modification si demandé (ou si l'ancien contenu n'en avait pas).
    let src = null;
    if (contenuType === 'simulateur' && (!existante || existante.contenu !== 'simulateur' || d.changerFichier)) {
      const choix = await ouvrirDialogue({ title: 'Choisir le simulateur (page HTML ou dossier compressé .zip)', buttonLabel: 'Choisir', properties: ['openFile'], filters: [{ name: 'Simulateur', extensions: ['html', 'htm', 'zip'] }] });
      if (choix.canceled || !choix.filePaths.length) return { annule: true };
      src = choix.filePaths[0];
    }
    return modifierRessources(labo, (_l, partage, contenu) => {
      const id = existante ? existante.id : idRessource();
      const dossier = path.join(partage, 'simulateurs', id);
      const maintenant = new Date().toISOString();
      if (src) { fs.rmSync(dossier, { recursive: true, force: true }); Object.assign(fiche, installerSimulateur(src, dossier), { fichier: maintenant }); }
      else if (contenuType === 'simulateur') Object.assign(fiche, { entree: existante.entree, source: existante.source, fichier: existante.fichier || existante.ajoute });
      else fs.rmSync(dossier, { recursive: true, force: true }); // plus de simulateur pour cette expérience
      const x = { id, type: 'experience', ...fiche, ajoute: existante ? existante.ajoute : maintenant, modifie: maintenant };
      const i = contenu.experiences.findIndex((y) => y.id === id);
      if (i >= 0) contenu.experiences[i] = x; else contenu.experiences.push(x);
      return { id };
    });
  });
  gererLabo('labos:ajouter-lien', (labo, { titre, url, description } = {}) => modifierRessources(laboValide(labo), (liste) => {
    let u; try { u = new URL(String(url).trim()); } catch { throw new Error('Adresse invalide (elle doit commencer par https://).'); }
    if (!/^https?:$/.test(u.protocol)) throw new Error('Adresse invalide (elle doit commencer par https://).');
    if (!texteCourt(titre, 80)) throw new Error('Donne un titre à ce lien.');
    liste.push({ id: idRessource(), type: 'lien', titre: texteCourt(titre, 80), description: texteCourt(description, 240), url: u.href, ajoute: new Date().toISOString() });
    return {};
  }));
  gererLabo('labos:installer', async (labo, { titre, description } = {}) => {
    laboValide(labo);
    if (!peutGererLabos()) throw new Error('Réservé à l\'enseignant connecté dans Labo Prof.');
    if (!texteCourt(titre, 80)) throw new Error('Donne un titre à ce simulateur.');
    const choix = await ouvrirDialogue({ title: 'Choisir le simulateur (page HTML ou dossier compressé .zip)', buttonLabel: 'Installer', properties: ['openFile'], filters: [{ name: 'Simulateur', extensions: ['html', 'htm', 'zip'] }] });
    if (choix.canceled || !choix.filePaths.length) return { annule: true };
    const src = choix.filePaths[0];
    return modifierRessources(labo, (liste, partage) => {
      const id = idRessource();
      const { entree, source } = installerSimulateur(src, path.join(partage, 'simulateurs', id));
      liste.push({ id, type: 'simulateur', titre: texteCourt(titre, 80), description: texteCourt(description, 240), entree, source, ajoute: new Date().toISOString() });
      return { id };
    });
  });
  // Supprimer une ressource (lien, simulateur) ou une expérience du professeur
  gererLabo('labos:supprimer', (labo, id) => modifierRessources(laboValide(labo), (liste, partage, contenu) => {
    let t = liste, i = liste.findIndex((x) => x.id === id);
    if (i < 0) { t = contenu.experiences; i = t.findIndex((x) => x.id === id); }
    if (i < 0) throw new Error('Ressource introuvable.');
    if (ID_VALIDE.test(id)) fs.rmSync(path.join(partage, 'simulateurs', id), { recursive: true, force: true });
    t.splice(i, 1);
    return {};
  }));
  // Outils créés par l'enseignant (Labo Prof › Créer un outil)
  gererLabo('outils-crees:creer', (d) => creerOutilProf(d));
  gererLabo('outils-crees:lister', () => ({ outils: listerOutilsCrees() }));
  gererLabo('outils-crees:supprimer', (id) => supprimerOutilCree(id));
  ipcMain.handle('office:lien', (_e, url) => office.definirLien(String(url || '')));

  ipcMain.handle('maj:choisir-dossier', async () => {
    const choix = await ouvrirDialogue({
      title: 'Choisir le dossier de mises à jour',
      buttonLabel: 'Choisir',
      properties: ['openDirectory'],
    });
    if (choix.canceled) return lireConfig();
    ecrireConfig({ ...lireConfigBrute(), dossierMaj: choix.filePaths[0], nuage: null }); // un dossier ordinaire remplace le lien Nuage
    obtenirNuage().arreter();
    return lireConfig();
  });

  ipcMain.handle('maj:oublier-dossier', () => {
    ecrireConfig({ ...lireConfigBrute(), dossierMaj: null, nuage: null });
    obtenirNuage().arreter();
    return lireConfig();
  });

  // ---------- Dossier partagé sur Nuage (apps.education.fr) par lien ----------
  ipcMain.handle('nuage:tester', async (_e, lien, mdp) => obtenirNuage().tester({ lien, mdp }));
  ipcMain.handle('nuage:definir', async (_e, lien, mdp, copier) => {
    const n = obtenirNuage();
    const t = await n.tester({ lien, mdp });
    if (!t.ok) return t;
    const avant = lireConfigBrute();
    const ancien = !miroirNuage(avant) && avant.dossierMaj && fs.existsSync(avant.dossierMaj) ? avant.dossierMaj : null;
    ecrireConfig({ ...avant, dossierMaj: avant.dossierMaj || null, nuage: { lien: t.lien, mdp: String(mdp || '').slice(0, 200) } });
    const m = miroirNuage(lireConfigBrute());
    let copies = 0;
    if (copier && ancien && m) { // le contenu du dossier actuel part sur Nuage (sans écraser ce qui y est déjà)
      fs.mkdirSync(m, { recursive: true });
      fs.cpSync(ancien, m, { recursive: true, force: false, errorOnExist: false, filter: (s) => !/(^|[\\/])(Thumbs\.db|desktop\.ini|~\$[^\\/]*)$/i.test(s) });
      copies = 1;
    }
    n.demarrer(lireConfigBrute().nuage);
    const r = await n.synchroniser();
    return { ...r, ok: true, copie: !!copies, vide: t.vide };
  });
  // Élève : ajouter le lien Nuage d'un autre enseignant (« ＋ Nouvelle matière »). Sans dossier partagé : il devient le dossier principal.
  ipcMain.handle('nuage:ajouter-lien', async (_e, lien, mdp) => {
    const c = lireConfigBrute(), a = analyserLien(lien);
    if (!a) return { ok: false, message: 'Ce n’est pas un lien de partage Nuage (il ressemble à https://nuage0X.apps.education.fr/s/…).' };
    if (!miroirNuage(c) && !c.dossierMaj) { // premier lien
      const t = await obtenirNuage().tester({ lien, mdp }); if (!t.ok) return t;
      ecrireConfig({ ...c, nuage: { lien: t.lien, mdp: String(mdp || '').slice(0, 200) } });
      obtenirNuage().demarrer(lireConfigBrute().nuage);
      return { ...(await obtenirNuage().synchroniser()), ok: true, principal: true };
    }
    if ((miroirNuage(c) && analyserLien(c.nuage.lien).jeton === a.jeton) || liensSupp(c).some((x) => analyserLien(x.lien).jeton === a.jeton)) return { ok: false, message: 'Ce lien est déjà enregistré sur ce PC.' };
    const t = await obtenirNuage().tester({ lien, mdp }); if (!t.ok) return t;
    ecrireConfig({ ...c, nuagesSupp: [...liensSupp(c), { lien: t.lien, mdp: String(mdp || '').slice(0, 200) }].slice(0, 12) });
    demarrerNuagesSupp();
    const m = nuagesSupp.get(a.jeton);
    return { ...(m ? await m.synchroniser() : {}), ok: true };
  });
  ipcMain.handle('nuage:retirer-lien', (_e, lien) => {
    const a = analyserLien(lien); if (!a) return { ok: false };
    const c = lireConfigBrute();
    ecrireConfig({ ...c, nuagesSupp: liensSupp(c).filter((x) => analyserLien(x.lien).jeton !== a.jeton) });
    demarrerNuagesSupp();
    return { ok: true };
  });
  ipcMain.handle('nuage:etat', () => ({ ...obtenirNuage().infos(), supp: [...nuagesSupp.values()].map((y) => y.infos()), compteProf: dernierCompteProf, cleProf: !!(dernierCompteProf && obtenirTrousseau().cle('prof:' + dernierCompteProf)) }));
  // Sauvegarde / restauration de la clé de l'enseignant (indispensable pour relire les copies sur un nouveau PC)
  ipcMain.handle('nuage:exporter-cle', async (_e, mdp) => {
    if (!dernierCompteProf) return { ok: false, message: 'Ouvre d’abord ton espace professeur (avec ton mot de passe).' };
    if (String(mdp || '').length < 8) return { ok: false, message: 'Choisis un mot de passe d’au moins 8 caractères pour protéger la sauvegarde.' };
    const id = 'prof:' + dernierCompteProf; obtenirTrousseau().assurer(id);
    const choix = await classe.pendantDialogue(() => dialog.showSaveDialog(fenetre, { title: 'Sauvegarder ma clé Nuage', defaultPath: 'cle-labo-nuage.labocle', filters: [{ name: 'Clé Labo', extensions: ['labocle'] }] }));
    if (choix.canceled || !choix.filePath) return { ok: false, annule: true };
    fs.writeFileSync(choix.filePath, obtenirTrousseau().exporter(id, mdp));
    return { ok: true, fichier: choix.filePath };
  });
  ipcMain.handle('nuage:importer-cle', async (_e, mdp) => {
    const choix = await ouvrirDialogue({ title: 'Restaurer ma clé Nuage', properties: ['openFile'], filters: [{ name: 'Clé Labo', extensions: ['labocle'] }] });
    if (choix.canceled || !choix.filePaths[0]) return { ok: false, annule: true };
    try { const id = obtenirTrousseau().importer(fs.readFileSync(choix.filePaths[0], 'utf8'), mdp); publierCle(id); return { ok: true, id }; }
    catch (e) { return { ok: false, message: e.message }; }
  });
  ipcMain.handle('nuage:synchroniser', async () => { const r = await Promise.all(tousLesNuages().map((n) => n.synchroniser())); return r[0] || { ok: false }; });

  ipcMain.handle('maj:verifier', () => verifierDossierMaj());

  ipcMain.handle('app:infos', () => ({
    version: VERSION_APPLI,
    edition: EDITION,
    nom: NOM_APPLI,
    dossierOutils: outilsUtilisateur(),
  }));

  ipcMain.handle('geogebra:etat', () => { cacheGeogebra.t = 0; const g = trouverGeogebra(); return { installe: !!g.dossier, version: g.version }; });
  ipcMain.handle('numworks:etat', () => etatNumworks());
  ipcMain.handle('numworks:chercher', () => (etatNumworks().installe ? { ok: true, ...etatNumworks() } : chercherNumworks()));
  ipcMain.handle('numworks:choisir', async () => {
    const choix = await ouvrirDialogue({
      title: 'Choisir l\'émulateur NumWorks téléchargé',
      buttonLabel: 'Utiliser ce fichier',
      defaultPath: app.getPath('downloads'),
      properties: ['openFile'],
      filters: [{ name: 'Émulateur NumWorks', extensions: ['zip', 'html'] }],
    });
    if (choix.canceled) return { ok: false, annule: true };
    return installerNumworks(choix.filePaths[0]);
  });
  ipcMain.handle('numworks:retirer', () => {
    fs.rmSync(dossierNumworks(), { recursive: true, force: true });
    return etatNumworks();
  });

  ipcMain.handle('logiciel:etat', (_e, id) => {
    const { installe, nom } = trouverLogiciel(String(id));
    return { installe, nom };
  });
  ipcMain.handle('logiciel:lancer', (_e, id) => {
    const l = trouverLogiciel(String(id));
    if (!l.installe) return { ok: false };
    // Logiciel de TP (Redy) en mode focus : autorisé, Labo Élève le laisse passer devant (jamais en examen).
    if (l.focus && classe.tpPermis()) {
      const dejaOuvert = classe.logicielOuvertTP(); // une fenêtre de Redy est déjà ouverte (vu par le module)
      classe.autoriserLogiciel(path.dirname(l.chemin));
      if (dejaOuvert) { classe.montrerLogiciel(); return { ok: true, nom: l.nom, dejaOuvert: true }; }
      spawn(l.chemin, l.args, { detached: true, stdio: 'ignore', windowsHide: false, cwd: path.dirname(l.chemin) }).unref();
      return { ok: true, nom: l.nom };
    }
    if (classe.bloquerSiActif('logiciel')) return { ok: false, bloque: true };
    spawn(l.chemin, l.args, { detached: true, stdio: 'ignore', windowsHide: false, cwd: path.dirname(l.chemin) }).unref();
    return { ok: true, nom: l.nom };
  });

  ipcMain.handle('documents:lister', () => listerDocuments());
  ipcMain.handle('documents:supprimer', async (_e, nom) => {
    const chemin = cheminDocument(nom);
    if (!chemin) return false;
    await shell.trashItem(chemin); // corbeille : récupérable
    return true;
  });
  ipcMain.handle('documents:importer', async () => {
    const choix = await ouvrirDialogue({ title: 'Ajouter un document', buttonLabel: 'Ajouter', properties: ['openFile', 'multiSelections'] });
    if (choix.canceled) return [];
    fs.mkdirSync(dossierDocuments(), { recursive: true });
    return choix.filePaths.map((src) => {
      const dest = cheminLibre(nomFichierSur(path.basename(src)));
      fs.copyFileSync(src, dest);
      return path.basename(dest);
    });
  });
  // Enregistrement depuis le traitement de texte ou le tableur intégrés.
  ipcMain.handle('documents:enregistrer', (_e, { nom, donnees, remplacer } = {}) => {
    if (!(donnees instanceof Uint8Array) && !(donnees instanceof ArrayBuffer)) return { ok: false, message: 'Données invalides.' };
    const propre = nomFichierSur(nom || 'document');
    if (!EXT_DOCUMENT.test(propre)) return { ok: false, message: 'Type de fichier non autorisé.' };
    fs.mkdirSync(dossierDocuments(), { recursive: true });
    const chemin = remplacer ? path.join(dossierDocuments(), propre) : cheminLibre(propre);
    fs.writeFileSync(chemin, Buffer.from(donnees));
    return { ok: true, nom: path.basename(chemin) };
  });

  // Copie chez l'enseignant (option choisie par l'élève) : dans « Copies des élèves/<nom> » de sa classe.
  ipcMain.handle('documents:prof', () => (espace ? espace.infoEnvoiProf() : { disponible: false }));
  ipcMain.handle('documents:envoyer-prof', (_e, nom) => {
    const chemin = cheminDocument(nom);
    if (!chemin || !fs.existsSync(chemin)) return { ok: false, message: 'Document introuvable.' };
    return espace ? espace.copierPourLeProf(chemin) : { ok: false, message: 'Indisponible.' };
  });

  ipcMain.handle('documents:ouvrir-dossier', () => {
    if (classe.bloquerSiActif('logiciel')) return false;
    fs.mkdirSync(dossierDocuments(), { recursive: true });
    shell.openPath(dossierDocuments());
    return true;
  });

  ipcMain.handle('pad:creer', (_e, d) => creerPad(d || {}));
  ipcMain.handle('pad:exporter', async (_e, id) => {
    const outil = typeof id === 'string' && outilsDisponibles().get(id);
    if (!outil || !outil.pad) return { ok: false, message: 'Carte introuvable.' };
    const choix = await classe.pendantDialogue(() => dialog.showSaveDialog(fenetre, {
      title: 'Exporter la carte pour les élèves',
      defaultPath: path.join(app.getPath('desktop'), `${outil.id}-${outil.version}.outil`),
      filters: [{ name: 'Outil Labo Élève', extensions: ['outil'] }],
    }));
    if (choix.canceled || !choix.filePath) return { ok: false, annule: true };
    const zip = new AdmZip();
    zip.addLocalFolder(outil.dossier, outil.id);
    zip.writeZip(choix.filePath);
    return { ok: true, fichier: choix.filePath };
  });

  // ---------- Fermeture d'urgence (enseignant) ----------
  // Ctrl+Alt+Maj+F ouvre une petite fenêtre à part (elle marche même si la page de Labo Élève est figée).
  // Le mot de passe d'un enseignant ferme l'application tout de suite, même en examen ou en mode classe.
  ipcMain.handle('urgence:valider', async (e, mdp) => {
    if (!fenetreUrgence || e.sender !== fenetreUrgence.webContents) return { ok: false };
    const v = espace.verifierMotDePasse(mdp);
    if (!v.ok) return v;
    try { if (suivi) suivi.ajouterEvenement({ type: 'fermeture-urgence' }); } catch { /* sans importance */ }
    classe.autoriserFermeture();
    setTimeout(async () => {
      if (suivi) { try { await suivi.signalerFermeture(); } catch { /* réseau coupé */ } }
      app.exit(0); // sans attendre les pages (une page figée ne doit pas bloquer la fermeture)
    }, 50);
    return { ok: true };
  });
  ipcMain.on('urgence:annuler', (e) => {
    if (fenetreUrgence && e.sender === fenetreUrgence.webContents) fenetreUrgence.close();
  });

  // Mode focus : l'élève a confirmé que son travail est terminé.
  ipcMain.handle('focus:fermer', async () => {
    if (classe.examenActif() || classe.estActif()) return false; // examen ou mode classe : fermeture interdite
    classe.autoriserFermeture();
    if (suivi) await suivi.signalerFermeture(); // prévient le professeur (heure de fermeture)
    app.quit();
    return true;
  });
  ipcMain.handle('focus:actualiser', () => { majFocus(); return true; });
  // PDF : une page HTML préparée par un outil (tableur, traitement de texte) est imprimée dans une fenêtre invisible,
  // sans JavaScript ni accès au réseau, puis renvoyée en octets (l'outil l'enregistre dans Mes documents).
  ipcMain.handle('pdf:depuis-html', async (_e, html, options = {}) => {
    if (typeof html !== 'string' || html.length > 40 * 1024 * 1024) throw new Error('Page trop grande.');
    const tmp = path.join(os.tmpdir(), `labo-impression-${crypto.randomBytes(6).toString('hex')}.html`);
    fs.writeFileSync(tmp, html);
    const w = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, partition: 'impression' } }); // session à part : le réseau y est coupé sans toucher au reste
    try {
      w.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_d, rappel) => rappel({ cancel: true }));
      await w.loadFile(tmp);
      const m = options.marges && typeof options.marges === 'object' ? options.marges : null;
      const nombre = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v < 4 ? +v : d);
      const entete = typeof options.entete === 'string' ? options.entete.slice(0, 5000) : '';
      const pied = typeof options.pied === 'string' ? options.pied.slice(0, 5000) : '';
      const pdf = await w.webContents.printToPDF({
        pageSize: 'A4', landscape: !!options.paysage, printBackground: true,
        margins: m ? { marginType: 'custom', top: nombre(m.haut, 1), bottom: nombre(m.bas, 1), left: nombre(m.gauche, 1), right: nombre(m.droite, 1) } : { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
        displayHeaderFooter: !!(entete || pied), headerTemplate: entete || '<span></span>', footerTemplate: pied || '<span></span>',
      });
      return new Uint8Array(pdf);
    } finally {
      w.destroy();
      fs.rmSync(tmp, { force: true });
    }
  });
  ipcMain.handle('office:url', (_e, appli) => office.urlDepart(String(appli)));
  ipcMain.handle('office:precedent', () => office.precedent());
  ipcMain.handle('recherche:etat', () => rechercheAutorisee());

  ipcMain.handle('app:ouvrir-dossier-outils', () => {
    fs.mkdirSync(outilsUtilisateur(), { recursive: true });
    shell.openPath(outilsUtilisateur());
  });
}

// ---------- Fenêtre ----------

let fenetreUrgence = null;
function ouvrirFermetureUrgence() {
  if (fenetreUrgence && !fenetreUrgence.isDestroyed()) { fenetreUrgence.show(); fenetreUrgence.focus(); return; }
  fenetreUrgence = new BrowserWindow({
    width: 460, height: 270, resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: false, autoHideMenuBar: true, show: false, title: 'Fermeture d\'urgence',
    backgroundColor: '#1a1f30',
    webPreferences: { preload: path.join(DOSSIER_APP, 'preload-urgence.js'), contextIsolation: true, sandbox: true },
  });
  fenetreUrgence.setAlwaysOnTop(true, 'screen-saver', 1); // au-dessus de la fenêtre plein écran de Labo Élève
  fenetreUrgence.setMenu(null);
  fenetreUrgence.webContents.on('will-navigate', (ev) => ev.preventDefault());
  fenetreUrgence.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // Pendant que la fenêtre est ouverte, la perte de focus de Labo Élève n'est ni une sortie, ni ramenée au premier plan.
  classe.pendantDialogue(() => new Promise((fin) => fenetreUrgence.once('closed', fin)));
  fenetreUrgence.once('closed', () => {
    fenetreUrgence = null;
    if (fenetre && !fenetre.isDestroyed()) fenetre.focus();
  });
  fenetreUrgence.once('ready-to-show', () => { fenetreUrgence.show(); fenetreUrgence.moveTop(); fenetreUrgence.focus(); });
  fenetreUrgence.loadURL('app://local/shell/urgence.html');
}

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: NOM_APPLI,
    icon: path.join(DOSSIER_APP, 'shell', 'icones', EDITION === 'prof' ? 'prof.png' : 'eleve.png'),
    backgroundColor: '#0f1320',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(DOSSIER_APP, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged, // pas d'outils de développement dans la version installée
      webviewTag: true, // Office en ligne affiché dans l'application (contrôlé dans office.js)
    },
  });
  fenetre.once('ready-to-show', () => fenetre.show());
  classe.brancherFenetre(fenetre);

  // Lien quittant l'application : un fichier venant d'un pad va dans « Mes documents »
  // (Digipad stocke ses fichiers sur un autre serveur) ; une vraie page web s'ouvre dans
  // le navigateur, ou est bloquée en mode classe.
  async function lienExterne(url, depuisPad) {
    if (!/^https?:/i.test(url)) return;
    if (depuisPad && await estUnFichier(url)) {
      fenetre.webContents.downloadURL(url);
      return;
    }
    if (!classe.bloquerSiActif('lien')) shell.openExternal(url);
  }

  fenetre.webContents.setWindowOpenHandler(({ url, referrer }) => {
    lienExterne(url, estUrlDePad(url) || estUrlDePad(referrer && referrer.url) || padAffiche());
    return { action: 'deny' };
  });
  // Le cadre d'un outil ne peut aller que vers l'application ou un pad autorisé.
  fenetre.webContents.on('will-frame-navigate', (details) => {
    if (details.isMainFrame || !details.frame || details.frame.parent !== fenetre.webContents.mainFrame) return;
    const url = details.url;
    if (url.startsWith('app://') || url === 'about:blank' || estUrlDePad(url)) return;
    details.preventDefault();
    lienExterne(url, estUrlDePad(details.frame.url) || padAffiche());
  });
  fenetre.webContents.on('did-frame-navigate', (_e, url, _code, _texte, estPrincipal, idProcessus, idRoutage) => {
    if (estPrincipal) return;
    const cadre = webFrameMain.fromId(idProcessus, idRoutage);
    if (cadre && cadre.parent === fenetre.webContents.mainFrame) urlCadreOutil = url;
  });
  fenetre.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://local/')) e.preventDefault();
  });

  fenetre.webContents.once('did-finish-load', () => {
    const rapports = [];
    if (lireConfig().dossierMaj) rapports.push(...verifierDossierMaj().resultats);
    rapports.push(...fichiersEnAttente.flatMap((c) => installerChemin(c, { confirmer: confirmerNonSigne })));
    fichiersEnAttente = [];
    if (!etatNumworks().installe) {
      const r = chercherNumworks();
      if (r.ok) rapports.push({ id: 'calculatrice-numworks', titre: 'Calculatrice NumWorks', version: r.version || '—', statut: 'installe' });
    }
    const utiles = rapports.filter((r) => r.statut !== 'deja-a-jour' && r.statut !== 'annule');
    if (utiles.length) notifierChangement({ resultats: utiles });
    // Nouvelle version de l'application dans le dossier partagé ? (au démarrage, puis toutes les 30 minutes)
    const signalerMaj = () => { const { fichier, sha256, ...m } = majApplication(); if (m.disponible && fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('appli:maj', m); };
    signalerMaj();
    setInterval(signalerMaj, 30 * 60 * 1000);
  });

  // Les pads du professeur peuvent s'afficher dans l'application même si le site
  // interdit normalement l'affichage dans un autre site (en-têtes X-Frame-Options / frame-ancestors).
  // Digipad installe un « service worker » : les pages du pad viennent ensuite de lui et non du réseau, donc
  // sans passer par le filtre ci-dessous qui autorise leur affichage dans l'application → page blanche.
  // On efface ces service workers à chaque démarrage et on empêche d'en installer (l'application n'en a pas besoin).
  // Autorisations des pages (outils, sites intégrés) : caméra, micro, position, notifications… refusés.
  // Seuls le plein écran, le verrouillage du pointeur (simulations) et la copie dans le presse-papiers sont permis.
  const PERMISSIONS_OK = ['fullscreen', 'pointerLock', 'clipboard-sanitized-write'];
  for (const ses of [fenetre.webContents.session, session.fromPartition('persist:office365')]) {
    ses.setPermissionRequestHandler((_wc, permission, rappel) => rappel(PERMISSIONS_OK.includes(permission)));
    ses.setPermissionCheckHandler((_wc, permission) => PERMISSIONS_OK.includes(permission));
  }
  fenetre.webContents.session.clearStorageData({ storages: ['serviceworkers'] }).catch(() => {});
  fenetre.webContents.session.webRequest.onBeforeSendHeaders((details, rappel) => {
    const scriptServiceWorker = Object.entries(details.requestHeaders || {}).some(([cle, valeur]) => cle.toLowerCase() === 'service-worker' && valeur === 'script');
    rappel(scriptServiceWorker ? { cancel: true } : { requestHeaders: details.requestHeaders });
  });
  fenetre.webContents.session.webRequest.onHeadersReceived((details, rappel) => {
    // Pads du professeur, et liens d'intégration enregistrés dans les expériences des labos (eux seuls).
    if (details.resourceType !== 'subFrame' || !(estUrlDePad(details.url) || estUrlIntegrationLabo(details.url))) return rappel({});
    const entetes = {};
    for (const [cle, valeur] of Object.entries(details.responseHeaders || {})) {
      const c = cle.toLowerCase();
      if (c === 'x-frame-options') continue;
      if (c === 'content-security-policy') {
        entetes[cle] = valeur.map((v) => v.split(';').filter((d) => !/^\s*frame-ancestors/i.test(d)).join(';'));
      } else entetes[cle] = valeur;
    }
    rappel({ responseHeaders: entetes });
  });

  fenetre.webContents.session.on('will-download', gererTelechargement);
  office.brancherFenetre(fenetre);

  if (MODE_TEST) { // bien visible : on n'est pas dans l'application normale
    fenetre.on('page-title-updated', (e, t) => { if (!t.startsWith('[TEST]')) { e.preventDefault(); fenetre.setTitle('[TEST] ' + t); } });
    fenetre.webContents.on('did-finish-load', () => fenetre.webContents.insertCSS('body::after{content:"🧪 VERSION DE TEST";position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99999;background:#f59e0b;color:#111;font:700 12px system-ui,sans-serif;padding:3px 14px;border-radius:0 0 8px 8px;pointer-events:none}'));
  }
  fenetre.loadURL('app://local/shell/index.html');
}

// Tout fichier téléchargé (pad, Office en ligne, enregistrement d'un PDF annoté) va dans « Mes documents ».
function gererTelechargement(_e, item) {
    fs.mkdirSync(dossierDocuments(), { recursive: true });
    let nom = nomFichierSur(item.getFilename() || 'document');
    if (!path.extname(nom)) nom += EXT_PAR_TYPE[(item.getMimeType() || '').split(';')[0]] || '';
    let chemin;
    if (item.getURL().startsWith('blob:app://local')) {
      // Enregistrement d'un PDF annoté : « fiche - complété.pdf », mis à jour à chaque enregistrement.
      const ext = path.extname(nom) || '.pdf';
      let base = path.basename(nom, ext);
      if (!/ - complété$/.test(base)) base += ' - complété';
      nom = base + ext;
      chemin = path.join(dossierDocuments(), nom);
    } else {
      chemin = cheminLibre(nom);
      nom = path.basename(chemin);
    }
    item.setSavePath(chemin);
    item.once('done', (_ev, etatTelechargement) => {
      if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('documents:telecharge', { nom, ok: etatTelechargement === 'completed' });
    });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  fichiersEnAttente = fichiersDansArguments(process.argv.slice(1));

  app.on('second-instance', (_e, argv) => {
    if (fenetre) {
      if (fenetre.isMinimized()) fenetre.restore();
      fenetre.focus();
    }
    installerFichiersOuverts(fichiersDansArguments(argv.slice(1)));
  });

  app.whenReady().then(() => {
    // Le nom « Labo Élève » apparaît dans l'agent utilisateur ; ses accents font échouer
    // le chargement des fichiers internes. On garde un agent utilisateur sans accents.
    app.userAgentFallback = app.userAgentFallback.normalize('NFD').replace(/[^ -~]/g, '');
    enregistrerProtocole();
    Menu.setApplicationMenu(null); // pas de menu : ni rechargement ni outils de développement au clavier
    // Suivi en direct : le PC du professeur écoute, les PC élèves envoient un signal.
    espace = creerEspaceClasses({
      ipcMain, dialog, obtenirFenetre: () => fenetre, lireConfig, edition: EDITION, pendantDialogue: classe.pendantDialogue,
      racinesSupp: () => (lireConfig().dossiersSupp || []).map((d) => path.join(d, 'Classes')),
      ouvrirChemin: (p) => shell.openPath(p),
      dossierDocuments, cheminLibre, nomFichierSur, urlPadValide, dossierDonnees: () => app.getPath('userData'),
      surIdentification: (eleve) => { suivi.definirEleve(eleve); majFocus(); if (eleve && eleve.classeId && eleve.eleveId) publierCle(`eleve:${eleve.classeId}:${eleve.eleveId}`); },
      surDeverrouillage: (mdp, compteId) => { suivi.demarrer(mdp, compteId); if (compteId) { dernierCompteProf = compteId; publierCle('prof:' + compteId); } },
      surLiberation: (mdp) => suivi.enregistrerLiberation(mdp),
      surExamenLeve: () => { suivi.ajouterEvenement({ type: 'examen-leve' }); majFocus(); },
      surExamenLocal: () => { majFocus(); suivi.ajouterEvenement({ type: 'examen-local' }); },
      surVerrouillage: () => suivi.arreter(),
    });
    suivi = creerSuivi({ app, ipcMain, obtenirFenetre: () => fenetre, racineClasses: espace.racine, estProfDeverrouille: espace.estProfDeverrouille, surDeconnexion: (classeId) => espace.oublierInscription(classeId), enExamen: () => !!classe.examenActif() });
    creerEvaluations({ app, ipcMain, espace, lireConfig, edition: EDITION, dossierDonnees: () => app.getPath('userData'),
      dialogues: { ouvrir: ouvrirDialogue, enregistrer: (o) => classe.pendantDialogue(() => dialog.showSaveDialog(fenetre, o)) } });
    enregistrerIPC();
    obtenirNuage().surChangement((e) => { if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('nuage:etat', e); });
    if (miroirNuage(lireConfigBrute())) obtenirNuage().demarrer(lireConfigBrute().nuage);
    demarrerNuagesSupp();
    classe.enregistrerIPC();
    espace.enregistrerIPC();
    suivi.enregistrerIPC();
    creerFenetre();
    if (EDITION !== 'prof') {
      try { globalShortcut.register('CommandOrControl+Alt+Shift+F', ouvrirFermetureUrgence); } catch { /* raccourci déjà pris */ }
    }
  });
  app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch { /* déjà fait */ } });
  // Avant de quitter : un dernier envoi vers Nuage (4 s au plus), pour ne pas garder une copie seulement sur ce PC
  let nuageFini = false;
  app.on('before-quit', (e) => {
    if (nuageFini || !tousLesNuages().length) return;
    e.preventDefault(); nuageFini = true;
    const liste = tousLesNuages();
    Promise.race([Promise.all(liste.map((n) => n.synchroniser())), new Promise((r) => setTimeout(r, 4000))]).finally(() => { liste.forEach((n) => n.arreter()); app.quit(); });
  });

  app.on('window-all-closed', () => app.quit());

  // Une page web (GeoGebra, Word en ligne, Digipad…) qui signale un travail non enregistré empêche
  // la fermeture sans rien afficher. On pose la question à la place, et on ferme si l'utilisateur le confirme.
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-prevent-unload', (ev) => {
      const parent = fenetre && !fenetre.isDestroyed() ? fenetre : undefined;
      let choix = 1;
      // (la boîte est synchrone : la réponse est connue avant de continuer ; pas compté comme une sortie)
      classe.pendantDialogue(() => {
        choix = dialog.showMessageBoxSync(parent, {
          type: 'question', title: NOM_APPLI, buttons: ['Fermer quand même', 'Annuler'], defaultId: 1, cancelId: 1, noLink: true,
          message: 'Un outil contient peut-être un travail non enregistré.',
          detail: 'Si tu fermes maintenant, ce qui n\'a pas été enregistré sera perdu.',
        });
      });
      if (choix === 0) ev.preventDefault(); // ignore la page : la fermeture continue
    });
  });
}
