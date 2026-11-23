// Après l'empaquetage (avant la création de l'installeur) : pose l'icône et le nom de l'application
// sur le .exe, à la place de ceux d'Electron (signAndEditExecutable est désactivé dans la config).
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function (contexte) {
  if (contexte.electronPlatformName !== 'win32') return;
  const info = contexte.packager.appInfo;
  const prof = info.productName === 'Labo Prof';
  const exe = path.join(contexte.appOutDir, `${info.productFilename}.exe`);
  const icone = path.join(__dirname, '..', 'shell', 'icones', prof ? 'prof.ico' : 'eleve.ico');
  execFileSync(path.join(__dirname, '..', 'natif', 'rcedit-x64.exe'), [
    exe,
    '--set-icon', icone,
    '--set-version-string', 'FileDescription', info.productName,
    '--set-version-string', 'ProductName', info.productName,
    '--set-version-string', 'InternalName', info.productName,
    '--set-version-string', 'OriginalFilename', `${info.productFilename}.exe`,
    '--set-version-string', 'CompanyName', 'Enseignant',
    '--set-file-version', info.version,
    '--set-product-version', info.version,
  ]);
  console.log(`  • icône et nom posés sur ${path.basename(exe)}`);
};
