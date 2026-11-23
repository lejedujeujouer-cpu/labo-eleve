// Construction de « Labo Prof » (application de l'enseignant) à partir du même code que Labo Élève.
// npm run installeur:prof  →  installeur/prof/
const base = require('./package.json').build;

module.exports = {
  ...base,
  appId: 'fr.ecole.labo-prof',
  productName: 'Labo Prof',
  extraMetadata: { edition: 'prof', productName: 'Labo Prof', name: 'labo-prof' },
  directories: { output: 'installeur/prof' },
  fileAssociations: [], // les fichiers .outil s'ouvrent avec Labo Élève
  win: { ...base.win, icon: 'shell/icones/prof.ico' },
  nsis: { ...base.nsis, shortcutName: 'Labo Prof', installerIcon: 'shell/icones/prof.ico', uninstallerIcon: 'shell/icones/prof.ico' },
  portable: { artifactName: 'Labo-Prof-portable-${version}.exe' },
};
