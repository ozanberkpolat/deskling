import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { parseDistros, wslHookCommand, createWsl } from '../src/main/wsl.js'
import { ours, EVENTS, WSL_MARK } from '../src/main/claude-hooks.js'
import { startHookServer } from '../src/main/hookserver.js'

test('wsl: distro list from wsl.exe (UTF-16LE or UTF-8), without Docker/Rancher and odd names', () => {
  const utf16 = Buffer.from('﻿Ubuntu-24.04\r\ndocker-desktop\r\nDebian\r\nweird name\r\n\r\n', 'utf16le')
  assert.deepEqual(parseDistros(utf16), ['Ubuntu-24.04', 'Debian'])
  assert.deepEqual(parseDistros(Buffer.from('Ubuntu\nrancher-desktop-data\n')), ['Ubuntu'])
})

test('wsl: the hook command is POSIX, marked, under the hook timeout, and refuses unsafe values', () => {
  const opts = { curl: '/mnt/c/Windows/System32/curl.exe', port: 8033, token: 'abc123', distro: 'Ubuntu' }
  const c = wslHookCommand({ ...opts, ev: 'PermissionRequest' })
  assert.match(c, /-m 110 /)
  assert.match(wslHookCommand({ ...opts, ev: 'Stop' }), /-m 4 /)
  assert.match(c, /exit 0 # deskling-wsl v1$/)
  assert.ok(ours({ type: 'command', command: c }), 'counts as ours, so it is replaced and removed')
  assert.throws(() => wslHookCommand({ ...opts, token: "x'; rm -rf ~" }))
  assert.throws(() => wslHookCommand({ ...opts, distro: 'a b' }))
})

// a distro in memory: what wsl.exe would do for each call createWsl makes
function fakeWsl(files = {}) {
  const calls = []
  const exec = async (args, input) => {
    calls.push(args)
    if (args[0] === '-l') return Buffer.from('Ubuntu\r\n', 'utf16le')
    const d = args[1]
    if (args[3] === 'wslpath') return Buffer.from('/mnt/c/Windows/System32/curl.exe\n')
    const sh = args[5]
    if (sh.startsWith('cat ')) return Buffer.from(files[d] ?? '')
    if (sh.includes('cat > ')) { files[d] = input; return Buffer.from('') }
    throw new Error('unexpected ' + sh)
  }
  return { exec, files, calls }
}

test('wsl: install keeps the user\'s hooks, is idempotent, removes cleanly; a broken file is never written', async () => {
  const theirs = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo theirs' }] }] } }
  const f = fakeWsl({ Ubuntu: JSON.stringify(theirs) })
  const w = createWsl({ exec: f.exec })
  assert.deepEqual(await w.distros(), ['Ubuntu'])
  assert.equal(await w.install('Ubuntu', { port: 8033, token: 'tok' }), 'installed')
  const s = JSON.parse(f.files.Ubuntu)
  assert.equal(s.model, 'opus')
  assert.equal(s.hooks.Stop.length, 2)
  for (const ev of EVENTS) assert.ok(s.hooks[ev].some(e => e.hooks[0].command?.includes(WSL_MARK)), ev)
  assert.equal(s.hooks.PermissionRequest[0].hooks[0].timeout, 120)
  assert.equal(await w.install('Ubuntu', { port: 8033, token: 'tok' }), 'unchanged')
  assert.equal(await w.install('Ubuntu', { port: 8033, token: 'new' }), 'installed', 'a new token rewrites')
  assert.equal(await w.remove('Ubuntu'), true)
  assert.deepEqual(JSON.parse(f.files.Ubuntu), theirs)
  assert.equal(await w.remove('Ubuntu'), false)
  const broken = fakeWsl({ Ubuntu: '{ broken' })
  await assert.rejects(createWsl({ exec: broken.exec }).install('Ubuntu', { port: 8033, token: 'tok' }))
  assert.equal(broken.files.Ubuntu, '{ broken')
  const none = fakeWsl({})
  await createWsl({ exec: none.exec }).install('Ubuntu', { port: 8033, token: 'tok' })
  assert.ok(JSON.parse(none.files.Ubuntu).hooks.Stop, 'no settings.json yet: created')
})

// The real command, run by sh the way Claude Code runs a command hook, with this machine's curl in
// place of curl.exe: the hook reaches Deskling with its headers, and a held prompt's Allow comes
// back on stdout for Claude Code to read.
const hasCurl = spawnSync('sh', ['-c', 'command -v curl'], { encoding: 'utf8' }).status === 0
test('wsl: the hook command end to end under sh', { skip: !hasCurl && 'no sh/curl here' }, async () => {
  const curl = spawnSync('sh', ['-c', 'command -v curl'], { encoding: 'utf8' }).stdout.trim()
  const got = []
  const hs = startHookServer({ port: 0, token: 'tok', log: () => {}, holdPermission: () => true, onHook: (p, meta) => got.push({ p, meta }) })
  try {
    await new Promise(r => hs.srv.once('listening', r))
    const port = hs.srv.address().port
    const sh = (ev, payload) => new Promise(res => {
      const ch = spawn('sh', ['-c', wslHookCommand({ curl, port, token: 'tok', distro: 'Ubuntu', ev })], { env: { ...process.env, TERM_PROGRAM: 'vscode' } })
      let out = ''
      ch.stdout.on('data', d => { out += d })
      ch.on('close', code => res({ out, code }))
      ch.stdin.end(JSON.stringify(payload))
    })
    let r = await sh('SessionStart', { session_id: 'w1', cwd: '/home/u/proj', hook_event_name: 'SessionStart' })
    assert.equal(r.code, 0)
    assert.equal(r.out, '{}')
    assert.equal(got[0].p.session_id, 'w1')
    assert.equal(got[0].meta.term, 'vscode')
    assert.equal(got[0].meta.wsl, 'Ubuntu')
    const pending = sh('PermissionRequest', { session_id: 'w1', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' } })
    for (let i = 0; i < 100 && hs.held === 0; i++) await new Promise(r => setTimeout(r, 20))
    hs.answer(got.at(-1).meta.holdId, true)
    r = await pending
    assert.equal(JSON.parse(r.out).hookSpecificOutput.decision.behavior, 'allow')
    // Deskling not running: still exit 0 and no output (no hook error in Claude Code)
    hs.close()
    r = await sh('Stop', { session_id: 'w1', hook_event_name: 'Stop' })
    assert.deepEqual(r, { out: '', code: 0 })
  } finally { hs.close() }
})
