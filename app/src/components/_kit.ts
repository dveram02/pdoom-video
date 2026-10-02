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

// ------------------------------------------------------------------ charts

/** A "nice" tick step for a range split into ~n parts: 1, 2, 2.5 or 5 × 10^k. */
export function niceStep(range: number, n = 4): number {
  const raw = range / n, k = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / k;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * k;
}
/** The top of an axis that holds `v` with nice ticks (≥ v, a whole number of nice steps). */
export function niceMax(v: number, n = 4): number {
  if (v <= 0) return 1;
  const s = niceStep(v, n);
  return Math.ceil(v / s - 1e-9) * s;
}

/** y at x along a polyline (x ascending), clamped to its ends. */
export function interp(pts: [number, number][], x: number): number {
  if (x <= pts[0]![0]) return pts[0]![1];
  const last = pts[pts.length - 1]!;
  if (x >= last[0]) return last[1];
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m]![0] <= x) lo = m; else hi = m; }
  const a = pts[lo]!, b = pts[hi]!;
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
}

/**
 * Horizontal gridlines with y tick labels for one tick set (style guide §5.2: `rule` hairlines, no vertical grid,
 * Plex Mono 24 px labels in ash, right-aligned left of the plot). `draw` (0..1) draws the lines in left to right.
 */
export function drawYGrid(c: CanvasRenderingContext2D, o: {
  left: number; right: number; Y: (v: number) => number; min: number; max: number; format: NumFormat;
  alpha?: number; labelAlpha?: number; draw?: number; top?: number;
}) {
  const step = niceStep(o.max - o.min), a = o.alpha ?? 1, top = o.top ?? -Infinity;
  for (let v = o.min; v <= o.max + 1e-9; v += step) {
    const y = o.Y(v);
    if (y < top - 2) continue;
    c.strokeStyle = rgba('rule', a);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(o.left, Math.round(y) + 0.5); c.lineTo(o.left + (o.right - o.left) * (o.draw ?? 1), Math.round(y) + 0.5); c.stroke();
    c.save(); c.globalAlpha = o.labelAlpha ?? a;
    c.font = font(F.mono(400), 24); c.fillStyle = rgba('ash'); c.textAlign = 'right';
    c.fillText(fmt(v, o.format), o.left - 20, y + 8);
    c.restore();
  }
}

/** Legend row, right-aligned at `right` (swatch + label per entry, in order), for charts with ≥ 2 series. */
export function drawLegend(c: CanvasRenderingContext2D, items: { label: string; color: string; swatch?: 'line' | 'block' }[], right: number, y: number, alpha = 1) {
  let x = right;
  c.save(); c.globalAlpha *= alpha;
  c.font = font(F.archivo(100, 500), 26); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  for (const it of [...items].reverse()) {
    x -= c.measureText(it.label).width;
    c.fillStyle = rgba('ash'); c.fillText(it.label, x, y);
    x -= 34;
    if (it.swatch === 'block') { c.fillStyle = rgba(it.color); c.beginPath(); c.roundRect(x + 2, y - 19, 18, 18, 3); c.fill(); }
    else { c.strokeStyle = rgba(it.color); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 22, y - 9); c.stroke(); }
    x -= 32;
  }
  c.restore();
}
