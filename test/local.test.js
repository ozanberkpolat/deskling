import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocal, DECAY_MS } from '../src/main/local.js'
import { installHooks, removeHooks, hooksInstalled, EVENTS } from '../src/main/claude-hooks.js'
import { startHookServer } from '../src/main/hookserver.js'
import { parseLimits, watchLimits } from '../src/main/quota.js'
import { isQuiet } from '../src/main/quiet.js'

const P = (ev, extra = {}) => ({ session_id: 's1', cwd: 'C:\\Users\\dev\\work\\my-app', hook_event_name: ev, ...extra })

test('local: hook payloads become laptop sessions, like cc-backend normalize()', () => {
  let t = 1_000_000
  const out = []
  const l = createLocal({ onSession: s => out.push(s), onGone: id => out.push({ gone: id }), now: () => t })
  l.hook(P('SessionStart'))
  l.hook(P('UserPromptSubmit', { prompt: 'fix the   login bug\nplease' }))
  l.hook(P('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' } }))
  l.hook(P('Notification', { message: 'Claude is waiting for your input', notification_type: 'idle_prompt' }))
  l.hook(P('PermissionRequest'))
  l.hook(P('Notification', { message: 'Claude needs your permission' }))      // stays blocked
  t += 42_000
  l.hook(P('Stop'))
  const last = out.at(-1)
  assert.equal(last.host, 'laptop')
  assert.equal(last.project, 'my-app')
  assert.equal(last.title, 'fix the login bug please')
  assert.equal(last.state, 'done')
  assert.equal(last.last, 'finished in 42s')
  assert.deepEqual(out.map(s => s.state), ['idle', 'working', 'working', 'blocked', 'blocked', 'done'])
  assert.equal(out[2].last, 'Bash: npm test')
  l.hook({ hook_event_name: 'Stop' })                                          // no session id: ignored
  l.hook(P('SomethingNew'))                                                    // unknown event: ignored
  assert.equal(out.length, 6)
})

test('local: decay turns a silent working session idle, then forgets ended ones', () => {
  let t = 0
  const out = []
  const l = createLocal({ onSession: s => out.push(s.state), onGone: id => out.push(`gone ${id}`), now: () => t })
  l.hook(P('UserPromptSubmit', { prompt: 'x' }))
  t = DECAY_MS + 1; l.decay()
  assert.equal(out.at(-1), 'idle')
  l.hook(P('SessionEnd'))
  t += 11 * 60_000; l.decay()
  assert.equal(out.at(-1), 'gone s1')
  assert.equal(l.size, 0)
})

test('claude-hooks: adds ours, keeps everyone else\'s, idempotent, removable, backed up', () => {
  const d = mkdtempSync(join(tmpdir(), 'deskling-'))
  const f = join(d, 'settings.json')
  try {
    const other = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'log.sh' }] }] }, model: 'opus' }
    writeFileSync(f, JSON.stringify(other))
    const opt = { url: 'http://127.0.0.1:8033/hook', token: 't0k' }
    installHooks(f, opt); installHooks(f, opt)
    const s = JSON.parse(readFileSync(f, 'utf8'))
    assert.equal(s.model, 'opus')
    assert.equal(s.hooks.Stop.length, 2)                                       // theirs + ours, once
    assert.equal(s.hooks.Stop[1].hooks[0].headers['X-Deskling-Token'], 't0k')
    assert.ok(hooksInstalled(f, opt.url))
    assert.equal(hooksInstalled(f, 'http://127.0.0.1:9999/hook'), false)
    assert.equal(Object.keys(s.hooks).length, EVENTS.length)
    removeHooks(f)
    assert.deepEqual(JSON.parse(readFileSync(f, 'utf8')), other)
    assert.deepEqual(JSON.parse(readFileSync(f + '.deskling-backup', 'utf8')), other)
    writeFileSync(f, '{ broken')
    assert.throws(() => installHooks(f, opt))
    assert.equal(readFileSync(f, 'utf8'), '{ broken')                          // never overwritten
    const fresh = join(d, 'new', 'settings.json')
    installHooks(fresh, opt)
    assert.ok(existsSync(fresh) && hooksInstalled(fresh, opt.url))
    // hooks left by cc-dog (this app's earlier name) are replaced, not doubled
    const legacy = { hooks: { Stop: [{ hooks: [{ type: 'http', url: opt.url, headers: { 'X-CcDog-Token': 'x', 'X-CcDog-Mark': 'cc-dog-v1' } }] }] } }
    writeFileSync(f, JSON.stringify(legacy))
    assert.equal(hooksInstalled(f, opt.url), false)
    installHooks(f, opt)
    const after = JSON.parse(readFileSync(f, 'utf8'))
    assert.equal(after.hooks.Stop.length, 1)
    assert.equal(after.hooks.Stop[0].hooks[0].headers['X-Deskling-Mark'], 'deskling-v1')
  } finally { rmSync(d, { recursive: true }) }
})

