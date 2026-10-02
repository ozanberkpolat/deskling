// Mascot: a little green alien, close-up (40x40 at 2x). Big rounded head wider at the top, huge
// slanted almond eyes, tiny mouth, no nose, two antennae with glowing tips, narrow silver-suited
// shoulders. Working = three-fingered hands on the laptop, antennae bobbing; waiting = antennae
// straight up, tips blinking to the orange accent. Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, poly, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20

export const COLORS = {
  U: '#8fe3c4', // skin
  W: '#4fb597', // skin shade
  3: '#7dffb0', // antenna glow
  4: '#e9ffd0', // antenna tip, bright
}
export const GREY = { U: '#b9bec5', W: '#8d939b', 3: '#a9aeb5', 4: '#d3d7dc' }

const mx = x => 2 * C - x            // mirror around the head axis

// antenna: polyline offsets from the base, last point = the tip
const ANT = {
  up: [[0, 0], [-1, -3.5], [-1.5, -7]],
  lean: [[0, 0], [-2, -3], [-4.5, -6]],
  lean2: [[0, 0], [1, -3.5], [1.5, -7]],
  droop: [[0, 0], [-4, -3.5], [-7.5, 0.5]],
}
const TIP = {
  bright: ['3', '4'], alert: ['a', 'Y'], dull: ['g', 'G'], flash: ['y', 'Y'],
}
// left/right antenna kinds can differ so they wiggle out of step
function antennae(l = 'up', r = l, tip = 'bright', dy = 0) {
  const sticks = layer(g => {
    for (const [side, kind] of [[-1, l], [1, r]]) {
      const bx = side < 0 ? 15 : mx(15), by = 9 + dy
      const pts = ANT[kind].map(([x, y]) => [bx + (side < 0 ? x : -x), by + y])
      // two pixels wide, so the stalk reads at 2x (one line, then the same one pixel toward the head axis)
      for (let i = 1; i < pts.length; i++) for (const dx of [0, -side]) line(g, pts[i - 1][0] + dx, pts[i - 1][1], pts[i][0] + dx, pts[i][1], 'W')
    }
  })
  const tips = layer(g => {
    for (const [side, kind] of [[-1, l], [1, r]]) {
      const bx = side < 0 ? 15 : mx(15), by = 9 + dy
      const [ox, oy] = ANT[kind][ANT[kind].length - 1]
      const x = bx + (side < 0 ? ox : -ox), y = by + oy
      ell(g, x, y, 2.4, 2.4, TIP[tip][0]); ell(g, x, y, 1.3, 1.3, TIP[tip][1])
    }
  })
  return compose(sticks, tips)
}

const body = (dy = 0) => layer(g => {
  ell(g, C, 46 + dy, 13, 12, 'L')
})
const suit = (dy = 0) => raw(g => {
  line(g, 14, 36 + dy, 20, 40 + dy, 'z'); line(g, 26, 36 + dy, 20, 40 + dy, 'z')
})

// almond eye, left-side coords (outer end up, inner end down); h = open amount
const ALMOND = [[8.5, 14.5], [12, 14], [17, 18.5], [17.5, 21.5], [13.5, 22.5], [9.5, 19.5]]
function eye(g, side, h, dy, glint = true) {
  const pts = ALMOND.map(([x, y]) => [side < 0 ? x : mx(x), 18.5 + dy + (y - 18.5) * h])
  poly(g, pts, 'n')
  if (glint && h > 0.5) px(g, [[side < 0 ? 13 : mx(13) - 1, Math.round(16.5 + dy + (h - 1) * 3)]], 'w')
}
const ARC = { // thin curves, left side coords
  closed: [[9, 17], [10, 18], [11, 19], [12, 19], [13, 20], [14, 20], [15, 20], [16, 20]],
  happy: [[9, 20], [10, 19], [11, 18], [12, 17], [13, 17], [14, 17], [15, 18], [16, 19]],
}
function arc(g, side, kind, dy) {
  px(g, ARC[kind].map(([x, y]) => [side < 0 ? x : mx(x) - 1, y + dy]), 'n')
  px(g, ARC[kind].map(([x, y]) => [side < 0 ? x : mx(x) - 1, y + dy + 1]), 'n')
}

