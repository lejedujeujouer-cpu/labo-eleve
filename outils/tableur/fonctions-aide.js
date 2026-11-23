// Aide à la saisie des formules, comme dans les tableurs courants :
// - en tapant « =SOM… », une liste des fonctions s'affiche (↑ ↓ pour choisir, Tab ou Entrée pour insérer) ;
// - dans les parenthèses, une bulle rappelle la syntaxe : SOMME(nombre1; [nombre2]; …), l'argument en cours en gras ;
// - la fenêtre « Insérer une fonction » (bouton fx) décrit chaque fonction par catégorie.
(function () {
  const FONCTIONS = [
    { n: 'SOMME', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Additionne des nombres ou une plage de cellules.', ex: '=SOMME(B2:B10)' },
    { n: 'MOYENNE', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Calcule la moyenne des nombres.', ex: '=MOYENNE(B2:B10)' },
    { n: 'MIN', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Renvoie la plus petite valeur.', ex: '=MIN(B2:B10)' },
    { n: 'MAX', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Renvoie la plus grande valeur.', ex: '=MAX(B2:B10)' },
    { n: 'NB', cat: 'Statistiques', args: ['valeur1', '[valeur2]', '…'], d: 'Compte les cellules qui contiennent des nombres.', ex: '=NB(B2:B10)' },
    { n: 'NBVAL', cat: 'Statistiques', args: ['valeur1', '[valeur2]', '…'], d: 'Compte les cellules non vides.', ex: '=NBVAL(A2:A30)' },
    { n: 'MEDIANE', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Renvoie la valeur du milieu (médiane).', ex: '=MEDIANE(B2:B10)' },
    { n: 'ECARTYPE', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Écart-type d\'un échantillon (mesure de la dispersion).', ex: '=ECARTYPE(B2:B10)' },
    { n: 'ECARTYPEP', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Écart-type de toute la population.', ex: '=ECARTYPEP(B2:B10)' },
    { n: 'VAR', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Variance d\'un échantillon.', ex: '=VAR(B2:B10)' },
    { n: 'ALEA', cat: 'Probabilités', args: [], d: 'Nombre au hasard entre 0 et 1 (change à chaque modification, ou avec F9).', ex: '=SI(ALEA()<0,5;"Pile";"Face")' },
    { n: 'ALEA.ENTRE.BORNES', cat: 'Probabilités', args: ['min', 'max'], d: 'Nombre entier au hasard entre min et max (ex. un lancer de dé).', ex: '=ALEA.ENTRE.BORNES(1;6)' },
    { n: 'NB.SI', cat: 'Probabilités', args: ['plage', 'critère'], d: 'Compte les cellules qui vérifient le critère (effectif d\'une issue).', ex: '=NB.SI(B2:B101;6)  ou  =NB.SI(B2:B101;">=4")' },
    { n: 'SOMME.SI', cat: 'Probabilités', args: ['plage', 'critère', '[plage_somme]'], d: 'Additionne les valeurs des lignes qui vérifient le critère.', ex: '=SOMME.SI(A2:A20;"Fille";C2:C20)' },
    { n: 'MOYENNE.SI', cat: 'Probabilités', args: ['plage', 'critère', '[plage_moyenne]'], d: 'Moyenne des valeurs des lignes qui vérifient le critère.', ex: '=MOYENNE.SI(A2:A20;"Fille";C2:C20)' },
    { n: 'FACT', cat: 'Probabilités', args: ['n'], d: 'Factorielle : n! = 1 × 2 × … × n.', ex: '=FACT(5)' },
    { n: 'COMBIN', cat: 'Probabilités', args: ['n', 'k'], d: 'Nombre de façons de choisir k objets parmi n (sans ordre).', ex: '=COMBIN(5;2)' },
    { n: 'PERMUTATION', cat: 'Probabilités', args: ['n', 'k'], d: 'Nombre de façons de choisir k objets parmi n, dans l\'ordre.', ex: '=PERMUTATION(5;2)' },
    { n: 'LOI.BINOMIALE', cat: 'Probabilités', args: ['k', 'n', 'p', 'cumulative'], d: 'Probabilité d\'obtenir k succès sur n essais (p = probabilité d\'un succès). Cumulative VRAI : au plus k succès.', ex: '=LOI.BINOMIALE(3;10;0,5;FAUX)' },
    { n: 'QUARTILE', cat: 'Statistiques', args: ['plage', 'quart'], d: 'Quartile : 1 pour Q1, 2 pour la médiane, 3 pour Q3 (calcul d\'Excel).', ex: '=QUARTILE(B2:B30;1)' },
    { n: 'MODE', cat: 'Statistiques', args: ['nombre1', '[nombre2]', '…'], d: 'Valeur la plus fréquente.', ex: '=MODE(B2:B30)' },
    { n: 'ARRONDI', cat: 'Maths', args: ['nombre', 'nb_chiffres'], d: 'Arrondit un nombre au nombre de décimales indiqué.', ex: '=ARRONDI(B2;2)' },
    { n: 'ARRONDI.INF', cat: 'Maths', args: ['nombre', 'nb_chiffres'], d: 'Arrondit vers zéro (troncature).', ex: '=ARRONDI.INF(2,78;1)' },
    { n: 'ARRONDI.SUP', cat: 'Maths', args: ['nombre', 'nb_chiffres'], d: 'Arrondit en s\'éloignant de zéro.', ex: '=ARRONDI.SUP(2,71;1)' },
    { n: 'MOD', cat: 'Maths', args: ['nombre', 'diviseur'], d: 'Reste de la division (ex. pair ou impair : =MOD(A2;2)).', ex: '=MOD(17;5)' },
    { n: 'ENT', cat: 'Maths', args: ['nombre'], d: 'Partie entière (arrondi à l\'entier inférieur).', ex: '=ENT(7,8)' },
    { n: 'ABS', cat: 'Maths', args: ['nombre'], d: 'Valeur absolue (le nombre sans son signe).', ex: '=ABS(B2)' },
    { n: 'RACINE', cat: 'Maths', args: ['nombre'], d: 'Racine carrée.', ex: '=RACINE(16)' },
    { n: 'PUISSANCE', cat: 'Maths', args: ['nombre', 'puissance'], d: 'Élève un nombre à une puissance (comme ^).', ex: '=PUISSANCE(2;10)' },
    { n: 'EXP', cat: 'Maths', args: ['nombre'], d: 'Exponentielle : e à la puissance du nombre.', ex: '=EXP(1)' },
    { n: 'LN', cat: 'Maths', args: ['nombre'], d: 'Logarithme népérien.', ex: '=LN(B2)' },
    { n: 'LOG10', cat: 'Maths', args: ['nombre'], d: 'Logarithme décimal.', ex: '=LOG10(1000)' },
    { n: 'LOG', cat: 'Maths', args: ['nombre', '[base]'], d: 'Logarithme dans la base choisie (10 par défaut).', ex: '=LOG(8;2)' },
    { n: 'PI', cat: 'Maths', args: [], d: 'Renvoie la valeur de π (3,14159…).', ex: '=PI()' },
    { n: 'SIN', cat: 'Trigonométrie', args: ['angle_en_radians'], d: 'Sinus d\'un angle en radians (utilise RADIANS pour les degrés).', ex: '=SIN(RADIANS(30))' },
    { n: 'COS', cat: 'Trigonométrie', args: ['angle_en_radians'], d: 'Cosinus d\'un angle en radians.', ex: '=COS(RADIANS(60))' },
    { n: 'TAN', cat: 'Trigonométrie', args: ['angle_en_radians'], d: 'Tangente d\'un angle en radians.', ex: '=TAN(RADIANS(45))' },
    { n: 'ASIN', cat: 'Trigonométrie', args: ['nombre'], d: 'Angle (en radians) dont le sinus est le nombre.', ex: '=DEGRES(ASIN(0,5))' },
    { n: 'ACOS', cat: 'Trigonométrie', args: ['nombre'], d: 'Angle (en radians) dont le cosinus est le nombre.', ex: '=DEGRES(ACOS(0,5))' },
    { n: 'ATAN', cat: 'Trigonométrie', args: ['nombre'], d: 'Angle (en radians) dont la tangente est le nombre.', ex: '=DEGRES(ATAN(1))' },
    { n: 'DEGRES', cat: 'Trigonométrie', args: ['angle_en_radians'], d: 'Convertit des radians en degrés.', ex: '=DEGRES(PI())' },
    { n: 'RADIANS', cat: 'Trigonométrie', args: ['angle_en_degrés'], d: 'Convertit des degrés en radians.', ex: '=RADIANS(180)' },
    { n: 'SI', cat: 'Logique', args: ['test', 'valeur_si_vrai', '[valeur_si_faux]'], d: 'Renvoie une valeur si la condition est vraie, une autre sinon.', ex: '=SI(B2>=10;"Admis";"Non admis")' },
    { n: 'ET', cat: 'Logique', args: ['test1', '[test2]', '…'], d: 'VRAI si toutes les conditions sont vraies.', ex: '=ET(B2>0;B2<20)' },
    { n: 'OU', cat: 'Logique', args: ['test1', '[test2]', '…'], d: 'VRAI si au moins une condition est vraie.', ex: '=OU(B2<0;B2>20)' },
    { n: 'NON', cat: 'Logique', args: ['test'], d: 'Inverse VRAI et FAUX.', ex: '=NON(B2>10)' },
    { n: 'CONCATENER', cat: 'Texte', args: ['texte1', '[texte2]', '…'], d: 'Met plusieurs textes bout à bout.', ex: '=CONCATENER(A2;" ";B2)' },
  ];
  const parNom = new Map(FONCTIONS.map((f) => [f.n, f]));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const syntaxe = (f, actif = -1) => `${f.n}(${f.args.map((a, i) => (i === actif || (a === '…' && actif >= i) ? `<b>${esc(a)}</b>` : esc(a))).join('; ')})`;

  // ---------- Éléments affichés (liste et bulle) ----------
  const liste = document.createElement('div');
  liste.className = 'aide-liste';
  liste.hidden = true;
  const bulle = document.createElement('div');
  bulle.className = 'aide-bulle';
  bulle.hidden = true;
  document.addEventListener('DOMContentLoaded', () => document.body.append(liste, bulle));
  if (document.body) document.body.append(liste, bulle);

  let champActif = null, propositions = [], choisi = 0, jeton = null;

  function placer(el, champ) {
    const r = champ.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(r.left, innerWidth - 380)) + 'px';
    el.style.top = r.bottom + 3 + 'px';
  }
  function cacher() { liste.hidden = true; bulle.hidden = true; propositions = []; }

  // Fonction en cours (parenthèse ouverte avant le curseur) et numéro de l'argument
  function fonctionEnCours(avant) {
    let prof = 0, args = 0, dansTexte = false;
    for (let i = avant.length - 1; i >= 0; i--) {
      const c = avant[i];
      if (c === '"') { dansTexte = !dansTexte; continue; }
      if (dansTexte) continue;
      if (c === ')') prof++;
      else if (c === '(') {
        if (prof === 0) { const m = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.]*)$/.exec(avant.slice(0, i)); return m ? { nom: m[1].toUpperCase(), arg: args } : null; }
        prof--;
      } else if ((c === ';' || c === ',') && prof === 0) args++;
    }
    return null;
  }

  function analyser(champ) {
    champActif = champ;
    const v = champ.value, pos = champ.selectionStart;
    if (!v.startsWith('=') || pos !== champ.selectionEnd) return cacher();
    const avant = v.slice(0, pos);
    // 1. Liste des fonctions pendant la saisie d'un nom
    const m = /(^|[=(;,+\-*/^&<>\s])([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.]*)$/.exec(avant);
    if (m && !/^[A-Z]{1,3}\d/.test(m[2].toUpperCase())) {
      const debut = m[2].toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      propositions = FONCTIONS.filter((f) => f.n.startsWith(debut)).slice(0, 8);
      if (propositions.length && !(propositions.length === 1 && propositions[0].n === debut && v[pos] === '(')) {
        jeton = { debut: pos - m[2].length, fin: pos };
        choisi = Math.min(choisi, propositions.length - 1);
        liste.innerHTML = propositions.map((f, i) => `<div class="aide-item ${i === choisi ? 'choisi' : ''}" data-i="${i}"><b>${f.n}</b><span>${esc(f.d)}</span></div>`).join('');
        placer(liste, champ);
        liste.hidden = false;
        bulle.hidden = true;
        return;
      }
    }
    liste.hidden = true; propositions = [];
    // 2. Bulle de syntaxe dans les parenthèses
    const enCours = fonctionEnCours(avant);
    const f = enCours && parNom.get(enCours.nom);
    if (!f) { bulle.hidden = true; return; }
    bulle.innerHTML = `${syntaxe(f, enCours.arg)}<small>${esc(f.d)}</small>`;
    placer(bulle, champ);
    bulle.hidden = false;
  }

  function inserer(champ, f) {
    const v = champ.value;
    const apres = v.slice(jeton.fin);
    const ajout = f.n + (apres.startsWith('(') ? '' : '(');
    champ.value = v.slice(0, jeton.debut) + ajout + apres;
    const pos = jeton.debut + ajout.length + (f.args.length ? 0 : 1);
    if (!f.args.length && !apres.startsWith('(')) champ.value = champ.value.slice(0, pos - 1) + ')' + champ.value.slice(pos - 1);
    champ.setSelectionRange(pos, pos);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    choisi = 0;
    analyser(champ);
  }

  function installer(champ) {
    // Écouteur en phase de capture : passe avant la validation de la cellule (Entrée, Tab, Échap).
    champ.addEventListener('keydown', (e) => {
      if (liste.hidden || !propositions.length) { if (e.key === 'Escape' && !bulle.hidden) bulle.hidden = true; return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopImmediatePropagation();
        choisi = (choisi + (e.key === 'ArrowDown' ? 1 : -1) + propositions.length) % propositions.length;
        analyser(champ);
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault(); e.stopImmediatePropagation();
        inserer(champ, propositions[choisi]);
      } else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cacher(); }
    }, true);
    for (const type of ['input', 'click', 'keyup']) champ.addEventListener(type, (e) => { if (type === 'keyup' && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) return; analyser(champ); });
    champ.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== champ) cacher(); }, 150));
  }
  liste.addEventListener('mousedown', (e) => {
    const it = e.target.closest('.aide-item');
    if (!it || !champActif) return;
    e.preventDefault();
    inserer(champActif, propositions[+it.dataset.i]);
  });

  // ---------- Fenêtre « Insérer une fonction » ----------
  function ouvrirFenetre(rappel) {
    const fond = document.createElement('div');
    fond.className = 'fond-fenetre';
    const cats = ['Toutes', ...new Set(FONCTIONS.map((f) => f.cat))];
    fond.innerHTML = `<form class="fenetre fenetre-fonction">
      <h2>Insérer une fonction</h2>
      <div class="deux"><label class="champ"><span>Rechercher une fonction</span><input type="search" id="f-recherche" placeholder="ex. moyenne, arrondi, racine…"></label>
        <label class="champ"><span>Catégorie</span><select id="f-categorie">${cats.map((c) => `<option>${c}</option>`).join('')}</select></label></div>
      <div class="liste-fonctions" id="f-liste"></div>
      <div class="description-fonction" id="f-description"></div>
      <div class="boutons-fenetre"><button type="button" class="btn" data-annuler>Annuler</button><button type="submit" class="btn principal">OK</button></div>
    </form>`;
    document.body.append(fond);
    let selection = FONCTIONS[0];
    const normal = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const dessiner = () => {
      const q = normal(fond.querySelector('#f-recherche').value), cat = fond.querySelector('#f-categorie').value;
      const l = FONCTIONS.filter((f) => (cat === 'Toutes' || f.cat === cat) && (!q || normal(f.n + ' ' + f.d).includes(q)));
      if (!l.includes(selection)) selection = l[0] || null;
      fond.querySelector('#f-liste').innerHTML = l.map((f) => `<div class="ligne-fonction ${f === selection ? 'choisi' : ''}" data-n="${f.n}">${f.n}</div>`).join('') || '<p>Aucune fonction.</p>';
      fond.querySelector('#f-description').innerHTML = selection ? `<b>${syntaxe(selection)}</b><p>${esc(selection.d)}</p><p class="exemple">Exemple : <code>${esc(selection.ex)}</code></p>` : '';
    };
    const fermer = (f) => { fond.remove(); if (f) rappel(f); };
    fond.querySelector('#f-recherche').addEventListener('input', dessiner);
    fond.querySelector('#f-categorie').addEventListener('change', dessiner);
    fond.querySelector('#f-liste').addEventListener('click', (e) => { const l = e.target.closest('[data-n]'); if (l) { selection = parNom.get(l.dataset.n); dessiner(); } });
    fond.querySelector('#f-liste').addEventListener('dblclick', (e) => { const l = e.target.closest('[data-n]'); if (l) fermer(parNom.get(l.dataset.n)); });
    fond.querySelector('[data-annuler]').addEventListener('click', () => fermer(null));
    fond.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(null); });
    fond.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); fermer(selection); });
    dessiner();
    fond.querySelector('#f-recherche').focus();
  }

  window.AideFormules = { installer, ouvrirFenetre, cacher, fonctions: FONCTIONS };
})();
