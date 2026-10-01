// `--replay=<fixture.jsonl>[,speed]`: play a recorded relay stream instead of connecting, so the real
// window can be checked without the relay. Same dispatches the live stream makes.
import { readFileSync } from 'node:fs'

export function startReplay(spec, dispatch, log) {
  const [file, speed = '1'] = spec.split(',')
  const lines = readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l))
  log(`replay: ${lines.length} events from ${file} at ${speed}x`)
  const timers = lines.map(l => setTimeout(() => dispatch({ type: l.event, data: l.data }), l.t / Number(speed)))
  return { stop: () => timers.forEach(clearTimeout), kick: () => {} }
}
