// The renderer gets no network and no navigation: pages come from app://deskling only.
import { app } from 'electron'

export function harden(ses) {
  ses.webRequest.onBeforeRequest((d, cb) => cb({ cancel: /^(https?|wss?|ftp):/i.test(d.url) }))
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  ses.setPermissionCheckHandler(() => false)
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', e => e.preventDefault())
    wc.on('will-attach-webview', e => e.preventDefault())
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  })
}

// IPC must come from our own page.
export const fromApp = e => (e.senderFrame?.url || '').startsWith('app://deskling/')
