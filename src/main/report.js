// "Report a problem": the full diagnostics go to the clipboard, and the browser opens a new GitHub
// issue with a short, prefilled body that says so. Only this one fixed URL is ever opened from here
// (the renderer's link allowlist stays empty by default). Pure, so it is tested.
export const ISSUES = 'https://github.com/ozanberkpolat/deskling/issues/new'
export const MAX_URL = 1800                       // ShellExecute and GitHub both get unreliable past ~2 KB

export function issueUrl({ version = '?', channel = '?', windows = '?' } = {}) {
  const body = [
    '**What happened?**', '', '', '**What did you expect?**', '', '',
    `Deskling ${version} (${channel}), Windows ${windows}`, '',
    '**Diagnostics** (Deskling copied them to your clipboard: paste them below; they never contain your prompts)', '', '',
  ].join('\n')
  const url = `${ISSUES}?labels=bug&title=${encodeURIComponent('Bug: ')}&body=${encodeURIComponent(body)}`
  return url.length <= MAX_URL ? url : `${ISSUES}?labels=bug`
}

// Diagnostics as they leave the machine: the home folder (it carries the Windows user name) becomes ~,
// and lines with a web address are dropped (a relay's address could be in them).
export function redact(text, home) {
  let out = String(text)
  if (home) {
    // either slash, any case: C:\Users\Ozan, c:/users/ozan
    const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(home.split(/[\\/]+/).map(esc).join('[\\\\/]+'), 'gi'), '~')
  }
  return out.split('\n').filter(l => !/https?:\/\//i.test(l)).join('\n')
}
