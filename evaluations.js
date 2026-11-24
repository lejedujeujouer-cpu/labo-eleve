// Évaluations de mathématiques (QCM « Cours » + calculs « Automatismes »), adaptées aux erreurs passées de chaque élève.
//
// Côté enseignant (Labo Prof), tout ce qui contient les réponses reste SUR SON PC (dossier de l'application) :
//   evaluations/banque.json       questions par notion (bonnes réponses, formules)
//   evaluations/evaluations.json  évaluations préparées
//   evaluations/historique.json   résultats passés de chaque élève, par notion et par question
//   evaluations/sessions/<id>.json  évaluation lancée : le sujet de chaque élève AVEC son corrigé
// Dans le dossier partagé, Classes/<classe>/evaluations/<session>/ :
//   session.json (titre, début, durée…), sujets/<élève>.json (énoncés SANS réponses),
//   copies/<élève>.json (écrites par l'élève), corrections/<élève>.json (écrites par Labo Prof quand c'est le moment).
// Labo Prof corrige lui-même les copies (toutes les quelques secondes pendant l'évaluation).
// Évaluation « exercice » (modele: 'exercice') : un PDF de l'enseignant (evaluations/pdfs/), une zone tracée par question ;
// l'élève écrit sa réponse ligne par ligne (texte ou écriture mathématique) ; l'enseignant corrige à la main
// (juste / en partie / faux + commentaire), puis rend les corrections. Dans le dossier partagé : exercice.pdf en plus.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { evaluer, lireNombre } = require('./commun/calcul-sur');
const { lireClasseur, ecrireClasseur } = require('./classeur-xlsx');

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const texte = (t, max) => String(t ?? '').replace(/\r/g, '').trim().slice(0, max);
const nouvelId = (p) => `${p}-${crypto.randomBytes(4).toString('hex')}`;
const melanger = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function lireJson(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }
function ecrireJson(f, v) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(v));
  fs.renameSync(tmp, f);
}

// ---------- Questions ----------
// Une question appartient à un CHAPITRE (dossier de la banque) et à une PARTIE :
//   - « cours » : questions de cours (QCM le plus souvent) ;
//   - « automatisme » : rangées par automatisme (notion = nom de l'automatisme, ex. « Coefficient multiplicateur »).
// Format de réponse (type) : « qcm » (réponses proposées) ou « calcul » (un nombre ; formule et nombres au hasard facultatifs).
// image : une illustration facultative (fichier de la banque, nommé par son empreinte).
const IMAGE = /^[0-9a-f]{16}\.(png|jpe?g|gif|webp|svg)$/;
const cle = (q) => `${q.chapitre} › ${q.notion}`;
function migrer(q) { // anciennes questions (avant les chapitres)
  if (!q.chapitre) q.chapitre = q.notion;
  if (!q.partie) q.partie = q.type === 'qcm' ? 'cours' : 'automatisme';
  return q;
}
function questionValide(q) {
  const type = q.type === 'calcul' ? 'calcul' : q.type === 'qcm' ? 'qcm' : null;
  if (!type) throw new Error('Type de question inconnu.');
  const partie = q.partie === 'cours' || q.partie === 'automatisme' ? q.partie : type === 'qcm' ? 'cours' : 'automatisme';
  const chapitre = texte(q.chapitre, 80) || texte(q.notion, 60);
  const r = { id: ID.test(q.id || '') ? q.id : nouvelId('q'), type, partie, chapitre, notion: texte(q.notion, 60) || chapitre, enonce: texte(q.enonce, 2000), modifie: new Date().toISOString() };
  if (texte(q.niveau, 30)) r.niveau = texte(q.niveau, 30);
  Object.assign(r, etiquettes(q)); // compétence, objectif, points
  if (texte(q.explication, 1500)) r.explication = texte(q.explication, 1500); // montrée à l'élève dans la correction
  if (q.image) { if (!IMAGE.test(q.image)) throw new Error('Image invalide.'); r.image = q.image; }
  if (!r.chapitre) throw new Error('Indique le chapitre (ex. Chapitre 1 : Statistique).');
  if (!r.enonce) throw new Error('Écris la question.');
  if (type === 'qcm') {
    r.choix = (Array.isArray(q.choix) ? q.choix : []).map((c) => {
      const x = { texte: texte(c.texte, 300), juste: !!c.juste };
      if (c.image) { if (!IMAGE.test(c.image)) throw new Error('Image de réponse invalide.'); x.image = c.image; }
      return x;
    }).filter((c) => c.texte || c.image).slice(0, 8);
    if (r.choix.length < 2) throw new Error('Un QCM a au moins deux réponses proposées.');
    if (!r.choix.some((c) => c.juste)) throw new Error('Coche au moins une bonne réponse.');
  } else {
    r.variables = (Array.isArray(q.variables) ? q.variables : []).map((v) => ({ nom: texte(v.nom, 12).toLowerCase(), min: Number(v.min), max: Number(v.max), pas: Number(v.pas) || 1 }))
      .filter((v) => v.nom).slice(0, 8);
    for (const v of r.variables) {
      if (!/^[a-z][a-z0-9_]*$/.test(v.nom) || ['pi', 'racine', 'sqrt', 'abs', 'arrondi', 'round', 'cos', 'sin', 'tan'].includes(v.nom)) throw new Error(`Nom de variable invalide : « ${v.nom} » (une lettre, ex. a).`);
      if (!Number.isFinite(v.min) || !Number.isFinite(v.max) || v.max < v.min || !(v.pas > 0)) throw new Error(`Valeurs de « ${v.nom} » invalides (min ≤ max, pas > 0).`);
      if ((v.max - v.min) / v.pas > 100000) throw new Error(`Trop de valeurs possibles pour « ${v.nom} ».`);
    }
    r.reponse = texte(q.reponse, 300);
    if (!r.reponse) throw new Error('Indique la réponse attendue (un nombre, ou une formule comme a*b/100).');
    r.tolerance = Math.max(0, Number(String(q.tolerance ?? '').replace(',', '.')) || 0);
    r.unite = texte(q.unite, 20);
    instancier(r); // vérifie que la réponse se calcule
  }
  return r;
}
const decimales = (x) => { const s = String(x); return s.includes('.') ? s.split('.')[1].length : 0; };
function tirerValeurs(q) {
  const v = {};
  for (const x of q.variables || []) {
    const n = Math.floor((x.max - x.min) / x.pas + 1e-9);
    v[x.nom] = Number((x.min + x.pas * crypto.randomInt(n + 1)).toFixed(Math.max(decimales(x.pas), decimales(x.min))));
  }
  return v;
}
const fr = (x) => Number(x).toLocaleString('fr-FR', { maximumFractionDigits: 6 });
// Remplace {a} par la valeur de a, et {= expression} par son résultat.
function remplir(enonce, valeurs) {
  return enonce.replace(/\{\s*=\s*([^}]+)\}/g, (_m, e) => { try { return fr(evaluer(e, valeurs)); } catch { return '?'; } })
    .replace(/\{\s*([a-z][a-z0-9_]*)\s*\}/gi, (m, n) => (Object.prototype.hasOwnProperty.call(valeurs, n.toLowerCase()) ? fr(valeurs[n.toLowerCase()]) : m));
}
// Une question « jouable » : énoncé avec ses nombres, et son corrigé.
function instancier(q) {
  migrer(q);
  const commun = { qid: q.id, notion: q.notion, chapitre: q.chapitre, partie: q.partie, cle: cle(q), image: q.image || null, explication: q.explication || '', ...etiquettes(q) };
  if (q.type === 'qcm') {
    const ordre = melanger(q.choix.map((_c, i) => i));
    const choixImages = ordre.map((i) => q.choix[i].image || null);
    return { ...commun, type: 'qcm', enonce: q.enonce, choix: ordre.map((i, k) => q.choix[i].texte || `image ${'ABCDEFGH'[k]}`), ...(choixImages.some(Boolean) ? { choixImages } : {}), justes: ordre.map((i, k) => (q.choix[i].juste ? k : -1)).filter((k) => k >= 0) };
  }
  let essais = 0, valeurs, attendu;
  do { // évite une division par zéro ou un résultat impossible
    valeurs = tirerValeurs(q);
    try { attendu = evaluer(q.reponse, valeurs); } catch (e) { if (++essais > 30) throw new Error(`La réponse attendue ne se calcule pas : ${e.message}`); attendu = null; }
  } while (attendu === null);
  return { ...commun, explication: q.explication ? remplir(q.explication, valeurs) : '', type: 'calcul', enonce: remplir(q.enonce, valeurs), valeurs, attendu, tolerance: q.tolerance || 0, unite: q.unite || '' };
}
const pourEleve = (x, n) => ({ n, type: x.type, partie: x.partie || (x.type === 'qcm' ? 'cours' : 'automatisme'), notion: x.notion, enonce: x.enonce, image: x.image || null,
  ...(x.type === 'qcm' ? { choix: x.choix, ...(x.choixImages ? { choixImages: x.choixImages } : {}), multiple: x.justes.length > 1 } : { unite: x.unite }) });
