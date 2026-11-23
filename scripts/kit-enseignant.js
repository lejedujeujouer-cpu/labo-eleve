// Crée le kit pour un(e) collègue qui veut modifier Labo Élève / Labo Prof avec Claude et le tester chez lui (elle).
// Usage : npm run kit   →   kit-enseignant/Labo-kit-<version>-<date>.zip
// Le kit contient le projet SANS la clé privée (cles-signature/) : il ne permet pas de publier une mise à jour.
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { RACINE, FICHIER_REFERENCE, listerFichiers, empreintes, horodatage } = require('./kit-commun');

const version = require(path.join(RACINE, 'package.json')).version;
const fichiers = listerFichiers();
const reference = { version, date: new Date().toISOString(), fichiers: empreintes() };

const LISEZMOI = `KIT ENSEIGNANT — Labo Élève / Labo Prof (version ${version})
===============================================================

Ce dossier est une copie du projet pour essayer tes propres modifications, avec Claude,
sur TON ordinateur. Rien de ce que tu fais ici n'arrive chez les élèves.

1. Une seule fois : installe Node.js (version « LTS ») depuis https://nodejs.org
   Puis, dans ce dossier, ouvre un terminal et tape :   npm install

2. Fais tes modifications avec Claude (application Claude, onglet « Code », en ouvrant ce dossier).

3. Teste :
     npm run test-prof     → Labo Prof en VERSION DE TEST
     npm run test-eleve    → Labo Élève en VERSION DE TEST
   La version de test a un bandeau orange « VERSION DE TEST » et ses propres données :
   elle ne touche pas à tes applications installées.
   ⚠ Dans les réglages (bouton « + »), choisis un dossier partagé DE TEST (un dossier vide sur ton PC),
     pas le vrai dossier du lycée.

4. Quand ça marche, envoie tes modifications :
     npm run envoyer -- "Ton nom" "Ce que tu as changé"
   Le fichier créé dans « modifications-a-envoyer » est à envoyer au responsable de l'application.
   Il ne contient que les fichiers que tu as ajoutés, modifiés ou supprimés.

Le responsable examine tes modifications et décide de les publier (ou non) pour tout le monde.
Ne change pas le numéro de version dans package.json.
`;

const zip = new AdmZip();
for (const rel of fichiers) zip.addFile(`Labo-kit/${rel}`, fs.readFileSync(path.join(RACINE, rel)));
zip.addFile(`Labo-kit/${FICHIER_REFERENCE}`, Buffer.from(JSON.stringify(reference, null, 2)));
zip.addFile('Labo-kit/LISEZMOI-KIT.txt', Buffer.from(LISEZMOI.replace(/\n/g, '\r\n')));
const sortie = path.join(RACINE, 'kit-enseignant');
fs.mkdirSync(sortie, { recursive: true });
const cible = path.join(sortie, `Labo-kit-${version}-${horodatage()}.zip`);
zip.writeZip(cible);
console.log(`✓ Kit créé : ${cible}`);
console.log(`  ${fichiers.length} fichiers, sans la clé de signature. À donner au collègue (clé USB, ENT…).`);
