// Évaluation « exercice » : la feuille d'exercice de l'enseignant (PDF), une zone par question.
//   Élève      : il clique sur une question → elle s'agrandit (loupe) avec sa zone de réponse :
//                lignes (texte ou écriture mathématique), tableau de valeurs, tableau de variations (flèches) ;
//                sa réponse s'écrit aussi sur la feuille, dans la zone de réponse prévue par l'enseignant.
//                Les outils autorisés (calculatrice, NumWorks, tableur…) s'ouvrent à côté (double fenêtre).
//   Correction : l'élève revoit la feuille, chaque question en couleur (juste / en partie / faux) et les commentaires.
//   Enseignant : ?mode=zones&eval=…   tracer les questions (et leurs zones de réponse) sur le PDF
//                ?mode=corriger&sid=…&eleve=…   corriger les copies à la main
import * as pdfjsLib from '../mes-documents/pdfjs/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '../mes-documents/pdfjs/build/pdf.worker.mjs';

const api = window.parent && window.parent.labo && window.parent.labo.evaluations;
const app = document.getElementById('app');
const EQ = window.Equations, M = window.CalculatriceMoteur;
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const maths = (t) => { try { return EQ && String(t || '').trim() ? EQ.rendre(String(t)).replace(/<mi>R<\/mi><mi>é<\/mi><mi>p<\/mi>/g, '<mtext>Rép</mtext>') : echapper(t); } catch { return echapper(t); } };
const tm = (t) => (EQ && EQ.texteAvecMaths ? EQ.texteAvecMaths(t) : echapper(t));
const VERDICTS = { juste: ['✔', 'Juste'], partiel: ['◐', 'En partie'], faux: ['✘', 'Faux'] };
// Travail à rendre : remarques de l'enseignant par question
const VERDICTS_TRAVAIL = { juste: ['✔', 'Validé'], partiel: ['◐', 'À compléter'], faux: ['✘', 'Faux'] };
const TYPES = { lignes: '✏️ Réponse rédigée', valeurs: '🔢 Tableau de valeurs', variations: '📈 Tableau de variations', arbre: '🌳 Arbre de probabilités' };
const OUTILS = { calculatrice: '🧮 Calculatrice', 'calculatrice-numworks': '🔢 NumWorks', tableur: '📊 Tableur', geogebra: '📐 GeoGebra', python: '🐍 Python', 'tableau-periodique': '⚛️ Tableau périodique' };
const typeDe = (z) => (TYPES[z.type] ? z.type : 'lignes');
function ecran(ic, titre, texte) { app.innerHTML = `<div class="centre"><div class="ic">${ic}</div><h1>${echapper(titre)}</h1><p>${texte}</p></div>`; }
function message(t, erreur) {
  const m = document.createElement('div'); m.className = 'ex-message' + (erreur ? ' erreur' : ''); m.textContent = t;
  document.body.append(m); setTimeout(() => m.remove(), 3500);
}

// =====================================================================================
// Réponses : affichage (lignes, tableau de valeurs, tableau de variations)
// =====================================================================================
const ligneHtml = (l) => (l.m ? `<span class="maths">${maths(l.t)}</span>` : `<span class="txt">${echapper(l.t)}</span>`);
const nonVide = (v) => {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (v.cases) return Object.values(v.cases).some((x) => String(x || '').trim());
  return ['x', 's', 'z', 'f', 'fl'].some((k) => (v[k] || []).some((x) => String(x || '').trim())) || ['n', 'p'].some((k) => Object.values(v[k] || {}).some((x) => String(x || '').trim()));
};

// ---------- Arbre de probabilités ----------
// Nœuds repérés par leur chemin : « 0 », « 1 » (1er niveau), « 0-1 »… ; n = événement écrit sur le nœud, p = probabilité de la branche qui y mène.
const BARRE = '\u0304'; // barre de l'événement contraire : M → M̄
function noeudsArbre(t) {
  const res = [{ c: '', prof: 0 }];
  const suite = (c, prof) => { if (prof >= t.niveaux) return; for (let b = 0; b < t.branches; b++) { const cc = c === '' ? String(b) : `${c}-${b}`; res.push({ c: cc, prof: prof + 1, parent: c }); suite(cc, prof + 1); } };
  suite('', 0);
  return res;
}
const axesParDefaut = (niveaux) => Array.from({ length: niveaux + 1 }, (_v, k) => 0.06 + (0.8 * k) / niveaux);
// positions : feuilles régulièrement espacées entre yh et yb ; un nœud est au milieu de ses enfants ; ax = colonne de chaque niveau
function geoArbre(t, W, H) {
  const nds = noeudsArbre(t), feuilles = nds.filter((n) => n.prof === t.niveaux), ax = t.ax && t.ax.length === t.niveaux + 1 ? t.ax : axesParDefaut(t.niveaux);
  const yh = t.yh ?? 0.06, yb = t.yb ?? 0.94, pos = {};
  feuilles.forEach((n, i) => { pos[n.c] = { x: ax[t.niveaux] * W, y: (yh + ((yb - yh) * (feuilles.length > 1 ? i / (feuilles.length - 1) : 0.5))) * H }; });
  for (let p = t.niveaux - 1; p >= 0; p--) nds.filter((n) => n.prof === p).forEach((n) => { const e = nds.filter((m) => m.parent === n.c); pos[n.c] = { x: ax[p] * W, y: e.reduce((sy, m) => sy + pos[m.c].y, 0) / e.length }; });
  return { nds, pos };
}
// place de l'événement (à droite d'une extrémité, au-dessus d'un nœud intermédiaire) et de la probabilité (au milieu de la branche, au-dessus)
const placeEvenement = (n, t, pt, ta) => (n.prof === t.niveaux ? { x: pt.x + ta * 0.6, y: pt.y, ancre: 'start' } : { x: pt.x, y: pt.y - ta * 1.05, ancre: 'middle' });
const placeProba = (a, b, ta) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - ta * 0.7 });
function svgArbre(t, d, W, H, { cale = false, max = 16, lignesSeules = false } = {}) {
  const { nds, pos } = geoArbre(t, W, H), nbF = t.branches ** t.niveaux;
  const ta = Math.max(7, Math.min(max, (H / Math.max(3, nbF)) * 0.45));
  const encre = '#1d4ed8';
  d = d || {};
  let s = `<svg class="ex-svg-arbre" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="${cale ? 'Segoe Print, Comic Sans MS, sans-serif' : 'Cambria Math, Cambria, serif'}">`;
  if (!cale) {
    for (const n of nds) if (n.c !== '') s += `<line x1="${pos[n.parent].x.toFixed(1)}" y1="${pos[n.parent].y.toFixed(1)}" x2="${pos[n.c].x.toFixed(1)}" y2="${pos[n.c].y.toFixed(1)}" stroke="#64748b" stroke-width="1.5"/>`;
    for (const n of nds) s += `<circle cx="${pos[n.c].x.toFixed(1)}" cy="${pos[n.c].y.toFixed(1)}" r="${n.c === '' ? 4 : 3}" fill="${n.c === '' ? '#111' : '#64748b'}"/>`;
  }
  if (lignesSeules) return s + '</svg>';
  const ecrire = (x, y, texte, ancre, donne) => (String(texte || '').trim() ? `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${ancre}" dominant-baseline="central" font-size="${ta.toFixed(1)}" fill="${donne ? '#111' : encre}">${echapper(texte)}</text>` : '');
  const val = (k, c) => { const g = ((t.donnes || {})[k] || {})[c]; return g ? [g, true] : [((d[k] || {})[c]) || '', false]; };
  for (const n of nds) {
    if (n.c === '') continue;
    const [ev, evD] = val('n', n.c), [pr, prD] = val('p', n.c);
    const pe = placeEvenement(n, t, pos[n.c], ta), pp = placeProba(pos[n.parent], pos[n.c], ta);
    s += ecrire(pe.x, pe.y, ev, pe.ancre, evD) + ecrire(pp.x, pp.y, pr, 'middle', prD);
  }
  return s + '</svg>';
}
// Tableau de valeurs : cases données par l'enseignant (tab.d) et cases remplies par l'élève (rep.cases)
function tableValeursHtml(tab, rep, editable = false) {
  const cs = (rep && rep.cases) || {};
  return `<table class="ex-tv">${Array.from({ length: tab.l }, (_r, r) => `<tr>${Array.from({ length: tab.c }, (_c, c) => {
    const donne = ((tab.d || [])[r] || [])[c];
    if (donne) return `<td class="donne">${tm(donne)}</td>`;
    const k = `${r}-${c}`;
    return editable ? `<td class="a-remplir"><input data-case="${k}" value="${echapper(cs[k] || '')}" autocomplete="off" spellcheck="false" aria-label="Ligne ${r + 1}, colonne ${c + 1}"></td>` : `<td class="eleve">${cs[k] ? tm(cs[k]) : ''}</td>`;
  }).join('')}</tr>`).join('')}</table>`;
}
// Tableau de variations : valeurs de x, (signes de f′), valeurs de f et flèches (h : monte, b : descend, c : constante)
let numSvg = 0;
function positionVar(fl, k, n) {
  if ((k > 0 && fl[k - 1] === 'h') || (k < n - 1 && fl[k] === 'b')) return 'h';
  if ((k > 0 && fl[k - 1] === 'b') || (k < n - 1 && fl[k] === 'h')) return 'b';
  return 'c';
}
const titres = (t) => { const fn = t.fn || 'f', l = t.lig || {}; return { x: l.x || 'x', s: l.s || fn + '′(x)', f: l.f || fn + '(x)' }; };
const avecVariations = (t) => t.var !== false || !t.signe;
function svgVariations(tab, d = {}) {
  const n = tab.n, sg = tab.signe, vr = avecVariations(tab), ti = titres(tab), id = 'fl' + (++numSvg);
  const val = (k, cle) => String((d[cle] || [])[k] || '');
  const gx = Math.max(92, 9 * Math.max(ti.x.length, sg ? ti.s.length : 0, vr ? ti.f.length : 0) + 16), pas = 120, W = gx + 40 + pas * (n - 1) + 40, hx = 36, hs = sg ? 36 : 0, hf = vr ? 100 : 0, H = hx + hs + hf;
  const X = (k) => gx + 40 + pas * k;
  const encre = '#1d4ed8';
  let s = `<svg class="ex-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" font-family="Cambria Math, Cambria, serif" font-size="17">
    <defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${encre}"/></marker></defs>
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="#fff" stroke="#111" stroke-width="1.5"/>
    <line x1="1" y1="${hx}" x2="${W - 1}" y2="${hx}" stroke="#111"/>${sg && vr ? `<line x1="1" y1="${hx + hs}" x2="${W - 1}" y2="${hx + hs}" stroke="#111"/>` : ''}
    <line x1="${gx}" y1="1" x2="${gx}" y2="${H - 1}" stroke="#111"/>
    <text x="${gx / 2}" y="${hx / 2 + 6}" text-anchor="middle" font-size="15">${echapper(ti.x)}</text>
    ${sg ? `<text x="${gx / 2}" y="${hx + hs / 2 + 6}" text-anchor="middle" font-size="15">${echapper(ti.s)}</text>` : ''}
    ${vr ? `<text x="${gx / 2}" y="${hx + hs + hf / 2 + 6}" text-anchor="middle" font-size="15">${echapper(ti.f)}</text>` : ''}`;
  for (let k = 0; k < n; k++) {
    const donne = (tab.x || [])[k];
    s += `<text x="${X(k)}" y="${hx / 2 + 6}" text-anchor="middle" fill="${donne ? '#111' : encre}">${echapper(donne || val(k, 'x'))}</text>`;
    if (sg) s += `<text x="${X(k)}" y="${hx + hs / 2 + 6}" text-anchor="middle" fill="${encre}">${echapper(val(k, 'z'))}</text>`;
    const p = positionVar(d.fl || [], k, n), top = hx + hs;
    const y = p === 'h' ? top + 22 : p === 'b' ? top + hf - 10 : top + hf / 2 + 6;
    if (vr) s += `<text x="${X(k)}" y="${y}" text-anchor="middle" fill="${encre}">${echapper(val(k, 'f'))}</text>`;
    if (k < n - 1) {
      if (sg && val(k, 's')) s += `<text x="${(X(k) + X(k + 1)) / 2}" y="${hx + hs / 2 + 7}" text-anchor="middle" fill="${encre}" font-size="20">${echapper(val(k, 's'))}</text>`;
      const f = vr && (d.fl || [])[k], x1 = X(k) + 22, x2 = X(k + 1) - 22;
      if (f === 'h') s += `<line x1="${x1}" y1="${top + hf - 22}" x2="${x2}" y2="${top + 26}" stroke="${encre}" stroke-width="2" marker-end="url(#${id})"/>`;
      if (f === 'b') s += `<line x1="${x1}" y1="${top + 26}" x2="${x2}" y2="${top + hf - 22}" stroke="${encre}" stroke-width="2" marker-end="url(#${id})"/>`;
      if (f === 'c') s += `<line x1="${x1}" y1="${top + hf / 2}" x2="${x2}" y2="${top + hf / 2}" stroke="${encre}" stroke-width="2" marker-end="url(#${id})"/>`;
    }
  }
  return s + '</svg>';
}
// Tableau déjà imprimé sur la feuille : seules les écritures de l'élève, placées dans les cases du tableau imprimé.
// g : largeur de la colonne des titres ; h : séparations des lignes ; m : marge des valeurs de x (fractions de la zone).
const lignesTab = (t, type) => (type === 'valeurs' ? Array.from({ length: t.l }, (_v, r) => r) : ['x', t.signe && 's', avecVariations(t) && 'f'].filter(Boolean));
const bornesTab = (t, nb) => [0, ...((t.h && t.h.length === nb - 1) ? t.h : Array.from({ length: nb - 1 }, (_v, k) => (k + 1) / nb)), 1];
// position d'une valeur de x dans la partie droite du tableau (0..1) : placée par l'enseignant, sinon régulière
const posX = (t, k) => (t.px && t.px.length === t.n ? t.px[k] : (t.m ?? 0.08) + ((1 - 2 * (t.m ?? 0.08)) * k) / (t.n - 1));
const estArbre = (z) => typeDe(z) === 'arbre';
const estCale = (z) => typeDe(z) !== 'lignes' && z.tab && z.tab.imprime !== false;
function svgCale(z, d, W, H, max = 20) {
  const t = z.tab, type = typeDe(z), id = 'fl' + (++numSvg), encre = '#1d4ed8', g = t.g ?? 0.2;
  d = d || {};
  const ecrire = (x, y, texte, taille) => (String(texte || '').trim() ? `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${taille.toFixed(1)}">${echapper(texte)}</text>` : '');
  let s = `<svg class="ex-svg-cale" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe Print, Comic Sans MS, sans-serif" fill="${encre}">
    <defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${encre}"/></marker></defs>`;
  const lignes = lignesTab(t, type), b = bornesTab(t, lignes.length);
  if (type === 'valeurs') {
    const C = t.c, cs = d.cases || {};
    const col = (c) => (C === 1 ? [0, W] : c === 0 ? [0, g * W] : [g * W + ((1 - g) * W * (c - 1)) / (C - 1), g * W + ((1 - g) * W * c) / (C - 1)]);
    for (let r = 0; r < t.l; r++) for (let c = 0; c < C; c++) {
      if (((t.d || [])[r] || [])[c]) continue; // case imprimée
      const v = cs[`${r}-${c}`]; if (!v) continue;
      const [x0, x1] = col(c), y0 = b[r] * H, y1 = b[r + 1] * H;
      s += ecrire((x0 + x1) / 2, (y0 + y1) / 2, v, Math.max(6, Math.min(max, (y1 - y0) * 0.75, ((x1 - x0) / Math.max(2, v.length)) * 1.7)));
    }
  } else {
    const n = t.n;
    const px = (k) => g * W + (1 - g) * W * posX(t, k);
    lignes.forEach((ligne, r) => {
      const y0 = b[r] * H, y1 = b[r + 1] * H, hh = y1 - y0;
      if (ligne === 'x') { const ta = Math.max(6, Math.min(max, hh * 0.7)); for (let k = 0; k < n; k++) if (!(t.x || [])[k]) s += ecrire(px(k), (y0 + y1) / 2, (d.x || [])[k], ta); }
      if (ligne === 's') {
        const ta = Math.max(6, Math.min(max, hh * 0.7));
        for (let k = 0; k < n; k++) s += ecrire(px(k), (y0 + y1) / 2, (d.z || [])[k], ta);
        for (let k = 0; k < n - 1; k++) s += ecrire((px(k) + px(k + 1)) / 2, (y0 + y1) / 2, (d.s || [])[k], ta * 1.2);
      }
      if (ligne === 'f') {
        const ta = Math.max(6, Math.min(max, hh * 0.34)), fl = d.fl || [], ep = Math.max(1.2, ta / 9);
        // valeurs en haut / en bas de la ligne ; chaque flèche va d'une valeur à la suivante
        const yv = (k) => { const p = positionVar(fl, k, n); return p === 'h' ? y0 + ta * 0.75 : p === 'b' ? y1 - ta * 0.75 : (y0 + y1) / 2; };
        for (let k = 0; k < n; k++) s += ecrire(px(k), yv(k), (d.f || [])[k], ta);
        for (let k = 0; k < n - 1; k++) {
          if (!fl[k]) continue;
          const ya = fl[k] === 'c' ? (y0 + y1) / 2 : yv(k), yb = fl[k] === 'c' ? (y0 + y1) / 2 : yv(k + 1);
          const dx = px(k + 1) - px(k), dy = yb - ya, lg = Math.hypot(dx, dy) || 1, retrait = ta * 1.15;
          const x1 = px(k) + (dx / lg) * retrait, y1a = ya + (dy / lg) * retrait, x2 = px(k + 1) - (dx / lg) * retrait, y2 = yb - (dy / lg) * retrait;
          s += `<line x1="${x1.toFixed(1)}" y1="${y1a.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${encre}" stroke-width="${ep.toFixed(1)}" marker-end="url(#${id})"/>`;
        }
      }
    });
  }
  return s + '</svg>';
}
// Exemple de réponse : l'aperçu montré à l'enseignant quand il place la zone de réponse
function exempleRep(z) {
  const t = z.tab, type = typeDe(z);
  if (type === 'arbre') {
    const n = {}, p = {};
    noeudsArbre(t).filter((x) => x.c).forEach((x) => { const b = +x.c.split('-').pop(), L = 'ABC'[x.prof - 1];
      n[x.c] = t.branches === 2 ? (b ? L + BARRE : L) : L + (b + 1); p[x.c] = t.branches === 2 ? (b ? '0,7' : '0,3') : '0,2'; });
    return { n, p };
  }
  if (type === 'lignes') return [{ t: 'Exemple de réponse de l’élève :' }, { t: 'C(0) = 2 × 0^2 − 20 × 0 + 80 = 80', m: true }];
  if (type === 'valeurs') { const cases = {}; for (let r = 0; r < t.l; r++) for (let c = 0; c < t.c; c++) if (!((t.d || [])[r] || [])[c]) cases[`${r}-${c}`] = String(10 + r * 7 + c); return { cases }; }
  const n = t.n;
  return { x: Array.from({ length: n }, (_v, k) => ((t.x || [])[k] ? '' : String(k * 5))), z: Array.from({ length: n }, (_v, k) => (k > 0 && k < n - 1 ? '0' : '')),
    s: Array.from({ length: n - 1 }, (_v, k) => (k % 2 ? '+' : '−')), f: Array.from({ length: n }, (_v, k) => (k % 2 ? '30' : '80')), fl: Array.from({ length: n - 1 }, (_v, k) => (k % 2 ? 'h' : 'b')) };
}

