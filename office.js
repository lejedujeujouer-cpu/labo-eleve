// Sites intégrés affichés DANS Labo Élève, sans ouvrir de fenêtre (compatibles avec le mode focus
// et le mode classe) : Office en ligne (Word, Excel, PowerPoint), l'ENT MonBureauNumérique et Pronote.
// - Les pages Microsoft s'affichent dans une « webview » (navigateur intégré à la page de l'application),
//   avec une session séparée et persistante : l'élève reste connecté d'une séance à l'autre.
// - Seuls ces sites (et ceux de connexion : EduConnect, académies) sont accessibles. Un site de connexion
//   vers lequel un site autorisé redirige l'élève est autorisé automatiquement pour la session.
// - Les documents téléchargés depuis Office vont dans « Mes documents ».

const PARTITION = 'persist:office365';
const URLS = {
  word: 'https://www.office.com/launch/word',
  excel: 'https://www.office.com/launch/excel',
  powerpoint: 'https://www.office.com/launch/powerpoint',
  ent: 'https://www.monbureaunumerique.fr/',
  // Recherche internet : Qwant (moteur français, sans suivi publicitaire), filtre parental strict imposé.
  recherche: 'https://www.qwant.com/?l=fr&s=2',
  // La Quizinière : l'élève entre le code de l'exercice donné par l'enseignant (sans compte).
  quiziniere: 'https://www.quiziniere.com/',
  // Kahoot : l'élève rejoint le jeu de l'enseignant avec le code PIN affiché au tableau (sans compte).
  kahoot: 'https://kahoot.it/',
};
// Sites « fermés » : seuls leurs domaines sont accessibles (utile pendant un exercice ou un examen).
const DOMAINES_PAR_SITE = {
  quiziniere: ['quiziniere.com', 'reseau-canope.fr'],
  kahoot: ['kahoot.it', 'kahoot.com'],
};
// Réglages imposés au moteur, même si l'élève essaie de les changer :
// filtre parental strict (pages et résultats) et pas de résumé rédigé par une IA.
// Robots conversationnels (IA) : bloqués dans l'outil Recherche, pour que l'élève cherche lui-même.
const SITES_IA = [
  'chatgpt.com', 'chat.openai.com', 'openai.com', 'gemini.google.com', 'bard.google.com', 'aistudio.google.com', 'copilot.microsoft.com',
  'copilot.cloud.microsoft', 'chat.mistral.ai', 'claude.ai', 'perplexity.ai', 'deepseek.com', 'poe.com', 'character.ai', 'you.com',
  'meta.ai', 'grok.com', 'x.ai', 'huggingface.co', 'phind.com', 'chatgpt.fr', 'chatgptfrancais.org', 'le-chat.fr',
];
const REGLES_MOTEUR = [
  { hotes: ['www.qwant.com', 'qwant.com'], imposer: { s: '2' } },
  { hotes: ['api.qwant.com'], imposer: { safesearch: '2', llm: 'false' } },
];
const DOMAINES_MICROSOFT = [
  'office.com', 'office.net', 'office365.com', 'microsoft365.com', 'cloud.microsoft', 'microsoft.com', 'microsoftonline.com',
  'live.com', 'live.net', 'msauth.net', 'msftauth.net', 'msocdn.com', 'msecnd.net', 'sharepoint.com', 'sharepointonline.com',
  'onedrive.com', 'officeapps.live.com', 'onenote.com', 'windows.net', 'azureedge.net', 'akamaized.net', 'microsoftstream.com',
];
// ENT, Pronote et connexion de l'Éducation nationale
const DOMAINES_SCOLAIRES = [
  'monbureaunumerique.fr', 'index-education.net', 'index-education.com', 'educonnect.education.gouv.fr', 'education.gouv.fr',
  'ac-reims.fr', 'ac-nancy-metz.fr', 'ac-strasbourg.fr', 'gar.education.fr',
];
// GAR : gestionnaire d'accès aux ressources numériques (manuels, Lumni, Éduthèque…) utilisé par le Médiacentre
const PORTAILS_RESSOURCES = ['gar.education.fr'];

