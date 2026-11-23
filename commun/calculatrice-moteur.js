// Moteur de la calculatrice scientifique de Labo Élève (outil « Calculatrice » et calculatrice des évaluations).
// Expressions écrites « comme au tableau » : virgule décimale, × ÷ −, puissance ^ et ², racine √, %, π, e,
// Rép (résultat précédent), trigonométrie en degrés ou en radians, multiplication implicite (2π, 3(4+1)), factorielle !.
(function () {
  function creerFonctions(degres) {
    const F = {
      sin: (x) => Math.sin(degres ? (x * Math.PI) / 180 : x),
      cos: (x) => Math.cos(degres ? (x * Math.PI) / 180 : x),
      tan: (x) => {
        const r = degres ? (x * Math.PI) / 180 : x;
        if (Math.abs(Math.cos(r)) < 1e-12) throw new Error('tan n\'est pas définie pour cet angle');
        return Math.tan(r);
      },
      asin: (x) => { if (Math.abs(x) > 1) throw new Error('sin⁻¹ : la valeur doit être entre −1 et 1'); const r = Math.asin(x); return degres ? (r * 180) / Math.PI : r; },
      acos: (x) => { if (Math.abs(x) > 1) throw new Error('cos⁻¹ : la valeur doit être entre −1 et 1'); const r = Math.acos(x); return degres ? (r * 180) / Math.PI : r; },
      atan: (x) => { const r = Math.atan(x); return degres ? (r * 180) / Math.PI : r; },
      '√': (x) => { if (x < 0) throw new Error('Racine d\'un nombre négatif'); return Math.sqrt(x); },
      ln: (x) => { if (x <= 0) throw new Error('ln : le nombre doit être positif'); return Math.log(x); },
      log: (x) => { if (x <= 0) throw new Error('log : le nombre doit être positif'); return Math.log10(x); },
      abs: Math.abs,
      exp: Math.exp,
    };
    F.racine = F['√'];
    return F;
  }
  const NOMS = Object.keys(creerFonctions(true)).sort((a, b) => b.length - a.length);

  function decouper(texte, rep) {
    const s = texte.replace(/\s+/g, '').replace(/[×·*]/g, '*').replace(/[÷/:]/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3');
    const jetons = [];
    let i = 0;
    while (i < s.length) {
      const reste = s.slice(i);
      let m;
      if ((m = /^\d+(?:[.,]\d+)?|^[.,]\d+/.exec(reste))) { jetons.push({ t: 'nb', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; continue; }
      if ((m = /^(Rép|Rep|Ans)/i.exec(reste))) { jetons.push({ t: 'nb', v: rep }); i += m[0].length; continue; }
      if (reste[0] === 'π' || /^pi/i.test(reste)) { jetons.push({ t: 'nb', v: Math.PI }); i += reste[0] === 'π' ? 1 : 2; continue; }
      const fn = NOMS.find((n) => reste.toLowerCase().startsWith(n));
      if (fn) { jetons.push({ t: 'fn', v: fn }); i += fn.length; continue; }
      if (reste[0] === 'e' && !/^e[a-z]/i.test(reste)) { jetons.push({ t: 'nb', v: Math.E }); i++; continue; }
      if ('+-*/^()%!'.includes(reste[0])) { jetons.push({ t: reste[0] }); i++; continue; }
      throw new Error(`Je ne comprends pas « ${reste[0]} »`);
    }
    return jetons;
  }

  // options : { degres (vrai par défaut), rep (résultat précédent) }
  function evaluer(texte, { degres = true, rep = 0 } = {}) {
    const FONCTIONS = creerFonctions(degres);
    const j = decouper(texte, rep);
    let p = 0;
    const voir = () => j[p];
    const prendre = () => j[p++];
    const commence = (x) => x && (x.t === 'nb' || x.t === 'fn' || x.t === '(');
    const somme = () => {
      let v = produit();
      while (voir() && (voir().t === '+' || voir().t === '-')) { const op = prendre().t; const d = produit(); v = op === '+' ? v + d : v - d; }
      return v;
    };
    const produit = () => {
      let v = unaire();
      for (;;) {
        const x = voir();
        if (x && (x.t === '*' || x.t === '/')) {
          prendre();
          const d = unaire();
          if (x.t === '/' && d === 0) throw new Error('Division par zéro');
          v = x.t === '*' ? v * d : v / d;
        } else if (commence(x)) v *= puissance(); // multiplication implicite : 2π, 3(4+1)
        else return v;
      }
    };
    const unaire = () => {
      if (voir() && voir().t === '-') { prendre(); return -unaire(); }
      if (voir() && voir().t === '+') { prendre(); return unaire(); }
      return puissance();
    };
    const puissance = () => {
      const b = postfixe();
      if (voir() && voir().t === '^') { prendre(); return b ** unaire(); }
      return b;
    };
    const postfixe = () => {
      let v = primaire();
      while (voir() && (voir().t === '%' || voir().t === '!')) {
        if (prendre().t === '%') v /= 100;
        else {
          if (v < 0 || !Number.isInteger(v) || v > 170) throw new Error('Factorielle : entier positif (≤ 170)');
          let f = 1; for (let k = 2; k <= v; k++) f *= k; v = f;
        }
      }
      return v;
    };
    const primaire = () => {
      const x = prendre();
      if (!x) throw new Error('Calcul incomplet');
      if (x.t === 'nb') return x.v;
      if (x.t === '(') { const v = somme(); if (voir() && voir().t === ')') prendre(); return v; } // parenthèse finale facultative
      if (x.t === 'fn') {
        let arg;
        if (voir() && voir().t === '(') { prendre(); arg = somme(); if (voir() && voir().t === ')') prendre(); }
        else arg = puissance(); // √9, sin30
        return FONCTIONS[x.v](arg);
      }
      throw new Error(x.t === ')' ? 'Parenthèse fermante en trop' : `Le signe « ${x.t} » est mal placé`);
    };
    const v = somme();
    if (p < j.length) throw new Error(j[p].t === ')' ? 'Parenthèse fermante en trop' : 'Calcul mal écrit');
    if (!Number.isFinite(v)) throw new Error('Résultat trop grand ou impossible');
    return v;
  }

  function formater(v) {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e12 || a < 1e-9) {
      const [m, e] = v.toExponential(8).split('e');
      return `${Number(m).toLocaleString('fr-FR', { maximumFractionDigits: 8 })} × 10^${Number(e)}`;
    }
    return Number(v.toPrecision(12)).toLocaleString('fr-FR', { maximumFractionDigits: 10, useGrouping: true }).replace(/ /g, ' ');
  }

  // Les touches de la calculatrice (mêmes dans l'outil Calculatrice et dans les évaluations)
  const TOUCHES = `
    <button data-i="sin(">sin</button><button data-i="cos(">cos</button><button data-i="tan(">tan</button><button data-i="√(">√</button><button data-i="^">xʸ</button>
    <button data-i="asin(">sin⁻¹</button><button data-i="acos(">cos⁻¹</button><button data-i="atan(">tan⁻¹</button><button data-i="²">x²</button><button data-i="π">π</button>
    <button data-i="ln(">ln</button><button data-i="log(">log</button><button data-i="(">(</button><button data-i=")">)</button><button data-a="retour" class="effacer" title="Effacer le dernier caractère">⌫</button>
    <button class="chiffre" data-i="7">7</button><button class="chiffre" data-i="8">8</button><button class="chiffre" data-i="9">9</button><button class="op" data-i="÷">÷</button><button data-a="tout" class="effacer" title="Tout effacer">C</button>
    <button class="chiffre" data-i="4">4</button><button class="chiffre" data-i="5">5</button><button class="chiffre" data-i="6">6</button><button class="op" data-i="×">×</button><button data-i="×10^">×10ˣ</button>
    <button class="chiffre" data-i="1">1</button><button class="chiffre" data-i="2">2</button><button class="chiffre" data-i="3">3</button><button class="op" data-i="−">−</button><button data-i="Rép">Rép</button>
    <button class="chiffre" data-i="0">0</button><button class="chiffre" data-i=",">,</button><button data-i="%">%</button><button class="op" data-i="+">+</button><button class="egal" data-a="egal">=</button>`;

  window.CalculatriceMoteur = { evaluer, formater, TOUCHES };
})();
