// StackedBar: vertical bars that grow one after another on narration cues, each split into stacked segments,
// typically grey "you put in" under gold "it grew" (style guide §2.2, §5). One segment = a plain bar chart.
//
//   const ys = yearly(growthSeries(a)).filter(p => p.year % 5 === 0 && p.year > 0);
//   E('bars', 'stacked-bar', at('Every five years'), at('Next'), {
//     title: 'What you put in vs. what it grew',
//     segments: [{ key: 'put', label: 'You put in', color: 'ash' }, { key: 'grew', label: 'Growth', color: 'gold' }],
//     bars: ys.map(p => ({ label: `Year ${p.year}`, values: { put: p.contributed, grew: p.growth } })),
//     buildOn: 'Every five years', buildTo: 'thirty',
//     breakdown: { bar: -1, on: 'Most of it' },   // segment values beside the last bar
//   })
//
// params:
//   segments[]   { key, label, color } bottom → top. Colours: 'ash' for what you put in, 'gold' for growth,
//                series colours for categories; never gain/loss unless the segment IS a gain or a loss.
//   bars[]       { label, values: { [segmentKey]: number } }
//   buildOn / buildTo  cues: the first bar starts growing / the last bar finishes (default 0.6 s → 3.6 s in)
//   y            { format (default 'usdCompact'), max }
//   totals       show each bar's total above it once grown (default true)
//   breakdown    { bar (index, negative from the end), on (cue) }: labels each segment of that bar beside it
//   title, kicker, legend (default: shown with ≥ 2 segments)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, clearRT } from '../engine/gl';
import { LIN, rgba, type PaletteKey } from '../engine/palette';
import { F, font } from '../engine/type';
import { SAFE } from '../engine/hud';
import { ease, prog } from '../engine/util';
import { cueTime, drawLegend, drawMono, drawYGrid, fmt, niceMax, type Cue, type NumFormat } from './_kit';

interface Params {
  title?: string; kicker?: string;
  segments: { key: string; label: string; color: PaletteKey }[];
  bars: { label: string; values: Record<string, number> }[];
  buildOn?: Cue; buildTo?: Cue;
  y?: { format?: NumFormat; max?: number };
  totals?: boolean;
  breakdown?: { bar: number; on?: Cue };
  legend?: boolean;
}

const PL = SAFE + 130, PR = W - SAFE - 300, PT = 300, PB = 820;
/** Seconds each bar takes to grow. */
const GROW = 0.7;

export default class StackedBar extends Scene {
  layer = new Layer2D();
  p!: Params;
  t0 = 0;
  t1 = 0;
  max = 1;

