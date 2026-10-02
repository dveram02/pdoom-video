// Engine test card (videos/_engine-test): exercises the pipeline end to end, not a production component.
// Shows the video title, the spoken sentence with per-word timing, and a growth counter + line computed
// from assumptions.json that lands on the year the narration names.
//   params: { kind: 'title' } | { kind: 'growth', key: '<assumptions key>', landOn: '<phrase>' }
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { SAFE } from '../engine/hud';
import { Narration } from '../engine/narration';
import { ease, frameTime, prog } from '../engine/util';
import { growthSeries, usd, valueAt, yearly, type GrowthPoint } from '../finance';
import type * as THREE from 'three';

export default class TestCard extends Scene {
  layer = new Layer2D();
  series: GrowthPoint[] = [];
  years = 0;
  /** Video time the counter lands on its final value (the spoken phrase), and when it starts. */
  landT = 0;
  startT = 0;

  override init() {
    const p = this.ctx.params;
    if (p.kind === 'growth') {
      const a = this.ctx.video.assumptions[p.key];
      if (!a) throw new Error(`assumptions.json has no "${p.key}"`);
      this.series = growthSeries(a);
      this.years = a.years;
      this.startT = this.ctx.start + 0.6;
      this.landT = this.ctx.narration.phrase(p.landOn).start;
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, narration, video, params } = this.ctx;
    clearRT(renderer, out, LIN.ink);
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';

    // header: mono kicker + title
    c.font = font(F.mono(500), 22);
    c.letterSpacing = '4px';
    c.fillStyle = rgba('gold');
    c.fillText(`ENGINE TEST · ${video.id}`, SAFE, SAFE + 22);
    c.letterSpacing = '0px';
    c.font = font(F.archivo(100, 900), 72);
    c.fillStyle = rgba('bone');
    c.fillText(video.meta.title, SAFE, SAFE + 110);

    if (params.kind === 'growth') this.growth(c, f.t);

    // the sentence being spoken, word by word (a test of the timings, not a style: real videos don't subtitle)
    const l = narration.lastLine(f.t);
    if (l && f.t < l.end + 0.6) {
      c.font = font(F.archivo(100, 500), 34);
      let x = SAFE;
      const y = 1080 - SAFE - 110;
      for (const w of l.words) {
        const k = Narration.wordProgress(w, frameTime(f.t)); // text: one state per frame
        c.fillStyle = k > 0 ? rgba('bone', 0.35 + 0.65 * Math.min(1, k * 3)) : rgba('graphite');
        const s = w.w + ' ';
        const ww = c.measureText(s).width;
        if (x + ww > W - SAFE) break;
        c.fillText(s, x, y);
        x += ww;
      }
    }
    comp.draw(renderer, L.upload(), out);
  }

  private growth(c: CanvasRenderingContext2D, t: number) {
    const yearAt = (x: number) => this.years * prog(x, this.startT, this.landT, ease.inOutCubic);
    // the line moves with continuous t (real motion, motion-blurred); the digits hold one value per frame
    const year = yearAt(t), yearShown = yearAt(frameTime(t));
    const bal = valueAt(this.series, yearShown), put = valueAt(this.series, yearShown, 'contributed');
    // counter: tabular figures, so the digits don't jitter while counting
    c.font = font(F.num(100, 900), 160);
    c.fillStyle = rgba('goldHi');
    c.fillText(usd(bal), SAFE, 470);
    c.font = font(F.mono(500), 26);
    c.letterSpacing = '2px';
    c.fillStyle = rgba('ash');
    c.fillText(`YEAR ${Math.floor(yearShown + 1e-6)}  ·  YOU PUT IN ${usd(put)}  ·  GROWTH ${usd(bal - put, { sign: true })}`, SAFE, 530);
    c.letterSpacing = '0px';

    // line chart, drawn up to `year`: grey contributions, gold balance, one y-axis
    const x0 = 1180, x1 = W - SAFE, y0 = 800, y1 = 300;
    const ys = yearly(this.series), max = ys.at(-1)!.balance;
    const X = (yr: number) => x0 + ((x1 - x0) * yr) / this.years, Y = (v: number) => y0 - ((y0 - y1) * v) / max;
    c.strokeStyle = rgba('rule'); c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(x0, Y((max * i) / 4)); c.lineTo(x1, Y((max * i) / 4)); c.stroke(); }
    c.font = font(F.mono(400), 24); c.fillStyle = rgba('ash'); c.textAlign = 'right';
    for (let i = 0; i <= 4; i++) c.fillText(usd((max * i) / 4, { compact: true }), x0 - 16, Y((max * i) / 4) + 8);
    c.textAlign = 'left';
    const line = (key: 'balance' | 'contributed', color: string) => {
      c.strokeStyle = color; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      for (let yr = 0; yr <= year; yr += 1 / 12) { const v = valueAt(this.series, yr, key); yr === 0 ? c.moveTo(X(yr), Y(v)) : c.lineTo(X(yr), Y(v)); }
      c.lineTo(X(year), Y(valueAt(this.series, year, key)));
      c.stroke();
    };
    line('contributed', rgba('ash'));
    line('balance', rgba('gold'));
    c.fillStyle = rgba('goldHi');
    c.beginPath(); c.arc(X(year), Y(valueAt(this.series, year)), 8, 0, Math.PI * 2); c.fill();
  }
}
