// Signature Authenticode des .exe (application, installeur, désinstalleur) avec le certificat Certum de l'enseignant.
// Le certificat est dans le cloud (SimplySign) : SimplySign Desktop doit être connecté sur ce PC.
// Sans le certificat (ex. quelqu'un qui reconstruit l'application depuis GitHub), on ne signe pas : simple avertissement.
//   - electron-builder : win.signtoolOptions.sign = "scripts/signer.js" (installeur et désinstalleur)
//   - scripts/icone-exe.js : signe le .exe de l'application après la pose de l'icône
// Variables facultatives : LABO_CERT_SHA1 (empreinte du certificat), SIGNTOOL (chemin de signtool.exe), LABO_SANS_SIGNATURE=1.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const EMPREINTE = (process.env.LABO_CERT_SHA1 || '6391533AECF3C941F28B3AB1CC076995761C9347').replace(/\s/g, '').toUpperCase();
const HORODATAGE = 'http://time.certum.pl';
const SITE = 'https://github.com/lejedujeujouer-cpu/labo-eleve';

function trouverSigntool() {
  if (process.env.SIGNTOOL && fs.existsSync(process.env.SIGNTOOL)) return process.env.SIGNTOOL;
  const candidats = [];
  const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
  try { for (const d of fs.readdirSync(cache)) candidats.push(path.join(cache, d, 'windows-10', 'x64', 'signtool.exe')); } catch { /* pas de cache */ }
  const kits = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  try { for (const d of fs.readdirSync(kits).sort().reverse()) candidats.push(path.join(kits, d, 'x64', 'signtool.exe')); } catch { /* pas de SDK */ }
  return candidats.find((f) => fs.existsSync(f)) || null;
}

// Le certificat est-il présent dans le magasin de l'utilisateur (avec sa clé) ?
let presenceCertificat = null;
function certificatPresent() {
  if (presenceCertificat !== null) return presenceCertificat;
  try {
    const r = execFileSync('powershell.exe', ['-NoProfile', '-Command', `[bool](Get-ChildItem Cert:\\CurrentUser\\My\\${EMPREINTE} -ErrorAction SilentlyContinue | Where-Object HasPrivateKey)`], { encoding: 'utf8' });
    presenceCertificat = /True/i.test(r);
  } catch { presenceCertificat = false; }
  return presenceCertificat;
}

function signerFichier(fichier, description) {
  if (process.env.LABO_SANS_SIGNATURE === '1') { console.log(`  • signature désactivée (LABO_SANS_SIGNATURE) : ${path.basename(fichier)}`); return false; }
  if (process.platform !== 'win32') return false;
  if (!certificatPresent()) { console.warn(`  ⚠ certificat ${EMPREINTE.slice(0, 8)}… absent (SimplySign Desktop connecté ?) : ${path.basename(fichier)} n'est PAS signé`); return false; }
  const signtool = trouverSigntool();
  if (!signtool) throw new Error('signtool.exe introuvable (cache electron-builder ou Windows SDK).');
  const args = ['sign', '/sha1', EMPREINTE, '/fd', 'sha256', '/tr', HORODATAGE, '/td', 'sha256', '/du', SITE];
  if (description) args.push('/d', description);
  args.push(fichier);
  let derniere = null;
  for (let essai = 1; essai <= 3; essai++) { // le serveur d'horodatage peut être lent : on réessaie
    try { execFileSync(signtool, args, { stdio: 'pipe' }); console.log(`  • signé : ${path.basename(fichier)}`); return true; }
    catch (e) { derniere = e; console.warn(`  ⚠ signature, essai ${essai} : ${String((e.stderr || e.message || '')).trim().split('\n').pop()}`); }
  }
  throw new Error(`Signature impossible de ${path.basename(fichier)} : ${String((derniere.stderr || derniere.message || '')).trim()}`);
}

// appelé par electron-builder pour chaque fichier à signer
exports.default = async function (config) {
  if (config.hash && config.hash !== 'sha256') return; // une seule signature SHA-256
  signerFichier(config.path, config.name);
};
exports.signerFichier = signerFichier;
exports.certificatPresent = certificatPresent;
