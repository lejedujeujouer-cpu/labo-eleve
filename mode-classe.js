// Mode classe : garde l'élève dans Labo Élève pendant la séance.
// - fenêtre plein écran verrouillée, toujours au premier plan, impossible à fermer ou réduire ;
// - chaque sortie (Alt+Tab, autre bureau, clic ailleurs…) est détectée, signalée et notée ;
// - une fermeture forcée (Gestionnaire des tâches) est repérée au redémarrage ;
// - seul le code enseignant permet de consulter le journal ou de quitter le mode classe.
// - pendant le verrouillage, un petit module Windows (natif/verrou-clavier.exe) bloque la touche Windows
//   (autres bureaux, Win+Tab, menu Démarrer…), Alt+Tab, Ctrl+Échap et Ctrl+Maj+Échap ; si la fenêtre perd
//   quand même le focus, elle est ramenée au premier plan.
// - en mode focus (jamais en examen ni en mode classe), un logiciel de TP autorisé (Redy de Jeulin) peut passer
//   devant : le module Windows dit quel programme est au premier plan et affiche un bouton « Revenir à Labo Élève ».
// Limite : Ctrl+Alt+Suppr ne peut être bloqué par aucune application (il reste détecté et signalé).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ---------- Module Windows qui bloque les raccourcis de sortie ----------
let verrouClavier = null;
let ecouteurModule = () => {};   // messages du module (programme au premier plan…), branché par creerModeClasse
let auDemarrageModule = () => {}; // envoie au module la fenêtre de Labo Élève et les logiciels autorisés
function envoyerModule(commande) {
  if (process.env.LABO_DEBUG_MODULE) console.log('→ module', commande, !!verrouClavier);
  try { if (verrouClavier && verrouClavier.stdin.writable) verrouClavier.stdin.write(commande + '\n'); } catch { /* module arrêté */ }
}
function cheminVerrouClavier() {
  const candidats = [
    process.resourcesPath && path.join(process.resourcesPath, 'verrou-clavier.exe'), // application installée
    path.join(__dirname, 'natif', 'verrou-clavier.exe'),                              // développement
  ].filter(Boolean);
  return candidats.find((c) => { try { return fs.statSync(c).isFile(); } catch { return false; } }) || null;
}
function demarrerVerrouClavier() {
  if (process.platform !== 'win32' || verrouClavier || process.env.LABO_SANS_VERROU_CLAVIER) return;
  const exe = cheminVerrouClavier();
  if (!exe) return;
  try {
    const module = spawn(exe, [String(process.pid)], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    verrouClavier = module;
    let reste = '';
    module.stdout.setEncoding('utf8');
    module.stdout.on('data', (morceau) => {
      reste += morceau;
      const lignes = reste.split(/\r?\n/);
      reste = lignes.pop();
      for (const l of lignes) if (l.trim()) { if (process.env.LABO_DEBUG_MODULE) console.log('← module', l.trim().slice(0, 140)); try { ecouteurModule(l.trim()); } catch { /* message ignoré */ } }
    });
    module.stdin.on('error', () => { /* module arrêté */ });
    module.on('exit', () => { if (verrouClavier === module) verrouClavier = null; });
    module.on('error', () => { if (verrouClavier === module) verrouClavier = null; });
    auDemarrageModule();
  } catch { verrouClavier = null; }
}
function arreterVerrouClavier() {
  if (!verrouClavier) return;
  try { verrouClavier.kill(); } catch { /* déjà arrêté */ }
  verrouClavier = null;
}
process.on('exit', arreterVerrouClavier);

const MAX_EVENEMENTS = 500;
const ESSAIS_AVANT_BLOCAGE = 5;
const DUREE_BLOCAGE_MS = 60_000;
const BATTEMENT_MS = 10_000;
const DUREE_MAX_DIALOGUE_MS = 3 * 60_000; // au-delà, une « fenêtre de fichier » est comptée comme une sortie
const DELAI_VERROUILLAGE_MS = 3000; // verrouillage / veille juste après la perte du focus : pas une sortie
const DELAI_DEMARRAGE_MS = 3000; // au lancement (ou quand le verrouillage commence), la fenêtre met un instant à passer devant : pas une sortie

function creerModeClasse({ app, ipcMain, obtenirFenetre, obtenirEleve = () => null, surEvenement = () => {} }) {
  const fichier = (nom) => path.join(app.getPath('userData'), nom);
  const lireJson = (nom, defaut) => { try { return JSON.parse(fs.readFileSync(fichier(nom), 'utf8')); } catch { return defaut; } };
  const ecrireJson = (nom, valeur) => {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(fichier(nom), JSON.stringify(valeur, null, 2));
  };

  let reglages = lireJson('classe.json', { actif: false, sel: null, empreinte: null });
  let journal = lireJson('journal-classe.json', []);
  let debutSortie = null;
  let enPause = 0;               // > 0 pendant une boîte de dialogue de l'application
  let essaisRates = 0;
  let bloqueJusqua = 0;
  let minuterieBattement = null;
  let fermetureAutorisee = false;
  let dernierClic = 0; // dernier clic dans l'application (y compris dans Office en ligne)

  const estActif = () => !!reglages.actif;
  // Mode focus : verrouillage automatique pour un élève identifié (réglé par le professeur, par classe).
  // Contrairement au mode classe, l'élève peut fermer l'application, après confirmation.
  let focus = false;
  // Mode examen (lancé par le professeur pour la classe) : verrouillage complet, fermeture interdite.
  let examen = null; // { titre, outils, debut }
  const verrouille = () => estActif() || focus || !!examen;

  // ---------- Logiciel de TP autorisé en mode focus (Redy) ----------
  const dossiersTP = new Set();      // dossiers d'installation des logiciels autorisés
  let premierPlan = { pid: 0, chemin: '' };
  let logicielOuvert = false;
  const tpPermis = () => focus && !examen && !estActif();
  const dansDossierTP = (chemin) => !!chemin && [...dossiersTP].some((d) => chemin.toLowerCase().startsWith(d.toLowerCase().replace(/[\\/]+$/, '') + path.sep));
  const logicielDevant = () => tpPermis() && dansDossierTP(premierPlan.chemin);
  function majModuleTP() {
    envoyerModule('autorise ' + (tpPermis() ? [...dossiersTP].join('|') : ''));
  }
  auDemarrageModule = () => {
    const f = obtenirFenetre();
    if (f && !f.isDestroyed()) {
      const h = f.getNativeWindowHandle();
      envoyerModule('labo ' + (h.length >= 8 ? h.readBigUInt64LE(0) : h.readUInt32LE(0)).toString());
    }
    majModuleTP();
  };
  // Labo Élève reste au-dessus de tout, sauf quand le logiciel de TP est ouvert (sinon sa fenêtre serait cachée).
  function majPremierPlanLabo() {
    const f = obtenirFenetre();
    if (!f || f.isDestroyed() || !verrouille()) return;
    if (logicielOuvert && tpPermis()) f.setAlwaysOnTop(false); else f.setAlwaysOnTop(true, 'screen-saver');
  }
  let debutTP = null, cumulTP = 0; // temps passé dans le logiciel de TP pendant une absence de Labo Élève
  let quandSortie = () => {}, quandRetour = () => {}; // définis avec la fenêtre (brancherFenetre)
  let verrouDepuis = 0; // moment où le verrouillage a commencé (0 = pas verrouillé)
  ecouteurModule = (ligne) => {
    if (ligne.startsWith('pp ')) {
      const [pid, ...reste] = ligne.slice(3).split('|');
      premierPlan = { pid: +pid, chemin: reste.join('|') };
      const devant = logicielDevant();
      if (devant && debutTP === null && debutSortie !== null) debutTP = Date.now();
      if (!devant && debutTP !== null) { cumulTP += Date.now() - debutTP; debutTP = null; }
      if (devant) { const f = obtenirFenetre(); if (f && !f.isDestroyed() && f.isAlwaysOnTop()) f.setAlwaysOnTop(false); }
      if (premierPlan.pid === process.pid) quandRetour();       // Labo Élève (ou une de ses fenêtres) est devant
      else if (premierPlan.pid) {
        quandSortie();                                           // un autre programme est devant
        if (!devant && verrouille() && !enPause) demarrerRetour();
      }
    } else if (ligne.startsWith('ouvert ')) {
      logicielOuvert = ligne.endsWith('1');
      majPremierPlanLabo();
    }
  };
  function autoriserLogiciel(dossier) {
    if (!dossier) return false;
    dossiersTP.add(dossier);
    majModuleTP();
    if (!tpPermis()) return false;
    logicielOuvert = true; // en attendant la confirmation du module
    majPremierPlanLabo();
    return true;
  }
  const montrerLogiciel = () => { if (tpPermis()) { logicielOuvert = true; majPremierPlanLabo(); envoyerModule('montrer'); } };
  const logicielOuvertTP = () => logicielOuvert && tpPermis();
  const fermetureInterdite = () => estActif() || !!examen;
  const envoyer = (canal, donnees) => {
    const f = obtenirFenetre();
    if (f && !f.isDestroyed()) f.webContents.send(canal, donnees);
  };

  function noter(evenement) {
    const eleve = obtenirEleve();
    journal.push({ ...evenement, a: evenement.a || new Date().toISOString(), ...(eleve ? { eleve: eleve.nom, classe: eleve.classe } : {}) });
    if (journal.length > MAX_EVENEMENTS) journal = journal.slice(-MAX_EVENEMENTS);
    ecrireJson('journal-classe.json', journal);
  }

  // ---------- Code enseignant ----------
  const empreinte = (code, sel) => crypto.scryptSync(String(code), sel, 32).toString('hex');
  const codeValide = (code) => /^\d{4,8}$/.test(String(code));

  function verifierCode(code) {
    const maintenant = Date.now();
    if (maintenant < bloqueJusqua) {
      return { ok: false, message: `Trop d'essais. Réessaie dans ${Math.ceil((bloqueJusqua - maintenant) / 1000)} s.` };
    }
    if (!reglages.empreinte) return { ok: false, message: 'Aucun code enseignant défini.' };
    const attendu = Buffer.from(reglages.empreinte, 'hex');
    const recu = Buffer.from(empreinte(code, reglages.sel), 'hex');
    if (crypto.timingSafeEqual(attendu, recu)) { essaisRates = 0; return { ok: true }; }
    essaisRates++;
    noter({ type: 'code-errone' });
    if (essaisRates >= ESSAIS_AVANT_BLOCAGE) { bloqueJusqua = maintenant + DUREE_BLOCAGE_MS; essaisRates = 0; }
    return { ok: false, message: 'Code incorrect.' };
  }

  // ---------- Verrouillage de la fenêtre ----------
  function appliquerVerrou() {
    const f = obtenirFenetre();
    if (!f || f.isDestroyed()) return;
    if (verrouille()) {
      if (!verrouDepuis) verrouDepuis = Date.now(); // début du verrouillage (lancement, mode focus activé…)
      f.setMinimizable(false);
      f.setKiosk(true);
      f.setAlwaysOnTop(!(logicielOuvert && tpPermis()), 'screen-saver');
      if (!(logicielOuvert && tpPermis())) f.focus();
      demarrerVerrouClavier();
      majModuleTP(); // examen ou mode classe : le logiciel de TP n'est plus autorisé
    } else {
      verrouDepuis = 0;
      arreterVerrouClavier();
      arreterRetour();
      f.setAlwaysOnTop(false);
      f.setKiosk(false);
      f.setMinimizable(true);
    }
  }

  function battement() {
    ecrireJson('battement-classe.json', { t: new Date().toISOString(), propre: false });
  }
  function demarrerBattement() {
    clearInterval(minuterieBattement);
    battement();
    minuterieBattement = setInterval(battement, BATTEMENT_MS);
  }
  function arreterBattement() {
    clearInterval(minuterieBattement);
    ecrireJson('battement-classe.json', { t: new Date().toISOString(), propre: true });
  }

  // À appeler une fois la fenêtre créée.
  function brancherFenetre(f) {
    // Fermeture forcée lors de la séance précédente ?
    const b = lireJson('battement-classe.json', null);
    if (b && !b.propre) {
      noter({ type: 'fermeture-forcee', a: b.t, retour: new Date().toISOString() });
      surEvenement({ type: 'fermeture-forcee', a: b.t });
      ecrireJson('battement-classe.json', { t: b.t, propre: true });
    }

    // Un clic juste avant la perte de focus = fenêtre « Choisir un fichier » ouverte depuis
    // une page (envoi d'un travail sur le pad…). Ce n'est pas une sortie, mais c'est noté.
    let parDialogue = false;
    f.webContents.on('input-event', (_e, ev) => { if (ev.type === 'mouseDown' || ev.type === 'mouseUp') dernierClic = Date.now(); });

    // Verrouillage de la session (Win+L) ou mise en veille : ce n'est pas une sortie de l'application.
    // L'absence n'est excusée que si le verrouillage suit de près la perte du focus (Win+L, capot fermé) :
    // un élève qui fait Alt+Tab puis verrouille plus tard voit sa sortie comptée jusqu'au verrouillage.
    debutVeille = null; // moment du verrouillage / de la mise en veille pendant la sortie en cours
    const { powerMonitor } = require('electron');
    const entreeVeille = () => { if (debutSortie !== null && debutVeille === null) debutVeille = Date.now(); };
    powerMonitor.on('lock-screen', entreeVeille);
    powerMonitor.on('suspend', entreeVeille);

    // Sortie et retour : signalés par Electron (blur / focus) et, plus sûrement, par le module Windows
    // qui voit quel programme est vraiment au premier plan (Electron ne le voit pas toujours).
    quandSortie = () => {
      if (!verrouille() || enPause || debutSortie !== null) return;
      debutSortie = Date.now();
      debutVeille = null;
      cumulTP = 0;
      debutTP = logicielDevant() ? debutSortie : null;
      parDialogue = debutSortie - dernierClic < 700;
      // Pas de retour forcé pour une fenêtre « Ouvrir un fichier » demandée par l'élève, ni pendant la veille.
      if (!parDialogue) demarrerRetour();
    };
    quandRetour = () => {
      arreterRetour();
      if (!verrouille() || debutSortie === null) return;
      if (debutTP !== null) { cumulTP += Date.now() - debutTP; debutTP = null; }
      const dureeTotale = Date.now() - debutSortie;
      const duree = dureeTotale - cumulTP; // le temps passé dans le logiciel de TP (Redy) n'est pas une sortie
      const a = new Date(debutSortie).toISOString();
      // La fenêtre vient d'être verrouillée (lancement de l'application) : elle n'était pas encore devant, ce n'est pas une sortie.
      if (verrouDepuis && debutSortie - verrouDepuis < DELAI_DEMARRAGE_MS) { debutSortie = null; debutVeille = null; return; }
      if (cumulTP > 0 && duree < 2000) { noter({ type: 'logiciel-tp', a, dureeMs: cumulTP }); debutSortie = null; debutVeille = null; return; }
      const veille = debutVeille;
      debutSortie = null;
      debutVeille = null;
      if (duree < 300) return; // simple clignotement de focus
      if (veille !== null) {
        const avantVeille = veille - Date.parse(a);
        if (avantVeille <= DELAI_VERROUILLAGE_MS) {
          noter({ type: 'veille', a, dureeMs: duree }); // noté pour information, sans alerte
          return;
        }
        // Sortie, puis verrouillage pour la cacher : on compte la sortie jusqu'au verrouillage.
        const ev = { type: 'sortie', a, dureeMs: avantVeille };
        noter(ev);
        surEvenement(ev);
        envoyer('classe:sortie', { ...ev, total: nombreSorties() });
        return;
      }
      if (parDialogue && duree < DUREE_MAX_DIALOGUE_MS) {
        noter({ type: 'dialogue-fichier', a, dureeMs: duree });
        return;
      }
      const ev = { type: 'sortie', a, dureeMs: duree };
      noter(ev);
      surEvenement(ev);
      envoyer('classe:sortie', { ...ev, total: nombreSorties() });
    };
    f.on('blur', quandSortie);
    f.on('focus', quandRetour);
    f.on('close', (e) => {
      if (fermetureAutorisee) return;
      if (fermetureInterdite()) {
        e.preventDefault();
        noter({ type: 'tentative-fermeture' });
        envoyer('classe:bloque', { quoi: examen ? 'fermer-examen' : 'fermer' });
      } else if (focus) {
        // Mode focus : on demande confirmation à l'élève (« ton travail est-il terminé ? »).
        e.preventDefault();
        envoyer('focus:fermeture-demandee', {});
      }
    });
    f.on('session-end', () => { // arrêt ou déconnexion de Windows : on laisse faire
      fermetureAutorisee = true;
      if (verrouille()) { noter({ type: 'arret-pc' }); arreterBattement(); }
    });
    f.once('ready-to-show', () => { appliquerVerrou(); if (verrouille()) demarrerBattement(); });
  }

  // Les boîtes de dialogue de l'application font perdre le focus : ce n'est pas une sortie.
  async function pendantDialogue(fn) {
    enPause++;
    try { return await fn(); } finally { setTimeout(() => { enPause--; }, 600); }
  }

  function nombreSorties() {
    let i = journal.length - 1;
    while (i >= 0 && journal[i].type !== 'activation') i--;
    return journal.slice(i + 1).filter((e) => e.type === 'sortie' || e.type === 'fermeture-forcee').length;
  }

  function etat() {
    return { actif: estActif(), focus: focus && !estActif() && !examen, examen, codeDefini: !!reglages.empreinte, sorties: estActif() ? nombreSorties() : 0 };
  }

  function definirFocus(actif) {
    if (focus === !!actif) return;
    focus = !!actif;
    appliquerVerrou();
    if (verrouille()) demarrerBattement(); else arreterBattement();
    envoyer('focus:etat', etat());
  }
  function definirExamen(e) {
    const avant = JSON.stringify(examen);
    examen = e ? { titre: e.titre, outils: e.outils, debut: e.debut, ...(typeof e.evaluation === 'string' && /^[a-z0-9-]{1,64}$/.test(e.evaluation) ? { evaluation: e.evaluation } : {}) } : null;
    if (JSON.stringify(examen) === avant) return;
    noter({ type: examen ? 'examen-debut' : 'examen-fin', titre: examen ? examen.titre : undefined });
    appliquerVerrou();
    if (verrouille()) demarrerBattement(); else arreterBattement();
    envoyer('focus:etat', etat());
  }
  // ---------- Retour forcé au premier plan ----------
  let minuterieRetour = null;
  let debutVeille = null; // partagé avec brancherFenetre (veille / verrouillage pendant une sortie)
  function arreterRetour() { clearInterval(minuterieRetour); minuterieRetour = null; }
  function demarrerRetour() {
    arreterRetour();
    minuterieRetour = setInterval(() => {
      const f = obtenirFenetre();
      // Avec le module Windows, on sait quel programme est vraiment devant ; sinon, on se fie à Electron.
      if (!f || f.isDestroyed()) { arreterRetour(); return; }
      const laboDevant = verrouClavier && premierPlan.pid ? premierPlan.pid === process.pid : f.isFocused();
      if (!verrouille() || enPause || fermetureAutorisee || laboDevant || debutVeille !== null) { arreterRetour(); return; }
      if (logicielDevant()) return; // l'élève travaille dans le logiciel de TP autorisé (Redy)
      if (f.isMinimized()) f.restore();
      f.show();
      f.setAlwaysOnTop(true, 'screen-saver');
      f.moveTop();
      f.focus();
      envoyerModule('revenir'); // Windows refuse souvent qu'une application repasse devant seule : le module s'en charge
    }, 400);
  }

  // L'élève a confirmé : la fenêtre peut se fermer normalement.
  function autoriserFermeture() {
    arreterVerrouClavier();
    arreterRetour();
    fermetureAutorisee = true;
    clearInterval(minuterieBattement);
    ecrireJson('battement-classe.json', { t: new Date().toISOString(), propre: true });
  }

  function enregistrerIPC() {
    ipcMain.handle('classe:etat', () => etat());

    ipcMain.handle('classe:activer', (_e, code) => {
      if (!reglages.empreinte) {
        if (!codeValide(code)) return { ok: false, message: 'Le code doit contenir de 4 à 8 chiffres.' };
        const sel = crypto.randomBytes(16).toString('hex');
        reglages = { ...reglages, sel, empreinte: empreinte(code, sel) };
      } else {
        const v = verifierCode(code);
        if (!v.ok) return v;
      }
      reglages.actif = true;
      ecrireJson('classe.json', reglages);
      noter({ type: 'activation' });
      appliquerVerrou();
      demarrerBattement();
      return { ok: true, ...etat() };
    });

    ipcMain.handle('classe:desactiver', (_e, code) => {
      const v = verifierCode(code);
      if (!v.ok) return v;
      reglages.actif = false;
      ecrireJson('classe.json', reglages);
      noter({ type: 'desactivation' });
      arreterBattement();
      appliquerVerrou();
      return { ok: true, ...etat() };
    });

    ipcMain.handle('classe:journal', (_e, code) => {
      const v = verifierCode(code);
      return v.ok ? { ok: true, journal: [...journal].reverse() } : v;
    });

    ipcMain.handle('classe:effacer', (_e, code) => {
      const v = verifierCode(code);
      if (!v.ok) return v;
      journal = estActif() ? [{ type: 'activation', a: new Date().toISOString() }] : [];
      ecrireJson('journal-classe.json', journal);
      return { ok: true, journal: [] };
    });

    ipcMain.handle('classe:changer-code', (_e, ancien, nouveau) => {
      const v = verifierCode(ancien);
      if (!v.ok) return v;
      if (!codeValide(nouveau)) return { ok: false, message: 'Le nouveau code doit contenir de 4 à 8 chiffres.' };
      const sel = crypto.randomBytes(16).toString('hex');
      reglages = { ...reglages, sel, empreinte: empreinte(nouveau, sel) };
      ecrireJson('classe.json', reglages);
      return { ok: true };
    });
  }

  // Appelé quand l'application veut ouvrir un lien ou un logiciel externe.
  function bloquerSiActif(quoi) {
    if (!verrouille()) return false;
    noter({ type: 'blocage', quoi });
    envoyer('classe:bloque', { quoi });
    return true;
  }

  return { autoriserLogiciel, montrerLogiciel, logicielOuvertTP, tpPermis, signalerClic: () => { dernierClic = Date.now(); }, estActif, brancherFenetre, enregistrerIPC, pendantDialogue, bloquerSiActif, definirFocus, definirExamen, autoriserFermeture, focusActif: () => focus, examenActif: () => examen };
}

module.exports = { creerModeClasse };
