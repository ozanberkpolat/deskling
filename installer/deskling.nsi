; Deskling per-user installer: no admin rights, installs to %LOCALAPPDATA%\Programs\Deskling, starts it.
; Built by scripts/build-installer.sh (locally, makensis in a throwaway Debian container) or by the
; release workflow on a Windows runner. The Start-menu shortcut is created by the app itself on first
; run, because Windows notifications need it to carry the AppUserModelId "deskling" (NSIS cannot set
; that without a plugin).
Unicode true
!define APP "Deskling"
!ifndef VERSION
  !define VERSION "0.0.0"
!endif
Name "${APP}"
Icon "..\build\icon.ico"
UninstallIcon "..\build\icon.ico"
OutFile "..\dist\deskling-setup.exe"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Deskling"
SetCompressor /SOLID lzma
ShowInstDetails nevershow
BrandingText "${APP} ${VERSION}"
Page instfiles

!define UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\Deskling"
!define RUN "Software\Microsoft\Windows\CurrentVersion\Run"

Section
  ; an older copy may be running and holding its files
  nsExec::Exec 'taskkill /IM deskling.exe /F'
  ; this app's earlier name: remove that install, its autostart entry, uninstaller entry and shortcut.
  ; Its settings in %APPDATA%\cc-dog are copied over by the app on first start.
  nsExec::Exec 'taskkill /IM cc-dog.exe /F'
  Sleep 1000
  RMDir /r "$LOCALAPPDATA\Programs\cc-dog"
  DeleteRegValue HKCU "${RUN}" "cc-dog"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-dog"
  Delete "$SMPROGRAMS\cc-dog.lnk"

  SetOutPath "$INSTDIR"
  File /r "..\dist\deskling-win32-x64\*"
  WriteUninstaller "$INSTDIR\Uninstall Deskling.exe"
  WriteRegStr HKCU "${UNINST}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST}" "Publisher" "Deskling"
  WriteRegStr HKCU "${UNINST}" "URLInfoAbout" "https://github.com/ozanberkpolat/deskling"
  WriteRegStr HKCU "${UNINST}" "DisplayIcon" "$INSTDIR\deskling.exe"
  WriteRegStr HKCU "${UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "UninstallString" '"$INSTDIR\Uninstall Deskling.exe"'
  WriteRegDWORD HKCU "${UNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST}" "NoRepair" 1
  Exec '"$INSTDIR\deskling.exe"'
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM deskling.exe /F'
  Sleep 1000
  ; take Deskling's hooks back out of ~/.claude/settings.json before the files go
  ExecWait '"$INSTDIR\deskling.exe" --remove-hooks'
  Delete "$SMPROGRAMS\Deskling.lnk"
  DeleteRegValue HKCU "${RUN}" "deskling"
  DeleteRegKey HKCU "${UNINST}"
  RMDir /r "$INSTDIR"
  ; %APPDATA%\deskling (config, hook token, log) is kept on purpose: reinstalling picks it up again
SectionEnd
