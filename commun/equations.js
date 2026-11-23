// Équations (moteur commun : traitement de texte, cartes mémoire, évaluations de maths).
// Saisie simple, au clavier : x^2 + 3x − 5 = 0 · (a+b)/2 · √(x+1) · v_0 · U = R × I
// - affichage dans la page en MathML (rendu natif du navigateur) ;
// - enregistrement dans le .docx en vraie équation Word (OMML), modifiable dans Word ;
// - à l'ouverture d'un .docx, les équations (de Word ou de Labo Élève) redeviennent modifiables.
(function () {
  const FONCTIONS = ['sin', 'cos', 'tan', 'ln', 'log', 'exp', 'lim', 'max', 'min', 'arcsin', 'arccos', 'arctan'];
  const LETTRES = /[A-Za-zÀ-ÿα-ωΑ-Ωπ∞°]/;
  const OPS = { '*': '×', '-': '−', '<=': '≤', '>=': '≥', '!=': '≠', '+-': '±', '->': '→' };

  // ---------- 1. Découpage ----------
  function jetons(source) {
    const t = [];
    let i = 0;
    const s = String(source || '');
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { if (t.length && t[t.length - 1].t !== 'espace') t.push({ t: 'espace' }); i++; continue; } // une espace termine une fraction (comme dans Word)
      const deux = s.slice(i, i + 2);
      if (OPS[deux] && deux.length === 2) { t.push({ t: 'op', v: OPS[deux] }); i += 2; continue; }
      if (/[0-9]/.test(c)) { const m = /^[0-9]+(?:[.,][0-9]+)?/.exec(s.slice(i)); t.push({ t: 'nombre', v: m[0] }); i += m[0].length; continue; }
      const mot = /^[a-z]+/.exec(s.slice(i));
      if (mot && mot[0].startsWith('vec')) { t.push({ t: 'vec' }); i += 3; continue; } // vec(AB) : vecteur
      if ('∑∫∏'.includes(c)) { t.push({ t: 'grand', v: c }); i++; continue; } // somme, intégrale (bornes avec _ et ^)
      if (mot) { const f = FONCTIONS.find((x) => mot[0].startsWith(x)); if (f) { t.push({ t: 'fonction', v: f }); i += f.length; continue; } }
      if (LETTRES.test(c)) { t.push({ t: c === '°' ? 'op' : 'ident', v: c }); i++; continue; }
      if ('()[]'.includes(c)) { t.push({ t: c === '(' || c === '[' ? 'ouvre' : 'ferme', v: c }); i++; continue; }
      if ('^_/√'.includes(c)) { t.push({ t: c }); i++; continue; }
      t.push({ t: 'op', v: OPS[c] || c }); i++;
    }
    return t;
  }

  // ---------- 2. Analyse : arbre de l'expression ----------
  function analyser(source) {
    const t = jetons(source);
    let p = 0;
    const voir = () => t[p];
    function sequence() { // jusqu'à « ) » ou la fin
      const elements = [];
      while (p < t.length && voir().t !== 'ferme') {
        if (voir().t === 'op') { elements.push({ t: 'op', v: t[p++].v }); continue; }
        if (voir().t === '/') { p++; elements.push({ t: '/' }); continue; }
        if (voir().t === 'espace') { p++; elements.push({ t: 'sep' }); continue; }
        const f = puissance();
        if (f) elements.push(f);
      }
      // Fractions : la suite de facteurs collés avant « / » sur celle d'après (a+b/c → a + b/c ; (a+b)/2).
      const sortie = [];
      for (let i = 0; i < elements.length; i++) {
        const e = elements[i];
        if (e.t !== '/') { sortie.push(e); continue; }
        const num = [];
        while (sortie.length && sortie[sortie.length - 1].t === 'sep') sortie.pop();
        while (sortie.length && !['op', 'sep'].includes(sortie[sortie.length - 1].t)) num.unshift(sortie.pop());
        const den = [];
        while (i + 1 < elements.length && elements[i + 1].t === 'sep' && !den.length) i++;
        while (i + 1 < elements.length && !['op', '/', 'sep'].includes(elements[i + 1].t)) den.push(elements[++i]);
        sortie.push({ t: 'frac', num: deballer(num), den: deballer(den) });
      }
      return { t: 'seq', elements: sortie.filter((e) => e.t !== 'sep') };
    }
    // Une parenthèse seule qui sert de groupe (numérateur, exposant, racine) n'est pas affichée.
    const deballer = (liste) => (liste.length === 1 && liste[0].t === 'paren' ? liste[0].contenu : { t: 'seq', elements: liste });
    function argument() {
      while (voir() && voir().t === 'espace') p++;
      const j = voir();
      if (!j) return { t: 'seq', elements: [] };
      if (j.t === 'ouvre') { const b = base(); return b.t === 'paren' ? b.contenu : b; }
      if (j.t === 'op' && (j.v === '−' || j.v === '+')) { p++; const b = base(); return { t: 'seq', elements: [{ t: 'op', v: j.v }, b] }; }
      return base() || { t: 'seq', elements: [] };
    }
    function base() {
      while (voir() && voir().t === 'espace') p++;
      const j = voir();
      if (!j) return null;
      if (j.t === 'nombre' || j.t === 'ident' || j.t === 'fonction') { p++; return { t: j.t, v: j.v }; }
      if (j.t === 'ouvre') {
        p++;
        const contenu = sequence();
        const ferme = voir() && voir().t === 'ferme' ? t[p++].v : ')';
        return { t: 'paren', ouvre: j.v, ferme, contenu };
      }
      if (j.t === '√') { // √(x) racine carrée ; √(3&x) racine n-ième (notation de Word)
        p++;
        const arg = argument();
        const k = arg.t === 'seq' ? arg.elements.findIndex((e) => e.t === 'op' && e.v === '&') : -1;
        if (k < 0) return { t: 'racine', arg };
        return { t: 'racine', deg: { t: 'seq', elements: arg.elements.slice(0, k) }, arg: { t: 'seq', elements: arg.elements.slice(k + 1) } };
      }
      if (j.t === 'vec') { p++; return { t: 'vecteur', arg: argument() }; }
      if (j.t === 'grand') { p++; return { t: 'grand', v: j.v }; }
      p++;
      return null; // ^ _ isolés
    }
    function puissance() {
      let b = base();
      if (!b) return null;
      while (voir() && (voir().t === '^' || voir().t === '_')) {
        const type = t[p++].t;
        const a = argument();
        if (type === '^') b = b.t === 'sub' ? { t: 'subsup', base: b.base, ind: b.ind, exp: a } : { t: 'sup', base: b, exp: a };
        else b = { t: 'sub', base: b, ind: a };
      }
      return b;
    }
    const arbre = sequence();
    while (p < t.length) { p++; const suite = sequence(); arbre.elements.push({ t: 'op', v: ')' }, ...suite.elements); } // « ) » en trop
    return arbre;
  }

  // ---------- 3. Rendu MathML ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function mathml(n) {
    switch (n.t) {
      case 'seq': return `<mrow>${n.elements.map(mathml).join('')}</mrow>`;
      case 'nombre': return `<mn>${esc(n.v)}</mn>`;
      case 'ident': return `<mi>${esc(n.v)}</mi>`;
      case 'fonction': return `<mi mathvariant="normal">${esc(n.v)}</mi>`;
      case 'op': return `<mo>${esc(n.v)}</mo>`;
      case 'paren': return `<mrow><mo>${esc(n.ouvre)}</mo>${mathml(n.contenu)}<mo>${esc(n.ferme)}</mo></mrow>`;
      case 'frac': return `<mfrac>${mathml(n.num)}${mathml(n.den)}</mfrac>`;
      // Somme et produit : bornes au-dessous / au-dessus, comme dans Word
      case 'sup': return n.base.t === 'grand' && n.base.v !== '∫' ? `<mover>${mathml(n.base)}${mathml(n.exp)}</mover>` : `<msup>${mathml(n.base)}${mathml(n.exp)}</msup>`;
      case 'sub': return n.base.t === 'grand' && n.base.v !== '∫' ? `<munder>${mathml(n.base)}${mathml(n.ind)}</munder>` : `<msub>${mathml(n.base)}${mathml(n.ind)}</msub>`;
      case 'subsup': return n.base.t === 'grand' && n.base.v !== '∫' ? `<munderover>${mathml(n.base)}${mathml(n.ind)}${mathml(n.exp)}</munderover>` : `<msubsup>${mathml(n.base)}${mathml(n.ind)}${mathml(n.exp)}</msubsup>`;
      case 'racine': return n.deg ? `<mroot>${mathml(n.arg)}${mathml(n.deg)}</mroot>` : `<msqrt>${mathml(n.arg)}</msqrt>`;
      case 'vecteur': return `<mover accent="true">${mathml(n.arg)}<mo stretchy="true">→</mo></mover>`;
      case 'grand': return `<mo largeop="true" movablelimits="false">${esc(n.v)}</mo>`;
      default: return '';
    }
  }
  const rendre = (source) => `<math xmlns="http://www.w3.org/1998/Math/MathML" displaystyle="true">${mathml(analyser(source))}</math>`;
  // Zone d'équation placée dans la page, comme dans Word : la saisie au clavier (.eq-source) n'est visible
  // que pendant la modification ; le reste du temps on voit le rendu « professionnel » (.eq-rendu).
  const html = (source, marque = '') => `<span class="equation${source ? '' : ' vide'}" contenteditable="false" data-source="${esc(source)}"${marque ? ` data-${marque}="1"` : ''} title="Clique pour modifier l'équation"><span class="eq-source" contenteditable="true" spellcheck="false">${esc(source)}</span><span class="eq-rendu">${source ? rendre(source) : ''}</span></span>`;

  // ---------- 4. Équation Word (bibliothèque docx) ----------
  const FIN_NARY = ['+', '−', '=', '<', '>', '≤', '≥', '≠', '≈', '→', '±'];
  function versDocx(source, D) {
    // Somme / intégrale : l'expression qui suit (jusqu'au prochain +, −, =…) devient le corps de l'opérateur.
    const nary = (n) => {
      const g = n.t === 'grand' ? n : n.base && n.base.t === 'grand' ? n.base : null;
      if (!g || (g.v !== '∑' && g.v !== '∫')) return null;
      return { classe: g.v === '∑' ? D.MathSum : D.MathIntegral, sub: n.ind, sup: n.exp };
    };
    const conv = (n) => {
      switch (n.t) {
        case 'seq': {
          const sortie = [];
          for (let i = 0; i < n.elements.length; i++) {
            const e = n.elements[i], o = nary(e);
            if (!o || !o.classe) { sortie.push(...conv(e)); continue; }
            const corps = [];
            while (i + 1 < n.elements.length && !(n.elements[i + 1].t === 'op' && FIN_NARY.includes(n.elements[i + 1].v))) corps.push(n.elements[++i]);
            sortie.push(new o.classe({ children: corps.flatMap(conv), subScript: o.sub ? conv(o.sub) : undefined, superScript: o.sup ? conv(o.sup) : undefined }));
          }
          return sortie;
        }
        case 'grand': return [new D.MathRun(n.v)];
        case 'vecteur': return [new D.MathLimitUpper({ children: conv(n.arg), limit: [new D.MathRun('→')] })];
        case 'nombre': case 'ident': case 'fonction': case 'op': return [new D.MathRun(n.v)];
        case 'paren': return [n.ouvre === '(' && D.MathRoundBrackets ? new D.MathRoundBrackets({ children: conv(n.contenu) }) : [new D.MathRun(n.ouvre), ...conv(n.contenu), new D.MathRun(n.ferme)]].flat();
        case 'frac': return [new D.MathFraction({ numerator: conv(n.num), denominator: conv(n.den) })];
        case 'sup': return [new D.MathSuperScript({ children: conv(n.base), superScript: conv(n.exp) })];
        case 'sub': return [new D.MathSubScript({ children: conv(n.base), subScript: conv(n.ind) })];
        case 'subsup': return D.MathSubSuperScript
          ? [new D.MathSubSuperScript({ children: conv(n.base), subScript: conv(n.ind), superScript: conv(n.exp) })]
          : [new D.MathSuperScript({ children: [new D.MathSubScript({ children: conv(n.base), subScript: conv(n.ind) })], superScript: conv(n.exp) })];
        case 'racine': return [new D.MathRadical({ children: conv(n.arg), degree: n.deg ? conv(n.deg) : undefined })];
        default: return [];
      }
    };
    return new D.Math({ children: conv(analyser(source)) });
  }

  // ---------- 5. Équation Word (OMML) → saisie simple ----------
  function depuisOMML(el) {
    const enfants = (n, nom) => [...n.children].filter((c) => !nom || c.localName === nom);
    const premier = (n, nom) => enfants(n, nom)[0];
    const groupe = (x) => (/^[\p{L}\p{N}.,°]+$/u.test(x) && [...x].length <= 1 || /^[0-9]+(?:[.,][0-9]+)?$/.test(x) ? x : `(${x})`);
    const lin = (n) => {
      if (!n) return '';
      switch (n.localName) {
        case 'r': return [...n.getElementsByTagNameNS('*', 't')].map((x) => x.textContent).join('');
        case 'f': return `${groupe(lin(premier(n, 'num')))}/${groupe(lin(premier(n, 'den')))} `; // l'espace termine la fraction
        case 'sSup': return `${lin(premier(n, 'e'))}^${groupe(lin(premier(n, 'sup')))}`;
        case 'sSub': return `${lin(premier(n, 'e'))}_${groupe(lin(premier(n, 'sub')))}`;
        case 'sSubSup': return `${lin(premier(n, 'e'))}_${groupe(lin(premier(n, 'sub')))}^${groupe(lin(premier(n, 'sup')))}`;
        case 'rad': { const deg = lin(premier(n, 'deg')); return `√(${deg ? deg + '&' : ''}${lin(premier(n, 'e'))})`; }
        case 'limUpp': { const l = lin(premier(n, 'lim')); return /^[→⃗]$/.test(l) ? `vec${groupe(lin(premier(n, 'e')))}` : `${lin(premier(n, 'e'))}^${groupe(l)}`; }
        case 'acc': {
          const pr = premier(n, 'accPr'), c = pr && premier(pr, 'chr'), ch = c ? c.getAttribute('m:val') || '' : '̂';
          return /[→⃗]/.test(ch) ? `vec${groupe(lin(premier(n, 'e')))}` : lin(premier(n, 'e'));
        }
        case 'd': {
          const pr = premier(n, 'dPr');
          const car = (nom, defaut) => { const c = pr && premier(pr, nom); return c ? c.getAttribute('m:val') ?? c.getAttributeNS('*', 'val') ?? defaut : defaut; };
          return `${car('begChr', '(')}${enfants(n, 'e').map(lin).join(', ')}${car('endChr', ')')}`;
        }
        case 'func': return `${lin(premier(n, 'fName'))} ${lin(premier(n, 'e'))}`;
        case 'nary': {
          const pr = premier(n, 'naryPr'); const c = pr && premier(pr, 'chr');
          const signe = c ? c.getAttribute('m:val') || '∫' : '∫';
          const sb = lin(premier(n, 'sub')), sp = lin(premier(n, 'sup'));
          return `${signe}${sb ? '_' + groupe(sb) : ''}${sp ? '^' + groupe(sp) : ''} ${lin(premier(n, 'e'))}`;
        }
        default:
          if (/Pr$/.test(n.localName)) return '';
          return enfants(n).map(lin).join('');
      }
    };
    // Espaces autour de =, +, −… pour une saisie lisible (et pour que « 1/2 m » ne devienne pas « 1/(2m) »),
    // sauf pour un signe moins en début d'expression ou de groupe.
    return lin(el)
      .replace(/\s*([=+−×÷±≤≥≠≈→<>-])\s*/g, ' $1 ')
      .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
      .replace(/(^|[(^_])\s*([−-])\s+/g, '$1$2')
      .replace(/−/g, '-').replace(/\s+/g, ' ').trim();
  }

  // ---------- 6. Ouverture d'un .docx : équations remplacées par des repères avant la conversion ----------
  const TABLE_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (o) => { let c = 0xffffffff; for (let i = 0; i < o.length; i++) c = TABLE_CRC[(c ^ o[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function lireZip(o) {
    let fin = o.length - 22;
    while (fin >= 0 && !(o[fin] === 0x50 && o[fin + 1] === 0x4b && o[fin + 2] === 5 && o[fin + 3] === 6)) fin--;
    if (fin < 0) throw new Error('Fichier .docx illisible.');
    const dv = new DataView(o.buffer, o.byteOffset);
    let p = dv.getUint32(fin + 16, true);
    const n = dv.getUint16(fin + 10, true), entrees = [];
    for (let i = 0; i < n; i++) {
      const methode = dv.getUint16(p + 10, true), taille = dv.getUint32(p + 20, true);
      const lnom = dv.getUint16(p + 28, true), lextra = dv.getUint16(p + 30, true), lcom = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
      const nom = new TextDecoder().decode(o.subarray(p + 46, p + 46 + lnom));
      const debut = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      let donnees = o.subarray(debut, debut + taille);
      if (methode === 8) donnees = new Uint8Array(await new Response(new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      entrees.push({ nom, donnees });
      p += 46 + lnom + lextra + lcom;
    }
    return entrees;
  }
  function ecrireZip(entrees) { // fichiers « stockés » (sans compression) : suffisant pour la conversion
    const enc = new TextEncoder(), morceaux = [], central = [];
    let decalage = 0;
    for (const e of entrees) {
      const nom = enc.encode(e.nom), crc = crc32(e.donnees), n = e.donnees.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true);
      h.setUint16(26, nom.length, true); h.setUint16(28, 0, true);
      morceaux.push(new Uint8Array(h.buffer), nom, e.donnees);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true);
      c.setUint16(28, nom.length, true); c.setUint32(42, decalage, true);
      central.push(new Uint8Array(c.buffer), nom);
      decalage += 30 + nom.length + n;
    }
    const tailleCentral = central.reduce((s, x) => s + x.length, 0);
    const f = new DataView(new ArrayBuffer(22));
    f.setUint32(0, 0x06054b50, true); f.setUint16(8, entrees.length, true); f.setUint16(10, entrees.length, true);
    f.setUint32(12, tailleCentral, true); f.setUint32(16, decalage, true);
    const tout = [...morceaux, ...central, new Uint8Array(f.buffer)];
    const sortie = new Uint8Array(tout.reduce((s, x) => s + x.length, 0));
    let i = 0; for (const x of tout) { sortie.set(x, i); i += x.length; }
    return sortie;
  }
  // Renvoie { octets, sources } : le document sans ses équations (repères ⟦EQn⟧) et le texte de chacune.
  async function extraireEquations(octets) {
    const entrees = await lireZip(new Uint8Array(octets));
    const doc = entrees.find((e) => e.nom === 'word/document.xml');
    if (!doc) return { octets, sources: [] };
    let xml = new TextDecoder().decode(doc.donnees);
    if (!/<m:oMath\b/.test(xml) && !/<w:br [^>]*w:type="page"/.test(xml)) return { octets, sources: [], entrees };
    // Les sauts de page sont aussi gardés (la conversion les ignore) : repère ⟦SAUT⟧.
    xml = xml.replace(/<w:br [^>]*w:type="page"[^>]*\/>/g, '<w:t>⟦SAUT⟧</w:t>');
    const espaces = (/<w:document\b[^>]*>/.exec(xml) || [''])[0].match(/xmlns:\w+="[^"]*"/g) || [];
    const sources = [];
    const convertir = (fragment) => {
      const d = new DOMParser().parseFromString(`<racine ${espaces.join(' ')}>${fragment}</racine>`, 'application/xml');
      const omaths = [...d.getElementsByTagNameNS('*', 'oMath')];
      return omaths.map((m) => { sources.push(depuisOMML(m)); return `<w:r><w:t xml:space="preserve">⟦EQ${sources.length - 1}⟧</w:t></w:r>`; }).join('<w:r><w:t xml:space="preserve"> </w:t></w:r>');
    };
    xml = xml.replace(/<m:oMathPara\b[^>]*>[\s\S]*?<\/m:oMathPara>/g, convertir).replace(/<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/g, convertir);
    doc.donnees = new TextEncoder().encode(xml);
    return { octets: ecrireZip(entrees).buffer, sources, entrees };
  }

  // ---------- 7. Onglet « Équation » du ruban : structures et symboles ----------
  // [identifiant, nom, texte inséré, position du curseur dans ce texte, exemple affiché sur le bouton]
  const STRUCTURES = [
    ['fraction', 'Fraction', '()/()', 1, 'a/b'],
    ['exposant', 'Exposant', '^()', 2, 'x^2'],
    ['indice', 'Indice', '_()', 2, 'x_1'],
    ['racine', 'Racine carrée', '√()', 2, '√(x)'],
    ['racine-n', 'Racine n-ième', '√(&)', 2, '√(3&x)'],
    ['parentheses', 'Parenthèses', '()', 1, '(x)'],
    ['crochets', 'Crochets', '[]', 1, '[x]'],
    ['valeur-absolue', 'Valeur absolue', '||', 1, '|x|'],
    ['somme', 'Somme', '∑_(i=1)^(n) ', 12, '∑_(i=1)^n'],
    ['integrale', 'Intégrale', '∫_()^() ', 3, '∫_a^b'],
    ['vecteur', 'Vecteur', 'vec()', 4, 'vec(AB)'],
  ];
  const SYMBOLES = ['π', '×', '÷', '±', '≤', '≥', '≠', '≈', '∞', 'α', 'β', 'Δ', 'θ', 'λ', 'μ', 'Ω', '→', '°', 'ω', 'ρ', 'σ', 'φ', '∈', '⇒'];

  // ---------- 8. Texte avec passages mathématiques (questions des évaluations) ----------
  // Dans une phrase, seuls les nombres, calculs, fonctions et inconnues sont rendus en écriture mathématique ;
  // les mots restent du texte. « Résous : 8x + 15 = 23. Donne la valeur de x. » → 8x + 15 = 23 et x en maths.
  const FONCTIONS_TEXTE = ['sin', 'cos', 'tan', 'ln', 'log', 'exp', 'f', 'g', 'h'];
  function texteAvecMaths(source) {
    const s = String(source ?? '');
    const re = /(\d+(?:[.,]\d+)?)|([A-Za-zÀ-ÖØ-öø-ÿ̄]+)|([ \t]+)|([+\-−×*/^=<>≤≥≈≠±√()²³%π_])|([\s\S])/g;
    const t = [];
    let m;
    while ((m = re.exec(s))) t.push({ v: m[0], k: m[1] ? 'nb' : m[2] ? 'mot' : m[3] ? 'esp' : m[4] ? 'op' : 'autre' });
    const voisin = (i, pas) => { let j = i + pas; while (t[j] && t[j].k === 'esp') j += pas; return t[j]; };
    const colle = (i, pas) => t[i + pas];
    for (let i = 0; i < t.length; i++) {
      const x = t[i];
      if (x.k === 'nb') x.m = true;
      else if (x.k === 'op') {
        // un tiret entre deux mots (c'est-à-dire) reste du texte
        const a = colle(i, -1), b = colle(i, 1);
        x.m = !(x.v === '-' && a && b && a.k === 'mot' && b.k === 'mot');
      } else if (x.k === 'mot') {
        const suivant = colle(i, 1);
        if (FONCTIONS_TEXTE.includes(x.v) && suivant && suivant.v === '(') x.m = true; // f(x), sin(30)
        else if (x.v.length === 1 && /[a-zπ]/.test(x.v)) {
          const a = voisin(i, -1), b = voisin(i, 1), ca = colle(i, -1), cb = colle(i, 1);
          const opProche = (y) => y && y.k === 'op' && y.v !== '%';
          // x : toujours une inconnue ; une autre lettre seule : si elle touche un calcul (2a, a = 5, a²)
          x.m = x.v === 'x' || opProche(a) || opProche(b) || (ca && ca.k === 'nb') || (cb && cb.k === 'nb');
        }
      }
    }
    // Passages : suites de morceaux « maths », espaces compris entre deux morceaux maths
    let html = '', i = 0;
    while (i < t.length) {
      if (!t[i].m) { html += esc(t[i].v); i++; continue; }
      let j = i, fin = i;
      while (j < t.length && (t[j].m || t[j].k === 'esp')) { if (t[j].m) fin = j; j++; }
      const passage = t.slice(i, fin + 1);
      const utile = passage.some((y) => y.k === 'nb' || y.k === 'mot'); // pas seulement des signes ou des parenthèses
      const texte = passage.map((y) => y.v).join('');
      html += utile ? `<span class="maths-texte">${rendre(texte)}</span>` : esc(texte);
      i = fin + 1;
    }
    return html;
  }

  // Explication en plusieurs étapes : une étape par ligne
  const etapes = (t) => { const s = String(t || '').trim(); if (!s) return []; const l = s.includes('\n') ? s.split(/\n+/) : s.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ(«])/); return l.map((x) => x.trim()).filter(Boolean); };
  const etapesHtml = (t) => etapes(t).map((x) => `<div class="etape">${texteAvecMaths(x)}</div>`).join('');

  window.Equations = { analyser, rendre, html, versDocx, depuisOMML, extraireEquations, texteAvecMaths, etapes, etapesHtml, STRUCTURES, SYMBOLES };
})();
