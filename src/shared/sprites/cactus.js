// Mascot: a cactus in a slate-blue pot (40x40 at 2x). It cannot walk, so the life is sway (the top
// leans left/right), arm poses and the face. Working = sways, arms tap the pot rim; waiting = stands
// tall with spines bristling and wide eyes; finished = a pink flower blooms on top. Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, poly, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20, TOP = 9, BOT = 33, CY = 21, RY = 12.5, RX = 9

export const COLORS = {
  7: '#7fb09a', // cactus body (cool sage)
  8: '#4f8574', // rib stripes
  9: '#5f7596', // pot (slate blue)
  '@': '#8ea6c8', // pot rim
}
export const GREY = { 7: '#9ea4aa', 8: '#7b8188', 9: '#7d838c', '@': '#a7acb3' }

// horizontal centre / half width of the body at row y; lean bends the top, the base stays planted
const t = y => Math.max(0, (BOT - y) / (BOT - TOP))
const cxAt = (y, lean) => C + lean * t(y) ** 1.6
const hwAt = y => RX * Math.sqrt(Math.max(0, 1 - ((y - CY) / RY) ** 2))

// arm tip heights: rest = small raised hand, up = hands in the air, down = hanging toward the rim
const ARM = { rest: 17, up: 10, down: 28, out: 23 }
function arms([l, r], lean) {
  return layer(g => {
    [[-1, l], [1, r]].forEach(([s, kind]) => {
      const ty = ARM[kind], by = 25, bx = cxAt(by, lean) + s * (kind === 'down' ? 9 : 11.5)
      const x0 = Math.round(cxAt(by, lean) + s * 6)
      rect(g, Math.min(x0, bx), by - 1, Math.max(x0, bx) + 1, by + 1, '7')                // stub out of the body
      rect(g, bx - 1 + (s > 0 ? 0 : 0), Math.min(ty, by), bx + 1, Math.max(ty, by + 1), '7') // upright / hanging part
      ell(g, bx + 0.5, ty + (ty < by ? 0 : 1), 2, 1.8, '7')
    })
  })
}

const body = lean => layer(g => {
  for (let y = TOP; y <= BOT; y++) {
    const c = cxAt(y, lean), h = hwAt(y)
    if (h > 0.4) rect(g, Math.round(c - h) - 1, y, Math.round(c + h), y, '7')
  }
})

const pot = layer(g => {
  poly(g, [[13, 34], [27, 34], [26, 40], [14, 40]], '9')
  rect(g, 11, 31, 28, 33, '@')
  rect(g, 11, 33, 28, 33, '9')
  line(g, 15, 36, 15, 38, '@')
})

// ribs + spines + face on top of the body (no outline)
function detail({ lean, eyes, mouth, spiny, dy, bristle }) {
  return raw(g => {
    for (let y = TOP + 3; y <= BOT - 3; y++) {
      const c = cxAt(y, lean), h = hwAt(y)
      for (const k of [-0.62, 0.62]) if (h > 4) px(g, [[Math.round(c + k * h), y]], '8')
      if (h > 4 && y % 3 === 0) {
        const o = (y / 3) % 2 ? 0.3 : -0.3
        px(g, [[Math.round(c + o * h), y]], 'w')
        if (spiny) px(g, [[Math.round(c + (o > 0 ? 0.9 : -0.9) * h), y]], 'c')
      }
      if (bristle && y % 3 === 1 && h > 3) px(g, [[Math.round(c - h) - 1, y], [Math.round(c + h) + 1, y]], 'c')
    }
    const Y = y => y + dy, fx = Math.round(cxAt(18, lean))
    const L = fx - 4, R = fx + 3, ey = Y(17)
    const dot = x => { px(g, [[x, ey], [x + 1, ey], [x, ey + 1], [x + 1, ey + 1]], 'n'); px(g, [[x, ey]], 'w') }
    for (const x of [L, R]) {
      if (eyes === 'open') dot(x)
      else if (eyes === 'wide') { rect(g, x - 1, ey - 1, x + 2, ey + 2, 'n'); px(g, [[x - 1, ey - 1], [x + 2, ey - 1], [x - 1, ey + 2], [x + 2, ey + 2]], '7'); px(g, [[x, ey - 1], [x, ey]], 'w') }
      else if (eyes === 'closed') line(g, x - 1, ey + 1, x + 2, ey + 1, 'n')
      else if (eyes === 'happy') px(g, [[x - 1, ey + 2], [x, ey + 1], [x + 1, ey + 1], [x + 2, ey + 2]], 'n')
      else if (eyes === 'sad') { dot(x); px(g, [[x === L ? x - 1 : x + 2, ey - 1], [x === L ? x : x + 1, ey - 2]], 'n') }
    }
    px(g, [[L - 2, Y(21)], [L - 1, Y(21)], [R + 3, Y(21)], [R + 4, Y(21)]], 'p')   // blush
    const m = fx - 1, my = Y(22)
    if (mouth === 'smile') px(g, [[m - 1, my], [m, my + 1], [m + 1, my + 1], [m + 2, my]], 'n')
    if (mouth === 'flat') line(g, m - 1, my + 1, m + 2, my + 1, 'n')
    if (mouth === 'sad') px(g, [[m - 1, my + 2], [m, my + 1], [m + 1, my + 1], [m + 2, my + 2]], 'n')
    if (mouth === 'o') { ell(g, m + 0.5 + 0.5, my + 1.5, 2, 2, 'n'); px(g, [[m + 1, my + 2]], 'p') }
    if (mouth === 'wide') { ell(g, m + 1, my + 2, 3, 3.2, 'n'); px(g, [[m, my + 3], [m + 1, my + 3], [m + 2, my + 3]], 'p') }
    if (mouth === 'tiny') px(g, [[m, my + 1], [m + 1, my + 1]], 'n')
  })
}

