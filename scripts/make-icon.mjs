// Draws build/icon.ico (16..256 px, PNG entries) and docs/logo.png from the logo in
// src/shared/sprites/logo.js. Run by scripts/build-installer.sh and the release workflow.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LOGO_COLORS, logoRows } from '../src/shared/sprites/logo.js'
import { png } from '../src/main/png.js'

// Up to 64 px each size is drawn at its own size; bigger ones are the 64 px drawing scaled 2x / 4x.
const image = size => size <= 64 ? png(logoRows(size), LOGO_COLORS) : png(logoRows(64), LOGO_COLORS, size / 64)

function ico(sizes) {
  const imgs = sizes.map(image)
  const head = Buffer.alloc(6 + 16 * sizes.length)
  head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4)
  let offset = head.length
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i
    head[e] = s >= 256 ? 0 : s; head[e + 1] = s >= 256 ? 0 : s
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(imgs[i].length, e + 8); head.writeUInt32LE(offset, e + 12)
    offset += imgs[i].length
  })
  return Buffer.concat([head, ...imgs])
}

const root = fileURLToPath(new URL('..', import.meta.url))       // works on Windows paths too
mkdirSync(root + 'build', { recursive: true }); mkdirSync(root + 'docs', { recursive: true })
writeFileSync(root + 'build/icon.ico', ico([16, 24, 32, 48, 64, 128, 256]))
writeFileSync(root + 'docs/logo.png', image(256))
console.log('wrote build/icon.ico and docs/logo.png')
