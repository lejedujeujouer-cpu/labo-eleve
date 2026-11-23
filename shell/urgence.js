// Fenêtre « Fermeture d'urgence » : le mot de passe est vérifié par le processus principal.
const mdp = document.getElementById('mdp');
const message = document.getElementById('message');
const valider = document.getElementById('valider');

document.getElementById('formulaire').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!mdp.value) { message.textContent = 'Entre ton mot de passe.'; return; }
  valider.disabled = true;
  message.textContent = '';
  const r = await window.urgence.valider(mdp.value);
  if (r && r.ok) { message.textContent = 'Fermeture…'; return; }
  valider.disabled = false;
  message.textContent = (r && r.message) || 'Mot de passe incorrect.';
  mdp.select();
});
document.getElementById('annuler').addEventListener('click', () => window.urgence.annuler());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.urgence.annuler(); });
mdp.focus();
