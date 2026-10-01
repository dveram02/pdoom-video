// Global overlay (docs/FINANCE_STYLE_GUIDE.md §5.2, §6): the small print that has to be on screen whenever a
// chart shows real or hypothetical numbers. Bottom-left inside the title-safe margin, Plex Mono 20 px:
//   SOURCE: U.S. BLS, CPI-U 1990–2025
//   HYPOTHETICAL · 8% AVG ANNUAL RETURN · NOT GUARANTEED
// Timeline entries carry them (`source`, `note`); a scene can hide the HUD with post.hud = 0.
import { Layer2D, H } from './gl';
import { rgba } from './palette';
import { F, font } from './type';
import { smoothstep } from './util';

export interface HudNote { start: number; end: number; source?: string; note?: string }

export interface HudState {
  /** Opacity multiplier from the active scene (post.hud). */
  opacity: number;
  /** 0..1: the frame is a paper scene — draw in ink. */
  paper: number;
}

/** Margin of the title-safe area (logical px). */
export const SAFE = 96;

export class Hud {
  layer = new Layer2D();
  constructor(public notes: HudNote[]) {}

  draw(t: number, st: HudState) {
    const L = this.layer;
    L.clear();
    if (st.opacity <= 0.001) return L.upload();
    const c = L.ctx;
    const ink = st.paper > 0.5;
    // the newest entry that is on screen wins; fade in/out over 0.35 s at its edges
    const n = [...this.notes].reverse().find((k) => t >= k.start && t < k.end);
    if (n) {
      const a = Math.min(smoothstep(n.start, n.start + 0.35, t), 1 - smoothstep(n.end - 0.35, n.end, t)) * st.opacity;
      const lines = [n.note, n.source ? `SOURCE: ${n.source}` : undefined].filter((s): s is string => !!s);
      c.save();
      c.globalAlpha = a;
      c.textBaseline = 'alphabetic';
      c.font = font(F.mono(500), 20);
      c.letterSpacing = '1.5px';
      c.fillStyle = ink ? rgba('ink', 0.6) : rgba('graphite', 1);
      // bottom line sits on the title-safe edge; lines stack upward
      lines.reverse().forEach((s, i) => c.fillText(s.toUpperCase(), SAFE, H - SAFE - i * 30));
      c.restore();
    }
    return L.upload();
  }
}
