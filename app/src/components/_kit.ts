// Shared helpers for components (not a component: '_' files are never placed on a timeline).
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { Narration } from '../engine/narration';
import { mult, num, pct, usd } from '../finance/format';

/** How a component shows a number (docs/FINANCE_STYLE_GUIDE.md §4). */
export type NumFormat = 'usd' | 'usdCompact' | 'usdSigned' | 'pct' | 'pctSigned' | 'num' | 'mult';

export function fmt(v: number, f: NumFormat = 'usd', decimals?: number): string {
  switch (f) {
    case 'usd': return usd(v);
    case 'usdCompact': return usd(v, { compact: true });
    case 'usdSigned': return usd(v, { sign: true });
    case 'pct': return pct(v, { decimals });
    case 'pctSigned': return pct(v, { decimals, sign: true });
    case 'num': return num(v, decimals ?? 0);
    case 'mult': return mult(v, decimals ?? 1);
  }
}

/**
 * A cue: a phrase in the narration ('After thirty years'), a time in seconds relative to the entry's start
 * (number), or undefined (use the fallback).
 */
export type Cue = string | number | undefined;

export function cueTime(n: Narration, entryStart: number, cue: Cue, fallback: number): number {
  if (cue === undefined) return fallback;
  if (typeof cue === 'number') return entryStart + cue;
  return n.phrase(cue).start;
}

/**
 * A gain/loss chip: "▲ +$31,473" in gain or "▼ −12.4%" in loss. The sign and arrow carry the meaning as well as
 * the colour (the gain/loss pair is in the CVD warn band). Returns its width. (x, y) = left end of the baseline.
 */
export function drawDeltaChip(c: CanvasRenderingContext2D, x: number, y: number, value: number, text: string, size = 30, alpha = 1): number {
  const up = value >= 0;
  const color = up ? 'gain' : 'loss';
  const label = `${up ? '▲' : '▼'} ${text}`;
  c.save();
  c.globalAlpha *= alpha;
  c.font = font(F.mono(600), size);
  c.letterSpacing = '0px';
  const tw = c.measureText(label).width, padX = size * 0.5, h = size * 1.5;
  c.fillStyle = rgba(color, 0.14);
  c.beginPath();
  c.roundRect(x, y - h * 0.72, tw + padX * 2, h, 6);
  c.fill();
  c.fillStyle = rgba(color);
  c.textBaseline = 'alphabetic';
  c.fillText(label, x + padX, y);
  c.restore();
  return tw + padX * 2;
}

/** Mono uppercase label with tracking (kickers, units, axis titles). */
export function drawMono(c: CanvasRenderingContext2D, text: string, x: number, y: number, o: { size?: number; color?: string; alpha?: number; align?: CanvasTextAlign; tracking?: number; weight?: number } = {}) {
  const size = o.size ?? 24;
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  c.font = font(F.mono(o.weight ?? 500), size);
  c.letterSpacing = `${o.tracking ?? size * 0.16}px`;
  c.fillStyle = rgba(o.color ?? 'ash');
  c.textAlign = o.align ?? 'left';
  c.textBaseline = 'alphabetic';
  // letterSpacing adds trailing space after the last glyph: shift centred/right text back by it
  const shift = (o.align === 'center' ? 0.5 : o.align === 'right' ? 1 : 0) * (o.tracking ?? size * 0.16);
  c.fillText(text.toUpperCase(), x + shift, y);
  c.restore();
}
