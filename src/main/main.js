// Deskling main process. Flags: --gallery (every clip, for sprite work), --replay=<file.jsonl>[,speed],
// --remove-hooks (take our hooks out of ~/.claude/settings.json and exit; the uninstaller runs it).
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, powerMonitor, protocol, session, shell } from 'electron'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, join, normalize, sep } from 'node:path'
import { Config, migrateFrom } from './config.js'
import { createLog } from './log.js'
import { startReplay } from './replay.js'
import { EVENTS, hooksInstalled, installHooks, removeHooks } from './claude-hooks.js'
import { watchFullscreen } from './fullscreen.js'
import { createNotifier, ensureShortcut } from './notify.js'
import { describe } from './notify-text.js'
import { isQuiet } from './quiet.js'
import { startHookServer } from './hookserver.js'
import { createLocal } from './local.js'
import { watchLimits } from './quota.js'
import { allowedLinks, safeExternal, sessionUrl } from './links.js'
import { fromApp, harden } from './security.js'
import { Store } from './store.js'
import { RelayStream } from './stream.js'
import { createTray, icon } from './tray.js'
import { createWidget } from './window.js'

const ROOT = join(import.meta.dirname, '..', '..')
const SRC = join(ROOT, 'src') + sep
const arg = name => process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`))
const GALLERY = !!arg('gallery')
const REPLAY = arg('replay')?.split('=')[1]
const CLAUDE_SETTINGS = join(homedir(), '.claude', 'settings.json')

if (arg('remove-hooks')) {
  try { removeHooks(CLAUDE_SETTINGS) } catch {}          // a broken settings.json is left untouched
  process.exit(0)                                         // now: nothing below may run (no migration, no config)
} else if (!app.requestSingleInstanceLock()) app.exit(0)
// The Microsoft Store build (MSIX) has a package identity: Windows gives it the AppUserModelId,
// the toast registration and the start-at-login task (manifest). Only the installer build sets them up itself.
const STORE = process.windowsStore === true
if (!STORE) app.setAppUserModelId('deskling')
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true } }])

const dir = app.getPath('userData')                    // %APPDATA%\deskling
const migrated = migrateFrom(join(app.getPath('appData'), 'cc-dog'), dir)
const log = createLog(dir)
const config = new Config(dir, log).watch()
if (config.get().disableGpu) app.disableHardwareAcceleration()
log(`start ${app.getVersion()} electron ${process.versions.electron} packaged=${app.isPackaged}`)
if (migrated) log('copied settings from %APPDATA%\\cc-dog (this app\'s earlier name)')

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }

// app://deskling/<path under src/> → the file, nothing else.
function serveApp() {
  protocol.handle('app', async req => {
    const u = new URL(req.url)
    const file = normalize(join(ROOT, decodeURIComponent(u.pathname)))
    if (u.host !== 'deskling' || !file.startsWith(SRC)) return new Response('not found', { status: 404 })
    try {
      return new Response(await readFile(file), { headers: { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' } })
    } catch { return new Response('not found', { status: 404 }) }
  })
}

let widget, store, tray, source, fullscreen
let fsMuted = false, locked = false, hotkeyError = '', local = null
// No sound while a full-screen app is in front, during quiet hours, or while the screen is locked.
const quiet = () => isQuiet(new Date(), config.get().quietHours)
const muted = () => fsMuted || locked || quiet()

// This machine's Claude Code: its hooks call our loopback receiver with a token kept beside config.
const hookUrl = c => `http://127.0.0.1:${c.hookPort}/hook`
function hookToken() {
  const f = join(dir, 'hook-token')
  if (!existsSync(f)) writeFileSync(f, randomBytes(24).toString('hex'), { mode: 0o600 })
  return readFileSync(f, 'utf8').trim()
}

// Keep ~/.claude/settings.json in line with config.localHooks (adds or removes only our hooks).
// null = not asked yet: leave the file alone.
function applyLocalHooks(c) {
  if (c.localHooks === null) return
  try {
    const on = hooksInstalled(CLAUDE_SETTINGS, hookUrl(c))
    if (c.localHooks && !on) { installHooks(CLAUDE_SETTINGS, { url: hookUrl(c), token: hookToken() }); log(`added Deskling hooks to ${CLAUDE_SETTINGS}; Claude sessions started from now on show up`) }
    if (!c.localHooks && on) { removeHooks(CLAUDE_SETTINGS); log(`removed Deskling hooks from ${CLAUDE_SETTINGS}`) }
  } catch (e) {
    log(`could not update ${CLAUDE_SETTINGS}: ${e.message} (left untouched)`)
  }
}

