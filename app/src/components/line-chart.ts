// LineChart: series that draw in left to right on narration cues, with riding end labels and a single y-axis
// that rescales smoothly when the values outgrow it (style guide §5).
//
//   const s = growthSeries(a);
//   E('growth', 'line-chart', at('Imagine'), at('Now compare'), {
//     kicker: 'Hypothetical', title: '$100 a month at 8%',
//     x: { from: 0, to: 30, label: 'Years', step: 5 },
//     y: { format: 'usdCompact', follow: true },
//     series: [
//       { id: 'put', label: 'You put in', color: 'ash', points: s.map(p => [p.year, p.contributed]), drawOn: 'Imagine', drawTo: 'thirty years' },
//       { id: 'bal', label: 'Account', color: 'gold', fill: true, points: s.map(p => [p.year, p.balance]), drawOn: 'Imagine', drawTo: 'thirty years' },
//     ],
//     notes: [{ series: 'bal', x: 9, text: 'Doubled what you put in', on: 'doubled' }],
//   })
//
// series[]:  id, label, color ('gold' | 'blue' | 'rose' | 'ash'; default: SERIES order), points [x, y][] (x ascending),
//            drawOn / drawTo cues (default 0.6 s in → 3.5 s in), ease ('inOutCubic' default | 'linear' | 'outCubic'),
//            fill (area under the line), endFormat (NumFormat of the riding label; default y.format → exact usd)
// x:         from, to, label (axis title, e.g. 'Years' / 'Age'), step (tick spacing; default ~6 ticks), prefix (tick text)
// y:         format (NumFormat for tick labels; default 'usdCompact'), max (fixed top; default: nice max of all data),
//            follow (the top follows the drawn values, rescaling smoothly), min (default 0)
// notes[]:   { series, x, text, on (cue) }: a callout on a series at x, popping in on its cue
// legend:    true/false (default: shown with ≥ 2 series)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, clearRT } from '../engine/gl';
import { LIN, SERIES, rgba, type PaletteKey } from '../engine/palette';
import { F, font } from '../engine/type';
import { SAFE } from '../engine/hud';
import { clamp, ease, frameTime, prog } from '../engine/util';
import { cueTime, drawLegend, drawMono, drawYGrid, fmt, interp, niceMax, niceStep, type Cue, type NumFormat } from './_kit';

type EaseName = 'inOutCubic' | 'linear' | 'outCubic';
interface SeriesP {
  id: string; label?: string; color?: PaletteKey; points: [number, number][];
  drawOn?: Cue; drawTo?: Cue; ease?: EaseName; fill?: boolean; endFormat?: NumFormat;
}
interface Params {
  title?: string; kicker?: string;
  x: { from: number; to: number; label?: string; step?: number; prefix?: string };
  y?: { format?: NumFormat; max?: number; min?: number; follow?: boolean };
  series: SeriesP[];
  notes?: { series: string; x: number; text: string; on?: Cue }[];
  legend?: boolean;
}
interface SeriesR extends SeriesP { color: PaletteKey; t0: number; t1: number; fn: (x: number) => number }

/** Seconds a y-axis rescale takes (eased). */
const RESCALE = 0.6;

// plot rectangle (logical px): room for y labels on the left, riding end labels on the right
const PL = SAFE + 130, PR = W - SAFE - 230, PT = 300, PB = 820;

export default class LineChart extends Scene {
  layer = new Layer2D();
  p!: Params;
  series: SeriesR[] = [];
  yMin = 0;
  yMaxAll = 1;
  /** y-axis top over time when `follow`: steps [t, max], eased over RESCALE s from the previous step. */
  steps: [number, number][] = [];

