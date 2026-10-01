// Deskling, 20 s landing loop. One desk in the page's own colours, a camera, the real mascot.
// Every style is a function of `t`; the timeline lives in cues.ts, the layout below.
import { AbsoluteFill, continueRender, delayRender, Img, staticFile } from "remotion";
import { camera, worldTransform, project, type CameraKey } from "../kit/camera";
import { cursorAt, UserCursor, type CursorKey } from "../kit/cursor";
import { move, type Rect } from "../kit/move";
import { step, critical } from "../kit/spring";

/** A critically damped spring that settles (99%) in about `s` seconds. */
const sec = (s: number) => critical(6.6 / s);
import { useTime, progress, clamp01 } from "../kit/time";
import { TargetLog } from "../kit/debug";
import { CUE, CAPTIONS, DURATION } from "./cues";
import { Box, Pup, MASCOT_IDS, type Play } from "./mascot";
import { C, FONT, type Mood } from "./tokens";

export type FilmProps = { fps: number; debug: boolean };

// ── fonts (local copies of the page's Google fonts) ──
const fontsReady = delayRender("fonts");
Promise.all([["Jersey 10", "Jersey10.ttf"], ["Instrument Sans", "InstrumentSans.ttf"], ["JetBrains Mono", "JetBrainsMono.ttf"]]
  .map(([family, file]) => new FontFace(family, `url(${staticFile(`fonts/${file}`)})`).load().then((f) => document.fonts.add(f))))
  .then(() => continueRender(fontsReady));

// ── layout (world units; at zoom 1 the world is the frame) ──
const TERM: Rect = { x: 300, y: 220, w: 1020, h: 610 };
const BROWSER: Rect = { x: 470, y: 300, w: 960, h: 600 };
const BOX = { x: 1560, y: 96, size: 196 };
const BOX_CENTER = { x: BOX.x + BOX.size / 2, y: BOX.y + BOX.size / 2 };
const LIST = { x: 1196, y: 318, w: 420 };
const ROW = { size: 132, gap: 40, y: 330 };
const ORDER = ["cat", "frog", "ghost", "owl", "shiba", "dragon", "robot", "alien", "duck", "cactus"].filter((id) => MASCOT_IDS.includes(id));
const slot = (i: number): Rect => {
  const total = ORDER.length * ROW.size + (ORDER.length - 1) * ROW.gap
  return { x: (1920 - total) / 2 + i * (ROW.size + ROW.gap), y: ROW.y, w: ROW.size, h: ROW.size }
}

const CAM: CameraKey[] = [
  [0, 900, 505, 1.1],
  [CUE.pull, 960, 540, 1],
  [CUE.push, 1340, 420, 1.4],
  [CUE.toTerm - 0.25, 960, 540, 1],
];

const PLAYS: Play[] = [
  [0, ["sleep"]], [CUE.work, ["wake", "type"]], [CUE.wait, ["sitUp", "stare"]], [CUE.bark, ["bark", "stare"]],
  [CUE.answer, ["type"]], [CUE.done, ["jump", "wag"]],
];
const MOODS: [number, Mood][] = [[0, "idle"], [CUE.work, "working"], [CUE.wait, "waiting"], [CUE.answer, "working"], [CUE.done, "finished"]];

const CURSOR: CursorKey[] = [
  { t: 4.6, x: 1180, y: 800, world: true },
  { t: CUE.scroll, x: 900, y: 640, world: true },
  { t: CUE.scroll + 1.6, x: 1010, y: 720, world: true },
  { t: CUE.click, x: BOX_CENTER.x - 10, y: BOX_CENTER.y + 20, world: true, click: true },
  { t: CUE.clickTerm, x: 390, y: 640, world: true, click: true },
];

const pop = sec(0.32);
const glide = sec(0.45);

