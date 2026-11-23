// Labo Prof › classe › onglet « 📝 Évaluations » : banque de questions par notion, évaluations, lancement adapté,
// suivi en direct et copies corrigées. Les réponses attendues restent sur le PC de l'enseignant (voir evaluations.js).
(function () {
  const E = api.evaluations;
  if (!E || !window.profOutils) return;
  const { saisir, verifier } = window.profOutils;
  const e$ = (t) => echapper(t);
  const tm = (t) => (window.Equations && window.Equations.texteAvecMaths ? window.Equations.texteAvecMaths(t) : e$(t));
  const maths = (t) => { try { return window.Equations && String(t || '').trim() ? window.Equations.rendre(String(t)) : e$(t); } catch { return e$(t); } };
  let suiviMinuterie = null;

  // ---------- Petite fabrique de fenêtres ----------
  function fenetre(titre, contenuHtml, { large = false } = {}) {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialogue' + (large ? ' dlg-eval-large' : '');
    dlg.innerHTML = `<div class="dialogue-contenu dlg-eval"><header><h2>${e$(titre)}</h2><button class="icone-btn" data-fermer aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><div class="dlg-eval-corps">${contenuHtml}</div></div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.querySelector('[data-fermer]').addEventListener('click', () => dlg.close());
    dlg.showModal();
    return dlg;
  }
  const notionsDe = (qs) => [...new Set(qs.map((q) => q.notion))].sort((a, b) => a.localeCompare(b, 'fr'));

  // ---------- Banque de questions : un dossier par chapitre (Cours + Automatismes) ----------
  const CLE = (q) => `${q.chapitre} › ${q.notion}`;
  const parNom = (a, b) => a.localeCompare(b, 'fr', { numeric: true });
  const images = new Map(); // nom → adresse (data:) déjà chargée
  async function urlImage(nom) {
    if (!nom) return '';
    if (!images.has(nom)) { const r = await E.imageLocale(nom); images.set(nom, r.ok ? r.url : ''); }
    return images.get(nom);
  }
  async function remplirImages(zone) {
    for (const img of zone.querySelectorAll('img[data-image]')) img.src = await urlImage(img.dataset.image);
  }
  async function ouvrirBanque(apresFermeture) {
    const dlg = fenetre('📚 Banque de questions', '<div id="banque-zone"></div>', { large: true });
    dlg.addEventListener('close', () => apresFermeture && apresFermeture());
    const zone = dlg.querySelector('#banque-zone');
    let qs = [], chapitres = [], courant = null;
    async function charger() {
      const r = await E.banque();
      if (!verifier(r)) return false;
      qs = r.questions; chapitres = r.chapitres;
      if (!chapitres.includes(courant)) courant = chapitres[0] || null;
      return true;
    }
    async function liste() {
      if (!(await charger())) return;
      const deChap = qs.filter((q) => q.chapitre === courant);
      const cours = deChap.filter((q) => q.partie === 'cours');
      const autos = [...new Set(deChap.filter((q) => q.partie === 'automatisme').map((q) => q.notion))].sort(parNom);
      const ligneQ = (q) => `<div class="eval-q">${q.image ? `<img class="eval-mini" data-image="${e$(q.image)}" alt="">` : ''}<span class="eval-badge ${q.type}">${q.type === 'qcm' ? 'QCM' : 'Nombre'}</span><span class="eval-q-texte">${tm(q.enonce)}</span>${q.niveau ? `<span class="eval-badge niveau">${e$(q.niveau)}</span>` : ''}
        <button class="lien" data-modifier="${e$(q.id)}">Modifier</button><button class="lien danger" data-supprimer="${e$(q.id)}">Supprimer</button></div>`;
      zone.innerHTML = `<div class="rangee eval-excel">
          <button class="principal" data-importer title="Classeur Excel, dossier compressé .zip (classeur ou questions.json + images), ou fichier .json">📥 Importer (Excel, .zip avec images)</button>
          <button class="secondaire" data-modele>📄 Modèle Excel</button>
          <button class="secondaire" data-exporter ${qs.length ? '' : 'disabled'}>📤 Exporter ma banque</button>
          <span class="espace"></span><button class="lien" data-exemples>✨ Ajouter des exemples</button>
        </div>
        <div class="banque">
          <aside class="banque-chapitres">
            <b>📁 Chapitres</b>
            ${chapitres.map((c) => `<button class="${c === courant ? 'actif' : ''}" data-chapitre="${e$(c)}"><span>📁 ${e$(c)}</span><small>${qs.filter((q) => q.chapitre === c).length}</small></button>`).join('') || '<p class="note-prof">Aucun chapitre.</p>'}
            <button class="secondaire" data-nouveau-chapitre>＋ Nouveau chapitre</button>
          </aside>
          <section class="banque-contenu">
            ${courant ? `<div class="banque-tete"><h3>📁 ${e$(courant)}</h3><span class="espace"></span><button class="lien" data-renommer>Renommer</button><button class="lien danger" data-suppr-chapitre>Supprimer</button></div>
              <div class="banque-partie"><div class="banque-partie-tete"><h4>📖 Cours <span class="note-prof" style="display:inline">· ${cours.length} question(s)</span></h4><span class="espace"></span><button class="principal petit" data-ajout="cours">➕ Question de cours</button></div>
                ${cours.map(ligneQ).join('') || '<p class="note-prof">Pas encore de question de cours.</p>'}</div>
              <div class="banque-partie"><div class="banque-partie-tete"><h4>🔢 Automatismes <span class="note-prof" style="display:inline">· ${autos.length}</span></h4><span class="espace"></span><button class="principal petit" data-nouvel-auto>➕ Nouvel automatisme</button></div>
                ${autos.map((a) => { const l = deChap.filter((q) => q.partie === 'automatisme' && q.notion === a); return `<div class="banque-auto"><div class="banque-auto-tete"><b>⚙️ ${e$(a)}</b> <span class="note-prof" style="display:inline">· ${l.length} question(s)</span><span class="espace"></span><button class="secondaire petit" data-ajout="automatisme" data-auto="${e$(a)}">➕ Question</button></div>${l.map(ligneQ).join('')}</div>`; }).join('')
                  || '<p class="note-prof">Pas encore d\'automatisme. Un automatisme (ex. « Coefficient multiplicateur ») regroupe ses propres questions.</p>'}</div>`
              : '<p class="prof-vide">Crée un premier chapitre (« ＋ Nouveau chapitre »), importe un fichier, ou ajoute des exemples.</p>'}
          </section>
        </div>`;
      remplirImages(zone);
      zone.querySelectorAll('[data-chapitre]').forEach((b) => b.addEventListener('click', () => { courant = b.dataset.chapitre; liste(); }));
      zone.querySelector('[data-nouveau-chapitre]').addEventListener('click', async () => {
        const v = await saisir('Nouveau chapitre', [{ label: 'Nom du chapitre', placeholder: 'ex. Chapitre 1 : Statistique' }], 'Créer');
        if (v && verifier(await E.chapitre('ajouter', v[0]))) { courant = v[0].trim(); liste(); }
      });
      zone.querySelector('[data-renommer]')?.addEventListener('click', async () => {
        const v = await saisir('Renommer le chapitre', [{ label: 'Nouveau nom', valeur: courant }], 'Renommer');
        if (v && verifier(await E.chapitre('renommer', courant, v[0]))) { courant = v[0].trim(); liste(); }
      });
      zone.querySelector('[data-suppr-chapitre]')?.addEventListener('click', async () => {
        const n = qs.filter((q) => q.chapitre === courant).length;
        if (confirm(`Supprimer le chapitre « ${courant} »${n ? ` et ses ${n} question(s)` : ''} ?`) && verifier(await E.chapitre('supprimer', courant))) { courant = null; liste(); }
      });
      zone.querySelectorAll('[data-ajout]').forEach((b) => b.addEventListener('click', () => editer({ chapitre: courant, partie: b.dataset.ajout, notion: b.dataset.auto || '', type: b.dataset.ajout === 'cours' ? 'qcm' : 'calcul' })));
      zone.querySelector('[data-nouvel-auto]')?.addEventListener('click', async () => {
        const v = await saisir('Nouvel automatisme', [{ label: 'Nom de l\'automatisme', placeholder: 'ex. Coefficient multiplicateur' }], 'Continuer');
        if (v && v[0].trim()) editer({ chapitre: courant, partie: 'automatisme', notion: v[0].trim(), type: 'calcul' });
      });
      zone.querySelector('[data-exemples]').addEventListener('click', async () => { if (verifier(await E.exemples())) { toast('Exemples ajoutés', '2 chapitres, avec des automatismes.', 'info'); liste(); } });
      zone.querySelector('[data-importer]').addEventListener('click', async () => {
        const r = await E.importerExcel();
        if (r.annule || !verifier(r)) return;
        let msg = `${r.ajoutees} question(s) ajoutée(s)${r.majs ? `, ${r.majs} mise(s) à jour` : ''}${r.avecImages ? `, dont ${r.avecImages} avec image` : ''}${r.notions.length ? ' — ' + r.notions.join(', ') : ''}.`;
        if (r.imagesManquantes.length) msg += `\n\nImages introuvables (mets-les dans le .zip) : ${r.imagesManquantes.join(', ')}`;
        if (r.nbIgnorees) msg += `\n\n${r.nbIgnorees} ligne(s) ignorée(s) :\n${r.ignorees.map((x) => '• ' + x.ligne + ' : ' + x.raison).join('\n')}`;
        if (r.nbIgnorees || r.imagesManquantes.length) alert(msg); else toast('Import terminé', msg, 'info');
        if (r.notions.length) courant = r.notions[0];
        liste();
      });
      zone.querySelector('[data-modele]').addEventListener('click', async () => { const r = await E.exporterExcel(true); if (!r.annule && verifier(r)) toast('Modèle enregistré', r.fichier, 'info'); });
      zone.querySelector('[data-exporter]').addEventListener('click', async () => { const r = await E.exporterExcel(false); if (!r.annule && verifier(r)) toast('Banque exportée', `${r.nombre} question(s) dans ${r.fichier}`, 'info'); });
      zone.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => editer(qs.find((q) => q.id === b.dataset.modifier))));
      zone.querySelectorAll('[data-supprimer]').forEach((b) => b.addEventListener('click', async () => {
        const q = qs.find((x) => x.id === b.dataset.supprimer);
        if (q && confirm(`Supprimer cette question ?\n\n${q.enonce}`) && verifier(await E.supprimerQuestion(q.id))) liste();
      }));
    }

    // Formulaire d'une question (cours ou automatisme ; QCM ou nombre ; image facultative)
    function editer(q) {
      const auto = q.partie === 'automatisme';
      const choix = q.choix && q.choix.length ? q.choix : [{ texte: '', juste: true }, { texte: '', juste: false }, { texte: '', juste: false }, { texte: '', juste: false }];
      const vars = q.variables || [];
      let image = q.image || null;
      const autosDuChap = [...new Set(qs.filter((x) => x.chapitre === q.chapitre && x.partie === 'automatisme').map((x) => x.notion))];
      zone.innerHTML = `<form class="eval-form" id="form-q">
        <h3>${q.id ? 'Modifier la question' : 'Nouvelle question'} · ${auto ? '🔢 Automatisme' : '📖 Cours'}</h3>
        <div class="eval-ligne2">
          <label>Chapitre <input name="chapitre" list="liste-chap" value="${e$(q.chapitre || '')}" required><datalist id="liste-chap">${chapitres.map((c) => `<option value="${e$(c)}">`).join('')}</datalist></label>
          <label>${auto ? 'Automatisme' : 'Notion (facultatif)'} <input name="notion" list="liste-autos" value="${e$(q.notion && q.notion !== q.chapitre ? q.notion : '')}" ${auto ? 'required placeholder="ex. Coefficient multiplicateur"' : 'placeholder="ex. Moyenne"'}><datalist id="liste-autos">${autosDuChap.map((n) => `<option value="${e$(n)}">`).join('')}</datalist></label>
        </div>
        <div class="eval-format"><b>Réponse :</b>
          <label class="case"><input type="radio" name="format" value="qcm" ${q.type === 'qcm' ? 'checked' : ''}> réponses proposées (QCM)</label>
          <label class="case"><input type="radio" name="format" value="calcul" ${q.type !== 'qcm' ? 'checked' : ''}> un nombre</label></div>
        <label>Question <textarea name="enonce" rows="3" required placeholder="${auto ? 'ex. Une hausse de 25 % correspond à un coefficient multiplicateur de…' : 'ex. La médiane d\'une série…'}">${e$(q.enonce || '')}</textarea></label>
        <div class="eval-image" id="zone-image"></div>
        <div id="bloc-qcm"><b>Réponses proposées</b> <span class="note-prof" style="display:inline">(coche la ou les bonnes ; elles sont mélangées pour chaque élève)</span>
          <div id="choix">${choix.map((c) => ligneChoix(c)).join('')}</div><button type="button" class="lien" id="ajout-choix">+ une réponse</button></div>
        <div id="bloc-nombre">
          <div class="eval-ligne3">
            <label>Réponse attendue <input name="reponse" value="${e$(q.reponse || '')}" placeholder="ex. 1,25"></label>
            <label>Unité <input name="unite" value="${e$(q.unite || '')}" placeholder="ex. €"></label>
            <label>Tolérance (±) <input name="tolerance" value="${e$(q.tolerance ?? 0)}" inputmode="decimal"></label>
          </div>
          <details ${vars.length ? 'open' : ''}><summary>🎲 Nombres tirés au hasard (facultatif) : chaque élève a ses propres nombres</summary>
            <p class="note-prof">Dans la question, <b>{a}</b> est remplacé par la valeur de a ; <b>{= a*2}</b> affiche un calcul. La réponse attendue devient alors une formule (ex. <b>1+a/100</b>).</p>
            <div id="vars">${vars.map((v) => ligneVar(v)).join('')}</div><button type="button" class="lien" id="ajout-var">+ un nombre au hasard</button>
          </details>
        </div>
        <label>💡 Explication (facultatif, montrée à l'élève quand il se trompe — une étape par ligne) <textarea name="explication" rows="4" placeholder="ex. On enlève 16 des deux côtés : 2x = 18, puis on divise par 2 : x = 9.">${e$(q.explication || '')}</textarea></label>
        <div class="eval-ligne3 eval-etiquettes"><label>🎯 Compétence <select name="competence"><option value="">—</option></select></label>
          <label>🏁 Objectif <select name="objectif"><option value="">—</option></select></label>
          <label>Points <input name="points" type="number" min="0.25" max="50" step="0.25" value="${e$(q.points || '')}" placeholder="1"></label></div>
        <div class="eval-apercu" id="apercu"></div>
        <p class="erreur" id="erreur-q"></p>
        <div class="rangee"><button type="button" class="secondaire" id="retour-banque">← Retour à la banque</button><span class="espace"></span>
          <button type="button" class="secondaire" id="btn-apercu">👁 Aperçu</button><button class="principal">Enregistrer</button></div>
      </form>`;
      const f = zone.querySelector('#form-q');
      const format = () => f.querySelector('[name=format]:checked').value;
      const majFormat = () => { f.querySelector('#bloc-qcm').hidden = format() !== 'qcm'; f.querySelector('#bloc-nombre').hidden = format() === 'qcm'; };
      f.querySelectorAll('[name=format]').forEach((x) => x.addEventListener('change', majFormat));
      majFormat();
      const afficherImage = async () => {
        const z = f.querySelector('#zone-image');
        z.innerHTML = image ? `<img src="${await urlImage(image)}" alt="Image de la question"><button type="button" class="lien danger" id="retirer-image">Retirer l'image</button>`
          : '<button type="button" class="secondaire" id="ajout-image">🖼 Ajouter une image (graphique, figure, tableau…)</button>';
        z.querySelector('#ajout-image')?.addEventListener('click', async () => { const r = await E.choisirImage(); if (!r.annule && verifier(r)) { image = r.image; afficherImage(); } });
        z.querySelector('#retirer-image')?.addEventListener('click', () => { image = null; afficherImage(); });
      };
      afficherImage();
      // compétences et objectifs du référentiel (onglet Notes › 📚 Référentiel)
      E.referentiel && E.referentiel().then((rr) => { if (!rr.ok) return;
        f.competence.insertAdjacentHTML('beforeend', rr.referentiel.competences.map((c) => `<option value="${e$(c.id)}" ${q.competence === c.id ? 'selected' : ''}>${e$(c.nom)}</option>`).join(''));
        f.objectif.insertAdjacentHTML('beforeend', rr.referentiel.objectifs.map((o) => `<option value="${e$(o.id)}" ${q.objectif === o.id ? 'selected' : ''}>${e$((o.sequence ? o.sequence + ' · ' : '') + o.nom)}</option>`).join('')); });
      const lire = () => {
        const d = { id: q.id, partie: q.partie, type: format(), chapitre: f.chapitre.value, notion: f.notion.value || f.chapitre.value, enonce: f.enonce.value, image, niveau: q.niveau, explication: f.explication.value, competence: f.competence.value || q.competence || '', objectif: f.objectif.value || q.objectif || '', points: f.points.value };
        if (d.type === 'qcm') d.choix = [...f.querySelectorAll('.ligne-choix')].map((l) => ({ texte: l.querySelector('[name=ct]').value, juste: l.querySelector('[name=cj]').checked, image: l.dataset.image || null }));
        else Object.assign(d, { reponse: f.reponse.value.replace(/(\d),(\d)/g, '$1.$2'), tolerance: f.tolerance.value, unite: f.unite.value, variables: [...f.querySelectorAll('.ligne-var')].map((l) => ({ nom: l.querySelector('[name=vn]').value, min: l.querySelector('[name=vmin]').value.replace(',', '.'), max: l.querySelector('[name=vmax]').value.replace(',', '.'), pas: l.querySelector('[name=vpas]').value.replace(',', '.') })) });
        return d;
      };
      const brancherSuppr = () => {
        f.querySelectorAll('[data-retirer]').forEach((b) => { b.onclick = () => b.closest('.ligne-choix, .ligne-var').remove(); });
        // image d'une réponse : ajouter / retirer
        f.querySelectorAll('[data-image-choix]').forEach((b) => { b.onclick = async () => {
          const l = b.closest('.ligne-choix');
          if (l.dataset.image) { l.dataset.image = ''; majImageChoix(l); return; }
          const r = await E.choisirImage();
          if (!r.annule && verifier(r)) { l.dataset.image = r.image; majImageChoix(l); }
        }; });
        f.querySelectorAll('.ligne-choix').forEach(majImageChoix);
      };
      async function majImageChoix(l) {
        const b = l.querySelector('[data-image-choix]'), img = l.querySelector('.img-choix');
        if (l.dataset.image) { img.src = await urlImage(l.dataset.image); img.hidden = false; b.textContent = '✕ image'; b.title = 'Retirer l’image'; }
        else { img.hidden = true; img.removeAttribute('src'); b.textContent = '🖼'; b.title = 'Ajouter une image à cette réponse'; }
      }
      brancherSuppr();
      f.querySelector('#ajout-choix').addEventListener('click', () => { f.querySelector('#choix').insertAdjacentHTML('beforeend', ligneChoix({ texte: '', juste: false })); brancherSuppr(); });
      f.querySelector('#ajout-var').addEventListener('click', () => { const n = 'abcdefgh'[f.querySelectorAll('.ligne-var').length] || 'x'; f.querySelector('#vars').insertAdjacentHTML('beforeend', ligneVar({ nom: n, min: 1, max: 10, pas: 1 })); brancherSuppr(); });
      f.querySelector('#retour-banque').addEventListener('click', liste);
      f.querySelector('#btn-apercu').addEventListener('click', async () => {
        const r = await E.apercu(lire());
        f.querySelector('#erreur-q').textContent = r.ok ? '' : r.message;
        f.querySelector('#apercu').innerHTML = r.ok ? `<b>Exemple pour un élève :</b> ${tm(r.enonce)}${r.choix ? `<br>${r.choix.map((c) => '• ' + tm(c)).join('<br>')}` : ''}<br><b>Réponse attendue :</b> ${tm(r.attendu)}${r.explication ? `<br><b>Explication :</b><div class="explication-prof">${window.Equations ? window.Equations.etapesHtml(r.explication) : e$(r.explication)}</div>` : ''}` : '';
      });
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const r = await E.enregistrerQuestion(lire());
        if (!r.ok) { f.querySelector('#erreur-q').textContent = r.message; return; }
        toast('Question enregistrée', `${r.question.chapitre} › ${r.question.notion}`, 'info');
        courant = r.question.chapitre;
        liste();
      });
    }
    const ligneChoix = (c) => `<div class="ligne-choix" data-image="${e$(c.image || '')}"><input type="checkbox" name="cj" ${c.juste ? 'checked' : ''} title="Bonne réponse"><img class="img-choix" hidden alt=""><input name="ct" value="${e$(c.texte)}" placeholder="Réponse proposée (ou seulement une image)"><button type="button" class="secondaire petit" data-image-choix title="Ajouter une image à cette réponse">🖼</button><button type="button" class="lien" data-retirer title="Retirer">✕</button></div>`;
    const ligneVar = (v) => `<div class="ligne-var"><input name="vn" value="${e$(v.nom)}" size="3" title="Nom (une lettre)"><span>de</span><input name="vmin" value="${e$(v.min)}" size="6"><span>à</span><input name="vmax" value="${e$(v.max)}" size="6"><span>par pas de</span><input name="vpas" value="${e$(v.pas)}" size="5"><button type="button" class="lien" data-retirer title="Retirer">✕</button></div>`;
    liste();
  }

  // ---------- Créer / modifier une évaluation : on coche des chapitres et des automatismes ----------
  async function editerEvaluation(ev, apres) {
    const rb = await E.banque();
    if (!verifier(rb)) return;
    const qs = rb.questions;
    if (!qs.length) { toast('Banque vide', 'Ajoute d\'abord des questions dans la banque.', 'erreur'); return; }
    const d = ev || { titre: '', dureeMin: 30, correction: 'fin-eleve', calculatrice: true, parties: [{ partie: 'cours', cles: [], nombre: 5 }, { partie: 'automatisme', cles: [], nombre: 5 }] };
    const partie = (p) => { // ancienne évaluation (par notions) : on retrouve les cases à cocher
      const x = d.parties.find((y) => (y.partie || (y.type === 'calcul' ? 'automatisme' : 'cours')) === p) || { cles: [], nombre: 0 };
      return { nombre: x.nombre, cles: x.cles || qs.filter((q) => (x.notions || []).includes(q.notion)).map(CLE) };
    };
    const blocPartie = (p, titre) => {
      const pp = partie(p), deP = qs.filter((q) => q.partie === p);
      const chaps = [...new Set(deP.map((q) => q.chapitre))].sort(parNom);
      return `<fieldset class="eval-partie" data-partie="${p}"><legend>${titre}</legend>
        ${chaps.length ? chaps.map((c) => {
          const items = [...new Set(deP.filter((q) => q.chapitre === c).map(CLE))].sort(parNom);
          return `<div class="eval-chap"><label class="case eval-chap-tete"><input type="checkbox" data-tout="${e$(c)}"> 📁 <b>${e$(c)}</b></label>
            <div class="eval-notions">${items.map((k) => { const nom = k.slice(c.length + 3); const n = deP.filter((q) => CLE(q) === k).length;
              return `<label><input type="checkbox" name="k-${p}" data-chap="${e$(c)}" value="${e$(k)}" ${pp.cles.includes(k) ? 'checked' : ''}> ${p === 'automatisme' ? '⚙️ ' : ''}${e$(nom === c ? 'Tout le cours du chapitre' : nom)} <span class="note-prof" style="display:inline">(${n})</span></label>`; }).join('')}</div></div>`;
        }).join('') + `<label>Nombre de questions <input type="number" name="nb-${p}" min="0" max="40" value="${pp.nombre}"></label>`
          : `<p class="note-prof">Aucune question ${p === 'cours' ? 'de cours' : 'd\'automatisme'} dans la banque.</p>`}</fieldset>`;
    };
    const dlg = fenetre(ev ? 'Modifier l\'évaluation' : 'Nouvelle évaluation', `<form class="eval-form" id="form-ev">
      <label>Titre <input name="titre" value="${e$(d.titre)}" placeholder="ex. Automatismes n°3 — coefficient multiplicateur" required></label>
      ${blocPartie('cours', '📖 Cours')}
      ${blocPartie('automatisme', '🔢 Automatismes')}
      <div class="eval-ligne3">
        <label>Durée (minutes, 0 = sans chrono) <input type="number" name="duree" min="0" max="240" value="${d.dureeMin}"></label>
        <label class="case"><input type="checkbox" name="calc" ${d.calculatrice ? 'checked' : ''}> Calculatrice pour les automatismes (étapes enregistrées)</label>
      </div>
      <div><b>Correction montrée à l'élève</b>
        <label class="case"><input type="radio" name="corr" value="fin-eleve" ${d.correction !== 'fin-heure' ? 'checked' : ''}> dès qu'il a rendu sa copie</label>
        <label class="case"><input type="radio" name="corr" value="fin-heure" ${d.correction === 'fin-heure' ? 'checked' : ''}> à la fin du chrono (ou quand tu termines), pour toute la classe en même temps</label></div>
      <p class="note-prof">Chaque élève reçoit ses propres questions, tirées dans ce que tu as coché : celles où il s'est trompé les fois précédentes reviennent en priorité.</p>
      <p class="erreur" id="erreur-ev"></p>
      <div class="rangee"><span class="espace"></span><button class="principal">Enregistrer</button></div></form>`, { large: true });
    const f = dlg.querySelector('#form-ev');
    // case d'un chapitre : coche / décoche tout ce qu'il contient
    const majTetes = () => f.querySelectorAll('[data-tout]').forEach((t) => { const fs2 = [...t.closest('.eval-chap').querySelectorAll('[data-chap]')]; t.checked = fs2.length && fs2.every((x) => x.checked); t.indeterminate = !t.checked && fs2.some((x) => x.checked); });
    f.querySelectorAll('[data-tout]').forEach((t) => t.addEventListener('change', () => { t.closest('.eval-chap').querySelectorAll('[data-chap]').forEach((x) => { x.checked = t.checked; }); majTetes(); }));
    f.querySelectorAll('[data-chap]').forEach((x) => x.addEventListener('change', majTetes));
    majTetes();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const parties = ['cours', 'automatisme'].map((p) => ({ partie: p, cles: [...f.querySelectorAll(`[name="k-${p}"]:checked`)].map((x) => x.value), nombre: Number((f.querySelector(`[name="nb-${p}"]`) || {}).value || 0) }));
      const r = await E.enregistrer({ id: d.id, titre: f.titre.value, dureeMin: f.duree.value, calculatrice: f.calc.checked, correction: f.querySelector('[name=corr]:checked').value, parties });
      if (!r.ok) { f.querySelector('#erreur-ev').textContent = r.message; return; }
      dlg.close();
      toast('Évaluation enregistrée', r.evaluation.titre, 'info');
      apres();
    });
  }

  // ---------- Choisir le modèle d'une nouvelle évaluation ----------
  function choisirModele(apres) {
    const dlg = fenetre('Nouvelle évaluation', `<p class="note-prof">Quel modèle d'évaluation ?</p>
      <div class="eval-modeles">
        <button class="eval-modele" data-modele="questions"><span class="ic">🎲</span><b>Questions</b><span>QCM de cours et automatismes tirés de ta banque, adaptés à chaque élève, corrigés automatiquement.</span></button>
        <button class="eval-modele" data-modele="exercice"><span class="ic">📄</span><b>Exercice (PDF)</b><span>Ta feuille d'exercices en PDF : l'élève clique sur une question pour l'agrandir et écrire sa réponse (écriture mathématique). Tu corriges à la main.</span></button>
      </div>`);
    dlg.querySelectorAll('[data-modele]').forEach((b) => b.addEventListener('click', () => { dlg.close(); if (b.dataset.modele === 'exercice') editerExercice(null, apres); else editerEvaluation(null, apres); }));
  }
  // L'outil s'ouvre à la place de l'espace professeur ; on y revient en le fermant (comme « Travail à rendre »).
  const outilEval = (p) => { document.getElementById('espace-prof').hidden = true; etat.retourEspaceProf = true; ouvrirOutil('evaluation-maths', p); };
  const placerQuestions = (id) => outilEval({ mode: 'zones', eval: id });

  // ---------- Évaluation « exercice » : un PDF, une zone par question, correction à la main ----------
  function editerExercice(ev, apres) {
    const d = ev || { titre: '', dureeMin: 55, calculatrice: true, outils: [], pdf: null, nomPdf: '', zones: [] };
    const OUTILS = [['calculatrice', '🧮 Calculatrice'], ['calculatrice-numworks', '🔢 Calculatrice NumWorks'], ['tableur', '📊 Tableur'], ['geogebra', '📐 GeoGebra'], ['python', '🐍 Python'], ['tableau-periodique', '⚛️ Tableau périodique']];
    let pdf = d.pdf, nomPdf = d.nomPdf;
    const dlg = fenetre(ev ? 'Modifier l\'évaluation (exercice)' : 'Nouvelle évaluation — Exercice (PDF)', `<form class="eval-form" id="form-ex">
      <label>Titre <input name="titre" value="${e$(d.titre)}" placeholder="ex. Évaluation n°2 — Fonctions affines" required></label>
      <div><b>Feuille d'exercices (PDF)</b>
        <div class="rangee" style="margin-top:6px"><button type="button" class="secondaire" id="ex-pdf">📄 Choisir le PDF…</button><span class="note-prof" style="margin:0" id="ex-nom">${pdf ? e$(nomPdf || 'PDF choisi') : 'Aucun PDF choisi'}</span></div></div>
      <div class="eval-ligne3">
        <label>Durée (minutes, 0 = sans chrono) <input type="number" name="duree" min="0" max="240" value="${d.dureeMin}"></label>
        <label class="case"><input type="checkbox" name="calc" ${d.calculatrice ? 'checked' : ''}> Calculatrice dans chaque question</label>
      </div>
      <fieldset class="eval-partie"><legend>🧰 Outils autorisés, ouverts à côté de l'évaluation (double fenêtre)</legend>
        <div class="eval-notions">${OUTILS.map(([id, nom]) => `<label><input type="checkbox" name="outil" value="${id}" ${(d.outils || []).includes(id) ? 'checked' : ''}> ${nom}</label>`).join('')}</div>
        <p class="note-prof" style="margin:4px 0 0">L'élève les ouvre d'un clic depuis l'évaluation ; tous les autres outils restent fermés. (Excel en ligne est un site internet : il ne peut pas s'ouvrir à côté ; le Tableur le remplace.)</p></fieldset>
      <p class="note-prof">Après l'enregistrement, tu traces un rectangle autour de chaque question du PDF. Pendant l'évaluation, l'élève clique sur une question : elle s'agrandit et il écrit sa réponse ligne par ligne (texte ou écriture mathématique). Tu corriges ensuite chaque copie (juste / en partie / faux + commentaire), puis tu rends les corrections.</p>
      <p class="erreur" id="erreur-ex"></p>
      <div class="rangee"><span class="espace"></span><button class="principal">Enregistrer${ev && (ev.zones || []).length ? '' : ' et placer les questions'}</button></div></form>`);
    const f = dlg.querySelector('#form-ex');
    dlg.querySelector('#ex-pdf').addEventListener('click', async () => {
      const r = await E.choisirPdf();
      if (r.annule) return;
      if (!r.ok) { f.querySelector('#erreur-ex').textContent = r.message; return; }
      if (pdf && r.pdf !== pdf && (d.zones || []).length && !confirm('Nouveau PDF : les questions déjà placées seront effacées. Continuer ?')) return;
      pdf = r.pdf; nomPdf = r.nomPdf;
      dlg.querySelector('#ex-nom').textContent = nomPdf;
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await E.enregistrer({ id: d.id, modele: 'exercice', titre: f.titre.value, dureeMin: f.duree.value, calculatrice: f.calc.checked, outils: [...f.querySelectorAll('[name=outil]:checked')].map((x) => x.value), pdf, nomPdf, ...(pdf !== d.pdf ? { zones: [] } : {}) });
      if (!r.ok) { f.querySelector('#erreur-ex').textContent = r.message; return; }
      dlg.close();
      toast('Évaluation enregistrée', r.evaluation.titre, 'info');
      if (!r.evaluation.zones.length) placerQuestions(r.evaluation.id); else apres();
    });
  }

  // ---------- Copie d'un élève ----------
  async function voirCopie(sid, eleveId) {
    const r = await E.copie(sid, eleveId);
    if (!verifier(r)) return;
    const dlg = fenetre(`Copie de ${r.nom}`, `<p class="bilan-prof">${r.faux} réponse(s) fausse(s) sur ${r.total}</p>
      ${r.lignes.map((l) => `<div class="eval-corr ${l.juste ? 'juste' : 'faux'}"><b>${l.juste ? '✔' : '✘'} Question ${l.n + 1}</b> · <span class="note-prof" style="display:inline">${e$(l.notion)}</span>
        <p>${tm(l.enonce)}</p>${l.image ? `<img class="eval-img-copie" data-image="${e$(l.image)}" alt="">` : ''}
        <p>Réponse : <b>${tm(l.reponse)}</b>${(l.imagesReponse || []).map((n) => `<img class="eval-mini grand" data-image="${e$(n)}" alt="">`).join('')}${l.juste ? '' : ` · attendu : <b class="ok">${tm(l.attendu)}</b>${(l.imagesAttendu || []).map((n) => `<img class="eval-mini grand" data-image="${e$(n)}" alt="">`).join('')}`}</p>${l.explication ? `<div class="explication-prof">💡 ${window.Equations ? window.Equations.etapesHtml(l.explication) : e$(l.explication)}</div>` : ''}
        ${l.calculs.length ? `<div class="eval-calculs">🧮 ${l.calculs.map((c) => (c.note ? (c.math ? `<span class="note-calc">${maths(c.expr)}</span>` : `<span class="note-calc">✏️ ${e$(c.expr)}</span>`) : `<span>${maths(c.expr)} = ${e$(c.res)}</span>`)).join('')}</div>` : ''}</div>`).join('')}`, { large: true });
    remplirImages(dlg); // les images de la banque (sur ce PC)
  }

  // ---------- Analyse des erreurs fréquentes ----------
  async function ouvrirAnalyse(c, sid = null, titre = '') {
    const r = await E.analyse(c.id, sid);
    if (!verifier(r)) return;
    const couleur = (p) => (p >= 75 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626');
    const barre = (p) => `<span class="analyse-barre"><span style="width:${p}%;background:${couleur(p)}"></span></span><b style="color:${couleur(p)}">${p} %</b>`;
    const contenu = !r.copies ? '<p class="prof-vide">Aucune copie à analyser pour l’instant.</p>' : `
      <p class="note-prof">${r.copies} copie(s) analysée(s) sur ${r.sessions} évaluation(s)${titre ? ' · ' + e$(titre) : ' · toutes les évaluations de la classe'}. Les notions les moins réussies sont en haut.</p>
      ${r.notions.map((n) => `<div class="analyse-notion">
        <div class="analyse-tete"><span class="eval-badge ${n.partie === 'cours' ? 'qcm' : 'calcul'}">${n.partie === 'cours' ? 'Cours' : 'Automatisme'}</span>
          <b>${e$(n.notion === n.chapitre ? n.chapitre : n.chapitre + ' › ' + n.notion)}</b><span class="espace"></span>${barre(n.reussite)}</div>
        <p class="note-prof" style="margin:2px 0 6px">${n.justes} / ${n.total} réponses justes${n.jsp ? ` · ${n.jsp} « je ne sais pas »` : ''}</p>
        ${n.aAider.length ? `<p class="analyse-aider">🧑‍🎓 À aider sur cette notion : ${n.aAider.map((x) => `<span class="puce-eleve">${e$(x.nom)} (${x.reussite} %)</span>`).join(' ')}</p>` : ''}
        ${n.questions.map((q) => `<div class="analyse-question">
          <div class="analyse-q-tete"><span class="analyse-enonce">${tm(q.enonce)}</span>${barre(q.reussite)}<span class="note-prof" style="display:inline;margin:0">(${q.total})</span></div>
          ${q.erreurs.length ? `<ul class="analyse-erreurs">${q.erreurs.map((x) => `<li><b>${e$(x.libelle)}</b> — ${x.n} fois (${x.part} % des erreurs)${x.exemples.length ? `<br><span class="note-prof" style="display:inline;margin:0">ex. ${x.exemples.map((t) => `<b>${tm(t.donne)}</b> au lieu de ${tm(t.attendu)}`).join(' · ')}</span>` : ''}</li>`).join('')}</ul>` : '<p class="note-prof" style="margin:4px 0 0">✔ Aucune erreur.</p>'}
        </div>`).join('')}
      </div>`).join('')}`;
    fenetre(`📊 Analyse des erreurs — ${c.nom}`, contenu, { large: true });
  }

  // ---------- Onglet de la classe ----------
  window.afficherEvaluationsClasse = async function (c, zone) {
    clearInterval(suiviMinuterie);
    const [rb, rl, rs] = await Promise.all([E.banque(), E.liste(), E.sessions(c.id)]);
    if (!verifier(rb) || !verifier(rl) || !verifier(rs)) return;
    const enCours = rs.sessions.find((s) => s.etat === 'en-cours' && c.examen && c.examen.evaluation === s.sid) || rs.sessions.find((s) => s.etat === 'en-cours');
    const recharger = () => window.afficherEvaluationsClasse(c, zone);
    zone.innerHTML = `
      ${enCours ? `<div class="eval-direct"><div class="eval-direct-tete"><b>🔴 En cours : ${e$(enCours.titre)}</b><span class="note-prof" style="margin:0" id="eval-chrono"></span><span class="espace"></span>
          ${enCours.modele === 'exercice' ? '<button class="secondaire" id="eval-corriger">✍️ Corriger les copies</button>' : ''}<button class="secondaire" id="eval-rendre" title="Donner les corrections maintenant (l'examen continue)">Rendre les corrections</button>
          <button class="principal" id="eval-terminer">Terminer l'évaluation</button></div><div id="eval-suivi"></div></div>` : ''}
      <div class="rangee">
        <button class="secondaire" id="eval-banque">📚 Banque de questions (${rb.questions.length})</button>
        <button class="principal" id="eval-nouvelle">➕ Nouvelle évaluation</button>
        <button class="secondaire" id="eval-analyse" title="Notions et questions les moins réussies, erreurs les plus fréquentes, élèves à aider">📊 Analyse des erreurs</button>
      </div>
      <div class="entr-bloc"><div><b>🏋️ Entraînement des élèves</b><div class="note-prof" style="margin:2px 0 0">Les élèves s’entraînent sur les chapitres et automatismes de ta banque, et sur tes modules d’exercices (avec ta correction). Ça ne compte pas dans les notes.</div></div>
        <span class="espace"></span>
        <button class="secondaire" id="entr-modules" title="Fiches d'exercices par chapitre et notion, avec ta correction">🧩 Modules d’exercices</button>
        <button class="principal" id="entr-ouvrir" title="Ce que cette classe peut travailler en entraînement">⚙️ Ouvrir à la classe</button>
        <button class="secondaire" id="entr-suivi" title="Ce que chaque élève a travaillé">📊 Suivi</button>
      </div>
      ${rl.evaluations.length ? `<div class="elements">${rl.evaluations.map((ev) => `<div class="element">
          <span class="ic">📝</span>
          <div style="min-width:0"><div class="nom-el">${e$(ev.titre)}</div>
            <div class="meta-el">${ev.modele === 'exercice' ? `📄 Exercice (PDF${ev.nomPdf ? ' : ' + e$(ev.nomPdf) : ''}) · ${ev.zones.length ? ev.zones.length + ' question(s)' : '<b class="ko">questions pas encore placées</b>'} · ${ev.dureeMin ? ev.dureeMin + ' min' : 'sans chrono'}${(ev.outils || []).length ? ' · 🧰 ' + ev.outils.length + ' outil(s)' : ''} · correction à la main` : ''}${(ev.parties || []).map((p) => `${p.nombre} question(s) ${(p.partie || (p.type === 'calcul' ? 'automatisme' : 'cours')) === 'cours' ? 'de cours' : 'd’automatismes'} (${e$((p.cles || p.notions || []).map((k) => k.split(' › ').pop()).join(', '))})`).join(' · ')} ${ev.modele === 'exercice' ? '' : ` · ${ev.dureeMin ? ev.dureeMin + ' min' : 'sans chrono'} · correction ${ev.correction === 'fin-heure' ? 'à la fin' : 'dès la copie rendue'}`}</div></div>
          <div class="actions-el">${c.archive ? '' : `<button data-lancer="${e$(ev.id)}" class="principal" ${enCours ? 'disabled title="Une évaluation est déjà en cours"' : ''}>▶ Lancer</button>`}
            ${ev.modele === 'exercice' ? `<button data-placer="${e$(ev.id)}" title="Tracer les questions sur le PDF">📐 Placer les questions</button>` : ''}<button data-modifier="${e$(ev.id)}">Modifier</button><button data-supprimer="${e$(ev.id)}" class="danger">Supprimer</button></div></div>`).join('')}</div>`
        : '<p class="prof-vide">Aucune évaluation préparée. Remplis la banque de questions, puis crée une évaluation.</p>'}
      ${rs.sessions.filter((s) => s !== enCours).length ? `<h3 class="eval-notion">Évaluations passées avec ${e$(c.nom)}</h3><div class="elements">${rs.sessions.filter((s) => s !== enCours).map((s) => `<div class="element"><span class="ic">🗂</span>
          <div style="min-width:0"><div class="nom-el">${e$(s.titre)}</div><div class="meta-el">${new Date(s.debut).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${s.eleves} élève(s)${s.etat === 'en-cours' ? ' · en cours' : ''}</div></div>
          <div class="actions-el">${s.modele === 'exercice' ? `<button data-corriger="${e$(s.sid)}">✍️ Corriger les copies</button><button data-rendre-ex="${e$(s.sid)}" title="Envoyer la correction aux élèves dont la copie est corrigée">📤 Rendre les corrections</button>` : `<button data-analyse="${e$(s.sid)}" data-titre="${e$(s.titre)}">📊 Analyse</button>`}<button data-resultats="${e$(s.sid)}">Voir les copies</button></div></div>`).join('')}</div>` : ''}
      <div id="eval-resultats"></div>`;
    zone.querySelector('#eval-banque').addEventListener('click', () => ouvrirBanque(recharger));
    zone.querySelector('#eval-nouvelle').addEventListener('click', () => choisirModele(recharger));
    zone.querySelectorAll('[data-placer]').forEach((b) => b.addEventListener('click', () => placerQuestions(b.dataset.placer)));
    zone.querySelectorAll('[data-corriger]').forEach((b) => b.addEventListener('click', () => corrigerExercice(b.dataset.corriger)));
    zone.querySelectorAll('[data-rendre-ex]').forEach((b) => b.addEventListener('click', () => rendreExercice(b.dataset.rendreEx)));
    zone.querySelector('#eval-analyse').addEventListener('click', () => ouvrirAnalyse(c));
    zone.querySelector('#entr-modules').addEventListener('click', () => gererModules());
    zone.querySelector('#entr-ouvrir').addEventListener('click', () => ouvrirEntrainement(c));
    zone.querySelector('#entr-suivi').addEventListener('click', () => suiviEntrainement(c));
    zone.querySelectorAll('[data-analyse]').forEach((b) => b.addEventListener('click', () => ouvrirAnalyse(c, b.dataset.analyse, b.dataset.titre)));
    zone.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => { const ev = rl.evaluations.find((x) => x.id === b.dataset.modifier); if (ev.modele === 'exercice') editerExercice(ev, recharger); else editerEvaluation(ev, recharger); }));
    zone.querySelectorAll('[data-supprimer]').forEach((b) => b.addEventListener('click', async () => {
      const ev = rl.evaluations.find((x) => x.id === b.dataset.supprimer);
      if (ev && confirm(`Supprimer l'évaluation « ${ev.titre} » ? (les copies des évaluations déjà passées restent)`) && verifier(await E.supprimer(ev.id))) recharger();
    }));
    zone.querySelectorAll('[data-lancer]').forEach((b) => b.addEventListener('click', async () => {
      const ev = rl.evaluations.find((x) => x.id === b.dataset.lancer);
      if (ev.modele === 'exercice' && !ev.zones.length) { toast('Questions pas encore placées', 'Clique sur « 📐 Placer les questions » pour tracer les questions sur le PDF.', 'erreur'); return; }
      if (!confirm(ev.modele === 'exercice' ? `Lancer « ${ev.titre} » avec ${c.nom} ?\n\nChaque élève reçoit la feuille d'exercices et la classe passe en mode examen : seule l'évaluation est ouverte.` : `Lancer « ${ev.titre} » avec ${c.nom} ?\n\nChaque élève reçoit ses propres questions et la classe passe en mode examen : seule l'évaluation est ouverte.`)) return;
      const r = await E.lancer(c.id, ev.id);
      if (!verifier(r)) return;
      toast('Évaluation lancée', r.manque ? `Attention : il manquait ${r.manque} question(s) dans la banque pour certaines notions.` : 'Les élèves la reçoivent dans les secondes qui viennent.', r.manque ? 'erreur' : 'info');
      window.profOutils.rafraichir();
    }));
    zone.querySelectorAll('[data-resultats]').forEach((b) => b.addEventListener('click', () => tableauSuivi(b.dataset.resultats, zone.querySelector('#eval-resultats'), false)));
    if (enCours) {
      const exo = enCours.modele === 'exercice';
      zone.querySelector('#eval-corriger')?.addEventListener('click', () => corrigerExercice(enCours.sid));
      zone.querySelector('#eval-terminer').addEventListener('click', async () => {
        if (!confirm(exo ? 'Terminer l\'évaluation ? Les copies sont ramassées et l\'examen s\'arrête. Tu corriges ensuite chaque copie, puis tu rends les corrections.' : 'Terminer l\'évaluation ? Les corrections sont rendues à tous les élèves qui ont une copie, puis l\'examen s\'arrête.')) return;
        if (verifier(await E.terminer(enCours.sid))) { toast('Évaluation terminée', exo ? 'Copies ramassées : clique sur « ✍️ Corriger les copies ».' : 'Corrections rendues.', 'info'); window.profOutils.rafraichir(); }
      });
      if (exo) zone.querySelector('#eval-rendre').addEventListener('click', () => rendreExercice(enCours.sid));
      else zone.querySelector('#eval-rendre').addEventListener('click', async () => {
        if (!confirm('Rendre les corrections maintenant ? Les élèves qui ont une copie voient leurs erreurs ; l\'examen continue.')) return;
        if (verifier(await E.rendre(enCours.sid))) toast('Corrections rendues', '', 'info');
      });
      const actualiser = () => {
        if (!document.body.contains(zone) || window.profOutils.ongletActif() !== 'evaluations') { clearInterval(suiviMinuterie); return; }
        tableauSuivi(enCours.sid, zone.querySelector('#eval-suivi'), true);
      };
      actualiser();
      suiviMinuterie = setInterval(actualiser, 3000);
    }
  };

  // Exercice : correction à la main dans l'outil (feuille + réponses), puis corrections rendues
  async function corrigerExercice(sid, eleveId) {
    if (!eleveId) {
      const r = await E.suivi(sid);
      if (!verifier(r)) return;
      const x = r.eleves.find((y) => y.commence && !y.note) || r.eleves.find((y) => y.commence);
      if (!x) { toast('Aucune copie', 'Aucun élève n\'a encore commencé.', 'info'); return; }
      eleveId = x.eleveId;
    }
    outilEval({ mode: 'corriger', sid, eleve: eleveId });
  }
  async function rendreExercice(sid) {
    if (!confirm('Envoyer la correction aux élèves dont la copie est corrigée ? (Tu pourras encore la modifier et la renvoyer.)')) return;
    const r = await E.rendre(sid);
    if (verifier(r)) toast('Corrections rendues', `${r.rendues} correction(s) envoyée(s)${r.aCorriger ? ` · ${r.aCorriger} copie(s) pas encore corrigée(s)` : ''}.`, 'info');
  }

  // =====================================================================================
  // Entraînement : modules d'exercices, ouverture à la classe, suivi
  // =====================================================================================
  async function gererModules() {
    const dlg = fenetre('🧩 Modules d’exercices', '<div id="mod-zone"></div>', { large: true });
    const zone = dlg.querySelector('#mod-zone');
    async function liste() {
      const r = await E.entrModules(); if (!verifier(r)) return;
      const parChap = {};
      r.modules.forEach((m) => (parChap[m.chapitre] = parChap[m.chapitre] || []).push(m));
      zone.innerHTML = `<p class="note-prof">Un module = une fiche d’exercices (PDF) sur une ou quelques notions d’un chapitre (ex. « Fonctions de degré 3 » › « Calculer une dérivée », « Tableau de variations »). Tu places les questions comme pour une évaluation « exercice » et tu écris <b>ta correction</b> de chaque question : l’élève la découvre après avoir cherché, puis s’auto-évalue.</p>
        <div class="rangee"><button class="principal" id="mod-nouveau">➕ Nouveau module</button></div>
        ${r.modules.length ? Object.keys(parChap).sort(parNom).map((ch) => `<h3 class="eval-notion">📁 ${e$(ch)}</h3><div class="elements">${parChap[ch].map((m) => `<div class="element"><span class="ic">🧩</span>
          <div style="min-width:0"><div class="nom-el">${e$(m.titre)}</div><div class="meta-el">${m.notions.map(e$).join(' · ') || 'notions non précisées'} · ${m.zones.length ? m.zones.length + ' question(s)' : '<b class="ko">questions pas encore placées</b>'} · ${m.zones.filter((z) => z.correction).length} correction(s)${m.corrige ? ' · 📄 corrigé PDF' : ''}</div></div>
          <div class="actions-el"><button data-placer-mod="${e$(m.id)}">📐 Questions et corrections</button><button data-modif-mod="${e$(m.id)}">Modifier</button><button class="danger" data-suppr-mod="${e$(m.id)}">Supprimer</button></div></div>`).join('')}</div>`).join('')
          : '<p class="prof-vide">Aucun module pour l’instant.</p>'}`;
      zone.querySelector('#mod-nouveau').addEventListener('click', () => editer(null));
      zone.querySelectorAll('[data-modif-mod]').forEach((b) => b.addEventListener('click', () => editer(r.modules.find((m) => m.id === b.dataset.modifMod))));
      zone.querySelectorAll('[data-placer-mod]').forEach((b) => b.addEventListener('click', () => { dlg.close(); outilEval({ mode: 'module-zones', module: b.dataset.placerMod }); }));
      zone.querySelectorAll('[data-suppr-mod]').forEach((b) => b.addEventListener('click', async () => { const m = r.modules.find((x) => x.id === b.dataset.supprMod); if (confirm(`Supprimer le module « ${m.titre} » ?`) && verifier(await E.entrModuleSupprimer(m.id))) liste(); }));
    }
    async function editer(m) {
      const rb = await E.banque();
      const chapitres = rb.ok ? rb.chapitres : [];
      const d = m || { titre: '', chapitre: '', notions: [], pdf: null, nomPdf: '', corrige: null, nomCorrige: '' };
      let pdf = d.pdf, nomPdf = d.nomPdf, corrige = d.corrige, nomCorrige = d.nomCorrige;
      zone.innerHTML = `<form class="eval-form" id="form-mod"><h3>${m ? 'Modifier le module' : 'Nouveau module d’exercices'}</h3>
        <label>Titre <input name="titre" value="${e$(d.titre)}" placeholder="ex. Dériver et étudier une fonction de degré 3" required></label>
        <div class="eval-ligne2"><label>Chapitre <input name="chapitre" list="mod-chaps" value="${e$(d.chapitre)}" required placeholder="ex. Chapitre 4 : Fonctions polynômes de degré 3"><datalist id="mod-chaps">${chapitres.map((x) => `<option value="${e$(x)}">`).join('')}</datalist></label>
          <label>Notions travaillées <input name="notions" value="${e$(d.notions.join(', '))}" placeholder="ex. Calculer une dérivée, Tableau de variations"></label></div>
        <div><b>Fiche d’exercices (PDF)</b> <button type="button" class="secondaire" id="mod-pdf">📄 Choisir…</button> <span class="note-prof" style="display:inline" id="mod-nom">${pdf ? e$(nomPdf || 'PDF choisi') : 'aucune'}</span></div>
        <div><b>Corrigé complet (PDF, facultatif)</b> <button type="button" class="secondaire" id="mod-corr">📄 Choisir…</button> <span class="note-prof" style="display:inline" id="mod-nomc">${corrige ? e$(nomCorrige || 'PDF choisi') : 'aucun'}</span>${corrige ? ' <button type="button" class="lien danger" id="mod-corr-x">Retirer</button>' : ''}</div>
        <p class="note-prof">Ensuite : <b>📐 Questions et corrections</b> pour encadrer chaque question sur la fiche et écrire sa correction.</p>
        <p class="erreur" id="mod-erreur"></p>
        <div class="rangee"><button type="button" class="secondaire" id="mod-retour">← Retour</button><span class="espace"></span><button class="principal">Enregistrer</button></div></form>`;
      const fm = zone.querySelector('#form-mod');
      zone.querySelector('#mod-retour').addEventListener('click', liste);
      zone.querySelector('#mod-pdf').addEventListener('click', async () => { const x = await E.choisirPdf(); if (x.annule || !verifier(x)) return; pdf = x.pdf; nomPdf = x.nomPdf; zone.querySelector('#mod-nom').textContent = nomPdf; });
      zone.querySelector('#mod-corr').addEventListener('click', async () => { const x = await E.choisirPdf(); if (x.annule || !verifier(x)) return; corrige = x.pdf; nomCorrige = x.nomPdf; zone.querySelector('#mod-nomc').textContent = nomCorrige; });
      zone.querySelector('#mod-corr-x')?.addEventListener('click', () => { corrige = null; nomCorrige = ''; zone.querySelector('#mod-nomc').textContent = 'aucun'; });
      fm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const x = await E.entrModuleEnregistrer({ id: d.id, titre: fm.titre.value, chapitre: fm.chapitre.value, notions: fm.notions.value, pdf, nomPdf, corrige, nomCorrige });
        if (!x.ok) { zone.querySelector('#mod-erreur').textContent = x.message; return; }
        toast('Module enregistré', x.module.titre, 'info');
        if (!x.module.zones.length && confirm('Placer maintenant les questions et leurs corrections sur la fiche ?')) { dlg.close(); outilEval({ mode: 'module-zones', module: x.module.id }); return; }
        liste();
      });
    }
    liste();
  }

  async function ouvrirEntrainement(c) {
    const [ro, rb] = await Promise.all([E.entrOuverture(c.id), E.banque()]);
    if (!verifier(ro) || !verifier(rb)) return;
    const o = ro.ouverture, qs = rb.questions;
    const chaps = [...new Set([...qs.map((q) => q.chapitre), ...ro.modules.map((m) => m.chapitre)])].sort(parNom);
    const dlg = fenetre(`🏋️ Entraînement ouvert à ${c.nom}`, `<form class="eval-form" id="form-entr">
      <p class="note-prof">Coche ce que les élèves de cette classe peuvent travailler (par exemple les chapitres de la prochaine évaluation). Les questions de la banque sont corrigées tout de suite, avec ton explication ; elles sont copiées pour la classe avec leurs réponses.</p>
      ${chaps.map((ch) => { const cours = qs.filter((q) => q.chapitre === ch && q.partie === 'cours'), autos = [...new Set(qs.filter((q) => q.chapitre === ch && q.partie === 'automatisme').map((q) => q.notion))].sort(parNom), mods = ro.modules.filter((m) => m.chapitre === ch);
        return `<fieldset class="eval-partie"><legend>📁 ${e$(ch)}</legend><div class="eval-notions">
          ${cours.length ? `<label><input type="checkbox" name="cle" value="${e$(ch + ' › cours')}" ${o.cles.includes(ch + ' › cours') ? 'checked' : ''}> 📖 Cours (${cours.length} question${cours.length > 1 ? 's' : ''})</label>` : ''}
          ${autos.map((n) => `<label><input type="checkbox" name="cle" value="${e$(ch + ' › ' + n)}" ${o.cles.includes(ch + ' › ' + n) ? 'checked' : ''}> ⚙️ ${e$(n)} (${qs.filter((q) => q.chapitre === ch && q.notion === n && q.partie === 'automatisme').length})</label>`).join('')}
          ${mods.map((m) => `<label><input type="checkbox" name="mod" value="${e$(m.id)}" ${o.modules.includes(m.id) ? 'checked' : ''} ${m.questions ? '' : 'disabled'}> 🧩 ${e$(m.titre)} ${m.questions ? `(${m.questions} question${m.questions > 1 ? 's' : ''})` : '<span class="ko">(questions pas encore placées)</span>'}</label>`).join('')}
        </div></fieldset>`; }).join('') || '<p class="prof-vide">Ta banque est vide et tu n’as pas encore de module d’exercices.</p>'}
      <p class="erreur" id="entr-erreur"></p>
      <div class="rangee"><span class="espace"></span><button class="principal">Enregistrer pour la classe</button></div></form>`, { large: true });
    const fe = dlg.querySelector('#form-entr');
    fe.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const x = await E.entrOuvrir(c.id, { cles: [...fe.querySelectorAll('[name=cle]:checked')].map((i) => i.value), modules: [...fe.querySelectorAll('[name=mod]:checked')].map((i) => i.value) });
      if (!x.ok) { fe.querySelector('#entr-erreur').textContent = x.message; return; }
      dlg.close(); toast('Entraînement mis à jour', `${x.questions} question(s) de la banque et ${x.modules} module(s) ouverts à ${c.nom}.`, 'info');
    });
  }

  async function suiviEntrainement(c) {
    const r = await E.entrSuivi(c.id); if (!verifier(r)) return;
    const pc = (j, t) => (t ? Math.round((100 * j) / t) + ' %' : '—');
    fenetre(`📊 Entraînement — ${c.nom}`, `<p class="note-prof">Ce que chaque élève a travaillé en entraînement (ça ne compte pas dans les notes). Clique sur un élève pour le détail.</p>
      <table class="eval-table"><thead><tr><th>Élève</th><th>Séries faites</th><th>Questions</th><th>Réussite</th><th>Modules faits</th><th>Dernière fois</th></tr></thead><tbody>
      ${r.eleves.map((x) => { const sv = x.suivi || { series: {}, modules: {} }, se = Object.values(sv.series || {}), mo = Object.values(sv.modules || {});
        const q = se.reduce((t, y) => t + y.questions, 0), j = se.reduce((t, y) => t + y.justes, 0);
        return `<tr class="entr-ligne" data-el="${e$(x.eleveId)}"><td><b>${e$(x.nom)}</b></td><td class="num">${se.reduce((t, y) => t + y.faites, 0)}</td><td class="num">${q}</td><td class="num">${pc(j, q)}</td><td class="num">${mo.length}</td><td>${sv.maj ? new Date(sv.maj).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td></tr>
          <tr class="entr-detail" data-det="${e$(x.eleveId)}" hidden><td colspan="6">${se.length || mo.length ? `<ul class="notes-detail">${Object.entries(sv.series || {}).map(([k, y]) => `<li>${e$(k.replace(' › cours', ' › 📖 Cours'))} : ${y.faites} série(s), ${pc(y.justes, y.questions)} de réussite (dernière : ${y.derniere ? y.derniere.justes + '/' + y.derniere.questions : '—'})</li>`).join('')}${Object.values(sv.modules || {}).map((y) => `<li>🧩 ${e$(y.titre)} : ✔ ${y.juste} · ◐ ${y.partiel} · ✘ ${y.faux} sur ${y.total} (auto-évaluation)</li>`).join('')}</ul>` : '<span class="note-prof">Rien pour l’instant.</span>'}</td></tr>`; }).join('')}
      </tbody></table>`, { large: true }).querySelectorAll('.entr-ligne').forEach((tr) => tr.addEventListener('click', () => { const d = tr.parentElement.querySelector(`[data-det="${tr.dataset.el}"]`); d.hidden = !d.hidden; }));
  }

  // Tableau : où en est chaque élève (en direct), et ses erreurs
  async function tableauSuivi(sid, cible, direct) {
    if (!cible) return;
    const r = await E.suivi(sid);
    if (!r.ok) { cible.innerHTML = `<p class="erreur">${e$(r.message)}</p>`; return; }
    const s = r.session;
    const chrono = document.getElementById('eval-chrono');
    if (chrono && direct) {
      if (s.dureeMin) { const reste = Math.max(0, Math.round((Date.parse(s.debut) + s.dureeMin * 60000 - Date.now()) / 60000)); chrono.textContent = `· ⏱ ${reste} min restante(s) · ${s.correction === 'fin-heure' ? 'corrections à la fin' : 'correction dès la copie rendue'}`; }
      else chrono.textContent = '· sans chrono';
    }
    const fini = r.eleves.filter((x) => x.fini).length;
    if (s.modele === 'exercice') {
      cible.innerHTML = `${direct ? '' : `<h3 class="eval-notion">${e$(s.titre)} — ${new Date(s.debut).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</h3>`}
        <p class="note-prof">${fini} / ${r.eleves.length} copie(s) rendue(s) · ${r.eleves.filter((x) => x.note).length} corrigée(s)${direct ? ' · mise à jour toutes les 3 secondes' : ''}</p>
        <table class="eval-table"><thead><tr><th>Élève</th><th>État</th><th>Questions répondues</th><th>Correction</th><th></th></tr></thead><tbody>
        ${r.eleves.map((x) => `<tr><td>${e$(x.nom)}</td>
          <td>${x.fini ? '✅ rendue' : x.commence ? '✏️ en cours' : '⏳ pas commencé'}</td>
          <td>${x.repondues} / ${x.total}</td>
          <td>${x.corrige ? '📤 rendue' : x.note ? '✔ corrigée' : '—'}</td>
          <td>${x.commence ? `<button class="lien" data-corr="${e$(x.eleveId)}">${x.note ? 'Revoir' : 'Corriger'}</button>` : ''}</td></tr>`).join('')}
        </tbody></table>`;
      cible.querySelectorAll('[data-corr]').forEach((b) => b.addEventListener('click', () => corrigerExercice(sid, b.dataset.corr)));
      return;
    }
    cible.innerHTML = `${direct ? '' : `<h3 class="eval-notion">${e$(s.titre)} — ${new Date(s.debut).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</h3>`}
      <p class="note-prof">${fini} / ${r.eleves.length} copie(s) rendue(s)${direct ? ' · mise à jour toutes les 3 secondes' : ''}</p>
      <table class="eval-table"><thead><tr><th>Élève</th><th>État</th><th>Réponses</th><th>Réponses fausses</th><th></th></tr></thead><tbody>
      ${r.eleves.map((x) => `<tr><td>${e$(x.nom)}</td>
        <td>${x.fini ? '✅ rendue' : x.commence ? '✏️ en cours' : '⏳ pas commencé'}${x.corrige ? ' · corrigée' : ''}</td>
        <td>${x.repondues} / ${x.total}</td>
        <td>${x.faux === null ? '—' : x.faux ? `<b class="ko">${x.faux}</b>` : '<b class="ok">0</b>'}</td>
        <td>${x.commence ? `<button class="lien" data-copie="${e$(x.eleveId)}">Voir</button>` : ''}</td></tr>`).join('')}
      </tbody></table>`;
    cible.querySelectorAll('[data-copie]').forEach((b) => b.addEventListener('click', () => voirCopie(sid, b.dataset.copie)));
  }
})();
