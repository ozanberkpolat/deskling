# Deskling film: brand kit

## Brief (interview 2026-10-01)
- Plays on https://obp.com.tr/deskling between the hero and "What it changes on your PC", as a
  **muted autoplay loop**. Silent: no music, no sound. Must read with the sound off.
- **20 s**, **16:9 only** (1920x1080, 60 fps preview, 240 fps final with motion blur).
- **Not a framed video:** it sits on the page with no border, card or player chrome, on the page's
  own background `#e9eef3`, so it reads as the page coming alive. Decode frame 0 of every
  deliverable and check that the background is `#e9eef3` (233,238,243) +-2.
- Words: **short captions**, 2 to 4 words, one per scene.
- Scenes connect on **one desktop with camera moves**; the mascot never leaves its corner until
  the end card.
- Desktop look: **plain, in the page's light palette**, not an imitation of Windows.

## Look (from obp.com.tr-site/deskling/index.html, the "Big buddy" design)
- Page `#e9eef3`, ink `#121821`, muted `#556170`, line `#c9d2dc`, card `#ffffff`.
- Mood colours: idle `#5b6675`, working `#4c8dff`, waiting `#ff8a1e`, finished `#2fd6a3`.
- Fonts: Jersey 10 (display, captions), Instrument Sans (UI text), JetBrains Mono (terminal).
- The mascot box exactly as on the page: a ring `size * .04` in the mood colour around a dark
  radial disc (`#1d2533` to `#0c1017`), the sprite bottom-aligned, the radar (two rings scaling to
  1.6 and fading, 0.6 s apart) only while waiting.
- Surfaces allowed: the page background, white cards with a 1.5 px `#c9d2dc` border (the page's
  cards), the dark terminal (`#121821`, the page's ink, as on the CTA), the app's own dark list
  panel (`#141a24` to `#171e29`, radius 16) when the list opens.

## The mascot
- The app's real sprite modules (`../src/shared/sprites`), painted per frame from `t` by a
  frame-driven twin of `src/renderer/dog.js` (which runs on setTimeout). Effects (zzz, "!", sparkle)
  on their own small canvas beside the box, as in the app.
- Shiba stars; the end card shows all ten.

## Claims (what the product really does)
- Deskling only **shows**: it cannot answer a permission prompt. In the film the answer is given in
  the terminal after the mascot calls; the list only shows what waits.
- It calls once (then once more after 5 min). It runs on Windows. It sends nothing anywhere.
- No Anthropic or Claude logos, no Claude Code UI imitation beyond plain terminal text.

## Banned
Glows, particles, click rings, bouncy easing, invented card tints or outlines, em dashes in copy.
