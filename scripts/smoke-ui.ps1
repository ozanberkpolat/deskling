# Shared by the smoke scripts (dot-source it): drive Deskling's list through UI Automation.
# UIA lives in Windows PowerShell (pwsh 7 has no System.Windows.Automation), so each call runs one
# powershell.exe. The search stays inside Deskling's own windows: a desktop-wide search also walked
# Windows Terminal's text and came back empty. Chromium builds its tree only once a UIA client asks,
# so every call retries. Arguments go through the environment, never through a quoted command line.
$UiaScript = @'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$A = [System.Windows.Automation.AutomationElement]
$all = [System.Windows.Automation.Condition]::TrueCondition
$ids = @(Get-Process deskling -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
for ($i = 0; $i -lt [int]$env:SMOKE_TRIES; $i++) {
  try {
    $names = @()
    foreach ($w in $A::RootElement.FindAll('Children', $all)) {
      if ($ids -notcontains $w.Current.ProcessId) { continue }
      foreach ($e in $w.FindAll('Descendants', $all)) {
        $n = $e.Current.Name; $names += $n
        if ($env:SMOKE_MODE -eq 'press' -and $n -like $env:SMOKE_Q) {
          $p = $null
          if ($e.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$p)) { $p.Invoke(); 'pressed: ' + $n; exit }
        }
      }
    }
    # state: the box is always there once the tree is built; the list region only while open
    if ($env:SMOKE_MODE -eq 'state' -and ($names -like 'Deskling:*')) { if ($names -contains 'Claude Code sessions') { 'open' } else { 'closed' }; exit }
  } catch { Write-Host ('uia retry: ' + $_.Exception.Message) }
  Start-Sleep 1
}
'not found; names seen: ' + (($names | Where-Object { $_ } | Select-Object -Unique) -join ' | ')
'@
function Uia($mode, $q = '', $tries = 10) {
  $env:SMOKE_MODE = $mode; $env:SMOKE_Q = $q; $env:SMOKE_TRIES = $tries
  powershell.exe -NoProfile -Command $UiaScript
}
# press the first invokable element whose name matches (wildcards), e.g. 'Allow' or '*my-app*'
function Press($like) { Uia 'press' $like }
function ListState() { Uia 'state' }
# open the list with the hotkey, but only when it is closed (the hotkey toggles); Deskling then has the foreground
function OpenList() {
  if ((ListState) -ne 'open') { (New-Object -ComObject WScript.Shell).SendKeys('^%d'); Start-Sleep 2 }
  $s = ListState
  Write-Host "list: $s"
}
function CloseList() { if ((ListState) -eq 'open') { (New-Object -ComObject WScript.Shell).SendKeys('^%d'); Start-Sleep 1 } }
