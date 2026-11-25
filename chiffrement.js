// Chiffrement des données personnelles des élèves dans le dossier partagé sur Nuage.
// Sur chaque PC, le dossier partagé (copie locale) reste en clair ; sur Nuage, les fichiers personnels sont chiffrés :
//   - copies, sujets individuels, corrections, notes, travaux rendus et remarques, suivi d'entraînement,
//     « Copies des élèves » : lisibles seulement par l'élève concerné et les enseignants de la classe ;
//   - liste des postes connus d'un enseignant : lisible par lui seul.
// Les autres fichiers (thèmes, sujets communs, documents, listes de classe) restent lisibles par la classe.
// Clés : X25519 ; contenu en AES-256-GCM ; la clé du contenu est « emballée » pour chaque destinataire.
// Clé privée : sur le PC, protégée par Windows (safeStorage) ; l'enseignant peut la sauvegarder dans un fichier à mot de passe.
// Clés publiques : Classes/cles/prof-<compte>.json et Classes/<classe>/cles/<élève>.json (en clair, dans le dossier).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAGIQUE = Buffer.from('LABOCHIF1\n');
const COMPTE_HISTORIQUE = 'prof-historique';
const b64 = (b) => Buffer.from(b).toString('base64');

// ---------- Primitives ----------
function genererPaire() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  return { pub: b64(publicKey.export({ type: 'spki', format: 'der' })), priv: b64(privateKey.export({ type: 'pkcs8', format: 'der' })) };
}
const clePub = (p) => crypto.createPublicKey({ key: Buffer.from(p, 'base64'), type: 'spki', format: 'der' });
const clePriv = (p) => crypto.createPrivateKey({ key: Buffer.from(p, 'base64'), type: 'pkcs8', format: 'der' });
const kek = (secret, sel, id) => Buffer.from(crypto.hkdfSync('sha256', secret, sel, Buffer.from('labo-v1|' + id), 32));
function aes(cle, donnees) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', cle, iv); const x = Buffer.concat([c.update(donnees), c.final()]); return { iv, x, tag: c.getAuthTag() }; }
function aesInv(cle, iv, x, tag) { const d = crypto.createDecipheriv('aes-256-gcm', cle, iv); d.setAuthTag(tag); return Buffer.concat([d.update(x), d.final()]); }

const estChiffre = (o) => Buffer.isBuffer(o) && o.length > MAGIQUE.length + 4 && o.subarray(0, MAGIQUE.length).equals(MAGIQUE);
// destinataires : [{ id, pub }]
function chiffrer(octets, destinataires) {
  const k = crypto.randomBytes(32);
  const corps = aes(k, octets);
  const d = destinataires.map(({ id, pub }) => {
    const eph = crypto.generateKeyPairSync('x25519');
    const ephPub = eph.publicKey.export({ type: 'spki', format: 'der' });
    const secret = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: clePub(pub) });
    const w = aes(kek(secret, ephPub, id), k);
    return { id, e: b64(ephPub), iv: b64(w.iv), t: b64(w.tag), k: b64(w.x) };
  });
  const tete = Buffer.from(JSON.stringify({ v: 1, iv: b64(corps.iv), t: b64(corps.tag), d }));
  const l = Buffer.alloc(4); l.writeUInt32BE(tete.length);
  return Buffer.concat([MAGIQUE, l, tete, corps.x]);
}
function lireTete(o) {
  const n = o.readUInt32BE(MAGIQUE.length), debut = MAGIQUE.length + 4;
  return { tete: JSON.parse(o.subarray(debut, debut + n).toString('utf8')), corps: o.subarray(debut + n) };
}
const destinatairesDe = (o) => { try { return lireTete(o).tete.d.map((x) => x.id); } catch { return []; } };
// cles : [{ id, priv }] → octets en clair, ou null si ce fichier n'est pas pour ce PC
function dechiffrer(o, cles) {
  const { tete, corps } = lireTete(o);
  for (const { id, priv } of cles) {
    const x = tete.d.find((y) => y.id === id); if (!x) continue;
    try {
      const ephPub = Buffer.from(x.e, 'base64');
      const secret = crypto.diffieHellman({ privateKey: clePriv(priv), publicKey: clePub(x.e) });
      const k = aesInv(kek(secret, ephPub, id), Buffer.from(x.iv, 'base64'), Buffer.from(x.k, 'base64'), Buffer.from(x.t, 'base64'));
      return aesInv(k, Buffer.from(tete.iv, 'base64'), corps, Buffer.from(tete.t, 'base64'));
    } catch { /* clé suivante */ }
  }
  return null;
}

