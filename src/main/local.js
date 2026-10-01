// Claude Code sessions running on THIS machine (the laptop), from its own hooks. Turns each hook
// payload into the same slim session the relay sends, tagged host:'laptop'. Mirrors cc-backend's
// normalize() (cc/backend/main.py), minus the agent tree. No electron import.

export const DECAY_MS = 20 * 60_000        // a working session with no event for this long lost its Stop
const GONE_ENDED_MS = 10 * 60_000, GONE_SILENT_MS = 12 * 3_600_000

const cut = (s, n) => {
  s = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''
  return s ? (s.length > n ? s.slice(0, n - 1) + '…' : s) : null
}

export function summarize(inp = {}) {
  for (const k of ['command', 'description', 'file_path', 'pattern', 'url', 'query', 'prompt', 'skill']) {
    if (typeof inp[k] === 'string' && inp[k]) return inp[k]
  }
  return ''
}

export function createLocal({ onSession, onGone, now = Date.now }) {
  const S = new Map()       // id → { slim, updated, turnStarted, agents:Set }

  // title = the first typed (non-slash) prompt, else the folder name
  function slimOf(r) { return { ...r.slim, title: r.title || r.slim.project, agentsActive: r.agents.size } }

  function hook(p) {
    const id = p?.session_id
    if (!id || typeof id !== 'string') return
    const t = now()
    let r = S.get(id)
    if (!r) {
      const project = String(p.cwd || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || null
      r = { slim: { id, project, tmux: null, title: null, state: 'idle', since: t / 1000, last: null, ctx: null, host: 'laptop' },
            updated: t, turnStarted: null, agents: new Set() }
      S.set(id, r)
    }
    r.updated = t
    const s = r.slim
    const set = state => { if (s.state !== state) { s.state = state; s.since = t / 1000 } }
    const ev = p.hook_event_name, aid = p.agent_id
    switch (ev) {
      case 'SessionStart': set('idle'); break
      case 'UserPromptSubmit': {
        set('working')
        r.turnStarted = t
        const prompt = cut(p.prompt, 120)
        if (!r.title && prompt && !prompt.startsWith('/')) r.title = cut(p.prompt, 80)
        s.last = prompt
        break
      }
      case 'PreToolUse':
        set('working')
        if (aid) r.agents.add(aid)                  // a background agent can run again after its stop
        s.last = cut(`${p.tool_name || '?'}: ${summarize(p.tool_input)}`, 120)
        break
      case 'SubagentStart': if (aid) r.agents.add(aid); break
      case 'SubagentStop': if (aid) r.agents.delete(aid); break
      case 'PermissionRequest': set('blocked'); break
      case 'Notification': {
        // a subagent's notice is not a question for you (its permission requests still are)
        if (aid) return
        // "Claude is waiting for your input" (~60 s after a turn) only means idle, not a question
        const msg = String(p.message || '')
        if (p.notification_type === 'idle_prompt' || msg.startsWith('Claude is waiting for your input')) return
        if (s.state !== 'blocked') set('waiting')
        s.last = cut(msg, 120)
        break
      }
      case 'Stop':
        set('done')
        s.last = `finished in ${Math.round((t - (r.turnStarted || t)) / 1000)}s`
        r.agents.clear()
        break
      case 'StopFailure': {                          // the turn ended on an API error (rate limit too)
        set('error')
        const e = p.error
        s.last = cut(typeof e === 'string' ? e : e?.message || p.error_type || p.message || 'API error', 120)
        r.agents.clear()
        break
      }
      case 'SessionEnd': set('ended'); break
      default: return
    }
    onSession(slimOf(r))
  }

  // Every minute: a working session silent for DECAY_MS goes idle; ended or long-silent ones go.
  function decay() {
    const t = now()
    for (const [id, r] of S) {
      if (r.slim.state === 'working' && t - r.updated > DECAY_MS) {
        r.slim.state = 'idle'; r.slim.since = t / 1000
        onSession(slimOf(r))
      }
      if ((r.slim.state === 'ended' && t - r.updated > GONE_ENDED_MS) || t - r.updated > GONE_SILENT_MS) {
        S.delete(id)
        onGone(id)
      }
    }
  }

  return { hook, decay, get size() { return S.size } }
}
