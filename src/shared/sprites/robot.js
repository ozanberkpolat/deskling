// Mascot: a pixel robot whose face is a small screen (40x40 at 2x). Working = code scrolls on the
// screen; waiting = the antenna turns into a red blinking siren and the screen shows "!"; finished =
// a check mark and confetti; offline = static snow on the screen (its own `offline` clip). Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20

export const COLORS = {
  t: '#9aaccc', // steel
  T: '#5b6b88', // dark steel
  S: '#0f2a26', // screen
  V: '#2a8f6d', // screen, dim
  K: '#4ff0b0', // screen, lit
  A: '#ff4d4d', // siren
}
export const GREY = { t: '#9aa0a8', T: '#686d75', S: '#2a2e35', V: '#5d636b', K: '#b8bcc3', A: '#8e939b' }

// The screen is 16x12 at (12,11). Faces are drawn into it with K (lit) / V (dim).
const SX = 12, SY = 11, SW = 16, SH = 12
const at = (list, c) => g => px(g, list.map(([x, y]) => [SX + x, SY + y]), c)
const SCREENS = {
  eyes: [at([[3, 3], [4, 3], [3, 4], [4, 4], [3, 5], [4, 5], [11, 3], [12, 3], [11, 4], [12, 4], [11, 5], [12, 5]], 'K'), at([[5, 9], [6, 10], [7, 10], [8, 10], [9, 10], [10, 9]], 'K')],
  blink: [at([[3, 5], [4, 5], [11, 5], [12, 5]], 'K'), at([[5, 9], [6, 10], [7, 10], [8, 10], [9, 10], [10, 9]], 'K')],
  happy: [at([[2, 5], [3, 4], [4, 3], [5, 4], [6, 5], [9, 5], [10, 4], [11, 3], [12, 4], [13, 5], [5, 8], [6, 9], [7, 10], [8, 10], [9, 9], [10, 8]], 'K')],
  check: [at([[3, 6], [4, 7], [5, 8], [6, 9], [7, 8], [8, 7], [9, 6], [10, 5], [11, 4], [12, 3]], 'K'), at([[4, 6], [5, 7], [6, 8], [7, 7], [8, 6], [9, 5], [10, 4], [11, 3]], 'K')],
  bang: [at([[7, 1], [8, 1], [7, 2], [8, 2], [7, 3], [8, 3], [7, 4], [8, 4], [7, 5], [8, 5], [7, 6], [8, 6], [7, 9], [8, 9], [7, 10], [8, 10]], 'K')],
  wide: [at([[2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [5, 3], [2, 4], [5, 4], [2, 5], [3, 5], [4, 5], [5, 5], [10, 2], [11, 2], [12, 2], [13, 2], [10, 3], [13, 3], [10, 4], [13, 4], [10, 5], [11, 5], [12, 5], [13, 5], [3, 3], [4, 4], [11, 3], [12, 4]], 'K'), at([[6, 9], [7, 9], [8, 9], [9, 9]], 'K')],
  zz: [at([[3, 4], [4, 4], [5, 4], [5, 5], [4, 6], [3, 7], [4, 7], [5, 7], [8, 2], [9, 2], [10, 2], [11, 2], [11, 3], [10, 4], [9, 5], [8, 6], [8, 7], [9, 7], [10, 7], [11, 7]], 'V')],
  x: [at([[4, 2], [5, 3], [6, 4], [7, 5], [8, 6], [9, 7], [10, 8], [11, 9], [11, 2], [10, 3], [9, 4], [8, 5], [7, 6], [6, 7], [5, 8], [4, 9], [5, 2], [10, 2], [5, 9], [10, 9]], 'A')],
  dots: [at([[3, 6], [7, 6], [11, 6]], 'K'), at([[4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [4, 10], [8, 10], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [9, 10], [5, 10]], 'V'), at([[5, 10]], 'A')],
}
// code lines that scroll up one row per frame
const CODE = [[0, 7], [2, 11], [2, 6], [0, 9], [2, 13], [4, 8], [2, 5], [0, 10], [2, 12], [0, 4]]
const code = f => [g => {
  for (let r = 0; r < 6; r++) {
    const [ind, len] = CODE[(r + f) % CODE.length]
    line(g, SX + 1 + ind, SY + 1 + r * 2, SX + 1 + ind + len - 1, SY + 1 + r * 2, r === 5 ? 'K' : 'V')
  }
  if (f % 2) px(g, [[SX + 1 + CODE[(5 + f) % CODE.length][0] + CODE[(5 + f) % CODE.length][1], SY + 11]], 'K')   // cursor
}]
// static snow, deterministic per frame
const snow = f => [g => {
  let s = 1234 + f * 977
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const v = s % 7
    if (v < 2) g[SY + y][SX + x] = 'K'; else if (v < 4) g[SY + y][SX + x] = 'V'
  }
}]

// screen: name in SCREENS or a draw list; siren: 0 off | 1 dim | 2 bright; arms: lift or null
function pose({ screen = 'eyes', siren = 0, dy = 0, lift = null, kb = false, bent = false } = {}) {
  const head = layer(g => {
    rect(g, 8, 6 + dy, 31, 26 + dy, 't')
    rect(g, 6, 13 + dy, 7, 19 + dy, 'T'); rect(g, 32, 13 + dy, 33, 19 + dy, 'T')       // ear bolts
    if (bent) { line(g, C, 5 + dy, C + 2, 3 + dy, 'T'); line(g, C - 1, 5 + dy, C + 1, 3 + dy, 'T') }       // antenna, bent
    else { line(g, C, 2 + dy, C, 5 + dy, 'T'); line(g, C - 1, 2 + dy, C - 1, 5 + dy, 'T') }                // antenna
  })
  const ball = layer(g => ell(g, bent ? C + 2.5 : C, (bent ? 2.5 : 1.5) + dy, 2, 2, siren ? 'A' : 'T'))
  const screenL = raw(g => {
    rect(g, SX - 1, SY - 1 + dy, SX + SW, SY + SH + dy, 'T')
    rect(g, SX, SY + dy, SX + SW - 1, SY + SH - 1 + dy, 'S')
    const draws = typeof screen === 'string' ? SCREENS[screen] : screen
    if (dy) { const tmp = raw(h => draws.forEach(d => d(h))); tmp.forEach((r, y) => r.forEach((c, x) => { if (c !== '.' && y + dy < H) g[y + dy][x] = c })) }
    else draws.forEach(d => d(g))
    if (siren === 2) px(g, [[C - 4, 1 + dy], [C + 3, 1 + dy], [C - 3, 0 + dy], [C + 2, 0 + dy]], 'A')
  })
  const chest = layer(g => {
    rect(g, 11, 29, 28, 40, 't')
    rect(g, 14, 32, 25, 36, 'T')
    px(g, [[16, 34], [19, 34], [22, 34]], siren ? 'A' : 'K')
    line(g, C - 1, 27, C - 1, 28, 'T'); line(g, C, 27, C, 28, 'T')
  })
  const board = kb && layer(g => { rect(g, 5, 35, 34, 38, 'l'); for (let x = 7; x < 33; x += 3) px(g, [[x, 36], [x + 1, 36]], 'L') })
  const arms = lift && layer(g => {
    rect(g, 9, 33 - lift[0], 13, 35 - lift[0], 'T')
    rect(g, 26, 33 - lift[1], 30, 35 - lift[1], 'T')
  })
  return compose(chest, head, ball, screenL, board, arms)
}

const F = (rows, ms) => ({ rows, ms })
export function buildClips() {
  return {
    sleep: { loop: true, frames: [F(pose({ screen: 'zz', dy: 1 }), 1400), F(pose({ screen: 'zz', dy: 2 }), 1400)] },
    curl: { loop: false, frames: [F(pose({ screen: 'blink' }), 260), F(pose({ screen: 'zz', dy: 1 }), 300)] },
    wake: { loop: false, frames: [F(pose({ screen: 'blink', dy: 1 }), 220), F(pose(), 200)] },
    type: { loop: true, frames: Array.from({ length: 10 }, (_, f) => F(pose({ screen: code(f), kb: true, lift: f % 2 ? [2, 0] : [0, 2] }), 160)) },
    jump: { loop: false, frames: [
      F(pose({ screen: 'check', dy: 1 }), 120), F(shift(pose({ screen: 'check' }), -2), 110), F(shift(pose({ screen: 'check' }), -4), 150),
      F(shift(pose({ screen: 'check' }), -3), 110), F(pose({ screen: 'check', dy: 1 }), 120), F(pose({ screen: 'happy' }), 200),
    ] },
    wag: { loop: true, frames: [F(pose({ screen: 'happy' }), 700), F(pose({ screen: 'check' }), 500), F(pose({ screen: 'happy' }), 900), F(pose({ screen: 'blink' }), 140)] },
    sitUp: { loop: false, frames: [F(pose(), 140), F(shift(pose({ screen: 'wide', siren: 2 }), -1), 120), F(pose({ screen: 'wide', siren: 1 }), 160)] },
    stare: { loop: true, frames: [
      F(pose({ screen: 'wide', siren: 2 }), 350), F(pose({ screen: 'wide', siren: 1 }), 350), F(pose({ screen: 'wide', siren: 2 }), 350),
      F(pose({ screen: 'wide', siren: 1 }), 350), F(pose({ screen: 'blink', siren: 2 }), 200), F(pose({ screen: 'wide', siren: 1 }), 350),
    ] },
    bark: { loop: false, frames: [
      F(shift(pose({ screen: 'bang', siren: 2 }), -1), 130), F(pose({ screen: 'wide', siren: 1 }), 110),
      F(shift(pose({ screen: 'bang', siren: 2 }), -1), 150), F(pose({ screen: 'wide', siren: 1 }), 300),
    ] },
    oops: { loop: true, frames: [
      F(pose({ screen: 'x', bent: true, dy: 1 }), 700), F(pose({ screen: [], bent: true, dy: 1 }), 300),
      F(pose({ screen: 'x', bent: true, dy: 1 }), 700), F(pose({ screen: 'dots', bent: true, dy: 2 }), 900),
    ] },
    yawn: { loop: false, frames: [F(pose({ screen: 'blink' }), 200), F(pose({ screen: 'dots' }), 900), F(pose({ screen: 'blink' }), 200), F(pose(), 300)] },
    offline: { loop: true, frames: Array.from({ length: 4 }, (_, f) => F(pose({ screen: snow(f), dy: 1 }), 120)) },
  }
}

export const CLIPS = buildClips()

const bits = (cs, n) => cs.map((c, i) => ({ x: (i * 7 + n * 5) % 21, y: (i * 11 + n * 9) % 20, rows: [c] }))
export const FX = {
  confetti: { ms: 160, frames: [
    bits(['y', 'K', 'p', 's'], 1), bits(['K', 'a', 'y', 'p', 's', 'y'], 2), bits(['p', 'y', 's', 'K', 'a', 'K'], 3),
    bits(['s', 'K', 'y', 'a'], 4), bits(['y', 'p'], 5), [],
  ] },
  beep: { ms: 150, anchor: 'mid', mirror: true, frames: [
    [{ x: 1, y: 10, rows: ['K', 'K'] }],
    [{ x: 1, y: 10, rows: ['K', 'K'] }, { x: 4, y: 8, rows: ['K.', '.K', '.K', '.K', 'K.'] }],
    [{ x: 4, y: 8, rows: ['K.', '.K', '.K', '.K', 'K.'] }, { x: 8, y: 6, rows: ['K..', '.K.', '..K', '..K', '..K', '.K.', 'K..'] }],
    [{ x: 8, y: 6, rows: ['K..', '.K.', '..K', '..K', '..K', '.K.', 'K..'] }],
    [],
  ] },
}
// sleep: the screen already says zZ; offline: the static is on the screen, no cloud
export const FX_FOR = { jump: 'confetti', sitUp: 'bubble', stare: 'bubble', bark: 'beep', offline: null, oops: null }

// ── pup: a tiny companion (14x12) shown beside the box for each running subagent ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(pupR.layer(g => {
  pupR.rect(g, 2, 3 - up, 11, 9 - up, 't')
  pupR.rect(g, 5, 10 - up, 8, 11 - up, 'T')
  pupR.line(g, 6, 0 - up, 6, 2 - up, 'T')
}), pupR.raw(g => { pupR.rect(g, 3, 4 - up, 10, 8 - up, 'S'); pupR.px(g, [[5, 5 - up], [8, 5 - up], [5, 6 - up], [8, 6 - up], [6, 7 - up], [7, 7 - up]], 'K'); pupR.px(g, [[6, 0 - up]], 'A') }))
export const PUP = [pupFrame(0), pupFrame(1)]
