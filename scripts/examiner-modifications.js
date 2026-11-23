// (Chez le responsable) Examine les modifications envoyées par un(e) collègue, puis les applique si on le décide.
// Usage :
//   npm run examiner -- "Modifications-xxx.zip"              → affiche ce qui change et range les fichiers dans modifications-recues/
//   npm run examiner -- "Modifications-xxx.zip" --appliquer  → sauvegarde tes fichiers, puis applique (sauf conflits)
//   ... --appliquer --forcer                                  → applique aussi les fichiers en conflit ou sensibles
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { RACINE, EXCLUS, SENSIBLES, empreinte, horodatage, nomSur } = require('./kit-commun');

const args = process.argv.slice(2);
const fichierZip = args.find((a) => !a.startsWith('--'));
const appliquer = args.includes('--appliquer'), forcer = args.includes('--forcer');
if (!fichierZip || !fs.existsSync(fichierZip)) { console.error('Usage : npm run examiner -- "Modifications-xxx.zip" [--appliquer] [--forcer]'); process.exit(1); }

const zip = new AdmZip(fichierZip);
const infos = JSON.parse(zip.readAsText('modifications.json') || 'null');
if (!infos) { console.error('✗ Ce fichier ne contient pas de modifications.json.'); process.exit(1); }
const cheminSur = (rel) => {
  const n = path.posix.normalize(String(rel || ''));
  if (!n || n.startsWith('..') || path.posix.isAbsolute(n) || /^[a-z]:/i.test(n) || n.includes('\\')) return null;
  if (EXCLUS.has(n.split('/')[0])) return null;
  return n;
};
const version = require(path.join(RACINE, 'package.json')).version;
console.log(`Modifications de ${infos.auteur} — ${infos.description || '(pas de description)'}`);
console.log(`Faites à partir de la version ${infos.versionBase} (ta version : ${version}), le ${String(infos.date).slice(0, 10)}.`);
if (infos.versionBase !== version) console.log('⚠ Version différente : vérifie bien les conflits ci-dessous.');

const lignes = [];
const ajouter = (type, rel, avant) => {
  const f = cheminSur(rel);
  if (!f) { lignes.push({ type, rel, refuse: 'chemin refusé' }); return; }
  const ici = path.join(RACINE, f);
  const existe = fs.existsSync(ici);
  // conflit : ton fichier a changé depuis le kit (ou un fichier « ajouté » existe déjà chez toi)
  const conflit = type === '+' ? existe && empreinte(ici) !== require('crypto').createHash('sha256').update(zip.readFile(`fichiers/${f}`) || Buffer.alloc(0)).digest('hex')
    : existe ? empreinte(ici) !== avant : type === '~';
  lignes.push({ type, rel: f, conflit, sensible: SENSIBLES.includes(f) || f === 'package.json' });
};
for (const f of infos.ajoutes || []) ajouter('+', f);
for (const x of infos.modifies || []) ajouter('~', x.fichier, x.avant);
for (const x of infos.supprimes || []) ajouter('-', x.fichier, x.avant);
for (const l of lignes) console.log(`  ${l.type} ${l.rel}${l.refuse ? '   ✗ ' + l.refuse : ''}${l.conflit ? '   ⚠ CONFLIT (tu as aussi modifié ce fichier)' : ''}${l.sensible ? '   ⚠ fichier sensible' : ''}`);

const recus = path.join(RACINE, 'modifications-recues', `${nomSur(infos.auteur)}-${horodatage()}`);
zip.getEntries().forEach((e) => {
  if (e.isDirectory) return;
  const rel = e.entryName.startsWith('fichiers/') ? cheminSur(e.entryName.slice(9)) : e.entryName === 'modifications.json' ? 'modifications.json' : null;
  if (!rel) return;
  const cible = path.join(recus, e.entryName === 'modifications.json' ? rel : path.join('fichiers', rel));
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, e.getData());
});
console.log(`\nFichiers reçus rangés dans : ${recus}`);
if (!appliquer) { console.log('Rien n\'a été changé dans ton projet. Pour appliquer : ajoute --appliquer à la commande.'); process.exit(0); }

const bloques = lignes.filter((l) => l.refuse || ((l.conflit || l.sensible) && !forcer));
const aFaire = lignes.filter((l) => !bloques.includes(l));
const sauvegarde = path.join(RACINE, 'sauvegardes', `avant-${nomSur(infos.auteur)}-${horodatage()}`);
for (const l of aFaire) {
  const ici = path.join(RACINE, l.rel);
  if (fs.existsSync(ici)) { fs.mkdirSync(path.dirname(path.join(sauvegarde, l.rel)), { recursive: true }); fs.copyFileSync(ici, path.join(sauvegarde, l.rel)); }
  if (l.type === '-') fs.rmSync(ici, { force: true });
  else { fs.mkdirSync(path.dirname(ici), { recursive: true }); fs.copyFileSync(path.join(recus, 'fichiers', l.rel), ici); }
}
console.log(`✓ ${aFaire.length} changement(s) appliqué(s). Tes anciens fichiers sont dans : ${sauvegarde}`);
if (bloques.length) console.log(`⚠ ${bloques.length} non appliqué(s) (conflit, fichier sensible ou chemin refusé). Regarde-les, puis relance avec --forcer si tu es sûr(e).`);
if (aFaire.some((l) => l.rel === 'package.json')) console.log('ℹ package.json a changé : lance « npm install ».');
