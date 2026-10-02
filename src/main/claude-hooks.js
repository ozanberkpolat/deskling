// Add (or remove) Deskling's hooks in Claude Code's settings (~/.claude/settings.json): this
// machine's file, and (wsl.js) the same file inside a WSL distro. Every hook of ours carries
// Deskling's mark (an X-Deskling-Mark header, or the mark in a WSL command hook's command); a run
// first drops all marked hooks, then adds the current block; other hooks are untouched. A file is
// backed up once and replaced atomically, and never written when it does not parse. Claude Code reads
// hooks at session start, so only sessions opened afterwards report. No electron import.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// v2: PermissionRequest waits up to 120 s, so the list can answer it. A v1 install is replaced on start.
export const MARK = 'deskling-v2'
export const WSL_MARK = 'deskling-wsl v1'               // inside the command of a WSL hook (wsl.js)
export const TIMEOUT = { PermissionRequest: 120 }        // seconds; every other event: 5
export const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'SubagentStart', 'SubagentStop',
  'Stop', 'StopFailure', 'Notification', 'PermissionRequest', 'SessionEnd']

// Earlier marks count as ours, so they get replaced: deskling-v1, and cc-dog (this app's earlier name).
export const ours = h => ['deskling-v1', MARK].includes((h.headers || {})['X-Deskling-Mark'])
  || (h.headers || {})['X-CcDog-Mark'] === 'cc-dog-v1'
  || (typeof h.command === 'string' && h.command.includes(WSL_MARK))

export function parseSettings(text) {
  return text && text.trim() ? JSON.parse(text) : {}   // a broken settings.json throws: never overwrite it
}

export function readSettings(file) {
  if (!existsSync(file)) return {}
  return parseSettings(readFileSync(file, 'utf8'))
}

export function writeSettings(file, d) {
  mkdirSync(dirname(file), { recursive: true })
  if (existsSync(file) && !existsSync(file + '.deskling-backup')) copyFileSync(file, file + '.deskling-backup')
  writeFileSync(file + '.tmp', JSON.stringify(d, null, 2) + '\n')
  renameSync(file + '.tmp', file)
}

// ── on the settings object (pure) ──
export function withoutHooks(d) {
  const hooks = d.hooks || {}
  for (const ev of Object.keys(hooks)) {
    const kept = (hooks[ev] || []).map(e => ({ ...e, hooks: (e.hooks || []).filter(h => !ours(h)) })).filter(e => e.hooks.length)
    if (kept.length) hooks[ev] = kept
    else delete hooks[ev]
  }
  if (d.hooks && !Object.keys(d.hooks).length) delete d.hooks
  return d
}

// hook(ev) → the one hook object for that event
export function withHooks(d, hook) {
  d = withoutHooks(d)
  d.hooks ??= {}
  for (const ev of EVENTS) (d.hooks[ev] ??= []).push({ hooks: [hook(ev)] })
  return d
}

// true when every event already has exactly the hook `hook(ev)` would add
export function hasHooks(d, hook) {
  const hooks = d?.hooks || {}
  return EVENTS.every(ev => (hooks[ev] || []).some(e => (e.hooks || []).some(h => JSON.stringify(h) === JSON.stringify(hook(ev)))))
}

// ── this machine: http hooks to the loopback receiver ──
// X-Term tells a VS Code terminal from the rest when the list jumps to a session ("Show terminal")
export const httpHook = ({ url, token }) => ev => ({ type: 'http', url, timeout: TIMEOUT[ev] || 5,
  headers: { 'X-Deskling-Token': token, 'X-Deskling-Mark': MARK, 'X-Term': '$TERM_PROGRAM' }, allowedEnvVars: ['TERM_PROGRAM'] })

export function installHooks(file, { url, token }) {
  writeSettings(file, withHooks(readSettings(file), httpHook({ url, token })))
}

export function removeHooks(file) {
  if (!existsSync(file)) return
  writeSettings(file, withoutHooks(readSettings(file)))
}

export function hooksInstalled(file, url) {
  try {
    const hooks = readSettings(file).hooks || {}
    return EVENTS.every(ev => (hooks[ev] || []).some(e => (e.hooks || []).some(h => (h.headers || {})['X-Deskling-Mark'] === MARK && h.url === url)))
  } catch { return false }
}