function creerOffice({ app, session, shell, obtenirFenetre, gererTelechargement, classe, obtenirUrlPronote = () => null, rechercheAutorisee = () => false }) {
  let appliActive = null; // site intégré affiché (word, ent, recherche…)
  let lien = null;         // site ajouté par l'enseignant dans un labo : { url, hote }
  function definirLien(url) {
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) return false; lien = { url: u.href, hote: u.hostname.replace(/^www\./, '').toLowerCase() }; return true; } catch { return false; }
  }
  // Sites de connexion atteints par redirection depuis Microsoft (ENT, académie…) : autorisés pour la session.
  const hotesConnexion = new Set();

  const hote = (u) => { try { const url = new URL(u); return url.protocol === 'https:' ? url.hostname.toLowerCase() : null; } catch { return null; } };
  const dans = (h, liste) => !!h && liste.some((d) => h === d || h.endsWith('.' + d));
  const estMicrosoft = (h) => dans(h, DOMAINES_MICROSOFT);
  const estSiteIA = (u) => { try { return dans(new URL(u).hostname.toLowerCase(), SITES_IA); } catch { return false; } };
  // Dans l'outil Recherche, un site refusé n'est pas ouvert dans le navigateur : on prévient l'élève.
  const refuserDansRecherche = (url) => {
    if (appliActive !== 'recherche') return false;
    const f = obtenirFenetre();
    if (f && !f.isDestroyed()) f.webContents.send('recherche:bloque', { ia: estSiteIA(url) });
    return true;
  };
  const hotePronote = () => hote(obtenirUrlPronote());
  const estAutorise = (u) => {
    // Outil Recherche autorisé par le professeur : tous les sites web, sauf les robots conversationnels.
    if (appliActive === 'recherche' && rechercheAutorisee()) return /^https?:\/\//i.test(u) && !estSiteIA(u);
    const h = hote(u);
    if (appliActive === 'lien') return !!h && !!lien && (dans(h, [lien.hote]) || hotesConnexion.has(h)); // seulement ce site
    if (DOMAINES_PAR_SITE[appliActive]) return !!h && (dans(h, DOMAINES_PAR_SITE[appliActive]) || hotesConnexion.has(h));
    return !!h && (estMicrosoft(h) || dans(h, DOMAINES_SCOLAIRES) || h === hotePronote() || hotesConnexion.has(h));
  };

  // La page affichée est-elle le Médiacentre de l'ENT, ou le GAR (accès aux ressources de l'Éducation nationale) ?
  const depuisPortailRessources = (wc) => {
    const u = wc.getURL();
    const h = hote(u);
    let chemin = '';
    try { chemin = decodeURIComponent(new URL(u).pathname + new URL(u).search); } catch { /* ignoré */ }
    return dans(h, PORTAILS_RESSOURCES) || (dans(h, DOMAINES_SCOLAIRES) && /m[ée]dia-?centre/i.test(chemin));
  };

  // Adresse de départ ; null si Pronote n'a pas encore été configuré par le professeur.
  function urlDepart(appli) {
    appliActive = appli;
    if (appli === 'recherche') return rechercheAutorisee() ? URLS.recherche : null;
    if (appli === 'pronote') return obtenirUrlPronote() || null;
    if (appli === 'lien') return lien ? lien.url : null;
    return URLS[appli] || URLS.word;
  }

  // ---------- Contrôle de la webview ----------
  function brancherFenetre(fenetre) {
    // Seules les webviews Office sont acceptées, avec des réglages sûrs imposés ici.
    fenetre.webContents.on('will-attach-webview', (e, prefs, params) => {
      delete prefs.preload;
      prefs.nodeIntegration = false;
      prefs.nodeIntegrationInSubFrames = false;
      prefs.contextIsolation = true;
      prefs.sandbox = true;
      prefs.webSecurity = true;
      params.partition = PARTITION;
      params.allowpopups = '';
      if (!estAutorise(params.src)) e.preventDefault();
    });
  }

  let vueActive = null; // contenu de la webview affichée
  // Page précédente (ex. revenir au Médiacentre après un manuel numérique).
  function precedent() {
    const h = vueActive && !vueActive.isDestroyed() && vueActive.navigationHistory;
    if (h && h.canGoBack()) { h.goBack(); return true; }
    return false;
  }

  app.on('web-contents-created', (_e, wc) => {
    if (wc.getType() !== 'webview') return;
    vueActive = wc;

    // Ressource ouverte depuis le Médiacentre de l'ENT ou par le GAR (manuels numériques, Lumni, Pix…) :
    // la liste est choisie par l'établissement, on autorise donc le site de la ressource pour la session.
    const accepterRessource = (url) => {
      const h = hote(url);
      if (!h || !depuisPortailRessources(wc)) return false;
      hotesConnexion.add(h);
      return true;
    };

    // Office et les ENT ouvrent souvent « dans un nouvel onglet » : on ouvre dans la même vue.
    wc.setWindowOpenHandler(({ url }) => {
      // (chargement juste après avoir refusé la nouvelle fenêtre, sinon il est ignoré)
      if (estAutorise(url) || accepterRessource(url)) setTimeout(() => { if (!wc.isDestroyed()) wc.loadURL(url); }, 0);
      else if (refuserDansRecherche(url)) { /* bloqué */ }
      else if (/^https?:/i.test(url) && !classe.bloquerSiActif('lien')) shell.openExternal(url);
      return { action: 'deny' };
    });
    // Lien vers un autre site : bloqué (ou ouvert dans le navigateur hors mode focus / classe).
    wc.on('will-navigate', (e, url) => {
      if (estAutorise(url) || accepterRessource(url)) return;
      e.preventDefault();
      if (refuserDansRecherche(url)) return;
      if (/^https?:/i.test(url) && !classe.bloquerSiActif('lien')) shell.openExternal(url);
    });
    // Redirection décidée par un site autorisé (connexion via l'ENT, EduConnect, l'académie) :
    // on fait confiance au site d'arrivée pour la session.
    wc.on('will-redirect', (_ev, url) => {
      const h = hote(url);
      if (h && !estAutorise(url) && estAutorise(wc.getURL())) hotesConnexion.add(h);
    });
    // Un clic dans Office compte comme un clic dans l'application (fenêtre « Choisir un fichier »…).
    wc.on('input-event', (_ev, ev) => { if (ev.type === 'mouseDown' || ev.type === 'mouseUp') classe.signalerClic(); });
  });

  // Téléchargements depuis Office -> « Mes documents ».
  app.whenReady().then(() => {
    const s = session.fromPartition(PARTITION);
    s.on('will-download', gererTelechargement);
    // Filtre parental strict du moteur de recherche, même si l'élève essaie de le changer.
    s.webRequest.onBeforeRequest({ urls: REGLES_MOTEUR.flatMap((r) => r.hotes.map((h) => `https://${h}/*`)) }, (d, rappel) => {
      try {
        const u = new URL(d.url);
        // Assistant IA de Qwant (« Chat IA ») : désactivé.
        if (u.hostname === 'api.qwant.com' && u.pathname.startsWith('/v3/agent')) return rappel({ cancel: true });
        if (u.searchParams.get('t') === 'chat' && d.resourceType === 'mainFrame') { u.searchParams.set('t', 'web'); return rappel({ redirectURL: u.toString() }); }
        const regle = REGLES_MOTEUR.find((r) => r.hotes.includes(u.hostname));
        if (regle && u.searchParams.has('q')) {
          let change = false;
          for (const [cle, valeur] of Object.entries(regle.imposer)) if (u.searchParams.get(cle) !== valeur) { u.searchParams.set(cle, valeur); change = true; }
          if (change) return rappel({ redirectURL: u.toString() });
        }
      } catch { /* adresse illisible : inchangée */ }
      rappel({});
    });
  });

  return { brancherFenetre, urlDepart, precedent, definirLien, PARTITION };
}

module.exports = { creerOffice };