  override init() {
    const p = (this.p = this.ctx.params as Params);
    const { narration: n, start, end } = this.ctx;
    if (!p.series?.length) throw new Error(`line-chart '${this.ctx.id}': params.series is empty`);
    this.series = p.series.map((s, i) => {
      if (!s.points?.length) throw new Error(`line-chart '${this.ctx.id}': series '${s.id}' has no points`);
      const t0 = cueTime(n, start, s.drawOn, start + 0.6);
      const t1 = Math.max(t0 + 0.4, cueTime(n, start, s.drawTo, Math.min(end - 0.5, t0 + 3)));
      const e = ease[s.ease ?? 'inOutCubic'];
      return { ...s, color: s.color ?? SERIES[i % SERIES.length]!, t0, t1, fn: (t: number) => prog(t, t0, t1, e) };
    });
    this.yMin = p.y?.min ?? 0;
    this.yMaxAll = p.y?.max ?? niceMax(Math.max(...this.series.flatMap((s) => s.points.map((q) => q[1]))));
    if (p.y?.follow && p.y?.max === undefined) {
      // precompute when the nice top changes as the lines draw (deterministic: a function of t only). The axis
      // looks RESCALE s ahead, so it has finished growing by the time the line gets there (a fast draw would
      // otherwise outrun the eased rescale and poke out of the plot).
      let prev = -1;
      for (let t = start; t <= end; t += 1 / 30) {
        const ahead = Math.max(...this.series.map((s) => this.drawnMax(s, t + RESCALE)));
        const m = niceMax(Math.max(this.yMaxAll / 8, ahead));
        if (m !== prev) { this.steps.push([t, m]); prev = m; }
      }
    }
  }

  /** Max y of the part of a series drawn by time t. */
  private drawnMax(s: SeriesR, t: number) {
    const xh = this.headX(s, t);
    let m = -Infinity;
    for (const q of s.points) { if (q[0] > xh) break; m = Math.max(m, q[1]); }
    return Math.max(m, interp(s.points, xh));
  }
  /** Where a series' line has drawn to at t: each series draws over its own x range (Michael starts at 35). */
  private headX(s: SeriesR, t: number) {
    const a = s.points[0]![0], b = s.points[s.points.length - 1]![0];
    return a + (b - a) * s.fn(t);
  }

  /** The axis top at t, and the tick sets to show with their alphas (old ones fade out while rescaling). */
  private yAxis(t: number): { max: number; tickSets: [number, number][] } {
    if (!this.steps.length) return { max: this.yMaxAll, tickSets: [[this.yMaxAll, 1]] };
    let i = 0;
    while (i + 1 < this.steps.length && this.steps[i + 1]![0] <= t) i++;
    const [ts, m] = this.steps[i]!, prev = i > 0 ? this.steps[i - 1]![1] : m;
    const k = ease.inOutCubic(clamp((t - ts) / RESCALE));
    const max = prev + (m - prev) * k;
    return { max, tickSets: k < 1 && prev !== m ? [[prev, 1 - k], [m, k]] : [[m, 1]] };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, start, narration } = this.ctx;
    const p = this.p;
    clearRT(renderer, out, LIN.ink);
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    const t = f.t, tf = frameTime(t);
    const enter = prog(t, start, start + 0.5, ease.outCubic);
    const { from: x0, to: x1 } = p.x;
    const yAx = this.yAxis(t);
    const X = (x: number) => PL + ((PR - PL) * (x - x0)) / (x1 - x0);
    const Y = (y: number, max = yAx.max) => PB - ((PB - PT) * (y - this.yMin)) / (max - this.yMin);
    const yFmt = p.y?.format ?? 'usdCompact';

    // headline
    if (p.kicker) drawMono(c, p.kicker, SAFE, SAFE + 26, { size: 24, color: 'gold', alpha: enter, weight: 600 });
    if (p.title) {
      c.save(); c.globalAlpha = enter;
      c.font = font(F.archivo(100, 800), 60); c.fillStyle = rgba('bone');
      c.fillText(p.title, SAFE, SAFE + (p.kicker ? 100 : 60));
      c.restore();
    }

    // grid: horizontal hairlines draw in left to right; tick labels fade (old set out, new set in while rescaling)
    const gridK = prog(t, start + 0.1, start + 0.6, ease.outCubic);
    for (const [max, a] of yAx.tickSets) drawYGrid(c, { left: PL, right: PR, top: PT, Y, min: this.yMin, max, format: yFmt, alpha: a, labelAlpha: a * enter, draw: gridK });
    // x ticks: numbers under the axis, axis title at the right end
    const xs = p.x.step ?? niceStep(x1 - x0, 6);
    c.save(); c.globalAlpha = enter;
    c.font = font(F.mono(400), 24); c.fillStyle = rgba('ash'); c.textAlign = 'center';
    for (let x = Math.ceil(x0 / xs) * xs; x <= x1 + 1e-9; x += xs) c.fillText(`${p.x.prefix ?? ''}${+x.toFixed(4)}`, X(x), PB + 44);
    c.restore();
    if (p.x.label) drawMono(c, p.x.label, PR, PB + 84, { size: 20, color: 'graphite', alpha: enter, align: 'right' });

