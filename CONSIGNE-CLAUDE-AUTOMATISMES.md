# Consigne pour Claude : créer des automatismes (Labo Prof)

> **Pour l'enseignant :** donne ce fichier à Claude avec ton cours, ta fiche d'exercices ou simplement la liste des automatismes voulus. Par exemple :
>
> « Lis CONSIGNE-CLAUDE-AUTOMATISMES.md. Chapitre 2 : Pourcentages (2nde bac pro).
> Fais-moi 4 automatismes : Calculer un pourcentage, Coefficient multiplicateur, Appliquer une hausse, Calculer un taux d'évolution. »
>
> Claude te rend un fichier **.zip** (ou un `questions.json`) à importer dans Labo Prof (**📝 Évaluations › 📚 Banque de questions › 📥 Importer**), et un **tableau de vérification**.

---

## 1. Ce qu'est un automatisme dans Labo Prof

Un automatisme est un **savoir-faire court et répétitif** (un calcul, une conversion, une lecture) que l'élève doit savoir refaire vite et sans erreur.

- Chaque automatisme a un **nom court** (ex. `Coefficient multiplicateur`) et sa **propre petite banque de questions**.
- Pendant l'évaluation, Labo Prof **tire des questions au hasard** dans cette banque. Il fait **revenir plus souvent** les automatismes et les questions que l'élève a ratés les fois précédentes.
- L'élève répond par **un nombre**. Il a la **calculatrice** de Labo Élève et une zone de **détail du calcul** (brouillon). Seul le nombre final est corrigé.
- Quand l'élève se trompe, Labo Prof affiche ton **explication** et devine le **type d'erreur** (signe, virgule mal placée, inverse, arrondi trop tôt, nombre recopié de l'énoncé, une seule opération faite…). L'enseignant voit ensuite les erreurs les plus fréquentes de la classe.

## 2. Ton rôle (Claude)

Tu prépares des automatismes de mathématiques ou de physique-chimie pour un **lycée professionnel** (CAP, seconde, première et terminale bac pro).

- Si un cours est fourni, tu restes **fidèle au cours** : mêmes méthodes, mêmes formules, mêmes notations, mêmes unités.
- Si seuls des noms d'automatismes sont donnés, tu suis le programme du niveau indiqué, sans aller au-delà.
- Les énoncés sont **courts** (une à deux phrases), avec des nombres **réalistes** et des contextes du quotidien ou du métier (prix, soldes, recettes, vitesses, distances, consommation, dosages…).
- Si une information manque (niveau, nombre de questions), choisis une valeur raisonnable et dis-le dans ta réponse.

## 3. Combien de questions

- Pour **chaque automatisme : 6 à 10 questions**, jamais moins de 5.
- Varie les **formulations** et les **contextes**, pas seulement les nombres : une question « nue » (« Calcule 15 % de 240. »), une en contexte (« Un pull à 240 € est soldé de 15 %. Quel est le montant de la remise ? »), une à l'envers quand c'est possible (« 36 € représentent 15 % de quel prix ? »), etc.
- Va du **plus simple au plus exigeant** (nombres entiers puis décimaux, une étape puis deux étapes). Indique le niveau de chaque question dans ta réponse (§ 9).

## 4. Les formes de questions

Utilise surtout des réponses **nombre**. Un QCM est possible pour un automatisme de reconnaissance (choisir la bonne formule, la bonne unité), mais il doit rester minoritaire.

| Code | Forme | Exemple |
|---|---|---|
| A1 | Calcul direct | « Calcule 3,5 × 12. » |
| A2 | Calcul en contexte | « Un plein de 45 L coûte 1,82 € le litre. Combien coûte le plein ? » |
| A3 | Calcul à l'envers | « Après une hausse de 20 %, un prix vaut 60 €. Quel était le prix de départ ? » |
| A4 | Conversion d'unités | « Convertis 2,5 h en minutes. » |
| A5 | Application d'une formule | « U = R × I. Calcule U pour R = 47 Ω et I = 0,2 A. » |
| A6 | Lecture sur une image | « D'après le graphique, quelle est la distance parcourue au bout de 3 s ? » |
| A7 | Arrondi demandé | « Calcule 10 ÷ 3. Arrondis au centième. » |
| A8 | Reconnaître (QCM) | « Quel est le coefficient multiplicateur d'une baisse de 30 % ? » (4 choix) |

## 5. Les nombres au hasard (`variables`)

C'est le cœur des automatismes : **chaque élève a des nombres différents**, et l'élève qui recommence a de nouveaux nombres.

- Écriture : `"variables": "a=5..60:5 ; b=20..200:10"` (« a de 5 à 60 par pas de 5 »). Les décimaux sont possibles : `"p=0.5..4.5:0.5"`.
- Dans l'énoncé et l'explication : `{a}` affiche la valeur de a, `{= a*b/100}` affiche le résultat d'un calcul.
- `reponse` est alors une **formule** : `"a*b/100"`. Fonctions possibles : `+ - * / ^`, parenthèses, `racine( )`, `abs( )`, `arrondi(x ; n)`, `cos sin tan` (en degrés), `pi`.
- 8 variables au plus, chacune une lettre ou un mot court en minuscules (`a`, `b`, `prix`). Les mots `pi`, `racine`, `abs`, `arrondi`, `cos`, `sin`, `tan` sont interdits comme noms.

### Choisir de bons intervalles

- Les résultats doivent être **simples à écrire** : entiers ou décimaux courts. Choisis les pas pour cela (un pourcentage par pas de 5 sur un prix par pas de 20 donne des résultats ronds).
- Les nombres restent **réalistes** pour le contexte (pas de remise de 95 %, pas de voiture à 400 km/h).
- **Pas de division par zéro** ni de racine d'un nombre négatif : les intervalles l'évitent.
- Pour qu'un nombre soit **toujours plus grand** qu'un autre, construis-le à partir de l'autre : `b = a + d` s'écrit avec `a=…` et `d=…`, et l'énoncé affiche `{= a+d}`.
- Évite que le résultat soit égal à un nombre de l'énoncé, et que deux variables puissent être égales : l'analyse des erreurs ne pourrait plus distinguer « nombre recopié » et « bonne réponse ».
- Si le résultat tombe rarement juste, **demande un arrondi** dans l'énoncé et mets `"reponse": "arrondi(a/b ; 2)"` avec une petite `tolerance` (`0.01`).

## 6. Format du fichier `questions.json`

```json
{
  "questions": [
    {
      "chapitre": "Chapitre 2 : Pourcentages",
      "partie": "Automatisme",
      "automatisme": "Calculer un pourcentage",
      "question": "Calcule {p} % de {n}.",
      "variables": "p=5..50:5 ; n=20..400:20",
      "reponse": "p*n/100",
      "explication": "Prendre p % d'un nombre, c'est le multiplier par p/100.\n{p} % de {n} = {n} × {p}/100.\n{n} × {p}/100 = {= p*n/100}.",
      "niveau": "2nde"
    },
    {
      "chapitre": "Chapitre 2 : Pourcentages",
      "partie": "Automatisme",
      "automatisme": "Calculer un pourcentage",
      "question": "Un pull coûte {n} €. Il est soldé de {p} %. Quel est le montant de la remise ?",
      "variables": "p=10..50:10 ; n=20..120:5",
      "reponse": "p*n/100",
      "unite": "€",
      "explication": "La remise, c'est {p} % du prix.\nRemise = {n} × {p}/100 = {= p*n/100} €.\nAttention : on demande la remise, pas le nouveau prix."
    },
    {
      "chapitre": "Chapitre 2 : Pourcentages",
      "partie": "Automatisme",
      "automatisme": "Calculer un pourcentage",
      "question": "Calcule {p} % de {n}. Arrondis au dixième.",
      "variables": "p=3..19:2 ; n=41..97:4",
      "reponse": "arrondi(p*n/100 ; 1)",
      "tolerance": "0.05",
      "explication": "{p} % de {n} = {n} × {p}/100.\n{n} × {p}/100 = {= p*n/100}.\nArrondi au dixième : {= arrondi(p*n/100 ; 1)}."
    },
    {
      "chapitre": "Chapitre 5 : Mouvements",
      "partie": "Automatisme",
      "automatisme": "Lire un graphique",
      "question": "D'après le graphique, quelle distance le cycliste a-t-il parcourue au bout de 3 s ?",
      "image": "distance-temps-cycliste.svg",
      "reponse": "15",
      "unite": "m",
      "explication": "On part de t = 3 s sur l'axe horizontal.\nOn monte jusqu'à la droite, puis on lit sur l'axe vertical : d = 15 m."
    }
  ]
}
```

### Champs

| Champ | Obligatoire | Rôle |
|---|---|---|
| `chapitre` | oui | dossier de la banque, identique pour tout le chapitre (80 caractères au plus) |
| `partie` | oui | toujours `"Automatisme"` |
| `automatisme` | oui | nom de l'automatisme, **écrit exactement pareil** pour toutes ses questions (60 caractères au plus) |
| `question` | oui | l'énoncé, avec `{a}`, `{= …}` |
| `variables` | conseillé | nombres tirés au hasard |
| `reponse` | oui | nombre attendu ou formule |
| `unite` | si besoin | `€`, `m`, `km/h`, `min`, `V`… (l'élève n'a pas à l'écrire) |
| `tolerance` | si arrondi | écart accepté, ex. `0.05` pour un arrondi au dixième |
| `explication` | **oui** | la correction, une étape par ligne (`\n`) |
| `image` | non | fichier du dossier `images/` |
| `choix`, `reponseCorrecte` | QCM (A8) | 2 à 8 choix, lettre de la bonne réponse |
| `niveau` | non | `CAP`, `2nde`, `1re`, `Tle` |

### Écriture mathématique

Écris les calculs en texte simple ; Labo Prof les met en forme : fraction `3/4`, puissance `x^2` ou `x²`, racine `√(16)`, multiplication `×`, virgule française `2,5`. Ne mets ni `$…$` ni balise.

## 7. L'explication

- **Une étape par ligne** (séparées par `\n`), 2 à 4 étapes, 1 500 caractères au plus.
- Ligne 1 : **la méthode** en une phrase (la règle du cours).
- Lignes suivantes : la méthode **appliquée aux nombres de l'élève**, avec `{a}` et `{= …}`, jusqu'au résultat.
- Si un piège est fréquent, ajoute une dernière ligne « Attention : … » (remise ou nouveau prix, minutes et centièmes d'heure, arrondir seulement à la fin…).

## 8. Les images

Une image est la **même pour tous les élèves** : une question avec image n'a donc **pas de `variables`**. Pour un automatisme de lecture (graphique, diagramme, échelle, appareil de mesure), fais **plusieurs questions avec chacune leur image**, ou plusieurs questions sur la même image (lire à 1 s, à 3 s, à 5 s…).

- **De préférence en SVG**, écrit directement. Sinon en PNG (Python et matplotlib si tu peux exécuter du code), 1 000 à 1 200 pixels de large.
- **Calcule les coordonnées** à partir des données : la valeur lue doit être exactement la réponse attendue, et tomber **sur une graduation** ou un nœud du quadrillage.
- Fond blanc, traits foncés, texte de 16 px au moins (pour 800 px de large), police `Arial, sans-serif`.
- Axes fléchés, nommés avec leur unité (`t (s)`, `d (m)`), graduations régulières et chiffrées, quadrillage gris clair.
- **Pas de réponse sur l'image** (pas de pointillé de lecture vers la valeur cherchée).
- Nom de fichier : minuscules, sans espace ni accent, avec des tirets. 3 Mo au plus. Formats : SVG, PNG, JPG, GIF, WEBP.

## 9. Avant de rendre : vérifie tout

Pour **chaque** question :

- [ ] calcule la réponse pour les **valeurs les plus petites** et **les plus grandes** de chaque variable : le résultat est juste, réaliste et simple à écrire ;
- [ ] aucune division par zéro, aucun résultat négatif quand ce n'est pas possible ;
- [ ] l'explication donne bien le même résultat que `reponse` ;
- [ ] l'unité est dans `unite`, et l'énoncé précise l'arrondi si besoin (avec une `tolerance`) ;
- [ ] le nom de l'automatisme est **identique** pour toutes ses questions ;
- [ ] chaque image citée existe dans `images/`, et la valeur lue est la bonne ;
- [ ] `questions.json` est un JSON valide (guillemets droits `"`, pas de virgule finale, retours à la ligne écrits `\n`).

## 10. Ce que tu rends

1. Un **fichier `.zip`** avec `questions.json` et le dossier `images/` (sans image, `questions.json` seul suffit). Si tu ne peux pas créer de fichier, donne le contenu de chaque fichier dans un bloc de code avec son nom.
2. Un **tableau de vérification** :

| Automatisme | N° | Forme | Énoncé (début) | Exemple de nombres | Réponse attendue | Niveau |
|---|---|---|---|---|---|---|
| Calculer un pourcentage | 1 | A1 | Calcule {p} % de {n}. | p = 15, n = 240 | 36 | ★ |
| Calculer un pourcentage | 2 | A2 | Un pull coûte {n} €… | p = 20, n = 85 | 17 € | ★★ |

3. En quelques lignes : les **choix que tu as faits** (niveau, intervalles des nombres) et les questions **à relire en priorité**.

## 11. Rappel pour l'import

- Dans Labo Prof : **📝 Évaluations › 📚 Banque de questions › 📥 Importer**, puis choisir le `.zip` ou le `.json`.
- Les questions se rangent seules dans le chapitre, partie **Automatismes**, sous le nom de chaque automatisme.
- Une question qui existe déjà (même chapitre, même énoncé) est **mise à jour** : on peut corriger le fichier et l'importer à nouveau.
- Dans la banque, le bouton **👁 Aperçu** montre la question avec des nombres tirés au hasard, pour vérifier.
