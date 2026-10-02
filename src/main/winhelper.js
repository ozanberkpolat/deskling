// "Which process sent this hook?" and "bring that session's terminal to the front", on Windows,
// without a native module: one hidden PowerShell child (started on first use, like fullscreen.js)
// that takes one JSON request per line on stdin and answers one JSON line on stdout.
//   pid:   the TCP connection's owner, i.e. the Claude Code process (looked up while the hook
//          request is still open: once it closes, the port no longer maps to a process).
//   focus: attach to that process's console, take its window's top-level owner (Windows Terminal
//          makes that its own window on purpose; a classic console is its own), pick the tab whose
//          title matches the console title (best effort, through UI Automation), then bring the
//          window forward. Without a console window (VS Code), a visible top-level window whose
//          title names the session's folder.
import { spawn } from 'node:child_process'

const SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -Namespace Deskling -Name W -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern bool FreeConsole();
[DllImport("kernel32.dll")] public static extern bool AttachConsole(uint pid);
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern uint GetConsoleTitle(System.Text.StringBuilder b, uint n);
[DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
[DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
[DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
'@
$A = [System.Windows.Automation.AutomationElement]
function Front($h) {
  if ([Deskling.W]::IsIconic($h)) { [void][Deskling.W]::ShowWindow($h, 9) }
  [Deskling.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [Deskling.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)   # a tap of Alt lets us take the foreground
  [void][Deskling.W]::SetForegroundWindow($h)
  Start-Sleep -Milliseconds 150
  $fg = [Deskling.W]::GetForegroundWindow()
  if ($fg -ne $h) {                     # refused (foreground lock): share the current foreground thread's input queue, then retry
    $me = [Deskling.W]::GetCurrentThreadId(); $them = [Deskling.W]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
    [void][Deskling.W]::AttachThreadInput($me, $them, $true)
    [void][Deskling.W]::BringWindowToTop($h); [void][Deskling.W]::SetForegroundWindow($h)
    [void][Deskling.W]::AttachThreadInput($me, $them, $false)
    Start-Sleep -Milliseconds 150
  }
  [Deskling.W]::GetForegroundWindow() -eq $h          # ok only when it really is in front
}
function Focus($r) {
  $top = [IntPtr]::Zero; $title = ''
  [void][Deskling.W]::FreeConsole()
  if ($r.pid -and [Deskling.W]::AttachConsole([uint32]$r.pid)) {
    $con = [Deskling.W]::GetConsoleWindow()
    $sb = New-Object System.Text.StringBuilder 512
    [void][Deskling.W]::GetConsoleTitle($sb, 512); $title = $sb.ToString()
    if ($con -ne [IntPtr]::Zero) { $top = [Deskling.W]::GetAncestor($con, 3) }   # GA_ROOTOWNER
    [void][Deskling.W]::FreeConsole()
  }
  if ($top -ne [IntPtr]::Zero -and [Deskling.W]::IsWindowVisible($top)) {
    $tab = $false
    if ($title) {
      try {
        $root = $A::FromHandle($top)
        $c = New-Object System.Windows.Automation.AndCondition(
          (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::TabItem)),
          (New-Object System.Windows.Automation.PropertyCondition($A::NameProperty, $title)))
        $t = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $c)
        if ($t) { $t.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select(); $tab = $true }
      } catch {}
    }
    return @{ ok = [bool](Front $top); how = $(if ($tab) { 'tab' } else { 'window' }) }
  }
  # no console window of its own (VS Code's terminal): a window whose title names the folder
  if ($r.folder) {
    $wins = $A::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($w in $wins) {
      $n = $w.Current.Name
      if ($n -and [Deskling.W]::IsWindowVisible([IntPtr]$w.Current.NativeWindowHandle) -and $n.IndexOf([string]$r.folder, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and ($r.term -ne 'vscode' -or $n -like '*Visual Studio Code*')) {
        return @{ ok = [bool](Front ([IntPtr]$w.Current.NativeWindowHandle)); how = 'title' }
      }
    }
  }
  return @{ ok = $false; how = 'none' }
}
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $out = @{}
  try {
    $r = $line | ConvertFrom-Json
    $out.id = $r.id
    if ($r.cmd -eq 'pid') {
      $c = Get-NetTCPConnection -LocalPort ([int]$r.port) -RemotePort ([int]$r.hookPort) -ErrorAction SilentlyContinue | Select-Object -First 1
      $id = $(if ($c) { [int]$c.OwningProcess } else { $null })
      # a WSL hook comes from curl.exe, which exits at once: its parent wsl.exe holds the tab's console
      if ($id) {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
        if ($p -and $p.Name -eq 'curl.exe') {
          $pp = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" -ErrorAction SilentlyContinue
          if ($pp -and $pp.Name -eq 'wsl.exe') { $id = [int]$pp.ProcessId }
        }
      }
      $out.pid = $id
    } elseif ($r.cmd -eq 'focus') { $f = Focus $r; $out.ok = $f.ok; $out.how = $f.how }
  } catch { $out.error = $_.Exception.Message }
  [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}`

// One JSON object per line → callbacks by id. Pure, so it can be tested.
export function createReader(onReply) {
  let buf = ''
  return chunk => {
    buf += chunk
    const lines = buf.split(/\r?\n/)
    buf = lines.pop()
    for (const l of lines) {
      if (!l.trim()) continue
      try { onReply(JSON.parse(l)) } catch {}
    }
  }
}

export function createWinHelper({ log, platform = process.platform, spawnFn = spawn }) {
  if (platform !== 'win32') return { pid: async () => null, focus: async () => ({ ok: false, how: 'unsupported' }), warm() {}, stop() {} }
  let child = null, seq = 0
  const waiting = new Map()                        // id → resolve

  function ensure() {
    if (child) return child
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
    child = spawnFn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    child.stdout.setEncoding('utf8').on('data', createReader(r => { const done = waiting.get(r.id); if (done) { waiting.delete(r.id); done(r) } }))
    child.stderr.setEncoding('utf8').on('data', d => { const s = String(d).trim(); if (s && !s.startsWith('#< CLIXML')) log(`window helper: ${s.slice(0, 200)}`) })
    child.on('error', e => log(`window helper: ${e.message}`))
    child.on('exit', code => {
      child = null
      for (const done of waiting.values()) done({ error: `helper exited (${code})` })
      waiting.clear()
    })
    return child
  }

  // Never throws; resolves with the helper's reply, or {error} after `ms`.
  function ask(req, ms) {
    return new Promise(resolve => {
      const id = ++seq
      const timer = setTimeout(() => { waiting.delete(id); resolve({ error: 'timed out' }) }, ms)
      waiting.set(id, r => { clearTimeout(timer); resolve(r) })
      try { ensure().stdin.write(JSON.stringify({ ...req, id }) + '\n') } catch (e) { waiting.delete(id); clearTimeout(timer); resolve({ error: e.message }) }
    })
  }

  return {
    pid: async (port, hookPort, ms = 1000) => (await ask({ cmd: 'pid', port, hookPort }, ms)).pid ?? null,
    focus: target => ask({ cmd: 'focus', ...target }, 5000),
    // PowerShell takes seconds to start: a cold first lookup timed out and the first session got no jump
    warm() { ensure() },
    stop() { child?.kill() },
  }
}
