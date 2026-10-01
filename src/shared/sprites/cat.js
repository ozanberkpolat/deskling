// Mascot: a silver-grey tabby cat, close-up (40x40 at 2x). Pointed ears with pink insides, dark
// forehead stripes, green slit-pupil eyes, small pink nose, pale whiskers. Working = paws on the
// little laptop; waiting = ears up, eyes huge and round; a tail flick shows when it is happy. Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, poly, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20

export const COLORS = {
  C: '#a3acb9', // silver coat
  D: '#5f6776', // tabby stripes
  F: '#7fdc6e', // green iris
  0: '#eef2f8', // whiskers
}
export const GREY = { C: '#a6aab1', D: '#6d7178', F: '#b9bdc3', 0: '#e3e5e8' }

const tail = (swish = 0) => layer(g => {
  // a thick curved tail rising at the right side; swish moves the tip
  const pts = [[31, 38], [35, 36], [37, 32], [37 + swish, 28], [35 + swish * 2, 25]]
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    for (let t = 0; t <= 1; t += 0.1) ell(g, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 2.1, 2.1, 'C')
  }
  px(g, [[36, 33], [37, 31], [36 + swish, 28]], 'D')
})

const chest = (dy = 0) => layer(g => {
  ell(g, C, 40 + dy, 14, 10, 'C')
  ell(g, C, 41 + dy, 6.5, 8, 'c', 'C')
  for (const x of [11, 14, 26, 29]) px(g, [[x, 34 + dy], [x, 35 + dy]], 'D')
})

function paws({ lift = [0, 0], dy = 0, kb = false } = {}) {
  const board = kb && layer(g => {
    rect(g, 5, 35, 34, 38, 'l')
    for (let x = 7; x < 33; x += 3) px(g, [[x, 36], [x + 1, 36]], 'L')
  })
  const p = layer(g => {
    ell(g, 12.5, 34.5 + dy - lift[0], 3.4, 2.4, 'C')
    ell(g, 27.5, 34.5 + dy - lift[1], 3.4, 2.4, 'C')
  })
  return [board, p]
}

