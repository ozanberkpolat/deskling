// Mascot: a friendly sheet ghost (40x40 at 2x). Dome head, wavy hem, stubby arms, big black eyes,
// pink blush. It floats: loops bob and the hem waves between two shapes. Asleep it turns see-through,
// offline it is almost invisible (its own `offline` clip). Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, poly, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20

export const COLORS = {
  P: '#f1edff', // sheet, lit
  R: '#b6aae0', // sheet, shade
  2: '#8d82c2', // inner line
}
export const GREY = { P: '#d5d7dc', R: '#a3a7af', 2: '#7e838b' }

const HEM = 33 // y where the scallops sit

// union shape of head + body + wavy hem; `ph` 0|1 flips the wave
function sheet(g, c, on, ph, sx = 0, sy = 0) {
  ell(g, C + sx, 16 + sy, 12.5, 12.5, c, on)
  poly(g, [[7.5 + sx, 16 + sy], [32.5 + sx, 16 + sy], [34 + sx, HEM + sy], [6 + sx, HEM + sy]], c, on)
  for (let i = 0; i < 4; i++) {                       // 4 scallops, 6.5 px wide
    const cx = 9.2 + i * 6.8 + (ph ? 0 : 0) + sx
    ell(g, cx, HEM + (i + ph) % 2 * 2 + sy, 3.5, 3.4 + ((i + ph) % 2 ? 0.8 : 0), c, on)
  }
}

function arm(g, side, kind) {
  const X = x => side < 0 ? x : 2 * C - x
  if (kind === 'down') ell(g, X(5.5), 26, 3.4, 5, 'P')
  if (kind === 'fwd') ell(g, X(11), 29, 5, 2.6, 'P')
  if (kind === 'up') { ell(g, X(4.5), 15, 2.8, 5, 'P'); ell(g, X(4), 9.5, 2.5, 2.6, 'P') }
  if (kind === 'out') ell(g, X(5), 22, 5, 2.6, 'P')
}

// eyes: open|wide|closed|happy|sad|read ; mouth: smile|o|wide|none|frown
function pose({ eyes = 'open', mouth = 'smile', arms = ['down', 'down'], ph = 0, look = 0, kb = false } = {}) {
  const a = layer(g => { arm(g, -1, arms[0]); arm(g, 1, arms[1]) })
  const body = layer(g => { sheet(g, 'R', null, ph); sheet(g, 'P', 'R', ph, -2.2, -1.4) })
  const face = raw(g => {
    for (const s of [-1, 1]) {
      const cx = C + s * 5.2 + look, ey = 16, e = Math.round(cx)
      if (eyes === 'open' || eyes === 'wide' || eyes === 'read' || eyes === 'sad') {
        const rx = eyes === 'wide' ? 3.3 : 2.6, ry = eyes === 'wide' ? 4.8 : eyes === 'sad' ? 3 : 3.8
        ell(g, cx, ey + (eyes === 'sad' ? 1 : 0), rx, ry, 'n')
        if (eyes !== 'read') px(g, [[e - 1, ey - 2 - (eyes === 'wide' ? 1 : 0)]], 'w')
        if (eyes === 'sad') line(g, e - s * 4, ey - 4, e + s * 3, ey - 2, '2')   // brow slants up toward the middle
        if (eyes === 'read') px(g, [[e, ey + 2]], 'w')
      }
      if (eyes === 'closed') line(g, e - 3, ey + 1, e + 3, ey + 1, 'n')
      if (eyes === 'happy') px(g, [[e - 3, ey + 2], [e - 2, ey + 1], [e - 1, ey], [e, ey], [e + 1, ey], [e + 2, ey + 1], [e + 3, ey + 2]], 'n')
      ell(g, C + s * 9.6 + look, 21.5, 2.4, 1.6, 'p')                              // blush
    }
    const m = C + look
    if (mouth === 'smile') px(g, [[m - 2, 22], [m - 1, 23], [m, 23], [m + 1, 22]], 'n')
    if (mouth === 'o') ell(g, m, 24, 1.8, 2.3, 'n')
    if (mouth === 'wide') { ell(g, m, 25, 4.2, 4.8, 'n'); ell(g, m, 27.5, 2.6, 1.6, 'p') }
    if (mouth === 'frown') px(g, [[m - 2, 24], [m - 1, 23], [m, 23], [m + 1, 24]], 'n')
    if (mouth === 'flat') px(g, [[m - 1, 23], [m, 23]], 'n')
    // inner fold line along the hem
    for (let x = 12; x < 30; x += 6) px(g, [[x, HEM - 3], [x + 1, HEM - 2]], '2')
  })
  const board = kb && layer(g => { rect(g, 9, 32, 30, 36, 'l'); rect(g, 11, 33, 28, 34, 's'); px(g, [[9, 36], [30, 36]], 'L') })
  const kbArms = kb && layer(g => { ell(g, 14, 30, 3, 2, 'P'); ell(g, 26, 30, 3, 2, 'P') })
  return compose(a, body, face, kbArms, board)
}

