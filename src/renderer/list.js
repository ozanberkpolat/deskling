// The drop-down list (and the hover peek, which shows one row). textContent only: titles and
// prompts come from the network.
import { ago } from '../shared/viewmodel.js'
import { CTX_WARN } from '../shared/reducer.js'

const LABEL = { waiting: 'Waiting for you', error: 'Stopped on an error', finished: 'Finished', working: 'Working', idle: 'Idle' }

function el(tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

// One row's content: dot · project · state · [ctx] · age, then title and last event.
export function rowParts(r, now = Date.now()) {
  const top = el('div', 'top')
  top.append(el('span', 'dot'), el('span', 'proj', r.project || '?'))
  if (r.host) top.append(el('span', 'host', r.host))
  top.append(el('span', 'state', r.k === 'pc' ? r.state : stateLabel(r)))
  if (r.ctx >= CTX_WARN) top.append(el('span', 'ctx', `ctx ${r.ctx}%`))
  if (typeof r.cost === 'number') {
    const c = el('span', 'cost', costLabel(r.cost))
    c.title = 'Cost at API list prices so far. On a Claude plan this is not what you pay.'
    top.append(c)
  }
  top.append(el('span', 'ago', ago(r.at, now)))
  const parts = [top, el('div', 'title', r.title || '')]
  if (r.detail) parts.push(el('div', 'detail', r.detail))
  return parts
}

export function renderList(root, vm, { now = Date.now(), openUrl, openSession, answer, offerStatusline, notice, highlight } = {}) {
  const frag = document.createDocumentFragment()
  let group = null
  for (const r of vm.rows) {
    if (r.group !== group) { group = r.group; const g = el('div', 'grp', LABEL[group]); g.setAttribute('role', 'heading'); g.setAttribute('aria-level', '3'); frag.append(g) }
    // Paperclip rows open their page; VPS cc rows open their terminal (main builds that URL);
    // a laptop session's terminal is already on this screen.
    // A held permission prompt: the row holds two real buttons, so it is not a button itself.
    const asking = r.ask && answer
    const click = asking ? null : r.k === 'pc' ? (r.url && (() => openUrl?.(r.url))) : (r.open && openSession && (() => openSession(r.id)))
    const key = `${r.k}:${r.id}`
    const row = el(click ? 'button' : 'div', `row g-${r.group} k-${r.k}${r.fresh ? ' fresh' : ''}${asking ? ' asking' : ''}${key === highlight ? ' hl' : ''}`)
    row.dataset.key = key
    if (click) { row.type = 'button'; row.addEventListener('click', click); if (r.open === 'terminal') row.title = 'Show terminal' }
    row.append(...rowParts(r, now))
    if (asking) row.append(askParts(r, answer))
    frag.append(row)
  }
  if (vm.more) frag.append(el('div', 'more', `+${vm.more} more`))
  if (!vm.rows.length) frag.append(el('div', 'empty', vm.connected ? 'Nothing running right now.' : 'Waiting for the relay…'))
  if (vm.quota) frag.append(quotaRow(vm.quota, now))
  else if (offerStatusline) {
    const b = el('button', 'offer', 'Show your plan quota and session costs…')
    b.type = 'button'
    b.addEventListener('click', offerStatusline)
    frag.append(b)
  }
  const st = statusLine(vm)
  if (st) frag.append(el('div', 'status', st))
  if (notice) { const n = el('div', 'status notice', notice); n.setAttribute('role', 'status'); frag.append(n) }
  if (answer && vm.rows.some(r => r.ask)) frag.append(el('div', 'status keys', 'W / S select · A allow · D deny'))
  root.replaceChildren(frag)
  root.querySelector('.row.hl')?.scrollIntoView({ block: 'nearest' })
}

// Reset times in the laptop's own clock: "14:30" today, else "Thu 09:00".
export function resetLabel(ms, now = Date.now()) {
  if (!ms) return ''
  const d = new Date(ms), t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toDateString() === new Date(now).toDateString() ? t : `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${t}`
}
const lvl = p => (p >= 95 ? 'h' : p >= 80 ? 'w' : '')

// "5h 62% · 14:30   Week 18% · Thu 09:00" for the peek
export function quotaLine(q, now = Date.now()) {
  const part = (name, w) => {
    const s = el('span', lvl(w?.pct ?? 0), w ? `${name} ${w.pct}%` : `${name} –`)
    const parts = w?.resetAt ? [s, ` · ${resetLabel(w.resetAt, now)}`] : [s]
    if (w?.hitAt) parts.push(el('span', 'w', ` · full ~${resetLabel(w.hitAt, now)}`))
    return parts
  }
  const line = el('div', 'qline')
  line.append(...part('5h', q.five), '   ', ...part('Week', q.week), q.stale ? `   · ${q.ageMin >= 120 ? Math.round(q.ageMin / 60) + ' h' : q.ageMin + ' min'} old` : '')
  return line
}

function quotaRow(q, now) {
  const row = el('div', 'qrow')
  for (const [name, w] of [['5 hours', q.five], ['Week', q.week]]) {
    const bar = el('span', `bar ${lvl(w?.pct ?? 0)}`), fill = el('i')
    fill.style.width = `${w?.pct ?? 0}%`
    bar.append(fill)
    row.append(el('span', null, name), bar, el('span', null, w ? `${w.pct}%` : '–'))
    if (w?.resetAt) row.append(el('span', 'rs', ''), el('span', 'rs', `resets ${resetLabel(w.resetAt, now)}`), el('span'))
    if (w?.hitAt) row.append(el('span', 'rs', ''), el('span', 'rs pace', `at this pace, full at ${resetLabel(w.hitAt, now)}`), el('span'))
  }
  if (q.stale) row.append(el('span', 'age', `Updated ${q.ageMin >= 120 ? Math.round(q.ageMin / 60) + ' hours' : q.ageMin + ' minutes'} ago`))
  return row
}

// "Allow" / "Deny" under the command. A click answers once; both buttons go quiet until the next view.
function askParts(r, answer) {
  const box = el('div', 'ask')
  const yes = el('button', 'yes', 'Allow'), no = el('button', 'no', 'Deny')
  // the names stay "Allow" / "Deny"; what they answer is read out from this description
  const about = el('span', 'sr', `${r.project || 'session'}: ${r.ask.text}`)
  about.id = `ask-${r.ask.id}`
  for (const [b, allow] of [[yes, true], [no, false]]) {
    b.type = 'button'
    b.setAttribute('aria-describedby', about.id)
    b.addEventListener('click', e => {
      e.stopPropagation()
      yes.disabled = no.disabled = true
      answer(r.ask.id, r.id, allow)
    })
  }
  box.append(yes, no, el('span', 'hint', 'or answer in the terminal'), about)
  return box
}

export const costLabel = usd => usd < 0.01 ? '<$0.01' : usd >= 100 ? `$${Math.round(usd)}` : `$${usd.toFixed(2)}`

function stateLabel(r) {
  if (r.state === 'working' && r.agents) return `working · ${r.agents} agent${r.agents > 1 ? 's' : ''}`
  return { blocked: 'needs approval', waiting: 'asks you', done: 'done', error: 'API error' }[r.state] || r.state
}

function statusLine(vm) {
  if (!vm.connected) return 'Relay unreachable, retrying'
  if (vm.status.cc !== 'ok') return `cc-backend: ${vm.status.cc}`
  if (vm.status.paperclip === 'error') return vm.status.stale ? 'Paperclip unreachable, showing the last list' : 'Paperclip unreachable'
  return ''
}
