# Labo Élève / Labo Prof

Boîte à outils interactifs de mathématiques et de physique-chimie pour le lycée professionnel.

- **Labo Élève** : outils de maths et de physique-chimie, évaluations, travail à rendre, entraînement par chapitre.
- **Labo Prof** : gestion des classes, évaluations (QCM et exercices sur PDF), correction, notes et compétences, suivi des élèves.

Les données des élèves restent sur leurs ordinateurs et dans le dossier partagé de l'établissement : rien n'est envoyé sur Internet.

## Lancer depuis le code

```
npm install
npm start          # Labo Élève
npm run start:prof # Labo Prof
```

## Construire les installateurs (Windows)

```
npx electron-builder --win nsis
npx electron-builder --win nsis --config electron-builder-prof.js
```

Le guide d'utilisation est dans [GUIDE-ENSEIGNANT.md](GUIDE-ENSEIGNANT.md).

## Licence

MIT, voir [LICENSE](LICENSE). Exceptions qui gardent leur propre licence :

- les bibliothèques de `commun/biblio` (voir `commun/biblio/LICENCES.txt`) et `outils/mes-documents/pdfjs` ;
- l'outil `outils/equation-balance`, d'Arnaud DURAND (mathix.org), sous licence GPL (voir `outils/equation-balance/CREDITS.txt`).
