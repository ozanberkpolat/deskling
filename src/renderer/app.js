// Renderer entry. Everything arrives through window.deskling (preload, or preview.html's mock);
// the renderer itself has no network.
import { Dog } from './dog.js'
import { paint } from './draw.js'
import { mascotOf } from '../shared/sprites/mascots.js'
import { renderList, rowParts, quotaLine } from './list.js'
import { play } from './sound.js'

const bridge = window.deskling
const $ = id => document.getElementById(id)
const pupsEl = $('pups')
const box = $('box'), list = $('list'), peek = $('peek'), rozet = box.querySelector('.rozet')
const dog = new Dog($('dog'), { mascot: mascotOf('shiba'), scale: 2, fx: $('fx') })

// The quota arc: the path follows the box's shape (circle or rounded square, 7 px outside it).
const qsvg = box.querySelector('.quota'), qarc = qsvg.querySelector('.q-arc'), qtrack = qsvg.querySelector('.q-track'), qdot = qsvg.querySelector('.q-dot')
const QPATH = {
  round: 'M63 2 A61 61 0 1 1 63 124 A61 61 0 1 1 63 2',
  square: 'M63 2 H95 A29 29 0 0 1 124 31 V95 A29 29 0 0 1 95 124 H31 A29 29 0 0 1 2 95 V31 A29 29 0 0 1 31 2 Z',
}
let lastQuota = null
function drawQuota(q) {
  lastQuota = q
  qsvg.toggleAttribute('hidden', !q)                       // SVG elements have no .hidden property
  if (!q) return
  const d = QPATH[cfg.shape] || QPATH.round
  if (qarc.getAttribute('d') !== d) { qarc.setAttribute('d', d); qtrack.setAttribute('d', d) }
  qsvg.dataset.level = q.level
  qsvg.classList.toggle('stale', q.stale)
  const five = q.five?.pct ?? 0
  qarc.style.strokeDasharray = `${five} 100`
  qarc.style.opacity = five ? 1 : 0
  qdot.style.display = q.week ? '' : 'none'
  if (q.week) {
    const p = qtrack.getPointAtLength(qtrack.getTotalLength() * Math.min(q.week.pct, 99.9) / 100)
    qdot.setAttribute('cx', p.x); qdot.setAttribute('cy', p.y)
  }
}

let vm = null
let open = false
let cfg = { sound: { enabled: true, volume: 0.5 }, shape: 'round', corner: 'tr', mascot: 'shiba', muted: false }
let interactive = false

bridge.onConfig(c => {
  cfg = { ...cfg, ...c }
  document.body.dataset.shape = cfg.shape
  document.body.dataset.corner = cfg.corner
  document.body.dataset.mascot = mascotOf(cfg.mascot).id
  if (cfg.idleOpacity != null) document.body.style.setProperty('--idle-op', cfg.idleOpacity)
  dog.setMascot(mascotOf(cfg.mascot))
  tuck()
  redrawPups()
  if (lastQuota) drawQuota(lastQuota)                      // the shape may have changed
})

bridge.onView(v => {
  vm = v
  dog.setMood(v.mood, v.fast)
  const n = v.badges.waiting || v.badges.error || v.badges.finished
  rozet.hidden = !n
  rozet.textContent = n
  rozet.classList.toggle('bad', !v.badges.waiting && !!v.badges.error)
  rozet.classList.toggle('good', !v.badges.waiting && !v.badges.error)
  drawQuota(v.quota)
  drawPups(v.pups)
  box.dataset.mood = v.mood
  box.title = { offline: 'Offline', waiting: 'Something waits for you', error: 'A session stopped on an error', finished: 'A session finished', working: 'Working', idle: 'All quiet' }[v.mood]
  tuck()
  if (open) draw()
  if (!peek.hidden) drawPeek()
})

// The bridge delivers a dispatch's view BEFORE its fx, so a bark lands on a dog already in 'waiting'.
bridge.onFx(({ fx }) => {
  if (fx === 'chirp') {
    if (cfg.sound?.enabled && !cfg.muted) play(mascotOf(cfg.mascot).voice, cfg.sound.volume)
    dog.react('bark')
  }
  if (fx === 'celebrate') dog.react('celebrate')
  if (fx === 'yawn') dog.react('yawn')
})

function draw() { if (vm) renderList(list, vm, { openUrl: bridge.openUrl, openSession: bridge.openSession, answer: bridge.answer }) }

let clock = null, openedAt = 0
function setOpen(v) {
  if (v === open) return
  open = v
  openedAt = Date.now()
  showPeek(false)
  document.body.classList.toggle('open', v)
  list.hidden = !v
  bridge.setListOpen(v)
  if (!v) interactive = false                               // main resets click-through on close
  tuck()
  clearInterval(clock)
  if (v) { draw(); clock = setInterval(draw, 30_000) }      // keep "4m ago" honest while open
}
bridge.onToggleList?.(() => setOpen(!open))                 // the global hotkey

