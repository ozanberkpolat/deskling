// Mascot: a leaf-green frog, close-up (40x40 at 2x). Two big eyes bulge on top of a wide head, a pale
// yellow-green belly and throat, a wide smile. Working = eyes follow the screen over its little
// laptop; waiting = sits up tall with huge eyes, then "ribbit" (the throat sac blows up into a big
// pale bubble); finished = a hop and the tongue snaps out at a fly. Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, poly, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20

export const COLORS = {
  I: '#5ccb4a', // leaf green
  N: '#2f8a38', // darker green: spots, mouth shade
  O: '#f2c230', // iris
  1: '#d9ee8a', // pale yellow-green belly / throat
}
export const GREY = { I: '#9ea3ab', N: '#6c717a', O: '#c3c7ce', 1: '#cfd2d7' }

const EX = 11.5 // eye centre offset from C

const body = (dy = 0, tall = 0) => layer(g => {
  ell(g, C, 38 + dy - tall, 14, 11 + tall, 'I')
  ell(g, C, 40 + dy, 9, 8, '1', 'I')
  px(g, [[9, 33 + dy], [11, 36 + dy], [29, 34 + dy], [31, 37 + dy]], 'N')     // back spots
})

// open mouth: 0 shut | 1 wide open (yawn) | 2 small open (tongue)
function head({ dy = 0, mouth = 0, mood = 'smile' } = {}) {
  const Y = y => y + dy
  const shape = layer(g => {
    ell(g, C, Y(23), 16, 9.5, 'I')
    ell(g, C, Y(28), 11, 4.5, '1', 'I')                                          // pale chin
    for (const x of [-1, 1]) px(g, [[C + x * 11, Y(18)], [C + x * 13, Y(20)]], 'N')
  })
  return raw(g => {
    shape.forEach((r, y) => r.forEach((c, x) => { g[y][x] = c }))
    px(g, [[C - 3, Y(19)], [C + 2, Y(19)]], 'N')                                  // nostrils
    const m = []
    if (mouth === 1) {
      ell(g, C, Y(27), 9, 4.5, 'n'); ell(g, C, Y(29), 6, 2.2, 'p', 'n')
      for (let x = 5; x <= 34; x++) m.push([x, Y(24) + (Math.abs(x - 19.5) > 9 ? 0 : 1)])
    } else if (mouth === 2) {
      ell(g, C, Y(26), 3, 1.6, 'n')
      line(g, 5, Y(25), 15, Y(27), 'n'); line(g, 25, Y(27), 34, Y(25), 'n')
    } else if (mood === 'frown') {
      line(g, 8, Y(28), 14, Y(26), 'n'); line(g, 14, Y(26), 25, Y(26), 'n'); line(g, 25, Y(26), 32, Y(28), 'n')
    } else {
      line(g, 5, Y(24), 10, Y(27), 'n'); line(g, 10, Y(27), 29, Y(27), 'n'); line(g, 29, Y(27), 34, Y(24), 'n')   // wide smile
      px(g, [[4, Y(23)], [35, Y(23)]], 'n')
    }
    px(g, m, 'n')
  })
}

