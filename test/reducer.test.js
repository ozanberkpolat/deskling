import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { initialState, reduce, mood, CHIRP_DEBOUNCE_MS } from '../src/shared/reducer.js'
import { viewmodel, quotaView } from '../src/shared/viewmodel.js'
import { mergeQuota } from '../src/shared/reducer.js'

const S = (id, state, extra = {}) => ({ id, project: 'p', tmux: id, title: id, state, since: 1, last: null, agentsActive: 0, ...extra })
const PC = (key, extra = {}) => ({ key, company: 'Acme', kind: 'approval', id: 'ACME-1', title: 't', severity: 'high', whyNow: 'w', at: '2026-10-01T06:00:00Z', url: 'https://items.example.com/x', ...extra })
const OK = { cc: 'ok', paperclip: 'ok' }

// Run actions in order, collecting effects. Time advances 10 s per action unless `now` is given.
function run(actions, st = initialState()) {
  const fx = []
  let now = 1_000_000
  for (const a of actions) {
    now = a.now ?? now + 10_000
    const r = reduce(st, { ...a, now })
    st = r.state
    fx.push(...r.effects.map(e => e.fx))
  }
  return { st, fx }
}
const snap = (sessions, items = [], status = OK) => ({ type: 'snapshot', data: { sessions, paperclip: { items, stale: false }, status } })
const ses = s => ({ type: 'session', data: s })

test('first snapshot seeds silently: no chirp for waiting, no celebrate for done, pc items seen', () => {
  const { st, fx } = run([snap([S('a', 'blocked'), S('b', 'done')], [PC('k1')])])
  assert.deepEqual(fx, [])
  assert.equal(mood(st), 'waiting')                        // still really waiting
  assert.deepEqual(st.unseen, {})
  assert.equal(viewmodel(st).badges.paperclip, 1)
  assert.equal(viewmodel(st).badges.waiting, 1)            // the cc one; pc k1 is seen
})

test('entering waiting chirps once; re-arms after leaving', () => {
  const { fx } = run([snap([S('a', 'working')]),
    ses(S('a', 'blocked')), ses(S('a', 'blocked', { last: 'x' })), ses(S('a', 'working')), ses(S('a', 'waiting'))])
  assert.deepEqual(fx, ['chirp', 'chirp'])
})

test('chirps debounce across sessions; a debounced session still re-arms', () => {
  const t = 2_000_000
  const { fx, st } = run([snap([S('a', 'working'), S('b', 'working')], [], OK),
    { ...ses(S('a', 'blocked')), now: t },
    { ...ses(S('b', 'blocked')), now: t + 1000 },                     // inside 4 s: swallowed
    { ...ses(S('b', 'working')), now: t + 2000 },
    { ...ses(S('b', 'blocked')), now: t + 1000 + CHIRP_DEBOUNCE_MS }])
  assert.deepEqual(fx, ['chirp', 'chirp'])
  assert.ok(st.alerted.b)
})

test('done while live celebrates; unseen until list opened', () => {
  let { st, fx } = run([snap([S('a', 'working')]), ses(S('a', 'done'))])
  assert.deepEqual(fx, ['celebrate'])
  assert.equal(mood(st), 'finished')
  assert.equal(viewmodel(st).badges.finished, 1)
  st = reduce(st, { type: 'listOpened', now: 0 }).state
  assert.equal(mood(st), 'idle')
})

test('unseen finished expires after the ttl', () => {
  let { st } = run([snap([S('a', 'working')]), { ...ses(S('a', 'done')), now: 5_000_000 }])
  st = reduce(st, { type: 'tick', now: 5_000_000 + 29 * 60_000 }).state
  assert.equal(mood(st), 'finished')
  st = reduce(st, { type: 'tick', now: 5_000_000 + 30 * 60_000 }).state
  assert.equal(mood(st), 'idle')
})

test('a finished session that starts working again is no longer unseen', () => {
  const { st } = run([snap([S('a', 'working')]), ses(S('a', 'done')), ses(S('a', 'working'))])
  assert.deepEqual(st.unseen, {})
  assert.equal(mood(st), 'working')
})

