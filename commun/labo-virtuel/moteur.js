// Labo virtuel : moteur commun au « Labo de chimie » et au « Labo de physique ».
//
// Chaque manipulation est décrite par un objet (voir outils/labo-chimie/manips.js) :
//   id, titre, icone, theme, niveaux ['CAP', '2de', '1re', 'Tle'], duree, objectif,
//   epi : équipements de protection obligatoires (['blouse', 'lunettes', 'gants']),
//   etatInitial() → état de la paillasse (objet simple, enregistrable),
//   vue(etat, outils) → { svg: '<svg…>', commandes: 'HTML des boutons' }  (éléments cliquables : data-action / data-arg),
//   actions : { nom(etat, arg, outils) { … } }  — outils.message(texte, 'ok'|'alerte'|'danger'), outils.remplir(ligne, colonne, valeur),
//             outils.ajouterLigne({…}), outils.epi('lunettes') ; renvoyer false si l'action est refusée,
//   etapes : [{ id, texte, ordre, fait(etat, historique) → bool, question?: { texte, type: 'texte'|'choix'|'nombre', options?, reponse?, tolerance? } }],
//   distracteurs : [{ texte, pourquoi }]   (étapes fausses ou dangereuses, pour « Construire mon protocole »),
//   mesures : { colonnes: [{ id, titre, saisie?, choix?, attendu?(ligne) }], lignes?: [{ id, … }], graphique?: { x, y, titreX, titreY, origine } }
(function () {
  const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nombre = (v) => { const n = Number(String(v ?? '').replace(',', '.').trim()); return String(v ?? '').trim() === '' || Number.isNaN(n) ? null : n; };
  const virgule = (n, d = 2) => (n === null || n === undefined || Number.isNaN(n) ? '' : Number(n.toFixed(d)).toLocaleString('fr-FR', { maximumFractionDigits: d }));
  const melanger = (t) => { const r = [...t]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const EPI = { blouse: '🥼 Blouse', lunettes: '🥽 Lunettes', gants: '🧤 Gants' };

  // ---------- Dessins (SVG) du matériel de laboratoire ----------
  const D = {
    becher({ x, y, l = 70, h = 86, couleur = '#cfe8ff', niveau = 0.5, etiquette = '', action, arg, choisi, sous = '' }) {
      const n = Math.max(0, Math.min(1, niveau)), hl = (h - 8) * n;
      return `<g ${action ? `class="cliquable${choisi ? ' choisi' : ''}" data-action="${action}" data-arg="${echapper(arg ?? '')}"` : ''} transform="translate(${x},${y})">
        <path d="M0 0 h${l} v${h - 6} q0 6 -6 6 h${-(l - 12)} q-6 0 -6 -6 z" fill="rgba(255,255,255,.55)" stroke="#64748b" stroke-width="2"/>
        ${n > 0 ? `<path d="M2 ${h - hl} h${l - 4} v${hl - 6} q0 4 -4 4 h${-(l - 12)} q-4 0 -4 -4 z" fill="${couleur}" opacity=".85"/>` : ''}
        <path d="M-4 0 h8 M${l - 4} 0 h8" stroke="#64748b" stroke-width="2"/>
        ${[0.25, 0.5, 0.75].map((g) => `<path d="M${l - 14} ${h - (h - 8) * g} h10" stroke="#94a3b8" stroke-width="1"/>`).join('')}
        ${etiquette ? `<text x="${l / 2}" y="${h + 18}" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">${echapper(etiquette)}</text>` : ''}
        ${sous ? `<text x="${l / 2}" y="${h + 33}" text-anchor="middle" font-size="11" fill="#64748b">${echapper(sous)}</text>` : ''}
      </g>`;
    },
    tube({ x, y, l = 26, h = 120, couleur = '#e0f2fe', niveau = 0, precipite = null, etiquette = '', sous = '', action, arg, choisi }) {
      const n = Math.max(0, Math.min(1, niveau)), hl = (h - 10) * n;
      return `<g ${action ? `class="cliquable${choisi ? ' choisi' : ''}" data-action="${action}" data-arg="${echapper(arg ?? '')}"` : ''} transform="translate(${x},${y})">
        ${n > 0 ? `<path d="M2 ${h - hl - 2} h${l - 4} v${hl - l / 2 + 2} a${l / 2 - 2} ${l / 2 - 2} 0 0 1 ${-(l - 4)} 0 z" fill="${couleur}" opacity=".85"/>` : ''}
        ${precipite ? `<path d="M2 ${h - l / 2 - precipite.hauteur} h${l - 4} v${precipite.hauteur} a${l / 2 - 2} ${l / 2 - 2} 0 0 1 ${-(l - 4)} 0 z" fill="${precipite.couleur}"/>
          ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${4 + (i * 37) % (l - 8)}" cy="${h - l / 2 - precipite.hauteur - 4 - (i * 13) % 26}" r="1.6" fill="${precipite.couleur}"/>`).join('')}` : ''}
        <path d="M0 0 v${h - l / 2} a${l / 2} ${l / 2} 0 0 0 ${l} 0 v${-(h - l / 2)}" fill="rgba(255,255,255,.4)" stroke="#64748b" stroke-width="2"/>
        ${etiquette ? `<text x="${l / 2}" y="${h + 16}" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">${echapper(etiquette)}</text>` : ''}
        ${sous ? `<text x="${l / 2}" y="${h + 30}" text-anchor="middle" font-size="10" fill="#64748b">${echapper(sous)}</text>` : ''}
      </g>`;
    },
    flacon({ x, y, couleur = '#e2e8f0', etiquette = '', sous = '', danger = false, action, arg, choisi }) {
      return `<g ${action ? `class="cliquable${choisi ? ' choisi' : ''}" data-action="${action}" data-arg="${echapper(arg ?? '')}"` : ''} transform="translate(${x},${y})">
        <rect x="14" y="0" width="22" height="12" rx="3" fill="#475569"/>
        <path d="M8 14 h34 q6 0 6 8 v58 q0 6 -6 6 h-34 q-6 0 -6 -6 v-58 q0 -8 6 -8 z" fill="${couleur}" stroke="#64748b" stroke-width="2"/>
        <rect x="6" y="38" width="38" height="26" rx="3" fill="#fff" stroke="#cbd5e1"/>
        <text x="25" y="55" text-anchor="middle" font-size="10" font-weight="700" fill="#1e293b">${echapper(etiquette)}</text>
        ${danger ? '<path d="M18 68 l7 -12 l7 12 z" fill="#f59e0b" stroke="#78350f"/><text x="25" y="67" text-anchor="middle" font-size="8" font-weight="900" fill="#78350f">!</text>' : ''}
        ${sous ? `<text x="25" y="102" text-anchor="middle" font-size="11" fill="currentColor">${echapper(sous)}</text>` : ''}
      </g>`;
    },
    afficheur({ x, y, l = 150, h = 74, titre = '', valeur = '', unite = '', couleur = '#0f172a', action, arg }) {
      return `<g ${action ? `class="cliquable" data-action="${action}" data-arg="${echapper(arg ?? '')}"` : ''} transform="translate(${x},${y})">
        <rect width="${l}" height="${h}" rx="10" fill="${couleur}" stroke="#334155" stroke-width="2"/>
        <rect x="10" y="22" width="${l - 20}" height="${h - 32}" rx="5" fill="#d9f99d"/>
        <text x="${l / 2}" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#e2e8f0">${echapper(titre)}</text>
        <text x="${l - 16}" y="${h - 17}" text-anchor="end" font-size="24" font-family="Consolas, monospace" font-weight="700" fill="#1a2e05">${echapper(valeur)}</text>
        <text x="16" y="${h - 17}" font-size="12" font-weight="700" fill="#365314">${echapper(unite)}</text>
      </g>`;
    },
    eprouvette({ x, y, h = 220, l = 34, max = 100, volume = 0, couleur = '#bfdbfe', etiquette = '', action, arg }) {
      const haut = h - 30, niveauY = 10 + haut * (1 - volume / max);
      const graduations = [];
      for (let v = 0; v <= max; v += max / 10) { const gy = 10 + haut * (1 - v / max); graduations.push(`<path d="M${l - 12} ${gy} h10" stroke="#475569" stroke-width="1.2"/><text x="${l + 4}" y="${gy + 4}" font-size="9" fill="#475569">${v}</text>`); }
      return `<g ${action ? `class="cliquable" data-action="${action}" data-arg="${echapper(arg ?? '')}"` : ''} transform="translate(${x},${y})">
        ${volume > 0 ? `<rect x="2" y="${niveauY}" width="${l - 4}" height="${10 + haut - niveauY}" fill="${couleur}" opacity=".85"/><path d="M2 ${niveauY} q${(l - 4) / 2} 6 ${l - 4} 0" fill="${couleur}" stroke="#1e3a8a" stroke-width="1"/>` : ''}
        <path d="M0 0 v${h - 20} M${l} 0 v${h - 20}" stroke="#64748b" stroke-width="2"/>
        <path d="M0 ${h - 20} h${l}" stroke="#64748b" stroke-width="2"/>
        <path d="M-12 ${h - 20} h${l + 24} v8 h${-(l + 24)} z" fill="#94a3b8"/>
        ${graduations.join('')}
        ${etiquette ? `<text x="${l / 2}" y="${h + 6}" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">${echapper(etiquette)}</text>` : ''}
      </g>`;
    },
    fiole({ x, y, couleur = '#bfdbfe', remplissage = 0, etiquette = '', bouchee = false, action, arg }) {
      // remplissage : 1 = exactement au trait de jauge
      const r = Math.max(0, Math.min(1.25, remplissage));
      const yLiquide = r <= 0.88 ? 190 - (r / 0.88) * 100 : 90 - ((r - 0.88) / 0.37) * 80;
      return `<g ${action ? `class="cliquable" data-action="${action}" data-arg="${echapper(arg ?? '')}"` : ''} transform="translate(${x},${y})">
        <clipPath id="clip-fiole"><path d="M44 0 h20 v80 q48 30 48 70 q0 44 -58 44 q-58 0 -58 -44 q0 -40 48 -70 z"/></clipPath>
        ${r > 0 ? `<rect x="-10" y="${yLiquide}" width="130" height="${200 - yLiquide}" fill="${couleur}" opacity=".85" clip-path="url(#clip-fiole)"/>` : ''}
        <path d="M44 0 h20 v80 q48 30 48 70 q0 44 -58 44 q-58 0 -58 -44 q0 -40 48 -70 z" fill="rgba(255,255,255,.35)" stroke="#64748b" stroke-width="2"/>
        <path d="M40 30 h28" stroke="#dc2626" stroke-width="2"/><text x="72" y="34" font-size="10" fill="#dc2626">trait de jauge</text>
        ${bouchee ? '<rect x="40" y="-14" width="28" height="16" rx="3" fill="#1e293b"/>' : ''}
        ${etiquette ? `<text x="54" y="214" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">${echapper(etiquette)}</text>` : ''}
      </g>`;
    },
  };

  // ---------- Graphique (nuage de points + droite de régression) ----------
  function graphique(canvas, points, g) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const L = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = L * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L, H);
    const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#333';
    const m = { g: 46, d: 14, h: 14, b: 38 };
    const xmax = Math.max(...points.map((p) => p.x), 1e-9) * 1.1, ymax = Math.max(...points.map((p) => p.y), 1e-9) * 1.1;
    const X = (v) => m.g + (v / xmax) * (L - m.g - m.d), Y = (v) => H - m.b - (v / ymax) * (H - m.h - m.b);
    ctx.strokeStyle = css('--bord'); ctx.fillStyle = css('--texte-doux'); ctx.font = '11px Segoe UI'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const vx = (xmax / 5) * i, vy = (ymax / 5) * i;
      ctx.beginPath(); ctx.moveTo(X(vx), Y(0)); ctx.lineTo(X(vx), Y(ymax)); ctx.moveTo(X(0), Y(vy)); ctx.lineTo(X(xmax), Y(vy)); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(virgule(vx, 3), X(vx), H - m.b + 14);
      ctx.textAlign = 'right'; ctx.fillText(virgule(vy, 2), m.g - 4, Y(vy) + 4);
    }
    ctx.fillStyle = css('--texte'); ctx.font = '600 12px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(g.titreX, (L + m.g) / 2, H - 6);
    ctx.save(); ctx.translate(12, (H - m.b) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(g.titreY, 0, 0); ctx.restore();
    let modele = null;
    if (points.length >= 2) {
      const sxx = points.reduce((s, p) => s + p.x * p.x, 0), sxy = points.reduce((s, p) => s + p.x * p.y, 0);
      if (g.origine !== false && sxx) modele = { a: sxy / sxx, b: 0 };
      ctx.strokeStyle = css('--lv-c') || '#2563eb'; ctx.lineWidth = 2;
      if (modele) { ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(xmax), Y(modele.a * xmax)); ctx.stroke(); }
    }
    ctx.fillStyle = '#dc2626';
    for (const p of points) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2); ctx.fill(); }
    return modele;
  }

  // =====================================================================================
  function demarrer({ titre, sousTitre, couleur, icone, outil, manips, sansEpi = false }) {
    document.documentElement.style.setProperty('--lv-c', couleur);
    if (sansEpi) document.documentElement.classList.add('sans-epi'); // labo de maths : pas d'équipement de protection
    const $ = (id) => document.getElementById(id);
    const cle = (m) => `labo-virtuel:${outil}:${m.id}`;
    const lire = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
    const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* indisponible */ } };
    document.body.innerHTML = `
      <header class="lv-barre"><span style="font-size:22px">${icone}</span><h1 id="lv-titre">${echapper(titre)}</h1><span id="lv-sous" class="lv-badge" hidden></span><span class="lv-espace"></span><span id="lv-actions-barre"></span></header>
      <section class="lv-accueil" id="lv-accueil"><p>${echapper(sousTitre)}</p><div class="lv-gestion-manips" id="lv-gestion-manips" hidden></div><div class="lv-manips" id="lv-manips"></div>
        <div class="lv-ressources" id="lv-ressources-zone" hidden>
          <div class="lv-ressources-entete"><h2>🧩 Simulateurs et sites</h2><span class="lv-espace"></span><span id="lv-gestion"></span></div>
          <p class="lv-aide" id="lv-ressources-aide"></p>
          <div class="lv-manips" id="lv-ressources"></div>
        </div></section>
      <section class="lv-simulateur" id="lv-simulateur" hidden><iframe id="lv-cadre-simulateur" title="Simulateur" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads" allow="fullscreen; accelerometer; gyroscope"></iframe></section>
      <section class="lv-manip" id="lv-manip" hidden>
        <div class="lv-scene-zone">
          <div class="lv-epi" id="lv-epi"></div>
          <div class="lv-scene" id="lv-scene"></div>
          <div class="lv-message" id="lv-message"></div>
        </div>
        <aside class="lv-panneau" id="lv-panneau">
          <div class="lv-onglets"><button data-onglet="suivre" class="actif">📋 Suivre</button><button data-onglet="construire">🧩 Construire</button><button data-onglet="mesures">📊 Mesures</button><button class="lv-replier" id="lv-replier" title="Replier / déplier le protocole">⇥</button></div>
          <div class="lv-contenu" id="lv-contenu"></div>
        </aside>
      </section>`;

    let m = null, s = null, onglet = 'suivre';
    // s = session : { etat, historique, epi, reponses, tableau, protocole, verification }
    const enregistrer = () => { if (m) ecrire(cle(m), s); };
    function nouvelleSession(manip) {
      const lignes = (manip.mesures && manip.mesures.lignes ? manip.mesures.lignes.map((l) => ({ ...l })) : []);
      return { etat: manip.etatInitial(), historique: [], epi: [], reponses: {}, tableau: lignes, protocole: [], verification: null, termine: false };
    }

    // ---------- Contenu ajouté par l'enseignant (dossier partagé, copié sur le PC) ----------
    // info : { ressources (liens, simulateurs), experiences (créées par le professeur), masques (manipulations fournies masquées), peutGerer, partage }
    const apiLabos = () => window.parent && window.parent.labo && window.parent.labo.labos;
    let info = { ressources: [], experiences: [], masques: [], peutGerer: false, partage: false };
    async function chargerInfo() {
      if (!apiLabos()) return info;
      try { const r = await apiLabos().lister(outil); if (r && r.ok) info = { ...r, experiences: r.experiences || [], masques: r.masques || [], ressources: r.ressources || [] }; } catch { /* hors de l'application */ }
      return info;
    }
    // Une expérience du professeur prend la forme d'une manipulation : le contenu remplace la paillasse,
    // le protocole (une étape par ligne) s'affiche dans « Suivre » et l'élève coche lui-même les étapes.
    const ICONES_EXP = { integration: '🧩', lien: '🔗', simulateur: '🖥️' };
    const estQuestion = (t) => /\?\s*$/.test(t);
    function versManip(x) {
      return {
        id: 'prof-' + x.id, perso: x, icone: ICONES_EXP[x.contenu] || '🧪', titre: x.titre, theme: x.theme || 'Expérience du professeur',
        niveaux: x.niveaux || [], duree: '', objectif: x.objectif || '', epi: [], actions: {},
        etatInitial: () => ({ coches: {} }), vue: () => ({ svg: '' }),
        etapes: (x.etapes || []).map((t, i) => {
          const id = 'e' + i, q = estQuestion(t);
          return { id, texte: echapper(t), ordre: i, question: q ? { texte: 'Ta réponse :', type: 'texte' } : undefined, coche: !q,
            fait: (etat, _h, ses) => (q ? String((ses.reponses || {})[id] ?? '').trim() !== '' : !!(etat.coches || {})[id]) };
        }),
      };
    }
    const persos = () => info.experiences.map(versManip);
    // Activités fournies « integre » (ex. Équations à la balance) : une page de l'application à la place de la paillasse.
    let cacheFournis = null;
    const fournis = () => cacheFournis || (cacheFournis = manips.map((x) => (x.integre
      ? { ...versManip({ id: x.id, titre: x.titre, theme: x.theme, niveaux: x.niveaux, objectif: x.objectif, contenu: 'page', url: x.integre, etapes: x.etapes }), id: x.id, icone: x.icone || '🧩', fourni: true, auteur: x.auteur || '' }
      : x)));
    const parProf = (x) => !!(x.perso && !x.fourni);
    const masquee = (x) => info.masques.includes(x.id);
    // Manipulations proposées : fournies (sauf masquées, que seul l'enseignant voit, grisées) + expériences du professeur.
    const manipsVisibles = () => [...fournis(), ...persos()].filter((x) => info.peutGerer || !masquee(x));
    const trouver = (id) => manipsVisibles().find((x) => x.id === id);
    function afficherRessources() {
      const r = info;
      const zone = $('lv-ressources-zone');
      if (!apiLabos()) { zone.hidden = true; return; }
      zone.hidden = !r.ressources.length && !r.peutGerer;
      $('lv-gestion').innerHTML = r.peutGerer ? '<button class="btn" id="lv-ajout-lien">🔗 Ajouter un lien vers un site</button> <button class="btn principal" id="lv-ajout-simulateur">📦 Installer un simulateur</button>' : '';
      $('lv-ressources-aide').innerHTML = r.peutGerer
        ? (r.partage ? 'Ajoute ici des simulateurs (une page HTML, ou un dossier compressé .zip contenant une page index.html — par exemple une simulation PhET téléchargée) ou des liens vers des sites. Tes élèves les retrouvent dans ce labo ; les simulateurs fonctionnent aussi sans réseau.' : '⚠ Choisis d\'abord le dossier partagé du lycée dans les réglages : les ressources y sont rangées pour tous les PC.')
        : 'Simulateurs et sites choisis par ton professeur.';
      $('lv-ressources').innerHTML = r.ressources.map((x) => `<div class="lv-carte lv-ressource" role="button" tabindex="0" data-ressource="${echapper(x.id)}">
          <span class="lv-ic">${x.type === 'lien' ? '🔗' : '🧩'}</span>
          <span class="lv-theme">${x.type === 'lien' ? 'Site · ' + echapper(hote(x.url)) : 'Simulateur installé'}</span>
          <h2>${echapper(x.titre)}</h2>${x.description ? `<p>${echapper(x.description)}</p>` : ''}
          ${r.peutGerer ? `<span class="lv-badges"><button class="btn danger" data-retirer-ressource="${echapper(x.id)}">🗑 Retirer</button></span>` : ''}
        </div>`).join('') || (r.peutGerer ? '<p class="lv-aide">Aucune ressource pour l\'instant.</p>' : '');
      $('lv-ressources').querySelectorAll('[data-ressource]').forEach((el) => {
        const x = r.ressources.find((y) => y.id === el.dataset.ressource);
        const ouvrirRessource = (e) => {
          if (e.target.closest('[data-retirer-ressource]')) return;
          if (x.type === 'lien') { if (window.parent.ouvrirLienLabo) window.parent.ouvrirLienLabo(x.url, x.titre, outil); }
          else ouvrirSimulateur(x);
        };
        el.addEventListener('click', ouvrirRessource);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') ouvrirRessource(e); });
      });
      $('lv-ressources').querySelectorAll('[data-retirer-ressource]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const x = r.ressources.find((y) => y.id === b.dataset.retirerRessource);
        if (!confirm(`Retirer « ${x.titre} » de ce labo pour tous les élèves ?`)) return;
        const res = await apiLabos().supprimer(outil, x.id);
        if (!res.ok) Doc.message(res.message, 'erreur'); else rafraichir();
      }));
      $('lv-ajout-lien')?.addEventListener('click', async () => {
        const v = await formulaire('Ajouter un lien vers un site', [{ id: 'titre', label: 'Titre affiché aux élèves', placeholder: 'ex. Simulation : circuit électrique (PhET)' }, { id: 'url', label: 'Adresse du site', placeholder: 'https://…' }, { id: 'description', label: 'Consigne ou description (facultatif)', placeholder: 'ex. Mesure l\'intensité dans chaque branche' }]);
        if (!v) return;
        const res = await apiLabos().ajouterLien(outil, v);
        if (!res.ok) Doc.message(res.message, 'erreur'); else { Doc.message('Lien ajouté au labo.'); rafraichir(); }
      });
      $('lv-ajout-simulateur')?.addEventListener('click', async () => {
        const v = await formulaire('Installer un simulateur', [{ id: 'titre', label: 'Titre affiché aux élèves', placeholder: 'ex. Construction d\'un circuit (PhET)' }, { id: 'description', label: 'Consigne ou description (facultatif)', placeholder: '' }], 'Choisir le fichier…');
        if (!v) return;
        const res = await apiLabos().installer(outil, v);
        if (!res.ok) Doc.message(res.message, 'erreur'); else if (!res.annule) { Doc.message('Simulateur installé : tes élèves le retrouvent dans ce labo.'); rafraichir(); }
      });
    }
    const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
    const adresseSimulateur = (id, entree) => `app://simulateurs/${encodeURIComponent(outil)}/${encodeURIComponent(id)}/${String(entree || 'index.html').split('/').map(encodeURIComponent).join('/')}`;
    function ouvrirSimulateur(x) {
      $('lv-accueil').hidden = true; $('lv-manip').hidden = true; $('lv-simulateur').hidden = false;
      $('lv-titre').textContent = `🧩 ${x.titre}`;
      $('lv-sous').hidden = true;
      $('lv-actions-barre').innerHTML = '<button class="btn" id="lv-retour-sim">← Retour au labo</button>';
      $('lv-retour-sim').addEventListener('click', () => { $('lv-cadre-simulateur').src = 'about:blank'; $('lv-simulateur').hidden = true; accueil(); });
      $('lv-cadre-simulateur').src = adresseSimulateur(x.id, x.entree);
    }
    // Petite fenêtre de saisie (plusieurs champs)
    function formulaire(titreF, champs, valider = 'Ajouter') {
      return new Promise((resoudre) => {
        const fond = document.createElement('div');
        fond.className = 'doc-fenetre-fond';
        fond.innerHTML = `<form class="doc-fenetre"><label>${echapper(titreF)}</label>${champs.map((c) => `<span class="lv-champ-form">${echapper(c.label)}<input name="${c.id}" placeholder="${echapper(c.placeholder || '')}" maxlength="240"></span>`).join('')}
          <div class="doc-fenetre-boutons"><button type="button" class="btn" data-annuler>Annuler</button><button type="submit" class="btn principal">${echapper(valider)}</button></div></form>`;
        const fermer = (v) => { fond.remove(); resoudre(v); };
        fond.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); fermer(Object.fromEntries(champs.map((c) => [c.id, fond.querySelector(`[name="${c.id}"]`).value.trim()]))); });
        fond.querySelector('[data-annuler]').addEventListener('click', () => fermer(null));
        fond.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(null); });
        document.body.append(fond);
        fond.querySelector('input').focus();
      });
    }

    // ---------- « Créer mon expérience » (enseignant) ----------
    const NIVEAUX = ['CAP', '2de', '1re', 'Tle'];
    const AIDE_CONTENU = {
      integration: ['Lien d\'intégration', 'Colle l\'adresse ou le code <iframe …> donné par le site (GeoGebra : Partager › Intégrer ; PhET : Partager › Intégrer ; LearningApps : Afficher › Intégrer). L\'activité s\'affiche dans le labo, à la place de la paillasse.', 'https://… ou <iframe src="https://…"></iframe>'],
      lien: ['Adresse du site', 'Le site s\'ouvre dans le navigateur de l\'application, limité à ce site. Pour les sites qui refusent de s\'afficher dans le labo.', 'https://…'],
      simulateur: ['Simulateur', 'Une page HTML, ou un dossier compressé .zip contenant une page index.html (par exemple une simulation PhET téléchargée). Il fonctionne aussi sans réseau.', ''],
    };
    function formulaireExperience(x) {
      const v = x || { titre: '', theme: '', niveaux: [], objectif: '', contenu: 'integration', url: '', etapes: [] };
      return new Promise((resoudre) => {
        const fond = document.createElement('div');
        fond.className = 'doc-fenetre-fond';
        fond.innerHTML = `<form class="doc-fenetre lv-fenetre-exp" id="lv-form-exp"><label>${x ? '✏️ Modifier mon expérience' : '➕ Créer mon expérience'}</label>
          <span class="lv-champ-form">Titre affiché aux élèves<input name="titre" maxlength="80" value="${echapper(v.titre)}" placeholder="ex. Chute libre d'une balle"></span>
          <span class="lv-champ-form">Thème (facultatif)<input name="theme" maxlength="60" value="${echapper(v.theme)}" placeholder="ex. Mécanique, Géométrie…"></span>
          <span class="lv-champ-form">Niveaux<span class="lv-cases">${NIVEAUX.map((n) => `<label><input type="checkbox" name="niveau" value="${n}" ${v.niveaux.includes(n) ? 'checked' : ''}> ${n}</label>`).join('')}</span></span>
          <span class="lv-champ-form">Consigne ou objectif<textarea name="objectif" rows="2" maxlength="600" placeholder="ex. Montrer que la vitesse augmente pendant la chute.">${echapper(v.objectif)}</textarea></span>
          <span class="lv-champ-form">Contenu de l'expérience<span class="lv-cases">
            <label><input type="radio" name="contenu" value="integration" ${v.contenu === 'integration' ? 'checked' : ''}> 🧩 Lien d'intégration</label>
            <label><input type="radio" name="contenu" value="lien" ${v.contenu === 'lien' ? 'checked' : ''}> 🔗 Lien vers un site</label>
            <label><input type="radio" name="contenu" value="simulateur" ${v.contenu === 'simulateur' ? 'checked' : ''}> 🖥️ Simulateur installé</label></span></span>
          <span class="lv-champ-form" id="lv-zone-url"><span id="lv-titre-url"></span><textarea name="url" rows="2" maxlength="4000">${echapper(v.url)}</textarea></span>
          <label class="lv-champ-case" id="lv-zone-fichier" hidden><input type="checkbox" name="changerFichier"> Remplacer le fichier du simulateur${x && x.source ? ` (actuel : ${echapper(x.source)})` : ''}</label>
          <p class="lv-aide" id="lv-aide-contenu"></p>
          <span class="lv-champ-form">Protocole : une étape par ligne<textarea name="protocole" rows="6" placeholder="Règle la hauteur de chute à 2 m.&#10;Lâche la balle et relève la durée de chute.&#10;Que remarques-tu sur la vitesse ?">${echapper((v.etapes || []).join('\n'))}</textarea></span>
          <p class="lv-aide">L'élève coche chaque étape quand il l'a faite. Une ligne qui se termine par « ? » devient une question, avec une zone de réponse.</p>
          <p class="lv-erreur" id="lv-erreur-exp" hidden></p>
          <div class="doc-fenetre-boutons"><button type="button" class="btn" data-annuler>Annuler</button><button type="submit" class="btn principal" id="lv-valider-exp">Enregistrer</button></div></form>`;
        const f = fond.querySelector('form');
        const contenu = () => f.querySelector('[name=contenu]:checked').value;
        const majContenu = () => {
          const c = contenu(), [t, aide, ph] = AIDE_CONTENU[c];
          $('lv-zone-url').hidden = c === 'simulateur';
          $('lv-titre-url').textContent = t;
          f.querySelector('[name=url]').placeholder = ph;
          const garder = !!(x && x.contenu === 'simulateur');
          $('lv-zone-fichier').hidden = !(c === 'simulateur' && garder);
          $('lv-aide-contenu').textContent = aide;
          $('lv-valider-exp').textContent = c === 'simulateur' && !(garder && !f.querySelector('[name=changerFichier]').checked) ? 'Choisir le fichier et enregistrer' : 'Enregistrer';
        };
        f.querySelectorAll('[name=contenu], [name=changerFichier]').forEach((el) => el.addEventListener('change', majContenu));
        const fermer = (r) => { fond.remove(); resoudre(r); };
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = {
            id: x ? x.id : undefined, titre: f.titre.value.trim(), theme: f.theme.value.trim(), objectif: f.objectif.value.trim(),
            niveaux: [...f.querySelectorAll('[name=niveau]:checked')].map((c) => c.value), contenu: contenu(),
            url: f.url.value.trim(), protocole: f.protocole.value, changerFichier: f.changerFichier.checked,
          };
          const erreur = (t) => { $('lv-erreur-exp').hidden = !t; $('lv-erreur-exp').textContent = t || ''; };
          if (!d.titre) return erreur('Donne un titre à ton expérience.');
          if (d.contenu !== 'simulateur' && !d.url) return erreur('Indique l\'adresse (ou le code d\'intégration).');
          erreur('');
          $('lv-valider-exp').disabled = true;
          const res = await apiLabos().experience(outil, d);
          $('lv-valider-exp').disabled = false;
          if (!res.ok) return erreur(res.message);
          if (res.annule) return; // choix du fichier annulé : on reste dans la fenêtre
          fermer(res);
        });
        fond.querySelector('[data-annuler]').addEventListener('click', () => fermer(null));
        fond.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(null); });
        document.body.append(fond);
        majContenu();
        f.titre.focus();
      });
    }

    // ---------- Accueil ----------
    async function rafraichir() { await chargerInfo(); if (!m && !$('lv-accueil').hidden) { afficherCartes(); afficherRessources(); } }
    function accueil() {
      m = null; s = null;
      $('lv-accueil').hidden = false; $('lv-manip').hidden = true; $('lv-sous').hidden = true; $('lv-simulateur').hidden = true;
      $('lv-scene').innerHTML = ''; $('lv-scene').dataset.exp = ''; // arrête un site intégré
      $('lv-titre').textContent = titre;
      $('lv-actions-barre').innerHTML = '';
      afficherCartes();
      rafraichir();
    }
    function afficherCartes() {
      const gerer = info.peutGerer;
      $('lv-gestion-manips').hidden = !gerer;
      $('lv-gestion-manips').innerHTML = gerer ? `<button class="btn principal" id="lv-creer-exp">➕ Créer mon expérience</button>
        <span class="lv-aide">${info.partage ? 'Ajoute ta propre expérience (activité GeoGebra, PhET, LearningApps…, site ou simulateur) avec ton protocole. « 🙈 Masquer » cache une activité à tes élèves sans la supprimer.' : '⚠ Choisis d\'abord le dossier partagé du lycée dans les réglages : tes expériences y sont rangées pour tous les PC.'}</span>` : '';
      const liste = manipsVisibles();
      $('lv-manips').innerHTML = liste.map((x) => {
        const fait = lire(cle(x), null), cachee = masquee(x);
        return `<div class="lv-carte${cachee ? ' masquee' : ''}${parProf(x) ? ' perso' : ''}" role="button" tabindex="0" data-manip="${echapper(x.id)}"><span class="lv-ic">${x.icone}</span><span class="lv-theme">${echapper(x.theme)}</span><h2>${echapper(x.titre)}</h2>
          ${x.objectif ? `<p>${echapper(x.objectif)}</p>` : ''}<span class="lv-badges">${x.niveaux.map((n) => `<span class="lv-badge">${echapper(n)}</span>`).join('')}${x.duree ? `<span class="lv-badge">⏱ ${echapper(x.duree)}</span>` : ''}</span>
          ${parProf(x) ? '<span class="lv-auteur">🧑‍🏫 Créée par le professeur</span>' : x.auteur ? `<span class="lv-auteur">${echapper(x.auteur)}</span>` : ''}
          ${cachee ? '<span class="lv-auteur">🙈 Masquée : les élèves ne la voient pas</span>' : ''}
          ${fait && fait.termine ? '<span class="lv-fait">✔ Manipulation terminée</span>' : fait && fait.historique && fait.historique.length ? '<span class="lv-fait" style="color:#b45309">… en cours</span>' : ''}
          ${gerer ? `<span class="lv-gestion-carte"><button class="btn" data-masquer="${echapper(x.id)}" data-etat="${cachee ? '0' : '1'}">${cachee ? '👁 Réafficher' : '🙈 Masquer'}</button>${parProf(x)
            ? `<button class="btn" data-modifier="${echapper(x.perso.id)}">✏️ Modifier</button><button class="btn danger" data-supprimer="${echapper(x.perso.id)}">🗑 Supprimer</button>` : ''}</span>` : ''}</div>`;
      }).join('') || '<p class="lv-aide">Aucune manipulation proposée pour l\'instant.</p>';
      $('lv-manips').querySelectorAll('[data-manip]').forEach((el) => {
        const go = (e) => { if (e.target.closest('.lv-gestion-carte')) return; const x = trouver(el.dataset.manip); if (x) ouvrir(x); };
        el.addEventListener('click', go);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === el) go(e); });
      });
      $('lv-manips').querySelectorAll('[data-masquer]').forEach((b) => b.addEventListener('click', async () => {
        const res = await apiLabos().masquer(outil, b.dataset.masquer, b.dataset.etat === '1');
        if (!res.ok) Doc.message(res.message, 'erreur'); else { Doc.message(b.dataset.etat === '1' ? 'Manipulation masquée : tes élèves ne la voient plus.' : 'Manipulation réaffichée pour tes élèves.'); rafraichir(); }
      }));
      $('lv-manips').querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', async () => {
        const x = info.experiences.find((y) => y.id === b.dataset.modifier);
        if (x && await formulaireExperience(x)) { Doc.message('Expérience modifiée.'); rafraichir(); }
      }));
      $('lv-manips').querySelectorAll('[data-supprimer]').forEach((b) => b.addEventListener('click', async () => {
        const x = info.experiences.find((y) => y.id === b.dataset.supprimer);
        if (!x || !confirm(`Supprimer l'expérience « ${x.titre} » pour tous les élèves ?`)) return;
        const res = await apiLabos().supprimer(outil, x.id);
        if (!res.ok) Doc.message(res.message, 'erreur'); else { Doc.message('Expérience supprimée.'); rafraichir(); }
      }));
      $('lv-creer-exp')?.addEventListener('click', async () => {
        if (await formulaireExperience(null)) { Doc.message('Expérience créée : tes élèves la retrouvent dans ce labo.'); rafraichir(); }
      });
    }

    // ---------- Une manipulation ----------
    function ouvrir(manip) {
      m = manip;
      s = lire(cle(m), null) || nouvelleSession(m);
      $('lv-accueil').hidden = true; $('lv-manip').hidden = false; $('lv-simulateur').hidden = true;
      $('lv-titre').textContent = `${m.icone} ${m.titre}`;
      // onglets utiles seulement : « Construire » s'il y a des étapes pièges, « Mesures » s'il y a un tableau
      const avecConstruire = !!(m.distracteurs && m.distracteurs.length), avecMesures = !!m.mesures;
      document.querySelector('[data-onglet="construire"]').hidden = !avecConstruire;
      document.querySelector('[data-onglet="mesures"]').hidden = !avecMesures;
      if ((onglet === 'construire' && !avecConstruire) || (onglet === 'mesures' && !avecMesures)) onglet = 'suivre';
      $('lv-sous').hidden = !m.niveaux.length; $('lv-sous').textContent = m.niveaux.join(' · ');
      $('lv-actions-barre').innerHTML = '<button class="btn" id="lv-recommencer" title="Remettre la paillasse à zéro">↺ Recommencer</button><button class="btn" id="lv-retour">← Manipulations</button>';
      $('lv-retour').addEventListener('click', accueil);
      $('lv-recommencer').addEventListener('click', () => { if (confirm('Tout recommencer ? La paillasse, tes mesures et tes réponses seront effacées.')) { s = nouvelleSession(m); enregistrer(); message(''); dessiner(); } });
      message(m.perso ? (s.historique.length ? 'Tu reprends là où tu t\'étais arrêté.' : 'Lis l\'objectif, suis le protocole à droite et coche chaque étape quand tu l\'as faite.')
        : s.historique.length ? 'Tu reprends là où tu t\'étais arrêté.' : 'Commence par lire l\'objectif et le protocole à droite.');
      dessiner();
    }
    // Expérience du professeur : le contenu (site intégré, lien, simulateur) remplace la paillasse.
    function sceneExperience(x) {
      const cadre = (src) => `<iframe class="lv-integration" src="${echapper(src)}" title="${echapper(x.titre)}" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads" allow="fullscreen; accelerometer; gyroscope" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      if (x.contenu === 'integration' || x.contenu === 'page') return cadre(x.url);
      if (x.contenu === 'simulateur') return cadre(adresseSimulateur(x.id, x.entree));
      return `<div class="lv-lien-exp"><span class="lv-ic">🔗</span><p>Cette expérience se fait sur le site <b>${echapper(hote(x.url))}</b>.</p>
        <button class="btn principal" data-ouvrir-lien>🔗 Ouvrir le site</button><p class="lv-aide">Reviens ensuite ici (bouton « Retour ») pour cocher les étapes et répondre aux questions.</p></div>`;
    }
    function message(texte, type = '') { $('lv-message').textContent = texte; $('lv-message').className = 'lv-message' + (type ? ' ' + type : ''); }
    const outils = {
      message,
      epi: (nom) => s.epi.includes(nom),
      remplir(ligneId, col, valeur) {
        let l = s.tableau.find((x) => x.id === ligneId);
        if (!l) { l = { id: ligneId }; s.tableau.push(l); }
        l[col] = valeur;
      },
      ajouterLigne(l) { s.tableau.push({ id: 'l' + Date.now() + Math.random().toString(36).slice(2, 5), ...l }); },
      lignes: () => s.tableau,
      virgule, nombre,
    };
    function dessiner() {
      const scene = $('lv-scene');
      $('lv-epi').hidden = !!m.perso;
      scene.classList.toggle('plein', !!(m.perso && m.perso.contenu !== 'lien'));
      if (m.perso) {
        // dessiné une seule fois : cocher une étape ne recharge pas le site intégré
        if (scene.dataset.exp !== m.id) { scene.innerHTML = sceneExperience(m.perso); scene.dataset.exp = m.id; }
        afficherPanneau();
        return;
      }
      scene.dataset.exp = '';
      // EPI
      $('lv-epi').innerHTML = (m.epi && m.epi.length ? `<b>Équipement :</b>${m.epi.map((e) => `<button data-epi="${e}" class="${s.epi.includes(e) ? 'porte' : ''}">${EPI[e]} ${s.epi.includes(e) ? '✔' : ''}</button>`).join('')}` : '<b>Pas d\'équipement de protection particulier pour cette manipulation.</b>');
      $('lv-epi').querySelectorAll('[data-epi]').forEach((b) => b.addEventListener('click', () => {
        const e = b.dataset.epi;
        s.epi = s.epi.includes(e) ? s.epi.filter((x) => x !== e) : [...s.epi, e];
        s.historique.push({ a: 'epi', arg: e, t: Date.now() });
        enregistrer(); dessiner();
      }));
      // Paillasse
      const v = m.vue(s.etat, outils);
      $('lv-scene').innerHTML = `${v.svg}${v.commandes ? `<div class="lv-commandes">${v.commandes}</div>` : ''}`;
      afficherPanneau();
    }
    // Clics et réglages sur la paillasse
    function agir(el) {
      const a = el.dataset.action;
      if (!a || !m.actions[a]) return;
      const arg = el.dataset.arg === '$valeur' ? el.value : el.dataset.arg;
      const manque = (m.epi || []).filter((e) => !s.epi.includes(e));
      if (manque.length && !(m.actionsSansEpi || []).includes(a)) {
        message(`⚠ Avant de manipuler, équipe-toi : ${manque.map((e) => EPI[e]).join(', ')}.`, 'danger');
        return;
      }
      const r = m.actions[a](s.etat, arg, outils);
      if (r === false) { dessiner(); return; }
      s.historique.push({ a, arg, t: Date.now() });
      enregistrer();
      dessiner();
    }
    $('lv-scene').addEventListener('click', (e) => {
      if (e.target.closest('[data-ouvrir-lien]') && m && m.perso) { if (window.parent.ouvrirLienLabo) window.parent.ouvrirLienLabo(m.perso.url, m.perso.titre, outil, m.id); return; }
      const el = e.target.closest('[data-action]'); if (el && el.tagName !== 'SELECT' && el.tagName !== 'INPUT') agir(el); });
    $('lv-scene').addEventListener('change', (e) => { const el = e.target.closest('select[data-action], input[data-action]'); if (el) agir(el); });

    // ---------- Panneau du protocole ----------
    document.querySelectorAll('.lv-onglets [data-onglet]').forEach((b) => b.addEventListener('click', () => { onglet = b.dataset.onglet; afficherPanneau(); }));
    $('lv-replier').addEventListener('click', () => $('lv-panneau').classList.toggle('replie'));
    function etapesFaites() { return new Set(m.etapes.filter((e) => { try { return e.fait(s.etat, s.historique, s); } catch { return false; } }).map((e) => e.id)); }
    function corriger(q, rep) {
      if (q.reponse === undefined || rep === undefined || rep === '') return null;
      const attendu = typeof q.reponse === 'function' ? q.reponse(s.etat) : q.reponse; // ex. valeur tirée au hasard pour cet élève
      if (q.type === 'nombre') { const n = nombre(rep); return n !== null && Math.abs(n - attendu) <= (q.tolerance ?? Math.abs(attendu) * 0.03); }
      return String(rep) === String(attendu);
    }
    function afficherPanneau() {
      document.querySelectorAll('.lv-onglets [data-onglet]').forEach((b) => b.classList.toggle('actif', b.dataset.onglet === onglet));
      const zone = $('lv-contenu');
      if (onglet === 'suivre') zone.innerHTML = vueSuivre();
      else if (onglet === 'construire') zone.innerHTML = vueConstruire();
      else zone.innerHTML = vueMesures();
      brancherPanneau(zone);
    }
    function vueSuivre() {
      const faites = etapesFaites();
      // ordre : celui que l'élève a construit et validé, sinon celui du professeur
      const ordre = s.verification && s.verification.ok ? s.protocole.map((id) => m.etapes.find((e) => e.id === id)).filter(Boolean) : [...m.etapes].sort((a, b) => a.ordre - b.ordre);
      const courante = ordre.find((e) => !faites.has(e.id));
      const toutes = ordre.length > 0 && ordre.every((e) => faites.has(e.id) && (!e.question || corriger(e.question, s.reponses[e.id]) !== false && (s.reponses[e.id] ?? '') !== ''));
      if (toutes && !s.termine) { s.termine = true; enregistrer(); }
      else if (m.perso && !toutes && s.termine) { s.termine = false; enregistrer(); } // étape décochée
      return `${m.objectif ? `<div class="lv-objectif"><b>Objectif :</b> ${echapper(m.objectif)}</div>` : ''}
        ${s.verification && s.verification.ok ? '<p class="lv-aide">Tu suis <b>ton</b> protocole (construit dans l\'onglet 🧩).</p>' : ''}
        ${m.perso ? (ordre.length ? '<p class="lv-aide">Clique sur le numéro d\'une étape pour la cocher quand tu l\'as faite. Réponds aux questions dans les zones prévues.</p>' : '<p class="lv-aide">Pas de protocole : réalise l\'activité en suivant l\'objectif.</p>') : ''}
        <ol class="lv-etapes">${ordre.map((e, i) => {
          const q = e.question;
          const rep = s.reponses[e.id] ?? '';
          const c = q ? corriger(q, rep) : null;
          const num = faites.has(e.id) ? '✓' : i + 1;
          return `<li class="lv-etape ${faites.has(e.id) ? 'fait' : ''} ${courante === e ? 'courante' : ''}">${e.coche ? `<button class="lv-num lv-cocher" data-cocher="${e.id}" title="${faites.has(e.id) ? 'Décocher' : 'Cocher : étape faite'}" aria-pressed="${faites.has(e.id)}">${num}</button>` : `<span class="lv-num">${num}</span>`}<span>${e.texte}</span>
            ${q ? `<label class="lv-question">${echapper(q.texte)}
              ${q.type === 'choix' ? `<select data-reponse="${e.id}"><option value="">— choisir —</option>${q.options.map((o) => `<option ${o === rep ? 'selected' : ''}>${echapper(o)}</option>`).join('')}</select>`
              : q.type === 'nombre' ? `<input data-reponse="${e.id}" inputmode="decimal" value="${echapper(rep)}" placeholder="ta réponse">`
              : `<textarea data-reponse="${e.id}" rows="2" placeholder="ton observation…">${echapper(rep)}</textarea>`}
              ${c === true ? '<span class="lv-correction ok">✔ Correct</span>' : c === false ? '<span class="lv-correction ko">✘ Vérifie ta réponse</span>' : ''}</label>` : ''}</li>`;
        }).join('')}</ol>
        ${toutes ? `<div class="lv-bravo">${m.mesures ? '🎉 Manipulation terminée ! Pense à enregistrer tes mesures (onglet 📊).' : '🎉 Bravo, tu as terminé !'}</div>` : ''}`;
    }
    function vueConstruire() {
      const choisies = new Set(s.protocole);
      const cartes = melanger([...m.etapes.map((e) => ({ id: e.id, texte: e.texte })), ...(m.distracteurs || []).map((d, i) => ({ id: 'x' + i, texte: d.texte }))]).filter((c) => !choisies.has(c.id));
      const texte = (id) => (id.startsWith('x') ? m.distracteurs[+id.slice(1)].texte : (m.etapes.find((e) => e.id === id) || {}).texte);
      const v = s.verification;
      return `<p class="lv-aide">Construis le protocole <b>dans le bon ordre</b> : clique sur les étapes à faire. Attention, certaines sont <b>fausses ou dangereuses</b> ! Puis clique sur <b>Vérifier</b>.</p>
        <div class="lv-titre-bloc">Mon protocole (${s.protocole.length})</div>
        ${s.protocole.length ? `<ol class="lv-mon-protocole">${s.protocole.map((id, i) => `<li class="${v && v.marques ? v.marques[id] || '' : ''}"><span>${texte(id)}</span><span class="lv-petits"><button data-monter="${i}" title="Monter">↑</button><button data-descendre="${i}" title="Descendre">↓</button><button data-retirer="${i}" title="Retirer">✕</button></span></li>`).join('')}</ol>` : '<p class="lv-aide">Aucune étape pour l\'instant.</p>'}
        <div class="lv-actions-mesures"><button class="btn principal" id="lv-verifier" ${s.protocole.length ? '' : 'disabled'}>✔ Vérifier mon protocole</button>${s.protocole.length ? '<button class="btn" id="lv-vider">Tout retirer</button>' : ''}</div>
        ${v ? `<div class="lv-verif">${v.lignes.map((l) => `<span class="${l[0]}">${l[1]}</span>`).join('')}</div>` : ''}
        <div class="lv-titre-bloc">Étapes proposées</div>
        <div class="lv-cartes-etapes">${cartes.map((c) => `<button data-ajouter="${c.id}">＋ ${c.texte}</button>`).join('') || '<p class="lv-aide">Toutes les étapes sont dans ton protocole.</p>'}</div>`;
    }
    function verifierProtocole() {
      const lignes = [], marques = {};
      const vraies = s.protocole.filter((id) => !id.startsWith('x'));
      const intrus = s.protocole.filter((id) => id.startsWith('x'));
      intrus.forEach((id) => { marques[id] = 'ko'; const d = m.distracteurs[+id.slice(1)]; lignes.push(['ko', `✘ « ${d.texte} » : ${d.pourquoi}`]); });
      const manquantes = m.etapes.filter((e) => !vraies.includes(e.id));
      manquantes.forEach((e) => lignes.push(['ko', `✘ Il manque une étape : « ${e.texte} »`]));
      let ordreOk = true;
      vraies.forEach((id, i) => {
        const e = m.etapes.find((x) => x.id === id);
        const avant = vraies.slice(0, i).map((x) => m.etapes.find((y) => y.id === x));
        const malPlacee = avant.some((p) => p.ordre > e.ordre);
        marques[id] = malPlacee ? 'ko' : 'ok';
        if (malPlacee) ordreOk = false;
      });
      if (!ordreOk) lignes.push(['ko', '✘ Certaines étapes (en rouge) ne sont pas au bon endroit : réfléchis à ce qu\'il faut faire avant.']);
      const ok = !intrus.length && !manquantes.length && ordreOk;
      if (ok) lignes.unshift(['ok', '🎉 Ton protocole est correct ! Tu peux le réaliser : il s\'affiche dans l\'onglet 📋 Suivre.']);
      else lignes.unshift(['info', `${vraies.filter((id) => marques[id] === 'ok').length} étape(s) bien placée(s) sur ${m.etapes.length}${intrus.length ? ` · ${intrus.length} étape(s) à retirer` : ''}.`]);
      s.verification = { ok, lignes, marques };
      enregistrer();
    }
    function vueMesures() {
      const ms = m.mesures;
      if (!ms) return '<p class="lv-aide">Pas de tableau de mesures pour cette manipulation.</p>';
      const cell = (l, c) => {
        const v = l[c.id] ?? '';
        if (c.saisie) {
          const att = c.attendu ? c.attendu(l, s.etat) : undefined;
          const ok = att === undefined || v === '' ? '' : (c.choix ? v === att : (nombre(v) !== null && Math.abs(nombre(v) - att) <= (c.tolerance ?? Math.max(0.05, Math.abs(att) * 0.05)))) ? 'ok' : 'ko';
          return `<td class="${ok}">${c.choix ? `<select data-saisie="${l.id}" data-col="${c.id}"><option value=""></option>${c.choix.map((o) => `<option ${o === v ? 'selected' : ''}>${echapper(o)}</option>`).join('')}</select>` : `<input data-saisie="${l.id}" data-col="${c.id}" value="${echapper(v)}" inputmode="decimal">`}</td>`;
        }
        return `<td>${typeof v === 'number' ? virgule(v, c.decimales ?? 2) : echapper(v)}</td>`;
      };
      const g = ms.graphique;
      return `<table class="lv-tableau"><thead><tr>${ms.colonnes.map((c) => `<th>${echapper(c.titre)}</th>`).join('')}</tr></thead>
        <tbody>${s.tableau.map((l) => `<tr>${ms.colonnes.map((c) => cell(l, c)).join('')}</tr>`).join('') || `<tr><td colspan="${ms.colonnes.length}" style="color:var(--texte-doux)">Les mesures s'ajoutent ici quand tu les relèves.</td></tr>`}</tbody></table>
        ${ms.aide ? `<p class="lv-aide" style="margin-top:6px">${ms.aide}</p>` : ''}
        ${g ? '<canvas class="lv-graphique" id="lv-graphique"></canvas><div class="lv-equation" id="lv-equation"></div>' : ''}
        <div class="lv-actions-mesures"><button class="btn" id="lv-exporter" ${s.tableau.length ? '' : 'disabled'}>💾 Enregistrer mes mesures (tableur)</button></div>`;
    }
    function brancherPanneau(zone) {
      zone.querySelectorAll('[data-reponse]').forEach((el) => el.addEventListener('change', () => { s.reponses[el.dataset.reponse] = el.value; if (m.perso) s.historique.push({ a: 'reponse', arg: el.dataset.reponse, t: Date.now() }); enregistrer(); afficherPanneau(); }));
      zone.querySelectorAll('[data-cocher]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.cocher;
        s.etat.coches = { ...(s.etat.coches || {}), [id]: !(s.etat.coches || {})[id] };
        s.historique.push({ a: 'cocher', arg: id, t: Date.now() });
        enregistrer(); afficherPanneau();
      }));
      zone.querySelectorAll('[data-ajouter]').forEach((b) => b.addEventListener('click', () => { s.protocole.push(b.dataset.ajouter); s.verification = null; enregistrer(); afficherPanneau(); }));
      zone.querySelectorAll('[data-retirer]').forEach((b) => b.addEventListener('click', () => { s.protocole.splice(+b.dataset.retirer, 1); s.verification = null; enregistrer(); afficherPanneau(); }));
      zone.querySelectorAll('[data-monter]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.monter; if (i > 0) { [s.protocole[i - 1], s.protocole[i]] = [s.protocole[i], s.protocole[i - 1]]; s.verification = null; enregistrer(); afficherPanneau(); } }));
      zone.querySelectorAll('[data-descendre]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.descendre; if (i < s.protocole.length - 1) { [s.protocole[i + 1], s.protocole[i]] = [s.protocole[i], s.protocole[i + 1]]; s.verification = null; enregistrer(); afficherPanneau(); } }));
      $('lv-verifier')?.addEventListener('click', () => { verifierProtocole(); afficherPanneau(); });
      $('lv-vider')?.addEventListener('click', () => { s.protocole = []; s.verification = null; enregistrer(); afficherPanneau(); });
      zone.querySelectorAll('[data-saisie]').forEach((el) => el.addEventListener('change', () => { outils.remplir(el.dataset.saisie, el.dataset.col, el.value); enregistrer(); afficherPanneau(); }));
      $('lv-exporter')?.addEventListener('click', exporter);
      const g = m.mesures && m.mesures.graphique;
      if (g && $('lv-graphique')) {
        const points = s.tableau.map((l) => ({ x: Number(l[g.x]), y: Number(l[g.y]) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
        const modele = graphique($('lv-graphique'), points, g);
        $('lv-equation').innerHTML = modele && points.length >= 2 ? `Droite passant par l'origine : <b>${g.nomY || 'y'} = ${virgule(modele.a, 3)} × ${g.nomX || 'x'}</b>${g.interpretation ? ' — ' + g.interpretation(modele) : ''}` : 'Relève au moins 2 mesures pour tracer la droite.';
      }
    }
    async function exporter() {
      const ms = m.mesures;
      const champ = (t) => (/[";\n]/.test(t) ? `"${String(t).replace(/"/g, '""')}"` : t);
      const csv = '﻿' + [ms.colonnes.map((c) => champ(c.titre)).join(';'), ...s.tableau.map((l) => ms.colonnes.map((c) => champ(typeof l[c.id] === 'number' ? virgule(l[c.id], 4) : l[c.id] ?? '')).join(';'))].join('\r\n') + '\r\n';
      try {
        const nom = await Doc.enregistrer(`${m.titre} - mesures.csv`, new TextEncoder().encode(csv), true);
        Doc.message(`Mesures enregistrées dans Mes documents : ${nom}`);
      } catch (e) { Doc.message(e.message, 'erreur'); }
    }

    window.laboVirtuel = { ouvrir: (id) => ouvrir(trouver(id) || fournis().find((x) => x.id === id)), agir: (a, arg) => { const el = document.createElement('span'); el.dataset.action = a; el.dataset.arg = arg ?? ''; agir(el); }, session: () => s, etapesFaites: () => [...etapesFaites()], onglet: (o) => { onglet = o; afficherPanneau(); }, info: () => info, pret: null }; // pour les tests
    // Démarrage : on lit d'abord ce que l'enseignant a ajouté ou masqué (les élèves ne voient jamais une manipulation masquée).
    const id = new URLSearchParams(location.search).get('manip');
    window.laboVirtuel.pret = chargerInfo().then(() => { const x = id && trouver(id); if (x) ouvrir(x); else accueil(); });
  }

  window.LaboVirtuel = { demarrer, D, echapper, virgule, nombre };
})();
