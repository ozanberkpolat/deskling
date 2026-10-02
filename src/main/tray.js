// Tray icon (drawn from the sprite data, no .ico file) and the menu, also shown on a right-click
// of the dog.
import { app, Menu, nativeImage, screen, shell, Tray } from 'electron'
import { png } from './png.js'
import { MASCOTS, mascotOf } from '../shared/sprites/mascots.js'

// The chosen mascot's alert head (32x32 crop of its stare frame), halved for the 16 px tray slot.
export function icon(grey = false, mascot = 'shiba') {
  const m = mascotOf(mascot)
  const head = m.clips.stare.frames[0].rows.slice(1, 33).map(r => r.slice(4, 36))
  const full = nativeImage.createFromBuffer(png(head, grey ? m.grey : m.colors, 1))
  const img = full.resize({ width: 16, height: 16, quality: 'best' })
  img.addRepresentation({ scaleFactor: 2, buffer: full.toPNG() })
  return img
}

export function createTray({ config, widget, log, statusText, onQuit, askStatusline, openSettings }) {
  const tray = new Tray(icon(true, config.get().mascot))
  tray.setToolTip('Deskling')
  let grey = true, shown = config.get().mascot
  const repaint = () => { shown = config.get().mascot; tray.setImage(icon(grey, shown)) }
  config.on('change', c => { if (c.mascot !== shown) repaint() })

  function menu() {
    const c = config.get()
    const vol = Math.round(c.sound.volume * 100)
    const displays = screen.getAllDisplays()
    return Menu.buildFromTemplate([
      { label: statusText(), enabled: false },
      { label: 'Settings…', click: openSettings },
      { type: 'separator' },
      { label: 'Sound', type: 'checkbox', checked: c.sound.enabled, click: i => config.set({ sound: { ...c.sound, enabled: i.checked } }) },
      { label: 'Volume', submenu: [25, 50, 75, 100].map(v => ({
        label: `${v}%`, type: 'radio', checked: Math.abs(vol - v) < 13, click: () => config.set({ sound: { ...c.sound, volume: v / 100 } }) })) },
      { label: 'Display', submenu: [
        { label: 'Automatic (built-in screen)', type: 'radio', checked: !c.display, click: () => config.set({ display: null }) },
        ...displays.map((d, i) => ({
          label: `${d.label || `Display ${i + 1}`} · ${d.size.width}x${d.size.height}${d.internal ? ' · built-in' : ''}`,
          type: 'radio', checked: !!c.display && c.display.id === d.id,
          click: () => config.set({ display: { id: d.id, label: d.label, size: d.size } }),
        })),
      ] },
      { label: 'Mascot', submenu: Object.values(MASCOTS).map(m => ({
        label: m.name, type: 'radio', checked: c.mascot === m.id, click: () => config.set({ mascot: m.id }) })) },
      { label: 'Idle opacity', submenu: [[1, 'Solid (off)'], [0.7, '70%'], [0.45, '45%'], [0.25, '25%']].map(([v, label]) => ({
        label, type: 'radio', checked: Math.abs(c.idleOpacity - v) < 0.01, click: () => config.set({ idleOpacity: v }) })) },
      { label: 'Shape', submenu: [['round', 'Round'], ['square', 'Square']].map(([v, label]) => ({
        label, type: 'radio', checked: c.shape === v, click: () => config.set({ shape: v }) })) },
      { label: 'Corner', submenu: [['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']].map(([v, label]) => ({
        label, type: 'radio', checked: c.corner === v, click: () => config.set({ corner: v }) })) },
      { label: 'Tuck into edge', type: 'checkbox', checked: c.tucked, click: i => config.set({ tucked: i.checked }) },
      { label: 'Quiet hours', submenu: [[null, 'Off'], [{ from: '20:00', to: '08:00' }, '20:00 – 08:00'], [{ from: '22:00', to: '07:00' }, '22:00 – 07:00'], [{ from: '18:00', to: '09:00' }, '18:00 – 09:00']].map(([v, label]) => ({
        label, type: 'radio', checked: JSON.stringify(c.quietHours) === JSON.stringify(v), click: () => config.set({ quietHours: v }) })) },
      { label: 'Back to top right', click: () => config.set({ corner: 'tr', display: null }) },
      widget.hidden
        ? { label: 'Show again', click: () => widget.show() }
        : { label: 'Hide for 1 hour', click: () => widget.hideFor(3_600_000) },
      { label: 'Watch Claude Code on this PC', type: 'checkbox', checked: c.localHooks === true, click: i => config.set({ localHooks: i.checked }) },
      { label: 'Show quota and cost', type: 'checkbox', checked: c.statusline === true, enabled: c.localHooks === true,
        click: i => (i.checked ? askStatusline() : config.set({ statusline: false })) },
      { label: 'Answer permission prompts here', type: 'checkbox', checked: c.answerPermissions, enabled: c.localHooks === true, click: i => config.set({ answerPermissions: i.checked }) },
      { label: 'Hide in full screen (video, slides)', type: 'checkbox', checked: c.hideInFullscreen, click: i => config.set({ hideInFullscreen: i.checked }) },
      { label: 'Hide from screen capture', type: 'checkbox', checked: c.hideFromCapture, click: i => config.set({ hideFromCapture: i.checked }) },
      process.windowsStore
        ? { label: 'Start at login: Windows Settings › Apps › Startup', enabled: false }
        : { label: 'Start at login', type: 'checkbox', checked: c.autostart, enabled: app.isPackaged, click: i => config.set({ autostart: i.checked }) },
      { type: 'separator' },
      { label: 'Open config', click: () => shell.openPath(config.file) },
      { label: 'Open log', click: () => shell.openPath(log.file) },
      { label: 'Quit', click: onQuit },
    ])
  }

  tray.on('click', () => tray.popUpContextMenu(menu()))
  tray.on('right-click', () => tray.popUpContextMenu(menu()))

  return {
    popup: () => menu().popup({ window: widget.win }),
    setOffline(v) { if (v !== grey) { grey = v; repaint() } },
    setTooltip: t => tray.setToolTip(t),
    destroy: () => tray.destroy(),
  }
}
