# Deskling

A pixel-art companion for the corner of the screen (Electron, Windows first) that shows what Claude
Code sessions on this machine are doing: idle, working, waiting for the user, finished, error. User
docs are in `README.md`; this file is for working on the code.

## Rules
- `src/shared/` stays pure: no Electron, no DOM, no Node APIs, so `node --test` covers it and the
  renderer and `preview.html` can import it.
- The renderer has no network: CSP `connect-src 'none'`, a request filter in `src/main/security.js`,
  and a test that greps `src/` for `POST` and `method:`. Keep it that way.
- `~/.claude/settings.json` belongs to the user: only ever add or remove hooks marked
  `X-Deskling-Mark`, never write a file that does not parse, and never write it before the user said
  yes (`localHooks: null` = not asked yet).
- Links open only for hosts derived from config (`src/main/links.js`); nothing by default.
- Every mascot is code (`src/shared/sprites/`): tune shapes and parameters, not pixels. The logo is
  `sprites/logo.js`; `scripts/make-icon.mjs` turns it into `build/icon.ico` and `docs/logo.png`.

## Working on it
- `npm test` (about 3 s). Add one assert-level test with any rule change in `reducer.js`.
- `preview.html` drives the real renderer and reducer in a browser with scenario buttons
  (`python -m http.server`, then `/preview.html`); `npm start -- --gallery` shows every clip.
- Release: bump `version` in `package.json`, tag `vX.Y.Z`, push the tag. The workflow builds the
  installer on Windows and publishes it as `deskling-setup.exe`.

## History
This app was called cc-dog until v1.0.0. On first start Deskling copies `%APPDATA%\cc-dog`'s
`config.json`, `token` and `hook-token` (`migrateFrom` in `src/main/config.js`), and treats hooks
marked `X-CcDog-Mark: cc-dog-v1` as its own so they get replaced; the installer removes the old
install, its autostart entry and its Start-menu shortcut.

The relay client (`src/main/stream.js`, `relayUrl` + `token`) follows sessions on another machine
through a self-hosted relay that is not part of this repository. With `relayUrl` empty, the default,
the reducer gets one `{type:'local'}` action and this machine is the whole picture (never offline).
