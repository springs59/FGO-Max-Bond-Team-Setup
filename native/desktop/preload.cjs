const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('fgoDesktop', {
  command: value => ipcRenderer.send('native-command', value),
  auto: value => ipcRenderer.send('native-auto', Boolean(value)),
  report: value => ipcRenderer.send('native-report', value),
  onCommand: fn => ipcRenderer.on('native-host-command', (_event, value) => fn(value)),
  openTasks: () => ipcRenderer.send('native-open-tasks'),
  apply: () => ipcRenderer.send('native-apply'),
  softwareStatus: () => ipcRenderer.invoke('native-software-status'),
  softwareCommand: action => ipcRenderer.invoke('native-software-command',action),
  softwareAuto: value => ipcRenderer.invoke('native-software-auto',Boolean(value)),
  beginQueryExport: name => ipcRenderer.invoke('native-query-export-begin',name),
  appendQueryExport: bytes => ipcRenderer.invoke('native-query-export-append',bytes),
  finishQueryExport: cancel => ipcRenderer.invoke('native-query-export-finish',Boolean(cancel)),
  exportQueryFile: (name,bytes) => ipcRenderer.invoke('native-export-queries',name,bytes),
})
