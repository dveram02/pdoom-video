#!/usr/bin/env bun
// Narration timing tools. Every mode reads/writes files in videos/<id>/ (run from app/):
//
//   estimate         bun scripts/narration.ts estimate --video <id> [--wpm 155]
//                    Timings estimated from script.md alone (no audio yet): prototype the edit before recording.
//   from-elevenlabs  bun scripts/narration.ts from-elevenlabs --video <id> --in tts.json [--audio-out narration.mp3]
//                    The response of ElevenLabs' text-to-speech *with-timestamps* endpoint (or just its
//                    `alignment` object). With --audio-out, also decodes its audio_base64 into the video folder.
//   from-whisperx    bun scripts/narration.ts from-whisperx --video <id> --in narration.json-from-whisperx
//                    WhisperX's JSON output (`whisperx narration.wav --output_format json`), ideally forced-aligned
//                    to script.md. Words WhisperX could not time (numbers, symbols) are interpolated.
//   analyze          bun scripts/narration.ts analyze --video <id>
//                    Decodes the video's audio (video.json mix/audio) with ffmpeg → audio.json (duration, loudness envelope).
//   srt              bun scripts/narration.ts srt --video <id>       → captions.srt (upload to YouTube)
//   chapters         bun scripts/narration.ts chapters --video <id>  → chapters.txt (paste into the description)
//
// narration.json format (what the engine reads; the same shape as the original word-timed lyrics):
//   { meta: { source, audioDuration? }, chapters: [{ title, start }], lines: [{ text, start, end, words: [{ w, start, end }] }] }
// One line per sentence. Chapters come from the `## headings` in script.md.
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(import.meta.dir, '../..');
const id = opt('video');
if (!mode || !id) {
  console.error('usage: bun scripts/narration.ts <estimate|from-elevenlabs|from-whisperx|analyze|srt|chapters> --video <id> [options]');
  process.exit(1);
}
const DIR = path.join(ROOT, 'videos', id);
if (!existsSync(DIR)) throw new Error(`no video folder: ${DIR}`);
const file = (f: string) => path.join(DIR, f);
const readJSON = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const writeJSON = (f: string, j: unknown) => { writeFileSync(f, JSON.stringify(j, null, 1) + '\n'); console.log(`wrote ${path.relative(ROOT, f)}`); };
const r3 = (x: number) => Math.round(x * 1000) / 1000;

interface W { w: string; start: number; end: number; conf?: number }
interface Line { text: string; start: number; end: number; words: W[] }
interface Chapter { title: string; start: number }

// ------------------------------------------------------------------ script.md
// Spoken text = paragraph text. Ignored: YAML front matter, `> notes`, <!-- comments -->, [stage directions],
// and lines starting with `- [ ]`/`|` (checklists, tables). `## Heading` lines start a chapter.

interface ScriptSection { title: string; paragraphs: string[] }

function readScript(): ScriptSection[] {
  const f = file('script.md');
  if (!existsSync(f)) throw new Error(`missing ${path.relative(ROOT, f)}`);
  let src = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  src = src.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/<!--[\s\S]*?-->/g, '');
  const sections: ScriptSection[] = [{ title: '', paragraphs: [] }];
  let para: string[] = [];
  const flush = () => { if (para.length) sections.at(-1)!.paragraphs.push(para.join(' ')); para = []; };
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      if (h[1]!.length >= 2) sections.push({ title: h[2]!.trim(), paragraphs: [] }); // # is the video title
      continue;
    }
    if (!line || line.startsWith('>') || line.startsWith('|') || /^[-*] \[[ x]\]/.test(line)) { flush(); continue; }
    const spoken = line.replace(/\[[^\]]*\]/g, '').replace(/\*\*?|__?|`/g, '').replace(/\s+/g, ' ').trim();
    if (spoken) para.push(spoken);
  }
  flush();
  return sections.filter((s) => s.paragraphs.length);
}

const ABBREV = /\b(?:U\.S|U\.K|e\.g|i\.e|vs|Mr|Mrs|Ms|Dr|St|Inc|Co|No|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|approx|est)\.$/i;

/** Split a paragraph into sentences (keeps "U.S.", "e.g.", decimals like 8.5% intact). */
function sentences(p: string): string[] {
  const words = p.split(' ');
  const out: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?]["”’)]*$/.test(w) && !ABBREV.test(w)) { out.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

// ------------------------------------------------------------------ grouping and chapters

/** Group a flat word list into sentence lines (by end punctuation). */
function toLines(words: W[]): Line[] {
  const lines: Line[] = [];
  let cur: W[] = [];
  const push = () => {
    if (!cur.length) return;
    lines.push({ text: cur.map((w) => w.w).join(' '), start: cur[0]!.start, end: cur.at(-1)!.end, words: cur });
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    if (/[.!?]["”’)]*$/.test(w.w) && !ABBREV.test(w.w)) push();
  }
  push();
  return lines;
}

const key = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9%']/g, '').replace(/'/g, '');

/** Chapter starts: each script section's first words, found in order in the timed words. */
function chapters(words: W[], sections: ScriptSection[]): Chapter[] {
  const keys = words.map((w) => key(w.w));
  const out: Chapter[] = [];
  let from = 0;
  for (const s of sections) {
    if (!s.title) continue;
    const q = s.paragraphs[0]!.split(' ').map(key).filter(Boolean).slice(0, 4);
    let hit = -1;
    for (let i = from; i + q.length <= keys.length && hit < 0; i++) if (q.every((k, j) => keys[i + j] === k)) hit = i;
    if (hit < 0) { console.warn(`chapter "${s.title}": its first words weren't found in the timings`); continue; }
    out.push({ title: s.title, start: r3(words[hit]!.start) });
    from = hit + q.length;
  }
  return out;
}

