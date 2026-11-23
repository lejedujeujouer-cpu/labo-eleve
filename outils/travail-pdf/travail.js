// Travail à rendre : un PDF de l'enseignant avec des cases à remplir.
//   ?mode=edition&classe=…&travail=…  (Labo Prof) placer les cases sur le PDF (ou reprendre celles du PDF)
//   ?mode=eleve&classe=…&travail=…    (Labo Élève) remplir les cases ; enregistrement continu + historique ; rendre
//   ?mode=suivi&classe=…&travail=…    (Labo Prof) suivre les copies en direct, l'historique et le tableau des réponses
import * as pdfjsLib from '../mes-documents/pdfjs/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '../mes-documents/pdfjs/build/pdf.worker.mjs';

const $ = (id) => document.getElementById(id);
const labo = window.parent && window.parent.labo;
const params = new URLSearchParams(location.search);
const MODE = params.get('mode') || 'eleve', CLASSE = params.get('classe'), TRAVAIL = params.get('travail');
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const heure = (iso, secondes = false) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...(secondes ? { second: '2-digit' } : {}) }) : '');
const dateHeure = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const nouvelId = () => 'c' + Math.random().toString(36).slice(2, 10);
document.body.classList.add('mode-' + MODE);

let pdf = null, travail = null;
const pages = []; // { numero, el, calque, largeur, hauteur }

// ---------- Affichage du PDF ----------
async function afficherPdf(octets) {
  pdf = await pdfjsLib.getDocument({ data: octets }).promise;
  const zone = $('pages');
  zone.innerHTML = '';
  const largeurDispo = Math.min(900, Math.max(320, $('principal').clientWidth - 70));
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const echelle = largeurDispo / base.width;
    const vue = page.getViewport({ scale: echelle * (window.devicePixelRatio || 1) });
    const el = document.createElement('div');
    el.className = 'page';
    el.style.width = largeurDispo + 'px';
    el.style.height = base.height * echelle + 'px';
    const canvas = document.createElement('canvas');
    canvas.width = vue.width; canvas.height = vue.height;
    const calque = document.createElement('div');
    calque.className = 'calque';
    calque.dataset.page = n;
    el.append(canvas, calque);
    if (pdf.numPages > 1) el.insertAdjacentHTML('beforeend', `<span class="num-page">p. ${n}</span>`);
    zone.append(el);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vue }).promise;
    pages.push({ numero: n, el, calque, largeur: largeurDispo, hauteur: base.height * echelle, page });
  }
}
const placer = (el, c) => Object.assign(el.style, { left: c.x * 100 + '%', top: c.y * 100 + '%', width: c.l * 100 + '%', height: c.h * 100 + '%' });
const taillePolice = (c) => { const p = pages[c.page - 1]; const h = p ? c.h * p.hauteur : 20; return Math.max(9, Math.min(18, (c.type === 'zone' ? 14 : h * 0.62))) + 'px'; };

// Cases déjà présentes dans un PDF « formulaire » (champs AcroForm).
async function casesDuPdf() {
  const trouvees = [];
  for (const p of pages) {
    const base = p.page.getViewport({ scale: 1 });
    for (const a of await p.page.getAnnotations()) {
      if (a.subtype !== 'Widget' || !a.rect) continue;
      const type = a.fieldType === 'Tx' ? (a.multiLine ? 'zone' : 'texte') : a.fieldType === 'Btn' && (a.checkBox || a.radioButton) ? 'case' : null;
      if (!type) continue;
      const [x1, y1, x2, y2] = base.convertToViewportRectangle(a.rect);
      trouvees.push({ id: nouvelId(), page: p.numero, x: Math.min(x1, x2) / base.width, y: Math.min(y1, y2) / base.height, l: Math.abs(x2 - x1) / base.width, h: Math.abs(y2 - y1) / base.height, type, nom: (a.alternativeText || a.fieldName || '').slice(0, 60) });
    }
  }
  return trouvees;
}

