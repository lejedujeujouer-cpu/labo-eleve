# Consigne pour Claude : créer des exercices « Calculer une dérivée » (Labo Prof)

> **Pour l'enseignant :** donne ce fichier à Claude, avec ton cours si tu veux qu'il s'y tienne exactement. Par exemple :
>
> « Lis CONSIGNE-CLAUDE-DERIVEES.md. Terminale bac pro, chapitre « Chapitre 4 : Fonctions polynômes de degré 3 ».
> Fais-moi les questions pour la banque et une fiche d'exercices avec sa correction. »
>
> Claude te rend :
> 1. **`questions.json`** : à importer dans Labo Prof (**📝 Évaluations › 📚 Banque de questions › 📥 Importer**). Ces questions sont **corrigées automatiquement** : séries d'entraînement (**🏋️ S'entraîner**) et évaluations.
> 2. **une fiche d'exercices** (PDF, ou Word à enregistrer en PDF) et **ses corrections** : pour un **🧩 module d'entraînement** (bloc 🏋️ Entraînement › 🧩 Modules d'exercices). Les calculs rédigés y sont corrigés par ta correction, que l'élève découvre après avoir cherché.
> 3. un **tableau de vérification**.

---

## 1. Ton rôle (Claude)

Tu prépares des exercices de **calcul de dérivées** pour un **lycée professionnel** (première ou terminale bac pro, programme de mathématiques).

- Si un cours est fourni : mêmes formules, mêmes notations, mêmes mots.
- Sinon, tu te limites à ce qui est au programme du niveau indiqué :
  - **1re bac pro** : fonctions polynômes de degré 2 — dérivée de *k*, *x*, *x²* ; dérivée de *ax² + bx + c* ;
  - **Tle bac pro** : en plus, fonctions polynômes de degré 3 — dérivée de *x³* ; dérivée de *ax³ + bx² + cx + d*. N'utilise *1/x* ou d'autres fonctions **que si elles sont dans le cours fourni**.
- Formules utilisées (à rappeler dans les explications) :
  - (k)′ = 0 ; (x)′ = 1 ; (x²)′ = 2x ; (x³)′ = 3x² ;
  - (k × u)′ = k × u′ ; (u + v)′ = u′ + v′ ;
  - donc (ax³ + bx² + cx + d)′ = 3ax² + 2bx + c.
- Coefficients **entiers ou décimaux simples** (pas de fractions compliquées) ; quelques coefficients négatifs, mais pas partout.
- Si une information manque (niveau, nombre de questions), choisis une valeur raisonnable et dis-le dans ta réponse.

## 2. Écriture mathématique (dans tous les textes)

Labo Prof met en forme seul les calculs écrits en texte simple :

| Pour afficher | Écris |
|---|---|
| x au carré, au cube | `x^2`, `x^3` (ou `x²`, `x³`) |
| la dérivée | `f′(x)` (avec le caractère ′) |
| multiplication | `×` (ex. `3 × 2x`) |
| moins | `−` ou `-` |
| décimaux | virgule française : `0,5` |

N'utilise ni `$…$` ni balise. Écris `5x^2`, pas `5*x^2`, dans les énoncés et les explications. Dans une **formule** de réponse (`reponse`), en revanche, écris le calcul avec `*` et `^` (ex. `3*a*k^2`).

---

## 3. Livrable 1 : les questions de la banque (`questions.json`)

### Organisation

- `chapitre` : identique pour toutes les questions (ex. `Chapitre 4 : Fonctions polynômes de degré 3`).
- **Partie « Cours »** (QCM) : les formules et le vocabulaire. Mets-y `"automatisme": "Formules de dérivation"` pour regrouper.
- **Partie « Automatisme »**, avec **6 à 10 questions par automatisme** (jamais moins de 5) :
  - `Dériver un polynôme de degré 2` ;
  - `Dériver un polynôme de degré 3` (seulement en terminale) ;
  - `Calculer un nombre dérivé f′(a)`.
- Ajoute `"competence": "Réaliser"` (ou `S’approprier` pour les formules du cours) et des `points` (1 en général, 2 pour un calcul en deux étapes).

### Les formes de questions (toutes corrigées automatiquement)

| Code | Forme | Format | Exemple |
|---|---|---|---|
| D1 | Formule du cours | QCM, 4 choix | « La dérivée de x³ est… » |
| D2 | Vrai / faux | QCM, 2 choix | « La dérivée de f(x) = 7 est f′(x) = 0. » |
| D3 | Trouver la dérivée | QCM, 4 choix | « f(x) = 2x³ − 5x + 1. Quelle est f′(x) ? » |
| D4 | Un coefficient de f′(x) | nombre + `variables` | « f(x) = {a}x^2 + {b}x − {c}. f′(x) = …x + … : quel est le coefficient de x ? » |
| D5 | Nombre dérivé f′(a) | nombre + `variables` | « f(x) = {a}x^3 − {b}x. Calcule f′({k}). » |
| D6 | Nombre dérivé en contexte | nombre (+ unité) | « Le coût C(q) = … Calcule C′(10). » |

**Pas de réponse sous forme d'expression** (l'élève ne peut pas taper « 6x − 5 » : ce ne serait pas corrigé). Pour faire trouver f′(x), utilise le QCM (D3) ou un coefficient (D4).

