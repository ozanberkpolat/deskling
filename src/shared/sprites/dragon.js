// Mascot: a small green dragon, close-up like the shiba (40x40 at 2x). Horns, bat wings behind the
// shoulders, yellow slit-pupil eyes, a striped yellow belly. Waiting = it breathes fire (in the
// sprite, from the mouth down over the chest, plus embers on the effects canvas). Pure.
import { raster } from './raster.js'

export const W = 40, H = 40
const { ell, rect, poly, px, line, layer, raw, compose, shift } = raster(W, H)
const C = 20
const m = x => 2 * C - 1 - x
const both = (g, list, c) => px(g, list.flatMap(([x, y]) => [[x, y], [m(x), y]]), c)

export const COLORS = {
  e: '#4cb35a', // scales
  f: '#2b7a3d', // dark green: wings, spikes, shade
  J: '#8fd694', // muzzle
  h: '#f2d46b', // belly plates
  H: '#cfa93c', // belly stripes
  i: '#f3e6c4', // horns, claws, teeth
  Q: '#ffd84d', // eyes
  r: '#e8432f', // flame, outer
  q: '#ff8f1f', // flame, middle
  m: '#d4d9e2', // smoke
  M: '#98a0ae', // smoke shade
}
export const GREY = { e: '#8c929b', f: '#646a73', J: '#a8adb5', h: '#b6bac1', H: '#9a9ea6', i: '#cfd2d7', Q: '#c3c7ce', r: '#7d828a', q: '#9aa0a8', m: '#c9ccd2', M: '#8e939b' }

const WINGS = {
  rest: [[14, 27], [7, 22], [3, 29], [8, 34], [14, 34]],
  half: [[14, 26], [5, 16], [1, 24], [4, 31], [14, 34]],
  up: [[14, 25], [7, 6], [2, 11], [2, 22], [14, 32]],
  droop: [[14, 29], [9, 30], [5, 38], [10, 40], [14, 36]],
}

function wings(kind) {
  if (!kind) return null
  return layer(g => {
    for (const side of [-1, 1]) {
      const pts = WINGS[kind].map(([x, y]) => [side < 0 ? x : 2 * C - x, y])
      poly(g, pts, 'f')
      const [s0, ...rest] = pts
      for (const p of rest.slice(0, 3)) line(g, s0[0], s0[1], p[0], p[1], 'e', 'f')   // ribs
    }
  })
}

const body = (dy = 0) => layer(g => {
  ell(g, C, 40 + dy, 14, 10.5, 'e')
  ell(g, C, 40 + dy, 7.5, 9, 'h', 'e')
  for (let y = 32 + dy; y < 40; y += 2) line(g, C - 7, y, C + 6, y, 'H', 'h')          // belly plates
})

