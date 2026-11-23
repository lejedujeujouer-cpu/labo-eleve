// Clés de signature du développeur.
// La clé PRIVÉE reste dans cles-signature/ (à garder secrète et à sauvegarder, par ex. sur une clé USB) :
// elle n'est jamais copiée dans l'application. La clé PUBLIQUE (signature-publique.pem) est intégrée
// à Labo Élève et Labo Prof pour vérifier les outils et les mises à jour.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'cles-signature');
const PRIVEE = path.join(DOSSIER, 'cle-privee.pem');
const PUBLIQUE = path.join(RACINE, 'signature-publique.pem');

function clePrivee() {
  if (!fs.existsSync(PRIVEE)) throw new Error(`Clé privée introuvable (${PRIVEE}). Lance d'abord : node scripts/cles.js creer`);
  return fs.readFileSync(PRIVEE, 'utf8');
}

function creer() {
  if (fs.existsSync(PRIVEE)) { console.log('✓ Les clés existent déjà : rien à faire.'); return; }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(DOSSIER, { recursive: true });
  fs.writeFileSync(PRIVEE, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(PUBLIQUE, publicKey.export({ type: 'spki', format: 'pem' }));
  fs.writeFileSync(path.join(DOSSIER, 'LISEZMOI.txt'), [
    'Clé privée de signature de Labo Élève / Labo Prof.',
    '',
    '- NE LA DONNE À PERSONNE et ne la mets jamais dans le dossier partagé du lycée.',
    '- Sauvegarde ce dossier (clé USB…) : sans elle, tu ne pourras plus publier de mise à jour',
    '  ni d\'outil signé, et il faudrait réinstaller l\'application sur tous les PC avec une nouvelle clé.',
    '',
  ].join('\r\n'));
  console.log('✓ Clés créées. Clé privée :', PRIVEE);
}

if (require.main === module) {
  if (process.argv[2] === 'creer') creer();
  else console.log('Usage : node scripts/cles.js creer');
}
module.exports = { clePrivee, PUBLIQUE };
