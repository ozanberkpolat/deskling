// The page's tokens (obp.com.tr-site/deskling/index.html), all hex so they can animate.
export const C = {
  bg: "#e9eef3", ink: "#121821", mut: "#556170", line: "#c9d2dc", card: "#ffffff",
  idle: "#5b6675", working: "#4c8dff", waiting: "#ff8a1e", finished: "#2fd6a3",
  // the app's own list panel (src/renderer/styles.css)
  panel: "#141a24", panel2: "#171e29", listInk: "#eaf0f7", listMuted: "#8a97a8", listFaint: "#5b6675",
  // terminal text
  term: "#121821", termBar: "#1b2330", termInk: "#e6edf5", termDim: "#7d8898", termOk: "#2fd6a3", termAsk: "#ffcf8a", termSel: "#263247",
} as const;

export const FONT = {
  display: '"Jersey 10", monospace',
  ui: '"Instrument Sans", sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;

export type Mood = "idle" | "working" | "waiting" | "finished";
