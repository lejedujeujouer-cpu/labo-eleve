// Labo Prof › classe › onglet « 📊 Notes » : système de notation de la classe (modèles réglables),
// carnet de notes par période (calculé à partir des évaluations de l'application + notes saisies à la main),
// appréciations, export Excel, notes montrées aux élèves. Le calcul est fait par evaluations.js (notes:*).
(function () {
  const E = api.evaluations;
  if (!E || !E.notesCalcul || !window.profOutils) return;
  const { verifier } = window.profOutils;
  const e$ = (t) => echapper(t);
  const fr = (n) => (n === null || n === undefined || n === '' ? '—' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
  const nb = (v) => Number(String(v ?? '').replace(',', '.'));
  const jour = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR') : '');
  const SOURCES = { cours: '📖 QCM de cours', automatismes: '🔢 Automatismes (QCM)', exercices: '📄 Évaluations « exercice »', competence: '🎯 Compétence (questions étiquetées)', manuel: '✍️ Notes saisies à la main' };
  let vueCompetences = false; // carnet ou tableau des compétences et objectifs
  const COULEURS_NIV = { na: '#fee2e2', ec: '#fef3c7', a: '#dcfce7', m: '#bbf7d0' };
  const ETATS_OBJ = { atteint: ['✅', 'Atteint'], 'en-cours': ['◐', 'En cours'], 'non-atteint': ['❌', 'Non atteint'] };
  const REGLES = { derniere: '📈 Progression : la dernière évaluation compte (par notion)', moyenne: 'Moyenne (avec coefficients)', meilleure: 'Meilleure note', somme: 'Somme des notes saisies (plafonnée)' };
  const periodes = {}; // période choisie, par classe
  let vuePronote = false; // carnet affiché comme sur Pronote : chaque partie sur 20, avec son coefficient

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

  // ---------- Onglet de la classe ----------
  window.afficherNotesClasse = async function (c, zone) {
    let r = await E.notesCalcul(c.id, periodes[c.id] || 0);
    if (!verifier(r)) return;
    if (!periodes[c.id]) { // la période en cours, à la première ouverture
      const auj = new Date().toISOString().slice(0, 10);
      const p = r.systeme.periodes.find((x) => auj >= x.debut && auj <= x.fin);
      periodes[c.id] = p ? p.num : r.periode.num;
      if (p && p.num !== r.periode.num) { r = await E.notesCalcul(c.id, p.num); if (!verifier(r)) return; }
    }
    const sys = r.systeme, recharger = () => window.afficherNotesClasse(c, zone);
    zone.innerHTML = `
      <div class="rangee notes-barre">
        <select id="notes-periode" title="Période">${sys.periodes.map((p) => `<option value="${p.num}" ${p.num === r.periode.num ? 'selected' : ''}>${e$(p.nom)}</option>`).join('')}</select>
        <span class="note-prof" style="margin:0">du ${jour(r.periode.debut)} au ${jour(r.periode.fin)}</span>
        <span class="espace"></span>
        <button class="${vueCompetences ? 'principal' : 'secondaire'}" id="notes-vue-comp" title="Niveau de chaque élève par compétence (avec le niveau visé) et objectifs atteints">🎯 Compétences & objectifs</button>
        <button class="secondaire" id="notes-referentiel" title="Tes compétences (niveau visé) et tes objectifs de séquence, à relier aux questions">📚 Référentiel</button>
        <button class="secondaire" id="notes-systeme">⚙️ Système de notation</button>
        <button class="secondaire" id="notes-saisir">✍️ Saisir des notes</button>
        <button class="${vuePronote ? 'principal' : 'secondaire'}" id="notes-pronote" title="Chaque partie sur 20 avec son coefficient, à recopier dans Pronote">🎓 Vue Pronote</button>
        <button class="secondaire" id="notes-export" title="Classeur Excel (avec une feuille Pronote)">📥 Excel</button>
        ${c.archive ? '' : `<button class="principal" id="notes-publier">${r.publie ? '🔄 Mettre à jour pour les élèves' : '📤 Montrer aux élèves'}</button>`}
      </div>
      <p class="note-prof">Système : <b>${e$(r.modeles[sys.modele] || '✏️ Personnel')}</b> — ${sys.parties.map((p) => `${e$(p.nom)} /${fr(p.points)}${p.bonus ? ` (+${fr(p.bonus)})` : ''}`).join(' + ')}
        · ${r.publie ? '👀 <b>visible par les élèves</b>' : 'pas encore montré aux élèves'}${r.moyenne !== null ? ` · moyenne de la classe : <b>${fr(r.moyenne)}/20</b>` : ''}</p>
      ${vuePronote ? `<div class="notes-pronote">🎓 <b>Pour Pronote</b> : crée <b>un devoir par partie, noté sur 20</b>, avec ces coefficients : ${sys.parties.map((p) => `<b>${e$(p.nom)}</b> coef <b>${fr(r.coefs[p.id])}</b>`).join(' · ')}. Recopie les notes ci-dessous : la moyenne de Pronote sera égale à la note /20 de la dernière colonne.${r.eleves.some((x) => x.negatif) ? ' ⚠ Une partie négative (ex. comportement) est mise à 0 pour Pronote : la moyenne Pronote sera alors un peu plus haute pour ces élèves (⚠ dans le tableau).' : ''}</div>` : ''}
      <div class="notes-table-zone"><table class="eval-table notes-table"><thead><tr><th>Élève</th>${sys.parties.map((p) => `<th title="${e$(REGLES[p.regle])}">${e$(p.nom)}<br><small>${vuePronote ? `/20 · coef ${fr(r.coefs[p.id])}` : `/${fr(p.points)}`}</small></th>`).join('')}<th>Note<br><small>/20</small></th><th>Appréciation</th></tr></thead><tbody>
        ${r.eleves.map((x) => `<tr><td><button class="lien" data-detail="${e$(x.eleveId)}" title="Voir le détail du calcul">${e$(x.nom)}</button></td>
          ${sys.parties.map((p) => `<td class="num">${fr(vuePronote ? x.pronote[p.id] : x.parties[p.id].score)}${vuePronote && (x.parties[p.id].score ?? 0) < 0 ? ' ⚠' : ''}</td>`).join('')}
          <td class="num"><b class="${x.note === null ? '' : x.note >= 10 ? 'ok' : 'ko'}">${fr(x.note)}</b></td>
          <td><input class="notes-appr" data-appr="${e$(x.eleveId)}" value="${e$(x.appreciation)}" placeholder="Appréciation…" maxlength="600"></td></tr>`).join('')}
      </tbody></table></div>
      <h3 class="eval-notion">✍️ Notes saisies à la main — ${e$(r.periode.nom)}</h3>
      ${r.saisies.length ? `<div class="elements">${r.saisies.sort((a, b) => a.date.localeCompare(b.date)).map((s) => `<div class="element"><span class="ic">✍️</span>
        <div style="min-width:0"><div class="nom-el">${e$(s.titre)}</div><div class="meta-el">${jour(s.date)} · ${e$((sys.parties.find((p) => p.id === s.partie) || {}).nom || 'partie supprimée')} · sur ${fr(s.sur)}${s.comptePour !== undefined ? ` (compte pour ${fr(s.comptePour)} pt)` : ''}${s.coef !== 1 ? ` · coef ${fr(s.coef)}` : ''} · ${Object.keys(s.notes).length} note(s)</div></div>
        <div class="actions-el"><button data-modif-saisie="${e$(s.id)}">Modifier</button><button class="danger" data-suppr-saisie="${e$(s.id)}">Supprimer</button></div></div>`).join('')}</div>`
        : '<p class="prof-vide">Aucune note saisie à la main pour cette période (évaluation sur papier, oral, comportement, travaux supplémentaires…).</p>'}
      <p class="note-prof">Les évaluations de l’application (QCM de cours, automatismes, évaluations « exercice » corrigées) comptent toutes seules, d’après la date où elles ont été passées. Un élève absent (sans copie) n’est pas pénalisé : l’évaluation ne compte pas pour lui.</p>`;
    zone.querySelector('#notes-periode').addEventListener('change', (e) => { periodes[c.id] = +e.target.value; recharger(); });
    zone.querySelector('#notes-vue-comp').addEventListener('click', () => { vueCompetences = !vueCompetences; recharger(); });
    zone.querySelector('#notes-referentiel').addEventListener('click', () => editerReferentiel(recharger));
    if (vueCompetences) await afficherCompetences(c, r.periode, zone);
    zone.querySelector('#notes-systeme').addEventListener('click', () => editerSysteme(c, sys, recharger));
    zone.querySelector('#notes-saisir').addEventListener('click', () => editerSaisie(c, r, null, recharger));
    zone.querySelector('#notes-pronote').addEventListener('click', () => { vuePronote = !vuePronote; recharger(); });
    zone.querySelector('#notes-export').addEventListener('click', async () => { const x = await E.notesExporter(c.id, r.periode.num); if (!x.annule && verifier(x)) toast('Notes exportées', `${x.fichier} (avec une feuille « Pronote » : notes /20 et coefficients)`, 'info'); });
    zone.querySelector('#notes-publier')?.addEventListener('click', async () => {
      if (!confirm(`Montrer les notes de « ${r.periode.nom} » aux élèves ?\n\nChaque élève voit sa note, le détail par partie et ton appréciation dans « 📝 Mes évaluations ». Tu pourras les mettre à jour ensuite.`)) return;
      const x = await E.notesPublier(c.id, r.periode.num, true);
      if (verifier(x)) { toast('Notes montrées aux élèves', `${x.eleves} élève(s)`, 'info'); recharger(); }
    });
    zone.querySelectorAll('[data-appr]').forEach((i) => i.addEventListener('change', async () => { const x = await E.notesAppreciation(c.id, r.periode.num, i.dataset.appr, i.value); if (verifier(x)) i.classList.add('enregistre'); }));
    zone.querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', () => detailEleve(r, r.eleves.find((x) => x.eleveId === b.dataset.detail))));
    zone.querySelectorAll('[data-modif-saisie]').forEach((b) => b.addEventListener('click', () => editerSaisie(c, r, r.saisies.find((s) => s.id === b.dataset.modifSaisie), recharger)));
    zone.querySelectorAll('[data-suppr-saisie]').forEach((b) => b.addEventListener('click', async () => {
      const s = r.saisies.find((x) => x.id === b.dataset.supprSaisie);
      if (s && confirm(`Supprimer les notes « ${s.titre} » ?`) && verifier(await E.notesSupprimerSaisie(c.id, s.id))) recharger();
    }));
  };

  // ---------- Compétences et objectifs de chaque élève ----------
  async function afficherCompetences(c, periode, zone) {
    const x = await E.notesCompetences(c.id, periode.num);
    if (!verifier(x)) return;
    const ref = x.referentiel, niv = Object.fromEntries(x.niveaux.map((n) => [n.id, n])), ordre = x.niveaux.map((n) => n.id);
    const cible = zone.querySelector('.notes-table-zone');
    // le carnet est remplacé par les deux tableaux (compétences, objectifs)
    zone.querySelectorAll('.notes-table-zone, .notes-pronote').forEach((el) => el.remove());
    const cellComp = (e, comp) => { const d = e.comp[comp.id]; if (!d || !d.n) return '<td class="num">—</td>';
      const ok = ordre.indexOf(d.niveau) >= ordre.indexOf(comp.vise);
      return `<td class="num comp-cell" style="background:${COULEURS_NIV[d.niveau]}" title="${e$(d.detail.join('\n'))}">${e$(niv[d.niveau].nom)} <small>${Math.round(d.ratio * 100)} %</small> ${ok ? '▲' : '▼'}</td>`; };
    const cellObj = (e, o) => { const d = e.obj[o.id]; if (!d || !d.n) return '<td class="num">—</td>';
      return `<td class="num obj-cell ${d.etat}" title="${e$(d.detail.join('\n'))}">${ETATS_OBJ[d.etat][0]} <small>${Math.round(d.ratio * 100)} %</small></td>`; };
    const html = `<div class="notes-table-zone"><h3 class="eval-notion">🎯 Compétences — ${e$(periode.nom)}</h3>
      <p class="note-prof">Niveau d'après les questions reliées à chaque compétence (la dernière fois qu'une question est passée compte). ▲ au niveau visé ou au-dessus, ▼ en dessous. Survole une case pour voir le détail.</p>
      <table class="eval-table notes-table"><thead><tr><th>Élève</th>${ref.competences.map((k) => `<th>${e$(k.nom)}<br><small>visé : ${e$(niv[k.vise].nom)}</small></th>`).join('')}</tr></thead><tbody>
      ${x.eleves.map((e) => `<tr><td>${e$(e.nom)}</td>${ref.competences.map((k) => cellComp(e, k)).join('')}</tr>`).join('')}
      <tr class="ligne-bilan"><td><b>Au niveau visé</b></td>${ref.competences.map((k) => { const avec = x.eleves.filter((e) => e.comp[k.id] && e.comp[k.id].n); const ok = avec.filter((e) => ordre.indexOf(e.comp[k.id].niveau) >= ordre.indexOf(k.vise)).length; return `<td class="num">${avec.length ? `<b>${ok} / ${avec.length}</b>` : '—'}</td>`; }).join('')}</tr>
      </tbody></table>
      <h3 class="eval-notion">🏁 Objectifs — ${e$(periode.nom)}</h3>
      ${ref.objectifs.length ? `<p class="note-prof">✅ atteint (70 % et plus) · ◐ en cours (40 à 70 %) · ❌ non atteint.</p>
      <div style="overflow:auto"><table class="eval-table notes-table"><thead><tr><th>Élève</th>${ref.objectifs.map((o) => `<th>${e$(o.nom)}${o.sequence ? `<br><small>${e$(o.sequence)}</small>` : ''}</th>`).join('')}</tr></thead><tbody>
      ${x.eleves.map((e) => `<tr><td>${e$(e.nom)}</td>${ref.objectifs.map((o) => cellObj(e, o)).join('')}</tr>`).join('')}
      <tr class="ligne-bilan"><td><b>Atteint</b></td>${ref.objectifs.map((o) => { const avec = x.eleves.filter((e) => e.obj[o.id] && e.obj[o.id].n); return `<td class="num">${avec.length ? `<b>${avec.filter((e) => e.obj[o.id].etat === 'atteint').length} / ${avec.length}</b>` : '—'}</td>`; }).join('')}</tr>
      </tbody></table></div>` : '<p class="prof-vide">Aucun objectif : écris tes objectifs de séquence dans 📚 Référentiel, puis relie-les aux questions (banque, évaluations « exercice », travaux à rendre).</p>'}
      <p class="note-prof">Pour qu'une question compte ici, donne-lui une compétence et/ou un objectif : dans la banque de questions, ou dans « 📐 Placer les questions » d'une évaluation « exercice » ou d'un travail à rendre (corrigé avec ✔ / ◐ / ✘).</p></div>`;
    const ancre = zone.querySelector('h3.eval-notion');
    if (ancre) ancre.insertAdjacentHTML('beforebegin', html); else zone.insertAdjacentHTML('beforeend', html);
    void cible;
  }

  // ---------- Référentiel : compétences (niveau visé) et objectifs de séquence ----------
  async function editerReferentiel(apres) {
    const x = await E.referentiel();
    if (!verifier(x)) return;
    const ref = x.referentiel, niveaux = x.niveaux;
    const dlg = fenetre('📚 Référentiel — compétences et objectifs', '<div id="ref-zone"></div>', { large: true });
    const zone = dlg.querySelector('#ref-zone');
    function dessiner() {
      zone.innerHTML = `<div class="rangee" style="margin-bottom:6px"><p class="note-prof" style="margin:0;flex:1">Ce référentiel sert pour toutes tes classes. Relie ensuite chaque question à une compétence et/ou un objectif (banque de questions, « 📐 Placer les questions »).</p>
          <button type="button" class="secondaire" id="ref-exporter" title="Classeur Excel (ou .json) : pour le garder, le modifier, le partager avec un collègue">📤 Exporter</button><button type="button" class="secondaire" id="ref-importer" title="Ajoute les compétences et objectifs d'un classeur Excel ou d'un .json (même nom : mis à jour)">📥 Importer</button></div>
        <fieldset class="eval-partie"><legend>🎯 Compétences et niveau visé</legend>
          ${ref.competences.map((k, i) => `<div class="ref-ligne"><input data-cnom="${i}" value="${e$(k.nom)}" placeholder="Nom de la compétence"><label>niveau visé <select data-cvise="${i}">${niveaux.map((n) => `<option value="${n.id}" ${k.vise === n.id ? 'selected' : ''}>${e$(n.nom)}</option>`).join('')}</select></label><button type="button" class="lien danger" data-csuppr="${i}" title="Supprimer">✕</button></div>`).join('')}
          <button type="button" class="secondaire" id="ref-ajout-comp">➕ Ajouter une compétence</button>
          <p class="note-prof">Niveaux : ${niveaux.map((n) => `${e$(n.nom)} (${Math.round(n.seuil * 100)} % et plus)`).join(' · ')}.</p></fieldset>
        <fieldset class="eval-partie"><legend>🏁 Objectifs de séquence</legend>
          ${ref.objectifs.length ? '' : '<p class="note-prof">Aucun objectif pour l’instant (ex. séquence « Fonctions du 2nd degré » : « Dresser un tableau de variations »).</p>'}
          ${ref.objectifs.map((o, i) => `<div class="ref-ligne"><input data-oseq="${i}" value="${e$(o.sequence)}" placeholder="Séquence / chapitre" style="max-width:220px"><input data-onom="${i}" value="${e$(o.nom)}" placeholder="Objectif (ex. Dresser un tableau de variations)">
            <select data-ocomp="${i}"><option value="">— compétence —</option>${ref.competences.map((k) => `<option value="${k.id}" ${o.competence === k.id ? 'selected' : ''}>${e$(k.nom)}</option>`).join('')}</select><button type="button" class="lien danger" data-osuppr="${i}" title="Supprimer">✕</button></div>`).join('')}
          <button type="button" class="secondaire" id="ref-ajout-obj">➕ Ajouter un objectif</button></fieldset>
        <p class="erreur" id="ref-erreur"></p>
        <div class="rangee"><span class="espace"></span><button class="principal" id="ref-ok">Enregistrer</button></div>`;
      zone.querySelectorAll('[data-cnom]').forEach((i) => i.addEventListener('input', () => { ref.competences[+i.dataset.cnom].nom = i.value; }));
      zone.querySelectorAll('[data-cvise]').forEach((i) => i.addEventListener('change', () => { ref.competences[+i.dataset.cvise].vise = i.value; }));
      zone.querySelectorAll('[data-csuppr]').forEach((b) => b.addEventListener('click', () => { if (confirm('Supprimer cette compétence ? Les questions qui y sont reliées ne compteront plus pour elle.')) { ref.competences.splice(+b.dataset.csuppr, 1); dessiner(); } }));
      zone.querySelectorAll('[data-oseq]').forEach((i) => i.addEventListener('input', () => { ref.objectifs[+i.dataset.oseq].sequence = i.value; }));
      zone.querySelectorAll('[data-onom]').forEach((i) => i.addEventListener('input', () => { ref.objectifs[+i.dataset.onom].nom = i.value; }));
      zone.querySelectorAll('[data-ocomp]').forEach((i) => i.addEventListener('change', () => { ref.objectifs[+i.dataset.ocomp].competence = i.value; }));
      zone.querySelectorAll('[data-osuppr]').forEach((b) => b.addEventListener('click', () => { ref.objectifs.splice(+b.dataset.osuppr, 1); dessiner(); }));
      zone.querySelector('#ref-ajout-comp').addEventListener('click', () => { ref.competences.push({ nom: '', vise: 'a' }); dessiner(); });
      zone.querySelector('#ref-ajout-obj').addEventListener('click', () => { const der = ref.objectifs[ref.objectifs.length - 1]; ref.objectifs.push({ nom: '', sequence: der ? der.sequence : '', competence: '' }); dessiner(); zone.querySelector(`[data-onom="${ref.objectifs.length - 1}"]`)?.focus(); });
      zone.querySelector('#ref-exporter').addEventListener('click', async () => {
        const y = await E.enregistrerReferentiel(ref); if (!verifier(y)) return; // ce qui est à l'écran est d'abord enregistré
        const x = await E.exporterReferentiel();
        if (!x.annule && verifier(x)) toast('Référentiel exporté', `${x.competences} compétence(s), ${x.objectifs} objectif(s) → ${x.fichier}`, 'info');
      });
      zone.querySelector('#ref-importer').addEventListener('click', async () => {
        const y = await E.enregistrerReferentiel(ref); if (!verifier(y)) return;
        const x = await E.importerReferentiel();
        if (x.annule || !verifier(x)) return;
        ref.competences = x.referentiel.competences; ref.objectifs = x.referentiel.objectifs; dessiner();
        toast('Référentiel importé', `${x.ajC} compétence(s) et ${x.ajO} objectif(s) ajouté(s)${x.majO ? `, ${x.majO} objectif(s) mis à jour` : ''}.`, 'info');
      });
      zone.querySelector('#ref-ok').addEventListener('click', async () => {
        const y = await E.enregistrerReferentiel(ref);
        if (!y.ok) { zone.querySelector('#ref-erreur').textContent = y.message; return; }
        dlg.close(); toast('Référentiel enregistré', `${y.referentiel.competences.length} compétence(s) · ${y.referentiel.objectifs.length} objectif(s)`, 'info'); apres();
      });
    }
    dessiner();
  }

  // ---------- Détail du calcul pour un élève ----------
  function detailEleve(r, x) {
    if (!x) return;
    fenetre(`📊 ${x.nom} — ${r.periode.nom}`, `
      <p class="bilan-prof">Note : <b>${fr(x.note)}/20</b>${x.max && x.max !== 20 ? ` <span class="note-prof" style="display:inline">(${fr(x.total)} / ${fr(x.max)} points)</span>` : ''}</p>
      ${r.systeme.parties.map((p) => { const d = x.parties[p.id]; return `<div class="eval-corr ${d.score === null ? '' : d.score >= p.points / 2 ? 'juste' : 'faux'}">
        <b>${e$(p.nom)} : ${fr(d.score)} / ${fr(p.points)}</b> <span class="note-prof" style="display:inline">· ${e$(REGLES[p.regle])}${p.bonus ? ` · bonus +${fr(p.bonus)}` : ''}</span>
        ${d.detail.length ? `<ul class="notes-detail">${d.detail.map((t) => `<li>${e$(t)}</li>`).join('')}</ul>` : '<p class="note-prof" style="margin:4px 0 0">Aucune évaluation pour cette partie dans la période.</p>'}</div>`; }).join('')}
      ${x.appreciation ? `<p><b>Appréciation :</b> ${e$(x.appreciation)}</p>` : ''}`, { large: true });
  }

  // ---------- Système de notation ----------
  async function editerSysteme(c, sysActuel, apres) {
    let sys = JSON.parse(JSON.stringify(sysActuel));
    const dlg = fenetre('⚙️ Système de notation — ' + c.nom, '<div id="sys-zone"></div>', { large: true });
    const zone = dlg.querySelector('#sys-zone');
    const r0 = await E.notesCalcul(c.id, 1);
    const modeles = (r0.ok && r0.modeles) || {};
    const rr = await E.referentiel();
    const refComp = rr.ok ? rr.referentiel.competences : [];
    function dessiner() {
      zone.innerHTML = `
        <p class="note-prof">Pars d’un modèle, puis règle chaque partie de la note comme tu veux. La note finale est ramenée sur 20.</p>
        <div class="rangee notes-modeles">${Object.entries(modeles).map(([k, t]) => `<button type="button" class="${sys.modele === k ? 'principal' : 'secondaire'}" data-modele="${k}">${e$(t)}</button>`).join('')}${sys.modele === 'personnel' ? '<span class="eval-badge">✏️ Personnel</span>' : ''}</div>
        <fieldset class="eval-partie"><legend>📅 Périodes</legend>
          <label class="case"><input type="radio" name="typep" value="trimestres" ${sys.typePeriodes !== 'semestres' ? 'checked' : ''}> Trimestres</label>
          <label class="case"><input type="radio" name="typep" value="semestres" ${sys.typePeriodes === 'semestres' ? 'checked' : ''}> Semestres</label>
          <div class="notes-periodes">${sys.periodes.map((p, i) => `<div><input data-pnom="${i}" value="${e$(p.nom)}"> du <input type="date" data-pdebut="${i}" value="${p.debut}"> au <input type="date" data-pfin="${i}" value="${p.fin}"></div>`).join('')}</div>
        </fieldset>
        <fieldset class="eval-partie"><legend>🧩 Parties de la note</legend>
          ${sys.parties.map((p, i) => `<div class="notes-partie" data-i="${i}">
            <div class="notes-partie-tete"><input data-f="nom" value="${e$(p.nom)}" placeholder="Nom (ex. Cours)">
              <label>sur <input type="number" data-f="points" min="0.5" max="100" step="0.5" value="${p.points}"> pts</label>
              <label>bonus <input type="number" data-f="bonus" min="0" max="20" step="0.5" value="${p.bonus}"></label>
              <button type="button" class="lien danger" data-suppr-partie="${i}" title="Supprimer cette partie">✕</button></div>
            ${p.sources.some((x) => x.type === 'competence') ? `<label>🎯 Compétence <select data-f="competence"><option value="">—</option>${(refComp || []).map((k) => `<option value="${k.id}" ${p.competence === k.id ? 'selected' : ''}>${e$(k.nom)}</option>`).join('')}</select></label>` : ''}
            <label>Règle <select data-f="regle">${Object.entries(REGLES).map(([k, t]) => `<option value="${k}" ${p.regle === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <div class="notes-sources">${Object.entries(SOURCES).map(([k, t]) => { const s = p.sources.find((x) => x.type === k);
              return `<label class="case"><input type="checkbox" data-src="${k}" ${s ? 'checked' : ''}> ${t}</label>${s && p.sources.length > 1 && p.regle !== 'somme' ? `<label class="notes-poids">poids <input type="number" data-poids="${k}" min="0" max="100" value="${s.poids}"> %</label>` : ''}`; }).join('')}</div>
          </div>`).join('')}
          <button type="button" class="secondaire" id="sys-ajouter">➕ Ajouter une partie</button>
          <p class="note-prof">Total : <b>${fr(sys.parties.reduce((t, p) => t + nb(p.points), 0))} points</b> (ramené sur 20). <b>Progression</b> : pour chaque notion, seule la dernière évaluation compte — l’élève peut rattraper. <b>Somme</b> : pour les notes saisies à la main (ex. comportement + travaux supplémentaires), additionnées puis plafonnées au maximum de la partie.</p>
        </fieldset>
        <label>Une réponse « en partie juste » (évaluation « exercice ») vaut <input type="number" id="sys-partiel" min="0" max="100" step="5" value="${Math.round(sys.partiel * 100)}"> % des points</label>
        <p class="erreur" id="sys-erreur"></p>
        <div class="rangee"><span class="espace"></span><button class="principal" id="sys-ok">Enregistrer</button></div>`;
      brancher();
    }
    const personnel = () => { if (sys.modele !== 'personnel') { sys.modele = 'personnel'; zone.querySelector('.notes-modeles').querySelectorAll('button').forEach((b) => { b.className = 'secondaire'; }); } };
    function brancher() {
      zone.querySelectorAll('[data-modele]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`Remplacer les parties de la note par le modèle « ${b.textContent} » ?`)) return;
        const m = await E.notesModele(b.dataset.modele); if (!verifier(m)) return;
        sys.parties = m.parties; sys.modele = b.dataset.modele; dessiner();
      }));
      zone.querySelectorAll('[name=typep]').forEach((x) => x.addEventListener('change', () => { sys.typePeriodes = x.value; sys.periodes = []; sys.periodesAuto = true; enregistrerBrouillon(true); }));
      zone.querySelectorAll('[data-pnom],[data-pdebut],[data-pfin]').forEach((x) => x.addEventListener('change', () => {
        const i = +(x.dataset.pnom ?? x.dataset.pdebut ?? x.dataset.pfin);
        if (x.dataset.pnom !== undefined) sys.periodes[i].nom = x.value; else if (x.dataset.pdebut !== undefined) sys.periodes[i].debut = x.value; else sys.periodes[i].fin = x.value;
      }));
      zone.querySelectorAll('.notes-partie').forEach((d) => {
        const p = sys.parties[+d.dataset.i];
        d.querySelectorAll('[data-f]').forEach((x) => x.addEventListener('change', () => { p[x.dataset.f] = ['points', 'bonus'].includes(x.dataset.f) ? nb(x.value) : x.value; personnel(); if (x.dataset.f === 'regle' || x.dataset.f === 'points') dessiner(); }));
        d.querySelectorAll('[data-src]').forEach((x) => x.addEventListener('change', () => {
          if (x.checked) p.sources.push({ type: x.dataset.src, poids: 50 }); else p.sources = p.sources.filter((s) => s.type !== x.dataset.src);
          personnel(); dessiner();
        }));
        d.querySelectorAll('[data-poids]').forEach((x) => x.addEventListener('change', () => { const s = p.sources.find((y) => y.type === x.dataset.poids); if (s) s.poids = nb(x.value); personnel(); }));
      });
      zone.querySelectorAll('[data-suppr-partie]').forEach((b) => b.addEventListener('click', () => { sys.parties.splice(+b.dataset.supprPartie, 1); personnel(); dessiner(); }));
      zone.querySelector('#sys-ajouter').addEventListener('click', () => { sys.parties.push({ nom: 'Nouvelle partie', points: 4, bonus: 0, regle: 'moyenne', sources: [{ type: 'manuel', poids: 100 }] }); personnel(); dessiner(); });
      zone.querySelector('#sys-partiel').addEventListener('change', (e) => { sys.partiel = nb(e.target.value) / 100; });
      zone.querySelector('#sys-ok').addEventListener('click', () => enregistrerBrouillon(false));
    }
    // changer trimestres / semestres : les dates par défaut sont proposées (enregistrées tout de suite pour les afficher)
    async function enregistrerBrouillon(rester) {
      const x = await E.notesSysteme(c.id, sys);
      if (!x.ok) { zone.querySelector('#sys-erreur').textContent = x.message; return; }
      sys = x.systeme;
      if (rester) { dessiner(); return; }
      dlg.close(); toast('Système de notation enregistré', '', 'info'); apres();
    }
    dessiner();
  }

  // ---------- Notes saisies à la main ----------
  async function editerSaisie(c, r, s, apres) {
    const parties = r.systeme.parties.filter((p) => p.sources.some((x) => x.type === 'manuel'));
    if (!parties.length) { toast('Aucune partie pour les notes à la main', 'Dans ⚙️ Système de notation, coche « ✍️ Notes saisies à la main » dans une partie.', 'erreur'); return; }
    const cl = await api.classes.lire(c.id);
    const eleves = ((cl && cl.eleves) || []).slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const d = s || { titre: '', date: new Date().toISOString().slice(0, 10), partie: parties[0].id, sur: 20, coef: 1, notes: {} };
    const dlg = fenetre(s ? 'Modifier des notes' : '✍️ Saisir des notes', `<form class="eval-form" id="form-saisie">
      <div class="eval-ligne3"><label>Titre <input name="titre" value="${e$(d.titre)}" placeholder="ex. Évaluation papier n°2, Oral, Comportement…" required></label>
        <label>Date <input type="date" name="date" value="${d.date}"></label></div>
      <div class="eval-ligne3"><label>Partie de la note <select name="partie">${parties.map((p) => `<option value="${p.id}" ${p.id === d.partie ? 'selected' : ''}>${e$(p.nom)} (/${fr(p.points)})</option>`).join('')}</select></label>
        <label>Noté sur <input name="sur" value="${fr(d.sur)}" size="4"></label>
        <label id="lab-compte">Compte pour <input name="comptePour" value="${d.comptePour !== undefined ? fr(d.comptePour) : ''}" size="4" placeholder="${fr(d.sur)}"> pt</label>
        <label id="lab-coef">Coefficient <input name="coef" value="${fr(d.coef)}" size="3"></label></div>
      <p class="note-prof" id="aide-saisie"></p>
      <table class="eval-table notes-saisie"><thead><tr><th>Élève</th><th>Note</th><th>Absent</th></tr></thead><tbody>
        ${eleves.map((x) => { const v = d.notes[x.id]; return `<tr><td>${e$(x.nom)}</td><td><input data-note="${e$(x.id)}" value="${v === undefined || v === 'abs' ? '' : fr(v)}" size="5" inputmode="decimal"></td><td><input type="checkbox" data-abs="${e$(x.id)}" ${v === 'abs' ? 'checked' : ''}></td></tr>`; }).join('')}
      </tbody></table>
      <p class="erreur" id="erreur-saisie"></p>
      <div class="rangee"><span class="espace"></span><button class="principal">Enregistrer</button></div></form>`, { large: true });
    const f = dlg.querySelector('#form-saisie');
    const majAide = () => {
      const p = parties.find((x) => x.id === f.partie.value);
      const somme = p && p.regle === 'somme';
      dlg.querySelector('#lab-compte').hidden = !somme; dlg.querySelector('#lab-coef').hidden = !p || p.regle !== 'moyenne';
      dlg.querySelector('#aide-saisie').textContent = !p ? '' : somme ? `« ${p.nom} » additionne les notes saisies (plafonné à ${fr(p.points)} pt) : « compte pour » dit combien de points vaut cette note (ex. travaux supplémentaires notés sur 20, qui comptent pour 2,5 pt). Une note négative est possible (ex. comportement).`
        : p.regle === 'derniere' ? `« ${p.nom} » suit la progression : la note la plus récente remplace les précédentes.` : p.regle === 'meilleure' ? `« ${p.nom} » garde la meilleure note.` : `« ${p.nom} » fait la moyenne des notes (avec les coefficients).`;
    };
    f.partie.addEventListener('change', majAide); majAide();
    dlg.querySelectorAll('[data-note]').forEach((i, k, tous) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); (tous[k + 1] || dlg.querySelector('.principal')).focus(); } }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const notes = {};
      dlg.querySelectorAll('[data-note]').forEach((i) => { const abs = dlg.querySelector(`[data-abs="${i.dataset.note}"]`).checked; if (abs) notes[i.dataset.note] = 'abs'; else if (i.value.trim() !== '') notes[i.dataset.note] = i.value.trim(); });
      const x = await E.notesSaisie(c.id, { id: d.id, titre: f.titre.value, date: f.date.value, partie: f.partie.value, sur: f.sur.value, coef: f.coef.value, comptePour: dlg.querySelector('#lab-compte').hidden ? '' : f.comptePour.value, notes });
      if (!x.ok) { dlg.querySelector('#erreur-saisie').textContent = x.message; return; }
      dlg.close(); toast('Notes enregistrées', x.saisie.titre, 'info'); apres();
    });
  }
})();
