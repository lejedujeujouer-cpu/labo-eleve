// Traitement de texte de Labo Élève, présenté comme les traitements de texte courants
// (ruban Accueil / Insertion / Mise en page / Affichage, règle, pages, barre d'état avec zoom).
// Ouverture .docx / .txt, enregistrement .docx (lisible par Word, LibreOffice, Word en ligne).
(function () {
  const $ = (id) => document.getElementById(id);
  const page = $('page');
  const feuille = $('feuille');
  const D = window.docx;
  const CM = 37.795; // pixels par centimètre (96 ppp)
  let fichier = { nom: null, nouveau: true, dejaEnregistre: false, modifie: false };
  let zoom = 1;

  // ---------- Format de page ----------
  const MARGES = {
    normales: { mh: 96, mb: 96, mg: 96, md: 96 },
    etroites: { mh: 48, mb: 48, mg: 48, md: 48 },
    larges: { mh: 96, mb: 96, mg: 192, md: 192 },
  };
  const format = { orientation: 'portrait', marges: 'normales' };
  const dimensions = () => {
    const portrait = format.orientation === 'portrait';
    return { l: portrait ? 794 : 1123, h: portrait ? 1123 : 794, ...MARGES[format.marges] };
  };
  const largeurTexte = () => { const d = dimensions(); return d.l - d.mg - d.md; };
  function appliquerFormat() {
    const d = dimensions();
    feuille.style.setProperty('--l', d.l + 'px');
    feuille.style.setProperty('--h', d.h + 'px');
    feuille.style.setProperty('--mh', d.mh + 'px');
    feuille.style.setProperty('--mb', d.mb + 'px');
    feuille.style.setProperty('--mg', d.mg + 'px');
    feuille.style.setProperty('--md', d.md + 'px');
    dessinerRegle();
    mettreEnPage();
  }

  // ---------- Règle ----------
  function dessinerRegle() {
    const d = dimensions();
    let html = `<div class="zone-texte" style="left:${d.mg}px;right:${d.md}px"></div>`;
    for (let k = -Math.floor(d.mg / (CM / 4)); d.mg + k * CM / 4 < d.l; k++) {
      const x = d.mg + k * CM / 4;
      if (x < 0) continue;
      if (k % 4 === 0 && k !== 0) html += `<span class="chiffre" style="left:${x}px">${Math.abs(k / 4)}</span>`;
      else if (k % 4 !== 0) html += `<span class="graduation" style="left:${x}px;height:${k % 2 ? 3 : 6}px;bottom:${k % 2 ? 9 : 8}px"></span>`;
    }
    html += '<span class="marque-retrait" id="marque-retrait"></span>';
    $('regle').innerHTML = html;
    majRegle();
  }
  function majRegle() {
    const m = $('marque-retrait');
    if (!m) return;
    const b = blocCourant();
    m.style.left = dimensions().mg + (b ? parseFloat(getComputedStyle(b).marginLeft) || 0 : 0) + 'px';
  }

  // ---------- Pages séparées (comme dans Word), en-tête et pied de page ----------
  // Chaque bloc (paragraphe, titre, élément de liste…) qui ne tient plus en bas d'une page est repoussé au
  // début de la suivante ; les feuilles blanches sont dessinées derrière le texte, avec un espace gris entre elles.
  const ECART = 24;
  const entetePied = { entete: '', alignEntete: 'center', pied: '', alignPied: 'left', numero: 'aucun', alignNumero: 'right' };
  const ENTETE_VIDE = { ...entetePied };
  let nbPages = 1;
  let attentePage = 0;
  const demanderMiseEnPage = () => { cancelAnimationFrame(attentePage); attentePage = requestAnimationFrame(mettreEnPage); };
  const echelle = () => { const r = page.getBoundingClientRect(); return r.height / page.offsetHeight || 1; };
  const hautDans = (el, e = echelle()) => (el.getBoundingClientRect().top - page.getBoundingClientRect().top) / e;
  function blocsDePage() {
    const liste = [];
    for (const el of page.children) {
      if ((el.tagName === 'UL' || el.tagName === 'OL') && el.children.length) liste.push(...[...el.children].filter((x) => x.tagName === 'LI'));
      else liste.push(el);
    }
    return liste;
  }
  function placerA(el, cible, e) { // marge ajoutée au-dessus du bloc pour qu'il commence à « cible »
    for (let essai = 0; essai < 5; essai++) {
      const diff = cible - hautDans(el, e);
      if (Math.abs(diff) < 0.5) return;
      if (!el.dataset.pousse) { el.dataset.pousse = '1'; el.dataset.mt = el.style.marginTop || ''; }
      el.style.marginTop = Math.max(0, (parseFloat(getComputedStyle(el).marginTop) || 0) + diff) + 'px';
    }
  }
  function mettreEnPage() {
    const d = dimensions(), pas = d.h + ECART;
    page.querySelectorAll('[data-pousse]').forEach((el) => { el.style.marginTop = el.dataset.mt || ''; delete el.dataset.pousse; delete el.dataset.mt; });
    const e = echelle();
    let pageForcee = -1;
    for (const el of blocsDePage()) {
      const haut = hautDans(el, e), h = el.offsetHeight;
      const p = Math.floor(haut / pas);
      const debut = p * pas + d.mh, fin = p * pas + d.h - d.mb;
      let cible = null;
      if (pageForcee >= 0 && p < pageForcee) cible = pageForcee * pas + d.mh; // après un saut de page
      else if (haut < debut - 0.5) cible = debut; // dans la marge du haut ou dans l'espace entre deux pages
      else if (haut + h > fin + 0.5 && h <= d.h - d.mh - d.mb && haut > debut + 1) cible = (p + 1) * pas + d.mh; // ne tient plus
      if (cible !== null) placerA(el, cible, e);
      pageForcee = el.matches('hr.saut-page') ? Math.floor(hautDans(el, e) / pas) + 1 : -1;
    }
    const dernier = page.lastElementChild;
    const bas = dernier ? hautDans(dernier, e) + dernier.offsetHeight + d.mb : d.h;
    nbPages = Math.max(1, Math.ceil((bas - 1) / pas), pageForcee > 0 ? pageForcee + 1 : 1);
    page.style.minHeight = nbPages * pas - ECART + 'px';
    dessinerFonds();
    majPageCourante();
  }
  const texteNumero = (n, total) => (entetePied.numero === 'page' ? String(n) : entetePied.numero === 'page-sur' ? `Page ${n} sur ${total}` : '');
  function dessinerFonds() {
    const d = dimensions(), pas = d.h + ECART, fonds = $('fonds-pages');
    while (fonds.children.length < nbPages) {
      const f = document.createElement('div');
      f.className = 'fond-page';
      f.innerHTML = '<div class="entete-page"></div><div class="pied-page"><span class="g"></span><span class="c"></span><span class="d"></span></div>';
      fonds.append(f);
    }
    while (fonds.children.length > nbPages) fonds.lastElementChild.remove();
    [...fonds.children].forEach((f, i) => {
      f.style.top = i * pas + 'px';
      const en = f.querySelector('.entete-page');
      en.textContent = entetePied.entete;
      en.style.textAlign = entetePied.alignEntete;
      const cases = { left: f.querySelector('.g'), center: f.querySelector('.c'), right: f.querySelector('.d') };
      Object.values(cases).forEach((c) => { c.textContent = ''; });
      if (entetePied.pied) cases[entetePied.alignPied].textContent = entetePied.pied;
      const num = texteNumero(i + 1, nbPages);
      if (num) { const c = cases[entetePied.alignNumero]; c.textContent = c.textContent ? c.textContent + '   ' + num : num; }
    });
  }
  function majPageCourante() {
    const d = dimensions(), pas = d.h + ECART;
    let x = 1;
    const s = getSelection();
    if (s.rangeCount && page.contains(s.anchorNode)) {
      const r = s.getRangeAt(0).getClientRects()[0] || (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).getBoundingClientRect();
      x = Math.min(nbPages, Math.max(1, Math.floor((r.top - page.getBoundingClientRect().top) / echelle() / pas) + 1));
    }
    $('pages').textContent = `Page ${x} sur ${nbPages}`;
  }
  // Fenêtre « En-tête et pied de page »
  function reglerEntetePied(champ = 'e-entete') {
    $('e-entete').value = entetePied.entete; $('e-align-entete').value = entetePied.alignEntete;
    $('e-pied').value = entetePied.pied; $('e-align-pied').value = entetePied.alignPied;
    $('e-numero').value = entetePied.numero; $('e-align-numero').value = entetePied.alignNumero;
    $('fenetre-entete').hidden = false;
    $(champ).focus();
  }
  $('e-annuler').addEventListener('click', () => { $('fenetre-entete').hidden = true; });
  $('e-effacer').addEventListener('click', () => { Object.assign(entetePied, ENTETE_VIDE); $('fenetre-entete').hidden = true; marquerModifie(); mettreEnPage(); });
  $('form-entete').addEventListener('submit', (ev) => {
    ev.preventDefault();
    Object.assign(entetePied, {
      entete: $('e-entete').value.trim(), alignEntete: $('e-align-entete').value, pied: $('e-pied').value.trim(), alignPied: $('e-align-pied').value,
      numero: $('e-numero').value, alignNumero: $('e-align-numero').value,
    });
    $('fenetre-entete').hidden = true;
    marquerModifie(); mettreEnPage();
  });
  // Double-clic dans la marge du haut ou du bas d'une page : réglage de l'en-tête / du pied de page
  page.addEventListener('dblclick', (ev) => {
    const d = dimensions(), pas = d.h + ECART;
    const y = ((ev.clientY - page.getBoundingClientRect().top) / echelle()) % pas;
    if (y < d.mh) reglerEntetePied('e-entete');
    else if (y > d.h - d.mb && y < d.h) reglerEntetePied(entetePied.numero !== 'aucun' && !entetePied.pied ? 'e-numero' : 'e-pied');
  });

  // ---------- Commandes d'édition ----------
  document.execCommand('defaultParagraphSeparator', false, 'p');
  document.execCommand('styleWithCSS', false, false);
  const commande = (cmd, valeur = null) => { page.focus(); document.execCommand(cmd, false, valeur); majOutils(); marquerModifie(); };
  const avecCSS = (fn) => { document.execCommand('styleWithCSS', false, true); try { fn(); } finally { document.execCommand('styleWithCSS', false, false); } };

  const BLOCS = 'p,h1,h2,h3,h4,li,div,blockquote';
  function blocCourant() {
    const s = getSelection();
    if (!s.rangeCount || !page.contains(s.anchorNode)) return null;
    const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
    const b = n.closest(BLOCS);
    return b && page.contains(b) && b !== page ? b : null;
  }
  function blocsSelection() {
    const s = getSelection();
    if (!s.rangeCount || !page.contains(s.anchorNode)) return [];
    const r = s.getRangeAt(0);
    let liste = [...page.querySelectorAll(BLOCS)].filter((b) => r.intersectsNode(b) && !b.querySelector(BLOCS));
    if (!liste.length) { document.execCommand('formatBlock', false, 'p'); const b = blocCourant(); liste = b ? [b] : []; }
    return liste;
  }

  function taillePolice(pt) {
    page.focus();
    document.execCommand('fontSize', false, '7');
    const nouveaux = [];
    for (const f of page.querySelectorAll('font[size="7"]')) {
      const span = document.createElement('span');
      span.style.fontSize = pt + 'pt';
      f.querySelectorAll('[style]').forEach((e) => { e.style.fontSize = ''; });
      while (f.firstChild) span.append(f.firstChild);
      f.replaceWith(span);
      nouveaux.push(span);
    }
    // Le texte reste sélectionné (pour enchaîner police, couleur…)
    if (nouveaux.length) {
      const r = document.createRange();
      r.setStartBefore(nouveaux[0].firstChild || nouveaux[0]);
      r.setEndAfter(nouveaux[nouveaux.length - 1].lastChild || nouveaux[nouveaux.length - 1]);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    }
    marquerModifie();
  }
  function retrait(sens) {
    const b = blocCourant();
    if (b && b.closest('li')) { commande(sens > 0 ? 'indent' : 'outdent'); return; }
    for (const bl of blocsSelection()) {
      const actuel = parseFloat(bl.style.marginLeft) || 0;
      const v = Math.max(0, Math.min(largeurTexte() - 100, actuel + sens * 48)); // pas de 1,27 cm
      bl.style.marginLeft = v ? v + 'px' : '';
    }
    marquerModifie(); majRegle();
  }
  function interligne(v) {
    for (const b of blocsSelection()) b.style.lineHeight = v === '1.15' ? '' : v;
    marquerModifie();
  }
  function sautDePage() {
    page.focus();
    document.execCommand('insertHTML', false, '<hr class="saut-page"><p><br></p>');
    marquerModifie();
  }

  // ---------- Presse-papiers ----------
  function insererHtmlPropre(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('script, style, meta, link, iframe, object').forEach((n) => n.remove());
    tmp.querySelectorAll('*').forEach((n) => {
      n.removeAttribute('class'); n.removeAttribute('id');
      if (n.tagName !== 'IMG') n.removeAttribute('style');
      for (const a of [...n.attributes]) if (/^on/i.test(a.name)) n.removeAttribute(a.name);
    });
    document.execCommand('insertHTML', false, tmp.innerHTML);
    marquerModifie();
  }
  async function coller() {
    page.focus();
    try {
      const elements = await navigator.clipboard.read();
      for (const el of elements) {
        const image = el.types.find((t) => t.startsWith('image/'));
        if (el.types.includes('text/html')) { insererHtmlPropre(await (await el.getType('text/html')).text()); return; }
        if (image) { insererImage(await lireImage(await el.getType(image))); return; }
        if (el.types.includes('text/plain')) { commande('insertText', await (await el.getType('text/plain')).text()); return; }
      }
    } catch {
      Doc.message('Utilise Ctrl+V pour coller.', 'erreur');
    }
  }
  page.addEventListener('paste', async (e) => {
    if (dansSaisieEq(e.target)) { // dans une équation : texte brut seulement
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
      return;
    }
    const items = [...(e.clipboardData && e.clipboardData.items || [])];
    const image = items.find((i) => i.type.startsWith('image/'));
    const html = e.clipboardData.getData('text/html');
    if (image && !html) { e.preventDefault(); insererImage(await lireImage(image.getAsFile())); return; }
    if (html) { e.preventDefault(); insererHtmlPropre(html); }
  });

  // ---------- Tableaux ----------
  let selectionSauvee = null;
  // (une position dans la saisie d'une équation n'est pas gardée : cette saisie est cachée une fois l'équation terminée)
  const sauverSelection = () => { const s = getSelection(); if (s.rangeCount && dansSaisieEq(s.anchorNode)) return; selectionSauvee = s.rangeCount && page.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null; };
  // Si la sélection est toujours dans la page (clic sur une liste du ruban), on la garde telle quelle.
  const restaurerSelection = () => { const dansPage = page.contains(getSelection().anchorNode); page.focus(); if (!dansPage && selectionSauvee) { const s = getSelection(); s.removeAllRanges(); s.addRange(selectionSauvee); } };
  function insererTableau(nl, nc, entete) {
    let html = '<table><tbody>';
    for (let l = 0; l < nl; l++) {
      html += '<tr>';
      for (let c = 0; c < nc; c++) html += l === 0 && entete ? '<th><br></th>' : '<td><br></td>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    page.focus();
    document.execCommand('insertHTML', false, html);
    marquerModifie();
  }
  // Grille de choix rapide (comme dans les traitements de texte)
  const grilleT = $('grille-tableau');
  grilleT.innerHTML = Array.from({ length: 80 }, (_, i) => `<span data-l="${Math.floor(i / 10)}" data-c="${i % 10}"></span>`).join('');
  grilleT.addEventListener('mouseover', (e) => {
    const s = e.target.closest('span');
    if (!s) return;
    const L = +s.dataset.l, C = +s.dataset.c;
    grilleT.querySelectorAll('span').forEach((x) => x.classList.toggle('on', +x.dataset.l <= L && +x.dataset.c <= C));
    $('titre-grille').textContent = `Tableau de ${C + 1} × ${L + 1}`;
  });
  grilleT.addEventListener('click', (e) => {
    const s = e.target.closest('span');
    if (!s) return;
    Ruban.fermerMenus();
    insererTableau(+s.dataset.l + 1, +s.dataset.c + 1, false);
  });
  $('t-annuler').addEventListener('click', () => { $('fenetre-tableau').hidden = true; });
  $('form-tableau').addEventListener('submit', (e) => {
    e.preventDefault();
    const nl = Math.min(50, Math.max(1, +$('t-lignes').value || 1)), nc = Math.min(12, Math.max(1, +$('t-colonnes').value || 1));
    $('fenetre-tableau').hidden = true;
    restaurerSelection();
    insererTableau(nl, nc, $('t-entete').checked);
  });
  // Tab : cellule suivante ; Tab dans la dernière cellule ajoute une ligne.
  const celluleCourante = () => { const n = getSelection().anchorNode; return n ? (n.nodeType === 1 ? n : n.parentElement).closest('td, th') : null; };
  page.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sautDePage(); return; }
    if (e.key !== 'Tab') return;
    const cellule = celluleCourante();
    e.preventDefault();
    if (!cellule) { commande('insertText', '\t'); return; }
    const cellules = [...cellule.closest('table').querySelectorAll('td, th')];
    let i = cellules.indexOf(cellule) + (e.shiftKey ? -1 : 1);
    if (i >= cellules.length) { actionTableau('ligne-dessous', cellule); i = cellules.length; }
    const cible = [...cellule.closest('table').querySelectorAll('td, th')][Math.max(0, i)];
    const r = document.createRange(); r.selectNodeContents(cible); r.collapse(false);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  });
  function actionTableau(action, cellule) {
    const table = cellule.closest('table'), ligne = cellule.closest('tr');
    const index = [...ligne.cells].indexOf(cellule);
    const vide = (tag = 'td') => { const n = document.createElement(tag); n.innerHTML = '<br>'; return n; };
    if (action === 'ligne-dessous') { const n = document.createElement('tr'); for (let i = 0; i < ligne.cells.length; i++) n.append(vide()); ligne.after(n); }
    if (action === 'colonne-droite') for (const tr of table.rows) { const c = tr.cells[Math.min(index, tr.cells.length - 1)]; c.after(vide(c.tagName === 'TH' ? 'th' : 'td')); }
    if (action === 'suppr-ligne') { if (table.rows.length > 1) ligne.remove(); else table.remove(); }
    if (action === 'suppr-colonne') { if (ligne.cells.length > 1) for (const tr of table.rows) tr.cells[Math.min(index, tr.cells.length - 1)].remove(); else table.remove(); }
    if (action === 'suppr-tableau') table.remove();
    marquerModifie();
  }
  let celluleMenu = null;
  page.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    celluleMenu = e.target.closest('td, th');
    $('ctx-tableau').hidden = !celluleMenu;
    Ruban.ouvrirMenu($('menu-contextuel'), { getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY }) });
  });

  // ---------- Symboles ----------
  const SYMBOLES = '² ³ × ÷ ± ≈ ≠ ≤ ≥ √ ∞ π Δ Ω α β γ θ λ µ ρ σ φ ω ° → ← ⇒ ⇔ · ∈ ∉ ∅ ℝ ℕ ∑ ∫ ‰ € ½ ¼ ¾ ⁻¹ ⁻² ₁ ₂ ₃ ⁺ ⁻'.split(' ');
  $('grille-symboles').innerHTML = SYMBOLES.map((s) => `<button data-symbole="${s}" title="${s}">${s}</button>`).join('');

  // ---------- Équations saisies directement dans la page (comme dans Word) ----------
  // Une équation = <span class="equation"> qui contient sa saisie au clavier (.eq-source, modifiable, visible
  // seulement pendant la modification) et son rendu MathML (.eq-rendu, aperçu en direct pendant la frappe).
  function dansSaisieEq(n) { const el = n && (n.nodeType === 1 ? n : n.parentElement); return !!(el && el.closest('.eq-source')); }
  const eqDe = (n) => { const el = n && (n.nodeType === 1 ? n : n.parentElement); const eq = el && el.closest('.equation'); return eq && page.contains(eq) ? eq : null; };
  const saisieEq = (eq) => eq.querySelector('.eq-source');
  const texteEq = (eq) => saisieEq(eq).textContent.replace(/[​]/g, '').replace(/ /g, ' ');
  let eqActive = null;
  const memoireEq = new Map(); // dernière saisie de chaque zone (pour « Rétablir »)
  let numeroEq = 0;
  function rendreEq(eq) {
    const s = saisieEq(eq);
    if (!s) return;
    const src = texteEq(eq).trim();
    if (!src && s.firstChild && !s.textContent) s.textContent = ''; // un <br> laissé par le navigateur
    eq.dataset.source = src;
    eq.querySelector('.eq-rendu').innerHTML = src ? Equations.rendre(src) : '';
    eq.classList.toggle('vide', !src);
  }
  function placerCurseur(noeud, position) {
    const r = document.createRange();
    r.setStart(noeud, position); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function editerEq(eq, auDebut = false) {
    eq.classList.add('en-edition');
    const s = saisieEq(eq);
    s.focus();
    const r = document.createRange(); r.selectNodeContents(s); r.collapse(auDebut);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  }
  // Fin de la modification : rendu définitif ; une zone restée vide disparaît.
  function terminerEq(eq) {
    eq.classList.remove('en-edition');
    rendreEq(eq);
    if (eq.dataset.source && eq.dataset.id) memoireEq.set(eq.dataset.id, eq.dataset.source);
    if (!eq.dataset.source) setTimeout(() => retirerVide(eq));
    if (eqActive === eq) eqActive = null;
    afficherOngletEq(false);
    demanderMiseEnPage();
  }
  // Zone laissée vide : retirée par une commande d'édition, pour que Ctrl+Z / Ctrl+Y restent cohérents.
  function retirerVide(eq) {
    if (!eq.isConnected || eq.dataset.source || eq.classList.contains('en-edition')) return;
    if (document.activeElement !== page) { eq.remove(); return; }
    const s = getSelection(), garde = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
    const r = document.createRange(); r.selectNode(eq);
    s.removeAllRanges(); s.addRange(r);
    document.execCommand('delete');
    if (garde && garde.startContainer.isConnected && !eq.contains(garde.startContainer)) { s.removeAllRanges(); s.addRange(garde); }
    marquerModifie();
  }
  // Sortie de la zone (Entrée, Échap, flèche en bout de zone) : curseur juste avant ou juste après.
  function sortirEq(eq, sens) {
    let n = sens === 'apres' ? eq.nextSibling : eq.previousSibling;
    if (!n || n.nodeType !== 3) { n = document.createTextNode('​'); if (sens === 'apres') eq.after(n); else eq.before(n); }
    page.focus(); // déclenche la fin de modification (focusout)
    placerCurseur(n, sens === 'apres' ? (n.data[0] === '​' ? 1 : 0) : n.length);
    majOutils();
  }
  function insererEquation() {
    if (eqActive) return;
    restaurerSelection();
    // Un simple repère est inséré par une commande d'édition (annulable), puis transformé en zone d'équation :
    // un élément non modifiable inséré directement en fin de paragraphe serait placé hors du paragraphe.
    document.execCommand('insertHTML', false, '<span class="equation" data-nouvelle-eq="1">​</span>​');
    const repere = page.querySelector('[data-nouvelle-eq]');
    if (!repere) return;
    // Le navigateur entoure le caractère invisible qui suit d'un <span style="…"> : on garde le texte seul.
    const apres = repere.nextSibling;
    if (apres && apres.nodeType === 1 && apres.tagName === 'SPAN' && apres.textContent === '​' && !apres.className) apres.replaceWith(document.createTextNode('​'));
    const modele = document.createElement('span');
    modele.innerHTML = Equations.html('');
    const eq = modele.firstChild;
    repere.removeAttribute('data-nouvelle-eq');
    for (const a of [...repere.attributes]) repere.removeAttribute(a.name);
    for (const a of eq.attributes) repere.setAttribute(a.name, a.value);
    repere.replaceChildren(...eq.childNodes);
    repere.dataset.id = 'eq' + Date.now().toString(36) + (++numeroEq);
    if (!repere.nextSibling || repere.nextSibling.nodeType !== 3) repere.after(document.createTextNode('​')); // pour placer le curseur après
    marquerModifie();
    editerEq(repere);
  }
  function supprimerEq(eq = eqActive) {
    if (!eq || !eq.isConnected) return;
    page.focus();
    if (!eq.isConnected) return; // zone vide : déjà retirée
    const r = document.createRange(); r.selectNode(eq);
    getSelection().removeAllRanges(); getSelection().addRange(r);
    document.execCommand('delete'); // annulable avec Ctrl+Z
    marquerModifie();
  }
  // Onglet contextuel « Équation » : visible seulement quand le curseur est dans une équation
  function afficherOngletEq(oui) {
    const b = $('onglet-equation');
    if (oui) { b.hidden = false; if (!b.classList.contains('actif')) b.click(); return; }
    const actif = b.classList.contains('actif');
    b.hidden = true;
    if (actif) document.querySelector('.onglets-ruban [data-onglet="accueil"]').click();
  }
  page.addEventListener('focusin', (e) => {
    if (!e.target.classList || !e.target.classList.contains('eq-source')) return;
    const eq = e.target.closest('.equation');
    eq.classList.add('en-edition');
    eqActive = eq;
    afficherOngletEq(true);
  });
  page.addEventListener('focusout', (e) => {
    if (e.target.classList && e.target.classList.contains('eq-source')) terminerEq(e.target.closest('.equation'));
  });
  page.addEventListener('input', (e) => { if (dansSaisieEq(e.target)) rendreEq(e.target.closest('.equation')); });
  // Annuler / Rétablir après la sortie de la zone : le rendu suit la saisie.
  // « Rétablir » (Ctrl+Y) remet parfois une copie simplifiée de la zone : on la répare (ou on la retire si elle est vide).
  function reparerEq(eq) {
    if (eq.getAttribute('contenteditable') !== 'false') eq.setAttribute('contenteditable', 'false');
    let s = saisieEq(eq);
    if (!s) { s = document.createElement('span'); s.className = 'eq-source'; s.textContent = eq.dataset.source || ''; eq.prepend(s); }
    if (s.getAttribute('contenteditable') !== 'true') { s.setAttribute('contenteditable', 'true'); s.spellcheck = false; }
    if (!texteEq(eq).trim() && memoireEq.has(eq.dataset.id)) s.textContent = memoireEq.get(eq.dataset.id);
    if (!eq.querySelector('.eq-rendu')) { const r = document.createElement('span'); r.className = 'eq-rendu'; eq.append(r); }
    eq.removeAttribute('style');
    rendreEq(eq);
    if (!eq.dataset.source && !eq.classList.contains('en-edition') && eq !== eqActive) eq.remove();
  }
  new MutationObserver((liste) => {
    const aRendre = new Set();
    for (const m of liste) {
      if (dansSaisieEq(m.target)) { const eq = eqDe(m.target); if (eq) aRendre.add(eq); }
      for (const n of m.addedNodes) if (n.nodeType === 1 && !dansSaisieEq(n) && !n.closest('.eq-rendu')) {
        if (n.matches('.equation')) aRendre.add(n);
        n.querySelectorAll('.equation').forEach((x) => aRendre.add(x));
      }
    }
    aRendre.forEach((eq) => { if (eq.isConnected) reparerEq(eq); });
  }).observe(page, { subtree: true, characterData: true, childList: true });
  // Clavier dans une équation (écouté avant les autres raccourcis)
  page.addEventListener('keydown', (e) => {
    if (!dansSaisieEq(e.target)) return;
    const s = e.target.closest('.eq-source'), eq = s.closest('.equation');
    const sel = getSelection();
    let pos = 0;
    if (sel.rangeCount) { const r = document.createRange(); r.selectNodeContents(s); r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset); pos = r.toString().length; }
    const long = s.textContent.length, simple = sel.isCollapsed && !e.shiftKey && !e.ctrlKey && !e.altKey;
    let sortie = null;
    if (e.key === 'Enter' || e.key === 'Escape' || (e.key === 'Tab' && !e.shiftKey)) sortie = 'apres';
    else if (e.key === 'Tab') sortie = 'avant';
    else if (simple && (e.key === 'ArrowRight' || e.key === 'ArrowDown') && pos >= long) sortie = 'apres';
    else if (simple && (e.key === 'ArrowLeft' || e.key === 'ArrowUp') && pos === 0) sortie = 'avant';
    else if ((e.key === 'Backspace' || e.key === 'Delete') && !texteEq(eq)) sortie = 'avant'; // zone vide : elle disparaît
    else if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[biugejlrk]$/i.test(e.key)) { e.preventDefault(); e.stopPropagation(); return; } // pas de gras, d'alignement… dans la saisie
    if (sortie) { e.preventDefault(); e.stopPropagation(); sortirEq(eq, sortie); }
  }, true);
  // Boutons de l'onglet « Équation »
  $('eq-structures').innerHTML = Equations.STRUCTURES.map(([id, nom, , , ex]) => `<button class="br grand eq-bouton" data-eq-structure="${id}" title="${nom}"><span class="eq-ic">${Equations.rendre(ex)}</span>${nom}</button>`).join('');
  $('eq-symboles').innerHTML = Equations.SYMBOLES.map((c) => `<button class="br" data-eq-symbole="${c}" title="${c}">${c}</button>`).join('');
  function insererDansEq(texte, curseur = texte.length) {
    const eq = eqActive;
    if (!eq) return;
    const s = saisieEq(eq);
    if (document.activeElement !== s) editerEq(eq);
    document.execCommand('insertText', false, texte);
    for (let i = 0; i < texte.length - curseur; i++) getSelection().modify('move', 'backward', 'character');
    rendreEq(eq);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-eq-structure], [data-eq-symbole]');
    if (!b) return;
    if (b.dataset.eqSymbole) { insererDansEq(b.dataset.eqSymbole); return; }
    const st = Equations.STRUCTURES.find((x) => x[0] === b.dataset.eqStructure);
    if (st) insererDansEq(st[2], st[3]);
  });

  // ---------- Images ----------
  const lireImage = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  function insererImage(src) {
    page.focus();
    document.execCommand('insertHTML', false, `<img src="${src}" style="width:60%">`);
    marquerModifie();
  }
  $('fichier-image').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) lireImage(f).then((src) => { restaurerSelection(); insererImage(src); });
  });
  let imageChoisie = null;
  page.addEventListener('click', (e) => {
    const eq = e.target.closest && e.target.closest('.equation');
    if (eq && page.contains(eq)) {
      if (!e.target.closest('.eq-source')) editerEq(eq); // clic sur le rendu : on retrouve la saisie modifiable
      return;
    }
    page.querySelectorAll('img.selectionnee').forEach((i) => i.classList.remove('selectionnee'));
    imageChoisie = e.target.tagName === 'IMG' ? e.target : null;
    if (imageChoisie) imageChoisie.classList.add('selectionnee');
    $('barre-image').hidden = !imageChoisie;
  });
  $('barre-image').addEventListener('click', (e) => {
    if (!imageChoisie) return;
    const t = e.target.closest('[data-taille]');
    if (t) { imageChoisie.style.width = t.dataset.taille + '%'; marquerModifie(); }
    if (e.target.id === 'btn-suppr-image') { imageChoisie.remove(); imageChoisie = null; $('barre-image').hidden = true; marquerModifie(); }
  });

  // ---------- Lien ----------
  async function lien() {
    sauverSelection();
    const texteChoisi = selectionSauvee ? selectionSauvee.toString() : '';
    let url = await Doc.demanderNom('Adresse du lien (par exemple https://…)', 'https://');
    if (!url || url === 'https://') return;
    if (!/^(https?:|mailto:)/i.test(url)) url = 'https://' + url;
    restaurerSelection();
    if (texteChoisi) commande('createLink', url);
    else { const a = document.createElement('a'); a.href = url; a.textContent = url; commande('insertHTML', a.outerHTML + '&nbsp;'); }
  }

  // ---------- Zoom ----------
  function fixerZoom(z) {
    zoom = Math.min(2, Math.max(0.5, Math.round(z * 100) / 100));
    feuille.style.zoom = zoom;
    $('zoom').value = Math.round(zoom * 100);
    $('zoom-val').textContent = Math.round(zoom * 100) + ' %';
  }
  $('zoom').addEventListener('input', (e) => fixerZoom(e.target.value / 100));
  $('zone-page').addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); fixerZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1)); } }, { passive: false });

  // ---------- Ruban ----------
  const COMMANDES = {
    enregistrer: () => enregistrer(),
    'enregistrer-sous': () => enregistrer(true),
    nouveau: () => { if (window.laboAvantFermeture()) { fichier.modifie = false; window.parent.ouvrirOutil && window.parent.ouvrirOutil('traitement-de-texte'); } },
    ouvrir: () => { if (window.laboAvantFermeture()) { fichier.modifie = false; window.parent.ouvrirOutil && window.parent.ouvrirOutil('mes-documents'); } },
    raccourcis: () => { sauverSelection(); $('fenetre-raccourcis').hidden = false; $('r-fermer').focus(); },
    coller,
    cut: () => commande('cut'),
    copy: () => commande('copy'),
    'retrait+': () => retrait(1),
    'retrait-': () => retrait(-1),
    'saut-page': sautDePage,
    entete: () => reglerEntetePied('e-entete'),
    pied: () => reglerEntetePied('e-pied'),
    numero: () => { if (entetePied.numero === 'aucun') entetePied.numero = 'page'; reglerEntetePied('e-numero'); },
    equation: () => insererEquation(),
    'supprimer-equation': () => supprimerEq(),
    pdf: exporterPdf,
    image: () => { sauverSelection(); $('fichier-image').click(); },
    lien,
    'tableau-fenetre': () => { sauverSelection(); $('fenetre-tableau').hidden = false; $('t-lignes').focus(); },
    regle: () => { const cache = $('regle').hidden = !$('regle').hidden; $('btn-regle').classList.toggle('actif', !cache); },
    zoom100: () => fixerZoom(1),
    'zoom+': () => fixerZoom(zoom + 0.1),
    'zoom-': () => fixerZoom(zoom - 0.1),
    'une-page': () => fixerZoom(($('zone-page').clientHeight - 40) / (dimensions().h + 30)),
    'largeur-page': () => fixerZoom(($('zone-page').clientWidth - 50) / dimensions().l),
  };
  // Garder la sélection dans la page quand on clique dans le ruban
  document.addEventListener('mousedown', (e) => { if (e.target.closest('.ruban, .onglets-ruban, .barre-titre, .menu-flottant, .barre-etat-office') && !e.target.closest('select, input')) e.preventDefault(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd], [data-menu], [data-bloc], [data-interligne], [data-symbole], [data-marges], [data-orientation], [data-table]');
    if (!b) return;
    if (b.dataset.menu) { Ruban.ouvrirMenu($(b.dataset.menu), b); return; }
    Ruban.fermerMenus();
    const d = b.dataset;
    if (d.cmd) { if (COMMANDES[d.cmd]) COMMANDES[d.cmd](); else commande(d.cmd); }
    else if (d.bloc) commande('formatBlock', d.bloc);
    else if (d.interligne) interligne(d.interligne);
    else if (d.symbole) commande('insertText', d.symbole);
    else if (d.marges) { format.marges = d.marges; appliquerFormat(); marquerModifie(); }
    else if (d.orientation) { format.orientation = d.orientation; appliquerFormat(); marquerModifie(); }
    else if (d.table && celluleMenu) actionTableau(d.table, celluleMenu);
  });
  $('onglet-fichier').addEventListener('click', (e) => Ruban.ouvrirMenu($('menu-fichier'), e.currentTarget));
  $('choix-police').addEventListener('change', (e) => { page.focus(); restaurerSelection(); avecCSS(() => document.execCommand('fontName', false, e.target.value)); marquerModifie(); });
  $('choix-taille').addEventListener('change', (e) => { restaurerSelection(); taillePolice(+e.target.value); });
  ['choix-police', 'choix-taille'].forEach((id) => $(id).addEventListener('mousedown', sauverSelection));
  $('choix-couleur').addEventListener('input', (e) => { $('barre-couleur').style.background = e.target.value; commande('foreColor', e.target.value); });
  $('choix-surligner').addEventListener('input', (e) => { $('barre-surligner').style.background = e.target.value; page.focus(); avecCSS(() => document.execCommand('hiliteColor', false, e.target.value)); marquerModifie(); });
  // Clic sur l'icône de couleur (et pas sur la flèche) : applique la dernière couleur choisie
  ['choix-couleur', 'choix-surligner'].forEach((id) => $(id).addEventListener('mousedown', sauverSelection));

  const ETATS = ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];
  function majOutils() {
    for (const b of document.querySelectorAll('.ruban [data-cmd]')) {
      if (ETATS.includes(b.dataset.cmd)) { try { b.classList.toggle('actif', document.queryCommandState(b.dataset.cmd)); } catch { /* ignoré */ } }
    }
    const bloc = (document.queryCommandValue('formatBlock') || 'p').toLowerCase();
    document.querySelectorAll('[data-bloc]').forEach((b) => b.classList.toggle('actif', b.dataset.bloc === (['h1', 'h2', 'h3'].includes(bloc) ? bloc : 'p')));
    const s = getSelection();
    if (s.rangeCount && page.contains(s.anchorNode)) {
      const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
      const cs = getComputedStyle(el);
      const police = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const choix = $('choix-police');
      if (![...choix.options].some((o) => o.value === police)) choix.append(new Option(police));
      choix.value = police;
      const pt = Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2;
      const taille = $('choix-taille');
      if (![...taille.options].some((o) => +o.value === pt)) taille.append(new Option(String(pt).replace('.', ',') , pt));
      taille.value = String(pt);
    }
    majRegle();
    majPageCourante();
  }
  document.addEventListener('selectionchange', () => { if (page.contains(getSelection().anchorNode)) { sauverSelection(); majOutils(); } });

  // ---------- Raccourcis clavier (ceux de Word, version française) ----------
  // Tailles proposées par Word quand on agrandit / réduit le texte au clavier
  const TAILLES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  function tailleSuivante(sens) {
    const s = getSelection();
    if (!s.rangeCount || !page.contains(s.anchorNode) || s.isCollapsed) return; // comme la liste des tailles : sur le texte sélectionné
    const actuelle = +$('choix-taille').value || 11;
    const t = sens > 0 ? TAILLES.find((x) => x > actuelle) || 72 : [...TAILLES].reverse().find((x) => x < actuelle) || 8;
    taillePolice(t);
    majOutils();
  }
  const style = (bloc) => () => commande('formatBlock', bloc);
  // [touches affichées, description, action, seulement dans la page ?]
  const RACCOURCIS = {
    'Fichier': [
      ['Ctrl+N', 'Nouveau document', () => COMMANDES.nouveau()],
      ['Ctrl+O', 'Ouvrir (Mes documents)', () => COMMANDES.ouvrir()],
      ['Ctrl+S', 'Enregistrer', () => enregistrer()],
      ['F12', 'Enregistrer sous…', () => enregistrer(true)],
      ['Ctrl+P', 'Imprimer / Exporter en PDF', () => exporterPdf()],
      ['F1', 'Afficher cette liste', () => COMMANDES.raccourcis()],
    ],
    'Modifier': [
      ['Ctrl+Z', 'Annuler'], ['Ctrl+Y', 'Rétablir'],
      ['Ctrl+X', 'Couper'], ['Ctrl+C', 'Copier'], ['Ctrl+V', 'Coller'], ['Ctrl+A', 'Tout sélectionner'],
    ],
    'Police': [
      ['Ctrl+G', 'Gras', () => commande('bold')],
      ['Ctrl+I', 'Italique', () => commande('italic')],
      ['Ctrl+U', 'Souligné', () => commande('underline')],
      ['Ctrl+=', 'Indice (ex. H₂O)', () => commande('subscript')],
      ['Ctrl+Maj++', 'Exposant (ex. m²)', () => commande('superscript')],
      ['Ctrl+Maj+>', 'Agrandir le texte sélectionné', () => tailleSuivante(1)],
      ['Ctrl+<', 'Réduire le texte sélectionné', () => tailleSuivante(-1)],
      ['Ctrl+Espace', 'Effacer la mise en forme des caractères', () => commande('removeFormat')],
    ],
    'Paragraphe': [
      ['Ctrl+Maj+G', 'Aligner à gauche (ou Ctrl+L)', () => commande('justifyLeft')],
      ['Ctrl+E', 'Centrer', () => commande('justifyCenter')],
      ['Ctrl+Maj+D', 'Aligner à droite (ou Ctrl+R)', () => commande('justifyRight')],
      ['Ctrl+J', 'Justifier', () => commande('justifyFull')],
      ['Ctrl+1', 'Interligne simple (1,0)', () => interligne('1')],
      ['Ctrl+5', 'Interligne 1,5', () => interligne('1.5')],
      ['Ctrl+2', 'Interligne double (2,0)', () => interligne('2')],
      ['Ctrl+Maj+L', 'Liste à puces', () => commande('insertUnorderedList')],
      ['Tab / Maj+Tab', 'Retrait (dans un tableau : cellule suivante / précédente)'],
    ],
    'Styles': [
      ['Ctrl+Alt+1', 'Titre 1', style('h1')],
      ['Ctrl+Alt+2', 'Titre 2', style('h2')],
      ['Ctrl+Alt+3', 'Titre 3', style('h3')],
      ['Ctrl+Maj+N', 'Normal', style('p')],
    ],
    'Insertion': [
      ['Ctrl+Entrée', 'Saut de page'],
      ['Ctrl+K', 'Lien', () => lien()],
      ['Alt+=', 'Équation (saisie dans la page)', () => COMMANDES.equation()],
      ['Entrée / Échap', 'Sortir de l\'équation'],
    ],
  };
  const action = (touches) => { for (const l of Object.values(RACCOURCIS)) for (const r of l) if (r[0] === touches) return r[2]; return null; };
  const FICHIER = ['Ctrl+N', 'Ctrl+O', 'Ctrl+S', 'F12', 'Ctrl+P', 'F1']; // fonctionnent même hors de la page
  // Nom du raccourci correspondant à l'appui (indépendant du clavier AZERTY / QWERTY quand c'est possible)
  function touchesDe(e) {
    if (e.key === 'F12' || e.key === 'F1') return !e.ctrlKey && !e.altKey && !e.shiftKey ? e.key : null;
    // Alt+= (ou Alt+Maj+=) : équation, comme dans Word ; touche « = » repérée sur AZERTY comme sur QWERTY
    if (e.altKey && !e.ctrlKey && !e.metaKey) return e.key === '=' || e.key === '+' || e.code === 'Equal' ? 'Alt+=' : null;
    if (!(e.ctrlKey || e.metaKey)) return null;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const chiffre = (/^(?:Digit|Numpad)([0-9])$/.exec(e.code) || [])[1];
    if (e.altKey) {
      // Sur un clavier français, AltGr (= Ctrl+Alt) sert à taper ~ et # avec les touches 2 et 3 : on les laisse passer.
      if (!e.shiftKey && chiffre >= '1' && chiffre <= '3' && ['1', '2', '3', '&', 'é', '"'].includes(e.key)) return 'Ctrl+Alt+' + chiffre;
      return null;
    }
    if (e.shiftKey) {
      if (e.key === '>') return 'Ctrl+Maj+>';
      if (e.key === '<') return 'Ctrl+<';
      if (e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') return 'Ctrl+Maj++';
      if (k === 'g' || k === 'd' || k === 'l' || k === 'n') return 'Ctrl+Maj+' + k.toUpperCase();
      return null;
    }
    if (k === ' ') return 'Ctrl+Espace';
    if (k === '=') return 'Ctrl+=';
    if (k === '<' || k === '[') return 'Ctrl+<';
    if (k === ']') return 'Ctrl+Maj+>';
    if (k === 'b') return 'Ctrl+G'; // réflexe des claviers anglais
    if (k === 'l') return 'Ctrl+Maj+G';
    if (k === 'r') return 'Ctrl+Maj+D';
    if (chiffre === '1' || chiffre === '2' || chiffre === '5') return 'Ctrl+' + chiffre;
    if (/^[a-z]$/.test(k)) return 'Ctrl+' + k.toUpperCase();
    return null;
  }
  const fenetreOuverte = () => !!document.querySelector('.fond-fenetre:not([hidden]), .doc-fenetre-fond');
  document.addEventListener('keydown', (e) => {
    const touches = touchesDe(e);
    if (!touches) return;
    if (touches === 'F1' && !$('fenetre-raccourcis').hidden) { e.preventDefault(); return; }
    if (fenetreOuverte()) return; // pendant une fenêtre (équation, en-tête…) les touches servent à la fenêtre
    const fn = action(touches);
    if (!fn || (!FICHIER.includes(touches) && document.activeElement !== page)) return;
    e.preventDefault();
    Ruban.fermerMenus();
    fn();
  });
  // Fenêtre « Raccourcis clavier »
  const kbd = (t) => t.split(' / ').map((x) => x.replace(/\+\+$/, '+PLUS').split('+')
    .map((c) => `<kbd>${c === 'PLUS' ? '+' : c.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</kbd>`).join('+')).join(' / ');
  $('liste-raccourcis').innerHTML = Object.entries(RACCOURCIS).map(([groupe, liste]) => `<div class="groupe-raccourcis"><h3>${groupe}</h3>${
    liste.map(([t, d]) => `<div class="raccourci"><span class="touches">${kbd(t)}</span><span>${d}</span></div>`).join('')}</div>`).join('');
  const fermerRaccourcis = () => { $('fenetre-raccourcis').hidden = true; restaurerSelection(); };
  $('r-fermer').addEventListener('click', fermerRaccourcis);
  $('fenetre-raccourcis').addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'F1') { e.preventDefault(); fermerRaccourcis(); } });
  $('fenetre-raccourcis').addEventListener('mousedown', (e) => { if (e.target === e.currentTarget) fermerRaccourcis(); });

  // ---------- État ----------
  function marquerModifie() {
    fichier.modifie = true;
    $('etat-fichier').textContent = ' · non enregistré';
    compter();
    demanderMiseEnPage();
  }
  page.addEventListener('input', marquerModifie);
  function compter() {
    const mots = (page.innerText.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    $('compteur').textContent = `${mots} mot${mots > 1 ? 's' : ''}`;
  }

  // ---------- Conversion vers Word (.docx) ----------
  const ALIGNEMENTS = { center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, justify: D.AlignmentType.JUSTIFIED };
  const TITRES = { H1: D.HeadingLevel.HEADING_1, H2: D.HeadingLevel.HEADING_2, H3: D.HeadingLevel.HEADING_3 };
  function versHex(couleur) {
    if (!couleur) return null;
    if (/^#([0-9a-f]{6})$/i.test(couleur)) return couleur.slice(1).toUpperCase();
    if (/^#([0-9a-f]{3})$/i.test(couleur)) return couleur.slice(1).split('').map((c) => c + c).join('').toUpperCase();
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(couleur);
    if (!m || m[4] === '0') return null;
    return [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  const alignement = (el) => ALIGNEMENTS[(el.style && el.style.textAlign) || el.getAttribute && el.getAttribute('align')] || undefined;
  // Retrait gauche et interligne d'un paragraphe (1 px = 15 twips)
  function proprietesParagraphe(el) {
    const p = { alignment: alignement(el) };
    const ml = parseFloat(el.style && el.style.marginLeft);
    if (ml > 0) p.indent = { left: Math.round(ml * 15) };
    const lh = parseFloat(el.style && el.style.lineHeight);
    if (lh > 0 && lh < 5) p.spacing = { line: Math.round(lh * 240) };
    return p;
  }
  const taillePt = (v) => { if (!v) return null; const n = parseFloat(v); if (!n) return null; return /px$/.test(v) ? n * 0.75 : /pt$/.test(v) ? n : null; };

  async function imageRun(img) {
    let src = img.getAttribute('src') || '';
    let type = (/^data:image\/(png|jpe?g|gif|bmp)/i.exec(src) || [])[1];
    if (!type) { // webp, svg… -> png
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 400; c.height = img.naturalHeight || 300;
      c.getContext('2d').drawImage(img, 0, 0);
      src = c.toDataURL('image/png'); type = 'png';
    }
    const octets = Uint8Array.from(atob(src.split(',')[1]), (ch) => ch.charCodeAt(0));
    const pct = parseFloat(img.style.width) || null;
    const nw = img.naturalWidth || 400, nh = img.naturalHeight || 300;
    const lt = largeurTexte();
    const largeur = Math.min(lt, pct ? lt * pct / 100 : nw);
    return new D.ImageRun({ type: type.toLowerCase() === 'jpeg' ? 'jpg' : type.toLowerCase(), data: octets, transformation: { width: Math.round(largeur), height: Math.round(largeur * nh / nw) } });
  }

  async function runs(noeud, fmt = {}) {
    const sortie = [];
    for (const n of noeud.childNodes) {
      if (n.nodeType === 3) {
        const texte = n.textContent.replace(/​/g, '').replace(/\s+/g, ' ');
        if (texte) sortie.push(new D.TextRun({ text: texte, ...fmtDocx(fmt) }));
        continue;
      }
      if (n.nodeType !== 1) continue;
      const t = n.tagName;
      if (t === 'BR') { sortie.push(new D.TextRun({ text: '', break: 1 })); continue; }
      if (n.classList && n.classList.contains('equation')) { if (n.dataset.source) sortie.push(Equations.versDocx(n.dataset.source, D)); continue; }
      if (t === 'IMG') { sortie.push(await imageRun(n)); continue; }
      if (['UL', 'OL', 'TABLE', 'HR'].includes(t)) continue; // traités comme blocs
      const f = { ...fmt };
      if (t === 'B' || t === 'STRONG' || t === 'TH') f.gras = true;
      if (t === 'I' || t === 'EM') f.italique = true;
      if (t === 'U') f.souligne = true;
      if (t === 'S' || t === 'STRIKE' || t === 'DEL') f.barre = true;
      if (t === 'SUP') f.exposant = true;
      if (t === 'SUB') f.indice = true;
      if (t === 'MARK') f.fond = 'FFFF00';
      if (t === 'FONT') {
        if (n.getAttribute('color')) f.couleur = versHex(n.getAttribute('color'));
        if (n.getAttribute('face')) f.police = n.getAttribute('face').split(',')[0].replace(/["']/g, '').trim();
      }
      if (n.style) {
        if (n.style.fontWeight === 'bold' || +n.style.fontWeight >= 600) f.gras = true;
        if (n.style.fontStyle === 'italic') f.italique = true;
        if (/underline/.test(n.style.textDecoration)) f.souligne = true;
        if (/line-through/.test(n.style.textDecoration)) f.barre = true;
        if (n.style.color) f.couleur = versHex(n.style.color) || f.couleur;
        if (n.style.backgroundColor) f.fond = versHex(n.style.backgroundColor) || f.fond;
        if (n.style.fontFamily) f.police = n.style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        const pt = taillePt(n.style.fontSize);
        if (pt) f.taille = pt;
      }
      if (t === 'A' && n.href && /^(https?|mailto):/.test(n.href)) {
        sortie.push(new D.ExternalHyperlink({ link: n.href, children: [new D.TextRun({ text: n.textContent, style: 'Hyperlink', ...fmtDocx(f) })] }));
        continue;
      }
      sortie.push(...await runs(n, f));
    }
    return sortie;
  }
  const fmtDocx = (f) => ({
    bold: f.gras || undefined, italics: f.italique || undefined, underline: f.souligne ? {} : undefined, strike: f.barre || undefined,
    superScript: f.exposant || undefined, subScript: f.indice || undefined, color: f.couleur || undefined,
    shading: f.fond ? { type: D.ShadingType.CLEAR, color: 'auto', fill: f.fond } : undefined,
    font: f.police || undefined, size: f.taille ? Math.round(f.taille * 2) : undefined,
  });

  let instanceListe = 0;
  async function blocs(conteneur) {
    const sortie = [];
    let enLigne = []; // texte ou éléments en ligne hors paragraphe
    const viderEnLigne = async () => {
      if (!enLigne.length) return;
      const tmp = document.createElement('p');
      enLigne.forEach((n) => tmp.append(n.cloneNode(true)));
      enLigne = [];
      if (tmp.textContent.trim() || tmp.querySelector('img')) sortie.push(new D.Paragraph({ children: await runs(tmp) }));
    };
    for (const n of conteneur.childNodes) {
      const t = n.nodeType === 1 ? n.tagName : '#texte';
      if (!['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE', 'HR'].includes(t)) { enLigne.push(n); continue; }
      await viderEnLigne();
      // L'éditeur place parfois une liste, un tableau ou un saut de page dans un paragraphe : on le découpe.
      if (['P', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4'].includes(t) && [...n.children].some((e) => ['UL', 'OL', 'TABLE', 'DIV', 'P', 'HR'].includes(e.tagName))) {
        sortie.push(...await blocs(n));
        continue;
      }
      if (TITRES[t] || t === 'H4') sortie.push(new D.Paragraph({ heading: TITRES[t] || D.HeadingLevel.HEADING_3, ...proprietesParagraphe(n), children: await runs(n) }));
      else if (t === 'P') sortie.push(new D.Paragraph({ ...proprietesParagraphe(n), children: await runs(n) }));
      else if (t === 'BLOCKQUOTE') sortie.push(new D.Paragraph({ ...proprietesParagraphe(n), indent: { left: 720 }, children: await runs(n) }));
      else if (t === 'DIV') { if (n.querySelector('p, h1, h2, h3, ul, ol, table, div, hr')) sortie.push(...await blocs(n)); else sortie.push(new D.Paragraph({ ...proprietesParagraphe(n), children: await runs(n) })); }
      else if (t === 'UL' || t === 'OL') sortie.push(...await liste(n, 0, ++instanceListe));
      else if (t === 'TABLE') sortie.push(await tableau(n), new D.Paragraph({ children: [] }));
      else if (t === 'HR' && n.classList.contains('saut-page')) sortie.push(new D.Paragraph({ children: [new D.PageBreak()] }));
      else if (t === 'HR') sortie.push(new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, children: [] }));
    }
    await viderEnLigne();
    return sortie;
  }
  async function liste(el, niveau, instance) {
    const numerotee = el.tagName === 'OL';
    const sortie = [];
    for (const li of el.children) {
      if (li.tagName !== 'LI') continue;
      sortie.push(new D.Paragraph({
        children: await runs(li), alignment: alignement(li),
        ...(numerotee ? { numbering: { reference: 'numeros', level: Math.min(niveau, 3), instance } } : { bullet: { level: Math.min(niveau, 3) } }),
      }));
      for (const sous of li.children) if (sous.tagName === 'UL' || sous.tagName === 'OL') sortie.push(...await liste(sous, niveau + 1, ++instanceListe));
    }
    return sortie;
  }
  async function tableau(table) {
    const lignes = [...table.rows];
    const nbCols = Math.max(1, ...lignes.map((r) => [...r.cells].reduce((s, c) => s + (c.colSpan || 1), 0)));
    const rows = [];
    for (const tr of lignes) {
      const cells = [];
      for (const td of tr.cells) {
        const contenu = td.querySelector('p, div, h1, h2, h3, ul, ol, table')
          ? await blocs(td)
          : [new D.Paragraph({ children: await runs(td, td.tagName === 'TH' ? { gras: true } : {}) })];
        cells.push(new D.TableCell({
          children: contenu.length ? contenu : [new D.Paragraph({ children: [] })], columnSpan: td.colSpan > 1 ? td.colSpan : undefined,
          shading: versHex(td.style.backgroundColor) ? { type: D.ShadingType.CLEAR, color: 'auto', fill: versHex(td.style.backgroundColor) } : undefined,
          width: { size: Math.round(100 / nbCols), type: D.WidthType.PERCENTAGE },
        }));
      }
      if (cells.length) rows.push(new D.TableRow({ children: cells, tableHeader: tr.querySelector('th') ? true : undefined }));
    }
    return new D.Table({ rows, width: { size: 100, type: D.WidthType.PERCENTAGE } });
  }

  async function versDocx() {
    instanceListe = 0;
    const enfants = await blocs(page);
    const m = MARGES[format.marges];
    const ALIGN = { left: D.AlignmentType.LEFT, center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT };
    const runsNumero = () => (entetePied.numero === 'page' ? [new D.TextRun({ children: [D.PageNumber.CURRENT] })]
      : entetePied.numero === 'page-sur' ? [new D.TextRun({ children: ['Page ', D.PageNumber.CURRENT, ' sur ', D.PageNumber.TOTAL_PAGES] })] : []);
    const paraPied = [];
    if (entetePied.pied && entetePied.numero !== 'aucun' && entetePied.alignPied === entetePied.alignNumero) {
      paraPied.push(new D.Paragraph({ alignment: ALIGN[entetePied.alignPied], children: [new D.TextRun(entetePied.pied + '   '), ...runsNumero()] }));
    } else {
      if (entetePied.pied) paraPied.push(new D.Paragraph({ alignment: ALIGN[entetePied.alignPied], children: [new D.TextRun(entetePied.pied)] }));
      if (entetePied.numero !== 'aucun') paraPied.push(new D.Paragraph({ alignment: ALIGN[entetePied.alignNumero], children: runsNumero() }));
    }
    const headers = entetePied.entete ? { default: new D.Header({ children: [new D.Paragraph({ alignment: ALIGN[entetePied.alignEntete], children: [new D.TextRun(entetePied.entete)] })] }) } : undefined;
    const footers = paraPied.length ? { default: new D.Footer({ children: paraPied }) } : undefined;
    const doc = new D.Document({
      creator: 'Labo Élève',
      styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 160, line: 276 } } } } },
      numbering: {
        config: [{
          reference: 'numeros',
          levels: [0, 1, 2, 3].map((l) => ({
            level: l, format: [D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER, D.LevelFormat.LOWER_ROMAN, D.LevelFormat.DECIMAL][l],
            text: `%${l + 1}.`, alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 360 } } },
          })),
        }],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: format.orientation === 'paysage' ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT },
            margin: { top: m.mh * 15, bottom: m.mb * 15, left: m.mg * 15, right: m.md * 15 },
          },
        },
        headers, footers,
        children: enfants.length ? enfants : [new D.Paragraph({ children: [] })],
      }],
    });
    const blob = await D.Packer.toBlob(doc);
    return new Uint8Array(await blob.arrayBuffer());
  }

  // Lecture du format de page d'un .docx (orientation, marges) : le fichier est un zip, on cherche word/document.xml.
  async function lireFormatDocx(octets) {
    try {
      const xml = await texteDuZip(new Uint8Array(octets), 'word/document.xml');
      if (!xml) return;
      const pg = /<w:pgSz[^>]*>/.exec(xml), mar = /<w:pgMar[^>]*>/.exec(xml);
      if (pg) format.orientation = /w:orient="landscape"/.test(pg[0]) ? 'paysage' : 'portrait';
      if (mar) {
        const g = +(/w:left="(\d+)"/.exec(mar[0]) || [])[1] || 1440;
        format.marges = g <= 900 ? 'etroites' : g >= 2400 ? 'larges' : 'normales';
      }
    } catch { /* format par défaut */ }
  }
  // En-tête et pied de page d'un .docx (texte, alignement, numéro de page)
  async function lireEntetePied(octets) {
    Object.assign(entetePied, ENTETE_VIDE);
    try {
      const o = new Uint8Array(octets);
      const lire = async (type) => { for (let i = 1; i <= 6; i++) { const x = await texteDuZip(o, `word/${type}${i}.xml`); if (x && /<w:t[ >]|PAGE/.test(x)) return x; } return null; };
      const paragraphes = (xml) => [...new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagNameNS('*', 'p')].map((p) => {
        const jc = p.getElementsByTagNameNS('*', 'jc')[0], v = jc ? jc.getAttribute('w:val') || '' : '';
        const instr = [...p.getElementsByTagNameNS('*', 'instrText')].map((x) => x.textContent).join(' ') + ' ' + [...p.getElementsByTagNameNS('*', 'fldSimple')].map((x) => x.getAttribute('w:instr')).join(' ');
        return { texte: [...p.getElementsByTagNameNS('*', 't')].map((x) => x.textContent).join(''), align: v === 'center' ? 'center' : v === 'right' || v === 'end' ? 'right' : 'left', page: /\bPAGE\b/.test(instr), total: /NUMPAGES/.test(instr) };
      }).filter((p) => p.texte.trim() || p.page);
      const h = await lire('header');
      if (h) { const ps = paragraphes(h).filter((p) => p.texte.trim()); if (ps.length) { entetePied.entete = ps.map((p) => p.texte.trim()).join(' — '); entetePied.alignEntete = ps[0].align; } }
      const f = await lire('footer');
      if (f) for (const p of paragraphes(f)) {
        if (p.page) {
          entetePied.numero = p.total ? 'page-sur' : 'page'; entetePied.alignNumero = p.align;
          const reste = p.texte.replace(/\bPage\b|\bsur\b|\d+/g, '').trim();
          if (reste) { entetePied.pied = reste; entetePied.alignPied = p.align; }
        } else if (p.texte.trim()) { entetePied.pied = p.texte.trim(); entetePied.alignPied = p.align; }
      }
    } catch { /* en-tête ignoré */ }
  }
  async function texteDuZip(o, cheminVoulu) {
    // Répertoire central du zip
    let fin = o.length - 22;
    while (fin >= 0 && !(o[fin] === 0x50 && o[fin + 1] === 0x4b && o[fin + 2] === 5 && o[fin + 3] === 6)) fin--;
    if (fin < 0) return null;
    const dv = new DataView(o.buffer, o.byteOffset);
    let p = dv.getUint32(fin + 16, true);
    const n = dv.getUint16(fin + 10, true);
    for (let i = 0; i < n; i++) {
      const methode = dv.getUint16(p + 10, true), taille = dv.getUint32(p + 20, true);
      const lnom = dv.getUint16(p + 28, true), lextra = dv.getUint16(p + 30, true), lcom = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const nom = new TextDecoder().decode(o.subarray(p + 46, p + 46 + lnom));
      if (nom === cheminVoulu) {
        const debut = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        const donnees = o.subarray(debut, debut + taille);
        if (methode === 0) return new TextDecoder().decode(donnees);
        const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return await new Response(flux).text();
      }
      p += 46 + lnom + lextra + lcom;
    }
    return null;
  }

  // ---------- Ouverture ----------
  async function ouvrir(nom) {
    const ext = (nom.split('.').pop() || '').toLowerCase();
    try {
      const octets = await Doc.lire(nom);
      if (ext === 'docx') {
        await lireFormatDocx(octets);
        await lireEntetePied(octets);
        // Les équations (Word ou Labo Élève) sont remplacées par des repères, puis recréées modifiables.
        const eq = await Equations.extraireEquations(octets).catch(() => ({ octets, sources: [] }));
        const r = await mammoth.convertToHtml({ arrayBuffer: eq.octets }, {
          styleMap: ['u => u', 'strike => s', "p[style-name='Title'] => h1:fresh", "p[style-name='Titre'] => h1:fresh", "p[style-name='Titre 1'] => h1:fresh", "p[style-name='Titre 2'] => h2:fresh", "p[style-name='Titre 3'] => h3:fresh", "p[style-name='Subtitle'] => h2:fresh"],
          convertImage: mammoth.images.imgElement((img) => img.read('base64').then((b) => ({ src: `data:${img.contentType};base64,${b}` }))),
        });
        page.innerHTML = r.value || '<p><br></p>';
        if (eq.sources.length) page.innerHTML = page.innerHTML.replace(/⟦EQ(\d+)⟧/g, (_, n) => Equations.html(eq.sources[+n] || ''));
        if (page.innerHTML.includes('⟦SAUT⟧')) page.innerHTML = page.innerHTML.replace(/<p>⟦SAUT⟧<\/p>/g, '<hr class="saut-page">').replace(/⟦SAUT⟧/g, '</p><hr class="saut-page"><p>');
        page.querySelectorAll('img').forEach((img) => { if (!img.style.width) img.style.width = '60%'; });
        afficherInfo('Document Word ouvert : certaines mises en forme (polices, couleurs) peuvent être simplifiées.');
      } else if (ext === 'txt') {
        const texte = new TextDecoder().decode(octets);
        page.innerHTML = texte.split(/\r?\n/).map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;') || '<br>'}</p>`).join('');
      } else {
        afficherInfo(ext === 'doc' ? 'Les anciens fichiers .doc ne sont pas pris en charge : enregistre-les d\'abord au format .docx.' : 'Ce type de fichier ne peut pas être ouvert ici.');
        return;
      }
      fichier = { nom: ext === 'docx' ? nom : nom.replace(/\.[^.]+$/, '.docx'), nouveau: false, dejaEnregistre: / - complété\.[^.]+$/.test(nom), modifie: false };
      $('nom-fichier').textContent = nom;
      $('etat-fichier').textContent = fichier.dejaEnregistre ? '' : ' · tes modifications iront dans une copie « - complété »';
    } catch (e) {
      afficherInfo(`Impossible d'ouvrir « ${nom} » : ${e.message}`);
    }
  }
  function afficherInfo(texte) { $('bandeau-info').textContent = texte; $('bandeau-info').hidden = false; }

  // ---------- Enregistrement ----------
  async function enregistrer(sous = false) {
    try {
      let nom, remplacer = true;
      if (sous || (fichier.nouveau && !fichier.dejaEnregistre)) {
        const choisi = await Doc.demanderNom('Enregistrer sous — nom du document', (fichier.nom || 'Mon compte rendu').replace(/\.(docx|txt)$/i, ''));
        if (!choisi) return;
        nom = choisi.replace(/\.docx$/i, '') + '.docx';
        remplacer = false;
      } else {
        nom = Doc.cible(fichier.nom, '.docx', fichier.dejaEnregistre);
      }
      $('etat-fichier').textContent = ' · enregistrement…';
      const final = await Doc.enregistrer(nom, await versDocx(), remplacer);
      fichier = { nom: final, nouveau: false, dejaEnregistre: true, modifie: false };
      $('nom-fichier').textContent = final;
      $('etat-fichier').textContent = ' · enregistré';
      Doc.message(`Enregistré dans Mes documents : ${final}`);
    } catch (e) {
      $('etat-fichier').textContent = ' · non enregistré';
      Doc.message(e.message, 'erreur');
    }
  }

  // ---------- Imprimer / exporter en PDF ----------
  async function exporterPdf() {
    const api = window.parent && window.parent.labo && window.parent.labo.pdf;
    if (!api) return Doc.message('Ouvre le traitement de texte depuis Labo Élève pour créer un PDF.', 'erreur');
    const clone = page.cloneNode(true);
    clone.querySelectorAll('[data-pousse]').forEach((el) => { el.style.marginTop = el.dataset.mt || ''; });
    clone.querySelectorAll('hr.saut-page').forEach((hr) => { hr.outerHTML = '<div style="page-break-after:always"></div>'; });
    clone.querySelectorAll('.equation').forEach((x) => { x.removeAttribute('title'); x.classList.remove('en-edition'); x.querySelectorAll('.eq-source').forEach((s) => s.remove()); });
    const d = dimensions(), pouce = (px) => px / 96;
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const bande = (contenus) => `<div style="font-size:9pt;font-family:Calibri,Arial,sans-serif;color:#555;width:100%;padding:0 ${pouce(d.md)}in 0 ${pouce(d.mg)}in;display:flex">${['left', 'center', 'right'].map((a) => `<span style="flex:1;text-align:${a}">${contenus[a] || ''}</span>`).join('')}</div>`;
    const num = entetePied.numero === 'page' ? '<span class="pageNumber"></span>' : entetePied.numero === 'page-sur' ? 'Page <span class="pageNumber"></span> sur <span class="totalPages"></span>' : '';
    const cases = {};
    if (entetePied.pied) cases[entetePied.alignPied] = esc(entetePied.pied);
    if (num) cases[entetePied.alignNumero] = (cases[entetePied.alignNumero] ? cases[entetePied.alignNumero] + '&nbsp;&nbsp; ' : '') + num;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { margin: 0; font: 11pt/1.15 Calibri, Arial, sans-serif; color: #000; }
      h1 { font-size: 16pt; color: #2f5496; font-weight: 400; margin: 12pt 0 4pt; } h2 { font-size: 13pt; color: #2f5496; font-weight: 400; margin: 10pt 0 3pt; } h3 { font-size: 12pt; color: #1f3763; font-weight: 400; margin: 8pt 0 3pt; }
      p { margin: 0 0 8pt; } ul, ol { margin: 0 0 8pt; padding-left: 36px; }
      table { border-collapse: collapse; width: 100%; margin: 0 0 8pt; } td, th { border: 1px solid #000; padding: 2px 7px; vertical-align: top; text-align: left; }
      img { max-width: 100%; height: auto; } a { color: #0563c1; } math { font-size: 1.12em; }
      p, li, h1, h2, h3, tr, img { break-inside: avoid; }
    </style></head><body>${clone.innerHTML}</body></html>`;
    try {
      Doc.message('Création du PDF…');
      const octets = await api.depuisHtml(html, {
        paysage: format.orientation === 'paysage',
        marges: { haut: pouce(d.mh), bas: pouce(d.mb), gauche: pouce(d.mg), droite: pouce(d.md) },
        entete: entetePied.entete ? bande({ [entetePied.alignEntete]: esc(entetePied.entete) }) : '',
        pied: Object.keys(cases).length ? bande(cases) : '',
      });
      const base = (fichier.nom || 'Document1').replace(/\.[^.]+$/, '');
      const nom = await Doc.enregistrer(`${base}.pdf`, octets, false);
      Doc.message(`PDF enregistré dans Mes documents : ${nom}`);
    } catch (err) { Doc.message(`PDF impossible : ${err.message}`, 'erreur'); }
  }

  window.laboAvantFermeture = () => !fichier.modifie || confirm('Ton document n\'est pas enregistré. Quitter quand même ?');
  window.laboVersDocx = versDocx; // utilisé par les tests

  // ---------- Démarrage ----------
  (async () => {
    const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    Object.assign(window.IconesOffice, {
      ouvrir: svg('<path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v2H3z"/><path d="M3 10h18l-2 9H5z"/>'),
      corbeille: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
      clavier: svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>'),
    });
    Ruban.installer();
    const aOuvrir = new URLSearchParams(location.search).get('ouvrir');
    if (aOuvrir) await ouvrir(aOuvrir);
    else page.innerHTML = '<p><br></p>';
    appliquerFormat();
    fixerZoom(1);
    compter();
    page.focus();
  })();
})();
