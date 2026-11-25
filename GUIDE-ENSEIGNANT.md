# Labo Élève — Guide de l'enseignant

Labo Élève est une application Windows qui rassemble des outils interactifs de mathématiques et de physique-chimie. Vous pouvez y **ajouter de nouveaux outils à tout moment**, sans réinstaller l'application.

## 1. Deux applications : Labo Élève et Labo Prof

| Application | Pour qui | Ce qu'elle contient |
|---|---|---|
| **Labo Élève** (icône bleu-vert, fiole) | les PC des élèves | les outils, « Ma classe », le mode focus et le mode examen. **Pas d'espace professeur** : même avec le mot de passe, il ne s'ouvre pas. |
| **Labo Prof** (icône orange, toque) | ton PC | s'ouvre directement sur **Mes classes** (élèves, documents, Digipads, suivi en direct, mode examen). Le bouton *Outils des élèves* montre les outils tels que les élèves les voient, pour les essayer. Jamais de mode focus ni d'examen sur ton PC. |

Les deux applications peuvent être ouvertes en même temps sur ton ordinateur. Elles ont des réglages séparés ; à sa première ouverture, Labo Prof reprend le dossier partagé déjà choisi dans Labo Élève.

### Installer Labo Élève sur les ordinateurs des élèves

Dans le dossier `installeur/`, vous trouverez :

| Fichier | Utilisation |
|---|---|
| `Labo Élève Setup 1.0.0.exe` | Installateur classique (menu Démarrer, raccourci bureau, double-clic sur les fichiers `.outil`). |
| `Labo-Eleve-portable-1.0.0.exe` | Version portable : rien à installer, se lance directement (depuis une clé USB par exemple). |

> Windows peut afficher « Windows a protégé votre ordinateur » car l'application n'est pas signée. Cliquez sur **Informations complémentaires → Exécuter quand même**.

### Installer Labo Prof sur ton ordinateur

Dans `installeur/prof/` : `Labo Prof Setup 1.0.0.exe` (installateur) ou `Labo-Prof-portable-1.0.0.exe`. **Ne le donne pas aux élèves.**

Pour reconstruire les deux applications après une modification :

```bash
npm run installeur
```

(`npm run installeur:eleve` ou `npm run installeur:prof` pour n'en reconstruire qu'une.)

## 2. Outils inclus

