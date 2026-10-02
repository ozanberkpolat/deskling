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
Add-Type -Namespace SmokeUi -Name Fg -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder b, int n);'
function FgName() { $b = New-Object System.Text.StringBuilder 256; [void][SmokeUi.Fg]::GetWindowText([SmokeUi.Fg]::GetForegroundWindow(), $b, 256); $b.ToString() }
# open the list with the hotkey, but only when it is closed (the hotkey toggles); Deskling then has the foreground
function OpenList() {
  if ((ListState) -ne 'open') { (New-Object -ComObject WScript.Shell).SendKeys('^%d'); Start-Sleep 2 }
  Write-Host "list: $(ListState); foreground: $(FgName)"
}
function CloseList() {
  if ((ListState) -eq 'open') { (New-Object -ComObject WScript.Shell).SendKeys('^%d'); Start-Sleep 1 }
  Write-Host "list: $(ListState) after closing"
}
# a key press the way a keyboard makes it, scan code included: Chromium reads e.code (WASD by
# position) from the scan code, and WScript's SendKeys sends none, so e.code came through empty
Add-Type -Namespace SmokeUi -Name Kb -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e); [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint c, uint t);'
function Key($ch) {
  $vk = [byte][char]$ch.ToUpper(); $sc = [byte][SmokeUi.Kb]::MapVirtualKey($vk, 0)
  [SmokeUi.Kb]::keybd_event($vk, $sc, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 50
  [SmokeUi.Kb]::keybd_event($vk, $sc, 2, [UIntPtr]::Zero)
}
