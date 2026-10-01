# Finance Channel Video Engine — Steps

Goal: turn `pdoom-video` (a code-rendered music video), now `finance-video-engine`, into a reusable engine that produces
faceless, motion-graphics finance explainers for YouTube, built and iterated with Claude Code.

Pipeline we're building:

```
topic → research (sources.json) → script.md → narration.wav → word timestamps (narration.json)
      → storyboard.md → scenes + timeline → stills/contact sheets (QA) → draft render
      → final render (+ music/SFX mix) → thumbnail → upload
```

---

## Part 0 — What the ChatGPT plan got right, and what it missed

The ChatGPT chat is a good high-level plan. Its overall direction (keep the engine, drop the
P(doom) creative content, write a style guide, build reusable finance components, prototype a
60-second video before a full one) is correct, and its compound-interest numbers check out
($500/mo at 8%: $36,738 at year 5, $91,473 at year 10, $745,179 at year 30).

I compared it against the actual code. These are the problems it didn't mention:

| # | Issue | Why it matters | Fix (step) |
|---|---|---|---|
| 1 | **Everything in Stage 1 is already installed.** Bun 1.4.2, FFmpeg 9.0.2 with libx264, Chrome, Node 22, Git, Claude Code 2.1.285 and uv are all present. Your GPU is an RTX 3060 Laptop (6 GB). | Skip the install section. | — |
| 2 | **The symlinks are broken on Windows.** `app/public/audio` and `app/public/data` are symlinks in the repo, but `core.symlinks=false`, so they were checked out as 11-byte text files containing `../../audio`. | The preview can't load `data/*.json` or the audio, so it fails to boot. | A2 |
| 3 | **The renderer is hard-coded for macOS.** `render.ts` launches Chrome with `--use-angle=metal`, which is Mac-only. | Headless Chrome may fall back to software rendering (SwiftShader) or use the integrated GPU. A long video would take a very long time to render. | A3 |
| 4 | **The audio file and data loaders are hard-coded to the song.** `main.ts` loads `audio/pdoom.mp3`, `render.ts` muxes `audio/pdoom.mp3`, `Engine.duration` comes from `data/audio.json`, and the timeline expects `Lyrics` plus a beat grid. | You can't drop in a narration file. The engine needs a small "video project" abstraction. | C1–C3 |
| 5 | **"Sentence-level timing is enough" is wrong for this engine.** Its real strength is `ly.get('phrase')`: scenes are anchored to *words*, not hard-coded seconds. | With word timestamps, the counter can land on "$745,000" exactly as it's spoken, and re-recording the narration re-times the whole edit for free. Keep word-level timing. | B3, C2 |
| 6 | **The default post-processing is the P(doom) look:** film grain, halation, chromatic aberration, bloom, crop-mark HUD and the P(doom) readout. `-tune grain` in x264 also inflates the bitrate. | Finance charts need crisp, clean numbers, so this look has to be toned down globally. | C4 |
| 7 | **Only one audio track gets muxed.** There's no music or SFX bus. | Narration, music and SFX need to be mixed and loudness-normalized before the mux. | F2 |
| 8 | **The repos are nested.** `C:\Projects\Youtube` is a git repo on an *unborn* `finance-channel` branch with `pdoom-video/` untracked. `pdoom-video` itself is still on `main`. | This is confusing, and it's easy to commit to the wrong place. | A1 |
| 9 | **Monetization risk isn't mentioned.** YouTube's Partner Program penalizes "inauthentic" (mass-produced or repetitive) content. Finance is also a high-scrutiny topic. | A template engine makes it easy to ship look-alike videos, so each video needs real editorial substance. | G3 |
| 10 | **Render cost is underestimated.** A 7-minute video at 60 fps is about 25,000 frames, and `--samples auto` renders up to 324 sub-frames per frame. | Plan for segmented renders and draft settings. | F1 |

---

## Part A — Fix the Windows setup ✅ DONE (2026-10-01)

