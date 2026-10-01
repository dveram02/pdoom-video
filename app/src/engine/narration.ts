// Word-timed narration (videos/<id>/narration.json) with queries for anchoring scenes to what is said.
// Same format as the original word-timed lyrics: lines[] (one per sentence) → words[] {w, start, end}.
import { smart } from './type';

export interface Word {
  w: string; // display token (punctuation attached, typographic quotes: don’t, ’cause)
  start: number;
  end: number;
  conf?: number;
  syl?: [number, number][];
  /** filled in by Narration: */
  line: number;
  index: number; // index within line
  gi: number; // global word index
}
export interface Line {
  i: number;
  text: string;
  start: number;
  end: number;
  words: Word[];
}
/** A run of consecutive words (may cross sentence boundaries). */
export interface Phrase {
  words: Word[];
  start: number;
  end: number;
  text: string;
}
export interface NarrationMeta {
  /** How the timings were made: 'estimate' (from script.md, no audio), 'elevenlabs', 'whisperx'. */
  source?: string;
  /** Seconds of audio (when known); the narration may end before the audio does. */
  audioDuration?: number;
}

/** A chapter from a `## heading` in script.md (also the YouTube chapter list). */
export interface Chapter { title: string; start: number }

export class Narration {
  lines: Line[];
  words: Word[];
  meta: NarrationMeta;
  chapters: Chapter[];
  constructor(j: { lines: any[]; meta?: NarrationMeta; chapters?: Chapter[] }) {
    // display text gets curly apostrophes and quotes (the data keeps the typed ones); mono UI
    // text that wants them straight uses plain()
    this.lines = (j.lines as any[]).map((l, li) => ({
      ...l,
      i: li,
      text: smart(l.text),
      words: (l.words as any[]).map((w, wi) => ({ ...w, w: smart(w.w), line: li, index: wi, gi: 0 })),
    }));
    this.words = this.lines.flatMap((l) => l.words);
    this.words.forEach((w, i) => (w.gi = i));
    this.meta = j.meta ?? {};
    this.chapters = j.chapters ?? [];
  }

  /** The chapter titled `title` (case-insensitive); throws if missing. */
  chapter(title: string): Chapter {
    const c = this.chapters.find((x) => x.title.toLowerCase() === title.toLowerCase());
    if (!c) throw new Error(`chapter not found: “${title}” (chapters come from ## headings in script.md)`);
    return c;
  }

  static async load(url: string): Promise<Narration> {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json'))
      throw new Error(`no narration timings at ${url} (make them: bun scripts/narration.ts estimate --video <id>)`);
    return new Narration(await r.json());
  }

  /** End of the last spoken word. */
  get end(): number {
    return this.words.length ? this.words[this.words.length - 1]!.end : 0;
  }

  /** The sentence being spoken at t (or null in pauses). */
  lineAt(t: number): Line | null {
    return this.lines.find((l) => t >= l.start && t < l.end) ?? null;
  }
  /** Most recent sentence that started at or before t. */
  lastLine(t: number): Line | null {
    let best: Line | null = null;
    for (const l of this.lines) if (l.start <= t) best = l;
    return best;
  }
  nextLine(t: number): Line | null {
    return this.lines.find((l) => l.start > t) ?? null;
  }
  linesIn(t0: number, t1: number): Line[] {
    return this.lines.filter((l) => l.end > t0 && l.start < t1);
  }
  /** Sentences whose text includes `s` (case-insensitive, straight or curly quotes). */
  find(s: string): Line[] {
    const q = fold(s);
    return this.lines.filter((l) => fold(l.text).includes(q));
  }
  /** nth sentence containing `s`; throws if missing (fail loudly while authoring). */
  get(s: string, nth = 0): Line {
    const l = this.find(s)[nth];
    if (!l) throw new Error(`narration line not found: “${s}”${nth ? ` (#${nth})` : ''}`);
    return l;
  }

  /**
   * The nth occurrence of a run of words, matched word by word ignoring case and punctuation, across
   * sentence boundaries: `phrase('five hundred dollars')`. This is how scenes and cues anchor to the voice.
   */
  findPhrases(s: string): Phrase[] {
    const q = s.split(/\s+/).map(norm).filter(Boolean);
    const out: Phrase[] = [];
    if (!q.length) return out;
    const ws = this.words.map((w) => norm(w.w));
    for (let i = 0; i + q.length <= ws.length; i++) {
      let ok = true;
      for (let k = 0; k < q.length && ok; k++) ok = ws[i + k] === q[k];
      if (!ok) continue;
      const words = this.words.slice(i, i + q.length);
      out.push({ words, start: words[0]!.start, end: words[words.length - 1]!.end, text: words.map((w) => w.w).join(' ') });
    }
    return out;
  }
  phrase(s: string, nth = 0): Phrase {
    const p = this.findPhrases(s)[nth];
    if (!p) throw new Error(`narration phrase not found: “${s}”${nth ? ` (#${nth})` : ''} — phrases match whole words in order, ignoring case and punctuation`);
    return p;
  }

  wordAt(t: number): Word | null {
    return this.words.find((w) => t >= w.start && t < w.end) ?? null;
  }
  lastWord(t: number): Word | null {
    let best: Word | null = null;
    for (const w of this.words) if (w.start <= t) best = w;
    return best;
  }
  /** Words whose normalized text matches (e.g. '$500' → '500'). */
  findWords(s: string): Word[] {
    const q = norm(s);
    return this.words.filter((w) => norm(w.w) === q);
  }

  /** Spoken progress of a word at time t: 0 before start, 1 after end, linear inside (or across syllables). */
  static wordProgress(w: Word, t: number): number {
    if (t <= w.start) return 0;
    if (t >= w.end) return 1;
    if (w.syl && w.syl.length > 1) {
      const n = w.syl.length;
      for (let i = 0; i < n; i++) {
        const [a, b] = w.syl[i]!;
        if (t < a) return i / n;
        if (t < b) return (i + (t - a) / Math.max(1e-3, b - a)) / n;
      }
      return 1;
    }
    return (t - w.start) / Math.max(1e-3, w.end - w.start);
  }

  /** Progress through a whole line in characters (0..text.length), for per-glyph wipes. */
  static lineCharProgress(l: Line, t: number): number {
    let chars = 0;
    for (const w of l.words) {
      const p = Narration.wordProgress(w, t);
      chars += p * w.w.length;
      if (p < 1) break;
      chars += 1; // the space
    }
    return Math.min(chars, l.text.length);
  }
}

/** Matching key for a word: lowercase letters, digits and % only ('$500,' → '500', 'Don’t' → 'dont'). */
export const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9%']/g, '').replace(/'/g, '');
const fold = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
