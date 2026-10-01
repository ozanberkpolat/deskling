# End-to-end check of deskling-setup.exe on a real Windows (the release workflow runs it on a
# GitHub windows runner; it also works on a spare Windows user account). It changes this user's
# %APPDATA%, %LOCALAPPDATA%\Programs, HKCU Run/Uninstall keys and ~/.claude/settings.json, so never
# run it on a machine you care about. Usage: pwsh scripts/windows-smoke.ps1 -Installer dist\deskling-setup.exe
param([Parameter(Mandatory)][string]$Installer, [string]$Out = 'smoke')
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
function Hooks() {
  if (-not (Test-Path $settings)) { return @() }
  $d = Get-Content $settings -Raw | ConvertFrom-Json -AsHashtable
  @($d.hooks.Values | ForEach-Object { $_ } | ForEach-Object { $_.hooks } | Where-Object { $_ })
}
function Ours() { @(Hooks | Where-Object { $_.headers -and $_.headers['X-Deskling-Mark'] -eq 'deskling-v1' }) }
function Legacy() { @(Hooks | Where-Object { $_.headers -and $_.headers['X-CcDog-Mark'] }) }
function Theirs() { @(Hooks | Where-Object { $_.command -eq 'echo theirs' }) }
function Running() { [bool](Get-Process deskling -ErrorAction SilentlyContinue) }

$run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$uninst = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$programs = Join-Path $env:LOCALAPPDATA 'Programs'
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$settings = Join-Path $env:USERPROFILE '.claude\settings.json'
$appdata = Join-Path $env:APPDATA 'deskling'
$old = Join-Path $env:APPDATA 'cc-dog'

# a fresh runner has neither key yet
foreach ($k in $run, $uninst) { if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null } }

# ── 1. an older cc-dog install, with settings and hooks, and one hook of the user's own ──
New-Item -ItemType Directory -Force $old, (Join-Path $programs 'cc-dog'), (Split-Path $settings) | Out-Null
'{"corner":"bl","localHooks":true,"relayUrl":"","hideFromCapture":false,"hideInFullscreen":false}' | Set-Content (Join-Path $old 'config.json')
'legacy-hook-token-0123456789abcdef' | Set-Content -NoNewline (Join-Path $old 'hook-token')
'' | Set-Content (Join-Path $programs 'cc-dog\cc-dog.exe')
'' | Set-Content (Join-Path $startMenu 'cc-dog.lnk')
Set-ItemProperty $run 'cc-dog' '"C:\nowhere\cc-dog.exe"'
New-Item -Force "$uninst\cc-dog" | Out-Null
$legacyHook = @{ type = 'http'; url = 'http://127.0.0.1:8033/hook'; headers = @{ 'X-CcDog-Token' = 'x'; 'X-CcDog-Mark' = 'cc-dog-v1' } }
@{ model = 'opus'; hooks = @{ Stop = @(@{ hooks = @(@{ type = 'command'; command = 'echo theirs' }) }, @{ hooks = @($legacyHook) }) } } |
  ConvertTo-Json -Depth 10 | Set-Content $settings

# ── 2. install silently; the installer starts the app ──
Start-Process $Installer -ArgumentList '/S' -Wait
Check (Until { Running }) 'installer started deskling.exe'
Check (Until { (Ours).Count -eq 10 } 40) 'migrated localHooks=true: 10 Deskling hooks in settings.json'
Start-Sleep 3
Shot '1-after-upgrade'
Check (-not (Test-Path (Join-Path $programs 'cc-dog'))) 'old install folder removed'
Check ($null -eq (Get-ItemProperty $run -Name 'cc-dog' -ErrorAction SilentlyContinue)) 'old Run entry removed'
Check (-not (Test-Path "$uninst\cc-dog")) 'old uninstall entry removed'
Check (-not (Test-Path (Join-Path $startMenu 'cc-dog.lnk'))) 'old Start-menu shortcut removed'
Check (Test-Path (Join-Path $programs 'Deskling\deskling.exe')) 'installed to Programs\Deskling'
Check (Test-Path "$uninst\Deskling") 'Apps list entry'
Check ((Get-Content (Join-Path $appdata 'config.json') -Raw | ConvertFrom-Json).corner -eq 'bl') 'settings copied from %APPDATA%\cc-dog'
Check ((Get-Content (Join-Path $appdata 'hook-token') -Raw).Trim() -eq 'legacy-hook-token-0123456789abcdef') 'hook token copied'
Check ((Legacy).Count -eq 0) 'cc-dog hooks replaced, not doubled'
Check ((Theirs).Count -eq 1) "the user's own hook kept"
Check ((Get-Content $settings -Raw | ConvertFrom-Json).model -eq 'opus') 'other settings kept'
Check (Test-Path "$settings.deskling-backup") 'settings.json backed up'
Check (Until { Test-Path (Join-Path $startMenu 'Deskling.lnk') }) 'Start-menu shortcut created (needed for notifications)'
Check ($null -ne (Get-ItemProperty $run -Name 'deskling' -ErrorAction SilentlyContinue)) 'start at login registered'