test('hookserver: token required, /hook only, answers {} at once', async () => {
  const got = []
  const srv = startHookServer({ port: 0, token: 'secret-token', onHook: p => got.push(p), log: () => {} })
  await new Promise(r => srv.once('listening', r))
  const url = `http://127.0.0.1:${srv.address().port}`
  const send = (path, headers, body) => fetch(url + path, { headers, body, method: 'PUT' })     // eslint: any verb
  assert.equal((await send('/hook', {}, '{}')).status, 401)
  assert.equal((await send('/hook', { 'X-Deskling-Token': 'wrong-token!' }, '{}')).status, 401)
  assert.equal((await send('/other', { 'X-Deskling-Token': 'secret-token' }, '{}')).status, 404)
  const r = await send('/hook', { 'X-Deskling-Token': 'secret-token' }, JSON.stringify({ session_id: 'a' }))
  assert.equal(r.status, 200)
  assert.equal(await r.text(), '{}')
  assert.deepEqual(got, [{ session_id: 'a' }])
  srv.close()
})

test('quota: limits.json in both shapes, weekly alias, ts or mtime, junk ignored', () => {
  const raw = { session_id: 'x', rate_limits: { five_hour: { used_percentage: 62.5, resets_at: 1790800000 }, seven_day: { used_percentage: 18, resets_at: '2026-10-05T07:00:00Z' } } }
  assert.deepEqual(parseLimits(JSON.stringify(raw), 1_790_000_000_000),
    { five: { pct: 62.5, resetsAt: 1790800000 }, week: { pct: 18, resetsAt: Date.parse('2026-10-05T07:00:00Z') / 1000 }, at: 1_790_000_000, source: 'laptop' })
  const bare = { ts: 1790000123456, five_hour: { used_percentage: 5 }, weekly: { used_percentage: 7, resets_at: 1790900000 } }
  const q = parseLimits(JSON.stringify(bare), 0)
  assert.equal(q.week.pct, 7)
  assert.equal(q.at, 1790000123.456)
  assert.equal(parseLimits('{ broken', 0), null)
  assert.equal(parseLimits(JSON.stringify({ model: 'x' }), 0), null)
})

test('quota: the watcher reports on change only and complains once', async () => {
  const d = mkdtempSync(join(tmpdir(), 'deskling-'))
  const f = join(d, 'limits.json'), got = [], logs = []
  const w = watchLimits({ file: f, onQuota: q => got.push(q.five.pct), log: m => logs.push(m), everyMs: 20 })
  await new Promise(r => setTimeout(r, 60))
  assert.equal(logs.length, 1)                                          // missing: said once
  writeFileSync(f, JSON.stringify({ rate_limits: { five_hour: { used_percentage: 33 } } }))
  await new Promise(r => setTimeout(r, 80))
  assert.deepEqual(got, [33])                                           // unchanged file: not re-sent
  w.stop(); rmSync(d, { recursive: true })
})

test('local: StopFailure is an error; a subagent notice never makes the session wait', () => {
  const out = []
  const l = createLocal({ onSession: s => out.push(s), onGone: () => {} })
  l.hook(P('UserPromptSubmit', { prompt: 'go' }))
  l.hook(P('Notification', { agent_id: 'sub1', message: 'Claude needs your permission' }))
  assert.equal(out.at(-1).state, 'working')
  l.hook(P('StopFailure', { error: { message: 'rate_limit_error: limit reached' } }))
  assert.equal(out.at(-1).state, 'error')
  assert.equal(out.at(-1).last, 'rate_limit_error: limit reached')
})

test('quiet hours: plain and across midnight', () => {
  const at = (h, m = 0) => new Date(2026, 9, 1, h, m)
  const night = { from: '20:00', to: '08:00' }, day = { from: '12:00', to: '13:30' }
  assert.equal(isQuiet(at(21), night), true)
  assert.equal(isQuiet(at(7, 59), night), true)
  assert.equal(isQuiet(at(8), night), false)
  assert.equal(isQuiet(at(19, 59), night), false)
  assert.equal(isQuiet(at(12, 45), day), true)
  assert.equal(isQuiet(at(13, 30), day), false)
  assert.equal(isQuiet(at(3), null), false)
})
