// Add (or remove) Deskling's hooks in this machine's Claude Code settings (~/.claude/settings.json),
// every hook of ours carries X-Deskling-Mark, a run
// first drops all marked hooks, then adds the current block; other hooks are untouched. The file is
// backed up once and replaced atomically. Claude Code reads hooks at session start, so only
// sessions opened afterwards report. No electron import.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const MARK = 'deskling-v1'
export const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'SubagentStart', 'SubagentStop',
  'Stop', 'StopFailure', 'Notification', 'PermissionRequest', 'SessionEnd']

// cc-dog (this app's earlier name) marked its hooks X-CcDog-Mark: those count as ours, so they get replaced.
const ours = h => (h.headers || {})['X-Deskling-Mark'] === MARK || (h.headers || {})['X-CcDog-Mark'] === 'cc-dog-v1'

function read(file) {
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, 'utf8'))       // a broken settings.json throws: never overwrite it
}

function write(file, d) {
  mkdirSync(dirname(file), { recursive: true })
  if (existsSync(file) && !existsSync(file + '.deskling-backup')) copyFileSync(file, file + '.deskling-backup')
  writeFileSync(file + '.tmp', JSON.stringify(d, null, 2) + '\n')
  renameSync(file + '.tmp', file)
}

function strip(d) {
  const hooks = d.hooks || {}
  for (const ev of Object.keys(hooks)) {
    const kept = (hooks[ev] || []).map(e => ({ ...e, hooks: (e.hooks || []).filter(h => !ours(h)) })).filter(e => e.hooks.length)
    if (kept.length) hooks[ev] = kept
    else delete hooks[ev]
  }
  if (d.hooks && !Object.keys(d.hooks).length) delete d.hooks
  return d
}

export function installHooks(file, { url, token }) {
  const d = strip(read(file))
  d.hooks ??= {}
  for (const ev of EVENTS) {
    (d.hooks[ev] ??= []).push({ hooks: [{ type: 'http', url, timeout: 5, headers: { 'X-Deskling-Token': token, 'X-Deskling-Mark': MARK } }] })
  }
  write(file, d)
}

export function removeHooks(file) {
  if (!existsSync(file)) return
  write(file, strip(read(file)))
}

export function hooksInstalled(file, url) {
  try {
    const hooks = read(file).hooks || {}
    return EVENTS.every(ev => (hooks[ev] || []).some(e => (e.hooks || []).some(h => (h.headers || {})['X-Deskling-Mark'] === MARK && h.url === url)))
  } catch { return false }
}
