// Publie la version construite (npm run installeur) dans le dossier partagé du lycée :
//   <dossier partagé>/Mise à jour de l'application/ : les deux installeurs, version.json et version.sig (signature).
// Labo Élève et Labo Prof y voient la nouvelle version et proposent de l'installer.
// Usage : npm run publier [-- "<dossier partagé>"] [-- --notes "Ce qui change"]
const fs = require('fs');
const path = require('path');
const { signer, empreinteFichier } = require('../signature');
const { clePrivee } = require('./cles');

const RACINE = path.join(__dirname, '..');
const version = require(path.join(RACINE, 'package.json')).version;
const args = process.argv.slice(2);
const iNotes = args.indexOf('--notes');
const notes = iNotes >= 0 ? String(args[iNotes + 1] || '') : '';
const libres = args.filter((a, i) => i !== iNotes && i !== iNotes + 1);
function dossierPartage() {
  if (libres[0]) return libres[0];
  for (const appli of ['Labo Prof', 'Labo Élève']) {
    try { const c = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, appli, 'config.json'), 'utf8')); if (c.nuage && c.nuage.lien) { const j = /\/s\/([A-Za-z0-9]+)/.exec(c.nuage.lien); if (j) return path.join(process.env.APPDATA, appli, 'nuage', j[1]); } if (c.dossierMaj) return c.dossierMaj; } catch { /* suivant */ }
  }
  return null;
}
const partage = dossierPartage();
if (!partage || !fs.existsSync(partage)) { console.error('✗ Dossier partagé introuvable. Indique-le : npm run publier -- "D:\\Dossier partagé"'); process.exit(1); }

const sources = {
  eleve: path.join(RACINE, 'installeur', `Labo Élève Setup ${version}.exe`),
  prof: path.join(RACINE, 'installeur', 'prof', `Labo Prof Setup ${version}.exe`),
};
for (const [ed, f] of Object.entries(sources)) if (!fs.existsSync(f)) { console.error(`✗ Installeur ${ed} introuvable : ${f} (lance d'abord npm run installeur)`); process.exit(1); }

const dest = path.join(partage, 'Mise à jour de l\'application');
fs.mkdirSync(dest, { recursive: true });
const cle = clePrivee();
const info = { version, date: new Date().toISOString(), notes };
for (const [ed, f] of Object.entries(sources)) {
  const nom = `${ed === 'prof' ? 'Labo-Prof' : 'Labo-Eleve'}-Setup-${version}.exe`;
  fs.copyFileSync(f, path.join(dest, nom));
  info[ed] = { fichier: nom, sha256: empreinteFichier(path.join(dest, nom)), taille: fs.statSync(f).size };
}
// anciennes versions retirées
for (const x of fs.readdirSync(dest)) if (/\.exe$/i.test(x) && !Object.values(info).some((v) => v && v.fichier === x)) fs.rmSync(path.join(dest, x), { force: true });
const texte = JSON.stringify(info, null, 2);
fs.writeFileSync(path.join(dest, 'version.json'), texte);
fs.writeFileSync(path.join(dest, 'version.sig'), signer(cle, texte) + '\n');
console.log(`✓ Version ${version} publiée dans ${dest}`);
console.log('  Les PC la proposeront à la prochaine ouverture de Labo Élève / Labo Prof (ou dans les 30 minutes).');