### Les mauvaises réponses des QCM : des erreurs réelles d'élèves

Pour f(x) = 4x³ − 2x² + 5x − 7, la bonne réponse est f′(x) = 12x² − 4x + 5. Les pièges à proposer :

- **la constante gardée** : 12x² − 4x + 5 − 7 ;
- **l'exposant baissé sans multiplier** : 4x² − 2x + 5 ;
- **la multiplication sans baisser l'exposant** : 12x³ − 4x² + 5 ;
- **le x qui reste** : 12x² − 4x + 5x ;
- **un signe oublié** : 12x² + 4x + 5.

Choisis-en 3 par question, varie-les, et **répartis la place de la bonne réponse** (a, b, c, d).

### Nombres au hasard (D4, D5)

- `"variables": "a=2..6:1 ; b=1..9:1 ; k=1..4:1"` ; dans l'énoncé, `{a}` affiche la valeur ; `{= 3*a}` affiche un calcul.
- `reponse` est la formule du résultat, ex. pour f(x) = ax³ − bx et f′(k) : `"reponse": "3*a*k^2-b"`.
- Les coefficients tirés ne doivent **jamais être 0** (intervalles qui commencent à 1 ou plus), et les nombres de l'énoncé doivent rester petits (résultat à moins de 1 000).
- Pour un coefficient négatif, garde la variable positive et écris le signe « − » dans l'énoncé (`− {b}x`), et `-b` dans la formule.

### L'explication (obligatoire)

**Une étape par ligne** (`\n`), avec les nombres de l'élève :

1. la formule du cours utilisée ;
2. la dérivée de chaque terme ;
3. le résultat (et, pour f′(a), le remplacement de x par a, puis le calcul).

Ajoute une ligne « Attention : … » pour le piège le plus fréquent (constante, signe…).

### Exemple de `questions.json`

