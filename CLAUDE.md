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
- A held PermissionRequest (`hookserver.js`) ends without the widget's answer with `{}`, never an
  allow. The hook for it has a 120 s timeout (`claude-hooks.js` TIMEOUT), the hold `holdSeconds`
  (max 110). Bumping the hook shape means bumping `MARK` (now `deskling-v2`); `ours()` must keep
  matching every older mark so upgrades replace, never double.
- The status line wrapper (`statusline.js`) never touches a status line it did not write, keeps the
  user's original in `%APPDATA%\deskling\statusline-original.json`, and leaves OBPTerm's alone.
- Windows-only work (PID lookup, focusing a terminal) lives in the hidden PowerShell child in
  `winhelper.js`, like `fullscreen.js`; both fail soft and log.
- Smoke tests (`scripts/windows-smoke*.ps1`) drive the real UI through UI Automation: Chromium builds
  its accessibility tree only after a client asks, so retry searches; a held PermissionRequest has to
  be sent from a background job.
- Every mascot is code (`src/shared/sprites/`): tune shapes and parameters, not pixels. The logo is
  `sprites/logo.js`; `scripts/make-icon.mjs` turns it into `build/icon.ico` and `docs/logo.png`.

## Working on it
- `npm test` (about 3 s). Add one assert-level test with any rule change in `reducer.js`.
- `preview.html` drives the real renderer and reducer in a browser with scenario buttons
  (`python -m http.server`, then `/preview.html`); `npm start -- --gallery` shows every clip.
- Release: bump `version` in `package.json`, tag `vX.Y.Z`, push the tag. The workflow builds the
  installer on Windows, runs `scripts/windows-smoke.ps1` on a fresh runner (upgrade from cc-dog, hooks,
  the first-start question, uninstall; screenshots in the `smoke-results` artifact) and publishes
  only if that passed. "Run workflow" by hand does the same without publishing.
- Microsoft Store update (manual by choice, 2026-10-02: Ozan's Partner Center account is an
  individual live.com one, no Entra automation): the release carries `deskling-store.msix`
  (unsigned; the Store signs it). Partner Center → Deskling: Desk Buddy → Update → Packages (remove
  the old, add the new) → Store listing "What's new" (text from `store/listing.md`) → Submit. An
  open hand-made draft is fine here, there is no automated publish to delete it.

## Website
`https://obp.com.tr/deskling` lives in the obp.com.tr-site repo (`deskling/index.html`, design
"Big buddy": one giant live mascot on a light page). Its `deskling/js/` is a COPY of
`src/renderer/{dog,draw}.js` and `src/shared/sprites/*.js`: after changing a sprite or adding a
mascot, copy them over and run that repo's deploy workflow, or the page shows the old set.

## Film
`videos/` is the 20 s silent landing film (Remotion 4.0.529; brief and rules in `videos/BRAND.md`,
timeline in `videos/src/film/cues.ts`). The mascot in it is a frame-driven twin of
`src/renderer/dog.js` using the real sprite modules. Fonts are not in git: download Jersey 10,
Instrument Sans and JetBrains Mono from github.com/google/fonts into `videos/public/fonts/`
(`Jersey10.ttf`, `InstrumentSans.ttf`, `JetBrainsMono.ttf`). Render in Docker
(`docker build -t deskling-remotion -f Dockerfile.render .`, then `scripts/final.sh vN`), check
with `scripts/verify.py` (probe a corner: frame 0's centre is the terminal), copy
`deskling-film.{mp4,webm}` + `poster.jpg` to the site's `deskling/film.*` and bump `?v=` there.

## History
This app was called cc-dog until v1.0.0. On first start Deskling copies `%APPDATA%\cc-dog`'s
`config.json`, `token` and `hook-token` (`migrateFrom` in `src/main/config.js`), and treats hooks
marked `X-CcDog-Mark: cc-dog-v1` as its own so they get replaced; the installer removes the old
install, its autostart entry and its Start-menu shortcut.

The relay client (`src/main/stream.js`, `relayUrl` + `token`) follows sessions on another machine
through a self-hosted relay that is not part of this repository. With `relayUrl` empty, the default,
the reducer gets one `{type:'local'}` action and this machine is the whole picture (never offline).
