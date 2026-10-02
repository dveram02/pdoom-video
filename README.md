# finance-video-engine

A code-rendered motion-graphics engine for a faceless personal-finance education YouTube channel. Each video
is narration plus animated charts, counters and diagrams, built as code with Claude Code. Every frame is a
deterministic function of video time, so the browser preview and the offline 1080p60/4K export are identical.

It's a fork of [*I'm Upping My P(doom)*](https://www.youtube.com/watch?v=5EoO5413dBY), a code-rendered music video
made with Claude (see [Credits](#credits)). The engine is kept: renderer, typography, post-processing and adaptive
motion blur. The music video's creative content is being replaced.

- **Plan / roadmap:** [`docs/STEPS.md`](docs/STEPS.md)
- **Look:** [`docs/FINANCE_STYLE_GUIDE.md`](docs/FINANCE_STYLE_GUIDE.md)
- **Engine and component API:** [`docs/ENGINE.md`](docs/ENGINE.md)
- **Per-video files and the timing tools:** [`videos/README.md`](videos/README.md)
- **Instructions for Claude Code:** [`CLAUDE.md`](CLAUDE.md)

## Layout

- `videos/<id>/`: one folder per video (`video.json`, `script.md`, `assumptions.json`, `sources.json`,
  `narration.json`, `timeline.ts`, …). Audio files are not in git.
- `app/`: the renderer (TypeScript + three.js, Bun + Vite).
  - `src/engine/`: core (video loading, narration timings, playback, post, typography, GPU lines, HUD).
  - `src/components/`: reusable, parameterised scenes (BigNumber, LineChart, …) that videos place on their timeline.
  - `src/finance/`: finance maths and number formatting (tested: `bun test`).
  - `scripts/render.ts`: offline renderer (headless Chrome → raw frames → FFmpeg).
  - `scripts/narration.ts`: word timings (estimate from the script, ElevenLabs, WhisperX), audio analysis, captions, chapters.

The music video's song, scenes and Python analysis tools aren't on this branch. They're on `main`.

## Requirements

[Bun](https://bun.sh), Google Chrome (driven headless through playwright-core) and FFmpeg with libx264.
Tested on Windows 11 (RTX 3060, ANGLE D3D11) and originally on macOS.

## Quick start

```sh
cd app
bun install
bun run typecheck && bun test
bun scripts/narration.ts estimate --video _engine-test     # timings from the script (no audio needed)
bunx vite                                                  # http://localhost:5173/?video=_engine-test
bun scripts/render.ts sheet --video _engine-test --from 0 --to 24 --n 12 --out ../out/sheet.png
bun scripts/render.ts video --video _engine-test --samples 4 --preset veryfast   # → out/_engine-test.mp4
```

Preview keys: space = play/pause · ←/→ = ±1 s (shift ±5 s) · `,`/`.` = one frame · `[`/`]` = previous/next entry ·
`l` = loop entry · `h` = hide UI. `?t=23` starts at a time, and `&scale=2` previews 4K.

Final render: `bun scripts/render.ts video --video <id> --samples auto --shutter 0.2` (add `--scale 2` for true 4K).
See "Motion blur and sampling" and "Output scale" in [`docs/ENGINE.md`](docs/ENGINE.md).

## Credits

- **Original engine:** the *I'm Upping My P(doom)* music video, made with Claude (Opus 5.5) in Claude Code. Its song
  "I'm Upping My P(doom)" has lyrics by [osmarks](https://docs.osmarks.net/hypha/p%28doom%29_song_objectively_correct_interpretation),
  built on an opening verse and chorus by [MusicPerson](https://www.udio.com/creators/MusicPerson), with the "Claude-Pop"
  version by [deckard (@slimer48484)](https://x.com/slimer48484/status/2097752569212756134). The song and lyrics aren't
  used by this engine and aren't covered by its license.
- **Fonts:** Archivo, IBM Plex Mono and Cormorant Garamond (SIL Open Font License). Single-stroke EMS and Hershey
  fonts via the `hersheytext` package (OFL / public domain).

## License

The code is released under the [MIT License](LICENSE). The fonts in `app/public/fonts/` keep their own licenses.
