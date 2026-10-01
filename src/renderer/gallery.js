// Sprite review: pick a mascot, then every mood in a real box and every clip. Used by preview.html and
// the Electron `--gallery` window.
import { Dog } from './dog.js'
import { MASCOTS } from '../shared/sprites/mascots.js'

const MOODS = ['idle', 'working', 'waiting', 'finished', 'offline']
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }

export function mountGallery(root, { mascot = 'shiba' } = {}) {
  let dogs = [], timers = []
  const picker = el('div', 'mpick'), body = el('div')
  root.append(picker, body)

  function show(id) {
    dogs.forEach(d => d.stop()); timers.forEach(clearInterval); dogs = []; timers = []
    for (const b of picker.children) b.classList.toggle('on', b.dataset.id === id)
    const m = MASCOTS[id]
    const row = el('div', 'cmprow')
    for (const mood of MOODS) {
      const fig = el('figure', 'mini'), box = el('div', 'box')
      box.dataset.mood = mood
      const face = el('div', 'face'), cv = el('canvas'), fx = el('canvas', 'fxmini')
      face.append(cv)
      box.append(el('i', 'radar'), el('i', 'radar r2'), el('i', 'ring'), face, fx)
      fig.append(box, el('figcaption', null, mood))
      row.append(fig)
      const dog = new Dog(cv, { mascot: m, scale: 2, fx })
      dog.setMood(mood, false)
      dogs.push(dog)
      if (mood === 'waiting') timers.push(setInterval(() => dog.react('bark'), 3500))
    }
    const wrap = el('div', 'clips')
    for (const [name, clip] of Object.entries(m.clips)) {
      const fig = el('figure'), cv = el('canvas')
      fig.append(cv, el('figcaption', null, `${name} · ${clip.frames.length}f${clip.loop ? ' · loop' : ''}`))
      wrap.append(fig)
      const dog = new Dog(cv, { mascot: m, scale: 3 })
      dog.mood = name === 'offline' ? 'offline' : 'idle'
      const run = () => dog.play([name])
      run()
      dogs.push(dog)
      if (!clip.loop) timers.push(setInterval(run, clip.frames.reduce((s, f) => s + f.ms, 0) + 900))
    }
    body.replaceChildren(row, el('h3', 'cliphead', `${m.name}: every clip`), wrap)
  }

  for (const m of Object.values(MASCOTS)) {
    const b = el('button', 'mbtn', m.name)
    b.type = 'button'; b.dataset.id = m.id
    b.addEventListener('click', () => show(m.id))
    picker.append(b)
  }
  show(mascot)
  return { show }
}

// gallery.html (Electron --gallery) mounts itself; preview.html calls mountGallery directly.
const own = document.getElementById('gallery-root')
if (own) mountGallery(own)
