// One character per pixel. '.' is transparent. GREY is the offline palette (same keys).
export const PALETTE = {
  k: '#2b1b17', // outline
  n: '#1a1112', // eyes, nose
  o: '#e08a3a', // coat (shiba orange)
  d: '#b9662a', // coat shade
  c: '#f8e4c2', // cream (cheeks, chest, tail underside)
  w: '#ffffff', // eye glint
  p: '#f0909c', // inner ear, tongue
  l: '#3c4452', // laptop body
  L: '#5d6878', // laptop edge
  s: '#8fdcff', // screen glow
  // overlays
  z: '#b8c8e8', // zzz
  y: '#ffd76a', // sparkle
  Y: '#fff6d0', // sparkle core
  a: '#ff8a1e', // the accent: "!" in the bubble
  b: '#f4f6fa', // bubble
  B: '#c9d0db', // bubble edge
  g: '#7b8592', // cloud shade
  G: '#b4bcc8', // cloud
  X: '#ff5a5a', // error ✕
}

export const GREY = {
  ...PALETTE,
  k: '#2a2e35', n: '#20242a', o: '#8c929b', d: '#6c717a', c: '#c4c8cf', p: '#a2a5ad', s: '#9aa3ad', X: '#8e939b',
}