function flower(lean) {
  const fx = Math.round(cxAt(TOP + 1, lean)), fy = 6
  return compose(layer(g => { for (let i = 0; i < 5; i++) { const a = i / 5 * 2 * Math.PI - Math.PI / 2; ell(g, fx + Math.cos(a) * 2.7, fy + Math.sin(a) * 2.7, 1.9, 1.9, 'p') } }),
    raw(g => rect(g, fx - 1, fy - 1, fx, fy, 'y')))
      .map(r => [...r])
}
const overlayGrid = rows => raw(g => rows.forEach((r, y) => r.forEach((c, x) => { if (c !== '.') g[y][x] = c })))

function pose({ lean = 0, eyes = 'open', mouth = 'smile', arm = ['rest', 'rest'], spiny = false, bristle = false, dy = 0, bloom = false } = {}) {
  const parts = [arms(arm, lean), body(lean), pot, detail({ lean, eyes, mouth, spiny, dy, bristle })]
  if (bloom) parts.push(overlayGrid(flower(lean)))
  return compose(...parts)
}
const F = (rows, ms) => ({ rows, ms })

export function buildClips() {
  const asleep = (lean, eyes = 'closed') => pose({ lean, eyes, mouth: 'tiny', dy: 1, arm: ['out', 'out'] })
  const work = (lean, a) => pose({ lean, arm: a, mouth: 'flat' })
  const alert = (extra = {}) => pose({ eyes: 'wide', mouth: 'flat', arm: ['rest', 'rest'], spiny: true, bristle: true, ...extra })
  const glad = (lean, a, extra = {}) => pose({ lean, eyes: 'happy', mouth: 'smile', arm: a, bloom: true, spiny: true, ...extra })
  return {
    sleep: { loop: true, frames: [F(asleep(-2), 1400), F(asleep(-4), 1500), F(asleep(-1), 600), F(asleep(-2), 1200)] },
    curl: { loop: false, frames: [F(pose({ lean: -1, eyes: 'closed', mouth: 'tiny', arm: ['rest', 'out'] }), 260), F(asleep(-2), 300)] },
    wake: { loop: false, frames: [F(pose({ lean: -1, eyes: 'closed', mouth: 'flat', arm: ['rest', 'rest'] }), 240), F(pose({ eyes: 'wide', mouth: 'flat' }), 160), F(pose(), 200)] },
    type: { loop: true, frames: [
      F(work(-2, ['down', 'out']), 260), F(work(-1, ['out', 'down']), 260), F(work(1, ['down', 'out']), 260), F(work(2, ['out', 'down']), 260),
      F(work(1, ['down', 'down']), 240), F(work(-1, ['down', 'out']), 240),
    ] },
    jump: { loop: false, frames: [
      F(shift(glad(-2, ['up', 'up']), 1), 120), F(shift(glad(2, ['up', 'up']), -2), 110), F(shift(glad(-2, ['up', 'up']), -4), 140),
      F(shift(glad(2, ['up', 'up']), -2), 110), F(glad(0, ['up', 'up']), 160), F(glad(0, ['rest', 'rest']), 200),
    ] },
    wag: { loop: true, frames: [F(glad(-3, ['rest', 'up']), 240), F(glad(0, ['up', 'up']), 160), F(glad(3, ['up', 'rest']), 240), F(glad(0, ['rest', 'rest']), 160)] },
    sitUp: { loop: false, frames: [F(pose({ lean: 2, eyes: 'open', mouth: 'flat' }), 140), F(shift(alert({ arm: ['up', 'up'] }), -1), 120), F(alert(), 160)] },
    stare: { loop: true, frames: [F(alert(), 1800), F(alert({ eyes: 'closed' }), 120), F(alert({ lean: 1 }), 1300), F(alert({ arm: ['up', 'rest'] }), 400), F(alert(), 300)] },
    bark: { loop: false, frames: [
      F(shift(alert({ mouth: 'o', arm: ['up', 'up'] }), -1), 160), F(alert({ mouth: 'flat' }), 120), F(shift(alert({ mouth: 'o', arm: ['up', 'up'] }), -1), 200), F(alert(), 300),
    ] },
    oops: { loop: true, frames: [
      F(pose({ lean: -6, eyes: 'sad', mouth: 'sad', arm: ['down', 'down'], dy: 2 }), 1500),
      F(pose({ lean: -7, eyes: 'sad', mouth: 'sad', arm: ['down', 'down'], dy: 3 }), 800),
      F(pose({ lean: -6, eyes: 'closed', mouth: 'sad', arm: ['down', 'down'], dy: 3 }), 300),
    ] },
    yawn: { loop: false, frames: [
      F(pose({ eyes: 'closed', mouth: 'flat' }), 200), F(pose({ eyes: 'closed', mouth: 'wide', lean: -1, arm: ['up', 'up'] }), 750),
      F(pose({ eyes: 'closed', mouth: 'wide', lean: -1, arm: ['up', 'up'] }), 300), F(pose({ eyes: 'open', mouth: 'flat' }), 260),
    ] },
  }
}

