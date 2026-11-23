// Matières et thèmes proposés par défaut (communs à Labo Élève et Labo Prof).
// Un thème est un dossier de la classe : l'enseignant y range des outils, des documents et des Digipads.
// Tant qu'il n'a créé aucun thème pour une classe, les élèves voient les thèmes proposés pour sa matière.

const MATIERES_ECOLE = {
  maths: { nom: 'Mathématiques', icone: '📐', couleur: '#5865f2' },
  'physique-chimie': { nom: 'Physique-Chimie', icone: '⚗️', couleur: '#e8590c' },
  francais: { nom: 'Français', icone: '📖', couleur: '#c2255c' },
  'histoire-geo': { nom: 'Histoire-Géographie', icone: '🌍', couleur: '#2f9e44' },
  anglais: { nom: 'Anglais', icone: '🇬🇧', couleur: '#1971c2' },
  espagnol: { nom: 'Espagnol', icone: '🇪🇸', couleur: '#e67700' },
  allemand: { nom: 'Allemand', icone: '🇩🇪', couleur: '#495057' },
  italien: { nom: 'Italien', icone: '🇮🇹', couleur: '#2b8a3e' },
  'arts-appliques': { nom: 'Arts appliqués', icone: '🎨', couleur: '#ae3ec9' },
  eps: { nom: 'EPS', icone: '🏃', couleur: '#0ca678' },
  pse: { nom: 'Prévention Santé Environnement', icone: '🩺', couleur: '#0b7285' },
  'eco-gestion': { nom: 'Économie-Gestion', icone: '💼', couleur: '#5f3dc4' },
  'eco-droit': { nom: 'Économie-Droit', icone: '⚖️', couleur: '#364fc7' },
  'enseignement-pro': { nom: 'Enseignement professionnel', icone: '🛠️', couleur: '#d9480f' },
  'co-intervention-maths': { nom: 'Co-intervention maths-sciences', icone: '🤝', couleur: '#1098ad' },
  'co-intervention-francais': { nom: 'Co-intervention français', icone: '🗣️', couleur: '#9c36b5' },
  'chef-oeuvre': { nom: "Chef-d'œuvre", icone: '🏆', couleur: '#f08c00' },
  autre: { nom: 'Autre matière', icone: '📘', couleur: '#5c7cfa' },
};
// Anciennes classes « co-intervention » (avant la séparation maths / français) : co-intervention maths.
const ALIAS_MATIERES = { 'co-intervention': 'co-intervention-maths' };
const matiereActuelle = (id) => ALIAS_MATIERES[id] || id;
const infoMatiere = (id) => MATIERES_ECOLE[matiereActuelle(id)] || { nom: 'Ma classe', icone: '📚', couleur: '#5865f2' };
// Matières d'une classe : la principale (« matiere ») d'abord, puis les autres (« matieres »).
const matieresDe = (c) => { const l = [c && c.matiere, ...((c && c.matieres) || [])].filter(Boolean).map(matiereActuelle); return [...new Set(l)]; };

// Icônes et couleurs proposées à l'enseignant pour ses thèmes.
const ICONES_THEMES = ['📈', '📐', '🧮', '📊', '🔢', '📏', '🎲', '🐍', '💻', '⚡', '🔋', '💡', '🚀', '🧲', '🔊', '🌡️', '🧪', '⚗️', '🔬', '🌱', '💧', '☀️',
  '📝', '📖', '✏️', '🗂️', '📁', '🌐', '🏫', '💻', '🛠️', '⚙️', '🔧', '🏗️', '🍳', '🩺', '🎨', '🎯', '⭐', '🧩', '🗺️', '⏱️'];
const COULEURS_THEMES = ['#5865f2', '#0ea5e9', '#7c3aed', '#16a34a', '#2563eb', '#f59e0b', '#e8590c', '#dc2626', '#0891b2', '#0f766e', '#d97706', '#c2255c'];

// Thèmes communs à toutes les matières
const THEMES_COMMUNS = [
  { nom: 'Mes productions', icone: '📝', couleur: '#2563eb', outils: ['traitement-de-texte', 'tableur', 'cartes-memoire', 'mes-documents'] },
  { nom: 'Exercices en ligne', icone: '🎯', couleur: '#e03131', outils: ['quiziniere', 'kahoot'] },
  { nom: 'Rechercher', icone: '🌐', couleur: '#d97706', outils: ['recherche-internet'] },
  { nom: 'Mon lycée', icone: '🏫', couleur: '#0f766e', outils: ['monbureaunumerique', 'pronote'] },
];
const THEMES_DEFAUT = {
  maths: [
    { nom: 'Fonctions', icone: '📈', couleur: '#5865f2', outils: ['labo-maths', 'geogebra', 'calculatrice-numworks'] },
    { nom: 'Géométrie et trigonométrie', icone: '📐', couleur: '#0ea5e9', outils: ['labo-maths', 'geogebra'] },
    { nom: 'Calculs', icone: '🧮', couleur: '#7c3aed', outils: ['calculatrice', 'calculatrice-numworks', 'labo-maths'] },
    { nom: 'Statistiques', icone: '📊', couleur: '#16a34a', outils: ['tableur', 'labo-maths', 'geogebra'] },
    { nom: 'Algorithmique', icone: '🐍', couleur: '#3572a5', outils: ['python'] },
  ],
  'physique-chimie': [
    { nom: 'Électricité', icone: '⚡', couleur: '#f59e0b', outils: ['labo-physique', 'tableur', 'calculatrice'] },
    { nom: 'Mécanique', icone: '🚀', couleur: '#e8590c', outils: ['labo-physique', 'tableur'] },
    { nom: 'Chimie', icone: '🧪', couleur: '#16a34a', outils: ['labo-chimie', 'tableau-periodique', 'calculatrice'] },
    { nom: 'Mesures et graphiques', icone: '📊', couleur: '#0891b2', outils: ['labo-physique', 'tableur', 'geogebra', 'calculatrice-numworks'] },
  ],
  // Co-intervention : maths / sciences avec l'enseignant de la spécialité professionnelle.
  'co-intervention-maths': [
    { nom: 'Situations du métier', icone: '🛠️', couleur: '#1098ad', outils: ['calculatrice', 'tableur', 'mes-documents'] },
    { nom: 'Mesures et calculs', icone: '📏', couleur: '#0ea5e9', outils: ['calculatrice-numworks', 'labo-maths', 'calculatrice'] },
    { nom: 'Graphiques et tableaux', icone: '📊', couleur: '#16a34a', outils: ['tableur', 'geogebra'] },
    { nom: 'Expériences et sécurité', icone: '🧪', couleur: '#e8590c', outils: ['labo-physique', 'labo-chimie', 'tableau-periodique'] },
  ],
  // Co-intervention : français avec l'enseignant de la spécialité professionnelle.
  'co-intervention-francais': [
    { nom: 'Écrits professionnels', icone: '📝', couleur: '#9c36b5', outils: ['traitement-de-texte', 'mes-documents'] },
    { nom: "S'exprimer à l'oral", icone: '🗣️', couleur: '#c2255c', outils: ['cartes-memoire', 'traitement-de-texte'] },
    { nom: 'Lire des documents du métier', icone: '📖', couleur: '#1971c2', outils: ['mes-documents', 'recherche-internet'] },
  ],
};
function themesParDefaut(matiere) {
  return [...(THEMES_DEFAUT[matiereActuelle(matiere)] || []), ...THEMES_COMMUNS].map((t) => ({ ...t, outils: [...t.outils] }));
}