// ---------- Sauvegarde de la clé de l'enseignant (fichier protégé par un mot de passe) ----------
function exporterCle(cle, mdp) {
  const sel = crypto.randomBytes(16);
  const k = crypto.scryptSync(String(mdp), sel, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const w = aes(k, Buffer.from(JSON.stringify(cle)));
  return JSON.stringify({ type: 'cle-labo-nuage', v: 1, id: cle.id, sel: b64(sel), iv: b64(w.iv), t: b64(w.tag), x: b64(w.x) }, null, 1);
}
function importerCle(texte, mdp) {
  const f = JSON.parse(texte);
  if (f.type !== 'cle-labo-nuage') throw new Error('Ce fichier n’est pas une sauvegarde de clé Labo.');
  const k = crypto.scryptSync(String(mdp), Buffer.from(f.sel, 'base64'), 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  try { return JSON.parse(aesInv(k, Buffer.from(f.iv, 'base64'), Buffer.from(f.x, 'base64'), Buffer.from(f.t, 'base64')).toString('utf8')); }
  catch { throw new Error('Mot de passe incorrect.'); }
}

// ---------- Trousseau du PC et règles du dossier partagé ----------
// protection : { chiffrer(texte) → texte, dechiffrer(texte) → texte } (safeStorage de Windows), sinon en clair
function creerTrousseau({ dossierDonnees, protection = null, nomFichierSur = (x) => x }) {
  const fichier = () => path.join(dossierDonnees(), 'cles-nuage.json');
  const lire = () => { try { return JSON.parse(fs.readFileSync(fichier(), 'utf8')); } catch { return { cles: {} }; } };
  const ecrire = (t) => { fs.mkdirSync(path.dirname(fichier()), { recursive: true }); fs.writeFileSync(fichier(), JSON.stringify(t, null, 1)); };
  const proteger = (priv) => (protection ? { p: protection.chiffrer(priv) } : { c: priv });
  const ouvrir = (x) => (x.p && protection ? protection.dechiffrer(x.p) : x.c);
  let cache = null;
  const mesCles = () => { if (!cache) cache = Object.entries(lire().cles || {}).map(([id, x]) => { try { return { id, pub: x.pub, priv: ouvrir(x) }; } catch { return null; } }).filter((x) => x && x.priv); return cache; };

  // ma clé (créée au besoin) ; id = « prof:<compte> » ou « eleve:<classe>:<élève> »
  function assurer(id) {
    const t = lire(); t.cles = t.cles || {};
    if (!t.cles[id]) { const p = genererPaire(); t.cles[id] = { pub: p.pub, ...proteger(p.priv), date: new Date().toISOString() }; ecrire(t); cache = null; }
    return { id, pub: t.cles[id].pub };
  }
  function ajouter(cle) { const t = lire(); t.cles = t.cles || {}; t.cles[cle.id] = { pub: cle.pub, ...proteger(cle.priv), date: new Date().toISOString() }; ecrire(t); cache = null; }
  const cle = (id) => mesCles().find((x) => x.id === id) || null;

  // Publication des clés publiques dans le dossier partagé (copie locale)
  const fichierProf = (racine, compte) => path.join(racine, 'Classes', 'cles', `prof-${compte}.json`);
  const fichierEleve = (racine, classeId, eleveId) => path.join(racine, 'Classes', classeId, 'cles', `${eleveId}.json`);
  function publier(racine, id) {
    const c = assurer(id); const m = /^prof:(.+)$/.exec(id) || null, e = /^eleve:([^:]+):(.+)$/.exec(id) || null;
    const f = m ? fichierProf(racine, m[1]) : e ? fichierEleve(racine, e[1], e[2]) : null; if (!f) return;
    try { const x = JSON.parse(fs.readFileSync(f, 'utf8')); if (x.pub === c.pub) return; } catch { /* absente */ }
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ id, pub: c.pub, date: new Date().toISOString() }));
  }
  const lirePub = (f) => { try { const x = JSON.parse(fs.readFileSync(f, 'utf8')); return x && typeof x.pub === 'string' && x.pub.length > 40 ? x.pub : null; } catch { return null; } };

  // Règles : à qui appartient ce fichier ? → { eleve, classeId, prof } ou null (fichier commun, en clair)
  const lireClasse = (racine, classeId) => { try { return JSON.parse(fs.readFileSync(path.join(racine, 'Classes', classeId, 'classe.json'), 'utf8')); } catch { return null; } };
  function proprietaire(racine, rel) {
    const p = rel.split('/');
    if (p[0] !== 'Classes') return null;
    if (p.length === 2) { const m = /^postes-connus(?:-(.+))?\.json$/.exec(p[1]); return m ? { prof: m[1] || COMPTE_HISTORIQUE } : null; }
    const c = p[1], j = (x) => x.replace(/\.json$/, '');
    if (p[2] === 'evaluations' && p.length === 6 && ['copies', 'corrections', 'sujets'].includes(p[4]) && p[5].endsWith('.json')) return { classeId: c, eleve: j(p[5]) };
    if (p[2] === 'notes' && p.length === 4 && p[3].endsWith('.json')) return { classeId: c, eleve: j(p[3]) };
    if (p[2] === 'travaux' && p.length === 5 && p[4].endsWith('.json')) return { classeId: c, eleve: j(p[4]) };
    if (p[2] === 'travaux' && p.length === 6 && p[4] === 'retours' && p[5].endsWith('.json')) return { classeId: c, eleve: j(p[5]) };
    if (p[2] === 'entrainement' && p[3] === 'suivi' && p.length === 5) return { classeId: c, eleve: j(p[4]) };
    if (p[2] === 'Copies des élèves' && p.length >= 5) {
      const cl = lireClasse(racine, c); const e = cl && (cl.eleves || []).find((x) => nomFichierSur(x.nom) === p[3] || x.id === p[3]);
      return { classeId: c, eleve: e ? e.id : null, inconnu: !e };
    }
    return null;
  }
  // Destinataires voulus pour un fichier personnel : l'élève + les enseignants de la classe (ou l'enseignant seul)
  function destinataires(racine, rel) {
    const o = proprietaire(racine, rel); if (!o) return null;
    const ids = [];
    if (o.prof) ids.push(o.prof);
    else { const cl = lireClasse(racine, o.classeId); if (cl) ids.push(cl.profId || COMPTE_HISTORIQUE, ...(cl.coEnseignants || [])); }
    const d = [...new Set(ids)].map((p) => ({ id: 'prof:' + p, pub: lirePub(fichierProf(racine, p)) }));
    if (o.eleve) d.push({ id: `eleve:${o.classeId}:${o.eleve}`, pub: lirePub(fichierEleve(racine, o.classeId, o.eleve)) });
    return { voulus: d.filter((x) => x.pub), manquants: d.filter((x) => !x.pub).map((x) => x.id), profs: d.filter((x) => x.id.startsWith('prof:') && x.pub).length };
  }
  return { assurer, ajouter, cle, mesCles, publier, destinataires, proprietaire, chiffrer, dechiffrer, estChiffre, destinatairesDe, exporter: (id, mdp) => exporterCle(cle(id), mdp), importer: (texte, mdp) => { const c = importerCle(texte, mdp); ajouter(c); return c.id; } };
}

module.exports = { creerTrousseau, chiffrer, dechiffrer, estChiffre, genererPaire, destinatairesDe, exporterCle, importerCle };
