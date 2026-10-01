import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Config, DEFAULTS, migrateFrom, normalize } from '../src/main/config.js'
import { pickDisplay, windowRect, nearestCorner } from '../src/main/displays.js'
import { allowedLinks, safeExternal, sessionUrl } from '../src/main/links.js'
import { createParser, HIDE_STATES } from '../src/main/fullscreen.js'
import { describe as toastText } from '../src/main/notify-text.js'
import { Store } from '../src/main/store.js'
import { RelayStream } from '../src/main/stream.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function until(fn, ms = 3000) {
  const end = Date.now() + ms
  while (!fn()) { if (Date.now() > end) throw new Error('timed out'); await sleep(10) }
}

// ── config ──
test('config: created with defaults, clamps, persists, reloads hand edits, survives bad JSON', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deskling-'))
  try {
    const c = new Config(dir).watch()
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')), DEFAULTS)
    c.set({ sound: { enabled: false, volume: 7 } })
    assert.equal(c.get().sound.volume, 1)
    assert.equal(new Config(dir).get().sound.enabled, false)
    let changed = null
    c.on('change', v => { changed = v })
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ ...c.get(), token: ' abc ' }))
    await until(() => changed)
    assert.equal(c.get().token, 'abc')
    c.set({ token: '' })
    assert.equal(c.token(), '')
    changed = null
    writeFileSync(join(dir, 'token'), 'from-file\n')
    await until(() => changed)
    assert.equal(c.token(), 'from-file')
    c.set({ token: 'abc' })
    changed = null
    writeFileSync(join(dir, 'config.json'), '{ broken')
    await sleep(400)
    assert.equal(changed, null)
    assert.equal(c.get().token, 'abc')
    c.close()
  } finally { rmSync(dir, { recursive: true }) }
})

test('config: normalize rejects junk', () => {
  const c = normalize({ relayUrl: 'ftp://x', finishedTtlMin: 'x', hideFromCapture: 'yes', positions: 3, corner: 'middle', shape: 'star', ccUrl: 'http://x/', nagAfterMin: -4 })
  assert.equal(c.relayUrl, DEFAULTS.relayUrl)
  assert.equal(c.finishedTtlMin, 30)
  assert.equal(c.hideFromCapture, true)
  assert.equal('positions' in c, false)
  assert.equal(c.corner, 'tr')
  assert.equal(c.shape, 'round')
  assert.equal(c.ccUrl, DEFAULTS.ccUrl)
  assert.equal(c.nagAfterMin, 0)
  assert.equal(normalize({ mascot: 'nope' }).mascot, 'shiba')
  assert.equal(normalize({ mascot: 'dragon' }).mascot, 'dragon')
  assert.equal(normalize({ idleOpacity: 0 }).idleOpacity, 0.1)
  assert.equal(normalize({ idleOpacity: 'x' }).idleOpacity, 0.45)
  assert.equal(normalize({ quietHours: null }).quietHours, null)
  assert.deepEqual(normalize({ quietHours: { from: '25:00', to: '08:00' } }).quietHours, { from: '20:00', to: '08:00' })
  assert.deepEqual(normalize({ quietHours: { from: '22:30', to: '06:15' } }).quietHours, { from: '22:30', to: '06:15' })
  assert.equal(normalize({ relayUrl: 'http://h:1/' }).relayUrl, 'http://h:1')
  // out of the box: this machine only, nothing to link to, hooks not asked about yet
  assert.equal(DEFAULTS.relayUrl, '')
  assert.equal(DEFAULTS.ccUrl, '')
  assert.equal(normalize({}).localHooks, null)
  assert.equal(normalize({ localHooks: 'yes' }).localHooks, null)
  assert.equal(normalize({ localHooks: false }).localHooks, false)
  assert.deepEqual(normalize({ linkHosts: ['items.example.com', 'bad host/', 3] }).linkHosts, ['items.example.com'])
})

test('config: settings from cc-dog (the earlier name) are copied once, never over our own', () => {
  const root = mkdtempSync(join(tmpdir(), 'deskling-'))
  const old = join(root, 'cc-dog'), now = join(root, 'deskling')
  try {
    assert.equal(migrateFrom(old, now), false)                                 // nothing to copy
    mkdirSync(old)
    writeFileSync(join(old, 'config.json'), '{"corner":"bl","localHooks":true}')
    writeFileSync(join(old, 'hook-token'), 'abc')
    writeFileSync(join(old, 'cc-dog.log'), 'old log')
    mkdirSync(now)                                                             // Electron makes the dir first
    assert.equal(migrateFrom(old, now), true)
    assert.equal(readFileSync(join(now, 'hook-token'), 'utf8'), 'abc')
    assert.equal(new Config(now).get().corner, 'bl')
    writeFileSync(join(old, 'config.json'), '{"corner":"tl"}')
    assert.equal(migrateFrom(old, now), false)                                 // ours exists: left alone
    assert.equal(new Config(now).get().corner, 'bl')
  } finally { rmSync(root, { recursive: true }) }
})

