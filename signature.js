// Signature des paquets (outils et mises à jour de l'application).
// Seul le PC du développeur possède la clé privée (dossier cles-signature/, jamais dans l'application) :
// il signe les outils (.outil) et les installeurs publiés. Labo Élève et Labo Prof contiennent seulement la
// clé publique (signature-publique.pem) et refusent ce qui vient du dossier partagé sans signature valide.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FICHIER_SIGNATURE = 'signature.sig';
const IGNORES = new Set([FICHIER_SIGNATURE]);

// Empreinte d'un dossier : liste triée « chemin relatif + SHA-256 de chaque fichier », puis SHA-256 du tout.
function empreinteDossier(dossier) {
  const lignes = [];
  const parcourir = (d) => {
    for (const x of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, x.name);
      const rel = path.relative(dossier, p).split(path.sep).join('/');
      if (x.isSymbolicLink()) throw new Error(`Lien symbolique refusé : ${rel}`);
      if (x.isDirectory()) parcourir(p);
      else if (x.isFile() && !IGNORES.has(rel)) lignes.push(`${rel}\0${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`);
    }
  };
  parcourir(dossier);
  lignes.sort();
  return crypto.createHash('sha256').update(lignes.join('\n')).digest('hex');
}

const empreinteFichier = (fichier) => crypto.createHash('sha256').update(fs.readFileSync(fichier)).digest('hex');

function signer(clePriveePem, donnees) {
  return crypto.sign(null, Buffer.from(donnees), crypto.createPrivateKey(clePriveePem)).toString('base64');
}
function verifier(clePubliquePem, donnees, signatureBase64) {
  try {
    if (!clePubliquePem || typeof signatureBase64 !== 'string') return false;
    return crypto.verify(null, Buffer.from(donnees), crypto.createPublicKey(clePubliquePem), Buffer.from(signatureBase64.trim(), 'base64'));
  } catch { return false; }
}

// Dossier d'outil signé ? (signature.sig = signature de « outil:<id>:<version>:<empreinte> »)
function dossierSigne(clePubliquePem, dossier, manifeste) {
  try {
    const sig = fs.readFileSync(path.join(dossier, FICHIER_SIGNATURE), 'utf8');
    return verifier(clePubliquePem, `outil:${manifeste.id}:${manifeste.version}:${empreinteDossier(dossier)}`, sig);
  } catch { return false; }
}
function signerDossier(clePriveePem, dossier, manifeste) {
  fs.rmSync(path.join(dossier, FICHIER_SIGNATURE), { force: true });
  const sig = signer(clePriveePem, `outil:${manifeste.id}:${manifeste.version}:${empreinteDossier(dossier)}`);
  fs.writeFileSync(path.join(dossier, FICHIER_SIGNATURE), sig + '\n');
}

module.exports = { empreinteDossier, empreinteFichier, signer, verifier, dossierSigne, signerDossier, FICHIER_SIGNATURE };
