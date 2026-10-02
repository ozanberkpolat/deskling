// Add (or remove) Deskling's wrapper around Claude Code's status line ("statusLine" in
// ~/.claude/settings.json). Claude Code pipes a JSON payload into that command on every refresh:
// the plan quota (rate_limits), the session's running cost and its context use. The wrapper saves
// the payload to ~/.claude/limits.json (the quota ring), hands it to Deskling over the loopback hook
// port, then feeds it unchanged to the user's own status line command, so their line looks the same.
// Their original statusLine object is kept beside our config and put back on removal. Claude Code
// runs the command with bash (Git Bash on Windows). No electron import.
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { readSettings, writeSettings } from './claude-hooks.js'

export const SL_MARK = 'deskling-statusline v1'
const OBPTERM = 'obpterm-statusline'                // OBPTerm's own writer: it already saves limits.json

export function wrapperCommand({ port, token, original }) {
  const lines = [
    `IFS= read -rd '' p; printf '%s' "$p" > "$HOME/.claude/limits.json"`,
    `printf '%s' "$p" | curl -s -m 1 -o /dev/null -H 'X-Deskling-Token: ${token}' --data-binary @- http://127.0.0.1:${port}/statusline &`,
  ]
  // the original on its own lines, so a trailing "# comment" in it cannot swallow the closing brace;
  // <<< hands it the payload plus one newline (cheaper than a pipe in Git Bash, harmless to JSON readers)
  if (original) lines.push('{', original, `} <<<"$p"; : # ${SL_MARK}`)
  else lines.push(`: # ${SL_MARK}`)
  return lines.join('\n')
}

// 'ours' | 'obpterm' | 'other' | 'none' (or 'broken' when settings.json does not parse)
export function statuslineState(file) {
  let d
  try { d = readSettings(file) } catch { return 'broken' }
  const cmd = d.statusLine?.command
  if (typeof cmd !== 'string' || !cmd.trim()) return 'none'
  if (cmd.includes(SL_MARK)) return 'ours'
  if (cmd.includes(OBPTERM)) return 'obpterm'
  return 'other'
}

// Returns what it did: 'installed' | 'refreshed' | 'unchanged' | 'obpterm' (left alone). Throws on a broken file.
export function installStatusline(file, { port, token, saveTo }) {
  const d = readSettings(file)
  const cur = d.statusLine
  const mine = typeof cur?.command === 'string' && cur.command.includes(SL_MARK)
  if (!mine && typeof cur?.command === 'string' && cur.command.includes(OBPTERM)) return 'obpterm'
  // the user's own status line: saved once, before we wrap it (a re-install wraps the saved one again)
  let original = null
  if (mine) { try { original = JSON.parse(readFileSync(saveTo, 'utf8')) } catch { original = null } }
  else {
    original = cur && typeof cur === 'object' ? cur : null
    writeFileSync(saveTo + '.tmp', JSON.stringify(original) + '\n')
    renameSync(saveTo + '.tmp', saveTo)
  }
  const base = original && typeof original === 'object' ? original : {}
  const command = wrapperCommand({ port, token, original: typeof base.command === 'string' ? base.command : null })
  if (mine && cur.command === command) return 'unchanged'          // every start checks; only a new port or token rewrites
  d.statusLine = { ...base, type: 'command', command,
    refreshInterval: base.refreshInterval ?? 30 }   // keeps the quota fresh while nothing happens
  writeSettings(file, d)
  return mine ? 'refreshed' : 'installed'
}

// Puts the user's own status line back (or none, if they had none). Only touches ours.
export function removeStatusline(file, { saveTo }) {
  if (!existsSync(file)) return false
  const d = readSettings(file)
  if (!(typeof d.statusLine?.command === 'string' && d.statusLine.command.includes(SL_MARK))) return false
  let original = null
  try { original = JSON.parse(readFileSync(saveTo, 'utf8')) } catch {}
  if (original && typeof original === 'object') d.statusLine = original
  else delete d.statusLine
  writeSettings(file, d)
  rmSync(saveTo, { force: true })
  return true
}

// One status line payload → what a session row and the quota ring need. Pure.
export function readStatusline(p) {
  const cost = p?.cost?.total_cost_usd
  const pct = p?.context_window?.used_percentage
  return {
    session: typeof p?.session_id === 'string' ? p.session_id : null,
    cost: typeof cost === 'number' && Number.isFinite(cost) ? Math.round(cost * 100) / 100 : null,
    ctx: typeof pct === 'number' && Number.isFinite(pct) ? Math.round(pct) : null,
  }
}
