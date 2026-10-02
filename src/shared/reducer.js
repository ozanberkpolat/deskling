// Pure reducer: reduce(state, action) → {state, effects}. No Node/Electron/DOM APIs.
// State is plain objects and arrays (no Set/Map) so it survives IPC and JSON.
//
// Actions (all carry `now`, epoch ms):
//   {type:'snapshot', data:{sessions, paperclip, status}}   relay (re)connect
//   {type:'session', data:slim}  {type:'gone', data:{id}}
//     (a slim with host:'laptop' comes from this machine's own Claude Code hooks, not the relay)
//   {type:'paperclip', data:{items, stale}}  {type:'status', data:{cc, paperclip}}
//   {type:'quota', data:{five, week, at, source}}   plan quota (relay = VPS statusline; laptop = limits.json)
//   {type:'local'}   no relay configured: this machine is the whole picture, never offline
//   {type:'disconnected'}  {type:'listOpened'}  {type:'tick'}
// Effects: {fx:'chirp', id, kind} (something new waits, or still waits after nagAfterMin),
//          {fx:'celebrate', id} (a session finished), {fx:'yawn'} (a session's context crossed 80%).
//          `id`/`kind` ('cc' session or 'pc' Paperclip key) let main name it in a notification.

export const WAITING = ['blocked', 'waiting']
export const CHIRP_DEBOUNCE_MS = 4000
export const CTX_WARN = 80, CTX_REARM = 60          // same thresholds as cc-backend's context push

export function initialState({ finishedTtlMin = 30, nagAfterMin = 5 } = {}) {
  return {
    connected: false,     // relay socket up
    seeded: false,        // first snapshot after launch applied
    status: { cc: 'connecting', paperclip: 'off' },
    sessions: {},         // id → slim
    paperclip: { items: [], stale: false },
    alerted: {},          // session id → ms it entered waiting (chirped or seeded)
    nagged: {},           // session id → true once re-chirped for this wait
    unseen: {},           // session id → ms it finished; cleared by listOpened or ttl
    errors: {},           // session id → ms its turn ended on an error; cleared when seen or it moves on
    pcSeen: {},           // paperclip key → true once the list was opened (or seeded)
    pcAlerted: {},        // paperclip key → ms chirped, or true when seeded (seeded never nags)
    pcNagged: {},         // paperclip key → true once re-chirped
    ctxWarned: {},        // session id → true after its context crossed CTX_WARN, until CTX_REARM
    pcSeeded: false,      // first real paperclip list applied (the relay sends null until it has one)
    quota: null,          // {five: {pct, resetsAt} | null, week: …, at (epoch s), source}: freshest wins
    quotaHist: { five: [], week: [] },   // recent [at, pct, resetsAt] per window, for the pace (viewmodel)
    lastChirp: 0,
    finishedTtlMs: finishedTtlMin * 60_000,
    nagAfterMs: nagAfterMin * 60_000,               // 0 = never re-chirp
  }
}

const isWaiting = s => WAITING.includes(s?.state)
const isLocal = s => s?.host === 'laptop'

