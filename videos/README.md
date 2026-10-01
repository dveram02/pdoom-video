# videos/

One folder per YouTube video. The engine (`app/`) renders one video at a time:

- **Preview:** `cd app; bunx vite`, then open http://localhost:5173/?video=<id> (`&t=65` seeks).
  Without `?video=`, the first video in this folder opens (ids starting with `_` sort last).
- **Render:** `bun scripts/render.ts <mode> --video <id> …` (from `app/`; see `docs/STEPS.md` F1).

Name folders `NNN-short-slug` (`001-compound-interest`). `_`-prefixed folders are tests or scratch work.

## Files in a video folder

| File | Made by | What it is |
|---|---|---|
| `video.json` | you | `{ "title", "audio"?, "mix"?, "tail"?, "duration"? }`. `audio` is the voice file and `mix` the final mix (preferred). Both are relative to the folder. |
| `script.md` | you + Claude | The narration. `# Title`, then `## Section` headings (these become **chapters**) and paragraphs of spoken text. `> lines` are notes and `[brackets]` are stage directions; neither is spoken. |
| `sources.json` | you + Claude | `[{ id, organization, title, url, accessed, note? }]`. Every real-world figure in the video cites one. |
| `assumptions.json` | you + Claude | Every number the video computes from (rates, amounts, years). Scenes read it through `ctx.video.assumptions`. |
| `storyboard.md` | Claude, you approve it | Scene-by-scene plan: narration, visual, animation, data, on-screen text. **No code before it's approved.** |
| `narration.wav` / `.mp3` | you / TTS | The voice. **Not in git** (see `.gitignore`), so back it up. |
| `narration.json` | `scripts/narration.ts` | Word timings (one line per sentence) plus chapters. What the edit is anchored to. |
| `audio.json` | `narration.ts analyze` | Duration and a loudness envelope of the audio (`f.a.rms`/`f.a.vocal` in scenes). Optional. |
| `timeline.ts` | Claude | The edit: which component plays when, anchored to phrases. |
| `captions.srt`, `chapters.txt` | `narration.ts srt` / `chapters` | For the YouTube upload. |

## Timings: three ways to make `narration.json`

Run all of these from `app/`.

```sh
# 1. No audio yet: estimate from script.md (≈155 wpm) to build and preview the edit before recording
bun scripts/narration.ts estimate --video <id> [--wpm 155]

# 2. ElevenLabs TTS: save the full response of the text-to-speech *with-timestamps* endpoint as <name>.tts.json
bun scripts/narration.ts from-elevenlabs --video <id> --in ../videos/<id>/voice.tts.json --audio-out narration.mp3

# 3. Your own voice: record narration.wav, run WhisperX (forced alignment to the script works best)
#    and save its JSON as <name>.whisperx.json. Words it can't time (numbers) are interpolated.
bun scripts/narration.ts from-whisperx --video <id> --in ../videos/<id>/narration.whisperx.json
```

Then set `"audio"` in `video.json` and run `bun scripts/narration.ts analyze --video <id>`. Because the edit is
anchored to phrases, re-timing doesn't break the timeline: the cuts move with the voice.
For the upload, also run `srt` and `chapters`.

**Write numbers the way they're spoken in `script.md`** when using your own voice ("one hundred dollars", not
"$100"). Alignment then matches every word. For TTS either form works, because the timings come back for the text you sent.

## `timeline.ts`

```ts
import type { MakeTimeline } from '@engine/timeline';

const timeline: MakeTimeline = ({ E, at, after, duration, video }) => {
  const growth = at('Imagine putting');            // 0.1 s before the phrase is spoken
  return [
    E('intro', 'title-card', 0, growth, { title: video.meta.title }),
    E('growth', 'line-chart', growth, duration, { key: 'hundredAMonth', landOn: 'After thirty years' }, {
      note: 'Hypothetical · 8% avg annual return · not guaranteed',   // HUD small print while on screen
      source: 'U.S. BLS, CPI-U 1990–2025',
    }),
  ];
};
export default timeline;
```

- `E(id, component, start, end, params?, extra?)`: `component` is a module in `app/src/components/`,
  `params` arrive as `ctx.params`, and `extra` takes `note`, `source`, `post`, `maxSamples`.
- `at(phrase, {nth, lead})`, `after(phrase, {nth, pad})`, `phrase(q)`, `sentence(q)`: phrases match whole words
  in order, ignoring case and punctuation, and throw if they aren't found (so a script edit that breaks a cue fails loudly).
- Windows that overlap crossfade by default. Windows that touch are hard cuts.
