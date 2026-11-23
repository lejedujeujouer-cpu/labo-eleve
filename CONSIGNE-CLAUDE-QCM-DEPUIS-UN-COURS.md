# Consigne pour Claude : créer un QCM à partir d'un cours (Labo Prof)

> **Pour l'enseignant :** donne ce fichier à Claude avec ton cours (PDF, Word, photo ou texte copié), par exemple :
>
> « Lis CONSIGNE-CLAUDE-QCM-DEPUIS-UN-COURS.md. Voici mon cours sur les fonctions affines (2nde bac pro).
> Fais-moi 12 questions de cours et 2 automatismes de 5 questions, avec des graphiques si c'est utile. »
>
> Claude te rend un fichier **.zip** à importer dans Labo Prof (**📝 Évaluations › 📚 Banque de questions › 📥 Importer**), et un **tableau de vérification** pour relire chaque question avant de l'utiliser.

---

## 1. Ton rôle (Claude)

Tu prépares des questions d'évaluation de mathématiques ou de physique-chimie pour un **lycée professionnel** (CAP, seconde, première et terminale bac pro). Tu travailles **uniquement à partir du cours fourni** par l'enseignant :

- chaque question porte sur une notion **présente dans le cours** (définition, propriété, formule, méthode, exemple) ;
- tu n'ajoutes pas de notion hors programme ou absente du cours ;
- tu reprends le **vocabulaire et les notations du cours** (mêmes noms de grandeurs, mêmes unités, même écriture des formules) ;
- les phrases sont **courtes et simples** : une seule idée par question, pas de double négation, pas de piège de lecture.

Si une information manque (niveau, nombre de questions, chapitre), choisis une valeur raisonnable et dis-le dans ta réponse plutôt que de poser des questions.

## 2. Ce que tu dois rendre

1. Un **fichier `.zip`** qui contient :
   - `questions.json` (format au § 5) ;
   - un dossier `images/` avec les images utilisées (si besoin).
2. Dans ta réponse, un **tableau de vérification** pour l'enseignant (§ 8).

Si tu ne peux pas créer de fichier .zip, donne le contenu de `questions.json` et de chaque image `.svg` dans des blocs de code séparés, avec leur nom de fichier, pour que l'enseignant les enregistre et les compresse lui-même.

## 3. Les types de questions (tous corrigés automatiquement)

Labo Prof corrige seul **deux formats** : le **QCM** (réponses proposées) et la **réponse « nombre »**. Utilise **uniquement** les types ci-dessous, en variant au moins quatre d'entre eux dans une même série.

| Code | Type | Format | Partie | Exemple |
|---|---|---|---|---|
| T1 | Définition / vocabulaire | QCM, 4 choix, 1 juste | Cours | « Une fonction affine s'écrit… » |
| T2 | Propriété ou formule | QCM, 4 choix, 1 juste | Cours | « La vitesse moyenne se calcule par… » |
| T3 | Vrai ou faux | QCM, 2 choix (`Vrai` / `Faux`) | Cours | « Un nombre négatif n'a pas de racine carrée réelle. » |
| T4 | Plusieurs bonnes réponses | QCM, 4 à 5 choix, 2 justes | Cours | « Quelles grandeurs s'expriment en joules ? » (la consigne le dit : « Coche toutes les bonnes réponses. ») |
| T5 | Lecture d'une image | QCM ou nombre, avec `image` | Cours ou Automatisme | « D'après le graphique, quelle est l'image de 2 ? » |
| T6 | Choisir la bonne représentation | QCM dont les choix sont des **images** | Cours | « Quel graphique représente f(x) = 2x + 1 ? » |
| T7 | Unité ou conversion | QCM ou nombre avec `unite` | Cours ou Automatisme | « Convertis 2,5 h en minutes. » |
| T8 | Calcul direct | nombre | Automatisme | « Calcule 15 % de 240. » |
| T9 | Calcul avec nombres au hasard | nombre + `variables` | Automatisme | « Calcule {a} % de {b}. » (chaque élève a des nombres différents) |
| T10 | Repérer l'erreur | QCM, 4 choix | Cours | « Léo écrit 3² = 6. Quelle est son erreur ? » |

