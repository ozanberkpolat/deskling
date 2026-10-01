// Incremental SSE parser. Pure: no Node or browser APIs, so main, tests and preview share it.
// `scanFrom` resumes the line scan where the last chunk stopped, so a 59 KB snapshot line that
// arrives in 100 chunks is scanned once (linear), not 100 times. Lines end in CRLF, LF or CR; a CR
// that ends a chunk ends its line at once and the next chunk's leading LF (if any) is skipped.
export function createSseParser(onEvent) {
  let buf = '', scanFrom = 0, skipLF = false, event = '', data = []

  function line(l) {
    if (l === '') {
      if (data.length) onEvent({ event: event || 'message', data: data.join('\n') })
      event = ''; data = []
      return
    }
    if (l[0] === ':') return                       // comment (keepalive)
    const i = l.indexOf(':')
    const field = i < 0 ? l : l.slice(0, i)
    let value = i < 0 ? '' : l.slice(i + 1)
    if (value[0] === ' ') value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }

  return {
    push(chunk) {
      if (!chunk) return
      if (skipLF && chunk.charCodeAt(0) === 10) chunk = chunk.slice(1)
      skipLF = false
      buf += chunk
      let start = 0, i = scanFrom
      for (; i < buf.length; i++) {
        const c = buf.charCodeAt(i)
        if (c !== 10 && c !== 13) continue
        line(buf.slice(start, i))
        if (c === 13) {
          if (i + 1 === buf.length) skipLF = true
          else if (buf.charCodeAt(i + 1) === 10) i++
        }
        start = i + 1
      }
      buf = buf.slice(start)
      scanFrom = buf.length
    },
    // A new connection must not inherit half an event from the old one.
    reset() { buf = ''; scanFrom = 0; skipLF = false; event = ''; data = [] },
  }
}
