// Tableur de Labo Élève, présenté comme les tableurs courants (ruban, Zone Nom, barre de formule,
// poignée de recopie, clic droit, onglets de feuilles) pour que les élèves gardent leurs repères.
// Fichiers : .xlsx (avec mise en forme, via ExcelJS), .xls / .ods / .csv en lecture (SheetJS), .csv en écriture.
(function () {
  const F = window.Formules;
  const $ = (id) => document.getElementById(id);
  const cle = (l, c) => l + ',' + c;
  const LARGEUR = 84;      // largeur d'une colonne par défaut (px)
  const LIGNE = 23;        // hauteur d'une ligne (px)

  // ---------- Données ----------
  const nouvelleFeuille = (nom) => ({ nom, cellules: new Map(), styles: new Map(), largeurs: {}, hauteurs: {}, fusions: [], masquesL: [], masquesC: [], figer: null, filtre: null });
  const STRUCTURE = ['hauteurs', 'fusions', 'masquesL', 'masquesC', 'figer', 'filtre'];
  let classeur = { feuilles: [nouvelleFeuille('Feuil1')], graphiques: [] };
  let active = 0;
  let nbLignes = 60, nbCols = 18;
  const sel = { l: 0, c: 0, l2: 0, c2: 0 };
  let fichier = { nom: null, nouveau: true, dejaEnregistre: false, modifie: false };
  let zoom = 1;
  const historique = [], refaire = [];

  const feuille = () => classeur.feuilles[active];
  const brut = (l, c, f = feuille()) => f.cellules.get(cle(l, c)) ?? '';
  const styleDe = (l, c, f = feuille()) => f.styles.get(cle(l, c)) || null;
  const largeurCol = (c) => feuille().largeurs[c] || LARGEUR;
  const largeurAffichee = (c) => (feuille().masquesC.includes(c) ? 4 : largeurCol(c));
  const hauteurLig = (l) => feuille().hauteurs[l] || LIGNE;
  const fusionDe = (l, c, f = feuille()) => f.fusions.find((m) => l >= m.l1 && l <= m.l2 && c >= m.c1 && c <= m.c2) || null;
  // Dates saisies en jj/mm/aaaa : numéro de série (comme les tableurs), pour pouvoir calculer des durées.
  const DATE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/;
  const ORIGINE = Date.UTC(1899, 11, 30);
  function serieDate(texte) {
    const m = DATE.exec(texte);
    let a = +m[3]; if (a < 100) a += 2000;
    return Math.round((Date.UTC(a, +m[2] - 1, +m[1]) - ORIGINE) / 86_400_000);
  }
  function texteDate(serie) {
    const d = new Date(ORIGINE + Math.round(serie) * 86_400_000);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }
  // Style utilisé pour l'affichage (une date tapée s'affiche en date même sans format choisi)
  const styleAffiche = (l, c, f = feuille()) => { const st = f.styles.get(cle(l, c)); return st && st.fmt ? st : DATE.test(brut(l, c, f)) ? { ...(st || {}), fmt: 'date' } : st || null; };

  // ---------- Calcul ----------
  let valeurs = new Map();
  let enCours = new Set();
  const NOMBRE = /^\s*[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?\s*$/;
  const POURCENT = /^\s*[-+]?(\d+([.,]\d*)?|[.,]\d+)\s*%\s*$/;
  // Nombres écrits avec des espaces entre les milliers (« 1 234,5 ») ou suivis de € (« 12,50 € »)
  const MILLIERS = /^\s*[-+]?\d{1,3}(\s\d{3})+([.,]\d+)?\s*$/;
  const MONNAIE = /^\s*[-+]?(\d{1,3}(\s\d{3})+|\d+)([.,]\d+)?\s*€\s*$/;
  // Espaces insécables (Excel en français les utilise pour les milliers) → espaces ordinaires ; bords nettoyés.
  const nettoyerColle = (t) => String(t ?? '').replace(/[    ]/g, ' ').replace(/\r/g, '').trim();

  function valeur(l, c) {
    const k = cle(l, c);
    if (valeurs.has(k)) { const v = valeurs.get(k); if (v instanceof F.ErreurCellule) throw v; return v; }
    const r = brut(l, c);
    let v;
    const rn = r.replace(/[    ]/g, ' ');
    if (rn.trim() === '') v = null; // une cellule qui ne contient que des espaces compte comme vide
    else if (MILLIERS.test(rn)) v = parseFloat(rn.replace(/\s/g, '').replace(',', '.'));
    else if (MONNAIE.test(rn)) v = parseFloat(rn.replace(/[\s€]/g, '').replace(',', '.'));
    else if (r[0] === '=') {
      if (enCours.has(k)) throw new F.ErreurCellule('#CYCLE!');
      enCours.add(k);
      try { v = F.evaluer(r.slice(1), valeur, active + '!' + k); } catch (e) { v = e instanceof F.ErreurCellule ? e : new F.ErreurCellule('#VALEUR!'); }
      enCours.delete(k);
    } else if (NOMBRE.test(r)) v = parseFloat(r.replace(',', '.'));
    else if (POURCENT.test(r)) v = parseFloat(r.replace(',', '.')) / 100;
    else if (DATE.test(r)) v = serieDate(r);
    else if (/^(vrai|faux)$/i.test(r.trim())) v = /^vrai$/i.test(r.trim());
    else v = r;
    valeurs.set(k, v);
    if (v instanceof F.ErreurCellule) throw v;
    return v;
  }
  function valeurSure(l, c) {
    try { return valeur(l, c); } catch (e) { return e instanceof F.ErreurCellule ? e : new F.ErreurCellule('#VALEUR!'); }
  }
  function afficher(v, st = null) {
    if (v === null || v === undefined) return '';
    if (v instanceof F.ErreurCellule) return v.code;
    if (typeof v === 'number') {
      if (st && st.fmt === 'date') return texteDate(v);
      if (st && st.fmt === 'monetaire') { const d = st.d ?? 2; return v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €'; }
      if (st && st.fmt === 'pourcentage') { const d = st.d ?? 0; return (v * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %'; }
      if (st && (st.fmt === 'nombre' || st.d != null)) { const d = st.d ?? 2; return v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: st.fmt === 'nombre' }); }
      return Number(v.toPrecision(10)).toLocaleString('fr-FR', { maximumFractionDigits: 10, useGrouping: false });
    }
    if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
    return String(v);
  }

  // ---------- Annulation (instantanés de la feuille) ----------
  const instantane = () => ({ feuille: active, cellules: new Map(feuille().cellules), styles: new Map(feuille().styles), largeurs: { ...feuille().largeurs }, structure: JSON.stringify(Object.fromEntries(STRUCTURE.map((k) => [k, feuille()[k]]))), graphiques: JSON.stringify(classeur.graphiques) });
  function memoriser() { historique.push(instantane()); if (historique.length > 100) historique.shift(); refaire.length = 0; }
  function restaurer(i) {
    active = i.feuille;
    Object.assign(feuille(), { cellules: i.cellules, styles: i.styles, largeurs: i.largeurs }, JSON.parse(i.structure));
    classeur.graphiques = JSON.parse(i.graphiques);
    afficherOnglets(); construire(); marquerModifie();
  }
  function annuler() { const i = historique.pop(); if (!i) return; refaire.push(instantane()); restaurer(i); }
  function retablir() { const i = refaire.pop(); if (!i) return; historique.push(instantane()); restaurer(i); }

  function marquerModifie() { fichier.modifie = true; $('etat-fichier').textContent = ' · non enregistré'; }

  // Modifie des cellules (avec annulation) : [{ l, c, v }]
  function modifier(changements) {
    memoriser();
    F.nouvelleGraine(); // comme dans Excel : chaque modification refait les tirages au hasard (ALEA…)
    const f = feuille();
    for (const { l, c, v } of changements) { if (v === '' || v === null) f.cellules.delete(cle(l, c)); else f.cellules.set(cle(l, c), String(v)); }
    marquerModifie();
    const lMax = Math.max(...changements.map((x) => x.l)), cMax = Math.max(...changements.map((x) => x.c));
    if (lMax >= nbLignes - 3 || cMax >= nbCols - 1) construire(); else rafraichir();
  }
  // Applique une mise en forme à la sélection
  function styliser(fn) {
    memoriser();
    const b = bornes(), f = feuille();
    for (let l = b.l1; l <= b.l2; l++) for (let c = b.c1; c <= b.c2; c++) {
      const st = { ...(f.styles.get(cle(l, c)) || {}) };
      fn(st, l, c, b);
      for (const k of Object.keys(st)) if (st[k] === undefined || st[k] === null || st[k] === false) delete st[k];
      if (st.bord && !Object.values(st.bord).some(Boolean)) delete st.bord;
      if (Object.keys(st).length) f.styles.set(cle(l, c), st); else f.styles.delete(cle(l, c));
    }
    marquerModifie();
    rafraichir();
  }

  // ---------- Grille ----------
  const grille = $('grille');
  function etendre() {
    let lMax = 0, cMax = 0;
    for (const k of feuille().cellules.keys()) { const [l, c] = k.split(',').map(Number); lMax = Math.max(lMax, l); cMax = Math.max(cMax, c); }
    nbLignes = Math.max(60, lMax + 25, sel.l2 + 10, sel.l + 10);
    nbCols = Math.max(18, cMax + 4, sel.c2 + 3, sel.c + 3);
  }
  function construire() {
    etendre();
    let html = `<colgroup><col style="width:40px">${Array.from({ length: nbCols }, (_, c) => `<col style="width:${largeurAffichee(c)}px">`).join('')}</colgroup><thead><tr><th></th>`;
    for (let c = 0; c < nbCols; c++) html += `<th data-col="${c}" class="${feuille().masquesC.includes(c) ? 'masquee' : ''}" style="position:sticky">${F.colVersLettres(c)}<span class="poignee-col" data-largeur="${c}"></span></th>`;
    html += '</tr></thead><tbody>';
    for (let l = 0; l < nbLignes; l++) {
      html += `<tr style="height:${hauteurLig(l)}px"><th data-lig="${l}">${l + 1}<span class="poignee-lig" data-hauteur="${l}"></span></th>`;
      for (let c = 0; c < nbCols; c++) html += `<td data-l="${l}" data-c="${c}"></td>`;
      html += '</tr>';
    }
    grille.innerHTML = html + '</tbody>';
    rafraichir();
  }
  const td = (l, c) => grille.rows[l + 1] && grille.rows[l + 1].cells[c + 1];

  function rafraichir() {
    valeurs = new Map(); enCours = new Set();
    const f = feuille();
    const couverts = new Set(), ancres = new Map();
    for (const m of f.fusions) {
      ancres.set(cle(m.l1, m.c1), m);
      for (let l = m.l1; l <= m.l2; l++) for (let c = m.c1; c <= m.c2; c++) if (l !== m.l1 || c !== m.c1) couverts.add(cle(l, c));
    }
    const filtrees = lignesFiltrees();
    for (let l = 0; l < nbLignes; l++) {
      const tr = grille.rows[l + 1];
      tr.style.display = f.masquesL.includes(l) || filtrees.has(l) ? 'none' : '';
      tr.style.height = hauteurLig(l) + 'px';
      for (let c = 0; c < nbCols; c++) {
        const cellule = td(l, c);
        const r = brut(l, c);
        const st = styleAffiche(l, c);
        cellule.removeAttribute('style');
        cellule.title = '';
        const m = ancres.get(cle(l, c));
        cellule.colSpan = m ? m.c2 - m.c1 + 1 : 1;
        cellule.rowSpan = m ? m.l2 - m.l1 + 1 : 1;
        if (couverts.has(cle(l, c))) cellule.style.display = 'none';
        if (r === '') { if (cellule.textContent) cellule.textContent = ''; cellule.className = ''; }
        else {
          const v = valeurSure(l, c);
          cellule.textContent = afficher(v, st);
          cellule.className = v instanceof F.ErreurCellule ? 'erreur' : typeof v === 'number' ? 'nombre' : '';
          if (v instanceof F.ErreurCellule) cellule.title = explicationErreur(v.code);
        }
        if (st) {
          const s = cellule.style;
          if (st.g) s.fontWeight = '700';
          if (st.i) s.fontStyle = 'italic';
          if (st.s) s.textDecoration = 'underline';
          if (st.couleur) s.color = st.couleur;
          if (st.fond) s.backgroundColor = st.fond;
          if (st.a) s.textAlign = st.a;
          if (st.police) s.fontFamily = `"${st.police}", Calibri, sans-serif`;
          if (st.t) s.fontSize = st.t + 'pt';
          if (st.w) cellule.classList.add('renvoi');
          if (st.bord) {
            const t = '1px solid #222';
            if (st.bord.h) s.borderTop = t;
            if (st.bord.b) s.borderBottom = t;
            if (st.bord.g) s.borderLeft = t;
            if (st.bord.d) s.borderRight = t;
          }
        }
      }
    }
    for (const c of f.masquesC) for (let l = 0; l < nbLignes; l++) td(l, c)?.classList.add('masquee');
    afficherFiltre();
    appliquerFiger();
    afficherSelection();
    rafraichirGraphiques();
  }
  function explicationErreur(code) {
    return {
      '#DIV/0!': 'Division par zéro', '#NOM?': 'Formule mal écrite ou fonction inconnue', '#VALEUR!': 'Une valeur n\'est pas un nombre',
      '#REF!': 'Référence de cellule invalide', '#CYCLE!': 'La formule utilise sa propre cellule (référence circulaire)', '#NOMBRE!': 'Résultat impossible',
    }[code] || code;
  }

  function bornes() {
    let b = { l1: Math.min(sel.l, sel.l2), l2: Math.max(sel.l, sel.l2), c1: Math.min(sel.c, sel.c2), c2: Math.max(sel.c, sel.c2) };
    for (let encore = true; encore;) {
      encore = false;
      for (const m of feuille().fusions) {
        if (m.l1 <= b.l2 && m.l2 >= b.l1 && m.c1 <= b.c2 && m.c2 >= b.c1 && (m.l1 < b.l1 || m.l2 > b.l2 || m.c1 < b.c1 || m.c2 > b.c2)) {
          b = { l1: Math.min(b.l1, m.l1), l2: Math.max(b.l2, m.l2), c1: Math.min(b.c1, m.c1), c2: Math.max(b.c2, m.c2) };
          encore = true;
        }
      }
    }
    return b;
  }
  function rectangle(b) {
    const a = td(b.l1, b.c1);
    const mz = fusionDe(b.l2, b.c2);
    const z = mz ? td(mz.l1, mz.c1) : td(b.l2, b.c2);
    if (!a || !z) return null;
    return { left: a.offsetLeft, top: a.offsetTop, width: z.offsetLeft + z.offsetWidth - a.offsetLeft, height: z.offsetTop + z.offsetHeight - a.offsetTop };
  }
  function afficherSelection() {
    grille.querySelectorAll('.dans-selection').forEach((e) => e.classList.remove('dans-selection'));
    grille.querySelectorAll('th.actif').forEach((e) => e.classList.remove('actif'));
    const b = bornes();
    for (let l = b.l1; l <= b.l2; l++) for (let c = b.c1; c <= b.c2; c++) if (l !== sel.l || c !== sel.c) td(l, c)?.classList.add('dans-selection');
    for (let c = b.c1; c <= b.c2; c++) grille.rows[0].cells[c + 1]?.classList.add('actif');
    for (let l = b.l1; l <= b.l2; l++) grille.rows[l + 1]?.cells[0].classList.add('actif');
    const r = rectangle(b), cadre = $('cadre-selection');
    if (r) { cadre.hidden = false; Object.assign(cadre.style, { left: r.left - 1 + 'px', top: r.top - 1 + 'px', width: r.width + 1 + 'px', height: r.height + 1 + 'px' }); }
    if (document.activeElement !== $('zone-nom')) $('zone-nom').value = b.l1 === b.l2 && b.c1 === b.c2 ? F.nomCellule(sel.l, sel.c) : `${F.nomCellule(b.l1, b.c1)}:${F.nomCellule(b.l2, b.c2)}`;
    if (document.activeElement !== $('saisie-formule')) $('saisie-formule').value = brut(sel.l, sel.c);
    majRuban();
    resumer(b);
  }
  function majRuban() {
    const st = styleDe(sel.l, sel.c) || {};
    document.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('actif', !!st[b.dataset.style]));
    document.querySelectorAll('[data-align]').forEach((b) => b.classList.toggle('actif', st.a === b.dataset.align));
    $('nom-police').value = st.police || 'Calibri';
    $('taille-police').value = String(st.t || 11);
    $('btn-renvoi').classList.toggle('actif', !!st.w);
    $('btn-fusion').classList.toggle('actif', !!fusionDe(sel.l, sel.c));
    $('btn-filtrer').classList.toggle('actif', !!feuille().filtre);
    $('format-nombre').value = (styleAffiche(sel.l, sel.c) || {}).fmt || 'standard';
  }
  function resumer(b) {
    const nombres = [];
    for (let l = b.l1; l <= b.l2; l++) for (let c = b.c1; c <= b.c2; c++) { const v = valeurSure(l, c); if (typeof v === 'number') nombres.push(v); }
    if (nombres.length < 2) { $('resume-selection').textContent = ''; return; }
    const s = nombres.reduce((a, x) => a + x, 0);
    $('resume-selection').textContent = `Moyenne : ${afficher(s / nombres.length)}    Nb (non vides) : ${nombres.length}    Somme : ${afficher(s)}`;
  }
  function voirCellule(l, c) {
    const cellule = td(l, c);
    if (!cellule) return;
    const zone = $('zone-grille');
    const x = cellule.offsetLeft * zoom, y = cellule.offsetTop * zoom, w = cellule.offsetWidth * zoom, h = cellule.offsetHeight * zoom;
    if (y + h > zone.scrollTop + zone.clientHeight) zone.scrollTop = y + h - zone.clientHeight + 4;
    if (y < zone.scrollTop + 24 * zoom) zone.scrollTop = Math.max(0, y - 24 * zoom);
    if (x + w > zone.scrollLeft + zone.clientWidth) zone.scrollLeft = x + w - zone.clientWidth + 4;
    if (x < zone.scrollLeft + 40 * zoom) zone.scrollLeft = Math.max(0, x - 40 * zoom);
  }
  function deplacer(l, c, etendreSel = false) {
    l = Math.max(0, l); c = Math.max(0, c);
    const m = !etendreSel && fusionDe(l, c);
    if (m) { l = m.l1; c = m.c1; }
    if (etendreSel) { sel.l2 = l; sel.c2 = c; } else { sel.l = sel.l2 = l; sel.c = sel.c2 = c; }
    if (l >= nbLignes - 3 || c >= nbCols - 1) construire();
    afficherSelection();
    voirCellule(etendreSel ? sel.l2 : sel.l, etendreSel ? sel.c2 : sel.c);
  }
  const mode = (t) => { $('mode-saisie').textContent = t; };

  // ---------- Saisie ----------
  const editeur = $('editeur');
  const barre = $('saisie-formule');
  let edition = null; // { l, c, depuis: 'cellule' | 'barre' }
  function commencerEdition(texteInitial = null) {
    const cellule = td(sel.l, sel.c);
    edition = { l: sel.l, c: sel.c, depuis: 'cellule' };
    Object.assign(editeur.style, { left: cellule.offsetLeft + 'px', top: cellule.offsetTop + 'px', width: Math.max(cellule.offsetWidth, 150) + 'px', height: cellule.offsetHeight + 'px' });
    editeur.value = texteInitial !== null ? texteInitial : brut(sel.l, sel.c);
    editeur.hidden = false;
    editeur.focus();
    editeur.setSelectionRange(editeur.value.length, editeur.value.length);
    // Curseur replacé à la fin une fois la touche traitée (Windows peut le déplacer pendant l'ouverture).
    const finSaisie = () => { if (edition && document.activeElement === editeur && editeur.selectionStart === 0 && editeur.selectionEnd === 0 && editeur.value) editeur.setSelectionRange(editeur.value.length, editeur.value.length); };
    setTimeout(finSaisie, 0);
    requestAnimationFrame(finSaisie);
    barre.value = editeur.value;
    mode(texteInitial !== null ? 'Entrer' : 'Modifier');
    majReferences();
  }
  function valeurEnCours() { return edition && edition.depuis === 'barre' ? barre.value : editeur.value; }
  function validerEdition(dl = 0, dc = 0) {
    if (!edition) return;
    const { l, c } = edition;
    const v = valeurEnCours();
    edition = null; refInseree = null;
    effacerReferences();
    editeur.hidden = true;
    mode('Prêt');
    if (v !== brut(l, c)) modifier([{ l, c, v: normaliserSaisie(v) }]);
    deplacer(l + dl, c + dc);
    $('zone-grille').focus();
  }
  function annulerEdition() {
    edition = null; refInseree = null;
    effacerReferences();
    editeur.hidden = true;
    mode('Prêt');
    afficherSelection();
    $('zone-grille').focus();
  }
  function normaliserSaisie(v) {
    if (v[0] !== '=') return v;
    return v.replace(/("(?:[^"]|"")*")|([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_.]*)(?=\s*\()|(\$?[a-z]{1,3}\$?\d+)/g, (t, texte, fn, ref) => texte || (fn ? fn.toUpperCase() : ref.toUpperCase()));
  }
  editeur.addEventListener('input', () => { barre.value = editeur.value; majReferences(); });
  barre.addEventListener('input', () => { if (edition) { editeur.value = barre.value; majReferences(); } });
  editeur.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); validerEdition(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Tab') { e.preventDefault(); validerEdition(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); annulerEdition(); }
    else if (e.key.length === 1 || e.key === 'Backspace') refInseree = null;
  });
  editeur.addEventListener('blur', () => { if (edition && edition.depuis === 'cellule' && !clicPourReference) validerEdition(); });

  barre.addEventListener('focus', () => { edition = { l: sel.l, c: sel.c, depuis: 'barre' }; editeur.hidden = true; mode('Modifier'); majReferences(); });
  barre.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); validerEdition(1, 0); }
    else if (e.key === 'Escape') { e.preventDefault(); barre.value = brut(sel.l, sel.c); annulerEdition(); }
  });
  $('btn-valider-saisie').addEventListener('mousedown', (e) => e.preventDefault());
  $('btn-valider-saisie').addEventListener('click', () => { if (edition) validerEdition(0, 0); });
  $('btn-annuler-saisie').addEventListener('mousedown', (e) => e.preventDefault());
  $('btn-annuler-saisie').addEventListener('click', () => { if (edition) { barre.value = brut(sel.l, sel.c); annulerEdition(); } });

  // Zone Nom : aller à une cellule ou une plage (ex. B5 ou A1:C10)
  $('zone-nom').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const [a, z] = e.target.value.trim().toUpperCase().split(':');
    const p = F.lireRef(a || ''), q = z ? F.lireRef(z) : p;
    if (!p || !q) { Doc.message('Adresse inconnue : écris par exemple B5 ou A1:C10', 'erreur'); return; }
    sel.l = p.l; sel.c = p.c; sel.l2 = q.l; sel.c2 = q.c;
    if (Math.max(p.l, q.l) >= nbLignes - 3 || Math.max(p.c, q.c) >= nbCols - 1) construire();
    afficherSelection(); voirCellule(sel.l, sel.c);
    $('zone-grille').focus();
  });

  // ---------- Souris : sélection, références, poignée de recopie, largeur des colonnes ----------
  let glisse = null; // 'selection' | 'reference' | 'recopie' | { largeur }
  let clicPourReference = false;
  let refInseree = null;
  // Position du curseur dans le champ de saisie. Sur certains PC (aide à la saisie de Windows), juste après
  // l'ouverture de la cellule par une touche, le curseur est annoncé au début : dans une formule, on le
  // considère alors à la fin (là où l'élève vient de taper « = »).
  function positionCurseur(champ) {
    const p = champ.selectionStart;
    if (p === null || p === undefined || document.activeElement !== champ) return champ.value.length;
    if (p === 0 && champ.selectionEnd === 0 && champ.value.startsWith('=')) return champ.value.length;
    return p;
  }
  const enFormule = () => {
    if (!edition) return false;
    const champ = edition.depuis === 'barre' ? barre : editeur;
    return champ.value.startsWith('=') && /[=(;,+\-*/^:&<>]$/.test(champ.value.slice(0, positionCurseur(champ)).trimEnd());
  };
  let cibleRecopie = null;

  grille.addEventListener('mousedown', (e) => {
    if (e.button === 2) return; // clic droit : menu contextuel
    const boutonFiltre = e.target.closest('[data-filtre-col]');
    if (boutonFiltre) { e.preventDefault(); e.stopPropagation(); if (edition) validerEdition(0, 0); ouvrirFiltre(+boutonFiltre.dataset.filtreCol, boutonFiltre); return; }
    const poigneeLig = e.target.closest('[data-hauteur]');
    if (poigneeLig) {
      const l = +poigneeLig.dataset.hauteur;
      glisse = { hauteur: l, y: e.clientY, depart: hauteurLig(l) };
      e.preventDefault(); e.stopPropagation();
      return;
    }
    const poigneeCol = e.target.closest('[data-largeur]');
    if (poigneeCol) {
      const c = +poigneeCol.dataset.largeur;
      glisse = { largeur: c, x: e.clientX, depart: largeurCol(c) };
      e.preventDefault(); e.stopPropagation();
      return;
    }
    const cellule = e.target.closest('td'), entete = e.target.closest('th');
    if (cellule) {
      const l = +cellule.dataset.l, c = +cellule.dataset.c;
      if (enFormule() || (refInseree && edition)) {
        e.preventDefault();
        clicPourReference = true;
        insererReference(l, c, e.shiftKey);
        glisse = 'reference';
        return;
      }
      if (edition) validerEdition(0, 0);
      deplacer(l, c, e.shiftKey);
      glisse = 'selection';
      $('zone-grille').focus();
      e.preventDefault();
    } else if (entete) {
      if (edition) validerEdition(0, 0);
      if (entete.dataset.col !== undefined) { sel.l = 0; sel.l2 = nbLignes - 1; sel.c = sel.c2 = +entete.dataset.col; }
      else if (entete.dataset.lig !== undefined) { sel.c = 0; sel.c2 = nbCols - 1; sel.l = sel.l2 = +entete.dataset.lig; }
      else { sel.l = sel.c = 0; sel.l2 = nbLignes - 1; sel.c2 = nbCols - 1; }
      afficherSelection();
      $('zone-grille').focus();
      e.preventDefault();
    }
  });
  $('poignee').addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (edition) validerEdition(0, 0);
    glisse = 'recopie';
    cibleRecopie = null;
  });
  grille.addEventListener('mouseover', (e) => {
    if (!glisse || typeof glisse === 'object') return;
    const cellule = e.target.closest('td');
    if (!cellule) return;
    const l = +cellule.dataset.l, c = +cellule.dataset.c;
    if (glisse === 'reference') insererReference(l, c, true);
    else if (glisse === 'selection') { sel.l2 = l; sel.c2 = c; afficherSelection(); }
    else if (glisse === 'recopie') {
      const b = bornes();
      // Comme dans les tableurs : on étend dans la direction où l'on s'éloigne le plus.
      const bas = l - b.l2, droite = c - b.c2;
      cibleRecopie = bas >= droite && bas > 0 ? { ...b, l2: l } : droite > 0 ? { ...b, c2: c } : null;
      const cadre = $('cadre-recopie');
      const r = cibleRecopie && rectangle(cibleRecopie);
      cadre.hidden = !r;
      if (r) Object.assign(cadre.style, { left: r.left - 1 + 'px', top: r.top - 1 + 'px', width: r.width + 1 + 'px', height: r.height + 1 + 'px' });
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (glisse && typeof glisse === 'object' && glisse.hauteur !== undefined) {
      const h = Math.max(8, Math.round(glisse.depart + (e.clientY - glisse.y) / zoom));
      grille.rows[glisse.hauteur + 1].style.height = h + 'px';
      glisse.nouvelle = h;
      afficherSelection();
    } else if (glisse && typeof glisse === 'object') {
      const w = Math.max(24, Math.round(glisse.depart + (e.clientX - glisse.x) / zoom));
      grille.querySelectorAll('col')[glisse.largeur + 1].style.width = w + 'px';
      glisse.nouvelle = w;
      afficherSelection();
    }
  });
  document.addEventListener('mouseup', () => {
    if (glisse === 'reference') setTimeout(() => { clicPourReference = false; (edition && edition.depuis === 'barre' ? barre : editeur).focus(); }, 0);
    if (glisse === 'recopie') { $('cadre-recopie').hidden = true; if (cibleRecopie) recopier(bornes(), cibleRecopie); }
    if (glisse && typeof glisse === 'object' && glisse.nouvelle) {
      memoriser();
      if (glisse.hauteur !== undefined) feuille().hauteurs[glisse.hauteur] = glisse.nouvelle; else feuille().largeurs[glisse.largeur] = glisse.nouvelle;
      marquerModifie();
    }
    glisse = null;
  });
  grille.addEventListener('dblclick', (e) => {
    const p = e.target.closest('[data-largeur]');
    if (p) { memoriser(); delete feuille().largeurs[+p.dataset.largeur]; construire(); return; }
    const ph = e.target.closest('[data-hauteur]');
    if (ph) { memoriser(); delete feuille().hauteurs[+ph.dataset.hauteur]; construire(); return; }
    if (e.target.closest('td')) commencerEdition();
  });

  function insererReference(l, c, plage) {
    const champ = edition && edition.depuis === 'barre' ? barre : editeur;
    const v = champ.value;
    if (!refInseree || !plage) { const pos = positionCurseur(champ); refInseree = { debut: pos, fin: pos, ancre: { l, c } }; }
    const a = refInseree.ancre;
    const texte = plage && (a.l !== l || a.c !== c)
      ? `${F.nomCellule(Math.min(a.l, l), Math.min(a.c, c))}:${F.nomCellule(Math.max(a.l, l), Math.max(a.c, c))}`
      : F.nomCellule(l, c);
    champ.value = v.slice(0, refInseree.debut) + texte + v.slice(refInseree.fin);
    refInseree.fin = refInseree.debut + texte.length;
    champ.setSelectionRange(refInseree.fin, refInseree.fin);
    if (champ === editeur) barre.value = editeur.value;
    majReferences();
  }

  // ---------- Références en couleur (comme dans les tableurs) ----------
  // Pendant la saisie d'une formule, chaque référence (B2, A1:A10…) a sa couleur, dans la cellule et la barre
  // de formule, et la cellule ou la plage correspondante est entourée de la même couleur sur la grille.
  const COULEURS_REF = ['#2f62d0', '#d1343b', '#7a3fc0', '#1f8a3e', '#c4580f', '#0f8ba6', '#b8337a'];
  const MOTIF_REF = /("(?:[^"]|"")*")|(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![\w(])/g;
  function referencesDe(texte) {
    const liste = [];
    if (!texte.startsWith('=')) return liste;
    MOTIF_REF.lastIndex = 0;
    let m;
    while ((m = MOTIF_REF.exec(texte))) {
      if (m[1]) continue; // texte entre guillemets
      const a = F.lireRef(m[2].replace(/\$/g, '')), b = m[3] ? F.lireRef(m[3].replace(/\$/g, '')) : a;
      if (!a || !b) continue;
      liste.push({ debut: m.index, fin: m.index + m[0].length, texte: m[0].toUpperCase().replace(/\$/g, ''), b: { l1: Math.min(a.l, b.l), l2: Math.max(a.l, b.l), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) } });
    }
    // Une même référence garde la même couleur.
    const couleurs = new Map();
    for (const r of liste) { if (!couleurs.has(r.texte)) couleurs.set(r.texte, COULEURS_REF[couleurs.size % COULEURS_REF.length]); r.couleur = couleurs.get(r.texte); }
    return liste;
  }
  const echapperHtml = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  // Texte coloré affiché sous le champ (le texte du champ est rendu transparent, le curseur reste visible).
  const miroirs = new Map();
  function miroirDe(champ) {
    if (!miroirs.has(champ)) {
      const m = document.createElement('div');
      m.className = 'miroir-formule';
      m.innerHTML = '<span></span>';
      champ.parentElement.insertBefore(m, champ);
      champ.addEventListener('scroll', () => majMiroir(champ));
      champ.addEventListener('keyup', () => majMiroir(champ));
      champ.addEventListener('click', () => majMiroir(champ));
      miroirs.set(champ, m);
    }
    return miroirs.get(champ);
  }
  function majMiroir(champ, refs = null) {
    const m = miroirs.get(champ);
    if (!m || m.hidden) return;
    const v = champ.value;
    refs = refs || referencesDe(v);
    let html = '', i = 0;
    for (const r of refs) { html += echapperHtml(v.slice(i, r.debut)) + `<span style="color:${r.couleur}">${echapperHtml(v.slice(r.debut, r.fin))}</span>`; i = r.fin; }
    html += echapperHtml(v.slice(i));
    const cs = getComputedStyle(champ);
    for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'borderLeftWidth', 'borderRightWidth', 'borderTopWidth', 'borderBottomWidth', 'boxSizing']) m.style[p] = cs[p];
    Object.assign(m.style, { left: champ.offsetLeft + 'px', top: champ.offsetTop + 'px', width: champ.offsetWidth + 'px', height: champ.offsetHeight + 'px' });
    m.firstChild.innerHTML = html || '&#8203;';
    m.firstChild.style.transform = `translateX(${-champ.scrollLeft}px)`;
  }
  let cadresRef = [];
  function effacerReferences() {
    cadresRef.forEach((c) => c.remove());
    cadresRef = [];
    for (const [champ, m] of miroirs) { m.hidden = true; champ.classList.remove('formule-coloree'); }
  }
  function majReferences() {
    if (!edition) return effacerReferences();
    const champ = edition.depuis === 'barre' ? barre : editeur, autre = champ === barre ? editeur : barre;
    const refs = referencesDe(champ.value);
    cadresRef.forEach((c) => c.remove());
    cadresRef = refs.map((r) => {
      const rect = rectangle(r.b);
      if (!rect) return null;
      const c = document.createElement('div');
      c.className = 'cadre-reference';
      Object.assign(c.style, { left: rect.left - 1 + 'px', top: rect.top - 1 + 'px', width: rect.width + 1 + 'px', height: rect.height + 1 + 'px', borderColor: r.couleur, background: r.couleur + '14' });
      $('contenu-grille').append(c);
      return c;
    }).filter(Boolean);
    for (const x of [champ, autre]) {
      const visible = refs.length > 0 && !(x === editeur && editeur.hidden);
      const m = miroirDe(x);
      m.hidden = !visible;
      x.classList.toggle('formule-coloree', visible);
      if (visible) majMiroir(x, x === champ ? refs : referencesDe(x.value));
    }
  }

  // ---------- F4 : référence relative ou absolue (B2 → $B$2 → B$2 → $B2 → B2) ----------
  function basculerAbsolu(champ) {
    const v = champ.value, p = champ.selectionStart;
    MOTIF_REF.lastIndex = 0;
    let m;
    while ((m = MOTIF_REF.exec(v))) {
      if (m[1] || p < m.index || p > m.index + m[0].length) continue;
      const cycle = (ref) => {
        const x = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(ref);
        const etat = (x[1] ? 2 : 0) + (x[3] ? 1 : 0); // 0 : B2, 3 : $B$2, 1 : B$2, 2 : $B2
        const suivant = { 0: 3, 3: 1, 1: 2, 2: 0 }[etat];
        return `${suivant & 2 ? '$' : ''}${x[2].toUpperCase()}${suivant & 1 ? '$' : ''}${x[4]}`;
      };
      const nouveau = cycle(m[2]) + (m[3] ? ':' + cycle(m[3]) : '');
      champ.value = v.slice(0, m.index) + nouveau + v.slice(m.index + m[0].length);
      const fin = m.index + nouveau.length;
      champ.setSelectionRange(fin, fin);
      champ.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }
  for (const champ of [editeur, barre]) {
    champ.addEventListener('keydown', (e) => {
      if (e.key !== 'F4' || !champ.value.startsWith('=')) return;
      e.preventDefault();
      if (!basculerAbsolu(champ)) Doc.message('Place le curseur sur une référence (ex. B2) puis appuie sur F4.');
    });
  }

  // Poignée de recopie : suite de nombres prolongée (0 ; 0,05 → 0,1 ; 0,15…), formules recalées, sinon copie.
  function recopier(source, cible) {
    memoriser();
    const f = feuille();
    const ch = [];
    const vertical = cible.l2 > source.l2;
    const lignesSrc = source.l2 - source.l1 + 1, colsSrc = source.c2 - source.c1 + 1;
    const serie = (vals) => {
      if (vals.length < 2 || !vals.every((x) => typeof x === 'number')) return null;
      const pas = vals[1] - vals[0];
      return vals.every((x, i) => i === 0 || Math.abs(x - vals[i - 1] - pas) < 1e-9) ? pas : null;
    };
    if (vertical) {
      for (let c = source.c1; c <= source.c2; c++) {
        const bruts = [], nums = [];
        for (let l = source.l1; l <= source.l2; l++) { bruts.push(brut(l, c)); nums.push(bruts[bruts.length - 1][0] === '=' ? null : valeurSure(l, c)); }
        const pas = serie(nums);
        for (let l = source.l2 + 1; l <= cible.l2; l++) {
          const i = (l - source.l1) % lignesSrc, r = bruts[i];
          let v = r;
          if (pas !== null) v = String(+(nums[nums.length - 1] + pas * (l - source.l2)).toPrecision(12)).replace('.', ',');
          else if (r[0] === '=') v = F.decaler(r, l - (source.l1 + i), 0);
          ch.push({ l, c, v });
          const st = f.styles.get(cle(source.l1 + i, c));
          if (st) f.styles.set(cle(l, c), { ...st }); else f.styles.delete(cle(l, c));
        }
      }
    } else {
      for (let l = source.l1; l <= source.l2; l++) {
        const bruts = [], nums = [];
        for (let c = source.c1; c <= source.c2; c++) { bruts.push(brut(l, c)); nums.push(bruts[bruts.length - 1][0] === '=' ? null : valeurSure(l, c)); }
        const pas = serie(nums);
        for (let c = source.c2 + 1; c <= cible.c2; c++) {
          const i = (c - source.c1) % colsSrc, r = bruts[i];
          let v = r;
          if (pas !== null) v = String(+(nums[nums.length - 1] + pas * (c - source.c2)).toPrecision(12)).replace('.', ',');
          else if (r[0] === '=') v = F.decaler(r, 0, c - (source.c1 + i));
          ch.push({ l, c, v });
          const st = f.styles.get(cle(l, source.c1 + i));
          if (st) f.styles.set(cle(l, c), { ...st }); else f.styles.delete(cle(l, c));
        }
      }
    }
    historique.pop(); // l'instantané ci-dessus suffit (modifier en reprend un sinon)
    modifier(ch.length ? ch : [{ l: sel.l, c: sel.c, v: brut(sel.l, sel.c) }]);
    sel.l2 = cible.l2; sel.c2 = cible.c2;
    afficherSelection();
  }
  function recopierBas() {
    const b = bornes();
    if (b.l1 === b.l2) return Doc.message('Sélectionne plusieurs lignes : la première est recopiée vers le bas.');
    recopier({ ...b, l2: b.l1 }, b);
  }

  // ---------- Insérer / supprimer des lignes et des colonnes ----------
  // Décale les références des formules : comme dans les tableurs, A5 devient A6 si on insère une ligne au-dessus.
  function ajusterRefs(formule, axe, index, delta) {
    let refCassee = false;
    const ajusterNombre = (n, estFin, estPlage) => {
      if (delta > 0) return n >= index ? n + delta : n;
      if (n > index) return n - 1;
      if (n === index) { if (!estPlage) { refCassee = true; return n; } return estFin && n > 0 ? n - 1 : n; }
      return n;
    };
    const remplacerRef = (ref, estFin, estPlage) => {
      const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(ref);
      if (!m) return ref;
      let c = F.lettresVersCol(m[2]), l = parseInt(m[4], 10) - 1;
      if (axe === 'l') l = ajusterNombre(l, estFin, estPlage); else c = ajusterNombre(c, estFin, estPlage);
      return `${m[1]}${F.colVersLettres(c)}${m[3]}${l + 1}`;
    };
    const resultat = formule.replace(/("(?:[^"]|"")*")|(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![\w(])/g, (tout, texte, a, b) => {
      if (texte) return texte;
      if (b) return `${remplacerRef(a, false, true)}:${remplacerRef(b, true, true)}`;
      return remplacerRef(a, false, false);
    });
    return refCassee ? '=#REF!' : resultat;
  }
  function changerStructure(axe, index, delta) {
    memoriser();
    const f = feuille();
    const deplacerCle = (k) => {
      let [l, c] = k.split(',').map(Number);
      const n = axe === 'l' ? l : c;
      if (delta < 0 && n === index) return null;
      const nn = delta > 0 ? (n >= index ? n + delta : n) : (n > index ? n - 1 : n);
      if (axe === 'l') l = nn; else c = nn;
      return cle(l, c);
    };
    const cellules = new Map(), styles = new Map();
    for (const [k, v] of f.cellules) { const nk = deplacerCle(k); if (nk) cellules.set(nk, v[0] === '=' ? '=' + ajusterRefs(v.slice(1), axe, index, delta).replace(/^=/, '') : v); }
    for (const [k, v] of f.styles) { const nk = deplacerCle(k); if (nk) styles.set(nk, v); }
    f.cellules = cellules; f.styles = styles;
    if (axe === 'c') {
      const largeurs = {};
      for (const [c, w] of Object.entries(f.largeurs)) { const n = +c; if (delta < 0 && n === index) continue; largeurs[delta > 0 ? (n >= index ? n + 1 : n) : (n > index ? n - 1 : n)] = w; }
      f.largeurs = largeurs;
    }
    const debut = (n) => (delta > 0 ? (n >= index ? n + 1 : n) : (n > index ? n - 1 : n));
    const fin = (n) => (delta > 0 ? (n >= index ? n + 1 : n) : (n >= index ? n - 1 : n));
    const [p1, p2] = axe === 'l' ? ['l1', 'l2'] : ['c1', 'c2'];
    f.fusions = f.fusions.map((m) => ({ ...m, [p1]: debut(m[p1]), [p2]: fin(m[p2]) })).filter((m) => m.l2 >= m.l1 && m.c2 >= m.c1 && (m.l2 > m.l1 || m.c2 > m.c1));
    const decalerListe = (liste) => liste.filter((n) => !(delta < 0 && n === index)).map(debut);
    if (axe === 'l') {
      f.masquesL = decalerListe(f.masquesL);
      const h = {}; for (const [l, v] of Object.entries(f.hauteurs)) { const n = +l; if (!(delta < 0 && n === index)) h[debut(n)] = v; } f.hauteurs = h;
      if (f.filtre) { f.filtre.l = debut(f.filtre.l); f.filtre.l2 = fin(f.filtre.l2); }
      if (f.figer && f.figer.l > index) f.figer.l = Math.max(0, f.figer.l + delta);
    } else {
      f.masquesC = decalerListe(f.masquesC);
      if (f.filtre) { f.filtre.c1 = debut(f.filtre.c1); f.filtre.c2 = fin(f.filtre.c2); f.filtre.exclus = {}; }
      if (f.figer && f.figer.c > index) f.figer.c = Math.max(0, f.figer.c + delta);
    }
    marquerModifie();
    construire();
  }

  // ---------- Clavier ----------
  const zone = $('zone-grille');
  zone.addEventListener('keydown', (e) => {
    if (edition) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key;
    const l = e.shiftKey ? sel.l2 : sel.l, c = e.shiftKey ? sel.c2 : sel.c;
    const mf = !e.shiftKey && fusionDe(sel.l, sel.c);
    const lMasquee = (n) => feuille().masquesL.includes(n) || lignesFiltrees().has(n), cMasquee = (n) => feuille().masquesC.includes(n);
    const suivant = (n, pas, masquee) => { n += pas; while (n > 0 && masquee(n)) n += pas; return Math.max(0, n); };
    if (k === 'ArrowDown') { e.preventDefault(); deplacer(suivant(mf ? mf.l2 : l, 1, lMasquee), c, e.shiftKey); }
    else if (k === 'ArrowUp') { e.preventDefault(); deplacer(suivant(mf ? mf.l1 : l, -1, lMasquee), c, e.shiftKey); }
    else if (k === 'ArrowRight') { e.preventDefault(); deplacer(l, suivant(mf ? mf.c2 : c, 1, cMasquee), e.shiftKey); }
    else if (k === 'ArrowLeft') { e.preventDefault(); deplacer(l, suivant(mf ? mf.c1 : c, -1, cMasquee), e.shiftKey); }
    else if (k === 'Enter') { e.preventDefault(); deplacer(sel.l + (e.shiftKey ? -1 : 1), sel.c); }
    else if (k === 'Tab') { e.preventDefault(); deplacer(sel.l, sel.c + (e.shiftKey ? -1 : 1)); }
    else if (k === 'Home') { e.preventDefault(); deplacer(ctrl ? 0 : sel.l, 0); }
    else if (k === 'F2') { e.preventDefault(); commencerEdition(); }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); effacerSelection(); }
    else if (ctrl && /^[zZ]$/.test(k)) { e.preventDefault(); annuler(); }
    else if (ctrl && /^[yY]$/.test(k)) { e.preventDefault(); retablir(); }
    else if (ctrl && /^[dD]$/.test(k)) { e.preventDefault(); recopierBas(); }
    else if (ctrl && /^[aA]$/.test(k)) { e.preventDefault(); sel.l = sel.c = 0; sel.l2 = nbLignes - 1; sel.c2 = nbCols - 1; afficherSelection(); }
    else if (ctrl && /^[gGbB]$/.test(k)) { e.preventDefault(); basculerStyle('g'); }
    else if (ctrl && /^[iI]$/.test(k)) { e.preventDefault(); basculerStyle('i'); }
    else if (ctrl && /^[uU]$/.test(k)) { e.preventDefault(); basculerStyle('s'); }
    else if (!ctrl && !e.altKey && k.length === 1) { e.preventDefault(); commencerEdition(k); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (edition) validerEdition(0, 0); enregistrer(); }
  });
  function effacerSelection() {
    const b = bornes(), ch = [];
    for (let l = b.l1; l <= b.l2; l++) for (let c = b.c1; c <= b.c2; c++) if (brut(l, c) !== '') ch.push({ l, c, v: '' });
    if (ch.length) modifier(ch);
  }
  function basculerStyle(p) {
    const actif = !!(styleDe(sel.l, sel.c) || {})[p];
    styliser((st) => { st[p] = !actif; });
  }

  // ---------- Presse-papiers (compatible avec les autres tableurs) ----------
  let pressePapiers = null;
  function copierSelection(couper) {
    const b = bornes(), lignes = [], bruts = [], styles = [];
    for (let l = b.l1; l <= b.l2; l++) {
      const ligne = [], lb = [], ls = [];
      for (let c = b.c1; c <= b.c2; c++) { ligne.push(afficher(valeurSure(l, c), styleDe(l, c))); lb.push(brut(l, c)); ls.push(styleDe(l, c)); }
      lignes.push(ligne.join('\t')); bruts.push(lb); styles.push(ls);
    }
    pressePapiers = { texte: lignes.join('\r\n'), bruts, styles, l: b.l1, c: b.c1, couper, feuille: active, b };
    return pressePapiers.texte;
  }
  function collerTexte(texte) {
    const ch = [];
    const pp = pressePapiers;
    if (pp && pp.texte === texte) {
      memoriser();
      if (pp.couper && pp.feuille === active) { // couper : on vide la zone d'origine
        for (let l = pp.b.l1; l <= pp.b.l2; l++) for (let c = pp.b.c1; c <= pp.b.c2; c++) { feuille().cellules.delete(cle(l, c)); feuille().styles.delete(cle(l, c)); }
      }
      pp.bruts.forEach((ligne, i) => ligne.forEach((v, j) => {
        ch.push({ l: sel.l + i, c: sel.c + j, v: v[0] === '=' && !pp.couper ? F.decaler(v, sel.l - pp.l, sel.c - pp.c) : v });
        const st = pp.styles[i][j];
        if (st) feuille().styles.set(cle(sel.l + i, sel.c + j), { ...st }); else feuille().styles.delete(cle(sel.l + i, sel.c + j));
      }));
      historique.pop();
      if (pp.couper) pressePapiers = null;
    } else {
      // Collage depuis Excel ou un autre tableur : cellules vides vraiment vides (sans espaces), nombres reconnus
      // même avec un séparateur de milliers (« 1 234,5 ») ou le symbole € (le format Monétaire est appliqué).
      memoriser();
      texte.replace(/\r?\n$/, '').split(/\r?\n/).forEach((ligne, i) => ligne.split('\t').forEach((brutColle, j) => {
        let v = nettoyerColle(brutColle);
        const l = sel.l + i, c = sel.c + j;
        if (MONNAIE.test(v)) {
          v = v.replace(/[\s€]/g, '');
          feuille().styles.set(cle(l, c), { ...(feuille().styles.get(cle(l, c)) || {}), fmt: 'monetaire' });
        } else if (MILLIERS.test(v)) v = v.replace(/\s/g, '');
        ch.push({ l, c, v });
      }));
      historique.pop(); // l'instantané ci-dessus suffit (modifier en reprend un)
    }
    if (ch.length) modifier(ch);
  }
  document.addEventListener('copy', (e) => { if (edition || ['zone-nom', 'saisie-formule'].includes(document.activeElement.id)) return; e.clipboardData.setData('text/plain', copierSelection(false)); e.preventDefault(); });
  document.addEventListener('cut', (e) => { if (edition || ['zone-nom', 'saisie-formule'].includes(document.activeElement.id)) return; e.clipboardData.setData('text/plain', copierSelection(true)); e.preventDefault(); });
  document.addEventListener('paste', (e) => { if (edition || ['zone-nom', 'saisie-formule'].includes(document.activeElement.id)) return; e.preventDefault(); collerTexte(e.clipboardData.getData('text/plain')); });
  async function collerDepuisBouton() {
    let texte = pressePapiers ? pressePapiers.texte : '';
    try { const t = await navigator.clipboard.readText(); if (t) texte = t; } catch { /* presse-papiers interne */ }
    if (texte) collerTexte(texte);
  }

  // ---------- Fonctions ----------
  function insererFonction(fn) {
    if (edition) validerEdition(0, 0);
    const b = bornes();
    const statistiques = ['SOMME', 'MOYENNE', 'MIN', 'MAX', 'NB', 'ECARTYPE', 'MEDIANE'];
    if (statistiques.includes(fn)) {
      let plage = null;
      if (b.l1 !== b.l2 || b.c1 !== b.c2) { // plage sélectionnée : résultat juste en dessous
        plage = `${F.nomCellule(b.l1, b.c1)}:${F.nomCellule(b.l2, b.c2)}`;
        deplacer(b.l2 + 1, b.c1);
      } else { // somme automatique : nombres situés au-dessus de la cellule
        let l = sel.l - 1;
        while (l >= 0 && typeof valeurSure(l, sel.c) === 'number') l--;
        if (l < sel.l - 1) plage = `${F.nomCellule(l + 1, sel.c)}:${F.nomCellule(sel.l - 1, sel.c)}`;
      }
      commencerEdition(`=${fn}(${plage || ''})`);
      if (!plage) editeur.setSelectionRange(fn.length + 2, fn.length + 2);
      return;
    }
    const modele = { ARRONDI: '=ARRONDI(;2)', PUISSANCE: '=PUISSANCE(;2)', SI: '=SI(;"oui";"non")', RACINE: '=RACINE()' }[fn] || `=${fn}()`;
    commencerEdition(modele);
    const pos = modele.indexOf('(') + 1;
    editeur.setSelectionRange(pos, pos);
  }

  // ---------- Feuilles ----------
  function afficherOnglets() {
    $('onglets').innerHTML = classeur.feuilles.map((f, i) => `<span class="onglet ${i === active ? 'actif' : ''}" data-i="${i}" title="Double-clic pour renommer">${f.nom.replace(/</g, '&lt;')}${classeur.feuilles.length > 1 && i === active ? '<button class="suppr-feuille" data-suppr title="Supprimer la feuille">×</button>' : ''}</span>`).join('');
  }
  function changerFeuille(i) {
    if (i === active) return;
    if (edition) validerEdition(0, 0);
    active = i;
    sel.l = sel.c = sel.l2 = sel.c2 = 0;
    afficherOnglets(); construire();
  }
  $('onglets').addEventListener('click', (e) => {
    const o = e.target.closest('.onglet');
    if (!o) return;
    const i = +o.dataset.i;
    if (e.target.closest('[data-suppr]')) {
      if (!confirm(`Supprimer la feuille « ${classeur.feuilles[i].nom} » ?`)) return;
      classeur.feuilles.splice(i, 1);
      classeur.graphiques = classeur.graphiques.filter((g) => g.feuille !== i).map((g) => ({ ...g, feuille: g.feuille > i ? g.feuille - 1 : g.feuille }));
      active = Math.max(0, i - 1);
      historique.length = 0; refaire.length = 0;
      afficherOnglets(); construire(); marquerModifie();
      return;
    }
    changerFeuille(i);
  });
  $('onglets').addEventListener('dblclick', async (e) => {
    const o = e.target.closest('.onglet');
    if (!o) return;
    const f = classeur.feuilles[+o.dataset.i];
    const nom = await Doc.demanderNom('Nom de la feuille', f.nom);
    if (nom) { f.nom = nom.slice(0, 31); afficherOnglets(); marquerModifie(); }
  });
  function ajouterFeuille() {
    let n = classeur.feuilles.length + 1;
    while (classeur.feuilles.some((f) => f.nom === `Feuil${n}`)) n++;
    classeur.feuilles.push(nouvelleFeuille(`Feuil${n}`));
    marquerModifie();
    changerFeuille(classeur.feuilles.length - 1);
  }

  // ---------- Graphiques ----------
  const graphiquesAffiches = [];
  function donneesPlage(g) {
    const lire = (l, c) => (active === g.feuille ? valeurSure(l, c) : null);
    const { l1, l2, c1, c2 } = g.plage;
    let debut = l1, entetes = [];
    const premiere = [];
    for (let c = c1; c <= c2; c++) premiere.push(lire(l1, c));
    if (premiere.some((v) => typeof v === 'string')) { entetes = premiere.map((v) => (v === null ? '' : afficher(v))); debut = l1 + 1; }
    const xs = [], series = [];
    for (let c = c1 + 1; c <= c2; c++) series.push({ nom: entetes[c - c1] || `Série ${c - c1}`, points: [] });
    for (let l = debut; l <= l2; l++) {
      const x = lire(l, c1);
      xs.push(x);
      for (let c = c1 + 1; c <= c2; c++) { const y = lire(l, c); series[c - c1 - 1].points.push({ x, y: typeof y === 'number' ? y : null }); }
    }
    if (c1 === c2) {
      series.push({ nom: entetes[0] || 'Série 1', points: [] });
      for (let l = debut; l <= l2; l++) series[0].points.push({ x: l - debut + 1, y: typeof lire(l, c1) === 'number' ? lire(l, c1) : null });
    }
    return { entetes, xs, series, titreX: entetes[0] || '' };
  }
  function regression(points, parOrigine) {
    const p = points.filter((q) => typeof q.x === 'number' && typeof q.y === 'number');
    if (p.length < 2) return null;
    const n = p.length;
    const sx = p.reduce((s, q) => s + q.x, 0), sy = p.reduce((s, q) => s + q.y, 0);
    let a, b;
    if (parOrigine) {
      const sxx = p.reduce((s, q) => s + q.x * q.x, 0), sxy = p.reduce((s, q) => s + q.x * q.y, 0);
      if (!sxx) return null;
      a = sxy / sxx; b = 0;
    } else {
      const mx = sx / n, my = sy / n;
      const num = p.reduce((s, q) => s + (q.x - mx) * (q.y - my), 0), den = p.reduce((s, q) => s + (q.x - mx) ** 2, 0);
      if (!den) return null;
      a = num / den; b = my - a * mx;
    }
    const my = sy / n;
    const ssTot = p.reduce((s, q) => s + (q.y - my) ** 2, 0);
    const ssRes = p.reduce((s, q) => s + (q.y - (a * q.x + b)) ** 2, 0);
    return { a, b, r2: ssTot ? 1 - ssRes / ssTot : 1, xmin: Math.min(...p.map((q) => q.x)), xmax: Math.max(...p.map((q) => q.x)) };
  }
  const arrondiSig = (v) => afficher(Number(v.toPrecision(4)));
  // Options d'un graphique (avec les valeurs par défaut)
  const COULEURS_SERIES = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'];
  const HAUTEURS = { petit: 220, moyen: 290, grand: 400 };
  const optionGraphique = (g, cle_, defaut) => (g[cle_] === undefined || g[cle_] === null || g[cle_] === '' ? defaut : g[cle_]);
  // Étiquettes de données : la valeur écrite au-dessus de chaque point ou barre
  const pluginEtiquettes = (g) => ({
    id: 'etiquettes',
    afterDatasetsDraw: (ch) => {
      if (!g.etiquettes || g.type === 'secteurs') return;
      const c = ch.ctx;
      c.save(); c.font = '600 11px Calibri, "Segoe UI", sans-serif'; c.fillStyle = Outil.css('--texte'); c.textAlign = 'center'; c.textBaseline = 'bottom';
      ch.data.datasets.forEach((ds, k) => {
        if (ds.tendance) return;
        ch.getDatasetMeta(k).data.forEach((el, n) => {
          const v = ds.data[n];
          const y = typeof v === 'object' && v ? v.y : v;
          if (typeof y === 'number') c.fillText(afficher(Number(y.toPrecision(6))), el.x, el.y - 6);
        });
      });
      c.restore();
    },
  });
  function rafraichirGraphiques() {
    const liste = classeur.graphiques.map((g, i) => ({ g, i })).filter(({ g }) => g.feuille === active);
    $('panneau-graphiques').hidden = !liste.length;
    graphiquesAffiches.forEach((ch) => ch.destroy());
    graphiquesAffiches.length = 0;
    const conteneur = $('liste-graphiques');
    conteneur.innerHTML = '';
    const texte = Outil.css('--texte'), grilleC = Outil.css('--grille-forte');
    for (const { g, i } of liste) {
      const carte = document.createElement('div');
      carte.className = 'carte-graphique';
      carte.dataset.i = i;
      carte.title = 'Clique sur le graphique pour le modifier';
      carte.innerHTML = `<div class="cadre-canvas" style="height:${HAUTEURS[optionGraphique(g, 'hauteur', 'moyen')]}px"><canvas></canvas></div><div class="equation"></div>
        <div class="actions-graphique"><button class="br" data-copier>📋 Copier l'image</button><button class="br" data-png>🖼 Enregistrer en image</button><button class="br" data-suppr>Supprimer</button></div>`;
      carte.addEventListener('mousedown', (e) => { if (!e.target.closest('button')) choisirGraphique(i); });
      conteneur.append(carte);
      const d = donneesPlage(g);
      if (g.type === 'secteurs') { graphiquesAffiches.push(diagrammeSecteurs(carte, g, d, texte)); brancherActions(carte, i, graphiquesAffiches[graphiquesAffiches.length - 1]); continue; }
      const couleurDe = (k) => (g.couleurs && g.couleurs[k]) || COULEURS_SERIES[k % COULEURS_SERIES.length];
      const equations = [];
      const datasets = d.series.map((s, k) => {
        const couleur = couleurDe(k);
        if (g.type === 'barres') return { label: s.nom, data: s.points.map((p) => p.y), backgroundColor: couleur, borderColor: couleur, borderWidth: 1 };
        return { label: s.nom, data: s.points.filter((p) => typeof p.x === 'number' && p.y !== null), borderColor: couleur, backgroundColor: couleur, showLine: g.type === 'courbe', pointRadius: 4.5, tension: 0, borderWidth: 2 };
      });
      if (g.type === 'nuage' && g.tendance) {
        d.series.forEach((s, k) => {
          const r = regression(s.points, g.tendance === 'lineaire');
          if (!r) return;
          const x0 = g.tendance === 'lineaire' ? Math.min(0, r.xmin) : r.xmin;
          datasets.push({ tendance: true, label: `Linéaire (${s.nom})`, data: [{ x: x0, y: r.a * x0 + r.b }, { x: r.xmax, y: r.a * r.xmax + r.b }], showLine: true, pointRadius: 0, borderDash: [6, 5], borderWidth: 2, borderColor: couleurDe(k), backgroundColor: 'transparent' });
          const signe = r.b < 0 ? '−' : '+';
          equations.push(g.tendance === 'lineaire'
            ? `${s.nom} : y = ${arrondiSig(r.a)} × x   (R² = ${afficher(Number(r.r2.toFixed(4)))})`
            : `${s.nom} : y = ${arrondiSig(r.a)} × x ${arrondiSig(Math.abs(r.b)) === '0' ? '' : signe + ' ' + arrondiSig(Math.abs(r.b))}   (R² = ${afficher(Number(r.r2.toFixed(4)))})`);
        });
      }
      carte.querySelector('.equation').textContent = optionGraphique(g, 'equation', true) ? equations.join('\n') : '';
      const quadrillage = optionGraphique(g, 'quadrillage', true);
      const borne = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      const axe = (titre, min, max) => ({ title: { display: !!titre, text: titre, color: texte }, min: borne(min), max: borne(max), ticks: { color: texte, callback: (v) => (typeof v === 'number' ? afficher(v) : v) }, grid: { color: grilleC, display: quadrillage } });
      const legende = optionGraphique(g, 'legende', 'top');
      const graphique = new Chart(carte.querySelector('canvas'), {
        type: g.type === 'barres' ? 'bar' : 'scatter',
        data: g.type === 'barres' ? { labels: d.xs.map((x) => afficher(x)), datasets } : { datasets },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          layout: { padding: { top: g.etiquettes ? 14 : 0 } },
          plugins: {
            title: { display: !!g.titre, text: g.titre, color: texte, font: { size: 15, weight: '600' } },
            legend: { display: legende !== 'aucune', position: legende === 'aucune' ? 'top' : legende, labels: { color: texte } },
          },
          scales: {
            x: { ...axe(g.axeX || d.titreX, g.xmin, g.xmax), type: g.type === 'barres' ? 'category' : 'linear', ...(g.type === 'barres' ? { ticks: { color: texte }, min: undefined, max: undefined } : {}) },
            y: axe(g.axeY, g.ymin, g.ymax),
          },
        },
        plugins: [{ id: 'fond', beforeDraw: (ch) => { const c = ch.ctx; c.save(); c.fillStyle = Outil.css('--surface'); c.fillRect(0, 0, ch.width, ch.height); c.restore(); } }, pluginEtiquettes(g)],
      });
      graphiquesAffiches.push(graphique);
      brancherActions(carte, i, graphique);
    }
    // Le graphique sélectionné reste sélectionné après un recalcul (sauf s'il a disparu)
    if (grapheChoisi !== null && (!classeur.graphiques[grapheChoisi] || classeur.graphiques[grapheChoisi].feuille !== active)) deselectionnerGraphique();
    marquerCartes();
  }

  // ---------- Onglet « Création de graphique » ----------
  let grapheChoisi = null, ongletAvant = 'insertion';
  const graphiqueChoisi = () => (grapheChoisi === null ? null : classeur.graphiques[grapheChoisi] || null);
  function marquerCartes() { document.querySelectorAll('.carte-graphique').forEach((c) => c.classList.toggle('choisie', +c.dataset.i === grapheChoisi)); }
  function choisirGraphique(i) {
    if (edition) validerEdition(0, 0);
    if (grapheChoisi === null) { const actif = document.querySelector('.onglets-ruban [data-onglet].actif'); ongletAvant = actif ? actif.dataset.onglet : 'accueil'; }
    grapheChoisi = i;
    const onglet = $('onglet-graphique');
    onglet.hidden = false;
    if (!onglet.classList.contains('actif')) onglet.click();
    marquerCartes();
    majPanneauGraphique();
  }
  function deselectionnerGraphique() {
    if (grapheChoisi === null) return;
    grapheChoisi = null;
    const onglet = $('onglet-graphique');
    const etaitActif = onglet.classList.contains('actif');
    onglet.hidden = true;
    if (etaitActif) document.querySelector(`.onglets-ruban [data-onglet="${ongletAvant}"]`)?.click();
    marquerCartes();
  }
  function majPanneauGraphique() {
    const g = graphiqueChoisi();
    if (!g) return;
    const secteurs = g.type === 'secteurs';
    document.querySelectorAll('[data-gtype]').forEach((b) => b.classList.toggle('actif', b.dataset.gtype === g.type));
    $('gc-plage').textContent = `Cellules : ${F.nomCellule(g.plage.l1, g.plage.c1)}:${F.nomCellule(g.plage.l2, g.plage.c2)}`;
    $('gc-titre').value = g.titre || '';
    $('gc-axex').value = g.axeX || ''; $('gc-axey').value = g.axeY || '';
    $('gc-axex').disabled = $('gc-axey').disabled = secteurs;
    $('gc-legende').value = optionGraphique(g, 'legende', secteurs ? 'right' : 'top');
    $('gc-quadrillage').checked = optionGraphique(g, 'quadrillage', true); $('gc-quadrillage').disabled = secteurs;
    $('gc-etiquettes').checked = !!g.etiquettes;
    $('gc-groupe-tendance').hidden = g.type !== 'nuage';
    $('gc-tendance').value = g.tendance || '';
    $('gc-equation').checked = optionGraphique(g, 'equation', true);
    $('gc-groupe-axes').hidden = secteurs;
    for (const k of ['xmin', 'xmax', 'ymin', 'ymax']) $('gc-' + k).value = typeof g[k] === 'number' ? g[k] : '';
    $('gc-xmin').disabled = $('gc-xmax').disabled = g.type === 'barres';
    $('gc-hauteur').value = optionGraphique(g, 'hauteur', 'moyen');
    // Une couleur par série (ou par part pour un diagramme en secteurs)
    const d = donneesPlage(g);
    const noms = secteurs ? (d.series[0] ? d.series[0].points.map((p, k) => (p.x === null || p.x === undefined ? `Part ${k + 1}` : afficher(p.x))) : []) : d.series.map((x) => x.nom);
    const defaut = (k) => (secteurs ? COULEURS_SECTEURS[k % COULEURS_SECTEURS.length] : COULEURS_SERIES[k % COULEURS_SERIES.length]);
    $('gc-couleurs').innerHTML = noms.slice(0, 12).map((n, k) => `<label><input type="color" data-couleur="${k}" value="${(g.couleurs && g.couleurs[k]) || defaut(k)}"> ${String(n).replace(/</g, '&lt;').slice(0, 18)}</label>`).join('');
  }
  function modifierGraphique(fn) {
    const g = graphiqueChoisi();
    if (!g) return;
    memoriser();
    fn(g);
    marquerModifie();
    rafraichirGraphiques();
    majPanneauGraphique();
  }
  document.querySelectorAll('[data-gtype]').forEach((b) => b.addEventListener('click', () => modifierGraphique((g) => { g.type = b.dataset.gtype; if (g.type !== 'nuage') g.tendance = ''; })));
  [['gc-titre', 'titre'], ['gc-axex', 'axeX'], ['gc-axey', 'axeY']].forEach(([id, cle_]) => $(id).addEventListener('change', (e) => modifierGraphique((g) => { g[cle_] = e.target.value.trim(); })));
  $('gc-legende').addEventListener('change', (e) => modifierGraphique((g) => { g.legende = e.target.value; }));
  $('gc-quadrillage').addEventListener('change', (e) => modifierGraphique((g) => { g.quadrillage = e.target.checked; }));
  $('gc-etiquettes').addEventListener('change', (e) => modifierGraphique((g) => { g.etiquettes = e.target.checked; }));
  $('gc-tendance').addEventListener('change', (e) => modifierGraphique((g) => { g.tendance = e.target.value; }));
  $('gc-equation').addEventListener('change', (e) => modifierGraphique((g) => { g.equation = e.target.checked; }));
  for (const k of ['xmin', 'xmax', 'ymin', 'ymax']) $('gc-' + k).addEventListener('change', (e) => modifierGraphique((g) => { const v = parseFloat(String(e.target.value).replace(',', '.')); g[k] = Number.isFinite(v) ? v : null; }));
  $('gc-hauteur').addEventListener('change', (e) => modifierGraphique((g) => { g.hauteur = e.target.value; }));
  $('gc-couleurs').addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.couleur;
    if (k === undefined) return;
    modifierGraphique((g) => { g.couleurs = [...(g.couleurs || [])]; g.couleurs[+k] = e.target.value; });
  });
  async function changerDonneesGraphique() {
    const g = graphiqueChoisi();
    if (!g) return;
    const b = bornes(), multi = b.l1 !== b.l2 || b.c1 !== b.c2;
    const actuelle = `${F.nomCellule(g.plage.l1, g.plage.c1)}:${F.nomCellule(g.plage.l2, g.plage.c2)}`;
    const proposee = multi ? `${F.nomCellule(b.l1, b.c1)}:${F.nomCellule(b.l2, b.c2)}` : actuelle;
    const texte = await Doc.demanderNom('Cellules utilisées par le graphique (ex. A1:B8). Astuce : sélectionne-les d\'abord, puis clique sur le graphique.', proposee);
    if (!texte) return;
    const [a, z] = texte.trim().toUpperCase().split(':');
    const p = F.lireRef(a || ''), q = F.lireRef(z || a || '');
    if (!p || !q) return Doc.message('Plage inconnue : écris par exemple A1:B8.', 'erreur');
    modifierGraphique((x) => { x.plage = { l1: Math.min(p.l, q.l), l2: Math.max(p.l, q.l), c1: Math.min(p.c, q.c), c2: Math.max(p.c, q.c) }; x.couleurs = []; });
  }
  // Clic ailleurs (grille, barre de formule) : le graphique n'est plus sélectionné
  $('zone-grille').addEventListener('mousedown', () => deselectionnerGraphique(), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && grapheChoisi !== null && !e.target.closest('input, select, textarea') && document.activeElement !== editeur) {
      e.preventDefault();
      memoriser(); classeur.graphiques.splice(grapheChoisi, 1); grapheChoisi = null; marquerModifie(); deselectionnerGraphique(); rafraichirGraphiques();
    } else if (e.key === 'Escape' && grapheChoisi !== null) deselectionnerGraphique();
  });
  function brancherActions(carte, i, graphique) {
    {
      carte.querySelector('[data-suppr]').addEventListener('click', () => { memoriser(); classeur.graphiques.splice(i, 1); if (grapheChoisi !== null) deselectionnerGraphique(); marquerModifie(); rafraichirGraphiques(); });
      carte.querySelector('[data-copier]').addEventListener('click', () => {
        graphique.canvas.toBlob(async (blob) => {
          try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); Doc.message('Image copiée : colle-la dans le traitement de texte (Ctrl+V)'); }
          catch { Doc.message('Copie impossible', 'erreur'); }
        });
      });
      carte.querySelector('[data-png]').addEventListener('click', async () => {
        const base = (fichier.nom || 'Classeur').replace(/\.[^.]+$/, '');
        const octets = Uint8Array.from(atob(graphique.toBase64Image('image/png').split(',')[1]), (ch) => ch.charCodeAt(0));
        try { const nom = await Doc.enregistrer(`${base} - graphique.png`, octets, false); Doc.message(`Image enregistrée : ${nom}`); }
        catch (e) { Doc.message(e.message, 'erreur'); }
      });
    }
  }
  // Diagramme en secteurs : 1re colonne = catégories, 2e colonne = effectifs (ou valeurs).
  // Les pourcentages sont écrits sur les parts et détaillés sous le graphique.
  const COULEURS_SECTEURS = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e', '#636363', '#997300'];
  function diagrammeSecteurs(carte, g, d, texte) {
    const serie = d.series[0] || { points: [] };
    const parts = serie.points.map((p, k) => ({ nom: p.x === null || p.x === undefined ? `Part ${k + 1}` : afficher(p.x), v: p.y }))
      .filter((p) => typeof p.v === 'number' && p.v > 0);
    const total = parts.reduce((s, p) => s + p.v, 0);
    const pct = (v) => (total ? afficher(Number((v / total * 100).toFixed(1))) + ' %' : '');
    carte.querySelector('.equation').textContent = parts.length
      ? parts.map((p) => `${p.nom} : ${afficher(p.v)} (${pct(p.v)})`).join('\n') + `\nTotal : ${afficher(total)}`
      : 'Aucune valeur positive à représenter : la 2e colonne doit contenir des nombres.';
    const couleurs = parts.map((_, k) => (g.couleurs && g.couleurs[k]) || COULEURS_SECTEURS[k % COULEURS_SECTEURS.length]);
    const legende = optionGraphique(g, 'legende', 'right');
    return new Chart(carte.querySelector('canvas'), {
      type: 'pie',
      data: { labels: parts.map((p) => p.nom), datasets: [{ label: serie.nom, data: parts.map((p) => p.v), backgroundColor: couleurs, borderColor: Outil.css('--surface'), borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          title: { display: !!g.titre, text: g.titre, color: texte, font: { size: 15, weight: '600' } },
          legend: { display: legende !== 'aucune', position: legende === 'aucune' ? 'right' : legende, labels: { color: texte } },
          tooltip: { callbacks: { label: (c) => `${c.label} : ${afficher(c.raw)} (${pct(c.raw)})` } },
        },
      },
      plugins: [
        { id: 'fond', beforeDraw: (ch) => { const c = ch.ctx; c.save(); c.fillStyle = Outil.css('--surface'); c.fillRect(0, 0, ch.width, ch.height); c.restore(); } },
        { id: 'pourcentages', afterDatasetsDraw: (ch) => {
          const c = ch.ctx;
          c.save();
          c.font = '600 13px Calibri, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
          ch.getDatasetMeta(0).data.forEach((arc, k) => {
            if (!total || parts[k].v / total < 0.04) return; // part trop petite pour y écrire
            const p = arc.tooltipPosition();
            c.fillText(g.etiquettes ? `${afficher(parts[k].v)} (${pct(parts[k].v)})` : pct(parts[k].v), p.x, p.y);
          });
          c.restore();
        } },
      ],
    });
  }
  Outil.surTheme(() => rafraichirGraphiques());
  $('btn-fermer-panneau').addEventListener('click', () => { $('panneau-graphiques').hidden = true; });

  function ouvrirFenetreGraphique(type) {
    const b = bornes();
    if (b.l1 === b.l2) return Doc.message('Sélectionne d\'abord tes données (au moins deux lignes), par exemple A1:B8.', 'erreur');
    const d = donneesPlage({ feuille: active, plage: b, type: 'nuage' });
    $('info-plage').textContent = `Données : ${F.nomCellule(b.l1, b.c1)}:${F.nomCellule(b.l2, b.c2)}`;
    $('g-type').value = type || 'nuage';
    $('g-axex').value = d.titreX;
    $('g-axey').value = d.series.length === 1 ? d.series[0].nom.replace(/^Série 1$/, '') : '';
    $('g-titre').value = d.series.length === 1 && d.titreX ? `${d.series[0].nom} en fonction de ${d.titreX}` : '';
    $('fenetre-graphique').dataset.plage = JSON.stringify(b);
    if ($('g-type').value === 'secteurs') { const nom = d.series.length ? d.series[0].nom.replace(/^Série 1$/, '') : ''; $('g-titre').value = nom ? `Répartition : ${nom}` : 'Répartition'; }
    adapterFenetreGraphique();
    $('fenetre-graphique').hidden = false;
    $('g-titre').focus();
  }
  function adapterFenetreGraphique() {
    const type = $('g-type').value;
    $('g-options-tendance').hidden = type !== 'nuage';
    $('g-axes').hidden = type === 'secteurs';
  }
  $('g-type').addEventListener('change', () => {
    adapterFenetreGraphique();
    const d = donneesPlage({ feuille: active, plage: JSON.parse($('fenetre-graphique').dataset.plage), type: 'nuage' });
    const nom = d.series.length ? d.series[0].nom.replace(/^Série 1$/, '') : '';
    if ($('g-type').value === 'secteurs') $('g-titre').value = nom ? `Répartition : ${nom}` : 'Répartition';
  });
  $('g-annuler').addEventListener('click', () => { $('fenetre-graphique').hidden = true; });
  $('form-graphique').addEventListener('submit', (e) => {
    e.preventDefault();
    memoriser();
    classeur.graphiques.push({
      feuille: active, plage: JSON.parse($('fenetre-graphique').dataset.plage), type: $('g-type').value,
      titre: $('g-titre').value.trim(), axeX: $('g-axex').value.trim(), axeY: $('g-axey').value.trim(),
      tendance: $('g-type').value === 'nuage' ? document.querySelector('input[name="g-tendance"]:checked').value : '',
    });
    $('fenetre-graphique').hidden = true;
    marquerModifie();
    rafraichirGraphiques();
    choisirGraphique(classeur.graphiques.length - 1);
  });

  // ---------- Probabilités : relancer les tirages et simuler une expérience ----------
  function relancerTirages() {
    if (edition) validerEdition(0, 0);
    F.nouvelleGraine();
    rafraichir();
    rafraichirGraphiques();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'F9') { e.preventDefault(); relancerTirages(); } });

  // Issues possibles de chaque expérience : [valeur, probabilité (formule)]
  function issuesSimulation() {
    const exp = $('s-experience').value;
    if (exp === 'piece') return { formule: '=SI(ALEA()<0,5;"Pile";"Face")', issues: [['Pile', '=1/2'], ['Face', '=1/2']], nom: 'Lancer d\'une pièce' };
    if (exp === 'de') return { formule: '=ALEA.ENTRE.BORNES(1;6)', issues: [1, 2, 3, 4, 5, 6].map((v) => [v, '=1/6']), nom: 'Lancer d\'un dé' };
    if (exp === 'deux-des') return { formule: '=ALEA.ENTRE.BORNES(1;6)+ALEA.ENTRE.BORNES(1;6)', issues: Array.from({ length: 11 }, (_, i) => [i + 2, `=${6 - Math.abs(i + 2 - 7)}/36`]), nom: 'Somme de deux dés' };
    if (exp === 'entier') {
      const a = Math.ceil(+$('s-min').value), b = Math.floor(+$('s-max').value);
      if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return { erreur: 'La borne « à » doit être plus grande que « De ».' };
      if (b - a > 39) return { erreur: 'Au plus 40 issues (choisis des bornes plus proches).' };
      return { formule: `=ALEA.ENTRE.BORNES(${a};${b})`, issues: Array.from({ length: b - a + 1 }, (_, i) => [a + i, `=1/${b - a + 1}`]), nom: `Entier entre ${a} et ${b}` };
    }
    const p = Number(String($('s-p').value).replace(',', '.'));
    if (!(p >= 0 && p <= 1)) return { erreur: 'La probabilité p doit être un nombre entre 0 et 1 (ex. 0,3).' };
    const pt = String(p).replace('.', ',');
    return { formule: `=SI(ALEA()<${pt};1;0)`, issues: [[1, `=${pt}`], [0, `=1-${pt}`]], nom: `Épreuve de Bernoulli (p = ${pt})` };
  }
  function adapterSimulation() {
    const exp = $('s-experience').value;
    $('s-bornes').hidden = exp !== 'entier';
    $('s-proba').hidden = exp !== 'evenement';
    const r = issuesSimulation();
    const avant = $('s-suivie').value;
    $('s-suivie').innerHTML = (r.issues || []).map(([v]) => `<option value="${v}">${v}</option>`).join('');
    const defaut = { de: '6', 'deux-des': '7', piece: 'Pile', evenement: '1' }[exp];
    if ([...$('s-suivie').options].some((o) => o.value === avant)) $('s-suivie').value = avant;
    else if (defaut && [...$('s-suivie').options].some((o) => o.value === defaut)) $('s-suivie').value = defaut;
  }
  ['s-experience', 's-min', 's-max', 's-p'].forEach((id) => $(id).addEventListener('input', adapterSimulation));
  function ouvrirSimulation() {
    if (edition) validerEdition(0, 0);
    $('s-erreur').textContent = '';
    adapterSimulation();
    $('fenetre-simulation').hidden = false;
    $('s-experience').focus();
  }
  $('s-annuler').addEventListener('click', () => { $('fenetre-simulation').hidden = true; });
  $('form-simulation').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = issuesSimulation();
    if (r.erreur) { $('s-erreur').textContent = r.erreur; return; }
    const n = Math.floor(+$('s-n').value);
    if (!(n >= 1 && n <= 2000)) { $('s-erreur').textContent = 'Choisis entre 1 et 2 000 tirages.'; return; }
    const suivie = $('s-suivie').value;
    const courbe = $('s-courbe').checked, barres = $('s-barres').checked;
    $('fenetre-simulation').hidden = true;

    // Nouvelle feuille « Simulation »
    memoriser();
    let k = 1;
    while (classeur.feuilles.some((f) => f.nom === (k === 1 ? 'Simulation' : `Simulation ${k}`))) k++;
    const f = nouvelleFeuille(k === 1 ? 'Simulation' : `Simulation ${k}`);
    classeur.feuilles.push(f);
    const ecrire = (l, c, v, st) => { f.cellules.set(cle(l, c), String(v)); if (st) f.styles.set(cle(l, c), st); };
    const ENTETE = { g: true, fond: '#dde7f6', a: 'center', w: true, bord: { h: true, b: true, g: true, d: true } };
    const CADRE = { bord: { h: true, b: true, g: true, d: true } };
    const dernier = n + 1; // dernière ligne des tirages (en numéros Excel)
    const texteSuivi = typeof r.issues[0][0] === 'number' ? suivie : `"${suivie}"`;
    // Colonnes : A = n° du tirage, B = fréquence de l'issue suivie depuis le début (si demandé), puis le résultat
    const cRes = courbe ? 2 : 1, lettreRes = F.colVersLettres(cRes);
    ecrire(0, 0, 'Tirage n°', ENTETE);
    if (courbe) ecrire(0, 1, `Fréquence de « ${suivie} »`, ENTETE);
    ecrire(0, cRes, 'Résultat', ENTETE);
    for (let i = 1; i <= n; i++) {
      ecrire(i, 0, i);
      if (courbe) ecrire(i, 1, `=NB.SI($${lettreRes}$2:${lettreRes}${i + 1};${texteSuivi})/A${i + 1}`, { d: 3 });
      ecrire(i, cRes, r.formule, { a: 'center' });
    }
    // Tableau des effectifs et des fréquences, à droite
    const c0 = cRes + 2, L = (c) => F.colVersLettres(c);
    ecrire(0, c0, 'Issue', ENTETE);
    ecrire(0, c0 + 1, 'Fréquence observée', ENTETE);
    ecrire(0, c0 + 2, 'Probabilité', ENTETE);
    ecrire(0, c0 + 3, 'Effectif', ENTETE);
    r.issues.forEach(([v, proba], i) => {
      const l = i + 1;
      ecrire(l, c0, v, { ...CADRE, a: 'center', g: true });
      ecrire(l, c0 + 3, `=NB.SI($${lettreRes}$2:$${lettreRes}$${dernier};${L(c0)}${l + 1})`, { ...CADRE, a: 'center' });
      ecrire(l, c0 + 1, `=${L(c0 + 3)}${l + 1}/${n}`, { ...CADRE, d: 3 });
      ecrire(l, c0 + 2, proba, { ...CADRE, d: 3 });
    });
    const lt = r.issues.length + 1;
    ecrire(lt, c0, 'Total', { ...CADRE, g: true, fond: '#f2f2f2' });
    ecrire(lt, c0 + 1, `=SOMME(${L(c0 + 1)}2:${L(c0 + 1)}${lt})`, { ...CADRE, d: 3, fond: '#f2f2f2' });
    ecrire(lt, c0 + 2, `=SOMME(${L(c0 + 2)}2:${L(c0 + 2)}${lt})`, { ...CADRE, d: 3, fond: '#f2f2f2' });
    ecrire(lt, c0 + 3, `=SOMME(${L(c0 + 3)}2:${L(c0 + 3)}${lt})`, { ...CADRE, a: 'center', fond: '#f2f2f2' });
    ecrire(lt + 2, c0, `${r.nom} — ${n} tirages. Appuie sur F9 (ou « Relancer ») pour refaire tous les tirages.`, { i: true, w: true, couleur: '#555555' });
    f.fusions.push({ l1: lt + 2, l2: lt + 3, c1: c0, c2: c0 + 3 });
    f.largeurs[0] = 70; if (courbe) f.largeurs[1] = 110; f.largeurs[c0] = 70; f.largeurs[c0 + 1] = 110; f.largeurs[c0 + 2] = 90;
    f.figer = { l: 1, c: 0 };

    const indice = classeur.feuilles.length - 1;
    if (barres) classeur.graphiques.push({ feuille: indice, plage: { l1: 0, l2: r.issues.length, c1: c0, c2: c0 + 2 }, type: 'barres', titre: `${r.nom} : fréquences et probabilités`, axeX: 'Issue', axeY: 'Fréquence', tendance: '' });
    if (courbe) classeur.graphiques.push({ feuille: indice, plage: { l1: 0, l2: n, c1: 0, c2: 1 }, type: 'courbe', titre: `Fréquence de « ${suivie} » au fil des tirages`, axeX: 'Nombre de tirages', axeY: 'Fréquence', tendance: '' });
    F.nouvelleGraine();
    marquerModifie();
    changerFeuille(indice);
    rafraichirGraphiques();
    Doc.message('Simulation prête : F9 pour relancer les tirages');
  });

  // ---------- Zoom et affichage ----------
  function fixerZoom(z) {
    zoom = Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));
    $('contenu-grille').style.zoom = zoom;
    $('zoom').value = Math.round(zoom * 100);
    $('zoom-val').textContent = Math.round(zoom * 100) + ' %';
  }
  $('zoom').addEventListener('input', (e) => fixerZoom(e.target.value / 100));
  zone.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); fixerZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1)); } }, { passive: false });

  // ---------- Insérer une fonction (fenêtre fx) ----------
  function insererFonctionFenetre() {
    window.AideFormules.ouvrirFenetre((fn) => {
      const texte = fn.n + '(' + (fn.args.length ? '' : ')');
      if (!edition) { commencerEdition('=' + texte); return; }
      const champ = edition.depuis === 'barre' ? barre : editeur;
      champ.focus();
      const p = champ.selectionStart;
      const avant = champ.value.slice(0, p);
      const ajout = (avant === '' ? '=' : /[=(;,+\-*/^&<>]$/.test(avant) ? '' : '+') + texte;
      champ.value = avant + ajout + champ.value.slice(champ.selectionEnd);
      const q = p + ajout.length - (fn.args.length ? 0 : 1) + (fn.args.length ? 0 : 1);
      champ.setSelectionRange(q, q);
      champ.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  // ---------- Fusionner et centrer ----------
  function fusionner() {
    if (edition) validerEdition(0, 0);
    const f = feuille(), b = bornes();
    const existante = f.fusions.filter((m) => m.l1 >= b.l1 && m.l2 <= b.l2 && m.c1 >= b.c1 && m.c2 <= b.c2);
    if (existante.length && existante.some((m) => m.l1 === b.l1 && m.c1 === b.c1 && m.l2 === b.l2 && m.c2 === b.c2)) {
      memoriser();
      f.fusions = f.fusions.filter((m) => !existante.includes(m)); // annuler la fusion
      marquerModifie(); construire();
      return;
    }
    if (b.l1 === b.l2 && b.c1 === b.c2) return Doc.message('Sélectionne d\'abord plusieurs cellules à fusionner.');
    let autres = 0;
    for (let l = b.l1; l <= b.l2; l++) for (let c = b.c1; c <= b.c2; c++) if ((l !== b.l1 || c !== b.c1) && brut(l, c) !== '') autres++;
    if (autres && !confirm('La fusion ne garde que la valeur de la cellule en haut à gauche. Continuer ?')) return;
    memoriser();
    for (let l = b.l1; l <= b.l2; l++) for (let c = b.c1; c <= b.c2; c++) if (l !== b.l1 || c !== b.c1) f.cellules.delete(cle(l, c));
    f.fusions = f.fusions.filter((m) => !existante.includes(m));
    f.fusions.push({ ...b });
    f.styles.set(cle(b.l1, b.c1), { ...(f.styles.get(cle(b.l1, b.c1)) || {}), a: 'center' });
    sel.l = sel.l2 = b.l1; sel.c = sel.c2 = b.c1;
    marquerModifie(); construire();
  }

  // ---------- Trier ----------
  // Zone de données : la sélection, ou le tableau autour de la cellule active (lignes et colonnes non vides voisines).
  function zoneDeDonnees() {
    const b = bornes();
    if (b.l1 !== b.l2 || b.c1 !== b.c2) return { ...b, l2: Math.min(b.l2, derniereLigne()) };
    const z = { l1: sel.l, l2: sel.l, c1: sel.c, c2: sel.c };
    const ligneVide = (l, c1, c2) => { for (let c = c1; c <= c2; c++) if (brut(l, c) !== '') return false; return true; };
    const colonneVide = (c, l1, l2) => { for (let l = l1; l <= l2; l++) if (brut(l, c) !== '') return false; return true; };
    for (let encore = true; encore;) {
      encore = false;
      if (z.l1 > 0 && !ligneVide(z.l1 - 1, z.c1, z.c2)) { z.l1--; encore = true; }
      if (!ligneVide(z.l2 + 1, z.c1, z.c2)) { z.l2++; encore = true; }
      if (z.c1 > 0 && !colonneVide(z.c1 - 1, z.l1, z.l2)) { z.c1--; encore = true; }
      if (!colonneVide(z.c2 + 1, z.l1, z.l2)) { z.c2++; encore = true; }
    }
    return z;
  }
  function derniereLigne() { let n = 0; for (const k of feuille().cellules.keys()) n = Math.max(n, +k.split(',')[0]); return n; }
  // La première ligne est-elle une ligne d'en-tête ? (du texte au-dessus de nombres, ou en gras)
  function aUnEntete(z) {
    if (z.l1 === z.l2) return false;
    let texte = 0, vides = 0;
    for (let c = z.c1; c <= z.c2; c++) { const v = valeurSure(z.l1, c); if (v === null) vides++; else if (typeof v === 'string') texte++; }
    if (texte && texte + vides === z.c2 - z.c1 + 1) {
      for (let c = z.c1; c <= z.c2; c++) for (let l = z.l1 + 1; l <= z.l2; l++) if (typeof valeurSure(l, c) === 'number') return true;
      return !!(styleDe(z.l1, z.c1) || {}).g;
    }
    return false;
  }
  const comparer = (a, b) => {
    const vide = (v) => v === null || v === '';
    if (vide(a) || vide(b)) return vide(a) - vide(b);
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'number') return -1;
    if (typeof b === 'number') return 1;
    return String(afficher(a)).localeCompare(String(afficher(b)), 'fr', { numeric: true, sensitivity: 'base' });
  };
  function trier(sens, colonne = null, zoneImposee = null) {
    if (edition) validerEdition(0, 0);
    const f = feuille();
    const z = zoneImposee || zoneDeDonnees();
    const col = colonne ?? Math.min(Math.max(sel.c, z.c1), z.c2);
    const debut = zoneImposee ? z.l1 + 1 : z.l1 + (aUnEntete(z) ? 1 : 0);
    if (debut >= z.l2) return Doc.message('Il faut au moins deux lignes à trier.');
    if (f.fusions.some((m) => m.l1 <= z.l2 && m.l2 >= debut && m.c1 <= z.c2 && m.c2 >= z.c1)) return Doc.message('Impossible de trier des cellules fusionnées.', 'erreur');
    memoriser();
    const lignes = [];
    for (let l = debut; l <= z.l2; l++) {
      const cellules = [];
      for (let c = z.c1; c <= z.c2; c++) cellules.push({ v: brut(l, c), st: f.styles.get(cle(l, c)) });
      lignes.push({ l, cle: valeurSure(l, col), cellules });
    }
    lignes.sort((a, b) => {
      const vide = (v) => v === null || v === '';
      if (vide(a.cle) || vide(b.cle)) return vide(a.cle) - vide(b.cle); // les cellules vides restent à la fin
      return sens * comparer(a.cle, b.cle) || a.l - b.l;
    });
    lignes.forEach((ligne, i) => {
      const cible = debut + i;
      ligne.cellules.forEach((x, j) => {
        const k = cle(cible, z.c1 + j);
        const v = x.v && x.v[0] === '=' ? F.decaler(x.v, cible - ligne.l, 0) : x.v;
        if (v === '') f.cellules.delete(k); else f.cellules.set(k, v);
        if (x.st) f.styles.set(k, x.st); else f.styles.delete(k);
      });
    });
    marquerModifie(); rafraichir();
    Doc.message(`Trié ${sens > 0 ? 'de A à Z' : 'de Z à A'} selon la colonne ${F.colVersLettres(col)}${debut > z.l1 ? ' (ligne d\'en-tête conservée)' : ''}.`);
  }

  // ---------- Filtrer ----------
  function basculerFiltre() {
    if (edition) validerEdition(0, 0);
    const f = feuille();
    memoriser();
    if (f.filtre) f.filtre = null;
    else {
      const z = zoneDeDonnees();
      if (z.l1 === z.l2) { historique.pop(); return Doc.message('Place-toi dans un tableau avec une ligne d\'en-tête pour filtrer.'); }
      f.filtre = { l: z.l1, c1: z.c1, c2: z.c2, l2: z.l2, exclus: {} };
    }
    marquerModifie(); rafraichir();
  }
  function lignesFiltrees() {
    const f = feuille(), r = new Set();
    if (!f.filtre) return r;
    const exclus = Object.entries(f.filtre.exclus || {}).filter(([, v]) => v && v.length);
    if (!exclus.length) return r;
    for (let l = f.filtre.l + 1; l <= f.filtre.l2; l++) {
      for (const [c, valeursExclues] of exclus) {
        const t = brut(l, +c) === '' ? '(Vides)' : afficher(valeurSure(l, +c), styleAffiche(l, +c));
        if (valeursExclues.includes(t)) { r.add(l); break; }
      }
    }
    return r;
  }
  function afficherFiltre() {
    const f = feuille();
    if (!f.filtre) return;
    for (let c = f.filtre.c1; c <= f.filtre.c2; c++) {
      const cellule = td(f.filtre.l, c);
      if (!cellule || cellule.style.display === 'none') continue;
      cellule.classList.add('avec-filtre');
      const actif = (f.filtre.exclus[c] || []).length > 0;
      cellule.insertAdjacentHTML('beforeend', `<button class="btn-filtre ${actif ? 'actif' : ''}" data-filtre-col="${c}" title="Trier et filtrer cette colonne">${actif ? '⧩' : '▾'}</button>`);
    }
  }
  function ouvrirFiltre(c, ancre) {
    const f = feuille(), fi = f.filtre;
    const valeursCol = new Set();
    for (let l = fi.l + 1; l <= fi.l2; l++) valeursCol.add(brut(l, c) === '' ? '(Vides)' : afficher(valeurSure(l, c), styleAffiche(l, c)));
    const liste = [...valeursCol].sort((a, b) => (a === '(Vides)') - (b === '(Vides)') || a.localeCompare(b, 'fr', { numeric: true }));
    const exclus = new Set(fi.exclus[c] || []);
    const menu = $('menu-filtre');
    const esc = (t) => String(t).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));
    menu.innerHTML = `<button data-tri="1">↑ Trier de A à Z</button><button data-tri="-1">↓ Trier de Z à A</button><hr>
      <div class="valeurs-filtre"><label><input type="checkbox" data-tout ${exclus.size ? '' : 'checked'}> <b>(Tout sélectionner)</b></label>
      ${liste.map((v) => `<label><input type="checkbox" data-valeur="${esc(v)}" ${exclus.has(v) ? '' : 'checked'}> ${esc(v)}</label>`).join('')}</div>
      <div class="boutons-fenetre"><button class="btn" data-annuler-filtre>Annuler</button><button class="btn principal" data-ok-filtre>OK</button></div>`;
    Ruban.ouvrirMenu(menu, ancre);
    const cases = () => [...menu.querySelectorAll('[data-valeur]')];
    menu.querySelector('[data-tout]').addEventListener('change', (e) => cases().forEach((x) => { x.checked = e.target.checked; }));
    menu.querySelectorAll('[data-tri]').forEach((b) => b.addEventListener('click', () => { Ruban.fermerMenus(); trier(+b.dataset.tri, c, { l1: fi.l, l2: fi.l2, c1: fi.c1, c2: fi.c2 }); }));
    menu.querySelector('[data-annuler-filtre]').addEventListener('click', () => Ruban.fermerMenus());
    menu.querySelector('[data-ok-filtre]').addEventListener('click', () => {
      memoriser();
      fi.exclus[c] = cases().filter((x) => !x.checked).map((x) => x.dataset.valeur);
      Ruban.fermerMenus(); marquerModifie(); rafraichir();
    });
  }

  // ---------- Figer les volets ----------
  function figer(l, c) {
    if (edition) validerEdition(0, 0);
    memoriser();
    feuille().figer = l || c ? { l, c } : null;
    marquerModifie(); rafraichir();
    if (l || c) Doc.message(l && c ? `Lignes 1 à ${l} et colonnes A à ${F.colVersLettres(c - 1)} figées.` : l ? `${l > 1 ? `Lignes 1 à ${l}` : 'Ligne 1'} figée${l > 1 ? 's' : ''}.` : `Colonne${c > 1 ? 's A à ' + F.colVersLettres(c - 1) : ' A'} figée${c > 1 ? 's' : ''}.`);
  }
  function appliquerFiger() {
    const fg = feuille().figer;
    if (!fg) return;
    const hautEntete = grille.rows[0].offsetHeight;
    let haut = hautEntete;
    for (let l = 0; l < Math.min(fg.l, nbLignes); l++) {
      const tr = grille.rows[l + 1];
      for (const cel of tr.cells) { cel.classList.add('fige'); cel.style.top = haut + 'px'; if (l === fg.l - 1) cel.classList.add('bord-fige-bas'); }
      tr.cells[0].style.zIndex = 3;
      haut += tr.style.display === 'none' ? 0 : tr.offsetHeight;
    }
    let gauche = 40;
    for (let c = 0; c < Math.min(fg.c, nbCols); c++) {
      for (let l = -1; l < nbLignes; l++) {
        const cel = l < 0 ? grille.rows[0].cells[c + 1] : td(l, c);
        if (!cel) continue;
        cel.classList.add('fige'); cel.style.left = gauche + 'px';
        cel.style.zIndex = l < 0 ? 3 : l < fg.l ? 3 : 2;
        if (c === fg.c - 1) cel.classList.add('bord-fige-droite');
      }
      gauche += largeurAffichee(c);
    }
  }

  // ---------- Masquer / afficher, hauteur et largeur ----------
  function masquer(axe, cacher) {
    if (edition) validerEdition(0, 0);
    const f = feuille(), b = bornes();
    memoriser();
    const [cle_, d, a] = axe === 'l' ? ['masquesL', b.l1, b.l2] : ['masquesC', b.c1, b.c2];
    if (cacher) { for (let n = d; n <= a; n++) if (!f[cle_].includes(n)) f[cle_].push(n); }
    else {
      // Afficher : les lignes / colonnes masquées dans la sélection, ou juste à côté.
      const avant = f[cle_].length;
      f[cle_] = f[cle_].filter((n) => n < d - 1 || n > a + 1);
      if (f[cle_].length === avant) f[cle_] = []; // rien de masqué près de la sélection : on affiche tout
    }
    marquerModifie(); construire();
  }
  async function dimension(axe) {
    if (edition) validerEdition(0, 0);
    const b = bornes(), f = feuille();
    const actuel = axe === 'l' ? Math.round(hauteurLig(b.l1) * 0.75) : Math.round((largeurCol(b.c1) - 5) / 7);
    const texte = await Doc.demanderNom(axe === 'l' ? 'Hauteur de ligne (en points, 15 par défaut)' : 'Largeur de colonne (en caractères, 11 par défaut)', String(actuel));
    const n = parseFloat(String(texte || '').replace(',', '.'));
    if (!(n > 0)) return;
    memoriser();
    if (axe === 'l') for (let l = b.l1; l <= b.l2; l++) f.hauteurs[l] = Math.max(8, Math.round(n / 0.75));
    else for (let c = b.c1; c <= b.c2; c++) f.largeurs[c] = Math.max(24, Math.round(n * 7 + 5));
    marquerModifie(); construire();
  }

  // ---------- Imprimer / exporter en PDF ----------
  function exporterPdf() {
    if (edition) validerEdition(0, 0);
    const fond = document.createElement('div');
    fond.className = 'fond-fenetre';
    const b = bornes(), multi = b.l1 !== b.l2 || b.c1 !== b.c2;
    fond.innerHTML = `<form class="fenetre">
      <h2>Imprimer / Exporter en PDF</h2>
      <label class="champ"><span>Que faut-il imprimer ?</span><select id="p-zone"><option value="feuille">La feuille « ${feuille().nom.replace(/</g, '')} »</option>${multi ? '<option value="selection">La sélection</option>' : ''}</select></label>
      <label class="champ"><span>Orientation</span><select id="p-orientation"><option value="portrait">Portrait</option><option value="paysage">Paysage</option></select></label>
      <label class="case"><input type="checkbox" id="p-quadrillage"> Imprimer le quadrillage</label>
      <label class="case"><input type="checkbox" id="p-graphiques" checked> Ajouter les graphiques de la feuille</label>
      <label class="case"><input type="checkbox" id="p-ajuster" checked> Ajuster à la largeur de la page</label>
      <p class="note">Le PDF est enregistré dans Mes documents : tu peux l'imprimer ou le déposer sur l'ENT.</p>
      <div class="boutons-fenetre"><button type="button" class="btn" data-annuler>Annuler</button><button type="submit" class="btn principal">Créer le PDF</button></div>
    </form>`;
    document.body.append(fond);
    fond.querySelector('[data-annuler]').addEventListener('click', () => fond.remove());
    fond.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const o = { zone: fond.querySelector('#p-zone').value, paysage: fond.querySelector('#p-orientation').value === 'paysage', quadrillage: fond.querySelector('#p-quadrillage').checked, graphiques: fond.querySelector('#p-graphiques').checked, ajuster: fond.querySelector('#p-ajuster').checked };
      fond.remove();
      const api = window.parent && window.parent.labo && window.parent.labo.pdf;
      if (!api) return Doc.message('Ouvre le tableur depuis Labo Élève pour créer un PDF.', 'erreur');
      try {
        Doc.message('Création du PDF…');
        const octets = await api.depuisHtml(htmlImpression(o), { paysage: o.paysage });
        const base = (fichier.nom || 'Classeur1').replace(/\.[^.]+$/, '');
        const nom = await Doc.enregistrer(`${base}.pdf`, octets, false);
        Doc.message(`PDF enregistré dans Mes documents : ${nom}`);
      } catch (err) { Doc.message(`PDF impossible : ${err.message}`, 'erreur'); }
    });
  }
  function htmlImpression(o) {
    const f = feuille();
    let z;
    if (o.zone === 'selection') z = bornes();
    else {
      z = { l1: 0, c1: 0, l2: 0, c2: 0 };
      for (const k of f.cellules.keys()) { const [l, c] = k.split(',').map(Number); z.l2 = Math.max(z.l2, l); z.c2 = Math.max(z.c2, c); }
      for (const m of f.fusions) { z.l2 = Math.max(z.l2, m.l2); z.c2 = Math.max(z.c2, m.c2); }
    }
    const esc = (t) => String(t).replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]));
    const cachees = lignesFiltrees();
    const colsVisibles = []; for (let c = z.c1; c <= z.c2; c++) if (!f.masquesC.includes(c)) colsVisibles.push(c);
    const couverts = new Set();
    for (const m of f.fusions) for (let l = m.l1; l <= m.l2; l++) for (let c = m.c1; c <= m.c2; c++) if (l !== m.l1 || c !== m.c1) couverts.add(cle(l, c));
    let lignes = '';
    for (let l = z.l1; l <= z.l2; l++) {
      if (f.masquesL.includes(l) || cachees.has(l)) continue;
      lignes += `<tr style="height:${hauteurLig(l)}px">`;
      for (const c of colsVisibles) {
        if (couverts.has(cle(l, c))) continue;
        const m = f.fusions.find((x) => x.l1 === l && x.c1 === c);
        const st = styleAffiche(l, c) || {};
        const v = brut(l, c) === '' ? '' : afficher(valeurSure(l, c), st);
        const nombre = typeof valeurSure(l, c) === 'number';
        const css = [st.g && 'font-weight:700', st.i && 'font-style:italic', st.s && 'text-decoration:underline', st.couleur && `color:${st.couleur}`, st.fond && `background:${st.fond}`,
          `text-align:${st.a || (nombre ? 'right' : 'left')}`, st.police && `font-family:'${st.police}'`, st.t && `font-size:${st.t}pt`, st.w ? 'white-space:normal' : 'white-space:nowrap',
          st.bord && st.bord.h && 'border-top:1px solid #000', st.bord && st.bord.b && 'border-bottom:1px solid #000', st.bord && st.bord.g && 'border-left:1px solid #000', st.bord && st.bord.d && 'border-right:1px solid #000'].filter(Boolean).join(';');
        lignes += `<td${m ? ` colspan="${m.c2 - m.c1 + 1}" rowspan="${m.l2 - m.l1 + 1}"` : ''} style="${css}">${esc(v)}</td>`;
      }
      lignes += '</tr>';
    }
    const images = o.graphiques ? graphiquesAffiches.map((g) => `<img src="${g.toBase64Image('image/png')}">`).join('') : '';
    const largeur = colsVisibles.reduce((s, c) => s + largeurCol(c), 0);
    const page = o.paysage ? 1050 : 720; // largeur utile en pixels (A4, petites marges)
    const echelle = o.ajuster && largeur > page ? page / largeur : 1;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body { margin: 0; font: 11pt Calibri, Arial, sans-serif; color: #000; }
      .zone { zoom: ${echelle}; }
      table { border-collapse: collapse; table-layout: fixed; }
      td { padding: 1px 4px; overflow: hidden; ${o.quadrillage ? 'border: 1px solid #bdbdbd;' : ''} vertical-align: bottom; }
      img { display: block; max-width: 100%; margin-top: 18px; page-break-inside: avoid; }
    </style></head><body><div class="zone"><table><colgroup>${colsVisibles.map((c) => `<col style="width:${largeurCol(c)}px">`).join('')}</colgroup><tbody>${lignes}</tbody></table>${images}</div></body></html>`;
  }

  // ---------- Ruban : boutons ----------
  // Nombre de décimales affichées dans la cellule active (point de départ des boutons ,0 / ,00)
  function decimalesActuelles() {
    const st = styleDe(sel.l, sel.c) || {};
    if (st.d != null) return st.d;
    if (st.fmt === 'pourcentage') return 0;
    if (st.fmt === 'nombre') return 2;
    const v = valeurSure(sel.l, sel.c);
    return typeof v === 'number' ? (afficher(v).split(',')[1] || '').length : 0;
  }
  const COMMANDES = {
    enregistrer: () => { if (edition) validerEdition(0, 0); enregistrer(); },
    'enregistrer-sous': () => { if (edition) validerEdition(0, 0); enregistrer(true); },
    'exporter-csv': () => exporterCsv(),
    nouveau: () => window.parent.ouvrirOutil && window.laboAvantFermeture() && (fichier.modifie = false, window.parent.ouvrirOutil('tableur')),
    annuler, retablir,
    copier: () => { copierSelection(false); try { navigator.clipboard.writeText(pressePapiers.texte); } catch { /* interne */ } Doc.message('Copié'); },
    couper: () => { copierSelection(true); try { navigator.clipboard.writeText(pressePapiers.texte); } catch { /* interne */ } Doc.message('Coupé : choisis où coller'); },
    coller: collerDepuisBouton,
    effacer: effacerSelection,
    recopier: recopierBas,
    'sans-couleur': () => styliser((st) => { st.couleur = null; st.fond = null; }),
    pourcentage: () => styliser((st) => { st.fmt = st.fmt === 'pourcentage' ? null : 'pourcentage'; }),
    'decimales+': () => styliser((st) => { st.d = Math.min(10, decimalesActuelles() + 1); }),
    'decimales-': () => styliser((st) => { st.d = Math.max(0, decimalesActuelles() - 1); }),
    'ligne+': () => changerStructure('l', bornes().l1, 1),
    'ligne-': () => changerStructure('l', bornes().l1, -1),
    'colonne+': () => changerStructure('c', bornes().c1, 1),
    'colonne-': () => changerStructure('c', bornes().c1, -1),
    'feuille+': ajouterFeuille,
    fx: insererFonctionFenetre,
    renvoi: () => basculerStyle('w'),
    fusionner,
    'trier-az': () => trier(1),
    'trier-za': () => trier(-1),
    filtrer: basculerFiltre,
    'effacer-filtres': () => { const f = feuille(); if (f.filtre) { memoriser(); f.filtre.exclus = {}; marquerModifie(); rafraichir(); } },
    figer: () => figer(sel.l, sel.c),
    'figer-ligne': () => figer(1, 0),
    'figer-colonne': () => figer(0, 1),
    liberer: () => figer(0, 0),
    'masquer-lignes': () => masquer('l', true),
    'masquer-colonnes': () => masquer('c', true),
    'afficher-lignes': () => masquer('l', false),
    'afficher-colonnes': () => masquer('c', false),
    hauteur: () => dimension('l'),
    largeur: () => dimension('c'),
    'entete-inserer': () => (enteteMenu === 'c' ? changerStructure('c', bornes().c1, 1) : changerStructure('l', bornes().l1, 1)),
    'entete-supprimer': () => (enteteMenu === 'c' ? changerStructure('c', bornes().c1, -1) : changerStructure('l', bornes().l1, -1)),
    'entete-taille': () => dimension(enteteMenu || 'c'),
    'entete-masquer': () => masquer(enteteMenu || 'c', true),
    'entete-afficher': () => masquer(enteteMenu || 'c', false),
    pdf: exporterPdf,
    simulation: ouvrirSimulation,
    relancer: relancerTirages,
    'g-donnees': changerDonneesGraphique,
    'g-copier': () => document.querySelector(`.carte-graphique[data-i="${grapheChoisi}"] [data-copier]`)?.click(),
    'g-suppr': () => { if (grapheChoisi === null) return; memoriser(); classeur.graphiques.splice(grapheChoisi, 1); grapheChoisi = null; marquerModifie(); deselectionnerGraphique(); rafraichirGraphiques(); },
    quadrillage: () => { const sans = $('zone-grille').classList.toggle('sans-quadrillage'); $('btn-quadrillage').classList.toggle('actif', !sans); },
    zoom100: () => fixerZoom(1),
    'zoom+': () => fixerZoom(zoom + 0.1),
    'zoom-': () => fixerZoom(zoom - 0.1),
  };
  document.addEventListener('mousedown', (e) => { if (e.target.closest('.ruban, .barre-titre, .menu-flottant, .boutons-formule') && !e.target.closest('select, input')) e.preventDefault(); });
  $('nom-police').addEventListener('change', (e) => { const v = e.target.value; styliser((st) => { st.police = v === 'Calibri' ? null : v; }); zone.focus(); });
  $('taille-police').addEventListener('change', (e) => { const v = +e.target.value; styliser((st) => { st.t = v === 11 ? null : v; }); zone.focus(); });
  // Aide à la saisie des formules (liste des fonctions, bulle de syntaxe)
  window.AideFormules.installer(editeur);
  window.AideFormules.installer(barre);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd], [data-style], [data-align], [data-bordure], [data-fonction], [data-graphique], [data-menu]');
    if (!b || b.closest('#onglets')) return;
    if (b.dataset.menu) { Ruban.ouvrirMenu($(b.dataset.menu), b); return; }
    Ruban.fermerMenus();
    if (b.dataset.cmd && COMMANDES[b.dataset.cmd]) COMMANDES[b.dataset.cmd]();
    else if (b.dataset.style) basculerStyle(b.dataset.style);
    else if (b.dataset.align) { const a = b.dataset.align; const deja = (styleDe(sel.l, sel.c) || {}).a === a; styliser((st) => { st.a = deja ? null : a; }); }
    else if (b.dataset.bordure) {
      const type = b.dataset.bordure;
      styliser((st, l, c, bo) => {
        if (type === 'aucune') { st.bord = null; return; }
        const bord = { ...(st.bord || {}) };
        if (type === 'tout') Object.assign(bord, { h: true, b: true, g: true, d: true });
        if (type === 'contour') { if (l === bo.l1) bord.h = true; if (l === bo.l2) bord.b = true; if (c === bo.c1) bord.g = true; if (c === bo.c2) bord.d = true; }
        if (type === 'bas' && l === bo.l2) bord.b = true;
        st.bord = bord;
      });
    } else if (b.dataset.fonction) insererFonction(b.dataset.fonction);
    else if (b.dataset.graphique) ouvrirFenetreGraphique(b.dataset.graphique);
    if (!edition && !b.closest('form')) zone.focus();
  });
  $('onglet-fichier').addEventListener('click', (e) => Ruban.ouvrirMenu($('menu-fichier'), e.currentTarget));
  $('choix-remplissage').addEventListener('input', (e) => { $('barre-remplissage').style.background = e.target.value; styliser((st) => { st.fond = e.target.value; }); });
  $('choix-police').addEventListener('input', (e) => { $('barre-police').style.background = e.target.value; styliser((st) => { st.couleur = e.target.value; }); });
  $('format-nombre').addEventListener('change', (e) => { const v = e.target.value; styliser((st) => { st.fmt = v === 'standard' ? null : v; if (v === 'standard') st.d = null; }); zone.focus(); });
  // Clic droit : menu contextuel
  let enteteMenu = null;
  grille.addEventListener('contextmenu', (e) => {
    const entete = e.target.closest('th[data-col], th[data-lig]');
    if (entete) {
      e.preventDefault();
      if (edition) validerEdition(0, 0);
      enteteMenu = entete.dataset.col !== undefined ? 'c' : 'l';
      const n = +(entete.dataset.col ?? entete.dataset.lig), b = bornes();
      const dedans = enteteMenu === 'c' ? n >= b.c1 && n <= b.c2 && b.l1 === 0 && b.l2 >= nbLignes - 1 : n >= b.l1 && n <= b.l2 && b.c1 === 0 && b.c2 >= nbCols - 1;
      if (!dedans) { if (enteteMenu === 'c') { sel.l = 0; sel.l2 = nbLignes - 1; sel.c = sel.c2 = n; } else { sel.c = 0; sel.c2 = nbCols - 1; sel.l = sel.l2 = n; } afficherSelection(); }
      Ruban.ouvrirMenu($('menu-entete'), { getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY }) });
      return;
    }
    const cellule = e.target.closest('td');
    if (!cellule) return;
    e.preventDefault();
    if (edition) validerEdition(0, 0);
    const l = +cellule.dataset.l, c = +cellule.dataset.c, b = bornes();
    if (l < b.l1 || l > b.l2 || c < b.c1 || c > b.c2) deplacer(l, c);
    Ruban.ouvrirMenu($('menu-contextuel'), { getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY }) });
  });

  // ---------- Fichiers ----------
  function lireCsv(octets) {
    let texte;
    try { texte = new TextDecoder('utf-8', { fatal: true }).decode(octets); } catch { texte = new TextDecoder('windows-1252').decode(octets); }
    texte = texte.replace(/^﻿/, '');
    const premiere = texte.split(/\r?\n/)[0] || '';
    const sep = [';', '\t', ','].map((s) => [s, premiere.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
    const f = nouvelleFeuille('Feuil1');
    let l = 0, c = 0, champ = '', guillemets = false;
    const pousser = () => { if (champ !== '') f.cellules.set(cle(l, c), champ); champ = ''; };
    for (let i = 0; i < texte.length; i++) {
      const ch = texte[i];
      if (guillemets) { if (ch === '"' && texte[i + 1] === '"') { champ += '"'; i++; } else if (ch === '"') guillemets = false; else champ += ch; }
      else if (ch === '"') guillemets = true;
      else if (ch === sep) { pousser(); c++; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && texte[i + 1] === '\n') i++; pousser(); l++; c = 0; }
      else champ += ch;
    }
    pousser();
    return { feuilles: [f], graphiques: [] };
  }

  const FEUILLE_GRAPHIQUES = '_LaboGraphiques';
  function lireAvecSheetJS(octets) {
    const wb = XLSX.read(octets, { type: 'array', cellFormula: true, cellNF: true, cellStyles: true });
    let graphiques = [];
    try { graphiques = JSON.parse((wb.Custprops || {}).LaboGraphiques || '[]'); } catch { graphiques = []; }
    const feuilles = [];
    for (const nom of wb.SheetNames) {
      const ws = wb.Sheets[nom];
      if (nom === FEUILLE_GRAPHIQUES) { try { graphiques = JSON.parse(ws.A1 && ws.A1.v); } catch { /* ignoré */ } continue; }
      const f = nouvelleFeuille(nom);
      for (const [adr, cel] of Object.entries(ws)) {
        if (adr[0] === '!') continue;
        const { r, c } = XLSX.utils.decode_cell(adr);
        let v;
        if (cel.f) v = '=' + F.depuisExcel(cel.f);
        else if (cel.t === 'n') v = cel.z && XLSX.SSF.is_date(cel.z) ? XLSX.SSF.format('dd/mm/yyyy', cel.v) : String(cel.v).replace('.', ',');
        else if (cel.t === 'b') v = cel.v ? 'VRAI' : 'FAUX';
        else if (cel.t === 'e') v = cel.w || '';
        else v = String(cel.v ?? '');
        if (v !== '') f.cellules.set(cle(r, c), v);
        // Format de nombre (décimales, pourcentage)
        if (cel.z && cel.t === 'n' && !XLSX.SSF.is_date(cel.z)) {
          const m = /0(?:[.,](0+))?(%?)/.exec(cel.z);
          if (m) f.styles.set(cle(r, c), { fmt: /€/.test(cel.z) ? 'monetaire' : m[2] ? 'pourcentage' : 'nombre', d: (m[1] || '').length });
        }
      }
      (ws['!cols'] || []).forEach((col, i) => { if (!col) return; if (col.hidden) f.masquesC.push(i); else if (col.wpx || col.wch) f.largeurs[i] = Math.round(col.wpx || col.wch * 7 + 5); });
      (ws['!rows'] || []).forEach((rg, i) => { if (!rg) return; if (rg.hidden) f.masquesL.push(i); else if (rg.hpx || rg.hpt) { const h = Math.round(rg.hpx || rg.hpt / 0.75); if (Math.abs(h - 20) > 2) f.hauteurs[i] = h; } });
      (ws['!merges'] || []).forEach((m) => f.fusions.push({ l1: m.s.r, c1: m.s.c, l2: m.e.r, c2: m.e.c }));
      if (ws['!autofilter'] && ws['!autofilter'].ref) { const z = XLSX.utils.decode_range(ws['!autofilter'].ref); f.filtre = { l: z.s.r, c1: z.s.c, c2: z.e.c, l2: z.e.r, exclus: {} }; }
      feuilles.push(f);
    }
    return { feuilles: feuilles.length ? feuilles : [nouvelleFeuille('Feuil1')], graphiques };
  }

  // Mise en forme lue avec ExcelJS (gras, couleurs, bordures, alignement)
  const hexDe = (couleur) => (couleur && couleur.argb && couleur.argb.length >= 6 ? '#' + couleur.argb.slice(-6).toLowerCase() : null);
  async function ajouterStylesExcelJS(octets, resultat) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(octets);
      wb.eachSheet((ws) => {
        const f = resultat.feuilles.find((x) => x.nom === ws.name);
        if (!f) return;
        const vue = (ws.views || [])[0];
        if (vue && vue.state === 'frozen' && (vue.xSplit || vue.ySplit)) f.figer = { l: vue.ySplit || 0, c: vue.xSplit || 0 };
        ws.eachRow({ includeEmpty: false }, (row, numL) => row.eachCell({ includeEmpty: true }, (cell, numC) => {
          const k = cle(numL - 1, numC - 1), st = { ...(f.styles.get(k) || {}) }, s = cell.style || {};
          if (s.font) { if (s.font.name && s.font.name !== 'Calibri') st.police = s.font.name; if (s.font.size && s.font.size !== 11) st.t = s.font.size; if (s.font.bold) st.g = true; if (s.font.italic) st.i = true; if (s.font.underline) st.s = true; const c = hexDe(s.font.color); if (c && c !== '#000000') st.couleur = c; }
          if (s.fill && s.fill.type === 'pattern' && s.fill.pattern === 'solid') { const c = hexDe(s.fill.fgColor); if (c) st.fond = c; }
          if (s.alignment && ['left', 'center', 'right'].includes(s.alignment.horizontal)) st.a = s.alignment.horizontal;
          if (s.alignment && s.alignment.wrapText) st.w = true;
          if (s.border) { const b = { h: !!(s.border.top && s.border.top.style), b: !!(s.border.bottom && s.border.bottom.style), g: !!(s.border.left && s.border.left.style), d: !!(s.border.right && s.border.right.style) }; if (Object.values(b).some(Boolean)) st.bord = b; }
          if (Object.keys(st).length) f.styles.set(k, st);
        }));
      });
    } catch { /* mise en forme ignorée si le fichier n'est pas lisible par ExcelJS */ }
  }

  async function ecrireXlsx() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Labo Élève';
    const sauvegarde = active;
    classeur.feuilles.forEach((f, i) => {
      active = i; valeurs = new Map(); enCours = new Set();
      const ws = wb.addWorksheet((f.nom || `Feuil${i + 1}`).slice(0, 31));
      for (const [c, w] of Object.entries(f.largeurs)) ws.getColumn(+c + 1).width = Math.max(2, (w - 5) / 7);
      const touches = new Set([...f.cellules.keys(), ...f.styles.keys()]);
      for (const k of touches) {
        const [l, c] = k.split(',').map(Number);
        const cell = ws.getCell(l + 1, c + 1);
        const r = brut(l, c, f);
        if (r !== '') {
          const v = valeurSure(l, c);
          const resultatFormule = v instanceof F.ErreurCellule ? { error: v.code === '#DIV/0!' ? '#DIV/0!' : v.code === '#NOM?' ? '#NAME?' : '#VALUE!' } : v;
          if (r[0] === '=') cell.value = { formula: F.versExcel(r.slice(1)), result: resultatFormule === null ? undefined : resultatFormule };
          else cell.value = v instanceof F.ErreurCellule ? r : v;
        }
        const st = styleAffiche(l, c, f);
        if (st) {
          if (st.g || st.i || st.s || st.couleur || st.police || st.t) cell.font = { name: st.police || 'Calibri', size: st.t || 11, bold: !!st.g, italic: !!st.i, underline: !!st.s, color: st.couleur ? { argb: 'FF' + st.couleur.slice(1).toUpperCase() } : undefined };
          if (st.fond) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + st.fond.slice(1).toUpperCase() } };
          if (st.a || st.w) cell.alignment = { horizontal: st.a || undefined, vertical: st.w ? 'top' : undefined, wrapText: !!st.w };
          if (st.bord) { const t = { style: 'thin', color: { argb: 'FF000000' } }; cell.border = { top: st.bord.h ? t : undefined, bottom: st.bord.b ? t : undefined, left: st.bord.g ? t : undefined, right: st.bord.d ? t : undefined }; }
          if (st.fmt === 'date') cell.numFmt = 'dd/mm/yyyy';
          else if (st.fmt === 'monetaire') { const d = st.d ?? 2; cell.numFmt = '#,##0' + (d ? '.' + '0'.repeat(d) : '') + ' "€"'; }
          else if (st.fmt || st.d != null) { const d = st.d ?? (st.fmt === 'pourcentage' ? 0 : 2); cell.numFmt = (st.fmt === 'nombre' ? '#,##0' : '0') + (d ? '.' + '0'.repeat(d) : '') + (st.fmt === 'pourcentage' ? '%' : ''); }
        }
      }
    });
    // Structure de chaque feuille : fusions, hauteurs, masques, volets figés, filtre
    classeur.feuilles.forEach((f, i) => {
      const ws = wb.worksheets[i];
      for (const m of f.fusions) { try { ws.mergeCells(m.l1 + 1, m.c1 + 1, m.l2 + 1, m.c2 + 1); } catch { /* fusion invalide ignorée */ } }
      for (const [l, h] of Object.entries(f.hauteurs)) ws.getRow(+l + 1).height = Math.round(h * 0.75);
      f.masquesC.forEach((c) => { ws.getColumn(c + 1).hidden = true; });
      f.masquesL.forEach((l) => { ws.getRow(l + 1).hidden = true; });
      if (f.figer && (f.figer.l || f.figer.c)) ws.views = [{ state: 'frozen', xSplit: f.figer.c || 0, ySplit: f.figer.l || 0 }];
      if (f.filtre) ws.autoFilter = { from: { row: f.filtre.l + 1, column: f.filtre.c1 + 1 }, to: { row: f.filtre.l2 + 1, column: f.filtre.c2 + 1 } };
    });
    active = sauvegarde; valeurs = new Map();
    // Les graphiques sont gardés pour Labo Élève dans une feuille masquée.
    if (classeur.graphiques.length) {
      const wsG = wb.addWorksheet(FEUILLE_GRAPHIQUES, { state: 'veryHidden' });
      wsG.getCell('A1').value = JSON.stringify(classeur.graphiques);
    }
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }

  function ecrireCsv() {
    let lMax = -1, cMax = -1;
    for (const k of feuille().cellules.keys()) { const [l, c] = k.split(',').map(Number); lMax = Math.max(lMax, l); cMax = Math.max(cMax, c); }
    const lignes = [];
    for (let l = 0; l <= lMax; l++) {
      const champs = [];
      for (let c = 0; c <= cMax; c++) { const t = brut(l, c) === '' ? '' : afficher(valeurSure(l, c), styleDe(l, c)); champs.push(/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t); }
      lignes.push(champs.join(';'));
    }
    return new TextEncoder().encode('﻿' + lignes.join('\r\n'));
  }

  async function enregistrer(sous = false) {
    try {
      let nom, remplacer = true;
      if (sous || (fichier.nouveau && !fichier.dejaEnregistre)) {
        const choisi = await Doc.demanderNom('Enregistrer sous — nom du classeur', (fichier.nom || 'Classeur1').replace(/\.(xlsx|csv|xls|ods)$/i, ''));
        if (!choisi) return;
        nom = choisi.replace(/\.(xlsx|csv)$/i, '') + '.xlsx';
        remplacer = false;
      } else {
        nom = Doc.cible(fichier.nom, /\.csv$/i.test(fichier.nom) ? '.csv' : '.xlsx', fichier.nouveau || fichier.dejaEnregistre);
      }
      const estCsv = /\.csv$/i.test(nom);
      $('etat-fichier').textContent = ' · enregistrement…';
      const octets = estCsv ? ecrireCsv() : await ecrireXlsx();
      const final = await Doc.enregistrer(nom, octets, remplacer);
      fichier = { nom: final, nouveau: false, dejaEnregistre: true, modifie: false };
      $('nom-fichier').textContent = final;
      $('etat-fichier').textContent = ' · enregistré';
      Doc.message(`Enregistré dans Mes documents : ${final}`);
    } catch (e) { $('etat-fichier').textContent = ' · non enregistré'; Doc.message(e.message, 'erreur'); }
  }
  async function exporterCsv() {
    try {
      const base = (fichier.nom || 'Classeur1').replace(/\.[^.]+$/, '');
      const final = await Doc.enregistrer(`${base}.csv`, ecrireCsv(), false);
      Doc.message(`Exporté en CSV : ${final}` + (classeur.feuilles.length > 1 ? ' (feuille active seulement)' : ''));
    } catch (e) { Doc.message(e.message, 'erreur'); }
  }

  async function ouvrir(nom) {
    try {
      const octets = new Uint8Array(await Doc.lire(nom));
      if (/\.csv$/i.test(nom)) classeur = lireCsv(octets);
      else {
        classeur = lireAvecSheetJS(octets);
        if (/\.xlsx$/i.test(nom)) await ajouterStylesExcelJS(octets, classeur);
      }
      active = 0;
      fichier = { nom, nouveau: false, dejaEnregistre: / - complété\.[^.]+$/.test(nom), modifie: false };
      $('nom-fichier').textContent = nom;
      $('etat-fichier').textContent = fichier.dejaEnregistre ? '' : ' · tes modifications iront dans une copie « - complété »';
    } catch (e) {
      Doc.message(`Impossible d'ouvrir ce fichier : ${e.message}`, 'erreur');
    }
  }

  window.laboAvantFermeture = () => !fichier.modifie || confirm('Ton classeur n\'est pas enregistré. Quitter quand même ?');

  // ---------- Démarrage ----------
  (async () => {
    Ruban.installer();
    const aOuvrir = new URLSearchParams(location.search).get('ouvrir');
    if (aOuvrir) await ouvrir(aOuvrir);
    afficherOnglets();
    construire();
    fixerZoom(1);
    zone.focus();
  })();
})();
