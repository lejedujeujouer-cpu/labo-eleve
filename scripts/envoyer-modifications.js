// (Dans le kit enseignant) Regroupe les fichiers ajoutés, modifiés ou supprimés depuis le kit dans un seul .zip à envoyer.
// Usage : npm run envoyer -- "Ton nom" "Ce que tu as changé"
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { RACINE, FICHIER_REFERENCE, empreintes, horodatage, nomSur } = require('./kit-commun');

const [, , auteur = '', description = ''] = process.argv;
if (!auteur) { console.error('Usage : npm run envoyer -- "Ton nom" "Ce que tu as changé"'); process.exit(1); }
let reference;
try { reference = JSON.parse(fs.readFileSync(path.join(RACINE, FICHIER_REFERENCE), 'utf8')); }
catch { console.error(`✗ ${FICHIER_REFERENCE} introuvable : cette commande se lance dans le dossier du kit enseignant.`); process.exit(1); }

const actuel = empreintes();
const base = reference.fichiers || {};
const ajoutes = Object.keys(actuel).filter((f) => !(f in base));
const modifies = Object.keys(actuel).filter((f) => f in base && base[f] !== actuel[f]);
const supprimes = Object.keys(base).filter((f) => !(f in actuel));
if (!ajoutes.length && !modifies.length && !supprimes.length) { console.log('Aucune modification par rapport au kit : rien à envoyer.'); process.exit(0); }

const infos = {
  auteur, description, versionBase: reference.version, dateKit: reference.date, date: new Date().toISOString(),
  ajoutes, modifies: modifies.map((f) => ({ fichier: f, avant: base[f] })), supprimes: supprimes.map((f) => ({ fichier: f, avant: base[f] })),
};
const zip = new AdmZip();
for (const f of [...ajoutes, ...modifies]) zip.addFile(`fichiers/${f}`, fs.readFileSync(path.join(RACINE, f)));
zip.addFile('modifications.json', Buffer.from(JSON.stringify(infos, null, 2)));
const sortie = path.join(RACINE, 'modifications-a-envoyer');
fs.mkdirSync(sortie, { recursive: true });
const cible = path.join(sortie, `Modifications-${nomSur(auteur)}-${horodatage()}.zip`);
zip.writeZip(cible);
console.log(`✓ Fichier prêt à envoyer : ${cible}`);
console.log(`  ${ajoutes.length} ajouté(s), ${modifies.length} modifié(s), ${supprimes.length} supprimé(s).`);
for (const f of ajoutes) console.log('  + ' + f);
for (const f of modifies) console.log('  ~ ' + f);
for (const f of supprimes) console.log('  - ' + f);
