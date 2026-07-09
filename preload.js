const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  spawn: (id, opts) => ipcRenderer.invoke('pty:spawn', { id, ...opts }),
  input: (id, data) => ipcRenderer.send('pty:input', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('pty:resize', { id, cols, rows }),
  kill: (id) => ipcRenderer.send('pty:kill', { id }),
  onData: (cb) => ipcRenderer.on('pty:data', (_event, payload) => cb(payload)),
  onExit: (cb) => ipcRenderer.on('pty:exit', (_event, payload) => cb(payload)),
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (config) => ipcRenderer.invoke('config:save', config),
  },
  project: {
    selectFolder: () => ipcRenderer.invoke('project:selectFolder'),
  },
  git: {
    status: (folder) => ipcRenderer.invoke('git:status', folder),
  },
  roblox: {
    playTest: (folder) => ipcRenderer.invoke('roblox:playTest', folder),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    onStatus: (cb) => {
      const listener = (_event, payload) => cb(payload);
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    },
  },
  logic: {
    generatePlan: (input) => require('./lib/plan-generator').generatePlan(input),
    matchError: (text) => require('./lib/debug-matcher').matchError(text),
  },
});