// eyes: open | wide | closed | half | happy | sad ; look -1|0|1
function eyes({ eyes: st = 'open', look = 0, dy = 0 } = {}) {
  const ey = 12 + dy
  const bump = layer(g => { for (const s of [-1, 1]) ell(g, C + s * EX, ey, 6, 6, 'I') })
  const det = raw(g => {
    for (const s of [-1, 1]) {
      const cx = C + s * EX, e = Math.floor(cx)
      if (['open', 'wide', 'half', 'sad'].includes(st)) {
        const r = st === 'wide' ? 5 : 4.2
        ell(g, cx, ey, r, r, 'w')
        ell(g, cx + look * 1.5, ey + (st === 'sad' ? 1 : 0), st === 'wide' ? 2.2 : 2.6, st === 'wide' ? 2.2 : 2.6, 'O')
        ell(g, cx + look * 1.8, ey + (st === 'sad' ? 1 : 0), 1.4, 1.4, 'n')
        px(g, [[e + look + 1, ey - 2]], 'w')
        if (st === 'half') { rect(g, cx - 5.5, ey - 6, cx + 5.5, ey - 0.5, 'I', 'wOn'); line(g, e - 5, ey, e + 5, ey, 'k') }
        if (st === 'sad') {            // lid slopes down toward the outside
          poly(g, s < 0 ? [[e - 6, ey - 6], [e + 6, ey - 6], [e + 6, ey - 3], [e - 6, ey + 1]] : [[e - 6, ey - 6], [e + 6, ey - 6], [e + 6, ey + 1], [e - 6, ey - 3]], 'I', 'wOn')
          line(g, s < 0 ? e - 5 : e - 4, s < 0 ? ey : ey - 2, s < 0 ? e + 4 : e + 5, s < 0 ? ey - 2 : ey, 'k')
        }
      }
      if (st === 'closed') line(g, e - 4, ey + 1, e + 4, ey + 1, 'k')
      if (st === 'happy') px(g, [[e - 3, ey + 1], [e - 2, ey], [e - 1, ey - 1], [e, ey - 1], [e + 1, ey - 1], [e + 2, ey], [e + 3, ey + 1]], 'n')
    }
  })
  return compose(bump, det)
}

const sac = size => size && layer(g => {
  ell(g, C, 31 + size * 0.5, 5 + size * 2.4, 3 + size * 2, '1')
  ell(g, C - size, 31 + size * 0.5 - 1, size, size * 0.7, 'w', '1')
  px(g, [[C - 3 * size, 29 + size], [C + 3 * size, 29 + size]], 'N')
})

const laptop = layer(g => { rect(g, 6, 35, 33, 38, 'l'); for (let x = 8; x < 32; x += 3) px(g, [[x, 36], [x + 1, 36]], 'L') })
const feet = (f = 0) => layer(g => { ell(g, 9 - f, 34, 4, 2.4, 'I'); ell(g, 31 + f, 34, 4, 2.4, 'I') })

function pose({ face = {}, mouth = 0, mood, dy = 0, tall = 0, big = 0, kb = false, tongue = null } = {}) {
  const eyeDy = dy - tall
  const parts = [body(dy, tall), head({ dy: dy - tall, mouth, mood }), sac(big)]
  parts.push(eyes({ ...face, dy: eyeDy }))
  if (kb) parts.push(laptop, feet(face.look || 0))
  let f = compose(...parts)
  if (tongue) {
    const g = raw(h => { const [x, y] = tongue; for (const o of [0, 1]) line(h, C, 26 + dy - tall + o, x, y + o, 'p'); px(h, [[x, y], [x + 1, y]], 'p') })
    const o = layer(h => { const [x, y] = tongue; for (const q of [0, 1]) line(h, C, 26 + dy - tall + q, x, y + q, 'p') })
    const base = f.map(r => r.split(''))
    o.forEach((r, y) => r.forEach((c, x) => { if (c === 'k' && base[y][x] === '.') base[y][x] = 'k' }))
    g.forEach((r, y) => r.forEach((c, x) => { if (c !== '.') base[y][x] = c }))
    f = base.map(r => r.join(''))
  }
  return f
}

const F = (rows, ms) => ({ rows, ms })