```json
{
  "questions": [
    {
      "chapitre": "Chapitre 4 : Fonctions polynômes de degré 3",
      "partie": "Cours",
      "automatisme": "Formules de dérivation",
      "question": "La dérivée de la fonction f(x) = x^3 est…",
      "choix": ["f′(x) = 3x^2", "f′(x) = x^2", "f′(x) = 3x^3", "f′(x) = 3x"],
      "reponseCorrecte": "a",
      "competence": "S’approprier",
      "explication": "Formule du cours : (x^3)′ = 3x^2.\nOn multiplie par l’exposant 3, puis on baisse l’exposant de 1.",
      "niveau": "Tle"
    },
    {
      "chapitre": "Chapitre 4 : Fonctions polynômes de degré 3",
      "partie": "Cours",
      "automatisme": "Formules de dérivation",
      "question": "f(x) = 2x^3 − 5x + 1. Quelle est f′(x) ?",
      "choix": ["f′(x) = 6x^2 − 5 + 1", "f′(x) = 2x^2 − 5", "f′(x) = 6x^2 − 5", "f′(x) = 6x^3 − 5x"],
      "reponseCorrecte": "c",
      "competence": "Réaliser",
      "explication": "(2x^3)′ = 2 × 3x^2 = 6x^2 ; (−5x)′ = −5 ; (1)′ = 0.\nDonc f′(x) = 6x^2 − 5.\nAttention : la dérivée d’un nombre seul (ici 1) est 0."
    },
    {
      "chapitre": "Chapitre 4 : Fonctions polynômes de degré 3",
      "partie": "Automatisme",
      "automatisme": "Dériver un polynôme de degré 2",
      "question": "f(x) = {a}x^2 + {b}x − {c}. On a f′(x) = …x + … Quel est le coefficient de x dans f′(x) ?",
      "variables": "a=2..9:1 ; b=1..9:1 ; c=1..9:1",
      "reponse": "2*a",
      "competence": "Réaliser",
      "points": 1,
      "explication": "(ax^2)′ = 2ax : on multiplie par l’exposant 2.\n({a}x^2)′ = 2 × {a}x = {= 2*a}x.\nLe coefficient de x dans f′(x) est {= 2*a}."
    },
    {
      "chapitre": "Chapitre 4 : Fonctions polynômes de degré 3",
      "partie": "Automatisme",
      "automatisme": "Calculer un nombre dérivé f′(a)",
      "question": "f(x) = {a}x^3 − {b}x + 4. Calcule f′({k}).",
      "variables": "a=1..5:1 ; b=1..9:1 ; k=1..3:1",
      "reponse": "3*a*k^2-b",
      "competence": "Réaliser",
      "points": 2,
      "explication": "On dérive : f′(x) = 3 × {a}x^2 − {b} = {= 3*a}x^2 − {b}.\nOn remplace x par {k} : f′({k}) = {= 3*a} × {k}^2 − {b}.\nf′({k}) = {= 3*a*k^2} − {b} = {= 3*a*k^2-b}."
    }
  ]
}
```

### Champs

| Champ | Rôle |
|---|---|
| `chapitre`, `partie` (`Cours` / `Automatisme`), `automatisme` | rangement dans la banque |
| `question` | l'énoncé (avec `{a}`, `{= …}`) |
| `choix` + `reponseCorrecte` | QCM : textes des réponses, lettre de la bonne |
| `variables` + `reponse` | nombre : nombres au hasard, formule du résultat |
| `unite`, `tolerance` | si besoin (contexte, arrondi) |
| `competence` | `S’approprier`, `Analyser`, `Réaliser`, `Valider` ou `Communiquer` |
| `points` | 1 par défaut |
| `explication` | la correction, une étape par ligne (`\n`) |
| `niveau` | `1re` ou `Tle` |

---

## 4. Livrable 2 : la fiche d'exercices et sa correction (module d'entraînement)

Ici, l'élève **rédige** ses calculs (dériver plusieurs fonctions, puis calculer des nombres dérivés). Labo Prof ne les corrige pas seul : l'élève compare avec **la correction de l'enseignant**, puis s'auto-évalue.

### La fiche (PDF, A4, une ou deux pages)

- En-tête : titre (ex. « Entraînement : calculer une dérivée »), chapitre, et un rappel des formules (encadré).
- **Questions numérotées** (Q1, Q2…), **une question par bloc**, bien séparées les unes des autres : l'enseignant encadre chaque question dans Labo Prof.
- Sous chaque question, **la place pour répondre** : 2 à 4 lignes de pointillés, ou un tableau à compléter.
- Progression conseillée (8 à 12 questions) :
  1. dériver des fonctions simples (*k*, *ax*, *ax²*) ;
  2. dériver des polynômes de degré 2, puis de degré 3 (avec un coefficient négatif, une constante) ;
  3. calculer f′(a) pour deux ou trois valeurs ;
  4. une question en contexte (ex. coût de production C(q), vitesse, bénéfice) : calculer et interpréter C′(q).
