// The Deskling mark: a pair of eyes looking out of the mood ring. Drawn for each size N (16 px is
// drawn for 16 px, not shrunk from 256), as palette rows like the sprites. Pure.
export const LOGO_COLORS = { k: '#2b1b17', f: '#141a24', w: '#ffffff', n: '#1a1112', r: '#ff8a1e' }

export function logoRows(N) {
  const g = Array.from({ length: N }, () => Array(N).fill('.'))
  const c = N / 2, rO = N / 2 - 0.5, t = Math.max(2, Math.round(N / 12)), rI = rO - t, D = 2 * rI
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = x + 0.5, py = y + 0.5, d = Math.hypot(px - c, py - c)
    if (d > rO) continue
    if (d > rI) { g[y][x] = 'r'; continue }
    const u = (px - c) / D, v = (py - c) / D        // -0.5..0.5 inside the ring
    g[y][x] = 'f'
    for (const ex of [-0.19, 0.19]) {
      if (Math.abs(u - ex) <= 0.085 && Math.abs(v + 0.02) <= 0.15) {
        g[y][x] = 'w'
        if (N >= 32 && v > 0.04 && (ex < 0 ? u > ex - 0.01 : u < ex + 0.01)) g[y][x] = 'n'
      }
    }
  }
  // 1 px dark outline outside the ring, like the sprites
  const o = g.map(r => r.slice())
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (g[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== '.')) o[y][x] = 'k'
  return o.map(r => r.join(''))
}
