// Aide commune au traitement de texte et au tableur : ouvrir et enregistrer
// un document de « Mes documents » (dossier Documents\Labo Élève).
(function () {
  const api = () => window.parent && window.parent.labo && window.parent.labo.documents;
  const extension = (nom) => (nom.match(/\.[^.]+$/) || [''])[0];
  const sansExtension = (nom) => nom.replace(/\.[^.]+$/, '');

  const Doc = {
    disponible: () => !!api(),

    /** Lit un document de Mes documents et renvoie un ArrayBuffer. */
    async lire(nom) {
      const r = await fetch('/documents/' + encodeURIComponent(nom));
      if (!r.ok) throw new Error(`Impossible d'ouvrir « ${nom} »`);
      return r.arrayBuffer();
    },

    /**
     * Choisit le nom d'enregistrement :
     * - document créé dans Labo Élève ou déjà « complété » : on enregistre par-dessus ;
     * - document reçu (du pad…) : on crée « nom - complété.ext » et l'original reste intact.
     */
    cible(nomOuvert, extVoulue, estNouveau) {
      const base = sansExtension(nomOuvert);
      const ext = extVoulue || extension(nomOuvert);
      if (estNouveau || / - complété$/.test(base)) return base + ext;
      return `${base} - complété${ext}`;
    },

    /** Enregistre des octets dans Mes documents. Renvoie le nom réellement utilisé. */
    async enregistrer(nom, octets, remplacer = true) {
      if (!api()) throw new Error('Ouvre cet outil depuis Labo Élève pour enregistrer.');
      const donnees = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
      const r = await api().enregistrer(nom, donnees, remplacer);
      if (!r.ok) throw new Error(r.message || 'Enregistrement impossible.');
      await Doc.proposerEnvoiProf(r.nom);
      return r.nom;
    },

    // ---------- Copie chez l'enseignant (option de l'élève, retenue pour chaque document) ----------
    async infoProf() {
      if (!api() || !api().prof) return { disponible: false };
      try { return await api().prof(); } catch { return { disponible: false }; }
    },
    choixEnvoi(nom) { try { return (JSON.parse(localStorage.getItem('labo:envoi-prof') || '{}'))[nom]; } catch { return undefined; } },
    retenirEnvoi(nom, oui) { try { const m = JSON.parse(localStorage.getItem('labo:envoi-prof') || '{}'); m[nom] = !!oui; localStorage.setItem('labo:envoi-prof', JSON.stringify(m)); } catch { /* stockage indisponible */ } },
    /** Envoie le document à l'enseignant (copie dans son dossier « Copies des élèves/<nom> »). */
    async envoyerProf(nom, discret = false) {
      const r = await api().envoyerProf(nom);
      const message = !r.ok ? r.message : r.envoye ? `📤 Copie envoyée à ${r.prof || 'ton professeur'}` : '📤 Copie gardée sur ce PC : elle partira chez ton professeur dès le retour du réseau';
      // après le message de l'outil (« Enregistré… »)
      setTimeout(() => Doc.message(message, r.ok ? '' : 'erreur'), discret ? 1400 : 0);
      return r;
    },
    /** Après un enregistrement : selon le choix de l'élève pour ce document (demandé la 1re fois), envoie une copie. */
    async proposerEnvoiProf(nom) {
      const info = await Doc.infoProf();
      if (!info.disponible) return;
      let choix = Doc._envoiProchain !== undefined ? Doc._envoiProchain : Doc.choixEnvoi(nom);
      delete Doc._envoiProchain;
      if (choix === undefined) choix = await Doc.question(`Envoyer aussi une copie de « ${nom} » à ${info.prof} ?`, 'Elle sera rangée dans le dossier à ton nom chez ton professeur, et mise à jour à chaque enregistrement de ce document.', ['📤 Oui, envoyer', 'Non, garder pour moi']);
      if (choix === null) return;
      Doc.retenirEnvoi(nom, choix);
      if (choix) await Doc.envoyerProf(nom, true);
    },
    /** Petite fenêtre avec deux boutons : renvoie true (1er bouton), false (2e) ou null (Échap). */
    question(titre, texte, [oui, non]) {
      return new Promise((resoudre) => {
        const fond = document.createElement('div');
        fond.className = 'doc-fenetre-fond';
        fond.innerHTML = `<div class="doc-fenetre" role="dialog"><label>${titre.replace(/[<>&]/g, '')}</label><p class="doc-fenetre-texte">${texte}</p>
          <div class="doc-fenetre-boutons"><button type="button" class="btn" data-non>${non}</button><button type="button" class="btn principal" data-oui>${oui}</button></div></div>`;
        const fermer = (v) => { fond.remove(); resoudre(v); };
        fond.querySelector('[data-oui]').addEventListener('click', () => fermer(true));
        fond.querySelector('[data-non]').addEventListener('click', () => fermer(false));
        fond.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(null); });
        document.body.append(fond);
        fond.querySelector('[data-oui]').focus();
      });
    },

    /** Demande un nom dans une petite fenêtre (window.prompt n'existe pas dans l'application). */
    demanderNom(titre, valeurParDefaut) {
      return new Promise(async (resoudre) => {
        const info = await Doc.infoProf();
        const fond = document.createElement('div');
        fond.className = 'doc-fenetre-fond';
        fond.innerHTML = `<form class="doc-fenetre">
          <label>${titre}</label>
          <input type="text" required maxlength="120">
          ${info.disponible ? `<label class="doc-fenetre-case"><input type="checkbox" data-envoi> 📤 Envoyer aussi une copie à ${String(info.prof).replace(/[<>&"]/g, '')}</label>` : ''}
          <div class="doc-fenetre-boutons">
            <button type="button" class="btn" data-annuler>Annuler</button>
            <button type="submit" class="btn principal">Valider</button>
          </div></form>`;
        const champ = fond.querySelector('input');
        champ.value = valeurParDefaut || '';
        const fermer = (v) => { fond.remove(); resoudre(v); };
        fond.querySelector('form').addEventListener('submit', (e) => {
          e.preventDefault();
          const caseEnvoi = fond.querySelector('[data-envoi]');
          if (caseEnvoi && champ.value.trim()) Doc._envoiProchain = caseEnvoi.checked; // appliqué au prochain enregistrement
          fermer(champ.value.trim() || null);
        });
        fond.querySelector('[data-annuler]').addEventListener('click', () => fermer(null));
        fond.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(null); });
        document.body.append(fond);
        champ.focus();
        champ.select();
      });
    },

    /** Petit message temporaire en bas de l'écran. */
    message(texte, type = '') {
      document.querySelectorAll('.doc-message').forEach((m) => m.remove()); // un seul message à la fois
      const el = document.createElement('div');
      el.className = 'doc-message ' + type;
      el.textContent = texte;
      document.body.append(el);
      setTimeout(() => el.classList.add('sortie'), 2600);
      setTimeout(() => el.remove(), 3000);
    },
  };

  // Styles des petites fenêtres et messages
  const style = document.createElement('style');
  style.textContent = `
    .doc-fenetre-fond { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: rgba(10,14,28,.4); }
    .doc-fenetre { background: var(--surface); border: 1px solid var(--bord); border-radius: 16px; padding: 20px; width: min(420px, 90vw); display: flex; flex-direction: column; gap: 12px; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
    .doc-fenetre label { font-weight: 650; }
    .doc-fenetre input { padding: 9px 12px; border-radius: 10px; border: 1px solid var(--bord); background: var(--surface-2); color: var(--texte); font: inherit; }
    .doc-fenetre-boutons { display: flex; justify-content: flex-end; gap: 8px; }
    .doc-fenetre-texte { margin: 0; color: var(--texte-doux); font-size: 14px; line-height: 1.4; }
    .doc-fenetre label.doc-fenetre-case { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 14px; cursor: pointer; }
    .doc-fenetre-case input { width: 18px; height: 18px; padding: 0; }
    .doc-message { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 1000; background: var(--texte); color: var(--fond); padding: 10px 18px; border-radius: 12px; font-weight: 600; font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.25); transition: opacity .3s; }
    .doc-message.erreur { background: #e5484d; color: #fff; }
    .doc-message.sortie { opacity: 0; }`;
  document.head.append(style);

  window.Doc = Doc;
})();