// x-shear around the middle: the hem swings opposite the head
const tilt = (f, t) => f.map((r, y) => {
  const o = Math.round(t * (20 - y) / 20)
  return o === 0 ? r : o > 0 ? '.'.repeat(o) + r.slice(0, -o) : r.slice(-o) + '.'.repeat(-o)
})
// see-through: replace bright pixels by shade on a checker
const sheer = (f, k = 2) => f.map((r, y) => r.split('').map((c, x) => (c === 'P' && (x + y) % k === 0 ? 'R' : c)).join(''))
// almost invisible: dotted outline, faint shade, eyes only
const faint = f => f.map((r, y) => r.split('').map((c, x) => {
  if (c === 'k') return (x + y) % 2 ? '.' : 'k'
  if (c === 'P') return '.'
  if (c === 'R') return (x * 3 + y * 5) % 7 === 0 ? 'R' : '.'
  if (c === 'p' || c === '2') return '.'
  return c
}).join(''))

const F = (rows, ms) => ({ rows, ms })

export function buildClips() {
  const z = (dy, extra = {}) => sheer(shift(pose({ eyes: 'closed', mouth: 'flat', ph: 0, ...extra }), dy), 2)
  const alert = (dy = 0, extra = {}) => shift(pose({ eyes: 'wide', mouth: 'o', arms: ['out', 'out'], ...extra }), dy)
  const happy = (extra = {}) => pose({ eyes: 'happy', mouth: 'smile', ...extra })
  const tw = (ph, look, arms) => pose({ eyes: 'read', mouth: 'flat', arms, kb: true, ph, look })
  return {
    sleep: { loop: true, frames: [F(z(2), 1200), F(z(3, { ph: 1 }), 1300), F(z(2), 1200), F(z(1, { ph: 1 }), 1300)] },
    curl: { loop: false, frames: [F(pose({ eyes: 'closed', mouth: 'flat' }), 260), F(z(2), 300)] },
    wake: { loop: false, frames: [F(shift(pose({ eyes: 'closed', mouth: 'flat' }), 1), 220), F(pose({ eyes: 'wide', mouth: 'o' }), 160), F(pose(), 160)] },
    type: { loop: true, frames: [
      F(tw(0, -2, ['fwd', 'fwd']), 260), F(tw(1, -1, ['fwd', 'fwd']), 260), F(tw(0, 0, ['fwd', 'fwd']), 260), F(tw(1, 1, ['fwd', 'fwd']), 260),
      F(tw(0, 2, ['fwd', 'fwd']), 260), F(tw(1, 1, ['fwd', 'fwd']), 260), F(tw(0, 0, ['fwd', 'fwd']), 260), F(tw(1, -1, ['fwd', 'fwd']), 260),
    ] },
    jump: { loop: false, frames: [
      F(happy({ arms: ['up', 'up'], ph: 1 }), 120), F(shift(tilt(happy({ arms: ['up', 'up'] }), 4), -3), 110),
      F(shift(happy({ arms: ['up', 'up'], ph: 1 }), -5), 140), F(shift(tilt(happy({ arms: ['up', 'up'] }), -4), -3), 110),
      F(happy({ arms: ['out', 'out'], ph: 1 }), 120), F(happy(), 200),
    ] },
    wag: { loop: true, frames: [
      F(tilt(happy({ arms: ['up', 'out'] }), 3), 220), F(shift(happy({ ph: 1 }), -1), 200), F(tilt(happy({ arms: ['out', 'up'], ph: 1 }), -3), 220),
      F(shift(happy(), -1), 200), F(shift(pose({ eyes: 'closed', mouth: 'smile', ph: 1 }), -1), 140),
    ] },
    sitUp: { loop: false, frames: [F(pose(), 140), F(alert(-2, { ph: 1 }), 120), F(alert(-3), 160)] },
    stare: { loop: true, frames: [
      F(alert(-3), 600), F(alert(-4, { ph: 1 }), 600), F(alert(-3), 500), F(alert(-3, { eyes: 'closed' }), 130), F(alert(-4, { ph: 1 }), 600),
    ] },
    bark: { loop: false, frames: [
      F(pose({ eyes: 'wide', mouth: 'wide', arms: ['up', 'up'] }), 170), F(shift(pose({ eyes: 'wide', mouth: 'wide', arms: ['up', 'up'], ph: 1 }), -2), 200),
      F(pose({ eyes: 'wide', mouth: 'wide', arms: ['up', 'up'], ph: 1 }), 170), F(alert(-3), 300),
    ] },
    yawn: { loop: false, frames: [
      F(pose({ eyes: 'closed', mouth: 'flat' }), 200), F(pose({ eyes: 'closed', mouth: 'wide', arms: ['up', 'up'] }), 800),
      F(pose({ eyes: 'closed', mouth: 'o', ph: 1 }), 260), F(pose(), 300),
    ] },
    oops: { loop: true, frames: [
      F(shift(pose({ eyes: 'sad', mouth: 'frown' }), 2), 1400), F(shift(pose({ eyes: 'sad', mouth: 'frown', ph: 1, look: -1 }), 3), 800),
      F(shift(pose({ eyes: 'closed', mouth: 'frown', ph: 1 }), 3), 300),
    ] },
    offline: { loop: true, frames: [
      F(faint(pose({ eyes: 'open', mouth: 'none', ph: 0 })), 1400), F(faint(shift(pose({ eyes: 'open', mouth: 'none', ph: 1 }), -1)), 1400),
      F(faint(pose({ eyes: 'closed', mouth: 'none', ph: 1 })), 200), F(faint(shift(pose({ eyes: 'open', mouth: 'none', ph: 0 }), -1)), 1000),
    ] },
  }
}