// eyes: open|wide|half|closed|happy|sad; mouth: shut|open|smile|wub
function head({ eyes = 'open', mouth = 'shut', dy = 0 } = {}) {
  const shape = layer(g => {
    ell(g, C, 19 + dy, 14, 11.5, 'W'); ell(g, C, 26.5 + dy, 8.5, 6.5, 'W')
    ell(g, C, 17.8 + dy, 13, 10.3, 'U'); ell(g, C, 25 + dy, 7.5, 5.5, 'U')
  })
  return raw(g => {
    shape.forEach((r, y) => r.forEach((c, x) => { g[y][x] = c }))
    for (const side of [-1, 1]) {
      if (eyes === 'open') eye(g, side, 1, dy)
      if (eyes === 'wide') eye(g, side, 1.22, dy)
      if (eyes === 'half') eye(g, side, 0.45, dy, false)
      if (eyes === 'sad') { eye(g, side, 0.8, dy); line(g, side < 0 ? 12 : mx(12), 12 + dy, side < 0 ? 18 : mx(18), 15 + dy, 'W') }
      if (eyes === 'closed' || eyes === 'happy') arc(g, side, eyes, dy)
    }
    const m = 28 + dy
    if (mouth === 'shut') px(g, [[19, m], [20, m]], 'n')
    if (mouth === 'smile') px(g, [[17, m], [18, m + 1], [19, m + 1], [20, m + 1], [21, m + 1], [22, m]], 'n')
    if (mouth === 'open') ell(g, C, m + 1, 2.2, 2, 'n')
    if (mouth === 'wub') { ell(g, C, m + 1, 3, 2.6, 'n'); px(g, [[19, m + 2], [20, m + 2]], 'p') }
    // (3, 4) keep skin cheeks plain: no nose by design
  })
}

// three-fingered hand: palm + 3 finger pixels, fingers tap by `t`
function hands(t) {
  return layer(g => {
    for (const x of [10, 30]) {
      ell(g, x, 38, 3, 2.4, 'U')
      px(g, [[x - 2, 35 + (t ? 1 : 0)], [x, 35 + (t ? 0 : 1)], [x + 2, 35 + (t ? 1 : 0)]], 'U')
    }
  })
}
const laptop = () => layer(g => {
  rect(g, 12, 36, 28, 40, 'l'); line(g, 12, 36, 28, 36, 'L')
  px(g, [[19, 38], [20, 38], [21, 38]], 's')
})

const F = (rows, ms) => ({ rows, ms })
function pose({ face = {}, ant = ['up'], tip = 'bright', dy = 0, lap = null } = {}) {
  const parts = [antennae(ant[0], ant[1] || ant[0], tip, dy), body(dy), suit(dy), head({ ...face, dy })]
  if (lap !== null) parts.push(laptop(), hands(lap))
  return compose(...parts)
}

