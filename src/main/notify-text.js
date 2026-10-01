// The words of a notification, from the store's state. Pure (no electron import), so it is tested.
export function describe(fx, st) {
  if (fx.kind === 'pc') {
    const i = st.paperclip.items.find(x => x.key === fx.id)
    return i && { title: `Paperclip · ${i.company || ''}`.trim(), body: [i.id, i.title].filter(Boolean).join(' ') + (i.whyNow ? `\n${i.whyNow}` : ''), target: { url: i.url } }
  }
  const s = st.sessions[fx.id]
  if (!s) return null
  const what = fx.fx === 'celebrate' ? 'finished' : s.state === 'blocked' ? 'needs approval' : 'asks you'
  return { title: `${s.project || 'Claude'} · ${what}`, body: [s.title, s.last].filter(Boolean).join('\n'), target: { session: s.id } }
}

