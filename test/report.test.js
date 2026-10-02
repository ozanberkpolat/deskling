import { test } from 'node:test'
import assert from 'node:assert/strict'
import { issueUrl, redact, ISSUES, MAX_URL } from '../src/main/report.js'

test('report: a short prefilled issue on the fixed repo URL', () => {
  const u = issueUrl({ version: '1.2.0', channel: 'Microsoft Store', windows: '10.0.26100' })
  assert.ok(u.startsWith(ISSUES + '?'))
  assert.ok(u.length <= MAX_URL)
  const body = new URL(u).searchParams.get('body')
  assert.match(body, /Deskling 1\.2\.0 \(Microsoft Store\), Windows 10\.0\.26100/)
  assert.match(body, /clipboard/)
  assert.equal(new URL(issueUrl({ version: 'x'.repeat(3000) })).search, '?labels=bug', 'too long: the bare form')
})

test('report: diagnostics lose the user name and any web address', () => {
  const home = 'C:\\Users\\ozan'
  const log = [
    'added Deskling hooks to C:\\Users\\ozan\\.claude\\settings.json',
    'quota: c:/users/OZAN/.claude/limits.json not found',
    'refused to open https://example.com/secret',
    'hook receiver on 127.0.0.1:8033',
  ].join('\n')
  const out = redact(log, home)
  assert.doesNotMatch(out, /ozan/i)
  assert.match(out, /~\\\.claude\\settings\.json/)
  assert.match(out, /~\/\.claude\/limits\.json/)
  assert.doesNotMatch(out, /https?:/)
  assert.match(out, /hook receiver/)
})
