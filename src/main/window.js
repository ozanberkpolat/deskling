// The widget window: frameless, transparent, always on top, click-through except over the box and
// the open list. It hugs one corner of the screen's work area; only its size changes (closed / list
// open), never animated. Drag the box anywhere: on release it jumps to the nearest corner.
import { BrowserWindow, screen } from 'electron'
import { nearestCorner, pickDisplay, windowRect } from './displays.js'

export const CLOSED = [360, 200], OPEN = [380, 560]       // box + radar room + peek / + list

export function createWidget({ config, log, preload, url, onLoad }) {
  const win = new BrowserWindow({
    width: CLOSED[0], height: CLOSED[1], show: false,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, thickFrame: false,
    resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, type: 'toolbar', focusable: false, alwaysOnTop: true, title: 'Deskling',
    webPreferences: {
      preload, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })
  win.setContentProtection(config.get().hideFromCapture)

  let open = false, interactive = false, drag = null, display = null
  let userHidden = 0, unhide = null, fsHidden = false

  function reposition() {
    if (drag) return
    display = pickDisplay(screen.getAllDisplays(), config.get().display, screen.getPrimaryDisplay().id)
    const [w, h] = open ? OPEN : CLOSED
    win.setBounds(windowRect(display, config.get().corner, w, h))
  }

  // Shown unless the user hid it for an hour or a full-screen app is in front.
  function applyVisible() {
    const hide = userHidden > Date.now() || fsHidden
    if (hide && win.isVisible()) win.hide()
    if (!hide && !win.isVisible()) win.showInactive()
  }

  function setInteractive(v) {
    if (v === interactive) return
    interactive = v
    win.setIgnoreMouseEvents(!v, { forward: true })
  }

  function setListOpen(v) {
    if (v === open) return
    open = v
    reposition()
    if (v) { win.setFocusable(true); win.focus() } else { win.setFocusable(false); setInteractive(false) }
  }

  // Never stuck catching clicks: once the cursor leaves the window, go back to click-through.
  const watchdog = setInterval(() => {
    if (!interactive || drag) return
    const c = screen.getCursorScreenPoint(), b = win.getBounds()
    if (c.x < b.x || c.y < b.y || c.x >= b.x + b.width || c.y >= b.y + b.height) setInteractive(false)
  }, 250)

  // Manual drag (no -webkit-app-region: that would eat the click). The window follows the cursor,
  // keeping where it was grabbed; the drop picks the screen under the cursor and its nearest corner.
  function dragStart() {
    if (drag) return
    const start = screen.getCursorScreenPoint(), b0 = win.getBounds()
    drag = { moved: false, stop: setTimeout(() => dragEnd(), 30_000) }
    drag.timer = setInterval(() => {
      const c = screen.getCursorScreenPoint()
      if (Math.abs(c.x - start.x) + Math.abs(c.y - start.y) > 4) drag.moved = true
      if (drag.moved) win.setPosition(b0.x + c.x - start.x, b0.y + c.y - start.y)
    }, 16)
  }

  function dragEnd() {
    if (!drag) return false
    clearInterval(drag.timer); clearTimeout(drag.stop)
    const { moved } = drag
    drag = null
    try {
      if (moved) {
        const c = screen.getCursorScreenPoint()
        const d = screen.getDisplayNearestPoint(c), corner = nearestCorner(d, c), b = d.bounds
        // dropped at (or past) the side edge of its corner: tuck in; dropped anywhere else: out
        const tucked = corner.endsWith('r') ? c.x >= b.x + b.width - 6 : c.x <= b.x + 5
        config.set({ display: { id: d.id, label: d.label, size: d.size }, corner, tucked })
        log(`moved to ${d.label || d.id} ${config.get().corner}`)
      }
    } catch (e) {
      log(`drag: could not save the new corner (${e.message})`)       // e.g. an unwritable %APPDATA%
    } finally {
      reposition()                                                   // never leave it where the cursor dropped it
    }
    return moved
  }

  function hideFor(ms) {
    clearTimeout(unhide)
    userHidden = Date.now() + ms
    applyVisible()
    unhide = setTimeout(() => { userHidden = 0; applyVisible() }, ms)
  }

  let debounce = null
  const onDisplays = () => { clearTimeout(debounce); debounce = setTimeout(reposition, 300) }
  for (const ev of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(ev, onDisplays)

  // Other topmost windows (Teams, full-screen video) can push us down; take the spot back.
  const topmost = setInterval(() => { if (win.isVisible()) { win.setAlwaysOnTop(true, 'screen-saver'); win.moveTop() } }, 60_000)

  win.webContents.on('did-finish-load', () => onLoad?.())
  win.webContents.on('console-message', e => {
    if (e.level === 'error' || e.level === 'warning') log(`renderer ${e.level}: ${e.message} (${e.sourceId}:${e.lineNumber})`)
  })
  win.webContents.on('render-process-gone', (_e, d) => { log(`renderer gone: ${d.reason}; reloading`); win.reload() })
  win.once('ready-to-show', () => { reposition(); applyVisible() })
  win.on('closed', () => { clearInterval(watchdog); clearInterval(topmost); clearTimeout(unhide) })
  win.loadURL(url)
  log(`window: loading ${url}`)

  return {
    win,
    send: (ch, payload) => { if (!win.isDestroyed()) win.webContents.send(ch, payload) },
    reposition, setInteractive, setListOpen, dragStart, dragEnd, hideFor,
    setFullscreen(v) { fsHidden = v; applyVisible() },
    show: () => { clearTimeout(unhide); userHidden = 0; applyVisible() },
    get hidden() { return userHidden > Date.now() },
    get visible() { return !win.isDestroyed() && win.isVisible() },
    applyConfig: c => { win.setContentProtection(c.hideFromCapture); reposition() },
  }
}