test('new paperclip item chirps once and waits only until the list is opened', () => {
  let { st, fx } = run([snap([], [PC('k1')]),
    { type: 'paperclip', data: { items: [PC('k1'), PC('k2')], stale: false } },
    { type: 'paperclip', data: { items: [PC('k1'), PC('k2', { whyNow: 'changed' })], stale: false } }])
  assert.deepEqual(fx, ['chirp'])
  assert.equal(mood(st), 'waiting')
  st = reduce(st, { type: 'listOpened', now: 0 }).state
  assert.equal(mood(st), 'idle')
  assert.equal(viewmodel(st).badges.paperclip, 2)
  assert.equal(viewmodel(st).badges.waiting, 0)
})

test('paperclip keys that leave the feed are forgotten', () => {
  const { st } = run([snap([], [PC('k1')]), { type: 'paperclip', data: { items: [], stale: false } }])
  assert.deepEqual(st.pcSeen, {})
  assert.deepEqual(st.pcAlerted, {})
})

test('resync after reconnect diffs against the state before the disconnect', () => {
  const { st, fx } = run([snap([S('a', 'working'), S('b', 'working'), S('c', 'blocked')]),
    { type: 'disconnected' },
    snap([S('a', 'done'), S('c', 'blocked')])])                        // a finished, b gone, c unchanged
  assert.deepEqual(fx, ['celebrate'])
  assert.deepEqual(Object.keys(st.sessions).sort(), ['a', 'c'])
  assert.ok(st.unseen.a)
})

test('offline: socket down, or relay up but cc-backend not ok', () => {
  let { st } = run([snap([S('a', 'working')])])
  assert.equal(mood(st), 'working')
  st = reduce(st, { type: 'status', data: { cc: 'error' }, now: 0 }).state
  assert.equal(mood(st), 'offline')
  st = reduce(st, { type: 'status', data: { cc: 'ok' }, now: 0 }).state
  st = reduce(st, { type: 'disconnected', now: 0 }).state
  assert.equal(mood(st), 'offline')
  assert.equal(mood(initialState()), 'offline')
})

test('local mode (no relay): never offline, idle when quiet, this machine\'s sessions drive the mood', () => {
  let { st } = run([ses(S('r', 'working')), { type: 'local' }])
  assert.equal(mood(st), 'idle')                                               // the relay's session is dropped
  assert.equal(viewmodel(st).connected, true)
  assert.equal(viewmodel(run([ses(S('a', 'working', { host: 'laptop' }))], st).st).rows[0].host, undefined)
  const r = run([ses(S('a', 'working', { host: 'laptop' })), ses(S('a', 'waiting', { host: 'laptop' }))], st)
  assert.equal(mood(r.st), 'waiting')
  assert.deepEqual(r.fx, ['chirp'])
})

test('mood priority: waiting > finished > working', () => {
  const { st } = run([snap([S('a', 'working'), S('b', 'working'), S('c', 'working')]), ses(S('b', 'done')), ses(S('c', 'waiting'))])
  assert.equal(mood(st), 'waiting')
  const vm = viewmodel(st)
  assert.deepEqual(vm.rows.map(r => r.group), ['waiting', 'finished', 'working'])
})

test('ended sessions are hidden from the list', () => {
  const { st } = run([snap([S('a', 'ended'), S('b', 'done')])])
  assert.deepEqual(viewmodel(st).rows.map(r => r.id), ['b'])
})

test('viewmodel stays under 5 KB with many rows', () => {
  const long = 'x'.repeat(120)
  const { st } = run([snap(Array.from({ length: 40 }, (_, i) => S(`s${i}`, 'working', { title: long.slice(0, 80), last: long })),
    Array.from({ length: 50 }, (_, i) => PC(`k${i}`, { title: long.slice(0, 80), whyNow: long })))])
  const vm = viewmodel(st)
  assert.ok(JSON.stringify(vm).length <= 5000, `${JSON.stringify(vm).length} bytes`)
  assert.ok(vm.more > 0 && vm.fast)
})

// Replay the newest recorded relay stream (private, gitignored; skipped when absent).
const fixtures = (() => { try { return readdirSync(new URL('../fixtures/', import.meta.url)).filter(f => /^stream-.*\.jsonl$/.test(f)).sort() } catch { return [] } })()
test('fixture replay', { skip: !fixtures.length && 'no recorded fixture' }, () => {
  const lines = readFileSync(new URL(`../fixtures/${fixtures.at(-1)}`, import.meta.url), 'utf8').trim().split('\n').map(l => JSON.parse(l))
  let st = initialState()
  const moods = new Set()
  lines.forEach((l, i) => {
    const r = reduce(st, { type: l.event, data: l.data, now: 1_800_000_000_000 + l.t })
    if (i === 0) assert.deepEqual(r.effects, [], 'launch snapshot must be silent')
    st = r.state
    const vm = viewmodel(st)
    assert.ok(JSON.stringify(vm).length <= 5000)
    moods.add(vm.mood)
  })
  assert.ok(st.seeded && st.connected)
  for (const m of moods) assert.ok(['offline', 'waiting', 'error', 'finished', 'working', 'idle'].includes(m))
})