// Réponse complète d'une question (cartes de correction)
function repHtml(z, v) {
  const t = typeDe(z);
  if (t === 'arbre') return `<div class="ex-var-carte">${svgArbre(z.tab, v || {}, 460, Math.min(320, Math.max(150, 46 * z.tab.branches ** z.tab.niveaux)), { max: 17 })}</div>`;
  if (t === 'valeurs') return tableValeursHtml(z.tab, v || {});
  if (t === 'variations') return `<div class="ex-var-carte">${svgVariations(z.tab, v || {})}</div>`;
  return v && v.length ? v.map((l) => `<div class="rep-ligne">${ligneHtml(l)}</div>`).join('') : '<p class="aide" style="margin:0">Pas de réponse.</p>';
}
// La réponse écrite sur la feuille, dans la zone de réponse tracée par l'enseignant
function reponseSurFeuille(pages, z, v, { onClick, classe = '' } = {}) {
  if (!z.rep) return null;
  const p = pages[z.rep.page - 1]; if (!p) return null;
  const el = document.createElement('div');
  el.className = `ex-rep ${classe} ${onClick ? 'cliquable' : ''}`;
  placer(el, z.rep);
  if (onClick) el.addEventListener('click', onClick);
  p.calque.append(el);
  remplirRep(el, z, v);
  return el;
}
// Contenu d'une zone de réponse déjà placée : lignes (rétrécies pour tenir), tableau dessiné, ou tableau calé sur la feuille
function remplirRep(el, z, v) {
  const t = typeDe(z);
  if (t === 'arbre') { el._cale = () => { el.innerHTML = svgArbre(z.tab, v || {}, el.clientWidth, el.clientHeight, { cale: z.tab.imprime !== false, max: taille12(el) }); }; el._cale(); return; }
  if (estCale(z)) { el._cale = () => { el.innerHTML = svgCale(z, v, el.clientWidth, el.clientHeight, taille12(el)); }; el._cale(); return; }
  el._cale = null;
  if (!nonVide(v)) { el.innerHTML = ''; return; }
  const contenu = t === 'variations' ? svgVariations(z.tab, v || {}) : t === 'valeurs' ? tableValeursHtml(z.tab, v || {}) : v.map((l) => `<div>${ligneHtml(l)}</div>`).join('');
  el.innerHTML = `<div class="ex-rep-in ${t}">${contenu}</div>`;
  if (t !== 'variations') requestAnimationFrame(() => ajuster(el));
}
// 12 pt sur la feuille : le calque connaît la largeur de la page (ou de la question agrandie) en points PDF
function taille12(el) {
  const c = el.parentElement, w = c && +c.dataset.ptw;
  return w ? (12 * c.clientWidth) / w : 15;
}
// le texte s'écrit en 12 pt ; il rétrécit seulement s'il ne tient pas dans la zone (et se réajuste quand la feuille change de taille)
function ajuster(el) {
  if (el._cale) { el._cale(); return; }
  const i = el.firstChild; if (!i || !i.classList || i.classList.contains('variations')) return;
  i.style.fontSize = taille12(el) + 'px';
  i.style.zoom = 1;
  const f = Math.min(1, (el.clientWidth - 4) / Math.max(1, i.scrollWidth), (el.clientHeight - 4) / Math.max(1, i.scrollHeight));
  i.style.zoom = Math.max(0.75, f); // jamais moins de 9 pt : au-delà, l'écriture dépasse un peu sous la zone
}
let reajuste = null;
new ResizeObserver(() => { clearTimeout(reajuste); reajuste = setTimeout(() => document.querySelectorAll('.ex-rep').forEach(ajuster), 120); }).observe(document.body);

// ---------- PDF ----------
async function ouvrirPdf(octets) { return pdfjsLib.getDocument({ data: new Uint8Array(octets) }).promise; }
async function afficherPages(pdf, conteneur, largeurMax = 900, zoom = 1) {
  conteneur.innerHTML = '';
  const pages = [];
  const largeur = Math.round(Math.max(320, Math.min(largeurMax, conteneur.clientWidth - 64)) * zoom);
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const e = largeur / base.width, dpr = window.devicePixelRatio || 1;
    const vue = page.getViewport({ scale: e * dpr });
    const el = document.createElement('div'); el.className = 'ex-page';
    el.style.width = largeur + 'px'; el.style.aspectRatio = `${base.width} / ${base.height}`; // la page rétrécit avec la fenêtre (double fenêtre)
    const canvas = document.createElement('canvas'); canvas.width = vue.width; canvas.height = vue.height;
    const calque = document.createElement('div'); calque.className = 'ex-calque'; calque.dataset.page = n; calque.dataset.ptw = base.width;
    el.append(canvas, calque);
    conteneur.append(el);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vue }).promise;
    pages.push({ numero: n, el, calque, largeur, hauteur: base.height * e });
  }
  return pages;
}
const placer = (el, z) => Object.assign(el.style, { left: z.x * 100 + '%', top: z.y * 100 + '%', width: z.l * 100 + '%', height: z.h * 100 + '%' });
// Loupe : la zone de la question, rendue nette à la largeur voulue
async function rendreZone(pdf, z, largeurCible) {
  const page = await pdf.getPage(z.page);
  const base = page.getViewport({ scale: 1 });
  const dpr = window.devicePixelRatio || 1;
  const echelle = Math.min(4, largeurCible / (z.l * base.width));
  const vue = page.getViewport({ scale: echelle * dpr });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(z.l * vue.width)); canvas.height = Math.max(1, Math.round(z.h * vue.height));
  canvas.style.width = canvas.width / dpr + 'px';
  canvas.dataset.ptw = z.l * base.width; // largeur de la question en points PDF (écriture en 12 pt dans l'aperçu)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vue, transform: [1, 0, 0, 1, -z.x * vue.width, -z.y * vue.height] }).promise;
  return canvas;
}

// =====================================================================================
// Élève : répondre
// =====================================================================================
const PALETTE = [['()/()', 1, 'a/b', 'Fraction'], ['^()', 2, 'x^2', 'Puissance'], ['_()', 2, 'x_1', 'Indice'], ['√()', 2, '√(x)', 'Racine'], ['()', 1, '(x)', 'Parenthèses'],
  ['×', 1, '×'], ['÷', 1, '÷'], ['−', 1, '−'], ['±', 1, '±'], ['=', 1, '='], ['≈', 1, '≈'], ['≠', 1, '≠'], ['≤', 1, '≤'], ['≥', 1, '≥'], ['π', 1, 'π'], ['°', 1, '°'], ['Δ', 1, 'Δ'], ['→', 1, '→'], ['⇒', 1, '⇒'], ['+∞', 2, '+∞', 'Plus l’infini'], ['−∞', 2, '−∞', 'Moins l’infini']];
const paletteHtml = () => `<div class="palette-maths">${PALETTE.map(([, , b, nom], i) => `<button type="button" data-palette="${i}" title="${echapper(nom || b)}">${b.length > 1 && !/∞/.test(b) && EQ ? EQ.rendre(b) : echapper(b)}</button>`).join('')}</div>`;
const FLECHES = { '': '·', h: '↗', b: '↘', c: '→' };

