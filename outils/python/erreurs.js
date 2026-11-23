// Traduit les erreurs Python en français, avec un conseil adapté à un élève qui débute.
(function () {
  const BLOCS = /^\s*(if|elif|else|for|while|def|try|except|finally|with|class)\b/;

  // Ligne de code (1 = première ligne)
  const ligneDe = (code, n) => (code.split('\n')[n - 1] || '');

  function parentheses(texte) {
    let p = 0, c = 0, a = 0, dansTexte = null;
    for (const ch of texte) {
      if (dansTexte) { if (ch === dansTexte) dansTexte = null; continue; }
      if (ch === '"' || ch === "'") dansTexte = ch;
      else if (ch === '#') break;
      else if (ch === '(') p++; else if (ch === ')') p--;
      else if (ch === '[') c++; else if (ch === ']') c--;
      else if (ch === '{') a++; else if (ch === '}') a--;
    }
    return { p, c, a, texteOuvert: !!dansTexte };
  }

  // Erreur de syntaxe : on cherche la cause la plus probable sur la ligne (ou celle d'avant).
  function syntaxe(message, code, n) {
    const l = ligneDe(code, n), avant = ligneDe(code, n - 1);
    const t = l.trim();
    if (/EOF in multi-line/.test(message)) {
      return { texte: 'Une parenthèse, un crochet ou des guillemets ne sont pas fermés.', conseil: 'Vérifie chaque ( … ), [ … ] et " … " : il en manque un à la fin d\'une ligne au-dessus.' };
    }
    if (BLOCS.test(l) && !/:\s*(#.*)?$/.test(t)) {
      return { texte: `Il manque les deux-points « : » à la fin de la ligne ${n}.`, conseil: 'Les lignes qui commencent par if, elif, else, for, while ou def se terminent par « : ».' };
    }
    if (/^\s*(if|elif|while)\b[^=!<>]*[^=!<>]=[^=]/.test(l)) {
      return { texte: 'Dans une condition, pour comparer, il faut écrire « == » (deux signes égal).', conseil: '« = » sert à donner une valeur à une variable ; « == » teste l\'égalité.' };
    }
    if (/:\s*(#.*)?$/.test(avant.trim()) && BLOCS.test(avant) && !/^\s/.test(l) && t) {
      return { texte: `La ligne ${n} doit être décalée vers la droite (indentation).`, conseil: 'Après une ligne qui se termine par « : », les instructions du bloc sont décalées de 4 espaces (touche Tab).' };
    }
    const pa = parentheses(avant);
    if (pa.p > 0 || pa.c > 0) return { texte: `Une parenthèse ou un crochet n'est pas fermé à la ligne ${n - 1}.`, conseil: 'Compte les ( et les ) : il doit y en avoir autant.' };
    const pl = parentheses(l);
    if (pl.texteOuvert) return { texte: 'Des guillemets ne sont pas fermés.', conseil: 'Un texte commence et se termine par les mêmes guillemets : "comme ceci".' };
    if (pl.p !== 0 || pl.c !== 0) return { texte: 'Les parenthèses ou les crochets ne vont pas par deux sur cette ligne.', conseil: 'Compte les ( et les ) : il doit y en avoir autant.' };
    if (/^\s*print\s+["'\w]/.test(l)) return { texte: 'print s\'écrit avec des parenthèses.', conseil: 'Écris print("texte") et non print "texte".' };
    if (/unindent|indent/i.test(message) || /^\s+/.test(l) && !/:\s*(#.*)?$/.test(avant.trim()) && avant.trim() && (l.match(/^\s*/)[0].length > (avant.match(/^\s*/)[0].length))) {
      return { texte: `Le décalage (indentation) de la ligne ${n} n'est pas correct.`, conseil: 'Les lignes d\'un même bloc doivent commencer exactement au même niveau. N\'ajoute un décalage qu\'après une ligne terminée par « : ».' };
    }
    if (/\b(et|ou|si|sinon|pour|tant que)\b/.test(t)) return { texte: 'Python s\'écrit avec des mots anglais.', conseil: 'si → if, sinon → else, pour → for, tant que → while, et → and, ou → or.' };
    return { texte: `Python ne comprend pas la ligne ${n}.`, conseil: 'Vérifie les deux-points « : », les parenthèses, les guillemets et l\'orthographe des mots-clés.' };
  }

  /**
   * erreur : exception Skulpt ; code : programme de l'élève.
   * Renvoie { ligne, titre, texte, conseil, original }.
   */
  function traduire(erreur, code) {
    const type = erreur && erreur.tp$name ? erreur.tp$name : 'Erreur';
    const original = String(erreur && erreur.toString ? erreur.toString() : erreur).replace(/ on line \d+$/, '');
    const message = original.replace(/^\w+: /, '');
    const tb = erreur && erreur.traceback && erreur.traceback[0];
    const ligne = tb && tb.lineno ? tb.lineno : null;
    const r = (titre, texte, conseil = '') => ({ ligne, titre, texte, conseil, original });
    let m;
    switch (type) {
      case 'SyntaxError': case 'IndentationError': case 'TabError': {
        const s = syntaxe(message, code, ligne || 1);
        return r('Erreur d\'écriture', s.texte, s.conseil);
      }
      case 'NameError': {
        const nom = (m = /name '([^']+)'/.exec(message)) ? m[1] : '?';
        const mots = { Print: 'print', Input: 'input', Range: 'range', Int: 'int', True_: 'True', true: 'True', false: 'False', vrai: 'True', faux: 'False', afficher: 'print' };
        if (mots[nom]) return r('Nom inconnu', `« ${nom} » n'existe pas en Python.`, `Tu voulais sans doute écrire « ${mots[nom]} » (attention aux majuscules).`);
        return r('Nom inconnu', `La variable ou la fonction « ${nom} » n'est pas définie.`, 'Vérifie l\'orthographe (majuscules comprises), qu\'elle a reçu une valeur avant cette ligne, et que le texte est bien entre guillemets.');
      }
      case 'TypeError':
        if (/concatenate|can only concatenate|must be str/.test(message)) return r('Texte et nombre mélangés', 'On ne peut pas coller un texte et un nombre avec « + ».', 'Dans print, sépare-les par une virgule : print("Total :", total). Pour faire un calcul, transforme le texte en nombre : int(…) ou float(…). Rappel : input() renvoie toujours du texte.');
        if (/unsupported operand/.test(message)) return r('Calcul impossible', 'Ce calcul mélange des valeurs qui ne vont pas ensemble (souvent du texte et un nombre).', 'Si la valeur vient de input(), transforme-la en nombre : float(input("…")).');
        if (/not callable/.test(message)) return r('Appel impossible', 'Tu utilises des parenthèses après quelque chose qui n\'est pas une fonction.', 'Une variable porte peut-être le même nom qu\'une fonction, ou il manque un signe « * » : 2(x+1) s\'écrit 2*(x+1).');
        if (/takes|positional argument|arguments/.test(message)) return r('Mauvais nombre de valeurs', 'La fonction n\'est pas appelée avec le bon nombre de valeurs entre parenthèses.', 'Compare l\'appel avec la ligne « def » : il faut autant de valeurs que de paramètres.');
        if (/not iterable/.test(message)) return r('Boucle impossible', 'On ne peut pas parcourir cette valeur avec « for ».', 'Pour répéter n fois, écris : for i in range(n):');
        if (/indices must be integers|list indices/.test(message)) return r('Indice incorrect', 'L\'indice d\'une liste doit être un nombre entier.', 'Utilise int(…) ou // (division entière) pour obtenir un entier.');
        return r('Type incorrect', 'Cette opération ne fonctionne pas avec ce type de valeur.', 'Vérifie si tes variables contiennent du texte ou des nombres.');
      case 'ZeroDivisionError':
        return r('Division par zéro', 'Le programme a essayé de diviser par 0.', 'Vérifie la valeur du diviseur avant la division (par exemple avec un if).');
      case 'IndexError':
        return r('Indice trop grand', 'Tu demandes un élément qui n\'existe pas dans la liste.', 'Une liste de n éléments est numérotée de 0 à n − 1. La longueur s\'obtient avec len(liste).');
      case 'KeyError':
        return r('Clé inconnue', `La clé ${message} n'existe pas dans le dictionnaire.`, 'Vérifie l\'orthographe de la clé.');
      case 'ValueError':
        if ((m = /invalid literal for (int|float)\(\)[^:]*: (.*)$/.exec(message))) return r('Conversion impossible', `${m[1]}() ne peut pas transformer ${m[2]} en nombre.`, m[1] === 'int' ? 'Pour un nombre à virgule, utilise float(…), avec un point : 2.5 et non 2,5.' : 'Un nombre à virgule s\'écrit avec un point en Python : 2.5 et non 2,5.');
        if (/math domain/.test(message)) return r('Calcul impossible', 'Ce calcul mathématique n\'est pas défini (par exemple la racine d\'un nombre négatif).', '');
        return r('Valeur incorrecte', message, '');
      case 'AttributeError': {
        const nom = (m = /attribute '([^']+)'/.exec(message)) ? m[1] : '?';
        return r('Fonction inconnue', `« .${nom} » n'existe pas pour cette valeur.`, 'Vérifie l\'orthographe et le module importé (par exemple math.sqrt, random.randint).');
      }
      case 'ImportError': case 'ModuleNotFoundError':
        return r('Module introuvable', 'Ce module n\'est pas disponible ici.', 'Modules disponibles : math, random, turtle, time…');
      case 'AssertionError':
        return r('Vérification non réussie', message || 'Une vérification (assert) est fausse.', '');
      case 'RecursionError':
        return r('Trop d\'appels', 'La fonction s\'appelle elle-même sans fin.', 'Il manque une condition d\'arrêt.');
      case 'TimeLimitError':
        return r('Programme trop long', 'Le programme ne s\'arrête pas (boucle infinie ?).', 'Dans une boucle while, vérifie que la condition finit par devenir fausse.');
      default:
        return r(type, message, '');
    }
  }

  window.ErreursPython = { traduire };
})();
