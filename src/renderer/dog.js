// The mascot player: picks clips for a mood and plays them with setTimeout (no rAF loop, so an idle
// mascot costs a timer every second or so). Effects (zzz, "!", fire, …) go on a separate small canvas
// outside the box, cycled on their own timer. The mascot can be swapped live (setMascot).
import { FX_W, FX_H } from '../shared/sprites/overlays.js'
import { effectFor } from '../shared/sprites/mascots.js'
import { paint } from './draw.js'

const ASLEEP = [undefined, 'idle', 'offline']

// Which clips to play when the mood becomes `mood`, given whether it was asleep.
export function planFor(mood, asleep, hasOffline = false) {
  const wake = asleep ? ['wake'] : []
  switch (mood) {
    case 'working': return [...wake, 'type']
    case 'finished': return [...wake, 'jump', 'wag']
    case 'waiting': return [...wake, 'sitUp', 'stare']
    case 'error': return [...wake, 'oops']
    case 'offline': if (hasOffline) return ['offline']
    // falls through: offline without its own clip = grey sleep
    default: return asleep ? ['sleep'] : ['curl', 'sleep']        // idle
  }
}
// the clip a mood settles into (used when the mascot changes mid-mood)
const LOOP = { working: 'type', finished: 'wag', waiting: 'stare', error: 'oops', idle: 'sleep' }

export class Dog {
  // mascot: an entry of MASCOTS; fx: optional canvas for the effects
  constructor(canvas, { mascot, scale = 2, fx = null, fxScale = 2 }) {
    this.cv = canvas
    this.ctx = canvas.getContext('2d')
    this.fx = fx
    this.fxScale = fxScale
    if (fx) { fx.width = FX_W * fxScale; fx.height = FX_H * fxScale; this.fctx = fx.getContext('2d') }
    this.scale = scale
    this.mood = undefined
    this.fast = false
    this.queue = []
    this.timer = this.otimer = null
    this.oi = 0
    this.setMascot(mascot)
  }

  setMascot(m) {
    if (m === this.m) return
    this.m = m
    const f = Object.values(m.clips)[0].frames[0].rows
    this.cv.width = f[0].length * this.scale
    this.cv.height = f.length * this.scale
    this.effect = undefined
    if (this.mood !== undefined) {
      const loop = this.mood === 'offline' ? (m.clips.offline ? 'offline' : 'sleep') : LOOP[this.mood]
      this.play([loop])
    }
  }

  setMood(mood, fast = false) {
    this.fast = fast
    if (mood === this.mood) return
    clearTimeout(this.petTimer); this.override = null
    const asleep = ASLEEP.includes(this.mood)
    this.mood = mood
    this.play(planFor(mood, asleep, !!this.m.clips.offline))
  }

  // One-shot reactions on top of the mood: a bark synced to the chirp, a jump on celebrate, a yawn.
  react(kind) {
    if (kind === 'bark' && this.mood === 'waiting') {
      // mid sit-up (or wake): bark right after it instead of cutting the transition short
      const i = this.queue.indexOf('stare')
      if (i >= 0 && !this.queue.includes('bark')) this.queue.splice(i, 0, 'bark')
      else if (i < 0) this.play(['bark', 'stare'])
    }
    // a yawn (context past 80%) never interrupts waiting or an offline mascot; it plays, then resumes
    if (kind === 'yawn' && !['waiting', 'offline'].includes(this.mood)) {
      const back = this.m.clips[this.name]?.loop ? this.name : (this.queue.at(-1) || this.name)
      this.play(['yawn', back])
    }
    // petted (press and hold): a short happy wiggle with hearts, then back to whatever the mood is
    if (kind === 'pet' && this.mood !== 'offline') {
      clearTimeout(this.petTimer)
      this.override = this.m.fx.hearts
      this.play(['wag'])
      this.petTimer = setTimeout(() => {
        this.override = null
        this.play([LOOP[this.mood] || 'sleep'])
      }, 1500)
    }
    if (kind === 'celebrate' && this.mood === 'finished' && this.name !== 'jump' && !this.queue.includes('jump')) this.play(['jump', 'wag'])
  }

  play(seq) {
    this.queue = seq.slice(1)
    this.start(seq[0])
  }

  start(name) {
    this.name = name
    this.i = 0
    const eff = this.override || effectFor(this.m, name, this.mood === 'offline')
    if (eff !== this.effect) {
      this.effect = eff
      this.oi = 0
      if (this.fx) {
        this.fx.dataset.anchor = eff?.anchor || 'top'
        this.fx.toggleAttribute('data-mirror', !!eff?.mirror)
      }
      this.tickOverlay()
    }
    this.step()
  }

  step() {
    clearTimeout(this.timer)
    const clip = this.m.clips[this.name]
    const f = clip.frames[this.i]
    this.draw(f.rows)
    const ms = this.name === 'type' && this.fast ? f.ms * 0.55 : f.ms
    this.timer = setTimeout(() => {
      if (++this.i < clip.frames.length) return this.step()
      if (this.queue.length) return this.start(this.queue.shift())
      if (clip.loop) { this.i = 0; this.step() }
      else this.i--                                                  // hold the last frame
    }, ms)
  }

  tickOverlay() {
    clearTimeout(this.otimer)
    this.drawFx()
    if (this.effect) this.otimer = setTimeout(() => { this.oi++; this.tickOverlay() }, this.effect.ms || 450)
  }

  palette() { return this.mood === 'offline' ? this.m.grey : this.m.colors }

  draw(rows) {
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height)
    paint(this.ctx, rows, this.palette(), this.scale)
  }

  drawFx() {
    if (!this.fctx) return
    this.fctx.clearRect(0, 0, this.fx.width, this.fx.height)
    const frames = this.effect?.frames
    if (frames) for (const o of frames[this.oi % frames.length]) paint(this.fctx, o.rows, this.palette(), this.fxScale, o.x, o.y)
  }

  stop() { clearTimeout(this.timer); clearTimeout(this.otimer); clearTimeout(this.petTimer) }
}
