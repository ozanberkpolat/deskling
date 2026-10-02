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
    assert.equal(after.hooks.Stop[0].hooks[0].headers['X-Deskling-Mark'], 'deskling-v2')
    // a v1 install (all 5 s timeouts) is not "installed" for v2, and is replaced, not doubled
    const v1 = { hooks: { PermissionRequest: [{ hooks: [{ type: 'http', url: opt.url, timeout: 5, headers: { 'X-Deskling-Token': 'x', 'X-Deskling-Mark': 'deskling-v1' } }] }] } }
    writeFileSync(f, JSON.stringify(v1))
    assert.equal(hooksInstalled(f, opt.url), false)
    installHooks(f, opt)
    const v2 = JSON.parse(readFileSync(f, 'utf8'))
    assert.equal(v2.hooks.PermissionRequest.length, 1)
    assert.equal(v2.hooks.PermissionRequest[0].hooks[0].timeout, 120)              // long enough to answer from the list
    assert.equal(v2.hooks.Stop[0].hooks[0].timeout, 5)
  } finally { rmSync(d, { recursive: true }) }
})

test('hookserver: token required, /hook only, answers {} at once', async () => {
  const got = []
  const hs = startHookServer({ port: 0, token: 'secret-token', onHook: p => got.push(p), log: () => {} })
  const srv = hs.srv
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
  hs.close()
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

test('hookserver: a permission prompt is held for the list; allow, deny, timeout, terminal first', async () => {
  const got = [], done = []
  let hold = true
  const hs = startHookServer({ port: 0, token: 'secret-token', log: () => {}, holdMs: 300,
    holdPermission: () => hold, onHook: (p, meta) => got.push({ ev: p.hook_event_name, meta }), onDone: (id, s) => done.push([id, s]) })
  await new Promise(r => hs.srv.once('listening', r))
  const url = `http://127.0.0.1:${hs.srv.address().port}/hook`
  const send = body => fetch(url, { method: 'PUT', headers: { 'X-Deskling-Token': 'secret-token' }, body: JSON.stringify(body) }).then(r => r.json())
  const ask = (s = 'a') => send({ session_id: s, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm i zod' } })
  const until = async f => { for (let i = 0; i < 100 && !f(); i++) await new Promise(r => setTimeout(r, 10)) }
  try {
    // allow
    let reply = ask()
    await until(() => hs.held === 1)
    const id = got.at(-1).meta.holdId
    assert.ok(id)
    assert.equal(hs.answer(id, true), 'a')
    assert.deepEqual(await reply, { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } })
    assert.equal(hs.answer(id, true), null)                       // answered once only
    // deny
    reply = ask()
    await until(() => hs.held === 1)
    hs.answer(got.at(-1).meta.holdId, false)
    assert.equal((await reply).hookSpecificOutput.decision.behavior, 'deny')
    // nobody answers: {} after holdMs, never an allow
    reply = ask()
    assert.deepEqual(await reply, {})
    assert.equal(done.length, 1)
    // the terminal answered first: the next event from that session releases it with {}
    reply = ask('b')
    await until(() => hs.held === 1)
    assert.deepEqual(await send({ session_id: 'b', hook_event_name: 'PreToolUse' }), {})
    assert.deepEqual(await reply, {})
    assert.equal(hs.held, 0)
    // AskUserQuestion is a question, not a permission: answered at once, never held
    assert.deepEqual(await send({ session_id: 'q', hook_event_name: 'PermissionRequest', tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'Which DB?', options: [] }] } }), {})
    assert.equal(hs.held, 0)
    assert.equal(got.at(-1).meta.holdId, undefined)
    // a Notification from the same session does not release it
    reply = ask('c')
    await until(() => hs.held === 1)
    await send({ session_id: 'c', hook_event_name: 'Notification', message: 'Claude needs your permission' })
    assert.equal(hs.held, 1)
    hs.answer(got.at(-2).meta.holdId, true)                       // the question, before the notice
    await reply
    // switched off: answered at once
    hold = false
    assert.deepEqual(await ask(), {})
  } finally { hs.close() }
})

test('local: a held prompt puts Allow/Deny on the session until it is settled', () => {
  const out = []
  const l = createLocal({ onSession: s => out.push(structuredClone(s)), onGone: () => {} })
  l.hook(P('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'npm install zod' } }), { holdId: 'h1' })
  assert.deepEqual(out.at(-1).ask, { id: 'h1', text: 'Bash: npm install zod' })
  assert.equal(out.at(-1).state, 'blocked')
  l.hook(P('Notification', { message: 'Claude needs your permission' }))
  assert.ok(out.at(-1).ask, 'a notice keeps the question')
  l.answered('s1', 'other')                                  // a stale id changes nothing
  assert.ok(out.at(-1).ask)
  l.answered('s1', 'h1')
  assert.equal(out.at(-1).ask, null)
  assert.equal(out.at(-1).state, 'working')
  l.hook(P('PermissionRequest', { tool_name: 'Edit', tool_input: { file_path: 'a.js' } }), { holdId: 'h2' })
  l.dropAsk('s1', 'h2')                                       // timed out: buttons go, still blocked
  assert.equal(out.at(-1).ask, null)
  assert.equal(out.at(-1).state, 'blocked')
  l.hook(P('PermissionRequest', { tool_name: 'Edit', tool_input: { file_path: 'b.js' } }))   // not held: no buttons
  assert.equal(out.at(-1).ask, null)
  l.hook(P('PermissionRequest', { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'Which DB?' }] } }))
  assert.equal(out.at(-1).last, 'Question: Which DB?')        // a question: waits for you, answered in the terminal
  assert.equal(out.at(-1).state, 'blocked')
  l.hook(P('PermissionRequest', { tool_name: 'Edit', tool_input: { file_path: 'c.js' } }), { holdId: 'h3' })
  l.hook(P('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'c.js' } }))       // answered in the terminal
  assert.equal(out.at(-1).ask, null)
})
