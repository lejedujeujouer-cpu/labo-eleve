// Crée un fichier .outil (archive) à partir d'un dossier d'outil, prêt à être distribué aux élèves.
// Usage : npm run paquet -- <dossier-de-l-outil> [<dossier-de-sortie>]
// Exemple : npm run paquet -- modele-outil
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const [, , source, sortie = 'paquets'] = process.argv;
if (!source) {
  console.error('Usage : npm run paquet -- <dossier-de-l-outil> [<dossier-de-sortie>]');
  process.exit(1);
}

const dossier = path.resolve(source);
const fichierManifeste = path.join(dossier, 'manifest.json');
if (!fs.existsSync(fichierManifeste)) {
  console.error(`✗ Pas de manifest.json dans ${dossier}`);
  process.exit(1);
}

let m;
try {
  m = JSON.parse(fs.readFileSync(fichierManifeste, 'utf8'));
} catch (e) {
  console.error(`✗ manifest.json illisible : ${e.message}`);
  process.exit(1);
}

const erreurs = [];
if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id || '')) erreurs.push('« id » doit contenir uniquement des minuscules, chiffres et tirets (ex. "loi-ohm")');
if (!m.titre) erreurs.push('« titre » est obligatoire');
if (!m.version) erreurs.push('« version » est obligatoire (ex. "1.0.0")');
const NIVEAUX = ['cap1', 'cap2', '2pro', '1pro', 'tpro'];
if (m.niveaux !== undefined) {
  if (!Array.isArray(m.niveaux)) erreurs.push('« niveaux » doit être une liste, ex. ["2pro", "1pro"]');
  else {
    const inconnus = m.niveaux.filter((n) => !NIVEAUX.includes(n));
    if (inconnus.length) erreurs.push(`niveaux inconnus : ${inconnus.join(', ')} (valeurs possibles : ${NIVEAUX.join(', ')})`);
  }
}
const entree = m.entree || 'index.html';
if (!fs.existsSync(path.join(dossier, entree))) erreurs.push(`le fichier d'entrée « ${entree} » est introuvable`);
if (erreurs.length) {
  console.error('✗ Le manifeste contient des erreurs :\n  - ' + erreurs.join('\n  - '));
  process.exit(1);
}

fs.mkdirSync(sortie, { recursive: true });
const cible = path.join(sortie, `${m.id}-${m.version}.outil`);
// Copie de travail signée avec la clé du développeur (obligatoire pour une diffusion par le dossier partagé)
const os = require('os');
const { signerDossier } = require('../signature');
const { clePrivee } = require('./cles');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paquet-'));
const copie = path.join(tmp, m.id);
fs.cpSync(dossier, copie, { recursive: true });
let signe = false;
try { signerDossier(clePrivee(), copie, m); signe = true; } catch (e) { console.warn('⚠ Paquet NON signé :', e.message); }
const zip = new AdmZip();
zip.addLocalFolder(copie, m.id);
zip.writeZip(cible);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(signe ? '✓ Paquet signé' : '⚠ Sans signature, il ne sera pas installé depuis le dossier partagé.');
console.log(`✓ Paquet créé : ${cible}`);
console.log(`  ${m.titre} — version ${m.version}`);
console.log('  Donne ce fichier aux élèves (double-clic pour l\'installer) ou dépose-le dans le dossier de mises à jour.');