### A1. Git layout ✅
- [x] Folder renamed `pdoom-video` → **`C:\Projects\Youtube\finance-video-engine`**.
- [x] Work happens on the new **`finance-channel`** branch inside `finance-video-engine` (`main` = untouched original).
- [x] Deleted the empty outer repo (`C:\Projects\Youtube\.git`, no commits). This plan now lives in the
      engine repo as `docs/STEPS.md`, and per-video material goes in `videos/<id>/` (Part C1).
- Gotcha: VS Code's Git integration watches nested repos and locks the folder. Use
  Source Control → Close Repository before renaming or moving it.

### A2. Broken symlinks ✅
- [x] `app/vite.config.ts` has a small `root-assets` plugin that serves `/audio/*` and `/data/*`
      straight from the repo root, with byte-range support so `<audio>` can seek. No symlinks, junctions or
      Developer Mode needed, and it survives folder renames.

### A3. GPU ✅
- [x] `render.ts` picks the ANGLE backend per platform: Metal on macOS,
      `--use-angle=d3d11 --force_high_performance_gpu` on Windows.
- [x] `bun scripts/render.ts gpu` → `ANGLE (NVIDIA GeForce RTX 3060 Laptop GPU … Direct3D11)`.

### A3b. Windows bugs found and fixed in `render.ts` ✅
- [x] Bun on Windows throws `EEXIST` from `mkdirSync(relative, {recursive:true})` when the folder exists:
      added a `mkdirp()` helper that resolves the path first (this broke `sheet` and re-runs of `stills`).
- [x] The render's private Vite server was left running after every render (`proc.kill()` only kills
      `bunx`, not its `node` child): it now uses `taskkill /T /F` on Windows.

### A4. Smoke test ✅ (P(doom) scenes = worst case; finance chart scenes will be much lighter)
| Test | Result |
|---|---|
| Preview server: data, audio, fonts, Range | ✅ (only 404 is `favicon.ico`) |
| `stills` ×3 | ~4.5 s |
| `sheet` 16 frames | ~20 s, every scene renders correctly |
| `perf` 1 sample/frame | ~100–280 ms/frame |
| `perf --samples auto --shutter 0.2` (heavy section) | ~3 s/frame avg (12–324 sub-frames) |
| `video` 5 s @ `--samples 4 --preset veryfast` | 1080p60 H.264 + AAC, 130 s (2.3 fps) |
| Typecheck (`tsconfig.json`, `tsconfig.scripts.json`) | ✅ clean |

---

## Part B — Channel foundations (docs, no code)

### B1. Create `CLAUDE.md` at the repo root ✅ (draft v1, 2026-10-01; review it)
This is the "persistent project instruction file" the ChatGPT chat described. Claude Code loads it
automatically every session. Include:
- **Role:** animation director and motion-graphics engineer for a faceless finance channel.
- **Financial accuracy rules:** never invent statistics; every fact comes from `sources.json`;
  calculations are done in code; label hypotheticals, assumptions and projections; never imply
  returns are guaranteed.
- **Engine rules** (from `docs/ENGINE.md`): scenes are pure functions of `f.t`; no `Math.random()`,
  `Date.now()` or `performance.now()`; use `mulberry32`/`hash`; use `frameIdx(t)` for per-frame
  jitter; anchor scenes to narration phrases, never to hard-coded seconds.
- **QA loop:** typecheck → render stills/contact sheet → *look at the PNGs* → fix → repeat.
  Work in small batches (2–4 scenes at a time).
- **What not to carry over:** the P(doom) counter, the orange spark, the mask, AI motifs, lyrics and characters.

### B2. Write `docs/FINANCE_STYLE_GUIDE.md` (replaces `TREATMENT.md` as the creative bible) ✅ (draft v1; palette validated for colour-blindness and contrast; review it)
Have Claude draft it, then you edit it. Lock in the following:
- **Palette.** Map it onto `engine/palette.ts`, which currently has ink/bone/signal/ember/acid. For example:
  ink `#090A0C`, bone `#F4F4F2`, ash `#9297A0`, gain green, loss red, accent gold.
  Use red and green **only** for gain/loss semantics.
