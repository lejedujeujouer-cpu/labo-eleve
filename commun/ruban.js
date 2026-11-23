// Ruban commun : icônes (dessinées pour Labo Élève), changement d'onglet et menus déroulants.
(function () {
  const t = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONES = {
    enregistrer: t('<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>'),
    annuler: t('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    retablir: t('<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
    coller: t('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>'),
    couper: t('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 16 17 4M16 16 7 4"/>'),
    copier: t('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>'),
    gras: t('<path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" stroke-width="2.4"/>'),
    italique: t('<path d="M10 4h8M6 20h8M14 4l-4 16" stroke-width="2"/>'),
    souligne: t('<path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14" stroke-width="2"/>'),
    barre: t('<path d="M16 6.5A4 3.5 0 0 0 12 4c-2.5 0-4 1.3-4 3.2 0 4 8 3 8 7.6 0 2-1.8 3.2-4 3.2a4.4 4 0 0 1-4.3-2.6M4 12h16"/>'),
    exposant: t('<path d="m4 8 8 10M12 8 4 18M16 7a2 2 0 1 1 3.5 1.3L16 11h4"/>'),
    indice: t('<path d="m4 6 8 10M12 6 4 16M16 16a2 2 0 1 1 3.5 1.3L16 20h4"/>'),
    couleurTexte: t('<path d="M6 17 12 3l6 14M8.5 11h7"/>'),
    surligner: t('<path d="m9 11 6-6 4 4-6 6zM9 11l-3 3 4 4 3-3M5 21h6"/>'),
    remplissage: t('<path d="m5 12 7-7 7 7-7 7z"/><path d="M19 15s2 2.3 2 3.5a2 2 0 0 1-4 0c0-1.2 2-3.5 2-3.5z"/>'),
    bordures: t('<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16" stroke-dasharray="2 2"/>'),
    gauche: t('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    centre: t('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    droite: t('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    justifie: t('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>'),
    puces: t('<circle cx="5" cy="7" r="1.3" fill="currentColor"/><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="5" cy="17" r="1.3" fill="currentColor"/><path d="M9 7h11M9 12h11M9 17h11"/>'),
    numeros: t('<path d="M4 5h1.5v4M4 9h3M4 14.5a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 3.5h3M10 7h10M10 12h10M10 17h10"/>'),
    retraitMoins: t('<path d="M10 6h10M10 10h10M10 14h10M10 18h10M7 9l-3 3 3 3"/>'),
    retraitPlus: t('<path d="M10 6h10M10 10h10M10 14h10M10 18h10M4 9l3 3-3 3"/>'),
    interligne: t('<path d="M11 6h9M11 12h9M11 18h9M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2"/>'),
    tableau: t('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14.5h18M9 4v16M15 4v16"/>'),
    image: t('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>'),
    symbole: t('<path d="M7 20h3v-2.5a7 7 0 1 1 4 0V20h3"/>'),
    saut: t('<path d="M6 3v6h12V3M6 21v-6h12v6"/><path d="M3 12h3M9 12h2M13 12h2M18 12h3" stroke-dasharray="1 0"/>'),
    lien: t('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    somme: t('<path d="M17 5H6l6 7-6 7h11" stroke-width="2"/>'),
    fx: t('<path d="M14 4h-1a3 3 0 0 0-3 3v13M7 10h6M15 13l5 6M20 13l-5 6"/>'),
    graphique: t('<path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>'),
    de: t('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/>'),
    relancer: t('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    secteurs: t('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6M12 12l-8.2 2.3"/>'),
    nuage: t('<path d="M4 20V4M4 20h16"/><circle cx="8" cy="15" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="16" cy="9" r="1.3" fill="currentColor"/><path d="M6 17 19 6" stroke-dasharray="2 2"/>'),
    recopier: t('<rect x="5" y="3" width="14" height="6" rx="1"/><path d="M12 9v11M8 16l4 4 4-4"/>'),
    effacer: t('<path d="m5 15 8-8 6 6-6 6H9z"/><path d="M9 19h11"/>'),
    trier: t('<path d="M7 4v16M4 17l3 3 3-3M14 6h6M14 11h4M14 16h2"/>'),
    pourcent: t('<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M19 5 5 19"/>'),
    decimalesPlus: t('<path d="M3 17h1M7 10a3 3 0 1 1 0 7 3 3 0 0 1 0-7zM14 10a3 3 0 1 1 0 7 3 3 0 0 1 0-7zM18 6h4M20 4v4"/>'),
    decimalesMoins: t('<path d="M3 17h1M7 10a3 3 0 1 1 0 7 3 3 0 0 1 0-7zM14 10a3 3 0 1 1 0 7 3 3 0 0 1 0-7zM18 6h4"/>'),
    insererLigne: t('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 12h18M12 9v6M9 12h6" stroke-width="2"/>'),
    supprimerLigne: t('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9 12h6" stroke-width="2.4"/>'),
    zoom: t('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M8 11h6M11 8v6"/>'),
    quadrillage: t('<path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/>'),
    regle: t('<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>'),
    orientation: t('<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M14 8h4"/>'),
    marges: t('<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 3v18M16 3v18M5 7h14M5 17h14" stroke-dasharray="2 2"/>'),
    renvoi: t('<path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M4 18h5M15 16l-2 2 2 2"/>'),
    fusion: t('<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2"/>'),
    format: t('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M9 4v16"/><path d="M14 14h4M16 12v4"/>'),
    trierAZ: t('<path d="M7 4v16M4 17l3 3 3-3"/><path d="M14 10l2.5-6 2.5 6M14.8 8h3.4M14 14h5l-5 6h5"/>'),
    trierZA: t('<path d="M7 4v16M4 17l3 3 3-3"/><path d="M14 4h5l-5 6h5M14 20l2.5-6 2.5 6M14.8 18h3.4"/>'),
    filtre: t('<path d="M4 5h16l-6 7v6l-4 2v-8z"/>'),
    figer: t('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M8 4v16" stroke-width="2.6"/>'),
    imprimer: t('<path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3M7 14h10v7H7z"/>'),
    entete: t('<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M7 7h10" stroke-width="2.4"/><path d="M7 11h10M7 14h10M7 17h6" opacity=".45"/>'),
    pied: t('<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M7 7h10M7 10h10M7 13h6" opacity=".45"/><path d="M7 17h10" stroke-width="2.4"/>'),
    numero: t('<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M11 13l2-1.5V18"/>'),
    equation: t('<path d="M5 8h4M7 6v4M14 7l4 4M18 7l-4 4M5 16h14M5 19h14"/>'),
    nouveau: t('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>'),
    styles: t('<path d="M4 18 9 5l5 13M5.8 13.5h6.4M15 13h5M15 17h5M15 9h5"/>'),
  };
  window.IconesOffice = ICONES;

  function installer(racine = document) {
    racine.querySelectorAll('[data-ic]').forEach((el) => {
      if (el.dataset.icPose) return;
      el.dataset.icPose = '1';
      const svg = ICONES[el.dataset.ic];
      if (svg) el.insertAdjacentHTML('afterbegin', svg);
    });
    // Onglets du ruban
    racine.querySelectorAll('.onglets-ruban [data-onglet]').forEach((b) => b.addEventListener('click', () => {
      const nom = b.dataset.onglet;
      if (nom === 'fichier') return; // ouvre le menu Fichier (géré par l'outil)
      racine.querySelectorAll('.onglets-ruban [data-onglet]').forEach((x) => x.classList.toggle('actif', x === b));
      racine.querySelectorAll('.ruban[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== nom; });
    }));
  }

  // Menu flottant placé sous un bouton ; se ferme au clic ailleurs.
  function ouvrirMenu(menu, ancre) {
    fermerMenus();
    const r = ancre.getBoundingClientRect ? ancre.getBoundingClientRect() : { left: ancre.x, bottom: ancre.y };
    menu.hidden = false;
    const largeur = menu.offsetWidth, hauteur = menu.offsetHeight;
    menu.style.left = Math.min(r.left, innerWidth - largeur - 8) + 'px';
    menu.style.top = Math.min(r.bottom + 2, innerHeight - hauteur - 8) + 'px';
  }
  function fermerMenus() { document.querySelectorAll('.menu-flottant').forEach((m) => { m.hidden = true; }); }
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.menu-flottant') && !e.target.closest('[data-menu]')) fermerMenus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerMenus(); });

  window.Ruban = { installer, ouvrirMenu, fermerMenus, icone: (n) => ICONES[n] || '' };
})();