test('paperclip null (relay just restarted) keeps the list; its return does not bark', () => {
  const { st, fx } = run([snap([], [PC('k1'), PC('k2')]),
    { type: 'disconnected' },
    { type: 'snapshot', data: { sessions: [], paperclip: null, status: OK } },
    { type: 'paperclip', data: { items: [PC('k1'), PC('k2')], stale: false } }])
  assert.deepEqual(fx, [])
  assert.equal(st.paperclip.items.length, 2)
  assert.equal(mood(st), 'idle')
})

test('first paperclip list arriving after launch seeds silently; the next new key chirps', () => {
  const { st, fx } = run([{ type: 'snapshot', data: { sessions: [], paperclip: null, status: OK } },
    { type: 'paperclip', data: { items: [PC('k1')], stale: false } },
    { type: 'paperclip', data: { items: [PC('k1'), PC('k9')], stale: false } }])
  assert.deepEqual(fx, ['chirp'])
  assert.equal(viewmodel(st).badges.waiting, 1)
})

test('nag: still waiting after 5 min chirps once more, once', () => {
  const t = 10_000_000
  let { st, fx } = run([snap([S('a', 'working')]), { ...ses(S('a', 'blocked')), now: t }])
  assert.deepEqual(fx, ['chirp'])
  const tick = ms => { const r = reduce(st, { type: 'tick', now: t + ms }); st = r.state; return r.effects.map(e => e.fx) }
  assert.deepEqual(tick(4 * 60_000), [])
  assert.deepEqual(tick(5 * 60_000), ['chirp'])
  assert.deepEqual(tick(9 * 60_000), [])
})

test('nag re-arms after leaving waiting; off with nagAfterMin 0', () => {
  const t = 10_000_000
  let { st } = run([snap([S('a', 'working')]), { ...ses(S('a', 'blocked')), now: t }])
  st = reduce(st, { type: 'tick', now: t + 6 * 60_000 }).state
  st = reduce(st, { ...ses(S('a', 'working')), now: t + 7 * 60_000 }).state
  st = reduce(st, { ...ses(S('a', 'blocked')), now: t + 8 * 60_000 }).state
  assert.deepEqual(reduce(st, { type: 'tick', now: t + 13 * 60_000 }).effects.map(e => e.fx), ['chirp'])
  let off = run([snap([S('a', 'working')]), { ...ses(S('a', 'blocked')), now: t }], initialState({ nagAfterMin: 0 })).st
  assert.deepEqual(reduce(off, { type: 'tick', now: t + 60 * 60_000 }).effects, [])
})

test('nag: an unseen new paperclip item nags once; a seen or seeded one never', () => {
  const t = 10_000_000
  let { st } = run([snap([], [PC('old')]), { type: 'paperclip', data: { items: [PC('old'), PC('new')], stale: false }, now: t }])
  assert.deepEqual(reduce(st, { type: 'tick', now: t + 5 * 60_000 }).effects.map(e => e.fx), ['chirp'])
  st = reduce(st, { type: 'listOpened', now: t + 60_000 }).state
  assert.deepEqual(reduce(st, { type: 'tick', now: t + 5 * 60_000 }).effects, [])
})

test('context: yawn once on crossing 80, again only after dropping under 60, silent on seed', () => {
  const { fx } = run([snap([S('a', 'working', { ctx: 85 }), S('b', 'working', { ctx: 40 })]),
    ses(S('a', 'working', { ctx: 90 })),
    ses(S('b', 'working', { ctx: 81 })), ses(S('b', 'working', { ctx: 79 })), ses(S('b', 'working', { ctx: 83 })),
    ses(S('b', 'working', { ctx: 12 })), ses(S('b', 'working', { ctx: 80 }))])
  assert.deepEqual(fx, ['yawn', 'yawn'])
})