export function buildClips() {
  const sleepy = (dy, e = 'closed') => pose({ face: { eyes: e }, dy })
  const alert = (extra = {}) => pose({ face: { eyes: 'wide' }, tall: 2, ...extra })
  const happy = (dy = 0, extra = {}) => pose({ face: { eyes: 'happy' }, dy, ...extra })
  return {
    sleep: { loop: true, frames: [F(sleepy(3), 1300), F(sleepy(4), 1400), F(sleepy(3, 'half'), 700), F(sleepy(3), 1200), F(sleepy(4), 1300)] },
    curl: { loop: false, frames: [F(pose({ face: { eyes: 'half' }, dy: 1 }), 260), F(sleepy(3), 300)] },
    wake: { loop: false, frames: [F(sleepy(3, 'half'), 240), F(pose({ face: { eyes: 'open' } }), 200)] },
    type: { loop: true, frames: [
      F(pose({ face: { look: -1 }, kb: true }), 800), F(pose({ face: { look: 0 }, kb: true }), 250),
      F(pose({ face: { look: 1 }, kb: true }), 800), F(pose({ face: { look: 0 }, kb: true }), 250),
      F(pose({ face: { eyes: 'closed' }, kb: true }), 130), F(pose({ kb: true }), 500),
    ] },
    jump: { loop: false, frames: [
      F(happy(2), 120), F(shift(happy(0, { mouth: 2, tongue: [29, 6] }), -3), 110), F(shift(happy(0, { mouth: 2, tongue: [33, 3] }), -5), 130),
      F(shift(happy(0, { mouth: 2, tongue: [26, 12] }), -4), 100), F(shift(happy(), -2), 110), F(happy(1), 120), F(happy(), 200),
    ] },
    wag: { loop: true, frames: [F(happy(), 500), F(happy(1), 300), F(happy(), 500), F(pose(), 800)] },
    sitUp: { loop: false, frames: [F(pose(), 140), F(shift(alert(), -1), 120), F(alert(), 160)] },
    stare: { loop: true, frames: [F(alert(), 2000), F(alert({ face: { eyes: 'closed' } }), 130), F(alert(), 1500), F(alert({ face: { eyes: 'wide', look: 1 } }), 400), F(alert(), 300)] },
    bark: { loop: false, frames: [
      F(alert({ big: 1 }), 120), F(alert({ big: 2 }), 140), F(shift(alert({ big: 3 }), -1), 260), F(alert({ big: 2 }), 140), F(alert({ big: 3 }), 220), F(alert({ big: 1 }), 150), F(alert(), 200),
    ] },
    oops: { loop: true, frames: [
      F(pose({ face: { eyes: 'sad' }, mood: 'frown', dy: 3 }), 1500), F(pose({ face: { eyes: 'sad', look: -1 }, mood: 'frown', dy: 4 }), 700), F(pose({ face: { eyes: 'closed' }, mood: 'frown', dy: 4 }), 300),
    ] },
    yawn: { loop: false, frames: [
      F(pose({ face: { eyes: 'closed' } }), 200), F(pose({ face: { eyes: 'closed' }, mouth: 1 }), 800), F(pose({ face: { eyes: 'half' } }), 260), F(pose(), 300),
    ] },
  }
}

export const CLIPS = buildClips()

// a tiny fly on the 24x24 effects canvas: wings flick, it zigzags
const fly = (x, y, w) => ({ x, y, rows: w ? ['z.z', '.n.'] : ['.n.', 'z.z'] })
export const FX = {
  fly: { ms: 130, frames: [
    [fly(14, 6, 0)], [fly(16, 4, 1)], [fly(15, 2, 0)], [fly(17, 5, 1)], [fly(14, 3, 0)], [fly(12, 5, 1)], [],
  ] },
}
export const FX_FOR = { sleep: 'zzz', jump: 'fly', wag: 'sparkle', sitUp: 'bubble', stare: 'bubble', oops: 'oops' }

// ── pup: a tiny companion (14x12) ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(pupR.layer(g => {
  pupR.ell(g, 7, 8 - up, 6, 3.6, 'I')
  pupR.ell(g, 4, 4.5 - up, 2, 2, 'I'); pupR.ell(g, 10, 4.5 - up, 2, 2, 'I')
  pupR.ell(g, 7, 10 - up, 3, 1.4, '1', 'I')
}), pupR.raw(g => { pupR.px(g, [[4, 4 - up], [10, 4 - up]], 'n'); pupR.px(g, [[4, 5 - up], [10, 5 - up]], 'O'); pupR.line(g, 4, 8 - up, 10, 8 - up, 'n') }))
export const PUP = [pupFrame(0), pupFrame(1)]
