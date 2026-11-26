// Dossier partagé sur Nuage (apps.education.fr, Nextcloud) par un simple lien de partage — sans compte pour les élèves.
// Chaque PC garde une copie locale (le « miroir ») : toute l'application lit et écrit dans ce miroir, comme dans un
// dossier partagé ordinaire, et ce module le synchronise avec Nuage (WebDAV du lien public).
//   - toutes les 20 s, et 1,5 s après chaque écriture locale ;
//   - sans réseau, rien n'est perdu : les changements partent au retour de la connexion ;
//   - le lien n'a pas le droit « Supprimer » (conseillé) : une suppression locale est notée dans .labo-supprimes.json,
//     que tous les PC respectent ; un fichier « caché » par quelqu'un (déplacé) est renvoyé par le PC qui l'a.
const fs = require('fs');
const path = require('path');

const INTERVALLE = 20000;
const IGNORER = /(^|\/)(\.labo-etat\.json|\.labo-temoin\.json|~\$[^/]*|[^/]*\.tmp|Thumbs\.db|desktop\.ini|\.DS_Store)$/i;
const TOMBES = '.labo-supprimes.json';

// « https://nuage06.apps.education.fr/index.php/s/AbCd123 » → { base, jeton }
function analyserLien(lien) {
  const m = /^(https:\/\/[a-z0-9.-]+(?::\d+)?)(?:\/index\.php)?\/s\/([A-Za-z0-9]{6,64})\/?(?:[?#].*)?$/i.exec(String(lien || '').trim());
  if (!m) return null;
  return { base: m[1], jeton: m[2], lien: `${m[1]}/index.php/s/${m[2]}` };
}

// trousseau (chiffrement.js) : les fichiers personnels des élèves partent chiffrés et ne sont déchiffrés que sur les PC autorisés
function creerNuage({ dossierDonnees, journal = () => {}, trousseau = null }) {
  let conf = null; // { base, jeton, lien, mdp }
  let minuterie = null, attente = null, enCours = null, relancer = false, surveillant = null;
  const etat = { derniere: null, erreur: null, envoyes: 0, recus: 0, horsLigne: false, attente: 0, chiffres: 0 };
  const ecouteurs = new Set();

  const miroir = () => (conf ? path.join(dossierDonnees(), 'nuage', conf.jeton) : null);
  const fichierEtat = () => path.join(dossierDonnees(), 'nuage', conf.jeton + '.etat.json');
  const lireEtat = () => { try { return JSON.parse(fs.readFileSync(fichierEtat(), 'utf8')); } catch { return { racine: null, fichiers: {} }; } };
  const ecrireEtat = (e) => { fs.mkdirSync(path.dirname(fichierEtat()), { recursive: true }); fs.writeFileSync(fichierEtat(), JSON.stringify(e)); };

  // ---------- WebDAV du lien public ----------
  const urlDe = (rel = '') => `${conf.base}/public.php/webdav/${rel.split('/').filter(Boolean).map(encodeURIComponent).join('/')}${rel.endsWith('/') ? '/' : ''}`;
  const entetes = (plus = {}) => ({ Authorization: 'Basic ' + Buffer.from(`${conf.jeton}:${conf.mdp || ''}`).toString('base64'), 'X-Requested-With': 'XMLHttpRequest', ...plus });
  async function requete(methode, rel, { corps, entetes: e = {}, delai = 30000 } = {}) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), delai);
    try { return await fetch(urlDe(rel), { method: methode, headers: entetes(e), body: corps, signal: ctrl.signal }); }
    finally { clearTimeout(t); }
  }
  const PROPS = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:getlastmodified/><d:getcontentlength/><d:resourcetype/></d:prop></d:propfind>';
  async function lister(profondeur) {
    const r = await requete('PROPFIND', '', { corps: PROPS, entetes: { Depth: profondeur, 'Content-Type': 'application/xml' }, delai: 60000 });
    if (r.status === 401 || r.status === 403) throw new Error('Accès refusé par Nuage : vérifie le lien (et son mot de passe).');
    if (r.status === 404) throw new Error('Lien Nuage introuvable : il a peut-être expiré ou été supprimé.');
    if (r.status !== 207) throw new Error(`Nuage a répondu ${r.status}.`);
    const xml = await r.text();
    const res = new Map();
    for (const bloc of xml.split(/<d:response>/).slice(1)) {
      const href = (/<d:href>([^<]*)<\/d:href>/.exec(bloc) || [])[1]; if (!href) continue;
      const rel = decodeURIComponent(href.replace(/^.*?\/public\.php\/webdav\/?/, '')).replace(/\/$/, '');
      const dossier = /<d:collection\s*\/>/.test(bloc);
      const etag = ((/<d:getetag>([^<]*)<\/d:getetag>/.exec(bloc) || [])[1] || '').replace(/&quot;|"/g, '');
      const modif = Date.parse((/<d:getlastmodified>([^<]*)<\/d:getlastmodified>/.exec(bloc) || [])[1] || '') || 0;
      res.set(rel, { dossier, etag, modif });
    }
    return res;
  }
  async function creerDossiers(rel, distants) {
    const parties = rel.split('/').slice(0, -1);
    for (let k = 1; k <= parties.length; k++) {
      const d = parties.slice(0, k).join('/');
      if (distants.has(d)) continue;
      const r = await requete('MKCOL', d + '/');
      if (![201, 405].includes(r.status)) throw Object.assign(new Error(`Création du dossier « ${d} » refusée (${r.status}).`), { http: r.status });
      distants.set(d, { dossier: true, etag: '', modif: Date.now() });
    }
  }

  // ---------- Copie locale ----------
  function parcourir(racine) {
    const res = new Map();
    const marcher = (dir, rel) => {
      let entrees = []; try { entrees = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entrees) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (IGNORER.test(r)) continue;
        const f = path.join(dir, e.name);
        if (e.isDirectory()) { res.set(r, { dossier: true }); marcher(f, r); }
        else if (e.isFile()) { try { const s = fs.statSync(f); res.set(r, { dossier: false, mtime: Math.round(s.mtimeMs), taille: s.size }); } catch { /* disparu */ } }
      }
    };
    marcher(racine, '');
    return res;
  }
  const local = (rel) => path.join(miroir(), ...rel.split('/'));

  // un fichier qui pose problème (introuvable, refusé) ne bloque pas les autres : noté, puis réessayé au cycle suivant
  let problemes = [];
  const sansBloquer = (f) => async (...a) => { try { return await f(...a); } catch (e) { if (!e.http) throw e; problemes.push(e.message); return undefined; } };
  const telecharger = sansBloquer(telechargerFichier);
  async function telechargerFichier(rel, d, connus) {
    const r = await requete('GET', rel, { delai: 120000 });
    if (r.status !== 200) throw Object.assign(new Error(`Téléchargement de « ${rel} » : ${r.status}.`), { http: r.status });
    let octets = Buffer.from(await r.arrayBuffer()), dest;
    if (trousseau && trousseau.estChiffre(octets)) {
      dest = trousseau.destinatairesDe(octets);
      const clair = trousseau.dechiffrer(octets, trousseau.mesCles());
      if (!clair) { connus[rel] = { etag: d.etag, ext: true }; return; } // pas pour ce PC : on ne le garde pas
      octets = clair;
    }
    const f = local(rel); fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, octets); fs.renameSync(tmp, f);
    const s = fs.statSync(f);
    connus[rel] = { etag: d.etag, mtime: Math.round(s.mtimeMs), taille: s.size, ...(dest ? { dest: dest.slice().sort() } : {}) };
    etat.recus++;
  }
  // fichier personnel → qui doit pouvoir le lire ? (null : fichier commun, envoyé en clair)
  const voulus = (rel) => (trousseau ? trousseau.destinataires(miroir(), rel) : null);
  const envoyer = sansBloquer(envoyerFichier);
  async function envoyerFichier(rel, l, connus, distants) {
    let corps = fs.readFileSync(local(rel)), dest;
    const v = voulus(rel);
    if (v) {
      if (!v.profs) { etat.attente++; return; } // la clé de l'enseignant n'est pas encore arrivée : on garde le fichier ici, en attendant
      corps = trousseau.chiffrer(corps, v.voulus); dest = v.voulus.map((x) => x.id).sort(); etat.chiffres++;
    }
    await creerDossiers(rel, distants);
    const r = await requete('PUT', rel, { corps, entetes: { 'Content-Type': 'application/octet-stream' }, delai: 180000 });
    if (![200, 201, 204].includes(r.status)) throw Object.assign(new Error(`Envoi de « ${rel} » : ${r.status}${r.status === 403 ? ' (le lien n’autorise pas la modification ?)' : ''}.`), { http: r.status });
    const etag = (r.headers.get('oc-etag') || r.headers.get('etag') || '').replace(/"/g, '');
    connus[rel] = { etag, mtime: l.mtime, taille: l.taille, ...(dest ? { dest } : {}) };
    etat.envoyes++;
  }

  // ---------- Une synchronisation complète ----------
  async function cycle() {
    if (!conf) return;
    fs.mkdirSync(miroir(), { recursive: true });
    problemes = [];
    const memo = lireEtat(); const connus = memo.fichiers || {};
    const locaux = parcourir(miroir());
    const changeLocal = [...locaux].some(([rel, l]) => !l.dossier && (!connus[rel] || connus[rel].mtime !== l.mtime || connus[rel].taille !== l.taille))
      || Object.keys(connus).some((rel) => !connus[rel].ext && !locaux.has(rel));
    etat.attente = 0;
    // rien de neuf ici ni là-bas : une seule petite requête
    const tete = await lister('0');
    const racineEtag = (tete.get('') || {}).etag;
    if (!changeLocal && racineEtag && racineEtag === memo.racine) { etat.derniere = new Date().toISOString(); etat.erreur = null; etat.horsLigne = false; return; }
    const distants = await lister('infinity'); distants.delete('');
    // suppressions décidées (par l'enseignant ou l'application) : fichier commun .labo-supprimes.json
    let tombes = {};
    try { if (distants.has(TOMBES)) { const r = await requete('GET', TOMBES); if (r.status === 200) tombes = JSON.parse(await r.text()) || {}; } } catch { tombes = {}; }
    let tombesModifiees = false;
    for (const rel of Object.keys(connus)) {
      if (locaux.has(rel) || rel === TOMBES || connus[rel].ext) continue; // ext : fichier d'un autre élève, jamais gardé ici
      // supprimé ici : on tente la suppression sur Nuage, sinon on le note pour les autres PC
      if (distants.has(rel)) {
        const r = await requete('DELETE', rel);
        if ([200, 204, 404].includes(r.status)) distants.delete(rel); else { tombes[rel] = Date.now(); tombesModifiees = true; }
      }
      delete connus[rel];
    }
    const enterre = (rel, d) => tombes[rel] && (!d || !d.modif || d.modif <= tombes[rel] + 2000);
    // de Nuage vers ce PC
    for (const [rel, d] of distants) {
      if (d.dossier || rel === TOMBES || IGNORER.test(rel)) continue;
      const l = locaux.get(rel), c = connus[rel];
      if (c && c.ext && c.etag === d.etag) continue; // toujours pas pour ce PC
      if (c && c.ext) { delete connus[rel]; await telecharger(rel, d, connus); continue; }
      if (enterre(rel, d)) { if (l) { try { fs.rmSync(local(rel), { force: true }); } catch { /* occupé */ } } delete connus[rel]; locaux.delete(rel); continue; }
      if (!l) { await telecharger(rel, d, connus); continue; }
      const modifLocale = !c || c.mtime !== l.mtime || c.taille !== l.taille;
      const modifDistante = !c || c.etag !== d.etag;
      if (modifDistante && !modifLocale) await telecharger(rel, d, connus);
      else if (modifDistante && modifLocale) { // modifié des deux côtés : le plus récent gagne
        if (d.modif > l.mtime) await telecharger(rel, d, connus); else await envoyer(rel, l, connus, distants);
      } else if (modifLocale) await envoyer(rel, l, connus, distants);
      else if (trousseau) { // inchangé : faut-il le rechiffrer ? (nouvelle clé d'élève ou d'enseignant, ou fichier encore en clair)
        const v = voulus(rel);
        if (v && v.profs && JSON.stringify(v.voulus.map((x) => x.id).sort()) !== JSON.stringify(c.dest || [])) await envoyer(rel, l, connus, distants);
      }
    }
    // de ce PC vers Nuage (nouveaux fichiers, ou fichiers disparus de Nuage : on les renvoie)
    for (const [rel, l] of locaux) {
      if (l.dossier || distants.has(rel) || rel === TOMBES) continue;
      if (tombes[rel]) { try { fs.rmSync(local(rel), { force: true }); } catch { /* occupé */ } delete connus[rel]; continue; }
      await envoyer(rel, l, connus, distants);
    }
    if (tombesModifiees) {
      const r = await requete('PUT', TOMBES, { corps: JSON.stringify(tombes), entetes: { 'Content-Type': 'application/json' } });
      if (![200, 201, 204].includes(r.status)) journal(`nuage : liste des suppressions non envoyée (${r.status})`);
    }
    const apres = await lister('0');
    if (problemes.length) { ecrireEtat({ racine: null, fichiers: connus }); etat.derniere = new Date().toISOString(); etat.horsLigne = false; etat.erreur = `${problemes.length} fichier(s) pas encore synchronisé(s) — nouvel essai bientôt (${problemes[0]})`; journal('nuage : ' + problemes.join(' ; ')); return; }
    ecrireEtat({ racine: (apres.get('') || {}).etag || null, fichiers: connus });
    etat.derniere = new Date().toISOString(); etat.erreur = null; etat.horsLigne = false;
  }

  async function synchroniserMaintenant() { return synchroniser(); }
  async function synchroniser() {
    if (!conf) return { ok: false, message: 'Aucun lien Nuage.' };
    if (enCours) { relancer = true; return enCours; }
    enCours = (async () => {
      try { await cycle(); }
      catch (e) {
        etat.erreur = e.name === 'AbortError' ? 'Nuage ne répond pas (réseau lent ?).' : e.message;
        etat.horsLigne = /fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|ne répond pas/i.test(etat.erreur + (e.cause ? e.cause.code : ''));
        journal(`nuage : ${etat.erreur}`);
      } finally {
        enCours = null;
        ecouteurs.forEach((f) => { try { f(infos()); } catch { /* fenêtre fermée */ } });
        if (relancer) { relancer = false; setTimeout(synchroniser, 300); }
      }
      return { ok: !etat.erreur, ...infos() };
    })();
    return enCours;
  }
  const bientot = () => { clearTimeout(attente); attente = setTimeout(synchroniser, 1500); };

  function arreter() {
    clearInterval(minuterie); clearTimeout(attente); minuterie = null;
    try { surveillant && surveillant.close(); } catch { /* déjà fermé */ } surveillant = null;
  }
  function demarrer(c) {
    arreter();
    conf = c && analyserLien(c.lien) ? { ...analyserLien(c.lien), mdp: c.mdp || '' } : null;
    if (!conf) return;
    fs.mkdirSync(miroir(), { recursive: true });
    try { surveillant = fs.watch(miroir(), { recursive: true }, (_t, nom) => { if (nom && !IGNORER.test(String(nom).replace(/\\/g, '/'))) bientot(); }); } catch { /* sans surveillance : la minuterie suffit */ }
    minuterie = setInterval(synchroniser, INTERVALLE);
    synchroniser();
  }
  const infos = () => ({ actif: !!conf, lien: conf ? conf.lien : null, miroir: miroir(), ...etat });

  // Vérifie un lien avant de l'enregistrer : lecture, écriture (petit fichier témoin)
  async function tester(c) {
    const a = analyserLien(c && c.lien);
    if (!a) return { ok: false, message: 'Ce n’est pas un lien de partage Nuage (il ressemble à https://nuage0X.apps.education.fr/s/…).' };
    const ancien = conf; conf = { ...a, mdp: (c && c.mdp) || '' };
    try {
      const l = await lister('1');
      const r = await requete('PUT', '.labo-temoin.json', { corps: JSON.stringify({ t: new Date().toISOString() }), entetes: { 'Content-Type': 'application/json' } });
      if (![200, 201, 204].includes(r.status)) return { ok: false, message: 'Ce lien ne permet pas d’écrire : dans Nuage, coche « Créer » et « Modifier » dans les permissions du lien.' };
      return { ok: true, lien: a.lien, vide: [...l.keys()].filter((k) => k && k !== '.labo-temoin.json').length === 0 };
    } catch (e) { return { ok: false, message: e.name === 'AbortError' ? 'Nuage ne répond pas.' : e.message }; }
    finally { conf = ancien; }
  }

  return { analyserLien, demarrer, arreter, synchroniser, tester, infos, miroir, surChangement: (f) => ecouteurs.add(f) };
}

module.exports = { creerNuage, analyserLien };
