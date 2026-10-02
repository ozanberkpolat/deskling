// Keyboard control of the open list, pure. Keys by physical position (e.code), like a game's WASD:
// W / S (or the arrows) move a highlight over the rows, A allows and D denies the highlighted row's
// question, Enter does what a click does, Esc closes. A, D and Enter only work once W/S has put a
// highlight on a row in this opening of the list, so someone who opens it with the hotkey and keeps
// typing (meaning the terminal) cannot answer a prompt by accident.
export const GRACE_MS = 400                         // keys right after the list opens are ignored

export const rowKey = r => `${r.k}:${r.id}`

// What a keydown means: null (ignore) | {type:'close'} | {type:'move', dir} | {type:'answer', allow} | {type:'open'}
export function keyAction(e, { openedAt = 0, now = Date.now(), armed = false } = {}) {
  if (e.repeat || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return null
  if (e.code === 'Escape') return { type: 'close' }
  if (now - openedAt < GRACE_MS) return null
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': return { type: 'move', dir: -1 }
    case 'KeyS': case 'ArrowDown': return { type: 'move', dir: 1 }
    case 'KeyA': return armed ? { type: 'answer', allow: true } : null
    case 'KeyD': return armed ? { type: 'answer', allow: false } : null
    case 'Enter': case 'NumpadEnter': return armed ? { type: 'open' } : null
    default: return null
  }
}

const mark = r => ({ key: rowKey(r), askId: r.ask?.id ?? null })

// The next highlight. The first move lands on the oldest waiting question (rows come sorted with the
// longest wait first), else the first row; later moves step and stop at either end.
export function nextHighlight(rows, current, dir) {
  if (!rows.length) return null
  const i = current ? rows.findIndex(r => rowKey(r) === current.key) : -1
  if (i < 0) return mark(rows.find(r => r.ask) || rows[0])
  return mark(rows[Math.min(rows.length - 1, Math.max(0, i + dir))])
}

// After a new view: keep the highlight only while its row is there and still asks the same question
// (a new question, or rows re-sorting under it, means W/S again before A/D).
export function checkHighlight(rows, current) {
  if (!current) return null
  const r = rows.find(x => rowKey(x) === current.key)
  return r && (r.ask?.id ?? null) === current.askId ? current : null
}
