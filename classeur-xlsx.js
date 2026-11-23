// Lecture / écriture simples de classeurs Excel (.xlsx), sans bibliothèque supplémentaire :
// un .xlsx est une archive zip de fichiers XML. On lit les textes (partagés ou en ligne) et les nombres.
const AdmZip = require('adm-zip');

const entites = (t) => String(t).replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(+d)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const echapper = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const textes = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => entites(m[1])).join('');
const colonne = (ref) => { const l = /^[A-Z]+/.exec(ref)[0]; let n = 0; for (const c of l) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
const lettres = (i) => { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };

// → [{ nom, lignes: [[cellule, …], …] }]
function lireClasseur(fichier) {
  const zip = new AdmZip(fichier);
  const lire = (n) => { const e = zip.getEntry(n); return e ? zip.readAsText(e, 'utf8') : null; };
  const classeur = lire('xl/workbook.xml');
  if (!classeur) throw new Error('Ce fichier n\'est pas un classeur Excel (.xlsx).');
  const partages = [];
  const ss = lire('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) partages.push(textes(m[1]));
  const liens = {};
  for (const m of (lire('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0]), cible = /Target="([^"]+)"/.exec(m[0]);
    if (id && cible) liens[id[1]] = cible[1].replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const feuilles = [];
  for (const m of classeur.matchAll(/<sheet\b[^>]*>/g)) {
    const nom = entites((/name="([^"]*)"/.exec(m[0]) || [])[1] || 'Feuille');
    const rid = (/r:id="([^"]+)"/.exec(m[0]) || [])[1];
    const xml = lire('xl/' + (liens[rid] || `worksheets/sheet${feuilles.length + 1}.xml`));
    if (!xml) continue;
    const lignes = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
      const ligne = [];
      for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], contenu = c[2] || '';
        const ref = (/r="([A-Z]+)\d+"/.exec(attrs) || [])[1];
        const t = (/t="([^"]+)"/.exec(attrs) || [])[1];
        const v = (/<v>([\s\S]*?)<\/v>/.exec(contenu) || [])[1];
        let val = '';
        if (t === 's') val = partages[+v] ?? '';
        else if (t === 'inlineStr') val = textes(contenu);
        else if (t === 'str' || t === 'e') val = v !== undefined ? entites(v) : '';
        else if (t === 'b') val = v === '1' ? 'VRAI' : 'FAUX';
        else if (v !== undefined) val = Number(v);
        ligne[ref ? colonne(ref) : ligne.length] = val;
      }
      lignes.push(Array.from(ligne, (x) => (x === undefined ? '' : x)));
    }
    feuilles.push({ nom, lignes });
  }
  return feuilles;
}

// feuilles : [{ nom, lignes: [[…]], largeurs: [nombre de caractères] }] → fichier .xlsx (textes « en ligne »)
function ecrireClasseur(fichier, feuilles) {
  const zip = new AdmZip();
  const ajouter = (n, t) => zip.addFile(n, Buffer.from(t, 'utf8'));
  const xmlEntete = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  ajouter('[Content_Types].xml', xmlEntete + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((_f, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  ajouter('_rels/.rels', xmlEntete + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  ajouter('xl/workbook.xml', xmlEntete + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${feuilles.map((f, i) => `<sheet name="${echapper(f.nom.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  ajouter('xl/_rels/workbook.xml.rels', xmlEntete + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles.map((_f, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  ajouter('xl/styles.xml', xmlEntete + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDE4FF"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>');
  feuilles.forEach((f, i) => {
    const cols = (f.largeurs || []).map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join('');
    const lignes = f.lignes.map((l, r) => `<row r="${r + 1}">${l.map((v, k) => (v === '' || v === null || v === undefined ? ''
      : typeof v === 'number' ? `<c r="${lettres(k)}${r + 1}"${r === 0 ? ' s="1"' : ' s="2"'}><v>${v}</v></c>`
        : `<c r="${lettres(k)}${r + 1}" t="inlineStr"${r === 0 ? ' s="1"' : ' s="2"'}><is><t xml:space="preserve">${echapper(v)}</t></is></c>`)).join('')}</row>`).join('');
    ajouter(`xl/worksheets/sheet${i + 1}.xml`, xmlEntete + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${lignes}</sheetData></worksheet>`);
  });
  zip.writeZip(fichier);
}

module.exports = { lireClasseur, ecrireClasseur };