function writeNarration(words: W[], source: string, extra: Record<string, unknown> = {}) {
  const sections = existsSync(file('script.md')) ? readScript() : [];
  const lines = toLines(words.map((w) => ({ ...w, start: r3(w.start), end: r3(w.end) })));
  writeJSON(file('narration.json'), { meta: { source, ...extra }, chapters: chapters(words, sections), lines });
  const end = words.at(-1)?.end ?? 0;
  console.log(`${lines.length} sentences, ${words.length} words, ${end.toFixed(1)} s spoken`);
}

// ------------------------------------------------------------------ estimate (no audio)

/** Rough speaking weight of a token in "average words": numbers and long words take longer to say. */
function weight(w: string): number {
  const t = w.replace(/[^\w$%.,]/g, '');
  const digits = (t.match(/\d/g) ?? []).length;
  if (digits) return Math.max(1, digits * 0.75 + (t.includes('$') ? 0.6 : 0) + (t.includes('%') ? 0.7 : 0));
  const letters = (t.match(/[a-z]/gi) ?? []).length;
  return Math.max(0.6, letters / 4.7);
}

function estimate() {
  const wpm = +opt('wpm', '155')!;
  const spw = 60 / wpm; // seconds per average word
  const words: W[] = [];
  let t = 0.6; // lead-in
  readScript().forEach((s, si) => {
    if (si > 0) t += 0.6; // section break
    s.paragraphs.forEach((p, pi) => {
      if (pi > 0) t += 0.35; // paragraph
      for (const sen of sentences(p)) {
        for (const w of sen.split(' ')) {
          const d = weight(w) * spw;
          words.push({ w, start: t, end: t + d * 0.92 });
          t += d;
          if (/[,;:—–]$/.test(w)) t += 0.15;
        }
        t += 0.3; // sentence pause
      }
    });
  });
  writeNarration(words, 'estimate', { wpm });
}

// ------------------------------------------------------------------ ElevenLabs

function fromElevenLabs() {
  const j = readJSON(path.resolve(opt('in')!));
  const al = j.alignment ?? j.normalized_alignment ?? j;
  const chars: string[] = al.characters, s: number[] = al.character_start_times_seconds, e: number[] = al.character_end_times_seconds;
  if (!chars || !s || !e) throw new Error('expected an ElevenLabs with-timestamps response (alignment.characters / character_start_times_seconds / character_end_times_seconds)');
  const words: W[] = [];
  let cur = '', start = 0, end = 0;
  const push = () => { if (cur.trim()) words.push({ w: cur.trim(), start, end }); cur = ''; };
  chars.forEach((c, i) => {
    if (/\s/.test(c)) { push(); return; }
    if (!cur) start = s[i]!;
    cur += c; end = e[i]!;
  });
  push();
  const out = opt('audio-out');
  if (out) {
    if (!j.audio_base64) throw new Error('--audio-out: the response has no audio_base64');
    writeFileSync(file(out), Buffer.from(j.audio_base64, 'base64'));
    console.log(`wrote videos/${id}/${out} (set "audio": "${out}" in video.json)`);
  }
  writeNarration(words, 'elevenlabs');
}

// ------------------------------------------------------------------ WhisperX

function fromWhisperX() {
  const j = readJSON(path.resolve(opt('in')!));
  const raw: { word: string; start?: number; end?: number; score?: number }[] =
    j.word_segments ?? (j.segments ?? []).flatMap((sg: any) => sg.words ?? []);
  if (!raw.length) throw new Error('no words in the WhisperX JSON (expected word_segments or segments[].words)');
  // words WhisperX couldn't align (digits, symbols) have no times: spread them between their neighbours
  const words: W[] = raw.map((r) => ({ w: r.word.trim(), start: r.start ?? NaN, end: r.end ?? NaN, conf: r.score }));
  let missing = 0;
  for (let i = 0; i < words.length; i++) {
    if (Number.isFinite(words[i]!.start)) continue;
    let k = i; while (k < words.length && !Number.isFinite(words[k]!.start)) k++;
    const a = i > 0 ? words[i - 1]!.end : 0, b = k < words.length ? words[k]!.start : a + 0.4 * (k - i);
    for (let m = i; m < k; m++) {
      const f0 = (m - i) / (k - i), f1 = (m - i + 1) / (k - i);
      words[m]!.start = a + (b - a) * f0; words[m]!.end = a + (b - a) * f1; words[m]!.conf = 0;
    }
    missing += k - i; i = k - 1;
  }
  if (missing) console.warn(`${missing} words had no WhisperX timing and were interpolated (conf 0)`);
  writeNarration(words, 'whisperx');
}

