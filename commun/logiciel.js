// Page commune des outils « logiciel » : indique si le logiciel est installé sur le PC,
// permet de le lancer, sinon propose des solutions de remplacement.
(async function () {
  const ALTERNATIVES = {
    word: { type: 'traitement de texte', libre: 'LibreOffice Writer' },
    excel: { type: 'tableur', libre: 'LibreOffice Calc' },
    // Redy n'a pas d'équivalent en ligne : il faut l'installer.
    redy: { installation: 'Redy est le logiciel gratuit de Jeulin pour les TP : acquisition des mesures avec les capteurs et les interfaces Jeulin, tableaux, graphiques et modélisation. Il doit d\'abord être installé sur cet ordinateur par ton professeur ou par l\'administrateur du lycée (téléchargement gratuit sur le site de Jeulin, avec un compte enseignant).' },
  };
  const api = window.parent && window.parent.labo && window.parent.labo.logiciel;
  const m = await (await fetch('manifest.json')).json();
  const alt = ALTERNATIVES[m.application] || { type: 'logiciel', libre: 'LibreOffice' };
  document.title = m.titre;
  document.documentElement.style.setProperty('--c', m.couleur || 'var(--accent)');

  const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function afficher() {
    const e = api ? await api.etat(m.application) : { installe: false };
    const nom = e.nom || m.titre;
    document.body.innerHTML = `
      <div class="page"><div class="carte">
        <div class="entete">
          <div class="tuile"><img src="${echapper(m.icone)}" alt=""></div>
          <div>
            <h1>${echapper(m.titre)}</h1>
            ${e.installe ? `<span class="etat oui">✓ ${echapper(nom)} est installé sur cet ordinateur</span>`
                         : `<span class="etat non">${echapper(m.titre)} n'est pas installé sur cet ordinateur</span>`}
          </div>
        </div>
        ${e.installe ? `
          <p class="texte">${echapper(nom)} s'ouvre dans sa propre fenêtre, à côté de Labo Élève. ${m.autoriseEnFocus ? 'Pour revenir ici, clique sur le bouton « ↩ Revenir à Labo Élève » en bas à droite de l\'écran ; pour retourner dans ' + echapper(nom) + ', clique de nouveau sur le bouton ci-dessous.' : 'Tu peux passer de l\'un à l\'autre avec la barre des tâches.'}</p>
          <button class="btn principal grand-btn" id="btn-ouvrir">Ouvrir ${echapper(nom)}</button>
        ` : alt.installation ? `
          <p class="texte">${echapper(alt.installation)}</p>
          <button class="btn" id="btn-verifier">Vérifier à nouveau</button>
        ` : `
          <p class="texte">Pas de souci, tu peux utiliser un autre ${alt.type} :</p>
          <ul class="options">
            <li><b>Office en ligne</b>
              <p>Gratuit dans le navigateur, avec le compte de ton établissement (ENT) ou un compte Microsoft.</p>
              <button class="btn" data-lien="https://www.office.com">Ouvrir Office en ligne</button></li>
            <li><b>${alt.libre}</b>
              <p>Logiciel gratuit qui ouvre aussi les fichiers Word et Excel. Demande à ton professeur avant de l'installer.</p>
              <button class="btn" data-lien="https://fr.libreoffice.org/download/telecharger-libreoffice/">Voir le site de LibreOffice</button></li>
          </ul>
          <button class="btn" id="btn-verifier">Vérifier à nouveau</button>
        `}
        <p class="mention">Labo Élève ne contient pas ce logiciel : il utilise seulement celui qui est déjà installé sur l'ordinateur.</p>
      </div></div>`;
    document.getElementById('btn-ouvrir')?.addEventListener('click', () => api.lancer(m.application));
    document.getElementById('btn-verifier')?.addEventListener('click', afficher);
    document.querySelectorAll('[data-lien]').forEach((b) => b.addEventListener('click', () => window.open(b.dataset.lien)));
  }
  await afficher();
})();