// Le nombre que l'élève a voulu donner : « 6 », « 6,0 », « 3/4 », « Cela vaut 6,0 », « 2x = 12 donc x = 6 », « 1 250 € ».
function nombreDeLaReponse(rep) {
  const direct = lireNombre(rep);
  if (direct !== null) return direct;
  let t = String(rep ?? '').replace(/[−–]/g, '-').replace(/(\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g, '$1');
  const i = t.lastIndexOf('=');
  if (i >= 0) t = t.slice(i + 1); // le résultat est après le dernier « = »
  const nb = '(-?\\d+(?:[.,]\\d+)?)';
  const fractions = [...t.matchAll(new RegExp(nb + '\\s*/\\s*' + nb, 'g'))];
  const lire = (s) => Number(s.replace(',', '.'));
  if (fractions.length) { const f = fractions[fractions.length - 1]; if (lire(f[2]) !== 0) return lire(f[1]) / lire(f[2]); }
  const nombres = [...t.matchAll(new RegExp(nb, 'g'))];
  return nombres.length ? lire(nombres[nombres.length - 1][1]) : null;
}
function estJuste(x, rep) {
  if (rep === undefined || rep === null || rep === '') return false;
  if (x.type === 'qcm') {
    const r = (Array.isArray(rep) ? rep : [rep]).map(Number).sort();
    return r.length === x.justes.length && r.every((v, i) => v === [...x.justes].sort()[i]);
  }
  const v = nombreDeLaReponse(rep);
  return v !== null && Math.abs(v - x.attendu) <= (x.tolerance || 0) + 1e-9;
}
const texteReponse = (x, rep) => (rep === 'jsp' ? 'Je ne sais pas' : x.type === 'qcm'
  ? (Array.isArray(rep) ? rep : rep === undefined || rep === null ? [] : [rep]).map((i) => x.choix[i]).filter(Boolean).join(' ; ') || '(pas de réponse)'
  : rep === undefined || rep === null || rep === '' ? '(pas de réponse)' : `${rep}${x.unite ? ' ' + x.unite : ''}`);
const texteAttendu = (x) => (x.type === 'qcm' ? x.justes.map((i) => x.choix[i]).join(' ; ') : `${fr(x.attendu)}${x.unite ? ' ' + x.unite : ''}`);

// ---------- Choix adapté : les erreurs passées reviennent en priorité ----------
function poids(q, h) {
  const n = (h && h.notions && (h.notions[cle(migrer(q))] || h.notions[q.notion])) || [];
  const recents = n.slice(-6);
  const tauxErreur = recents.length ? recents.filter((x) => !x).length / recents.length : 0;
  let p = 1 + 4 * tauxErreur;
  const derniere = h && h.questions ? h.questions[q.id] : undefined;
  if (derniere === false) p += 3; // ratée la dernière fois : elle revient (avec d'autres nombres)
  if (derniere === true) p *= 0.5; // réussie : moins souvent
  return p;
}
function tirerQuestions(pool, nombre, h) {
  const reste = [...pool], choisies = [];
  while (choisies.length < nombre && reste.length) {
    const ps = reste.map((q) => poids(q, h)), total = ps.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, k = 0;
    while (k < ps.length - 1 && (r -= ps[k]) > 0) k++;
    choisies.push(reste.splice(k, 1)[0]);
  }
  return choisies;
}

// ---------- Banque ⇄ fichiers (Excel, .zip avec images, .json) ----------
// Colonnes reconnues (une ligne par question, l'ordre et les majuscules n'ont pas d'importance) :
//   Chapitre | Partie (Cours / Automatisme) | Automatisme (ou Notion) | Question | Image (nom du fichier)
//   QCM : ChoixA … ChoixH | ReponseCorrecte (a, c ou « a;c »)
//   Nombre : Reponse (un nombre, ou une formule avec les variables) | Unite | Tolerance | Variables (« a=5..50:5 ; b=20..200:10 »)
//   Niveau (facultatif)
const norme = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const COLS = {
  chapitre: ['chapitre', 'theme', 'thematique', 'dossier', 'sequence'],
  partie: ['partie', 'section', 'categorie', 'typedequestion'],
  notion: ['automatisme', 'notion', 'souschapitre', 'competence', 'capacite', 'savoirfaire'],
  question: ['question', 'enonce', 'intitule', 'consigne'],
  image: ['image', 'illustration', 'figure', 'photo', 'schema'],
  correcte: ['reponsecorrecte', 'reponsescorrectes', 'bonnereponse', 'bonnesreponses', 'correct', 'correcte', 'solution', 'reponsejuste', 'juste'],
  niveau: ['niveau', 'classe'],
  variables: ['variables', 'nombres', 'parametres', 'valeurs'],
  reponse: ['reponse', 'formule', 'resultat', 'reponseattendue', 'calcul'],
  tolerance: ['tolerance', 'precision'],
  unite: ['unite', 'unites'],
  explication: ['explication', 'explications', 'correction', 'corrige', 'justification', 'methode', 'aide'],
};
const nombreFr = (t) => Number(String(t).replace(',', '.'));
function lireVariables(t) {
  if (Array.isArray(t)) return t;
  return String(t || '').split(/[;\n]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^([a-z][a-z0-9_]*)\s*[=:]\s*(-?[\d.,]+)\s*(?:\.\.|à|->|→)\s*(-?[\d.,]+)(?:\s*(?:pas|par pas de|par|:|\/)\s*([\d.,]+))?$/i.exec(x);
    if (!m) throw new Error(`variable « ${x} » non comprise (écris par ex. a=5..50:5)`);
    return { nom: m[1].toLowerCase(), min: nombreFr(m[2]), max: nombreFr(m[3]), pas: m[4] ? nombreFr(m[4]) : 1 };
  });
}
const lirePartie = (t, defaut) => { const n = norme(t); return n.startsWith('auto') ? 'automatisme' : n.startsWith('cours') || n.startsWith('qcm') ? 'cours' : defaut; };
// Une question décrite « à plat » (ligne d'Excel ou objet JSON) → question de la banque.
// image(nom) : renvoie le nom de l'image enregistrée dans la banque (ou lève une erreur si le fichier manque).
function depuisLigne(o, { feuille = '', image = null } = {}) {
  const defautPartie = /auto|calcul/i.test(feuille) ? 'automatisme' : null;
  const base = { chapitre: String(o.chapitre || '').trim() || feuille, notion: String(o.notion || o.automatisme || '').trim(), enonce: String(o.question || o.enonce || '').trim(), niveau: String(o.niveau || '').trim(), explication: String(o.explication || '').trim() };
  // compétence (id ou nom : S’approprier, Analyser, Réaliser, Valider, Communiquer) et points (facultatifs)
  const COMP_NOMS = { app: 'app', sapproprier: 'app', approprier: 'app', ana: 'ana', analyser: 'ana', analyserraisonner: 'ana', raisonner: 'ana', rea: 'rea', realiser: 'rea', val: 'val', valider: 'val', com: 'com', communiquer: 'com' };
  const cp = norme(o.competence || ''); if (COMP_NOMS[cp]) base.competence = COMP_NOMS[cp];
  if (o.points !== undefined && String(o.points).trim() !== '') base.points = o.points;
  if (!base.enonce) throw new Error('pas de question');
  if (o.image) base.image = image ? image(String(o.image).trim()) : undefined;
  const img = (n) => (n && image ? image(String(n).trim()) : undefined);
  const choix = Array.isArray(o.choix) ? o.choix.map((c, i) => (typeof c === 'string' ? { lettre: 'abcdefgh'[i], texte: c } : { lettre: 'abcdefgh'[i], texte: String(c.texte || ''), juste: c.juste, image: img(c.image) }))
    : 'abcdefgh'.split('').map((l) => ({ lettre: l, texte: String(o['choix' + l] ?? '').trim(), image: img(o['image' + l]) }));
  const textesChoix = choix.filter((x) => String(x.texte).trim() || x.image);
  if (textesChoix.length >= 2) {
    let justes;
    if (textesChoix.some((x) => x.juste !== undefined)) justes = textesChoix.filter((x) => x.juste).map((x) => x.lettre);
    else {
      const brut = String(o.correcte ?? o.reponsecorrecte ?? o.bonnereponse ?? '').trim();
      justes = brut.toLowerCase().split(/[\s,;/+&]+|\bet\b/).filter(Boolean);
      if (!justes.length || !justes.every((x) => /^[a-h]$/.test(x))) { const n = norme(brut); justes = textesChoix.filter((x) => norme(x.texte) === n).map((x) => x.lettre); }
      if (!justes.length) throw new Error(`bonne réponse « ${brut} » non reconnue (écris la lettre : a, b, c ou d)`);
    }
    return questionValide({ ...base, partie: lirePartie(o.partie, defautPartie || 'cours'), type: 'qcm', choix: textesChoix.map((x) => ({ texte: x.texte, juste: justes.includes(x.lettre), ...(x.image ? { image: x.image } : {}) })) });
  }
  if (String(o.reponse ?? '').trim() !== '') {
    return questionValide({ ...base, partie: lirePartie(o.partie, 'automatisme'), type: 'calcul', variables: lireVariables(o.variables), reponse: String(o.reponse).trim(), tolerance: o.tolerance || 0, unite: String(o.unite || '').trim() });
  }
  throw new Error('ni réponses proposées (QCM) ni réponse attendue (nombre)');
}
function questionsDuClasseur(feuilles, image = null) {
  const questions = [], ignorees = [];
  for (const f of feuilles) {
    const iEntete = f.lignes.findIndex((l) => l.some((c) => COLS.question.includes(norme(c))));
    if (iEntete < 0) continue;
    const entete = f.lignes[iEntete].map(norme);
    const c = Object.fromEntries(Object.keys(COLS).map((k) => [k, entete.findIndex((h) => COLS[k].includes(h))]));
    const choix = entete.map((h, i) => { const m = /^(?:choix|proposition)?([a-h])$/.exec(h); return m ? { lettre: m[1], i } : null; }).filter(Boolean);
    for (let r = iEntete + 1; r < f.lignes.length; r++) {
      const l = f.lignes[r];
      const v = (i) => (i >= 0 && l[i] !== undefined ? String(l[i]).trim() : '');
      if (!l.some((x) => String(x).trim())) continue;
      try {
        const o = Object.fromEntries(Object.keys(COLS).map((k) => [k, v(c[k])]));
        for (const x of choix) o['choix' + x.lettre] = v(x.i);
        entete.forEach((h, i) => { const m = /^image([a-h])$/.exec(h); if (m) o['image' + m[1]] = v(i); });
        questions.push(depuisLigne(o, { feuille: f.nom, image }));
      } catch (e) { ignorees.push({ ligne: `${f.nom}, ligne ${r + 1}`, raison: e.message }); }
    }
  }
  return { questions, ignorees };
}
function questionsDuJson(texteJson, image = null) {
  let d;
  try { d = JSON.parse(texteJson); } catch { throw new Error('Le fichier JSON est illisible.'); }
  const liste = Array.isArray(d) ? d : d && Array.isArray(d.questions) ? d.questions : null;
  if (!liste) throw new Error('Le fichier JSON doit contenir une liste « questions ».');
  const questions = [], ignorees = [];
  liste.forEach((o, i) => {
    try {
      const p = Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [norme(k), v]));
      if (Array.isArray(o.choix)) p.choix = o.choix;
      if (Array.isArray(o.variables)) p.variables = o.variables;
      questions.push(depuisLigne(p, { image }));
    } catch (e) { ignorees.push({ ligne: `question n° ${i + 1}`, raison: e.message }); }
  });
  return { questions, ignorees };
}
function feuillesDeLaBanque(questions) {
  questions = questions.map(migrer);
  const qcm = questions.filter((q) => q.type === 'qcm'), nb = questions.filter((q) => q.type === 'calcul');
  const n = Math.max(4, ...qcm.map((q) => q.choix.length));
  const L = 'ABCDEFGH'.slice(0, n).split('');
  const partie = (q) => (q.partie === 'automatisme' ? 'Automatisme' : 'Cours');
  const notion = (q) => (q.notion !== q.chapitre ? q.notion : '');
  return [
    { nom: 'QCM', largeurs: [30, 12, 26, 60, 18, ...L.map(() => 26), 16, 10],
      lignes: [['Chapitre', 'Partie', 'Automatisme', 'Question', 'Image', ...L.map((x) => 'Choix' + x), 'ReponseCorrecte', 'Niveau', ...L.map((x) => 'Image' + x), 'Explication'],
        ...qcm.map((q) => [q.chapitre, partie(q), notion(q), q.enonce, q.image || '', ...L.map((_x, i) => (q.choix[i] ? q.choix[i].texte : '')), q.choix.map((x, i) => (x.juste ? 'abcdefgh'[i] : '')).filter(Boolean).join(';'), q.niveau || '', ...L.map((_x, i) => (q.choix[i] && q.choix[i].image) || ''), q.explication || ''])] },
    { nom: 'Automatismes', largeurs: [30, 12, 26, 60, 18, 18, 8, 10, 34, 10],
      lignes: [['Chapitre', 'Partie', 'Automatisme', 'Question', 'Image', 'Reponse', 'Unite', 'Tolerance', 'Variables', 'Niveau', 'Explication'],
        ...nb.map((q) => [q.chapitre, partie(q), notion(q), q.enonce, q.image || '', q.reponse, q.unite || '', q.tolerance || 0, q.variables.map((x) => `${x.nom}=${x.min}..${x.max}:${x.pas}`).join(' ; '), q.niveau || '', q.explication || ''])] },
    { nom: 'Aide', largeurs: [120], lignes: [['Comment remplir ce classeur (une ligne = une question)'],
      ['Chapitre : le dossier de la banque (ex. « Chapitre 1 : Statistique »). Partie : Cours ou Automatisme. Automatisme : le nom de l’automatisme (ex. « Coefficient multiplicateur »).'],
      ['Feuille QCM : ChoixA à ChoixD (jusqu’à H) et ReponseCorrecte = la lettre de la bonne réponse (a, b, c ou d), ou plusieurs lettres séparées par ; (ex. a;c).'],
      ['Feuille Automatismes : Reponse = le nombre attendu (ex. 1,25). Unite et Tolerance (écart accepté, ex. 0,01) sont facultatives.'],
      ['Nombres au hasard (facultatif) : dans la question, {a} est remplacé par un nombre tiré au hasard ; Variables : a=5..50:5 (« de 5 à 50 par pas de 5 ») ; Reponse : une formule (ex. a*b/100).'],
      ['Image (facultatif) : le nom du fichier (ex. graphique1.png). Pour un QCM, ImageA à ImageD mettent une image dans les réponses (la réponse peut alors n’avoir que l’image). Mets le classeur et les images dans un même dossier compressé (.zip) et importe le .zip.'],
      ['Explication (facultatif) : la méthode ou la correction, montrée à l’élève à côté de la bonne réponse ({a} y est aussi remplacé par le nombre tiré au hasard).'],
      ['Niveau : facultatif (ex. 2nde, 1re, TMSPC). Une question déjà dans la banque (même chapitre, même question) est mise à jour au lieu d’être ajoutée deux fois.']] },
  ];
}

// ---------- Exemples pour démarrer ----------
const C1 = 'Chapitre 1 : Proportionnalité et pourcentages', C2 = 'Chapitre 2 : Calcul numérique';
const EXEMPLES = [
  { chapitre: C1, partie: 'cours', type: 'qcm', notion: 'Proportionnalité', enonce: 'Un tableau est de proportionnalité si…', choix: [{ texte: 'on passe d\'une ligne à l\'autre en multipliant toujours par le même nombre', juste: true }, { texte: 'les nombres augmentent', juste: false }, { texte: 'on ajoute toujours le même nombre', juste: false }], explication: "Dans un tableau de proportionnalité, on passe d'une ligne à l'autre en multipliant toujours par le même nombre : le coefficient de proportionnalité.\nAjouter toujours le même nombre, ou avoir des nombres qui augmentent, ne suffit pas." },
  { chapitre: C1, partie: 'cours', type: 'qcm', notion: 'Pourcentages', enonce: 'Augmenter un prix de 20 %, c\'est le multiplier par…', choix: [{ texte: '1,2', juste: true }, { texte: '0,2', juste: false }, { texte: '20', juste: false }, { texte: '0,8', juste: false }], explication: "Augmenter de 20 %, c'est garder 100 % du prix et ajouter 20 % : 100 % + 20 % = 120 % = 1,2.\nOn multiplie donc par 1,2.\n(Multiplier par 0,8 correspond à une baisse de 20 %.)" },
  { chapitre: C1, partie: 'automatisme', type: 'calcul', notion: 'Coefficient multiplicateur', enonce: 'Une hausse de {a} % correspond à un coefficient multiplicateur de…', variables: [{ nom: 'a', min: 5, max: 60, pas: 5 }], reponse: '1+a/100', tolerance: 0, explication: "Pour une hausse de t %, le coefficient multiplicateur est 1 + t/100.\nIci : 1 + {a}/100 = {=1+a/100}." },
  { chapitre: C1, partie: 'automatisme', type: 'calcul', notion: 'Coefficient multiplicateur', enonce: 'Une baisse de {a} % correspond à un coefficient multiplicateur de…', variables: [{ nom: 'a', min: 5, max: 60, pas: 5 }], reponse: '1-a/100', tolerance: 0, explication: "Pour une baisse de t %, le coefficient multiplicateur est 1 − t/100.\nIci : 1 − {a}/100 = {=1-a/100}." },
  { chapitre: C1, partie: 'automatisme', type: 'qcm', notion: 'Coefficient multiplicateur', enonce: 'Multiplier par 0,7, c\'est…', choix: [{ texte: 'baisser de 30 %', juste: true }, { texte: 'baisser de 70 %', juste: false }, { texte: 'augmenter de 70 %', juste: false }, { texte: 'baisser de 0,7 %', juste: false }], explication: "0,7 = 70 % : on garde 70 % de la valeur, donc on enlève 30 %.\nMultiplier par 0,7, c'est baisser de 30 %." },
  { chapitre: C1, partie: 'automatisme', type: 'calcul', notion: 'Pourcentage d\'une quantité', enonce: 'Calcule {a} % de {b} €.', variables: [{ nom: 'a', min: 5, max: 50, pas: 5 }, { nom: 'b', min: 20, max: 200, pas: 10 }], reponse: 'a*b/100', tolerance: 0.01, unite: '€', explication: '{a} % de {b} € : {a} × {b} / 100 = {=a*b/100} €.' },
  { chapitre: C1, partie: 'automatisme', type: 'calcul', notion: 'Proportionnalité', enonce: '{a} kg de pommes coûtent {=a*p} €. Combien coûtent {c} kg ?', variables: [{ nom: 'a', min: 2, max: 5, pas: 1 }, { nom: 'p', min: 1.5, max: 3, pas: 0.5 }, { nom: 'c', min: 6, max: 10, pas: 1 }], reponse: 'c*p', tolerance: 0.01, unite: '€', explication: "On cherche d'abord le prix d'un kilo : {=a*p} ÷ {a} = {p} €.\nPour {c} kg : {c} × {p} = {=c*p} €." },
  { chapitre: C2, partie: 'cours', type: 'qcm', notion: 'Fractions', enonce: 'Quelles écritures sont égales à 1/2 ?', choix: [{ texte: '0,5', juste: true }, { texte: '2/4', juste: true }, { texte: '1,2', juste: false }, { texte: '50 %', juste: true }], explication: "1/2 = 1 ÷ 2 = 0,5 = 50 %.\nEt 2/4 se simplifie par 2 : 2/4 = 1/2.\nEn revanche 1,2 n'est pas égal à 0,5." },
  { chapitre: C2, partie: 'automatisme', type: 'calcul', notion: 'Fraction d\'une quantité', enonce: 'Calcule {a}/{b} de {=b*k}.', variables: [{ nom: 'a', min: 1, max: 4, pas: 1 }, { nom: 'b', min: 5, max: 8, pas: 1 }, { nom: 'k', min: 2, max: 9, pas: 1 }], reponse: 'a*k', tolerance: 0, explication: "{a}/{b} de {=b*k} : on divise par {b}, puis on multiplie par {a}. {=b*k} ÷ {b} = {k}, puis {k} × {a} = {=a*k}." },
  { chapitre: C2, partie: 'automatisme', type: 'calcul', notion: 'Équations', enonce: 'Résous : {a}x + {b} = {=a*s+b}. Donne la valeur de x.', variables: [{ nom: 'a', min: 2, max: 9, pas: 1 }, { nom: 'b', min: 1, max: 20, pas: 1 }, { nom: 's', min: 1, max: 10, pas: 1 }], reponse: 's', tolerance: 0, explication: "On enlève {b} des deux côtés : {a}x = {=a*s}.\nPuis on divise par {a} : x = {=a*s}/{a} = {s}." },
];

// ---------- Référentiel de l'enseignant : compétences (avec un niveau visé) et objectifs de séquence ----------
// Chaque question (banque, évaluation « exercice », travail à rendre) peut porter une compétence, un objectif et des points.
const ID_REF = /^[a-z0-9-]{1,16}$/;
const NIVEAUX_COMP = [['na', 'Non acquis', 0], ['ec', 'En cours', 0.4], ['a', 'Acquis', 0.6], ['m', 'Maîtrisé', 0.8]];
const niveauDe = (ratio) => (ratio === null || ratio === undefined ? null : [...NIVEAUX_COMP].reverse().find((n) => ratio >= n[2] - 1e-9)[0]);
const etatObjectif = (ratio) => (ratio === null || ratio === undefined ? null : ratio >= 0.7 ? 'atteint' : ratio >= 0.4 ? 'en-cours' : 'non-atteint');
const REFERENTIEL_DEFAUT = { competences: [
  { id: 'app', nom: 'S’approprier', vise: 'a' }, { id: 'ana', nom: 'Analyser / Raisonner', vise: 'a' }, { id: 'rea', nom: 'Réaliser', vise: 'a' },
  { id: 'val', nom: 'Valider', vise: 'a' }, { id: 'com', nom: 'Communiquer', vise: 'a' }], objectifs: [] };
function referentielValide(r = {}) {
  const competences = (Array.isArray(r.competences) ? r.competences : []).slice(0, 12).map((c, i) => ({ id: ID_REF.test(c.id || '') ? c.id : 'c' + crypto.randomBytes(3).toString('hex'), nom: texte(c.nom, 50) || `Compétence ${i + 1}`, vise: NIVEAUX_COMP.some((n) => n[0] === c.vise) ? c.vise : 'a' }));
  const ids = new Set(competences.map((c) => c.id));
  const objectifs = (Array.isArray(r.objectifs) ? r.objectifs : []).slice(0, 200).map((o, i) => ({ id: ID_REF.test(o.id || '') ? o.id : 'o' + crypto.randomBytes(3).toString('hex'), nom: texte(o.nom, 120) || `Objectif ${i + 1}`, sequence: texte(o.sequence, 80), competence: ids.has(o.competence) ? o.competence : '' }));
  return { competences, objectifs };
}
// étiquettes d'une question : compétence, objectif, points (facultatifs)
const etiquettes = (c = {}) => {
  const pts = Number(String(c.points ?? '').replace(',', '.'));
  return { ...(ID_REF.test(c.competence || '') ? { competence: c.competence } : {}), ...(ID_REF.test(c.objectif || '') ? { objectif: c.objectif } : {}), ...(pts > 0 ? { points: Math.min(50, Math.max(0.25, pts)) } : {}) };
};

