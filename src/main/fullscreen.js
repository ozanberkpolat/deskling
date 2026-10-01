// "Is a full-screen app or a presentation in front?" on Windows, without a native module: one hidden
// PowerShell child calls shell32!SHQueryUserNotificationState every 2 s (the same signal Windows uses
// to hold back its own notifications) and prints the state. Fails open: if the child dies or prints
// garbage, we report "not full screen" and restart it with backoff. Costs one PowerShell process.
import { spawn } from 'node:child_process'

// QUNS_BUSY (a full-screen app), QUNS_RUNNING_D3D_FULL_SCREEN, QUNS_PRESENTATION_MODE
export const HIDE_STATES = [2, 3, 4]

const SCRIPT = `
Add-Type -Namespace Deskling -Name Quns -MemberDefinition '[DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);'
while ($true) {
  $s = 0
  [void][Deskling.Quns]::SHQueryUserNotificationState([ref]$s)
  [Console]::Out.WriteLine($s)
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 2000
}`

// Parse the child's output stream into states; pure, so it can be tested.
export function createParser(onState) {
  let buf = ''
  return chunk => {
    buf += chunk
    const lines = buf.split(/\r?\n/)
    buf = lines.pop()
    for (const l of lines) {
      const n = Number(l.trim())
      onState(Number.isInteger(n) && l.trim() !== '' ? n : null)
    }
  }
}

export function watchFullscreen({ onChange, log, platform = process.platform }) {
  if (platform !== 'win32') return { stop() {} }
  let child = null, stopped = false, full = false, delay = 5000, timer = null
  const set = v => { if (v !== full) { full = v; onChange(v) } }

  function start() {
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const parse = createParser(s => { if (s !== null) delay = 5000; set(s !== null && HIDE_STATES.includes(s)) })
    child.stdout.setEncoding('utf8').on('data', parse)
    child.stderr.setEncoding('utf8').on('data', d => log(`fullscreen helper: ${String(d).trim().slice(0, 200)}`))
    child.on('error', e => log(`fullscreen helper: ${e.message}`))
    child.on('exit', code => {
      child = null
      set(false)                                   // fail open: show the dog
      if (stopped) return
      log(`fullscreen helper exited (${code}); restart in ${delay / 1000} s`)
      timer = setTimeout(start, delay)
      delay = Math.min(delay * 2, 60_000)
    })
  }

  start()
  return { stop() { stopped = true; clearTimeout(timer); child?.kill() } }
}
