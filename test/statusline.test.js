import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { installStatusline, removeStatusline, statuslineState, readStatusline, wrapperCommand, SL_MARK } from '../src/main/statusline.js'
import { startHookServer } from '../src/main/hookserver.js'
import { limitsFrom } from '../src/main/quota.js'

const tmp = () => mkdtempSync(join(tmpdir(), 'deskling-'))
const json = f => JSON.parse(readFileSync(f, 'utf8'))

test('statusline: wraps theirs, keeps their options, refreshes, puts it back', () => {
  const d = tmp(), f = join(d, 'settings.json'), saveTo = join(d, 'saved.json')
  try {
    const theirs = { type: 'command', command: 'bash ~/.claude/mine.sh # keep me', padding: 1, refreshInterval: 10 }
    writeFileSync(f, JSON.stringify({ model: 'opus', statusLine: theirs }))
    assert.equal(statuslineState(f), 'other')
    assert.equal(installStatusline(f, { port: 8033, token: 't0k', saveTo }), 'installed')
    let s = json(f)
    assert.equal(s.model, 'opus')
    assert.equal(statuslineState(f), 'ours')
    assert.ok(s.statusLine.command.includes(SL_MARK))
    assert.ok(s.statusLine.command.includes('\nbash ~/.claude/mine.sh # keep me\n'), 'their command on its own line')
    assert.equal(s.statusLine.padding, 1)
    assert.equal(s.statusLine.refreshInterval, 10)
    assert.deepEqual(json(saveTo), theirs)
    assert.equal(installStatusline(f, { port: 8033, token: 't0k', saveTo }), 'unchanged')
    assert.equal(installStatusline(f, { port: 9000, token: 't0k', saveTo }), 'refreshed')
    assert.ok(json(f).statusLine.command.includes('127.0.0.1:9000/statusline'))
    assert.deepEqual(json(saveTo), theirs, 'a refresh never saves our own wrapper as theirs')
    assert.equal(removeStatusline(f, { saveTo }), true)
    assert.deepEqual(json(f).statusLine, theirs)
    assert.equal(existsSync(saveTo), false)
    assert.equal(removeStatusline(f, { saveTo }), false, 'not ours: left alone')
  } finally { rmSync(d, { recursive: true }) }
})

test('statusline: none before, none after; OBPTerm left alone; a broken file is never written', () => {
  const d = tmp(), f = join(d, 'settings.json'), saveTo = join(d, 'saved.json')
  try {
    writeFileSync(f, '{}')
    assert.equal(installStatusline(f, { port: 8033, token: 't', saveTo }), 'installed')
    assert.equal(json(f).statusLine.refreshInterval, 30)
    removeStatusline(f, { saveTo })
    assert.deepEqual(json(f), {})
    const obp = { statusLine: { type: 'command', command: 'obpterm-host statusline # obpterm-statusline v3' } }
    writeFileSync(f, JSON.stringify(obp))
    assert.equal(installStatusline(f, { port: 8033, token: 't', saveTo }), 'obpterm')
    assert.deepEqual(json(f), obp)
    writeFileSync(f, '{ broken')
    assert.throws(() => installStatusline(f, { port: 8033, token: 't', saveTo }))
    assert.equal(readFileSync(f, 'utf8'), '{ broken')
    assert.equal(statuslineState(f), 'broken')
  } finally { rmSync(d, { recursive: true }) }
})

test('statusline: payload → cost, context and quota', () => {
  const p = { session_id: 's1', cost: { total_cost_usd: 1.23456 }, context_window: { used_percentage: 81.6 },
    rate_limits: { five_hour: { used_percentage: 62, resets_at: 1790800000 }, seven_day: { used_percentage: 18, resets_at: 1791000000 } } }
  assert.deepEqual(readStatusline(p), { session: 's1', cost: 1.23, ctx: 82 })
  assert.deepEqual(readStatusline({}), { session: null, cost: null, ctx: null })
  const q = limitsFrom(p, 1_790_000_000_000)
  assert.equal(q.five.pct, 62)
  assert.equal(q.week.pct, 18)
})

// The wrapper itself, run by bash the way Claude Code runs a status line: their output comes through
// unchanged, limits.json is written, and the payload reaches Deskling's /statusline route.
const hasBash = spawnSync('bash', ['-c', 'command -v curl'], { encoding: 'utf8' }).status === 0
test('statusline: the wrapper under bash', { skip: !hasBash && 'no bash/curl here' }, async () => {
  const home = tmp()
  mkdirSync(join(home, '.claude'))
  const seen = []
  const hs = startHookServer({ port: 0, token: 'tok', log: () => {}, onHook: () => {}, onStatusline: p => seen.push(p) })
  try {
    await new Promise(r => hs.srv.once('listening', r))
    const port = hs.srv.address().port
    const payload = JSON.stringify({ session_id: 's1', cost: { total_cost_usd: 0.5 }, rate_limits: { five_hour: { used_percentage: 40 } } })
    const cmd = wrapperCommand({ port, token: 'tok', original: 'IFS= read -rd "" x; printf "theirs:%s" "${#x}" # their comment' })
    // spawn, not spawnSync: the wrapper's curl must reach this process's server while bash runs
    const { spawn } = await import('node:child_process')
    const out = await new Promise((res, rej) => {
      const ch = spawn('bash', ['-c', cmd], { env: { ...process.env, HOME: home } })
      let o = ''
      ch.stdout.on('data', d => { o += d })
      ch.on('error', rej)
      ch.on('close', () => res(o))
      ch.stdin.end(payload)
    })
    // bash's <<< adds one newline at the end (harmless to a JSON reader; it saves a pipe process on Windows)
    assert.equal(out, `theirs:${payload.length + 1}`, 'their command got the same payload and printed as before')
    assert.equal(readFileSync(join(home, '.claude', 'limits.json'), 'utf8'), payload)
    for (let i = 0; i < 100 && !seen.length; i++) await new Promise(r => setTimeout(r, 20))
    assert.equal(seen[0]?.session_id, 's1')
  } finally { hs.close(); rmSync(home, { recursive: true }) }
})
