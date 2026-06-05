const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shibaAPI', {
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getReminders: () => ipcRenderer.invoke('get-reminders'),
  startDrag: () => ipcRenderer.send('start-drag'),
  onReminderTrigger: (callback) => {
    ipcRenderer.on('reminder-trigger', (event, text) => callback(text));
  },
});