// eyes: open|wide|closed|half|happy|sad; look -1|0|1; mouth: none|smile|open|yawn|frown;
// ears: up|perk|back
function head({ eyes = 'open', look = 0, mouth = 'smile', ears = 'up', dy = 0 } = {}) {
  const Y = y => y + dy
  const shape = layer(g => {
    for (const side of [-1, 1]) {
      const X = x => (side < 0 ? x : 2 * C - x)
      if (ears === 'back') poly(g, [[X(12), Y(15)], [X(3), Y(13)], [X(9), Y(8)]], 'C')
      else {
        const t = ears === 'perk' ? 1.5 : 0
        poly(g, [[X(7), Y(14)], [X(7), Y(1 - t)], [X(16), Y(9)]], 'C')
      }
    }
    ell(g, C, Y(21), 14, 10.5, 'C')
    ell(g, C, Y(25), 11, 7.5, 'C')
  })
  return raw(g => {
    shape.forEach((r, y) => r.forEach((c, x) => { g[y][x] = c }))
    // inner ears
    for (const side of [-1, 1]) {
      const X = x => (side < 0 ? x : 2 * C - x)
      if (ears === 'back') poly(g, [[X(10), Y(13.5)], [X(5.5), Y(12.5)], [X(9), Y(10)]], 'p')
      else {
        const t = ears === 'perk' ? 1.5 : 0
        poly(g, [[X(9), Y(12.5)], [X(9), Y(5 - t)], [X(13), Y(9.5)]], 'p')
      }
    }
    // tabby stripes: forehead "M" and cheek bars
    for (const x of [C - 4, C, C + 4]) line(g, x, Y(11), x, Y(14), 'D')
    px(g, [[C - 2, Y(12)], [C + 2, Y(12)]], 'D')
    for (const side of [-1, 1]) {
      const X = x => (side < 0 ? C - x : C + x)
      line(g, X(13), Y(19), X(10), Y(20), 'D'); line(g, X(13), Y(23), X(10), Y(23), 'D')
    }
    // muzzle
    ell(g, C - 2.5, Y(26), 3, 2.4, 'c'); ell(g, C + 2.5, Y(26), 3, 2.4, 'c')
    // eyes
    for (const s of [-1, 1]) {
      const cx = C + s * 6.5 + look, ey = Y(19), e = Math.floor(cx)
      if (eyes === 'open' || eyes === 'wide' || eyes === 'half' || eyes === 'sad') {
        const big = eyes === 'wide'
        ell(g, cx, ey, big ? 4.3 : 3.5, big ? 4.3 : 3.2, 'F')
        if (big) ell(g, cx + look * 0.8, ey, 2.3, 2.3, 'n')
        else px(g, [[e, ey - 2], [e, ey - 1], [e, ey], [e, ey + 1]], 'n')       // slit pupil
        px(g, [[e + 1, ey - (big ? 2 : 1)]], 'w')
        if (eyes === 'half') ell(g, cx, ey - 1.8, 4, 2.2, 'C')
        if (eyes === 'sad') { ell(g, cx, ey - 2, 4.2, 2.4, 'C'); px(g, [[e + 1, ey + 1]], 'w') }
      }
      if (eyes === 'closed') line(g, e - 3, ey + 1, e + 3, ey + 1, 'n')
      if (eyes === 'happy') px(g, [[e - 3, ey + 1], [e - 2, ey], [e - 1, ey - 1], [e, ey - 1], [e + 1, ey - 1], [e + 2, ey], [e + 3, ey + 1]], 'n')
    }
    // nose + mouth
    const m = C
    px(g, [[m - 1, Y(23)], [m, Y(23)], [m - 1, Y(24)], [m, Y(24)]], 'p')
    px(g, [[m - 1, Y(23)], [m, Y(23)]], 'p')
    if (mouth === 'smile') px(g, [[m - 3, Y(26)], [m - 2, Y(27)], [m - 1, Y(26)], [m, Y(26)], [m + 1, Y(27)], [m + 2, Y(26)]], 'n')
    if (mouth === 'frown') px(g, [[m - 2, Y(27)], [m - 1, Y(26)], [m, Y(26)], [m + 1, Y(27)]], 'n')
    if (mouth === 'none') px(g, [[m - 1, Y(26)], [m, Y(26)]], 'n')
    if (mouth === 'open') { ell(g, m - 0.5, Y(28), 3, 2.8, 'n'); px(g, [[m - 2, Y(29)], [m - 1, Y(29)], [m, Y(29)]], 'p') }
    if (mouth === 'yawn') { ell(g, m - 0.5, Y(28.5), 5, 4.5, 'n'); ell(g, m - 0.5, Y(30.5), 3.6, 2, 'p', 'n') }
    // whiskers
    for (const s of [-1, 1]) {
      const X = d => (s < 0 ? C - d : C + d)
      line(g, X(7), Y(25), X(15), Y(23), '0'); line(g, X(7), Y(27), X(15), Y(28), '0')
    }
  })
}

const pose = ({ face = {}, lift, kb, bob = 0, swish = null } = {}) =>
  compose(swish === null ? null : tail(swish), chest(bob), head({ ...face, dy: (face.dy || 0) + bob }), ...(kb ? paws({ lift, kb, dy: bob }) : []))
const F = (rows, ms) => ({ rows, ms })