// eyes: open|closed|happy|wide; mouth: smile|grin|open|fire|yawn; dy lowers the head
function head({ eyes = 'open', mouth = 'smile', dy = 0, smoke = 0 } = {}) {
  const Y = y => y + dy
  const shape = layer(g => {
    ell(g, C, Y(19), 12, 9, 'e')                                  // skull
    ell(g, C, Y(25.5), 8.5, 5.5, 'e')                             // snout
    for (const side of [-1, 1]) {
      const X = x => side < 0 ? x : 2 * C - x
      poly(g, [[X(7), Y(17)], [X(2), Y(13)], [X(4.5), Y(19)], [X(8), Y(22)]], 'f')   // ear fins
    }
    poly(g, [[16, Y(11)], [17.5, Y(7)], [19, Y(10.5)]], 'f')       // head spikes
    poly(g, [[21, Y(10.5)], [22.5, Y(7)], [24, Y(11)]], 'f')
  })
  const horns = layer(g => {
    for (const side of [-1, 1]) {
      const X = x => side < 0 ? x : 2 * C - x
      poly(g, [[X(11), Y(13)], [X(7), Y(2)], [X(10), Y(4)], [X(14.5), Y(11)]], 'i')
    }
  })
  const face = raw(g => {
    shape.forEach((r, y) => r.forEach((c, x) => { g[y][x] = c }))
    ell(g, C, Y(26.5), 6.5, 3.6, 'J', 'e')                        // muzzle
    const E = (list, c) => both(g, list.map(([x, y]) => [x, Y(y)]), c)
    if (eyes === 'open') { E([[13, 16], [14, 16], [15, 16], [13, 17], [14, 17], [15, 17], [13, 18], [14, 18], [15, 18]], 'Q'); E([[14, 16], [14, 17], [14, 18]], 'n'); px(g, [[15, Y(16)], [25, Y(16)]], 'w') }
    if (eyes === 'wide') { E([[12, 15], [13, 15], [14, 15], [15, 15], [12, 16], [15, 16], [12, 17], [15, 17], [12, 18], [13, 18], [14, 18], [15, 18]], 'Q'); E([[13, 16], [14, 16], [13, 17], [14, 17]], 'n'); px(g, [[14, Y(16)], [25, Y(16)]], 'w') }
    if (eyes === 'closed') E([[12, 17], [13, 18], [14, 18], [15, 17]], 'n')
    if (eyes === 'happy') E([[12, 18], [13, 17], [14, 17], [15, 18]], 'n')
    if (eyes === 'sad') { E([[13, 17], [14, 17], [15, 17], [13, 18], [14, 18], [15, 18]], 'Q'); E([[14, 17], [14, 18]], 'n'); E([[12, 16], [13, 16], [14, 15], [15, 14]], 'f') }
    E([[17, 24]], 'n')                                             // nostrils
    if (mouth === 'smile') E([[16, 28], [17, 29], [18, 29], [19, 29]], 'n')
    if (mouth === 'frown') E([[16, 30], [17, 29], [18, 29], [19, 29]], 'n')
    if (mouth === 'grin') { E([[15, 28], [16, 29], [17, 29], [18, 29], [19, 29]], 'n'); E([[17, 28]], 'i') }
    if (mouth === 'open' || mouth === 'fire') {
      E([[15, 28], [16, 28], [17, 28], [18, 28], [19, 28], [15, 29], [15, 30], [16, 31], [17, 31], [18, 31], [19, 31]], 'n')
      E([[16, 29], [17, 29], [18, 29], [19, 29], [16, 30], [17, 30], [18, 30], [19, 30]], mouth === 'fire' ? 'q' : 'p')
      E([[16, 28]], 'i')                                           // fangs
    }
    if (mouth === 'yawn') { E([[17, 28], [18, 28], [19, 28], [16, 29], [16, 30], [17, 31], [18, 31], [19, 31]], 'n'); E([[17, 29], [18, 29], [19, 29], [17, 30], [18, 30], [19, 30]], 'p') }
    if (smoke) px(g, smoke === 1 ? [[17, Y(22)], [22, Y(21)]] : [[16, Y(21)], [23, Y(22)]], 'm')
  })
  return [horns, face]
}

// the breath: a cone out of the mouth, over the chest; f = flicker frame 0..2
function flame(f, dy = 0) {
  return raw(g => {
    const top = 31 + dy, spread = [9, 11, 10][f]
    poly(g, [[C - 4, top], [C + 4, top], [C + spread + 3, 40], [C - spread - 3, 40]], 'r')
    poly(g, [[C - 3, top], [C + 3, top], [C + spread, 40], [C - spread, 40]], 'q')
    poly(g, [[C - 2, top + 1], [C + 2, top + 1], [C + spread - 4, 40], [C - spread + 4, 40]], 'y')
    poly(g, [[C - 1, top + 2], [C + 1, top + 2], [C + 2 + f, 40], [C - 2 - f, 40]], 'Y')
    px(g, [[C - spread - 4 + f, 36], [C + spread + 3 - f, 34], [C - 2, 38 - f]], f % 2 ? 'y' : 'q')
  })
}

function paws({ lift = [0, 0], kb = false } = {}) {
  const board = kb && layer(g => {
    rect(g, 5, 35, 34, 38, 'l')
    for (let x = 7; x < 33; x += 3) px(g, [[x, 36], [x + 1, 36]], 'L')
  })
  const p = layer(g => {
    for (const [cx, l] of [[12.5, lift[0]], [27.5, lift[1]]]) {
      ell(g, cx, 34.5 - l, 3.4, 2.4, 'e')
      px(g, [[Math.round(cx) - 2, 35 - l], [Math.round(cx), 36 - l], [Math.round(cx) + 2, 35 - l]], 'i')    // claws
    }
  })
  return [board, p]
}

const pose = ({ face = {}, wing = 'rest', bob = 0, lift, kb, fire = -1 } = {}) => compose(
  wings(wing), body(bob), ...head({ ...face, dy: (face.dy || 0) + bob }),
  fire >= 0 ? flame(fire, (face.dy || 0) + bob) : null, ...(kb ? paws({ lift, kb }) : []))

const F = (rows, ms) => ({ rows, ms })

