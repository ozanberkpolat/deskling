// Mascot: an owl, close-up (40x40 at 2x). Ear tufts, a pale face disc with huge round eyes, a small
// orange beak, wings at the sides that spread. Working = it turns its head from side to side,
// watching the sessions; waiting = eyes huge and feathers puffed up, then "hoo-hoo". Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, poly, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20

export const COLORS = {
  u: '#8a5a3b', // feathers
  v: '#c8915f', // breast, light feathers
  x: '#f2e2c4', // face disc
  j: '#f0a12e', // beak
  E: '#ffcf3f', // iris
}
export const GREY = { u: '#6c717a', v: '#9ea3ab', x: '#cfd2d7', j: '#b3b7be', E: '#c3c7ce' }

const WING = {
  rest: [[9, 27], [4, 32], [5, 40], [12, 40]],
  half: [[9, 26], [1, 27], [2, 36], [11, 40]],
  up: [[9, 25], [1, 15], [0, 25], [10, 38]],
}
function wings(kind) {
  return layer(g => {
    for (const side of [-1, 1]) {
      const pts = WING[kind].map(([x, y]) => [side < 0 ? x : 2 * C - x, y])
      poly(g, pts, 'u')
      const [a, b] = pts
      line(g, a[0], a[1] + 3, b[0], b[1] + 4, 'v', 'u')
    }
  })
}

const body = (puff = 0, dy = 0) => layer(g => {
  ell(g, C, 38 + dy, 13 + puff, 12, 'u')
  ell(g, C, 39 + dy, 8.5 + puff, 10, 'v', 'u')
  for (let y = 31 + dy; y < 40; y += 3) for (let x = C - 6; x <= C + 5; x += 3) px(g, [[x, y], [x + 1, y + 1], [x + 2, y]], 'u')   // breast chevrons
})

// eyes: open|wide|closed|half|happy; look: -1|0|1 (pupils, head turned); beak: shut|open
function head({ eyes = 'open', look = 0, beak = 'shut', dy = 0, puff = 0 } = {}) {
  const Y = y => y + dy, hx = C + look
  const shape = layer(g => {
    ell(g, hx, Y(18), 13 + puff, 11 + puff * 0.6, 'u')
    for (const side of [-1, 1]) {
      const X = x => side < 0 ? hx - (C - x) : hx + (C - x)
      poly(g, [[X(8), Y(12)], [X(6), Y(2 - puff)], [X(13.5), Y(9)]], 'u')            // ear tufts
    }
  })
  return raw(g => {
    shape.forEach((r, y) => r.forEach((c, x) => { g[y][x] = c }))
    const L = hx - 5.5, R = hx + 5.5
    for (const cx of [L, R]) ell(g, cx, Y(19), 6, 6, 'x', 'u')                       // face disc
    for (const cx of [L, R]) {
      const e = Math.floor(cx), ey = Y(19)
      if (eyes === 'open' || eyes === 'wide' || eyes === 'half') {
        const r = eyes === 'wide' ? 4.3 : 3.4
        ell(g, cx, ey, r, r, 'E')
        ell(g, cx + look * 0.8, ey, eyes === 'wide' ? 2.3 : 1.7, eyes === 'wide' ? 2.3 : 1.7, 'n')
        px(g, [[e + 1 + look, ey - 2]], 'w')
        if (eyes === 'half') { ell(g, cx, ey - 2.2, 4, 2.6, 'x'); line(g, e - 3, ey - 1, e + 3, ey - 1, 'n') }
      }
      if (eyes === 'closed') line(g, e - 3, ey, e + 3, ey, 'n')
      if (eyes === 'happy') px(g, [[e - 2, ey + 1], [e - 1, ey], [e, ey - 1], [e + 1, ey], [e + 2, ey + 1]], 'n')
    }
    const b = Math.floor(hx)
    if (beak === 'shut') px(g, [[b - 1, Y(23)], [b, Y(23)], [b - 1, Y(24)], [b, Y(24)], [b - 1, Y(25)]], 'j')
    if (beak === 'open') { px(g, [[b - 1, Y(23)], [b, Y(23)]], 'j'); px(g, [[b - 1, Y(24)], [b, Y(24)], [b - 1, Y(25)], [b, Y(25)]], 'n'); px(g, [[b - 1, Y(26)], [b, Y(26)]], 'j') }
  })
}

const pose = ({ face = {}, wing = 'rest', bob = 0, puff = 0 } = {}) =>
  compose(wings(wing), body(puff, bob), head({ ...face, puff, dy: (face.dy || 0) + bob }))
const F = (rows, ms) => ({ rows, ms })