function statusText() {
  const v = store?.view, c = config.get()
  if (hotkeyError) return hotkeyError
  if (c.localHooks === false && !c.relayUrl) return 'Not watching: turn on "Watch Claude Code on this PC"'
  if (!c.relayUrl && v) return `Watching this PC · ${v.badges.waiting} waiting · ${v.badges.working} working${quotaText(v.quota)}`
  if (!config.token()) return 'No token: put it in %APPDATA%\\deskling\\token'
  if (!v?.connected) return 'Relay unreachable, retrying'
  if (v.status.cc !== 'ok') return `cc-backend: ${v.status.cc}`
  const b = v.badges
  return `Connected · ${b.waiting} waiting · ${b.working} working · ${b.paperclip} Paperclip${quotaText(v.quota)}`
}
const quotaText = q => q ? ` · 5h ${q.five ? q.five.pct + '%' : '–'} · week ${q.week ? q.week.pct + '%' : '–'}` : ''

function connect() {
  source?.stop()
  const c = config.get()
  if (REPLAY) source = startReplay(REPLAY, a => store.dispatch(a), log)
  else if (!c.relayUrl) { source = null; store.dispatch({ type: 'local' }) }
  else if (!config.token()) { log('no token (config.json "token" or the token file); not connecting'); source = null }
  else source = new RelayStream({ url: c.relayUrl, token: config.token(), dispatch: a => store.dispatch(a), log }).start()
}

// What the renderer needs from config, plus the full-screen mute.
const rendererConfig = c => ({ sound: c.sound, shape: c.shape, corner: c.corner, mascot: c.mascot, idleOpacity: c.idleOpacity, tucked: c.tucked, muted: muted() })

function applyHotkey(c) {
  globalShortcut.unregisterAll()
  hotkeyError = ''
  if (!c.hotkey) return
  let ok = false
  try { ok = globalShortcut.register(c.hotkey, () => widget.send('toggle-list')) } catch (e) { log(`hotkey ${c.hotkey}: ${e.message}`) }
  if (!ok) { hotkeyError = `Hotkey ${c.hotkey} is taken or invalid`; log(hotkeyError) }
}

function applyFullscreen(c) {
  fullscreen?.stop()
  fullscreen = null
  fsMuted = false
  widget.setFullscreen(false)
  if (!c.hideInFullscreen) return
  fullscreen = watchFullscreen({
    log,
    onChange: v => {
      fsMuted = v
      widget.setFullscreen(v)
      widget.send('config', rendererConfig(config.get()))
      log(v ? 'full screen in front: hidden, muted' : 'full screen gone: shown')
    },
  })
}

function applyAutostart(c) {
  if (app.isPackaged && !STORE) app.setLoginItemSettings({ openAtLogin: c.autostart })
}

// a VPS session's terminal in the CC app (laptop sessions have no tmux: their terminal is right here)
function openSession(id) {
  const c = config.get(), tmux = store.state.sessions[id]?.tmux
  const url = tmux && c.ccUrl && sessionUrl(c.ccUrl, tmux)
  if (url && safeExternal(url, allowedLinks(c))) shell.openExternal(url)
  else { log(`no terminal to open for session ${String(id).slice(0, 60)} (${url || 'no tmux'})`); widget.show() }
}

// First start: ask before touching the user's Claude Code settings.
async function askLocalHooks() {
  const { response } = await dialog.showMessageBox({
    type: 'question', buttons: ['Watch Claude Code', 'Not now'], defaultId: 0, cancelId: 1, noLink: true,
    title: 'Deskling',
    message: 'Watch Claude Code on this PC?',
    detail: `Deskling adds ${EVENTS.length} small hooks to ${CLAUDE_SETTINGS} so Claude Code tells it when a session ` +
      `works, finishes or waits for you. They only talk to Deskling on 127.0.0.1:${config.get().hookPort}. ` +
      'Your other settings stay as they are, and the file is backed up once (settings.json.deskling-backup).\n\n' +
      'You can turn this off any time in the tray menu ("Watch Claude Code on this PC"), which takes the hooks out again.',
  })
  config.set({ localHooks: response === 0 })
}

function startGallery() {
  const win = new BrowserWindow({ width: 980, height: 720, title: 'Deskling gallery', icon: icon(),
    backgroundColor: '#0a0e14', webPreferences: { contextIsolation: true, sandbox: true } })
  win.loadURL('app://deskling/src/renderer/gallery.html')
}

