// Suivi en direct : quel élève est connecté sur quel ordinateur.
// - Sur le PC du professeur (espace professeur déverrouillé), un petit serveur écoute sur le réseau
//   du lycée ; son adresse est déposée dans <dossier partagé>/Classes/suivi.json.
// - Chaque PC élève identifié envoie un signal toutes les 15 s : « je suis tel PC, avec tel élève ».
// - Le professeur voit les connexions, est alerté si un même élève est sur deux PC, et peut
//   déconnecter un PC : celui-ci revient alors à l'écran d'identification.
// Les PC élèves n'écrivent rien dans le dossier partagé.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const PORTS = [47801, 47802, 47803, 47804, 47805];
const INTERVALLE_MS = 15_000;
const HORS_LIGNE_MS = 45_000;
const ID_ELEVE = /^[a-f0-9]{8}$/;
const ID_CLASSE = /^[a-z0-9-]{1,60}$/;
const ID_POSTE = /^[a-f0-9]{24}$/;

function creerSuivi({ app, ipcMain, obtenirFenetre, racineClasses, estProfDeverrouille, surDeconnexion = () => {}, enExamen = () => false }) {
  const lireJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  // Un fichier de suivi par enseignant (plusieurs enseignants peuvent suivre leurs classes en même temps).
  // L'ancien compte unique garde les noms d'origine (compatibles avec les versions précédentes).
  const nomFichier = (base, profId) => (!profId || profId === 'prof-historique' ? `${base}.json` : `${base}-${profId}.json`);
  let profServeur = null; // compte de l'enseignant dont ce PC fait tourner le suivi
  const fichierSuiviPour = (profId) => { const r = racineClasses(); return r ? path.join(r, nomFichier('suivi', profId)) : null; };
  const fichierSuivi = () => fichierSuiviPour(profServeur);

  // ---------- Identifiant de l'ordinateur ----------
  // Empreinte de l'identifiant Windows de la machine (MachineGuid) : stable même si l'application
  // est réinstallée. Seule l'empreinte circule, jamais l'identifiant lui-même.
  let posteCache = null;
  function idPoste() {
    if (posteCache) return posteCache;
    let source = process.env.LABO_POSTE_ID || null; // permet de simuler plusieurs PC pendant les tests
    if (!source && process.platform === 'win32') {
      try {
        const sortie = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
        source = (/MachineGuid\s+REG_SZ\s+([0-9a-f-]+)/i.exec(sortie) || [])[1] || null;
      } catch { source = null; }
    }
    if (!source) { // repli : identifiant aléatoire gardé dans les données de l'application
      const f = path.join(app.getPath('userData'), 'poste.json');
      source = lireJson(f, {}).id;
      if (!source) { source = crypto.randomUUID(); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ id: source })); }
    }
    posteCache = crypto.createHash('sha256').update('labo-eleve:' + source).digest('hex').slice(0, 24);
    return posteCache;
  }
  const nomPoste = () => String(process.env.LABO_POSTE_NOM || os.hostname()).slice(0, 60);

  // =====================================================================
  // Côté professeur : serveur de suivi
  // =====================================================================
  let serveur = null, port = null, jeton = null, erreurServeur = null;
  const connexions = new Map(); // `${eleveId}|${poste}` -> connexion
  const refus = new Map();      // `${eleveId}|${poste}` -> { nom, nomPoste } : PC déconnecté par le professeur

  // Ordinateurs connus : à quel élève appartient chaque PC (mémorisé d'une séance à l'autre).
  // Si un PC réapparaît avec un autre nom sans que le professeur l'ait libéré, c'est signalé.
  const connus = new Map();     // poste -> { eleveId, classeId, nom, classe, nomPoste, depuis }
  const fichierConnus = () => { const r = racineClasses(); return r ? path.join(r, nomFichier('postes-connus', profServeur)) : null; };
  let cleLiberation = null;     // dérivée du mot de passe professeur, en mémoire seulement
  const deriverCle = (mdp) => crypto.scryptSync(String(mdp), 'labo-eleve-liberation', 32);
  const preuve = (cle, poste, date) => crypto.createHmac('sha256', cle).update(`${poste}|${date}`).digest('hex');

  // On part de ses propres postes connus, complétés par ceux des collègues (co-enseignants d'une même
  // classe : un PC déjà vu par l'un est reconnu par l'autre). L'association la plus récente l'emporte.
  function chargerConnus() {
    connus.clear();
    const r = racineClasses();
    let fichiers = [];
    try { fichiers = fs.readdirSync(r).filter((x) => /^postes-connus(-[a-z0-9-]+)?\.json$/.test(x)).map((x) => path.join(r, x)); } catch { /* dossier inaccessible */ }
    for (const f of fichiers) {
      for (const [poste, c] of Object.entries(lireJson(f, {}) || {})) {
        if (!ID_POSTE.test(poste) || !c || !c.eleveId) continue;
        const actuel = connus.get(poste);
        if (!actuel || Date.parse(c.depuis || 0) > Date.parse(actuel.depuis || 0)) connus.set(poste, c);
      }
    }
  }
  function sauverConnus() {
    const f = fichierConnus();
    if (!f) return;
    try {
      const tmp = `${f}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(connus), null, 2));
      fs.renameSync(tmp, f);
    } catch { /* dossier momentanément inaccessible */ }
  }
  function associer(poste, d) {
    connus.set(poste, { eleveId: d.eleveId, classeId: d.classeId, nom: texte(d.nom, 60), classe: texte(d.classe, 40), nomPoste: texte(d.nomPoste, 60), depuis: new Date().toISOString() });
    sauverConnus();
  }
  // Le professeur a libéré ce PC sur place (mot de passe) après la dernière association ?
  function liberationValide(d, connu) {
    const l = d.liberation;
    if (!cleLiberation || !l || typeof l.date !== 'string' || typeof l.preuve !== 'string') return false;
    if (!(new Date(l.date) > new Date(connu.depuis))) return false;
    const attendue = preuve(cleLiberation, d.poste, l.date);
    return l.preuve.length === attendue.length && crypto.timingSafeEqual(Buffer.from(l.preuve), Buffer.from(attendue));
  }

  function adressesLocales() {
    const liste = [];
    for (const interfaces of Object.values(os.networkInterfaces())) {
      for (const i of interfaces || []) if (i.family === 'IPv4' && !i.internal) liste.push(i.address);
    }
    return [...liste, '127.0.0.1'];
  }
  const texte = (v, max = 80) => String(v ?? '').slice(0, max);

  // Journal de la séance : fermetures, fermetures forcées et sorties envoyées par les PC élèves.
  const TYPES_EVENEMENTS = ['fermeture', 'fermeture-forcee', 'sortie', 'reseau', 'examen-leve', 'fermeture-urgence', 'examen-local'];
  let journal = [];
  let numeroEvenement = 0;
  const evenementsRecus = new Set();
  function recevoirEvenements(d) {
    if (!Array.isArray(d.evenements)) return false;
    let ferme = false;
    for (const ev of d.evenements.slice(0, 50)) {
      if (!ev || !TYPES_EVENEMENTS.includes(ev.type) || Number.isNaN(Date.parse(ev.a))) continue;
      const idEv = `${d.poste}|${String(ev.id || '').slice(0, 20)}|${ev.type}|${ev.a}`;
      if (evenementsRecus.has(idEv)) continue; // déjà reçu (signal envoyé deux fois)
      evenementsRecus.add(idEv);
      journal.unshift({
        n: ++numeroEvenement, type: ev.type, a: new Date(ev.a).toISOString(), dureeMs: Number(ev.dureeMs) || 0,
        nom: texte(d.nom, 60), classe: texte(d.classe, 40), classeId: d.classeId, eleveId: d.eleveId, nomPoste: texte(d.nomPoste, 60), examen: !!ev.examen,
      });
      if (ev.type === 'fermeture') ferme = true;
    }
    if (journal.length > 300) journal = journal.slice(0, 300);
    return ferme;
  }

  function traiterSignal(d) {
    if (!d || d.jeton !== jeton || !ID_POSTE.test(d.poste) || !ID_ELEVE.test(d.eleveId) || !ID_CLASSE.test(d.classeId)) return { statut: 400, corps: { ok: false } };
    const cle = `${d.eleveId}|${d.poste}`;
    if (refus.has(cle)) {
      connexions.delete(cle);
      return { statut: 200, corps: { ok: true, deconnecter: true, message: 'Ton professeur a déconnecté ce compte sur cet ordinateur. Choisis ton propre nom.' } };
    }
    // Ce PC appartenait-il à un autre élève ?
    let ancien = null;
    const connu = connus.get(d.poste);
    if (!connu) associer(d.poste, d); // premier passage de ce PC
    else if (connu.eleveId !== d.eleveId) {
      if (liberationValide(d, connu)) associer(d.poste, d); // libéré par le professeur : normal
      else ancien = { nom: connu.nom, classe: connu.classe, depuis: connu.depuis };
    }
    // Un ordinateur n'a qu'un élève à la fois : on oublie l'élève précédent de ce PC.
    for (const [k, c] of connexions) if (c.poste === d.poste && k !== cle) connexions.delete(k);
    const avant = connexions.get(cle);
    connexions.set(cle, {
      poste: d.poste, nomPoste: texte(d.nomPoste, 60), classeId: d.classeId, classe: texte(d.classe, 40),
      eleveId: d.eleveId, nom: texte(d.nom, 60), depuis: avant ? avant.depuis : Date.now(), vu: Date.now(), ancien, examen: !!d.examen,
    });
    // L'élève a fermé l'application : il n'est plus connecté.
    if (recevoirEvenements(d)) connexions.delete(cle);
    return { statut: 200, corps: { ok: true } };
  }

  function ecouter(i = 0) {
    return new Promise((resoudre) => {
      if (i >= PORTS.length) { erreurServeur = 'Aucun port réseau disponible.'; return resoudre(false); }
      const s = http.createServer((req, res) => {
        const repondre = (statut, corps) => { res.writeHead(statut, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corps)); };
        if (req.method !== 'POST' || req.url !== '/labo-eleve/signal') return repondre(404, { ok: false });
        let brut = '';
        req.on('data', (morceau) => { brut += morceau; if (brut.length > 4096) req.destroy(); });
        req.on('end', () => {
          let d = null;
          try { d = JSON.parse(brut); } catch { /* ignoré */ }
          const r = traiterSignal(d);
          repondre(r.statut, r.corps);
        });
      });
      s.once('error', () => resoudre(ecouter(i + 1)));
      s.listen(PORTS[i], '0.0.0.0', () => { serveur = s; port = PORTS[i]; resoudre(true); });
    });
  }

  async function demarrer(mdp, profId = null) {
    if (serveur && profId !== profServeur) arreter(); // autre enseignant connecté sur ce PC
    profServeur = profId;
    if (mdp) cleLiberation = deriverCle(mdp);
    if (serveur || !fichierSuivi()) return;
    chargerConnus();
    erreurServeur = null;
    jeton = crypto.randomBytes(16).toString('hex');
    if (!(await ecouter())) return;
    try {
      fs.writeFileSync(fichierSuivi(), JSON.stringify({ adresses: adressesLocales(), port, jeton, nomPoste: nomPoste(), demarre: new Date().toISOString() }, null, 2));
    } catch (e) { erreurServeur = `Impossible d'écrire dans le dossier partagé : ${e.message}`; }
  }
  function arreter() {
    if (!serveur) return;
    serveur.close();
    serveur = null;
    cleLiberation = null;
    try { const f = fichierSuivi(); if (f && lireJson(f, {}).jeton === jeton) fs.rmSync(f, { force: true }); } catch { /* ignoré */ }
    jeton = null;
  }
  app.on('will-quit', arreter);

  function etatProf() {
    const maintenant = Date.now();
    for (const [k, c] of connexions) {
      if (maintenant - c.vu <= HORS_LIGNE_MS) continue;
      // Un élève en examen ne répond plus (réseau coupé ?) : alerte dans le journal de la séance.
      if (c.examen) {
        journal.unshift({ n: ++numeroEvenement, type: 'perdu-examen', a: new Date(c.vu).toISOString(), dureeMs: 0, nom: c.nom, classe: c.classe, classeId: c.classeId, eleveId: c.eleveId, nomPoste: c.nomPoste, examen: true });
      }
      connexions.delete(k);
    }
    return {
      actif: !!serveur, port, adresses: serveur ? adressesLocales() : [], erreur: erreurServeur,
      connexions: [...connexions.values()].map(({ poste, ...c }) => ({ ...c, poste })),
      refus: [...refus.entries()].map(([cle, r]) => ({ cle, ...r })),
      journal,
    };
  }

  // =====================================================================
  // Côté élève : signal régulier vers le PC du professeur
  // =====================================================================
  let eleve = null;
  let minuterie = null;
  const adresseQuiMarche = new Map(); // enseignant -> dernière adresse qui a répondu

  // Les événements attendent dans un fichier tant que le PC du professeur ne les a pas reçus.
  const fichierAttente = () => path.join(app.getPath('userData'), 'evenements-en-attente.json');
  function ajouterEvenement(ev, envoyerTout = true) {
    const liste = lireJson(fichierAttente(), []);
    liste.push({ id: crypto.randomBytes(6).toString('hex'), type: ev.type, a: ev.a || new Date().toISOString(), dureeMs: ev.dureeMs || 0, examen: ev.examen === undefined ? enExamen() : !!ev.examen });
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(fichierAttente(), JSON.stringify(liste.slice(-100)));
    if (eleve && envoyerTout) envoyerSignal();
  }

  // Coupures réseau : notées sur le PC, signalées au professeur dès que la connexion revient
  // (un élève ne peut donc pas couper son Wi-Fi en toute discrétion).
  const fichierCoupure = () => path.join(app.getPath('userData'), 'coupure.json');
  const fichierDernierSignal = () => path.join(app.getPath('userData'), 'dernier-signal.json');
  const DUREE_COUPURE_MIN_MS = 40_000; // en dessous : simple signal manqué
  function noterEchec(info) {
    const r = racineClasses();
    // Dossier partagé lisible mais aucun professeur en ligne : ce n'est pas une coupure côté élève.
    if (!info && r && fs.existsSync(r)) return;
    const c = lireJson(fichierCoupure(), null);
    if (c) { if (enExamen() && !c.examen) fs.writeFileSync(fichierCoupure(), JSON.stringify({ ...c, examen: true })); return; }
    const dernier = lireJson(fichierDernierSignal(), null);
    // Seulement si le PC était relié au professeur juste avant (pas le soir, à la maison).
    if (!dernier || Date.now() - Date.parse(dernier.a) > 2 * 60_000) return;
    fs.writeFileSync(fichierCoupure(), JSON.stringify({ debut: dernier.a, examen: enExamen() || !!dernier.examen }));
  }
  function noterReussite() {
    fs.writeFileSync(fichierDernierSignal(), JSON.stringify({ a: new Date().toISOString(), examen: enExamen() }));
    const c = lireJson(fichierCoupure(), null);
    if (!c) return;
    fs.rmSync(fichierCoupure(), { force: true });
    const duree = Date.now() - Date.parse(c.debut);
    if (duree > DUREE_COUPURE_MIN_MS) {
      ajouterEvenement({ type: 'reseau', a: c.debut, dureeMs: duree, examen: c.examen }, false);
      setTimeout(envoyerSignal, 300); // le professeur l'apprend tout de suite
    }
  }

  // Envoie le signal à un enseignant (son PC fait tourner le suivi) ; renvoie sa réponse, ou null.
  async function signalVers(profId, info, donnees) {
    const corps = JSON.stringify({ ...donnees, jeton: info.jeton });
    const adresses = [...new Set([adresseQuiMarche.get(profId), ...info.adresses].filter(Boolean))];
    for (const a of adresses) {
      try {
        const r = await fetch(`http://${a}:${info.port}/labo-eleve/signal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps, signal: AbortSignal.timeout(2500) });
        const reponse = await r.json();
        adresseQuiMarche.set(profId, a);
        return reponse;
      } catch { /* adresse suivante */ }
    }
    return null;
  }
  async function envoyerSignal() {
    if (!eleve) return false;
    // Le signal va à tous les enseignants de la classe (propriétaire et co-enseignants) qui suivent en direct.
    const profIds = [...new Set(Array.isArray(eleve.profIds) && eleve.profIds.length ? eleve.profIds : [eleve.profId])];
    const cibles = profIds.map((id) => ({ id, info: fichierSuiviPour(id) && lireJson(fichierSuiviPour(id), null) }))
      .filter((x) => x.info && x.info.port && Array.isArray(x.info.adresses));
    if (!cibles.length) { noterEchec(null); return false; } // pas de professeur en ligne, ou pas de réseau
    const evenements = lireJson(fichierAttente(), []);
    const liberation = lireJson(path.join(app.getPath('userData'), 'liberation.json'), null);
    const donnees = { poste: idPoste(), nomPoste: nomPoste(), classeId: eleve.classeId, classe: eleve.classe, eleveId: eleve.eleveId, nom: eleve.nom, liberation, evenements, examen: enExamen() };
    const reponses = await Promise.all(cibles.map((x) => signalVers(x.id, x.info, donnees)));
    const recues = reponses.filter(Boolean);
    if (!recues.length) { noterEchec(cibles[0].info); return false; }
    if (recues.some((r) => r.ok)) noterReussite();
    // Événements bien reçus : on les retire de la file (sans perdre ceux arrivés entre-temps).
    if (recues.some((r) => r.ok) && evenements.length) {
      const envoyes = new Set(evenements.map((x) => x.id));
      const restants = lireJson(fichierAttente(), []).filter((x) => !envoyes.has(x.id));
      fs.writeFileSync(fichierAttente(), JSON.stringify(restants));
    }
    const deconnexion = recues.find((r) => r.deconnecter);
    if (deconnexion && eleve) {
      const classeId = eleve.classeId;
      eleve = null;
      surDeconnexion(classeId); // efface l'inscription de l'élève dans cette classe, sur ce PC
      const f = obtenirFenetre();
      if (f && !f.isDestroyed()) f.webContents.send('suivi:deconnecte', { message: deconnexion.message });
    }
    return true;
  }

  // Fermeture confirmée par l'élève : on prévient le professeur avant de quitter (3 s au plus).
  async function signalerFermeture() {
    ajouterEvenement({ type: 'fermeture' }, false);
    fs.rmSync(fichierDernierSignal(), { force: true }); // fermeture normale : pas de « coupure » jusqu'au prochain cours
    await Promise.race([envoyerSignal(), new Promise((r) => setTimeout(r, 3000))]);
  }

  // Le professeur libère ce PC sur place : preuve signée avec une clé tirée de son mot de passe.
  // Un élève ne peut pas la fabriquer, même en supprimant les fichiers de l'application.
  function enregistrerLiberation(mdp) {
    const date = new Date().toISOString();
    const f = path.join(app.getPath('userData'), 'liberation.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ date, preuve: preuve(deriverCle(mdp), idPoste(), date) }));
  }

  function definirEleve(ident) {
    eleve = ident;
    clearInterval(minuterie);
    if (eleve) { envoyerSignal(); minuterie = setInterval(envoyerSignal, INTERVALLE_MS); }
  }

  // ---------- IPC (professeur) ----------
  function enregistrerIPC() {
    const prof = (fn) => (...args) => (estProfDeverrouille() ? fn(...args) : { ok: false, message: 'Espace professeur verrouillé.' });
    ipcMain.handle('suivi:etat', prof(() => ({ ok: true, ...etatProf() })));
    ipcMain.handle('suivi:deconnecter', prof((_e, eleveId, poste) => {
      const c = connexions.get(`${eleveId}|${poste}`);
      if (!c) return { ok: false, message: 'Cette connexion n\'existe plus.' };
      refus.set(`${eleveId}|${poste}`, { nom: c.nom, nomPoste: c.nomPoste, classe: c.classe });
      connexions.delete(`${eleveId}|${poste}`);
      return { ok: true };
    }));
    ipcMain.handle('suivi:autoriser', prof((_e, cle) => { refus.delete(String(cle)); return { ok: true }; }));
    // « C'est normal » : ce PC appartient désormais à l'élève connecté.
    ipcMain.handle('suivi:accepter', prof((_e, poste) => {
      const c = [...connexions.values()].find((x) => x.poste === poste);
      if (!c) return { ok: false, message: 'Cet ordinateur n\'est plus connecté.' };
      associer(poste, c);
      c.ancien = null;
      return { ok: true };
    }));
  }

  return { demarrer, arreter, definirEleve, enregistrerIPC, enregistrerLiberation, ajouterEvenement, signalerFermeture };
}

module.exports = { creerSuivi };
