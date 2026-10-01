// Relay client: one SSE connection to <relay>/stream, GET only. No electron import.
//  - watchdog: no byte for 45 s (the relay sends a keepalive every 20 s) → reconnect
//  - backoff: full jitter, 1..30 s
//  - after 3 failures in a row, also poll /live every 15 s until the stream is back
//  - kick(): reconnect now (power resume, unlock, wall-clock jump > 15 s)
import { createSseParser } from '../shared/sse-parser.js'

const EVENTS = ['snapshot', 'session', 'gone', 'paperclip', 'status', 'quota']

export class RelayStream {
  constructor({ url, token, dispatch, log = () => {}, fetchFn = globalThis.fetch,
                watchdogMs = 45_000, minBackoffMs = 1000, maxBackoffMs = 30_000,
                pollMs = 15_000, pollAfter = 3, clockMs = 5000, jumpMs = 15_000 }) {
    Object.assign(this, { url, token, dispatch, log, fetchFn, watchdogMs, minBackoffMs, maxBackoffMs, pollMs, pollAfter, clockMs, jumpMs })
    this.fails = 0
    this.parser = createSseParser(e => this.onEvent(e))
    this.stopped = true
  }

  headers() { return { Authorization: `Bearer ${this.token}`, Accept: 'text/event-stream' } }

  start() {
    this.stopped = false
    let last = Date.now()
    this.clock = setInterval(() => {               // Modern Standby: timers stop, the clock does not
      const now = Date.now()
      if (now - last > this.clockMs + this.jumpMs) this.kick('wall clock jumped')
      last = now
    }, this.clockMs)
    this.loop()
    return this
  }

  stop() {
    this.stopped = true
    clearInterval(this.clock)
    this.stopPoll()
    this.ac?.abort()
    this.wake?.()
  }

  kick(reason) {
    if (this.stopped) return
    this.log(`stream: reconnect now (${reason})`)
    this.fails = 0
    this.ac?.abort(new Error(reason))
    this.wake?.()                                  // cut a backoff sleep short
  }

  async loop() {
    while (!this.stopped) {
      const ac = this.ac = new AbortController()
      let why
      try {
        await this.connect(ac)
        why = 'stream ended'
      } catch (e) {
        why = ac.signal.reason?.message || e.message
      }
      clearTimeout(this.dog)
      if (this.stopped) break
      if (this.connected && !this.liveOk) this.dispatch({ type: 'disconnected' })
      this.connected = false
      this.fails++
      if (this.fails >= this.pollAfter) this.startPoll()
      const ms = Math.round(this.minBackoffMs + Math.random() * (Math.min(this.maxBackoffMs, this.minBackoffMs * 2 ** this.fails) - this.minBackoffMs))
      this.log(`stream: ${why}; retry ${this.fails} in ${ms} ms`)
      await new Promise(r => { const t = setTimeout(r, ms); this.wake = () => { clearTimeout(t); r() } })
      this.wake = null
    }
  }

  armWatchdog(ac) {
    clearTimeout(this.dog)
    this.dog = setTimeout(() => ac.abort(new Error(`no data for ${this.watchdogMs / 1000} s`)), this.watchdogMs)
  }

  async connect(ac) {
    this.armWatchdog(ac)
    const r = await this.fetchFn(`${this.url}/stream`, { headers: this.headers(), signal: ac.signal })
    if (!r.ok) throw new Error(r.status === 401 ? 'HTTP 401: the token in config.json was rejected' : `HTTP ${r.status}`)
    this.parser.reset()
    for await (const chunk of r.body.pipeThrough(new TextDecoderStream())) {
      this.armWatchdog(ac)
      this.parser.push(chunk)
    }
  }

  onEvent({ event, data }) {
    if (!EVENTS.includes(event)) return
    let d
    try { d = JSON.parse(data) } catch { return this.log(`stream: bad JSON in ${event}`) }
    if (event === 'snapshot') {
      this.fails = 0
      this.connected = true
      this.stopPoll()
      this.log('stream: connected')
    }
    this.dispatch({ type: event, data: d })
  }

  startPoll() {
    if (this.poll) return
    this.log('stream: polling /live while the stream is down')
    const tick = async () => {
      try {
        const r = await this.fetchFn(`${this.url}/live`, { headers: this.headers(), signal: AbortSignal.timeout(10_000) })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json()
        if (this.stopped) return                   // stopped mid-request (relay switched off): stay out
        this.liveOk = true
        this.dispatch({ type: 'snapshot', data: d })
      } catch (e) {
        if (this.liveOk) this.dispatch({ type: 'disconnected' })
        this.liveOk = false
      }
    }
    this.poll = setInterval(tick, this.pollMs)
    tick()
  }

  stopPoll() {
    clearInterval(this.poll)
    this.poll = null
    this.liveOk = false
  }
}
