// This machine's reading of the plan quota: a Claude Code statusLine command that saves its stdin to
// ~/.claude/limits.json (README: "Quota ring"). Parsed as:
// a `rate_limits` wrapper or the bare object, `seven_day` or `weekly`. No electron import.
import { readFileSync, statSync } from 'node:fs'

const epoch = v => typeof v === 'number' ? (v > 1e12 ? v / 1000 : v)
  : typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? Date.parse(v) / 1000 : null

export function parseLimits(text, mtimeMs) {
  let d
  try { d = JSON.parse(text) } catch { return null }
  if (!d || typeof d !== 'object') return null
  const rl = d.rate_limits && typeof d.rate_limits === 'object' ? d.rate_limits : d
  const win = w => w && typeof w.used_percentage === 'number' ? { pct: w.used_percentage, resetsAt: epoch(w.resets_at) } : null
  const five = win(rl.five_hour), week = win(rl.seven_day || rl.weekly)
  if (!five && !week) return null
  const at = epoch(d.ts) ?? mtimeMs / 1000
  return { five, week, at, source: 'laptop' }
}

// Re-read every 15 s when the file changed. A missing or unreadable file is logged once, not spammed.
export function watchLimits({ file, onQuota, log, everyMs = 15_000 }) {
  let lastMtime = 0, complained = false
  const tick = () => {
    let st
    try { st = statSync(file) } catch {
      if (!complained) { log(`quota: ${file} not found (see the README's quota section); no quota ring until it appears`); complained = true }
      return
    }
    if (st.mtimeMs === lastMtime) return
    lastMtime = st.mtimeMs
    let q = null
    try { q = parseLimits(readFileSync(file, 'utf8'), st.mtimeMs) } catch {}
    if (q) { complained = false; onQuota(q) }
    else if (!complained) { log(`quota: no rate_limits in ${file}`); complained = true }
  }
  tick()
  const t = setInterval(tick, everyMs)
  return { stop: () => clearInterval(t) }
}