// src (travail à rendre) : { octets, sauver(état), apresRendu() } ; sinon : évaluation (dossier partagé de la session)
async function eleve(r, src = null) {
  const session = r.session, zones = r.questions || [];
  const reponses = {}, valides = new Set();
  let calculs = [], fini = false, minuterie = null;
  if (r.copie) {
    for (const [k, v] of Object.entries(r.copie.reponses || {})) {
      if (Array.isArray(v)) reponses[k] = v.filter((l) => l && typeof l === 'object');
      else if (v && typeof v === 'object') reponses[k] = v;
    }
    calculs = r.copie.calculs || []; fini = !!r.copie.fini; (r.copie.valides || []).forEach((n) => valides.add(n));
  }
  let octets = src && src.octets;
  if (!octets) {
    const rs = await api.pdfSujet();
    if (!rs.ok) { ecran('⏳', session.titre, echapper(rs.message)); setTimeout(() => location.reload(), 4000); return; }
    octets = rs.octets;
  }
  const pdf = await ouvrirPdf(octets);
  const travail = !!src;
  const retours = (src && src.retours) || {}; // { n° de question : { v, c } }
  const avecRetours = Object.keys(retours).length > 0 || !!(src && src.retourGeneral);
  const repondu = (i) => nonVide(reponses[i]);
  let delai = null;
  const enregistrer = (immediat) => { clearTimeout(delai); const f = () => (src ? src.sauver({ reponses, calculs, fini, valides: [...valides] }) : api.enregistrerCopie({ reponses, calculs, fini, valides: [...valides] })); if (immediat) return f(); delai = setTimeout(f, 600); return null; };
  const finChrono = () => (session.dureeMin > 0 ? Date.parse(session.debut) + session.dureeMin * 60000 : null);
  function chrono() {
    clearInterval(minuterie);
    const maj = () => {
      const el = document.getElementById('chrono'); const fin = finChrono(); if (!el || !fin) return;
      const reste = Math.max(0, Math.round((fin - Date.now()) / 1000));
      el.textContent = `⏱ ${String(Math.floor(reste / 60)).padStart(2, '0')}:${String(reste % 60).padStart(2, '0')}`;
      el.classList.toggle('urgent', reste <= 300);
      if (reste === 0 && !fini) rendre();
    };
    maj(); minuterie = setInterval(maj, 1000);
  }
  const outils = (session.outils || []).filter((id) => OUTILS[id]);
  const barreOutils = () => (outils.length && window.parent.ouvrirOutilACote ? `<div class="ex-outils"><span>🧰 Ouvrir à côté :</span>${outils.map((id) => `<button class="btn petit" data-outil="${id}">${OUTILS[id]}</button>`).join('')}</div>` : '');
  const brancherOutils = (racine) => racine.querySelectorAll('[data-outil]').forEach((b) => b.addEventListener('click', () => { if (!window.parent.ouvrirOutilACote(b.dataset.outil)) message('Cet outil n’est pas disponible.', true); }));
  let pages = [], courante = null, zoomFeuille = 1;
  async function feuille() {
    app.innerHTML = `<div class="ev">
      <div class="entete"><h1>📝 ${echapper(session.titre)}</h1><span class="note" id="compte"></span>
        <span class="ex-zoom-btns" title="Taille de la feuille"><button class="btn petit" id="zoom-moins" title="Rapetisser la feuille">🔍−</button><button class="btn petit" id="zoom-plus" title="Agrandir la feuille">🔍+</button></span>
        ${finChrono() ? '<span class="chrono" id="chrono"></span>' : ''}${src && src.retour ? '<button class="btn" id="retour-entr">← Entraînement</button>' : ''}<button class="btn ${travail ? 'principal' : ''}" id="terminer">${src && src.libelleTerminer ? src.libelleTerminer : travail ? '📤 Rendre mon travail…' : 'Terminer l’évaluation…'}</button></div>
      ${avecRetours ? `<div class="ex-retour-bandeau">🔁 <b>Ton professeur t’a rendu ton travail</b> : retravaille les questions en <b style="color:#b45309">orange</b> (à compléter) et en <b style="color:#b91c1c">rouge</b> (faux) — clique dessus pour lire sa remarque. Puis rends-le de nouveau.${src.retourGeneral ? `<div class="ex-retour-general">💬 ${echapper(src.retourGeneral).replace(/\n/g, '<br>')}</div>` : ''}</div>` : ''}
      <div class="ex-consigne">👆 Clique sur une question de la feuille : elle s'ouvre à droite pour écrire ta réponse, et la feuille reste visible pour relire l'énoncé.${barreOutils()}</div>
      <div class="ex-travail" id="travail"><div class="ex-feuille" id="feuille"></div><aside class="ex-panneau" id="panneau" hidden></aside></div></div>`;
    document.getElementById('terminer').addEventListener('click', confirmation);
    document.getElementById('retour-entr')?.addEventListener('click', async () => { clearInterval(minuterie); await enregistrer(true); src.retour(); });
    document.getElementById('zoom-moins').addEventListener('click', () => changerZoom(-0.2));
    document.getElementById('zoom-plus').addEventListener('click', () => changerZoom(0.2));
    brancherOutils(app);
    chrono();
    await dessinerFeuille();
  }
  async function dessinerFeuille() {
    const zf = document.getElementById('feuille');
    zf.classList.toggle('zoomee', zoomFeuille > 1);
    pages = await afficherPages(pdf, zf, 900, zoomFeuille);
    dessinerZones();
  }
  async function changerZoom(d) {
    zoomFeuille = Math.min(2.2, Math.max(0.6, Math.round((zoomFeuille + d) * 10) / 10));
    const zf = document.getElementById('feuille'), haut = zf.scrollTop / Math.max(1, zf.scrollHeight);
    await dessinerFeuille();
    zf.scrollTop = haut * zf.scrollHeight;
  }
  function dessinerZones() {
    pages.forEach((p) => { p.calque.innerHTML = ''; });
    zones.forEach((z, i) => {
      const p = pages[z.page - 1]; if (!p) return;
      const b = document.createElement('button');
      const rq = retours[i];
      b.className = `ex-zone ${rq && rq.v ? 'retour ' + rq.v : valides.has(i) ? 'valide' : repondu(i) ? 'repondu' : ''} ${courante === i ? 'active' : ''}`;
      b.title = `${z.nom} — clique pour répondre`;
      b.innerHTML = `<span class="ex-num">${rq && rq.v ? VERDICTS_TRAVAIL[rq.v][0] + ' ' : valides.has(i) ? '✓ ' : ''}${i + 1}</span>`;
      placer(b, z);
      b.addEventListener('click', () => ouvrirQuestion(i));
      p.calque.append(b);
      reponseSurFeuille(pages, z, reponses[i], { onClick: () => ouvrirQuestion(i) });
    });
    const c = document.getElementById('compte'); if (c) c.textContent = `${valides.size} / ${zones.length} validée(s)`;
  }

  // ---------- Loupe : une question agrandie avec sa zone de réponse ----------
  let mode = 'maths', degres = true, repCalc = 0;
  async function ouvrirQuestion(i) {
    const fond = document.getElementById('panneau'); if (!fond) return;
    const z = zones[i], type = typeDe(z);
    courante = i;
    fond.hidden = false; document.getElementById('travail').classList.add('avec-panneau');
    const editeurLignes = `<div class="ex-lignes" id="lignes"></div>
          <div class="saisie-brouillon">
            <div class="modes"><button type="button" data-mode="maths" class="${mode === 'maths' ? 'actif' : ''}" title="Écrire un calcul, une équation">∑ Maths</button><button type="button" data-mode="texte" class="${mode === 'texte' ? 'actif' : ''}" title="Écrire une phrase">Abc Texte</button></div>
            <div class="apercu-maths" id="apercu"></div>
            <div class="note-ligne"><input id="saisie-ligne" class="champ-maths" type="text" autocomplete="off" spellcheck="${mode === 'texte'}"><button class="btn principal" id="ajouter" title="Ajouter cette ligne (Entrée)">＋ Ajouter</button></div>
            ${paletteHtml()}
          </div>`;
    const titreRep = { arbre: '🌳 Complète l’arbre <small>(événements sur les nœuds, probabilités sur les branches)</small>', lignes: '✏️ Ma réponse <small>(une ligne par étape)</small>', valeurs: '🔢 Complète le tableau <small>(Tab ou Entrée : case suivante)</small>', variations: avecVariations(z.tab || {}) ? '📈 Complète le tableau de variations <small>(clique entre deux valeurs pour la flèche)</small>' : '📈 Complète le tableau de signes <small>(clique entre deux valeurs pour le signe)</small>' }[type];
    fond.innerHTML = `<div class="ex-loupe" role="dialog" aria-label="Question ${i + 1}">
      <div class="ex-loupe-tete"><b>Question ${i + 1}</b><span class="aide" style="margin:0">${echapper(z.nom)}</span><span class="espace"></span>
        ${outils.map((id) => `<button class="btn petit" data-outil="${id}" title="Ouvrir à côté">${OUTILS[id]}</button>`).join('')}
        <button class="btn" id="l-prec" ${i === 0 ? 'disabled' : ''}>←</button><button class="btn" id="l-suiv" ${i === zones.length - 1 ? 'disabled' : ''}>→</button><button class="btn" id="l-fermer" title="Revenir à la feuille">✕ Fermer</button></div>
      <div class="ex-loupe-corps">
        ${retours[i] ? `<div class="ex-remarque ${retours[i].v || ''}"><b>${retours[i].v ? VERDICTS_TRAVAIL[retours[i].v].join(' ') : '💬 Remarque'}</b>${retours[i].c ? ` — ${echapper(retours[i].c).replace(/\n/g, '<br>')}` : ''}</div>` : ''}
        <div class="ex-extrait" id="extrait"><p class="aide">Agrandissement…</p></div>
        <div class="ex-reponse">
          <div class="col-titre">${titreRep}</div>
          ${type === 'lignes' ? editeurLignes : '<div id="tableau"></div>'}
          ${type === 'variations' ? '<div class="ex-var-apercu" id="var-apercu"></div>' : ''}
          ${session.calculatrice ? `<details class="ex-calc"><summary>🧮 Calculatrice</summary><div class="calc">
            <div class="ecran"><div class="saisie-rendu" id="calc-rendu"></div><input id="saisie" type="text" autocomplete="off" spellcheck="false" placeholder="Tape un calcul, ex. 2,5 × (3 + 4)²"><div id="resultat" aria-live="polite"></div></div>
            <div class="options"><span>Angles :</span><span class="bascule"><button id="mode-deg" class="${degres ? 'actif' : ''}">Degrés</button><button id="mode-rad" class="${degres ? '' : 'actif'}">Radians</button></span></div>
            <div class="touches" id="touches">${M.TOUCHES}</div>
            ${type === 'lignes' ? '<button class="btn" id="vers-reponse" disabled>↳ Ajouter ce calcul à ma réponse</button>' : ''}</div></details>` : ''}
        </div>
      </div>
      <div class="ex-loupe-pied"><span class="aide" id="etat-q" style="margin:0;flex:1"></span><button class="btn principal grand" id="valider">✔ Valider cette question</button></div>
    </div>`;
    dessinerZones(); // la question ouverte est mise en valeur sur la feuille (qui a rétréci)
    document.querySelector(`.ex-zone.active`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    fond.scrollTop = 0;
    brancherOutils(fond);
    const modifie = () => { valides.delete(i); majEtat(); dessinerZones(); enregistrer(); };
    function majEtat() {
      fond.querySelector('#etat-q').textContent = valides.has(i) ? '✔ Question validée — tu peux encore la modifier.' : repondu(i) ? 'Relis ta réponse, puis valide.' : 'Réponds, puis valide.';
      fond.querySelector('#valider').disabled = !repondu(i);
      fond.querySelector('#valider').textContent = valides.has(i) ? 'Question suivante →' : '✔ Valider cette question';
    }
    let premierChamp = null;
    if (type === 'lignes') premierChamp = editeurDeLignes();
    else if (type === 'valeurs') premierChamp = editeurValeurs();
    else if (type === 'arbre') premierChamp = editeurArbre();
    else premierChamp = editeurVariations();

    // ----- Lignes : texte ou écriture mathématique -----
    function editeurDeLignes() {
      const saisie = fond.querySelector('#saisie-ligne'), apercu = fond.querySelector('#apercu');
      const lignes = () => { if (!Array.isArray(reponses[i])) reponses[i] = []; return reponses[i]; };
      function afficherLignes() {
        const ls = lignes();
        fond.querySelector('#lignes').innerHTML = ls.length ? ls.map((l, k) => `<div class="ex-ligne">${ligneHtml(l)}<button class="suppr" data-modif="${k}" title="Modifier cette ligne">✎</button><button class="suppr" data-suppr="${k}" title="Supprimer cette ligne">✕</button></div>`).join('')
          : '<p class="aide" style="margin:4px 0">Ta réponse apparaîtra ici. Écris une ligne en bas, puis appuie sur Entrée.</p>';
      }
      const apercuSaisie = () => { apercu.innerHTML = mode === 'maths' && saisie.value.trim() ? maths(saisie.value) : ''; };
      const placeholder = () => { saisie.placeholder = mode === 'maths' ? 'ex. 2x + 3 = 7   ·   x^2   ·   (a+b)/2' : 'Écris une phrase, ex. Le prix final est de 45 €.'; };
      placeholder();
      function ajouter() {
        const t = saisie.value.trim(); if (!t) return;
        lignes().push({ t: t.slice(0, 300), ...(mode === 'maths' ? { m: true } : {}) });
        saisie.value = ''; apercuSaisie(); afficherLignes(); modifie(); saisie.focus();
      }
      fond.querySelector('#ajouter').addEventListener('click', ajouter);
      saisie.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } });
      saisie.addEventListener('input', apercuSaisie);
      fond.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
        mode = b.dataset.mode; fond.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('actif', x === b));
        saisie.spellcheck = mode === 'texte'; placeholder(); apercuSaisie(); saisie.focus();
      }));
      fond.querySelectorAll('[data-palette]').forEach((b) => {
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => {
          const [t, pos] = PALETTE[+b.dataset.palette];
          if (mode !== 'maths') fond.querySelector('[data-mode="maths"]').click();
          const d = saisie.selectionStart ?? saisie.value.length, f = saisie.selectionEnd ?? saisie.value.length;
          saisie.value = saisie.value.slice(0, d) + t + saisie.value.slice(f);
          saisie.focus(); saisie.setSelectionRange(d + pos, d + pos); apercuSaisie();
        });
      });
      fond.querySelector('#lignes').addEventListener('click', (e) => {
        const s = e.target.closest('[data-suppr]'), m = e.target.closest('[data-modif]');
        if (s) { lignes().splice(+s.dataset.suppr, 1); afficherLignes(); modifie(); }
        if (m) { // la ligne revient dans la saisie pour être corrigée
          const [l] = lignes().splice(+m.dataset.modif, 1);
          mode = l.m ? 'maths' : 'texte'; fond.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('actif', x.dataset.mode === mode));
          placeholder(); saisie.value = l.t; apercuSaisie(); afficherLignes(); modifie(); saisie.focus();
        }
      });
      afficherLignes();
      fond.ajouterLigneMaths = (t) => { lignes().push({ t: t.slice(0, 300), m: true }); afficherLignes(); modifie(); };
      return saisie;
    }
    // ----- Tableau de valeurs : les cases à remplir -----
    function editeurValeurs() {
      if (!reponses[i] || Array.isArray(reponses[i])) reponses[i] = { cases: {} };
      const v = reponses[i]; v.cases = v.cases || {};
      const zt = fond.querySelector('#tableau');
      zt.innerHTML = `<div class="ex-tv-zone">${tableValeursHtml(z.tab, v, true)}</div><div class="apercu-maths" id="apercu-case"></div>`;
      const champs = [...zt.querySelectorAll('[data-case]')];
      champs.forEach((c, k) => {
        c.addEventListener('input', () => { v.cases[c.dataset.case] = c.value.trim(); fond.querySelector('#apercu-case').innerHTML = /[\/^√]/.test(c.value) ? maths(c.value) : ''; modifie(); });
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); (champs[k + 1] || champs[0]).focus(); } });
      });
      return champs[0];
    }
    // ----- Arbre de probabilités : un événement par nœud, une probabilité par branche -----
    function editeurArbre() {
      const t = z.tab;
      if (!reponses[i] || Array.isArray(reponses[i])) reponses[i] = {};
      const v = reponses[i]; v.n = v.n || {}; v.p = v.p || {};
      // l'arbre prend la largeur du panneau (« Départ » à gauche, la case de l'événement à droite des extrémités)
      const nbF = t.branches ** t.niveaux, W = Math.max(380, Math.min(640, (fond.querySelector('#tableau').clientWidth || 620) - 8)), H = Math.max(240, nbF * 62);
      const tl = { ...t, ax: Array.from({ length: t.niveaux + 1 }, (_v, k) => 0.14 + (0.68 * k) / t.niveaux), yh: 0.12, yb: 0.9 };
      const { nds, pos } = geoArbre(tl, W, H), ta = 15;
      const champ = (k, c, x, y, place) => { const g = ((t.donnes || {})[k] || {})[c];
        return g ? `<span class="ex-arbre-donne" style="left:${x}px;top:${y}px">${echapper(g)}</span>`
          : `<input class="ex-arbre-${k === 'n' ? 'ev' : 'pr'}" data-arbre="${k}|${c}" value="${echapper(v[k][c] || '')}" placeholder="${place}" style="left:${x}px;top:${y}px" autocomplete="off" spellcheck="false">`; };
      let html = '';
      for (const n of nds) {
        if (n.c === '') continue;
        const pe = placeEvenement(n, tl, pos[n.c], ta), pp = placeProba(pos[n.parent], pos[n.c], ta);
        html += champ('n', n.c, pe.ancre === 'start' ? pe.x : pe.x - 30, pe.y - 14, 'évén.') + champ('p', n.c, pp.x - 32, pp.y - 14, 'proba');
      }
      fond.querySelector('#tableau').innerHTML = `<div class="ex-arbre-zone" style="width:${W}px;height:${H}px">${svgArbre(tl, {}, W, H, { lignesSeules: true })}<span class="ex-arbre-depart" style="left:${pos[''].x - 62}px;top:${pos[''].y - 11}px">Départ</span>${html}</div>
        <div class="ex-arbre-outils"><button type="button" class="btn petit" id="arbre-barre" title="Ajoute (ou enlève) la barre au-dessus de l'événement choisi : M → M̄">M̄ Contraire</button>
        <span class="aide" style="margin:0">Écris l'événement sur chaque nœud (ex. M, puis M̄ avec le bouton) et la probabilité sur chaque branche (ex. 0,02 ou 2/100).</span></div>`;
      let dernier = null;
      fond.querySelectorAll('[data-arbre]').forEach((c) => {
        c.addEventListener('focus', () => { if (c.classList.contains('ex-arbre-ev')) dernier = c; });
        c.addEventListener('input', () => { const [k, ch] = c.dataset.arbre.split('|'); v[k][ch] = c.value.trim(); modifie(); });
      });
      const barre = fond.querySelector('#arbre-barre');
      barre.addEventListener('mousedown', (e) => e.preventDefault());
      barre.addEventListener('click', () => {
        const c = dernier || fond.querySelector('.ex-arbre-ev'); if (!c) return;
        c.value = c.value.endsWith(BARRE) ? c.value.slice(0, -1) : c.value + BARRE;
        c.dispatchEvent(new Event('input')); c.focus();
      });
      return fond.querySelector('[data-arbre]');
    }
    // ----- Tableau de variations : valeurs, signes, flèches -----
    function editeurVariations() {
      const t = z.tab, n = t.n;
      if (!reponses[i] || Array.isArray(reponses[i])) reponses[i] = {};
      const v = reponses[i];
      for (const k of ['x', 'f', 'z']) v[k] = Array.from({ length: n }, (_x, j) => (v[k] || [])[j] || '');
      for (const k of ['s', 'fl']) v[k] = Array.from({ length: n - 1 }, (_x, j) => (v[k] || [])[j] || '');
      const zt = fond.querySelector('#tableau');
      const champ = (cle, j, donne) => (donne ? `<td class="donne">${tm(donne)}</td>` : `<td><input data-var="${cle}-${j}" value="${echapper(v[cle][j])}" autocomplete="off" spellcheck="false" aria-label="${cle === 'x' ? 'x' : cle === 'f' ? 'Valeur de ' + t.fn : 'Signe'} n° ${j + 1}"></td>`);
      function dessiner() {
        const ti = titres(t), vr = avecVariations(t);
        zt.innerHTML = `<table class="ex-var-edit">
          <tr><th>${echapper(ti.x)}</th>${Array.from({ length: n }, (_x, j) => champ('x', j, (t.x || [])[j]) + (j < n - 1 ? '<td class="entre"></td>' : '')).join('')}</tr>
          ${t.signe ? `<tr><th>${echapper(ti.s)}</th>${Array.from({ length: n }, (_x, j) => champ('z', j) + (j < n - 1 ? `<td class="entre"><button class="ex-signe" data-sg="${j}" title="Signe : clique pour changer">${v.s[j] || '·'}</button></td>` : '')).join('')}</tr>` : ''}
          ${vr ? `<tr class="ligne-f"><th>${echapper(ti.f)}</th>${Array.from({ length: n }, (_x, j) => { const p = positionVar(v.fl, j, n); return `<td class="pos-${p}"><input data-var="f-${j}" value="${echapper(v.f[j])}" autocomplete="off" spellcheck="false" aria-label="Valeur de ${echapper(t.fn)} n° ${j + 1}"></td>` + (j < n - 1 ? `<td class="entre"><button class="ex-fleche ${v.fl[j]}" data-fl="${j}" title="Flèche : clique pour changer (monte, descend, constante)">${FLECHES[v.fl[j]]}</button></td>` : ''); }).join('')}</tr>` : ''}
        </table>
        <p class="aide" style="margin:6px 0 0">${vr ? 'Clique sur <b>·</b> entre deux valeurs pour choisir la flèche : ↗ croissante, ↘ décroissante, → constante. ' : ''}${t.signe ? 'Clique sur <b>·</b> entre deux valeurs pour le signe (+ ou −) ; écris 0 sous une valeur de x si besoin. ' : ''}${vr ? 'Les valeurs se placent en haut ou en bas toutes seules.' : ''}</p>`;
        fond.querySelector('#var-apercu').innerHTML = svgVariations(t, v);
        zt.querySelectorAll('[data-var]').forEach((c) => c.addEventListener('input', () => { const [cle, j] = c.dataset.var.split('-'); v[cle][+j] = c.value.trim(); fond.querySelector('#var-apercu').innerHTML = svgVariations(t, v); modifie(); }));
        zt.querySelectorAll('[data-fl]').forEach((b) => b.addEventListener('click', () => { const j = +b.dataset.fl, ordre = ['', 'h', 'b', 'c']; v.fl[j] = ordre[(ordre.indexOf(v.fl[j]) + 1) % 4]; dessiner(); modifie(); }));
        zt.querySelectorAll('[data-sg]').forEach((b) => b.addEventListener('click', () => { const j = +b.dataset.sg, ordre = ['', '+', '−']; v.s[j] = ordre[(ordre.indexOf(v.s[j]) + 1) % 3]; dessiner(); modifie(); }));
      }
      dessiner();
      return zt.querySelector('input');
    }

    // calculatrice : « = » calcule ; pour une réponse rédigée, le calcul peut être ajouté à la réponse
    const calc = fond.querySelector('#saisie');
    if (calc) {
      const res = fond.querySelector('#resultat'); let dernier = null;
      const apercuCalc = () => {
        fond.querySelector('#calc-rendu').innerHTML = calc.value.trim() ? maths(calc.value) : '';
        res.className = ''; if (!calc.value.trim()) { res.textContent = ''; return; }
        try { res.textContent = '= ' + M.formater(M.evaluer(calc.value, { degres, rep: repCalc })); res.style.opacity = '.55'; } catch { res.textContent = ''; }
      };
      const calculer = () => {
        const t = calc.value.trim(); if (!t) return;
        try {
          const v = M.evaluer(t, { degres, rep: repCalc }); repCalc = v;
          dernier = { expr: t, res: M.formater(v) };
          res.style.opacity = '1'; res.className = ''; res.textContent = '= ' + dernier.res;
          calculs.push({ q: i, expr: t, res: dernier.res, t: new Date().toISOString() }); enregistrer();
          const vr = fond.querySelector('#vers-reponse'); if (vr) vr.disabled = false;
          calc.value = ''; fond.querySelector('#calc-rendu').innerHTML = '';
        } catch (err) { res.style.opacity = '1'; res.className = 'erreur'; res.textContent = err.message; }
      };
      const touches = fond.querySelector('#touches');
      touches.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
      touches.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.i) { const d = calc.selectionStart ?? calc.value.length, f = calc.selectionEnd ?? calc.value.length; calc.value = calc.value.slice(0, d) + b.dataset.i + calc.value.slice(f); calc.focus(); calc.setSelectionRange(d + b.dataset.i.length, d + b.dataset.i.length); apercuCalc(); }
        else if (b.dataset.a === 'egal') calculer();
        else if (b.dataset.a === 'tout') { calc.value = ''; res.textContent = ''; calc.focus(); }
        else if (b.dataset.a === 'retour') { calc.value = calc.value.slice(0, -1); apercuCalc(); calc.focus(); }
      });
      calc.addEventListener('input', apercuCalc);
      calc.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calculer(); } else if (e.key === 'Escape') { e.stopPropagation(); calc.value = ''; res.textContent = ''; } });
      const modeAngle = (deg) => { degres = deg; fond.querySelector('#mode-deg').classList.toggle('actif', deg); fond.querySelector('#mode-rad').classList.toggle('actif', !deg); apercuCalc(); };
      fond.querySelector('#mode-deg').addEventListener('click', () => modeAngle(true));
      fond.querySelector('#mode-rad').addEventListener('click', () => modeAngle(false));
      fond.querySelector('#vers-reponse')?.addEventListener('click', () => { if (dernier && fond.ajouterLigneMaths) fond.ajouterLigneMaths(`${dernier.expr} = ${dernier.res}`); });
    }
    fond.querySelector('#l-fermer').addEventListener('click', fermerLoupe);
    fond.querySelector('#l-prec').addEventListener('click', () => ouvrirQuestion(i - 1));
    fond.querySelector('#l-suiv').addEventListener('click', () => ouvrirQuestion(i + 1));
    fond.querySelector('#valider').addEventListener('click', () => {
      if (!repondu(i)) return;
      valides.add(i); enregistrer(); dessinerZones();
      for (let k = 1; k <= zones.length; k++) { const j = (i + k) % zones.length; if (!valides.has(j)) { ouvrirQuestion(j); return; } }
      fermerLoupe(); confirmation();
    });
    document.removeEventListener('keydown', echap); document.addEventListener('keydown', echap);
    majEtat(); premierChamp?.focus();
    try {
      const largeur = Math.min(1000, fond.querySelector('#extrait').clientWidth - 8);
      const cv = await rendreZone(pdf, z, largeur);
      const ex = fond.querySelector('#extrait'); if (ex) { ex.innerHTML = ''; ex.append(cv); }
    } catch (e) { const ex = fond.querySelector('#extrait'); if (ex) ex.innerHTML = `<p class="erreur">${echapper(e.message)}</p>`; }
  }
  function echap(e) { if (e.key === 'Escape') fermerLoupe(); }
  function fermerLoupe() {
    document.removeEventListener('keydown', echap);
    const p = document.getElementById('panneau'); if (!p || p.hidden) return;
    p.hidden = true; p.innerHTML = ''; courante = null;
    document.getElementById('travail')?.classList.remove('avec-panneau');
    dessinerZones();
  }

  // ---------- Confirmation, puis copie rendue ----------
  function confirmation() {
    fermerLoupe();
    const etatQ = (i) => (valides.has(i) ? ['valide', '✔ Validée'] : repondu(i) ? ['nonvalide', '⚠ Réponse non validée'] : ['vide', '✘ Sans réponse']);
    const manquantes = zones.filter((_z, i) => !valides.has(i)).length;
    app.innerHTML = `<div class="ev"><div class="entete"><h1>📝 ${echapper(session.titre)}</h1>${finChrono() ? '<span class="chrono" id="chrono"></span>' : ''}</div>
      <div class="zone-question"><div class="carte confirmation">
        <h2>${manquantes ? 'Tu n’as pas validé toutes les questions' : '🎉 Tu as répondu à toutes les questions'}</h2>
        <p class="aide">${manquantes ? `${manquantes} question(s) ne sont pas validées : tu peux y revenir, ou terminer quand même (ce que tu as écrit compte).` : (travail ? 'Relis-toi une dernière fois si tu veux, puis rends ton travail.' : 'Relis-toi une dernière fois si tu veux, puis confirme que ton évaluation est terminée.')}</p>
        <div class="liste-confirmation">${zones.map((z, i) => { const [c, t] = etatQ(i); return `<button class="ligne-conf ${c}" data-revoir="${i}"><b>${i + 1}. ${echapper(z.nom)}</b><span>${t}</span></button>`; }).join('')}</div>
        <div class="rangee-conf"><button class="btn" id="revoir">← Revenir à la feuille</button><button class="btn principal grand" id="confirmer">${src && src.libelleConfirmer ? src.libelleConfirmer : travail ? '📤 Rendre mon travail' : '✔ Confirmer : mon évaluation est terminée'}</button></div>
      </div></div></div>`;
    chrono();
    app.querySelectorAll('[data-revoir]').forEach((b) => b.addEventListener('click', async () => { await feuille(); ouvrirQuestion(+b.dataset.revoir); }));
    document.getElementById('revoir').addEventListener('click', feuille);
    document.getElementById('confirmer').addEventListener('click', rendre);
  }
  async function rendre() {
    if (fini) return;
    fini = true; clearInterval(minuterie); fermerLoupe();
    await enregistrer(true);
    if (src) { src.apresRendu(); return; }
    ecran('✅', 'Copie rendue', 'Ton professeur va la corriger : tu retrouveras ta correction dans « 📝 Mes évaluations ».');
    if (window.parent && window.parent.finEvaluationEleve) window.parent.finEvaluationEleve();
  }
  window.evaluation = { etat: () => ({ reponses, valides: [...valides], fini, zones }), ouvrirQuestion, confirmation }; // pour les tests
  const premiere = zones.findIndex((_z, i) => !valides.has(i));
  await feuille();
  if (premiere < 0 && zones.length) confirmation();
}

