import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSseParser } from '../src/shared/sse-parser.js'

function parseChunks(chunks) {
  const out = []
  const p = createSseParser(e => out.push(e))
  for (const c of chunks) p.push(c)
  return out
}

const STREAM = 'event: snapshot\ndata: {"a":1}\n\n: keepalive\n\nevent: session\ndata: x\ndata:y\n\n'
const WANT = [{ event: 'snapshot', data: '{"a":1}' }, { event: 'session', data: 'x\ny' }]

test('whole stream', () => assert.deepEqual(parseChunks([STREAM]), WANT))

test('every split point, LF / CRLF / CR', () => {
  for (const eol of ['\n', '\r\n', '\r']) {
    const s = STREAM.replaceAll('\n', eol)
    for (let i = 0; i <= s.length; i++) assert.deepEqual(parseChunks([s.slice(0, i), s.slice(i)]), WANT, `${JSON.stringify(eol)} @${i}`)
  }
})

test('CRLF split between CR and LF does not make an empty line', () => {
  assert.deepEqual(parseChunks(['event: a\r', '\ndata: 1\r', '\n\r', '\n']), [{ event: 'a', data: '1' }])
})

test('byte-by-byte', () => assert.deepEqual(parseChunks([...STREAM.replaceAll('\n', '\r\n')]), WANT))

test('a 60 KB line in 1-byte chunks stays linear', () => {
  const big = 'x'.repeat(60_000)
  const p = createSseParser(e => out.push(e)), out = []
  const t = performance.now()
  p.push('data: ')
  for (const c of big) p.push(c)
  p.push('\n\n')
  assert.equal(out[0].data.length, 60_000)
  assert.ok(performance.now() - t < 1500, 'quadratic scan?')
})

test('reset drops a half event', () => {
  const out = []
  const p = createSseParser(e => out.push(e))
  p.push('event: snapshot\ndata: {"half')
  p.reset()
  p.push('event: gone\ndata: 1\n\n')
  assert.deepEqual(out, [{ event: 'gone', data: '1' }])
})
