// Palette rows → RGBA PNG buffer. No electron import (scripts/make-icon.mjs uses it too).
import { deflateSync, crc32 } from 'node:zlib'

export function png(rows, palette, scale = 1) {
  const w = rows[0].length * scale, h = rows.length * scale
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[Math.floor(y / scale)][Math.floor(x / scale)]
    if (c === '.') continue
    const hex = palette[c]
    raw.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], y * (w * 4 + 1) + 1 + x * 4)
  }
  const chunk = (t, d) => {
    const b = Buffer.alloc(12 + d.length)
    b.writeUInt32BE(d.length); b.write(t, 4); d.copy(b, 8)
    b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length)
    return b
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