À **ne pas** produire (Labo Prof ne peut pas les corriger) : questions ouvertes à rédiger, justifications en phrases, tracés à faire, réponses sous forme d'expression littérale (« 2x + 3 »), questions dont la réponse dépend d'une interprétation.

### Règles pour les QCM

- **4 choix** en général (2 pour Vrai/Faux, 5 au maximum pour T4) ; une seule bonne réponse sauf pour T4.
- Les **mauvaises réponses** sont des **erreurs fréquentes d'élèves**, pas des réponses absurdes : erreur de signe, virgule mal placée (×10 ou ÷10), inverse de la bonne réponse, formule inversée, oubli de la conversion d'unité, confusion de vocabulaire proche (périmètre et aire, masse et poids, moyenne et médiane…).
- Les choix ont une **longueur et une forme comparables**. La bonne réponse ne doit pas se repérer à sa longueur ou à sa précision.
- Pas de « toutes les réponses » ni d'« aucune des réponses » (sauf si le cours l'impose).
- **Répartis la place de la bonne réponse** (a, b, c, d) de façon équilibrée sur la série.
- Ne propose pas de choix `Je ne sais pas` : Labo Prof l'ajoute tout seul.

### Règles pour les réponses « nombre »

- `reponse` contient **un seul nombre** (`"0.55"` ou `"0,55"`) ou une **formule** avec les variables (`"a*b/100"`).
- Indique l'**unité** dans `unite` (pas dans `reponse`) et précise l'arrondi dans la question si besoin : « Arrondis au dixième. ». Mets alors une `tolerance` adaptée (`0.05` pour un arrondi au dixième).
- Avec des `variables`, choisis des intervalles et des pas qui donnent des **résultats simples** (entiers ou décimaux courts) et **réalistes** (pas de prix négatif, pas de vitesse de 3 000 km/h pour un vélo).
- Une question avec `variables` ne peut **pas** avoir d'image qui dépend des nombres tirés (l'image est la même pour tous les élèves).

### Partie et regroupement

- `"partie": "Cours"` : connaissances et compréhension (surtout des QCM).
- `"partie": "Automatisme"` : savoir-faire répétitif (surtout des nombres). Chaque automatisme a un **nom court** dans `automatisme` (ex. `Calculer une image`), et il faut **au moins 5 questions** par automatisme : Labo Prof en tire une partie au hasard.
- `chapitre` : le titre du chapitre, identique pour toutes les questions (ex. `Chapitre 4 : Fonctions affines`).
- Pour une question de cours, `automatisme` peut servir à indiquer la **notion** du cours (ex. `Coefficient directeur`) : l'enseignant voit ainsi quelles notions posent problème.

## 4. Écriture mathématique

Labo Prof met en forme seul les calculs écrits en texte simple. Écris :

| Pour afficher | Écris |
|---|---|
| une fraction | `3/4`, `(x+1)/2` |
| une puissance | `x^2`, `10^(-3)` (ou `x²`) |
| une racine carrée | `√(16)` |
| multiplication | `×` (ou `*`) |
| une fonction | `f(x) = 2x + 1` |
| décimaux | virgule française : `2,5` |

Les mots et les phrases restent en texte normal : n'entoure rien de `$…$` ni de balises.

## 5. Format du fichier `questions.json`