// =====================================================================================
// Élève : la correction de l'enseignant
// =====================================================================================
async function correction(c, { sid, retour, octets, entete, bandeau, verdicts = VERDICTS } = {}) {
  ecran('⏳', entete || 'Correction', 'Chargement de la feuille…');
  const zones = c.zones || [], notes = c.notes || {}, reps = c.reponses || {};
  const compte = { juste: 0, partiel: 0, faux: 0 };
  zones.forEach((_z, i) => { const v = notes[i] && notes[i].v; if (compte[v] !== undefined) compte[v]++; });
  app.innerHTML = `<div class="principal-zone" style="height:100vh">
    <div class="entete"><h1>${entete ? echapper(entete) : '📝 Correction — ' + echapper(c.titre)}</h1>${retour ? '<button class="btn" id="retour-liste">← Mes évaluations</button>' : ''}</div>
    ${bandeau ? `<div class="ex-consigne">${bandeau}</div>` : ''}
    <div class="ex-correction">
      <div class="ex-feuille" id="feuille"><p class="aide">Chargement de la feuille…</p></div>
      <div class="ex-cote">
        ${entete ? '' : `<p class="bilan">${compte.juste} juste${compte.juste > 1 ? 's' : ''} · ${compte.partiel} en partie · ${compte.faux} fausse${compte.faux > 1 ? 's' : ''} sur ${zones.length}</p>`}
        ${c.general ? `<div class="ex-general"><div class="col-titre">💬 Le mot de ton professeur</div>${echapper(c.general).replace(/\n/g, '<br>')}</div>` : ''}
        ${zones.map((z, i) => { const n = notes[i] || {}, v = verdicts[n.v];
          return `<div class="correction-ligne ex-carte ${n.v || ''}" id="q${i}"><div class="tete">${v ? v[0] : '•'} Question ${i + 1} · <span class="notion">${echapper(z.nom)}</span>${v ? ` <span class="ex-badge ${n.v}">${v[1]}</span>` : ''}</div>
            <div class="col-titre">Ta réponse</div>${repHtml(z, reps[i])}
            ${n.c ? `<div class="col-titre">💬 Commentaire</div><div class="ex-comm">${echapper(n.c).replace(/\n/g, '<br>')}</div>` : ''}</div>`; }).join('')}
      </div>
    </div></div>`;
  document.getElementById('retour-liste')?.addEventListener('click', retour);
  const r = octets ? { ok: true, octets } : await api.pdfSujet(sid);
  const zoneF = document.getElementById('feuille');
  if (!r.ok) { zoneF.innerHTML = `<p class="aide">${echapper(r.message)}</p>`; return; }
  const pages = await afficherPages(await ouvrirPdf(r.octets), zoneF, 720);
  zones.forEach((z, i) => {
    const p = pages[z.page - 1]; if (!p) return;
    const n = notes[i] || {};
    const b = document.createElement('button'); b.className = `ex-zone corr ${n.v || ''}`; placer(b, z);
    b.innerHTML = `<span class="ex-num">${verdicts[n.v] ? verdicts[n.v][0] + ' ' : ''}${i + 1}</span>`;
    const voir = () => { const q = document.getElementById('q' + i); q.scrollIntoView({ behavior: 'smooth', block: 'center' }); q.classList.add('flash'); setTimeout(() => q.classList.remove('flash'), 1200); };
    b.addEventListener('click', voir);
    p.calque.append(b);
    reponseSurFeuille(pages, z, reps[i], { onClick: voir });
  });
}