// =====================================================================================
// Mode édition (enseignant) : placer les cases
// =====================================================================================
async function modeEdition() {
  const r = await labo.prof.travailLire(CLASSE, TRAVAIL);
  if (!r.ok) throw new Error(r.message);
  travail = r.travail;
  $('titre').textContent = `Cases à remplir — ${travail.nom}`;
  $('sous-titre').textContent = `Classe ${r.classe.nom} · trace un rectangle à la souris pour ajouter une case`;
  let typeCourant = 'texte', choisi = null, modifie = false;
  let champs = travail.champs.map((c) => ({ ...c }));
  $('actions').innerHTML = `
    <span class="groupe-boutons" title="Type de la prochaine case">
      <button class="btn actif" data-type="texte">▭ Texte court</button><button class="btn" data-type="zone">▤ Zone de texte</button><button class="btn" data-type="case">☑ Case à cocher</button>
    </span>
    <input class="champ-nom" id="nom-champ" placeholder="Nom de la case choisie" disabled>
    <select class="champ-nom" id="type-champ" disabled title="Type de la case choisie" style="width:auto"><option value="texte">Texte court</option><option value="zone">Zone de texte</option><option value="case">Case à cocher</option></select>
    <button class="btn danger" id="btn-suppr-champ" disabled title="Supprimer la case choisie (touche Suppr)">Supprimer</button>
    <span class="sep"></span>
    <button class="btn" id="btn-detecter" title="Reprendre les cases d'un PDF formulaire (déjà remplissable)">🔍 Cases du PDF</button>
    <button class="btn danger" id="btn-vider">Tout effacer</button>
    <span class="etat" id="etat"></span>
    <button class="btn principal" id="btn-enregistrer">Enregistrer</button>`;
  $('info').hidden = false;
  $('info').innerHTML = '<b>Comment faire :</b> choisis le type de case, puis <b>trace un rectangle</b> sur le PDF à l\'endroit où l\'élève doit écrire (un simple clic crée une case de taille normale). Clique sur une case pour la choisir : déplace-la, agrandis-la avec le coin orange, renomme-la (ex. « Question 3 ») ou supprime-la. Pense à <b>Enregistrer</b> : les élèves voient les cases dès qu\'ils ouvrent le travail.';
  await afficherPdf(r.octets);
  if (!champs.length) {
    const auto = await casesDuPdf();
    if (auto.length) { champs = auto; modifie = true; Doc.message(`${auto.length} case${auto.length > 1 ? 's' : ''} trouvée${auto.length > 1 ? 's' : ''} dans le PDF. Vérifie-les puis enregistre.`); }
  }
  const etat = () => { $('etat').textContent = `${champs.length} case${champs.length > 1 ? 's' : ''}${modifie ? ' · non enregistré' : ' · ✓ enregistré'}`; $('etat').className = 'etat' + (modifie ? ' alerte' : ' ok'); };
  const marquer = () => { modifie = true; etat(); };
  function dessiner() {
    pages.forEach((p) => { p.calque.innerHTML = ''; });
    champs.forEach((c, i) => {
      const p = pages[c.page - 1]; if (!p) return;
      const el = document.createElement('div');
      el.className = `champ ${c.type}${choisi === c.id ? ' choisi' : ''}`;
      el.dataset.id = c.id;
      placer(el, c);
      el.innerHTML = `<span class="etiquette">${i + 1}. ${echapper(c.nom)}</span><span class="poignee"></span>`;
      p.calque.append(el);
    });
    const c = champs.find((x) => x.id === choisi);
    $('nom-champ').disabled = !c; $('btn-suppr-champ').disabled = !c; $('type-champ').disabled = !c;
    $('nom-champ').value = c ? c.nom : '';
    if (c) $('type-champ').value = c.type;
    etat();
  }
  dessiner();
  // Type de la PROCHAINE case tracée ; le type de la case choisie se change avec la liste à côté de son nom.
  document.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
    typeCourant = b.dataset.type;
    document.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('actif', x === b));
  }));
  $('type-champ').addEventListener('change', (e) => { const c = champs.find((x) => x.id === choisi); if (c) { c.type = e.target.value; marquer(); dessiner(); } });
  $('nom-champ').addEventListener('input', (e) => { const c = champs.find((x) => x.id === choisi); if (c) { c.nom = e.target.value.slice(0, 60); marquer(); const et = document.querySelector(`.champ[data-id="${c.id}"] .etiquette`); if (et) et.textContent = `${champs.indexOf(c) + 1}. ${c.nom}`; } });
  const supprimer = () => { if (!choisi) return; champs = champs.filter((x) => x.id !== choisi); choisi = null; marquer(); dessiner(); };
  $('btn-suppr-champ').addEventListener('click', supprimer);
  document.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && choisi && e.target.tagName !== 'INPUT') { e.preventDefault(); supprimer(); } });
  $('btn-vider').addEventListener('click', () => { if (champs.length && confirm('Effacer toutes les cases ?')) { champs = []; choisi = null; marquer(); dessiner(); } });
  $('btn-detecter').addEventListener('click', async () => {
    const auto = await casesDuPdf();
    if (!auto.length) return Doc.message('Ce PDF n\'a pas de cases à remplir : trace-les toi-même.', 'erreur');
    champs = [...champs, ...auto]; marquer(); dessiner();
    Doc.message(`${auto.length} case${auto.length > 1 ? 's' : ''} ajoutée${auto.length > 1 ? 's' : ''}.`);
  });
  async function enregistrer() {
    const res = await labo.prof.travailChamps(CLASSE, TRAVAIL, champs);
    if (!res.ok) return Doc.message(res.message, 'erreur');
    champs = res.champs; modifie = false; dessiner();
    Doc.message('Cases enregistrées : les élèves les voient dès qu\'ils ouvrent le travail.');
  }
  $('btn-enregistrer').addEventListener('click', enregistrer);
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); } });
  window.laboAvantFermeture = () => !modifie || confirm('Les cases ne sont pas enregistrées. Quitter quand même ?');

  // Souris : tracer, choisir, déplacer, redimensionner
  let geste = null;
  const pos = (e, p) => { const r = p.calque.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  document.getElementById('pages').addEventListener('mousedown', (e) => {
    const calque = e.target.closest('.calque'); if (!calque || e.button !== 0) return;
    e.preventDefault();
    const p = pages[+calque.dataset.page - 1];
    const elChamp = e.target.closest('.champ');
    const depart = pos(e, p);
    if (elChamp) {
      const c = champs.find((x) => x.id === elChamp.dataset.id);
      choisi = c.id;
      geste = { type: e.target.classList.contains('poignee') ? 'taille' : 'deplacer', c, depart, origine: { ...c }, p };
      dessiner();
      return;
    }
    choisi = null; dessiner();
    const rect = document.createElement('div'); rect.className = 'rectangle-trace'; calque.append(rect);
    geste = { type: 'tracer', depart, p, rect };
  });
  document.addEventListener('mousemove', (e) => {
    if (!geste) return;
    const m = pos(e, geste.p);
    if (geste.type === 'tracer') {
      Object.assign(geste.rect.style, { left: Math.min(m.x, geste.depart.x) * 100 + '%', top: Math.min(m.y, geste.depart.y) * 100 + '%', width: Math.abs(m.x - geste.depart.x) * 100 + '%', height: Math.abs(m.y - geste.depart.y) * 100 + '%' });
    } else {
      const c = geste.c, o = geste.origine;
      if (geste.type === 'deplacer') { c.x = Math.min(1 - c.l, Math.max(0, o.x + m.x - geste.depart.x)); c.y = Math.min(1 - c.h, Math.max(0, o.y + m.y - geste.depart.y)); }
      else { c.l = Math.max(0.01, Math.min(1 - c.x, o.l + m.x - geste.depart.x)); c.h = Math.max(0.008, Math.min(1 - c.y, o.h + m.y - geste.depart.y)); }
      const el = document.querySelector(`.champ[data-id="${c.id}"]`); if (el) placer(el, c);
      geste.bouge = true;
    }
  });
  document.addEventListener('mouseup', (e) => {
    if (!geste) return;
    const g = geste; geste = null;
    if (g.type === 'tracer') {
      const m = pos(e, g.p); g.rect.remove();
      let l = Math.abs(m.x - g.depart.x), h = Math.abs(m.y - g.depart.y), x = Math.min(m.x, g.depart.x), y = Math.min(m.y, g.depart.y);
      const ratio = g.p.largeur / g.p.hauteur;
      if (l < 0.012 && h < 0.008) { // simple clic : case de taille normale
        if (typeCourant === 'case') { h = 0.022; l = h / ratio; } else if (typeCourant === 'zone') { l = 0.5; h = 0.09; } else { l = 0.3; h = 0.026; }
        x = Math.min(1 - l, g.depart.x); y = Math.min(1 - h, Math.max(0, g.depart.y - h / 2));
      } else if (typeCourant === 'case') { const cote = Math.max(l * ratio, h); l = cote / ratio; h = cote; }
      const c = { id: nouvelId(), page: g.p.numero, x, y, l, h, type: typeCourant, nom: `Case ${champs.length + 1}` };
      champs.push(c); choisi = c.id; marquer(); dessiner();
    } else if (g.bouge) marquer();
  });
}