// ── peek: hover the box for the most urgent thing, without opening the list ──
let peekTimer = null
function drawPeek() {
  const r = vm?.rows.find(r => r.group === 'waiting' || r.group === 'finished')
  if (r) {
    const wrap = document.createElement('div')
    wrap.className = `g-${r.group} k-${r.k}${r.fresh ? ' fresh' : ''}`
    wrap.append(...rowParts(r))
    peek.replaceChildren(wrap)
    if (vm.quota) peek.append(quotaLine(vm.quota))
    return
  }
  const w = vm?.badges.working
  const line = document.createElement('div')
  line.className = 'title'
  line.textContent = !vm?.connected ? 'Relay unreachable' : w ? `${w} session${w > 1 ? 's' : ''} working` : 'All quiet'
  peek.replaceChildren(line)
  if (vm?.quota) peek.append(quotaLine(vm.quota))
}
function showPeek(v) {
  clearTimeout(peekTimer)
  if (!v || open) { peek.hidden = true; return }
  peekTimer = setTimeout(() => { drawPeek(); peek.hidden = false }, 350)
}
box.addEventListener('mouseenter', () => { showPeek(true); hover(true) })
box.addEventListener('mouseleave', () => { showPeek(false); hover(false) })

// ── tuck into the side edge (config.tucked): out while hovered, with the list, or when needed ──
let hovered = false, hoverTimer = null
function hover(v) {
  clearTimeout(hoverTimer)
  if (v) { hovered = true; tuck() } else hoverTimer = setTimeout(() => { hovered = false; tuck() }, 1500)
}
function tuck() {
  const needs = ['waiting', 'error', 'finished'].includes(vm?.mood)
  document.body.classList.toggle('tucked-in', !!cfg.tucked && !open && !hovered && !needs)
}

// ── subagent pups: one tiny companion per running subagent (vm.pups, max 3) ──
let pupFrame = 0
function paintPup(cv) {
  const m = mascotOf(cfg.mascot), rows = m.pup[pupFrame % m.pup.length]
  cv.width = rows[0].length * 2; cv.height = rows.length * 2
  paint(cv.getContext('2d'), rows, m.colors, 2)
}
function redrawPups() { for (const cv of pupsEl.querySelectorAll('canvas:not(.leave)')) paintPup(cv) }
function drawPups(n = 0) {
  const live = [...pupsEl.querySelectorAll('canvas:not(.leave)')]
  for (let i = live.length; i < n; i++) { const cv = document.createElement('canvas'); paintPup(cv); pupsEl.append(cv) }
  for (const cv of live.slice(n)) { cv.classList.add('leave'); setTimeout(() => cv.remove(), 650) }   // waves, then goes
}
setInterval(() => { if (pupsEl.children.length) { pupFrame++; redrawPups() } }, 420)
addEventListener('cc-pet', () => dog.react('pet'))                  // preview.html's "Pet" button

// Press-and-drag moves the box (main polls the cursor and snaps it to the nearest corner on release);
// a press without a drag is a click; a double click, or holding it 500 ms or more, is a pet
// (= mark everything seen).
let pressed = false, downAt = 0, clickTimer = null
box.addEventListener('pointerdown', e => {
  if (e.button !== 0) return
  pressed = true
  downAt = Date.now()
  showPeek(false)
  box.setPointerCapture(e.pointerId)
  bridge.dragStart?.()
})
box.addEventListener('pointerup', async () => {
  if (!pressed) return
  pressed = false
  const held = Date.now() - downAt
  if (await bridge.dragEnd?.()) return
  if (held >= 500) return pet()
  // a double click is a pet too: hold the single click briefly to see if a second one follows
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return pet() }
  clickTimer = setTimeout(() => { clickTimer = null; setOpen(!open) }, 230)
})
function pet() { dog.react('pet'); bridge.ack?.() }
box.addEventListener('lostpointercapture', () => { if (pressed) { pressed = false; bridge.dragEnd?.() } })
box.addEventListener('contextmenu', e => { e.preventDefault(); bridge.showMenu?.() })
addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false) })
// Close when focus goes elsewhere, but not on a blur right after opening: from the hotkey, Windows
// may refuse to hand focus to us (foreground lock) and the list would shut the moment it opened.
addEventListener('blur', () => { if (Date.now() - openedAt > 400) setOpen(false) })

// Click-through: the window ignores the mouse except over the box and the open list. Re-sent every
// 300 ms while over them, because main's watchdog may have switched click-through back on.
let sentAt = 0
function setInteractive(v) {
  if (v === interactive && !(v && Date.now() - sentAt > 300)) return
  interactive = v
  sentAt = Date.now()
  bridge.setInteractive(v)
}
addEventListener('mousemove', e => setInteractive(!!e.target.closest('#box, #list:not([hidden])')))
document.addEventListener('mouseleave', () => { setInteractive(false); showPeek(false) })
