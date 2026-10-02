# The jump to a session's terminal, on the terminals people use: a Windows Terminal tab (the right
# tab, among two) and a VS Code window. CI installs both from their portable zips first (see
# release.yml). Each fake session is a PowerShell process that sends Deskling's hooks itself, like
# Claude Code would; a click on its row in the list must bring its window (and tab) to the front.
# Changes this user's %APPDATA% and ~/.claude: never run it on a machine you care about.
# Usage: pwsh scripts/windows-smoke-terminals.ps1 -Installer deskling-setup.exe -Wt C:\wt\WindowsTerminal.exe -Code C:\vsc\Code.exe
param([Parameter(Mandatory)][string]$Installer, [Parameter(Mandatory)][string]$Wt, [Parameter(Mandatory)][string]$Code, [string]$Out = 'smoke-terminals')
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Out | Out-Null
$failures = [System.Collections.Generic.List[string]]::new()
function Check($ok, $what) { if ($ok) { Write-Host "ok   $what" } else { Write-Host "FAIL $what"; $failures.Add($what) } }
function Shot($name) {
  try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = [System.Drawing.Bitmap]::new($b.Width, $b.Height)
    [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
    $bmp.Save((Join-Path $Out "$name.png"))
  } catch { Write-Host "screenshot $name failed: $_" }
}
function Until($cond, $seconds = 30) { $end = (Get-Date).AddSeconds($seconds); while (-not (& $cond)) { if ((Get-Date) -gt $end) { return $false }; Start-Sleep -Milliseconds 500 }; return $true }
Add-Type -Namespace Smoke -Name W -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder b, int n);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder b, int n);
'@
function Fg() {
  $h = [Smoke.W]::GetForegroundWindow(); $t = New-Object System.Text.StringBuilder 512; $c = New-Object System.Text.StringBuilder 256
  [void][Smoke.W]::GetWindowText($h, $t, 512); [void][Smoke.W]::GetClassName($h, $c, 256)
  @{ title = $t.ToString(); class = $c.ToString() }
}
$appdata = Join-Path $env:APPDATA 'deskling'
$log = Join-Path $appdata 'deskling.log'

# ── Deskling, already set up (no first-start question), visible to screenshots ──
New-Item -ItemType Directory -Force $appdata | Out-Null
'{"localHooks":true,"hideFromCapture":false,"hideInFullscreen":false}' | Set-Content (Join-Path $appdata 'config.json')
(Start-Process $Installer -ArgumentList '/S' -PassThru).WaitForExit()
Check (Until { Get-Process deskling -ErrorAction SilentlyContinue }) 'Deskling is running'
Check (Until { Test-Path (Join-Path $appdata 'hook-token') }) 'hook token written'
Start-Sleep 3
$tok = (Get-Content (Join-Path $appdata 'hook-token') -Raw).Trim()

# A fake Claude Code session: sets its own window/tab title, then sends SessionStart and a prompt.
function Sender($folder, $title, $term = '') {
  $h = "@{ 'X-Deskling-Token' = '$tok'$(if ($term) { "; 'X-Term' = '$term'" }) }"
  $script = @"
`$Host.UI.RawUI.WindowTitle = '$title'
# then a tool call every 5 s, like a working session (an early pid lookup may come before Deskling's helper is ready)
foreach (`$e in @('SessionStart', 'UserPromptSubmit') + @('PreToolUse') * 60) {
  Invoke-WebRequest -Uri 'http://127.0.0.1:8033/hook' -Method Post -Headers $h -ContentType 'application/json' -UseBasicParsing ``
    -Body ('{"session_id":"$folder","cwd":"C:\\work\\$folder","hook_event_name":"' + `$e + '","prompt":"jump test","tool_name":"Bash","tool_input":{"command":"ls"}}') | Out-Null
  if (`$e -eq 'PreToolUse') { Start-Sleep 5 }
}
"@
  [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
}
. (Join-Path $PSScriptRoot 'smoke-ui.ps1')
function ClickRow($folder) { OpenList; Press "*$folder*" }
function Helper() { (Select-String -Path $log -Pattern 'terminal brought forward|could not bring the terminal' | Select-Object -Last 1).Line }

# ── Windows Terminal: the target tab first, then a decoy tab that becomes the active one ──
$enc = Sender 'wtjump' 'deskling-jump-wt'
Start-Process $Wt -ArgumentList "-w deskling-test new-tab --title deskling-jump-wt powershell -NoProfile -EncodedCommand $enc ; new-tab --title decoy powershell -NoExit -Command `$Host.UI.RawUI.WindowTitle='decoy'"
Start-Sleep 16
Shot '1-wt-before'
Write-Host "wt row: $(ClickRow 'wtjump')"
Start-Sleep 3
Shot '2-wt-after'
$fg = Fg
Write-Host "foreground: $($fg.class) / $($fg.title); helper: $(Helper)"
Check ($fg.class -eq 'CASCADIA_HOSTING_WINDOW_CLASS') 'Windows Terminal: its window comes to the front'
Check ($fg.title -like '*deskling-jump-wt*') 'Windows Terminal: the session''s tab is selected (not the decoy)'
Check ((Helper) -match '\(tab\)') 'Windows Terminal: the helper matched the tab by its title'

# ── VS Code: the folder's window; the session's own console is hidden, so the title decides ──
New-Item -ItemType Directory -Force 'C:\work\vsjump' | Out-Null
Start-Process $Code -ArgumentList '-n --skip-welcome --disable-workspace-trust C:\work\vsjump'
Check (Until { (Get-Process Code -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*vsjump*' }) } 60) 'VS Code opened the folder'
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile', '-EncodedCommand', (Sender 'vsjump' 'deskling-jump-vs' 'vscode')
Start-Sleep 6
Write-Host "vscode row: $(ClickRow 'vsjump')"
Start-Sleep 3
Shot '3-vscode-after'
$fg = Fg
Write-Host "foreground: $($fg.class) / $($fg.title); helper: $(Helper)"
Check ($fg.title -like '*vsjump*Visual Studio Code*') 'VS Code: the folder''s window comes to the front'

Copy-Item $log $Out -ErrorAction SilentlyContinue
if ($failures.Count) { Write-Host "`n$($failures.Count) check(s) failed:"; $failures | ForEach-Object { Write-Host "  - $_" }; exit 1 }
Write-Host "`nall checks passed"
