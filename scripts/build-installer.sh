#!/usr/bin/env bash
# Build dist/deskling-setup.exe on Linux: draw the icon, package the app for win32, then wrap it with
# NSIS (makensis runs in a throwaway Debian container, so the host needs neither NSIS nor wine).
# The release workflow does the same on a Windows runner. Usage: scripts/build-installer.sh
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
node scripts/make-icon.mjs
# Setting the exe's own icon needs rcedit, i.e. wine off Windows; without wine the exe keeps
# Electron's icon (the installer, shortcut and tray still use ours).
ICON=(); command -v wine >/dev/null && ICON=(--icon=build/icon.ico)
npx @electron/packager . deskling --platform=win32 --arch=x64 --asar --out=dist --overwrite \
  --app-version="$VERSION" "${ICON[@]}" \
  --ignore='^/(fixtures|test|scripts|dist|build|docs|videos|installer|preview(-settings)?\.html|\.github)($|/)'
docker run --rm -v "$PWD:/w" -w /w/installer debian:stable-slim sh -c \
  "apt-get update -qq >/dev/null && apt-get install -y -qq nsis >/dev/null && makensis -V2 -DVERSION=$VERSION deskling.nsi && chown $(id -u):$(id -g) ../dist/deskling-setup.exe"
ls -l dist/deskling-setup.exe