// ---------- Questions sur une feuille PDF (évaluation « exercice » et travail à rendre) ----------
// Une question : sa zone sur la feuille (agrandie pour l'élève), sa zone de réponse (où la réponse s'écrit sur la feuille),
// le type de réponse : lignes rédigées, tableau de valeurs (cases données / à remplir), tableau de variations (flèches).
const borne = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
const rectangle = (c) => { const x = borne(c.x, 0, 0.99), y = borne(c.y, 0, 0.99); return { page: Math.max(1, Math.min(500, Math.round(Number(c.page) || 1))), x, y, l: borne(c.l, 0.01, 1 - x), h: borne(c.h, 0.005, 1 - y) }; };
// Calage sur un tableau déjà imprimé sur la feuille : g = largeur de la colonne des titres, h = séparations des lignes,
// m = marge des valeurs de x (tableau de variations) — en fractions de la zone de réponse.
const calage = (t, lignes) => {
  let h = (Array.isArray(t.h) ? t.h : []).map((x) => borne(x, 0.02, 0.98)).sort((a, b) => a - b).slice(0, lignes - 1);
  if (h.length !== lignes - 1) h = Array.from({ length: lignes - 1 }, (_v, k) => (k + 1) / lignes);
  return { imprime: t.imprime !== false, g: t.g === undefined ? 0.2 : borne(t.g, 0, 0.7), h };
};
// Arbre de probabilités : niveaux (1 à 3), branches par nœud (2 ou 3) ; calage sur l'arbre imprimé :
// ax = position (de gauche à droite) de chaque niveau, de la racine aux feuilles ; yh / yb = première et dernière feuille.
// donnes : événements (n) et probabilités (p) déjà écrits par l'enseignant, par nœud (chemin « 0 », « 0-1 », « 1-0-1 »…).
const CHEMIN_ARBRE = /^[0-2](-[0-2]){0,2}$/;
function arbreConfig(t = {}) {
  const niveaux = Math.round(borne(t.niveaux, 1, 3)) || 2, branches = Math.round(borne(t.branches, 2, 3)) || 2;
  const ax = Array.isArray(t.ax) && t.ax.length === niveaux + 1 ? t.ax.map((x) => borne(x, 0, 1)) : Array.from({ length: niveaux + 1 }, (_v, k) => 0.06 + (0.8 * k) / niveaux);
  const donnes = { n: {}, p: {} };
  for (const k of ['n', 'p']) for (const [c, v] of Object.entries((t.donnes && t.donnes[k]) || {})) if (CHEMIN_ARBRE.test(c) && texte(v, 20)) donnes[k][c] = texte(v, 20);
  return { niveaux, branches, ax, yh: t.yh === undefined ? 0.06 : borne(t.yh, 0, 1), yb: t.yb === undefined ? 0.94 : borne(t.yb, 0, 1), donnes, imprime: t.imprime !== false };
}
function tableauConfig(type, t = {}) {
  if (type === 'arbre') return arbreConfig(t);
  if (type === 'valeurs') {
    const l = Math.round(borne(t.l, 1, 8)) || 2, c = Math.round(borne(t.c, 1, 15)) || 5;
    return { l, c, d: Array.from({ length: l }, (_v, r) => Array.from({ length: c }, (_w, k) => texte(((t.d || [])[r] || [])[k], 30))), ...calage(t, l) };
  }
  const n = Math.round(borne(t.n, 2, 7)) || 3, signe = !!t.signe, varie = t.var !== false || !signe;
  const lig = t.lig || {};
  return { n, signe, var: varie, fn: texte(t.fn, 6) || 'f', x: Array.from({ length: n }, (_v, k) => texte((t.x || [])[k], 30)),
    lig: { x: texte(lig.x, 30) || 'x', s: texte(lig.s, 30) || `${texte(t.fn, 6) || 'f'}′(x)`, f: texte(lig.f, 30) || `${texte(t.fn, 6) || 'f'}(x)` },
    m: t.m === undefined ? 0.08 : borne(t.m, 0, 0.3), ...(Array.isArray(t.px) && t.px.length === n ? { px: t.px.map((x) => borne(x, 0, 1)) } : {}), ...calage(t, 1 + (signe ? 1 : 0) + (varie ? 1 : 0)) };
}
const zonesValides = (z) => (Array.isArray(z) ? z : []).slice(0, 60).map((c, i) => {
  const type = ['valeurs', 'variations', 'arbre', 'image'].includes(c.type) ? c.type : 'lignes';
  return { id: /^[a-z0-9]{1,16}$/i.test(c.id || '') ? c.id : 'z' + crypto.randomBytes(4).toString('hex'), ...rectangle(c), nom: texte(c.nom, 40) || `Question ${i + 1}`, type,
    ...etiquettes(c), ...(texte(c.correction, 2000) ? { correction: texte(c.correction, 2000) } : {}), ...(c.rep && typeof c.rep === 'object' ? { rep: rectangle(c.rep) } : {}), ...(!['lignes', 'image'].includes(type) ? { tab: tableauConfig(type, c.tab || {}) } : {}) };
});
// Outils que l'élève peut ouvrir à côté de l'évaluation (double fenêtre)
const OUTILS_EXO = ['calculatrice', 'calculatrice-numworks', 'tableur', 'geogebra', 'python', 'tableau-periodique'];
// Réponse « tableau » : { cases: { 'ligne-colonne': valeur } } ou { x, s, z, f: [textes], fl: ['h'|'b'|'c'|''] }
// image collée ou capturée par l'élève (data URL, 1,5 Mo au plus)
const IMG_REP = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
// surlignages de l'élève sur la feuille : [{ p, x, y, l, h }]
const surlValides = (s) => (Array.isArray(s) ? s : []).slice(0, 300).filter((x) => x && typeof x === 'object')
  .map((x) => ({ p: Math.max(1, Math.min(500, Math.round(Number(x.p) || 1))), x: borne(x.x, 0, 1), y: borne(x.y, 0, 1), l: borne(x.l, 0, 1), h: borne(x.h, 0, 1) })).filter((x) => x.l > 0 && x.h > 0);
function tableauValide(v) {
  if (typeof v.img === 'string') return v.img.length <= 1500000 && IMG_REP.test(v.img) ? { img: v.img } : {};
  const r = {};
  if (v.cases && typeof v.cases === 'object') { r.cases = {}; for (const [k, x] of Object.entries(v.cases).slice(0, 200)) if (/^\d{1,2}-\d{1,2}$/.test(k) && texte(x, 30)) r.cases[k] = texte(x, 30); }
  for (const k of ['x', 's', 'z', 'f']) if (Array.isArray(v[k])) r[k] = v[k].slice(0, 8).map((x) => texte(x, 30));
  if (Array.isArray(v.fl)) r.fl = v.fl.slice(0, 8).map((x) => (['h', 'b', 'c'].includes(x) ? x : ''));
  for (const k of ['n', 'p']) if (v[k] && typeof v[k] === 'object') { r[k] = {}; for (const [c, x] of Object.entries(v[k]).slice(0, 60)) if (CHEMIN_ARBRE.test(c) && texte(x, 20)) r[k][c] = texte(x, 20); }
  return r;
}
const repNonVide = (v) => {
  if (v === '' || v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v !== 'object') return !!String(v).trim();
  if (v.img) return true;
  const plein = (x) => String(x ?? '').trim() !== '';
  return Object.values(v.cases || {}).some(plein) || ['x', 's', 'z', 'f', 'fl'].some((k) => (v[k] || []).some(plein)) || ['n', 'p'].some((k) => Object.values(v[k] || {}).some(plein));
};
// réponse d'une question : des lignes { t: texte, m: true si écriture mathématique }
const lignesValides = (v) => (Array.isArray(v) ? v : []).slice(0, 60).map((l) => ({ t: texte(l && l.t, 300), ...(l && l.m ? { m: true } : {}) })).filter((l) => l.t);