export function reduce(state, action) {
  const st = { ...state }
  const fx = []
  const now = action.now ?? Date.now()
  const chirp = (id, kind) => {
    if (now - st.lastChirp >= CHIRP_DEBOUNCE_MS) { fx.push({ fx: 'chirp', id, kind }); st.lastChirp = now }
  }

  // One session moving from `prev` to `next`. `silent` = launch seeding: record, never alert.
  function applySession(next, silent) {
    const prev = st.sessions[next.id]
    st.sessions = { ...st.sessions, [next.id]: next }
    if (isWaiting(next)) {
      if (!st.alerted[next.id]) {
        st.alerted = { ...st.alerted, [next.id]: now }
        if (!silent) chirp(next.id, 'cc')
      }
    } else if (st.alerted[next.id]) {
      st.alerted = without(st.alerted, next.id)          // re-arm, even if its chirp was debounced
      st.nagged = without(st.nagged, next.id)
    }
    if (next.ctx >= CTX_WARN && !st.ctxWarned[next.id]) {
      st.ctxWarned = { ...st.ctxWarned, [next.id]: true }
      if (!silent) fx.push({ fx: 'yawn' })
    } else if (next.ctx != null && next.ctx < CTX_REARM && st.ctxWarned[next.id]) {
      st.ctxWarned = without(st.ctxWarned, next.id)
    }
    if (next.state === 'done') {
      if (!silent && prev && prev.state !== 'done' && !st.unseen[next.id]) {
        st.unseen = { ...st.unseen, [next.id]: now }
        fx.push({ fx: 'celebrate', id: next.id })
      }
    } else if (st.unseen[next.id]) {
      st.unseen = without(st.unseen, next.id)
    }
    // an error is attention, not an alarm: no sound, counts until seen or the session moves on
    if (next.state === 'error') {
      if (prev?.state !== 'error' && !st.errors[next.id]) st.errors = { ...st.errors, [next.id]: now }
    } else if (st.errors[next.id]) {
      st.errors = without(st.errors, next.id)
    }
  }

  function applyGone(id) {
    st.sessions = without(st.sessions, id)
    st.alerted = without(st.alerted, id)
    st.nagged = without(st.nagged, id)
    st.unseen = without(st.unseen, id)
    st.errors = without(st.errors, id)
    st.ctxWarned = without(st.ctxWarned, id)
  }

  function applyPaperclip(pc, silent) {
    if (!pc) return                                  // relay doesn't know yet: keep what we have
    st.paperclip = { items: pc.items || [], stale: !!pc.stale }
    const keys = st.paperclip.items.map(i => i.key)
    if (silent || !st.pcSeeded) {                    // the first list ever is old news, not news
      st.pcSeeded = true
      st.pcSeen = { ...st.pcSeen, ...flags(keys) }
      st.pcAlerted = { ...st.pcAlerted, ...flags(keys) }
      return
    }
    const fresh = keys.filter(k => !st.pcAlerted[k])
    if (fresh.length) { st.pcAlerted = { ...st.pcAlerted, ...Object.fromEntries(fresh.map(k => [k, now])) }; chirp(fresh[0], 'pc') }
    // Forget keys that left the feed, so the sets don't grow forever.
    st.pcSeen = pick(st.pcSeen, keys)
    st.pcAlerted = pick(st.pcAlerted, keys)
    st.pcNagged = pick(st.pcNagged, keys)
  }

  // the newest reading wins; each accepted reading also goes into the pace history
  function setQuota(q) {
    const next = mergeQuota(st.quota, q)
    if (next !== st.quota) st.quotaHist = addPace(st.quotaHist, next)
    st.quota = next
  }

  switch (action.type) {
    case 'snapshot': {
      const d = action.data || {}
      const silent = !st.seeded
      st.connected = true
      st.local = false
      st.status = { ...st.status, ...d.status }
      // the relay knows only VPS sessions: laptop ones are never diffed away by its snapshot
      const ids = new Set((d.sessions || []).map(s => s.id))
      if (silent) st.sessions = Object.fromEntries(Object.entries(st.sessions).filter(([, s]) => isLocal(s)))
      else for (const [id, s] of Object.entries(st.sessions)) if (!isLocal(s) && !ids.has(id)) applyGone(id)
      for (const s of d.sessions || []) applySession(s, silent)
      applyPaperclip(d.paperclip, silent)
      setQuota(d.quota && { ...d.quota, source: 'vps' })
      st.seeded = true
      break
    }
    case 'session': applySession(action.data, !st.seeded && !isLocal(action.data)); break
    case 'gone': applyGone(action.data.id); break
    case 'paperclip': applyPaperclip(action.data, !st.seeded); break
    case 'status': st.status = { ...st.status, ...action.data }; break
    case 'quota': setQuota(action.data && { source: 'vps', ...action.data }); break
    case 'local':
      st.local = true
      st.connected = true
      st.seeded = true
      st.status = { cc: 'ok', paperclip: 'off' }
      st.sessions = Object.fromEntries(Object.entries(st.sessions).filter(([, s]) => isLocal(s)))
      st.paperclip = { items: [], stale: false }
      break
    case 'disconnected': st.connected = false; st.local = false; break
    case 'listOpened':                                  // also "petted": everything counts as seen
      st.unseen = {}
      st.errors = {}
      st.pcSeen = { ...st.pcSeen, ...flags(st.paperclip.items.map(i => i.key)) }
      break
    case 'tick': {
      for (const [id, at] of Object.entries(st.unseen)) if (now - at >= st.finishedTtlMs) st.unseen = without(st.unseen, id)
      if (!st.nagAfterMs) break
      // Still waiting after nagAfterMs: one more chirp per wait (one chirp covers all that are due).
      const due = at => typeof at === 'number' && now - at >= st.nagAfterMs
      const cc = Object.keys(st.alerted).filter(id => isWaiting(st.sessions[id]) && !st.nagged[id] && due(st.alerted[id]))
      const pc = Object.keys(st.pcAlerted).filter(k => !st.pcSeen[k] && !st.pcNagged[k] && due(st.pcAlerted[k]))
      if (cc.length || pc.length) {
        st.nagged = { ...st.nagged, ...flags(cc) }
        st.pcNagged = { ...st.pcNagged, ...flags(pc) }
        chirp(cc[0] ?? pc[0], cc.length ? 'cc' : 'pc')
      }
      break
    }
  }
  return { state: st, effects: fx }
}

