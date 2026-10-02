// The settings window. Reads the whole config once, writes one change at a time through the bridge
// (main validates every key), and redraws whenever the config changes, hand edits included.
// Nested values (sound, quietHours) are always sent whole: config.set merges only the top level.
import { Dog } from './dog.js'
import { MASCOTS } from '../shared/sprites/mascots.js'
import { play } from './sound.js'

const bridge = window.deskling
const $ = id => document.getElementById(id)
let c = null
const set = patch => { c = { ...c, ...patch }; bridge.setConfig(patch) }

// ── mascots, each a live preview ──
const mascotButtons = Object.values(MASCOTS).map(m => {
  const b = document.createElement('button')
  b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.v = m.id
  const cv = document.createElement('canvas'), name = document.createElement('span')
  name.textContent = m.name
  b.append(cv, name)
  const dog = new Dog(cv, { mascot: m, scale: 2 })
  dog.setMood('idle')
  b.addEventListener('click', () => set({ mascot: m.id }))
  b.addEventListener('mouseenter', () => dog.setMood('finished'))
  b.addEventListener('mouseleave', () => dog.setMood('idle'))
  $('mascots').append(b)
  return b
})

function seg(id, key) {
  const btns = [...$(id).querySelectorAll('button')]
  btns.forEach(b => { b.setAttribute('role', 'radio'); b.addEventListener('click', () => set({ [key]: b.dataset.v })) })
  return v => btns.forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v)))
}
const showShape = seg('shape', 'shape'), showCorner = seg('corner', 'corner')

const check = (id, key) => $(id).addEventListener('change', e => set({ [key]: e.target.checked }))
for (const [id, key] of [['tucked', 'tucked'], ['hideInFullscreen', 'hideInFullscreen'], ['hideFromCapture', 'hideFromCapture'],
  ['autostart', 'autostart'], ['localHooks', 'localHooks'], ['answerPermissions', 'answerPermissions'], ['statusline', 'statusline']]) check(id, key)

const number = (id, key) => $(id).addEventListener('change', e => { const v = Number(e.target.value); if (Number.isFinite(v)) set({ [key]: v }) })
for (const id of ['nagAfterMin', 'finishedTtlMin', 'holdSeconds', 'hookPort']) number(id, id)

$('idleOpacity').addEventListener('input', e => { $('idleOpacityOut').value = `${e.target.value}%` })
$('idleOpacity').addEventListener('change', e => set({ idleOpacity: Number(e.target.value) / 100 }))
$('soundOn').addEventListener('change', e => set({ sound: { ...c.sound, enabled: e.target.checked } }))
$('volume').addEventListener('input', e => { $('volumeOut').value = `${e.target.value}%` })
$('volume').addEventListener('change', e => set({ sound: { ...c.sound, volume: Number(e.target.value) / 100 } }))
$('testSound').addEventListener('click', () => play(MASCOTS[c.mascot]?.voice || 'yip', Number($('volume').value) / 100))

// quiet hours: off = null; on = both times
const quiet = () => set({ quietHours: $('quietOn').checked ? { from: $('quietFrom').value || '20:00', to: $('quietTo').value || '08:00' } : null })
for (const id of ['quietOn', 'quietFrom', 'quietTo']) $(id).addEventListener('change', quiet)

// hotkey recorder: the next key with at least one modifier becomes an Electron accelerator
let recording = false
const keyName = e => /^[a-z0-9]$/i.test(e.key) ? e.key.toUpperCase() : /^F\d{1,2}$/.test(e.key) ? e.key
  : { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' }[e.key] || null
$('hotkey').addEventListener('click', () => { recording = true; $('hotkey').classList.add('recording'); $('hotkey').textContent = 'Press the keys…' })
window.addEventListener('keydown', e => {
  if (!recording) return
  e.preventDefault()
  if (e.key === 'Escape') { recording = false; draw(); return }
  const k = keyName(e)
  if (!k || !(e.ctrlKey || e.altKey || e.metaKey)) return          // wait for a real key with Ctrl / Alt / Win
  recording = false
  set({ hotkey: [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super', k].filter(Boolean).join('+') })
  draw()
})
$('hotkeyOff').addEventListener('click', () => { recording = false; set({ hotkey: '' }); draw() })

$('diagnostics').addEventListener('click', async () => {
  const ok = await bridge.copyDiagnostics()
  $('copied').textContent = ok ? 'Copied. Paste it into a GitHub issue.' : 'Could not copy.'
  setTimeout(() => { $('copied').textContent = '' }, 5000)
})
$('openConfig').addEventListener('click', () => bridge.openConfig())
$('openLog').addEventListener('click', () => bridge.openLog())
$('report').addEventListener('click', () => bridge.reportProblem())

// one checkbox per WSL distro Deskling found; the list is rebuilt only when the distros change
function drawWsl() {
  const found = c.wslFound || []
  $('wslBox').hidden = !found.length
  const box = $('wslList')
  if (box.dataset.found !== found.join(',')) {
    box.dataset.found = found.join(',')
    box.replaceChildren(...found.map(d => {
      const l = document.createElement('label'), i = document.createElement('input'), t = document.createElement('span')
      l.className = 'field check'; i.type = 'checkbox'; i.dataset.d = d; t.textContent = d
      i.addEventListener('change', () => set({ wslDistros: [...box.querySelectorAll('input:checked')].map(x => x.dataset.d) }))
      l.append(i, t)
      return l
    }))
  }
  for (const i of box.querySelectorAll('input')) { i.checked = (c.wslDistros || []).includes(i.dataset.d); i.disabled = c.localHooks !== true }
}

function draw() {
  if (!c) return
  drawWsl()
  $('ver').textContent = `Deskling ${c.version}`
  mascotButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === c.mascot)))
  showShape(c.shape); showCorner(c.corner)
  $('idleOpacity').value = Math.round(c.idleOpacity * 100); $('idleOpacityOut').value = `${$('idleOpacity').value}%`
  for (const k of ['tucked', 'hideInFullscreen', 'hideFromCapture', 'autostart', 'answerPermissions']) $(k).checked = !!c[k]
  $('localHooks').checked = c.localHooks === true
  $('statusline').checked = c.statusline === true
  for (const k of ['answerPermissions', 'statusline', 'holdSeconds']) $(k).disabled = c.localHooks !== true
  $('soundOn').checked = c.sound.enabled
  $('volume').value = Math.round(c.sound.volume * 100); $('volumeOut').value = `${$('volume').value}%`
  $('quietOn').checked = !!c.quietHours
  $('quietFrom').value = c.quietHours?.from || '20:00'; $('quietTo').value = c.quietHours?.to || '08:00'
  $('quietFrom').disabled = $('quietTo').disabled = !c.quietHours
  for (const k of ['nagAfterMin', 'finishedTtlMin', 'holdSeconds', 'hookPort']) if (document.activeElement !== $(k)) $(k).value = c[k]
  if (!recording) { $('hotkey').classList.remove('recording'); $('hotkey').textContent = c.hotkey ? c.hotkey.replace(/\+/g, ' + ') : 'None' }
  $('autostartRow').hidden = c.store; $('autostartStore').hidden = !c.store
}

bridge.onFullConfig(v => { c = v; draw() })
bridge.getConfig().then(v => { c = v; draw() })
