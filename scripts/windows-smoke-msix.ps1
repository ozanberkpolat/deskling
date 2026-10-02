# End-to-end check of the Microsoft Store package on a real Windows (a GitHub windows runner). The
# Store signs the real upload; here the package is signed with a throwaway certificate whose subject
# is the Store publisher, trusted for this machine only, so it can be installed. Checks what is
# different in a package: settings are virtualised, ~/.claude is not, no Run key, and what an
# uninstall leaves behind. Never run it on a machine you care about.
# Usage: pwsh scripts/windows-smoke-msix.ps1 -Package dist\deskling.msix -Publisher 'CN=...'
param([Parameter(Mandatory)][string]$Package, [Parameter(Mandatory)][string]$Publisher, [string]$Out = 'smoke-msix')
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
$settings = Join-Path $env:USERPROFILE '.claude\settings.json'
function Ours() { if (Test-Path $settings) { [regex]::Matches((Get-Content $settings -Raw), '"X-Deskling-Mark"\s*:\s*"deskling-v2"').Count } else { 0 } }
function Running() { [bool](Get-Process deskling -ErrorAction SilentlyContinue) }
$sdk = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64' -Directory | Sort-Object Name | Select-Object -Last 1

# ── sign with a throwaway certificate named like the Store publisher, trust it here ──
$cert = New-SelfSignedCertificate -Type Custom -Subject $Publisher -KeyUsage DigitalSignature -FriendlyName 'Deskling smoke test' `
  -CertStoreLocation 'Cert:\CurrentUser\My' -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
$pfx = Join-Path $env:RUNNER_TEMP 'smoke.pfx'; $pw = ConvertTo-SecureString 'smoke' -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pw | Out-Null
Import-PfxCertificate -FilePath $pfx -Password $pw -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople' | Out-Null
$signed = Join-Path $env:RUNNER_TEMP 'deskling-signed.msix'
Copy-Item $Package $signed
& (Join-Path $sdk.FullName 'signtool.exe') sign /fd SHA256 /f $pfx /p smoke $signed
Check ($LASTEXITCODE -eq 0) 'package signs with the publisher name from the manifest'

# ── install and start ──
Add-AppxPackage -Path $signed
$app = Get-AppxPackage -Name 'OzanBerkPolat.DesklingDeskBuddy'
Check ($null -ne $app) 'installs as OzanBerkPolat.DesklingDeskBuddy'
$pfn = $app.PackageFamilyName
Start-Process "shell:AppsFolder\$pfn!Deskling"
Check (Until { Running }) 'starts from the Start menu entry'
Start-Sleep 8
Shot '1-first-start'
Check ((Ours) -eq 0) 'nothing written to settings.json before the user answers'
powershell.exe -NoProfile -Command @'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Watch Claude Code')
$hits = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
$done = $false
foreach ($e in $hits) { $p = $null; if (-not $done -and $e.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$p)) { $p.Invoke(); $done = $true } }
if (-not $done -and $hits.Count) {
  Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, int e);'
  $r = $hits[0].Current.BoundingRectangle
  [W.U]::SetCursorPos([int]($r.X + $r.Width / 2), [int]($r.Y + $r.Height / 2)); Start-Sleep -Milliseconds 200
  [W.U]::mouse_event(2, 0, 0, 0, 0); [W.U]::mouse_event(4, 0, 0, 0, 0); $done = $true
}
Write-Host "first-start button: $($hits.Count) match(es), pressed=$done"
'@
Check (Until { (Ours) -eq 10 } 20) 'the hooks land in the real ~/.claude/settings.json (not virtualised)'

# ── a package keeps its settings in its own folder ──
$own = Join-Path $env:LOCALAPPDATA "Packages\$pfn\LocalCache\Roaming\deskling"
Check (Until { Test-Path (Join-Path $own 'config.json') }) 'settings live in the package folder (LocalCache\Roaming\deskling)'
Check (-not (Test-Path (Join-Path $env:APPDATA 'deskling\config.json'))) 'nothing in the real %APPDATA%\deskling'
Check ($null -eq (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'deskling' -ErrorAction SilentlyContinue)) 'no Run key (start at login is the manifest task)'

# ── hooks reach it ──
$tok = (Get-Content (Join-Path $own 'hook-token') -Raw).Trim()
$post = { param($body) Invoke-WebRequest -Uri 'http://127.0.0.1:8033/hook' -Method Post -Headers @{ 'X-Deskling-Token' = $tok } -Body $body -ContentType 'application/json' -SkipHttpErrorCheck -TimeoutSec 5 }
Check ((& $post '{"session_id":"m1","cwd":"C:\\work\\my-app","hook_event_name":"SessionStart"}').StatusCode -eq 200) 'hook receiver answers inside the package'
# held for the list (answerPermissions is on): from a job, then released by the session's next event
$held = Start-Job -ArgumentList $tok -ScriptBlock {
  param($t) (Invoke-WebRequest -Uri 'http://127.0.0.1:8033/hook' -Method Post -Headers @{ 'X-Deskling-Token' = $t } -ContentType 'application/json' -TimeoutSec 120 -UseBasicParsing `
    -Body '{"session_id":"m1","cwd":"C:\\work\\my-app","hook_event_name":"PermissionRequest","tool_name":"Bash","tool_input":{"command":"npm test"}}').Content }
Start-Sleep 4
Shot '2-waiting'
Check (Running) 'still running'
& $post '{"session_id":"m1","cwd":"C:\\work\\my-app","hook_event_name":"PreToolUse"}' | Out-Null
Check ((Receive-Job $held -Wait -AutoRemoveJob) -eq '{}') 'a held prompt is released with {} when the terminal answers first'

Copy-Item (Join-Path $own 'deskling.log') $Out -ErrorAction SilentlyContinue

# ── uninstall: a package cannot run code on removal, so our hooks stay (README says so) ──
Remove-AppxPackage -Package $app.PackageFullName
Check (Until { -not (Running) } 20) 'uninstall stops it'
Check ($null -eq (Get-AppxPackage -Name 'OzanBerkPolat.DesklingDeskBuddy')) 'uninstalled'
Write-Host "info: $(Ours) Deskling hooks left in settings.json after uninstall (expected: turn 'Watch Claude Code' off first)"

Copy-Item $settings (Join-Path $Out 'settings.json') -ErrorAction SilentlyContinue
if ($failures.Count) { Write-Host "`n$($failures.Count) check(s) failed:"; $failures | ForEach-Object { Write-Host "  - $_" }; exit 1 }
Write-Host "`nall checks passed"