# ── 3. the hook receiver: token required, and a waiting session reaches the widget ──
$tok = (Get-Content (Join-Path $appdata 'hook-token') -Raw).Trim()
$post = { param($t, $body) Invoke-WebRequest -Uri 'http://127.0.0.1:8033/hook' -Method Post -Headers @{ 'X-Deskling-Token' = $t } -Body $body -ContentType 'application/json' -SkipHttpErrorCheck -TimeoutSec 5 }
Check ((& $post 'wrong-token' '{}').StatusCode -eq 401) 'hook receiver refuses a wrong token'
$s = '{"session_id":"smoke1","cwd":"C:\\work\\my-app","hook_event_name":"%E%"}'
Check ((& $post $tok ($s -replace '%E%', 'SessionStart')).StatusCode -eq 200) 'hook receiver accepts the token'
& $post $tok ($s -replace '%E%', 'UserPromptSubmit' -replace '}$', ',"prompt":"fix the login bug"}') | Out-Null
& $post $tok ($s -replace '%E%', 'PermissionRequest') | Out-Null
Start-Sleep 4
Shot '2-session-waiting'
Check (Running) 'still running after hooks'

# ── 4. a brand-new user: the first-start question, before anything is written ──
Stop-Process -Name deskling -Force; Start-Sleep 2
& (Join-Path $programs 'Deskling\deskling.exe') --remove-hooks | Out-Null
Check (Until { (Ours).Count -eq 0 }) '--remove-hooks takes our hooks out'
Check ((Theirs).Count -eq 1) "--remove-hooks keeps the user's hook"
Remove-Item -Recurse -Force $appdata, $old
Start-Process (Join-Path $programs 'Deskling\deskling.exe')
Start-Sleep 8
Shot '3-first-start-question'
Check (Running) 'first start with the question on screen: no crash'
Check ((Ours).Count -eq 0) 'nothing written to settings.json before the user answers'
$ws = New-Object -ComObject WScript.Shell
if ($ws.AppActivate('Deskling')) { Start-Sleep 1; $ws.SendKeys('{ENTER}') } else { Write-Host 'could not focus the question window' }
Check (Until { (Ours).Count -eq 10 } 20) 'answering "Watch Claude Code" adds the hooks'
Shot '4-after-yes'

# ── 5. uninstall ──
Start-Process (Join-Path $programs 'Deskling\Uninstall Deskling.exe') -ArgumentList '/S' -Wait
Check (Until { -not (Test-Path (Join-Path $programs 'Deskling\deskling.exe')) } 60) 'uninstaller removed the program'
Check (Until { (Ours).Count -eq 0 } 30) 'uninstaller took the hooks out'
Check ((Theirs).Count -eq 1) "uninstaller kept the user's hook"
Check (-not (Running)) 'no deskling.exe left running'
Check ($null -eq (Get-ItemProperty $run -Name 'deskling' -ErrorAction SilentlyContinue)) 'start at login entry removed'
Check (-not (Test-Path "$uninst\Deskling")) 'Apps list entry removed'
Check (-not (Test-Path (Join-Path $startMenu 'Deskling.lnk'))) 'Start-menu shortcut removed'

Copy-Item $settings (Join-Path $Out 'settings.json') -ErrorAction SilentlyContinue
Copy-Item (Join-Path $appdata 'deskling.log') $Out -ErrorAction SilentlyContinue
if ($failures.Count) { Write-Host "`n$($failures.Count) check(s) failed:"; $failures | ForEach-Object { Write-Host "  - $_" }; exit 1 }
Write-Host "`nall checks passed"
