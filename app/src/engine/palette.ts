import { hexToLinear } from './util';

// The channel palette (docs/FINANCE_STYLE_GUIDE.md §2): ink ground, bone type, one gold accent.
// Series colours in fixed order gold → blue → rose; gain/loss are semantic only and always ship with
// a sign or arrow (their CVD separation is in the warn band). Validated on the ink surface.
export const HEX = {
  ink: '#0B0D10', // background (cool near-black)
  ink2: '#15181D', // raised panels, cards, plot areas
  rule: '#262A31', // gridlines, dividers, inactive tracks (non-text)
  graphite: '#5E6672', // tertiary text: footnotes, ticks, source lines (large / non-essential only)
  ash: '#9AA1AC', // secondary text: labels, units, axis titles
  bone: '#F2F0EB', // primary text, hero numbers
  paper: '#F2F0EB', // ground of "document" scenes
  gold: '#BA8520', // brand accent, series 1
  goldHi: '#E3B04B', // gold highlight: glow cores, the moment number
  blue: '#3F7FD0', // series 2
  rose: '#D0679A', // series 3 (rare)
  gain: '#22A06B', // semantic: up / profit / positive delta
  loss: '#E5533F', // semantic: down / debt / negative delta
} as const;

export type PaletteKey = keyof typeof HEX;

/** Series colours in their fixed order (never cycled: a 4th series folds into "Other"). */
export const SERIES: readonly PaletteKey[] = ['gold', 'blue', 'rose'];

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
