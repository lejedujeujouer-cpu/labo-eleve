// Fenêtre « Fermeture d'urgence » : seulement deux actions, rien d'autre n'est exposé.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('urgence', {
  valider: (mdp) => ipcRenderer.invoke('urgence:valider', String(mdp)),
  annuler: () => ipcRenderer.send('urgence:annuler'),
});
