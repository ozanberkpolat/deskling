// Paint palette-indexed rows onto a 2D context at an integer scale. Pixel-exact, no smoothing.
export function paint(ctx, rows, palette, scale, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y]
    for (let x = 0; x < r.length; x++) {
      const c = r[x]
      if (c === '.') continue
      ctx.fillStyle = palette[c]
      ctx.fillRect((ox + x) * scale, (oy + y) * scale, scale, scale)
    }
  }
}

// A sprite as a small canvas (tray / window icon, gallery thumbnails).
export function toCanvas(rows, palette, scale) {
  const cv = document.createElement('canvas')
  cv.width = rows[0].length * scale
  cv.height = rows.length * scale
  paint(cv.getContext('2d'), rows, palette, scale)
  return cv
}