export const CLIPS = buildClips()

export const FX = {
  boo: { ms: 170, anchor: 'mid', mirror: true, frames: [
    [{ x: 2, y: 8, rows: ['2.2', '222'] }],
    [{ x: 1, y: 6, rows: ['22.', '2.2', '22.', '2.2', '22.'] }, { x: 6, y: 8, rows: ['.2.', '2.2', '2.2', '.2.'] }],
    [{ x: 1, y: 4, rows: ['22.', '2.2', '22.', '2.2', '22.'] }, { x: 6, y: 6, rows: ['.2.', '2.2', '2.2', '.2.'] }, { x: 11, y: 6, rows: ['.2.', '2.2', '2.2', '.2.'] }],
    [{ x: 1, y: 4, rows: ['22.', '2.2', '22.', '2.2', '22.'] }, { x: 6, y: 6, rows: ['.2.', '2.2', '2.2', '.2.'] }, { x: 11, y: 6, rows: ['.2.', '2.2', '2.2', '.2.'] }, { x: 16, y: 5, rows: ['2', '2', '.', '2'] }],
    [],
  ] },
  wisps: { ms: 220, frames: [
    [{ x: 4, y: 16, rows: ['.R', 'R.', '.R'] }],
    [{ x: 5, y: 12, rows: ['.R', 'R.', '.R'] }, { x: 14, y: 14, rows: ['R.', '.R', 'R.'] }],
    [{ x: 6, y: 8, rows: ['.R', 'R.', '.R'] }, { x: 15, y: 9, rows: ['R.', '.R', 'R.'] }, { x: 10, y: 16, rows: ['.R', 'R.', '.R'] }],
    [{ x: 8, y: 5, rows: ['R.', '.R', 'R.'] }, { x: 16, y: 4, rows: ['.R', 'R.', '.R'] }],
    [],
  ] },
}
export const FX_FOR = { sleep: 'zzz', jump: 'wisps', sitUp: 'bubble', stare: 'bubble', bark: 'boo', oops: 'oops', offline: null }

// ── pup: a tiny companion (14x12) shown beside the box for each running subagent ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(pupR.layer(g => {
  pupR.ell(g, 7, 5.5 - up, 5, 4.6, 'P')
  pupR.poly(g, [[2, 6 - up], [12, 6 - up], [12.5, 9.5 - up], [1.5, 9.5 - up]], 'P')
  for (const x of [3.5, 7, 10.5]) pupR.ell(g, x, 9.5 - up + (x === 7 ? 1 : 0), 1.8, 1.4, 'P')
}), pupR.raw(g => { pupR.px(g, [[5, 4 - up], [5, 5 - up], [9, 4 - up], [9, 5 - up]], 'n'); pupR.px(g, [[6, 7 - up], [7, 7 - up]], 'R') }))
export const PUP = [pupFrame(0), pupFrame(1)]
