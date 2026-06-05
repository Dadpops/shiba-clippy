const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('shibaAPI', {
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getMode: () => ipcRenderer.invoke('get-mode'),
  startDrag: () => ipcRenderer.send('start-drag'),
  // Reminders
  getActiveReminders: () => ipcRenderer.invoke('get-active-reminders'),
  cancelReminder: (id) => ipcRenderer.invoke('cancel-reminder', id),
  onReminderTrigger: (cb) => ipcRenderer.on('reminder-trigger', (_, text) => cb(text)),
  onRemindersUpdated: (cb) => ipcRenderer.on('reminders-updated', (_, list) => cb(list)),
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
  // Assets
  assetsPath: path.join(__dirname, '..', 'assets').replace(/\\/g, '/'),
});