export function buildClips() {
  const sleepy = (bob, extra = {}) => pose({ face: { eyes: 'closed', mouth: 'smile', dy: 3, ...extra }, bob })
  const alert = (extra = {}, wing = 'half') => pose({ face: { eyes: 'wide', mouth: 'smile', ...extra }, wing })
  const typing = (lift, eyes = 'open') => pose({ face: { eyes }, lift, kb: true })
  return {
    sleep: { loop: true, frames: [
      F(sleepy(0), 1100), F(sleepy(1), 1300), F(sleepy(0), 1100), F(sleepy(1), 1300),
      F(sleepy(0, { smoke: 1 }), 500), F(sleepy(0, { smoke: 2 }), 500), F(sleepy(1), 1200),
    ] },
    curl: { loop: false, frames: [F(pose({ face: { eyes: 'closed' } }), 260), F(sleepy(0), 300)] },
    wake: { loop: false, frames: [F(sleepy(0, { eyes: 'open' }), 220), F(pose({ face: { eyes: 'closed' }, wing: 'half' }), 180), F(pose(), 200)] },
    type: { loop: true, frames: [
      F(typing([2, 0]), 170), F(typing([0, 0]), 120), F(typing([0, 2]), 170), F(typing([0, 0]), 120),
      F(typing([2, 0]), 170), F(typing([0, 2]), 170), F(typing([0, 0], 'closed'), 130),
    ] },
    jump: { loop: false, frames: [
      F(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'half', bob: 1 }), 120),
      F(shift(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'up' }), -2), 110),
      F(shift(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'half' }), -4), 140),
      F(shift(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'up' }), -3), 110),
      F(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'half', bob: 1 }), 120),
      F(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'rest' }), 200),
    ] },
    wag: { loop: true, frames: [
      F(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'half' }), 220), F(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'up' }), 180),
      F(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'half' }), 220), F(pose({ face: { eyes: 'happy', mouth: 'grin' }, wing: 'rest' }), 300),
      F(pose({ face: { mouth: 'smile' } }), 900), F(pose({ face: { eyes: 'closed', mouth: 'smile' } }), 140),
    ] },
    sitUp: { loop: false, frames: [F(pose({ wing: 'rest' }), 140), F(shift(alert({}, 'up'), -1), 120), F(alert(), 160)] },
    stare: { loop: true, frames: [
      F(alert(), 1800), F(alert({ smoke: 1 }), 400), F(alert({ smoke: 2 }), 400), F(alert(), 1200),
      F(alert({ eyes: 'closed' }), 130), F(alert(), 1400),
    ] },
    bark: { loop: false, frames: [
      F(shift(alert({ mouth: 'open' }, 'up'), -1), 120),
      F(alert({ mouth: 'fire' }, 'up'), 110),
      F(pose({ face: { eyes: 'wide', mouth: 'fire' }, wing: 'up', fire: 0 }), 120),
      F(pose({ face: { eyes: 'wide', mouth: 'fire' }, wing: 'up', fire: 1 }), 120),
      F(pose({ face: { eyes: 'wide', mouth: 'fire' }, wing: 'half', fire: 2 }), 120),
      F(pose({ face: { eyes: 'wide', mouth: 'fire' }, wing: 'half', fire: 1 }), 120),
      F(alert({ mouth: 'open', smoke: 1 }), 200), F(alert({ smoke: 2 }), 300),
    ] },
    oops: { loop: true, frames: [
      F(pose({ face: { eyes: 'sad', mouth: 'frown', dy: 2 }, wing: 'droop' }), 1500),
      F(pose({ face: { eyes: 'sad', mouth: 'frown', dy: 3, smoke: 1 }, wing: 'droop' }), 500),
      F(pose({ face: { eyes: 'closed', mouth: 'frown', dy: 3, smoke: 2 }, wing: 'droop' }), 500),
    ] },
    yawn: { loop: false, frames: [
      F(pose({ face: { eyes: 'closed' } }), 200), F(pose({ face: { eyes: 'closed', mouth: 'yawn' } }), 700),
      F(pose({ face: { eyes: 'closed', smoke: 1 } }), 260), F(pose(), 300),
    ] },
  }
}

export const CLIPS = buildClips()

