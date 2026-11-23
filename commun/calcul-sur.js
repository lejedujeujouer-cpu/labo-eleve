// Calcul sûr (sans eval) : utilisé par la calculatrice des évaluations (élève) et par la correction (Labo Prof).
// Accepte : nombres (virgule ou point), + − × ÷ * / ^, parenthèses, variables (a, b…), π, et les fonctions
// racine / sqrt, abs, arrondi(x ; n) / round, cos, sin, tan (en degrés).
(function (racine) {
  function evaluer(texte, variables = {}) {
    const s = String(texte || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'racine').replace(/π/g, 'pi').replace(/,/g, '.').replace(/;/g, ',').replace(/\s+/g, '');
    let i = 0;
    const erreur = (m) => { throw new Error(m || 'Calcul impossible'); };
    const voir = () => s[i];
    function nombre() {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) erreur();
      i += m[0].length;
      return parseFloat(m[0]);
    }
    function nom() { const m = /^[a-zA-Zé_][a-zA-Zé_0-9]*/.exec(s.slice(i)); i += m[0].length; return m[0].toLowerCase(); }
    const FONCTIONS = {
      racine: (x) => (x < 0 ? erreur('Racine d\'un nombre négatif') : Math.sqrt(x)), sqrt: (x) => (x < 0 ? erreur('Racine d\'un nombre négatif') : Math.sqrt(x)),
      abs: Math.abs, arrondi: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n, round: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n,
      cos: (x) => Math.cos((x * Math.PI) / 180), sin: (x) => Math.sin((x * Math.PI) / 180), tan: (x) => Math.tan((x * Math.PI) / 180),
    };
    function primaire() {
      const c = voir();
      if (c === '(') { i++; const v = somme(); if (voir() !== ')') erreur('Parenthèse non fermée'); i++; return v; }
      if (c === '-') { i++; return -puissance(); }
      if (c === '+') { i++; return puissance(); }
      if (/[\d.]/.test(c || '')) return nombre();
      if (/[a-zA-Zé_]/.test(c || '')) {
        const n = nom();
        if (n === 'pi') return Math.PI;
        if (FONCTIONS[n]) {
          if (voir() !== '(') erreur(`Il faut des parenthèses après ${n}`);
          i++;
          const args = [somme()];
          while (voir() === ',') { i++; args.push(somme()); }
          if (voir() !== ')') erreur('Parenthèse non fermée');
          i++;
          return FONCTIONS[n](...args);
        }
        if (Object.prototype.hasOwnProperty.call(variables, n)) return Number(variables[n]);
        erreur(`« ${n} » inconnu`);
      }
      erreur();
    }
    function puissance() { const b = primaire(); if (voir() === '^') { i++; return b ** puissance(); } return b; }
    function produit() {
      let v = puissance();
      while (voir() === '*' || voir() === '/' || voir() === '(' ) {
        if (voir() === '(') { v *= puissance(); continue; } // 2(3+1)
        const op = s[i++]; const d = puissance();
        if (op === '/' && d === 0) erreur('Division par zéro');
        v = op === '*' ? v * d : v / d;
      }
      return v;
    }
    function somme() { let v = produit(); while (voir() === '+' || voir() === '-') { const op = s[i++]; const d = produit(); v = op === '+' ? v + d : v - d; } return v; }
    if (!s) erreur('Écris un calcul');
    const v = somme();
    if (i < s.length) erreur(`Caractère inattendu « ${s[i]} »`);
    if (!Number.isFinite(v)) erreur('Résultat impossible');
    return Math.round(v * 1e10) / 1e10;
  }
  // Nombre écrit par l'élève : « 12,5 », « 12.5 € », « 1 250 », « -3 » ; null si ce n'est pas un nombre.
  function lireNombre(texte) {
    const t = String(texte ?? '').replace(/ |\s/g, '').replace(',', '.').replace(/[^\d.eE+-]+$/, '');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
    return parseFloat(t);
  }
  const formater = (x) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: 6 }) : '—');
  const api = { evaluer, lireNombre, formater };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.CalculSur = api;
})(typeof window !== 'undefined' ? window : globalThis);