export function buildClips() {
  const asleep = (dy = 0, eyes = 'closed') => pose({ face: { eyes }, ant: ['droop'], tip: 'dull', dy: 2 + dy })
  const alert = (extra = {}, tip = 'bright', ant = ['up']) => pose({ face: { eyes: 'wide', ...extra }, ant, tip })
  const happy = (l, r, dy = 0, mouth = 'smile') => pose({ face: { eyes: 'happy', mouth }, ant: [l, r], tip: 'flash', dy })
  return {
    sleep: { loop: true, frames: [F(asleep(0), 1300), F(asleep(1), 1400), F(asleep(0, 'half'), 700), F(asleep(1), 1400)] },
    curl: { loop: false, frames: [F(pose({ face: { eyes: 'half' }, ant: ['lean'], tip: 'dull', dy: 1 }), 260), F(asleep(0), 300)] },
    wake: { loop: false, frames: [F(pose({ face: { eyes: 'half' }, ant: ['lean'], tip: 'dull', dy: 1 }), 240), F(pose({ ant: ['lean2'] }), 200)] },
    type: { loop: true, frames: [
      F(pose({ ant: ['lean', 'lean2'], lap: 0 }), 160), F(pose({ ant: ['up'], lap: 1 }), 160),
      F(pose({ ant: ['lean2', 'lean'], lap: 0 }), 160), F(pose({ ant: ['up'], lap: 1 }), 160),
      F(pose({ face: { eyes: 'closed' }, ant: ['lean', 'lean2'], lap: 0 }), 120), F(pose({ ant: ['up'], lap: 1 }), 160),
    ] },
    jump: { loop: false, frames: [
      F(happy('lean', 'lean2', 1), 120), F(shift(happy('lean2', 'lean'), -2), 110), F(shift(happy('lean', 'lean2'), -3), 140),
      F(shift(happy('lean2', 'lean'), -2), 110), F(happy('lean', 'lean2', 1), 120), F(happy('up', 'up'), 200),
    ] },
    wag: { loop: true, frames: [F(happy('lean', 'lean2'), 220), F(happy('lean2', 'lean'), 220), F(happy('lean', 'lean2'), 220), F(happy('up', 'up'), 300), F(pose({ ant: ['up'], face: { mouth: 'smile' } }), 800)] },
    sitUp: { loop: false, frames: [F(pose({ ant: ['lean'] }), 140), F(shift(alert({}, 'alert'), -1), 120), F(alert(), 160)] },
    stare: { loop: true, frames: [F(alert(), 500), F(alert({}, 'alert'), 400), F(alert(), 500), F(alert({}, 'alert'), 400), F(alert({ eyes: 'closed' }, 'alert'), 130), F(alert({}, 'alert'), 400)] },
    bark: { loop: false, frames: [
      F(shift(alert({ mouth: 'wub' }, 'flash', ['lean', 'lean2']), -1), 160), F(alert({}, 'alert'), 140),
      F(shift(alert({ mouth: 'wub' }, 'flash', ['lean2', 'lean']), -1), 200), F(alert({}, 'alert'), 300),
    ] },
    yawn: { loop: false, frames: [F(pose({ face: { eyes: 'half', mouth: 'open' }, ant: ['lean'], tip: 'dull' }), 700), F(pose({ face: { eyes: 'closed', mouth: 'open' }, ant: ['droop'], tip: 'dull', dy: 1 }), 700), F(pose({ face: { eyes: 'half' }, ant: ['lean'] }), 260), F(pose(), 300)] },
    oops: { loop: true, frames: [
      F(pose({ face: { eyes: 'sad' }, ant: ['droop'], tip: 'dull', dy: 2 }), 1500),
      F(pose({ face: { eyes: 'sad' }, ant: ['droop'], tip: 'dull', dy: 3 }), 700),
      F(pose({ face: { eyes: 'closed' }, ant: ['droop'], tip: 'dull', dy: 3 }), 300),
    ] },
  }
}

export const CLIPS = buildClips()

// beam: rings rise up a short tractor-beam column with sparkle dust
const ring = ['.yYYy.', 'yY..Yy']
export const FX = {
  beam: { ms: 130, frames: [
    [{ x: 9, y: 17, rows: ring }],
    [{ x: 9, y: 17, rows: ring }, { x: 9, y: 12, rows: ring }],
    [{ x: 9, y: 12, rows: ring }, { x: 9, y: 7, rows: ring }, { x: 5, y: 15, rows: ['y'] }],
    [{ x: 9, y: 7, rows: ring }, { x: 9, y: 2, rows: ['.yy.'] }, { x: 17, y: 12, rows: ['y'] }],
    [{ x: 9, y: 2, rows: ['.yy.'] }, { x: 6, y: 6, rows: ['y'] }],
    [],
  ] },
}
export const FX_FOR = { sleep: 'zzz', jump: 'beam', sitUp: 'bubble', stare: 'bubble', bark: 'sparkle', oops: 'oops' }

// ── pup: tiny alien (14x12) ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(
  pupR.raw(g => { pupR.px(g, [[4, 2 - up], [3, 1 - up], [10, 2 - up], [11, 1 - up]], 'k') }),
  pupR.layer(g => {
    pupR.ell(g, 7, 7.5 - up, 5.5, 4.4, 'U')
    pupR.ell(g, 3, 1 - up + 0.5, 1.2, 1.2, '4'); pupR.ell(g, 11, 1 - up + 0.5, 1.2, 1.2, '4')
  }),
  pupR.raw(g => { pupR.px(g, [[3, 6 - up], [4, 7 - up], [10, 6 - up], [9, 7 - up]], 'n'); pupR.px(g, [[7, 9 - up]], 'n') }),
)
export const PUP = [pupFrame(0), pupFrame(1)]
