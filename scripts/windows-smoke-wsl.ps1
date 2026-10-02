# Claude Code inside WSL: the distro gets Deskling's command hooks, they reach Deskling through
# Windows' curl.exe, a held permission prompt gets its Allow back through curl, a click on the row
# brings the WSL console forward (curl.exe → its parent wsl.exe), and the uninstaller takes the hooks
# out of the distro again. CI installs the distro first (Vampire/setup-wsl, see release.yml).
# Changes this user's %APPDATA% and the distro's ~/.claude: never run it on a machine you care about.
# Usage: pwsh scripts/windows-smoke-wsl.ps1 -Installer deskling-setup.exe -Distro Ubuntu-24.04
param([Parameter(Mandatory)][string]$Installer, [Parameter(Mandatory)][string]$Distro, [string]$Out = 'smoke-wsl')
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
'@
function FgTitle() { $b = New-Object System.Text.StringBuilder 512; [void][Smoke.W]::GetWindowText([Smoke.W]::GetForegroundWindow(), $b, 512); $b.ToString() }
$appdata = Join-Path $env:APPDATA 'deskling'
$log = Join-Path $appdata 'deskling.log'
$programs = Join-Path $env:LOCALAPPDATA 'Programs'
# stdin from PowerShell may carry CRLF (a CRLF checkout, the pipe's own newline): files get LF only
function Put($file, $text) { $text | wsl.exe -d $Distro -e sh -c "tr -d '\r' > $file" }
function InDistro($cmd) { wsl.exe -d $Distro -e sh -c $cmd }
function DistroSettings() { (InDistro 'cat "$HOME/.claude/settings.json" 2>/dev/null; true') -join "`n" }
. (Join-Path $PSScriptRoot 'smoke-ui.ps1')

# ── 1. Deskling with this distro turned on (as the Settings checkbox does) ──
New-Item -ItemType Directory -Force $appdata | Out-Null
@{ localHooks = $true; wslDistros = @($Distro); hideFromCapture = $false; hideInFullscreen = $false } | ConvertTo-Json | Set-Content (Join-Path $appdata 'config.json')
(Start-Process $Installer -ArgumentList '/S' -PassThru).WaitForExit()
Check (Until { Get-Process deskling -ErrorAction SilentlyContinue }) 'Deskling is running'
Check (Until { (DistroSettings) -match 'deskling-wsl v1' } 90) "hooks added inside $Distro"
$set = (DistroSettings) | ConvertFrom-Json -AsHashtable
$cmd = @{}
foreach ($ev in 'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest') {
  $cmd[$ev] = @($set.hooks[$ev] | ForEach-Object { $_.hooks } | Where-Object { $_.command -match 'deskling-wsl v1' })[0].command
  Write-Host "$ev hook: $($cmd[$ev] -replace 'Token: \w+', 'Token: ***')"
  Put "/tmp/ev-$ev.sh" $cmd[$ev]
}
Check ($cmd.PermissionRequest -match '-m 110' -and $set.hooks.PermissionRequest[-1].hooks[0].timeout -eq 120) 'PermissionRequest: curl waits 110 s under a 120 s hook timeout'
Check ((Get-Content $log -Raw) -match "WSL ${Distro}: Deskling hooks added") 'logged the install'

# payloads as Claude Code sends them; one file each, so no quoting through wsl.exe
function Payload($sid, $ev, $extra = '') { "{""session_id"":""$sid"",""cwd"":""/home/u/$sid"",""hook_event_name"":""$ev""$extra}" }
Put '/tmp/p-SessionStart.json' (Payload 'wsljump' 'SessionStart')
Put '/tmp/p-UserPromptSubmit.json' (Payload 'wsljump' 'UserPromptSubmit' ',"prompt":"wsl test"')
Put '/tmp/p-PreToolUse.json' (Payload 'wsljump' 'PreToolUse' ',"tool_name":"Bash","tool_input":{"command":"ls"}')
Put '/tmp/p-PermissionRequest.json' (Payload 'wslask' 'PermissionRequest' ',"tool_name":"Bash","tool_input":{"command":"apt list --installed"}')

# ── 2. a WSL session in its own console window, titled so the jump can be checked ──
Put '/tmp/send.sh' @'
printf '\033]0;deskling-jump-wsl\007'
for ev in SessionStart UserPromptSubmit; do sh /tmp/ev-$ev.sh < /tmp/p-$ev.json; echo; done
for i in $(seq 60); do sleep 5; sh /tmp/ev-PreToolUse.sh < /tmp/p-PreToolUse.json; echo; done
'@
$console = Start-Process wsl.exe -ArgumentList '-d', $Distro, '-e', 'sh', '/tmp/send.sh' -PassThru
Start-Sleep 16                                                # a few tool calls, like a working session
OpenList
Shot '1-wsl-session'
$row = Press '*wsljump*'
Write-Host "row: $row"
Check ($row -match 'pressed.*WSL') 'the WSL session shows in the list, with its WSL chip'
Start-Sleep 3
Shot '2-after-jump'
$fg = FgTitle
Write-Host "foreground: $fg; helper: $((Select-String -Path $log -Pattern 'terminal brought forward|could not bring the terminal' | Select-Object -Last 1).Line)"
Check ($fg -like '*deskling-jump-wsl*') 'clicking the row brings the WSL console forward'

# ── 3. a held permission prompt from WSL, allowed in the list; the answer comes back through curl ──
$job = Start-Job -ArgumentList $Distro -ScriptBlock { param($d) (wsl.exe -d $d -e sh -c 'sh /tmp/ev-PermissionRequest.sh < /tmp/p-PermissionRequest.json') -join '' }
Start-Sleep 4
OpenList
Shot '3-wsl-asks'
Write-Host "allow: $(Press 'Allow')"
$answer = Receive-Job $job -Wait; Remove-Job $job -Force -ErrorAction SilentlyContinue   # -AutoRemoveJob raced once ("child job")
Write-Host "curl printed: $answer"
Check ($answer -match '"behavior":"allow"') 'Allow in the list reaches Claude Code in WSL'

# ── 4. Deskling not running: the hook stays quiet and fast (exit 0, no error) ──
Stop-Process -Name deskling -Force; Start-Sleep 2
$t = Measure-Command { $script:quiet = InDistro 'sh /tmp/ev-SessionStart.sh < /tmp/p-SessionStart.json; echo "exit=$?"' }
Write-Host "with Deskling stopped: $quiet in $([int]$t.TotalMilliseconds) ms"
Check ("$quiet" -match 'exit=0' -and $t.TotalSeconds -lt 5) 'with Deskling stopped the hook exits 0 within seconds'

# ── 5. uninstall: the distro's hooks go too ──
(Start-Process (Join-Path $programs 'Deskling\Uninstall Deskling.exe') -ArgumentList '/S' -PassThru).WaitForExit()
Check (Until { -not (Test-Path (Join-Path $programs 'Deskling\deskling.exe')) } 60) 'uninstaller removed the program'
Check (Until { (DistroSettings) -notmatch 'deskling-wsl' } 60) "uninstaller took the hooks out of $Distro"

Stop-Process -Id $console.Id -Force -ErrorAction SilentlyContinue
Copy-Item $log $Out -ErrorAction SilentlyContinue
if ($failures.Count) { Write-Host "`n$($failures.Count) check(s) failed:"; $failures | ForEach-Object { Write-Host "  - $_" }; exit 1 }
Write-Host "`nall checks passed"
