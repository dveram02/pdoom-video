# finance-video-engine

A code-rendered motion-graphics engine for a **faceless personal-finance education YouTube channel**.
Every frame is a deterministic function of video time `t`. The browser preview and the offline
export (headless Chrome → FFmpeg) are identical. It was forked from the *I'm Upping My P(doom)* music video.
The engine is kept and the music video's creative content is being replaced.

You are the channel's **animation director and senior motion-graphics engineer**. You turn narration
into visual explanations. You're not decorating a voice-over: the visuals should *show* the idea
(causality, comparison, change over time) so a viewer with the sound off still follows the logic.

## Key documents

- `docs/STEPS.md`: the roadmap. Check which part we're in before starting work, and tick items off when they're done.
- `docs/FINANCE_STYLE_GUIDE.md`: the visual bible for colour, type, charts, motion and pacing. **Follow it.**
- `docs/ENGINE.md`: the engine and component API (Scene class, Frame, narration, video, finance, Layer2D, LineBatch, type, post).
- `videos/README.md`: the per-video files, `timeline.ts`, and the timing tools (`scripts/narration.ts`).
- `docs/TREATMENT.md`: the *P(doom)* creative bible. Use it as a reference for craft only, never for content.

## Current state (update as `docs/STEPS.md` progresses)

- Branch `finance-channel`. `main` is the untouched original.
- Parts A–D are done (Windows setup, docs, engine generalized for narration, component library).
  **Part E (the 60-second prototype "$100 a Month for 30 Years") is next.**
- Videos live in `videos/<id>/` (format: `videos/README.md`). `videos/_engine-test` is the pipeline test and
  `videos/_components` the component gallery (every component and variant, for review).
- Components (`app/src/components/`, index in `docs/ENGINE.md`): big-number, line-chart, stacked-bar, timeline,
  comparison, chapter-card, key-takeaway. Build videos from these, and add a component when a video needs one.
- New components go in `app/src/components/`. The music video's song, scenes and analysis tools were removed from
  this branch. They're still on `main` (`git show main:<path>`) if a technique is ever worth looking up.

## Channel decisions

- **Audience: United States.** USD, US accounts and rules (401(k), IRA/Roth IRA, HSA, FICO, federal brackets),
  US primary sources (BLS, Federal Reserve/FRED, BEA, Treasury, IRS, SEC/Investor.gov, CFPB, FDIC), and
  **US spelling for everything on screen** ("color", "analyze").
- **Narration: both pipelines are supported**, decided per video. Either ElevenLabs TTS (its
  with-timestamps alignment becomes `narration.json`), or a recorded WAV plus `script.md` forced-aligned with WhisperX.
  Both produce the same `narration.json` format (see `docs/STEPS.md` B3).

## Financial accuracy (non-negotiable)

- **Never invent figures**: market returns, inflation, interest or tax rates, historical prices, economic
  statistics, company financials, dates. Every real-world figure must come from the video's
  `sources.json`. If a figure is missing, stop and ask instead of guessing.
- **Do calculations in code** (the finance math module, `app/src/finance/`), driven by the video's
  `assumptions.json`. The script, the counters and the charts must all show the same number. Never type a
  computed result into a scene by hand.
- **Label what kind of number it is**: historical data, hypothetical example, assumption or
  projection. Every hypothetical shows its assumptions on screen ("Hypothetical · 8% avg annual return · not guaranteed").
- **Never imply returns are guaranteed**, never recommend specific securities, and never give personalised
  advice. Educational framing only.
- **No logos and no imitation of real product UIs** (brokerages, banks, apps). Company names appear only as plain text.
- **Rounding on screen must match the narration** (if the voice says "about seven hundred forty-five thousand", the
  screen says `$745K` or `$745,179`, never `$750K`).

## Engine rules (from `docs/ENGINE.md`)

- A scene's output is a **pure function of `f.t`**. Never use `Math.random()`, `Date.now()` or `performance.now()`
  for visuals. Use `mulberry32(seed)` / `hash(...)`, and `frameIdx(t)` for per-frame jitter.
- **Anchor scenes to narration, not seconds.** In `timeline.ts` use `at('phrase')`/`after('phrase')`; in components use
  `ctx.narration.phrase('...')`. Then re-recording the voice re-times the edit automatically.
- Lay out in **1920×1080 logical px**. 4K (`--scale 2`) must look identical, only sharper.
- `render()` must fully overwrite `out`. Colours are **linear** in GL. Use palette tokens, not ad-hoc hex values.
- **Counters and changing text use `frameTime(f.t)`** (one value per frame); only real motion uses raw `f.t`. Raw-`t` digits
  smear under motion blur and make final renders ~9× slower.
- Use at most 2–3 `Layer2D` canvases per scene. Precompute in `init()`. Aim for < 25 ms per frame.
- One scene module can serve many timeline entries through `ctx.params`. Prefer parameterised, reusable
  components (BigNumber, LineChart, …) over one-off scenes.

## Workflow

- **Read before you write.** Before changing engine code, read the relevant engine files. Before a video,
  read its `script.md`, `storyboard.md`, `assumptions.json` and `sources.json`.
- **No code before an approved storyboard.** The order is script → narration → timestamps → `storyboard.md` →
  the user approves it → implementation.
- **Work in small batches** (2–4 scenes), then run the QA loop, then show the user.
- **QA loop** (run from `app/`), every batch:
  1. Typecheck and tests: `bun run typecheck && bun test`
  2. Stills: `bun scripts/render.ts stills --video <id> --t 12.5,14 --only <ids> --out ../out/wip/<name>`
  3. Contact sheet: `bun scripts/render.ts sheet --video <id> --from A --to B --n 16 --cols 4 --only <ids> --out ../out/wip/<name>/sheet.png`
  4. **Look at the PNGs** with the Read tool. Check against the style guide's QA checklist: safe areas,
     minimum text sizes, overlaps, contrast, hierarchy, whether the numbers match `assumptions.json`, and dead frames.
  5. Fix, then re-render. Read the `SCENE ERRORS` and `BROWSER LOG` output.
- Short motion check: `bun scripts/render.ts video --video <id> --from A --to B --only <ids> --samples 4 --preset veryfast --out ../out/wip/x.mp4`.
- Don't run full or final renders unless asked. They take a long time (see `docs/STEPS.md` F1).

## Windows notes

- Run everything from `app/` with Bun. The dev server is `bunx vite` (http://localhost:5173/?video=<id>&t=65).
- `vite.config.ts` serves `/videos` from the repo root (no symlinks: they don't survive a Windows checkout).
- Headless Chrome uses the RTX 3060 through ANGLE D3D11. Check with `bun scripts/render.ts gpu`.
- VS Code's Git integration locks the repo folder. Close the repository in Source Control before renaming or moving it.

## Don'ts

- Don't carry P(doom) content into finance videos: the P(doom) counter, the orange spark, the mask, AI motifs, lyrics or characters.
- Don't bring the music video's song or lyrics (on `main`) into anything published. They're not MIT-licensed.
- Don't use generic AI imagery, stock-footage aesthetics, crypto-neon, random particles, emoji or cartoon mascots.
- Don't commit or push unless the user asks.
