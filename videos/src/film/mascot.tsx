// Frame-driven twin of src/renderer/dog.js (which plays clips on setTimeout) and of the mascot box
// on obp.com.tr/deskling. Same sprite modules, same clip plans; the clock is the film's `t`.
import { useLayoutEffect, useRef } from "react";
import { interpolateColors } from "remotion";
import { MASCOTS, effectFor } from "../../../src/shared/sprites/mascots.js";
import { paint } from "../../../src/renderer/draw.js";
import { C, type Mood } from "./tokens";

type Frame = { rows: string[]; ms: number };
type Clip = { loop: boolean; frames: Frame[] };
type Mascot = { id: string; name: string; clips: Record<string, Clip>; colors: Record<string, string>; pup: string[][] };

export const MASCOT_IDS: string[] = Object.keys(MASCOTS);
export const mascot = (id: string): Mascot => (MASCOTS as Record<string, Mascot>)[id];

/** A clip sequence that starts at `t`, like Dog.play(seq): one-shots in order, then the last one loops (or holds). */
export type Play = readonly [t: number, seq: readonly string[]];

const clipLength = (c: Clip) => c.frames.reduce((s, f) => s + f.ms, 0) / 1000;

/** Which clip and frame show at `t`, and when that clip started (effects run from there). */
export function frameAt(m: Mascot, plays: readonly Play[], t: number) {
  let current = plays[0];
  for (const p of plays) if (p[0] <= t) current = p
  let start = current[0], elapsed = Math.max(0, t - current[0])
  const seq = current[1]
  for (let i = 0; i < seq.length; i++) {
    const clip = m.clips[seq[i]], len = clipLength(clip), last = i === seq.length - 1
    if (!last && elapsed >= len) { elapsed -= len; start += len; continue }
    let e = last && clip.loop ? elapsed % len : Math.min(elapsed, len - 1e-6)
    let k = 0
    while (k < clip.frames.length - 1 && e >= clip.frames[k].ms / 1000) { e -= clip.frames[k].ms / 1000; k++ }
    return { name: seq[i], rows: clip.frames[k].rows, start }
  }
  const c = m.clips[seq[seq.length - 1]]
  return { name: seq[seq.length - 1], rows: c.frames[c.frames.length - 1].rows, start }
}

function Sprite({ rows, palette, scale, style }: { rows: string[]; palette: Record<string, string>; scale: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const key = rows.join("")
  useLayoutEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext("2d")!
    ctx.clearRect(0, 0, cv.width, cv.height)
    paint(ctx, rows, palette, 1)
  }, [key, palette, rows])
  return <canvas ref={ref} width={rows[0].length} height={rows.length}
    style={{ width: rows[0].length * scale, height: rows.length * scale, imageRendering: "pixelated", display: "block", ...style }} />
}

const MOOD_COLOR: Record<Mood, string> = { idle: C.idle, working: C.working, waiting: C.waiting, finished: C.finished }

/** The ring colour at `t`: each mood change blends over 0.25 s (the page's border-color transition). */
export function ringColor(moods: readonly (readonly [number, Mood])[], t: number) {
  let color: string = MOOD_COLOR[moods[0][1]], mood = moods[0][1]
  for (let i = 1; i < moods.length; i++) {
    const [at, m] = moods[i]
    if (t < at) break
    color = interpolateColors(Math.min(1, (t - at) / 0.25), [0, 1], [MOOD_COLOR[mood], MOOD_COLOR[m]])
    mood = m
  }
  return { color, mood }
}

/** The mascot in its mood ring, as on the page. `size` in px; the sprite fills about 72% of it. */
export function Box({ t, id, plays, moods, size, fxSide = "left", waitFrom }: {
  t: number; id: string; plays: readonly Play[]; moods: readonly (readonly [number, Mood])[]; size: number
  fxSide?: "left" | "right"; waitFrom?: number
}) {
  const m = mascot(id)
  const f = frameAt(m, plays, t)
  const { color, mood } = ringColor(moods, t)
  const scale = Math.round(size * 0.72 / 40 * 100) / 100
  const eff = effectFor(m, f.name, false) as { frames: { x: number; y: number; rows: string[] }[][]; ms?: number; anchor?: string } | null
  const fx = eff ? eff.frames[Math.floor((t - f.start) / ((eff.ms || 450) / 1000)) % eff.frames.length] : null
  const fxScale = size * 0.43 / 24
  const radar = (k: number) => {
    if (mood !== "waiting" || waitFrom === undefined) return null
    const p = ((t - waitFrom - k * 0.6) % 1.4 + 1.4) % 1.4 / 1.4
    if (t - waitFrom - k * 0.6 < 0) return null
    const e = 1 - (1 - p) ** 2
    return <div key={k} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${C.waiting}`, scale: 1 + 0.6 * e, opacity: 0.8 * (1 - e) }} />
  }
  const idle = mood === "idle" ? 0.7 : 1
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {radar(0)}{radar(1)}
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${size * 0.04}px solid ${color}`,
        background: "radial-gradient(circle at 50% 30%, #1d2533, #0c1017 72%)", boxShadow: "0 10px 30px #0c101740", opacity: idle }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "end center", opacity: idle }}>
        <Sprite rows={f.rows} palette={m.colors} scale={scale} style={{ marginBottom: size * 0.02 }} />
      </div>
      {fx && fx.length > 0 && (
        <div style={{ position: "absolute", top: eff?.anchor === "mid" ? size * 0.46 : -size * 0.08, [fxSide]: -size * 0.4, width: 24 * fxScale, height: 24 * fxScale,
          scale: fxSide === "left" && (eff as { mirror?: boolean }).mirror ? "-1 1" : undefined }}>
          {fx.map((o, i) => <Sprite key={i} rows={o.rows} palette={m.colors} scale={fxScale}
            style={{ position: "absolute", left: o.x * fxScale, top: o.y * fxScale }} />)}
        </div>
      )}
    </div>
  )
}

/** A subagent pup (14x12), two frames, 0.4 s each. */
export function Pup({ t, id, scale }: { t: number; id: string; scale: number }) {
  const m = mascot(id)
  return <Sprite rows={m.pup[Math.floor(t / 0.4) % 2]} palette={m.colors} scale={scale} />
}
