// %APPDATA%\deskling\config.json. Atomic writes; an edit by hand (or by the tray) is applied live
// via fs.watch. No electron import, so node tests can drive it with a temp dir.
import { EventEmitter } from 'node:events'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MASCOTS } from '../shared/sprites/mascots.js'

export const DEFAULTS = {
  relayUrl: '',               // '' = watch this machine only; else a remote relay (advanced, needs token)
  token: '',
  display: null,              // null = automatic (built-in screen, then primary); else {id, label, size}
  corner: 'tr',               // tl | tr | bl | br
  shape: 'round',             // round | square
  mascot: 'shiba',            // an id from sprites/mascots.js
  idleOpacity: 0.45,          // how see-through the box is while nothing happens (1 = solid)
  quietHours: { from: '20:00', to: '08:00' },   // no sound and no toasts in this window; null = off
  tucked: false,              // tucked into the side edge (drop it past the edge, or tray)
  hotkey: 'Control+Alt+D',    // toggles the list; '' = none
  ccUrl: '',                  // with a relay: web terminal a remote session's row opens (<ccUrl>#t=<tmux>)
  linkHosts: [],              // with a relay: extra https hosts its items may link to
  localHooks: null,           // watch this machine's Claude Code (hooks in ~/.claude/settings.json); null = ask on first start
  hookPort: 8033,             // 127.0.0.1 only
  sound: { enabled: true, volume: 0.6 },
  finishedTtlMin: 30,
  hideFromCapture: true,
  hideInFullscreen: true,     // hide + mute while a full-screen app or presentation runs (Windows)
  nagAfterMin: 5,             // still waiting after this long: one more bark; 0 = never
  autostart: true,
  disableGpu: false,
}

const clamp = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)

export function normalize(raw = {}) {
  const c = { ...DEFAULTS, ...raw }
  c.relayUrl = typeof c.relayUrl === 'string' && /^https?:\/\/[^/]+/.test(c.relayUrl) ? c.relayUrl.replace(/\/+$/, '') : ''
  c.token = typeof c.token === 'string' ? c.token.trim() : ''
  delete c.positions                                  // v1's top-edge offsets
  c.corner = ['tl', 'tr', 'bl', 'br'].includes(c.corner) ? c.corner : DEFAULTS.corner
  c.shape = ['round', 'square'].includes(c.shape) ? c.shape : DEFAULTS.shape
  c.mascot = Object.hasOwn(MASCOTS, c.mascot) ? c.mascot : DEFAULTS.mascot
  c.hotkey = typeof c.hotkey === 'string' ? c.hotkey.trim() : DEFAULTS.hotkey
  c.ccUrl = typeof c.ccUrl === 'string' && /^https:\/\/[^/]+\//.test(c.ccUrl) ? c.ccUrl : ''
  c.linkHosts = Array.isArray(c.linkHosts) ? c.linkHosts.filter(h => typeof h === 'string' && /^[a-z0-9.-]+$/i.test(h)) : []
  c.nagAfterMin = clamp(c.nagAfterMin, 0, 24 * 60, DEFAULTS.nagAfterMin)
  c.idleOpacity = clamp(c.idleOpacity, 0.1, 1, DEFAULTS.idleOpacity)
  const hm = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
  c.quietHours = c.quietHours === null ? null : hm(c.quietHours?.from) && hm(c.quietHours?.to) ? { from: c.quietHours.from, to: c.quietHours.to } : DEFAULTS.quietHours
  c.hookPort = Math.round(clamp(c.hookPort, 1024, 65535, DEFAULTS.hookPort))
  c.sound = { enabled: c.sound?.enabled !== false, volume: clamp(c.sound?.volume, 0, 1, DEFAULTS.sound.volume) }
  c.finishedTtlMin = clamp(c.finishedTtlMin, 1, 24 * 60, DEFAULTS.finishedTtlMin)
  c.localHooks = typeof c.localHooks === 'boolean' ? c.localHooks : null
  for (const k of ['hideFromCapture', 'hideInFullscreen', 'autostart', 'disableGpu', 'tucked']) c[k] = typeof c[k] === 'boolean' ? c[k] : DEFAULTS[k]
  return c
}

// This app was called cc-dog before. Its settings and tokens move over once, on the first start
// that has no config of its own yet (the log stays behind). Returns true when it copied.
export const MIGRATE = ['config.json', 'token', 'hook-token']
export function migrateFrom(oldDir, dir) {
  if (existsSync(join(dir, 'config.json')) || !existsSync(join(oldDir, 'config.json'))) return false
  mkdirSync(dir, { recursive: true })
  for (const f of MIGRATE) if (existsSync(join(oldDir, f))) copyFileSync(join(oldDir, f), join(dir, f))
  return true
}

export class Config extends EventEmitter {
  constructor(dir, log = () => {}) {
    super()
    this.dir = dir
    this.file = join(dir, 'config.json')
    this.log = log
    this.written = ''
    mkdirSync(dir, { recursive: true })
    this.value = this.read() ?? normalize()
    if (this.written === '') this.write(this.value)        // first launch: create it with defaults
  }

  read() {
    let text
    try { text = readFileSync(this.file, 'utf8') } catch { return null }
    try {
      this.written = text
      return normalize(JSON.parse(text))
    } catch (e) {
      this.log(`config: ${this.file} is not valid JSON (${e.message}); keeping the previous settings`)
      return undefined
    }
  }

  write(value) {
    const text = JSON.stringify(value, null, 2) + '\n'
    const tmp = this.file + '.tmp'
    writeFileSync(tmp, text)
    renameSync(tmp, this.file)
    this.written = text
  }

  get() { return this.value }

  // config.json's "token", else a `token` file beside it (so it can arrive by scp, never by chat).
  token() {
    if (this.value.token) return this.value.token
    try { return readFileSync(join(this.dir, 'token'), 'utf8').trim() } catch { return '' }
  }

  set(patch) {
    this.value = normalize({ ...this.value, ...patch })
    this.write(this.value)
    this.emit('change', this.value)
  }

  // Watch the directory, not the file: an atomic rename replaces the inode a file watch holds.
  watch() {
    let t = null
    this.watcher = watch(this.dir, (_, name) => {
      if (name && name !== 'config.json' && name !== 'token') return
      clearTimeout(t)
      t = setTimeout(() => {
        if (name === 'token') return this.emit('change', this.value)
        let text
        try { text = readFileSync(this.file, 'utf8') } catch { return }
        if (text === this.written) return                   // our own write
        const v = this.read()
        if (!v) return
        this.value = v
        this.log('config: reloaded after an edit')
        this.emit('change', v)
      }, 200)
    })
    return this
  }

  close() { this.watcher?.close() }
}