// =====================================================================================
// Enseignant : placer les questions (et leurs zones de réponse) sur le PDF
// =====================================================================================
const configParDefaut = (type) => (type === 'arbre' ? { niveaux: 2, branches: 2, ax: axesParDefaut(2), yh: 0.06, yb: 0.94, donnes: { n: {}, p: {} }, imprime: true } : type === 'valeurs' ? { l: 2, c: 6, d: [['x'], ['f(x)']], imprime: true, g: 0.2 } : type === 'variations' ? { n: 3, signe: false, var: true, fn: 'f', x: [], lig: { x: 'x', s: 'f′(x)', f: 'f(x)' }, imprime: true, g: 0.2, m: 0.08 } : undefined);
// src : { charger() → { ok, titre, zones, octets }, enregistrer(zones) → { ok, zones } } (travail à rendre) ; sinon : l'évaluation evalId
async function editerZones(evalId, src = null) {
  src = src || {
    charger: async () => { const x = await api.exercice(evalId); return x.ok ? { ok: true, titre: x.evaluation.titre, zones: x.evaluation.zones, octets: x.octets } : x; },
    enregistrer: async (zs) => { const x = await api.zones(evalId, zs); return x.ok ? { ok: true, zones: x.evaluation.zones } : x; },
  };
  const r = await src.charger();
  if (!r.ok) return ecran('⚠️', 'Exercice', echapper(r.message));
  const ev = { titre: r.titre, zones: r.zones || [] };
  // référentiel de l'enseignant : compétences et objectifs, à relier aux questions
  const refR = api.referentiel ? await api.referentiel() : null;
  const REF = refR && refR.ok ? refR.referentiel : { competences: [], objectifs: [] };
  let zones = (ev.zones || []).map((z) => JSON.parse(JSON.stringify(z))), choisie = null, modifie = false;
  const CONSIGNE = 'Trace un rectangle autour de <b>chaque question, avec la place de sa réponse</b> (pointillés, tableau…). Puis, pour chaque question, choisis le <b>type de réponse</b> et clique sur <b>🔍 Placer la zone de réponse</b> : la question s’agrandit et tu traces l’endroit où la réponse de l’élève s’écrira.';
  const pdfDoc = await ouvrirPdf(r.octets);
  app.innerHTML = `<div class="ev">
    <div class="entete"><h1>📐 ${echapper(ev.titre)} — placer les questions</h1><span class="note" id="etat"></span><button class="btn principal" id="enregistrer">💾 Enregistrer</button></div>
    <div class="ex-consigne" id="consigne">${CONSIGNE}</div>
    <div class="ex-correction"><div class="ex-feuille edition" id="feuille"></div>
      <div class="ex-cote"><div class="col-titre">Questions (dans l'ordre)</div><div id="liste"></div></div></div></div>`;
  const pages = await afficherPages(pdfDoc, document.getElementById('feuille'), 820);
  const etat = () => { document.getElementById('etat').textContent = `${zones.length} question(s)${modifie ? ' · non enregistré' : ''}`; };
  const marquer = () => { modifie = true; etat(); };
  // ordre de lecture : page, puis de haut en bas ; les noms automatiques « Question n » suivent l'ordre
  const trier = () => { zones.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x); zones.forEach((z, i) => { if (!z.nom || /^Question \d+$/.test(z.nom)) z.nom = `Question ${i + 1}`; }); };
  function details(z) {
    const t = typeDe(z), tab = z.tab;
    const imprime = tab ? `<label class="case"><input type="checkbox" data-cfg="imprime" ${tab.imprime !== false ? 'checked' : ''}> Le tableau est déjà imprimé sur la feuille (la réponse se cale dessus)</label>` : '';
    let config = '';
    if (t === 'valeurs') config = `${imprime}<div class="ex-config"><label>Lignes <input type="number" min="1" max="8" value="${tab.l}" data-cfg="l"></label><label>Colonnes <input type="number" min="1" max="15" value="${tab.c}" data-cfg="c"></label></div>
      <p class="aide" style="margin:4px 0">Écris les cases <b>données</b> (en-têtes, valeurs de x…) ; les cases laissées vides seront remplies par l’élève.</p>
      <div class="ex-grille-prof"><table>${Array.from({ length: tab.l }, (_r, ri) => `<tr>${Array.from({ length: tab.c }, (_c, ci) => `<td><input data-d="${ri}-${ci}" value="${echapper(((tab.d || [])[ri] || [])[ci] || '')}"></td>`).join('')}</tr>`).join('')}</table></div>`;
    if (t === 'arbre') config = `${imprime.replace('Le tableau est déjà imprimé', 'L’arbre est déjà dessiné')}<div class="ex-config"><label>Niveaux <input type="number" min="1" max="3" value="${tab.niveaux}" data-cfg="niveaux"></label><label>Branches par nœud <input type="number" min="2" max="3" value="${tab.branches}" data-cfg="branches"></label></div>
      <p class="aide" style="margin:4px 0">Déjà écrit sur la feuille ou donné à l’élève (facultatif — vide : l’élève l’écrit) :</p>
      <div class="ex-arbre-donnes">${noeudsArbre(tab).filter((n) => n.c).map((n) => `<div style="padding-left:${(n.prof - 1) * 16}px"><span>${'↳'} ${n.c.split('-').map((x) => +x + 1).join('.')}</span><input data-dn="${n.c}" value="${echapper(((tab.donnes || {}).n || {})[n.c] || '')}" placeholder="événement" maxlength="20"><input data-dp="${n.c}" value="${echapper(((tab.donnes || {}).p || {})[n.c] || '')}" placeholder="probabilité" maxlength="20"></div>`).join('')}</div>`;
    if (t === 'variations') { const ti = titres(tab); config = `${imprime}<div class="ex-config"><label>Valeurs de x <input type="number" min="2" max="7" value="${tab.n}" data-cfg="n"></label></div>
      <label>Modèle <select data-cfg="modele">
        <option value="var" ${!tab.signe ? 'selected' : ''}>📈 Variations seules (croissance / décroissance)</option>
        <option value="deriv" ${tab.signe && avecVariations(tab) ? 'selected' : ''}>📈 Signe de la dérivée ${echapper(tab.fn || 'f')}′(x) + variations</option>
        <option value="signes" ${tab.signe && !avecVariations(tab) ? 'selected' : ''}>± Tableau de signes seul</option></select></label>
      <div class="ex-config">Titres des lignes : <input data-lig="x" value="${echapper(ti.x)}" style="width:60px">${tab.signe ? `<input data-lig="s" value="${echapper(ti.s)}" style="width:110px">` : ''}${avecVariations(tab) ? `<input data-lig="f" value="${echapper(ti.f)}" style="width:80px">` : ''}</div>
      <p class="aide" style="margin:4px 0">Valeurs de x déjà écrites sur la feuille (vide : l’élève l’écrit) :</p>
      <div class="ex-config">${Array.from({ length: tab.n }, (_x, k) => `<input data-x="${k}" value="${echapper((tab.x || [])[k] || '')}" style="width:62px" placeholder="x${k + 1}">`).join('')}</div>`; }
    const etq = `<div class="ex-config ex-etiquettes"><label>🎯 Compétence <select data-etq="competence"><option value="">—</option>${REF.competences.map((c) => `<option value="${c.id}" ${z.competence === c.id ? 'selected' : ''}>${echapper(c.nom)}</option>`).join('')}</select></label>
      <label>🏁 Objectif <select data-etq="objectif"><option value="">—</option>${REF.objectifs.map((o) => `<option value="${o.id}" ${z.objectif === o.id ? 'selected' : ''}>${echapper((o.sequence ? o.sequence + ' · ' : '') + o.nom)}</option>`).join('')}</select></label>
      <label>Points <input type="number" min="0.25" max="50" step="0.25" data-etq="points" value="${z.points || ''}" placeholder="1" style="width:64px"></label></div>
      ${REF.objectifs.length ? '' : '<p class="aide" style="margin:0">Pour relier un objectif : écris tes objectifs dans Labo Prof › classe › 📊 Notes › 📚 Référentiel.</p>'}`;
    const corr = src.avecCorrection ? `<label>✅ Correction de la question <span class="aide" style="margin:0">(montrée à l’élève après son essai — une étape par ligne)</span><textarea data-etq="correction" rows="4" placeholder="ex. f′(x) = 3x² − 12x + 9&#10;f′(x) = 0 pour x = 1 et x = 3">${echapper(z.correction || '')}</textarea></label>` : '';
    return `<div class="ex-details">
      ${corr}
      ${etq}
      <label>Type de réponse <select data-type>${Object.entries(TYPES).map(([k, nom]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${nom}</option>`).join('')}</select></label>
      ${config}
      <div class="ex-config"><b>Zone de réponse :</b> ${z.rep ? '✔ placée' : '<span class="ko">pas encore placée</span>'}</div>
      <div class="ex-config"><button class="btn principal" data-zoom-rep>🔍 ${z.rep ? 'Modifier' : 'Placer'} la zone de réponse</button>${z.rep ? '<button class="btn petit" data-effacer-rep>Effacer</button>' : ''}</div></div>`;
  }
  function dessiner() {
    pages.forEach((p) => { p.calque.innerHTML = ''; });
    zones.forEach((z, i) => {
      const p = pages[z.page - 1];
      if (p) {
        const el = document.createElement('div'); el.className = 'ex-zone edition' + (z.id === choisie ? ' choisie' : ''); el.dataset.id = z.id; placer(el, z);
        el.innerHTML = `<span class="ex-num">${i + 1}</span><span class="poignee" title="Agrandir"></span>`;
        p.calque.append(el);
      }
      if (z.rep) reponseSurFeuille(pages, z, exempleRep(z), { classe: 'edition apercu' + (z.id === choisie ? ' choisie' : '') });
    });
    document.getElementById('liste').innerHTML = zones.length ? zones.map((z, i) => `<div class="ex-item ${z.id === choisie ? 'choisie' : ''}" data-item="${z.id}"><div class="ex-item-tete"><b>${i + 1}</b><input value="${echapper(z.nom)}" data-nom="${z.id}" maxlength="40" title="Nom de la question (ex. 1a, Q2…)"><span class="aide" style="margin:0">${TYPES[typeDe(z)].split(' ')[0]}${z.rep ? ' ✔' : ''}</span><button class="suppr" data-suppr="${z.id}" title="Supprimer">✕</button></div>${z.id === choisie ? details(z) : ''}</div>`).join('')
      : '<p class="aide">Aucune question : trace un rectangle sur la feuille.</p>';
    etat();
  }
  dessiner();
  const zoneChoisie = () => zones.find((x) => x.id === choisie);
  const liste = document.getElementById('liste');
  liste.addEventListener('input', (e) => {
    const z = zoneChoisie(), el = e.target;
    if (el.dataset.nom) { const y = zones.find((x) => x.id === el.dataset.nom); if (y) { y.nom = el.value; marquer(); } return; }
    if (!z) return;
    if (el.dataset.d) { const [ri, ci] = el.dataset.d.split('-').map(Number); z.tab.d = z.tab.d || []; z.tab.d[ri] = z.tab.d[ri] || []; z.tab.d[ri][ci] = el.value; marquer(); }
    if (el.dataset.dn !== undefined || el.dataset.dp !== undefined) { const k = el.dataset.dn !== undefined ? 'n' : 'p', ch = el.dataset.dn ?? el.dataset.dp; z.tab.donnes = z.tab.donnes || { n: {}, p: {} }; z.tab.donnes[k] = z.tab.donnes[k] || {}; if (el.value.trim()) z.tab.donnes[k][ch] = el.value.trim(); else delete z.tab.donnes[k][ch]; marquer(); return; }
    if (el.dataset.x !== undefined) { z.tab.x = z.tab.x || []; z.tab.x[+el.dataset.x] = el.value; marquer(); }
    if (el.dataset.lig) { z.tab.lig = { ...titres(z.tab), [el.dataset.lig]: el.value }; marquer(); }
  });
  liste.addEventListener('change', (e) => {
    const z = zoneChoisie(), el = e.target; if (!z) return;
    if (el.dataset.etq) { const v = el.value; if (v === '' || (el.dataset.etq === 'points' && !(+v > 0))) delete z[el.dataset.etq]; else z[el.dataset.etq] = el.dataset.etq === 'points' ? +v : v; marquer(); return; }
    if (el.dataset.type !== undefined) { z.type = el.value; z.tab = configParDefaut(el.value); if (!z.tab) delete z.tab; marquer(); dessiner(); }
    if (el.dataset.cfg === 'n') delete z.tab.px;
    if (['niveaux', 'branches'].includes(el.dataset.cfg)) { const [min, max] = el.dataset.cfg === 'niveaux' ? [1, 3] : [2, 3]; z.tab[el.dataset.cfg] = Math.min(max, Math.max(min, Math.round(+el.value || min))); z.tab.ax = axesParDefaut(z.tab.niveaux); z.tab.donnes = { n: {}, p: {} }; marquer(); dessiner(); return; }
    if (['l', 'c', 'n'].includes(el.dataset.cfg)) { const max = { l: 8, c: 15, n: 7 }[el.dataset.cfg], min = el.dataset.cfg === 'n' ? 2 : 1; z.tab[el.dataset.cfg] = Math.min(max, Math.max(min, Math.round(+el.value || min))); if (el.dataset.cfg === 'l') delete z.tab.h; marquer(); dessiner(); }
    if (el.dataset.cfg === 'modele') {
      const fn = z.tab.fn || 'f';
      z.tab.signe = el.value !== 'var'; z.tab.var = el.value !== 'signes';
      if (z.tab.signe) z.tab.lig = { ...titres(z.tab), s: el.value === 'deriv' ? `${fn}′(x)` : `Signe de ${fn}(x)` };
      delete z.tab.h; marquer(); dessiner();
    }
    if (el.dataset.cfg === 'imprime') { z.tab.imprime = el.checked; marquer(); dessiner(); }
  });
  liste.addEventListener('click', (e) => {
    const s = e.target.closest('[data-suppr]'); if (s) { zones = zones.filter((z) => z.id !== s.dataset.suppr); trier(); choisie = null; marquer(); dessiner(); return; }
    if (e.target.closest('[data-zoom-rep]')) { zoomReponse(zoneChoisie()); return; }
    if (e.target.closest('[data-effacer-rep]')) { delete zoneChoisie().rep; marquer(); dessiner(); return; }
    const it = e.target.closest('[data-item]');
    if (it && !e.target.closest('input, select, button, .ex-details') && it.dataset.item !== choisie) { choisie = it.dataset.item; dessiner(); document.querySelector(`.ex-zone[data-id="${choisie}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && choisie && !['INPUT', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); zones = zones.filter((z) => z.id !== choisie); trier(); choisie = null; marquer(); dessiner(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); }
  });
  async function enregistrer() {
    const res = await src.enregistrer(zones);
    if (!res.ok) return message(res.message, true);
    zones = res.zones.map((z) => JSON.parse(JSON.stringify(z))); modifie = false; dessiner();
    const sansRep = zones.filter((z) => !z.rep).length;
    message(sansRep ? `Questions enregistrées · ${sansRep} sans zone de réponse (la réponse ne s’écrira pas sur la feuille).` : 'Questions enregistrées.');
  }
  document.getElementById('enregistrer').addEventListener('click', enregistrer);
  window.laboAvantFermeture = () => !modifie || confirm('Les questions ne sont pas enregistrées. Quitter quand même ?');
  // souris : tracer, choisir, déplacer, agrandir (questions et zones de réponse)
  let geste = null;
  const pos = (e, p) => { const b = p.calque.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; };
  document.getElementById('feuille').addEventListener('mousedown', (e) => {
    const calque = e.target.closest('.ex-calque'); if (!calque || e.button !== 0) return;
    e.preventDefault();
    const p = pages[+calque.dataset.page - 1], depart = pos(e, p);
    const elZ = e.target.closest('.ex-zone');
    if (elZ) {
      const z = zones.find((x) => x.id === elZ.dataset.id);
      if (choisie !== z.id) { choisie = z.id; dessiner(); }
      geste = { type: e.target.classList.contains('poignee') ? 'taille' : 'deplacer', obj: z, el: `.ex-zone[data-id="${z.id}"]`, depart, o: { ...z }, p };
      return;
    }
    choisie = null; dessiner();
    const rect = document.createElement('div'); rect.className = 'ex-trace'; calque.append(rect);
    geste = { type: 'tracer', depart, p, rect };
  });
  document.addEventListener('mousemove', (e) => {
    if (!geste) return;
    const m = pos(e, geste.p);
    if (geste.type === 'tracer') { Object.assign(geste.rect.style, { left: Math.min(m.x, geste.depart.x) * 100 + '%', top: Math.min(m.y, geste.depart.y) * 100 + '%', width: Math.abs(m.x - geste.depart.x) * 100 + '%', height: Math.abs(m.y - geste.depart.y) * 100 + '%' }); return; }
    const z = geste.obj, o = geste.o;
    if (geste.type === 'deplacer') { z.x = Math.min(1 - z.l, Math.max(0, o.x + m.x - geste.depart.x)); z.y = Math.min(1 - z.h, Math.max(0, o.y + m.y - geste.depart.y)); }
    else { z.l = Math.max(0.03, Math.min(1 - z.x, o.l + m.x - geste.depart.x)); z.h = Math.max(0.015, Math.min(1 - z.y, o.h + m.y - geste.depart.y)); }
    const el = document.querySelector(geste.el); if (el) placer(el, z);
    geste.bouge = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (!geste) return;
    const g = geste; geste = null;
    if (g.type === 'tracer') {
      const m = pos(e, g.p); g.rect.remove();
      const l = Math.abs(m.x - g.depart.x), h = Math.abs(m.y - g.depart.y);
      if (l < 0.03 || h < 0.015) return; // simple clic : rien
      const rect = { page: g.p.numero, x: Math.min(m.x, g.depart.x), y: Math.min(m.y, g.depart.y), l, h };
      const z = { id: 'z' + Math.random().toString(36).slice(2, 10), ...rect, nom: '', type: 'lignes' };
      zones.push(z); trier();
      choisie = z.id; marquer(); dessiner();
      document.querySelector(`[data-nom="${z.id}"]`)?.select();
    } else if (g.bouge) {
      const z = g.obj;
      if (z.rep) { // la zone de réponse suit sa question quand on la déplace
        const dx = z.x - g.o.x, dy = z.y - g.o.y;
        if (g.type === 'deplacer') { z.rep.x = Math.min(1 - z.rep.l, Math.max(0, z.rep.x + dx)); z.rep.y = Math.min(1 - z.rep.h, Math.max(0, z.rep.y + dy)); }
      }
      trier(); marquer(); dessiner();
    }
  });

  // ---------- Zoom sur une question : tracer la zone de réponse, caler le tableau, voir l'aperçu ----------
  async function zoomReponse(z) {
    if (!z) return;
    const fond = document.createElement('div'); fond.className = 'ex-loupe-fond'; fond.id = 'zoom-rep';
    const cale = () => estCale(z);
    fond.innerHTML = `<div class="ex-loupe" role="dialog" aria-label="Zone de réponse">
      <div class="ex-loupe-tete"><b>🔍 Question ${zones.indexOf(z) + 1}</b><span class="aide" style="margin:0">${echapper(z.nom)} · ${TYPES[typeDe(z)]}</span><span class="espace"></span><button class="btn" id="z-effacer">Effacer la zone</button><button class="btn principal" id="z-ok">✔ Terminé</button></div>
      <div class="ex-consigne" id="z-consigne"></div>
      <div class="ex-loupe-corps"><div class="ex-zoom" id="z-zone"><p class="aide">Agrandissement…</p></div>
        <div class="ex-config" id="z-reglages"></div></div></div>`;
    document.body.append(fond);
    const zone = fond.querySelector('#z-zone');
    const cv = await rendreZone(pdfDoc, z, Math.min(1150, zone.clientWidth - 10));
    zone.innerHTML = '';
    const boite = document.createElement('div'); boite.className = 'ex-zoom-boite';
    const calque = document.createElement('div'); calque.className = 'ex-zoom-calque'; calque.dataset.ptw = cv.dataset.ptw;
    boite.append(cv, calque); zone.append(boite);
    // zone de réponse en fractions de la question (0..1)
    const versLocal = (r) => ({ x: (r.x - z.x) / z.l, y: (r.y - z.y) / z.h, l: r.l / z.l, h: r.h / z.h });
    const versPage = (q) => ({ page: z.page, x: z.x + q.x * z.l, y: z.y + q.y * z.h, l: q.l * z.l, h: q.h * z.h });
    let loc = z.rep && z.rep.page === z.page ? versLocal(z.rep) : null;
    const lignesDuTab = () => (z.tab ? lignesTab(z.tab, typeDe(z)) : []);
    function consigneZoom() {
      fond.querySelector('#z-consigne').innerHTML = !loc ? '✏️ Trace un rectangle à l’endroit où la réponse de l’élève doit s’écrire (les pointillés, ou <b>exactement les bords du tableau imprimé</b>).'
        : estArbre(z) ? '↔ Fais glisser les <b>traits orange</b> sur chaque colonne de l’arbre imprimé (départ, nœuds, extrémités) et les <b>traits rouges</b> sur la première et la dernière extrémité. L’<b>aperçu en bleu</b> montre où s’écriront les événements et les probabilités.'
        : cale() ? '↔ Fais glisser les <b>traits rouges</b> sur les traits du tableau imprimé (colonne des titres, séparations des lignes)' + (typeDe(z) === 'variations' ? ', et les <b>traits orange</b> là où chaque valeur de x doit s’écrire' : '') + '. L’<b>aperçu en bleu</b> montre où s’écriront les réponses.'
          : 'L’<b>aperçu en bleu</b> montre comment la réponse de l’élève s’écrira (elle rétrécit pour tenir dans la zone). Tu peux déplacer la zone ou l’agrandir avec le coin.';
      const t = z.tab;
      fond.querySelector('#z-reglages').innerHTML = loc && cale() && typeDe(z) === 'variations'
        ? `<span class="aide" style="margin:0">Les <b style="color:#d97706">traits orange</b> placent chaque valeur de x (fais-les glisser) — ou règle-les tous :</span><label>Écart des bords <input type="range" min="0" max="30" value="${Math.round((t.m ?? 0.08) * 100)}" id="z-marge"></label>` : '';
      fond.querySelector('#z-marge')?.addEventListener('input', (e) => { z.tab.m = +e.target.value / 100; delete z.tab.px; marquer(); dessinerZoom(); });
    }
    function dessinerZoom() {
      calque.innerHTML = '';
      if (!loc) return;
      const el = document.createElement('div'); el.className = 'ex-rep edition apercu choisie ex-zrep'; placer(el, loc);
      calque.append(el);
      z.rep = versPage(loc);
      remplirRep(el, z, exempleRep(z));
      const p = document.createElement('span'); p.className = 'poignee'; p.title = 'Agrandir'; el.append(p);
      if (estArbre(z)) { // repères de l'arbre : une colonne par niveau (orange), première et dernière extrémité (rouge)
        const t = z.tab, ax = t.ax && t.ax.length === t.niveaux + 1 ? t.ax : axesParDefaut(t.niveaux);
        ax.forEach((x, k) => { const g = document.createElement('div'); g.className = 'ex-guide p'; g.style.left = x * 100 + '%'; g.title = k === 0 ? 'Départ de l’arbre' : k === t.niveaux ? 'Extrémités de l’arbre' : `Nœuds du niveau ${k}`; g.dataset.guide = 'a' + k; el.append(g); });
        [['yh', t.yh ?? 0.06, 'Première extrémité (en haut)'], ['yb', t.yb ?? 0.94, 'Dernière extrémité (en bas)']].forEach(([k, y, titre]) => { const g = document.createElement('div'); g.className = 'ex-guide h'; g.style.top = y * 100 + '%'; g.title = titre; g.dataset.guide = k; el.append(g); });
      } else if (cale()) {
        const t = z.tab, b = bornesTab(t, lignesDuTab().length);
        if (!(typeDe(z) === 'valeurs' && t.c === 1)) { const gv = document.createElement('div'); gv.className = 'ex-guide v'; gv.style.left = (t.g ?? 0.2) * 100 + '%'; gv.title = 'Bord de la colonne des titres'; gv.dataset.guide = 'g'; el.append(gv); }
        if (typeDe(z) === 'variations') for (let k = 0; k < t.n; k++) { const gp = document.createElement('div'); gp.className = 'ex-guide p'; gp.style.left = ((t.g ?? 0.2) + (1 - (t.g ?? 0.2)) * posX(t, k)) * 100 + '%'; gp.title = `Position de la valeur de x n° ${k + 1}`; gp.dataset.guide = 'p' + k; el.append(gp); }
        b.slice(1, -1).forEach((y, k) => { const gh = document.createElement('div'); gh.className = 'ex-guide h'; gh.style.top = y * 100 + '%'; gh.title = 'Séparation des lignes'; gh.dataset.guide = 'h' + k; el.append(gh); });
      }
    }
    consigneZoom(); dessinerZoom();
    let gz = null;
    const posZ = (e) => { const b = calque.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; };
    calque.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const m = posZ(e), guide = e.target.closest('[data-guide]');
      if (guide) { gz = { type: 'guide', cle: guide.dataset.guide }; return; }
      if (e.target.classList.contains('poignee')) { gz = { type: 'taille', depart: m, o: { ...loc } }; return; }
      if (e.target.closest('.ex-zrep')) { gz = { type: 'deplacer', depart: m, o: { ...loc } }; return; }
      const t = document.createElement('div'); t.className = 'ex-trace rep'; calque.append(t);
      gz = { type: 'tracer', depart: m, el: t };
    });
    const bouger = (e) => {
      if (!gz) return;
      const m = posZ(e);
      if (gz.type === 'tracer') { Object.assign(gz.el.style, { left: Math.min(m.x, gz.depart.x) * 100 + '%', top: Math.min(m.y, gz.depart.y) * 100 + '%', width: Math.abs(m.x - gz.depart.x) * 100 + '%', height: Math.abs(m.y - gz.depart.y) * 100 + '%' }); return; }
      if (gz.type === 'guide') {
        const t = z.tab, rx = (m.x - loc.x) / loc.l, ry = (m.y - loc.y) / loc.h;
        if (estArbre(z)) {
          const c01 = (x) => Math.min(1, Math.max(0, x));
          if (gz.cle[0] === 'a') { t.ax = t.ax && t.ax.length === t.niveaux + 1 ? t.ax : axesParDefaut(t.niveaux); t.ax[+gz.cle.slice(1)] = c01(rx); }
          else if (gz.cle === 'yh') t.yh = c01(ry); else if (gz.cle === 'yb') t.yb = c01(ry);
          marquer(); dessinerZoom(); return;
        }
        if (gz.cle === 'g') t.g = Math.min(0.7, Math.max(0, rx));
        else if (gz.cle[0] === 'p') { const k = +gz.cle.slice(1), g0 = t.g ?? 0.2; t.px = Array.from({ length: t.n }, (_v, j) => posX(t, j)); t.px[k] = Math.min(1, Math.max(0, (rx - g0) / Math.max(0.05, 1 - g0))); }
        else {
          const k = +gz.cle.slice(1), b = bornesTab(t, lignesDuTab().length).slice(1, -1);
          b[k] = Math.min((b[k + 1] ?? 1) - 0.03, Math.max((b[k - 1] ?? 0) + 0.03, ry)); t.h = b;
        }
        marquer(); dessinerZoom(); return;
      }
      if (gz.type === 'deplacer') { loc.x = Math.min(1 - loc.l, Math.max(0, gz.o.x + m.x - gz.depart.x)); loc.y = Math.min(1 - loc.h, Math.max(0, gz.o.y + m.y - gz.depart.y)); }
      else { loc.l = Math.max(0.03, Math.min(1 - loc.x, gz.o.l + m.x - gz.depart.x)); loc.h = Math.max(0.03, Math.min(1 - loc.y, gz.o.h + m.y - gz.depart.y)); }
      marquer(); dessinerZoom();
    };
    const lacher = (e) => {
      if (!gz) return;
      const g = gz; gz = null;
      if (g.type === 'tracer') {
        const m = posZ(e); g.el.remove();
        const l = Math.abs(m.x - g.depart.x), h = Math.abs(m.y - g.depart.y);
        if (l < 0.02 || h < 0.02) return;
        loc = { x: Math.min(m.x, g.depart.x), y: Math.min(m.y, g.depart.y), l, h };
        marquer(); consigneZoom(); dessinerZoom();
      }
    };
    document.addEventListener('mousemove', bouger);
    document.addEventListener('mouseup', lacher);
    const fermer = () => { document.removeEventListener('mousemove', bouger); document.removeEventListener('mouseup', lacher); fond.remove(); dessiner(); };
    fond.querySelector('#z-ok').addEventListener('click', fermer);
    fond.querySelector('#z-effacer').addEventListener('click', () => { loc = null; delete z.rep; marquer(); consigneZoom(); dessinerZoom(); });
    fond.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
    window.zoomEnCours = { fond, calque, z }; // pour les tests
  }
}