// offline > waiting > error > finished > working > idle. With the relay down only laptop sessions count,
// and a laptop session waiting for you still beats offline: the dog can see it without the relay.
export function mood(st) {
  const offline = !st.connected || st.status.cc !== 'ok'
  const live = Object.values(st.sessions).filter(s => !offline || isLocal(s))
  if (offline && !live.some(isWaiting)) return 'offline'
  if (live.some(isWaiting) || (!offline && st.paperclip.items.some(i => !st.pcSeen[i.key]))) return 'waiting'
  if (live.some(s => st.errors[s.id])) return 'error'
  if (live.some(s => st.unseen[s.id])) return 'finished'
  if (live.some(s => s.state === 'working')) return 'working'
  return 'idle'
}

// One account, two machines reporting it: keep whichever reading is newer.
// Pace history: an hour of readings per window, at most 20, a reading within 5 s of the last one
// replaces it, and a new reset time (the window rolled over) starts afresh.
export const PACE = { keepS: 3600, maxPoints: 20, minSpanS: 600 }
export function addPace(hist = { five: [], week: [] }, q) {
  const out = { ...hist }
  for (const w of ['five', 'week']) {
    const win = q?.[w]
    if (!win || typeof q.at !== 'number') continue
    let pts = out[w] || []
    if (pts.length && pts.at(-1)[2] !== (win.resetsAt ?? null)) pts = []
    if (pts.length && Math.abs(pts.at(-1)[0] - q.at) < 5) pts = pts.slice(0, -1)
    out[w] = [...pts, [q.at, win.pct, win.resetsAt ?? null]].filter(p => q.at - p[0] <= PACE.keepS).slice(-PACE.maxPoints)
  }
  return out
}

export function mergeQuota(prev, next) {
  if (!next || !(next.five || next.week)) return prev
  return !prev || (next.at || 0) >= (prev.at || 0) ? next : prev
}

function without(o, k) {
  if (!(k in o)) return o
  const c = { ...o }; delete c[k]; return c
}
const flags = keys => Object.fromEntries(keys.map(k => [k, true]))
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k]).map(k => [k, o[k]]))
