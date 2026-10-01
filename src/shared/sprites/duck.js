// Mascot: a rubber duck (the "rubber duck debugging" one), front view, 40x40. Glossy yellow round
// head on a round body floating in a blue pool with a ripple line; flat orange bill, bead eyes, a
// wing bump. A toy has no hands: working = it bobs and watches a little laptop floating in front.
// Waiting = rides high, eyes huge; bark = bill splits open (QUACK); finished = hops out and splashes
// back. Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, poly, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20

export const COLORS = {
  Z: '#ffd21f', // rubber yellow
  5: '#ff8a1e', // bill
  6: '#4a9fe0', // water
}
export const GREY = { Z: '#c4c8cf', 5: '#9a9ea6', 6: '#8c929b' }

// sink: how far the duck sits down in the water (px); tilt: lean (-1..1) of the whole duck
const body = (sink, tilt) => layer(g => {
  ell(g, C + tilt, 29 + sink, 14, 8.5, 'Z')
  poly(g, [[C + 13 + tilt, 26 + sink], [C + 17 + tilt, 22 + sink], [C + 14 + tilt, 30 + sink]], 'Z')          // tail flick
})
const wings = (sink, tilt, flap = 0) => layer(g => {
  for (const s of [-1, 1]) ell(g, C + tilt + s * 9, 29 + sink - flap, 4.5, 3.2, 'Z')
})
const waterLine = (sink, rip) => raw(g => {
  const top = 33 + (sink > 0 ? Math.min(sink, 2) : 0)
  for (let x = 0; x < W; x++) { const y = top + (((x + rip) >> 2) & 1 ? 1 : 0); rect(g, x - 1, y, x, 39, '6') }
  for (let x = 3 + rip % 4; x < 36; x += 8) px(g, [[x, top + 3], [x + 1, top + 3], [x + 2, top + 3]], 'w')       // ripple dashes
  for (let x = 5; x < 36; x += 9) px(g, [[x - rip % 3, top + 5]], 'w')
})

// eyes: open|wide|closed|happy|sad|half ; bill: shut|open|wide
function head({ eyes = 'open', look = 0, bill = 'shut', dy = 0, dx = 0 } = {}) {
  const hx = C + dx
  const shape = layer(g => {
    ell(g, hx, 16 + dy, 11, 10, 'Z')
    poly(g, [[hx - 2, 6 + dy], [hx + 1, 3 + dy], [hx + 4, 6.5 + dy]], 'Z')                                    // head tuft
    if (bill === 'shut') ell(g, hx, 21.5 + dy, 6.5, 2.4, '5')
    else {
      const gap = bill === 'wide' ? 4 : 2
      ell(g, hx, 20 + dy, 6.5, 2.2, '5'); ell(g, hx, 22 + gap + 1.6 + dy, 5.2, 2 + gap * 0.2, '5')
    }
  })
  return raw(g => {
    shape.forEach((r, y) => r.forEach((c, x) => { g[y][x] = c }))
    ell(g, hx - 6, 12 + dy, 2.2, 1.6, 'w')                                                                    // gloss
    if (bill !== 'shut') {
      const gap = bill === 'wide' ? 4 : 2
      ell(g, hx, 22 + gap / 2 + dy, 4.2, gap / 2 + 0.6, 'k')
      if (bill === 'wide') px(g, [[hx - 1, 23 + dy], [hx, 23 + dy], [hx + 1, 23 + dy], [hx, 24 + dy]], 'p')
    } else px(g, [[hx - 5, 21 + dy], [hx - 4, 22 + dy]], 'w')
    for (const s of [-1, 1]) {
      const ex = hx + s * 6 + look, ey = 14 + dy, e = Math.round(ex)
      if (eyes === 'open' || eyes === 'wide' || eyes === 'half') {
        const r = eyes === 'wide' ? 3.1 : 2
        ell(g, ex, ey, r, r, 'n'); px(g, [[e - 1, ey - 1]], 'w')
        if (eyes === 'wide') px(g, [[e - 1, ey - 2], [e, ey - 2]], 'w')
        if (eyes === 'half') rect(g, e - 3, ey - 3, e + 2, ey - 1, 'Z')
      }
      if (eyes === 'closed') line(g, e - 2, ey, e + 2, ey, 'n')
      if (eyes === 'happy') px(g, [[e - 2, ey + 1], [e - 1, ey], [e, ey - 1], [e + 1, ey], [e + 2, ey + 1]], 'n')
      if (eyes === 'sad') {
        px(g, [[e - 1, ey], [e, ey], [e + 1, ey], [e, ey + 1]], 'n')
        line(g, e - 2 * s, ey - 3 + (s < 0 ? 0 : 0), e + 2 * s, ey - 4 + 0, 'n')
        px(g, [[e + s * 2, ey + 3], [e + s * 2, ey + 4]], '6')                                                // a tear
      }
    }
  })
}

const laptop = (sink, open = true) => layer(g => {
  if (!open) return
  rect(g, 12, 33 + sink, 27, 37 + sink, 'l'); rect(g, 13, 34 + sink, 26, 35 + sink, 's'); px(g, [[14, 36 + sink], [15, 36 + sink], [17, 36 + sink]], 'L')
})

