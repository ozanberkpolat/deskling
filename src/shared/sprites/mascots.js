// The mascots the widget can wear. Each plays the same clips (sleep, curl, wake, type, jump, wag,
// sitUp, stare, bark, yawn; optionally offline) with its own art, effects and voice. Pure.
import { PALETTE, GREY } from './palette.js'
import { OVERLAYS } from './overlays.js'
import * as shiba from './shiba.js'
import * as dragon from './dragon.js'
import * as owl from './owl.js'
import * as robot from './robot.js'
import * as cat from './cat.js'
import * as frog from './frog.js'
import * as ghost from './ghost.js'
import * as alien from './alien.js'
import * as duck from './duck.js'
import * as cactus from './cactus.js'

export const CLIP_NAMES = ['sleep', 'curl', 'wake', 'type', 'jump', 'wag', 'sitUp', 'stare', 'bark', 'yawn', 'oops']

// shared effects: zzz, bubble ("!"), sparkle, cloud (offline)
const BASE_FX = Object.fromEntries(Object.entries(OVERLAYS).map(([k, frames]) => [k, { frames, ms: { bubble: 520, hearts: 240, oops: 700 }[k] || 450 }]))

const make = (id, name, mod, voice) => ({
  id, name, voice,
  clips: mod.CLIPS,
  colors: { ...PALETTE, ...mod.COLORS },
  grey: { ...GREY, ...mod.GREY },
  fx: { ...BASE_FX, ...mod.FX },
  fxFor: mod.FX_FOR,
  pup: mod.PUP,                       // two 14x12 frames, one companion per running subagent
})

export const MASCOTS = {
  shiba: make('shiba', 'Shiba', shiba, 'yip'),
  dragon: make('dragon', 'Dragon', dragon, 'growl'),
  owl: make('owl', 'Owl', owl, 'hoot'),
  robot: make('robot', 'Robot', robot, 'beep'),
  cat: make('cat', 'Cat', cat, 'meow'),
  frog: make('frog', 'Frog', frog, 'ribbit'),
  ghost: make('ghost', 'Ghost', ghost, 'boo'),
  alien: make('alien', 'Alien', alien, 'warble'),
  duck: make('duck', 'Rubber duck', duck, 'quack'),
  cactus: make('cactus', 'Cactus', cactus, 'chime'),
}
export const mascotOf = id => MASCOTS[id] || MASCOTS.shiba

// which effect plays with a clip; offline has a default cloud unless the mascot says otherwise
export function effectFor(m, clip, offline) {
  const name = offline ? ('offline' in m.fxFor ? m.fxFor.offline : 'cloud') : m.fxFor[clip]
  return name ? m.fx[name] : null
}