// effects canvas (24x24). anchor 'mid' = at mouth height; mirror = flip so it points inward.
const ring = ['.mm.', 'm..m', 'm..m', '.mm.']
const ringS = ['.m.', 'm.m', '.m.']
export const FX = {
  smoke: { ms: 520, frames: [
    [{ x: 4, y: 18, rows: ringS }],
    [{ x: 5, y: 15, rows: ringS }, { x: 9, y: 11, rows: ring }],
    [{ x: 10, y: 8, rows: ring }, { x: 15, y: 3, rows: ring }],
    [{ x: 16, y: 1, rows: ring }],
    [],
  ] },
  fire: { ms: 100, anchor: 'mid', mirror: true, frames: [
    [{ x: 0, y: 9, rows: ['rqq.', 'qyyq', 'rqq.'] }],
    [{ x: 0, y: 8, rows: ['.rqqr...', 'rqyyyq..', 'qyYYyqr.', 'rqyyyq..', '.rqqr...'] }],
    [{ x: 0, y: 6, rows: ['..rrq.......', '.rqqyqr.....', 'rqyyYyyqr...', 'qyYYYYyyqqr.', 'rqyyYyyqr...', '.rqqyqr.....', '..rrq.......'] }, { x: 16, y: 4, rows: ['q'] }],
    [{ x: 2, y: 5, rows: ['...rrqr.......', '.rqqyyqqr.....', 'rqyyYYyyqqr...', 'qyYYYYYYyyqqr.', 'rqyyYYyyqqr...', '.rqqyyqqr.....', '...rrqr.......'] }, { x: 19, y: 3, rows: ['y'] }, { x: 18, y: 16, rows: ['q'] }],
    [{ x: 6, y: 6, rows: ['..r.rq....', '.rqqyqqr..', 'rqyYYyyqr.', '.rqqyqqr..', '..r.rq....'] }, { x: 20, y: 5, rows: ['r'] }, { x: 21, y: 15, rows: ['y'] }],
    [{ x: 13, y: 8, rows: ['r.q.', '.q.r', 'q.r.'] }, { x: 21, y: 3, rows: ['q'] }],
    [],
  ] },
  flameRings: { ms: 160, frames: [
    [{ x: 4, y: 14, rows: ['.q.', 'q.q', '.q.'] }],
    [{ x: 3, y: 12, rows: ['.rq.', 'q..q', 'q..q', '.qr.'] }, { x: 14, y: 6, rows: ['.y.', 'y.y', '.y.'] }],
    [{ x: 2, y: 9, rows: ['..rq..', '.q..q.', 'r....q', 'q....r', '.q..q.', '..qr..'] }, { x: 13, y: 3, rows: ['.yq.', 'q..y', 'y..q', '.qy.'] }],
    [{ x: 14, y: 1, rows: ['..yq..', '.q..y.', 'y....q', 'q....y', '.y..q.', '..qy..'] }],
    [],
  ] },
  puff: { ms: 260, anchor: 'mid', mirror: true, frames: [
    [{ x: 0, y: 10, rows: ['mm', 'Mm'] }],
    [{ x: 1, y: 8, rows: ['.mm.', 'mmmm', 'MmmM', '.MM.'] }],
    [{ x: 4, y: 6, rows: ['..mm..', '.mmmmm', 'mmmmmm', 'MmmmmM', '.MMMM.'] }],
    [{ x: 9, y: 5, rows: ['.m.m.', 'm.m.m', '.m.m.'] }],
    [],
  ] },
}
export const FX_FOR = { sleep: 'smoke', jump: 'flameRings', sitUp: 'bubble', stare: 'bubble', bark: 'fire', yawn: 'puff', oops: 'oops' }

// ── pup: a tiny companion (14x12) shown beside the box for each running subagent ──
const pupR = raster(14, 12)
const pupFrame = up => pupR.compose(pupR.layer(g => {
  pupR.poly(g, [[3, 7 - up], [0, 3 - up], [1, 8 - up]], 'f'); pupR.poly(g, [[11, 7 - up], [14, 3 - up], [13, 8 - up]], 'f')   // wing stubs
  pupR.ell(g, 7, 10 - up, 4.5, 2.6, 'e')
  pupR.ell(g, 7, 6 - up, 4, 3.4, 'e')
  pupR.ell(g, 7, 9.5 - up, 2.2, 1.6, 'h', 'e')
}), pupR.raw(g => { pupR.px(g, [[4, 2 - up], [9, 2 - up]], 'i'); pupR.px(g, [[5, 6 - up], [8, 6 - up]], 'Q'); pupR.px(g, [[5, 5 - up], [8, 5 - up]], 'n') }))
export const PUP = [pupFrame(0), pupFrame(1)]