// =====================================================================================
// Mode élève : remplir, enregistrer en continu (avec l'historique), rendre
// =====================================================================================
async function modeEleve() {
  const r = await labo.classes.ouvrirTravail(CLASSE, TRAVAIL);
  if (!r.ok) throw new Error(r.message);
  travail = r.travail;
  const copie = { valeurs: { ...(r.copie && r.copie.valeurs) }, historique: [...((r.copie && r.copie.historique) || [])], rendu: (r.copie && r.copie.rendu) || null };
  $('titre').textContent = travail.nom;
  $('sous-titre').textContent = r.eleve.nom ? `Travail de ${r.eleve.nom}` : 'Travail à rendre';
  $('actions').innerHTML = `<span class="etat" id="progression"></span><span class="etat" id="etat"></span><button class="btn principal" id="btn-rendre">📤 Rendre mon travail</button>`;
  await afficherPdf(r.octets);
  if (!travail.champs.length) {
    $('info').hidden = false;
    $('info').textContent = 'Ton professeur n\'a pas encore placé les cases à remplir sur ce document. Tu peux le lire ; reviens plus tard pour le compléter.';
    $('btn-rendre').hidden = true;
    return;
  }
  const rempli = (c) => (c.type === 'case' ? copie.valeurs[c.id] === true : String(copie.valeurs[c.id] ?? '').trim() !== '');
  const majProgression = () => { const n = travail.champs.filter(rempli).length; $('progression').textContent = `${n} / ${travail.champs.length} cases remplies`; };
  function verrouiller() {
    document.querySelectorAll('.champ input, .champ textarea').forEach((x) => { x.disabled = true; });
    $('btn-rendre').hidden = true;
    $('info').hidden = false; $('info').className = 'info rendu';
    $('info').innerHTML = `✅ <b>Travail rendu</b> ${dateHeure(copie.rendu)}. Tu ne peux plus le modifier (sauf si ton professeur le rouvre).`;
  }
  // Cases
  for (const c of travail.champs) {
    const p = pages[c.page - 1]; if (!p) continue;
    const el = document.createElement('div');
    el.className = `champ ${c.type}`;
    placer(el, c);
    const entree = c.type === 'zone' ? document.createElement('textarea') : document.createElement('input');
    if (c.type === 'case') { entree.type = 'checkbox'; entree.checked = copie.valeurs[c.id] === true; }
    else { if (c.type !== 'zone') entree.type = 'text'; entree.value = copie.valeurs[c.id] ?? ''; entree.style.fontSize = taillePolice(c); entree.spellcheck = true; }
    entree.title = c.nom; entree.setAttribute('aria-label', c.nom); entree.dataset.id = c.id;
    el.append(entree);
    p.calque.append(el);
  }
  majProgression();
  // Enregistrement : quelques secondes après la dernière frappe, et à chaque fin de saisie d'une case.
  let minuterie = null, enCours = false, aRefaire = false;
  async function enregistrer() {
    clearTimeout(minuterie); minuterie = null;
    if (enCours) { aRefaire = true; return; }
    enCours = true;
    const res = await labo.classes.enregistrerTravail(CLASSE, TRAVAIL, copie);
    enCours = false;
    if (!res.ok) {
      $('etat').textContent = '⚠ ' + res.message; $('etat').className = 'etat alerte';
      if (/déjà rendu/.test(res.message)) { copie.rendu = copie.rendu || new Date().toISOString(); verrouiller(); }
    } else if (res.envoye) { $('etat').textContent = `✓ Enregistré à ${heure(res.maj)}`; $('etat').className = 'etat ok'; }
    else { $('etat').textContent = '💾 Enregistré sur ce PC (réseau coupé) : envoyé dès le retour du réseau'; $('etat').className = 'etat alerte'; }
    if (aRefaire) { aRefaire = false; enregistrer(); }
  }
  const plusTard = () => { clearTimeout(minuterie); minuterie = setTimeout(enregistrer, 2000); };
  // Historique : une ligne par modification d'une case (valeur avant → après, avec l'heure).
  const avant = new Map();
  const noter = (id, nouvelle) => {
    const ancienne = avant.has(id) ? avant.get(id) : (copie.valeurs[id] ?? '');
    if (ancienne === nouvelle) return;
    copie.historique.push({ t: new Date().toISOString(), c: id, a: ancienne, n: nouvelle });
    avant.set(id, nouvelle);
  };
  $('pages').addEventListener('focusin', (e) => { const id = e.target.dataset && e.target.dataset.id; if (id && !avant.has(id)) avant.set(id, copie.valeurs[id] ?? (e.target.type === 'checkbox' ? false : '')); });
  $('pages').addEventListener('input', (e) => {
    const id = e.target.dataset.id; if (!id) return;
    copie.valeurs[id] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.type === 'checkbox') { noter(id, e.target.checked); enregistrer(); } else plusTard();
    majProgression();
  });
  $('pages').addEventListener('focusout', (e) => {
    const id = e.target.dataset && e.target.dataset.id; if (!id || e.target.type === 'checkbox') return;
    noter(id, e.target.value); avant.delete(id);
    enregistrer();
  });
  window.addEventListener('beforeunload', () => { const a = document.activeElement; if (a && a.dataset && a.dataset.id && a.type !== 'checkbox') noter(a.dataset.id, a.value); if (minuterie || aRefaire) enregistrer(); });
  window.laboAvantFermeture = () => { const a = document.activeElement; if (a && a.dataset && a.dataset.id && a.type !== 'checkbox') { noter(a.dataset.id, a.value); enregistrer(); } return true; };
  $('btn-rendre').addEventListener('click', async () => {
    const a = document.activeElement; if (a && a.dataset && a.dataset.id && a.type !== 'checkbox') noter(a.dataset.id, a.value);
    const vides = travail.champs.filter((c) => !rempli(c)).length;
    if (!confirm(`${vides ? `Attention : ${vides} case${vides > 1 ? 's sont vides' : ' est vide'}.\n\n` : ''}Rendre ton travail à ton professeur ? Tu ne pourras plus le modifier.`)) return;
    copie.rendu = new Date().toISOString();
    copie.historique.push({ t: copie.rendu, c: '', a: '', n: '', e: 'rendu' });
    await enregistrer();
    verrouiller();
  });
  // Classe clôturée (année précédente) : la copie se lit, mais ne se modifie plus et ne se rend plus.
  if (r.lectureSeule) {
    verrouiller();
    $('info').className = 'info';
    $('info').innerHTML = `🗄 <b>Année ${echapper(r.annee || 'précédente')}</b> : cette classe est clôturée. Tu peux relire ${r.copie ? 'ta copie' : 'ce document'}${copie.rendu ? ` (rendue ${dateHeure(copie.rendu)})` : ''}, sans la modifier.`;
  } else if (copie.rendu) verrouiller();
  else { $('etat').textContent = r.copie ? `Repris là où tu en étais (${heure(r.copie.maj)})` : 'Ton travail est enregistré automatiquement.'; }
}