export function buildClips() {
  const sleepy = (bob, extra = {}) => pose({ face: { eyes: 'closed', mouth: 'none', dy: 3, ...extra }, bob })
  const typing = (lift, eyes = 'open', look = 0) => pose({ face: { eyes, look }, lift, kb: true })
  const happy = (bob, sw) => pose({ face: { eyes: 'happy', mouth: 'smile' }, bob, swish: sw })
  const alert = (extra = {}) => pose({ face: { eyes: 'wide', ears: 'perk', mouth: 'none', ...extra } })
  return {
    sleep: { loop: true, frames: [F(sleepy(0), 1100), F(sleepy(1), 1300), F(sleepy(0), 1100), F(sleepy(1), 1300), F(sleepy(0, { ears: 'back' }), 180), F(sleepy(0), 900)] },
    curl: { loop: false, frames: [F(pose({ face: { eyes: 'closed' } }), 260), F(sleepy(0), 300)] },
    wake: { loop: false, frames: [F(sleepy(0, { eyes: 'half', mouth: 'smile' }), 220), F(pose({ face: { eyes: 'closed' } }), 150), F(pose(), 200)] },
    type: { loop: true, frames: [
      F(typing([2, 0], 'open', -1), 170), F(typing([0, 0], 'open', -1), 120), F(typing([0, 2], 'open', 1), 170), F(typing([0, 0], 'open', 1), 120),
      F(typing([2, 0]), 170), F(typing([0, 2]), 170), F(typing([0, 0], 'closed'), 130),
    ] },
    jump: { loop: false, frames: [F(happy(1, 0), 120), F(shift(happy(0, 1), -2), 110), F(shift(happy(0, -1), -4), 170), F(shift(happy(0, 1), -2), 110), F(happy(1, 0), 120), F(happy(0, -1), 200)] },
    wag: { loop: true, frames: [F(happy(0, 0), 260), F(happy(0, 1), 200), F(happy(1, -1), 260), F(happy(0, 1), 200), F(pose({ face: { mouth: 'smile' }, swish: 0 }), 900), F(pose({ face: { eyes: 'closed' }, swish: -1 }), 140)] },
    sitUp: { loop: false, frames: [F(pose({ face: { ears: 'perk' } }), 140), F(shift(alert(), -1), 120), F(alert(), 160)] },
    stare: { loop: true, frames: [F(alert(), 2200), F(alert({ eyes: 'closed' }), 130), F(alert(), 1600), F(alert({ look: 1 }), 300), F(alert({ look: -1 }), 300), F(alert(), 200)] },
    bark: { loop: false, frames: [F(shift(alert({ mouth: 'open' }), -1), 140), F(alert(), 110), F(shift(alert({ mouth: 'open' }), -1), 170), F(alert(), 300)] },
    oops: { loop: true, frames: [
      F(pose({ face: { eyes: 'sad', mouth: 'frown', ears: 'back', dy: 2 } }), 1600),
      F(pose({ face: { eyes: 'sad', mouth: 'frown', ears: 'back', dy: 3 } }), 900),
      F(pose({ face: { eyes: 'closed', mouth: 'frown', ears: 'back', dy: 3 } }), 300),
    ] },
    yawn: { loop: false, frames: [F(pose({ face: { eyes: 'closed' } }), 200), F(pose({ face: { eyes: 'closed', mouth: 'yawn' } }), 800), F(pose({ face: { eyes: 'half' } }), 260), F(pose(), 300)] },
  }
}

export const CLIPS = buildClips()

// purr: little curved waves drift up; paws: two prints that tread by
const wave = ['..00', '.0..', '0...', '.0..', '..00', '.0..', '0...']
export const FX = {
  purr: { ms: 200, frames: [
    [{ x: 5, y: 16, rows: wave }],
    [{ x: 5, y: 16, rows: wave }, { x: 9, y: 11, rows: wave }],
    [{ x: 9, y: 11, rows: wave }, { x: 13, y: 6, rows: wave }],
    [{ x: 13, y: 6, rows: wave }],
    [],
  ] },
}
export const FX_FOR = { sleep: 'zzz', jump: 'purr', wag: 'purr', sitUp: 'bubble', stare: 'bubble', oops: 'oops' }

// ── pup (14x12): a tiny tabby head ──
const pr = raster(14, 12)
const pupFrame = up => pr.compose(pr.layer(g => {
  pr.ell(g, 7, 7.5 - up, 5.2, 4.2, 'C')
  pr.poly(g, [[2, 5 - up], [2.5, 0.5 - up], [6, 3.5 - up]], 'C'); pr.poly(g, [[12, 5 - up], [11.5, 0.5 - up], [8, 3.5 - up]], 'C')
}), pr.raw(g => {
  pr.px(g, [[5, 6 - up], [9, 6 - up]], 'F'); pr.px(g, [[7, 3 - up]], 'D'); pr.px(g, [[6, 3 - up], [8, 3 - up]], 'D')
  pr.px(g, [[7, 8 - up]], 'p')
}))
export const PUP = [pupFrame(0), pupFrame(1)]
