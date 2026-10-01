// Holds the reducer state and pushes to the renderer: the view at most 4 Hz (at once when the mood
// changes), fx at once, and always the view BEFORE the fx of the same dispatch, so a bark lands on
// a dog that is already in 'waiting'. No electron import.
import { initialState, reduce } from '../shared/reducer.js'
import { viewmodel } from '../shared/viewmodel.js'

export class Store {
  constructor({ send, finishedTtlMin = 30, nagAfterMin = 5, viewMs = 250, tickMs = 15_000, now = Date.now }) {
    Object.assign(this, { send, viewMs, now })
    this.state = initialState({ finishedTtlMin, nagAfterMin })
    this.view = viewmodel(this.state)
    this.timer = null
    this.ticker = setInterval(() => this.dispatch({ type: 'tick' }), tickMs)
  }

  dispatch(action) {
    const r = reduce(this.state, { now: this.now(), ...action })
    this.state = r.state
    const moodChanged = viewmodel(this.state).mood !== this.view.mood
    if (moodChanged || r.effects.length) this.flush()
    else if (!this.timer) this.timer = setTimeout(() => this.flush(), this.viewMs)
    for (const e of r.effects) this.send('fx', e)
  }

  flush() {
    clearTimeout(this.timer)
    this.timer = null
    this.view = viewmodel(this.state)
    this.send('view', this.view)
  }

  setTimes({ finishedTtlMin, nagAfterMin }) {
    this.state = { ...this.state, finishedTtlMs: finishedTtlMin * 60_000, nagAfterMs: nagAfterMin * 60_000 }
  }

  close() { clearTimeout(this.timer); clearInterval(this.ticker) }
}
