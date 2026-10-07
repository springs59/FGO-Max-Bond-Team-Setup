const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('fgoDesktop', {
  command: value => ipcRenderer.send('native-command', value),
  auto: value => ipcRenderer.send('native-auto', Boolean(value)),
  report: value => ipcRenderer.send('native-report', value),
  onCommand: fn => ipcRenderer.on('native-host-command', (_event, value) => fn(value)),
  openTasks: () => ipcRenderer.send('native-open-tasks'),
  apply: () => ipcRenderer.send('native-apply'),
})
