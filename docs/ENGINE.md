# Engine guide (for component authors)

The engine is a web app (`app/`, TypeScript + three.js, run with bun + Vite) that renders any video time `t` of one video project (`videos/<id>/`, see `videos/README.md`) deterministically at 1920×1080 (or at 2× that, 3840×2160, with `?scale=2`; see "Output scale" below). The same code drives the live preview and the offline 60 fps export.

## Running things

- Dev server (probably already running): `cd app && bunx vite --port 5173`. Preview: http://localhost:5173/?video=<id>&t=23.0 (space = play/pause, ←/→ = ±1 s, shift = ±5 s, `,`/`.` = ±1 frame, `[`/`]` = previous/next timeline entry, `l` = loop the current entry, `h` = hide the UI).
- Stills (the main way to check your work — then LOOK at the PNGs with the Read tool): `cd app && bun scripts/render.ts stills --video <id> --t 12.5,13.0,14.2 --only intro --out ../out/wip/intro`. Every mode takes `--video <id>` (default: the first video).
- Contact sheet of a time range: `bun scripts/render.ts sheet --video <id> --from 1.5 --to 9 --n 16 --cols 4 --only intro --out ../out/wip/intro/sheet.png`
- Short video clip (to judge motion: extract frames with ffmpeg, or just trust the math): `bun scripts/render.ts video --video <id> --from 20 --to 25 --only growth --out ../out/wip/growth.mp4 --preset veryfast` (muxes the video's `mix`/`audio` from `video.json`; silent if it has none)
- `--only a,b` loads only those timeline entries (fast, and isolates you from broken components). Without a matching entry nothing renders (black), so the entry must exist in the video's `timeline.ts`.
- Typecheck just your files: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep components/yourcomponent` (`bun run typecheck` checks everything, `bun test` runs the finance tests).
- The render script prints `SCENE ERRORS` and browser console errors — read them.
- 4K: add `--scale 2` to any mode (`stills` then saves full-resolution 3840×2160 PNGs). Check your scene at both scales: downscaled, the 4K frame should look like the 1080p one, only sharper.
- Renders while files are being edited: run a server without live reload (`FVE_NO_HMR=1 bunx vite --port 5190`) and pass `--url http://localhost:5190`; a live-reloading server reloads the page mid-render. The private server that `render.ts` starts when none is reachable already runs without it.

## Data

- `video` (`src/engine/video.ts`, `ctx.video`): `id`, `meta` (video.json), **`assumptions`** (assumptions.json: the numbers to compute from), `sources` (sources.json), `duration`.
- `narration` (`src/engine/narration.ts`, `ctx.narration`): `lines[]` (one per sentence) with `text,start,end,words[]`, each word `{w,start,end}`, plus `chapters[]` (from the `## headings` in script.md). Anchor to what is said, never hard-code times: `narration.phrase('five hundred dollars').start` (whole words in order, ignoring case and punctuation; across sentences), `narration.get('compound interest')` (the sentence containing it), `narration.chapter('The time advantage').start`. Helpers: `Narration.wordProgress(word, t)` (0..1 spoken progress), `Narration.lineCharProgress(line, t)`, `findWords('$500')`, `lineAt(t)`, `lastWord(t)`.
- `audio` (`src/engine/audio.ts`, `ctx.audio`): `env('rms'|'vocal', t)` (0..1 loudness of the voice, from `narration.ts analyze`; 0 when the video has no audio.json). The beat grid (`beats`, `beatAt`, ...), sections and onsets are empty for narration (kept from the music-video origin).
- Every `Frame` carries `f.a` (`rms`, `vocal` ...; the music fields read 0) and `f.beat`/`f.bar` (0 without a beat grid).
- Finance maths and formatting (`src/finance/`): `growthSeries`, `annuityFV`, `futureValue`, `valueAt` (a series at a fractional year: what a counter shows while a line draws), `loanPayment`, `amortize`, `minimumPayment`, `realValue`, `cagr`, `doublingYears`; `usd(v, {compact, sign, cents})`, `pct`, `pts`, `num`, `mult`, `years`. **Compute every number from `ctx.video.assumptions`; never type a result into a scene.**

## Writing a scene

One file `app/src/components/<name>.ts`, default-exporting a class extending `Scene` (`src/engine/scene.ts`). Components are reusable and parameterised (`ctx.params`); a video's `timeline.ts` places them (`E(id, '<name>', start, end, params)`):

```ts
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H, clearRT } from '../engine/gl';

export default class MyScene extends Scene {
  bg = new FSPass(`uniform float t; void main(){ fragColor = vec4(C_INK, 1.0); }`, { t: { value: 0 } });
  text = new Layer2D();
  async init() { /* build geometry, precompute text outlines, etc. */ }
  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, narration, video } = this.ctx;
    this.bg.u.t!.value = f.t;
    this.bg.render(renderer, out);            // fullscreen shader → out (overwrites)
    const c = this.text.ctx; this.text.clear(); /* draw with Canvas2D */
    comp.draw(renderer, this.text.upload(), out); // alpha-over onto out
    return { bloom: 0.7 };                   // post overrides (optional)
  }
}
```

Rules:

- **Deterministic**: output must be a pure function of `f.t` (and seeded randomness: `mulberry32(seed)`, `hash(...)`). Never use `Math.random()`, `Date.now()` or `performance.now()` for visuals. The export averages many sub-frames per frame, in any order (see "Motion blur and sampling"). If you need simulation state (particles, feedback buffers), set `stateful = true`, reset in `reset()`, integrate with `f.dt`, and the engine will fast-forward after seeks; such a scene can only be exported with a fixed `--samples`.
- `render()` must fully overwrite `out` (a HalfFloat linear-HDR target). Colours are **linear**; values > ~0.85 bloom. Use the palette tokens of `docs/FINANCE_STYLE_GUIDE.md` §2 (`C_INK`, `C_BONE`, `C_GOLD`, `C_GAIN`... in GLSL; `LIN.gold` in TS for GL; `rgba('gold', a)` for Canvas2D; `SERIES` is the fixed series order). Only gold highlights should exceed ~0.9 linear (bloom).
- `ctx.params` holds the timeline entry's params (one module can serve several entries); `ctx.start/ctx.end` its window; `f.lt`/`f.p` local time/progress.
- Transitions: by default the engine crossfades overlapping entries. For custom transitions set `handlesTransition = true` and composite `f.under` (the previous scene's frame) yourself using `f.tin` (0→1 over the overlap). Most cuts should be hard cuts on downbeats (no overlap) — that's the default when windows touch.
- Post overrides you can return: `exposure, bloom, bloomThreshold, bloomKnee, bloomRadius, halation, ca, grain, vignette, hud (HUD opacity), paper (light scene: HUD in ink), fade, flash, shake:[x,y], zoom, invert`. Defaults (the finance preset: no halation or CA, minimal grain) in `src/engine/post.ts`.
- Performance: aim for < 25 ms/frame (measure with `bun scripts/render.ts perf --video <id> --from A --to B`). A Canvas2D layer upload costs ~1 ms on Windows/D3D11 now that layers are RGBA8 textures decoded in the shader (an sRGB texture format cost ~29 ms). Don't use more than 2–3 layers per scene. Precompute in `init()`. A custom shader that samples a `Layer2D` texture must decode it with `toLinear()` (`isSRGBEncoded(tex)` in `gl.ts`); the Compositor does this already.
- Keep component helpers next to the component (`components/<name>-*.ts`), or in a shared module when two components need them.

## Toolbox

- `gl.ts`: `FSPass(frag, uniforms)` fullscreen GLSL3 pass (has `vUv`, writes `fragColor`, gets `GLSL_COMMON`), `Compositor` via `this.ctx.comp.draw(renderer, tex, target, {mode:'normal'|'add'|'screen'|'multiply'|'max', opacity, tint, scale, offset})`, `Layer2D` (1920×1080 logical Canvas2D → sRGB texture), `makeRT()` (screen-sized HDR target; `makeRT(w, h)` takes logical px), `clearRT(renderer, rt, [r,g,b])`, `SCALE`/`PW`/`PH` (output scale and physical size).
- `glsl/common.ts` (`GLSL_COMMON`, prepended to FSPass; import it into your own ShaderMaterials): palette consts, `hash*`, `snoise(vec2|vec3)`, `fbm`, `curl2`, 2D/3D SDFs, `smin`, `aaFill`, `aaStroke`, **`hatch(u, darkness)` and `engrave(uv, darkness, freq, angle)`** for engraving-style shading, `heat(x)` orange ramp, `toSRGB/toLinear`.
- `lines.ts`: `LineBatch(capacity, {screen2D, worldWidth, blend})` — GPU capsule segments, 2D pixels (y down) or 3D with a camera. `seg2`, `seg`, `polyline`, `render(renderer, out, camera?)`. Colours linear, can exceed 1 for glow. Good for 10k–200k segments.
- `type.ts`: fonts. `F.archivo(width 62–125, weight 300–900)` (grotesk with width steps 62/75/87.5/100/112.5/125), `F.archivoItalic()`, `F.serif(weight, italic)` (Cormorant Garamond), `F.mono(weight, italic)` (IBM Plex Mono). `font(family, px)` → CSS font string. `layout(text, family, size, tracking)` → per-glyph x/advance with the font's kerning (draw glyph i at `glyphs[i].x`). `glyphX(text, i, family, size)` → where to start drawing `text[i..]` when a word is drawn in pieces (sung/unsung colours, wipes); never offset a piece by `measure(text.slice(0, i))`, which drops the kern between the pieces. `fitSize`, `measure`, `textPath2D` (opentype outline as Path2D), `textPathCommands`, `textPoints(text, family, size, step)` (points filling the glyphs — "text made of atoms"). `smart(s)` / `plain(s)`: typewriter quotes → typographic (’ “ ” …) and back.
- `stroke.ts`: single-stroke plotter/engraving fonts (`script`, `hscript`, `sans`, `readable`, `tech`, `serif`, `osmotron`, `felix`): `strokeText(text, font, size, tracking, kern)`, `drawStrokeText(ctx2d, st, lengthPx)` → returns pen head position, `writtenLength(st, charTimes, t)` to sync writing to word timings. The fonts have no kerning tables: pairs that leave a hole (To, Yo, We, AV, LT…) are kerned optically from the glyph shapes (off for the connected scripts).

## Typography

- Proportional text gets the font's kerning: whole strings through Canvas2D get it for free; glyph-by-glyph drawing must use `layout()` / `glyphX()`. Adjacent runs in different fonts or sizes have no kerning between them: set that gap by eye.
- Narration text comes with typographic punctuation (`don’t`, `“Just`): `Word.w` and `Line.text` go through `smart()`; `narration.get()` matches straight or curly quotes. Hardcoded display strings use ’ “ ” … – — × − too. Mono text (IBM Plex Mono) keeps typewriter quotes (`plain()`).
- **Numbers that count** use `F.num(width, weight)` (Archivo with tabular figures, drawn with `fillText`) or Plex Mono, so the digits don't jitter. Format them with `src/finance/format.ts`.
- No outlined or haloed type.
- `util.ts`: `clamp, lerp, remap, smoothstep, ease.*, prog(x,a,b,ease), keys(t, [[t,v,ease],...]), springStep, pulse, mulberry32, hash, noise1/2/3, fbm1/2, polylineLengths, pointAtLength, window01`.
- `hud.ts`: the global HUD: the small print of the timeline entry on screen (`note` = the hypothetical/assumption line, `source` = `SOURCE: ...`), bottom-left on the title-safe margin (`SAFE` = 96 px). Hide it with `post.hud = 0`; `post.paper = 1` draws it in ink.

## Output scale (4K)

`?scale=2` (render.ts `--scale 2`) renders a true 3840×2160 frame. Scenes keep laying out in logical 1920×1080 px (`W`, `H`, `ctx.W`, `ctx.H` never change); the engine handles the rest:

- Render targets: `out`, the engine's targets and `makeRT()` are physical (`PW`×`PH`). `makeRT(w, h)` takes logical px and allocates `w*SCALE`×`h*SCALE`; pass `{ pxScale: 1 }` for a data-sized target whose resolution must not follow the output.
- `Layer2D`: the backing canvas is `SCALE`× larger and its context is pre-scaled, so drawing code works in logical px. `setTransform`/`resetTransform`/`getTransform`, `shadowBlur`, `shadowOffsetX/Y` and `filter` px lengths are patched to stay logical. Not patched: `canvas.width/height` and `getImageData`/`putImageData` are physical px, and `drawImage(layer.canvas, x, y)` needs an explicit size. `new Layer2D(w, h, 1)` makes a deliberately low-res layer (e.g. a soft glow). `scaleContext2D(ctx, SCALE)` applies the same patch to your own canvas.
- `LineBatch`: coordinates and widths stay logical; the AA feather and the hairline floor work in physical px, so hairlines stay crisp.
- GLSL (`GLSL_COMMON`): `gl_FragCoord`, `fwidth` and `dFdx` are physical. Use `FRAG_PX` (the fragment position in logical px) instead of `gl_FragCoord.xy` whenever it is combined with logical sizes, and `PX_SCALE` to convert. A line whose width comes from `fwidth` ("a 1.2 px hairline": `1.0 - smoothstep(a, b, d / fwidth(u))`) gets thinner and fainter at 4K: write it as `pxLine(d, a, b)`, which is identical at 1× and keeps the 1× ink with sharper edges at 4K (`rampLine` does the same for the linear-ramp idiom). `hatch`, `engrave` and `aaStroke` already do this. LOD thresholds and supersampling offsets expressed in pixels should be logical (`fwidth(u) * PX_SCALE`, offsets `/ PX_SCALE`).
- Offscreen canvases used as textures (atlases, text planes) keep their own size: make them `SCALE`× larger (with `ctx.scale(SCALE, SCALE)`) if they are shown large, or they look soft at 4K.
- Post (bloom, halation, CA, grain, vignette) and the HUD scale automatically; the bloom pyramid stays at the logical resolution.

## Motion blur and sampling

The export renders every frame as the average of many sub-frames spread over the shutter (`--shutter 0.2`: a fifth of the frame time, centred on the frame's time), before post-processing. `--samples N` takes N evenly spaced sub-frames; `--samples auto` chooses the count per frame (`Engine.render`, `AdaptiveSampling`):

- The count steps through 4, 12, 36, 108, 324. Each step adds a sub-frame either side of every existing one, so each set is evenly spread and centred on the frame's time.
- After each step the engine compares the new sub-frames' average with the old ones' (displayed values, worst 2×2-logical-px block). Stepped copies of a moving edge differ between the two sets; a converged streak or a still image does not. Stepping shrinks as 1/count, so the frame's remaining error is about half the change the last step made; it stops when that is below `--tol` (default 3 levels of 255).
- In practice a still frame stops at 12, ordinary camera motion at 36, and whips, slams and fast zooms at 108 or 324. At 1:1 in 4K, 108 can't be told from 324, while 36 still shows faint striations on the fastest edges.

What this asks of scenes:

- Sub-frames are rendered out of time order and in any number: a scene's output must depend on `f.t` only. `stateful` scenes can't be sampled adaptively (the engine refuses); nothing may count `render()` calls.
- **Counters and any changing text read `frameTime(t)`** (`util.ts`: t snapped to its frame), never raw `t`. A number counting with raw `t` differs in every sub-frame: its digits smear and the adaptive sampler runs that frame to 324 sub-frames (measured: a 6 s clip took 443 s instead of 51 s). Things that really move (a line drawing in, a camera) keep raw `t` and get motion blur.
- Per-frame flicker and jitter keyed to 60 fps must use `frameIdx(t)` (`util.ts`), not `Math.floor(t * 60)`. `frameIdx` is constant over the frame's shutter; `floor` switches at the frame's own time and double-exposes two states in every frame.
- Noise that changes with continuous `t` (a hash seeded by time) is resampled in every sub-frame: it averages out, but slowly, and makes the adaptive sampler work harder. Seed it with `frameIdx(t)` unless it is meant to smooth out.
- An emitter whose rate varies over time passes the rate as a function of the birth time: a rate read at the current `t` re-times every particle from one sub-frame to the next.
- Shaders that supersample internally (4 rotated-grid taps) take `ssTap: SS_TAP` and `${SS_TAP_GLSL}` and loop `for (int k = ssK0(); k < ssK1(); k++) ... rgss(k)`, weighting by `ssWeight()`. The engine then hands each sub-frame one tap, cycling them (every set is a multiple of 4), which averages to the same image for a quarter of the cost. In the preview and single-sample stills they take all four.
- Post parameters (shake, flash, zoom, fades, the HUD mode) are read at one point of the shutter, 1/8 of it after the frame's time (where the video was tuned, and a point every sample set includes); the HUD, grain and dither are drawn once per frame.

## Components (`app/src/components/`)

Each file's header documents its params with an example. All follow the style guide, compute nothing themselves
(values come from `timeline.ts`, computed with `src/finance` from `assumptions.json`), anchor their motion to
narration cues (a phrase, or seconds after the entry starts) and hold counters to one value per frame.
`videos/_components` shows every one of them (`?video=_components`).

| Component | For | Key params |
|---|---|---|
| `big-number` | One hero figure that counts and lands on the spoken word | `value, format, kicker, label, sub, suffix, countOn, landOn, delta, align, color` |
| `line-chart` | Growth over time, paths compared | `series[{points, drawOn, drawTo, fill}], x, y{format, follow}, notes, title` |
| `stacked-bar` | What you put in vs. what it grew; plain bar charts | `segments, bars[{label, values}], buildOn, buildTo, breakdown` |
| `timeline` | Ages and years: spans and markers | `x, spans[{from, to, drawOn, drawTo}], markers[{at, label, sub, on}]` |
| `comparison` | Two scenarios side by side and the gap | `left, right ({label, sub, value, rows}), countOn, landOn, gap{label, on, ratio}` |
| `chapter-card` | Section title, matching the YouTube chapters | `title` (default: the script chapter), `number`, `total` |
| `key-takeaway` | One ≤ 7-word line, key word underlined | `text, highlight, on` |
| `test-card` | Engine pipeline test only | |

Shared helpers in `components/_kit.ts`: `fmt` (NumFormat → text), `cueTime`, `drawMono`, `drawDeltaChip`,
`drawYGrid`, `drawLegend`, `niceStep`/`niceMax` (axis ticks), `interp`. `padToFinal` (`src/finance/format.ts`) lays a
count out in its final shape with dim leading zeros.

## Reference: the original music video

The *P(doom)* music video's scenes and analysis tools were removed from the `finance-channel` branch; they're on `main`
(`git show main:app/src/scenes/<name>.ts`). Worth knowing as technique references: `ascent-odo.ts` (odometer counter),
`leftturn-gantt.ts` (timeline/Gantt layout), `dense-press.ts` (dense typography), `bureau.ts` (paper-scene diagrams),
and the `handlesTransition` hand-offs. Reuse techniques, never their content or look.
