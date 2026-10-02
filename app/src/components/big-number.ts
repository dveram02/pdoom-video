// BigNumber: one hero figure that counts to its value and lands on the spoken word (style guide §3, §7, §10).
//
//   E('total', 'big-number', at('After thirty years'), at('Now compare'), {
//     value: annuityFV(a.contribution, a.rate, a.years),   // computed in timeline.ts from assumptions, never typed
//     format: 'usd', kicker: 'After 30 years', label: 'Portfolio value',
//     countOn: 'After thirty years', landOn: 'one hundred forty-nine thousand',
//     delta: { value: 113036, format: 'usdSigned', label: 'growth' },
//   })
//
// params:
//   value        the number (required)
//   from         where the count starts (default 0; set from = value for a reveal without counting)
//   format       NumFormat (default 'usd'); decimals for pct/num/mult
//   kicker       small gold mono line above ("AFTER 30 YEARS")
//   label        mono line below the number ("PORTFOLIO VALUE")
//   sub          a short Archivo line below the label ("a month, every month"), ≤ 7 words
//   suffix       unit set small after the number ("/mo", "/yr")
//   countOn      cue (phrase, or seconds after the entry starts) where counting starts (default: 0.35 s in)
//   landOn       cue where the count lands (default: 1.8 s after countOn). Lands ON the word, never after.
//   delta        { value, format?, label? }: gain/loss chip that pops in after landing
//   align        'center' (default) | 'left'
//   color        'bone' | 'gold' (default 'gold' for money, use 'bone' for neutral figures)
//   size         font px (default fits: 240, shrunk to the safe width)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { SAFE } from '../engine/hud';
import { ease, frameTime, prog } from '../engine/util';
import { cueTime, drawDeltaChip, drawMono, fmt, type Cue, type NumFormat } from './_kit';
import { padToFinal } from '../finance/format';

interface Params {
  value: number;
  from?: number;
  format?: NumFormat;
  decimals?: number;
  kicker?: string;
  label?: string;
  sub?: string;
  suffix?: string;
  countOn?: Cue;
  landOn?: Cue;
  delta?: { value: number; format?: NumFormat; label?: string };
  align?: 'center' | 'left';
  color?: 'bone' | 'gold';
  size?: number;
}

export default class BigNumber extends Scene {
  layer = new Layer2D();
  p!: Params;
  t0 = 0; // counting starts
  t1 = 0; // lands
  size = 240;
  /** Width of the final number string: the number is laid out for it, so a new digit doesn't shift the layout. */
  finalW = 0;
  suffixW = 0;

  override init() {
    const p = (this.p = this.ctx.params as Params);
    if (typeof p.value !== 'number' || !Number.isFinite(p.value)) throw new Error(`big-number '${this.ctx.id}': params.value must be a finite number`);
    const { narration: n, start } = this.ctx;
    this.t0 = cueTime(n, start, p.countOn, start + 0.35);
    this.t1 = cueTime(n, start, p.landOn, this.t0 + 1.8);
    if (this.t1 <= this.t0) this.t1 = this.t0 + 0.6;
    const c = this.layer.ctx;
    // fit: the number + suffix must stay inside the title-safe width
    const maxW = W - SAFE * 2 - (p.align === 'left' ? 0 : 160);
    this.size = p.size ?? 240;
    for (;;) {
      c.font = font(F.num(100, 900), this.size);
      this.finalW = c.measureText(this.text(p.value)).width;
      c.font = font(F.archivo(100, 700), this.size * 0.32);
      this.suffixW = p.suffix ? c.measureText(p.suffix).width + this.size * 0.06 : 0;
      if (this.finalW + this.suffixW <= maxW || this.size <= 120) break;
      this.size -= 8;
    }
  }

  private text(v: number) {
    return fmt(v, this.p.format ?? 'usd', this.p.decimals);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, start } = this.ctx;
    const p = this.p;
    clearRT(renderer, out, LIN.ink);
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';