- **Calculatrice** (tous niveaux) : calculatrice scientifique (puissances, racines, trigonométrie en degrés ou radians, historique). Autorisée par défaut en mode examen.
- **Tableau périodique** (tous niveaux, version CAP / bac pro) : les éléments de **H à Xe** (5 premières lignes), présentés comme dans les manuels. Chaque case donne le **nombre de masse A**, le **numéro atomique Z**, le symbole, le nom et la **masse molaire M** (g/mol, une décimale). Les colonnes I à VIII sont numérotées, et une **case explicative « X »** au milieu du tableau rappelle ce que sont A, Z, X et M. Quand l'élève clique sur un élément, sa **case s'affiche en grand**. Les réponses ne sont **pas données** : dans *🔎 À toi de trouver*, l'élève retrouve lui-même le nombre de protons, de neutrons et d'électrons (la répartition sur les couches n'est pas proposée). *✔ Vérifier* indique les cases justes (vert) et fausses (rouge), sans donner la correction. La fiche montre aussi la ligne et la colonne, la masse molaire et, pour quelques métaux, l'ion courant (Fe²⁺ / Fe³⁺, Cu²⁺, Zn²⁺, Ag⁺). Le tableau repère les familles (alcalins, halogènes, gaz nobles), et le filtre ★ *Éléments à connaître* met en avant les éléments du programme. L'outil calcule aussi la masse molaire d'une formule en détaillant le calcul (M = M(Ca) + 2 × M(O) + …) et la quantité de matière n = m / M.
- **Calculatrice NumWorks** (tous niveaux) : l'émulateur officiel, voir plus bas.
- **Mes documents** (tous niveaux) : documents téléchargés depuis les pads, avec lecture et annotation des PDF, voir plus bas.
- **Traitement de texte** (tous niveaux) : présenté **comme Word** (ruban *Fichier, Accueil, Insertion, Mise en page, Affichage*, règle, zoom, « Page X sur N »). **Vraies pages A4 séparées** : un paragraphe qui ne tient plus en bas d'une page passe à la suivante. Polices et tailles, styles *Normal / Titre 1 / 2 / 3*, gras, couleurs, surbrillance, listes, retraits, interligne, tableaux, images, liens, symboles, saut de page (Ctrl+Entrée), marges et orientation. **En-tête, pied de page et numéros de page** (*Insertion*, ou double-clic en haut / en bas d'une page). **Équations, comme dans Word** (*Insertion → Équation* ou **Alt+=**) : une zone « Tapez une équation ici. » s'ouvre directement dans la page, à l'endroit du curseur ; l'élève tape au clavier, ex. `(a+b)/2`, `x^2`, `√(x+1)`, `√(3&x)` (racine cubique), `v_0`, `vec(AB)` (une espace termine une fraction : `1/2 m v^2`), avec un aperçu du rendu pendant la frappe. **Entrée**, **Échap** ou une flèche en bout de zone ressortent de l'équation, qui s'affiche alors comme dans un manuel ; un clic dessus permet de la modifier. Pendant la saisie, l'onglet violet **Équation** du ruban propose les structures (fraction, exposant, indice, racines, parenthèses, crochets, valeur absolue, somme, intégrale, vecteur), une palette de symboles (π, ×, ÷, ±, ≤, ≥, ≠, ≈, ∞, lettres grecques, →, °…) et *Supprimer l'équation* ; Ctrl+Z annule. Ouvre et enregistre les fichiers Word (`.docx`) **avec leur mise en forme** : les équations deviennent de vraies équations Word, modifiables dans Word, et celles des documents Word redeviennent modifiables à l'ouverture. *Fichier → Imprimer / Exporter en PDF* crée un PDF dans Mes documents (avec en-tête et numéros de page). **Raccourcis clavier de Word** (version française) : Ctrl+G / I / U, Ctrl+E centrer, Ctrl+Maj+G / Ctrl+Maj+D (ou Ctrl+L / Ctrl+R) aligner à gauche / à droite, Ctrl+J justifier, Ctrl+= indice, Ctrl+Maj++ exposant, Ctrl+Maj+> / Ctrl+< taille du texte, Ctrl+Espace effacer la mise en forme, Ctrl+1 / 5 / 2 interligne, Ctrl+Alt+1 / 2 / 3 *Titre 1 / 2 / 3*, Ctrl+Maj+N *Normal*, Ctrl+Maj+L puces, Ctrl+K lien, Alt+= équation dans la page, Ctrl+N / Ctrl+O / Ctrl+S / F12 / Ctrl+P ; la liste complète s'affiche avec **F1**, le bouton **?** ou *Fichier → Raccourcis clavier*, et dans les infobulles des boutons. Sur un clavier AZERTY, AltGr+2 / AltGr+3 tapent toujours ~ et # (utiliser le pavé numérique pour Ctrl+Alt+2 / 3).
- **GeoGebra Classique** (tous niveaux) : le GeoGebra **déjà installé** sur l'ordinateur de l'élève (GeoGebra Classic 6 ou Calculatrice GeoGebra), ouvert **dans** Labo Élève : il marche donc avec le mode focus, sans Internet, et tu peux l'autoriser (ou non) en mode examen. GeoGebra n'est pas fourni avec Labo Élève ; s'il n'est pas installé, l'outil propose la page de téléchargement officielle et s'ouvre tout seul une fois l'installation finie. Attention en examen : GeoGebra Classique contient le calcul formel. GeoGebra® est gratuit pour un usage non commercial ([licence](https://www.geogebra.org/license)).
- **Kahoot!** : affiché **dans** Labo Élève, sur la page où l'élève tape le **code PIN** du quiz que tu lances au tableau, puis son pseudo (sans compte). Seuls les sites de Kahoot sont accessibles depuis cet outil ; il peut être autorisé en mode examen comme la Quizinière. Thème proposé *Exercices en ligne*.
- **La Quizinière** (exerciseur de Réseau Canopé) : affichée **dans** Labo Élève. L'élève entre le **code de l'exercice** que tu lui donnes (sans compte), répond, puis retrouve sa copie corrigée avec *Accéder à ma copie*. Seul le site de la Quizinière est accessible depuis cet outil (les liens vers d'autres sites sont bloqués). Tu peux l'**autoriser en mode examen** (case à cocher au lancement de l'examen) pour une évaluation en ligne. Elle figure dans le thème proposé *Exercices en ligne*.
- **Recherche internet** (désactivée par défaut) : un navigateur **dans** Labo Élève, avec le moteur français **Qwant** et son **filtre parental strict imposé** (l'élève ne peut pas l'enlever). Les **assistants IA** sont bloqués : l'onglet *Chat IA* et le résumé IA de Qwant, ChatGPT, Gemini, Copilot, Mistral, Claude, Perplexity… Les fichiers téléchargés vont dans *Mes documents*. Tu l'actives **classe par classe** dans Labo Prof, case **🌐 Recherche internet** à côté de *Mode focus* : la carte apparaît ou disparaît chez les élèves en 5 secondes (l'outil ouvert se ferme s'il est désactivé). Jamais disponible pendant un examen ni en mode classe.
- **Tableur** (tous niveaux) : présenté **comme Excel** (ruban *Fichier, Accueil, Insertion, Formules, Données, Affichage*, Zone Nom, barre de formule *fx*, onglets de feuilles, barre d'état avec Somme / Moyenne de la sélection et zoom). Formules en français : **en tapant `=SOM…` la liste des fonctions s'affiche** (Tab pour choisir), comme dans Excel, on peut taper `=` puis **cliquer sur une cellule** (ou faire glisser pour une plage) : chaque référence s'affiche **en couleur**, avec un cadre de la même couleur autour de la cellule, et **F4** la rend absolue (`B2` → `$B$2` → `B$2` → `$B2`) ; une **bulle rappelle la syntaxe** (`SOMME(nombre1; [nombre2]; …)`) ; le bouton **fx** ouvre *Insérer une fonction* avec la description et un exemple de chaque fonction. Somme automatique, poignée de recopie (suites et formules), clic droit, insertion/suppression de lignes et colonnes. Mise en forme : **police et taille**, gras, couleurs, bordures, alignement, **Renvoyer à la ligne**, **Fusionner et centrer**, formats Nombre, Pourcentage, **Monétaire (€)** et **Date** (les dates jj/mm/aaaa se calculent : `=C3-C2` donne le nombre de jours). **Trier** (A → Z, Z → A, la ligne d'en-tête est gardée) et **Filtrer** (menus ▾ sur la ligne d'en-tête, comme Excel). **Figer les volets**, **masquer / afficher** des lignes et colonnes, **hauteur des lignes** et largeur des colonnes à la souris ou au clavier (*Format*). Graphiques (*Insertion*) : nuage de points avec **droite de tendance** (y = a·x + b ou y = k·x, avec R²), courbe, histogramme et **diagramme en secteurs**. **Clic sur un graphique** : l'onglet **Création de graphique** apparaît (comme dans Excel) pour tout modifier : type, cellules utilisées, titre et titres des axes, légende, quadrillage, étiquettes de données, courbe de tendance et équation, minimum / maximum des axes, couleur de chaque série, taille ; Suppr efface le graphique sélectionné. **Probabilités** (onglet *Formules*) : fonctions `ALEA`, `ALEA.ENTRE.BORNES`, `NB.SI`, `SOMME.SI`, `MOYENNE.SI`, `FACT`, `COMBIN`, `PERMUTATION`, `LOI.BINOMIALE`, `QUARTILE`, `MODE`, `MOD`, `ARRONDI.INF` / `ARRONDI.SUP` ; les tirages au hasard ne changent qu'à chaque modification ou avec **F9** (*Relancer*), comme dans Excel. Le bouton **🎲 Simulation** prépare en un clic une nouvelle feuille : pièce, dé, somme de deux dés, entier entre deux bornes ou épreuve à deux issues de probabilité p, jusqu'à 2 000 tirages (un par ligne, en formules), le tableau des effectifs, fréquences et probabilités, l'histogramme *fréquences observées / probabilités* et la courbe de la fréquence d'une issue au fil des tirages (**loi des grands nombres**). F9 refait tous les tirages : les élèves voient les fréquences bouger autour de la probabilité. Enregistre en `.xlsx` **avec toute la mise en forme** (fusions, filtres, volets figés, formats…) lisible dans Excel ou LibreOffice, ou en `.csv` ; *Fichier → Imprimer / Exporter en PDF* crée un PDF dans Mes documents.
- **MonBureauNumérique** et **Pronote** (tous niveaux) : l'ENT et Pronote affichés dans Labo Élève, voir plus bas.
- **Word**, **Excel** et **PowerPoint en ligne** (tous niveaux) : les applications Microsoft 365 affichées dans Labo Élève, compatibles avec le mode focus, voir plus bas.
- **Redy (Jeulin)** (physique-chimie, tous niveaux) : ouvre **Redy**, le logiciel gratuit de Jeulin pour les TP (acquisition avec les capteurs et interfaces Jeulin, tableaux, graphiques, modélisation). Labo Élève ne contient pas Redy : il faut l'**installer sur chaque PC** (téléchargement gratuit sur le site de Jeulin, avec ton compte enseignant). Labo Élève le trouve tout seul (menu Démarrer, dossiers Jeulin / Redy) ; sinon la carte explique à l'élève qu'il doit être installé. Redy s'ouvre dans sa propre fenêtre. **En mode focus, Redy est autorisé** (voir section 8) ; il reste bloqué en mode examen et en mode classe.
- **Labo de chimie** et **Labo de physique** (physique-chimie, tous niveaux — version de départ, à enrichir) : des **manipulations virtuelles** liées aux programmes de CAP et de bac pro. L'élève choisit une manipulation, s'**équipe** (blouse, lunettes, gants : sans eux il ne peut pas manipuler), réalise les gestes sur la paillasse en cliquant (choisir un bécher, tremper le papier pH, pipeter, brancher un appareil, régler le générateur…) et reçoit des retours immédiats, y compris sur les erreurs (sonde non rincée, pipetage sans propipette, ampèremètre en dérivation → fusible grillé, trait de jauge dépassé…). À droite, un **panneau du protocole** (repliable) avec trois onglets :
  - **📋 Suivre** : les étapes du protocole se cochent toutes seules quand l'élève les réalise ; certaines posent une question (corrigée automatiquement) ;
  - **🧩 Construire** : l'élève **construit lui-même le protocole** en remettant les étapes dans l'ordre, parmi lesquelles se cachent des étapes **fausses ou dangereuses** (« goûter la solution », « pipeter à la bouche »…). *Vérifier* explique ce qui ne va pas ; une fois juste, c'est son protocole qu'il suit ;
  - **📊 Mesures** : le tableau des mesures (cases vertes / rouges quand l'élève calcule ou conclut), le **graphique** avec la droite et son équation (loi d'Ohm), et *Enregistrer mes mesures* en CSV dans Mes documents (avec l'option de te l'envoyer).
  **Pour l'instant, ces deux labos ne contiennent aucune manipulation fournie** : c'est toi qui y ajoutes tes expériences (voir *Tes propres expériences dans les labos* ci-dessous). Les anciennes manipulations d'exemple (pH, ions, dilution, loi d'Ohm, masse volumique) sont gardées hors de l'application, dans le dossier `archives/manips-labos/` du projet, pour être reprises plus tard. La progression de l'élève est gardée sur son PC (*Recommencer* remet tout à zéro). Ils sont dans les thèmes par défaut *Chimie*, *Électricité* et *Mesures et graphiques*.
- **Labo de maths** (maths, tous niveaux) : même principe que les labos de sciences, pour **explorer une notion**. Il propose pour l'instant une seule activité fournie : **⚖️ Équations à la balance** (voir plus bas), affichée dans le labo à la place de la paillasse. Tu peux la masquer et ajouter tes propres activités. Les anciennes explorations d'exemple (fonction affine, Pythagore, fréquence d'un dé) sont gardées dans `archives/manips-labos/`. Dans les thèmes par défaut *Fonctions*, *Géométrie et trigonométrie*, *Calculs* et *Statistiques*.
- **Simulateurs et sites dans les labos** (chimie, physique, maths) : dans **Labo Prof**, ouvre un labo (« Outils des élèves ») : la section **🧩 Simulateurs et sites** te propose :
  - **🔗 Ajouter un lien vers un site** (simulation PhET en ligne, applet GeoGebra, page de ressource…) : titre, adresse, consigne. L'élève l'ouvre **dans** Labo Élève, limité à ce site (compatible avec le mode focus) ; *Accueil* le ramène au labo ;
  - **📦 Installer un simulateur** : une page **HTML** (par exemple une simulation PhET téléchargée depuis phet.colorado.edu : bouton de téléchargement, fichier `.html`) ou un dossier compressé **.zip** contenant une page `index.html`. Il est copié dans le dossier partagé (`Labos/<labo>/`), puis sur chaque PC élève : il **fonctionne sans Internet**. Par sécurité, un simulateur installé est isolé : il ne peut pas accéder à Labo Élève ;
  - *🗑 Retirer* supprime la ressource pour tous les élèves.
  Les élèves voient ces ressources sous les manipulations, sans les boutons de gestion.
- **Tes propres expériences dans les labos** (chimie, physique, maths) : toujours dans **Labo Prof**, connecté, ouvre un labo.
  - **🙈 Masquer** (sur chaque activité, fournie ou créée par toi) : les élèves ne la voient plus, sans qu'elle soit supprimée. Toi, tu la vois grisée, avec **👁 Réafficher**.
  - **➕ Créer mon expérience** : titre, thème, niveaux (CAP, 2de, 1re, Tle), consigne ou objectif, puis le contenu, au choix :
    - **🧩 Lien d'intégration** : colle l'adresse, ou le code `<iframe …>` donné par le site (GeoGebra : *Partager › Intégrer* ; PhET en ligne ; LearningApps : *Intégrer*). L'activité s'affiche **dans le labo**, à la place de la paillasse. Seuls les sites que tu as enregistrés ainsi peuvent s'afficher dans un labo, même s'ils l'interdisent normalement ; l'adresse doit commencer par `https://` ;
    - **🔗 Lien vers un site** : il s'ouvre comme les liens ci-dessus, dans Labo Élève, limité à ce site. Au retour, l'élève revient sur l'expérience ;
    - **🖥️ Simulateur installé** : une page HTML ou un .zip, comme ci-dessus (fonctionne sans Internet).
  - **Protocole** : écris **une étape par ligne**. Les étapes s'affichent dans le panneau *📋 Suivre* : l'élève **coche lui-même** chaque étape faite (il n'y a pas de correction automatique). Une ligne qui se termine par **« ? »** devient une **question**, avec une zone de réponse.
  - L'expérience apparaît avec les manipulations, marquée **« créée par le professeur »**. Tu peux la **✏️ modifier** ou la **🗑 supprimer**. La progression de chaque élève (étapes cochées, réponses) reste sur son PC, comme pour les autres manipulations.
  - Tout est rangé dans le dossier partagé (`Labos/<labo>/ressources.json`), puis copié sur chaque PC élève. Tous les PC doivent avoir la nouvelle version de Labo Élève : une ancienne version ne verrait plus les liens et simulateurs une fois qu'une expérience a été créée ou une manipulation masquée.
- **Cartes mémoire** (toutes matières, tous niveaux) : l'élève crée ses **flashcards** (question au recto, réponse au verso), un paquet par chapitre, avec une palette de symboles (×, ², √, Ω, Δ, →…) et des **formules** écrites entre deux `$` (`$U=R*I$`, `$x^2$`). **Réviser** : il lit la question, retourne la carte (clic ou Espace) et dit s'il savait (touches 1 / 2) ; ou bien, mode **Écrire la réponse**, il tape la réponse, vérifiée sans tenir compte des majuscules, accents et espaces. Sens *Question → réponse*, *Réponse → question* ou *Mélangé*. Méthode des **boîtes de Leitner** : une carte réussie revient dans 1, 3, 7 puis 14 jours, une carte ratée revient tout de suite (et une fois en fin de séance) ; le bilan montre le score et les cartes à revoir. Chaque paquet est un fichier `Nom.cartes.csv` dans *Mes documents* (colonnes *Recto;Verso*). **Tu peux préparer un paquet pour ta classe** dans le Tableur ou Excel (colonne A = question, colonne B = réponse, enregistré en CSV sous le nom `Chapitre.cartes.csv`) et le déposer dans un thème : l'élève l'ouvre et commence à réviser, sa progression restant sur son PC. Dans le thème commun *Mes productions*.
- **Équations à la balance** (maths, tous niveaux) : outil **créé par Arnaud DURAND** ([mathix.org](https://www.mathix.org/equation-anim/), licence GPL), intégré tel quel et utilisable **sans Internet**. Il n'est plus dans la liste des outils : il se trouve **dans le Labo de maths**, où tu peux le masquer. L'élève résout une équation du premier degré en gardant la balance en équilibre : il ajoute ou retire des *x* et des poids des deux côtés, et les étapes de calcul s'écrivent à côté. *Nouveau défi* tire une équation au hasard, *Personnaliser* permet d'entrer la sienne. Le nom de l'auteur est affiché sur la carte de l'activité et en bas de l'outil ; le fichier `outils/equation-balance/CREDITS.txt` indique la source, la licence et les petites modifications faites pour Labo Élève.
- **Python** (tous niveaux) : apprendre à programmer, **sans Internet**. Éditeur avec couleurs, numéros de ligne et indentation automatique (Tab, Ctrl+/ pour commenter), **▶ Exécuter** (F5) et **■ Arrêter** (Échap, utile pour une boucle infinie). La console accepte `input()` : un champ de réponse apparaît à la suite de la question. Modules `math`, `random`, `turtle` (la **tortue** dessine dans une zone à droite)… **Erreurs expliquées en français** avec un conseil et la ligne surlignée (deux-points oubliés, indentation, texte + nombre, `input()` qui renvoie du texte, virgule au lieu du point…). **📚 Exemples** : input, calculs (loi d'Ohm), conditions, boucles for et while, fonctions, listes, hasard (dé), suite et seuil, tortue. **🎯 Exercices** : 15 exercices progressifs (afficher → variables → input → conditions → fonctions → boucles → listes → hasard → physique), **vérifiés automatiquement** avec **✔ Vérifier**, un indice 💡 par exercice et le compteur de réussites. Les programmes s'enregistrent en `.py` dans Mes documents (le brouillon est aussi gardé automatiquement) ; tu peux déposer un `.py` dans un thème de ta classe. Le thème par défaut **Algorithmique** (maths) contient l'outil.

Pour changer les niveaux d'un outil, modifiez le champ `niveaux` de son `manifest.json` (voir plus bas).

### Deux outils sur le même écran (« Côte à côte »)

Dans un outil ouvert, le bouton **Côte à côte** (en haut à droite) ouvre un deuxième outil à droite : par exemple la consigne (PDF, Digipad) à gauche et le tableur à droite, ou la calculatrice à côté du traitement de texte.
- **Contenu proposé :** en classe, l'élève choisit parmi ce que tu as rangé dans les thèmes de la matière (outils, Digipads, documents, groupés par thème) et *Mes documents*. En examen : seulement les outils autorisés.
- **Réglages :** le **séparateur** se fait glisser pour donner plus de place à un côté (entre 25 % et 75 %, la largeur est retenue). **⇄** inverse les deux côtés sans recharger les outils. **Changer** remplace l'outil de droite, **✕** le ferme.
- **Fermeture :** *Accueil* ferme les deux côtés. Chaque outil demande d'enregistrer s'il y a un document en cours.
- **Exception :** les sites intégrés (Word / Excel en ligne, Pronote, ENT, Recherche internet, Quizinière) ne s'ouvrent que du côté principal, à gauche.

Les outils *Traceur de fonctions*, *Cercle trigonométrique* et *Mouvement d'un projectile* ont été retirés de l'application. Ils sont gardés hors de l'application, dans le dossier `archives/outils-retires/` du projet, avec l'ancien tableau périodique complet.

## 3. Créer un nouvel outil

Un outil est simplement un **dossier** qui contient :

```
mon-outil/
├── manifest.json   ← la carte d'identité de l'outil
├── index.html      ← la page de l'outil
└── icone.svg       ← (facultatif) l'icône
```

Le plus simple : **copiez le dossier `modele-outil/`** et modifiez-le.

### Le fichier `manifest.json`

```json
{
  "id": "loi-ohm",
  "titre": "Loi d'Ohm",
  "description": "Fais varier R et I et observe la tension U.",
  "matiere": "physique-chimie",
  "niveaux": ["cap1", "cap2", "2pro"],
  "version": "1.0.0",
  "icone": "⚡",
  "couleur": "#f59e0b",
  "motsCles": ["électricité", "tension", "résistance"],
  "entree": "index.html"
}
```

- `id` : nom unique en minuscules, chiffres et tirets.
- `matiere` : `maths`, `physique-chimie`, ou toute autre matière (`svt`, `technologie`…). Un nouveau filtre apparaît automatiquement.
- `niveaux` : les classes pour lesquelles l'outil est proposé. Au premier lancement, l'élève choisit sa classe, et l'accueil n'affiche que les outils de ce niveau (il peut changer de niveau à tout moment).

  | Valeur | Classe |
  |---|---|
  | `cap1` | 1re année de CAP |
  | `cap2` | 2e année de CAP |
  | `2pro` | Seconde professionnelle |
  | `1pro` | Première professionnelle |
  | `tpro` | Terminale professionnelle |

  Sans champ `niveaux`, l'outil apparaît à tous les niveaux.
- `icone` : un emoji (`"⚡"`) ou le nom d'un fichier image du dossier (`"icone.svg"`).
- `version` : **à augmenter à chaque mise à jour** (`1.0.0` → `1.1.0`). L'application n'installe une version que si elle est plus récente que celle déjà présente.

### La page `index.html`

C'est une page web normale (HTML, CSS, JavaScript). Pour obtenir le même style que les autres outils, incluez les fichiers communs :

```html
<link rel="stylesheet" href="../../commun/outil.css">
<script src="../../commun/outil.js"></script>
```

Vous disposez alors de :
- la mise en page `.outil` > `.panneau` (réglages à gauche) + `.scene` (dessin à droite) ;
- les composants `.curseur`, `.champ`, `.btn`, `.stats` / `.stat`, `.case` ;
- les couleurs du thème clair ou sombre : `var(--c1)` à `var(--c5)`, `var(--accent)`…
- les aides JavaScript : `Outil.canvas()`, `Outil.curseur()`, `Outil.fleche()`, `Outil.nombre()`, `Outil.css()`.

Le fichier `modele-outil/index.html` montre tout cela en moins de 60 lignes. Pour tester votre outil, ouvrez simplement `index.html` dans un navigateur, à condition que le dossier soit placé à côté de `commun/` (par exemple dans `outils/`).

L'outil doit fonctionner **sans Internet** : n'utilisez pas de bibliothèques en ligne, copiez-les plutôt dans le dossier de l'outil.

## 4. Distribuer l'outil aux élèves (la « mise à jour »)

### Étape 1 : créer le paquet

```bash
npm run paquet -- modele-outil
```

Cette commande vérifie le manifeste et produit le fichier `paquets/aire-disque-1.0.0.outil`. Le paquet est **signé** avec la clé du développeur (voir *Sécurité* plus bas) : sans signature, il ne peut pas être diffusé par le dossier partagé.

### Étape 2 : le donner aux élèves, au choix

1. **Double-clic** : envoyez le fichier `.outil` (ENT, mail, clé USB). L'élève double-clique dessus et l'outil s'installe dans l'application.
2. **Bouton « + »** dans l'application : *Choisir un fichier .outil*.
3. **Dossier partagé (automatique)** : dans le bouton « + », choisissez une seule fois un dossier partagé (lecteur réseau du lycée, dossier synchronisé…). À chaque démarrage, l'application installe d'elle-même les nouveaux outils et les nouvelles versions déposés dans ce dossier. **C'est la solution la plus pratique pour une classe entière.** Seuls les outils **signés** (créés avec `npm run paquet`) et les outils sans code (Digipad, outils de *🛠 Créer un outil*) sont installés ainsi. Un outil non signé déposé dans le dossier partagé est **refusé** ; Labo Prof l'indique.

Pour les choix 1 et 2 (installation à la main), un outil non signé n'est installé qu'après un avertissement (« Outil non signé… Installer quand même ? »).

Un outil ajouté affiche le badge **Nouveau** sur l'accueil.

### Mettre à jour un outil existant

Modifiez l'outil, **augmentez `version`** dans `manifest.json`, recréez le paquet et redistribuez-le. Les outils inclus d'origine peuvent aussi être mis à jour de cette manière (même `id`, version supérieure). L'élève peut toujours revenir à la version d'origine depuis la liste « Outils installés ».

### Mettre à jour l'application elle-même (nouveaux outils intégrés, nouveaux modules)

Depuis la **version 1.1**, Labo Élève et Labo Prof savent se mettre à jour depuis le dossier partagé.

1. Sur le PC du développeur : augmenter `version` dans `package.json` (ex. 1.1.0 → 1.2.0), puis construire les installeurs : `npm run installeur`.
2. Publier : `npm run publier -- --notes "Ce qui change"`. Le script copie les deux installeurs dans le dossier partagé, sous-dossier **« Mise à jour de l'application »**, avec un fichier `version.json` **signé**.
3. Sur chaque PC, au démarrage (puis toutes les 30 minutes), un bandeau **🎁 Nouvelle version disponible** propose **Installer**. Windows demande l'autorisation (« Oui »), l'application s'installe et redémarre seule. On peut aussi passer par le bouton « + » › *Version de l'application*.

L'application vérifie la signature et l'empreinte du fichier avant de l'installer : un installeur modifié ou déposé par quelqu'un d'autre est refusé. La mise à jour n'est pas proposée pendant un examen, en mode classe ou en mode focus.

⚠ Les PC qui ont encore la version 1.0 doivent recevoir la version 1.1 **une dernière fois à la main** (installeur habituel) : c'est elle qui apporte la mise à jour automatique.

### Un(e) collègue veut modifier l'application (avec Claude)

1. **Créer le kit** : `npm run kit` → `kit-enseignant/Labo-kit-<version>-<date>.zip`. C'est une copie du projet **sans la clé de signature** : elle ne permet pas de publier quoi que ce soit chez les élèves. Le fichier `LISEZMOI-KIT.txt` explique tout au collègue.
2. **Chez le collègue** : il installe Node.js, tape `npm install`, fait ses modifications avec Claude et teste avec `npm run test-prof` / `npm run test-eleve`. La **version de test** a un bandeau orange « VERSION DE TEST », `[TEST]` dans le titre et ses propres données (« Labo Prof (test) ») : elle ne touche pas aux applications installées. Il choisit un dossier partagé **de test** (un dossier vide), pas celui du lycée.
3. **Il t'envoie ses modifications** : `npm run envoyer -- "Son nom" "Ce qui change"` crée un petit `.zip` avec uniquement les fichiers ajoutés, modifiés ou supprimés.
4. **Tu examines** : `npm run examiner -- "Modifications-….zip"` affiche la liste et range les fichiers dans `modifications-recues/` sans rien changer (Claude peut te les expliquer). Les **conflits** (un fichier que tu as aussi modifié) et les **fichiers sensibles** (clé publique, signature, preload…) sont signalés.
5. **Si tu es d'accord** : `npm run examiner -- "Modifications-….zip" --appliquer`. Tes anciens fichiers sont sauvegardés dans `sauvegardes/`. Les conflits et fichiers sensibles ne sont **pas** appliqués, sauf si tu ajoutes `--forcer` après les avoir vérifiés.
6. Tu testes, puis tu publies la mise à jour pour tout le monde (voir ci-dessus).

## 5. La calculatrice NumWorks

L'émulateur NumWorks n'est **pas inclus** dans Labo Élève : ses conditions d'utilisation interdisent de le redistribuer. Chaque élève le télécharge donc lui-même, gratuitement, sur le site officiel :

1. L'élève ouvre la carte **Calculatrice NumWorks** et clique sur *Ouvrir le site de NumWorks*.
2. Il clique sur « Télécharger l'émulateur » sur le site. Le fichier arrive dans Téléchargements.
3. Labo Élève le détecte tout seul (dans Téléchargements, Bureau ou Documents) et ouvre la calculatrice. Pas besoin de dézipper.

Si le fichier est ailleurs, le bouton *Choisir le fichier moi-même…* permet de l'indiquer. L'application en garde une copie sur le PC de l'élève : la calculatrice reste disponible même si le fichier téléchargé est supprimé, et elle fonctionne sans Internet. L'élève peut la retirer depuis « Outils installés ».

### Word, Excel et PowerPoint en ligne

Les logiciels Word et Excel installés sur le PC ne peuvent pas s'afficher dans Labo Élève : il n'y a donc pas de carte pour eux. Pour la bureautique, les élèves utilisent le traitement de texte et le tableur intégrés, ou les versions en ligne ci-dessous.

Les cartes **Word en ligne**, **Excel en ligne** et **PowerPoint en ligne** affichent les vraies applications Microsoft 365 **à l'intérieur** de Labo Élève, sans ouvrir de fenêtre : elles fonctionnent donc en **mode focus** et en **mode classe**.

- Il faut une connexion Internet et un **compte Microsoft de l'établissement** (Office 365 Éducation, souvent fourni par l'ENT). L'élève se connecte avec le bouton *Se connecter* de Microsoft ; si l'établissement passe par l'ENT ou l'académie pour la connexion, ces pages sont autorisées automatiquement.
- L'élève reste connecté d'une séance à l'autre. Ses fichiers sont enregistrés sur son **OneDrive**.
- Seuls les sites Microsoft sont accessibles : un lien vers un autre site est bloqué (et noté en mode focus / classe).
- Un fichier téléchargé depuis Office (*Fichier → Enregistrer sous → Télécharger une copie*) arrive dans **Mes documents**.
- En revenant à l'accueil, le document Office reste ouvert en arrière-plan : l'élève le retrouve en cliquant à nouveau sur la carte.

### MonBureauNumérique et Pronote

Les cartes **MonBureauNumérique** et **Pronote** (catégorie *Établissement*) affichent l'ENT et Pronote **à l'intérieur** de Labo Élève : ils restent utilisables en **mode focus**.

- **MonBureauNumérique** fonctionne tout de suite. L'élève se connecte avec son compte **EduConnect** (ou le mode de connexion de son académie), puis accède à Pronote depuis l'ENT sans retaper ses identifiants.
- **Pronote** : chaque établissement a sa propre adresse. Dans **Labo Prof**, bouton **🏫 Pronote et ENT**, colle l'adresse de l'espace élèves de ton lycée (ouvre Pronote dans ton navigateur et copie l'adresse, du type `https://0570000a.index-education.net/pronote/eleve.html`). Elle est enregistrée dans le dossier partagé : la carte fonctionne alors sur **tous** les PC des élèves. Tant que l'adresse n'est pas indiquée, la carte affiche un message.
- Seuls ces sites, EduConnect et les sites de connexion de l'académie sont accessibles : un lien vers un autre site (YouTube…) est bloqué.
- La connexion est mémorisée entre deux séances, comme pour Office.
- **Médiacentre** : les ressources de l'ENT (manuels numériques, Lumni, Éduthèque, Pix…) s'ouvrent **dans** Labo Élève. Quand l'élève clique sur une ressource du Médiacentre, le site de la ressource (éditeur, Lumni…) est autorisé pour la séance, y compris en mode focus. Les ressources passant par le **GAR** (le gestionnaire d'accès de l'Éducation nationale) sont aussi prises en charge. En revanche, un site qui ne vient pas du Médiacentre reste bloqué.
- Le bouton **◀ Page précédente**, en haut, permet de revenir au Médiacentre (ou à la page d'avant) après avoir ouvert une ressource.
- Une ressource qui demande d'installer un logiciel ou une application à part ne peut pas s'ouvrir dans Labo Élève.

**Listes d'élèves depuis Pronote :** Pronote n'a pas d'interface officielle pour échanger des données avec d'autres logiciels. Pour remplir une classe, copie la liste des élèves depuis Pronote (ou depuis un export Excel) et colle-la dans *Ajouter des élèves* : seule la première colonne (le nom) est gardée, et la ligne d'en-tête est ignorée. Tu peux aussi exporter la liste en **CSV** depuis Pronote et l'importer avec **📄 Importer la liste Pronote (CSV)** (nom et prénom gardés, même en deux colonnes).

## 6. Labo Prof : comptes, classes, élèves et thèmes

Labo Prof permet à **chaque enseignant** (toutes matières) de créer ses classes, d'y inscrire ses élèves, puis de préparer des **thèmes** : de grandes icônes dans lesquelles il range les **outils**, les **documents** et les **Digipads** de ses élèves.

### Comptes enseignants

- Chaque enseignant a **son compte** : un nom affiché aux élèves (ex. « M. Dupont »), sa **matière** et un mot de passe. Il ne voit et ne modifie **que ses classes**, et celles où un collègue l'a invité comme **co-enseignant** (voir plus bas).
- À l'ouverture de Labo Prof : *Qui es-tu ?* → clique sur ton compte → mot de passe.
- **Nouvel enseignant :** *+ Je suis un nouvel enseignant*. Un collègue déjà inscrit valide le compte en tapant **son** mot de passe : un élève qui récupérerait Labo Prof ne peut donc pas se créer de compte.
- **Si tu utilisais déjà Labo Prof :** ton ancien mot de passe devient ton compte. À la première connexion, indique ton nom et ta matière : tes classes existantes te restent attribuées.
- *👤 Mon profil* (en haut) : changer ton nom ou ta matière.

### Mise en place (une seule fois)

**☁ Dossier partagé sur Nuage (apps.education.fr) — conseillé quand les élèves ont leur propre PC** : pas besoin de lecteur réseau ni de compte pour les élèves, et ça marche au lycée, à la maison et en 4G.
1. Dans ton **Nuage** (apps.education.fr, avec ton identifiant académique), crée un dossier (ex. « Labo »), puis *Partager* → **Lien de partage** → *Permissions personnalisées* : coche **Lire, Créer, Modifier** et laisse **Supprimer décoché** (ainsi personne ne peut effacer les fichiers avec le lien). Un mot de passe est conseillé. Note la date d’expiration (un an) : il faudra renouveler le lien.
2. Dans **Labo Prof** : réglages (ou *Espace professeur* → dossier partagé) → **☁ Lien Nuage…**, colle le lien (et son mot de passe). Coche *Copier le contenu de mon dossier partagé actuel* si tu avais déjà des classes ailleurs.
3. Sur chaque PC élève, dans **Labo Élève** : **+** → **☁ Lien Nuage…**, colle le **même lien** (et le mot de passe).
Chaque PC garde une copie locale du dossier : l’application la synchronise avec Nuage toutes les 20 secondes et juste après chaque enregistrement. Sans réseau, rien n’est perdu : tout part au retour de la connexion. L’état s’affiche dans les réglages (« ☁ Synchronisé avec Nuage à … » ou « 📴 Hors ligne »). 🔒 **Données des élèves chiffrées sur Nuage** : les copies, sujets individuels, corrections, notes, travaux rendus et remarques, le suivi d’entraînement, les « Copies des élèves » et la liste des postes connus sont **chiffrés** avant de partir sur Nuage. Seuls l’élève concerné et les enseignants de la classe peuvent les lire ; quelqu’un qui a le lien ne voit que des fichiers illisibles. Les thèmes, sujets communs, documents et listes de classe restent lisibles par la classe (les noms des élèves y figurent, pour qu’ils puissent choisir le leur).
- Chaque PC a sa **clé** : celle de l’enseignant est créée quand il ouvre son espace professeur, celle de l’élève quand il choisit son nom. Un élève ne peut rien envoyer avant que l’enseignant de la classe ait ouvert Labo Prof une fois (ses copies attendent sur son PC : « ⏳ en attente de la clé de ton professeur »).
- **🔑 Sauvegarde ta clé** (réglages → *Sauvegarder ma clé*, avec un mot de passe d’au moins 8 caractères) et garde le fichier sur une clé USB : sans elle, un nouvel ordinateur ne pourrait pas relire les anciennes copies. Sur un nouveau PC : *Restaurer une clé…*.
- Un élève qui change d’ordinateur reçoit une nouvelle clé : les corrections et notes que tu enregistres ensuite lui sont lisibles ; les anciennes sont rechiffrées automatiquement par ton PC.
- Pour de vraies données, pars d’un **dossier Nuage neuf** : Nuage garde un historique des versions, et un ancien fichier envoyé en clair y resterait.

1. Il faut un **dossier partagé** accessible depuis ton PC et depuis les PC élèves : lecteur réseau du lycée, dossier ENT synchronisé… Sur chaque PC, indique ce dossier dans **+** → *Dossier partagé de l'établissement*. C'est le même dossier que pour les mises à jour.
2. Sur ton PC, ouvre **Labo Prof** et crée ton **compte** (nom, matière, mot de passe de 6 caractères minimum). Le mot de passe de n'importe quel enseignant sert aussi, sur les PC élèves, à **changer d'élève** (bouton 🔒) ou à **terminer un examen** sur place.
3. **Droits sur le dossier :** les élèves n'ont besoin que d'un accès en **lecture seule**. Demande-le à l'administrateur informatique, pour qu'aucun élève ne puisse modifier tes documents depuis l'Explorateur Windows.
4. **Suivi en direct :** la première fois que tu ouvres l'espace professeur, Windows peut demander d'**autoriser Labo Élève sur le réseau** (pare-feu). Accepte, sur les réseaux privés ou de domaine. Si ce n'est pas possible sans droits d'administrateur, demande-le à l'administrateur informatique. Ton PC et ceux des élèves doivent être sur le même réseau du lycée.

### Créer une classe

- **+ Nouvelle classe** : un nom (ex. « 2nde MELEC A »), un niveau et **une ou plusieurs matières**, à cocher (la tienne est cochée par défaut). Exemple : coche **Mathématiques** et **Physique-Chimie** si tu enseignes les deux dans cette classe. Deux enseignants peuvent avoir chacun une classe « 2nde MELEC A » : les élèves les distinguent par la matière.
- **Plusieurs matières dans une classe :** chaque matière a **ses propres thèmes** et apparaît comme **une carte** sur la page « Quelle matière ? » des élèves. Dans l'onglet *🗂 Thèmes et documents*, des onglets (📐 Mathématiques, ⚗️ Physique-Chimie…) te font passer d'une matière à l'autre. Pour changer les matières plus tard : bouton des matières en haut de la page de la classe (ex. « 📐⚗️ Mathématiques + Physique-Chimie »). La première matière est la **principale** ; si tu décoches une matière, ses thèmes passent dans la principale (rien n'est supprimé). *Déplacer* permet aussi d'envoyer un thème dans une autre matière.
- **Co-intervention :** choisis **🤝 Co-intervention maths-sciences** (maths / sciences avec l'enseignement professionnel) ou **🗣️ Co-intervention français** (français avec l'enseignement professionnel). Chacune a ses thèmes proposés (situations du métier, mesures et calculs, graphiques, expériences et sécurité ; écrits professionnels, oral, lecture de documents du métier). Les anciennes classes « Co-intervention » deviennent automatiquement « Co-intervention maths-sciences » (change-la si c'était du français).
- Onglet **Élèves** → *Ajouter des élèves* : colle toute la liste d'un coup, un élève par ligne (copie depuis Pronote ou un tableur). Les doublons sont ignorés.
- Onglet **Élèves** → **📄 Importer la liste Pronote (CSV)** : choisis le fichier CSV de la liste des élèves exporté de Pronote (ou d'un tableur). L'application reconnaît la colonne « Élève » (ou « Nom » et « Prénom »), le séparateur et les accents, puis montre la liste : décoche ceux à ne pas ajouter (ceux déjà dans la classe ne sont pas cochés).
- Onglet **🗂 Thèmes et documents** :
  - Tant que tu n'as créé aucun thème (dans une matière), tes élèves voient les **thèmes proposés pour cette matière** (en maths : Fonctions, Géométrie et trigonométrie, Calculs, Statistiques ; en physique-chimie : Électricité, Mécanique, Chimie, Mesures et graphiques ; pour toutes les matières : Mes productions, Rechercher, Mon lycée). *Utiliser ces thèmes et les modifier* les copie dans ta classe pour que tu les ajustes.
  - *📁 Nouveau thème* : un nom, une icône et une couleur. Dès qu'un thème existe, les thèmes proposés disparaissent. Dans un thème, *Nouveau dossier* crée un sous-dossier.
  - *🧰 Ajouter des outils* : coche les outils à proposer dans ce thème. **Les élèves ne voient que les outils que tu as rangés dans tes thèmes.**
  - *Ajouter un Digipad* (un nom et le lien du pad) et *Ajouter des documents* (PDF, Word, Excel, images, copiés dans le dossier partagé).
  - Pour chaque élément : ↑ ↓ pour l'ordre, *Icône* (thèmes), *Renommer*, *Déplacer*, *Supprimer*.
  - Les dossiers que tu avais créés avant cette version deviennent des thèmes. Les classes créées avant les « plusieurs matières » continuent de marcher : leurs thèmes restent dans leur matière.

### Co-enseignants : gérer une classe à deux (ou plus)

Un collègue qui a **Labo Prof** peut gérer une de tes classes **avec son propre compte** (par exemple en co-intervention, ou si vous partagez une classe en maths et en physique-chimie).

1. **Le même dossier partagé (le « drive relié ») :** vous devez avoir choisi, dans Labo Prof, **exactement le même dossier partagé** : lecteur réseau du lycée, ou dossier **OneDrive / Google Drive partagé** entre vous (synchronisé sur chacun de vos PC). C'est ce dossier commun qui relie vos deux Labo Prof.
2. Ton collègue y crée **son compte enseignant** (*+ Je suis un nouvel enseignant* ; tu valides avec ton mot de passe). **S'il n'apparaît pas** dans la liste des collègues, c'est qu'il n'a pas encore créé son compte dans ce dossier (ou qu'il utilise un autre dossier).
3. Sur la page de ta classe, bouton **👥 Co-enseignants** : coche ton collègue, puis *Enregistrer*.
4. Ton collègue voit alors la classe dans **Mes classes** (avec la mention « 👥 Co-enseignant ») et peut tout gérer comme toi : élèves, thèmes, documents, Digipads, travaux à rendre et réponses, copies des élèves, mode focus, recherche internet, examen et **suivi en direct** (les PC des élèves envoient leur signal à chacun de vous).
5. **Seul toi** (l'enseignant qui a créé la classe) peux **supprimer la classe**, **inviter** ou **retirer** un co-enseignant. Ton collègue peut seulement *Quitter cette classe*.

Les élèves voient le nom des deux enseignants (ex. « M. Dupont et Mme Martin »).

### Fin d'année : clôturer ses classes

En fin d'année (juin, juillet), on **clôture** ses classes. Ce n'est **pas une suppression** : rien n'est effacé.

- Sur la page d'une classe : **🗄 Clôturer l'année**. L'année scolaire est proposée (ex. « 2025-2026 ») ; tu peux la corriger. Pour tout faire d'un coup : **🗄 Clôturer toutes mes classes**, sous la liste « Mes classes » (les classes où tu es seulement co-enseignant ne changent pas).
- La classe passe dans **🗄 Années précédentes** (en bas de « Mes classes »), rangée par année. Elle est en **lecture seule** : tu peux encore consulter ses thèmes, ses élèves, les copies et les réponses aux travaux, mais plus rien n'est modifiable. Plus de mode focus, d'examen ni de suivi en direct pour cette classe ; un examen préparé est retiré.
- **Erreur ?** Ouvre la classe dans « Années précédentes » et clique sur **↩ Rouvrir la classe** : elle redevient normale, pour toi et tes élèves.
- Seul l'enseignant qui a créé la classe peut la clôturer ou la rouvrir. Les co-enseignants la voient aussi dans leurs « Années précédentes ».
- **Côté élève :** la classe disparaît de ses matières (elle ne le bloque plus : ni mode focus, ni examen). Un bouton **📚 Mes années précédentes** (sur la page des matières et en haut de ses thèmes) lui montre ses anciennes classes, par année puis par matière. Il y relit les **documents** (copiés dans ses Mes documents), les **Digipads**, les **outils**, et ses **travaux à rendre** (sa copie, en lecture seule : il ne peut plus la modifier ni la rendre). Sans réseau, il retrouve ce qu'il avait déjà ouvert sur son PC.
- **À la rentrée :** crée tes nouvelles classes. Chaque élève s'inscrit dans sa nouvelle classe (même professeur et même matière que l'an dernier : c'est permis), et garde l'accès à ses anciennes classes.
- Une classe clôturée occupe toujours de la place dans le dossier partagé. Quand tu n'en as plus besoin, *Supprimer la classe* l'efface définitivement (les élèves ne la verront plus dans leurs années précédentes).

### Créer un outil (H5P, LearningApps, page web…)

Dans le contenu d'une classe, le bouton **🛠 Créer un outil** (à côté de *Nouveau thème* et *Ajouter des outils*) transforme une activité en un **outil comme les autres**. Choisis d'abord ce que tu proposes :

- **📦 Une activité H5P** (fichier `.h5p`) : elle s'affiche dans Labo Élève et **fonctionne sans Internet**. Le fichier doit contenir ses bibliothèques : sur h5p.org ou h5p.com, utilise *Réutiliser › Télécharger en .h5p* ; avec le logiciel gratuit **Lumi**, exporte en `.h5p`. Sinon, un message te l'indique. La lecture se fait avec le lecteur libre h5p-standalone (licence MIT), inclus dans l'application.
- **🧩 Une activité en ligne à intégrer** : LearningApps (*Afficher › Intégrer*), Wordwall, Genially, GeoGebra (*Partager › Intégrer*), H5P en ligne… Colle l'adresse ou le code `<iframe …>`. L'activité s'affiche **dans** l'outil ; il faut Internet.
- **🖥️ Une page web ou un dossier .zip** (simulation, exercice HTML…) : copiée sur les PC, elle **fonctionne sans Internet**.
- **🔗 Un lien vers un site** : l'élève l'ouvre dans Labo Élève, limité à ce site.

Ensuite, donne un **nom**, une description courte, la **matière**, les **niveaux** (aucun coché = tous), une **icône** et une couleur. Pour l'icône, choisis un symbole dans la liste ou **🖼 Mon image** (PNG, JPG, SVG…, 2 Mo au maximum) pour mettre ta propre icône. Laisse cochée la case *Ajouter aussi cet outil dans…* pour le ranger tout de suite dans le thème ouvert.

- L'outil apparaît aussitôt dans **🧰 Ajouter des outils**, pour toutes tes classes.
- Il est rangé dans le **dossier partagé** (un dossier `cree-…`). Chaque PC élève le reçoit à la prochaine ouverture de Labo Élève, comme une mise à jour. Sans dossier partagé, l'outil reste sur ton PC seulement.
- Pour le retirer : **🛠 Créer un outil › 🗑 Supprimer un outil que j'ai créé**. Il disparaît aussi des PC des élèves à leur prochaine ouverture de Labo Élève.
- Par sécurité, le contenu importé (H5P, page, .zip) est **isolé** : il ne peut pas accéder à Labo Élève ni aux données des élèves.

### Évaluations de maths (QCM et automatismes, adaptées à chaque élève)

Dans une classe, onglet **📝 Évaluations**.

1. **📚 Banque de questions** : rangée en **dossiers, un par chapitre** (ex. « Chapitre 1 : Statistique »). Dans chaque chapitre :
   - **📖 Cours** : les questions de cours (souvent des QCM) ;
   - **🔢 Automatismes** : chaque automatisme (ex. « Coefficient multiplicateur ») a **sa propre banque de questions**. *➕ Nouvel automatisme* le crée, *➕ Question* lui ajoute une question.
   - Une question a une réponse **QCM** (réponses proposées, cocher la ou les bonnes) ou **un nombre** (réponse attendue, unité, tolérance). Elle peut avoir une **image** (graphique, figure, tableau…) : *🖼 Ajouter une image*. Dans un QCM, **chaque réponse proposée peut aussi avoir son image** (bouton 🖼 sur la ligne de la réponse) : la réponse peut être un texte, une image, ou les deux ; l'élève voit l'image dans la tuile. Les **nombres tirés au hasard** sont facultatifs (*🎲*) : `{a}` dans la question, et une formule comme `1+a/100` en réponse.
   - **Importer** : *📥 Importer* accepte un classeur **Excel**, un fichier **.json**, ou un **dossier compressé .zip** qui contient le classeur (ou le .json) **et les images**. *📄 Modèle Excel* donne un classeur prêt à remplir ; *📤 Exporter ma banque* l'enregistre (en .zip s'il y a des images), par exemple pour un collègue. Une question déjà présente (même chapitre, même question) est mise à jour.
   - **Avec Claude** : le fichier `FORMAT-BANQUE-QUESTIONS.md` (dans le dossier du projet) décrit le format. Donne-le à Claude avec ta demande (« prépare-moi le chapitre Statistique : 10 QCM de cours et 3 automatismes avec des images, en .zip pour Labo Prof ») et importe le .zip obtenu.
   - *✨ Ajouter des exemples* crée deux chapitres d'exemple.
2. **➕ Nouvelle évaluation** : un titre ; dans **📖 Cours**, coche les chapitres (ou des notions) et le nombre de questions ; dans **🔢 Automatismes**, coche les automatismes (ou un chapitre entier) et le nombre de questions ; la **durée** (chrono, 0 = sans), la **calculatrice** à côté, et le moment où l'élève voit sa **correction** : *dès qu'il a rendu sa copie*, ou *à la fin du chrono* (toute la classe en même temps : moins de partage de réponses).
3. **▶ Lancer** : chaque élève reçoit **ses propres questions**. Les notions et les questions où il s'est trompé les fois précédentes **reviennent en priorité** (avec d'autres nombres) ; celles qu'il a réussies reviennent moins souvent. La classe passe en **mode examen** et l'évaluation s'ouvre seule sur chaque PC.
4. **Côté élève** : une question à la fois (QCM puis calculs), le chrono en haut (rouge dans les 5 dernières minutes). Après avoir répondu, l'élève clique sur **✔ Valider ma réponse** : la pastille de la question devient verte (✓) et l'évaluation passe à la question suivante non validée. Il peut revenir modifier une réponse (elle compte toujours ; il la valide de nouveau). Quand tout est validé — ou avec *Terminer l'évaluation…* — une **page de confirmation** récapitule les questions (validée, je ne sais pas, non validée) avant *✔ Confirmer : mon évaluation est terminée*. L'évaluation se ferme alors et l'élève revient sur la **page où il choisit sa matière** (sa correction sera dans *📝 Mes évaluations*). Même chose quand tu termines l'évaluation. Une réponse écrite en phrase est comprise : « Cela vaut 6,0 », « 2x = 12 donc x = 6 » ou « 3/4 » sont comptées justes si le nombre est le bon. **QCM** : les réponses en grandes tuiles A, B, C, D, et un bouton **🤷 Je ne sais pas** en haut à droite (mieux que répondre au hasard ; tu le vois dans la copie). **Automatisme** : la réponse, et juste à côté **la même calculatrice que l'outil Calculatrice** de Labo Élève (degrés / radians, Rép, %, ×10ˣ…). Au-dessus, le **📝 Détail de mes calculs** sert de brouillon ou de justification : chaque calcul validé par « = » s'y ajoute, l'élève peut y **écrire une phrase** (✏️) et **supprimer une ligne** (✕). Ce détail est gardé avec la question : tu le vois dans la copie. **Écriture mathématique** : en mode *∑ Maths* (par défaut), l'élève écrit comme dans Word — `2x + 3 = 7`, `x^2`, `(a+b)/2`, `√(x)`, `v_0` — et voit tout de suite le rendu (fraction, puissance, racine…) ; une **palette** (fraction, puissance, indice, racine, ×, ÷, ±, ≤, ≥, ≈, π, °, Δ, →, ⇒) insère les écritures d'un clic. *Abc Texte* sert aux phrases. Les calculs de la calculatrice s'affichent aussi en écriture mathématique, et la **réponse peut être une fraction** (`3/4` est accepté pour 0,75). Dans les **questions et les réponses proposées**, les nombres, calculs, fonctions et inconnues sont affichés automatiquement en écriture mathématique (« Résous : 8x + 15 = 23 » → 8x + 15 = 23 en maths, le reste en texte) : écris-les simplement comme dans Word (`x^2`, `1/6`, `f(x) = 2x + 1`). *↳ Mettre le résultat dans ma réponse* recopie le dernier résultat. Tout est enregistré au fur et à mesure ; à la fin du chrono, la copie est rendue automatiquement.
5. **Suivi en direct** (encadré rouge, mis à jour toutes les 3 s) : qui n'a pas commencé, qui est en cours, combien de réponses, combien de **réponses fausses**. *Voir* ouvre la copie : réponses, bonnes réponses et calculs de l'élève. **Il n'y a pas de note** : seulement le retour des réponses fausses.
6. **Correction** : pour chaque question, l'élève voit **à gauche sa réponse et ses calculs**, **à droite la bonne réponse** et, s'il s'est trompé, **l'explication** (pour une réponse juste, elle reste accessible avec *💡 Voir l'explication*). En haut de sa correction, un encadré **📌 Pour réussir la prochaine fois** liste les **notions à revoir** (les plus ratées d'abord, avec les numéros des questions) et, pour chacune, un **conseil selon l'erreur repérée** (vérifier l'ordre de grandeur et la virgule, écrire les étapes au lieu d'une seule opération, n'arrondir qu'à la fin, revoir la leçon après un « je ne sais pas »…), puis les notions **réussies**. L'explication (facultative, champ *💡 Explication* de la question, ou colonne *Explication* dans Excel) peut utiliser les nombres tirés au hasard (`{a}`, `{= a*2}`). Écrivez **une étape par ligne** (touche Entrée) : chaque étape s’affiche sur sa propre ligne chez l’élève. Si tout est écrit d’un bloc, l’application passe à la ligne après chaque phrase. *Rendre les corrections* les donne tout de suite (l'examen continue) ; **Terminer l'évaluation** les rend à ceux qui ne les ont pas encore, puis arrête le mode examen. Après l'examen, l'élève relit ses corrections avec le bouton **📝 Mes évaluations** de sa classe — y compris s'il n'avait pas rendu sa copie quand tu as terminé l'évaluation (sa copie est corrigée telle qu'elle était). Si l'élève a encore l'évaluation ouverte quand tu la termines, sa correction s'affiche d'elle-même.

7. **📊 Analyse des erreurs** (bouton de l’onglet, ou *📊 Analyse* sur une évaluation passée) : pour chaque notion, le **taux de réussite** (les moins réussies en haut), les **élèves à aider** (moins de 50 % de réussite sur la notion) et, pour chaque question, les **erreurs les plus fréquentes** : la mauvaise réponse choisie (QCM), ou le type d’erreur repéré automatiquement (erreur de virgule ou d’unité, une seule opération avec les nombres de l’énoncé — par exemple 30 ÷ 100 au lieu de 1 − 30/100 —, valeur approchée, erreur de signe, nombre recopié, je ne sais pas…), avec des exemples de réponses.

**Les réponses ne quittent jamais ton ordinateur** : la banque, les corrigés et l'historique des élèves restent dans Labo Prof (sur ton PC) ; les élèves ne reçoivent que leurs énoncés, et c'est ton Labo Prof qui corrige leurs copies. **Labo Prof doit donc rester ouvert pendant l'évaluation.** Les évaluations passées de la classe restent consultables (*Voir les copies*).

### 🏋️ Entraînement des élèves (hors évaluation)

Onglet **📝 Évaluations** d’une classe, bloc **🏋️ Entraînement des élèves**. Ça ne compte pas dans les notes.

1. **🧩 Modules d’exercices** : un module = une fiche d’exercices (PDF) sur un chapitre et une ou quelques notions (ex. « Fonctions de degré 3 » › « Calculer une dérivée », « Tableau de variations »), avec éventuellement un **PDF du corrigé complet**. **📐 Questions et corrections** : tu encadres chaque question comme pour une évaluation « exercice » (réponse rédigée, tableau, tableau de variations, arbre…) et tu écris **sa correction** (une étape par ligne).
2. **⚙️ Ouvrir à la classe** : coche ce que la classe peut travailler — pour chaque chapitre de ta banque, le **📖 Cours** (QCM) et chaque **⚙️ automatisme**, et tes **🧩 modules**. Les questions de la banque sont copiées pour la classe avec leurs réponses (c’est de l’entraînement : ce sont des questions qui peuvent tomber en évaluation).
3. Côté élève : bouton **🏋️ S’entraîner** (dans sa matière). Il choisit un chapitre :
   - **📖 Cours** ou un **⚙️ automatisme** : une série de 10 questions tirées au hasard (les nombres changent à chaque fois), **corrigées tout de suite** avec la bonne réponse et ton explication ; à la fin, son score, **🎲 Nouvelle série** ou **🔁 Refaire les questions ratées** ;
   - un **🧩 module** : il fait l’exercice sur la feuille (comme une évaluation « exercice », avec la calculatrice), puis **✅ Voir la correction** : sa réponse à côté de ta correction, le corrigé complet en PDF si tu l’as mis, et il s’auto-évalue (✔ Réussi / ◐ Presque / ✘ À revoir). Il peut **🔁 Recommencer**.
4. **📊 Suivi** : pour chaque élève, le nombre de séries faites, sa réussite, les modules faits (et son auto-évaluation), la date ; clique sur un élève pour le détail par chapitre et automatisme.

### Évaluation « Exercice (PDF) » : ta feuille d’exercices, corrigée à la main

1. Onglet **📝 Évaluations** › **➕ Nouvelle évaluation** › **📄 Exercice (PDF)** : un titre, ta feuille d’exercices en PDF, la durée, la calculatrice ou non, et les **🧰 outils autorisés** (Calculatrice, Calculatrice NumWorks, Tableur, GeoGebra, Python, Tableau périodique). L’élève les ouvre d’un clic **à côté de l’évaluation (double fenêtre)** ; tous les autres outils restent fermés. Excel en ligne est un site internet : il ne peut pas s’ouvrir à côté, le Tableur le remplace.
2. **📐 Placer les questions** : trace un rectangle autour de chaque question **avec la place de sa réponse** (pointillés, tableau imprimé…). Les questions sont numérotées dans l’ordre de la feuille ; tu peux les renommer (ex. « Q7 »), les déplacer, les agrandir avec le coin, ou les supprimer. Clique sur une question dans la liste pour choisir :
   - son **type de réponse** : ✏️ *Réponse rédigée* (lignes de texte ou de calcul), 🔢 *Tableau de valeurs* (lignes, colonnes, cases déjà écrites sur la feuille), 🌳 *Arbre de probabilités* (nombre de niveaux et de branches par nœud ; événements ou probabilités déjà donnés, facultatif), 📈 *Tableau de variations / de signes* avec trois **modèles** : variations seules (croissance / décroissance), signe de la dérivée f′(x) + variations, ou tableau de signes seul ; puis le nombre de valeurs de x, les titres des lignes et les valeurs de x déjà écrites ; 🖼️ *Image / capture d’écran* : l’élève met une image dans la zone de réponse (par exemple la **courbe tracée avec GeoGebra ou la calculatrice**) — autorise l’outil dans les 🧰 outils de l’évaluation et trace une zone de réponse assez grande pour l’image ;
   - pour un tableau : **« Le tableau est déjà imprimé sur la feuille »** (coché par défaut) : la réponse de l’élève se cale sur ton tableau, sans le redessiner ;
   - **🔍 Placer la zone de réponse** : la question s’agrandit. Trace le rectangle où la réponse doit s’écrire (les pointillés, ou **exactement les bords du tableau imprimé**). Pour un tableau, fais glisser les **traits rouges** sur les traits du tableau (colonne des titres, séparations des lignes) et les **traits orange** là où chaque valeur de x doit s’écrire (par exemple sur les pointillés de « xS = …… »). Pour un **arbre** déjà dessiné : un **trait orange** sur chaque colonne de l’arbre (départ, nœuds, extrémités) et les **traits rouges** sur la première et la dernière extrémité ; l’élève écrit les événements sur les nœuds (bouton **M̄ Contraire** pour la barre) et les probabilités sur les branches, et tout s’écrit sur ton arbre. L’**aperçu en bleu** montre exactement comment la réponse apparaîtra.

   Sur la feuille de l’élève, on ne voit pas de cadre : seulement ce qu’il écrit, à l’encre bleue, en **12 pt** (plus petit seulement s’il écrit beaucoup dans une petite zone : prévois une zone de réponse assez grande).
   Pense à **💾 Enregistrer**.
3. **▶ Lancer** : la classe passe en mode examen et chaque élève reçoit la feuille. Il **clique sur une question** : elle s’ouvre **dans un panneau à droite**, agrandie, et **la feuille reste visible à gauche** (il peut relire l’énoncé et les autres questions, cliquer sur une autre question, ou agrandir la feuille avec 🔍+ / 🔍−). Il écrit sa réponse **ligne par ligne**, en **∑ Maths** (calculs, équations, avec la palette : fraction, puissance, racine…) ou en **Abc Texte** (phrases) ; pour un tableau de valeurs, il remplit les cases (Entrée : case suivante) ; pour un tableau de variations, il écrit les valeurs et **clique entre deux valeurs pour la flèche** (↗, ↘, →) et le signe (+, −) : les valeurs se placent en haut ou en bas toutes seules. Sa réponse s’écrit aussitôt dans la zone de réponse de la feuille. La calculatrice peut ajouter un calcul à sa réponse. Pour une question **🖼️ Image**, il ouvre l’outil à côté, trace sa courbe, clique sur **📷 Capturer l’outil à côté**, puis **trace un rectangle** autour de la partie utile (✂ Garder cette partie) : l’image s’affiche dans la zone de réponse de la feuille. Il peut aussi **coller** une image copiée (**Ctrl+V**) ou en choisir une sur l’ordinateur (📁). La capture marche aussi en mode examen : seul l’outil ouvert à côté est photographié. Il valide chaque question, puis confirme que son évaluation est terminée.

   **🖍️ Surligner** (en haut de la feuille) : l’élève fait glisser la souris sur l’énoncé pour le surligner en jaune (données importantes, mots-clés). En mode surligneur, un clic sur un surlignage l’efface ; 🧽 les efface tous ; on reclique sur 🖍️ Surligner pour revenir aux questions. Ses surlignages sont gardés avec sa copie : tu les vois en corrigeant, et lui les retrouve dans sa correction. Le surligneur et les questions 🖼️ Image existent aussi dans les **📄 Travaux à rendre** et les **modules d’entraînement**.
4. Tu suis l’avancement en direct (questions répondues). **✍️ Corriger les copies** ouvre la feuille de l’élève à gauche et ses réponses à droite : pour chaque question, **✔ Juste / ◐ En partie / ✘ Faux** et un commentaire, plus un commentaire général. Tout s’enregistre seul ; les flèches passent à la copie suivante.
5. **📤 Rendre les corrections** envoie la correction aux élèves dont la copie est corrigée (tu peux la modifier et la renvoyer). L’élève la retrouve dans **📝 Mes évaluations** : la feuille avec chaque question en couleur, ses réponses et tes commentaires.

Pas de note ni de correction automatique pour ce modèle, et il n’entre pas dans l’analyse des erreurs (réservée aux QCM et automatismes).

### 📊 Notes : ton système de notation et le carnet de notes de la classe

Onglet **📊 Notes** d’une classe. Les notes et leurs réglages restent sur ton PC ; chaque élève ne reçoit que la sienne, quand tu la lui montres.

1. **⚙️ Système de notation** : pars d’un modèle, puis règle-le comme tu veux.
   - 📈 **Progression** (comme ton Carnet Prof) : *Cours (QCM)* /10 avec un bonus de +1,5, *Automatismes* /6 (60 % évaluations « exercice » + 40 % automatismes), *Suivi* /4 (séances + travaux supplémentaires, saisis à la main) ;
   - 🎯 **Compétences** : S’approprier, Analyser / Raisonner, Réaliser, Valider, Communiquer (notes saisies à la main pour l’instant) ;
   - 🔢 **Moyenne classique** : la moyenne de toutes les évaluations, avec coefficients.
   Pour chaque **partie** de la note : son nom, ses points, un bonus, ses **sources** (QCM de cours, automatismes, évaluations « exercice », notes saisies à la main — avec un poids en % quand il y en a plusieurs) et sa **règle** : *Progression* (pour chaque notion, seule la **dernière** évaluation compte : l’élève peut rattraper), *Moyenne*, *Meilleure note*, ou *Somme* (notes saisies à la main additionnées, plafonnées). Tu choisis aussi trimestres ou semestres (avec leurs dates) et ce que vaut une réponse « en partie juste ». La note finale est ramenée sur 20.
2. Le **carnet** : un élève par ligne, une colonne par partie, la note /20 et une **appréciation**. Choisis la période en haut. Les évaluations de l’application comptent toutes seules (d’après leur date) ; un élève absent (sans copie) n’est pas pénalisé. Clique sur le nom d’un élève pour voir le **détail du calcul**.
3. **✍️ Saisir des notes** : évaluation sur papier, oral, comportement, travaux supplémentaires… (titre, date, partie de la note, « noté sur », coefficient ou « compte pour » selon la règle de la partie, une note par élève ou « absent »).
4. **📤 Montrer aux élèves** : chaque élève voit sa note de la période, le détail par partie et ton appréciation dans **📝 Mes évaluations** (dans sa matière). Après un changement, **🔄 Mettre à jour pour les élèves**.
5. **🎓 Vue Pronote** : chaque partie de la note est affichée **sur 20**, avec son **coefficient** (ses points, simplifiés : 10, 6, 4 → 5, 3, 2). Dans Pronote, crée un devoir par partie, noté sur 20, avec ce coefficient, et recopie les notes : la moyenne de Pronote est alors exactement la note /20 du carnet. (Une partie négative, comme un comportement très difficile, est mise à 0 pour Pronote : signalée par ⚠.)
6. **📥 Excel** : le carnet de la période en classeur Excel, avec une deuxième feuille **« Pronote »** (notes /20 et ligne des coefficients).

#### 🎯 Compétences et objectifs

1. **📚 Référentiel** (onglet 📊 Notes) : tes **compétences** (par défaut S’approprier, Analyser / Raisonner, Réaliser, Valider, Communiquer) avec le **niveau visé** de chacune (Non acquis, En cours, Acquis, Maîtrisé), et tes **objectifs de séquence** (ex. séquence « Fonctions du 2nd degré » : « Dresser un tableau de variations »), chacun relié ou non à une compétence. Le référentiel sert pour toutes tes classes. **📤 Exporter** le met dans un classeur Excel (feuilles « Compétences » et « Objectifs », modifiables) ou un fichier .json ; **📥 Importer** ajoute ceux d’un fichier (même nom : mis à jour, rien n’est supprimé) — pratique pour le partager avec un collègue ou le retrouver sur un autre PC.
2. **Relier les questions** : chaque question peut recevoir **🎯 une compétence, 🏁 un objectif et des points** — dans la banque de questions (QCM, automatismes), et dans **📐 Placer les questions** d’une évaluation « exercice » ou d’un travail à rendre. Les points comptent aussi dans la note des évaluations « exercice ».
3. **🎯 Compétences & objectifs** (onglet 📊 Notes) : pour chaque élève et chaque compétence, son **niveau** (Non acquis < 40 % ≤ En cours < 60 % ≤ Acquis < 80 % ≤ Maîtrisé), **▲ au niveau visé ou au-dessus, ▼ en dessous**, et le nombre d’élèves au niveau visé ; pour chaque objectif : ✅ atteint (70 % et plus), ◐ en cours (40 à 70 %), ❌ non atteint. Survole une case pour voir les questions prises en compte. Progression : quand une question est repassée, la dernière fois compte. Une question compte une fois corrigée : QCM / automatismes rendus, évaluation « exercice » corrigée à la main, travail à rendre avec tes remarques (✔ / ◐ / ✘).
4. Le modèle **🎯 Compétences** du système de notation prend maintenant directement ces niveaux : une partie par compétence (source « 🎯 Compétence »).
5. Quand tu montres les notes, chaque élève voit aussi **ses compétences (avec le niveau visé) et ses objectifs** dans « 📝 Mes évaluations ».

### Travail à rendre (PDF à compléter) : même format que l’évaluation « exercice »

1. Dans un thème, clique sur **📝 Travail à rendre (PDF)** et choisis le PDF (fiche de TP, exercice…).
2. **📐 Placer les questions** s’ouvre : c’est **le même éditeur que pour l’évaluation « exercice »** — un rectangle par question (avec la place de sa réponse), le type de réponse (réponse rédigée, tableau de valeurs, tableau de variations / de signes) et **🔍 Placer la zone de réponse** (zoom, traits rouges et orange, aperçu en bleu). Pense à **💾 Enregistrer**.
3. Côté élève, le travail apparaît dans le thème (📝 *Travail à rendre*). Comme pour une évaluation « exercice » : il clique sur une question, elle s’ouvre **à droite** (la feuille reste visible), il écrit sa réponse et elle **s’écrit sur la feuille** en 12 pt. Tout est **enregistré automatiquement** (même sans réseau : envoyé dès le retour du réseau), avec l’heure de chaque modification. Il termine avec **📤 Rendre mon travail** ; ensuite sa copie se lit mais ne se modifie plus. Pas de chrono ni de mode examen.
4. **👀 Suivre les réponses** (sur la ligne du travail) : la feuille de l’élève avec ses réponses écrites dessus, et à droite ses réponses question par question, **mises à jour en direct** (toutes les 4 secondes). Les flèches ← → et la liste passent d’un élève à l’autre (⏳ pas commencé, ✏️ en cours, ✅ rendu). **🕑 Historique des modifications** : chaque changement avec l’heure, la question, l’ancienne réponse (barrée) et la nouvelle.
5. **Remarques et travail à retravailler** : dans le suivi, pour chaque question, clique sur **✔ Validé**, **◐ À compléter** (il manque des informations) ou **✘ Faux**, et écris une remarque si tu veux (plus une remarque générale). Puis :
   - **🔁 Rendre pour retravailler** : le travail est rouvert ; l’élève voit un bandeau, ses questions en couleur sur la feuille (orange : à compléter, rouge : faux) et ta remarque quand il clique sur une question. Il corrige, puis te le rend de nouveau (📥 dans la liste des élèves) ; tu peux recommencer autant de fois que nécessaire ;
   - **✅ Valider le travail** : l’élève voit tes remarques, sa copie reste fermée (🏁 dans la liste).
   Tes remarques sont gardées à part : l’élève ne peut pas les effacer en modifiant sa copie.

Un ancien travail préparé avec des « cases » (avant cette version) garde son ancien fonctionnement.

Les copies sont dans le dossier partagé (`Classes/<classe>/travaux/`) ; supprimer le travail du thème ne supprime pas les copies déjà rendues.

### Copies des élèves : les documents que l'élève t'envoie

Quand un élève **enregistre** un document dans Labo Élève (traitement de texte, tableur, PDF annoté, Python, cartes mémoire…), il peut **en envoyer une copie à son professeur** — celui de la matière où il travaille :
- dans la fenêtre du nom du document, case **📤 Envoyer aussi une copie à …** ;
- sinon, la première fois qu'il enregistre un document, la question lui est posée (*Oui, envoyer* / *Non, garder pour moi*). Son choix est retenu pour ce document : s'il a dit oui, **chaque nouvel enregistrement met à jour ta copie** ;
- à tout moment, bouton **📤 Au prof** sur un document de ses *Mes documents*.

Tu retrouves tout dans Labo Prof, page de la classe, onglet **📂 Copies des élèves** : un dossier **au nom de chaque élève** (`Classes/<classe>/Copies des élèves/<NOM Prénom>/` dans le dossier partagé), avec la date du dernier enregistrement de chaque document. Clique sur un document pour l'ouvrir avec le logiciel de ton PC (Word, Excel, lecteur PDF…), ou sur *Ouvrir son dossier* / *Ouvrir le dossier*. Sans réseau, la copie reste sur le PC de l'élève et part toute seule dès que le réseau revient. Ses autres documents restent privés.

### Côté élève

- Au premier démarrage, l'élève choisit **sa classe**, puis **son nom** (une confirmation lui rappelle que ce choix est définitif).
- **Plusieurs matières :** au premier cours avec un autre enseignant, l'élève clique sur *+ Ajouter une matière*, choisit la classe de ce cours puis son nom (son nom déjà utilisé est proposé en premier). Une seule classe par enseignant et par matière.
- Ensuite, à chaque ouverture, la **première page est le choix de la matière** (s'il en a plusieurs), puis les **thèmes** en grandes icônes, puis leur contenu. Il ne voit plus la liste de tous les outils.
- **Revenir en arrière :** dans un thème, un grand bouton bleu **‹ Retour** (ex. « Retour aux thèmes », « Retour : Fonctions ») remonte d'un niveau. Dans un outil, le bouton en haut à gauche indique où il ramène (ex. « Retour : Fonctions »). Raccourcis : touche **Retour arrière** (dans les thèmes), **Alt + ←**, **Échap** (ferme l'outil) ou le bouton **précédent** sur le côté de la souris. Le même bouton existe dans Labo Prof, dans les thèmes d'une classe.
- Si un enseignant lance un **examen** dans l'une de ses classes, l'élève bascule automatiquement dans cette matière.
- Ce nom est alors **enregistré sur l'ordinateur** : à chaque ouverture de Labo Élève, l'élève est **connecté automatiquement**, sans rien choisir. Il **ne peut plus changer de nom** lui-même.
- Pour changer l'élève d'un ordinateur (erreur de nom, changement de place, PC partagé entre plusieurs classes), deux possibilités :
  - **à distance** : dans Labo Prof, onglet *Élèves*, bouton **Déconnecter** à côté de l'ordinateur (l'élève doit avoir Labo Élève ouvert dans ta matière). Seule **ta** matière est effacée : l'élève choisit de nouveau son nom dans ta classe, ses autres matières restent ;
  - **sur place** : sur le PC de l'élève, bouton **🔒 Changer d'élève**, puis ton mot de passe. **Toutes** les matières sont effacées et l'ordinateur revient à l'écran d'identification.
- **Plusieurs matières dans une même classe :** l'élève s'inscrit une seule fois, puis voit une carte par matière (ex. Mathématiques et Physique-Chimie) et retrouve les thèmes de la matière choisie. *⇄ Changer de matière* le ramène à cette page.
- **Suivi en direct :** chaque enseignant voit les élèves connectés **dans ses classes**, y compris celles où il est co-enseignant (plusieurs enseignants peuvent suivre leurs classes en même temps, dans des salles différentes).
- Si tu retires un élève de la classe, son ordinateur revient aussi à l'écran d'identification.
- Le nom est enregistré pour la **session Windows** : si les élèves se connectent à Windows avec leur propre compte, chacun a le sien, même sur un PC partagé.

### Suivi en direct : qui est connecté où

Tant que l'**espace professeur est ouvert** (déverrouillé) sur ton PC, chaque PC élève t'indique toutes les 15 secondes quel élève y est connecté. Rien n'est écrit par les élèves : leur PC envoie l'information directement au tien, par le réseau du lycée.

- Onglet **Élèves** : à côté de chaque nom, 🟢 et le **nom de l'ordinateur**, ou « hors ligne ». En haut, le nombre d'élèves connectés.
- **Même élève sur deux ordinateurs** : la fiche passe en rouge, un bandeau d'alerte s'affiche, et tu reçois une notification même si tu es ailleurs dans l'application (bouton *Voir*).
- **Déconnecter** à côté d'un ordinateur : il revient à l'écran d'identification (dans les 15 secondes), avec le message « Ton professeur a déconnecté ce compte sur cet ordinateur », et le nom enregistré sur ce PC est effacé. Ce PC ne peut plus reprendre ce nom **pendant la séance** ; le bouton *Autoriser à nouveau* annule la mesure.
- Quand tu verrouilles l'espace professeur ou fermes l'application, le suivi s'arrête ; les élèves continuent à travailler normalement.
- L'ordinateur est reconnu par une empreinte de son identifiant Windows (jamais l'identifiant lui-même) et affiché avec son nom Windows (ex. PC-SALLE-01).

### Alerte « ordinateur d'un autre élève »

Chaque élève a son propre ordinateur. Ton PC **retient à quel élève appartient chaque ordinateur** (fichier `Classes\postes-connus.json` du dossier partagé), d'une séance à l'autre.

Un élève administrateur de son PC pourrait supprimer le fichier de Labo Élève qui mémorise son nom, puis en choisir un autre. Dans ce cas :
- un **bandeau rouge** s'affiche dans l'onglet *Élèves* : « L'ordinateur PC-SALLE-01 était celui de DUPONT Léa, mais il est maintenant connecté au nom de MARTIN Hugo, sans que tu l'aies libéré » ;
- tu reçois une **notification**, même si tu es ailleurs dans l'application ;
- deux boutons : **Déconnecter**, ou **C'est normal** si le changement est légitime (l'ordinateur appartient alors au nouvel élève).

Pas de fausse alerte quand c'est toi qui libères le PC **sur place** (🔒 *Changer d'élève* + ton mot de passe) : le PC garde une preuve signée avec ton mot de passe, qu'un élève ne peut pas fabriquer. En revanche, après une déconnexion **à distance**, le prochain élève qui se connecte sur ce PC déclenche l'alerte : clique sur *C'est normal* si c'est voulu. Si tu changes ton mot de passe, les libérations faites avant le changement ne sont plus reconnues.
- Son accueil affiche **« Ma classe »** avec tes dossiers, tes Digipads et tes documents. Il se met à jour tout seul toutes les 30 secondes : un document ajouté pendant la séance apparaît sans redémarrer.
- Un document qu'il ouvre est **copié dans ses « Mes documents »** et s'ouvre dans le bon outil (lecteur PDF, traitement de texte, tableur). Il le complète, et l'original reste intact.
- Les Digipads de la classe restent accessibles en mode classe.
- En mode classe, le journal indique maintenant **le nom de l'élève** pour chaque événement.

**Données personnelles :** seuls les noms des élèves sont enregistrés, dans le dossier partagé de l'établissement. Les connexions (élève ↔ ordinateur) ne sont gardées que dans la mémoire de ton PC, le temps de la séance. Rien n'est envoyé sur Internet. Le suivi ne bloque pas un élève qui choisirait le nom d'un camarade : il te permet de le voir et de le déconnecter.

**Mot de passe oublié :** supprime le fichier `Classes\professeur.json` dans le dossier partagé, puis crée un nouveau mot de passe. Les classes sont conservées.

## 7. Tes Digipads et « Mes documents »

**Ajouter un pad :** bouton **+** → *Ajouter un Digipad*. Donne un titre, colle le lien de ton pad (celui que tu partages aux élèves), coche les niveaux concernés, puis *Ajouter la carte*. La carte apparaît dans la catégorie **Documents du cours**.

**Distribuer la carte à la classe :** dans *Outils installés*, clique sur *Exporter pour les élèves*. Tu obtiens un fichier `.outil` à distribuer comme les autres outils : double-clic, ou dépôt dans le dossier de mises à jour.

**Pour l'élève :**
- Le pad s'affiche directement dans Labo Élève. Il reste utilisable en mode classe, mais l'élève ne peut pas aller du pad vers un autre site : c'est bloqué et noté.
- Chaque document téléchargé depuis le pad est rangé dans **Documents\Labo Élève** et apparaît dans l'outil **Mes documents**.
- Un **PDF** s'ouvre dans Labo Élève : l'élève peut écrire du texte, dessiner, surligner, ajouter une image ou remplir les champs d'un formulaire. *Enregistrer* crée « fiche - complété.pdf » à côté de l'original, qui n'est jamais modifié. Il peut ensuite déposer ce fichier sur ton pad.
- Un **document Word** (`.docx`) s'ouvre dans le **Traitement de texte**, un **tableau** (`.xlsx`, `.xls`, `.ods`, `.csv`) dans le **Tableur**. Comme pour les PDF, *Enregistrer* crée « nom - complété.docx » (ou `.xlsx`) et l'original reste intact. Les boutons *Nouveau document* et *Nouveau tableau* créent un fichier vierge.
- À l'ouverture d'un fichier Word, la mise en page peut être **simplifiée** : les titres, le gras, l'italique, le souligné, les listes, les tableaux et les images sont gardés, mais pas les polices, les marges, les en-têtes et pieds de page, ni les zones de texte. Pour une fiche à la mise en page complexe, préférez un PDF (éventuellement avec champs de formulaire).
- Dans le tableur, les graphiques sont enregistrés dans le fichier `.xlsx` et réapparaissent à sa réouverture dans Labo Élève (Excel ne les affiche pas). L'élève peut aussi **copier l'image** d'un graphique et la coller dans son compte rendu.
- Les fichiers `.doc` (ancien Word), `.odt` et `.pptx` ne s'ouvrent pas dans l'application.

**Astuce :** pour des fiches à compléter proprement, exporte-les depuis Word ou LibreOffice en **PDF avec champs de formulaire**.

En mode classe, la fenêtre Windows « Choisir un fichier » (pour envoyer un travail sur le pad) n'est pas comptée comme une sortie : elle apparaît en gris dans le journal. Au-delà de 3 minutes, elle est comptée comme une sortie.

## 8. Le mode focus (automatique pour les élèves)

Pour les élèves identifiés dans une classe, Labo Élève s'ouvre en **mode focus** :
- **plein écran verrouillé**, au-dessus de toutes les fenêtres, sans possibilité de le réduire ;
- les sites web et logiciels externes sont bloqués (les Digipads de la classe restent accessibles) ;
- **les raccourcis pour quitter le bureau sont bloqués** : touche Windows (donc menu Démarrer, Win+Tab, Win+Ctrl+→ pour changer de bureau virtuel, Win+D…), Alt+Tab, Alt+Échap, Ctrl+Échap et Ctrl+Maj+Échap (Gestionnaire des tâches) ;
- **retour forcé** : si la fenêtre perd quand même la main (geste à 3 ou 4 doigts sur le pavé tactile, notification…), Labo Élève revient tout seul au premier plan en moins d'une demi-seconde ;
- **exception pour les TP : Redy (Jeulin)**. L'élève ouvre Redy depuis sa carte : Redy passe devant Labo Élève et il peut y travailler normalement, sans retour forcé et **sans que ce soit compté comme une sortie**. Un bouton **« ↩ Revenir à Labo Élève »** apparaît en bas à droite de l'écran ; pour retourner dans Redy, l'élève reclique sur *Ouvrir Redy* (la fenêtre déjà ouverte revient, sans en lancer une deuxième). Seul Redy est autorisé : tout autre programme est ramené et signalé comme avant. Jamais en mode examen ni en mode classe ;
- s'il réussit malgré tout à sortir, un message rouge l'attend à son retour, et **tu es prévenu** ;
- **le verrouillage de la session (Win+L) et la mise en veille ne comptent pas comme des sorties** : pas d'alerte, pas de notification (c'est seulement noté pour information dans le journal du PC). Pour éviter la triche, l'absence n'est excusée que si le verrouillage arrive juste après la perte de la fenêtre (3 secondes au plus) : un élève qui fait Alt+Tab, va ailleurs, puis verrouille pour le cacher voit sa sortie comptée jusqu'au moment du verrouillage ;
- pour fermer, l'élève clique sur **⏻ Terminer** (ou Alt+F4). Une fenêtre lui demande : « Ton travail est-il bien terminé ? », en lui rappelant d'enregistrer ses documents. S'il confirme, l'application se ferme.

**Ce que tu reçois** (espace professeur ouvert sur ton PC) :
- une notification **« 🔔 DUPONT Léa a fermé Labo Élève à 10:45 »** ;
- une notification **« ⚠ … a quitté Labo Élève pendant 14 s »** pour chaque sortie ;
- une alerte si l'application a été **fermée de force** (Gestionnaire des tâches), signalée à sa réouverture ;
- tout est rassemblé dans le **Journal de la séance**, onglet *Élèves* de la classe.

Si ton PC n'est pas joignable au moment de l'événement (espace professeur fermé, élève hors du réseau), l'événement est **gardé sur le PC de l'élève** et t'est envoyé à sa prochaine connexion. Le journal n'est conservé que pendant que ton application est ouverte.

**Activer ou désactiver :** case **Mode focus pour les élèves**, en haut de la page de chaque classe dans l'espace professeur. Il est activé par défaut. Le changement s'applique sur les PC des élèves dans les 30 secondes.

**Différence avec le mode classe :** le mode focus est automatique et laisse l'élève fermer l'application (en te prévenant). Le mode classe (avec ton code, section 10) empêche toute fermeture sur un PC. Pour une évaluation de toute la classe, utilise plutôt le **mode examen** (section suivante).

## 9. Le mode examen (pour toute une classe)

Depuis l'Espace professeur, tu mets **tous les PC d'une classe** en examen en un clic.

**Lancer :** page de la classe → **🎓 Mode examen**. Donne un titre (ex. « Évaluation — Loi d'Ohm ») et coche les **outils autorisés**. Par défaut : **Calculatrice**, **Calculatrice NumWorks** et **Tableur** ; tu peux en ajouter ou en retirer.

**Sur les PC des élèves** (dans les 5 secondes, pour tous les élèves de la classe dont Labo Élève est ouvert, puis pour ceux qui l'ouvrent ensuite) :
- seuls les outils autorisés restent sur l'accueil ; un outil non autorisé ouvert à ce moment-là est **fermé** ;
- « Ma classe », l'ENT, Pronote, Office, les Digipads, les réglages et l'espace professeur disparaissent ;
- un bandeau violet **« 🎓 Mode examen »** rappelle le titre, l'heure de début et les outils autorisés ;
- l'application est en **plein écran verrouillé** et **ne peut pas être fermée** (ni Alt+F4, ni Terminer) ;
- comme en mode focus, les raccourcis de sortie (touche Windows, Alt+Tab…) sont bloqués, la fenêtre revient seule au premier plan, et toute sortie t'est signalée et notée dans le journal.

**Pendant l'examen :** la page de la classe affiche « Examen en cours », et l'onglet *Élèves* indique **🎓 en examen** à côté de chaque élève connecté.

**Terminer :** bouton **Terminer l'examen** sur la page de la classe. Tous les outils reviennent sur les PC des élèves dans les 5 secondes.

L'examen est enregistré dans le dossier partagé : il continue même si tu fermes l'espace professeur ou ton application, et tu peux le terminer depuis n'importe quel PC où tu ouvres l'espace professeur.

### Et si un élève coupe son réseau ?

Couper le Wi-Fi ne fait **pas** sortir de l'examen. Chaque PC élève garde une copie des réglages de sa classe : sans réseau, il continue d'appliquer le dernier état connu (examen, outils autorisés, mode focus), même si l'élève ferme et rouvre Labo Élève.

- Dans Labo Prof, un élève en examen qui ne répond plus depuis 45 secondes déclenche une alerte : **« … ne répond plus pendant l'examen (réseau coupé ?) »**.
- Dès que son réseau revient, son PC t'envoie la durée de la coupure : **« … a perdu la connexion pendant 1 min 15 s (pendant l'examen) »**. Tout est noté dans le *Journal de la séance*.
- Sans réseau, son PC ne peut pas voir que tu as terminé l'examen : il reste en mode examen. Sur place, clique sur **🔒 Professeur** dans le bandeau violet et entre ton mot de passe : l'examen se termine sur ce PC seulement, et tu en es informé. Ça marche aussi pour libérer un élève qui a fini plus tôt.

### Examen dans une salle sans réseau (démarrage par code)

Si les PC des élèves n'auront pas de réseau pendant l'examen, prépare-le à l'avance :

1. Dans Labo Prof, ouvre la classe et clique sur **📴 Examen sans réseau**. Choisis le titre, les outils autorisés et un **code de 4 à 8 chiffres** (un code est proposé ; tu peux le changer).
2. **Avant l'examen**, chaque PC d'élève doit ouvrir Labo Élève dans cette classe **avec le réseau** une fois (par exemple au cours précédent). C'est à ce moment que le PC enregistre l'examen et son code.
3. Le jour de l'examen, sur chaque PC : clique sur **🎓 Examen** en haut de Labo Élève et tape le code. Le PC passe aussitôt en mode examen (plein écran verrouillé, seuls les outils choisis), même sans réseau, et même si l'élève redémarre le PC.
4. Fin de l'examen : sur chaque PC, bouton **🔒 Professeur** dans le bandeau violet, puis ton mot de passe. Si le réseau revient et que tu cliques sur **Retirer** dans Labo Prof, les PC encore en examen le terminent tout seuls.

Le code reste affiché dans Labo Prof (bloc « Examen sans réseau prêt ») ; **Modifier** change le titre, les outils ou le code. Le code ne sert qu'à **démarrer** l'examen : même s'il circule, un élève ne peut pas s'en servir pour en sortir. Quand le réseau revient, tu vois dans le suivi sur quels PC l'examen a été démarré avec le code.

**Limites :** comme pour le mode focus, Ctrl+Alt+Suppr (protégé par Windows, aucune application ne peut le bloquer) ou l'extinction du PC ne peuvent pas être empêchés, mais une fermeture forcée t'est signalée. La calculatrice NumWorks doit avoir été téléchargée à l'avance sur chaque PC (voir section 5).

## 10. Le mode classe (surveillance de la séance)

Le mode classe garde l'élève dans Labo Élève pendant la séance, pour que tu n'aies pas à vérifier son écran sans arrêt.

**Activer :** bouton **+** → *Mode classe (enseignant)*. La première fois, choisis un code de 4 à 8 chiffres et note-le bien. Le mode classe reste actif même si l'ordinateur redémarre.

**Ce qui se passe pour l'élève :**
- Labo Élève passe en plein écran verrouillé, au-dessus de toutes les fenêtres. On ne peut ni le fermer (Alt+F4 compris), ni le réduire.
- Les sites web et les logiciels externes (Word, Excel, liens) sont bloqués.
- La touche Windows, Alt+Tab, Ctrl+Échap et Ctrl+Maj+Échap sont bloqués, et la fenêtre revient seule au premier plan si elle perd la main.
- S'il sort quand même (verrouillage de la session, Ctrl+Alt+Suppr…), un message rouge « Tu as quitté Labo Élève » s'affiche à son retour, et la sortie est notée.
- Si l'application est fermée de force (Gestionnaire des tâches), c'est noté au redémarrage suivant.

**Consulter :** le bouton rouge **Mode classe** (avec le nombre de sorties) ouvre l'*Espace enseignant*. Après ton code, tu vois le journal de la séance : heure de chaque sortie, durée, fermetures forcées, codes erronés. Tu peux aussi quitter le mode classe, effacer le journal ou changer le code. Après 5 codes erronés, la saisie est bloquée 1 minute.

**Les limites, à connaître :**
- Aucune application ne peut empêcher **Ctrl+Alt+Suppr** (protection de Windows) : cette sortie est **détectée et signalée**, et la fenêtre revient au premier plan dès que l'élève quitte cet écran.
- Le blocage des raccourcis passe par un petit module Windows (`verrou-clavier.exe`, installé avec l'application). Il ne tourne que pendant le mode focus, examen ou classe, et s'arrête à la fermeture. Certains antivirus peuvent le signaler : il faut alors l'autoriser.
- Un élève qui connaît Windows peut supprimer les fichiers de l'application dans %APPDATA%. Pour un verrouillage total, demandez à votre administrateur l'**Accès attribué** de Windows (le PC n'ouvre qu'une seule application), ou utilisez **Veyon** (logiciel gratuit pour voir et verrouiller tous les écrans de la salle).
- Code oublié : supprimer le fichier `classe.json` dans `%APPDATA%\Labo Élève` (cela désactive le mode classe et efface le code).

### Si l'application bugue : la fermeture d'urgence (enseignant)

Sur le PC de l'élève, appuie sur **Ctrl+Alt+Maj+F**. Une petite fenêtre « Fermeture d'urgence » s'ouvre par-dessus le plein écran : entre ton **mot de passe enseignant** (celui de ton compte Labo Prof, ou celui d'un collègue) et clique sur **Fermer Labo Élève**.

- Ça ferme l'application **tout de suite**, même en mode focus, en mode examen ou en mode classe, et même si la page est figée. Le travail non enregistré est perdu.
- Le clavier redevient normal (le module de blocage s'arrête), et tu es prévenu dans le suivi : « fermé par un enseignant (fermeture d'urgence) ».
- Ça marche sans réseau (comme le bouton 🔒 Professeur). Après 5 mauvais mots de passe, il faut attendre une minute.
- Si l'élève relance Labo Élève pendant un examen, l'examen reprend normalement.
- Si même ce raccourci ne répond plus (application complètement bloquée) : **Ctrl+Alt+Suppr**, puis l'icône ⏻ en bas à droite, **Redémarrer**. En dernier recours, appui long sur le bouton d'alimentation.

## 10 bis. Sécurité

Ce qui protège l'application et les élèves :

- **Signature** : une clé privée, sur le seul PC du développeur (dossier `cles-signature/`, jamais inclus dans l'application), signe les outils et les mises à jour. Les applications ne contiennent que la clé publique. Un élève qui dépose un faux outil ou une fausse mise à jour dans le dossier partagé n'arrive à rien. **Garde ce dossier secret et sauvegarde-le** (clé USB) : sans lui, plus de mise à jour signée possible.
- **Contenus isolés** : les simulateurs, activités H5P, pages .zip et outils créés s'affichent dans une zone séparée, sans accès aux documents des élèves ni à Labo Élève. Pour un outil créé, l'application fabrique elle-même la page à partir de sa fiche : aucun code déposé dans le dossier n'est exécuté avec les droits de l'application.
- **Archives vérifiées** : un fichier .zip / .outil / .h5p dont les chemins sortiraient du dossier est refusé.
- **Autorisations** : caméra, micro, position et notifications sont refusés à toutes les pages. Les outils de développement sont désactivés dans la version installée.
- **Mots de passe enseignants** : jamais enregistrés en clair (empreinte scrypt). Depuis la version 1.1, au moins 8 caractères, avec un calcul d'empreinte plus coûteux (plus difficile à « deviner »). 5 essais ratés bloquent la saisie une minute. *Conseil : change ton mot de passe une fois (Labo Prof › Changer le mot de passe) pour profiter de la nouvelle empreinte.*
- **Composants à jour** : Electron 45, adm-zip 0.6.1 (failles des archives corrigées).

**À régler côté établissement (recommandé)** : dans le dossier partagé, les élèves ont besoin d'écrire dans `Classes` (inscriptions, copies, travaux), mais pas ailleurs. Si possible, demande à l'administrateur réseau de mettre **la racine du dossier partagé, `Labos` et `Mise à jour de l'application` en lecture seule pour les élèves**. Les signatures protègent déjà les outils et les mises à jour, mais un élève qui peut écrire partout pourrait encore modifier les fichiers des classes (contenus, réglages des labos).

## 11. Où sont stockés les outils ajoutés ?

Dans `%APPDATA%\Labo Élève\outils\` sur chaque ordinateur. Le bouton « Ouvrir le dossier des outils ajoutés » y mène directement.

## 12. Organisation du projet (pour aller plus loin)

```
main.js          Processus principal : fenêtre, installation et mise à jour des outils
preload.js       Pont sécurisé entre l'interface et le système
shell/           Interface d'accueil (cartes, recherche, favoris, thème)
commun/          Styles et aides partagés par tous les outils
outils/          Outils inclus dans l'application
mode-classe.js   Mode classe : verrouillage, détection des sorties, journal
espace-classes.js Classes, élèves et documents dans le dossier partagé
suivi.js         Suivi en direct : quel élève est connecté sur quel ordinateur
office.js        Sites intégrés : Office en ligne, MonBureauNumérique, Pronote
modele-outil/    Modèle à copier pour créer un outil
scripts/         Script de création des paquets .outil
```

Lancer l'application en développement :

```bash
npm start
```
