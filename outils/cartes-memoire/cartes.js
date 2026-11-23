// Cartes mémoire (flashcards) : paquets enregistrés dans Mes documents au format « Nom.cartes.csv »
// (colonnes Recto;Verso — modifiable dans le tableur ou Excel), révision avec les boîtes de Leitner.
(function () {
  const $ = (id) => document.getElementById(id);
  const api = () => window.parent && window.parent.labo && window.parent.labo.documents;
  const EXT = '.cartes.csv';
  const JOUR = 24 * 3600 * 1000;
  const INTERVALLES = [0, 0, 1, 3, 7, 14]; // jours avant de revoir une carte, selon sa boîte (1 à 5)
  const COULEURS_BOITES = ['', '#e5484d', '#f59e0b', '#eab308', '#22c55e', '#15803d'];
  const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lireLocal = (cle, defaut) => { try { const v = localStorage.getItem(cle); return v === null ? defaut : JSON.parse(v); } catch { return defaut; } };
  const ecrireLocal = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* indisponible */ } };
  const nomSansExt = (f) => f.replace(/\.cartes\.csv$/i, '');
  const melanger = (t) => { const r = [...t]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

  // ---------- Format CSV (point-virgule, comme Excel en français) ----------
  function lireCsv(texte) {
    texte = texte.replace(/^﻿/, '');
    const premiere = texte.split(/\r?\n/)[0] || '';
    const sep = (premiere.match(/;/g) || []).length >= (premiere.match(/,/g) || []).length ? ';' : ',';
    const lignes = [];
    let ligne = [], champ = '', guillemets = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (guillemets) {
        if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') guillemets = false; else champ += c;
      } else if (c === '"') guillemets = true;
      else if (c === sep) { ligne.push(champ); champ = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texte[i + 1] === '\n') i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
      else champ += c;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    let debut = 0;
    if (lignes.length && /^(recto|question|terme|mot)$/i.test((lignes[0][0] || '').trim())) debut = 1; // ligne d'en-tête
    return lignes.slice(debut).map((l) => ({ recto: (l[0] || '').trim(), verso: (l[1] || '').trim() })).filter((c) => c.recto || c.verso);
  }
  const champCsv = (t) => (/[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const ecrireCsv = (cartes) => '﻿Recto;Verso\r\n' + cartes.map((c) => `${champCsv(c.recto)};${champCsv(c.verso)}`).join('\r\n') + '\r\n';

  // ---------- Affichage d'une face : texte + formules entre $…$ ----------
  function rendreTexte(t) {
    return String(t || '').split(/(\$[^$\n]+\$)/g).map((morceau) => {
      if (/^\$[^$\n]+\$$/.test(morceau) && window.Equations) {
        try { return window.Equations.rendre(morceau.slice(1, -1)); } catch { return echapper(morceau); }
      }
      return echapper(morceau);
    }).join('');
  }

  // ---------- Progression (boîtes de Leitner), gardée sur ce PC ----------
  const cleCarte = (c) => { let h = 2166136261; const s = c.recto + '\u0001' + c.verso; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const progression = (fichier) => lireLocal('cartes:' + fichier, {});
  const enregistrerProgression = (fichier, p) => ecrireLocal('cartes:' + fichier, p);
  const boiteDe = (p, c) => (p[cleCarte(c)] ? p[cleCarte(c)].b : 0); // 0 = jamais révisée
  const aReviser = (p, c) => { const e = p[cleCarte(c)]; return !e || e.p <= Date.now(); };

  // ---------- Mes paquets ----------
  let paquets = []; // { fichier, nom, cartes }
  async function chargerPaquets() {
    let liste = [];
    try { liste = (await api().lister()) || []; } catch { /* hors de Labo Élève */ }
    const noms = liste.map((d) => (typeof d === 'string' ? d : d.nom)).filter((n) => n.toLowerCase().endsWith(EXT));
    paquets = [];
    for (const fichier of noms) {
      try { paquets.push({ fichier, nom: nomSansExt(fichier), cartes: lireCsv(new TextDecoder().decode(await Doc.lire(fichier))) }); } catch { /* fichier illisible */ }
    }
    paquets.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
  async function afficherListe() {
    montrer('vue-liste');
    await chargerPaquets();
    const zone = $('paquets');
    if (!paquets.length) {
      zone.innerHTML = '<div class="vide"><b>Aucun paquet pour l\'instant</b>Clique sur « + Nouveau paquet » pour créer tes premières cartes.</div>';
      return;
    }
    zone.innerHTML = paquets.map((pq, i) => {
      const p = progression(pq.fichier);
      const dues = pq.cartes.filter((c) => aReviser(p, c)).length;
      const parBoite = [0, 0, 0, 0, 0, 0];
      pq.cartes.forEach((c) => parBoite[boiteDe(p, c)]++);
      const total = pq.cartes.length || 1;
      const jauge = [1, 2, 3, 4, 5].map((b) => `<span style="width:${(parBoite[b] / total) * 100}%;background:${COULEURS_BOITES[b]}"></span>`).join('');
      return `<article class="paquet">
        <h2>${echapper(pq.nom)}</h2>
        <div class="infos">${pq.cartes.length} carte${pq.cartes.length > 1 ? 's' : ''} · ${dues ? `<span class="a-reviser">${dues} à réviser</span>` : '✔ rien à réviser aujourd\'hui'} · ${parBoite[5]} maîtrisée${parBoite[5] > 1 ? 's' : ''}</div>
        <div class="jauge" title="Rouge : à apprendre · Vert : maîtrisées">${jauge}</div>
        <div class="actions">
          <button class="btn principal" data-reviser="${i}" ${pq.cartes.length ? '' : 'disabled'}>▶ Réviser</button>
          <button class="btn" data-modifier="${i}">Modifier</button>
          <button class="btn danger" data-supprimer="${i}" title="Mettre le paquet à la corbeille">Supprimer</button>
        </div></article>`;
    }).join('');
    zone.querySelectorAll('[data-reviser]').forEach((b) => b.addEventListener('click', () => commencerRevision(paquets[+b.dataset.reviser])));
    zone.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => ouvrirEdition(paquets[+b.dataset.modifier])));
    zone.querySelectorAll('[data-supprimer]').forEach((b) => b.addEventListener('click', async () => {
      const pq = paquets[+b.dataset.supprimer];
      if (!confirm(`Supprimer le paquet « ${pq.nom} » ? (Il va dans la corbeille de Windows.)`)) return;
      try { await api().supprimer(pq.fichier); } catch { /* ignoré */ }
      afficherListe();
    }));
  }
  function montrer(id) { document.querySelectorAll('.vue').forEach((v) => { v.hidden = v.id !== id; }); window.scrollTo(0, 0); }

  // ---------- Modifier un paquet ----------
  let edition = null; // { fichier|null, cartes: [...], modifie }
  const SYMBOLES = ['×', '÷', '²', '³', '√', 'π', '≈', '≠', '≤', '≥', '±', '°', '|', 'Ω', 'µ', 'Δ', 'α', 'λ', '|', '→', '⇒', '∞', '€'];
  $('palette').innerHTML = SYMBOLES.map((s) => (s === '|' ? '<span class="sep"></span>' : `<button type="button" data-symbole="${s}">${s}</button>`)).join('')
    + '<span class="sep"></span><button type="button" data-formule title="Formule : écris-la entre les deux $ (ex. $U=R*I$)">$ formule $</button>';
  let dernierChamp = null;
  document.addEventListener('focusin', (e) => { if (e.target.matches('.ligne-carte textarea')) dernierChamp = e.target; });
  $('palette').addEventListener('mousedown', (e) => e.preventDefault()); // garder le curseur dans la carte
  $('palette').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !dernierChamp) return;
    const avant = b.dataset.formule !== undefined ? '$' : b.dataset.symbole, apres = b.dataset.formule !== undefined ? '$' : '';
    const { selectionStart: d, selectionEnd: f, value: v } = dernierChamp;
    dernierChamp.value = v.slice(0, d) + avant + v.slice(d, f) + apres + v.slice(f);
    dernierChamp.selectionStart = dernierChamp.selectionEnd = d + avant.length + (f - d);
    dernierChamp.dispatchEvent(new Event('input', { bubbles: true }));
    dernierChamp.focus();
  });

  function ouvrirEdition(pq) {
    edition = { fichier: pq ? pq.fichier : null, cartes: pq ? pq.cartes.map((c) => ({ ...c })) : [{ recto: '', verso: '' }, { recto: '', verso: '' }, { recto: '', verso: '' }], modifie: false };
    $('nom-paquet').value = pq ? pq.nom : '';
    $('etat-edition').textContent = '';
    montrer('vue-edition');
    dessinerCartes();
    (pq ? document.querySelector('.ligne-carte textarea') : $('nom-paquet')).focus();
  }
  function apercu(t) { return /\$[^$\n]+\$/.test(t) ? rendreTexte(t) : ''; }
  function dessinerCartes() {
    $('liste-cartes').innerHTML = edition.cartes.map((c, i) => `<div class="ligne-carte" data-i="${i}">
      <span class="num">${i + 1}</span>
      <label>Recto (question)<textarea rows="2" data-cote="recto">${echapper(c.recto)}</textarea><span class="apercu">${apercu(c.recto)}</span></label>
      <label>Verso (réponse)<textarea rows="2" data-cote="verso">${echapper(c.verso)}</textarea><span class="apercu">${apercu(c.verso)}</span></label>
      <button class="suppr" title="Supprimer cette carte" data-suppr="${i}">🗑</button></div>`).join('');
  }
  $('liste-cartes').addEventListener('input', (e) => {
    const t = e.target.closest('textarea'); if (!t) return;
    const i = +t.closest('.ligne-carte').dataset.i;
    edition.cartes[i][t.dataset.cote] = t.value;
    t.nextElementSibling.innerHTML = apercu(t.value);
    marquerModifie();
  });
  $('liste-cartes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-suppr]'); if (!b) return;
    edition.cartes.splice(+b.dataset.suppr, 1);
    if (!edition.cartes.length) edition.cartes.push({ recto: '', verso: '' });
    marquerModifie(); dessinerCartes();
  });
  function ajouterCarte() {
    edition.cartes.push({ recto: '', verso: '' });
    marquerModifie(); dessinerCartes();
    const champs = document.querySelectorAll('.ligne-carte textarea[data-cote="recto"]');
    champs[champs.length - 1].focus();
    champs[champs.length - 1].scrollIntoView({ block: 'center' });
  }
  $('btn-ajouter').addEventListener('click', ajouterCarte);
  $('liste-cartes').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); ajouterCarte(); } });
  $('nom-paquet').addEventListener('input', marquerModifie);
  function marquerModifie() { if (edition) { edition.modifie = true; $('etat-edition').textContent = '· non enregistré'; } }

  async function enregistrer() {
    if (!edition) return false;
    if (!Doc.disponible()) { Doc.message('Ouvre cet outil depuis Labo Élève pour enregistrer.', 'erreur'); return false; }
    const nom = $('nom-paquet').value.trim().replace(/[<>:"/\\|?*]/g, '-');
    if (!nom) { Doc.message('Donne un nom à ton paquet (ex. Loi d\'Ohm).', 'erreur'); $('nom-paquet').focus(); return false; }
    const cartes = edition.cartes.map((c) => ({ recto: c.recto.trim(), verso: c.verso.trim() })).filter((c) => c.recto || c.verso);
    if (!cartes.length) { Doc.message('Écris au moins une carte.', 'erreur'); return false; }
    const fichier = nom + EXT;
    if (fichier !== edition.fichier && paquets.some((p) => p.fichier.toLowerCase() === fichier.toLowerCase()) && !confirm(`Un paquet « ${nom} » existe déjà. Le remplacer ?`)) return false;
    try {
      const reel = await Doc.enregistrer(fichier, new TextEncoder().encode(ecrireCsv(cartes)), true);
      if (edition.fichier && edition.fichier !== reel) { // renommé : la progression suit, l'ancien fichier part à la corbeille
        enregistrerProgression(reel, { ...progression(edition.fichier), ...progression(reel) });
        try { await api().supprimer(edition.fichier); } catch { /* ignoré */ }
      }
      edition.fichier = reel; edition.cartes = cartes; edition.modifie = false;
      $('etat-edition').textContent = '✓ enregistré';
      Doc.message(`Paquet enregistré dans Mes documents : ${reel}`);
      dessinerCartes();
      return true;
    } catch (e) { Doc.message(e.message, 'erreur'); return false; }
  }
  $('btn-enregistrer').addEventListener('click', enregistrer);
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('vue-edition').hidden) { e.preventDefault(); enregistrer(); } });
  const quitterEdition = () => !edition || !edition.modifie || confirm('Ton paquet n\'est pas enregistré. Quitter quand même ?');
  $('btn-retour-edition').addEventListener('click', () => { if (quitterEdition()) { edition = null; afficherListe(); } });
  $('btn-reviser-edition').addEventListener('click', async () => {
    if (edition.modifie && !(await enregistrer())) return;
    const pq = { fichier: edition.fichier, nom: nomSansExt(edition.fichier), cartes: edition.cartes };
    edition = null;
    commencerRevision(pq);
  });
  $('btn-nouveau').addEventListener('click', () => ouvrirEdition(null));
  window.laboAvantFermeture = () => quitterEdition();

  // ---------- Réviser ----------
  let session = null; // { paquet, file, index, reussies, ratees:Set, total, face }
  function commencerRevision(pq, seulement = null) {
    const p = progression(pq.fichier);
    let cartes = seulement || pq.cartes.filter((c) => aReviser(p, c));
    if (!cartes.length) cartes = pq.cartes; // tout est à jour : on révise quand même tout le paquet
    session = { paquet: pq, file: melanger(cartes), index: 0, reussies: 0, ratees: new Map(), dejaRatees: new Set(), vues: 0 };
    $('titre-revision').textContent = pq.nom;
    montrer('vue-revision');
    afficherCarte();
  }
  function afficherCarte() {
    const s = session;
    if (s.index >= s.file.length) return afficherBilan();
    const c = s.file[s.index];
    const sens = $('sens').value === 'melange' ? (Math.random() < 0.5 ? 'recto' : 'verso') : $('sens').value;
    s.face = sens;
    const question = sens === 'recto' ? c.recto : c.verso, reponse = sens === 'recto' ? c.verso : c.recto;
    $('etiquette-recto').textContent = sens === 'recto' ? 'Question' : 'Réponse → retrouve la question';
    $('etiquette-verso').textContent = sens === 'recto' ? 'Réponse' : 'Question';
    $('carte').classList.remove('retournee');
    // le contenu change pendant que la carte est de face
    $('face-recto').innerHTML = rendreTexte(question) || '<i>(vide)</i>';
    setTimeout(() => { $('face-verso').innerHTML = rendreTexte(reponse) || '<i>(vide)</i>'; }, 150);
    $('resultat').textContent = ''; $('resultat').className = 'resultat';
    $('boutons-note').hidden = true;
    const ecrire = $('mode').value === 'ecrire';
    $('form-reponse').hidden = !ecrire;
    $('reponse').value = '';
    $('compteur').textContent = `Carte ${Math.min(s.index + 1, s.file.length)} / ${s.file.length}`;
    $('barre').style.width = `${(s.index / s.file.length) * 100}%`;
    (ecrire ? $('reponse') : $('carte')).focus();
  }
  function retourner() {
    if (!session || $('carte').classList.contains('retournee')) return;
    $('carte').classList.add('retournee');
    $('boutons-note').hidden = false;
    $('btn-ok').focus();
  }
  $('carte').addEventListener('click', () => { if ($('mode').value === 'retourner') retourner(); });
  // Réponse écrite : comparée sans tenir compte des majuscules, accents, espaces et de la virgule / du point.
  const normaliser = (t) => String(t).replace(/\$/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/×/g, '*').replace(/,/g, '.').replace(/[\s'’"«».;:!?()]/g, '');
  $('form-reponse').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!session || $('carte').classList.contains('retournee')) return;
    const c = session.file[session.index];
    const attendu = session.face === 'recto' ? c.verso : c.recto;
    const juste = normaliser($('reponse').value) !== '' && normaliser($('reponse').value) === normaliser(attendu);
    retourner();
    $('resultat').className = 'resultat ' + (juste ? 'ok' : 'ko');
    if (juste) { $('resultat').textContent = '✔ Bonne réponse !'; setTimeout(() => noter(true), 900); $('boutons-note').hidden = true; }
    else $('resultat').innerHTML = '✘ Ce n\'est pas exactement la réponse attendue. Compare avec la carte : si tu avais juste, clique sur « Je savais ».';
  });
  function noter(reussi) {
    const s = session;
    if (!s || !$('carte').classList.contains('retournee')) return;
    const c = s.file[s.index];
    const p = progression(s.paquet.fichier), k = cleCarte(c);
    const e = p[k] || { b: 0 };
    if (reussi) {
      // une carte ratée pendant cette séance ne monte pas de boîte quand on la réussit ensuite
      // réussie du premier coup : au moins la boîte 2 (elle revient demain), puis 3, 4, 5
      e.b = s.dejaRatees.has(k) ? Math.max(1, e.b) : Math.min(5, Math.max(2, (e.b || 0) + 1));
      e.p = Date.now() + INTERVALLES[e.b] * JOUR;
      if (!s.dejaRatees.has(k)) s.reussies++;
    } else {
      e.b = 1; e.p = Date.now();
      s.ratees.set(k, c);
      if (!s.dejaRatees.has(k)) { s.dejaRatees.add(k); s.file.push(c); } // elle revient une fois en fin de séance
    }
    p[k] = e;
    enregistrerProgression(s.paquet.fichier, p);
    s.index++;
    afficherCarte();
  }
  $('btn-ok').addEventListener('click', () => noter(true));
  $('btn-ko').addEventListener('click', () => noter(false));
  document.addEventListener('keydown', (e) => {
    if ($('vue-revision').hidden || (e.target instanceof Element && e.target.matches('input, select, textarea'))) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!$('carte').classList.contains('retournee')) retourner(); else if (e.key === 'Enter') noter(true); }
    else if (e.key === '1' || e.key === 'ArrowLeft') noter(false);
    else if (e.key === '2' || e.key === 'ArrowRight') noter(true);
  });
  $('mode').addEventListener('change', () => { if (session) afficherCarte(); });
  $('sens').addEventListener('change', () => { if (session) afficherCarte(); });
  $('btn-retour-revision').addEventListener('click', () => { session = null; afficherListe(); });

  // ---------- Bilan ----------
  function afficherBilan() {
    const s = session;
    const nbCartes = new Set(s.file.map(cleCarte)).size;
    const pct = nbCartes ? Math.round((s.reussies / nbCartes) * 100) : 0;
    $('score').textContent = `${s.reussies} / ${nbCartes}`;
    $('phrase-bilan').textContent = pct === 100 ? '🎉 Parfait, tu connais toutes ces cartes du premier coup !' : pct >= 70 ? '👍 Bien joué ! Encore un petit effort sur les cartes ratées.' : '💪 Continue : les cartes ratées reviendront plus souvent jusqu\'à ce que tu les saches.';
    const p = progression(s.paquet.fichier);
    const parBoite = [0, 0, 0, 0, 0, 0];
    s.paquet.cartes.forEach((c) => parBoite[boiteDe(p, c)]++);
    $('boites').innerHTML = ['Jamais vues', 'Boîte 1', 'Boîte 2', 'Boîte 3', 'Boîte 4', 'Maîtrisées'].map((n, i) => `<div class="boite" style="border-color:${COULEURS_BOITES[i] || 'var(--bord)'}"><b>${parBoite[i]}</b>${n}</div>`).join('');
    const ratees = [...s.ratees.values()];
    $('a-revoir').innerHTML = ratees.length ? `<b>À revoir :</b><ul>${ratees.map((c) => `<li>${rendreTexte(c.recto)} → <b>${rendreTexte(c.verso)}</b></li>`).join('')}</ul>` : '';
    $('btn-erreurs').hidden = !ratees.length;
    $('barre').style.width = '100%';
    montrer('vue-bilan');
  }
  $('btn-erreurs').addEventListener('click', () => commencerRevision(session.paquet, [...session.ratees.values()]));
  $('btn-tout').addEventListener('click', () => commencerRevision(session.paquet, session.paquet.cartes));
  $('btn-retour-bilan').addEventListener('click', () => { session = null; afficherListe(); });

  // ---------- Démarrage : un paquet ouvert depuis Mes documents ou un thème de la classe ----------
  (async () => {
    const ouvrir = new URLSearchParams(location.search).get('ouvrir');
    await afficherListe();
    if (ouvrir) {
      const pq = paquets.find((p) => p.fichier === ouvrir);
      if (pq && pq.cartes.length) commencerRevision(pq);
    }
  })();
  window.laboCartes = { lireCsv, ecrireCsv, normaliser, ouvrirEdition, commencerRevision, enregistrer, paquets: () => paquets }; // pour les tests
})();