// ── terminal ──
const PROMPT = "move session handling into its own module";
function Terminal({ t }: { t: number }) {
  const typed = PROMPT.slice(0, Math.round(PROMPT.length * progress(t, CUE.typeFrom, CUE.typeTo - CUE.typeFrom)));
  const blink = Math.floor(t * 2) % 2 === 0;
  const show = (at: number) => t >= at;
  const dot = (c: string = C.termDim) => <span style={{ color: c }}>● </span>;
  const asking = show(CUE.wait) && !show(CUE.answer);
  const L = (key: string, node: React.ReactNode) => <div key={key} style={{ minHeight: 36 }}>{node}</div>;
  const lines = [
    L("cwd", <span style={{ color: C.termDim }}>~/my-app</span>),
    L("p", <>{"> "}{typed}{!show(CUE.enter) && blink && <span style={{ display: "inline-block", width: 12, height: 24, background: C.termInk, verticalAlign: -4 }} />}</>),
    L("b1", ""),
    show(CUE.lines[0]) && L("l0", <>{dot()}Read src/auth/session.ts</>),
    show(CUE.lines[1]) && L("l1", <>{dot()}Edit src/auth/session.ts  <span style={{ color: C.termOk }}>+42</span> <span style={{ color: C.termDim }}>-17</span></>),
    show(CUE.lines[2]) && L("l2", <>{dot()}Bash npm test</>),
    show(CUE.lines[3]) && L("l3", <>{dot()}Write src/auth/index.ts</>),
    asking && L("b2", ""),
    asking && L("a0", <span style={{ color: C.termAsk }}>Run this command?</span>),
    asking && L("a1", <>{"  "}npm install zod</>),
    asking && L("b3", ""),
    asking && L("a2", <>{" "}<span style={{ background: C.termSel, padding: "0 6px" }}>1. Yes</span>{"    2. No"}</>),
    show(CUE.answer) && L("r0", <>{dot()}Bash npm install zod</>),
    show(CUE.after[0]) && L("r1", <>{dot()}Bash npm test</>),
    show(CUE.done) && L("r2", <>{dot(C.termOk)}128 tests pass. Session handling now lives in its own module.</>),
    show(CUE.done) && L("r3", <span style={{ color: C.termDim }}>  done in 4m 12s</span>),
  ].filter(Boolean);
  return (
    <div data-target="terminal" style={{ position: "absolute", left: TERM.x, top: TERM.y, width: TERM.w, height: TERM.h, background: C.term, borderRadius: 14,
      boxShadow: "0 18px 50px #12182133", overflow: "hidden", fontFamily: FONT.mono, fontSize: 22, color: C.termInk, whiteSpace: "pre" }}>
      <div style={{ height: 40, background: C.termBar, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", color: C.termDim, fontSize: 15 }}>
        {[0, 1, 2].map((i) => <i key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: "#3a4250" }} />)}
        <span style={{ marginLeft: 10 }}>my-app</span>
      </div>
      <div style={{ padding: "18px 26px" }}>{lines}</div>
    </div>
  );
}

