// Effects drawn on their own 24x24 canvas just outside the box (toward the screen centre), so they
// never cover the dog and work for both framings. Each overlay = frames of [{x, y, rows}]. Pure.
export const FX_W = 24, FX_H = 24

const z = ['zz', '.z', 'zz']                            // small z
const Z = ['zzz', '..z', '.z.', 'zzz']                  // big z
const star = ['.y.', 'yYy', '.y.']
const bigStar = ['..y..', '..y..', 'yyYyy', '..y..', '..y..']

const BUBBLE = [
  '..BBBBBBBB..',
  '.BbbbbbbbbB.',
  'BbbbbaabbbbB',
  'BbbbbaabbbbB',
  'BbbbbaabbbbB',
  'BbbbbaabbbbB',
  'BbbbbbbbbbbB',
  'BbbbbaabbbbB',
  '.BbbbbbbbbB.',
  '..BBBBBBBB..',
  '....BbbB....',
  '.....BB.....',
]

export const OVERLAYS = {
  zzz: [
    [{ x: 4, y: 18, rows: z }],
    [{ x: 4, y: 18, rows: z }, { x: 9, y: 12, rows: Z }],
    [{ x: 5, y: 17, rows: z }, { x: 9, y: 12, rows: Z }, { x: 15, y: 5, rows: Z }],
    [{ x: 10, y: 11, rows: Z }, { x: 15, y: 5, rows: Z }],
    [{ x: 16, y: 3, rows: Z }],
    [],
  ],
  bubble: [
    [{ x: 6, y: 6, rows: BUBBLE }],
    [{ x: 6, y: 4, rows: BUBBLE }],
  ],
  sparkle: [
    [{ x: 3, y: 14, rows: star }, { x: 16, y: 6, rows: ['y'] }],
    [{ x: 1, y: 12, rows: bigStar }, { x: 14, y: 4, rows: star }, { x: 19, y: 16, rows: ['y'] }],
    [{ x: 3, y: 14, rows: star }, { x: 13, y: 2, rows: bigStar }, { x: 18, y: 15, rows: star }],
    [{ x: 4, y: 15, rows: ['y'] }, { x: 14, y: 4, rows: star }, { x: 19, y: 16, rows: ['y'] }],
  ],
  // error: a small grey bubble with a red ✕
  oops: [
    [{ x: 6, y: 5, rows: ['..BBBBBBBB..', '.BbbbbbbbbB.', 'BbbXbbbbXbbB', 'BbbbXbbXbbbB', 'BbbbbXXbbbbB', 'BbbbbXXbbbbB', 'BbbbXbbXbbbB', 'BbbXbbbbXbbB', '.BbbbbbbbbB.', '..BBBBBBBB..', '...BbbB.....', '....BB......'] }],
    [{ x: 6, y: 5, rows: ['..BBBBBBBB..', '.BbbbbbbbbB.', 'BbbXbbbbXbbB', 'BbbbXbbXbbbB', 'BbbbbXXbbbbB', 'BbbbbXXbbbbB', 'BbbbXbbXbbbB', 'BbbXbbbbXbbB', '.BbbbbbbbbB.', '..BBBBBBBB..', '...BbbB.....', '....BB......'] }],
  ],
  // petted: hearts rise
  hearts: [
    [{ x: 4, y: 16, rows: ['p.p', 'ppp', '.p.'] }],
    [{ x: 5, y: 12, rows: ['p.p', 'ppp', '.p.'] }, { x: 13, y: 15, rows: ['pp.pp', 'ppppp', '.ppp.', '..p..'] }],
    [{ x: 6, y: 8, rows: ['p.p', 'ppp', '.p.'] }, { x: 14, y: 10, rows: ['pp.pp', 'ppppp', '.ppp.', '..p..'] }, { x: 3, y: 17, rows: ['p.p', 'ppp', '.p.'] }],
    [{ x: 15, y: 5, rows: ['pp.pp', 'ppppp', '.ppp.', '..p..'] }, { x: 4, y: 12, rows: ['p.p', 'ppp', '.p.'] }],
    [{ x: 5, y: 7, rows: ['p.p', 'ppp', '.p.'] }],
    [],
  ],
  cloud: [
    [{ x: 4, y: 8, rows: ['....GGG.......', '..GGGGGGG.GG..', '.GGGGGGGGGGGG.', 'GGGGGGGGGGGGGG', '.gggggggggggg.'] }],
    [{ x: 5, y: 8, rows: ['....GGG.......', '..GGGGGGG.GG..', '.GGGGGGGGGGGG.', 'GGGGGGGGGGGGGG', '.gggggggggggg.'] }],
  ],
}
