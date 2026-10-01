// The renderer's whole surface: receive view/fx/config/hotkey, report list/hover/drag, ask for a link.
const { contextBridge, ipcRenderer } = require('electron')

const on = ch => cb => { ipcRenderer.on(ch, (_e, payload) => cb(payload)) }

contextBridge.exposeInMainWorld('deskling', {
  onView: on('view'),
  onFx: on('fx'),
  onConfig: on('config'),
  onToggleList: on('toggle-list'),
  setListOpen: open => ipcRenderer.send('list', !!open),
  setInteractive: v => ipcRenderer.send('interactive', !!v),
  openUrl: url => ipcRenderer.send('open-url', String(url)),
  openSession: id => ipcRenderer.send('open-session', String(id)),
  showMenu: () => ipcRenderer.send('menu'),
  ack: () => ipcRenderer.send('ack'),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.invoke('drag-end'),
})
