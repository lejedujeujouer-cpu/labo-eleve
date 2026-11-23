// Calculatrice scientifique : évaluation d'expressions écrites « comme au tableau ».
// Virgule décimale, × ÷ −, puissance ^ et ², racine √, %, π, e, Rép (résultat précédent),
// trigonométrie en degrés ou en radians, multiplication implicite (2π, 3(4+1)).
(function () {
  const $ = (id) => document.getElementById(id);
  let degres = true;
  let rep = 0;
  const historique = [];

  // ---------- Évaluation : moteur commun (commun/calculatrice-moteur.js, aussi utilisé par les évaluations) ----------
  const M = window.CalculatriceMoteur;
  const evaluer = (t) => M.evaluer(t, { degres, rep });
  const formater = M.formater;

  // ---------- Interface ----------
  const saisie = $('saisie');
  const resultat = $('resultat');

  function apercu() {
    const t = saisie.value.trim();
    resultat.className = '';
    if (!t) { resultat.textContent = ''; return; }
    try { resultat.textContent = '= ' + formater(evaluer(t)); resultat.style.opacity = '.55'; } catch { resultat.textContent = ''; }
  }
  function calculer() {
    const t = saisie.value.trim();
    if (!t) return;
    try {
      const v = evaluer(t);
      rep = v;
      resultat.style.opacity = '1';
      resultat.className = '';
      resultat.textContent = '= ' + formater(v);
      historique.unshift({ calcul: t, valeur: v, mode: degres ? '°' : 'rad' });
      afficherHistorique();
      saisie.value = '';
    } catch (e) {
      resultat.style.opacity = '1';
      resultat.className = 'erreur';
      resultat.textContent = e.message;
    }
  }
  function inserer(texte) {
    const d = saisie.selectionStart ?? saisie.value.length, f = saisie.selectionEnd ?? saisie.value.length;
    // Après un calcul, une opération repart du résultat précédent (comme une vraie calculatrice).
    if (!saisie.value && historique.length && /^[+×÷−^²%]/.test(texte)) texte = 'Rép' + texte;
    saisie.value = saisie.value.slice(0, d) + texte + saisie.value.slice(f);
    const pos = d + texte.length;
    saisie.focus();
    saisie.setSelectionRange(pos, pos);
    apercu();
  }
  function afficherHistorique() {
    $('vide-historique').hidden = historique.length > 0;
    $('liste-historique').innerHTML = historique.slice(0, 50).map((h, i) => `<li data-i="${i}"><div class="calcul">${h.calcul.replace(/</g, '&lt;')}${/sin|cos|tan/.test(h.calcul) ? ` <small>(${h.mode})</small>` : ''}</div><div class="val">= ${formater(h.valeur)}</div></li>`).join('');
  }

  $('touches').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  $('touches').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.i) return inserer(b.dataset.i);
    if (b.dataset.a === 'egal') calculer();
    else if (b.dataset.a === 'tout') { saisie.value = ''; resultat.textContent = ''; saisie.focus(); }
    else if (b.dataset.a === 'retour') { saisie.value = saisie.value.slice(0, -1); apercu(); saisie.focus(); }
  });
  saisie.addEventListener('input', apercu);
  saisie.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calculer(); }
    else if (e.key === 'Escape') { saisie.value = ''; resultat.textContent = ''; }
  });
  $('liste-historique').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li) { saisie.value = historique[+li.dataset.i].calcul; apercu(); saisie.focus(); }
  });
  const changerMode = (deg) => { degres = deg; $('mode-deg').classList.toggle('actif', deg); $('mode-rad').classList.toggle('actif', !deg); apercu(); saisie.focus(); };
  $('mode-deg').addEventListener('click', () => changerMode(true));
  $('mode-rad').addEventListener('click', () => changerMode(false));

  window.laboCalculer = (t) => { saisie.value = t; calculer(); return resultat.textContent; }; // utilisé par les tests
  afficherHistorique();
  saisie.focus();
})();
