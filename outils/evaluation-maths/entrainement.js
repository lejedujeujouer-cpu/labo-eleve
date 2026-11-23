// Entraînement de l'élève (hors évaluation) :
//   - séries de questions de la banque de l'enseignant (un chapitre › Cours, ou un automatisme), corrigées tout de suite
//     avec l'explication ; les nombres changent à chaque série ;
//   - modules d'exercices (fiche PDF + correction de l'enseignant), dans exercice.js.
// Seul ce que l'enseignant a ouvert pour la classe est proposé. Le résumé (séries faites, réussite) est envoyé à l'enseignant.
(function () {
  const api = window.parent && window.parent.labo && window.parent.labo.evaluations;
  const app = document.getElementById('app');
  const EQ = window.Equations, M = window.CalculatriceMoteur;
  const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tm = (t) => (EQ && EQ.texteAvecMaths ? EQ.texteAvecMaths(t) : echapper(t));
  const maths = (t) => { try { return EQ && String(t || '').trim() ? EQ.rendre(String(t)) : echapper(t); } catch { return echapper(t); } };
  const etapesHtml = (t) => (EQ && EQ.etapesHtml ? EQ.etapesHtml(t) : echapper(t));
  const LETTRES = 'ABCDEFGH';
  const pc = (j, t) => (t ? Math.round((100 * j) / t) : null);
  function ecran(ic, titre, texte) { app.innerHTML = `<div class="centre"><div class="ic">${ic}</div><h1>${echapper(titre)}</h1><p>${texte}</p></div>`; }
  const images = new Map();
  async function chargerImages(racine) {
    for (const img of racine.querySelectorAll('img[data-image]')) {
      const n = img.dataset.image;
      if (!images.has(n)) { const r = await api.entrImage(n); images.set(n, r.ok ? r.url : ''); }
      img.src = images.get(n);
    }
  }

  // ---------- Accueil : chapitres ouverts par le professeur ----------
  async function accueil() {
    if (!api || !api.entrContenu) return ecran('⚠️', 'Entraînement', 'Ouvre cet outil depuis Labo Élève.');
    const r = await api.entrContenu();
    if (!r.ok) return ecran('⚠️', 'Entraînement', echapper(r.message));
    if (!r.chapitres.length) return ecran('🏋️', 'Entraînement', 'Ton professeur n’a encore rien ouvert à l’entraînement pour ta classe.');
    const sv = r.suivi || { series: {}, modules: {} };
    const badge = (cle) => { const x = sv.series[cle]; if (!x || !x.questions) return ''; const p = pc(x.justes, x.questions); return `<span class="entr-badge ${p >= 70 ? 'ok' : p >= 40 ? 'moyen' : 'ko'}">${p} % · ${x.faites} série${x.faites > 1 ? 's' : ''}</span>`; };
    app.innerHTML = `<div class="principal-zone" style="height:100vh"><div class="entete"><h1>🏋️ S’entraîner</h1><span class="note">Ça ne compte pas dans tes notes : entraîne-toi autant que tu veux !</span></div>
      <div class="question">${r.chapitres.map((c) => {
        const mods = r.modules.filter((m) => m.chapitre === c.chapitre);
        return `<div class="entr-chap"><h2>📁 ${echapper(c.chapitre)}</h2><div class="entr-cartes">
          ${c.cours ? `<button class="entr-carte cours" data-serie="cours" data-chap="${echapper(c.chapitre)}"><b>📖 Cours</b><span>${c.cours} question${c.cours > 1 ? 's' : ''} de cours (QCM)</span>${badge(c.chapitre + ' › cours')}</button>` : ''}
          ${c.automatismes.map((a) => `<button class="entr-carte auto" data-serie="automatisme" data-chap="${echapper(c.chapitre)}" data-notion="${echapper(a.notion)}"><b>⚙️ ${echapper(a.notion)}</b><span>automatisme · ${a.n} question${a.n > 1 ? 's' : ''}</span>${badge(c.chapitre + ' › ' + a.notion)}</button>`).join('')}
          ${mods.map((m) => { const fait = (sv.modules || {})[m.id]; return `<button class="entr-carte module" data-module="${echapper(m.id)}"><b>🧩 ${echapper(m.titre)}</b><span>${m.notions.map(echapper).join(' · ') || 'exercices'} · ${m.questions} question${m.questions > 1 ? 's' : ''}</span>${fait ? `<span class="entr-badge ${fait.faux ? 'moyen' : 'ok'}">fait · ✔ ${fait.juste}/${fait.total}</span>` : ''}</button>`; }).join('')}
        </div></div>`; }).join('')}</div></div>`;
    app.querySelectorAll('[data-serie]').forEach((b) => b.addEventListener('click', () => serie({ chapitre: b.dataset.chap, partie: b.dataset.serie, notion: b.dataset.notion || '' })));
    app.querySelectorAll('[data-module]').forEach((b) => b.addEventListener('click', async () => {
      const ex = window.EvalExercice || await new Promise((ok) => window.addEventListener('exercice-pret', () => ok(window.EvalExercice), { once: true }));
      ex.module(b.dataset.module, accueil);
    }));
  }

  // ---------- Une série de questions, corrigées tout de suite ----------
  async function serie(choix, questionsImposees = null) {
    let questions = questionsImposees;
    if (!questions) {
      ecran('⏳', 'Entraînement', 'Préparation de ta série…');
      const r = await api.entrSerie({ ...choix, nombre: 10 });
      if (!r.ok) return ecran('⚠️', 'Entraînement', echapper(r.message));
      questions = r.questions;
    }
    const titre = choix.partie === 'cours' ? `📖 ${choix.chapitre} — Cours` : `⚙️ ${choix.notion}`;
    const cle = choix.partie === 'cours' ? `${choix.chapitre} › cours` : `${choix.chapitre} › ${choix.notion}`;
    const resultats = []; let n = 0;
    const afficher = () => {
      const x = questions[n];
      app.innerHTML = `<div class="ev"><div class="entete"><h1>${echapper(titre)}</h1><span class="note">Question ${n + 1} / ${questions.length} · ✔ ${resultats.filter(Boolean).length}</span><button class="btn" id="quitter">← Arrêter</button></div>
        <div class="zone-question"><div class="carte ${x.type}">
          <div class="enonce">${tm(x.enonce)}</div>
          ${x.image ? `<img class="illus" data-image="${echapper(x.image)}" alt="Illustration">` : ''}
          ${x.type === 'qcm'
            ? `<div class="tuiles">${x.choix.map((c, i) => { const im = x.choixImages && x.choixImages[i]; const t = im && /^image [A-H]$/.test(c) ? '' : c;
              return `<button class="tuile ${im ? 'avec-image' : ''}" data-choix="${i}"><span class="lettre">${LETTRES[i]}</span>${im ? `<img class="tuile-img" data-image="${echapper(im)}" alt="">` : ''}${t ? `<span>${tm(t)}</span>` : ''}</button>`; }).join('')}</div>
               <p class="aide">${x.multiple ? 'Plusieurs réponses sont justes : clique sur toutes les bonnes.' : 'Une seule réponse est juste.'}</p>`
            : `<div class="reponse-calc"><input id="rep" class="champ-maths" type="text" autocomplete="off" spellcheck="false" placeholder="ex. 12,5 ou 3/4">${x.unite ? `<b>${echapper(x.unite)}</b>` : ''}</div><div class="apercu-maths" id="rep-apercu"></div>
               <details class="ex-calc"><summary>🧮 Calculatrice</summary><div class="calc" style="max-width:420px"><div class="ecran"><input id="saisie" type="text" autocomplete="off" spellcheck="false" placeholder="Tape un calcul, puis Entrée"><div id="resultat"></div></div><div class="touches" id="touches">${M ? M.TOUCHES : ''}</div></div></details>`}
          <div class="zone-valider"><span class="aide" id="aide-v">Réponds, puis vérifie.</span><button class="btn principal grand" id="verifier" disabled>✔ Vérifier</button></div>
          <div id="retour"></div>
        </div></div></div>`;
      chargerImages(app);
      let rep = x.type === 'qcm' && x.multiple ? [] : '';
      const pret = () => { document.getElementById('verifier').disabled = Array.isArray(rep) ? !rep.length : String(rep).trim() === ''; };
      app.querySelectorAll('[data-choix]').forEach((b) => b.addEventListener('click', () => {
        if (b.disabled) return;
        const i = +b.dataset.choix;
        if (x.multiple) rep = rep.includes(i) ? rep.filter((k) => k !== i) : [...rep, i].sort(); else rep = i;
        app.querySelectorAll('[data-choix]').forEach((t) => t.classList.toggle('choisie', x.multiple ? rep.includes(+t.dataset.choix) : +t.dataset.choix === rep));
        pret();
      }));
      const champ = document.getElementById('rep');
      if (champ) {
        champ.addEventListener('input', () => { rep = champ.value.trim(); document.getElementById('rep-apercu').innerHTML = /[\/^√]/.test(champ.value) ? maths(champ.value) : ''; pret(); });
        champ.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !document.getElementById('verifier').disabled) document.getElementById('verifier').click(); });
        champ.focus();
        const calc = document.getElementById('saisie'), res = document.getElementById('resultat');
        const calculer = () => { try { res.textContent = '= ' + M.formater(M.evaluer(calc.value, { degres: true })); res.className = ''; } catch (e) { res.textContent = e.message; res.className = 'erreur'; } };
        calc.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calculer(); } });
        document.getElementById('touches').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
        document.getElementById('touches').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.i) calc.value += b.dataset.i; else if (b.dataset.a === 'egal') calculer(); else if (b.dataset.a === 'tout') { calc.value = ''; res.textContent = ''; } else if (b.dataset.a === 'retour') calc.value = calc.value.slice(0, -1); calc.focus(); });
      }
      document.getElementById('quitter').addEventListener('click', () => (resultats.length ? fin() : accueil()));
      document.getElementById('verifier').addEventListener('click', async () => {
        const v = await api.entrVerifier(x, rep);
        if (!v.ok) return;
        resultats[n] = v.juste;
        app.querySelectorAll('[data-choix]').forEach((t) => { const i = +t.dataset.choix; t.disabled = true; if (x.justes && x.justes.includes(i)) t.classList.add('bonne-rep'); else if (t.classList.contains('choisie')) t.classList.add('mauvaise-rep'); });
        if (champ) champ.disabled = true;
        document.querySelector('.zone-valider').style.display = 'none';
        const der = n === questions.length - 1;
        document.getElementById('retour').innerHTML = `<div class="entr-retour ${v.juste ? 'juste' : 'faux'}">
          <div class="entr-verdict">${v.juste ? '✔ Bravo, c’est juste !' : '✘ Ce n’est pas ça.'}</div>
          ${v.juste ? '' : `<div>Bonne réponse : <b class="bonne">${tm(v.attendu)}</b></div>`}
          ${x.explication ? `<details ${v.juste ? '' : 'open'}><summary>💡 Explication</summary><div class="explication">${etapesHtml(x.explication)}</div></details>` : ''}
          <div class="rangee-conf" style="margin-top:12px"><span></span><button class="btn principal grand" id="suivante">${der ? 'Voir mon résultat' : 'Question suivante →'}</button></div></div>`;
        document.getElementById('suivante').addEventListener('click', () => { if (der) fin(); else { n++; afficher(); } });
        document.getElementById('suivante').focus();
      });
    };
    const fin = async () => {
      const faites = resultats.filter((x) => x !== undefined), justes = faites.filter(Boolean).length;
      if (faites.length) await api.entrProgres({ serie: { cle, questions: faites.length, justes } });
      const ratees = questions.filter((_q, i) => resultats[i] === false);
      const p = pc(justes, faites.length);
      app.innerHTML = `<div class="centre"><div class="ic">${p >= 80 ? '🏆' : p >= 50 ? '👍' : '💪'}</div><h1>${justes} / ${faites.length}</h1>
        <p>${p >= 80 ? 'Excellent ! Tu es prêt(e).' : p >= 50 ? 'C’est bien parti : refais une série pour progresser.' : 'Continue à t’entraîner : relis les explications, puis recommence.'}</p>
        <div class="rangee-conf" style="justify-content:center;gap:10px">
          ${ratees.length ? '<button class="btn" id="ratees">🔁 Refaire les questions ratées</button>' : ''}
          <button class="btn principal grand" id="nouvelle">🎲 Nouvelle série</button><button class="btn" id="accueil">← Retour</button></div></div>`;
      document.getElementById('nouvelle').addEventListener('click', () => serie(choix));
      document.getElementById('accueil').addEventListener('click', accueil);
      document.getElementById('ratees')?.addEventListener('click', () => serie(choix, ratees));
    };
    afficher();
  }

  window.Entrainement = { accueil, serie };
})();