function start() {
  harden(session.defaultSession)
  serveApp()
  if (GALLERY) return startGallery()

  let lastView = null, quotaSent = {}
  // Hidden widget (full screen / Hide for 1 hour): say it with a toast instead. Never while the
  // screen is locked or in quiet hours.
  const toast = createNotifier({
    log,
    onClick: t => {
      if (t?.session) openSession(t.session)
      else if (t?.url && safeExternal(t.url, allowedLinks(config.get()))) shell.openExternal(t.url)
      else widget.show()
    },
  })
  const canToast = () => !widget?.visible && !locked && !quiet()
  function onFx(fx) {
    if ((fx.fx === 'chirp' || fx.fx === 'celebrate') && canToast()) {
      const d = describe(fx, store.state)
      if (d) toast(d)
    }
  }
  function onQuota(q) {                 // once per window and level: amber, then red
    for (const [name, w] of [['5-hour', q?.five], ['Weekly', q?.week]]) {
      if (!w || q.level === 'calm') continue
      const key = `${name}|${w.resetAt}`, lvl = w.pct >= 95 ? 2 : w.pct >= 80 ? 1 : 0
      if (lvl && lvl > (quotaSent[key] || 0)) {
        quotaSent[key] = lvl
        if (canToast()) toast({ title: `Claude quota · ${name} ${w.pct}%`, body: w.resetAt ? `Resets ${new Date(w.resetAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : '' })
      }
    }
  }
  store = new Store({
    finishedTtlMin: config.get().finishedTtlMin,
    nagAfterMin: config.get().nagAfterMin,
    send: (ch, payload) => {
      widget?.send(ch, payload)
      if (ch === 'fx') onFx(payload)
      if (ch === 'view') {
        onQuota(payload.quota)
        lastView = payload
        tray?.setOffline(payload.mood === 'offline')
        tray?.setTooltip(`Deskling · ${statusText()}`)
      }
    },
  })
  widget = createWidget({
    config, log,
    preload: join(ROOT, 'src', 'preload', 'preload.cjs'),
    url: 'app://deskling/src/renderer/index.html',
    onLoad: () => {
      widget.send('config', rendererConfig(config.get()))
      widget.send('view', lastView || store.view)
    },
  })
  tray = createTray({ config, widget, log, statusText, onQuit: () => app.quit() })

  ipcMain.on('list', (e, open) => {
    if (!fromApp(e)) return
    widget.setListOpen(open)
    if (open) store.dispatch({ type: 'listOpened' })
  })
  ipcMain.on('interactive', (e, v) => { if (fromApp(e)) widget.setInteractive(v) })
  ipcMain.on('open-url', (e, url) => {
    if (!fromApp(e)) return
    if (safeExternal(url, allowedLinks(config.get()))) shell.openExternal(url)
    else log(`refused to open ${String(url).slice(0, 200)}`)
  })
  ipcMain.on('open-session', (e, id) => { if (fromApp(e)) openSession(id) })
  ipcMain.on('menu', e => { if (fromApp(e)) tray.popup() })
  ipcMain.on('ack', e => { if (fromApp(e)) store.dispatch({ type: 'listOpened' }) })      // petted
  ipcMain.on('drag-start', e => { if (fromApp(e)) widget.dragStart() })
  ipcMain.handle('drag-end', e => (fromApp(e) ? widget.dragEnd() : false))

  let prev = config.get(), prevToken = config.token()
  config.on('change', c => {
    widget.applyConfig(c)
    widget.send('config', rendererConfig(c))
    store.setTimes(c)
    if (c.hotkey !== prev.hotkey) applyHotkey(c)
    if (c.hideInFullscreen !== prev.hideInFullscreen) applyFullscreen(c)
    if (c.localHooks !== prev.localHooks) applyLocalHooks(c)
    if (c.relayUrl !== prev.relayUrl || config.token() !== prevToken) { prevToken = config.token(); connect() }
    if (c.autostart !== prev.autostart) applyAutostart(c)
    prev = c
  })

  for (const ev of ['resume', 'unlock-screen']) powerMonitor.on(ev, () => source?.kick?.(ev))
  // locked or asleep: silent until back
  const setLocked = v => { if (locked !== v) { locked = v; widget.send('config', rendererConfig(config.get())) } }
  for (const ev of ['lock-screen', 'suspend']) powerMonitor.on(ev, () => setLocked(true))
  for (const ev of ['unlock-screen', 'resume']) powerMonitor.on(ev, () => setLocked(false))
  // quiet hours start and end on the clock: re-send the mute when that flips
  let wasQuiet = quiet()
  setInterval(() => { if (quiet() !== wasQuiet) { wasQuiet = quiet(); widget.send('config', rendererConfig(config.get())) } }, 30_000)
  if (!STORE) ensureShortcut({ app, shell, log })

  applyAutostart(config.get())
  applyHotkey(config.get())
  applyFullscreen(config.get())
  local = createLocal({
    onSession: s => store.dispatch({ type: 'session', data: s }),
    onGone: id => store.dispatch({ type: 'gone', data: { id } }),
  })
  setInterval(() => local.decay(), 60_000)
  startHookServer({ port: config.get().hookPort, token: hookToken(), onHook: p => local.hook(p), log })
  applyLocalHooks(config.get())
  if (config.get().localHooks === null) askLocalHooks()
  watchLimits({ file: join(homedir(), '.claude', 'limits.json'), log, onQuota: q => store.dispatch({ type: 'quota', data: q }) })
  connect()
}

app.on('second-instance', () => widget?.show())
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { source?.stop(); fullscreen?.stop(); store?.close(); config.close() })
app.on('will-quit', () => globalShortcut.unregisterAll())
app.whenReady().then(start)