// ── displays ──
const D = (id, label, internal, x = 0, w = 1920) => ({ id, label, internal, size: { width: w, height: 1080 },
  bounds: { x, y: 0, width: w, height: 1080 }, workArea: { x, y: 0, width: w, height: 1040 } })   // 40 px taskbar
const screens = [D(1, 'DELL P2419H', false, -1920), D(2, 'Built-in', true, 0), D(3, 'DELL P2419H', false, 1920)]

test('displays: saved id, then label+size, then built-in, then primary', () => {
  assert.equal(pickDisplay(screens, { id: 3 }, 1).id, 3)
  assert.equal(pickDisplay(screens, { id: 99, label: 'DELL P2419H', size: { width: 1920, height: 1080 } }, 1).id, 1)
  assert.equal(pickDisplay(screens, null, 1).id, 2)
  assert.equal(pickDisplay([D(1, 'a', false), D(5, 'b', false)], null, 5).id, 5)
})

test('displays: the window hugs the work-area corner (above the taskbar), on any monitor', () => {
  assert.deepEqual(windowRect(screens[1], 'tr', 360, 200), { x: 1560, y: 0, width: 360, height: 200 })
  assert.deepEqual(windowRect(screens[1], 'bl', 360, 200), { x: 0, y: 840, width: 360, height: 200 })
  assert.deepEqual(windowRect(screens[0], 'tl', 380, 560), { x: -1920, y: 0, width: 380, height: 560 })
  assert.deepEqual(windowRect(screens[2], 'br', 380, 560), { x: 1920 + 1540, y: 480, width: 380, height: 560 })
})

test('displays: a drop goes to the corner of its quadrant', () => {
  assert.equal(nearestCorner(screens[1], { x: 100, y: 100 }), 'tl')
  assert.equal(nearestCorner(screens[1], { x: 1800, y: 900 }), 'br')
  assert.equal(nearestCorner(screens[0], { x: -100, y: 600 }), 'br')
  assert.equal(nearestCorner(screens[2], { x: 2000, y: 10 }), 'tl')
})

// ── links ──
test('links: only the configured terminal path and item hosts, https, no credentials; none by default', () => {
  const allowed = allowedLinks({ ccUrl: 'https://portal.example.com/cc/', linkHosts: ['items.example.com'] })
  assert.ok(safeExternal('https://items.example.com/ACME/issues/ACME-77', allowed))
  assert.ok(safeExternal('https://portal.example.com/cc/#t=37-my-app', allowed))
  for (const bad of ['http://items.example.com/x', 'https://portal.example.com/brain/', 'https://evil.com/cc/',
    'https://u:p@items.example.com/', 'javascript:alert(1)', 'not a url']) assert.equal(safeExternal(bad, allowed), false, bad)
  assert.equal(safeExternal('https://items.example.com/x'), false)
  assert.deepEqual(allowedLinks(DEFAULTS), [])
  assert.equal(sessionUrl('https://portal.example.com/cc/', '37-my app'), 'https://portal.example.com/cc/#t=37-my%20app')
})

// ── fullscreen helper output ──
test('fullscreen: parses states across chunks; garbage is null', () => {
  const got = []
  const p = createParser(s => got.push(s))
  p('5\r\n2'); p('\r\n'); p('oops\n4\n')
  assert.deepEqual(got, [5, 2, null, 4])
  assert.deepEqual(HIDE_STATES, [2, 3, 4])
})

// ── store ──
test('store: view goes out before fx; quiet updates are throttled', async () => {
  const sent = []
  const st = new Store({ send: (ch, p) => sent.push([ch, ch === 'view' ? p.mood : p.fx]), viewMs: 30 })
  const S = (state) => ({ id: 'a', project: 'p', tmux: 't', title: 't', state, since: 1, last: null, agentsActive: 0 })
  st.dispatch({ type: 'snapshot', data: { sessions: [S('working')], paperclip: { items: [] }, status: { cc: 'ok' } } })
  assert.deepEqual(sent.splice(0), [['view', 'working']])
  st.dispatch({ type: 'session', data: S('blocked') })
  assert.deepEqual(sent.splice(0), [['view', 'waiting'], ['fx', 'chirp']])
  st.dispatch({ type: 'session', data: { ...S('blocked'), last: 'x' } })
  st.dispatch({ type: 'session', data: { ...S('blocked'), last: 'y' } })
  assert.deepEqual(sent, [])
  await sleep(60)
  assert.deepEqual(sent.splice(0), [['view', 'waiting']])
  st.close()
})

