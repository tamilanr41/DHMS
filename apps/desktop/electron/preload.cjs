const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zhanx', {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.sendSync('zhanx:get-server-url-sync'),
  setServerUrl: (url) => ipcRenderer.invoke('zhanx:set-server-url', url),
  testConnection: (url) => ipcRenderer.invoke('zhanx:test-connection', url),
  getRefreshToken: () => ipcRenderer.invoke('zhanx:get-refresh-token'),
  saveRefreshToken: (token) => ipcRenderer.invoke('zhanx:save-refresh-token', token),
  clearRefreshToken: () => ipcRenderer.invoke('zhanx:clear-refresh-token'),
  openPdf: (bytes, fileName) => ipcRenderer.invoke('zhanx:open-pdf', bytes, fileName)
});