function creerEvaluations({ app, ipcMain, espace, lireConfig, edition, dossierDonnees, dialogues = {} }) {
  const local = (...p) => path.join(dossierDonnees(), 'evaluations', ...p);
  const lireFichierBanque = () => lireJson(local('banque.json'), { questions: [] });
  const lireBanque = () => (lireFichierBanque().questions || []).map(migrer);
  const ecrireBanque = (q, chapitres = lireFichierBanque().chapitres || []) => ecrireJson(local('banque.json'), { questions: q, chapitres });
  const chapitresDe = (qs) => [...new Set([...(lireFichierBanque().chapitres || []), ...qs.map((q) => q.chapitre)])].sort((x, y) => x.localeCompare(y, 'fr', { numeric: true }));
  // Images de la banque : evaluations/images/<empreinte>.<ext> (copiées avec le sujet quand on lance une évaluation)
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
  function stockerImage(donnees, nomOrigine) {
    const ext = (path.extname(nomOrigine).slice(1) || '').toLowerCase().replace('jpeg', 'jpg');
    if (!MIME[ext]) throw new Error(`Format d'image non accepté : ${nomOrigine} (PNG, JPG, GIF, WEBP ou SVG).`);
    if (donnees.length > 3 * 1024 * 1024) throw new Error(`Image trop lourde (3 Mo au maximum) : ${nomOrigine}`);
    const nom = crypto.createHash('sha256').update(donnees).digest('hex').slice(0, 16) + '.' + ext;
    const cible = local('images', nom);
    if (!fs.existsSync(cible)) { fs.mkdirSync(local('images'), { recursive: true }); fs.writeFileSync(cible, donnees); }
    return nom;
  }
  const dataUrl = (fichier) => `data:${MIME[path.extname(fichier).slice(1).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(fichier).toString('base64')}`;
  const lireEvals = () => lireJson(local('evaluations.json'), { evaluations: [] }).evaluations || [];
  const ecrireEvals = (e) => ecrireJson(local('evaluations.json'), { evaluations: e });
  const lireHisto = () => lireJson(local('historique.json'), {});
  const lireSession = (sid) => (ID.test(sid || '') ? lireJson(local('sessions', sid + '.json'), null) : null);
  const ecrireSession = (s) => ecrireJson(local('sessions', s.sid + '.json'), s);
  const racine = () => { const d = lireConfig().dossierMaj; return d ? path.join(d, 'Classes') : null; };
  const partage = (classeId, sid, ...p) => { if (!ID.test(classeId) || !ID.test(sid) || !racine()) throw new Error('Dossier partagé indisponible.'); return path.join(racine(), classeId, 'evaluations', sid, ...p); };
  const exigerProf = () => { if (edition !== 'prof' || !espace.estProfDeverrouille()) throw new Error('Réservé à l\'enseignant connecté dans Labo Prof.'); };
  const gerer = (canal, fn) => ipcMain.handle(canal, async (_e, ...a) => {
    try { const r = await fn(...a); return { ok: true, ...(r && typeof r === 'object' && !Array.isArray(r) ? r : { valeur: r }) }; } catch (e) { return { ok: false, message: e.message }; }
  });

  // ---------- Évaluation « exercice » ----------
  const PDF = /^[0-9a-f]{16}\.pdf$/;
  const estExercice = (s) => !!s && s.modele === 'exercice';
  const NOTES = ['juste', 'partiel', 'faux'];
  const notesDe = (s, eleveId) => ((s.notes || {})[eleveId]) || { questions: {}, general: '' };
  const estNotee = (s, eleveId) => { const n = notesDe(s, eleveId); return Object.keys(n.questions || {}).length > 0 || !!n.general; };
  function correctionExercice(s, eleveId) {
    const copie = lireCopie(s, eleveId) || {};
    const n = notesDe(s, eleveId);
    return { titre: s.titre, modele: 'exercice', date: new Date().toISOString(), zones: s.zones, reponses: copie.reponses || {}, surl: copie.surl || [], calculs: (copie.calculs || []).slice(-400), notes: n.questions || {}, general: n.general || '' };
  }
  function stockerPdf(donnees) {
    if (donnees.length > 25 * 1024 * 1024) throw new Error('PDF trop lourd (25 Mo au maximum).');
    if (donnees.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Ce fichier n\'est pas un PDF.');
    const nom = crypto.createHash('sha256').update(donnees).digest('hex').slice(0, 16) + '.pdf';
    const cible = local('pdfs', nom);
    if (!fs.existsSync(cible)) { fs.mkdirSync(local('pdfs'), { recursive: true }); fs.writeFileSync(cible, donnees); }
    return nom;
  }

  // ---------- Correction (Labo Prof) ----------
  function corrigerCopie(s, eleveId, copie) {
    if (estExercice(s)) return null; // corrigée à la main
    const sujet = s.sujets[eleveId];
    if (!sujet) return null;
    const reps = (copie && copie.reponses) || {};
    const lignes = sujet.questions.map((x, n) => ({ n, notion: x.notion, cle: x.cle || x.notion, partie: x.partie || (x.type === 'qcm' ? 'cours' : 'automatisme'), image: x.image || null, type: x.type, enonce: x.enonce, choix: x.choix, juste: estJuste(x, reps[n]), reponse: texteReponse(x, reps[n]), attendu: texteAttendu(x), explication: x.explication || '', erreur: estJuste(x, reps[n]) ? null : typeErreur(x, reps[n]).cle,
      ...(x.choixImages ? { imagesReponse: (Array.isArray(reps[n]) ? reps[n] : reps[n] === undefined || reps[n] === 'jsp' ? [] : [reps[n]]).map((i) => x.choixImages[i]).filter(Boolean), imagesAttendu: x.justes.map((i) => x.choixImages[i]).filter(Boolean) } : {}), calculs: ((copie && copie.calculs) || []).filter((c) => c.q === n).slice(-40) }));
    return { lignes, faux: lignes.filter((l) => !l.juste).length, total: lignes.length, bilan: bilanEleve(lignes) };
  }
  // « Pour réussir la prochaine fois » : notions à revoir (avec un conseil selon l'erreur) et notions réussies.
  const CONSEILS = {
    jsp: 'Revois la leçon sur cette notion : tu n’as pas su répondre. Refais les exemples du cours.',
    vide: 'Tu n’as pas répondu : garde du temps pour chaque question, et réponds même si tu n’es pas sûr(e).',
    virgule: 'Vérifie l’ordre de grandeur de ton résultat (est-il trop grand ou trop petit ?) et la place de la virgule.',
    'op+': 'Une seule opération ne suffit pas : relis la méthode et écris les étapes du calcul.',
    'op−': 'Une seule opération ne suffit pas : relis la méthode et écris les étapes du calcul.',
    'op×': 'Une seule opération ne suffit pas : relis la méthode et écris les étapes du calcul.',
    'op÷': 'Une seule opération ne suffit pas : relis la méthode et écris les étapes du calcul.',
    approche: 'N’arrondis qu’à la fin du calcul, et garde assez de chiffres après la virgule.',
    signe: 'Attention aux signes : relis les « + » et les « − » de ton calcul.',
    recopie: 'Ne recopie pas un nombre de l’énoncé : il faut calculer le résultat.',
    inverse: 'Vérifie l’ordre de ta division : qu’est-ce qu’on divise, et par quoi ?',
    illisible: 'Écris ta réponse sous forme de nombre (par exemple 12,5 ou 3/4).',
    incomplet: 'Il y avait plusieurs bonnes réponses : lis toutes les propositions avant de valider.',
    autre: 'Relis l’explication de la correction, puis refais le calcul étape par étape.',
  };
  const conseilDe = (l) => CONSEILS[l.erreur] || (l.type === 'qcm' ? 'Relis la leçon et l’explication de la correction : compare ta réponse à la bonne.' : CONSEILS.autre);
  function bilanEleve(lignes) {
    const notions = {};
    for (const l of lignes) {
      const b = (notions[l.cle] = notions[l.cle] || { notion: l.notion, partie: l.partie, total: 0, faux: 0, questions: [], conseils: [] });
      b.total++;
      if (l.juste) continue;
      b.faux++; b.questions.push(l.n + 1);
      const c = conseilDe(l);
      if (!b.conseils.includes(c)) b.conseils.push(c);
    }
    const liste = Object.values(notions);
    return {
      aRevoir: liste.filter((b) => b.faux).sort((a, b) => b.faux / b.total - a.faux / a.total || b.faux - a.faux),
      reussies: liste.filter((b) => !b.faux).map((b) => b.notion),
    };
  }
  const lireCopie = (s, eleveId) => lireJson(partage(s.classeId, s.sid, 'copies', eleveId + '.json'), null);
  function rendreCorrection(s, eleveId) {
    if (estExercice(s)) {
      ecrireJson(partage(s.classeId, s.sid, 'corrections', eleveId + '.json'), correctionExercice(s, eleveId));
      s.corrige[eleveId] = true;
      return;
    }
    const r = corrigerCopie(s, eleveId, lireCopie(s, eleveId));
    if (!r) return;
    ecrireJson(partage(s.classeId, s.sid, 'corrections', eleveId + '.json'), { titre: s.titre, date: new Date().toISOString(), ...r });
    s.corrige[eleveId] = true;
    // Historique : sert à adapter les prochaines évaluations
    const h = lireHisto(), e = (h[eleveId] = h[eleveId] || { notions: {}, questions: {} });
    if (!(s.historise || {})[eleveId]) {
      r.lignes.forEach((l, i) => {
        const qid = s.sujets[eleveId].questions[i].qid;
        (e.notions[l.cle] = e.notions[l.cle] || []).push(l.juste);
        e.notions[l.cle] = e.notions[l.cle].slice(-20);
        e.questions[qid] = l.juste;
      });
      s.historise = { ...(s.historise || {}), [eleveId]: true };
      ecrireJson(local('historique.json'), h);
    }
  }
  function terminer(s) {
    if (!estExercice(s)) for (const eleveId of Object.keys(s.sujets)) if (!s.corrige[eleveId] && lireCopie(s, eleveId)) rendreCorrection(s, eleveId);
    s.etat = 'terminee'; s.fin = new Date().toISOString();
    ecrireSession(s);
    ecrireJson(partage(s.classeId, s.sid, 'session.json'), sessionPublique(s));
  }
  const sessionPublique = (s) => ({ sid: s.sid, titre: s.titre, debut: s.debut, dureeMin: s.dureeMin, correction: s.correction, calculatrice: s.calculatrice, etat: s.etat, ...(estExercice(s) ? { modele: 'exercice', zones: s.zones, outils: s.outils || [] } : {}) });
  // Passage régulier : correction immédiate (mode « fin de l'élève ») ou en fin de chrono (mode « fin de l'heure »).
  function tour() {
    if (edition !== 'prof') return;
    let fichiers = [];
    try { fichiers = fs.readdirSync(local('sessions')).filter((f) => f.endsWith('.json')); } catch { return; }
    for (const f of fichiers) {
      const s = lireSession(f.slice(0, -5));
      if (!s || s.etat !== 'en-cours' || estExercice(s)) continue; // exercice : corrigé à la main
      try {
        let change = false;
        if (s.correction === 'fin-eleve') {
          for (const eleveId of Object.keys(s.sujets)) {
            if (s.corrige[eleveId]) continue;
            const c = lireCopie(s, eleveId);
            if (c && c.fini) { rendreCorrection(s, eleveId); change = true; }
          }
        }
        const finChrono = Date.parse(s.debut) + (s.dureeMin * 60 + 60) * 1000; // une minute de marge pour les dernières copies
        if (s.correction === 'fin-heure' && s.dureeMin > 0 && Date.now() > finChrono) { terminer(s); continue; }
        if (change) ecrireSession(s);
      } catch { /* dossier partagé momentanément indisponible */ }
    }
  }
  if (edition === 'prof') setInterval(tour, 4000);

  // ---------- IPC enseignant ----------
  gerer('eval:banque', () => { exigerProf(); const qs = lireBanque(); return { questions: qs, chapitres: chapitresDe(qs) }; });
  // Dossiers de la banque : un par chapitre
  gerer('eval:chapitre', (action, nom, nouveau) => {
    exigerProf();
    const n = texte(nom, 80), nv = texte(nouveau, 80);
    const fb = lireFichierBanque(), qs = lireBanque();
    let chap = fb.chapitres || [];
    if (action === 'ajouter') { if (!n) throw new Error('Donne un nom au chapitre.'); if (!chap.includes(n)) chap.push(n); ecrireBanque(qs, chap); }
    else if (action === 'renommer') {
      if (!nv) throw new Error('Donne un nom au chapitre.');
      for (const q of qs) if (q.chapitre === n) { if (q.notion === n) q.notion = nv; q.chapitre = nv; }
      chap = chap.map((x) => (x === n ? nv : x));
      ecrireBanque(qs, [...new Set(chap)]);
    } else if (action === 'supprimer') ecrireBanque(qs.filter((q) => q.chapitre !== n), chap.filter((x) => x !== n));
    return { chapitres: chapitresDe(lireBanque()) };
  });
  gerer('eval:image-choisir', async () => {
    exigerProf();
    const choix = await dialogues.ouvrir({ title: 'Choisir une image pour la question', buttonLabel: 'Choisir', properties: ['openFile'], filters: [{ name: 'Images', extensions: Object.keys(MIME) }] });
    if (choix.canceled || !choix.filePaths.length) return { annule: true };
    return { image: stockerImage(fs.readFileSync(choix.filePaths[0]), choix.filePaths[0]) };
  });
  gerer('eval:image-locale', (nom) => { exigerProf(); if (!IMAGE.test(nom || '') || !fs.existsSync(local('images', nom))) throw new Error('Image introuvable.'); return { url: dataUrl(local('images', nom)) }; });
  gerer('eval:question-enregistrer', (q) => {
    exigerProf();
    const r = questionValide(q || {});
    const liste = lireBanque().filter((x) => x.id !== r.id);
    liste.push(r);
    ecrireBanque(liste);
    return { question: r };
  });
  gerer('eval:question-supprimer', (id) => { exigerProf(); ecrireBanque(lireBanque().filter((x) => x.id !== id)); return {}; });
  gerer('eval:exemples', () => {
    exigerProf();
    const liste = lireBanque();
    for (const q of EXEMPLES) if (!liste.some((x) => x.enonce === q.enonce && x.chapitre === q.chapitre)) liste.push(questionValide(q));
    ecrireBanque(liste);
    return { questions: liste };
  });
  // Import : classeur Excel (.xlsx), fichier .json, ou dossier compressé (.zip) avec le classeur / le .json ET les images.
  // Une question déjà présente (même chapitre, même question) est mise à jour au lieu d'être ajoutée deux fois.
  gerer('eval:importer-excel', async () => {
    exigerProf();
    const choix = await dialogues.ouvrir({ title: 'Importer des questions (Excel, .zip avec images, .json)', buttonLabel: 'Importer', properties: ['openFile'], filters: [{ name: 'Banque de questions', extensions: ['xlsx', 'zip', 'json'] }] });
    if (choix.canceled || !choix.filePaths.length) return { annule: true };
    const fichier = choix.filePaths[0], ext = path.extname(fichier).toLowerCase();
    const images = new Map(); // nom de fichier (minuscules) → contenu
    let feuilles = null, json = null;
    if (ext === '.zip') {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(fichier);
      for (const e of zip.getEntries()) {
        const nom = e.entryName.replace(/\\/g, '/');
        if (e.isDirectory || nom.split('/').some((x) => x === '..') || /(^|\/)__MACOSX\//.test(nom)) continue;
        const base = path.posix.basename(nom).toLowerCase();
        if (/\.xlsx$/i.test(base) && !feuilles && !base.startsWith('~$')) feuilles = lireClasseur(e.getData());
        else if (/\.json$/i.test(base) && !json) json = e.getData().toString('utf8');
        else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(base)) images.set(base, e.getData());
      }
      if (!feuilles && !json) throw new Error('Le .zip ne contient ni classeur Excel (.xlsx) ni fichier questions.json.');
    } else if (ext === '.json') json = fs.readFileSync(fichier, 'utf8');
    else {
      feuilles = lireClasseur(fichier);
      // images à côté du classeur (même dossier, ou sous-dossier « images »)
      for (const d of [path.dirname(fichier), path.join(path.dirname(fichier), 'images')]) {
        try { for (const x of fs.readdirSync(d)) if (/\.(png|jpe?g|gif|webp|svg)$/i.test(x)) images.set(x.toLowerCase(), fs.readFileSync(path.join(d, x))); } catch { /* pas de dossier */ }
      }
    }
    const manquantes = new Set();
    const image = (nom) => {
      const n = path.basename(String(nom)).toLowerCase();
      if (!images.has(n)) { manquantes.add(nom); return undefined; }
      return stockerImage(images.get(n), n);
    };
    const { questions, ignorees } = json ? questionsDuJson(json, image) : questionsDuClasseur(feuilles, image);
    const liste = lireBanque();
    let ajoutees = 0, majs = 0;
    for (const q of questions) {
      const i = liste.findIndex((x) => x.type === q.type && norme(x.chapitre) === norme(q.chapitre) && norme(x.enonce) === norme(q.enonce));
      if (i >= 0) { liste[i] = { ...q, id: liste[i].id }; majs++; } else { liste.push(q); ajoutees++; }
    }
    ecrireBanque(liste);
    return { ajoutees, majs, ignorees: ignorees.slice(0, 50), nbIgnorees: ignorees.length, notions: [...new Set(questions.map((q) => q.chapitre))], imagesManquantes: [...manquantes].slice(0, 20), avecImages: questions.filter((q) => q.image || (q.choix || []).some((c) => c.image)).length };
  });
  gerer('eval:exporter-excel', async (modele) => {
    exigerProf();
    const qs = modele ? EXEMPLES.map((q) => questionValide({ ...q, niveau: '2nde' })) : lireBanque();
    const avecImages = !modele && qs.some((q) => q.image || (q.choix || []).some((c) => c.image));
    const choix = await dialogues.enregistrer({ title: modele ? 'Enregistrer le modèle Excel' : 'Exporter la banque', defaultPath: modele ? 'Modele-banque-questions.xlsx' : avecImages ? 'Banque-questions.zip' : 'Banque-questions.xlsx', filters: [avecImages ? { name: 'Dossier compressé (classeur + images)', extensions: ['zip'] } : { name: 'Classeur Excel', extensions: ['xlsx'] }] });
    if (choix.canceled || !choix.filePath) return { annule: true };
    if (avecImages) {
      const AdmZip = require('adm-zip');
      const tmp = choix.filePath + '.tmp.xlsx';
      ecrireClasseur(tmp, feuillesDeLaBanque(qs));
      const zip = new AdmZip();
      zip.addFile('banque.xlsx', fs.readFileSync(tmp));
      fs.rmSync(tmp, { force: true });
      for (const n of new Set(qs.flatMap((q) => [q.image, ...(q.choix || []).map((c) => c.image)]).filter(Boolean))) if (fs.existsSync(local('images', n))) zip.addFile(n, fs.readFileSync(local('images', n)));
      zip.writeZip(choix.filePath);
    } else ecrireClasseur(choix.filePath, feuillesDeLaBanque(qs));
    return { fichier: choix.filePath, nombre: qs.length };
  });
  gerer('eval:apercu', (q) => { exigerProf(); const r = questionValide(q || {}); const x = instancier(r); return { enonce: x.enonce, attendu: texteAttendu(x), choix: x.choix, image: x.image, explication: x.explication }; });
  gerer('eval:liste', () => { exigerProf(); return { evaluations: lireEvals() }; });
  gerer('eval:enregistrer', (d = {}) => {
    exigerProf();
    if (d.modele === 'exercice') {
      const ancienne = lireEvals().find((x) => x.id === d.id);
      const e = { id: ID.test(d.id || '') ? d.id : nouvelId('ev'), modele: 'exercice', titre: texte(d.titre, 80), dureeMin: Math.min(240, Math.max(0, Math.round(Number(d.dureeMin) || 0))),
        correction: 'manuelle', calculatrice: d.calculatrice !== false, outils: (Array.isArray(d.outils) ? d.outils : []).filter((x) => OUTILS_EXO.includes(x)), pdf: PDF.test(d.pdf || '') ? d.pdf : null, nomPdf: texte(d.nomPdf, 120),
        zones: zonesValides(d.zones !== undefined ? d.zones : ancienne && ancienne.pdf === d.pdf ? ancienne.zones : []), modifie: new Date().toISOString() };
      if (!e.titre) throw new Error('Donne un titre à l\'évaluation.');
      if (!e.pdf || !fs.existsSync(local('pdfs', e.pdf))) throw new Error('Choisis le PDF de l\'exercice.');
      ecrireEvals([...lireEvals().filter((x) => x.id !== e.id), e]);
      return { evaluation: e };
    }
    const e = {
      id: ID.test(d.id || '') ? d.id : nouvelId('ev'), titre: texte(d.titre, 80), dureeMin: Math.min(240, Math.max(0, Math.round(Number(d.dureeMin) || 0))),
      correction: d.correction === 'fin-heure' ? 'fin-heure' : 'fin-eleve', calculatrice: d.calculatrice !== false,
      parties: (Array.isArray(d.parties) ? d.parties : []).map((p) => ({ partie: p.partie === 'automatisme' || p.type === 'calcul' ? 'automatisme' : 'cours', cles: (Array.isArray(p.cles) ? p.cles : []).map((n) => texte(n, 150)).filter(Boolean), nombre: Math.min(40, Math.max(0, Math.round(Number(p.nombre) || 0))) }))
        .filter((p) => p.nombre > 0 && p.cles.length),
      modifie: new Date().toISOString(),
    };
    if (!e.titre) throw new Error('Donne un titre à l\'évaluation.');
    if (!e.parties.length) throw new Error('Coche au moins un chapitre ou un automatisme, et indique un nombre de questions.');
    ecrireEvals([...lireEvals().filter((x) => x.id !== e.id), e]);
    return { evaluation: e };
  });
  gerer('eval:pdf-choisir', async () => {
    exigerProf();
    const choix = await dialogues.ouvrir({ title: 'Choisir le PDF de l\'exercice', buttonLabel: 'Choisir', properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (choix.canceled || !choix.filePaths.length) return { annule: true };
    return { pdf: stockerPdf(fs.readFileSync(choix.filePaths[0])), nomPdf: path.basename(choix.filePaths[0]) };
  });
  gerer('eval:exercice', (evalId) => {
    exigerProf();
    const e = lireEvals().find((x) => x.id === evalId && x.modele === 'exercice');
    if (!e) throw new Error('Évaluation introuvable.');
    return { evaluation: e, octets: fs.readFileSync(local('pdfs', e.pdf)) };
  });
  gerer('eval:zones', (evalId, zones) => {
    exigerProf();
    const liste = lireEvals(), e = liste.find((x) => x.id === evalId && x.modele === 'exercice');
    if (!e) throw new Error('Évaluation introuvable.');
    e.zones = zonesValides(zones); e.modifie = new Date().toISOString();
    ecrireEvals(liste);
    return { evaluation: e };
  });
  // Correction à la main : { questions: { <n° de zone>: { v: 'juste'|'partiel'|'faux', c: commentaire } }, general }
  gerer('eval:noter', (sid, eleveId, notes = {}) => {
    exigerProf();
    const s = lireSession(sid);
    if (!estExercice(s) || !s.sujets[eleveId]) throw new Error('Copie introuvable.');
    const questions = {};
    for (const [k, v] of Object.entries((notes && notes.questions) || {})) {
      if (!/^\d{1,3}$/.test(k) || +k >= s.zones.length || !v) continue;
      const x = { ...(NOTES.includes(v.v) ? { v: v.v } : {}), ...(texte(v.c, 1000) ? { c: texte(v.c, 1000) } : {}) };
      if (Object.keys(x).length) questions[k] = x;
    }
    s.notes = { ...(s.notes || {}), [eleveId]: { questions, general: texte(notes && notes.general, 2000) } };
    ecrireSession(s);
    return { notes: s.notes[eleveId] };
  });
  gerer('eval:supprimer', (id) => { exigerProf(); ecrireEvals(lireEvals().filter((x) => x.id !== id)); return {}; });
  // Lancer : un sujet adapté par élève de la classe, puis mode examen avec l'outil « Évaluation ».
  gerer('eval:lancer', (classeId, evalId) => {
    exigerProf();
    const ev = lireEvals().find((x) => x.id === evalId);
    if (!ev) throw new Error('Évaluation introuvable.');
    const c = espace.lireClasse(classeId);
    if (!c) throw new Error('Classe introuvable.');
    if (!(c.eleves || []).length) throw new Error('Cette classe n\'a pas encore d\'élèves.');
    if (ev.modele === 'exercice') {
      if (!ev.zones.length) throw new Error('Place d\'abord les questions sur le PDF (bouton « 📐 Placer les questions »).');
      if (!ev.pdf || !fs.existsSync(local('pdfs', ev.pdf))) throw new Error('Le PDF de l\'exercice est introuvable : choisis-le de nouveau.');
      const sid = nouvelId('s');
      const outils = (ev.outils || []).filter((x) => OUTILS_EXO.includes(x));
      const s = { sid, evalId, modele: 'exercice', titre: ev.titre, classeId, debut: new Date().toISOString(), dureeMin: ev.dureeMin, correction: 'manuelle', calculatrice: ev.calculatrice, outils, etat: 'en-cours', pdf: ev.pdf, zones: ev.zones, sujets: {}, corrige: {}, notes: {} };
      for (const el of c.eleves) s.sujets[el.id] = { nom: el.nom, questions: [] };
      ecrireSession(s);
      fs.mkdirSync(partage(classeId, sid), { recursive: true });
      fs.copyFileSync(local('pdfs', ev.pdf), partage(classeId, sid, 'exercice.pdf'));
      ecrireJson(partage(classeId, sid, 'session.json'), sessionPublique(s));
      espace.modifierClasse(classeId, (cl) => { cl.examen = { titre: ev.titre, outils: ['evaluation-maths', ...outils], debut: s.debut, evaluation: sid }; return { classe: cl }; });
      return { sid, manque: 0 };
    }
    const banque = lireBanque(), h = lireHisto();
    const sid = nouvelId('s');
    const s = { sid, evalId, titre: ev.titre, classeId, debut: new Date().toISOString(), dureeMin: ev.dureeMin, correction: ev.correction, calculatrice: ev.calculatrice, etat: 'en-cours', sujets: {}, corrige: {}, historise: {} };
    let manque = 0;
    for (const el of c.eleves) {
      const questions = [];
      for (const p of ev.parties) {
        const pool = p.cles ? banque.filter((q) => q.partie === p.partie && p.cles.includes(cle(q))) // depuis les chapitres
          : banque.filter((q) => q.type === p.type && (p.notions || []).includes(q.notion)); // ancienne évaluation
        const t = tirerQuestions(pool, p.nombre, h[el.id]);
        manque = Math.max(manque, p.nombre - t.length);
        questions.push(...t.map(instancier));
      }
      s.sujets[el.id] = { nom: el.nom, questions };
    }
    if (!Object.values(s.sujets).some((x) => x.questions.length)) throw new Error('Aucune question dans la banque pour ces notions.');
    ecrireSession(s);
    for (const [eleveId, x] of Object.entries(s.sujets)) ecrireJson(partage(classeId, sid, 'sujets', eleveId + '.json'), { questions: x.questions.map(pourEleve) });
    // images des sujets (pas secrètes) : copiées une fois dans le dossier de l'évaluation
    for (const n of new Set(Object.values(s.sujets).flatMap((x) => x.questions.flatMap((q) => [q.image, ...(q.choixImages || [])])).filter(Boolean))) {
      if (!fs.existsSync(local('images', n))) continue;
      fs.mkdirSync(partage(classeId, sid, 'images'), { recursive: true });
      fs.copyFileSync(local('images', n), partage(classeId, sid, 'images', n));
    }
    ecrireJson(partage(classeId, sid, 'session.json'), sessionPublique(s));
    espace.modifierClasse(classeId, (cl) => { cl.examen = { titre: ev.titre, outils: ['evaluation-maths'], debut: s.debut, evaluation: sid }; return { classe: cl }; });
    return { sid, manque };
  });
  // ---------- Analyse des erreurs fréquentes (par notion, par question) ----------
  const proche = (v, a) => Math.abs(v - a) <= Math.max(1e-9, Math.abs(a) * 1e-6);
  // Quelle erreur l'élève a-t-il probablement faite ? → { cle, libelle }
  function typeErreur(x, rep) {
    if (rep === 'jsp') return { cle: 'jsp', libelle: '🤷 Je ne sais pas' };
    if (rep === undefined || rep === null || rep === '' || (Array.isArray(rep) && !rep.length)) return { cle: 'vide', libelle: '⏳ Pas de réponse' };
    if (x.type === 'qcm') {
      const r = (Array.isArray(rep) ? rep : [rep]).map(Number);
      const fausses = r.filter((i) => !x.justes.includes(i));
      if (!fausses.length) return { cle: 'incomplet', libelle: 'Réponse incomplète (il manquait une bonne réponse)' };
      const t = fausses.map((i) => x.choix[i]).join(' ; ');
      return { cle: 'choix:' + t, libelle: `A choisi « ${t} »` };
    }
    const v = nombreDeLaReponse(rep), a = x.attendu;
    if (v === null) return { cle: 'illisible', libelle: 'Réponse sans nombre lisible' };
    if (a !== 0 && Math.abs(v / a - 1) <= 0.05) return { cle: 'approche', libelle: 'Valeur approchée (arrondi trop tôt ou trop grossier)' };
    if (a !== 0 && proche(v, -a)) return { cle: 'signe', libelle: 'Erreur de signe' };
    for (const k of [1, 2, 3, -1, -2, -3]) if (a !== 0 && proche(v * 10 ** k, a)) return { cle: 'virgule', libelle: 'Erreur de virgule ou d’unité (facteur 10, 100, 1 000)' };
    if (a !== 0 && v !== 0 && proche(v, 1 / a)) return { cle: 'inverse', libelle: 'Calcul « à l’envers » (l’inverse du résultat)' };
    // Les nombres de l'énoncé (et 100 quand il y a des pourcentages) : l'élève a-t-il fait une seule opération ?
    const nombres = [...new Set([...Object.values(x.valeurs || {}), ...(String(x.enonce).match(/\d+(?:[.,]\d+)?/g) || []).map((n) => Number(n.replace(',', '.'))), ...(/%/.test(x.enonce) ? [100] : [])])].slice(0, 8);
    if (nombres.some((n) => proche(v, n))) return { cle: 'recopie', libelle: 'A recopié un nombre de l’énoncé' };
    const OPS = [['+', (p, q) => p + q], ['−', (p, q) => p - q], ['×', (p, q) => p * q], ['÷', (p, q) => (q ? p / q : NaN)]];
    for (const [op, f] of OPS) for (const p of nombres) for (const q of nombres) {
      if (p === q && op !== '×' && op !== '+') continue;
      if (proche(v, f(p, q))) return { cle: 'op' + op, libelle: `Une seule opération avec les nombres de l’énoncé (ex. ${fr(p)} ${op} ${fr(q)})` };
    }
    return { cle: 'autre', libelle: 'Autre erreur' };
  }
  function analyserErreurs(classeId, sid = null) {
    let fichiers = [];
    try { fichiers = fs.readdirSync(local('sessions')).filter((f) => f.endsWith('.json')); } catch { /* aucune */ }
    const sessions = fichiers.map((f) => lireSession(f.slice(0, -5))).filter((s) => s && !estExercice(s) && s.classeId === classeId && (!sid || s.sid === sid));
    const banque = new Map(lireBanque().map((q) => [q.id, q]));
    const notions = {};
    let copies = 0;
    for (const s of sessions) for (const [eleveId, suj] of Object.entries(s.sujets)) {
      let copie = null;
      try { copie = lireCopie(s, eleveId); } catch { /* dossier partagé indisponible */ }
      if (!copie) continue;
      copies++;
      const reps = copie.reponses || {};
      suj.questions.forEach((x, n) => {
        const rep = reps[n], juste = estJuste(x, rep);
        const cleN = x.cle || x.notion;
        const N = (notions[cleN] = notions[cleN] || { cle: cleN, chapitre: x.chapitre || x.notion, notion: x.notion, partie: x.partie || (x.type === 'qcm' ? 'cours' : 'automatisme'), total: 0, justes: 0, jsp: 0, eleves: {}, questions: {} });
        N.total++; if (juste) N.justes++; else if (rep === 'jsp') N.jsp++;
        const el = (N.eleves[eleveId] = N.eleves[eleveId] || { nom: suj.nom, total: 0, justes: 0 });
        el.total++; if (juste) el.justes++;
        const modele = banque.get(x.qid);
        const Q = (N.questions[x.qid] = N.questions[x.qid] || { qid: x.qid, enonce: modele ? modele.enonce.replace(/\{\s*=[^}]+\}/g, '…').replace(/\{\s*([a-z][a-z0-9_]*)\s*\}/gi, '$1') : x.enonce, type: x.type, total: 0, justes: 0, erreurs: {} });
        Q.total++;
        if (juste) { Q.justes++; return; }
        const t = typeErreur(x, rep);
        const E = (Q.erreurs[t.cle] = Q.erreurs[t.cle] || { libelle: t.libelle, n: 0, exemples: [] });
        E.n++;
        const ex = { donne: texteReponse(x, rep), attendu: texteAttendu(x) };
        if (rep !== 'jsp' && rep !== '' && rep !== undefined && E.exemples.length < 4 && !E.exemples.some((y) => y.donne === ex.donne && y.attendu === ex.attendu)) E.exemples.push(ex);
      });
    }
    const taux = (j, t) => (t ? Math.round((100 * j) / t) : 0);
    const liste = Object.values(notions).map((N) => ({
      cle: N.cle, chapitre: N.chapitre, notion: N.notion, partie: N.partie, total: N.total, justes: N.justes, jsp: N.jsp, reussite: taux(N.justes, N.total),
      aAider: Object.values(N.eleves).filter((e) => e.total >= 2 && e.justes / e.total < 0.5).map((e) => ({ nom: e.nom, reussite: taux(e.justes, e.total), total: e.total })).sort((a, b) => a.reussite - b.reussite),
      questions: Object.values(N.questions).map((Q) => {
        const faux = Q.total - Q.justes;
        return { enonce: Q.enonce, type: Q.type, total: Q.total, reussite: taux(Q.justes, Q.total),
          erreurs: Object.values(Q.erreurs).sort((a, b) => b.n - a.n).map((e) => ({ ...e, part: taux(e.n, faux) })) };
      }).sort((a, b) => a.reussite - b.reussite),
    })).sort((a, b) => a.reussite - b.reussite);
    return { sessions: sessions.length, copies, notions: liste };
  }
  gerer('eval:analyse', (classeId, sid) => { exigerProf(); return analyserErreurs(classeId, sid || null); });
  gerer('eval:sessions', (classeId) => {
    exigerProf();
    let f = [];
    try { f = fs.readdirSync(local('sessions')); } catch { /* aucune */ }
    return { sessions: f.map((x) => lireSession(x.replace(/\.json$/, ''))).filter((s) => s && s.classeId === classeId).map((s) => ({ ...sessionPublique(s), fin: s.fin || null, eleves: Object.keys(s.sujets).length })).sort((a, b) => b.debut.localeCompare(a.debut)) };
  });
  // Suivi en direct : où en est chaque élève (et ses erreurs, calculées en direct)
  gerer('eval:suivi', (sid) => {
    exigerProf();
    const s = lireSession(sid);
    if (!s) throw new Error('Évaluation introuvable.');
    const eleves = Object.entries(s.sujets).map(([eleveId, x]) => {
      const copie = lireCopie(s, eleveId);
      const r = copie ? corrigerCopie(s, eleveId, copie) : null;
      const repondues = copie ? Object.values(copie.reponses || {}).filter(repNonVide).length : 0;
      return { eleveId, nom: x.nom, total: estExercice(s) ? s.zones.length : x.questions.length, repondues, fini: !!(copie && copie.fini), commence: !!copie, faux: r ? r.faux : null, corrige: !!s.corrige[eleveId], ...(estExercice(s) ? { note: estNotee(s, eleveId) } : {}), maj: copie ? copie.maj : null };
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return { session: { ...sessionPublique(s), fin: s.fin || null }, eleves };
  });
  gerer('eval:copie', (sid, eleveId) => {
    exigerProf();
    const s = lireSession(sid);
    if (!s || !s.sujets[eleveId]) throw new Error('Copie introuvable.');
    if (estExercice(s)) {
      const copie = lireCopie(s, eleveId);
      const eleves = Object.entries(s.sujets).map(([id, x]) => ({ eleveId: id, nom: x.nom, commence: fs.existsSync(partage(s.classeId, s.sid, 'copies', id + '.json')), note: estNotee(s, id), corrige: !!s.corrige[id] })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      return { nom: s.sujets[eleveId].nom, exercice: true, session: { ...sessionPublique(s), fin: s.fin || null }, octets: fs.readFileSync(local('pdfs', s.pdf)), copie, notes: notesDe(s, eleveId), corrige: !!s.corrige[eleveId], eleves };
    }
    return { nom: s.sujets[eleveId].nom, ...corrigerCopie(s, eleveId, lireCopie(s, eleveId)) };
  });
  gerer('eval:terminer', (sid) => {
    exigerProf();
    const s = lireSession(sid);
    if (!s) throw new Error('Évaluation introuvable.');
    if (s.etat === 'en-cours') terminer(s);
    try { espace.modifierClasse(s.classeId, (cl) => { if (cl.examen && cl.examen.evaluation === sid) cl.examen = null; return { classe: cl }; }); } catch { /* classe supprimée */ }
    return {};
  });
  gerer('eval:rendre', (sid) => { // donner les corrections tout de suite, l'examen continue
    exigerProf();
    const s = lireSession(sid);
    if (!s) throw new Error('Évaluation introuvable.');
    if (estExercice(s)) { // exercice : les copies déjà corrigées (de nouveau si la correction a changé)
      let n = 0;
      for (const eleveId of Object.keys(s.sujets)) if (estNotee(s, eleveId) && lireCopie(s, eleveId)) { rendreCorrection(s, eleveId); n++; }
      ecrireSession(s);
      return { rendues: n, aCorriger: Object.keys(s.sujets).filter((id) => !estNotee(s, id) && lireCopie(s, id)).length };
    }
    terminer(s);
    return {};
  });

  // ---------- IPC élève ----------
  function maSession() {
    const ex = espace.examenEleve && espace.examenEleve();
    const el = espace.eleve && espace.eleve();
    if (!ex || !ex.examen || !ex.examen.evaluation || !el || el.classeId !== ex.classeId) throw new Error('Aucune évaluation en cours pour toi.');
    const sid = ex.examen.evaluation;
    if (!ID.test(sid) || !ID.test(el.eleveId)) throw new Error('Évaluation invalide.');
    return { sid, classeId: ex.classeId, eleveId: el.eleveId, nom: el.nom };
  }
  const brouillon = (sid) => local('copies', sid + '.json');
  gerer('eval:mon-sujet', () => {
    const m = maSession();
    const session = lireJson(partage(m.classeId, m.sid, 'session.json'), null);
    const sujet = lireJson(partage(m.classeId, m.sid, 'sujets', m.eleveId + '.json'), null);
    if (session && session.modele === 'exercice') {
      const copie = lireJson(brouillon(m.sid), null) || lireJson(partage(m.classeId, m.sid, 'copies', m.eleveId + '.json'), null);
      return { nom: m.nom, session, exercice: true, questions: session.zones || [], copie };
    }
    if (!session || !sujet) throw new Error('Ton sujet n\'est pas encore arrivé : patiente quelques secondes, puis réessaie.');
    const copie = lireJson(brouillon(m.sid), null) || lireJson(partage(m.classeId, m.sid, 'copies', m.eleveId + '.json'), null);
    return { nom: m.nom, session, questions: sujet.questions, copie };
  });
  gerer('eval:enregistrer-copie', (d = {}) => {
    const m = maSession();
    const reponses = {};
    for (const [k, v] of Object.entries(d.reponses || {})) {
      if (!/^\d{1,3}$/.test(k)) continue;
      if (Array.isArray(v) && v.some((x) => x && typeof x === 'object')) { reponses[k] = lignesValides(v); continue; } // exercice : lignes de réponse
      if (v && typeof v === 'object' && !Array.isArray(v)) { reponses[k] = tableauValide(v); continue; } // exercice : tableau
      reponses[k] = Array.isArray(v) ? v.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x < 10).slice(0, 10) : texte(v, 80);
    }
    const calculs = (Array.isArray(d.calculs) ? d.calculs : []).slice(-400).map((c) => ({ q: Math.max(0, Math.min(999, Number(c.q) || 0)), expr: texte(c.expr, 160), res: texte(c.res, 40), t: texte(c.t, 30), ...(c.note ? { note: true, ...(c.math ? { math: true } : {}) } : {}) }));
    const precedente = lireJson(brouillon(m.sid), null);
    const valides = (Array.isArray(d.valides) ? d.valides : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 1000).slice(0, 200);
    const titre = (precedente && precedente.titre) || (lireJson(partage(m.classeId, m.sid, 'session.json'), {}) || {}).titre || 'Évaluation';
    const copie = { nom: m.nom, sid: m.sid, classeId: m.classeId, eleveId: m.eleveId, titre, reponses, calculs, valides, surl: surlValides(d.surl), fini: !!d.fini || !!(precedente && precedente.fini), maj: new Date().toISOString() };
    if (precedente && precedente.fini) return { copie: precedente, deja: true }; // copie rendue : plus de changement
    ecrireJson(brouillon(m.sid), copie);
    try { ecrireJson(partage(m.classeId, m.sid, 'copies', m.eleveId + '.json'), copie); } catch { return { copie, horsLigne: true }; }
    return { copie };
  });
  // Évaluations déjà passées sur ce PC (pour relire les corrections après l'examen)
  gerer('eval:mes-evaluations', () => {
    let f = [];
    try { f = fs.readdirSync(local('copies')).filter((x) => x.endsWith('.json')); } catch { /* aucune */ }
    const liste = f.map((x) => lireJson(local('copies', x), null)).filter((c) => c && c.sid && c.classeId && c.eleveId)
      .map((c) => { let corrigee = false; try { corrigee = fs.existsSync(partage(c.classeId, c.sid, 'corrections', c.eleveId + '.json')); } catch { /* hors ligne */ } return { sid: c.sid, titre: c.titre || 'Évaluation', date: c.maj, corrigee, fini: c.fini }; })
      .filter((c) => c.fini || c.corrigee)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return { evaluations: liste };
  });
  gerer('eval:image', (nom, sid) => {
    if (!IMAGE.test(nom || '')) throw new Error('Image invalide.');
    let classeId, ses;
    if (sid) { const b = ID.test(sid) ? lireJson(brouillon(sid), null) : null; if (!b) throw new Error('Évaluation introuvable.'); classeId = b.classeId; ses = sid; }
    else { const m = maSession(); classeId = m.classeId; ses = m.sid; }
    const f = partage(classeId, ses, 'images', nom);
    if (!fs.existsSync(f)) throw new Error('Image introuvable.');
    return { url: dataUrl(f) };
  });
  // PDF de l'exercice (évaluation en cours, ou relecture d'une évaluation passée)
  gerer('eval:pdf-sujet', (sid) => {
    let classeId, ses;
    if (sid) { const b = ID.test(sid) ? lireJson(brouillon(sid), null) : null; if (!b) throw new Error('Évaluation introuvable.'); classeId = b.classeId; ses = sid; }
    else { const m = maSession(); classeId = m.classeId; ses = m.sid; }
    const f = partage(classeId, ses, 'exercice.pdf');
    if (!fs.existsSync(f)) throw new Error('Le sujet n\'est pas encore arrivé : patiente quelques secondes.');
    return { octets: fs.readFileSync(f) };
  });
  gerer('eval:ma-correction', (sid) => {
    if (sid) { // relecture d'une évaluation passée
      const b = ID.test(sid) ? lireJson(brouillon(sid), null) : null;
      if (!b || !b.classeId || !b.eleveId) throw new Error('Évaluation introuvable sur cet ordinateur.');
      return { correction: lireJson(partage(b.classeId, sid, 'corrections', b.eleveId + '.json'), null), etat: 'terminee' };
    }
    const m = maSession();
    const session = lireJson(partage(m.classeId, m.sid, 'session.json'), null);
    const correction = lireJson(partage(m.classeId, m.sid, 'corrections', m.eleveId + '.json'), null);
    return { correction, etat: session ? session.etat : null };
  });


  // =====================================================================================
  // ---------- Notes : système de notation de la classe, carnet par période ----------
  // Réglages et saisies sur le PC de l'enseignant : evaluations/notes/<classe>.json.
  // Notes publiées aux élèves (chacun la sienne) : Classes/<classe>/notes/<élève>.json.
  // Une « partie » de la note (ex. Cours /10) se calcule à partir de sources (QCM de cours, automatismes,
  // évaluations « exercice », notes saisies à la main), avec une règle : dernière évaluation par notion
  // (progression), moyenne, meilleure, ou somme (saisies à la main, ex. comportement + travaux supplémentaires).
  // =====================================================================================
  const SOURCES_NOTES = ['cours', 'automatismes', 'exercices', 'manuel', 'competence'];
  const REGLES_NOTES = ['derniere', 'moyenne', 'meilleure', 'somme'];
  const MODELES_NOTES = {
    progression: { titre: '📈 Progression', parties: [
      { id: 'cours', nom: 'Cours (QCM)', points: 10, bonus: 1.5, regle: 'derniere', sources: [{ type: 'cours', poids: 100 }] },
      { id: 'auto', nom: 'Automatismes', points: 6, bonus: 0, regle: 'derniere', sources: [{ type: 'exercices', poids: 60 }, { type: 'automatismes', poids: 40 }] },
      { id: 'suivi', nom: 'Suivi (séances, travaux supp.)', points: 4, bonus: 0, regle: 'somme', sources: [{ type: 'manuel', poids: 100 }] },
    ] },
    competences: { titre: '🎯 Compétences', parties: REFERENTIEL_DEFAUT.competences.map((c, i) => ({ id: 'c' + (i + 1), nom: c.nom, competence: c.id, points: 4, bonus: 0, regle: 'derniere', sources: [{ type: 'competence', poids: 100 }] })) },
    moyenne: { titre: '🔢 Moyenne classique', parties: [
      { id: 'evals', nom: 'Évaluations', points: 20, bonus: 0, regle: 'moyenne', sources: [{ type: 'cours', poids: 25 }, { type: 'automatismes', poids: 25 }, { type: 'exercices', poids: 25 }, { type: 'manuel', poids: 25 }] },
    ] },
  };
  const anneeScolaire = () => { const d = new Date(); return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; };
  function periodesParDefaut(type) {
    const a = anneeScolaire();
    return type === 'semestres'
      ? [{ num: 1, nom: 'Semestre 1', debut: `${a}-08-20`, fin: `${a + 1}-01-31` }, { num: 2, nom: 'Semestre 2', debut: `${a + 1}-02-01`, fin: `${a + 1}-07-31` }]
      : [{ num: 1, nom: 'Trimestre 1', debut: `${a}-08-20`, fin: `${a}-11-30` }, { num: 2, nom: 'Trimestre 2', debut: `${a}-12-01`, fin: `${a + 1}-02-28` }, { num: 3, nom: 'Trimestre 3', debut: `${a + 1}-03-01`, fin: `${a + 1}-07-31` }];
  }
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  function systemeValide(s = {}) {
    const modele = MODELES_NOTES[s.modele] ? s.modele : 'personnel';
    const parties = (Array.isArray(s.parties) ? s.parties : []).slice(0, 12).map((p, i) => ({
      id: /^[a-z0-9]{1,16}$/i.test(p.id || '') ? p.id : 'p' + crypto.randomBytes(3).toString('hex'),
      nom: texte(p.nom, 50) || `Partie ${i + 1}`,
      points: Math.min(100, Math.max(0.5, Number(p.points) || 1)),
      bonus: Math.min(20, Math.max(0, Number(p.bonus) || 0)),
      regle: REGLES_NOTES.includes(p.regle) ? p.regle : 'derniere',
      ...(ID_REF.test(p.competence || '') ? { competence: p.competence } : {}),
      sources: (Array.isArray(p.sources) ? p.sources : []).filter((x) => SOURCES_NOTES.includes(x.type)).slice(0, 4).map((x) => ({ type: x.type, poids: Math.min(100, Math.max(0, Number(x.poids) || 0)) })),
    })).filter((p) => p.sources.length);
    if (!parties.length) throw new Error('Ajoute au moins une partie à la note, avec une source.');
    const typePeriodes = s.typePeriodes === 'semestres' ? 'semestres' : 'trimestres';
    const defaut = periodesParDefaut(typePeriodes);
    const periodes = (Array.isArray(s.periodes) && s.periodes.length === defaut.length ? s.periodes : defaut).map((p, i) => ({
      num: i + 1, nom: texte(p.nom, 30) || defaut[i].nom, debut: DATE.test(p.debut || '') ? p.debut : defaut[i].debut, fin: DATE.test(p.fin || '') ? p.fin : defaut[i].fin }));
    return { modele, typePeriodes, periodes, parties, partiel: Math.min(1, Math.max(0, s.partiel === undefined ? 0.5 : Number(s.partiel))), sur: 20 };
  }
  const fichierNotes = (classeId) => { if (!ID.test(classeId || '')) throw new Error('Classe invalide.'); return local('notes', classeId + '.json'); };
  function lireNotes(classeId) {
    const d = lireJson(fichierNotes(classeId), null) || {};
    if (!d.systeme) {
      const cl = espace.lireClasse(classeId) || {};
      d.systeme = systemeValide({ modele: 'progression', parties: MODELES_NOTES.progression.parties, typePeriodes: /bac/i.test(cl.niveau || '') && !/cap/i.test(cl.niveau || '') ? 'semestres' : 'trimestres' });
    }
    return { systeme: d.systeme, saisies: d.saisies || [], appreciations: d.appreciations || {}, publie: d.publie || {} };
  }
  const ecrireNotes = (classeId, d) => ecrireJson(fichierNotes(classeId), d);
  const dansPeriode = (date, p) => { const j = String(date || '').slice(0, 10); return j >= p.debut && j <= p.fin; };
  // Résultats d'un élève, source par source, dans la période : des « éléments » { cle, date, ratio, titre, coef }
  function elementsEleve(classeId, eleveId, periode, sessions, saisies, partieId) {
    const el = { cours: [], automatismes: [], exercices: [], manuel: [] };
    for (const s of sessions) {
      if (!dansPeriode(s.debut, periode) || !s.sujets[eleveId]) continue;
      let copie = null;
      try { copie = lireCopie(s, eleveId); } catch { /* dossier partagé indisponible */ }
      if (!copie) continue; // absent : la session ne compte pas
      if (estExercice(s)) {
        if (!estNotee(s, eleveId)) continue;
        const q = notesDe(s, eleveId).questions || {};
        const n = s.zones.reduce((t, z) => t + (z.points || 1), 0); if (!n) continue;
        const pts = s.zones.reduce((t, z, i) => t + (z.points || 1) * ((q[i] || {}).v === 'juste' ? 1 : (q[i] || {}).v === 'partiel' ? partielDe(classeId) : 0), 0);
        el.exercices.push({ cle: s.sid, date: s.debut, ratio: pts / n, titre: s.titre, coef: 1, unique: true });
        continue;
      }
      if (!(s.corrige || {})[eleveId] && s.etat !== 'terminee') continue;
      const r = corrigerCopie(s, eleveId, copie); if (!r) continue;
      const parNotion = {};
      for (const l of r.lignes) { const k = l.partie === 'cours' ? 'cours' : 'automatismes'; const c = `${k}|${l.cle}`; (parNotion[c] = parNotion[c] || { k, cle: l.cle, notion: l.notion, j: 0, n: 0 }); parNotion[c].n++; if (l.juste) parNotion[c].j++; }
      for (const x of Object.values(parNotion)) el[x.k].push({ cle: x.cle, date: s.debut, ratio: x.j / x.n, titre: `${s.titre} · ${x.notion}`, coef: 1 });
    }
    for (const sa of saisies) {
      if (sa.partie !== partieId || !dansPeriode(sa.date, periode)) continue;
      const v = (sa.notes || {})[eleveId];
      if (v === undefined || v === null || v === '' || v === 'abs') continue;
      el.manuel.push({ cle: sa.id, date: sa.date, ratio: Number(v) / sa.sur, brut: (Number(v) / sa.sur) * (sa.comptePour ?? sa.sur), titre: `${sa.titre} : ${String(v).replace('.', ',')}/${String(sa.sur).replace('.', ',')}`, coef: sa.coef || 1, unique: true });
    }
    return el;
  }
  let partielCourant = 0.5;
  const partielDe = () => partielCourant;
  // Règle appliquée aux éléments d'une source → ratio (0..1) ; « dernière » : par notion, la plus récente compte (progression)
  function appliquerRegle(elements, regle) {
    if (!elements.length) return null;
    if (regle === 'derniere') {
      const parCle = {};
      for (const e of [...elements].sort((a, b) => String(a.date).localeCompare(String(b.date)))) parCle[e.cle] = e;
      const cles = Object.values(parCle);
      // évaluations « exercice » et saisies : chaque élément a sa propre clé → seul le plus récent compte
      const derniers = cles.every((e) => e.unique) ? [cles.sort((a, b) => String(a.date).localeCompare(String(b.date))).pop()] : cles;
      return { ratio: derniers.reduce((t, e) => t + e.ratio, 0) / derniers.length, retenus: derniers };
    }
    if (regle === 'meilleure') { const m = elements.reduce((a, b) => (b.ratio > a.ratio ? b : a)); return { ratio: m.ratio, retenus: [m] }; }
    const c = elements.reduce((t, e) => t + (e.coef || 1), 0);
    return { ratio: elements.reduce((t, e) => t + e.ratio * (e.coef || 1), 0) / c, retenus: elements };
  }
  function calculerNotes(classeId, num) {
    const cl = espace.lireClasse(classeId);
    if (!cl) throw new Error('Classe introuvable.');
    const d = lireNotes(classeId), sys = d.systeme;
    partielCourant = sys.partiel;
    const periode = sys.periodes.find((p) => p.num === Number(num)) || sys.periodes[0];
    let fichiers = [];
    try { fichiers = fs.readdirSync(local('sessions')).filter((f) => f.endsWith('.json')); } catch { /* aucune */ }
    const sessions = fichiers.map((f) => lireSession(f.slice(0, -5))).filter((s) => s && s.classeId === classeId);
    const comps = sys.parties.some((p) => p.sources.some((x) => x.type === 'competence')) ? calculerCompetences(classeId, periode.num, sessions) : null;
    const eleves = (cl.eleves || []).map((e) => {
      const parties = {};
      let total = 0, max = 0;
      const ce = comps && comps.eleves.find((x) => x.eleveId === e.id);
      for (const p of sys.parties) {
        const el = elementsEleve(classeId, e.id, periode, sessions, d.saisies, p.id);
        let score = null; const detail = [];
        if (p.regle === 'somme') {
          const tous = p.sources.flatMap((x) => el[x.type]);
          if (tous.length) { score = Math.min(p.points, tous.reduce((t, x) => t + (x.brut ?? x.ratio * p.points), 0)); detail.push(...tous.map((x) => x.titre)); }
        } else {
          let somme = 0, poids = 0;
          for (const src of p.sources) {
            const c = src.type === 'competence' && ce && p.competence ? ce.comp[p.competence] : null;
            const r = src.type === 'competence' ? (c && c.ratio !== null ? { ratio: c.ratio, retenus: c.detail.map((t) => ({ titre: t.replace(/ \(\d+ %\)$/, ''), ratio: Number((t.match(/\((\d+) %\)$/) || [0, 0])[1]) / 100 })) } : null) : appliquerRegle(el[src.type], p.regle);
            if (!r || !src.poids) continue;
            somme += r.ratio * src.poids; poids += src.poids;
            detail.push(...r.retenus.map((x) => `${x.titre} (${Math.round(x.ratio * 100)} %)`));
          }
          if (poids) score = Math.min(p.points, (somme / poids) * p.points + p.bonus);
        }
        parties[p.id] = { score: score === null ? null : Math.round(score * 100) / 100, detail };
        if (score !== null) { total += score; max += p.points; }
      }
      const note = max ? Math.round((total / max) * 20 * 100) / 100 : null;
      return { eleveId: e.id, nom: e.nom, parties, total: Math.round(total * 100) / 100, max, note, appreciation: ((d.appreciations[periode.num] || {})[e.id]) || '' };
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const avec = eleves.filter((x) => x.note !== null);
    const coefs = coefsPronote(sys.parties);
    eleves.forEach((e) => { e.pronote = Object.fromEntries(sys.parties.map((p) => [p.id, sur20(e.parties[p.id].score, p.points)])); e.negatif = sys.parties.some((p) => (e.parties[p.id].score ?? 0) < 0); });
    return { coefs, systeme: sys, periode, eleves, moyenne: avec.length ? Math.round((avec.reduce((t, x) => t + x.note, 0) / avec.length) * 100) / 100 : null, saisies: d.saisies.filter((s) => dansPeriode(s.date, periode)), publie: !!d.publie[periode.num], modeles: Object.fromEntries(Object.entries(MODELES_NOTES).map(([k, m]) => [k, m.titre])) };
  }
  // Pronote : chaque partie = un devoir noté sur 20, coefficient = ses points (simplifiés : 10, 6, 4 → 5, 3, 2).
  // La moyenne pondérée de Pronote retombe alors exactement sur la note /20 du carnet.
  function coefsPronote(parties) {
    const pts = parties.map((p) => p.points);
    const pgcd = (a, b) => (b ? pgcd(b, a % b) : a);
    const entiers = pts.every((x) => Number.isInteger(x));
    const d = entiers ? pts.reduce((a, b) => pgcd(a, b)) : pts.every((x) => Number.isInteger(x * 2)) ? 0.5 : 1;
    return Object.fromEntries(parties.map((p) => [p.id, Math.round((p.points / (entiers ? d : 1)) * 100) / 100]));
  }
  const sur20 = (score, points) => (score === null || score === undefined ? null : Math.round((Math.max(0, score) / points) * 20 * 100) / 100);
  const lireReferentiel = () => { const r = lireJson(local('referentiel.json'), null); return r ? referentielValide(r) : JSON.parse(JSON.stringify(REFERENTIEL_DEFAUT)); };
  // Travaux à rendre de la classe (dans les thèmes), avec leurs questions
  const travauxDe = (cl) => { const t = []; const voir = (ns) => (ns || []).forEach((n) => { if (n.type === 'travail' && (n.questions || []).length) t.push(n); if (n.enfants) voir(n.enfants); }); voir(cl.contenu); return t; };
  // Résultats « étiquetés » d'un élève dans la période : une ligne par question qui porte une compétence ou un objectif.
  // Progression : pour une même question repassée, la dernière fois compte.
  function itemsEtiquetes(classeId, eleveId, periode, sessions, travaux) {
    const items = [];
    for (const s of sessions) {
      if (!dansPeriode(s.debut, periode) || !s.sujets[eleveId]) continue;
      let copie = null;
      try { copie = lireCopie(s, eleveId); } catch { /* dossier partagé indisponible */ }
      if (!copie) continue;
      if (estExercice(s)) {
        if (!estNotee(s, eleveId)) continue;
        const q = notesDe(s, eleveId).questions || {};
        s.zones.forEach((z, i) => { const v = (q[i] || {}).v; if (!v || !(z.competence || z.objectif)) return;
          items.push({ cle: `z:${s.evalId}:${z.id}`, competence: z.competence, objectif: z.objectif, poids: z.points || 1, date: s.debut, ratio: v === 'juste' ? 1 : v === 'partiel' ? partielCourant : 0, titre: `${s.titre} · ${z.nom}` }); });
        continue;
      }
      if (!(s.corrige || {})[eleveId] && s.etat !== 'terminee') continue;
      const r = corrigerCopie(s, eleveId, copie); if (!r) continue;
      r.lignes.forEach((l, n) => { const x = s.sujets[eleveId].questions[n]; if (!x || !(x.competence || x.objectif)) return;
        items.push({ cle: `q:${x.qid}`, competence: x.competence, objectif: x.objectif, poids: x.points || 1, date: s.debut, ratio: l.juste ? 1 : 0, titre: `${s.titre} · question ${n + 1}` }); });
    }
    for (const t of travaux) {
      let ret = null;
      try { ret = lireJson(path.join(racine(), classeId, 'travaux', t.id, 'retours', eleveId + '.json'), null); } catch { /* indisponible */ }
      if (!ret || !dansPeriode(ret.date, periode)) continue;
      t.questions.forEach((z) => { const v = ((ret.questions || {})[z.id] || {}).v; if (!v || !(z.competence || z.objectif)) return;
        items.push({ cle: `t:${t.id}:${z.id}`, competence: z.competence, objectif: z.objectif, poids: z.points || 1, date: ret.date, ratio: v === 'juste' ? 1 : v === 'partiel' ? partielCourant : 0, titre: `${t.nom} · ${z.nom}` }); });
    }
    const dernier = {};
    for (const it of items.sort((a, b) => String(a.date).localeCompare(String(b.date)))) dernier[it.cle] = it;
    return Object.values(dernier);
  }
  function calculerCompetences(classeId, num, sessionsDonnees = null) {
    const cl = espace.lireClasse(classeId);
    if (!cl) throw new Error('Classe introuvable.');
    const d = lireNotes(classeId), ref = lireReferentiel();
    partielCourant = d.systeme.partiel;
    const periode = d.systeme.periodes.find((p) => p.num === Number(num)) || d.systeme.periodes[0];
    let sessions = sessionsDonnees;
    if (!sessions) { let fichiers = []; try { fichiers = fs.readdirSync(local('sessions')).filter((x) => x.endsWith('.json')); } catch { /* aucune */ } sessions = fichiers.map((x) => lireSession(x.slice(0, -5))).filter((x) => x && x.classeId === classeId); }
    const travaux = travauxDe(cl);
    const moyenne = (its) => { const p = its.reduce((t, x) => t + x.poids, 0); return p ? its.reduce((t, x) => t + x.ratio * x.poids, 0) / p : null; };
    const eleves = (cl.eleves || []).map((e) => {
      const its = itemsEtiquetes(classeId, e.id, periode, sessions, travaux);
      const comp = {}, obj = {};
      for (const c of ref.competences) { const l = its.filter((x) => x.competence === c.id); const r = moyenne(l); comp[c.id] = { ratio: r === null ? null : Math.round(r * 1000) / 1000, niveau: niveauDe(r), n: l.length, detail: l.map((x) => `${x.titre} (${Math.round(x.ratio * 100)} %)`) }; }
      for (const o of ref.objectifs) { const l = its.filter((x) => x.objectif === o.id); const r = moyenne(l); obj[o.id] = { ratio: r === null ? null : Math.round(r * 1000) / 1000, etat: etatObjectif(r), n: l.length, detail: l.map((x) => `${x.titre} (${Math.round(x.ratio * 100)} %)`) }; }
      return { eleveId: e.id, nom: e.nom, comp, obj };
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return { referentiel: ref, niveaux: NIVEAUX_COMP.map(([id, nom, seuil]) => ({ id, nom, seuil })), periode, eleves };
  }
  const exigerClasseProf = (classeId) => { exigerProf(); if (!espace.lireClasse(classeId)) throw new Error('Classe introuvable.'); };
  gerer('eval:referentiel', () => { exigerProf(); return { referentiel: lireReferentiel(), niveaux: NIVEAUX_COMP.map(([id, nom, seuil]) => ({ id, nom, seuil })) }; });
  // Export : classeur Excel (Compétences, Objectifs) ou .json — pour le garder, le partager avec un collègue, le réimporter.
  gerer('eval:referentiel-exporter', async () => {
    exigerProf();
    const ref = lireReferentiel();
    const choix = await dialogues.enregistrer({ title: 'Exporter mes compétences et objectifs', defaultPath: 'Référentiel compétences et objectifs.xlsx', filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }, { name: 'Fichier .json', extensions: ['json'] }] });
    if (choix.canceled || !choix.filePath) return { annule: true };
    const noms = Object.fromEntries(NIVEAUX_COMP.map(([id, nom]) => [id, nom])), nomComp = Object.fromEntries(ref.competences.map((c) => [c.id, c.nom]));
    if (/\.json$/i.test(choix.filePath)) fs.writeFileSync(choix.filePath, JSON.stringify({ format: 'labo-referentiel', version: 1, ...ref }, null, 2));
    else ecrireClasseur(choix.filePath, [
      { nom: 'Compétences', lignes: [['Compétence', 'Niveau visé'], ...ref.competences.map((c) => [c.nom, noms[c.vise]])] },
      { nom: 'Objectifs', lignes: [['Séquence', 'Objectif', 'Compétence'], ...ref.objectifs.map((o) => [o.sequence, o.nom, nomComp[o.competence] || ''])] },
      { nom: 'Mode d’emploi', lignes: [['Niveaux possibles : ' + NIVEAUX_COMP.map((n) => n[1]).join(', ')], ['Compétence d’un objectif : le nom exact d’une compétence de la première feuille (ou vide).'], ['Réimporter : Labo Prof › classe › 📊 Notes › 📚 Référentiel › 📥 Importer.']] },
    ]);
    return { fichier: choix.filePath, competences: ref.competences.length, objectifs: ref.objectifs.length };
  });
  // Import : ajouté au référentiel actuel (même nom = mis à jour), rien n'est supprimé.
  gerer('eval:referentiel-importer', async () => {
    exigerProf();
    const choix = await dialogues.ouvrir({ title: 'Importer des compétences et objectifs', buttonLabel: 'Importer', properties: ['openFile'], filters: [{ name: 'Référentiel (Excel ou .json)', extensions: ['xlsx', 'json'] }] });
    if (choix.canceled || !choix.filePaths.length) return { annule: true };
    const fichier = choix.filePaths[0];
    let comps = [], objs = [];
    const nv = (t) => { const n = norme(t); const x = NIVEAUX_COMP.find((k) => norme(k[1]) === n || k[0] === n); return x ? x[0] : 'a'; };
    if (/\.json$/i.test(fichier)) {
      let d; try { d = JSON.parse(fs.readFileSync(fichier, 'utf8')); } catch { throw new Error('Le fichier .json est illisible.'); }
      const idNom = Object.fromEntries((d.competences || []).map((c) => [c.id, c.nom]));
      comps = (d.competences || []).map((c) => ({ nom: texte(c.nom, 50), vise: c.vise }));
      objs = (d.objectifs || []).map((o) => ({ sequence: texte(o.sequence, 80), nom: texte(o.nom, 120), competence: idNom[o.competence] || '' }));
    } else {
      const feuilles = lireClasseur(fichier);
      const fc = feuilles.find((f) => /comp/i.test(f.nom)), fo = feuilles.find((f) => /obj/i.test(f.nom));
      if (!fc && !fo) throw new Error('Le classeur doit avoir une feuille « Compétences » et/ou « Objectifs ».');
      if (fc) comps = fc.lignes.slice(1).filter((l) => String(l[0] || '').trim()).map((l) => ({ nom: texte(l[0], 50), vise: nv(l[1]) }));
      if (fo) objs = fo.lignes.slice(1).filter((l) => String(l[1] || '').trim()).map((l) => ({ sequence: texte(l[0], 80), nom: texte(l[1], 120), competence: texte(l[2], 50) }));
    }
    const ref = lireReferentiel();
    let ajC = 0, ajO = 0, majO = 0;
    for (const c of comps) {
      if (!c.nom) continue;
      const ex = ref.competences.find((x) => norme(x.nom) === norme(c.nom));
      if (ex) { if (c.vise) ex.vise = c.vise; } else { ref.competences.push({ nom: c.nom, vise: c.vise || 'a' }); ajC++; }
    }
    let r = referentielValide(ref); // ids des nouvelles compétences
    for (const o of objs) {
      if (!o.nom) continue;
      const comp = r.competences.find((x) => norme(x.nom) === norme(o.competence));
      const ex = r.objectifs.find((x) => norme(x.nom) === norme(o.nom) && norme(x.sequence) === norme(o.sequence));
      if (ex) { ex.competence = comp ? comp.id : ex.competence; majO++; } else { r.objectifs.push({ sequence: o.sequence, nom: o.nom, competence: comp ? comp.id : '' }); ajO++; }
    }
    r = referentielValide(r);
    ecrireJson(local('referentiel.json'), r);
    return { referentiel: r, ajC, ajO, majO };
  });
  gerer('eval:referentiel-enregistrer', (r) => { exigerProf(); const x = referentielValide(r); ecrireJson(local('referentiel.json'), x); return { referentiel: x }; });
  gerer('notes:competences', (classeId, num) => { exigerClasseProf(classeId); return calculerCompetences(classeId, num); });
  gerer('notes:calcul', (classeId, num) => { exigerClasseProf(classeId); return calculerNotes(classeId, num); });
  gerer('notes:modele', (cle) => { exigerProf(); const m = MODELES_NOTES[cle]; if (!m) throw new Error('Modèle inconnu.'); return { parties: JSON.parse(JSON.stringify(m.parties)) }; });
  gerer('notes:systeme', (classeId, systeme) => {
    exigerClasseProf(classeId);
    const d = lireNotes(classeId);
    d.systeme = systemeValide(systeme);
    ecrireNotes(classeId, d);
    return { systeme: d.systeme };
  });
  gerer('notes:saisie', (classeId, s = {}) => {
    exigerClasseProf(classeId);
    const d = lireNotes(classeId), cl = espace.lireClasse(classeId);
    if (!d.systeme.parties.some((p) => p.id === s.partie && p.sources.some((x) => x.type === 'manuel'))) throw new Error('Choisis une partie de la note qui accepte les notes saisies à la main.');
    const sur = Math.min(1000, Math.max(0.5, Number(String(s.sur).replace(',', '.')) || 20));
    const notes = {};
    for (const e of cl.eleves || []) {
      const v = (s.notes || {})[e.id];
      if (v === 'abs') notes[e.id] = 'abs';
      else if (v !== undefined && v !== null && String(v).trim() !== '') { const n = Number(String(v).replace(',', '.')); if (Number.isFinite(n)) notes[e.id] = Math.min(sur, Math.max(-sur, n)); }
    }
    const x = { id: /^n[a-z0-9]{6,12}$/.test(s.id || '') ? s.id : 'n' + crypto.randomBytes(4).toString('hex'), titre: texte(s.titre, 60) || 'Note', date: DATE.test(s.date || '') ? s.date : new Date().toISOString().slice(0, 10),
      partie: s.partie, sur, coef: Math.min(10, Math.max(0.1, Number(String(s.coef || 1).replace(',', '.')) || 1)), ...(s.comptePour !== undefined && s.comptePour !== '' ? { comptePour: Math.min(100, Math.max(0, Number(String(s.comptePour).replace(',', '.')) || 0)) } : {}), notes };
    d.saisies = [...d.saisies.filter((y) => y.id !== x.id), x];
    ecrireNotes(classeId, d);
    return { saisie: x };
  });
  gerer('notes:supprimer-saisie', (classeId, id) => { exigerClasseProf(classeId); const d = lireNotes(classeId); d.saisies = d.saisies.filter((y) => y.id !== id); ecrireNotes(classeId, d); return {}; });
  gerer('notes:appreciation', (classeId, num, eleveId, t) => {
    exigerClasseProf(classeId);
    const d = lireNotes(classeId);
    d.appreciations[num] = { ...(d.appreciations[num] || {}), [eleveId]: texte(t, 600) };
    ecrireNotes(classeId, d);
    return {};
  });
  // Publier : chaque élève reçoit sa note de la période et son détail (dans le dossier partagé, un fichier par élève).
  gerer('notes:publier', (classeId, num, publier = true) => {
    exigerClasseProf(classeId);
    const r = calculerNotes(classeId, num), d = lireNotes(classeId);
    const dossier = path.join(racine() || '', classeId, 'notes');
    if (!racine()) throw new Error('Dossier partagé indisponible.');
    let n = 0;
    const comps = calculerCompetences(classeId, r.periode.num);
    const NOMS_NIV = Object.fromEntries(NIVEAUX_COMP.map(([id, nom]) => [id, nom]));
    for (const e of r.eleves) {
      const f = path.join(dossier, e.eleveId + '.json');
      const ce = comps.eleves.find((x) => x.eleveId === e.eleveId) || { comp: {}, obj: {} };
      const competences = comps.referentiel.competences.filter((c) => ce.comp[c.id] && ce.comp[c.id].n).map((c) => ({ nom: c.nom, niveau: NOMS_NIV[ce.comp[c.id].niveau], vise: NOMS_NIV[c.vise], atteint: NIVEAUX_COMP.findIndex((x) => x[0] === ce.comp[c.id].niveau) >= NIVEAUX_COMP.findIndex((x) => x[0] === c.vise) }));
      const objectifs = comps.referentiel.objectifs.filter((o) => ce.obj[o.id] && ce.obj[o.id].n).map((o) => ({ nom: o.nom, sequence: o.sequence, etat: ce.obj[o.id].etat }));
      const deja = lireJson(f, { periodes: {} });
      if (publier && e.note !== null) {
        deja.periodes[r.periode.num] = { competences, objectifs, nom: r.periode.nom, note: e.note, parties: r.systeme.parties.map((p) => ({ nom: p.nom, points: p.points, score: e.parties[p.id].score, detail: e.parties[p.id].detail.slice(0, 30) })), appreciation: e.appreciation, date: new Date().toISOString() };
        n++;
      } else delete deja.periodes[r.periode.num];
      ecrireJson(f, deja);
    }
    d.publie[r.periode.num] = !!publier;
    ecrireNotes(classeId, d);
    return { eleves: n };
  });
  gerer('notes:exporter', async (classeId, num) => {
    exigerClasseProf(classeId);
    const r = calculerNotes(classeId, num), cl = espace.lireClasse(classeId);
    const choix = await dialogues.enregistrer({ title: 'Exporter les notes', defaultPath: `Notes ${cl.nom} - ${r.periode.nom}.xlsx`.replace(/[\\/:*?"<>|]/g, '-'), filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }] });
    if (choix.canceled || !choix.filePath) return { annule: true };
    const vf = (x) => (x === null || x === undefined ? '' : x);
    ecrireClasseur(choix.filePath, [{ nom: r.periode.nom.slice(0, 31), lignes: [
      ['Élève', ...r.systeme.parties.map((p) => `${p.nom} (/${p.points})`), 'Note /20', 'Appréciation'],
      ...r.eleves.map((e) => [e.nom, ...r.systeme.parties.map((p) => vf(e.parties[p.id].score)), vf(e.note), e.appreciation]),
      [], ['Moyenne de la classe', ...r.systeme.parties.map(() => ''), vf(r.moyenne)],
    ] }, { nom: 'Pronote', lignes: [
      ['À saisir dans Pronote : un devoir par partie, noté sur 20, avec ce coefficient.'],
      ['Élève', ...r.systeme.parties.map((p) => `${p.nom} (/20)`), 'Moyenne obtenue /20'],
      ['Coefficient', ...r.systeme.parties.map((p) => r.coefs[p.id]), ''],
      ...r.eleves.map((e) => [e.nom, ...r.systeme.parties.map((p) => vf(e.pronote[p.id])), vf(e.note)]),
    ] }]);
    return { fichier: choix.filePath };
  });
  // Élève : ses notes publiées (classe active)
  gerer('notes:mes-notes', () => {
    const el = espace.eleve && espace.eleve();
    if (!el || !ID.test(el.classeId || '') || !ID.test(el.eleveId || '') || !racine()) return { periodes: {} };
    return lireJson(path.join(racine(), el.classeId, 'notes', el.eleveId + '.json'), { periodes: {} });
  });

  // =====================================================================================
  // ---------- Entraînement des élèves ----------
  // L'enseignant ouvre, classe par classe, des chapitres / automatismes de sa banque et des modules d'exercices.
  // Dossier partagé : Classes/<classe>/entrainement/contenu.json (questions AVEC leurs réponses : c'est de l'entraînement),
  //   images/, pdf/, suivi/<élève>.json (ce que l'élève a travaillé : séries faites, réussite, modules).
  // Modules d'exercices (sur le PC de l'enseignant) : evaluations/modules.json — une fiche PDF, ses questions (zones)
  //   avec la correction de l'enseignant, et éventuellement un PDF du corrigé.
  // =====================================================================================
  const lireModules = () => lireJson(local('modules.json'), { modules: [] }).modules || [];
  const ecrireModules = (m) => ecrireJson(local('modules.json'), { modules: m });
  const dossierEntr = (classeId, ...p) => { if (!ID.test(classeId || '') || !racine()) throw new Error('Dossier partagé indisponible.'); return path.join(racine(), classeId, 'entrainement', ...p); };
  gerer('entr:modules', () => { exigerProf(); return { modules: lireModules() }; });
  gerer('entr:module-enregistrer', (d = {}) => {
    exigerProf();
    const liste = lireModules(), ancien = liste.find((x) => x.id === d.id);
    const m = { id: ID.test(d.id || '') ? d.id : nouvelId('m'), titre: texte(d.titre, 80), chapitre: texte(d.chapitre, 80),
      notions: (Array.isArray(d.notions) ? d.notions : String(d.notions || '').split(/[,;\n]/)).map((x) => texte(x, 60)).filter(Boolean).slice(0, 10),
      pdf: PDF.test(d.pdf || '') ? d.pdf : null, nomPdf: texte(d.nomPdf, 120), corrige: PDF.test(d.corrige || '') ? d.corrige : null, nomCorrige: texte(d.nomCorrige, 120),
      zones: ancien && ancien.pdf === d.pdf ? ancien.zones : [], modifie: new Date().toISOString() };
    if (!m.titre) throw new Error('Donne un titre au module (ex. Dériver une fonction de degré 3).');
    if (!m.chapitre) throw new Error('Indique le chapitre.');
    if (!m.pdf || !fs.existsSync(local('pdfs', m.pdf))) throw new Error('Choisis la fiche d’exercices (PDF).');
    ecrireModules([...liste.filter((x) => x.id !== m.id), m]);
    return { module: m };
  });
  gerer('entr:module-supprimer', (id) => { exigerProf(); ecrireModules(lireModules().filter((x) => x.id !== id)); return {}; });
  gerer('entr:module-exercice', (id) => { exigerProf(); const m = lireModules().find((x) => x.id === id); if (!m) throw new Error('Module introuvable.'); return { module: m, octets: fs.readFileSync(local('pdfs', m.pdf)) }; });
  gerer('entr:module-zones', (id, zones) => {
    exigerProf();
    const liste = lireModules(), m = liste.find((x) => x.id === id);
    if (!m) throw new Error('Module introuvable.');
    m.zones = zonesValides(zones); m.modifie = new Date().toISOString();
    ecrireModules(liste);
    return { module: m };
  });
  // ouverture à une classe
  const lireOuverture = (classeId) => lireJson(local('entrainement', classeId + '.json'), { cles: [], modules: [] });
  function publierEntrainement(classeId) {
    const o = lireOuverture(classeId), banque = lireBanque(), modules = lireModules();
    const questions = banque.filter((q) => (q.partie === 'cours' ? o.cles.includes(`${q.chapitre} › cours`) : o.cles.includes(cle(q))));
    fs.mkdirSync(dossierEntr(classeId, 'images'), { recursive: true });
    fs.mkdirSync(dossierEntr(classeId, 'pdf'), { recursive: true });
    for (const n of new Set(questions.flatMap((q) => [q.image, ...(q.choix || []).map((c) => c.image)]).filter(Boolean))) if (fs.existsSync(local('images', n)) && !fs.existsSync(dossierEntr(classeId, 'images', n))) fs.copyFileSync(local('images', n), dossierEntr(classeId, 'images', n));
    const mods = modules.filter((m) => o.modules.includes(m.id) && m.zones.length);
    for (const m of mods) for (const p of [m.pdf, m.corrige].filter(Boolean)) if (fs.existsSync(local('pdfs', p)) && !fs.existsSync(dossierEntr(classeId, 'pdf', p))) fs.copyFileSync(local('pdfs', p), dossierEntr(classeId, 'pdf', p));
    ecrireJson(dossierEntr(classeId, 'contenu.json'), { maj: new Date().toISOString(), questions, modules: mods.map((m) => ({ id: m.id, titre: m.titre, chapitre: m.chapitre, notions: m.notions, pdf: m.pdf, corrige: m.corrige, zones: m.zones })) });
    return { questions: questions.length, modules: mods.length };
  }
  gerer('entr:ouverture', (classeId) => {
    exigerClasseProf(classeId);
    return { ouverture: lireOuverture(classeId), modules: lireModules().map((m) => ({ id: m.id, titre: m.titre, chapitre: m.chapitre, notions: m.notions, questions: m.zones.length })) };
  });
  gerer('entr:ouvrir', (classeId, o = {}) => {
    exigerClasseProf(classeId);
    const x = { cles: (Array.isArray(o.cles) ? o.cles : []).map((k) => texte(k, 150)).filter(Boolean).slice(0, 500), modules: (Array.isArray(o.modules) ? o.modules : []).filter((k) => ID.test(k)).slice(0, 200) };
    ecrireJson(local('entrainement', classeId + '.json'), x);
    return publierEntrainement(classeId);
  });
  gerer('entr:suivi', (classeId) => {
    exigerClasseProf(classeId);
    const cl = espace.lireClasse(classeId);
    return { eleves: (cl.eleves || []).map((e) => ({ eleveId: e.id, nom: e.nom, suivi: lireJson(dossierEntr(classeId, 'suivi', e.id + '.json'), null) })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) };
  });
  // ----- élève -----
  const moiEntr = () => {
    const el = espace.eleve && espace.eleve();
    if (!el || !ID.test(el.classeId || '') || !ID.test(el.eleveId || '')) throw new Error('Choisis d’abord ta classe.');
    return el;
  };
  const contenuEntr = (el) => lireJson(dossierEntr(el.classeId, 'contenu.json'), { questions: [], modules: [] });
  gerer('entr:contenu', () => {
    let el; try { el = moiEntr(); } catch { return { chapitres: [], modules: [] }; }
    const c = contenuEntr(el), chap = {};
    for (const q of c.questions) {
      const x = (chap[q.chapitre] = chap[q.chapitre] || { chapitre: q.chapitre, cours: 0, automatismes: {} });
      if (q.partie === 'cours') x.cours++; else x.automatismes[q.notion] = (x.automatismes[q.notion] || 0) + 1;
    }
    for (const m of c.modules) chap[m.chapitre] = chap[m.chapitre] || { chapitre: m.chapitre, cours: 0, automatismes: {} };
    const suivi = lireJson(dossierEntr(el.classeId, 'suivi', el.eleveId + '.json'), { series: {}, modules: {} });
    return { chapitres: Object.values(chap).sort((a, b) => a.chapitre.localeCompare(b.chapitre, 'fr', { numeric: true })).map((x) => ({ ...x, automatismes: Object.entries(x.automatismes).map(([notion, n]) => ({ notion, n })) })),
      modules: c.modules.map((m) => ({ id: m.id, titre: m.titre, chapitre: m.chapitre, notions: m.notions, questions: m.zones.length, corrige: !!m.corrige })), suivi };
  });
  // une série : des questions tirées au hasard (avec leurs nombres), corrigées tout de suite
  gerer('entr:serie', (d = {}) => {
    const el = moiEntr(), c = contenuEntr(el);
    const pool = c.questions.filter((q) => q.chapitre === d.chapitre && (d.partie === 'cours' ? q.partie === 'cours' : q.partie !== 'cours' && q.notion === d.notion));
    if (!pool.length) throw new Error('Plus de questions ouvertes ici : demande à ton professeur.');
    const n = Math.min(20, Math.max(1, Number(d.nombre) || 10));
    const tirees = [];
    while (tirees.length < n) tirees.push(...melanger(pool).slice(0, n - tirees.length));
    return { questions: tirees.map((q) => { const x = instancier(q); return { ...x, multiple: x.type === 'qcm' && x.justes.length > 1 }; }) };
  });
  gerer('entr:verifier', (x, rep) => ({ juste: estJuste(x, rep), attendu: texteAttendu(x) }));
  gerer('entr:image', (nom) => {
    const el = moiEntr();
    if (!IMAGE.test(nom || '')) throw new Error('Image invalide.');
    const f = dossierEntr(el.classeId, 'images', nom);
    if (!fs.existsSync(f)) throw new Error('Image introuvable.');
    return { url: dataUrl(f) };
  });
  const brouillonModule = (el, id) => local('entrainement-eleve', `${el.classeId}--${id}.json`);
  gerer('entr:module', (id) => {
    const el = moiEntr(), m = contenuEntr(el).modules.find((x) => x.id === id);
    if (!m) throw new Error('Ce module n’est plus ouvert.');
    const f = dossierEntr(el.classeId, 'pdf', m.pdf);
    if (!fs.existsSync(f)) throw new Error('La fiche n’est pas disponible pour l’instant.');
    return { module: m, octets: fs.readFileSync(f), copie: lireJson(brouillonModule(el, id), null) };
  });
  gerer('entr:corrige', (id) => {
    const el = moiEntr(), m = contenuEntr(el).modules.find((x) => x.id === id);
    if (!m || !m.corrige) throw new Error('Pas de corrigé pour ce module.');
    return { octets: fs.readFileSync(dossierEntr(el.classeId, 'pdf', m.corrige)) };
  });
  gerer('entr:module-sauver', (id, d = {}) => {
    const el = moiEntr();
    if (!ID.test(id || '')) throw new Error('Module invalide.');
    const reponses = {};
    for (const [k, v] of Object.entries(d.reponses || {})) { if (!/^\d{1,3}$/.test(k)) continue; if (Array.isArray(v)) reponses[k] = lignesValides(v); else if (v && typeof v === 'object') reponses[k] = tableauValide(v); }
    const copie = { reponses, surl: surlValides(d.surl), valides: (Array.isArray(d.valides) ? d.valides : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 200), fini: !!d.fini, auto: d.auto && typeof d.auto === 'object' ? Object.fromEntries(Object.entries(d.auto).filter(([k, v]) => /^\d{1,3}$/.test(k) && ['juste', 'partiel', 'faux'].includes(v))) : {}, maj: new Date().toISOString() };
    ecrireJson(brouillonModule(el, id), copie);
    return { copie };
  });
  // ce que l'élève a travaillé (pour le résumé de l'enseignant)
  gerer('entr:progres', (d = {}) => {
    const el = moiEntr();
    const f = dossierEntr(el.classeId, 'suivi', el.eleveId + '.json');
    const x = lireJson(f, { series: {}, modules: {} });
    x.nom = el.nom || x.nom || ''; x.maj = new Date().toISOString();
    if (d.serie && typeof d.serie === 'object') {
      const k = texte(d.serie.cle, 150); if (k) { const s0 = x.series[k] || { faites: 0, questions: 0, justes: 0 }; s0.faites++; s0.questions += Math.min(50, Math.max(0, Number(d.serie.questions) || 0)); s0.justes += Math.min(50, Math.max(0, Number(d.serie.justes) || 0)); s0.derniere = { date: x.maj, questions: Number(d.serie.questions) || 0, justes: Number(d.serie.justes) || 0 }; x.series[k] = s0; }
    }
    if (d.module && ID.test(d.module.id || '')) { const a = d.module.auto || {}; x.modules[d.module.id] = { date: x.maj, titre: texte(d.module.titre, 80), juste: Object.values(a).filter((v) => v === 'juste').length, partiel: Object.values(a).filter((v) => v === 'partiel').length, faux: Object.values(a).filter((v) => v === 'faux').length, total: Number(d.module.total) || 0 }; }
    try { ecrireJson(f, x); } catch { return { horsLigne: true }; }
    return {};
  });

  return { tour, instancier, questionValide, estJuste };
}

module.exports = { surlValides, referentielValide, niveauDe, zonesValides, lignesValides, tableauValide, creerEvaluations, EXEMPLES, questionValide, instancier, estJuste, tirerQuestions, questionsDuClasseur, questionsDuJson, feuillesDeLaBanque, cle };