    const t = f.t, tf = frameTime(t); // tf: the count holds one value per frame (sharp digits, cheap motion blur)
    const enter = prog(t, start, start + 0.5, ease.outCubic); // entrance (real motion: raw t)
    const k = prog(tf, this.t0, this.t1, ease.outCubic);
    const from = p.from ?? 0;
    const v = from + (p.value - from) * k;
    // snap the last stretch to the exact value so the landing frame shows exactly what the voice says
    const shown = k >= 0.999 ? p.value : v;
    // landing highlight: 1 → 0 over ~0.6 s after landing (per frame: it recolours text)
    const settle = tf >= this.t1 ? Math.exp(-(tf - this.t1) / 0.25) : 0;

    const S = this.size;
    const center = (p.align ?? 'center') === 'center';
    const blockW = this.finalW + this.suffixW;
    const left = center ? (W - blockW) / 2 : SAFE;
    const baseY = center ? H / 2 + S * 0.32 : H / 2 + S * 0.2;
    const rise = (1 - enter) * 24;

    // kicker
    if (p.kicker) drawMono(c, p.kicker, center ? W / 2 : left, baseY - S * 0.92 + rise, { size: 26, color: 'gold', alpha: enter, align: center ? 'center' : 'left', weight: 600 });

    // the number: right-aligned to the final width (digits grow leftward, nothing jumps)
    c.save();
    c.globalAlpha = enter;
    c.font = font(F.num(100, 900), S);
    c.textAlign = 'right';
    const gold = (p.color ?? 'gold') === 'gold';
    // counts in gold, flashes to the highlight on landing and eases back
    const fill = gold ? mixHex('#BA8520', '#E3B04B', settle) : rgba('bone');
    // the counter keeps its final width: digits not reached yet show as dim zeros ($002,823 → $149,036)
    const [prefix, pad, body] = padToFinal(this.text(shown), this.text(p.value));
    let x = left + this.finalW; // drawn right to left: live digits, dim zeros, prefix
    c.fillStyle = fill;
    c.fillText(body, x, baseY + rise);
    x -= c.measureText(body).width;
    if (pad) {
      c.fillStyle = rgba('graphite', 0.5);
      c.fillText(pad, x, baseY + rise);
      x -= c.measureText(pad).width;
      c.fillStyle = fill;
      c.fillText(prefix, x, baseY + rise);
    }
    c.restore();
    if (p.suffix) {
      c.save();
      c.globalAlpha = enter;
      c.font = font(F.archivo(100, 700), S * 0.32);
      c.fillStyle = rgba('ash');
      c.fillText(p.suffix, left + this.finalW + S * 0.06, baseY + rise);
      c.restore();
    }

    // label + sub + delta chip under the number
    let y = baseY + S * 0.3 + 34;
    const lx = center ? W / 2 : left;
    if (p.label) { drawMono(c, p.label, lx, y + rise, { size: 28, color: 'ash', alpha: enter, align: center ? 'center' : 'left' }); y += 58; }
    if (p.sub) {
      c.save();
      c.globalAlpha = enter;
      c.font = font(F.archivo(100, 500), 44);
      c.fillStyle = rgba('bone', 0.9);
      c.textAlign = center ? 'center' : 'left';
      c.fillText(p.sub, lx, y + 10 + rise);
      c.restore();
      y += 76;
    }
    if (p.delta) {
      const a = prog(t, this.t1 + 0.15, this.t1 + 0.55, ease.outCubic);
      if (a > 0) {
        const d = p.delta;
        const txt = fmt(d.value, d.format ?? 'usdSigned') + (d.label ? `  ${d.label.toUpperCase()}` : '');
        c.font = font(F.mono(600), 30);
        const w = c.measureText(`▲ ${txt}`).width + 30;
        const x = center ? W / 2 - w / 2 : left;
        drawDeltaChip(c, x, y + 20 + (1 - a) * 14, d.value, txt, 30, a);
      }
    }
    comp.draw(renderer, L.upload(), out);
  }
}

function mixHex(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
