// Moteur de formules du tableur.
// Accepte les noms français (SOMME, MOYENNE, SI…) et anglais (SUM, AVERAGE, IF…),
// « ; » comme séparateur et la virgule décimale (2,5), comme dans Excel en français.
(function () {
  class ErreurCellule extends Error {
    constructor(code) { super(code); this.code = code; }
  }
  const err = (code) => { throw new ErreurCellule(code); };

  // ---------- Références ----------
  const lettresVersCol = (l) => [...l.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const colVersLettres = (c) => { let s = ''; c++; while (c > 0) { const r = (c - 1) % 26; s = String.fromCharCode(65 + r) + s; c = Math.floor((c - 1) / 26); } return s; };
  const nomCellule = (l, c) => colVersLettres(c) + (l + 1);
  function lireRef(texte) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(texte);
    return m ? { l: parseInt(m[2], 10) - 1, c: lettresVersCol(m[1]) } : null;
  }

  // ---------- Fonctions ----------
  const nombres = (args) => args.flat(Infinity).filter((v) => typeof v === 'number');
  const enNombre = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === null || v === '') return 0;
    const n = Number(String(v).replace(',', '.'));
    if (Number.isNaN(n)) err('#VALEUR!');
    return n;
  };
  const un = (args) => { const v = args[0]; if (Array.isArray(v)) err('#VALEUR!'); return enNombre(v); };
  const moyenne = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : err('#DIV/0!'));
  const variance = (xs, echantillon) => {
    if (xs.length < (echantillon ? 2 : 1)) err('#DIV/0!');
    const m = moyenne(xs);
    return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - (echantillon ? 1 : 0));
  };
  // Hasard reproductible : chaque cellule tire ses nombres à partir d'une « graine ». Les tirages ne changent donc
  // pas quand on clique ou fait défiler, seulement quand le classeur est modifié ou avec F9 (comme dans Excel).
  let graine = Math.floor(Math.random() * 2 ** 31);
  const nouvelleGraine = () => { graine = Math.floor(Math.random() * 2 ** 31); };
  const hacher = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const hasard = (n) => { let a = (n + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // Critère de NB.SI, SOMME.SI… : 6, "6", ">=10", "<>Pile", "Pile" (texte sans tenir compte des majuscules)
  function critere(c) {
    if (Array.isArray(c)) err('#VALEUR!');
    if (typeof c === 'number' || typeof c === 'boolean') { const n = enNombre(c); return (v) => typeof v === 'number' ? v === n : typeof v === 'boolean' ? (v ? 1 : 0) === n && typeof c === 'boolean' : false; }
    const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(String(c ?? ''));
    const op = m[1] || '=', t = m[2];
    const tn = t.trim().replace(',', '.');
    const num = tn !== '' && !Number.isNaN(Number(tn)) ? Number(tn) : null;
    const cmp = (x) => (op === '=' ? x === 0 : op === '<>' ? x !== 0 : op === '<' ? x < 0 : op === '>' ? x > 0 : op === '<=' ? x <= 0 : x >= 0);
    return (v) => {
      if (num !== null) return typeof v === 'number' ? cmp(v - num) : op === '<>';
      if (op === '=' && t === '') return v === null || v === '';
      if (typeof v === 'number' && op !== '=' && op !== '<>') return false;
      const a = (v === null ? '' : texteValeur(v)).toLowerCase();
      return cmp(a.localeCompare(t.toLowerCase(), 'fr'));
    };
  }
  const liste = (v) => (Array.isArray(v) ? v.flat(Infinity) : [v]);
  const entier = (v) => { const n = enNombre(v); if (n < 0) err('#NOMBRE!'); return Math.floor(n); };
  const factorielle = (n) => { if (n > 170) err('#NOMBRE!'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const combin = (n, k) => { if (k > n) err('#NOMBRE!'); let r = 1; for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - Math.min(k, n - k) + i)) / i; return Math.round(r); };
  const vrai = (v) => (Array.isArray(v) ? err('#VALEUR!') : typeof v === 'string' ? v !== '' : !!enNombre(v));

  const FONCTIONS = {
    SOMME: (a) => nombres(a).reduce((s, x) => s + x, 0),
    MOYENNE: (a) => moyenne(nombres(a)),
    MIN: (a) => { const x = nombres(a); return x.length ? Math.min(...x) : 0; },
    MAX: (a) => { const x = nombres(a); return x.length ? Math.max(...x) : 0; },
    NB: (a) => nombres(a).length,
    NBVAL: (a) => a.flat(Infinity).filter((v) => v !== null && v !== '').length,
    MEDIANE: (a) => { const x = nombres(a).sort((p, q) => p - q); if (!x.length) err('#NOMBRE!'); const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; },
    ECARTYPE: (a) => Math.sqrt(variance(nombres(a), true)),
    ECARTYPEP: (a) => Math.sqrt(variance(nombres(a), false)),
    VAR: (a) => variance(nombres(a), true),
    ARRONDI: (a) => { const n = un(a), d = a.length > 1 ? enNombre(a[1]) : 0; const f = 10 ** d; return Math.round(n * f) / f; },
    ENT: (a) => Math.floor(un(a)),
    ABS: (a) => Math.abs(un(a)),
    RACINE: (a) => { const n = un(a); return n < 0 ? err('#NOMBRE!') : Math.sqrt(n); },
    PUISSANCE: (a) => enNombre(a[0]) ** enNombre(a[1]),
    EXP: (a) => Math.exp(un(a)),
    LN: (a) => { const n = un(a); return n <= 0 ? err('#NOMBRE!') : Math.log(n); },
    LOG10: (a) => { const n = un(a); return n <= 0 ? err('#NOMBRE!') : Math.log10(n); },
    LOG: (a) => { const n = un(a); const b = a.length > 1 ? enNombre(a[1]) : 10; return n <= 0 ? err('#NOMBRE!') : Math.log(n) / Math.log(b); },
    SIN: (a) => Math.sin(un(a)), COS: (a) => Math.cos(un(a)), TAN: (a) => Math.tan(un(a)),
    ASIN: (a) => Math.asin(un(a)), ACOS: (a) => Math.acos(un(a)), ATAN: (a) => Math.atan(un(a)),
    DEGRES: (a) => (un(a) * 180) / Math.PI,
    RADIANS: (a) => (un(a) * Math.PI) / 180,
    PI: () => Math.PI,
    SI: (a) => (vrai(a[0]) ? (a.length > 1 ? a[1] : true) : (a.length > 2 ? a[2] : false)),
    ET: (a) => a.flat(Infinity).every(vrai),
    OU: (a) => a.flat(Infinity).some(vrai),
    NON: (a) => !vrai(a[0]),
    // ----- Probabilités -----
    ALEA: (_a, x) => x.alea(),
    'ALEA.ENTRE.BORNES': (a, x) => { const b = Math.ceil(enNombre(a[0])), h = Math.floor(enNombre(a[1])); if (h < b) err('#NOMBRE!'); return b + Math.floor(x.alea() * (h - b + 1)); },
    'NB.SI': (a) => { const ok = critere(a[1]); return liste(a[0]).filter(ok).length; },
    'SOMME.SI': (a) => { const ok = critere(a[1]), p = liste(a[0]), s = a.length > 2 ? liste(a[2]) : p; return p.reduce((t, v, i) => (ok(v) && typeof s[i] === 'number' ? t + s[i] : t), 0); },
    'MOYENNE.SI': (a) => { const ok = critere(a[1]), p = liste(a[0]), s = a.length > 2 ? liste(a[2]) : p; return moyenne(p.map((v, i) => (ok(v) ? s[i] : null)).filter((v) => typeof v === 'number')); },
    FACT: (a) => factorielle(entier(un(a))),
    COMBIN: (a) => combin(entier(a[0]), entier(a[1])),
    PERMUTATION: (a) => { const n = entier(a[0]), k = entier(a[1]); if (k > n) err('#NOMBRE!'); let r = 1; for (let i = n - k + 1; i <= n; i++) r *= i; return r; },
    'LOI.BINOMIALE': (a) => {
      const k = entier(a[0]), n = entier(a[1]), p = enNombre(a[2]), cumul = a.length > 3 && vrai(a[3]);
      if (p < 0 || p > 1 || k > n) err('#NOMBRE!');
      const terme = (i) => combin(n, i) * p ** i * (1 - p) ** (n - i);
      if (!cumul) return terme(k);
      let s = 0; for (let i = 0; i <= k; i++) s += terme(i); return Math.min(1, s);
    },
    MOD: (a) => { const n = enNombre(a[0]), d = enNombre(a[1]); if (d === 0) err('#DIV/0!'); return n - d * Math.floor(n / d); },
    'ARRONDI.INF': (a) => { const n = un(a), f = 10 ** (a.length > 1 ? enNombre(a[1]) : 0); return Math.trunc(n * f + (n >= 0 ? 1e-9 : -1e-9)) / f; },
    'ARRONDI.SUP': (a) => { const n = un(a), f = 10 ** (a.length > 1 ? enNombre(a[1]) : 0); const r = Math.abs(n * f); return Math.sign(n) * Math.ceil(r - 1e-9) / f; },
    QUARTILE: (a) => {
      const x = nombres([a[0]]).sort((p, q) => p - q), q = Math.floor(enNombre(a[1]));
      if (!x.length || q < 0 || q > 4) err('#NOMBRE!');
      const pos = ((x.length - 1) * q) / 4, i = Math.floor(pos);
      return i + 1 < x.length ? x[i] + (pos - i) * (x[i + 1] - x[i]) : x[i];
    },
    MODE: (a) => {
      const x = nombres(a), nb = new Map();
      for (const v of x) nb.set(v, (nb.get(v) || 0) + 1);
      let meilleur = null, n = 1;
      for (const v of x) if (nb.get(v) > n) { meilleur = v; n = nb.get(v); }
      return meilleur === null ? err('#N/A') : meilleur;
    },
    CONCATENER: (a) => a.flat(Infinity).map((v) => (v === null ? '' : texteValeur(v))).join(''),
  };
  // Noms anglais (fichiers Excel) -> noms français
  const ALIAS = {
    SUM: 'SOMME', AVERAGE: 'MOYENNE', COUNT: 'NB', COUNTA: 'NBVAL', MEDIAN: 'MEDIANE', STDEV: 'ECARTYPE', 'STDEV.S': 'ECARTYPE',
    STDEVP: 'ECARTYPEP', 'STDEV.P': 'ECARTYPEP', 'VAR.S': 'VAR', ROUND: 'ARRONDI', INT: 'ENT', SQRT: 'RACINE', POWER: 'PUISSANCE',
    DEGREES: 'DEGRES', IF: 'SI', AND: 'ET', OR: 'OU', NOT: 'NON', CONCATENATE: 'CONCATENER', CONCAT: 'CONCATENER',
    RAND: 'ALEA', RANDBETWEEN: 'ALEA.ENTRE.BORNES', COUNTIF: 'NB.SI', SUMIF: 'SOMME.SI', AVERAGEIF: 'MOYENNE.SI', PERMUT: 'PERMUTATION',
    BINOMDIST: 'LOI.BINOMIALE', 'BINOM.DIST': 'LOI.BINOMIALE', 'LOI.BINOMIALE.N': 'LOI.BINOMIALE', ROUNDDOWN: 'ARRONDI.INF', ROUNDUP: 'ARRONDI.SUP',
    'QUARTILE.INC': 'QUARTILE', 'MODE.SNGL': 'MODE', 'MODE.SIMPLE': 'MODE',
    'MÉDIANE': 'MEDIANE', 'DEGRÉS': 'DEGRES', 'ÉCARTYPE': 'ECARTYPE',
  };
  const VERS_ANGLAIS = Object.fromEntries(Object.entries({
    SOMME: 'SUM', MOYENNE: 'AVERAGE', NB: 'COUNT', NBVAL: 'COUNTA', MEDIANE: 'MEDIAN', ECARTYPE: 'STDEV', ECARTYPEP: 'STDEVP',
    ARRONDI: 'ROUND', ENT: 'INT', RACINE: 'SQRT', PUISSANCE: 'POWER', DEGRES: 'DEGREES', SI: 'IF', ET: 'AND', OU: 'OR', NON: 'NOT',
    CONCATENER: 'CONCATENATE',
    ALEA: 'RAND', 'ALEA.ENTRE.BORNES': 'RANDBETWEEN', 'NB.SI': 'COUNTIF', 'SOMME.SI': 'SUMIF', 'MOYENNE.SI': 'AVERAGEIF', PERMUTATION: 'PERMUT',
    'LOI.BINOMIALE': 'BINOMDIST', 'ARRONDI.INF': 'ROUNDDOWN', 'ARRONDI.SUP': 'ROUNDUP',
  }));
  const nomFonction = (n) => { const u = n.toUpperCase().replace(/^_XLFN\./, ''); return FONCTIONS[u] ? u : ALIAS[u] || null; };

  // ---------- Analyse ----------
  function decouper(src) {
    const jetons = [];
    let i = 0;
    while (i < src.length) {
      const reste = src.slice(i);
      let m;
      if (/^\s/.test(reste)) { i++; continue; }
      if ((m = /^"((?:[^"]|"")*)"/.exec(reste))) { jetons.push({ t: 'texte', v: m[1].replace(/""/g, '"') }); i += m[0].length; continue; }
      if ((m = /^(\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?|\.\d+)/.exec(reste))) { jetons.push({ t: 'nb', v: parseFloat(m[1].replace(',', '.')) }); i += m[0].length; continue; }
      if ((m = /^(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![\w(])/.exec(reste))) {
        jetons.push(m[2] ? { t: 'plage', a: m[1], b: m[2] } : { t: 'ref', v: m[1] });
        i += m[0].length; continue;
      }
      if ((m = /^([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_.]*)\s*\(/.exec(reste))) { jetons.push({ t: 'fn', v: m[1] }); i += m[0].length; continue; }
      if ((m = /^(VRAI|FAUX|TRUE|FALSE)(?![\w(])/i.exec(reste))) { jetons.push({ t: 'bool', v: /^(VRAI|TRUE)$/i.test(m[1]) }); i += m[0].length; continue; }
      if ((m = /^(<=|>=|<>|[-+*/^&=<>();,%:])/.exec(reste))) { jetons.push({ t: m[1] === ',' || m[1] === ';' ? 'sep' : m[1] }); i += m[1].length; continue; }
      if ((m = /^[A-Za-zÀ-ÿ_][\w.]*/.exec(reste))) { jetons.push({ t: 'nom', v: m[0] }); i += m[0].length; continue; }
      err('#NOM?');
    }
    return jetons;
  }

  function analyser(jetons) {
    let p = 0;
    const voir = () => jetons[p];
    const prendre = (t) => { const j = jetons[p]; if (t && (!j || j.t !== t)) err('#NOM?'); p++; return j; };
    const binaire = (suivant, ops) => () => {
      let g = suivant();
      while (voir() && ops.includes(voir().t)) { const op = prendre().t; g = { op, g, d: suivant() }; }
      return g;
    };
    const primaire = () => {
      const j = prendre();
      if (!j) err('#NOM?');
      switch (j.t) {
        case 'nb': return { nb: j.v };
        case 'texte': return { texte: j.v };
        case 'bool': return { bool: j.v };
        case 'ref': return { ref: j.v };
        case 'plage': return { plage: [j.a, j.b] };
        case '(': { const e = comparaison(); prendre(')'); return e; }
        case 'fn': {
          const args = [];
          if (voir() && voir().t !== ')') {
            args.push(comparaison());
            while (voir() && voir().t === 'sep') { prendre(); args.push(comparaison()); }
          }
          prendre(')');
          return { fn: j.v, args };
        }
        case 'nom': return /^PI$/i.test(j.v) ? { nb: Math.PI } : { nomInconnu: j.v };
        default: err('#NOM?');
      }
    };
    const pourcent = () => { let e = primaire(); while (voir() && voir().t === '%') { prendre(); e = { op: '/', g: e, d: { nb: 100 } }; } return e; };
    const puissance = () => { const b = pourcent(); if (voir() && voir().t === '^') { prendre(); return { op: '^', g: b, d: unaire() }; } return b; };
    const unaire = () => { if (voir() && (voir().t === '-' || voir().t === '+')) { const op = prendre().t; return op === '-' ? { neg: unaire() } : unaire(); } return puissance(); };
    const produit = binaire(unaire, ['*', '/']);
    const somme = binaire(produit, ['+', '-']);
    const concat = binaire(somme, ['&']);
    const comparaison = binaire(concat, ['=', '<>', '<', '>', '<=', '>=']);
    const arbre = comparaison();
    if (p < jetons.length) err('#NOM?');
    return arbre;
  }

  const cache = new Map();
  function compiler(formule) {
    if (!cache.has(formule)) {
      try { cache.set(formule, { arbre: analyser(decouper(formule)) }); } catch (e) { cache.set(formule, { erreur: e.code || '#NOM?' }); }
    }
    return cache.get(formule);
  }

  // ---------- Évaluation ----------
  function texteValeur(v) {
    if (typeof v === 'number') return String(+v.toPrecision(12)).replace('.', ',');
    if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
    return String(v ?? '');
  }

  /**
   * Évalue une formule (sans le « = ») dans le contexte d'une feuille.
   * `valeurDe(l, c)` renvoie la valeur calculée d'une cellule (ou lève une ErreurCellule).
   */
  function evaluer(formule, valeurDe, idCellule = '') {
    const { arbre, erreur } = compiler(formule);
    if (erreur) err(erreur);
    let tirage = 0;
    const contexte = { alea: () => hasard(hacher(`${graine}|${idCellule || formule}|${tirage++}`)) };
    const plage = (a, b) => {
      const p = lireRef(a), q = lireRef(b);
      if (!p || !q) err('#REF!');
      const lignes = [];
      for (let l = Math.min(p.l, q.l); l <= Math.max(p.l, q.l); l++) {
        const ligne = [];
        for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) ligne.push(valeurDe(l, c));
        lignes.push(ligne);
      }
      return lignes;
    };
    const ev = (n) => {
      if ('nb' in n) return n.nb;
      if ('texte' in n) return n.texte;
      if ('bool' in n) return n.bool;
      if ('ref' in n) { const r = lireRef(n.ref); if (!r) err('#REF!'); const v = valeurDe(r.l, r.c); return v === null ? 0 : v; }
      if ('plage' in n) return plage(n.plage[0], n.plage[1]);
      if ('nomInconnu' in n) err('#NOM?');
      if ('neg' in n) return -enNombre(ev(n.neg));
      if ('fn' in n) {
        const nom = nomFonction(n.fn);
        if (!nom) err('#NOM?');
        if (nom === 'SI') { // évaluation paresseuse
          const c = ev(n.args[0]);
          if (vrai(c)) return n.args.length > 1 ? ev(n.args[1]) : true;
          return n.args.length > 2 ? ev(n.args[2]) : false;
        }
        const args = n.args.map((a) => ('plage' in a ? ev(a) : ev(a)));
        const r = FONCTIONS[nom](args, contexte);
        if (typeof r === 'number' && !Number.isFinite(r)) err('#NOMBRE!');
        return r;
      }
      const g = ev(n.g), d = ev(n.d);
      if (Array.isArray(g) || Array.isArray(d)) err('#VALEUR!');
      switch (n.op) {
        case '+': return enNombre(g) + enNombre(d);
        case '-': return enNombre(g) - enNombre(d);
        case '*': return enNombre(g) * enNombre(d);
        case '/': { const b = enNombre(d); return b === 0 ? err('#DIV/0!') : enNombre(g) / b; }
        case '^': return enNombre(g) ** enNombre(d);
        case '&': return texteValeur(g) + texteValeur(d);
        case '=': return g === d || (typeof g !== 'string' && typeof d !== 'string' && enNombre(g) === enNombre(d));
        case '<>': return !(g === d);
        case '<': return comparer(g, d) < 0;
        case '>': return comparer(g, d) > 0;
        case '<=': return comparer(g, d) <= 0;
        case '>=': return comparer(g, d) >= 0;
        default: err('#NOM?');
      }
    };
    const r = ev(arbre);
    if (Array.isArray(r)) return r[0][0]; // =A1:A3 seul : première valeur
    if (typeof r === 'number' && !Number.isFinite(r)) err('#NOMBRE!');
    return r;
  }
  const comparer = (a, b) => (typeof a === 'string' || typeof b === 'string'
    ? texteValeur(a).localeCompare(texteValeur(b), 'fr')
    : enNombre(a) - enNombre(b));

  // ---------- Conversion pour les fichiers Excel ----------
  // Excel enregistre les formules en anglais, avec « , » comme séparateur et « . » décimal.
  function versExcel(formule) {
    let sortie = '';
    for (const j of decouperSurement(formule)) {
      if (j.t === 'fn') { const n = nomFonction(j.v) || j.v.toUpperCase(); sortie += (VERS_ANGLAIS[n] || n) + '('; }
      else if (j.t === 'nb') sortie += String(j.v);
      else if (j.t === 'texte') sortie += '"' + j.v.replace(/"/g, '""') + '"';
      else if (j.t === 'sep') sortie += ',';
      else if (j.t === 'ref') sortie += j.v;
      else if (j.t === 'plage') sortie += j.a + ':' + j.b;
      else if (j.t === 'bool') sortie += j.v ? 'TRUE' : 'FALSE';
      else if (j.t === 'nom') sortie += j.v;
      else sortie += j.t;
    }
    return sortie;
  }
  function depuisExcel(formule) {
    // Dans une formule Excel, la virgule hors texte est toujours un séparateur.
    let sortie = '', dansTexte = false;
    for (const ch of formule) {
      if (ch === '"') dansTexte = !dansTexte;
      sortie += !dansTexte && ch === ',' ? ';' : ch;
    }
    return sortie;
  }
  const decouperSurement = (f) => { try { return decouper(f); } catch { return []; } };

  // Décale les références relatives d'une formule (recopie vers le bas / la droite).
  function decaler(formule, dl, dc) {
    return formule.replace(/("(?:[^"]|"")*")|(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(])/g, (tout, texte, dCol, col, dLig, lig) => {
      if (texte) return texte;
      let c = lettresVersCol(col), l = parseInt(lig, 10) - 1;
      if (!dCol) c += dc;
      if (!dLig) l += dl;
      if (c < 0 || l < 0) return '#REF!';
      return `${dCol}${colVersLettres(c)}${dLig}${l + 1}`;
    });
  }

  window.Formules = { evaluer, nouvelleGraine, ErreurCellule, texteValeur, lireRef, colVersLettres, lettresVersCol, nomCellule, versExcel, depuisExcel, decaler, FONCTIONS: Object.keys(FONCTIONS) };
})();
