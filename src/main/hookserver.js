// Receiver for this machine's Claude Code hooks. Loopback only, and every request must carry the
// token Deskling wrote into ~/.claude/settings.json. It only listens: nothing here sends a request.
// Always answers {} at once, so it never holds Claude up (a held permission would wait for us).
import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

const MAX_BODY = 1_000_000

export function startHookServer({ port, token, onHook, log }) {
  const want = Buffer.from(token)
  const ok = got => { const b = Buffer.from(String(got || '')); return b.length === want.length && timingSafeEqual(b, want) }
  const reply = (res, code) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(code === 200 ? '{}' : '') }

  const srv = createServer((req, res) => {
    if (req.url !== '/hook') return reply(res, 404)
    if (!ok(req.headers['x-deskling-token'])) return reply(res, 401)
    let size = 0
    const chunks = []
    req.on('data', c => { size += c.length; if (size > MAX_BODY) req.destroy(); else chunks.push(c) })
    req.on('end', () => {
      reply(res, 200)
      try { onHook(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (e) { log(`hook: bad payload (${e.message})`) }
    })
  })
  srv.on('error', e => log(`hook receiver on 127.0.0.1:${port}: ${e.message}`))
  srv.listen(port, '127.0.0.1', () => log(`hook receiver on 127.0.0.1:${port}`))
  return srv
}