test('viewmodel carries ctx and counts sessions over the line', () => {
  const { st } = run([snap([S('a', 'working', { ctx: 85 }), S('b', 'working', { ctx: 10 })])])
  const vm = viewmodel(st)
  assert.equal(vm.ctxHigh, 1)
  assert.deepEqual(vm.rows.map(r => r.ctx).sort(), [10, 85])
})

const LAP = (id, state) => ({ ...S(id, state), host: 'laptop' })

test('laptop sessions: chirp even before the relay ever connects, survive relay snapshots', () => {
  let { st, fx } = run([ses(LAP('L', 'working')), ses(LAP('L', 'blocked'))])
  assert.deepEqual(fx, ['chirp'])
  assert.equal(mood(st), 'waiting')                          // relay never connected, still waiting
  st = reduce(st, { ...snap([S('v', 'working')]), now: 2_000_000 }).state
  assert.ok(st.sessions.L && st.sessions.v)                  // the launch seed keeps laptop sessions
  st = reduce(st, { ...snap([]), now: 2_100_000 }).state
  assert.ok(st.sessions.L && !st.sessions.v)                 // a resync drops only VPS ones
})

test('relay down: a laptop session still drives the mood; VPS ones do not', () => {
  let { st } = run([snap([S('v', 'blocked')]), ses(LAP('L', 'working')), { type: 'disconnected' }])
  assert.equal(mood(st), 'offline')                          // the waiting VPS session is not trusted now
  st = reduce(st, { ...ses(LAP('L', 'blocked')), now: 5_000_000 }).state
  assert.equal(mood(st), 'waiting')
  assert.equal(viewmodel(st).rows.find(r => r.id === 'L').host, 'laptop')
})

const Q = (five, week, at, source) => ({ five: five == null ? null : { pct: five, resetsAt: 2_000_000_000 }, week: week == null ? null : { pct: week, resetsAt: 2_000_000_000 }, at, source })

test('quota: the newer reading wins, whichever machine sent it', () => {
  let { st } = run([snap([])])
  st = reduce(st, { type: 'quota', data: Q(40, 10, 100, 'vps'), now: 1 }).state
  st = reduce(st, { type: 'quota', data: Q(55, 11, 90, 'laptop'), now: 1 }).state      // older: ignored
  assert.equal(st.quota.five.pct, 40)
  st = reduce(st, { type: 'quota', data: Q(60, 12, 120, 'laptop'), now: 1 }).state
  assert.equal(st.quota.source, 'laptop')
  assert.equal(mergeQuota(st.quota, { five: null, week: null, at: 999 }), st.quota)     // empty: kept
  st = reduce(st, { ...snap([]), data: { sessions: [], status: OK, quota: Q(70, 13, 130) }, now: 1 }).state
  assert.equal(st.quota.five.pct, 70)
  assert.equal(st.quota.source, 'vps')
})

test('quota view: levels, a rolled-over window reads 0, stale after 30 min', () => {
  const now = 1_800_000_000_000
  const at = now / 1000
  assert.equal(quotaView(Q(62, 18, at), now).level, 'calm')
  assert.equal(quotaView(Q(40, 81, at), now).level, 'warn')                            // the fuller window decides
  assert.equal(quotaView(Q(96, 10, at), now).level, 'high')
  const rolled = quotaView({ five: { pct: 99, resetsAt: at - 60 }, week: { pct: 20, resetsAt: at + 3600 }, at: at - 600 }, now)
  assert.deepEqual(rolled.five, { pct: 0, resetAt: null })
  assert.equal(rolled.week.resetAt, (at + 3600) * 1000)
  assert.equal(rolled.level, 'calm')
  assert.equal(quotaView(Q(10, 10, at - 31 * 60), now).stale, true)
  assert.equal(quotaView(Q(10, 10, at - 5 * 60), now).stale, false)
  assert.equal(quotaView(null, now), null)
  assert.deepEqual(quotaView(Q(null, 2, at), now).five, null)
})

test('effects carry what they are about: chirp and celebrate name the session or item', () => {
  let r = run([snap([S('a', 'working')]), ses(S('a', 'blocked'))])
  const st0 = r.st
  const e = reduce(st0, { ...ses(S('b', 'waiting')), now: 9_000_000 }).effects[0]
  assert.deepEqual(e, { fx: 'chirp', id: 'b', kind: 'cc' })
  const c = reduce(st0, { ...ses(S('a', 'done')), now: 9_000_000 }).effects.find(x => x.fx === 'celebrate')
  assert.equal(c.id, 'a')
  const p = reduce(run([snap([], [PC('k1')])]).st, { type: 'paperclip', data: { items: [PC('k1'), PC('k2')], stale: false }, now: 9_000_000 }).effects[0]
  assert.deepEqual(p, { fx: 'chirp', id: 'k2', kind: 'pc' })
})

