// Liste d'élèves au format CSV (export Pronote, ENT, tableur) → noms « NOM Prénom ».
// Encodage : UTF-8, sinon Windows-1252 (accents des exports Pronote). Séparateur : « ; », tabulation ou « , ».
// Colonnes reconnues : « Élève » / « Nom Prénom » (un seul champ), ou « Nom » + « Prénom ». Sans en-tête : la première colonne.
const norme = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const majusculeInitiale = (p) => p.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());

function decouperLigne(l, sep) { // champs entre guillemets possibles : "DUPONT Léa";"12/03/2009"
  const champs = [];
  let cur = '', guill = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (guill) {
      if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') guill = false; else cur += ch;
    } else if (ch === '"') guill = true;
    else if (ch === sep) { champs.push(cur.trim()); cur = ''; } else cur += ch;
  }
  champs.push(cur.trim());
  return champs;
}

function nomsDuCsv(octets) {
  let texte;
  try { texte = new TextDecoder('utf-8', { fatal: true }).decode(octets); } catch { texte = new TextDecoder('windows-1252').decode(octets); }
  texte = texte.replace(/^﻿/, '');
  const brutes = texte.split(/\r\n|\n|\r/).filter((l) => l.trim());
  const echantillon = brutes.slice(0, 10).join('\n');
  const sep = [';', '\t', ','].map((c) => [c, echantillon.split(c).length]).sort((x, y) => y[1] - x[1])[0][0];
  const lignes = brutes.map((l) => decouperLigne(l, sep));
  // ligne d'en-tête : parmi les premières lignes (Pronote met parfois un titre avant)
  let iEntete = -1, cNom = -1, cPrenom = -1, cEleve = -1;
  for (let i = 0; i < Math.min(15, lignes.length) && iEntete < 0; i++) {
    const n = lignes[i].map(norme);
    const eleve = n.findIndex((x) => /^(eleves?|nom prenoms?|nom et prenoms?|prenom nom|identite)$/.test(x));
    const nom = n.findIndex((x) => /^(nom|nom de famille|nom d usage|nom usage|nom patronymique)$/.test(x));
    const prenom = n.findIndex((x) => /^(prenoms?|premier prenom|prenom usuel)$/.test(x));
    if (eleve >= 0 || nom >= 0) { iEntete = i; cEleve = eleve; cNom = nom; cPrenom = prenom; }
  }
  const noms = [];
  for (const l of lignes.slice(iEntete + 1)) {
    let nom = '';
    if (iEntete >= 0 && cNom >= 0 && cPrenom >= 0) {
      const n = (l[cNom] || '').trim(), p = (l[cPrenom] || '').trim();
      if (n) nom = `${n.toUpperCase()} ${majusculeInitiale(p)}`;
    } else if (iEntete >= 0 && cEleve >= 0) nom = l[cEleve] || '';
    else if (iEntete >= 0 && cNom >= 0) nom = l[cNom] || '';
    else nom = l[0] || '';
    nom = nom.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!nom || /^(total|effectif|moyenne)/i.test(nom) || !/\p{L}/u.test(nom)) continue;
    if (!noms.includes(nom)) noms.push(nom);
  }
  const colonnes = iEntete < 0 ? 'première colonne (pas d’en-tête reconnu)'
    : cNom >= 0 && cPrenom >= 0 ? `colonnes « ${lignes[iEntete][cNom]} » et « ${lignes[iEntete][cPrenom]} »`
      : `colonne « ${lignes[iEntete][cEleve >= 0 ? cEleve : cNom]} »`;
  return { noms: noms.slice(0, 200), colonnes, separateur: sep === '\t' ? 'tabulation' : sep };
}

module.exports = { nomsDuCsv };
