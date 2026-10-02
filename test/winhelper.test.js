import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { createReader, createWinHelper } from '../src/main/winhelper.js'
import { createLocal } from '../src/main/local.js'
import { initialState, reduce } from '../src/shared/reducer.js'
import { viewmodel } from '../src/shared/viewmodel.js'

test('winhelper: replies are matched by id across chunk boundaries', () => {
  const got = []
  const read = createReader(r => got.push(r))
  read('{"id":1,"pid":4')
  read('2}\r\n{"id":2,"ok":true,"how":"tab"}\n\nnot json\n')
  assert.deepEqual(got, [{ id: 1, pid: 42 }, { id: 2, ok: true, how: 'tab' }])
})

// a stand-in for the PowerShell child: answers each request line through `answer`
function fakeSpawn(answer) {
  return () => {
    const child = new EventEmitter()
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough()
    child.kill = () => child.emit('exit', 0)
    let buf = ''
    child.stdin.on('data', d => {
      buf += d
      const lines = buf.split('\n'); buf = lines.pop()
      for (const l of lines) { const r = answer(JSON.parse(l)); if (r) child.stdout.write(JSON.stringify({ id: JSON.parse(l).id, ...r }) + '\n') }
    })
    return child
  }
}

test('winhelper: pid and focus go through the helper; a silent helper times out instead of hanging', async () => {
  const w = createWinHelper({ log: () => {}, platform: 'win32',
    spawnFn: fakeSpawn(r => r.cmd === 'pid' ? (r.port === 5555 ? { pid: 1234 } : null) : { ok: true, how: 'window' }) })
  assert.equal(await w.pid(5555, 8033), 1234)
  assert.deepEqual(await w.focus({ pid: 1234, folder: 'my-app' }), { id: 2, ok: true, how: 'window' })
  assert.equal(await w.pid(6666, 8033, 50), undefined)            // no answer after the cap: undefined (not a try)
  w.stop()
  const off = createWinHelper({ log: () => {}, platform: 'linux' })
  assert.equal(await off.pid(1, 2), null)
  assert.equal((await off.focus({ pid: 1 })).ok, false)
})

test('local + viewmodel: a row opens its terminal once the process is known', () => {
  const out = []
  const l = createLocal({ onSession: s => out.push(structuredClone(s)), onGone: () => {} })
  l.hook({ session_id: 's1', cwd: 'C:\\work\\my-app', hook_event_name: 'SessionStart' }, { term: 'vscode' })
  assert.equal(l.needsPid('s1'), true)
  assert.equal(l.target('s1'), null)
  l.setPid('s1', null); l.setPid('s1', null)
  assert.equal(l.needsPid('s1'), true)
  l.setPid('s1', 4321)
  assert.equal(l.needsPid('s1'), false)
  assert.deepEqual(l.target('s1'), { pid: 4321, term: 'vscode', folder: 'my-app' })
  let st = reduce(initialState(), { type: 'local', now: 0 }).state
  st = reduce(st, { type: 'session', data: out.at(-1), now: 0 }).state
  assert.equal(viewmodel(st).rows[0].open, 'terminal')
  const l2 = createLocal({ onSession: () => {}, onGone: () => {} })
  for (let i = 0; i < 3; i++) l2.setPid('nope', null)              // unknown session: ignored
  l2.hook({ session_id: 's2', cwd: '/x', hook_event_name: 'SessionStart' })
  for (let i = 0; i < 5; i++) l2.setPid('s2', undefined)             // helper still starting: does not use up the tries
  assert.equal(l2.needsPid('s2'), true)
  l2.setPid('s2', null); l2.setPid('s2', null); l2.setPid('s2', null)
  assert.equal(l2.needsPid('s2'), false, 'gives up after three tries')
})
