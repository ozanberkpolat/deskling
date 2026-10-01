// Quiet hours: {from:'HH:MM', to:'HH:MM'} in the laptop's local time; a window may wrap past midnight
// (20:00 → 08:00). Pure.
const mins = hm => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0) }

export function isQuiet(date, qh) {
  if (!qh || !qh.from || !qh.to) return false
  const now = date.getHours() * 60 + date.getMinutes(), a = mins(qh.from), b = mins(qh.to)
  if (a === b) return false
  return a < b ? now >= a && now < b : now >= a || now < b
}
