// The renderer's whole surface: receive view/fx/config/hotkey, report list/hover/drag, ask for a link.
const { contextBridge, ipcRenderer } = require('electron')

const on = ch => cb => { ipcRenderer.on(ch, (_e, payload) => cb(payload)) }

contextBridge.exposeInMainWorld('deskling', {
  onView: on('view'),
  onFx: on('fx'),
  onConfig: on('config'),
  onToggleList: on('toggle-list'),
  onNotice: on('notice'),
  setListOpen: open => ipcRenderer.send('list', !!open),
  setInteractive: v => ipcRenderer.send('interactive', !!v),
  openUrl: url => ipcRenderer.send('open-url', String(url)),
  openSession: id => ipcRenderer.send('open-session', String(id)),
  answer: (holdId, session, allow) => ipcRenderer.send('answer', String(holdId), String(session), allow === true),
  showMenu: () => ipcRenderer.send('menu'),
  setupStatusline: () => ipcRenderer.send('setup-statusline'),
  // the settings window
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: patch => ipcRenderer.send('set-config', patch),
  onFullConfig: on('full-config'),
  copyDiagnostics: () => ipcRenderer.invoke('copy-diagnostics'),
  openConfig: () => ipcRenderer.send('open-config'),
  openLog: () => ipcRenderer.send('open-log'),
  ack: () => ipcRenderer.send('ack'),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.invoke('drag-end'),
})
