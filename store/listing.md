# Microsoft Store listing: Deskling Desk Buddy

Everything Partner Center asks for, ready to paste. Product: **Deskling Desk Buddy**
(`OzanBerkPolat.DesklingDeskBuddy`, publisher `CN=CE54EF76-5C7E-4E9A-99C3-9CD72C74D9E7`).
The package is the `deskling-msix` artifact of the release workflow (`deskling.msix`, unsigned; the
Store signs it).

## Pricing and availability
- Price: **Free**. Markets: all. Visibility: public.

## Properties
- Category: **Developer tools** (subcategory: none). Secondary: Productivity.
- Privacy policy URL: `https://obp.com.tr/deskling/privacy`
- Website: `https://obp.com.tr/deskling`
- Support contact: `https://github.com/ozanberkpolat/deskling/issues`
- Product declarations: none of the special ones apply (no in-app purchases, no ads, no
  accessibility claim beyond the defaults). It does not depend on non-Microsoft drivers.
- System requirements: Windows 10 version 1809 or later, x64.

## Age ratings (IARC questionnaire)
Category "Utility, productivity, communication or other". Answer **No** to every content question
(no violence, no user-to-user communication, no sharing of location, no purchases, no gambling).
Expected rating: 3+ / Everyone.

## Store listing (English, United States)

**Product name:** Deskling Desk Buddy

**Short description** (shows in search):
> A pixel-art desk buddy that watches your Claude Code sessions and calls you when one needs you.

**Description:**
> Start a long task in Claude Code, switch to something else, and stop checking the terminal.
>
> Deskling sits in a corner of your screen as a small pixel-art mascot in a coloured ring. It
> naps while nothing runs, types along while a session works, and sits up and calls you once when
> a session needs your answer or a permission. When a turn finishes it celebrates, and the ring
> stays green until you have looked.
>
> - Grey: nothing running. Blue: working. Orange: waiting for you. Green: finished. Red: a turn
>   ended on an error.
> - Click it for the list of sessions; double-click to pet it.
> - Drag it to any corner of any screen, or tuck it into the edge.
> - Ten mascots: shiba, dragon, owl, robot, cat, frog, ghost, alien, rubber duck and cactus.
> - Hides and stays silent in full screen, during quiet hours and while the screen is locked, and
>   hides from screen sharing. While hidden, a waiting session shows as a quiet notification.
>
> Private by design: Deskling sends nothing anywhere. No account, no telemetry. It only listens on
> 127.0.0.1 for Claude Code's own hooks, which it adds to Claude Code's settings only after you say
> yes on first start. Free and open source (MIT): github.com/ozanberkpolat/deskling
>
> Deskling is an independent project, not affiliated with Anthropic. Claude Code is a product of
> Anthropic and is needed for Deskling to show anything.

**What's new in this version:**
> First release.

**Product features** (one per line, max 20):
> Shows what each Claude Code session on this PC is doing, at a glance
> Calls you once when a session waits for your answer or a permission
> Celebrates when a session finishes
> Ten pixel-art mascots
> Snaps to any corner of any screen
> Quiet hours, hidden in full screen and from screen sharing
> Sends nothing anywhere: no account, no telemetry

**Search terms** (max 7): `claude code`, `ai coding`, `desktop widget`, `pixel art`, `mascot`,
`developer tools`, `notifications`

**Screenshots** (desktop, 1920x1080 PNG, in this order): `store/screenshot-1.png` … `-5.png`
1. Start a long task. 2. Switch away. 3. It calls you once (the list open). 4. Done. 5. All ten mascots.

**Store logos:** optional; the package's own logo is used.

**Copyright and trademark info:** `© 2026 Ozan Berk Polat. MIT License.`

**Additional license terms:** `https://github.com/ozanberkpolat/deskling/blob/main/LICENSE`

## Submission options

**Restricted capability justification** (`runFullTrust`, asked under "Submission options"):
> Deskling is a desktop (Win32, Electron) app packaged with the Desktop Bridge. It needs full trust
> to run its own window and tray icon, to listen on 127.0.0.1 for Claude Code's local hooks, and to
> add or remove those hooks in %USERPROFILE%\.claude\settings.json, which it does only after the
> user agrees on first start.

**Notes for certification:**
> Deskling shows the state of Claude Code sessions (a command-line tool from Anthropic) running on
> the same PC. Without Claude Code installed it starts, asks on first start whether to watch Claude
> Code (either answer is fine), and then shows its idle mascot in the top-right corner; the tray
> icon menu has every setting. To see it react without Claude Code, send it a hook by hand: the
> token is in %LOCALAPPDATA%\Packages\OzanBerkPolat.DesklingDeskBuddy_<id>\LocalCache\Roaming\deskling\hook-token, then
> `curl -X POST http://127.0.0.1:8033/hook -H "X-Deskling-Token: <token>" -d "{\"session_id\":\"a\",\"cwd\":\"C:\\\\work\",\"hook_event_name\":\"PermissionRequest\"}"`
> turns the ring orange. It makes no network connections beyond 127.0.0.1.
