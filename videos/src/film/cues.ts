import { at, type Grid } from "../kit/time";

// Silent film: a 120 BPM grid anyway, so moments land on beats. 1 beat = 0.5 s, 1 bar = 2 s, 10 bars.
export const GRID: Grid = { bpm: 120, firstBeat: 0, pickupBeats: 0, beatsPerBar: 4 };
export const b = (bar: number, beat = 1, fraction = 0) => at(GRID, bar, beat, fraction);
export const DURATION = b(11);                       // 20 s

export const CUE = {
  typeFrom: b(1, 1, 0.8), typeTo: b(1, 4, 0.4), enter: b(1, 4, 0.8),
  work: b(2),                                        // mascot wakes and types
  lines: [b(2, 2), b(2, 3), b(2, 4), b(3, 1)],       // Read, Edit, Bash npm test, (running)
  pull: b(2),                                        // camera pulls back to the whole desk
  away: b(3),                                        // the browser comes to the front
  pups: [b(3, 3), b(3, 4)], pupsGone: b(4, 4),
  scroll: b(4, 1),
  wait: b(5),                                        // the mascot calls
  bark: b(5, 2),
  push: b(5),
  toBox: b(6, 1), click: b(6, 2),                    // the list opens
  toTerm: b(6, 4, 0.5), clickTerm: b(7, 1),          // back to the terminal
  answer: b(7, 3),                                   // Enter on "1. Yes": working again
  after: [b(7, 4), b(8, 1, 0.5)],
  done: b(8),
  end: b(9),                                         // the end card: all ten
  lockup: b(10),
  loop: b(10, 2, 0.5),                               // fold back into frame 0
} as const;

// Captions: [in, out, text]
export const CAPTIONS: readonly (readonly [number, number, string])[] = [
  [b(1, 1, 0.6), b(2, 4), "Start a long task."],
  [b(3, 1, 0.6), b(4, 4), "Switch away."],
  [b(5, 1, 0.6), b(6, 4), "It calls you once."],
  [b(7, 1, 0.6), b(7, 4, 0.8), "Answer, carry on."],
  [b(8, 1, 0.4), b(8, 4, 0.8), "Done."],
];
