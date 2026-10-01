// The dog, close-up: head and chest of the same shiba, big enough to read inside the round box.
// 40x40 frames, palette-indexed strings (palette.js), same clip names as dog.js. Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, poly, px, layer, raw, compose, shift } = raster(W, H)
const C = 20                                   // face centre is the line between pixels 19 and 20
const m = x => 2 * C - 1 - x                   // mirror a pixel column
const both = (g, list, c) => px(g, list.flatMap(([x, y]) => [[x, y], [m(x), y]]), c)

const EARS = {
  up: [[9, 17], [10.5, 3], [17.5, 10.5]],
  perk: [[10, 16], [11, 1.5], [17.5, 10]],
  back: [[8, 19], [5.5, 7], [15.5, 11.5]],
}

// dy lowers the head (sleep), ears: up|perk|back|twitch (left back, right up)
function head({ eyes = 'open', mouth = 'smile', ears = 'up', dy = 0 } = {}) {
  const earsFor = side => EARS[ears === 'twitch' ? (side < 0 ? 'back' : 'up') : ears]
  const mirror = (pts, side) => pts.map(([x, y]) => [side < 0 ? x : 2 * C - x, y + dy])
  const shape = layer(g => {
    ell(g, C, 21 + dy, 13.5, 10, 'o')                        // skull
    ell(g, C - 9, 25 + dy, 4.5, 4, 'o')                      // cheek fluff
    ell(g, C + 9, 25 + dy, 4.5, 4, 'o')
    for (const side of [-1, 1]) poly(g, mirror(earsFor(side), side), 'o')
  })
  return raw(g => {
    shape.forEach((r, y) => r.forEach((c, x) => { g[y][x] = c }))
    for (const side of [-1, 1]) {                            // inner ears
      const [a, b, c] = mirror(earsFor(side), side)
      const ctr = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3]
      poly(g, [a, b, c].map(p => [ctr[0] + (p[0] - ctr[0]) * 0.5, ctr[1] + (p[1] - ctr[1]) * 0.55 + 1]), 'p', 'o')
    }
    ell(g, C, 26.5 + dy, 7.5, 4.6, 'c', 'o')                // muzzle
    ell(g, C - 9, 25.5 + dy, 4, 3.2, 'c', 'o')               // cheeks
    ell(g, C + 9, 25.5 + dy, 4, 3.2, 'c', 'o')
    both(g, [[14, 15 + dy], [15, 15 + dy]], 'c')             // shiba brow dots
    const E = (list, c) => both(g, list.map(([x, y]) => [x, y + dy]), c)
    if (eyes === 'open') { E([[14, 18], [15, 18], [14, 19], [15, 19], [14, 20], [15, 20]], 'n'); px(g, [[15, 18 + dy], [25, 18 + dy]], 'w') }
    if (eyes === 'wide') { E([[13, 17], [14, 17], [15, 17], [13, 18], [14, 18], [15, 18], [13, 19], [14, 19], [15, 19], [14, 20]], 'n'); px(g, [[15, 17 + dy], [14, 18 + dy], [25, 17 + dy], [24, 18 + dy]], 'w') }
    if (eyes === 'closed') E([[13, 19], [14, 20], [15, 20], [16, 19]], 'n')
    if (eyes === 'happy') E([[13, 20], [14, 19], [15, 19], [16, 20]], 'n')
    if (eyes === 'sad') { E([[13, 19], [14, 20], [15, 20], [16, 19]], 'n'); px(g, [[14, 21 + dy], [14, 22 + dy]], 's'); E([[14, 16], [15, 15]], 'c') }   // closed, a tear, worried brows
    // nose
    E([[18, 23], [19, 23], [19, 24]], 'n')
    const W_ = [[19, 25], [18, 26], [17, 26], [16, 25]]      // the cat-like ω mouth
    if (mouth === 'smile') E(W_, 'n')
    if (mouth === 'frown') E([[19, 26], [18, 25], [17, 25], [16, 26]], 'n')
    if (mouth === 'tongue') { E(W_, 'n'); E([[19, 26], [19, 27], [18, 27]], 'p') }
    if (mouth === 'open') { E([[19, 25], [18, 25], [17, 26], [17, 27], [18, 28], [19, 28]], 'n'); E([[18, 26], [19, 26], [18, 27], [19, 27]], 'p') }
    if (mouth === 'yawn') { E([[19, 25], [18, 25], [17, 26], [16, 27], [16, 28], [17, 29], [18, 30], [19, 30]], 'n'); E([[18, 26], [19, 26], [17, 27], [18, 27], [19, 27], [17, 28], [18, 28], [19, 28], [18, 29], [19, 29]], 'p') }
  })
}

// chest under the head, cut off by the bottom of the frame
const chest = (dy = 0) => layer(g => {
  ell(g, C, 40 + dy, 14, 10, 'o')
  ell(g, C, 40 + dy, 7.5, 8.5, 'c', 'o')
})

// front paws: lift = [left, right] px up; `kb` draws the little keyboard they type on
function paws({ lift = [0, 0], dy = 0, kb = false } = {}) {
  const board = kb && layer(g => {
    rect(g, 5, 35, 34, 38, 'l')
    for (let x = 7; x < 33; x += 3) px(g, [[x, 36], [x + 1, 36]], 'L')
  })
  const p = layer(g => {
    ell(g, 12.5, 34.5 + dy - lift[0], 3.4, 2.4, 'c')
    ell(g, 27.5, 34.5 + dy - lift[1], 3.4, 2.4, 'c')
  })
  return [board, p]
}

