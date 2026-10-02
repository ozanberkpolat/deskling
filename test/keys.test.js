import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keyAction, nextHighlight, checkHighlight, GRACE_MS } from '../src/shared/keys.js'

const k = (code, extra = {}) => ({ code, ...extra })
const at = { openedAt: 0, now: 10_000 }

test('keys: WASD and arrows by position; A/D/Enter only once armed', () => {
  assert.deepEqual(keyAction(k('KeyW'), at), { type: 'move', dir: -1 })
  assert.deepEqual(keyAction(k('ArrowDown'), at), { type: 'move', dir: 1 })
  assert.equal(keyAction(k('KeyA'), at), null, 'not armed: a stray A answers nothing')
  assert.equal(keyAction(k('KeyD'), at), null)
  assert.equal(keyAction(k('Enter'), at), null)
  assert.deepEqual(keyAction(k('KeyA'), { ...at, armed: true }), { type: 'answer', allow: true })
  assert.deepEqual(keyAction(k('KeyD'), { ...at, armed: true }), { type: 'answer', allow: false })
  assert.deepEqual(keyAction(k('Enter'), { ...at, armed: true }), { type: 'open' })
  assert.deepEqual(keyAction(k('Escape'), { openedAt: 0, now: 1 }), { type: 'close' }, 'Esc works at once')
})

test('keys: ignored right after opening, on repeat, while composing, and with Ctrl/Alt/Win held', () => {
  const armed = { ...at, armed: true }
  assert.equal(keyAction(k('KeyS'), { openedAt: 0, now: GRACE_MS - 1 }), null)
  assert.equal(keyAction(k('KeyA', { repeat: true }), armed), null)
  assert.equal(keyAction(k('KeyA', { isComposing: true }), armed), null)
  for (const m of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(keyAction(k('KeyA', { [m]: true }), armed), null, m)
  assert.equal(keyAction(k('KeyQ'), armed), null)
})

test('keys: the first move lands on the oldest question; moves stop at the ends; a changed question disarms', () => {
  const rows = [
    { k: 'cc', id: 'a', ask: { id: 'h1' } },
    { k: 'cc', id: 'b', ask: { id: 'h2' } },
    { k: 'cc', id: 'c' },
  ]
  let hl = nextHighlight(rows, null, 1)
  assert.deepEqual(hl, { key: 'cc:a', askId: 'h1' })
  hl = nextHighlight(rows, hl, -1)
  assert.equal(hl.key, 'cc:a', 'stops at the top')
  hl = nextHighlight(rows, nextHighlight(rows, hl, 1), 1)
  assert.deepEqual(hl, { key: 'cc:c', askId: null })
  assert.equal(nextHighlight(rows, hl, 1).key, 'cc:c', 'stops at the bottom')
  assert.equal(nextHighlight([{ k: 'cc', id: 'x' }], null, 1).key, 'cc:x', 'no question: the first row')
  assert.equal(nextHighlight([], null, 1), null)
  const b = { key: 'cc:b', askId: 'h2' }
  assert.deepEqual(checkHighlight(rows, b), b)
  assert.equal(checkHighlight([{ k: 'cc', id: 'b', ask: { id: 'h9' } }], b), null, 'a new question under it')
  assert.equal(checkHighlight([{ k: 'cc', id: 'b' }], b), null, 'the question was answered elsewhere')
  assert.equal(checkHighlight([], b), null, 'the row is gone')
})
