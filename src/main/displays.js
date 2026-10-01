// Which screen the box sits on, and in which corner. Pure: takes Electron display objects, returns
// numbers. Corners use the workArea, so a bottom corner sits above the taskbar.

export const CORNERS = ['tl', 'tr', 'bl', 'br']

// saved {id,label,size} → built-in screen → primary → first. (A display id can change across docks;
// label + size survives that.)
export function pickDisplay(displays, saved, primaryId) {
  if (saved) {
    const byId = displays.find(d => d.id === saved.id)
    if (byId) return byId
    const byLabel = saved.label && displays.find(d => d.label === saved.label &&
      d.size.width === saved.size?.width && d.size.height === saved.size?.height)
    if (byLabel) return byLabel
  }
  return displays.find(d => d.internal) || displays.find(d => d.id === primaryId) || displays[0]
}

// The window hugs the corner of the work area; the box sits in the same corner of the window, so it
// stays put when the window grows for the list.
export function windowRect(display, corner, width, height) {
  const a = display.workArea
  return {
    x: corner.endsWith('l') ? a.x : a.x + a.width - width,
    y: corner.startsWith('t') ? a.y : a.y + a.height - height,
    width, height,
  }
}

// The corner whose quadrant holds `point` (a drop).
export function nearestCorner(display, point) {
  const a = display.workArea
  return (point.y < a.y + a.height / 2 ? 't' : 'b') + (point.x < a.x + a.width / 2 ? 'l' : 'r')
}
