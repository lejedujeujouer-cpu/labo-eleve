// Exemples à charger et exercices corrigés automatiquement (progression lycée professionnel).
// Exercice « sortie » : on exécute le programme avec des réponses aux input() et on cherche des textes dans l'affichage.
// Exercice « fonction » : on appelle la fonction de l'élève et on compare le résultat (repr Python).
(function () {
  const EXEMPLES = [
    { titre: 'Afficher et demander', code: `# print() affiche, input() pose une question (la réponse est du texte)
prenom = input("Quel est ton prénom ? ")
print("Bonjour", prenom, "!")
age = int(input("Quel âge as-tu ? "))   # int() transforme le texte en nombre entier
print("Dans 10 ans, tu auras", age + 10, "ans.")
` },
    { titre: 'Calculs et variables', code: `# Loi d'Ohm : U = R × I
R = 220      # résistance en ohms
I = 0.05     # intensité en ampères
U = R * I
print("Tension U =", U, "V")
print(f"Puissance P = {U * I:.2f} W")   # f-string : {valeur:.2f} = 2 chiffres après la virgule
` },
    { titre: 'Condition : si… sinon', code: `note = float(input("Ta note sur 20 : "))
if note >= 16:
    print("Très bien !")
elif note >= 10:
    print("Admis")
else:
    print("Refusé : il manque", 10 - note, "points")
` },
    { titre: 'Boucle for : table de multiplication', code: `n = 7
for i in range(1, 11):        # i prend les valeurs 1, 2, …, 10
    print(n, "x", i, "=", n * i)
` },
    { titre: 'Boucle while : placement bancaire', code: `# Au bout de combien d'années un capital placé à 4 % par an double-t-il ?
capital = 1000
annees = 0
while capital < 2000:
    capital = capital * 1.04
    annees = annees + 1
print("Il faut", annees, "ans. Capital :", round(capital, 2), "€")
` },
    { titre: 'Fonction', code: `def aire_rectangle(longueur, largeur):
    """Renvoie l'aire d'un rectangle."""
    return longueur * largeur

print(aire_rectangle(5, 3))
print(aire_rectangle(2.5, 4))
` },
    { titre: 'Listes : moyenne de notes', code: `notes = [12, 8.5, 15, 10, 17]
somme = 0
for note in notes:
    somme = somme + note
print("Nombre de notes :", len(notes))
print("Moyenne :", round(somme / len(notes), 2))
print("Meilleure note :", max(notes))
` },
    { titre: 'Hasard : simuler 1 000 lancers de dé', code: `import random

nb_six = 0
for i in range(1000):
    de = random.randint(1, 6)
    if de == 6:
        nb_six = nb_six + 1
print("Nombre de 6 :", nb_six)
print("Fréquence :", nb_six / 1000, "(probabilité : 1/6 ≈ 0,167)")
` },
    { titre: 'Suite et seuil (algorithme)', code: `# u(0) = 500 et u(n+1) = 0,9 × u(n) + 20 : à partir de quel rang u(n) < 250 ?
u = 500
n = 0
while u >= 250:
    u = 0.9 * u + 20
    n = n + 1
print("Rang :", n, " u =", round(u, 2))
` },
    { titre: 'Tortue : un carré', code: `import turtle

t = turtle.Turtle()
t.color("blue")
for i in range(4):
    t.forward(120)   # avance de 120 pas
    t.left(90)       # tourne de 90° à gauche
` },
    { titre: 'Tortue : polygones', code: `import turtle

t = turtle.Turtle()
t.speed(0)
couleurs = ["red", "orange", "green", "blue", "purple"]
for cotes in range(3, 8):
    t.color(couleurs[cotes - 3])
    for i in range(cotes):
        t.forward(70)
        t.left(360 / cotes)
` },
  ];

  const EXERCICES = [
    {
      id: 'bonjour', notion: 'Afficher', titre: 'Bonjour le monde',
      enonce: 'Écris un programme qui affiche exactement : <code>Bonjour le monde</code>',
      depart: '# Écris ton programme ici\n',
      indice: 'Utilise <code>print("…")</code> avec le texte entre guillemets.',
      type: 'sortie', cas: [{ entrees: [], contient: ['Bonjour le monde'] }],
    },
    {
      id: 'perimetre', notion: 'Variables', titre: 'Périmètre d\'un rectangle',
      enonce: 'Les variables <code>longueur = 7</code> et <code>largeur = 3</code> sont données. Calcule le périmètre dans une variable <code>perimetre</code> et affiche-le.',
      depart: 'longueur = 7\nlargeur = 3\n# calcule le périmètre puis affiche-le\n',
      indice: 'Périmètre = 2 × (longueur + largeur). En Python, la multiplication s\'écrit <code>*</code>.',
      type: 'sortie', cas: [{ entrees: [], contient: ['20'] }],
    },
    {
      id: 'saluer', notion: 'input()', titre: 'Saluer quelqu\'un',
      enonce: 'Demande le prénom de l\'utilisateur avec <code>input()</code>, puis affiche <code>Bonjour</code> suivi du prénom. Exemple : si on tape Léa, le programme affiche <code>Bonjour Léa</code>.',
      depart: '',
      indice: '<code>prenom = input("Prénom ? ")</code> puis <code>print("Bonjour", prenom)</code>.',
      type: 'sortie', cas: [{ entrees: ['Léa'], contient: ['Bonjour Léa'] }, { entrees: ['Yanis'], contient: ['Bonjour Yanis'] }],
    },
    {
      id: 'fahrenheit', notion: 'input() et nombres', titre: 'Degrés Celsius → Fahrenheit',
      enonce: 'Demande une température en degrés Celsius et affiche-la en degrés Fahrenheit : <code>F = C × 9 / 5 + 32</code>.',
      depart: '',
      indice: '<code>input()</code> renvoie du texte : transforme-le en nombre avec <code>float(input("…"))</code>.',
      type: 'sortie', cas: [{ entrees: ['100'], contient: ['212'] }, { entrees: ['0'], contient: ['32'] }, { entrees: ['-40'], contient: ['-40'] }],
    },
    {
      id: 'admis', notion: 'Condition if / else', titre: 'Admis ou refusé',
      enonce: 'Demande une note sur 20. Affiche <code>Admis</code> si la note est supérieure ou égale à 10, sinon <code>Refusé</code>.',
      depart: 'note = float(input("Note : "))\n',
      indice: '<code>if note >= 10:</code> puis, décalé de 4 espaces, le <code>print</code>. Ensuite <code>else:</code>. N\'oublie pas les deux-points <code>:</code>.',
      type: 'sortie', cas: [{ entrees: ['12'], contient: ['Admis'], absent: ['Refusé'] }, { entrees: ['8'], contient: ['Refusé'], absent: ['Admis'] }, { entrees: ['10'], contient: ['Admis'], absent: ['Refusé'] }],
    },
    {
      id: 'aire-disque', notion: 'Fonction', titre: 'Aire d\'un disque',
      enonce: 'Écris une fonction <code>aire_disque(r)</code> qui <b>renvoie</b> (avec <code>return</code>) l\'aire d\'un disque de rayon <code>r</code> : π × r².',
      depart: 'import math\n\ndef aire_disque(r):\n    # complète\n    \n',
      indice: '<code>math.pi</code> vaut π et <code>r ** 2</code> calcule r². La fonction doit se terminer par <code>return …</code>.',
      type: 'fonction', cas: [{ expr: 'aire_disque(1)', attendu: '3.141592653589793' }, { expr: 'aire_disque(2)', attendu: '12.566370614359172' }, { expr: 'aire_disque(0)', attendu: '0' }],
    },
    {
      id: 'ttc', notion: 'Fonction', titre: 'Prix TTC',
      enonce: 'Écris une fonction <code>prix_ttc(ht, taux)</code> qui renvoie le prix toutes taxes comprises. <code>taux</code> est en pourcentage : <code>prix_ttc(100, 20)</code> renvoie 120.',
      depart: 'def prix_ttc(ht, taux):\n    \n',
      indice: 'TTC = HT × (1 + taux / 100).',
      type: 'fonction', cas: [{ expr: 'prix_ttc(100, 20)', attendu: '120' }, { expr: 'prix_ttc(50, 5.5)', attendu: '52.75' }, { expr: 'prix_ttc(80, 0)', attendu: '80' }],
    },
    {
      id: 'maximum', notion: 'Fonction et condition', titre: 'Le plus grand de deux nombres',
      enonce: 'Écris une fonction <code>maximum(a, b)</code> qui renvoie le plus grand des deux nombres, <b>sans</b> utiliser <code>max</code>.',
      depart: 'def maximum(a, b):\n    \n',
      indice: 'Avec <code>if a > b:</code> on renvoie <code>a</code>, sinon <code>b</code>.',
      type: 'fonction', interdit: ['max('], cas: [{ expr: 'maximum(3, 8)', attendu: '8' }, { expr: 'maximum(10, -2)', attendu: '10' }, { expr: 'maximum(4, 4)', attendu: '4' }],
    },
    {
      id: 'somme', notion: 'Boucle for', titre: 'Somme des entiers',
      enonce: 'Écris une fonction <code>somme_jusqua(n)</code> qui renvoie 1 + 2 + … + n en utilisant une boucle <code>for</code>.',
      depart: 'def somme_jusqua(n):\n    total = 0\n    \n',
      indice: '<code>for i in range(1, n + 1):</code> fait prendre à i les valeurs 1, 2, …, n. Ajoute i à total, puis <code>return total</code> (en dehors de la boucle).',
      type: 'fonction', cas: [{ expr: 'somme_jusqua(10)', attendu: '55' }, { expr: 'somme_jusqua(100)', attendu: '5050' }, { expr: 'somme_jusqua(1)', attendu: '1' }],
    },
    {
      id: 'doubler', notion: 'Boucle while', titre: 'Doubler un capital',
      enonce: 'Écris une fonction <code>annees_pour_doubler(taux)</code> qui renvoie le nombre d\'années nécessaires pour qu\'un capital de 1000 € placé à <code>taux</code> % par an atteigne au moins 2000 €.',
      depart: 'def annees_pour_doubler(taux):\n    capital = 1000\n    annees = 0\n    \n',
      indice: '<code>while capital < 2000:</code> on multiplie le capital par <code>(1 + taux / 100)</code> et on ajoute 1 aux années.',
      type: 'fonction', cas: [{ expr: 'annees_pour_doubler(4)', attendu: '18' }, { expr: 'annees_pour_doubler(10)', attendu: '8' }, { expr: 'annees_pour_doubler(100)', attendu: '1' }],
    },
    {
      id: 'moyenne', notion: 'Listes', titre: 'Moyenne d\'une liste',
      enonce: 'Écris une fonction <code>moyenne(notes)</code> qui renvoie la moyenne des nombres de la liste <code>notes</code>.',
      depart: 'def moyenne(notes):\n    \n',
      indice: 'Parcours la liste avec <code>for note in notes:</code> pour faire la somme, puis divise par <code>len(notes)</code>.',
      type: 'fonction', cas: [{ expr: 'moyenne([12, 8, 16])', attendu: '12' }, { expr: 'moyenne([10])', attendu: '10' }, { expr: 'moyenne([5, 15, 9.5, 12.5])', attendu: '10.5' }],
    },
    {
      id: 'admis-liste', notion: 'Listes et condition', titre: 'Compter les admis',
      enonce: 'Écris une fonction <code>nombre_admis(notes)</code> qui renvoie combien de notes de la liste sont supérieures ou égales à 10.',
      depart: 'def nombre_admis(notes):\n    compteur = 0\n    \n',
      indice: 'Dans la boucle, <code>if note >= 10:</code> alors <code>compteur = compteur + 1</code>.',
      type: 'fonction', cas: [{ expr: 'nombre_admis([12, 8, 10, 15, 3])', attendu: '3' }, { expr: 'nombre_admis([])', attendu: '0' }, { expr: 'nombre_admis([9.5, 9.9])', attendu: '0' }],
    },
    {
      id: 'de', notion: 'Hasard', titre: 'Lancer un dé',
      enonce: 'Écris une fonction <code>lancer_de()</code> qui renvoie un nombre entier au hasard entre 1 et 6 (module <code>random</code>).',
      depart: 'import random\n\ndef lancer_de():\n    \n',
      indice: '<code>random.randint(1, 6)</code> renvoie un entier au hasard de 1 à 6 (inclus).',
      type: 'fonction', cas: [
        { expr: 'all(1 <= lancer_de() <= 6 for i in range(300))', attendu: 'True', message: 'Toujours entre 1 et 6' },
        { expr: 'len(set([lancer_de() for i in range(300)]))', attendu: '6', message: 'Les 6 faces sortent' },
        { expr: 'all(type(lancer_de()) == int for i in range(20))', attendu: 'True', message: 'Un nombre entier' },
      ],
    },
    {
      id: 'energie', notion: 'Physique', titre: 'Énergie cinétique',
      enonce: 'Écris une fonction <code>energie_cinetique(m, v)</code> qui renvoie l\'énergie cinétique (en J) d\'un objet de masse <code>m</code> (kg) et de vitesse <code>v</code> (m/s) : Ec = ½ × m × v².',
      depart: 'def energie_cinetique(m, v):\n    \n',
      indice: '½ s\'écrit <code>0.5</code> ou <code>1 / 2</code>, et v² s\'écrit <code>v ** 2</code>.',
      type: 'fonction', cas: [{ expr: 'energie_cinetique(2, 3)', attendu: '9' }, { expr: 'energie_cinetique(1000, 20)', attendu: '200000' }, { expr: 'energie_cinetique(0.5, 0)', attendu: '0' }],
    },
    {
      id: 'frequence', notion: 'Hasard et boucle', titre: 'Fréquence de Pile',
      enonce: 'Écris une fonction <code>frequence_pile(n)</code> qui simule <code>n</code> lancers d\'une pièce (Pile si <code>random.random() &lt; 0.5</code>) et renvoie la fréquence de Pile.',
      depart: 'import random\n\ndef frequence_pile(n):\n    \n',
      indice: 'Compte les Pile dans une boucle de n tours, puis renvoie <code>nb_pile / n</code>.',
      type: 'fonction', cas: [
        { expr: '0.45 < frequence_pile(4000) < 0.55', attendu: 'True', message: 'Proche de 0,5 sur 4 000 lancers' },
        { expr: '0 <= frequence_pile(10) <= 1', attendu: 'True', message: 'Entre 0 et 1' },
      ],
    },
  ];

  window.PythonDonnees = { EXEMPLES, EXERCICES };
})();
