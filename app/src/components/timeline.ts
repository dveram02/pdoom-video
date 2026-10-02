// Timeline: an age/year axis with spans that draw along it (above) and markers that drop in on cues (below).
//
//   E('ages', 'timeline', at('Sarah starts'), at('Next'), {
//     title: 'Ten years apart',
//     x: { from: 20, to: 70, step: 5, label: 'Age' },
//     spans: [
//       { label: 'Sarah invests', from: 25, to: 65, color: 'gold', drawOn: 'Sarah starts', drawTo: 'sixty-five' },
//       { label: 'Michael invests', from: 35, to: 65, color: 'blue', drawOn: 'Michael waits', drawTo: 'sixty-five' },
//     ],
//     markers: [{ at: 25, label: 'Sarah starts', sub: 'Age 25', on: 'Sarah starts' }, { at: 35, label: 'Michael starts', sub: 'Age 35', on: 'Michael waits' }],
//   })
//
// params:
//   x        { from, to, step (tick spacing; default ~10 ticks), label (axis title), prefix (tick text) }
//   spans[]  { label, from, to, color (default series order), drawOn / drawTo (cues; default 0.6 s in, 1.2 s long) }
//            stacked in rows above the axis, in order
//   markers[] { at, label, sub?, color? ('bone' default), on (cue; default staggered after the entry starts) }
//            hang below the axis; markers closer than 280 px alternate between two depths
//   title, kicker
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, clearRT } from '../engine/gl';
import { LIN, SERIES, rgba, type PaletteKey } from '../engine/palette';
import { F, font } from '../engine/type';
import { SAFE } from '../engine/hud';
import { ease, prog } from '../engine/util';
import { cueTime, drawMono, niceStep, type Cue } from './_kit';

interface Params {
  title?: string; kicker?: string;
  x: { from: number; to: number; step?: number; label?: string; prefix?: string };
  spans?: { label: string; from: number; to: number; color?: PaletteKey; drawOn?: Cue; drawTo?: Cue }[];
  markers?: { at: number; label: string; sub?: string; color?: PaletteKey; on?: Cue }[];
}

const AL = SAFE + 40, AR = W - SAFE - 40; // axis ends
const AY = 600; // axis y
const ROW = 74; // span row height

export default class Timeline extends Scene {
  layer = new Layer2D();
  p!: Params;
  spans: { label: string; from: number; to: number; color: PaletteKey; t0: number; t1: number }[] = [];
  markers: { at: number; label: string; sub?: string; color: PaletteKey; t: number; level: number }[] = [];

  override init() {
    const p = (this.p = this.ctx.params as Params);
    const { narration: n, start, end } = this.ctx;
    this.spans = (p.spans ?? []).map((s, i) => {
      const t0 = cueTime(n, start, s.drawOn, start + 0.6 + i * 0.4);
      const t1 = Math.max(t0 + 0.4, cueTime(n, start, s.drawTo, Math.min(end - 0.3, t0 + 1.2)));
      return { ...s, color: s.color ?? SERIES[i % SERIES.length]!, t0, t1 };
    });
    // markers: left to right; one closer than 280 px to the previous on the same depth drops to the other depth
    const X = (v: number) => this.X(v);
    const ms = (p.markers ?? []).map((m, i) => ({ ...m, color: m.color ?? 'bone' as PaletteKey, t: cueTime(n, start, m.on, start + 0.8 + i * 0.5), level: 0 }))
      .sort((a, b) => a.at - b.at);
    const lastX = [-Infinity, -Infinity];
    for (const m of ms) {
      const x = X(m.at);
      m.level = x - lastX[0]! >= 280 ? 0 : x - lastX[1]! >= 280 ? 1 : 0;
      lastX[m.level] = x;
    }
    this.markers = ms;
  }

  private X(v: number) {
    const { from, to } = this.p.x;
    return AL + ((AR - AL) * (v - from)) / (to - from);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, start } = this.ctx;
    const p = this.p;
    clearRT(renderer, out, LIN.ink);
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    const t = f.t;
    const enter = prog(t, start, start + 0.5, ease.outCubic);

