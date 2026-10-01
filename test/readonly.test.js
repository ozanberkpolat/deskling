// v1 is display-only: nothing under src/ may send anything but GET.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../src/', import.meta.url))
const files = d => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)])

test('src/ never POSTs or sets a request method', () => {
  for (const f of files(src)) {
    const text = readFileSync(f, 'utf8')
    assert.ok(!/\bPOST\b/.test(text), `${f} mentions POST`)
    assert.ok(!/\bmethod\s*:/.test(text), `${f} sets method:`)
  }
})