// ------------------------------------------------------------------ audio analysis

async function analyze() {
  const meta = readJSON(file('video.json'));
  const f = meta.mix ?? meta.audio;
  if (!f) throw new Error('video.json has no "audio" or "mix" yet');
  const SR = 16000, FPS = 100, HOP = SR / FPS;
  const p = Bun.spawn(['ffmpeg', '-v', 'error', '-i', file(f), '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { stdout: 'pipe', stderr: 'inherit' });
  const buf = new Uint8Array(await new Response(p.stdout).arrayBuffer());
  if ((await p.exited) !== 0) throw new Error('ffmpeg failed to decode the audio');
  const pcm = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  const n = Math.ceil(pcm.length / HOP);
  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = i * HOP; k < Math.min(pcm.length, (i + 1) * HOP); k++) { s += pcm[k]! * pcm[k]!; c++; }
    rms[i] = Math.sqrt(s / Math.max(1, c));
  }
  // normalise to the 95th percentile of voiced frames so 1.0 is "speaking normally"
  const voiced = Array.from(rms).filter((x) => x > 1e-3).sort((a, b) => a - b);
  const ref = voiced[Math.floor(voiced.length * 0.95)] ?? 1;
  const env = Array.from(rms, (x) => Math.round(Math.min(1, x / ref) * 1000) / 1000);
  const duration = r3(pcm.length / SR);
  writeJSON(file('audio.json'), { duration, fps: FPS, features: { rms: env, vocal: env } });
  console.log(`${duration} s of audio`);
}

// ------------------------------------------------------------------ captions and chapters

const stamp = (t: number, sep = ',') => {
  const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`;
};

function srt() {
  const j = readJSON(file('narration.json'));
  const cues: { start: number; end: number; text: string }[] = [];
  const MAX = 84, MAXDUR = 6; // two lines of ~42 characters, at most 6 s per cue
  for (const l of j.lines as Line[]) {
    let cur: W[] = [];
    const push = () => { if (cur.length) cues.push({ start: cur[0]!.start, end: cur.at(-1)!.end, text: cur.map((w) => w.w).join(' ') }); cur = []; };
    for (const w of l.words) {
      const text = [...cur, w].map((x) => x.w).join(' ');
      if (cur.length && (text.length > MAX || w.end - cur[0]!.start > MAXDUR)) push();
      cur.push(w);
    }
    push();
  }
  const wrap = (s: string) => {
    if (s.length <= 42) return s;
    const mid = s.lastIndexOf(' ', Math.ceil(s.length / 2) + 4);
    return mid > 0 ? `${s.slice(0, mid)}\n${s.slice(mid + 1)}` : s;
  };
  const out = cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(Math.max(c.end, c.start + 0.8))}\n${wrap(c.text)}\n`).join('\n');
  writeFileSync(file('captions.srt'), out);
  console.log(`wrote videos/${id}/captions.srt (${cues.length} cues)`);
}

function chaptersTxt() {
  const j = readJSON(file('narration.json'));
  const ch: Chapter[] = j.chapters ?? [];
  if (!ch.length) throw new Error('no chapters: add "## Section" headings to script.md and re-run the timing step');
  const fmt = (t: number) => { const s = Math.floor(t), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
  // YouTube needs the first chapter at 0:00, at least 3 chapters, each ≥ 10 s
  const list = ch.map((c, i) => ({ ...c, start: i === 0 ? 0 : c.start }));
  const short = list.filter((c, i) => (list[i + 1]?.start ?? Infinity) - c.start < 10);
  const out = list.map((c) => `${fmt(c.start)} ${c.title}`).join('\n') + '\n';
  writeFileSync(file('chapters.txt'), out);
  process.stdout.write(out);
  if (list.length < 3) console.warn('YouTube needs at least 3 chapters');
  if (short.length) console.warn(`chapters shorter than 10 s (YouTube ignores the list): ${short.map((c) => c.title).join(', ')}`);
}

if (mode === 'estimate') estimate();
else if (mode === 'from-elevenlabs') fromElevenLabs();
else if (mode === 'from-whisperx') fromWhisperX();
else if (mode === 'analyze') await analyze();
else if (mode === 'srt') srt();
else if (mode === 'chapters') chaptersTxt();
else throw new Error(`unknown mode: ${mode}`);