    if (p.kicker) drawMono(c, p.kicker, SAFE, SAFE + 26, { size: 24, color: 'gold', alpha: enter, weight: 600 });
    if (p.title) {
      c.save(); c.globalAlpha = enter;
      c.font = font(F.archivo(100, 800), 60); c.fillStyle = rgba('bone');
      c.fillText(p.title, SAFE, SAFE + (p.kicker ? 100 : 60));
      c.restore();
    }

    // axis: hairline drawing in left to right, ticks and labels
    const ax = prog(t, start + 0.05, start + 0.65, ease.inOutCubic);
    c.strokeStyle = rgba('ash', 0.7); c.lineWidth = 2;
    c.beginPath(); c.moveTo(AL, AY); c.lineTo(AL + (AR - AL) * ax, AY); c.stroke();
    const { from, to } = p.x;
    const step = p.x.step ?? niceStep(to - from, 10);
    c.font = font(F.mono(400), 24); c.textAlign = 'center';
    for (let v = Math.ceil(from / step) * step; v <= to + 1e-9; v += step) {
      const x = this.X(v);
      const a = prog(t, start + 0.05 + 0.6 * ((x - AL) / (AR - AL)), start + 0.25 + 0.6 * ((x - AL) / (AR - AL)));
      if (a <= 0) continue;
      c.globalAlpha = a;
      c.fillStyle = rgba('ash', 0.7); c.fillRect(Math.round(x) - 1, AY - 8, 2, 16);
      c.fillStyle = rgba('ash'); c.fillText(`${p.x.prefix ?? ''}${+v.toFixed(4)}`, x, AY + 46);
    }
    c.globalAlpha = 1;
    if (p.x.label) drawMono(c, p.x.label, AR, AY + 84, { size: 20, color: 'graphite', alpha: enter, align: 'right' });

    // spans: rows above the axis, nearest row first; each draws from its start to its end
    this.spans.forEach((s, i) => {
      const k = prog(t, s.t0, s.t1, ease.inOutCubic);
      if (k <= 0) return;
      const y = AY - 44 - i * ROW, x0 = this.X(s.from), x1 = x0 + (this.X(s.to) - x0) * k;
      c.fillStyle = rgba(s.color);
      c.beginPath(); c.roundRect(x0, y - 7, Math.max(14, x1 - x0), 14, 7); c.fill();
      const a = prog(t, s.t0, s.t0 + 0.35);
      c.save(); c.globalAlpha = a;
      c.font = font(F.archivo(100, 600), 28); c.fillStyle = rgba('bone'); c.textAlign = 'left';
      c.fillText(s.label, x0, y - 20);
      // span length in the axis unit ("40 years") once it has drawn
      const done = prog(t, s.t1, s.t1 + 0.3);
      if (done > 0) {
        c.globalAlpha = done;
        c.font = font(F.mono(500), 22); c.fillStyle = rgba('ash'); c.textAlign = 'right';
        c.fillText(`${+(s.to - s.from).toFixed(2)} ${(p.x.label ?? '').toLowerCase() === 'age' ? 'years' : (p.x.label ?? '').toLowerCase()}`.trim(), x1, y - 20);
      }
      c.restore();
    });

    // markers: drop in below the axis (dot on the axis, stem, card)
    for (const m of this.markers) {
      const a = prog(t, m.t, m.t + 0.45, ease.outCubic);
      if (a <= 0) continue;
      const x = this.X(m.at), stem = 70 + m.level * 110, drop = (1 - a) * -16;
      c.save(); c.globalAlpha = a;
      c.fillStyle = rgba(m.color === 'bone' ? 'bone' : m.color);
      c.beginPath(); c.arc(x, AY, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = rgba('ink'); c.beginPath(); c.arc(x, AY, 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = rgba('ash', 0.6); c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, AY + 64); c.lineTo(x, AY + 64 + stem * a); c.stroke();
      const ty = AY + 64 + stem + 40 + drop;
      c.font = font(F.archivo(100, 700), 34); c.fillStyle = rgba('bone'); c.textAlign = 'center';
      const cx = Math.min(Math.max(x, AL + 140), AR - 140);
      c.fillText(m.label, cx, ty);
      if (m.sub) drawMono(c, m.sub, cx, ty + 36, { size: 20, color: 'ash', align: 'center' });
      c.restore();
    }

    comp.draw(renderer, L.upload(), out);
  }
}