- **Typography.** The fonts already in the repo suit finance well: **Archivo** for headings
  (with width axes), **IBM Plex Mono** for numbers and tickers, **Cormorant** for quotes. Use
  tabular figures for numbers that count up.
- **Number formatting:** `$1,234`, `$1.2M`, `8.0%`, negatives as `−$500` (true minus sign).
- **Chart rules:** axis style, gridlines, label sizes (minimum readable on a phone),
  1920×1080 safe areas, and a source line position (bottom-left, small).
- **Motion:** charts draw in, counters ease, objects morph into the next scene, the camera
  pushes in. Something should develop visually every 3–8 seconds, which doesn't always mean a cut.
- **Post look:** low or zero grain, no CA, no halation, light vignette, subtle bloom only on accents.
- **Avoid:** generic AI imagery, crypto neon, random particles, stock-footage look, cartoon characters.

### B3. Narration and timestamp tool ✅ (decided 2026-10-01)
- [x] **Audience: United States**: USD, US accounts and rules, US primary sources, US spelling on screen (recorded in `CLAUDE.md`).
- [x] **Voice: support both, decided per video.** One output format, two ways in:
  - **Path 1, ElevenLabs TTS:** generate with the *with-timestamps* endpoint and keep its character alignment JSON →
    `scripts/narration.ts from-elevenlabs` builds `narration.json`. No Whisper needed. Needs a paid plan for
    monetized use. Check YouTube's synthetic-content disclosure rules at upload.
  - **Path 2, own voice:** record `narration.wav` (48 kHz, mono, quiet room) plus `script.md` →
    **WhisperX forced alignment against the script text**, not free transcription, so the words match the script
    exactly. Reuse the uv setup in `analysis/` (adapt `whisper_run.py` / `ctcalign.py`).
- [ ] Build both converters as part of **C2** (to be done then, not now). Output in the **same shape as `data/lyrics.json`**
      (`lines[] → {text,start,end,words[{w,start,end}]}`, one line per sentence), so the `Lyrics` helpers
      (`get`, `wordProgress`, `lineCharProgress`) work unchanged.
- [ ] Also from `narration.json`: an **SRT captions file** for the upload (G1).

---

## Part C — Generalize the engine (Claude Code, one PR)

Prompt Claude to *read first and change nothing*. The ChatGPT "first prompt" works as-is.
Then have it implement the following.

### C1. Add a video project folder and loader
```
videos/
  000-prototype-100-a-month/
    video.json        # { title, audio: "narration.wav", music?, fps, ... }
    script.md
    sources.json
    assumptions.json  # every number used in the video (single source of truth)
    narration.wav
    narration.json    # word timestamps (lyrics.json format)
    storyboard.md
    timeline.ts       # this video's edit
    mix.wav           # generated: narration + music + sfx (F2)
```
- [ ] Select the video with `?video=000-prototype-100-a-month` in the preview and `--video <id>` in `render.ts`.
- [ ] Remove the hard-coded `audio/pdoom.mp3` from `main.ts` and `render.ts`.
      `Engine.duration` should come from the narration (plus an outro tail).
- [ ] Serve `videos/` through Vite. The `vite.config.ts` `fs.allow` already permits the repo root.
      Use a Vite alias or middleware rather than more symlinks.

### C2. Replace "song" concepts with "narration" concepts
- [ ] `Lyrics` loads `narration.json`; add a `Narration` alias.
- [ ] Make `AudioData` beats and sections **optional**. Generate a minimal `audio.json` for each video:
      duration plus an RMS/voice envelope. Scenes like a "speaking" pulse can still use `f.a.vocal`.
      Leave `beat`/`bar` at 0 when there's no grid.
- [ ] Timeline helpers: `at('phrase')` → the start of the phrase's first word; `atWord('phrase', i)`; `after('phrase')`.
      Then edits look like `E('growth', 'LineChart', at('If you invested'), at('Now compare'))`.

### C3. Remove the P(doom) layer from the engine
- [ ] The HUD no longer depends on `PDoom`. Replace the HUD with an optional
      **source/citation line** and a **disclaimer chip** ("Hypothetical example · not financial advice").