// =====================================================================================
// Mode suivi (enseignant) : copies en direct, historique, tableau des réponses
// =====================================================================================
async function modeSuivi() {
  const r = await labo.prof.travailLire(CLASSE, TRAVAIL);
  if (!r.ok) throw new Error(r.message);
  travail = r.travail;
  const champs = travail.champs;
  const nomChamp = (id) => { const i = champs.findIndex((c) => c.id === id); return i < 0 ? '(case supprimée)' : `${i + 1}. ${champs[i].nom}`; };
  const texteValeur = (v) => (v === true ? '☑ cochée' : v === false ? '☐ non cochée' : String(v ?? '') === '' ? '(vide)' : String(v));
  $('titre').textContent = `Suivi — ${travail.nom}`;
  $('sous-titre').textContent = `Classe ${r.classe.nom} · actualisé toutes les 5 secondes`;
  $('actions').innerHTML = '<button class="btn" id="btn-rouvrir" hidden title="Permettre à cet élève de modifier de nouveau son travail">🔓 Rouvrir sa copie</button><button class="btn" id="btn-exporter" hidden title="Créer un PDF de la copie de cet élève dans Mes documents">📄 Copie en PDF</button><span class="etat" id="etat"></span>';
  $('cote').hidden = false;
  $('onglets').hidden = false;
  $('onglets').innerHTML = '<button data-vue="copie" class="actif">📄 Copie</button><button data-vue="historique">🕑 Historique des modifications</button><button data-vue="tableau">📊 Toutes les réponses</button>';
  if (!champs.length) { $('info').hidden = false; $('info').innerHTML = 'Aucune case n\'est encore placée sur ce document : utilise d\'abord <b>Placer les cases</b>.'; }
  await afficherPdf(r.octets);
  let copies = [], choisi = null, vue = 'copie', dejaVu = new Map();
  const etatCopie = (c) => (!c.copie ? 'pas' : c.copie.rendu ? 'rendu' : 'cours');
  const nbRemplies = (cp) => champs.filter((c) => (c.type === 'case' ? cp.valeurs[c.id] === true : String(cp.valeurs[c.id] ?? '').trim() !== '')).length;
  const ilYa = (iso) => { const s = Math.round((Date.now() - Date.parse(iso)) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? `il y a ${Math.round(s / 60)} min` : heure(iso); };
  function afficherCote() {
    const n = { pas: 0, cours: 0, rendu: 0 };
    copies.forEach((c) => n[etatCopie(c)]++);
    $('cote').innerHTML = `<div class="resume"><div><b>${n.pas}</b>pas commencé</div><div><b>${n.cours}</b>en cours</div><div><b>${n.rendu}</b>rendu${n.rendu > 1 ? 's' : ''}</div></div>
      <div class="liste-eleves">${copies.map((c) => {
        const e = etatCopie(c);
        const actif = e === 'cours' && c.copie.maj && Date.now() - Date.parse(c.copie.maj) < 60_000;
        const detail = e === 'pas' ? '—' : e === 'rendu' ? `rendu ${heure(c.copie.rendu)}` : `${nbRemplies(c.copie)}/${champs.length} · ${ilYa(c.copie.maj)}`;
        return `<button data-eleve="${c.eleveId}" class="${choisi === c.eleveId ? 'choisi' : ''} ${actif ? 'actif' : ''}" title="${actif ? 'Écrit en ce moment' : ''}"><span>${e === 'pas' ? '⚪' : e === 'rendu' ? '✅' : actif ? '✏️' : '🟡'}</span><span>${echapper(c.nom)}</span><span class="detail">${detail}</span></button>`;
      }).join('') || '<p class="etat">Aucun élève dans cette classe.</p>'}</div>`;
    $('cote').querySelectorAll('[data-eleve]').forEach((b) => b.addEventListener('click', () => { choisi = b.dataset.eleve; afficherTout(); }));
  }
  function afficherCopie(recents = new Set(), montre = null) {
    const c = copies.find((x) => x.eleveId === choisi);
    pages.forEach((p) => { p.calque.innerHTML = ''; });
    if (!c) { $('info').hidden = !!champs.length ? false : $('info').hidden; if (champs.length) $('info').innerHTML = 'Choisis un élève à gauche pour voir sa copie.'; return; }
    $('info').hidden = false;
    $('info').className = 'info' + (c.copie && c.copie.rendu ? ' rendu' : '');
    $('info').innerHTML = !c.copie ? `<b>${echapper(c.nom)}</b> n'a pas encore ouvert ce travail.`
      : `<b>${echapper(c.nom)}</b> · ${nbRemplies(c.copie)}/${champs.length} cases remplies · ${c.copie.historique.filter((h) => !h.e).length} modification(s) · dernière activité ${dateHeure(c.copie.maj)}${c.copie.poste ? ` (PC ${echapper(c.copie.poste)})` : ''}${c.copie.rendu ? ` · ✅ rendu ${dateHeure(c.copie.rendu)}` : ''}`;
    for (const ch of champs) {
      const p = pages[ch.page - 1]; if (!p) continue;
      const el = document.createElement('div');
      el.className = `champ ${ch.type}${recents.has(ch.id) ? ' recent' : ''}${montre === ch.id ? ' montre' : ''}`;
      el.dataset.id = ch.id;
      placer(el, ch);
      const v = c.copie ? c.copie.valeurs[ch.id] : undefined;
      const vide = ch.type === 'case' ? v !== true : String(v ?? '').trim() === '';
      el.innerHTML = `<div class="valeur ${ch.type === 'case' ? 'case' : ''} ${vide && c.copie ? 'vide' : ''}" style="font-size:${taillePolice(ch)}" title="${echapper(ch.nom)}">${ch.type === 'case' ? (v === true ? '✔' : '') : echapper(v ?? '')}</div>`;
      p.calque.append(el);
    }
  }
  function afficherHistorique() {
    const c = copies.find((x) => x.eleveId === choisi);
    const zone = $('annexe');
    if (!c || !c.copie) { zone.innerHTML = '<p class="etat">Choisis un élève qui a commencé le travail.</p>'; return; }
    const h = [...c.copie.historique].reverse();
    zone.innerHTML = h.length ? `<ul class="historique">${h.map((x) => (x.e
      ? `<li class="evenement"><span class="heure">${heure(x.t, true)}</span><span>${x.e === 'rendu' ? '📤 Travail rendu' : '🔓 Copie rouverte par l\'enseignant'}</span><span>${dateHeure(x.t)}</span></li>`
      : `<li data-champ="${echapper(x.c)}" title="Voir la case sur la copie"><span class="heure">${heure(x.t, true)}</span><b>${echapper(nomChamp(x.c))}</b><span><span class="avant">${echapper(texteValeur(x.a))}</span> → <span class="apres">${echapper(texteValeur(x.n))}</span></span></li>`)).join('')}</ul>`
      : '<p class="etat">Aucune modification enregistrée pour l\'instant.</p>';
    zone.querySelectorAll('[data-champ]').forEach((li) => li.addEventListener('click', () => { changerVue('copie'); afficherCopie(new Set(), li.dataset.champ); const el = document.querySelector(`.champ[data-id="${li.dataset.champ}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }));
  }
  function afficherTableau() {
    const zone = $('annexe');
    zone.innerHTML = `<div class="tableau-reponses"><table><thead><tr><th>Élève</th><th>État</th>${champs.map((c, i) => `<th title="${echapper(c.nom)}">${i + 1}. ${echapper(c.nom)}</th>`).join('')}</tr></thead><tbody>
      ${copies.map((c) => `<tr><td><b>${echapper(c.nom)}</b></td><td>${etatCopie(c) === 'pas' ? '⚪' : etatCopie(c) === 'rendu' ? '✅' : '🟡'}</td>${champs.map((ch) => {
        const v = c.copie ? c.copie.valeurs[ch.id] : undefined;
        const vide = ch.type === 'case' ? v !== true : String(v ?? '').trim() === '';
        return `<td class="${vide ? 'vide' : ''}" title="${echapper(v ?? '')}">${ch.type === 'case' ? (v === true ? '✔' : '') : echapper(v ?? '')}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function changerVue(v) {
    vue = v;
    document.querySelectorAll('[data-vue]').forEach((b) => b.classList.toggle('actif', b.dataset.vue === v));
    $('pages').hidden = v !== 'copie';
    $('annexe').hidden = v === 'copie';
    $('info').hidden = v !== 'copie' || $('info').innerHTML === '';
  }
  document.querySelectorAll('[data-vue]').forEach((b) => b.addEventListener('click', () => { changerVue(b.dataset.vue); afficherTout(); }));
  function afficherTout(recents) {
    afficherCote();
    const c = copies.find((x) => x.eleveId === choisi);
    $('btn-rouvrir').hidden = !(c && c.copie && c.copie.rendu);
    $('btn-exporter').hidden = !(c && c.copie);
    if (vue === 'copie') afficherCopie(recents); else if (vue === 'historique') afficherHistorique(); else afficherTableau();
  }
  async function actualiser() {
    const res = await labo.prof.travailCopies(CLASSE, TRAVAIL);
    if (!res.ok) { $('etat').textContent = '⚠ ' + res.message; return; }
    copies = res.copies;
    // cases modifiées depuis la dernière actualisation (mises en évidence sur la copie)
    const recents = new Set();
    const c = copies.find((x) => x.eleveId === choisi);
    if (c && c.copie) {
      const vu = dejaVu.get(choisi) || 0;
      c.copie.historique.slice(vu).forEach((h) => h.c && recents.add(h.c));
      if (vu === 0) recents.clear();
      dejaVu.set(choisi, c.copie.historique.length);
    }
    $('etat').textContent = `Actualisé à ${heure(new Date().toISOString(), true)}`;
    afficherTout(recents);
  }
  $('btn-rouvrir').addEventListener('click', async () => {
    const c = copies.find((x) => x.eleveId === choisi);
    if (!c || !confirm(`Permettre à ${c.nom} de modifier de nouveau son travail ?`)) return;
    const res = await labo.prof.travailRouvrir(CLASSE, TRAVAIL, c.eleveId);
    if (!res.ok) return Doc.message(res.message, 'erreur');
    Doc.message(`La copie de ${c.nom} est rouverte.`);
    actualiser();
  });
  $('btn-exporter').addEventListener('click', async () => {
    const c = copies.find((x) => x.eleveId === choisi);
    if (!c || !c.copie) return;
    // Pages du PDF en images + réponses de l'élève par-dessus, puis impression en PDF dans Mes documents.
    const pagesHtml = pages.map((p) => {
      const img = p.el.querySelector('canvas').toDataURL('image/jpeg', 0.92);
      const cases = champs.filter((ch) => ch.page === p.numero).map((ch) => {
        const v = c.copie.valeurs[ch.id];
        const txt = ch.type === 'case' ? (v === true ? '✔' : '') : echapper(v ?? '');
        return `<div style="position:absolute;left:${ch.x * 100}%;top:${ch.y * 100}%;width:${ch.l * 100}%;height:${ch.h * 100}%;font:${ch.type === 'zone' ? '11pt' : Math.max(8, Math.min(13, ch.h * 297 * 2.3)) + 'pt'} Arial;color:#0b2b5c;white-space:pre-wrap;overflow:hidden;${ch.type === 'case' ? 'display:grid;place-items:center;font-weight:bold;' : ''}">${txt}</div>`;
      }).join('');
      return `<div style="position:relative;width:100%;page-break-after:always"><img src="${img}" style="width:100%;display:block">${cases}</div>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:0}body{margin:0}</style></head><body>${pagesHtml}</body></html>`;
    const paysage = pages[0] && pages[0].largeur > pages[0].hauteur;
    const octets = await labo.pdf.depuisHtml(html, { paysage, marges: { haut: 0, bas: 0, gauche: 0, droite: 0 } });
    if (!octets || !octets.length) return Doc.message('Impossible de créer le PDF.', 'erreur');
    try { const nom = await Doc.enregistrer(`${travail.nom} - ${c.nom}.pdf`, octets, true); Doc.message(`Copie enregistrée dans Mes documents : ${nom}`); } catch (e) { Doc.message(e.message, 'erreur'); }
  });
  await actualiser();
  if (!choisi) { const premier = copies.find((c) => c.copie) || copies[0]; if (premier) { choisi = premier.eleveId; dejaVu.set(choisi, premier.copie ? premier.copie.historique.length : 0); afficherTout(); } }
  setInterval(actualiser, 5000);
}

// ---------- Format des évaluations « exercice » ----------
// Un travail sans anciennes cases (nouveau travail) s'ouvre dans l'outil d'évaluation : questions agrandies, réponses écrites sur la feuille.
async function versFormatExercice() {
  const r = MODE === 'eleve' ? await labo.classes.ouvrirTravail(CLASSE, TRAVAIL) : await labo.prof.travailLire(CLASSE, TRAVAIL);
  if (!r.ok || (r.travail.champs || []).length) return false; // ancien travail (cases) : on garde cet outil
  location.replace(`../evaluation-maths/index.html?${new URLSearchParams({ v: params.get('v') || '', mode: 'travail-' + MODE, classe: CLASSE, travail: TRAVAIL })}`);
  return true;
}

// ---------- Démarrage ----------
(async () => {
  try {
    if (!labo) throw new Error('Ouvre ce travail depuis Labo Élève ou Labo Prof.');
    if (!CLASSE || !TRAVAIL) throw new Error('Travail introuvable.');
    if (await versFormatExercice()) return;
    if (MODE === 'edition') await modeEdition();
    else if (MODE === 'suivi') await modeSuivi();
    else await modeEleve();
  } catch (e) {
    $('pages').innerHTML = `<p class="erreur-chargement">⚠ ${echapper(e.message || e)}</p>`;
  }
})();
window.laboTravail = { mode: MODE, pages, get travail() { return travail; } }; // pour les tests
