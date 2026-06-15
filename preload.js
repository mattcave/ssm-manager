                                                                                                                                                                                                                                                                                                                                          const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Dependencies
  checkDeps: () => ipcRenderer.invoke('deps:check'),

  // Config
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  openConfigFile: () => ipcRenderer.invoke('config:open-file'),

  // Tunnels
  connect: (envName, tunnelId) => ipcRenderer.invoke('tunnel:connect', envName, tunnelId),
  disconnect: (tunnelId) => ipcRenderer.invoke('tunnel:disconnect', tunnelId),
  getActiveTunnels: () => ipcRenderer.invoke('tunnel:active'),
  getLogHistory: (tunnelId) => ipcRenderer.invoke('tunnel:log-history', tunnelId),

  // SSO
  ssoLogin: (profile, tunnelId) => ipcRenderer.invoke('sso:login', profile, tunnelId),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_e, data) => cb(data)),

  // Events pushed from main process
  onLog: (callback) => ipcRenderer.on('tunnel:log', (_e, data) => callback(data)),
  onTunnelExited: (callback) => ipcRenderer.on('tunnel:exited', (_e, data) => callback(data)),
  onConfigChanged: (callback) => ipcRenderer.on('config:changed', (_e, data) => callback(data)),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('tunnel:log')
    ipcRenderer.removeAllListeners('tunnel:exited')
    ipcRenderer.removeAllListeners('update:available')
    ipcRenderer.removeAllListeners('config:changed')
  }
})