test('error: below waiting, above finished; silent; cleared when seen or the session moves on', () => {
  let { st, fx } = run([snap([S('a', 'working'), S('b', 'working')]), ses(S('a', 'error')), ses(S('b', 'done'))])
  assert.deepEqual(fx, ['celebrate'])                                 // the error itself makes no sound
  assert.equal(mood(st), 'error')
  assert.equal(viewmodel(st).badges.error, 1)
  assert.deepEqual(viewmodel(st).rows.map(r => r.group), ['error', 'finished'])
  assert.equal(mood(reduce(st, { ...ses(S('c', 'blocked')), now: 9e6 }).state), 'waiting')
  st = reduce(st, { type: 'listOpened', now: 9e6 }).state                // seen (or petted)
  assert.equal(mood(st), 'idle')
  assert.equal(viewmodel(st).rows[0].group, 'error')                  // the row still says so
  ;({ st } = run([snap([S('a', 'working')]), ses(S('a', 'error')), ses(S('a', 'working'))]))
  assert.deepEqual(st.errors, {})
})

test('pups: active subagents of working sessions, capped at 3', () => {
  const { st } = run([snap([S('a', 'working', { agentsActive: 2 }), S('b', 'working', { agentsActive: 4 }), S('c', 'done', { agentsActive: 5 })])])
  assert.equal(viewmodel(st).pups, 3)
  assert.equal(viewmodel(run([snap([S('a', 'working', { agentsActive: 1 })])]).st).pups, 1)
})

test('quota pace: rising readings give a time the window fills; flat, short, falling or after reset give none', async () => {
  const { addPace, PACE } = await import('../src/shared/reducer.js')
  const { paceHit } = await import('../src/shared/viewmodel.js')
  const reset = 1_000_000 + 4 * 3600                             // epoch s
  const read = (at, pct, resetsAt = reset) => ({ at, five: { pct, resetsAt }, week: null })
  let h = { five: [], week: [] }
  for (const [t, p] of [[0, 20], [300, 25], [600, 30], [900, 35]]) h = addPace(h, read(1_000_000 + t, p))
  assert.equal(h.five.length, 4)
  // 15 points in 900 s → 1/60 % per s; 65 % to go → 3900 s after the last reading
  const now = (1_000_000 + 900) * 1000
  assert.equal(paceHit(h.five, reset * 1000, now), (1_000_000 + 900 + 3900) * 1000)
  assert.equal(paceHit(h.five, (1_000_000 + 1000) * 1000, now), null, 'resets before it would fill')
  assert.equal(paceHit(h.five.slice(0, 2), reset * 1000, now), null, 'under 10 minutes of readings')
  assert.equal(paceHit([[0, 40, null], [1000, 40, null]], null, 0), null, 'flat')
  assert.equal(paceHit([[0, 40, null], [1000, 30, null]], null, 0), null, 'falling')
  // a reading 3 s after the last replaces it; a new reset time starts over; an hour is kept at most
  h = addPace(h, read(1_000_000 + 903, 36))
  assert.equal(h.five.length, 4)
  assert.equal(h.five.at(-1)[1], 36)
  assert.equal(addPace(h, read(1_000_000 + 1200, 2, reset + 18000)).five.length, 1)
  assert.equal(addPace(h, read(1_000_000 + 903 + PACE.keepS + 1, 50)).five.length, 1)
})

test('quota pace: the reducer keeps the history and the view model shows only the time', () => {
  let st = initialState()
  const reset = 2_000_000 + 3 * 3600
  for (const [t, p] of [[0, 50], [400, 55], [800, 60]]) st = reduce(st, { type: 'quota', data: { at: 2_000_000 + t, five: { pct: p, resetsAt: reset }, week: null, source: 'laptop' }, now: 0 }).state
  const q = viewmodel(st, (2_000_000 + 800) * 1000).quota
  assert.ok(q.five.hitAt > (2_000_000 + 800) * 1000)
  assert.equal('quotaHist' in viewmodel(st), false, 'history stays out of the view model')
})
