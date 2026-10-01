// Tiny raster kit for sprites drawn as code: filled ellipses / rects / polygons in z-order, each
// layer outlined by 1 px so overlapping parts stay readable. Output: palette-indexed strings.
// Pure: no DOM.
export function raster(W, H) {
  const grid = () => Array.from({ length: H }, () => Array(W).fill('.'))
  const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H

  // Paint pixels whose centre passes `test`. `on` limits painting to pixels already holding one of
  // those chars (e.g. cream only over coat).
  function fill(g, test, c, on) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (test(x + 0.5, y + 0.5) && (!on || on.includes(g[y][x]))) g[y][x] = c
  }
  const ell = (g, cx, cy, rx, ry, c, on) => fill(g, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c, on)
  const rect = (g, x0, y0, x1, y1, c, on) => fill(g, (x, y) => x > x0 && x < x1 + 1 && y > y0 && y < y1 + 1, c, on)
  const poly = (g, pts, c, on) => fill(g, (x, y) => pip(pts, x, y), c, on)
  const px = (g, list, c) => { for (const [x, y] of list) if (inside(x, y)) g[y][x] = c }
  // 1 px line (Bresenham), for wing ribs and such
  function line(g, x0, y0, x1, y1, c, on) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let e = dx + dy
    for (;;) {
      if (inside(x0, y0) && (!on || on.includes(g[y0][x0]))) g[y0][x0] = c
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * e
      if (e2 >= dy) { e += dy; x0 += sx }
      if (e2 <= dx) { e += dx; y0 += sy }
    }
  }

  function outline(g) {
    const o = g.map(r => r.slice())
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (g[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && g[y + dy][x + dx] !== '.'))
        o[y][x] = 'k'
    return o
  }

  const layer = draw => { const g = grid(); draw(g); return outline(g) }
  const raw = draw => { const g = grid(); draw(g); return g }       // no outline (details on top)

  function compose(...layers) {
    const g = grid()
    for (const l of layers) if (l) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (l[y][x] !== '.') g[y][x] = l[y][x]
    return g.map(r => r.join(''))
  }

  // Shift a finished frame (strings) by dy rows; rows pushed off the edge are lost.
  const shift = (f, dy) => Array.from({ length: H }, (_, y) => f[y - dy] ?? '.'.repeat(W))

  return { W, H, grid, inside, ell, rect, poly, px, line, outline, layer, raw, compose, shift }
}

function pip(pts, x, y) {
  let r = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r
  }
  return r
}