    // series: area fill, then the line up to its head (clipped to the plot: during a rescale the head can briefly
    // run past the old top)
    const heads: { s: SeriesR; x: number; y: number; v: number; vy: number }[] = [];
    c.save();
    c.beginPath(); c.rect(PL - 12, PT - 40, PR - PL + 24, PB - PT + 52); c.clip();
    for (const s of this.series) {
      const k = s.fn(t);
      if (k <= 0) continue;
      const xh = this.headX(s, t), yh = interp(s.points, xh);
      const path = new Path2D();
      let first = true;
      for (const q of s.points) {
        if (q[0] > xh) break;
        if (first) { path.moveTo(X(q[0]), Y(q[1])); first = false; } else path.lineTo(X(q[0]), Y(q[1]));
      }
      if (first) path.moveTo(X(xh), Y(yh)); else path.lineTo(X(xh), Y(yh));
      if (s.fill) {
        const area = new Path2D(path);
        area.lineTo(X(xh), PB); area.lineTo(X(s.points[0]![0]), PB); area.closePath();
        const g = c.createLinearGradient(0, PT, 0, PB);
        g.addColorStop(0, rgba(s.color, 0.22)); g.addColorStop(1, rgba(s.color, 0.02));
        c.fillStyle = g; c.fill(area);
      }
      c.strokeStyle = rgba(s.color); c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
      c.stroke(path);
      // the label's VALUE holds one number per frame; the dot and label POSITION follow the moving head
      const vf = interp(s.points, this.headX(s, tf));
      heads.push({ s, x: X(xh), y: Y(yh), v: vf, vy: Y(yh) });
    }
    c.restore();

    // riding end labels: keep ≥ 56 px apart vertically (two passes of pushing apart, deterministic)
    heads.sort((a, b) => a.vy - b.vy);
    for (let pass = 0; pass < 3; pass++)
      for (let i = 1; i < heads.length; i++) {
        const d = heads[i]!.vy - heads[i - 1]!.vy;
        if (d < 56) { heads[i - 1]!.vy -= (56 - d) / 2; heads[i]!.vy += (56 - d) / 2; }
      }
    for (const h of heads) {
      c.fillStyle = rgba(h.s.color === 'ash' ? 'bone' : h.s.color === 'gold' ? 'goldHi' : h.s.color);
      c.beginPath(); c.arc(h.x, h.y, 7, 0, Math.PI * 2); c.fill();
      const lx = h.x + 22;
      c.font = font(F.mono(600), 28); c.fillStyle = rgba('bone'); c.textAlign = 'left';
      c.fillText(fmt(h.v, h.s.endFormat ?? (yFmt === 'usdCompact' ? 'usd' : yFmt)), lx, h.vy + 10);
      if (h.s.label) drawMono(c, h.s.label, lx, h.vy - 22, { size: 18, color: 'ash' });
    }

    // legend (≥ 2 series): swatch + label, top right
    if (p.legend ?? this.series.length >= 2) drawLegend(c, this.series.map((s) => ({ label: s.label ?? s.id, color: s.color })), PR + 200, SAFE + 26, enter);

    // callouts
    for (const nt of p.notes ?? []) {
      const s = this.series.find((q) => q.id === nt.series);
      if (!s) throw new Error(`line-chart '${this.ctx.id}': note on unknown series '${nt.series}'`);
      const ton = cueTime(narration, start, nt.on, s.t1 + 0.3);
      const a = prog(t, ton, ton + 0.4, ease.outCubic);
      if (a <= 0) continue;
      const px = X(nt.x), py = Y(interp(s.points, nt.x));
      const ty = Math.max(PT - 10, py - 120) + (1 - a) * 12;
      c.save(); c.globalAlpha = a;
      c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 2;
      c.beginPath(); c.arc(px, py, 11, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(px, py - 13); c.lineTo(px, ty + 14); c.stroke();
      c.font = font(F.archivo(100, 600), 30); c.fillStyle = rgba('bone'); c.textAlign = 'center';
      c.fillText(nt.text, clamp(px, PL + 200, PR - 200), ty);
      c.restore();
    }

    comp.draw(renderer, L.upload(), out);
  }
}