// Paws only on the keyboard: on a bare bust they read as two rings on the cream chest.
const pose = ({ face = {}, lift, kb, bob = 0 } = {}) =>
  compose(chest(bob), head({ ...face, dy: (face.dy || 0) + bob }), ...(kb ? paws({ lift, kb, dy: bob }) : []))

const F = (rows, ms) => ({ rows, ms })

export function buildClips() {
  const sleepy = (bob, extra = {}) => pose({ face: { eyes: 'closed', mouth: 'none', ears: 'back', dy: 3, ...extra }, bob })
  const typing = (lift, eyes = 'open') => pose({ face: { eyes }, lift, kb: true })
  const happy = (bob, mouth = 'tongue') => pose({ face: { eyes: 'happy', mouth }, bob })
  const alert = (extra = {}) => pose({ face: { eyes: 'wide', ears: 'perk', ...extra } })
  return {
    sleep: { loop: true, frames: [
      F(sleepy(0), 1000), F(sleepy(1), 1200), F(sleepy(0), 1000), F(sleepy(1), 1200),
      F(sleepy(0, { ears: 'twitch' }), 180), F(sleepy(0), 800), F(sleepy(1), 1200),
    ] },
    curl: { loop: false, frames: [F(pose({ face: { eyes: 'closed' } }), 260), F(sleepy(0), 300)] },
    wake: { loop: false, frames: [F(sleepy(0, { eyes: 'open' }), 220), F(pose({ face: { eyes: 'closed' } }), 160), F(pose(), 200)] },
    type: { loop: true, frames: [
      F(typing([2, 0]), 170), F(typing([0, 0]), 120), F(typing([0, 2]), 170), F(typing([0, 0]), 120),
      F(typing([2, 0]), 170), F(typing([0, 2]), 170), F(typing([0, 0], 'closed'), 130),
    ] },
    jump: { loop: false, frames: [
      F(happy(1), 120), F(shift(happy(0), -2), 110), F(shift(happy(0), -4), 170), F(shift(happy(0), -2), 110),
      F(happy(1), 120), F(happy(0), 200),
    ] },
    wag: { loop: true, frames: [
      F(happy(0), 300), F(happy(1), 220), F(happy(0), 300), F(happy(1), 220),
      F(pose({ face: { mouth: 'smile' } }), 900), F(pose({ face: { eyes: 'closed', mouth: 'smile' } }), 140),
    ] },
    sitUp: { loop: false, frames: [F(pose({ face: { ears: 'perk' } }), 140), F(shift(alert(), -1), 120), F(alert(), 160)] },
    stare: { loop: true, frames: [
      F(alert(), 2200), F(alert({ eyes: 'closed' }), 130), F(alert(), 1600), F(alert({ dy: 1 }), 200), F(alert(), 200),
    ] },
    bark: { loop: false, frames: [
      F(shift(alert({ mouth: 'open' }), -1), 130), F(alert(), 110), F(shift(alert({ mouth: 'open' }), -1), 150), F(alert(), 300),
    ] },
    oops: { loop: true, frames: [
      F(pose({ face: { eyes: 'sad', mouth: 'frown', ears: 'back', dy: 2 } }), 1600),
      F(pose({ face: { eyes: 'sad', mouth: 'frown', ears: 'back', dy: 3 } }), 900),
      F(pose({ face: { eyes: 'closed', mouth: 'frown', ears: 'back', dy: 3 } }), 300),
    ] },
    yawn: { loop: false, frames: [
      F(pose({ face: { eyes: 'closed' } }), 200), F(pose({ face: { eyes: 'closed', mouth: 'yawn', ears: 'back' } }), 700),
      F(pose({ face: { eyes: 'closed' } }), 220), F(pose(), 300),
    ] },
  }
}

export const CLIPS = buildClips()

// The shiba's colours are the base palette itself (palette.js); its effects are the shared ones.
export const COLORS = {}
export const GREY = {}
export const FX = {}
export const FX_FOR = { sleep: 'zzz', jump: 'sparkle', sitUp: 'bubble', stare: 'bubble', bark: 'bubble', oops: 'oops' }

// ── pup: a tiny companion (14x12) shown beside the box for each running subagent ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(pupR.layer(g => {
  pupR.ell(g, 7, 10.2 - up, 3.6, 1.9, 'o')                                          // body
  pupR.ell(g, 7, 6.2 - up, 4.4, 3.6, 'o')                                           // round head
  pupR.poly(g, [[2.8, 5 - up], [3.2, 0.5 - up], [6, 3 - up]], 'o'); pupR.poly(g, [[11.2, 5 - up], [10.8, 0.5 - up], [8, 3 - up]], 'o')
  pupR.ell(g, 7, 8 - up, 2.4, 1.3, 'c', 'o')                                        // muzzle
}), pupR.raw(g => { pupR.px(g, [[5, 6 - up], [8, 6 - up]], 'n'); pupR.px(g, [[6, 8 - up], [7, 8 - up]], 'n'); pupR.px(g, [[4, 2 - up], [9, 2 - up]], 'p') }))
export const PUP = [pupFrame(0), pupFrame(1)]
