// Comparison: two scenarios side by side, each with a name card, a hero value that counts to its figure and
// optional detail rows, then the gap between them (style guide §10).
//
//   E('gap', 'comparison', at('By sixty-five'), at('Next'), {
//     title: 'Same $300 a month',
//     left:  { label: 'Sarah', sub: 'Starts at 25', value: sarah, color: 'gold', rows: [{ label: 'Put in', value: 144000 }] },
//     right: { label: 'Michael', sub: 'Starts at 35', value: michael, color: 'blue', rows: [{ label: 'Put in', value: 108000 }] },
//     countOn: 'By sixty-five', landOn: 'the gap',
//     gap: { label: 'The cost of waiting 10 years', on: 'the gap', ratio: true },
//   })
//
// params:
//   left / right  { label, sub?, value, format? (default 'usd'), color? (series colour; default gold / blue),
//                   rows?: [{ label, value, format? }] }
//   countOn / landOn  cues for both hero values (default 0.5 s in → 2.3 s in)
//   gap           { label, on (cue), value? (default |left − right|), format?, ratio? (show "2.3×" too) }
//   title, kicker
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, clearRT } from '../engine/gl';
import { LIN, rgba, type PaletteKey } from '../engine/palette';
import { F, font } from '../engine/type';
import { SAFE } from '../engine/hud';
import { ease, frameTime, prog } from '../engine/util';
import { padToFinal, mult } from '../finance/format';
import { cueTime, drawMono, fmt, type Cue, type NumFormat } from './_kit';

interface Side { label: string; sub?: string; value: number; format?: NumFormat; color?: PaletteKey; rows?: { label: string; value: number; format?: NumFormat }[] }
interface Params {
  title?: string; kicker?: string;
  left: Side; right: Side;
  countOn?: Cue; landOn?: Cue;
  gap?: { label: string; on?: Cue; value?: number; format?: NumFormat; ratio?: boolean };
}

const COLW = 600; // column width
const CX = [W / 2 - 400, W / 2 + 400]; // column centres
const TOP = 330;

export default class Comparison extends Scene {
  layer = new Layer2D();
  p!: Params;
  t0 = 0;
  t1 = 0;
  tg = 0;
  size = 120;

  override init() {
    const p = (this.p = this.ctx.params as Params);
    const { narration: n, start, id } = this.ctx;
    for (const s of [p.left, p.right]) if (!s || !Number.isFinite(s.value)) throw new Error(`comparison '${id}': left and right need a finite value`);
    this.t0 = cueTime(n, start, p.countOn, start + 0.5);
    this.t1 = Math.max(this.t0 + 0.5, cueTime(n, start, p.landOn, this.t0 + 1.8));
    this.tg = cueTime(n, start, p.gap?.on, this.t1 + 0.4);
    // one size for both heroes, fitted to the wider final value
    const c = this.layer.ctx;
    for (this.size = 120; this.size > 64; this.size -= 4) {
      c.font = font(F.num(100, 900), this.size);
      if (Math.max(...[p.left, p.right].map((s) => c.measureText(fmt(s.value, s.format ?? 'usd')).width)) <= COLW - 40) break;
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, start } = this.ctx;
    const p = this.p;
    clearRT(renderer, out, LIN.ink);
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    const t = f.t, tf = frameTime(t);
    const enter = prog(t, start, start + 0.5, ease.outCubic);

    if (p.kicker) drawMono(c, p.kicker, SAFE, SAFE + 26, { size: 24, color: 'gold', alpha: enter, weight: 600 });
    if (p.title) {
      c.save(); c.globalAlpha = enter;
      c.font = font(F.archivo(100, 800), 60); c.fillStyle = rgba('bone');
      c.fillText(p.title, SAFE, SAFE + (p.kicker ? 100 : 60));
      c.restore();
    }

    // divider between the columns
    c.fillStyle = rgba('rule');
    c.fillRect(W / 2 - 1, TOP, 2, 400 * prog(t, start + 0.1, start + 0.7, ease.inOutCubic));

    const k = prog(tf, this.t0, this.t1, ease.outCubic); // the count: one value per frame
    [p.left, p.right].forEach((s, i) => {
      const cx = CX[i]!, color = s.color ?? (i === 0 ? 'gold' : 'blue');
      const a = prog(t, start + 0.1 + i * 0.15, start + 0.6 + i * 0.15, ease.outCubic), rise = (1 - a) * 20;
      c.save(); c.globalAlpha = a;
      // name card: colour bar, name, sub
      c.fillStyle = rgba(color);
      c.beginPath(); c.roundRect(cx - 40, TOP + rise, 80, 6, 3); c.fill();
      c.font = font(F.archivo(100, 700), 48); c.fillStyle = rgba('bone'); c.textAlign = 'center';
      c.fillText(s.label, cx, TOP + 70 + rise);
      if (s.sub) drawMono(c, s.sub, cx, TOP + 110 + rise, { size: 22, color: 'ash', align: 'center' });
      // hero value, counting with dim leading zeros (keeps its final width)
      const fmtS = s.format ?? 'usd', finalS = fmt(s.value, fmtS);
      const [prefix, pad, body] = padToFinal(k >= 0.999 ? finalS : fmt(s.value * k, fmtS), finalS);
      c.font = font(F.num(100, 900), this.size);
      const total = c.measureText(prefix + pad + body).width;
      let x = cx - total / 2;
      const y = TOP + 140 + this.size * 0.82 + rise;
      c.textAlign = 'left';
      const hero = rgba(color === 'gold' ? 'goldHi' : color); // gold heroes use the highlight for contrast
      for (const [txt, col] of [[prefix, hero], [pad, rgba('graphite', 0.5)], [body, hero]] as const) {
        if (!txt) continue;
        c.fillStyle = col;
        c.fillText(txt, x, y);
        x += c.measureText(txt).width;
      }
      // detail rows: label left, value right, hairline between rows
      let ry = y + 70;
      for (const r of s.rows ?? []) {
        c.fillStyle = rgba('rule'); c.fillRect(cx - COLW / 2 + 40, ry - 34, COLW - 80, 1);
        drawMono(c, r.label, cx - COLW / 2 + 40, ry, { size: 22, color: 'ash' });
        c.font = font(F.mono(600), 26); c.fillStyle = rgba('bone'); c.textAlign = 'right';
        c.fillText(fmt(r.value, r.format ?? 'usd'), cx + COLW / 2 - 40, ry);
        c.textAlign = 'left';
        ry += 52;
      }
      c.restore();
    });

    // the gap, centred under both columns
    if (p.gap) {
      const a = prog(t, this.tg, this.tg + 0.45, ease.outCubic);
      if (a > 0) {
        const g = p.gap.value ?? Math.abs(p.left.value - p.right.value);
        const hi = Math.max(p.left.value, p.right.value), lo = Math.min(p.left.value, p.right.value);
        const y = 900 + (1 - a) * 14;
        c.save(); c.globalAlpha = a;
        drawMono(c, p.gap.label, W / 2, y - 64, { size: 22, color: 'ash', align: 'center' });
        c.font = font(F.num(100, 800), 64); c.fillStyle = rgba('bone'); c.textAlign = 'center';
        const text = fmt(g, p.gap.format ?? 'usd') + (p.gap.ratio && lo > 0 ? `  ·  ${mult(hi / lo)}` : '');
        c.fillText(text, W / 2, y);
        c.restore();
      }
    }

    comp.draw(renderer, L.upload(), out);
  }
}