// ── stream, against a real local HTTP server ──
function relay(handler) {
  return new Promise(res => {
    const srv = createServer(handler).listen(0, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}` }))
  })
}
const SNAP = { sessions: [], paperclip: { items: [], stale: false }, status: { cc: 'ok', paperclip: 'off' } }
const sse = (res, ...events) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  for (const [e, d] of events) res.write(`event: ${e}\r\ndata: ${JSON.stringify(d)}\r\n\r\n`)
}

test('stream: snapshot then events, sends the token, GET only', async () => {
  const seen = []
  const { srv, url } = await relay((req, res) => {
    seen.push([req.method, req.url, req.headers.authorization])
    sse(res, ['snapshot', SNAP], ['session', { id: 'a', state: 'working' }], ['tabs', {}])
  })
  const got = []
  const s = new RelayStream({ url, token: 'tok', dispatch: a => got.push(a.type) }).start()
  try {
    await until(() => got.length >= 2)
    assert.deepEqual(got, ['snapshot', 'session'])
    assert.deepEqual(seen[0], ['GET', '/stream', 'Bearer tok'])
  } finally { s.stop(); srv.closeAllConnections(); srv.close() }
})

test('stream: watchdog reconnects a silent stream; disconnect is dispatched', async () => {
  let n = 0
  const { srv, url } = await relay((req, res) => { n++; sse(res, ['snapshot', SNAP]) })   // then silence
  const got = []
  const s = new RelayStream({ url, token: 't', dispatch: a => got.push(a.type), watchdogMs: 250, minBackoffMs: 5, maxBackoffMs: 10 }).start()
  try {
    await until(() => n >= 2 && got.length >= 3, 5000)
    assert.deepEqual(got.slice(0, 3), ['snapshot', 'disconnected', 'snapshot'])
  } finally { s.stop(); srv.closeAllConnections(); srv.close() }
})

test('stream: after 3 failures it polls /live; a 401 is logged plainly', async () => {
  const hits = []
  const { srv, url } = await relay((req, res) => {
    hits.push(req.url)
    if (req.url === '/live') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(SNAP)) }
    res.writeHead(401); res.end()
  })
  const got = [], logs = []
  const s = new RelayStream({ url, token: 't', dispatch: a => got.push(a.type), log: m => logs.push(m), minBackoffMs: 5, maxBackoffMs: 10, pollMs: 50 }).start()
  try {
    await until(() => hits.includes('/live') && got.includes('snapshot'))
    assert.ok(hits.filter(h => h === '/stream').length >= 3)
    assert.ok(logs.some(l => l.includes('token in config.json was rejected')))
  } finally { s.stop(); srv.closeAllConnections(); srv.close() }
})

test('stream: kick() cuts a long backoff short', async () => {
  let n = 0
  const { srv, url } = await relay((req, res) => { n++; res.writeHead(500); res.end() })
  const s = new RelayStream({ url, token: 't', dispatch: () => {}, minBackoffMs: 60_000, maxBackoffMs: 60_000 }).start()
  try {
    await until(() => n === 1)
    await sleep(50)
    s.kick('resume')
    await until(() => n === 2, 1000)
  } finally { s.stop(); srv.closeAllConnections(); srv.close() }
})

test('notification text: a session waiting or finished, a Paperclip item', () => {
  const st = { sessions: { a: { id: 'a', project: 'my-app', title: 'login fix', last: 'Bash: npm test', state: 'blocked' } },
    paperclip: { items: [{ key: 'k', company: 'Acme', id: 'ACME-7', title: 'Review', whyNow: 'In review', url: 'https://items.example.com/x' }] } }
  assert.deepEqual(toastText({ fx: 'chirp', id: 'a', kind: 'cc' }, st), { title: 'my-app · needs approval', body: 'login fix\nBash: npm test', target: { session: 'a' } })
  assert.equal(toastText({ fx: 'celebrate', id: 'a' }, st).title, 'my-app · finished')
  assert.deepEqual(toastText({ fx: 'chirp', id: 'k', kind: 'pc' }, st), { title: 'Paperclip · Acme', body: 'ACME-7 Review\nIn review', target: { url: 'https://items.example.com/x' } })
  assert.equal(toastText({ fx: 'chirp', id: 'gone', kind: 'cc' }, st), null)
})