- [ ] Move the P(doom) scenes out of the build (`scenes/_pdoom/` or delete them on this branch) and keep
      them on `main` for reference. The ChatGPT advice "don't delete immediately" is right; using a branch handles it.
- [ ] Remove `audio/pdoom.mp3`, `lyrics/` and `data/lyrics.json` from this branch. Their license is
      **not** MIT, and they must never end up in a video you publish.

### C4. Finance post-processing preset
- [ ] New `DEFAULT_POST` values: grain ~0–0.01, `ca: 0`, `halation: 0`, vignette ~0.15, bloom low,
      HUD crop marks off.
- [ ] Change `render.ts`: replace `-tune grain` with `-tune animation`, or make it a flag.
      This gives smaller files and sharper text.

### C5. Finance math module (`src/finance/`)
- [ ] `futureValue`, `annuityFV` (monthly contributions), `amortization`, `inflationAdjust`, `cagr`,
      plus yearly series generators for charts.
- [ ] Number formatters that follow the style guide.
- [ ] **Unit tests** (`bun test`) covering the known values above, e.g. $500/mo at 8% for 10y gives $91,473.
- [ ] Scenes read their parameters from `assumptions.json` and call this module, so the script, the counters
      and the chart all show the same number.

---

## Part D — Component library (build 5 first)

Each component is a `Scene` class driven by `ctx.params`, so one module serves many timeline entries.
Build them in this order, with stills and contact sheets reviewed after each:

1. **BigNumber / Title.** A huge counter or reveal ("$100", "10 YEARS") with a label and a subtitle.
2. **LineChart.** Draw-in series, multiple lines (Sarah vs Michael), animated axes, end labels.
   Use `lines.ts` `LineBatch` for crisp lines.
3. **BarChart / StackedBar.** Contributions vs growth, built over time.
4. **Timeline.** Ages and years, with markers that drop in on a word cue.
5. **Comparison.** A two-column face-off with a delta callout.

Later (from the ChatGPT list): MoneyFlow, DebtPaydown, InflationComparison, PortfolioAllocation,
MarketDrawdown, CalculatorScene, KeyTakeaway, Outro/subscribe card.

Reuse ideas, not visuals, from the existing scenes. Good references for techniques:
`ascent-odo.ts` (odometer counter), `leftturn-gantt.ts` (timeline/gantt),
`stack-kit.ts`, `dense-press.ts` (typography and layout), and `_motifs.ts` (pattern for shared motifs).

Also add **object continuity** transitions (`handlesTransition = true`, compositing `f.under`) so a
"$100" can become a bar, which becomes a curve. That kind of transition is what makes these videos look high-end.

---

## Part E — 60-second prototype: "$100 a Month for 30 Years"

- [ ] `assumptions.json`: $100/mo, 8% annual (hypothetical, stated on screen), monthly compounding, 30y.
- [ ] `script.md`: about 150 words. Use the ChatGPT storyboard as the outline:
      hook → $100/month deposits → timeline → contributions ($36,000) vs growth → compounding loop → final → "time is the multiplier".
- [ ] Record or generate `narration.wav` → `narration.json`.
- [ ] Ask Claude to write `storyboard.md` (timestamp, narration, visual, animation, transitions,
      data, on-screen text). **Approve it before any code gets written.**
- [ ] Implement it in 2–3 batches. After each batch, render a contact sheet, have Claude review the PNGs, then fix.
- [ ] Draft render, watch it at full screen **and on your phone**.
- [ ] Write down everything that was painful. Fix it in the engine before the first full video.

---

## Part F — Rendering and audio

### F1. Render settings
| Purpose | Command (from `app/`) |
|---|---|
| Scene check | `bun scripts/render.ts sheet --from 60 --to 80 --n 16 --cols 4 --only <ids> --out ../out/wip/sheet.png` |
| Spot stills | `bun scripts/render.ts stills --t 61.5,70 --only <ids> --out ../out/wip` |
| Fast draft | `bun scripts/render.ts video --fps 30 --samples 1 --preset veryfast --out ../out/draft.mp4` |
| Final 1080p60 | `bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/final.mp4` |
| Final 4K (later) | add `--scale 2 --crf 18 --x264 aq-mode=3:rc-lookahead=30` |

