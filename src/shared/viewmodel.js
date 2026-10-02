// View model: the only thing the renderer gets. Small (≤5 KB), plain JSON. Pure.
import { CTX_WARN, WAITING, PACE, mood } from './reducer.js'

export const QUOTA_WARN = 80, QUOTA_HIGH = 95, QUOTA_STALE_MIN = 30

// The arc's numbers. A window whose reset time has passed reads 0: it rolled over and no newer
// reading has come in yet. The level follows the fuller of the two windows.
// When the window fills up at the pace of its readings (ms), or null: needs 10+ minutes of rising
// readings, and the limit has to come before the window resets.
export function paceHit(pts, resetAt, now = Date.now()) {
  if (!pts || pts.length < 2) return null
  const [a, b] = [pts[0], pts.at(-1)]
  if (b[0] - a[0] < PACE.minSpanS || b[1] >= 100) return null
  const rate = (b[1] - a[1]) / (b[0] - a[0])                // percent per second
  if (rate <= 0) return null
  const hit = (b[0] + (100 - b[1]) / rate) * 1000
  return hit <= now || (resetAt && hit >= resetAt) ? null : Math.round(hit)
}

export function quotaView(q, now = Date.now(), hist = null) {
  if (!q) return null
  const win = (w, pts) => {
    if (!w) return null
    const reset = w.resetsAt ? w.resetsAt * 1000 : null
    if (reset && reset <= now) return { pct: 0, resetAt: null }
    const hitAt = paceHit(pts, reset, now)
    return { pct: Math.round(w.pct), resetAt: reset, ...(hitAt ? { hitAt } : {}) }
  }
  const five = win(q.five, hist?.five), week = win(q.week, hist?.week)
  const top = Math.max(five?.pct ?? 0, week?.pct ?? 0)
  const ageMin = Math.max(0, Math.round((now - (q.at || 0) * 1000) / 60_000))
  return { five, week, level: top >= QUOTA_HIGH ? 'high' : top >= QUOTA_WARN ? 'warn' : 'calm',
           ageMin, stale: ageMin > QUOTA_STALE_MIN, source: q.source }
}

export const MAX_ROWS = 12
const GROUP = { waiting: 0, error: 1, finished: 2, working: 3, idle: 4 }
export const MAX_PUPS = 3

export function viewmodel(st, now = Date.now()) {
  const rows = []
  const live = Object.values(st.sessions).filter(s => s.state !== 'ended')
  for (const s of live) {
    const group = WAITING.includes(s.state) ? 'waiting'
      : s.state === 'error' ? 'error'
      : st.unseen[s.id] ? 'finished'
        : s.state === 'working' ? 'working' : 'idle'
    rows.push({ k: 'cc', id: s.id, group, project: s.project, title: s.title, state: s.state,
                at: Math.round((s.since || 0) * 1000), detail: s.last, agents: s.agentsActive || 0, ctx: s.ctx ?? null,
                // what a click does: this PC's terminal (once its process is known), or the relay's web terminal
                open: s.host === 'laptop' ? (s.canShow ? 'terminal' : null) : (s.tmux ? 'web' : null),
                ...(s.ask ? { ask: s.ask } : {}), ...(s.wsl ? { wsl: s.wsl } : {}), ...(typeof s.cost === 'number' ? { cost: s.cost } : {}),
                ...(s.host && !st.local ? { host: s.host } : {}) })   // no relay: every row is this machine's, no chip
  }
  for (const i of st.paperclip.items) {
    rows.push({ k: 'pc', id: i.key, group: 'waiting', project: i.company,
                title: [i.id, i.title].filter(Boolean).join(' '), state: i.kind,
                at: Date.parse(i.at) || 0, detail: i.whyNow, url: i.url, fresh: !st.pcSeen[i.key] })
  }
  // waiting: oldest first (longest wait on top); the rest: most recent first
  rows.sort((a, b) => GROUP[a.group] - GROUP[b.group] || (a.group === 'waiting' ? a.at - b.at : b.at - a.at))

  const count = g => rows.filter(r => r.group === g && r.k === 'cc').length
  const working = live.filter(s => s.state === 'working').length
  return {
    mood: mood(st),
    fast: working >= 3,
    connected: st.connected,
    // subagents running right now, one pup each beside the box (capped)
    pups: Math.min(MAX_PUPS, live.filter(s => s.state === 'working').reduce((n, s) => n + (s.agentsActive || 0), 0)),
    ctxHigh: live.filter(s => s.ctx >= CTX_WARN).length,
    status: { ...st.status, stale: st.paperclip.stale },
    badges: {
      waiting: count('waiting') + st.paperclip.items.filter(i => !st.pcSeen[i.key]).length,
      error: live.filter(s => st.errors[s.id]).length,
      finished: count('finished'),
      working,
      paperclip: st.paperclip.items.length,
    },
    quota: quotaView(st.quota, now, st.quotaHist),
    rows: rows.slice(0, MAX_ROWS),
    more: Math.max(0, rows.length - MAX_ROWS),
  }
}

// "now", "4m", "2h", "3d". Pure, shared by the list and the tooltip.
export function ago(ms, now = Date.now()) {
  const s = Math.max(0, (now - ms) / 1000)
  if (s < 45) return 'now'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
