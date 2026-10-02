// Claude Code inside WSL. Its 127.0.0.1 is the Linux VM, not Windows, so the hooks there are
// `command` hooks that pipe the hook's JSON through Windows' own curl.exe (WSL interop): the request
// starts on the Windows side, reaches Deskling on 127.0.0.1, and curl prints Deskling's reply, which
// Claude Code reads exactly like an http hook's body (so Allow / Deny works too). No firewall prompt,
// no change to WSL's networking. A distro's settings file is read and written through wsl.exe itself
// (not the \\wsl.localhost share), so its owner, mode and line endings stay right. Only distros the
// user turned on are ever touched; listing them (wsl.exe -l -q) does not start any.
import { execFile, execFileSync } from 'node:child_process'
import { TIMEOUT, WSL_MARK, hasHooks, parseSettings, withHooks, withoutHooks } from './claude-hooks.js'

const SKIP = /^(docker-desktop|rancher-desktop)/i
const SAFE = /^[\w.-]+$/                              // distro names and tokens go into a shell command

// `wsl.exe -l -q` prints UTF-16LE (unless WSL_UTF8 is set); names one per line. Pure.
export function parseDistros(buf) {
  const text = Buffer.isBuffer(buf) && buf.includes(0) ? buf.toString('utf16le') : String(buf)
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(s => s.replace(/\0/g, '').trim()).filter(s => s && !SKIP.test(s) && SAFE.test(s))
}

// The hook command for one event (POSIX sh; Claude Code runs it with `sh -c`). curl's -m stays under
// the hook's own timeout; `exit 0` keeps a stopped Deskling from showing a hook error on every event.
export function wslHookCommand({ curl, port, token, distro, ev }) {
  if (!SAFE.test(token) || !SAFE.test(distro) || !/^\/[\w./ -]+$/.test(curl)) throw new Error('unsafe value for a WSL hook')
  const max = ev === 'PermissionRequest' ? 110 : 4
  return `c='${curl}'; cd "\${c%/*}" 2>/dev/null; "$c" -s -m ${max} --connect-timeout 1 -H 'Expect:' ` +
    `-H 'X-Deskling-Token: ${token}' -H 'X-Deskling-Wsl: ${distro}' -H "X-Term: $TERM_PROGRAM" ` +
    `--data-binary @- http://127.0.0.1:${port}/hook; exit 0 # ${WSL_MARK}`
}

export const wslHook = opts => ev => ({ type: 'command', command: wslHookCommand({ ...opts, ev }), timeout: TIMEOUT[ev] || 5 })

const run = (args, input) => new Promise((resolve, reject) => {
  const ch = execFile('wsl.exe', args, { encoding: 'buffer', timeout: 60_000, windowsHide: true, maxBuffer: 8 << 20 }, (err, out) => (err ? reject(err) : resolve(out)))
  if (input != null) ch.stdin.end(input)
})

const SETTINGS = '"$HOME/.claude/settings.json"'
// mkdir; back up once; write a temp file from stdin; move it into place
const WRITE = `mkdir -p "$HOME/.claude" && f=${SETTINGS} && { [ ! -f "$f" ] || [ -f "$f.deskling-backup" ] || cp "$f" "$f.deskling-backup"; } && cat > "$f.tmp" && mv "$f.tmp" "$f"`

export function createWsl({ log, exec = run, systemRoot = process.env.SystemRoot || 'C:\\Windows' } = {}) {
  const read = async d => parseSettings((await exec(['-d', d, '-e', 'sh', '-c', `cat ${SETTINGS} 2>/dev/null; true`])).toString('utf8'))
  const write = (d, obj) => exec(['-d', d, '-e', 'sh', '-c', WRITE], JSON.stringify(obj, null, 2) + '\n')
  const curlPath = async d => (await exec(['-d', d, '-e', 'wslpath', '-u', `${systemRoot}\\System32\\curl.exe`])).toString('utf8').trim()

  return {
    async distros() {
      try { return parseDistros(await exec(['-l', '-q'])) } catch { return [] }   // no WSL: nothing to offer
    },
    // Puts the current hooks into a distro. Returns 'installed' | 'unchanged'. Throws (and writes
    // nothing) when its settings.json does not parse.
    async install(d, { port, token }) {
      const hook = wslHook({ curl: await curlPath(d), port, token, distro: d })
      const cur = await read(d)
      if (hasHooks(cur, hook)) return 'unchanged'
      await write(d, withHooks(cur, hook))
      log?.(`WSL ${d}: Deskling hooks added`)
      return 'installed'
    },
    async remove(d) {
      const cur = await read(d)
      const before = JSON.stringify(cur)
      const next = withoutHooks(cur)
      if (JSON.stringify(next) === before) return false
      await write(d, next)
      log?.(`WSL ${d}: Deskling hooks removed`)
      return true
    },
  }
}


// For the uninstaller (`--remove-hooks`), which exits right after: synchronous, best effort.
export function removeSync(distros) {
  for (const d of distros.filter(x => SAFE.test(x))) {
    try {
      const sh = (cmd, input) => execFileSync('wsl.exe', ['-d', d, '-e', 'sh', '-c', cmd], { input, timeout: 30_000, windowsHide: true })
      const cur = parseSettings(sh(`cat ${SETTINGS} 2>/dev/null; true`).toString('utf8'))
      const before = JSON.stringify(cur)
      const next = withoutHooks(cur)
      if (JSON.stringify(next) !== before) sh(WRITE, JSON.stringify(next, null, 2) + '\n')
    } catch {}
  }
}