// =====================================================================================
// Enseignant : corriger les copies à la main
// =====================================================================================
async function corriger(sid, eleveId) {
  let r = await api.copie(sid, eleveId);
  if (!r.ok) return ecran('⚠️', 'Copie', echapper(r.message));
  const session = r.session, zones = session.zones || [];
  app.innerHTML = `<div class="ev">
    <div class="entete"><h1>✍️ ${echapper(session.titre)}</h1>
      <button class="btn" id="e-prec" title="Copie précédente">←</button><select id="eleve" class="ex-select"></select><button class="btn" id="e-suiv" title="Copie suivante">→</button>
      <span class="note" id="etat"></span><button class="btn principal" id="rendre" title="Envoyer la correction aux élèves dont la copie est corrigée">📤 Rendre les corrections</button></div>
    <div class="ex-correction"><div class="ex-feuille" id="feuille"></div><div class="ex-cote" id="cote"></div></div></div>`;
  const pages = await afficherPages(await ouvrirPdf(r.octets), document.getElementById('feuille'), 720);
  let notes = null, delai = null;
  const etat = (t) => { document.getElementById('etat').textContent = t; };
  async function sauver() {
    clearTimeout(delai); delai = null;
    const res = await api.noter(sid, eleveId, notes);
    etat(res.ok ? '✔ Enregistré' : '⚠ ' + res.message);
  }
  const plusTard = () => { etat('…'); clearTimeout(delai); delai = setTimeout(sauver, 700); };
  function zonesFeuille() {
    const reps = (r.copie && r.copie.reponses) || {};
    pages.forEach((p) => { p.calque.innerHTML = ''; });
    zones.forEach((z, i) => {
      const p = pages[z.page - 1]; if (!p) return;
      const v = (notes.questions[i] || {}).v;
      const b = document.createElement('button'); b.className = `ex-zone corr ${v || ''}`; placer(b, z);
      b.innerHTML = `<span class="ex-num">${VERDICTS[v] ? VERDICTS[v][0] + ' ' : ''}${i + 1}</span>`;
      const voir = () => document.getElementById('q' + i)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      b.addEventListener('click', voir);
      p.calque.append(b);
      reponseSurFeuille(pages, z, reps[i], { onClick: voir });
    });
  }
  function afficher() {
    notes = { questions: { ...((r.notes && r.notes.questions) || {}) }, general: (r.notes && r.notes.general) || '' };
    const sel = document.getElementById('eleve');
    sel.innerHTML = r.eleves.map((x) => `<option value="${echapper(x.eleveId)}" ${x.eleveId === eleveId ? 'selected' : ''}>${x.note ? '✔ ' : x.commence ? '✏️ ' : '⏳ '}${echapper(x.nom)}</option>`).join('');
    const copie = r.copie, reps = (copie && copie.reponses) || {}, calculs = (copie && copie.calculs) || [];
    etat(!copie ? 'Pas de copie' : copie.fini ? (r.corrige ? 'Copie rendue · correction envoyée' : 'Copie rendue') : 'Copie en cours');
    document.getElementById('cote').innerHTML = !copie ? '<p class="aide">Cet élève n’a pas encore commencé.</p>' : `
      <div class="ex-general"><div class="col-titre">💬 Commentaire général (facultatif)</div><textarea id="general" rows="2" placeholder="ex. Bon travail, attention aux unités.">${echapper(notes.general)}</textarea></div>
      ${zones.map((z, i) => { const n = notes.questions[i] || {}; const cs = calculs.filter((x) => x.q === i && !x.note);
        return `<div class="correction-ligne ex-carte ${n.v || ''}" id="q${i}"><div class="tete">Question ${i + 1} · <span class="notion">${echapper(z.nom)}</span></div>
          ${repHtml(z, reps[i])}
          ${cs.length ? `<details class="ex-calculs"><summary>🧮 ${cs.length} calcul(s) à la calculatrice</summary>${cs.map((x) => `<div>${maths(x.expr)} = ${echapper(x.res)}</div>`).join('')}</details>` : ''}
          <div class="ex-verdicts">${Object.entries(VERDICTS).map(([k, [ic, nom]]) => `<button class="ex-v ${k} ${n.v === k ? 'actif' : ''}" data-q="${i}" data-v="${k}">${ic} ${nom}</button>`).join('')}</div>
          <textarea data-comm="${i}" rows="2" placeholder="Commentaire pour l'élève (facultatif)">${echapper(n.c || '')}</textarea></div>`; }).join('')}`;
    zonesFeuille();
    const cote = document.getElementById('cote');
    cote.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
      const i = b.dataset.q, q = (notes.questions[i] = notes.questions[i] || {});
      q.v = q.v === b.dataset.v ? undefined : b.dataset.v;
      const carte = document.getElementById('q' + i);
      carte.className = `correction-ligne ex-carte ${q.v || ''}`;
      carte.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('actif', x.dataset.v === q.v));
      zonesFeuille(); sauver();
    }));
    cote.querySelectorAll('[data-comm]').forEach((t) => t.addEventListener('input', () => { const q = (notes.questions[t.dataset.comm] = notes.questions[t.dataset.comm] || {}); q.c = t.value; plusTard(); }));
    document.getElementById('general')?.addEventListener('input', (e) => { notes.general = e.target.value; plusTard(); });
  }
  async function changer(id) {
    if (delai) await sauver();
    const n = await api.copie(sid, id);
    if (!n.ok) return message(n.message, true);
    r = n; eleveId = id; afficher();
    document.getElementById('cote').scrollTop = 0;
  }
  const decaler = (d) => { const i = r.eleves.findIndex((x) => x.eleveId === eleveId); const x = r.eleves[i + d]; if (x) changer(x.eleveId); };
  document.getElementById('eleve').addEventListener('change', (e) => changer(e.target.value));
  document.getElementById('e-prec').addEventListener('click', () => decaler(-1));
  document.getElementById('e-suiv').addEventListener('click', () => decaler(1));
  document.getElementById('rendre').addEventListener('click', async () => {
    if (delai) await sauver();
    if (!confirm('Envoyer la correction aux élèves dont la copie est corrigée ? (Tu pourras encore la modifier et la renvoyer.)')) return;
    const res = await api.rendre(sid);
    if (!res.ok) return message(res.message, true);
    message(`${res.rendues} correction(s) rendue(s)${res.aCorriger ? ` · ${res.aCorriger} copie(s) pas encore corrigée(s)` : ''}.`);
    changer(eleveId);
  });
  window.laboAvantFermeture = () => { if (delai) sauver(); return true; };
  afficher();
}

