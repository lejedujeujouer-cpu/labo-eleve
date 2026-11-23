# Préparer une banque de questions pour Labo Prof (avec Claude)

Ce document décrit le format que Labo Prof sait importer (**📚 Banque de questions › 📥 Importer**).
Tu peux le donner tel quel à Claude, avec ta demande, par exemple :

> « Lis FORMAT-BANQUE-QUESTIONS.md. Prépare-moi pour Labo Prof le chapitre « Chapitre 1 : Statistique »
> (niveau 2nde bac pro) : 10 questions de cours en QCM et 3 automatismes (« Calculer une moyenne »,
> « Lire un diagramme en barres », « Calculer une fréquence ») de 5 questions chacun, avec des images
> pour les lectures de diagrammes. Donne-moi un fichier .zip à importer. »

## Ce qu'il faut produire

Un **dossier compressé `.zip`** qui contient :

- `questions.json` (ou un classeur Excel `.xlsx`, voir plus bas) ;
- les **images** utilisées (PNG, JPG, GIF, WEBP ou SVG, 3 Mo au maximum chacune), à la racine du zip ou dans un dossier `images/`.

Sans image, un simple fichier `questions.json` ou `.xlsx` suffit.

## Organisation de la banque

- **Chapitre** : le dossier de la banque (ex. `Chapitre 1 : Statistique`).
- **Partie** : `Cours` (questions de cours, souvent des QCM) ou `Automatisme`.
- **Automatisme** : pour la partie Automatisme, le nom de l'automatisme qui regroupe ses questions
  (ex. `Coefficient multiplicateur`). Pour le cours, c'est facultatif (une notion du chapitre).
- Chaque question est soit un **QCM** (réponses proposées), soit une **réponse « nombre »**.

## Format `questions.json`

```json
{
  "questions": [
    {
      "chapitre": "Chapitre 1 : Statistique",
      "partie": "Cours",
      "question": "La médiane d'une série partage les valeurs…",
      "choix": ["en deux groupes de même effectif", "en quatre groupes", "au hasard", "selon la moyenne"],
      "reponseCorrecte": "a",
      "niveau": "2nde"
    },
    {
      "chapitre": "Chapitre 3 : Géométrie",
      "partie": "Cours",
      "question": "Quelle figure est un parallélogramme ?",
      "choix": [
        { "image": "figure-a.png", "juste": true },
        { "image": "figure-b.png" },
        { "texte": "Aucune des deux" }
      ]
    },
    {
      "chapitre": "Chapitre 1 : Statistique",
      "partie": "Automatisme",
      "automatisme": "Calculer une moyenne",
      "question": "Calcule la moyenne de 12, 15 et 18.",
      "reponse": "15",
      "explication": "On additionne les valeurs : 12 + 15 + 18 = 45, puis on divise par leur nombre : 45/3 = 15."
    },
    {
      "chapitre": "Chapitre 1 : Statistique",
      "partie": "Automatisme",
      "automatisme": "Lire un diagramme en barres",
      "question": "D'après le diagramme, combien d'élèves ont 15 ans ?",
      "image": "diagramme-ages.png",
      "reponse": "8",
      "unite": "élèves"
    },
    {
      "chapitre": "Chapitre 2 : Pourcentages",
      "partie": "Automatisme",
      "automatisme": "Coefficient multiplicateur",
      "question": "Une hausse de {a} % correspond à un coefficient multiplicateur de…",
      "variables": "a=5..60:5",
      "reponse": "1+a/100"
    }
  ]
}
```

### Champs

| Champ | Obligatoire | Rôle |
|---|---|---|
| `chapitre` | oui | dossier de la banque |
| `partie` | conseillé | `Cours` ou `Automatisme` (par défaut : QCM → Cours, nombre → Automatisme) |
| `automatisme` (ou `notion`) | pour un automatisme | nom de l'automatisme |
| `question` | oui | l'énoncé |
| `image` | non | nom du fichier image (présent dans le zip) |
| `choix` | QCM | 2 à 8 réponses proposées : des textes, ou des objets `{"texte": "…", "image": "fichier.png", "juste": true}` (une réponse peut n'avoir qu'une image) |
| `reponseCorrecte` | QCM | la lettre de la bonne réponse : `a`, `b`, `c`… ; plusieurs : `"a;c"` (inutile si les choix ont `"juste": true`) |
| `reponse` | nombre | le nombre attendu (`"1.25"` ou `"1,25"`), ou une formule avec les variables |
| `unite` | non | ex. `€`, `cm`, `élèves` |
| `tolerance` | non | écart accepté, ex. `0.01` (0 par défaut) |
| `variables` | non | nombres tirés au hasard pour chaque élève : `"a=5..60:5 ; b=20..200:10"` (« a de 5 à 60 par pas de 5 ») ; dans la question, `{a}` est remplacé par la valeur, `{= a*2}` affiche un calcul |
| `explication` | non (conseillé) | la méthode ou la correction, montrée à l'élève à côté de la bonne réponse (`{a}` y est aussi remplacé par le nombre tiré au hasard) |
| `niveau` | non | ex. `CAP`, `2nde`, `1re`, `Tle` |

Fonctions possibles dans une formule : `+ - * / ^`, parenthèses, `racine( )`, `abs( )`, `arrondi(x ; n)`, `cos sin tan` (en degrés), `pi`.

## Format Excel (`.xlsx`) — même contenu, une ligne par question

- Feuille **QCM** : `Chapitre | Partie | Automatisme | Question | Image | ChoixA | ChoixB | ChoixC | ChoixD | ReponseCorrecte | Niveau | ImageA | ImageB | ImageC | ImageD | Explication` (ImageA… : une image dans la réponse A…, le texte du choix peut alors rester vide)
- Feuille **Automatismes** : `Chapitre | Partie | Automatisme | Question | Image | Reponse | Unite | Tolerance | Variables | Niveau | Explication`

Le bouton **📄 Modèle Excel** de Labo Prof donne un classeur prêt à remplir.

## Conseils pour les images

- Une image pour la question (affichée sous la question, en grand) et, pour un QCM, une image par réponse (affichée dans la tuile de la réponse).
- Graphiques, diagrammes, figures, tableaux : PNG de 800 à 1200 pixels de large, fond blanc, texte lisible.
- Le nom du fichier dans `image` doit correspondre exactement au fichier du zip (les majuscules ne comptent pas).
- Une question déjà présente dans la banque (même chapitre, même question) est **mise à jour** à l'import, pas ajoutée deux fois.