// bob: the whole duck rides lower(+) / higher(-); sink: how deep in the water
const pose = ({ face = {}, bob = 0, tilt = 0, rip = 0, flap = 0, lap = false } = {}) =>
  compose(
    body(bob, tilt), wings(bob, tilt, flap),
    head({ ...face, dy: (face.dy || 0) + bob, dx: (face.dx || 0) + tilt }),
    waterLine(bob, rip),
    lap && laptop(0),
  )
const F = (rows, ms) => ({ rows, ms })

export function buildClips() {
  const sleepy = (b, rip, eyes = 'closed') => pose({ face: { eyes, dy: 2 }, bob: b + 1, rip })
  const happy = (b, rip = 0, flap = 0, bill = 'shut') => pose({ face: { eyes: 'happy', bill }, bob: b, rip, flap })
  const alert = (extra = {}, b = -3) => pose({ face: { eyes: 'wide', ...extra }, bob: b, rip: 1 })
  const work = (look, rip, eyes = 'open') => pose({ face: { eyes, look, dy: 1 }, bob: 1, rip, lap: true })
  return {
    sleep: { loop: true, frames: [F(sleepy(0, 0), 1200), F(sleepy(1, 1), 1300), F(sleepy(0, 2, 'closed'), 1100), F(sleepy(1, 3), 1300)] },
    curl: { loop: false, frames: [F(sleepy(0, 0, 'half'), 260), F(sleepy(0, 1), 300)] },
    wake: { loop: false, frames: [F(sleepy(0, 0, 'half'), 240), F(pose({ rip: 1 }), 200)] },
    type: { loop: true, frames: [
      F(work(-1, 0), 450), F(work(-1, 1), 300), F(work(0, 2), 300), F(work(1, 3), 450), F(work(1, 0), 300), F(work(0, 1, 'closed'), 120), F(work(0, 2), 300),
    ] },
    jump: { loop: false, frames: [
      F(happy(2, 0, 0), 120), F(happy(-1, 1, 2), 110), F(shift(happy(-2, 1, 3), -2), 150),
      F(shift(happy(-1, 2, 2), -1), 110), F(happy(3, 3), 120), F(happy(1, 0), 200),
    ] },
    wag: { loop: true, frames: [F(happy(0, 0, 0), 220), F(happy(-1, 1, 2), 180), F(happy(0, 2, 0), 220), F(happy(1, 3, 2), 180), F(pose({ rip: 0 }), 900)] },
    sitUp: { loop: false, frames: [F(pose({ rip: 0 }), 140), F(alert({}, -1), 120), F(alert({}, -3), 160)] },
    stare: { loop: true, frames: [F(alert(), 2000), F(alert({ eyes: 'closed' }), 130), F(alert({}, -2), 1500), F(alert({ look: 1 }), 400), F(alert(), 300)] },
    bark: { loop: false, frames: [
      F(alert({ bill: 'open' }, -4), 160), F(alert({ bill: 'wide' }, -4), 160), F(alert({}, -3), 120), F(alert({ bill: 'wide' }, -4), 200), F(alert(), 300),
    ] },
    oops: { loop: true, frames: [
      F(pose({ face: { eyes: 'sad', dy: 3 }, bob: 4, tilt: -3, rip: 0 }), 1500),
      F(pose({ face: { eyes: 'sad', dy: 3, dx: -1 }, bob: 5, tilt: -3, rip: 1 }), 700),
      F(pose({ face: { eyes: 'closed', dy: 3 }, bob: 4, tilt: -3, rip: 2 }), 300),
    ] },
    yawn: { loop: false, frames: [
      F(pose({ face: { eyes: 'closed', dy: 1 }, bob: 1 }), 200), F(pose({ face: { eyes: 'closed', bill: 'wide', dy: 1 }, bob: 1 }), 800),
      F(pose({ face: { eyes: 'half' }, bob: 1 }), 260), F(pose(), 300),
    ] },
  }
}

export const CLIPS = buildClips()

// splash: droplets thrown up beside the duck (24x24 effect canvas, toward the screen centre)
const drop = ['6', '6']
const big = ['.6.', '666', '.6.']
export const FX = {
  splash: { ms: 150, frames: [
    [{ x: 4, y: 20, rows: big }],
    [{ x: 3, y: 15, rows: drop }, { x: 8, y: 12, rows: big }, { x: 13, y: 16, rows: drop }],
    [{ x: 2, y: 10, rows: drop }, { x: 7, y: 6, rows: big }, { x: 14, y: 9, rows: drop }, { x: 18, y: 14, rows: drop }],
    [{ x: 4, y: 12, rows: drop }, { x: 9, y: 10, rows: drop }, { x: 16, y: 13, rows: drop }],
    [{ x: 5, y: 19, rows: drop }, { x: 12, y: 20, rows: drop }],
    [],
  ] },
}
export const FX_FOR = { sleep: 'zzz', jump: 'splash', sitUp: 'bubble', stare: 'bubble', bark: 'bubble', oops: 'oops' }

// ── pup: a tiny duck (14x12) ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(pupR.layer(g => {
  pupR.ell(g, 7, 8 - up, 5.5, 3.4, 'Z'); pupR.ell(g, 7, 4.5 - up, 3.6, 3.2, 'Z'); pupR.ell(g, 7, 6.2 - up, 2.4, 1, '5')
}), pupR.raw(g => {
  pupR.px(g, [[5, 4 - up], [9, 4 - up]], 'n'); pupR.px(g, [[5, 10], [6, 10], [9, 10], [10, 10]], '6')
}))
export const PUP = [pupFrame(0), pupFrame(1)]