- Render long videos **in segments** (`--from/--to`, for example 60 s each), then losslessly concat:
  `ffmpeg -f concat -safe 0 -i list.txt -c copy final.mp4`. That way one crash doesn't cost you hours.
- Finance motion graphics are mostly calm, so `--samples auto` will usually settle at 12–36 sub-frames.
  Use `perf` (A4) to estimate the total time.
- Stay at 1080p until the look is locked. Consider 4K once your laptop's 4K timings are known
  (6 GB VRAM may be tight).

### F2. Audio mix (new script: `scripts/mix.ts`, wraps ffmpeg)
- Narration (primary), music bed ducked under the voice (sidechain or roughly −20 to −25 dB relative), SFX at about −15 to −20 dB.
- Normalize the final mix to about **−14 LUFS integrated, −1 dBTP** (YouTube's playback target) with `loudnorm`.
- `render.ts` muxes `mix.wav` instead of the song.
- Music and SFX must be **licensed for YouTube monetization** (YouTube Audio Library, Epidemic, Artlist, etc.).
- SFX cue points come from the same timeline (e.g. a tick per counter step), so that also stays deterministic.

---

## Part G — Publishing

### G1. Per-video checklist
- [ ] Every number on screen traces back to `assumptions.json` or `sources.json`.
- [ ] Hypotheticals are labeled on screen ("Hypothetical · 8% avg annual return, not guaranteed").
- [ ] There's a disclaimer in the video and in the description ("Educational only, not financial advice").
- [ ] The description sources list is generated from `sources.json`.
- [ ] Chapters come from the storyboard sections (timestamps in the description).
- [ ] Captions: upload an `.srt` generated from `narration.json`. It's free accuracy and helps SEO.

### G2. Thumbnail
A separate design task. It can reuse engine stills (`stills` mode at a hero moment) plus bold
text, or be built in Canva.

### G3. Platform policies
- **Altered/synthetic content disclosure:** if you use an AI voice, check YouTube's current
  disclosure rules when uploading. Animated charts are clearly not "realistic" footage, but a realistic
  cloned voice of a real person would need disclosure.
- **Inauthentic/mass-produced content (YPP):** vary the structure, add original analysis and examples,
  and don't publish lightly reskinned templates. The engine is meant to save time on animation, not on thinking.

---

## Part H — Production loop per video (once the engine is built)

1. Pick a topic → research → `sources.json`
2. `script.md` (900–1,100 words ≈ 7 min) plus `assumptions.json`
3. `narration.wav` → `narration.json` (word timestamps)
4. Claude: "Read script + style guide + narration.json → create storyboard.md". **You approve it.**
5. Claude: implement scenes in batches of 3–4 → contact sheet → review → fix
6. Draft render (30 fps, 1 sample) → watch → revision notes with timestamps (`?t=65`)
7. `mix.wav` → final segmented render → concat
8. Thumbnail, title, description (sources, chapters, disclaimer), captions → upload

Suggested first full-length topics, in order of visual simplicity: *How Compound Interest Actually Works*,
*$10,000 at 20 vs 30 vs 40*, *Why Minimum Credit Card Payments Keep You in Debt*, *Why Cash Loses Value*.

---

## Immediate next actions

1. ~~**A1–A4**: fix the git layout, symlinks and GPU flag, then smoke-test.~~ ✅ Done and committed on `finance-channel`.
2. ~~**B1–B2**: `CLAUDE.md` and `FINANCE_STYLE_GUIDE.md`.~~ ✅ Drafted. Review and edit them.
3. ~~**B3**: decide on your voice and timestamp tool.~~ ✅ US audience. Both ElevenLabs and own voice are supported.
4. **C1–C5**: engine generalization, as one reviewed change.
5. **D**: the first 5 components → **E**: the 60-second prototype.
