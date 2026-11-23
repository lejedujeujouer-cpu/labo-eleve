// Tableau périodique — version bac pro / CAP.
// Au programme : constitution de l'atome (Z, A, protons, neutrons, électrons), répartition des électrons
// ions courants, familles
// (alcalins, halogènes, gaz nobles), masse molaire et quantité de matière n = m / M.
(function () {
  const $ = (id) => document.getElementById(id);

  const CATEGORIES = {
    alcalin: { nom: 'Alcalins (colonne 1)', couleur: '#ef4444' },
    halogene: { nom: 'Halogènes (colonne 17)', couleur: '#14b8a6' },
    gaznoble: { nom: 'Gaz nobles (colonne 18)', couleur: '#8b5cf6' },
    metal: { nom: 'Autres métaux', couleur: '#60a5fa' },
    nonmetal: { nom: 'Autres non-métaux', couleur: '#eab308' },
  };
  const ALCALINS = [3, 11, 19, 37, 55, 87];
  const HALOGENES = [9, 17, 35, 53, 85];
  const GAZ_NOBLES = [2, 10, 18, 36, 54, 86, 118];
  const NON_METAUX = [1, 5, 6, 7, 8, 14, 15, 16, 32, 33, 34, 51, 52];
  // Nombre de masse A de l'isotope le plus courant (éléments affichés : H à Xe)
  const NOMBRE_DE_MASSE = [1, 4, 7, 9, 11, 12, 14, 16, 19, 20, 23, 24, 27, 28, 31, 32, 35, 40, 39, 40,
    45, 48, 51, 52, 55, 56, 59, 58, 63, 64, 69, 74, 75, 80, 79, 84,
    85, 88, 89, 90, 93, 98, 99, 102, 103, 106, 107, 114, 115, 120, 121, 130, 127, 129];
  const Z_MAX = 54; // tableau des 5 premières lignes (programme de CAP / bac pro)
  const ROMAINS = { 1: 'I', 2: 'II', 13: 'III', 14: 'IV', 15: 'V', 16: 'VI', 17: 'VII', 18: 'VIII' };
  // Ions courants étudiés en CAP / bac pro
  const IONS = { 1: 'H⁺', 3: 'Li⁺', 4: 'Be²⁺', 8: 'O²⁻', 9: 'F⁻', 11: 'Na⁺', 12: 'Mg²⁺', 13: 'Al³⁺', 16: 'S²⁻', 17: 'Cl⁻', 19: 'K⁺', 20: 'Ca²⁺',
    26: 'Fe²⁺ et Fe³⁺', 29: 'Cu²⁺', 30: 'Zn²⁺', 35: 'Br⁻', 47: 'Ag⁺', 53: 'I⁻' };
  const COURANTS = [1, 2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 26, 29, 30, 47, 50, 35, 53];

  // ---------- Données ----------
  const elements = window.ELEMENTS_BRUTS.trim().split(';').map((t, i) => {
    const [symbole, nom, masse] = t.trim().split('|');
    return { z: i + 1, symbole, nom, masse: parseFloat(masse) };
  });
  const parSymbole = Object.fromEntries(elements.map((e) => [e.symbole, e]));
  function categorie(z) {
    if (ALCALINS.includes(z)) return 'alcalin';
    if (HALOGENES.includes(z)) return 'halogene';
    if (GAZ_NOBLES.includes(z)) return 'gaznoble';
    if (NON_METAUX.includes(z)) return 'nonmetal';
    return 'metal';
  }
  function position(z) {
    const debuts = [1, 3, 11, 19, 37, 55, 87];
    let periode = 7;
    while (z < debuts[periode - 1]) periode--;
    const k = z - debuts[periode - 1];
    if (periode === 1) return { periode, groupe: z === 1 ? 1 : 18, ligne: 1 };
    if (periode <= 3) return { periode, groupe: k < 2 ? k + 1 : k + 11, ligne: periode };
    if (periode <= 5) return { periode, groupe: k + 1, ligne: periode };
    if (k < 2) return { periode, groupe: k + 1, ligne: periode };
    if (k < 17) return { periode, groupe: null, ligne: periode + 3, colonne: k + 1 };
    return { periode, groupe: k - 13, ligne: periode };
  }
  // Couches K, L, M, N (modèle simplifié, valable pour les 20 premiers éléments)
  function couches(z) {
    if (z > 20) return null;
    const max = [2, 8, 8, 2], noms = ['K', 'L', 'M', 'N'], r = [];
    let reste = z;
    for (let i = 0; i < 4 && reste > 0; i++) { const n = Math.min(reste, max[i]); r.push({ c: noms[i], n }); reste -= n; }
    return r;
  }
  const uneDecimale = (x) => x.toFixed(1).replace('.', ','); // 1,0 · 23,0 · 55,8 (comme dans le manuel)
  const exposant = (n) => String(n).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('');
  for (const e of elements) { Object.assign(e, position(e.z)); e.cat = categorie(e.z); }

  // ---------- Tableau ----------
  const tableau = $('tableau');
  let html = '';
  for (const [g, r] of Object.entries(ROMAINS)) html += `<div class="entete-groupe" style="grid-row:${g == 1 || g == 18 ? 1 : 2};grid-column:${g}">${r}</div>`;
  const caseHtml = (e) => `<span class="a">${NOMBRE_DE_MASSE[e.z - 1]}</span><span class="z">${e.z}</span><span class="sym">${e.symbole}</span><span class="nom-el">${e.nom}</span><span class="m">${uneDecimale(e.masse)}</span>`;
  // Lignes de la grille : 1 = en-têtes I et VIII, puis une rangée par période (les en-têtes II à VII sont dans la rangée de H, en bas).
  const rangee = (p) => ({ 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }[p]);
  for (const e of elements.filter((x) => x.z <= Z_MAX)) {
    const r = rangee(e.periode);
    html += `<button class="el${COURANTS.includes(e.z) ? ' courant' : ''}" data-z="${e.z}" style="--cat:${CATEGORIES[e.cat].couleur};grid-row:${r};grid-column:${e.groupe}" title="${e.nom}">${caseHtml(e)}</button>`;
  }
  // Case explicative (comme dans le manuel)
  html += `<div class="explication" style="grid-row:2 / 5;grid-column:3 / 13">
    <div class="ex-gauche"><span class="ex-a">Nombre de masse : <i>A</i></span><span class="ex-z">Numéro atomique : <i>Z</i></span></div>
    <div class="ex-case"><span class="a"><i>A</i></span><span class="z"><i>Z</i></span><span class="sym">X</span><span class="m"><i>M</i></span></div>
    <div class="ex-droite"><span>X : symbole de l'élément</span><span class="ex-m"><i>M</i> : masse molaire atomique (g/mol)</span></div>
  </div>`;
  tableau.innerHTML = html;

  // ---------- Légende et filtres ----------
  let filtre = null;
  $('legende').innerHTML = Object.entries(CATEGORIES).map(([id, c]) => `<button data-cat="${id}" style="--cat:${c.couleur}">${c.nom}</button>`).join('')
    + '<button data-cat="courants" class="courants">Éléments à connaître</button>';
  const garde = (z, f) => (f === 'courants' ? COURANTS.includes(z) : elements[z - 1].cat === f);
  function surligner(f) { tableau.querySelectorAll('.el').forEach((b) => b.classList.toggle('estompe', !!f && !garde(+b.dataset.z, f))); }
  $('legende').addEventListener('mouseover', (e) => { const b = e.target.closest('[data-cat]'); if (b) surligner(b.dataset.cat); });
  $('legende').addEventListener('mouseleave', () => surligner(filtre));
  $('legende').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    filtre = filtre === b.dataset.cat ? null : b.dataset.cat;
    $('legende').querySelectorAll('button').forEach((x) => x.classList.toggle('actif', x.dataset.cat === filtre));
    surligner(filtre);
  });

  // ---------- Fiche d'un élément ----------
  function afficherFiche(z) {
    const e = elements[z - 1];
    tableau.querySelectorAll('.el.choisi').forEach((b) => b.classList.remove('choisi'));
    tableau.querySelector(`[data-z="${z}"]`).classList.add('choisi');
    const A = NOMBRE_DE_MASSE[z - 1];
    const zone = $('zone-fiche');
    zone.style.setProperty('--cat', CATEGORIES[e.cat].couleur);
    // Les réponses (protons, neutrons, électrons) ne sont pas affichées : l'élève les retrouve
    // à partir de la case (A et Z), puis vérifie ses réponses.
    const champ = (id, label) => `<label class="q"><span>${label}</span><input type="number" min="0" step="1" inputmode="numeric" data-q="${id}"><b class="res" data-res="${id}"></b></label>`;
    const attendu = { protons: z, electrons: z };
    if (A) attendu.neutrons = A - z;
    zone.innerHTML = `
      <div class="fiche">
        <div class="case-element">
          ${A ? '<span class="lib lib-a">A</span>' : ''}<span class="lib lib-z">Z</span>
          <div class="grand">${caseHtml(e)}</div>
        </div>
        <div class="titre-el">${e.nom}</div>
        <div class="cat">${CATEGORIES[e.cat].nom}</div>
        <div><button class="btn petit" id="ajout-formule">+ Ajouter à la formule</button></div>
      </div>
      <p class="note legende-case"><b>A</b> : nombre de masse · <b>Z</b> : numéro atomique · <b>M</b> : masse molaire (g/mol)</p>
      <div class="a-trouver">
        <h3>🔎 À toi de trouver</h3>
        <div class="qs">
          ${champ('protons', 'Nombre de protons')}
          ${A ? champ('neutrons', 'Nombre de neutrons') : ''}
          ${champ('electrons', 'Nombre d\'électrons')}
        </div>
        <div class="ligne-btn"><button class="btn principal petit" id="verifier">✔ Vérifier</button><span id="bilan" class="note"></span></div>
      </div>
      <dl class="details">
        <dt>Ligne · Colonne</dt><dd>${e.periode} · ${e.groupe ?? '3'}</dd>
        ${IONS[z] && z > 20 ? `<dt>Ion courant</dt><dd>${IONS[z]}</dd>` : ''}
        <dt>Masse molaire</dt><dd>${uneDecimale(e.masse)} g/mol</dd>
      </dl>`;
    $('verifier').addEventListener('click', () => {
      let justes = 0, total = 0, vides = 0;
      zone.querySelectorAll('[data-q]').forEach((inp) => {
        const id = inp.dataset.q, res = zone.querySelector(`[data-res="${id}"]`);
        total++;
        if (inp.value === '') { vides++; res.textContent = ''; inp.classList.remove('juste', 'faux'); return; }
        const ok = +inp.value === attendu[id];
        if (ok) justes++;
        inp.classList.toggle('juste', ok); inp.classList.toggle('faux', !ok);
        res.textContent = ok ? '✔' : '✘';
      });
      $('bilan').textContent = vides === total ? 'Remplis les cases, puis vérifie.'
        : justes === total ? '🎉 Tout est juste !'
        : `${justes} / ${total} juste${justes > 1 ? 's' : ''}.` + (vides ? ` ${vides} case${vides > 1 ? 's' : ''} vide${vides > 1 ? 's' : ''}.` : ' Corrige les cases en rouge.');
    });
    $('ajout-formule').addEventListener('click', () => { const f = $('formule'); f.value += e.symbole; f.dispatchEvent(new Event('input')); f.focus(); });
  }
  tableau.addEventListener('click', (e) => { const b = e.target.closest('.el'); if (b) afficherFiche(+b.dataset.z); });

  // ---------- Masse molaire ----------
  function lireFormule(texte) {
    const s = texte.replace(/\s+/g, '');
    if (!s) throw new Error('Écris une formule, par exemple H2O');
    const { compte, pos } = lireGroupe(s, 0, null);
    if (pos < s.length) throw new Error(`Caractère inattendu « ${s[pos]} »`);
    return compte;
  }
  function lireGroupe(s, pos, fermante) {
    const compte = {};
    const ajouter = (sym, n) => (compte[sym] = (compte[sym] || 0) + n);
    const lireNombre = () => { const m = /^\d+/.exec(s.slice(pos)); if (!m) return 1; pos += m[0].length; return +m[0]; };
    while (pos < s.length) {
      const c = s[pos];
      if (c === ')') { if (fermante !== ')') throw new Error('Parenthèse « ) » en trop'); return { compte, pos: pos + 1 }; }
      if (c === '(') {
        const r = lireGroupe(s, pos + 1, ')'); pos = r.pos;
        const n = lireNombre();
        for (const [sym, k] of Object.entries(r.compte)) ajouter(sym, k * n);
      } else if (/[A-Z]/.test(c)) {
        let sym = c;
        if (/[a-z]/.test(s[pos + 1] || '')) { sym = c + s[pos + 1]; if (!parSymbole[sym]) throw new Error(`L'élément « ${sym} » n'existe pas`); }
        if (!parSymbole[sym]) throw new Error(`L'élément « ${sym} » n'existe pas`);
        pos += sym.length;
        ajouter(sym, lireNombre());
      } else if (/[a-z]/.test(c)) throw new Error(`Un symbole commence par une majuscule : « ${c.toUpperCase()} » ?`);
      else throw new Error(`Caractère inattendu « ${c} »`);
    }
    if (fermante) throw new Error('Il manque « ) »');
    return { compte, pos };
  }
  let masseMolaire = null;
  function calculer() {
    const zone = $('resultat');
    tableau.querySelectorAll('.dans-formule').forEach((b) => b.classList.remove('dans-formule'));
    try {
      const compte = lireFormule($('formule').value);
      const lignes = Object.entries(compte).map(([s, n]) => ({ s, n, m: parSymbole[s].masse }));
      masseMolaire = lignes.reduce((t, l) => t + l.n * l.m, 0);
      zone.innerHTML = `
        <p class="calcul">M = ${lignes.map((l) => `${l.n > 1 ? l.n + ' × ' : ''}M(${l.s})`).join(' + ')}</p>
        <p class="calcul">M = ${lignes.map((l) => `${l.n > 1 ? l.n + ' × ' : ''}${Outil.nombre(l.m, 1)}`).join(' + ')}</p>
        <div class="resultat-m">M = ${Outil.nombre(masseMolaire, 1)} g/mol</div>`;
      for (const l of lignes) tableau.querySelector(`[data-z="${parSymbole[l.s].z}"]`).classList.add('dans-formule');
    } catch (e) {
      masseMolaire = null;
      zone.innerHTML = `<p class="erreur">${e.message}</p>`;
    }
    calculerQuantite();
  }
  function calculerQuantite() {
    const m = parseFloat($('masse').value);
    if (!masseMolaire || !(m >= 0)) { $('n-mol').textContent = '—'; return; }
    $('n-mol').textContent = `n = ${Outil.nombre(m, 2)} / ${Outil.nombre(masseMolaire, 1)} ≈ ${Outil.nombre(m / masseMolaire, 3)} mol`;
  }
  $('formule').addEventListener('input', calculer);
  $('masse').addEventListener('input', calculerQuantite);
  $('exemples').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $('formule').value = b.textContent; calculer(); });

  afficherFiche(11);
  calculer();
})();