// =====================================================================================
// Travail à rendre (PDF déposé dans un thème) : mêmes questions, même feuille, mêmes réponses que l'évaluation « exercice ».
// Pas de chrono ni de mode examen ; enregistrement continu avec l'historique ; l'enseignant suit les réponses en direct.
// Les réponses sont gardées dans la copie du travail : valeurs[<id de la question>] = réponse (JSON).
// =====================================================================================
const L = () => window.parent && window.parent.labo;
const resumeRep = (v) => (!v ? '' : Array.isArray(v) ? v.map((l) => l.t).join(' / ') : (v.n || v.p) ? Object.keys({ ...(v.n || {}), ...(v.p || {}) }).sort().map((c) => `${(v.n || {})[c] || '?'} (${(v.p || {})[c] || '?'})`).join(' ; ') : v.cases ? Object.values(v.cases).filter(Boolean).join(' ; ')
  : ['x', 'z', 's', 'f'].map((k) => (v[k] || []).filter(Boolean).join(' ')).filter(Boolean).join(' | ') + ((v.fl || []).some(Boolean) ? ' ' + v.fl.map((x) => FLECHES[x] || '·').join(' ') : ''));
const lireValeur = (valeurs, k) => { try { return valeurs[k] === undefined ? undefined : JSON.parse(valeurs[k]); } catch { return undefined; } };
const reponsesDuTravail = (zones, valeurs) => { const r = {}; zones.forEach((z, i) => { const v = lireValeur(valeurs, z.id); if (v !== undefined && v !== null) r[i] = v; }); return r; };
const dateHeure = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

async function travail(mode, cl, tr) {
  if (mode === 'travail-edition') {
    return editerZones(null, {
      charger: async () => { const x = await L().prof.travailLire(cl, tr); return x.ok ? { ok: true, titre: x.travail.nom, zones: x.travail.questions, octets: x.octets } : x; },
      enregistrer: async (zs) => { const x = await L().prof.travailQuestions(cl, tr, zs); return x.ok ? { ok: true, zones: x.questions } : x; },
    });
  }
  if (mode === 'travail-suivi') return travailSuivi(cl, tr);
  // élève
  const r = await L().classes.ouvrirTravail(cl, tr);
  if (!r.ok) return ecran('⚠️', 'Travail à rendre', echapper(r.message));
  const zones = r.travail.questions || [];
  if (!zones.length) return ecran('📄', r.travail.nom, 'Ton professeur n’a pas encore placé les questions sur ce document. Reviens un peu plus tard.');
  const valeurs = { ...((r.copie && r.copie.valeurs) || {}) };
  const historique = [...((r.copie && r.copie.historique) || [])];
  // remarques de l'enseignant : par question (clé = id de la question → n° de la question)
  const ret = r.retour || null, notesRet = {};
  if (ret) zones.forEach((z, i) => { if (ret.questions && ret.questions[z.id]) notesRet[i] = ret.questions[z.id]; });
  const valide = ret && ret.statut === 'valide';
  const relire = (rendu) => correction({ titre: r.travail.nom, zones, reponses: reponsesDuTravail(zones, valeurs), notes: valide || (ret && r.copie && r.copie.rendu && Date.parse(ret.date) > Date.parse(r.copie.rendu)) ? notesRet : {}, general: valide ? ret.general : '' }, {
    octets: r.octets, entete: `📄 ${r.travail.nom}`, verdicts: VERDICTS_TRAVAIL,
    bandeau: r.lectureSeule ? `🗄 Classe clôturée (année ${echapper(r.annee || '')}) : ta copie se lit, mais ne se modifie plus.`
      : valide ? `✅ <b>Travail validé par ton professeur</b> ${dateHeure(ret.date)}.` : `✅ <b>Travail rendu</b> ${dateHeure(rendu)}. Tu ne peux plus le modifier (sauf si ton professeur te le rend pour le retravailler).`,
  });
  if ((r.copie && r.copie.rendu) || r.lectureSeule) return relire(r.copie && r.copie.rendu);
  const sauver = async ({ reponses, valides, fini }) => {
    const t = new Date().toISOString();
    zones.forEach((z, i) => {
      const nouveau = nonVide(reponses[i]) ? JSON.stringify(reponses[i]) : undefined;
      if (nouveau === valeurs[z.id]) return;
      historique.push({ t, c: z.id, a: resumeRep(lireValeur(valeurs, z.id)).slice(0, 2000), n: resumeRep(reponses[i]).slice(0, 2000) });
      if (nouveau === undefined) delete valeurs[z.id]; else valeurs[z.id] = nouveau;
    });
    valeurs.valides = JSON.stringify(valides);
    const rendu = fini ? t : null;
    const res = await L().classes.enregistrerTravail(cl, tr, { valeurs, historique, rendu });
    if (!res.ok) message(res.message, true);
    else if (rendu) r.copie = { ...(r.copie || {}), rendu };
    return res;
  };
  const valides = lireValeur(valeurs, 'valides') || [];
  const aRetravailler = ret && ret.statut === 'a-retravailler';
  return eleve({ session: { titre: r.travail.nom, dureeMin: 0, calculatrice: true, outils: [] }, questions: zones,
    copie: { reponses: reponsesDuTravail(zones, valeurs), valides: aRetravailler ? valides.filter((i) => !notesRet[i] || notesRet[i].v === 'juste') : valides, fini: false } },
  { octets: r.octets, sauver, retours: aRetravailler ? notesRet : {}, retourGeneral: aRetravailler ? ret.general : '', apresRendu: () => { message('📤 Travail rendu : ton professeur le voit.'); relire(r.copie && r.copie.rendu); } });
}

