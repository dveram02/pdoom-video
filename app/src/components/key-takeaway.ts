// KeyTakeaway: one short sentence that sums up a section (style guide §10: ≤ 7 words, bone on ink), the key word
// underlined in gold when it's spoken.
//
//   E('takeaway', 'key-takeaway', at('The lesson'), at('Next'), { text: 'Time does the heavy lifting.', highlight: 'Time', on: 'time does' })
//
// params:  text (≤ 7 words; longer throws: split it or cut it), highlight (a word of the text to underline;
//          default: the whole line), on (cue for the underline; default 0.7 s in), kicker (default 'Key takeaway')
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { ease, prog } from '../engine/util';
import { cueTime, drawMono, type Cue } from './_kit';

interface Params { text: string; highlight?: string; on?: Cue; kicker?: string }

export default class KeyTakeaway extends Scene {
  layer = new Layer2D();
  p!: Params;
  size = 96;
  tOn = 0;

  override init() {
    const p = (this.p = this.ctx.params as Params);
    const { id, narration, start } = this.ctx;
    if (!p.text) throw new Error(`key-takeaway '${id}': params.text is required`);
    const words = p.text.trim().split(/\s+/).length;
    if (words > 7) throw new Error(`key-takeaway '${id}': ${words} words; the style guide allows 7 (cut it or split it into two takeaways)`);
    if (p.highlight && !p.text.includes(p.highlight)) throw new Error(`key-takeaway '${id}': highlight “${p.highlight}” is not in the text`);
    this.tOn = cueTime(narration, start, p.on, start + 0.7);
    const c = this.layer.ctx;
    for (this.size = 96; this.size > 56; this.size -= 4) {
      c.font = font(F.archivo(100, 800), this.size);
      if (c.measureText(p.text).width <= W - 400) break;
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, start } = this.ctx;
    const p = this.p;
    clearRT(renderer, out, LIN.ink);
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    const t = f.t;
    const a = prog(t, start, start + 0.5, ease.outCubic);
    const y = H / 2 + this.size * 0.3;
    drawMono(c, p.kicker ?? 'Key takeaway', W / 2, y - this.size - 30, { size: 24, color: 'gold', alpha: a, align: 'center', weight: 600 });
    c.font = font(F.archivo(100, 800), this.size);
    const tw = c.measureText(p.text).width, x0 = (W - tw) / 2;
    c.save(); c.globalAlpha = a;
    c.fillStyle = rgba('bone');
    c.fillText(p.text, x0, y + (1 - a) * 16);
    c.restore();
    // underline: under the highlighted word (measured in place, so kerning matches the drawn line)
    let ux = x0, uw = tw;
    if (p.highlight) {
      const i = p.text.indexOf(p.highlight);
      ux = x0 + c.measureText(p.text.slice(0, i)).width;
      uw = c.measureText(p.highlight).width;
    }
    const k = prog(t, this.tOn, this.tOn + 0.5, ease.inOutCubic);
    c.fillStyle = rgba('gold');
    c.fillRect(ux, y + 26, uw * k, 7);
    comp.draw(renderer, L.upload(), out);
  }
}