export function buildClips() {
  const sleepy = (bob, eyes = 'closed') => pose({ face: { eyes, dy: 2 }, bob })
  const alert = (extra = {}, wing = 'rest') => pose({ face: { eyes: 'wide', ...extra }, wing, puff: 1 })
  const happy = (wing, b = 0) => pose({ face: { eyes: 'happy' }, wing, bob: b })
  return {
    sleep: { loop: true, frames: [
      F(sleepy(0), 1200), F(sleepy(1), 1300), F(sleepy(0, 'half'), 900), F(sleepy(0), 1100), F(sleepy(1), 1300),
    ] },
    curl: { loop: false, frames: [F(pose({ face: { eyes: 'half' } }), 260), F(sleepy(0), 300)] },
    wake: { loop: false, frames: [F(sleepy(0, 'half'), 240), F(pose({ face: { eyes: 'open' } }), 200)] },
    type: { loop: true, frames: [
      F(pose({ face: { look: -1 } }), 900), F(pose({ face: { look: 0 } }), 250), F(pose({ face: { look: 1 } }), 900),
      F(pose({ face: { look: 0 } }), 250), F(pose({ face: { look: 0, eyes: 'closed' } }), 130), F(pose(), 600),
    ] },
    jump: { loop: false, frames: [
      F(happy('half', 1), 120), F(shift(happy('up'), -2), 110), F(shift(happy('half'), -4), 140),
      F(shift(happy('up'), -3), 110), F(happy('half', 1), 120), F(happy('rest'), 200),
    ] },
    wag: { loop: true, frames: [F(happy('half'), 220), F(happy('up'), 180), F(happy('half'), 220), F(happy('rest'), 300), F(pose(), 900)] },
    sitUp: { loop: false, frames: [F(pose(), 140), F(shift(alert({}, 'half'), -1), 120), F(alert(), 160)] },
    stare: { loop: true, frames: [F(alert(), 2000), F(alert({ eyes: 'closed' }), 130), F(alert(), 1500), F(alert({ look: 1 }), 400), F(alert(), 300)] },
    bark: { loop: false, frames: [
      F(shift(alert({ beak: 'open' }, 'half'), -1), 160), F(alert(), 140), F(shift(alert({ beak: 'open' }, 'half'), -1), 200), F(alert(), 300),
    ] },
    oops: { loop: true, frames: [
      F(pose({ face: { eyes: 'half', dy: 2 }, puff: 1, wing: 'rest' }), 1500),
      F(pose({ face: { eyes: 'half', dy: 3, look: -1 }, puff: 1 }), 700),
      F(pose({ face: { eyes: 'closed', dy: 3 }, puff: 1 }), 300),
    ] },
    yawn: { loop: false, frames: [F(pose({ face: { eyes: 'closed' } }), 200), F(pose({ face: { eyes: 'closed', beak: 'open' } }), 700), F(pose({ face: { eyes: 'half' } }), 260), F(pose(), 300)] },
  }
}

export const CLIPS = buildClips()

const feather = ['.v', 'vu', 'u.']
const featherR = ['v.', 'uv', '.u']
export const FX = {
  feathers: { ms: 200, frames: [
    [{ x: 3, y: 16, rows: feather }],
    [{ x: 4, y: 12, rows: featherR }, { x: 14, y: 8, rows: feather }],
    [{ x: 6, y: 9, rows: feather }, { x: 15, y: 5, rows: featherR }, { x: 9, y: 18, rows: featherR }],
    [{ x: 8, y: 7, rows: featherR }, { x: 17, y: 3, rows: feather }, { x: 11, y: 15, rows: feather }],
    [{ x: 18, y: 1, rows: featherR }, { x: 13, y: 13, rows: featherR }],
    [],
  ] },
  hoot: { ms: 170, anchor: 'mid', mirror: true, frames: [
    [{ x: 1, y: 9, rows: ['z.', '.z', '.z', 'z.'] }],
    [{ x: 1, y: 9, rows: ['z.', '.z', '.z', 'z.'] }, { x: 5, y: 7, rows: ['z..', '.z.', '..z', '..z', '.z.', 'z..'] }],
    [{ x: 5, y: 7, rows: ['z..', '.z.', '..z', '..z', '.z.', 'z..'] }, { x: 10, y: 5, rows: ['z...', '.z..', '..z.', '...z', '...z', '..z.', '.z..', 'z...'] }],
    [{ x: 10, y: 5, rows: ['z...', '.z..', '..z.', '...z', '...z', '..z.', '.z..', 'z...'] }],
    [],
  ] },
}
export const FX_FOR = { sleep: 'zzz', jump: 'feathers', sitUp: 'bubble', stare: 'bubble', bark: 'hoot', oops: 'oops' }

// ── pup: a tiny companion (14x12) shown beside the box for each running subagent ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(pupR.layer(g => {
  pupR.ell(g, 7, 7.5 - up, 5, 4.4, 'u')
  pupR.poly(g, [[2.5, 5 - up], [2.5, 1 - up], [5, 3.5 - up]], 'u'); pupR.poly(g, [[11.5, 5 - up], [11.5, 1 - up], [9, 3.5 - up]], 'u')
  pupR.ell(g, 5, 6.5 - up, 2, 2, 'x', 'u'); pupR.ell(g, 9, 6.5 - up, 2, 2, 'x', 'u')
  pupR.ell(g, 7, 10 - up, 3, 1.6, 'v', 'u')
}), pupR.raw(g => { pupR.px(g, [[5, 6 - up], [8, 6 - up]], 'n'); pupR.px(g, [[6, 8 - up], [7, 8 - up]], 'j') }))
export const PUP = [pupFrame(0), pupFrame(1)]
