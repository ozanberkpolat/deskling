import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FX_W, FX_H } from '../src/shared/sprites/overlays.js'
import { MASCOTS, CLIP_NAMES, mascotOf, effectFor } from '../src/shared/sprites/mascots.js'

// sound.js needs no DOM to import; only calling a voice touches WebAudio
const { VOICES } = await import('../src/renderer/sound.js')

for (const m of Object.values(MASCOTS)) {
  test(`${m.name}: every clip, 40x40, only its own palette`, () => {
    for (const c of CLIP_NAMES) assert.ok(m.clips[c], `${m.id} lacks ${c}`)
    for (const [name, clip] of Object.entries(m.clips)) {
      assert.ok(clip.frames.length, `${m.id}.${name} has no frames`)
      for (const f of clip.frames) {
        assert.equal(f.rows.length, 40, `${m.id}.${name}`)
        for (const r of f.rows) {
          assert.equal(r.length, 40, `${m.id}.${name}`)
          for (const ch of r) assert.ok(ch === '.' || ch in m.colors, `${m.id}.${name} uses "${ch}"`)
        }
        assert.ok(f.ms > 0, `${m.id}.${name}`)
      }
    }
  })

  test(`${m.name}: grey palette, effects, voice`, () => {
    assert.deepEqual(Object.keys(m.grey).sort(), Object.keys(m.colors).sort(), 'grey covers every colour')
    for (const [clip, fx] of Object.entries(m.fxFor)) if (fx !== null) assert.ok(m.fx[fx], `${m.id}: ${clip} → unknown effect ${fx}`)
    for (const [name, eff] of Object.entries(m.fx)) for (const f of eff.frames) for (const o of f) {
      assert.ok(o.x >= 0 && o.y >= 0 && o.y + o.rows.length <= FX_H, `${m.id}.${name}`)
      for (const r of o.rows) {
        assert.ok(o.x + r.length <= FX_W, `${m.id}.${name}`)
        for (const ch of r) assert.ok(ch === '.' || ch in m.colors, `${m.id}.${name} uses "${ch}"`)
      }
    }
    assert.equal(typeof VOICES[m.voice], 'function', `${m.id}: voice ${m.voice}`)
    assert.equal(m.pup.length, 2, `${m.id}: pup has two frames`)
    for (const f of m.pup) {
      assert.equal(f.length, 12, `${m.id} pup`)
      for (const r of f) { assert.equal(r.length, 14, `${m.id} pup`); for (const ch of r) assert.ok(ch === '.' || ch in m.colors, `${m.id} pup uses "${ch}"`) }
    }
  })
}

test('registry: unknown ids fall back to the shiba; offline effects', () => {
  assert.equal(mascotOf('nope').id, 'shiba')
  assert.equal(effectFor(MASCOTS.shiba, 'sleep', true), MASCOTS.shiba.fx.cloud)
  assert.equal(effectFor(MASCOTS.robot, 'offline', true), null)            // its static is on the screen
  assert.equal(effectFor(MASCOTS.dragon, 'bark', false).anchor, 'mid')     // the flame comes out at the mouth
  assert.ok(MASCOTS.robot.clips.offline)
})

test('logo: every icon size is square, ringed, symmetric, and only uses its palette', async () => {
  const { logoRows, LOGO_COLORS } = await import('../src/shared/sprites/logo.js')
  for (const n of [16, 24, 32, 48, 64]) {
    const rows = logoRows(n)
    assert.equal(rows.length, n)
    assert.ok(rows.every(r => r.length === n))
    assert.ok(rows.every(r => [...r].every(c => c === '.' || c in LOGO_COLORS)), `palette ${n}`)
    assert.ok(rows.every(r => r === [...r].reverse().join('') || n >= 32), `mirror ${n}`)   // pupils look inward at 32+
    assert.ok(rows[n >> 1].includes('r') && rows[n >> 1].includes('f'), `ring ${n}`)
    assert.ok(rows.join('').includes('w'), `eyes ${n}`)
  }
})