// L'enseignant suit les réponses en direct : la feuille de l'élève (réponses écrites dessus), ses réponses, l'historique.
async function travailSuivi(cl, tr) {
  const r = await L().prof.travailLire(cl, tr);
  if (!r.ok) return ecran('⚠️', 'Travail à rendre', echapper(r.message));
  const zones = r.travail.questions || [];
  app.innerHTML = `<div class="ev">
    <div class="entete"><h1>👀 ${echapper(r.travail.nom)}</h1>
      <button class="btn" id="e-prec" title="Élève précédent">←</button><select id="eleve" class="ex-select"></select><button class="btn" id="e-suiv" title="Élève suivant">→</button>
      <span class="note" id="etat"></span>
      <button class="btn" id="rendre-retravail" title="L'élève voit tes remarques, retravaille les questions concernées et te rend de nouveau son travail">🔁 Rendre pour retravailler</button>
      <button class="btn principal" id="valider-travail" title="Le travail est validé : l'élève voit tes remarques, sa copie reste fermée">✅ Valider le travail</button></div>
    <div class="ex-consigne">Les réponses s’affichent en direct (toutes les 4 secondes). Pour chaque question : <b>✔ Validé</b>, <b>◐ À compléter</b> (il manque des informations) ou <b>✘ Faux</b>, avec une remarque si tu veux. Puis <b>🔁 Rendre pour retravailler</b> : l’élève voit tes remarques sur sa feuille, corrige et te le rend de nouveau.</div>
    <div class="ex-correction"><div class="ex-feuille" id="feuille"></div><div class="ex-cote" id="cote"></div></div></div>`;
  if (!zones.length) { document.getElementById('cote').innerHTML = '<p class="aide">Les questions ne sont pas encore placées sur ce PDF : clique sur « 📐 Placer les questions ».</p>'; }
  const pages = await afficherPages(await ouvrirPdf(r.octets), document.getElementById('feuille'), 720);
  let copies = [], eleveId = null, signature = '';
  const brouillons = {}; // remarques en cours, par élève (pas encore envoyées)
  const remarquesDe = (x) => (brouillons[x.eleveId] = brouillons[x.eleveId] || JSON.parse(JSON.stringify(x.retour ? { questions: x.retour.questions || {}, general: x.retour.general || '' } : { questions: {}, general: '' })));
  const ETATS_RETOUR = { valide: '✅ validé', 'a-retravailler': '🔁 à retravailler' };
  const nom = (id) => (zones.find((z) => z.id === id) || {}).nom || '';
  function afficher() {
    const x = copies.find((c) => c.eleveId === eleveId) || copies[0]; if (!x) return;
    eleveId = x.eleveId;
    const sel = document.getElementById('eleve');
    sel.innerHTML = copies.map((c) => `<option value="${echapper(c.eleveId)}" ${c.eleveId === eleveId ? 'selected' : ''}>${c.retour && c.retour.statut === 'valide' ? '🏁 ' : c.copie ? (c.copie.rendu ? '📥 ' : c.retour ? '🔁 ' : '✏️ ') : '⏳ '}${echapper(c.nom)}</option>`).join('');
    const sig = JSON.stringify([eleveId, x.copie && x.copie.maj, x.copie && x.copie.rendu, x.retour && x.retour.date]);
    if (sig === signature) return; // rien de nouveau : on ne redessine pas (la lecture n'est pas dérangée)
    if (signature && document.activeElement && document.activeElement.closest && document.activeElement.closest('#cote') && document.activeElement.tagName === 'TEXTAREA') return; // remarque en cours de saisie
    signature = sig;
    const copie = x.copie, valeurs = (copie && copie.valeurs) || {}, reps = reponsesDuTravail(zones, valeurs);
    document.getElementById('etat').textContent = (!copie ? 'Pas commencé' : copie.rendu ? `📥 Rendu ${dateHeure(copie.rendu)}` : `✏️ En cours · ${dateHeure(copie.maj)}${copie.poste ? ' (PC ' + copie.poste + ')' : ''}`) + (x.retour ? ` · ${ETATS_RETOUR[x.retour.statut] || ''} ${dateHeure(x.retour.date)}` : '');
    const rem = remarquesDe(x);
    document.getElementById('rendre-retravail').disabled = document.getElementById('valider-travail').disabled = !copie;
    pages.forEach((p) => { p.calque.innerHTML = ''; });
    zones.forEach((z, i) => {
      const p = pages[z.page - 1]; if (!p) return;
      const v = (rem.questions[z.id] || {}).v;
      const b = document.createElement('button'); b.className = `ex-zone corr ${v || ''}`; placer(b, z);
      b.innerHTML = `<span class="ex-num">${v ? VERDICTS_TRAVAIL[v][0] + ' ' : ''}${i + 1}</span>`;
      const voir = () => document.getElementById('q' + i)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      b.addEventListener('click', voir); p.calque.append(b);
      reponseSurFeuille(pages, z, reps[i], { onClick: voir });
    });
    const h = ((copie && copie.historique) || []).slice(-80).reverse();
    document.getElementById('cote').innerHTML = !copie ? '<p class="aide">Cet élève n’a pas encore ouvert le travail.</p>' : `
      <div class="ex-general"><div class="col-titre">💬 Remarque générale (facultatif)</div><textarea id="rq-general" rows="2" placeholder="ex. Bon début : complète les justifications.">${echapper(rem.general)}</textarea></div>
      ${zones.map((z, i) => { const q = rem.questions[z.id] || {}; return `<div class="correction-ligne ex-carte ${q.v || ''}" id="q${i}"><div class="tete">Question ${i + 1} · <span class="notion">${echapper(z.nom)}</span></div>${repHtml(z, reps[i])}
        <div class="ex-verdicts">${Object.entries(VERDICTS_TRAVAIL).map(([k, [ic, nomV]]) => `<button class="ex-v ${k} ${q.v === k ? 'actif' : ''}" data-zq="${echapper(z.id)}" data-v="${k}">${ic} ${nomV}</button>`).join('')}</div>
        <textarea data-rq="${echapper(z.id)}" rows="2" placeholder="Remarque pour l'élève (ex. il manque l'unité)">${echapper(q.c || '')}</textarea></div>`; }).join('')}
      <details class="ex-historique" ${h.length ? '' : 'hidden'}><summary>🕑 Historique des modifications (${h.length})</summary><ul>${h.map((e) => (e.e === 'rouvert' ? `<li><b>${dateHeure(e.t)}</b> · 🔓 travail rouvert par le professeur</li>`
        : `<li><b>${dateHeure(e.t)}</b> · ${echapper(nom(e.c) || e.c)} : <span class="avant">${echapper(e.a || '∅')}</span> → <span class="apres">${echapper(e.n || '∅')}</span></li>`)).join('')}</ul></details>`;
  }
  // remarques : modifiées sur la page, envoyées avec « Rendre pour retravailler » ou « Valider »
  document.getElementById('cote').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zq]'); if (!b) return;
    const x = copies.find((c) => c.eleveId === eleveId); if (!x) return;
    const rem = remarquesDe(x), q = (rem.questions[b.dataset.zq] = rem.questions[b.dataset.zq] || {});
    q.v = q.v === b.dataset.v ? undefined : b.dataset.v;
    signature = ''; afficher();
  });
  document.getElementById('cote').addEventListener('input', (e) => {
    const x = copies.find((c) => c.eleveId === eleveId); if (!x) return;
    const rem = remarquesDe(x);
    if (e.target.id === 'rq-general') rem.general = e.target.value;
    if (e.target.dataset.rq) { const q = (rem.questions[e.target.dataset.rq] = rem.questions[e.target.dataset.rq] || {}); q.c = e.target.value; }
  });
  async function envoyer(rouvrir) {
    const x = copies.find((c) => c.eleveId === eleveId); if (!x || !x.copie) return;
    const rem = remarquesDe(x);
    const nb = Object.values(rem.questions).filter((q) => q.v && q.v !== 'juste').length;
    if (rouvrir && !confirm(`Rendre son travail à ${x.nom} pour qu’il le retravaille ?\n\n${nb} question(s) à revoir. Il verra tes remarques sur sa feuille, pourra corriger, puis te le rendre de nouveau.`)) return;
    if (!rouvrir && !confirm(`Valider le travail de ${x.nom} ? Il verra tes remarques ; sa copie reste fermée.`)) return;
    const res = await L().prof.travailRetour(cl, tr, eleveId, rem, rouvrir);
    if (!res.ok) return message(res.message, true);
    delete brouillons[eleveId];
    message(rouvrir ? `🔁 Travail rendu à ${x.nom} pour qu’il le retravaille.` : `✅ Travail de ${x.nom} validé.`);
    signature = ''; await actualiser();
  }
  document.getElementById('rendre-retravail').addEventListener('click', () => envoyer(true));
  document.getElementById('valider-travail').addEventListener('click', () => envoyer(false));
  async function actualiser() {
    const rc = await L().prof.travailCopies(cl, tr);
    if (!rc.ok) { document.getElementById('etat').textContent = '⚠ ' + rc.message; return; }
    copies = rc.copies;
    if (!eleveId) eleveId = (copies.find((c) => c.copie) || copies[0] || {}).eleveId;
    afficher();
  }
  const changer = (id) => { eleveId = id; signature = ''; afficher(); document.getElementById('cote').scrollTop = 0; };
  document.getElementById('eleve').addEventListener('change', (e) => changer(e.target.value));
  const decaler = (d) => { const i = copies.findIndex((c) => c.eleveId === eleveId); const x = copies[i + d]; if (x) changer(x.eleveId); };
  document.getElementById('e-prec').addEventListener('click', () => decaler(-1));
  document.getElementById('e-suiv').addEventListener('click', () => decaler(1));
  await actualiser();
  setInterval(actualiser, 4000);
}

// =====================================================================================
// Entraînement : modules d'exercices (fiche PDF + correction de l'enseignant)
// =====================================================================================
async function moduleZones(id) { // enseignant : placer les questions et écrire leur correction
  const E = api;
  return editerZones(null, {
    avecCorrection: true,
    charger: async () => { const x = await E.entrModuleExercice(id); return x.ok ? { ok: true, titre: x.module.titre, zones: x.module.zones, octets: x.octets } : x; },
    enregistrer: async (zs) => { const x = await E.entrModuleZones(id, zs); return x.ok ? { ok: true, zones: x.module.zones } : x; },
  });
}
async function module(id, retour) { // élève : chercher l'exercice, puis découvrir la correction et s'auto-évaluer
  ecran('⏳', 'Entraînement', 'Ouverture de l’exercice…');
  const r = await api.entrModule(id);
  if (!r.ok) return ecran('⚠️', 'Entraînement', echapper(r.message));
  const m = r.module, zones = m.zones || [];
  let copie = r.copie || { reponses: {}, valides: [], fini: false, auto: {} };
  const sauver = async (etat) => { const x = await api.entrModuleSauver(id, { reponses: etat.reponses, valides: etat.valides, fini: etat.fini, auto: copie.auto || {} }); if (x.ok) copie = x.copie; return x; };
  if (copie.fini) return correctionModule(m, r.octets, copie, retour);
  return eleve({ session: { titre: m.titre, dureeMin: 0, calculatrice: true, outils: [] }, questions: zones, copie: { reponses: copie.reponses || {}, valides: copie.valides || [], fini: false } },
    { octets: r.octets, sauver, retour, libelleTerminer: '✅ Voir la correction…', libelleConfirmer: '✅ J’ai fini : voir la correction', apresRendu: () => correctionModule(m, r.octets, copie, retour) });
}
async function correctionModule(m, octets, copie, retour) {
  const zones = m.zones || [], reps = copie.reponses || {}, auto = { ...(copie.auto || {}) };
  const AUTO = { juste: ['✔', 'Réussi'], partiel: ['◐', 'Presque'], faux: ['✘', 'À revoir'] };
  app.innerHTML = `<div class="ev">
    <div class="entete"><h1>✅ Correction — ${echapper(m.titre)}</h1>${m.corrige ? '<button class="btn" id="voir-corrige">📄 Corrigé complet</button>' : ''}<button class="btn" id="recommencer">🔁 Recommencer</button><button class="btn principal" id="retour-entr">← Entraînement</button></div>
    <div class="ex-consigne">Compare ta réponse avec la correction, puis dis pour chaque question si tu l’as <b>réussie</b>. Ton professeur voit ce résumé (ça ne compte pas dans tes notes).</div>
    <div class="ex-correction"><div class="ex-feuille" id="feuille"></div><div class="ex-cote">
      ${zones.map((z, i) => `<div class="correction-ligne ex-carte ${auto[i] || ''}" id="q${i}"><div class="tete">Question ${i + 1} · <span class="notion">${echapper(z.nom)}</span></div>
        <div class="deux-colonnes"><div class="col-eleve"><div class="col-titre">Ta réponse</div>${repHtml(z, reps[i])}</div>
        <div class="col-correction"><div class="col-titre">✅ Correction</div>${z.correction ? `<div class="explication">${EQ && EQ.etapesHtml ? EQ.etapesHtml(z.correction) : echapper(z.correction)}</div>` : `<p class="aide" style="margin:0">Pas de correction écrite pour cette question${m.corrige ? ' : regarde le corrigé complet' : ''}.</p>`}</div></div>
        <div class="ex-verdicts">${Object.entries(AUTO).map(([k, [ic, nom]]) => `<button class="ex-v ${k} ${auto[i] === k ? 'actif' : ''}" data-q="${i}" data-v="${k}">${ic} ${nom}</button>`).join('')}</div></div>`).join('')}
    </div></div></div>`;
  const zoneF = document.getElementById('feuille');
  let pages = await afficherPages(await ouvrirPdf(octets), zoneF, 720);
  const dessinerFeuille = () => zones.forEach((z, i) => {
    const p = pages[z.page - 1]; if (!p) return;
    const b = document.createElement('button'); b.className = `ex-zone corr ${auto[i] || ''}`; placer(b, z); b.innerHTML = `<span class="ex-num">${i + 1}</span>`;
    b.addEventListener('click', () => document.getElementById('q' + i)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    p.calque.append(b); reponseSurFeuille(pages, z, reps[i]);
  });
  dessinerFeuille();
  const enregistrerAuto = async () => {
    await api.entrModuleSauver(m.id, { reponses: reps, valides: copie.valides || [], fini: true, auto });
    await api.entrProgres({ module: { id: m.id, titre: m.titre, auto, total: zones.length } });
  };
  enregistrerAuto();
  app.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
    const i = b.dataset.q; auto[i] = auto[i] === b.dataset.v ? undefined : b.dataset.v; if (!auto[i]) delete auto[i];
    const carte = document.getElementById('q' + i); carte.className = `correction-ligne ex-carte ${auto[i] || ''}`;
    carte.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('actif', x.dataset.v === auto[i]));
    pages.forEach((p) => { p.calque.innerHTML = ''; }); dessinerFeuille(); enregistrerAuto();
  }));
  let surCorrige = false;
  document.getElementById('voir-corrige')?.addEventListener('click', async (e) => {
    surCorrige = !surCorrige;
    e.target.textContent = surCorrige ? '📝 Ma feuille' : '📄 Corrigé complet';
    if (surCorrige) { const c = await api.entrCorrige(m.id); if (!c.ok) return message(c.message, true); await afficherPages(await ouvrirPdf(c.octets), zoneF, 720); }
    else { pages = await afficherPages(await ouvrirPdf(octets), zoneF, 720); dessinerFeuille(); }
  });
  document.getElementById('recommencer').addEventListener('click', async () => {
    if (!confirm('Recommencer l’exercice ? Tes réponses seront effacées.')) return;
    await api.entrModuleSauver(m.id, { reponses: {}, valides: [], fini: false, auto: {} });
    module(m.id, retour);
  });
  document.getElementById('retour-entr').addEventListener('click', () => (retour ? retour() : null));
}

window.EvalExercice = { eleve, correction, editerZones, corriger, svgVariations, travail, module, moduleZones };
window.dispatchEvent(new Event('exercice-pret'));
