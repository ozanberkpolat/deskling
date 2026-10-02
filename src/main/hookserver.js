// Receiver for this machine's Claude Code hooks. Loopback only, and every request must carry the
// token Deskling wrote into ~/.claude/settings.json. It only listens: nothing here sends a request.
// Answers {} at once, except a PermissionRequest while holdPermission() is true: that one is held
// until the user answers in the widget (answer()), the terminal answers first (release()), Claude
// Code gives up (the socket closes) or holdMs passes. A held request that is not answered gets {},
// which leaves Claude Code's own prompt in charge: never an automatic allow.
import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'

const MAX_BODY = 1_000_000
export const HOLD_MS = 90_000                   // under the 120 s hook timeout claude-hooks.js sets

export function decision(allow) {
  return { hookSpecificOutput: { hookEventName: 'PermissionRequest',
    decision: allow ? { behavior: 'allow' } : { behavior: 'deny', message: 'Denied in Deskling' } } }
}

// onDone(id, session) runs whenever a held request ends without an answer from the widget.
export function startHookServer({ port, token, onHook, log, holdPermission = () => false, holdMs = HOLD_MS, onDone = () => {} }) {
  const want = Buffer.from(token)
  const ok = got => { const b = Buffer.from(String(got || '')); return b.length === want.length && timingSafeEqual(b, want) }
  const send = (res, code, body = {}) => {
    if (res.writableEnded || res.destroyed) return
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(code === 200 ? JSON.stringify(body) : '')
  }
  const held = new Map()                         // id → { res, session, timer }

  // End one held request with `body`. Returns its session, or null when it was already gone.
  function finish(id, body, quiet = false) {
    const h = held.get(id)
    if (!h) return null
    held.delete(id)
    clearTimeout(h.timer)
    send(h.res, 200, body)
    if (!quiet) onDone(id, h.session)
    return h.session
  }
  const answer = (id, allow) => finish(id, decision(allow), true)
  function release(session) {
    for (const [id, h] of held) if (h.session === session) finish(id, {})
  }

  const srv = createServer((req, res) => {
    if (req.url !== '/hook') return send(res, 404)
    if (!ok(req.headers['x-deskling-token'])) return send(res, 401)
    let size = 0
    const chunks = []
    req.on('data', c => { size += c.length; if (size > MAX_BODY) req.destroy(); else chunks.push(c) })
    req.on('end', () => {
      // the parse error would quote the payload (prompt text): log only its size
      let p
      try { p = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch {
        send(res, 200)
        return log(`hook: payload is not valid JSON (${size} bytes)`)
      }
      const ev = p?.hook_event_name, session = p?.session_id
      let meta = {}
      if (ev === 'PermissionRequest' && typeof session === 'string' && holdPermission()) {
        const id = randomBytes(6).toString('hex')
        held.set(id, { res, session, timer: setTimeout(() => finish(id, {}), holdMs) })
        // Claude Code gave up on us (its own timeout, or the terminal was answered and it moved on)
        res.on('close', () => {
          const h = held.get(id)
          if (h && !res.writableEnded) { held.delete(id); clearTimeout(h.timer); onDone(id, h.session) }
        })
        meta = { holdId: id }
      } else {
        send(res, 200)
        // anything but another question from this session means the terminal answered first
        if (ev !== 'PermissionRequest' && ev !== 'Notification' && typeof session === 'string') release(session)
      }
      try { onHook(p, meta) } catch (e) { log(`hook: ${e.message}`) }
    })
  })
  srv.on('error', e => log(`hook receiver on 127.0.0.1:${port}: ${e.message}`))
  srv.listen(port, '127.0.0.1', () => log(`hook receiver on 127.0.0.1:${port}`))
  return {
    srv, answer, release,
    get held() { return held.size },
    close() { for (const id of [...held.keys()]) finish(id, {}, true); srv.closeAllConnections?.(); srv.close() },
  }
}
