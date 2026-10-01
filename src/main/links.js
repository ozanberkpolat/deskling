// The only links Deskling opens (all of them come from a configured relay, none from this machine):
// a remote session's web terminal under config.ccUrl, or an item on one of config.linkHosts. Pure.
export function allowedLinks({ ccUrl = '', linkHosts = [] } = {}) {
  const a = linkHosts.map(h => [h, '/'])
  try { if (ccUrl) { const u = new URL(ccUrl); a.push([u.hostname, u.pathname]) } } catch {}
  return a
}

export function safeExternal(url, allowed = []) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !u.username && !u.password &&
      allowed.some(([host, path]) => u.hostname === host && u.pathname.startsWith(path))
  } catch { return false }
}

// CC opens a tab by its tmux name: <ccUrl>#t=<tmux>.
export function sessionUrl(ccUrl, tmux) {
  const u = new URL(ccUrl)
  u.hash = `t=${encodeURIComponent(tmux)}`
  return u.toString()
}
