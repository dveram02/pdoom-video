// ChapterCard: a section title (style guide §7 "Section breaks"): mono chapter number, Archivo 900 title, a gold
// rule drawing in under it. Matches the YouTube chapters (both come from the `## headings` in script.md).
//
//   E('ch2', 'chapter-card', at('Now the time advantage'), at('Imagine'), {})          // title + number from the chapter
//   E('ch2', 'chapter-card', t0, t1, { title: 'The time advantage', number: 2, total: 5 })
//
// params:  title (default: the script chapter that starts nearest this entry), number / total (default: from the
//          chapter list), kicker (replaces the "02 / 05" line)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { SAFE } from '../engine/hud';
import { ease, prog } from '../engine/util';
import { drawMono } from './_kit';

interface Params { title?: string; number?: number; total?: number; kicker?: string }

export default class ChapterCard extends Scene {
  layer = new Layer2D();
  title = '';
  line = '';
  size = 112;
  titleW = 0;

  override init() {
    const p = this.ctx.params as Params;
    const { narration: n, start, id } = this.ctx;
    const chs = n.chapters;
    // the chapter whose start is closest to this entry (cards usually start a beat before the chapter's first word)
    let idx = -1;
    chs.forEach((ch, i) => { if (idx < 0 || Math.abs(ch.start - start) < Math.abs(chs[idx]!.start - start)) idx = i; });
    this.title = p.title ?? chs[idx]?.title ?? '';
    if (!this.title) throw new Error(`chapter-card '${id}': no title (pass params.title or add ## headings to script.md)`);
    const num = p.number ?? (idx >= 0 ? idx + 1 : undefined), total = p.total ?? (chs.length || undefined);
    this.line = p.kicker ?? (num ? `${String(num).padStart(2, '0')}${total ? ` / ${String(total).padStart(2, '0')}` : ''}` : '');
    const c = this.layer.ctx;
    for (this.size = 112; this.size > 64; this.size -= 4) {
      c.font = font(F.archivo(100, 900), this.size);
      this.titleW = c.measureText(this.title).width;
      if (this.titleW <= W - SAFE * 2 - 200) break;
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, start } = this.ctx;
    clearRT(renderer, out, LIN.ink);
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    const t = f.t;
    const x = SAFE + 100, y = H / 2 + this.size * 0.3;
    const a1 = prog(t, start, start + 0.45, ease.outCubic);
    const a2 = prog(t, start + 0.15, start + 0.7, ease.outCubic);
    const rule = prog(t, start + 0.4, start + 1.1, ease.inOutCubic);
    if (this.line) drawMono(c, this.line, x, y - this.size - 18 + (1 - a1) * 12, { size: 28, color: 'gold', alpha: a1, weight: 600, tracking: 6 });
    c.save(); c.globalAlpha = a2;
    c.font = font(F.archivo(100, 900), this.size); c.fillStyle = rgba('bone');
    c.fillText(this.title, x, y + (1 - a2) * 18);
    c.restore();
    c.fillStyle = rgba('gold');
    c.fillRect(x, y + 40, Math.max(0, this.titleW * rule), 6);
    comp.draw(renderer, L.upload(), out);
    return { hud: 0 };
  }
}