- Police de 12 pt au moins, pas de couleur de fond, pas de tableau inutile.

Si tu ne peux pas créer de PDF, donne la fiche en **Word (.docx)** ou en texte mis en page : l'enseignant l'enregistrera en PDF.

### Les corrections (un fichier `corrections.md`)

Pour chaque question, un bloc à **copier-coller** dans le champ « ✅ Correction de la question » de Labo Prof :

```
Q3
f(x) = 4x^3 − 2x^2 + 5x − 7
(4x^3)′ = 4 × 3x^2 = 12x^2 ; (−2x^2)′ = −2 × 2x = −4x ; (5x)′ = 5 ; (−7)′ = 0
f′(x) = 12x^2 − 4x + 5
```

- **Une étape par ligne** (chaque ligne s'affiche séparément) : la formule, la dérivée de chaque terme, le résultat.
- Pour une question en contexte, ajoute une dernière ligne d'interprétation (« C′(10) = 35 : à partir de 10 objets, produire un objet de plus coûte environ 35 €. »).

Facultatif : un **corrigé complet en PDF** (la fiche remplie), à ajouter au module comme « Corrigé complet ».

---

## 5. Avant de rendre : vérifie tout

- [ ] Chaque dérivée est **recalculée** terme par terme (multiplier par l'exposant, baisser l'exposant de 1, constante → 0).
- [ ] QCM : une seule bonne réponse, et chaque piège correspond à une erreur réelle (§ 3).
- [ ] Nombres au hasard : la formule `reponse` donne le bon résultat pour les **plus petites et les plus grandes** valeurs (calcule les deux) ; aucun coefficient ne vaut 0.
- [ ] L'explication donne bien le même résultat que `reponse`.
- [ ] Le nom de chaque automatisme est **écrit exactement pareil** pour toutes ses questions.
- [ ] `questions.json` est un JSON valide (guillemets droits, pas de virgule finale, retours à la ligne écrits `\n`).
- [ ] Sur la fiche, chaque question est séparée et a sa place de réponse ; `corrections.md` a un bloc par question, dans le même ordre.

## 6. Le tableau de vérification (dans ta réponse)

| N° | Livrable | Partie / automatisme | Forme | Énoncé (début) | Exemple de nombres | Réponse attendue |
|---|---|---|---|---|---|---|
| 1 | banque | Cours / Formules de dérivation | D1 | La dérivée de x³ est… | — | a) 3x² |
| 4 | banque | Calculer un nombre dérivé f′(a) | D5 | f(x) = {a}x³ − {b}x + 4… | a = 2, b = 5, k = 1 | 1 |
| Q3 | fiche | — | rédigée | f(x) = 4x³ − 2x² + 5x − 7 | — | f′(x) = 12x² − 4x + 5 |

Puis, en quelques lignes : les choix que tu as faits (niveau, formules utilisées) et les questions à relire en priorité.

---

## 7. Rappel pour l'import et le module

- **Banque** : Labo Prof › classe › **📝 Évaluations › 📚 Banque de questions › 📥 Importer** › `questions.json` (ou un .zip qui le contient). Ensuite, **⚙️ Ouvrir à la classe** (bloc 🏋️ Entraînement) pour que les élèves s'y entraînent.
- **Module** : **🧩 Modules d'exercices › ➕ Nouveau module** (titre, chapitre, notions, la fiche PDF, le corrigé PDF facultatif), puis **📐 Questions et corrections** : encadre chaque question et colle sa correction depuis `corrections.md`.
- Pour relier les questions à un **objectif** de séquence (📊 Notes › 📚 Référentiel), choisis-le ensuite dans la banque ou dans « 📐 Questions et corrections ».
