<p align="center"><img src="docs/logo.png" width="96" height="96" alt="Deskling logo: two eyes looking out of an orange ring"></p>

<h1 align="center">Deskling</h1>

<p align="center">A small pixel-art companion in the corner of your screen that shows what your Claude Code sessions are doing.</p>

<p align="center"><a href="https://github.com/ozanberkpolat/deskling/releases/latest/download/deskling-setup.exe"><b>Download for Windows</b></a> · <a href="https://obp.com.tr/deskling">Website</a></p>

<p align="center"><img src="docs/moods.png" width="820" alt="Ten mascots (shiba, dragon, owl, robot, cat, frog, ghost, alien, rubber duck, cactus) in four moods: idle, working, waiting, finished"></p>

Start a long task in Claude Code, switch to something else, and stop checking the terminal. Deskling
sleeps while nothing happens, gets to work while a session works, and sits up and calls you (once)
when a session needs your answer or permission. When a turn finishes it celebrates, and the ring stays
green until you have looked.

The ring around it tells you the state at a glance:

| Ring | Means |
| --- | --- |
| grey, faded | nothing running |
| blue | a session is working |
| orange, pulsing | a session waits for you (permission or a question) |
| green | a session finished since you last looked |
| red | a turn ended on an API error (rate limit included) |

## Install

Two ways to get the same app. Pick one, not both (they would share the hooks and port 8033).

- **Microsoft Store**, as *Deskling Desk Buddy* (the plain name was taken there). Signed by
  Microsoft, so it installs with Smart App Control on, and it updates itself. *The listing is in
  review; the link goes here once it is live.*
- **Installer from GitHub:** [`deskling-setup.exe`](https://github.com/ozanberkpolat/deskling/releases/latest/download/deskling-setup.exe).
  No admin rights needed; it installs for your user only. It is not code-signed yet:
  - Windows SmartScreen asks once: **More info → Run anyway**.
  - **Smart App Control** (Windows 11) blocks unsigned installers outright, with no per-app
    exception. If it is on, use the Store version, or turn it off in Windows Security → App &
    browser control → Smart App Control.

On first start Deskling asks whether to watch Claude Code on this PC (see below). Say yes. Claude
Code sessions you start from then on show up; sessions that were already open usually pick the
change up too.

Windows 10 and 11. A macOS version is planned.

## Using it

- **Click** the box for the list of sessions: project, what it is doing, how long.
- **Double-click** (or press and hold) to pet it. That also marks everything as seen.
- **Drag** it anywhere; it snaps to the nearest corner of whichever screen you drop it on. Drop it
  past the edge to tuck it in, leaving a thin strip that slides out on hover.
- **Ctrl+Alt+D** opens and closes the list from anywhere.
- **Tray icon** (or right-click the box): mascot (shiba, dragon, owl, robot, cat, frog, ghost,
  alien, rubber duck or cactus), shape, corner,
  sound and volume, quiet hours, idle opacity, hide for an hour, start at login.

It gets out of the way on its own: it hides and stays silent while a full-screen app or a
presentation is in front, it never makes a sound during quiet hours (20:00 to 08:00 by default) or
while the screen is locked, and it hides itself from screen sharing and screenshots. While it is
hidden, a session that waits or finishes shows up as a silent Windows notification instead.

## What it changes on your machine

Deskling learns about your sessions through [Claude Code hooks](https://code.claude.com/docs/en/hooks).
When you say yes on first start it:

- adds 10 `http` hooks to `%USERPROFILE%\.claude\settings.json`. Each is marked with an
  `X-Deskling-Mark` header so Deskling can find and remove exactly its own; your other settings and
  hooks are left as they are. The file is backed up once, to `settings.json.deskling-backup`, and is
  never written if it does not parse.
- listens on `127.0.0.1:8033` (loopback only) for those hooks. Every request must carry a random
  token that lives in `%APPDATA%\deskling\hook-token`. It answers at once and never holds Claude Code up.

To stop watching, untick **Watch Claude Code on this PC** in the tray menu: the hooks come out again.
Uninstalling the GitHub installer version (Settings → Apps) takes them out too; the Store version
cannot run anything while it is removed, so untick that switch before uninstalling it. Settings and the log stay in `%APPDATA%\deskling`
until you delete that folder.

## Privacy

Deskling sends nothing anywhere. The only network traffic is Claude Code's hooks arriving on
`127.0.0.1`. The window that draws the mascot has no network access at all (a strict Content
Security Policy plus a request filter), and the app opens no links unless you configure a remote
relay. There is no telemetry and no update check.

## Quota ring (optional)

Deskling can draw your Claude plan usage as a thin arc around the ring: the 5-hour window as the arc
and the weekly window as a dot, amber from 80% and red from 95%. Claude Code only shares those
numbers with a [status line](https://code.claude.com/docs/en/statusline) command, so
Deskling reads them from a file that your status line writes, `%USERPROFILE%\.claude\limits.json`.

If you have no status line yet, this one writes the file and shows nothing (it needs Node.js on your
PATH, and Claude Code to run status line commands with Git Bash, which is its default on
Windows). Add it to `%USERPROFILE%\.claude\settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>require('fs').writeFileSync(require('os').homedir()+'/.claude/limits.json',s))\""
}
```

If you already have a status line, make it also save its input (the JSON it receives on stdin) to
that file. Without the file there is simply no arc.

## Settings file

Everything in the tray menu is stored in `%APPDATA%\deskling\config.json`, which is reloaded as soon
as you save it. A few things are only there: `hotkey` (default `Control+Alt+D`, `""` for none),
`hookPort` (default `8033`), `nagAfterMin` (call once more when something still waits after this
many minutes, default `5`, `0` for never) and `finishedTtlMin` (how long a finished session counts
as new, default `30`). The tray's **Open log** shows `deskling.log` when something looks wrong.

## Build from source

Needs Node.js 22.

```sh
npm ci
npm test        # unit tests, about 3 s
npm start       # run it (on Windows; Linux and macOS start but are not supported yet)
npm start -- --gallery   # every mascot, mood and animation in one window
```

`preview.html` runs the real renderer and state logic in a browser with buttons for every scenario:
serve the folder (`python -m http.server`) and open `/preview.html`. `scripts/build-installer.sh` builds
`dist/deskling-setup.exe` on Linux (with Docker for NSIS); tagged releases are built on a Windows
runner by `.github/workflows/release.yml`.

How it is put together:

- `src/main/`: the Electron main process. `hookserver.js` and `claude-hooks.js` are the Claude Code
  side, `local.js` turns hook payloads into sessions, `window.js` and `displays.js` place the box,
  `tray.js` is the menu.
- `src/shared/`: plain JavaScript with no Electron or DOM. `reducer.js` holds all the state rules
  (what counts as waiting, when to call, when to celebrate), `viewmodel.js` shapes it for the screen,
  `sprites/` draws every mascot in code as palette strings.
- `src/renderer/`: the box, the list and the animation loop.

Deskling can also follow sessions on another machine through a small relay service that you run
yourself (`relayUrl` and `token` in the config). That part is undocumented for now; open an issue if
you want it.

## Privacy policy

[obp.com.tr/deskling/privacy](https://obp.com.tr/deskling/privacy) (the same as the Privacy section above, in full).

## License

[MIT](LICENSE). Deskling is an independent project and is not affiliated with or endorsed by
Anthropic. Claude and Claude Code are trademarks of Anthropic.
