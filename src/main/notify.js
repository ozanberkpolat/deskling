// Windows notifications for when the widget can't be seen (full screen, "Hide for 1 hour"): a session
// waits for you or finished, or the quota crossed amber / red. Silent: the toast is the signal.
// Windows itself holds toasts back during presentations and games (Focus Assist).
import { Notification } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Toasts from an unpackaged-installer app need a Start-menu shortcut that carries the AppUserModelId.
export function ensureShortcut({ app, shell, log }) {
  if (!app.isPackaged || process.platform !== 'win32') return
  const lnk = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Deskling.lnk')
  if (existsSync(lnk)) return
  try {
    shell.writeShortcutLink(lnk, 'create', { target: process.execPath, appUserModelId: 'deskling', description: 'Deskling' })
    log(`created ${lnk} (Windows needs it for notifications)`)
  } catch (e) { log(`could not create the Start-menu shortcut: ${e.message}`) }
}

export function createNotifier({ onClick, log }) {
  let warned = false
  return function notify({ title, body, target }) {
    if (!Notification.isSupported()) { if (!warned) { log('notifications are not supported here'); warned = true } return }
    const n = new Notification({ title, body: body || '', silent: true })
    n.on('click', () => onClick(target))
    n.show()
  }
}
