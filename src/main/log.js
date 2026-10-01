// One small log file next to config.json, rolled at 1 MB. Never log the token.
import { appendFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function createLog(dir) {
  const file = join(dir, 'deskling.log')
  const log = msg => {
    const line = `${new Date().toISOString()} ${msg}\n`
    try {
      if (statSync(file, { throwIfNoEntry: false })?.size > 1_000_000) renameSync(file, file + '.1')
      appendFileSync(file, line)
    } catch {}
    process.stdout.write?.(line)
  }
  log.file = file
  return log
}