```json
{
  "questions": [
    {
      "chapitre": "Chapitre 4 : Fonctions affines",
      "partie": "Cours",
      "automatisme": "Définition",
      "question": "Une fonction affine est une fonction de la forme…",
      "choix": ["f(x) = ax + b", "f(x) = ax^2 + b", "f(x) = a/x", "f(x) = √(x) + b"],
      "reponseCorrecte": "a",
      "explication": "Une fonction affine s'écrit f(x) = ax + b.\na est le coefficient directeur et b l'ordonnée à l'origine.",
      "niveau": "2nde"
    },
    {
      "chapitre": "Chapitre 4 : Fonctions affines",
      "partie": "Cours",
      "automatisme": "Lecture graphique",
      "question": "D'après le graphique, quelle est l'ordonnée à l'origine de la droite ?",
      "image": "droite-ordonnee-origine.svg",
      "choix": ["1", "2", "-1", "0,5"],
      "reponseCorrecte": "b",
      "explication": "L'ordonnée à l'origine se lit là où la droite coupe l'axe vertical.\nLa droite coupe l'axe des ordonnées au point (0 ; 2)."
    },
    {
      "chapitre": "Chapitre 4 : Fonctions affines",
      "partie": "Cours",
      "question": "Quel graphique représente une fonction affine décroissante ?",
      "choix": [
        { "image": "choix-croissante.svg" },
        { "image": "choix-decroissante.svg", "juste": true },
        { "image": "choix-parabole.svg" },
        { "image": "choix-constante.svg" }
      ],
      "explication": "Une fonction affine est représentée par une droite.\nElle est décroissante quand la droite descend de gauche à droite (a < 0)."
    },
    {
      "chapitre": "Chapitre 4 : Fonctions affines",
      "partie": "Automatisme",
      "automatisme": "Calculer une image",
      "question": "f(x) = {a}x + {b}. Calcule f({c}).",
      "variables": "a=2..9:1 ; b=1..12:1 ; c=1..6:1",
      "reponse": "a*c+b",
      "explication": "On remplace x par {c} : f({c}) = {a} × {c} + {b}.\nf({c}) = {= a*c} + {b} = {= a*c+b}."
    }
  ]
}
```

### Champs

| Champ | Obligatoire | Rôle |
|---|---|---|
| `chapitre` | oui | dossier de la banque (80 caractères au plus) |
| `partie` | oui | `Cours` ou `Automatisme` |
| `automatisme` | pour un automatisme | nom de l'automatisme (ou notion du cours), 60 caractères au plus |
| `question` | oui | l'énoncé |
| `image` | non | nom d'un fichier du dossier `images/` |
| `choix` | QCM | 2 à 8 réponses : des textes, ou des objets `{"texte": "…", "image": "….svg", "juste": true}` |
| `reponseCorrecte` | QCM avec des choix en texte | lettre(s) de la bonne réponse : `"b"`, ou `"a;c"` pour T4 (inutile si les choix portent `"juste": true`) |
| `reponse` | nombre | nombre attendu, ou formule avec les variables |
| `unite` | non | `€`, `cm`, `km/h`, `J`… |
| `tolerance` | non | écart accepté (ex. `0.05`) |
| `variables` | non | `"a=5..60:5 ; b=20..200:10"` (a de 5 à 60 par pas de 5) ; dans le texte, `{a}` affiche la valeur, `{= a*2}` affiche un calcul |
| `explication` | **oui** (pour toi) | la correction, montrée à l'élève quand il se trompe |
| `niveau` | non | `CAP`, `2nde`, `1re`, `Tle` |

Fonctions utilisables dans une formule : `+ - * / ^`, parenthèses, `racine( )`, `abs( )`, `arrondi(x ; n)`, `cos sin tan` (en degrés), `pi`.

### L'explication

- **Une étape par ligne**, séparées par `\n` dans le JSON (2 à 4 étapes, 1 500 caractères au maximum).
- La première ligne rappelle **la règle ou la méthode du cours**, les suivantes l'**appliquent** à la question.
- Pour un QCM, explique aussi pourquoi le **piège le plus probable** est faux, si c'est utile (« Attention : 3² = 3 × 3, et non 3 × 2. »).

## 6. Les images

### Quand en faire

Seulement quand l'image **apporte quelque chose** : lecture de graphique, diagramme statistique, figure géométrique, schéma électrique ou montage, tableau de valeurs, échelle de mesure. Pas d'image décorative.

### Comment les faire