  override init() {
    const p = (this.p = this.ctx.params as Params);
    const { narration: n, start, end, id } = this.ctx;
    if (!p.bars?.length || !p.segments?.length) throw new Error(`stacked-bar '${id}': needs bars and segments`);
    for (const b of p.bars) for (const s of p.segments) {
      const v = b.values[s.key];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`stacked-bar '${id}': bar '${b.label}' needs a value ≥ 0 for '${s.key}'`);
    }
    this.t0 = cueTime(n, start, p.buildOn, start + 0.6);
    this.t1 = Math.max(this.t0 + GROW, cueTime(n, start, p.buildTo, Math.min(end - 0.5, this.t0 + 3)));
    this.max = p.y?.max ?? niceMax(Math.max(...p.bars.map((b) => this.total(b))));
  }

  private total(b: Params['bars'][number]) {
    return this.p.segments.reduce((s, g) => s + b.values[g.key]!, 0);
  }
  /** 0..1 growth of bar i at t: bars start one after another so the last one lands at t1. */
  private grow(i: number, t: number) {
    const n = this.p.bars.length;
    const stagger = n > 1 ? (this.t1 - this.t0 - GROW) / (n - 1) : 0;
    const a = this.t0 + i * stagger;
    return prog(t, a, a + GROW, ease.outCubic);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, start, narration } = this.ctx;
    const p = this.p;
    clearRT(renderer, out, LIN.ink);
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    const t = f.t;
    const enter = prog(t, start, start + 0.5, ease.outCubic);
    const yFmt = p.y?.format ?? 'usdCompact';
    const Y = (v: number) => PB - ((PB - PT) * v) / this.max;

    if (p.kicker) drawMono(c, p.kicker, SAFE, SAFE + 26, { size: 24, color: 'gold', alpha: enter, weight: 600 });
    if (p.title) {
      c.save(); c.globalAlpha = enter;
      c.font = font(F.archivo(100, 800), 60); c.fillStyle = rgba('bone');
      c.fillText(p.title, SAFE, SAFE + (p.kicker ? 100 : 60));
      c.restore();
    }
    drawYGrid(c, { left: PL, right: PR, Y, min: 0, max: this.max, format: yFmt, labelAlpha: enter, draw: prog(t, start + 0.1, start + 0.6, ease.outCubic) });
    if (p.legend ?? p.segments.length >= 2)
      drawLegend(c, [...p.segments].reverse().map((s) => ({ label: s.label, color: s.color, swatch: 'block' as const })), W - SAFE, SAFE + 26, enter);

    // bars: width from the count (max 120 px), ≥ 4 px gaps; segments separated by a 2 px ink gap;
    // 4 px rounded data-end on top of each bar, anchored square to the baseline
    const n = p.bars.length, slot = (PR - PL) / n, bw = Math.min(120, slot * 0.62);
    const bd = p.breakdown ? (p.breakdown.bar < 0 ? n + p.breakdown.bar : p.breakdown.bar) : -1;
    p.bars.forEach((b, i) => {
      const k = this.grow(i, t);
      const cx = PL + slot * (i + 0.5), x = cx - bw / 2;
      // bar label (x axis)
      c.save(); c.globalAlpha = enter;
      c.font = font(F.mono(400), 24); c.fillStyle = rgba('ash'); c.textAlign = 'center';
      c.fillText(b.label, cx, PB + 44);
      c.restore();
      if (k <= 0) return;
      const tot = this.total(b);
      let acc = 0;
      const shown = tot * k; // the whole stack grows from the baseline; segments fill in order
      p.segments.forEach((s, si) => {
        const v = b.values[s.key]!;
        const lo = acc, hi = Math.min(acc + v, shown);
        acc += v;
        if (hi <= lo) return;
        const yTop = Y(hi), yBot = Y(lo) - (si > 0 ? 2 : 0); // 2 px ink gap between segments
        if (yBot - yTop < 0.5) return;
        const isTop = hi >= shown - 1e-9;
        c.fillStyle = rgba(s.color);
        c.beginPath();
        c.roundRect(x, yTop, bw, yBot - yTop, isTop ? [4, 4, 0, 0] : 0);
        c.fill();
      });
      // total above the bar, once it has grown
      if (p.totals ?? true) {
        const a = prog(k, 0.85, 1);
        if (a > 0) {
          c.save(); c.globalAlpha = a;
          c.font = font(F.mono(600), 26); c.fillStyle = rgba('bone'); c.textAlign = 'center';
          c.fillText(fmt(tot, yFmt), cx, Y(tot) - 16);
          c.restore();
        }
      }
      // breakdown: each segment's value beside the bar, with a tick to its middle
      if (i === bd) {
        const ton = cueTime(narration, start, p.breakdown!.on, this.t1 + 0.3);
        const a = prog(t, ton, ton + 0.45, ease.outCubic);
        if (a > 0) {
          let lo = 0;
          for (const s of p.segments) {
            const v = b.values[s.key]!, mid = Y(lo + v / 2);
            lo += v;
            const lx = x + bw + 18;
            c.save(); c.globalAlpha = a;
            c.strokeStyle = rgba(s.color); c.lineWidth = 2;
            c.beginPath(); c.moveTo(x + bw + 4, mid); c.lineTo(lx + (1 - a) * -10 + 6, mid); c.stroke();
            drawMono(c, s.label, lx + 14, mid - 8, { size: 18, color: 'ash' });
            c.font = font(F.mono(600), 28); c.fillStyle = rgba('bone'); c.textAlign = 'left';
            c.fillText(fmt(v, 'usd'), lx + 14, mid + 26);
            c.restore();
          }
        }
      }
    });

    comp.draw(renderer, L.upload(), out);
  }
}
