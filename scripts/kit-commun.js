// Outils communs du kit enseignant : liste des fichiers du projet et empreintes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..');
// Jamais dans le kit ni dans les modifications : dépendances, clé privée, fichiers construits, échanges.
const EXCLUS = new Set(['node_modules', 'cles-signature', 'installeur', 'paquets', 'kit-enseignant', 'modifications-a-envoyer', 'modifications-recues', 'sauvegardes', '.claude', '.git']);
const FICHIER_REFERENCE = 'reference-kit.json';
// Fichiers qui touchent à la sécurité : une modification reçue n'y est jamais appliquée sans --forcer.
const SENSIBLES = ['signature-publique.pem', 'signature.js', 'scripts/cles.js', 'scripts/publier-maj.js', 'scripts/kit-commun.js', 'scripts/examiner-modifications.js', 'preload.js', 'preload-urgence.js'];

function listerFichiers(base = RACINE) {
  const res = [];
  const parcourir = (d) => {
    for (const x of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, x.name);
      const rel = path.relative(base, p).split(path.sep).join('/');
      if (!rel.includes('/') && EXCLUS.has(x.name)) continue;
      if (rel === FICHIER_REFERENCE || rel === 'LISEZMOI-KIT.txt' || x.isSymbolicLink()) continue;
      if (x.isDirectory()) parcourir(p);
      else if (x.isFile()) res.push(rel);
    }
  };
  parcourir(base);
  return res.sort();
}
const empreinte = (fichier) => crypto.createHash('sha256').update(fs.readFileSync(fichier)).digest('hex');
function empreintes(base = RACINE) {
  return Object.fromEntries(listerFichiers(base).map((rel) => [rel, empreinte(path.join(base, rel))]));
}
const horodatage = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const nomSur = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'enseignant';

module.exports = { RACINE, EXCLUS, FICHIER_REFERENCE, SENSIBLES, listerFichiers, empreinte, empreintes, horodatage, nomSur };
