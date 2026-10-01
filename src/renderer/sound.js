// Each mascot's voice, synthesised with WebAudio (no sound files). The AudioContext is created on
// first use. `volume` 0..1 is scaled down here: these are short and should stay polite.
let ac = null

function ctx(volume) {
  ac ??= new AudioContext()
  if (ac.state === 'suspended') ac.resume()
  const out = ac.createGain()
  out.gain.value = volume
  out.connect(ac.destination)
  return { t: ac.currentTime, out }
}

// one shaped note: type, from→to Hz over `len`, attack/decay envelope
function note({ t, out }, type, at, f0, f1, len, level) {
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t + at)
  o.frequency.exponentialRampToValueAtTime(f1, t + at + len * 0.6)
  g.gain.setValueAtTime(0, t + at)
  g.gain.linearRampToValueAtTime(level, t + at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, t + at + len)
  o.connect(g).connect(out)
  o.start(t + at)
  o.stop(t + at + len + 0.02)
  return o
}

export const VOICES = {
  // shiba: two quick square-wave "yip"s
  yip(v) {
    const c = ctx(0.18 * v)
    note(c, 'square', 0, 880, 1240, 0.1, 1)
    note(c, 'square', 0.13, 1050, 1480, 0.1, 1)
  },
  // dragon: a low growl under a flame "whoosh" (noise through a sweeping band-pass)
  growl(v) {
    const c = ctx(0.3 * v)
    note(c, 'sawtooth', 0, 95, 70, 0.45, 0.5)
    const len = 0.55, buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain()
    src.buffer = buf
    bp.type = 'bandpass'; bp.Q.value = 0.8
    bp.frequency.setValueAtTime(400, c.t + 0.05); bp.frequency.exponentialRampToValueAtTime(2600, c.t + 0.35)
    g.gain.setValueAtTime(0, c.t + 0.05); g.gain.linearRampToValueAtTime(0.9, c.t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, c.t + len)
    src.connect(bp).connect(g).connect(c.out)
    src.start(c.t + 0.05)
  },
  // owl: "hoo-hoo", two soft sine notes with a little vibrato
  hoot(v) {
    const c = ctx(0.35 * v)
    for (const [at, f] of [[0, 520], [0.32, 470]]) {
      const o = note(c, 'sine', at, f, f * 0.94, 0.26, 1)
      const lfo = ac.createOscillator(), depth = ac.createGain()
      lfo.frequency.value = 7; depth.gain.value = 9
      lfo.connect(depth).connect(o.frequency)
      lfo.start(c.t + at); lfo.stop(c.t + at + 0.3)
    }
  },
  // robot: two short beeps
  beep(v) {
    const c = ctx(0.16 * v)
    note(c, 'square', 0, 1320, 1320, 0.08, 1)
    note(c, 'square', 0.12, 1760, 1760, 0.08, 1)
  },
  // cat: one "mew", a triangle that rises then falls
  meow(v) {
    const c = ctx(0.3 * v)
    note(c, 'triangle', 0, 620, 900, 0.18, 1)
    note(c, 'triangle', 0.16, 900, 560, 0.2, 0.8)
  },
  // frog: "rib-bit", two low buzzy bursts (square under a fast tremolo)
  ribbit(v) {
    const c = ctx(0.22 * v)
    for (const [at, f] of [[0, 210], [0.17, 260]]) {
      const o = note(c, 'square', at, f, f * 0.9, 0.12, 1)
      const lfo = ac.createOscillator(), depth = ac.createGain()
      lfo.frequency.value = 38; depth.gain.value = 60
      lfo.connect(depth).connect(o.frequency)
      lfo.start(c.t + at); lfo.stop(c.t + at + 0.14)
    }
  },
  // ghost: a slow wobbling "boo" sliding down
  boo(v) {
    const c = ctx(0.32 * v)
    const o = note(c, 'sine', 0, 330, 200, 0.55, 1)
    const lfo = ac.createOscillator(), depth = ac.createGain()
    lfo.frequency.value = 5; depth.gain.value = 14
    lfo.connect(depth).connect(o.frequency)
    lfo.start(c.t); lfo.stop(c.t + 0.58)
  },
  // alien: a quick high warble
  warble(v) {
    const c = ctx(0.2 * v)
    const o = note(c, 'sine', 0, 1100, 1700, 0.32, 1)
    const lfo = ac.createOscillator(), depth = ac.createGain()
    lfo.frequency.value = 22; depth.gain.value = 180
    lfo.connect(depth).connect(o.frequency)
    lfo.start(c.t); lfo.stop(c.t + 0.34)
  },
  // rubber duck: a squeaky "quack", nasal sawtooth through a band-pass
  quack(v) {
    const c = ctx(0.3 * v)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2.5
    bp.connect(c.out)
    note({ t: c.t, out: bp }, 'sawtooth', 0, 520, 380, 0.16, 1)
    note({ t: c.t, out: bp }, 'sawtooth', 0.19, 500, 360, 0.14, 0.8)
  },
  // cactus: two soft bell tones, like a flower opening
  chime(v) {
    const c = ctx(0.22 * v)
    note(c, 'sine', 0, 1568, 1568, 0.35, 1)
    note(c, 'sine', 0.12, 2093, 2093, 0.45, 0.8)
  },
}

export function play(voice, volume = 0.5) {
  if (volume <= 0) return
  ;(VOICES[voice] || VOICES.yip)(volume)
}