export const CLIPS = buildClips()

const pet = ['.p.', 'pyp', '.p.']
const petal = ['p.', '.p']
export const FX = {
  petals: { ms: 200, frames: [
    [{ x: 3, y: 16, rows: pet }],
    [{ x: 4, y: 12, rows: petal }, { x: 14, y: 9, rows: ['.p', 'p.'] }],
    [{ x: 6, y: 9, rows: petal }, { x: 15, y: 6, rows: ['.p', 'p.'] }, { x: 9, y: 18, rows: pet }],
    [{ x: 8, y: 7, rows: ['.p', 'p.'] }, { x: 17, y: 3, rows: petal }, { x: 11, y: 15, rows: petal }],
    [{ x: 18, y: 1, rows: ['.p', 'p.'] }, { x: 13, y: 13, rows: petal }],
    [],
  ] },
}
export const FX_FOR = { sleep: 'zzz', jump: 'petals', sitUp: 'bubble', stare: 'bubble', oops: 'oops' }

// ── pup: a tiny cactus in a pot (14x12) ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(pupR.layer(g => {
  pupR.ell(g, 7, 5.5 - up, 3.4, 4.6, '7')
  pupR.rect(g, 2, 5 - up, 3, 6 - up, '7'); pupR.rect(g, 2, 3 - up, 3, 5 - up, '7')
  pupR.rect(g, 10, 6 - up, 11, 7 - up, '7'); pupR.rect(g, 11, 4 - up, 12, 6 - up, '7')
  pupR.poly(g, [[4, 9], [10, 9], [9, 12], [5, 12]], '9'); pupR.rect(g, 3, 8, 10, 9, '@')
}), pupR.raw(g => { pupR.px(g, [[6, 4 - up], [8, 4 - up]], 'n'); pupR.px(g, [[7, 6 - up]], 'p'); pupR.px(g, [[7, 2 - up]], 'w') }))
export const PUP = [pupFrame(0), pupFrame(1)]
