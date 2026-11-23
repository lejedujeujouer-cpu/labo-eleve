// Petite boîte à outils partagée par les outils de Labo Élève.
// Inclusion : <script src="../../commun/outil.js"></script>
(function () {
  const Outil = {
    /** Lit une variable CSS du thème (ex. Outil.css('--c1')). */
    css(nom) {
      return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
    },

    /** Appelle `rappel` quand le thème clair/sombre change. */
    surTheme(rappel) {
      new MutationObserver(rappel).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rappel);
    },

    /**
     * Prépare un canvas net (écrans haute densité) qui se redessine
     * automatiquement au redimensionnement et au changement de thème.
     * `dessiner(ctx, largeur, hauteur)` est appelé à chaque fois.
     */
    canvas(cv, dessiner) {
      const ctx = cv.getContext('2d');
      const scene = { ctx, largeur: 0, hauteur: 0, redessiner };
      function redessiner() {
        if (!scene.largeur) return;
        ctx.save();
        ctx.clearRect(0, 0, scene.largeur, scene.hauteur);
        dessiner(ctx, scene.largeur, scene.hauteur);
        ctx.restore();
      }
      function redimensionner() {
        const r = cv.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        cv.width = Math.max(1, Math.round(r.width * dpr));
        cv.height = Math.max(1, Math.round(r.height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scene.largeur = r.width;
        scene.hauteur = r.height;
        redessiner();
      }
      new ResizeObserver(redimensionner).observe(cv);
      Outil.surTheme(() => requestAnimationFrame(redessiner));
      return scene;
    },

    /** Formate un nombre à la française (virgule décimale). */
    nombre(x, decimales = 2) {
      if (!isFinite(x)) return x > 0 ? '+∞' : x < 0 ? '−∞' : '—';
      const t = Number(x).toLocaleString('fr-FR', { maximumFractionDigits: decimales, minimumFractionDigits: 0 });
      return t.replace('-', '−');
    },

    /** Relie un <input type=range> à son <output> et appelle `rappel(valeur)`. */
    curseur(id, rappel, format = (v) => Outil.nombre(v)) {
      const input = document.getElementById(id);
      const sortie = document.querySelector(`output[for="${id}"]`);
      const maj = () => {
        const v = parseFloat(input.value);
        if (sortie) sortie.textContent = format(v);
        rappel && rappel(v);
      };
      input.addEventListener('input', maj);
      maj();
      return { input, get valeur() { return parseFloat(input.value); }, fixer(v) { input.value = v; maj(); } };
    },

    /** Dessine une flèche (vecteur) de (x1,y1) à (x2,y2). */
    fleche(ctx, x1, y1, x2, y2, couleur, epaisseur = 2.5) {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const long = Math.hypot(x2 - x1, y2 - y1);
      const tete = Math.min(12, long * 0.45);
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = couleur;
      ctx.lineWidth = epaisseur;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - Math.cos(ang) * tete * 0.6, y2 - Math.sin(ang) * tete * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - tete * Math.cos(ang - 0.42), y2 - tete * Math.sin(ang - 0.42));
      ctx.lineTo(x2 - tete * Math.cos(ang + 0.42), y2 - tete * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    /** Pas de graduation « joli » (1, 2 ou 5 × 10^n) proche de `brut`. */
    pasJoli(brut) {
      const p = Math.pow(10, Math.floor(Math.log10(brut)));
      const r = brut / p;
      return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p;
    },

    police(taille = 13, graisse = 500) {
      return `${graisse} ${taille}px "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`;
    },
  };
  window.Outil = Outil;
})();