- **De préférence en SVG**, écrit directement à la main (pas besoin d'outil) : le résultat est net et léger.
- En **PNG**, si tu peux exécuter du code (par exemple Python avec matplotlib) : 1 000 à 1 200 pixels de large.
- **Calcule les coordonnées** à partir des données (ne place rien « à l'œil ») : la valeur lue sur l'image doit être **exactement** celle de la réponse.

### Règles de lisibilité

- Fond **blanc**, traits **noirs ou foncés**, au plus 3 couleurs bien distinctes.
- Texte de **16 px au moins** (dans un SVG de 800 px de large), police `Arial, sans-serif`.
- Graphique : axes fléchés et nommés avec leur **unité** (`t (s)`, `d (m)`), **graduations régulières** et chiffrées, quadrillage léger (gris clair) pour les lectures.
- **Pas de réponse sur l'image** : ni la valeur cherchée, ni de pointillé de lecture qui donne la réponse.
- Pour les choix en images (T6) : même taille, mêmes axes et même style pour toutes les images, afin que seule la notion testée les différencie.
- Nom de fichier : minuscules, sans espace ni accent, avec des tirets (`diagramme-ages.svg`).
- 3 Mo au maximum par image. Formats acceptés : SVG, PNG, JPG, GIF, WEBP.

### Modèle SVG (graphique d'une droite)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" font-family="Arial, sans-serif" font-size="18">
  <rect width="800" height="600" fill="#fff"/>
  <!-- repère : origine en (100, 500), 1 unité = 60 px en x et 50 px en y -->
  <g stroke="#e5e7eb" stroke-width="1">
    <!-- quadrillage : une ligne par unité -->
    <line x1="160" y1="50" x2="160" y2="500"/> <line x1="220" y1="50" x2="220" y2="500"/>
    <line x1="100" y1="450" x2="740" y2="450"/> <line x1="100" y1="400" x2="740" y2="400"/>
  </g>
  <g stroke="#111" stroke-width="2">
    <line x1="100" y1="500" x2="750" y2="500"/>  <!-- axe des abscisses -->
    <line x1="100" y1="500" x2="100" y2="40"/>   <!-- axe des ordonnées -->
  </g>
  <polygon points="750,500 738,494 738,506" fill="#111"/>
  <polygon points="100,40 94,52 106,52" fill="#111"/>
  <text x="760" y="530">x</text> <text x="70" y="40">y</text>
  <!-- graduations chiffrées : x = 1 → 160, y = 1 → 450 -->
  <text x="155" y="525">1</text> <text x="80" y="456">1</text>
  <!-- droite y = 1,5x + 2 : de x = 0 (y = 2 → 400 px) jusqu'au haut du repère y = 9 (→ 50 px), atteint pour x = 7/1,5 ≈ 4,67 (→ 380 px) -->
  <line x1="100" y1="400" x2="380" y2="50" stroke="#2563eb" stroke-width="3"/>
</svg>
```

(Complète le quadrillage et les graduations sur tout le repère ; le modèle n'en montre que quelques-unes.)

## 7. Avant de rendre : vérifie tout

Pour **chaque** question, refais le calcul toi-même et coche :

- [ ] la bonne réponse est juste, et **une seule** réponse est juste (sauf T4) ;
- [ ] aucune mauvaise réponse n'est aussi acceptable (arrondi, autre unité, autre écriture du même nombre) ;
- [ ] la valeur lue sur l'image est exactement celle attendue (recalcule les coordonnées) ;
- [ ] avec `variables` : la formule de `reponse` est juste pour les valeurs extrêmes de chaque intervalle ;
- [ ] chaque fichier cité dans `image` existe dans `images/`, avec le même nom ;
- [ ] `questions.json` est un JSON valide (guillemets droits `"`, pas de virgule finale, retours à la ligne écrits `\n`) ;
- [ ] la notion est bien dans le cours fourni.

## 8. Le tableau de vérification (dans ta réponse)

Après le fichier, donne ce tableau pour que l'enseignant relise rapidement :

| N° | Type | Partie / automatisme | Question (début) | Bonne réponse | Image | Où dans le cours |
|---|---|---|---|---|---|---|
| 1 | T1 | Cours / Définition | Une fonction affine est… | a) f(x) = ax + b | — | § 1, définition |
| 2 | T5 | Cours / Lecture graphique | D'après le graphique, l'ordonnée… | b) 2 | droite-ordonnee-origine.svg | § 2, exemple 1 |

Puis signale en quelques lignes :

- les **choix que tu as faits** (niveau, nombre de questions, notions laissées de côté) ;
- les questions **à relire en priorité** (arrondi délicat, formulation qui pourrait prêter à confusion).

## 9. Rappel pour l'import

- Dans Labo Prof : **📝 Évaluations › 📚 Banque de questions › 📥 Importer**, puis choisir le `.zip`.
- Une question qui existe déjà (même chapitre, même énoncé) est **mise à jour**, pas ajoutée deux fois : on peut donc corriger le fichier et l'importer à nouveau.
- Après l'import, l'enseignant peut ouvrir chaque question dans la banque pour la modifier ou voir l'aperçu élève.