// ── the window you switch to ──
function Browser({ t }: { t: number }) {
  const scroll = -110 * step(t - CUE.scroll, glide);
  const bars = [0.92, 0.86, 0.95, 0.6, 0, 0.9, 0.82, 0.94, 0.7, 0, 0.88, 0.93, 0.76, 0.9, 0.5];
  return (
    <div style={{ position: "absolute", left: BROWSER.x, top: BROWSER.y, width: BROWSER.w, height: BROWSER.h, background: C.card, border: `1.5px solid ${C.line}`,
      borderRadius: 14, boxShadow: "0 18px 50px #12182126", overflow: "hidden", fontFamily: FONT.ui }}>
      <div style={{ height: 52, borderBottom: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", gap: 8, padding: "0 18px" }}>
        {[0, 1, 2].map((i) => <i key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: C.line }} />)}
        <span style={{ marginLeft: 16, padding: "6px 16px", borderRadius: 999, border: `1.5px solid ${C.line}`, color: C.mut, fontSize: 16 }}>notes / q4-plan</span>
      </div>
      <div style={{ position: "absolute", top: 54, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      <div style={{ padding: "36px 56px", translate: `0 ${scroll}px` }}>
        <div style={{ fontSize: 40, fontWeight: 600, color: C.ink }}>Q4 plan</div>
        <div style={{ fontSize: 19, color: C.mut, marginTop: 6, marginBottom: 28 }}>Auth, sessions, rollout</div>
        {bars.map((w, i) => w === 0 ? <div key={i} style={{ height: 26 }} /> :
          <div key={i} style={{ height: 14, width: `${w * 100}%`, borderRadius: 7, background: C.line, marginBottom: 16 }} />)}
      </div>
      </div>
    </div>
  );
}

// ── the app's list, as it drops down under the box ──
function List({ t }: { t: number }) {
  const open = step(t - CUE.click - 0.08, pop) * (1 - step(t - CUE.clickTerm, pop));
  if (open <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: LIST.x, top: LIST.y, width: LIST.w, padding: 10, borderRadius: 16, fontFamily: FONT.ui,
      background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`, boxShadow: "0 10px 30px #12182155", color: C.listInk,
      transformOrigin: "100% 0", scale: `${0.94 + 0.06 * open}`, opacity: open }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: C.listFaint, padding: "6px 8px 6px" }}>WAITING FOR YOU</div>
      <div style={{ padding: "10px 10px 12px", borderRadius: 10, background: "#ffffff0a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17 }}>
          <i style={{ width: 9, height: 9, borderRadius: "50%", background: C.waiting }} />
          <b>my-app</b><span style={{ color: C.waiting, flex: 1 }}>needs approval</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 14, color: C.listFaint }}>now</span>
        </div>
        <div style={{ fontSize: 16, marginTop: 6, marginLeft: 17 }}>{PROMPT}</div>
        <div style={{ fontSize: 15, marginTop: 4, marginLeft: 17, color: C.listMuted, fontFamily: FONT.mono }}>Bash: npm install zod</div>
      </div>
    </div>
  );
}

// ── captions: one short line per scene, word by word into kept slots ──
function Captions({ t }: { t: number }) {
  return (
    <>
      {CAPTIONS.map(([from, to, text]) => {
        if (t < from - 0.01 || t > to + 0.5) return null;
        const out = step(t - to, sec(0.25));
        return (
          <div key={text} style={{ position: "absolute", left: 110, top: 70, fontFamily: FONT.display, fontSize: 92, lineHeight: 1, color: C.ink, opacity: 1 - out }}>
            {text.split(" ").map((w, i) => {
              const s = step(t - from - i * 0.12, sec(0.28));
              return <span key={i} style={{ display: "inline-block", marginRight: 22, opacity: s, translate: `0 ${(1 - s) * 18}px` }}>{w}</span>;
            })}
          </div>
        );
      })}
    </>
  );
}

// ── the whole scene at time t ──
function Scene({ t, debug }: { t: number; debug?: boolean }) {
  const view = camera(t, CAM);
  const ending = step(t - CUE.end, sec(0.35));                 // the desk clears for the end card
  const desk = 1 - ending;
  const away = step(t - CUE.away, glide) * (1 - step(t - CUE.clickTerm, sec(0.3)));
  const toScreen = (x: number, y: number) => project(view, x, y);
  const cur = cursorAt(t, CURSOR, toScreen);
  const curOn = progress(t, 4.6, 0.3) * (1 - progress(t, CUE.after[0], 0.4));

  // the shiba: in its corner until the end card, then into its slot in the row
  const home: Rect = { x: BOX.x, y: BOX.y, w: BOX.size, h: BOX.size };
  const shibaAt = t < CUE.end ? home : move(t, CUE.end, home, slot(ORDER.indexOf("shiba")));
  const endView = { x: 960, y: 540, zoom: 1 };
  const boxScreen = t < CUE.end ? null : shibaAt;                  // after the end starts it lives in screen space
  const lockup = step(t - CUE.lockup, sec(0.4));

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: worldTransform(t < CUE.end ? view : { ...view, ...lerpView(view, endView, ending) }), opacity: desk }}>
        <Terminal t={t} />
        {away > 0.001 && <div style={{ opacity: away, translate: `0 ${(1 - away) * 70}px`, position: "absolute", inset: 0 }}><Browser t={t} /></div>}
        <List t={t} />
        {!boxScreen && (
          <div data-target="box" style={{ position: "absolute", left: BOX.x, top: BOX.y }}>
            <Box t={t} id="shiba" plays={PLAYS} moods={MOODS} size={BOX.size} waitFrom={CUE.wait} />
          </div>
        )}
        {[0, 1].map((i) => {
          const s = step(t - CUE.pups[i], pop) * (1 - progress(t, CUE.pupsGone, 0.3));
          return s > 0.001 && <div key={i} style={{ position: "absolute", left: BOX_CENTER.x - 52 + i * 62, top: BOX.y + BOX.size + 14, scale: `${s}`, opacity: Math.min(1, s) }}>
            <Pup t={t + i * 0.2} id="shiba" scale={3} /></div>;
        })}
      </div>

      {/* end card: all ten, then the lockup */}
      {t >= CUE.end && ORDER.map((id, i) => {
        if (id === "shiba") return (
          <div key={id} style={{ position: "absolute", left: shibaAt.x, top: shibaAt.y }}>
            <Box t={t} id="shiba" plays={PLAYS} moods={MOODS} size={shibaAt.w} />
          </div>
        );
        const others = ORDER.filter((x) => x !== "shiba").indexOf(id);
        const at = CUE.end + 0.35 + others * 0.125;
        const s = step(t - at, pop);
        const r = slot(i);
        return s > 0.001 && (
          <div key={id} style={{ position: "absolute", left: r.x, top: r.y, scale: `${0.7 + 0.3 * s}`, opacity: clamp01(s) }}>
            <Box t={t} id={id} plays={[[at, ["wake", "jump", "wag"]]]} moods={[[0, "finished"]]} size={ROW.size} />
          </div>
        );
      })}
      {lockup > 0.001 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: ROW.y + ROW.size + 90, display: "flex", justifyContent: "center", alignItems: "center", gap: 26,
          opacity: lockup, translate: `0 ${(1 - lockup) * 20}px` }}>
          <Img src={staticFile("logo.png")} style={{ width: 92, height: 92, imageRendering: "pixelated" }} />
          <span style={{ fontFamily: FONT.display, fontSize: 132, lineHeight: 1, color: C.ink }}>Deskling</span>
        </div>
      )}

      <Captions t={t} />
      {curOn > 0.001 && <div style={{ opacity: curOn }}><UserCursor x={cur.x} y={cur.y} squash={cur.squash} /></div>}
      {debug && <TargetLog />}
    </AbsoluteFill>
  );
}

function lerpView(a: { x: number; y: number; zoom: number }, b: { x: number; y: number; zoom: number }, k: number) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.zoom + (b.zoom - a.zoom) * k };
}

export function Film({ debug }: FilmProps) {
  const t = useTime();
  // The loop: the last stretch fades into frame 0, so the final frame equals the first.
  // The end card clears to the bare page first, then the opening fades in, so the two never mix.
  const last = DURATION - 1 / 60, mid = (CUE.loop + last) / 2;
  const ease = (x: number) => x * x * (3 - 2 * x);
  const out = ease(clamp01((t - CUE.loop) / (mid - CUE.loop)));
  const back = ease(clamp01((t - mid) / (last - mid)));
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ opacity: 1 - out }}><Scene t={t} debug={debug} /></AbsoluteFill>
      {back > 0 && <AbsoluteFill style={{ opacity: back }}><Scene t={0} /></AbsoluteFill>}
    </AbsoluteFill>
  );
}
