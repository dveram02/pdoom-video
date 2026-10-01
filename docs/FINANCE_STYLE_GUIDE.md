# Finance channel — style guide

The visual bible for every video. It replaces `TREATMENT.md` as the creative reference. When a choice isn't
covered here, pick whatever makes the financial idea clearer.

> **Status:** v1 draft (2026-10-01). Colours were validated with the dataviz palette validator and WCAG contrast.
> To be revised after the 60-second prototype (STEPS Part E).

---

## 1. The idea in one paragraph

Each video is an **animated financial documentary**: one big idea, explained with **numbers that move,
charts that build, and objects that turn into the next concept**. The look is editorial and precise,
like a Bloomberg or Financial Times graphics desk working in motion. It should never look like a slide deck,
a stock-footage montage or an AI-image slideshow. The visuals do the explaining: a viewer with the sound off
should still follow the logic. Restraint is the brand: dark ink ground, warm white type, **one gold accent**,
and green and red used **only** to mean gain and loss.

**Feel:** premium · authoritative · calm confidence · data-driven · cinematic, never flashy.

---

## 2. Colour

### 2.1 Tokens

These replace `app/src/engine/palette.ts` in Part C. Hex values are sRGB. GL code uses the `LIN` versions.

| Token | Hex | Role | Contrast on ink |
|---|---|---|---|
| `ink` | `#0B0D10` | Background (a cool near-black) | — |
| `ink2` | `#15181D` | Raised panels, cards, chart plot areas | — |
| `rule` | `#262A31` | Gridlines, dividers, inactive tracks (non-text) | — |
| `graphite` | `#5E6672` | Tertiary text: footnotes, axis ticks, source lines | 3.35:1 (large or non-essential only) |
| `ash` | `#9AA1AC` | Secondary text: labels, units, axis titles | 7.48:1 |
| `bone` | `#F2F0EB` | Primary text and hero numbers | 17.1:1 |
| `gold` | `#BA8520` | **Brand accent** and series 1 ("you" / the main portfolio) | 5.99:1 |
| `goldHi` | `#E3B04B` | Gold highlight: glow cores, the "moment" number, keyline on gold fills | 9.80:1 |
| `blue` | `#3F7FD0` | Series 2 (comparison / "the other path") | 4.78:1 |
| `rose` | `#D0679A` | Series 3 (rare; a third scenario) | — |
| `gain` | `#22A06B` | **Semantic only:** up, profit, positive delta | 5.85:1 |
| `loss` | `#E5533F` | **Semantic only:** down, debt, loss, negative delta | 5.23:1 |
| `paper` | `#F2F0EB` | Background of "document" scenes (= bone) | ink on paper 17.1:1 |

### 2.2 Rules

- **Series colours go in fixed order: gold → blue → rose.** Validated (dark, surface `#0B0D10`, all pairs): passes
  the lightness band, chroma, CVD ΔE ≥ 8 and normal-vision ΔE ≥ 15. A **4th series is never a new hue**. Fold it
  into "Other", or split into two charts.
- **Colour follows the entity, not its rank.** If Sarah is gold in scene 3, she's gold for the whole video.
- **Green and red are reserved for gain and loss.** They're never series colours. The gain/loss pair sits in the
  colour-blindness *warn* band (ΔE 7.4 deutan), so **always add a second cue**: a sign (`+` / `−`), an arrow (▲ / ▼)
  or a label. Never rely on red versus green alone.
- **Neutral grey (`ash`/`graphite`) for "the boring part"**: contributions, principal, baselines, "what you put in".
  Gold for "what grew". This contrast is the channel's main visual idea.
- **Text uses text tokens** (`bone`/`ash`/`graphite`), never the series colour. A coloured swatch, line end or
  marker next to the label carries the identity.
- **Glow:** only `goldHi` (and `gain`/`loss` on a hero moment) may exceed ~0.85 linear and bloom. Bone type
  never blooms.
- **Light/dark rhythm:** most scenes are ink. Use **paper scenes** (bone ground, ink lines, gold accent) for
  history, documents, definitions and rules ("The 1913 Revenue Act", "What the fine print says"). At most a
  third of the runtime.
- **No other hues.** No neon, no purple gradients, no cyan glow.

---

## 3. Typography

The repo already has the right families (`app/src/engine/type.ts`):

| Family | Use | Notes |
|---|---|---|
| **Archivo** 700–900, width 87–112 | Headlines, hero numbers, key words | Big, tight, confident. Use width and weight for emphasis, not decoration. |
| **Archivo** 300–500, width 100 | Sub-heads, card titles, labels in sentence case | |
| **IBM Plex Mono** 400–600 | Data labels, tickers, axis values, footnotes, sources, small numbers | Every glyph is the same width, so it never jitters. |
| **Cormorant Garamond** italic | Quotes and definitions only (≤ 1 per video section) | Lining figures are already on. |

- **Counting numbers must not jitter.** Archivo digits are nearly tabular (595–597 units) and the font has `tnum`.
  In Part C, add an Archivo face with `"tnum" 1` (the `features` field in `type.ts`) for animated numbers.
  Plex Mono is fixed-width already.
- **Minimum sizes (1080p logical px)**, because a large share of viewers watch on phones:
  hero number ≥ 160 · headline ≥ 72 · sub-head ≥ 44 · body/label ≥ 30 · axis/tick ≥ 24 · footnote/source ≥ 20 (graphite or ash).
- **On-screen reading load:** ≤ 7 words per text line, ≤ 2 lines of reading text at a time. Don't make viewers
  read a sentence while the narration says a different one. Key words, not transcripts.
- **No permanent subtitles burned into the video.** Upload real captions (an SRT built from the timestamp data) instead.
- **Case:** headlines in sentence case or ALL CAPS Archivo for single-word slams (`TIME`, `COMPOUNDING`).
  Labels in sentence case. Mono labels may be uppercase with +40–80 tracking.
- **Craft (inherited from TREATMENT.md):** kern everything (`layout()`/`glyphX()` for glyph-by-glyph drawing), use
  typographic punctuation (’ “ ” – — × −), no outlined or haloed type, no glyphs from outside these families.

---

## 4. Numbers and data formatting

| Kind | Format | Example |
|---|---|---|
| Currency, exact | `$` + thousands separators, no cents ≥ $100 | `$91,473` · `$36,000` |
| Currency, small | cents only when they matter | `$4.17/day` |
| Currency, compact (headlines) | 3 significant figures + K / M / B / T | `$745K` · `$1.2M` · `$31.4T` |
| Negative | true minus sign U+2212, before the `$` | `−$500` · `−12.4%` |
| Change | always signed | `+$31,473` · `−3.2%` |
| Rates | one decimal place, with the period stated | `8.0% / yr` · `24.9% APR` |
| Percent points | `pts` | `+1.5 pts` |
| Time | `Year 10` · `Age 35` · `Jan 2020` · `1990–2025` (en dash) | |
| Multipliers | `×` U+00D7 | `2.4×` |

- **The screen and the voice round the same way.** If the script says "about seven hundred forty-five thousand",
  show `$745K` or `$745,179`, never `$750K`.
- **Exact versus compact:** show exact values when the viewer should do the maths with you (contributions + growth = total).
  Use compact values for scale and impact.
- **Units always visible:** `/mo`, `/yr`, `APR`, `real` vs `nominal`, `inflation-adjusted`.
- **Every number traces to `assumptions.json` (computed) or `sources.json` (cited).**

---

## 5. Charts

Video charts aren't interactive, so **direct labels do the job of tooltips**.

### 5.1 Picking a form

| The point being made | Form |
|---|---|
| One headline figure | **BigNumber**: no chart at all |
| Growth over time | **LineChart** (single series: no legend box, the title names it) |
| Two paths compared (start at 25 vs 35) | **LineChart**, 2 series, direct-labelled at the line ends |
| "What you put in" vs "what it grew" | **Stacked bar or stacked area**: grey contributions, gold growth |
| Parts of a whole (budget, allocation) | **Horizontal stacked bar** or a 100% bar. Pie only for ≤ 3 parts. |
| Ranking / comparing amounts | **Horizontal bars**, sorted |
| A process or flow (paycheck → taxes → savings) | **MoneyFlow** diagram (Sankey-lite) |
| A sequence of events | **Timeline** |

### 5.2 Anatomy and marks

- **One y-axis, always.** Never a dual-axis chart. Different scales → two charts, or index both to 100.
- **The plot area** takes 60–70% of the frame width, and the headline or insight sits above it (top-left aligned).
- **Gridlines:** horizontal only, `rule` colour, 1 px, 4–5 lines maximum. No vertical grid. No chart border box.
- **Axis labels:** Plex Mono 24 px, `ash`. The y-axis uses compact currency. Label only round values.
- **Lines** are 3–4 px logical (video needs heavier lines than screens do), with round caps and the series colour.
  The live end gets a **dot** (≥ 12 px) plus a direct label (`$745K`) that rides along.
- **Bars:** 4 px rounded data-ends anchored to the baseline, a ≥ 4 px gap between bars, and a 2 px ink gap between stacked segments.
- **Labels:** direct-label line ends and key bars. **Never put a number on every point.** One highlighted
  annotation per chart is the norm ("Your money doubled here").
- **A legend only with ≥ 2 series**, and with ≤ 3 series also direct-label. Identity is never colour-only.
- **Source line:** bottom-left inside the safe area, Plex Mono 20 px, `graphite`: `SOURCE: U.S. BLS, CPI-U 1990–2025`.
  Hypotheticals use the same position: `HYPOTHETICAL · 8% AVG ANNUAL RETURN · NOT GUARANTEED`.

### 5.3 Chart motion

- **Build in this order:** axes and grid (0.4 s) → series draws left to right (2–4 s, `inOutCubic`, or synced to the narration
  phrase) → end label → annotation. Each step lands on a spoken word.
- **A counter and a line are driven by the same `t`**, so the label always equals the line's current value.
- **Rescale smoothly:** when values outgrow the axis, ease the y-scale (0.6 s) and re-label the ticks. Never jump.
- **Log scale** only when the narration explains it, with an on-screen `LOG SCALE` tag.

---

## 6. Layout and safe areas

- **Logical canvas 1920×1080.** Title-safe margin **96 px** on all sides: all text and key data stays inside.
- **YouTube overlays:** keep the **bottom 120 px** free of anything essential (the player controls and captions sit
  there), and the **top-left corner** clear in the first 5 s (the title overlay on embeds).
- **End screen:** the last **20 s** keep the right half (or the zones the end-screen template uses) clear for the
  video and subscribe elements.
- **Grid:** 12 columns, 96 px outer margin, 24 px gutters. Compositions are asymmetric (headline left, chart right, or
  stacked), with generous negative space. Centred layouts only for single-word slams and hero numbers.
- **Hierarchy per frame:** **one** focal point (a number, a line end or a word). Everything else is `ash`/`graphite`.

---

## 7. Motion

- **The rhythm comes from the narration, not a beat grid.** Key changes land on the **spoken word** (the word's
  `start` from the timestamp data). Anticipate by ≤ 0.15 s and never lag behind the voice.
- **Pacing:** a meaningful visual development every **3–8 s**. A development doesn't have to be a cut: a new
  data point, a re-scale, a callout, a camera push. No static frame longer than ~8 s.
- **Eases** (`util.ts`): enter with `outExpo` / `outCubic` (0.4–0.7 s), move with `inOutCubic` (0.6–1.2 s), and use a
  subtle `springStep` only on small UI pops. No linear motion except chart draw-ins tied to time.
- **Counters:** 1.5–3 s, ease-out, landing **on** the spoken number. Then **hold ≥ 1.5 s** so it can be read.
- **Object continuity is the signature move.** Concepts transform instead of cutting:
  `$100 bill → monthly deposit chip → bar → growth curve → timeline`. Use `handlesTransition` with `f.under`.
- **Cuts:** hard cuts at sentence or section boundaries. Crossfades only for time passing.
- **Camera:** slow pushes (≤ 5% scale over a shot) and purposeful moves *through* charts ("zoom into year 30").
  No shake, no whip-pans, no roll, except one deliberate impact per video at most.
- **Section breaks:** a chapter card (Archivo 900 + mono chapter number `02 / THE TIME ADVANTAGE`), 2–3 s, which
  matches the YouTube chapters.

---

## 8. Post-processing (the finance preset, implemented in STEPS C4)

| Param | P(doom) default | Finance |
|---|---|---|
| `bloom` | 0.55 | 0.15 (gold highlights only) |
| `halation` | 0.25 | 0 |
| `ca` (chromatic aberration) | 1.2 | 0 |
| `grain` | 0.055 | 0.008 (just enough to stop banding in dark gradients) |
| `vignette` | 0.35 | 0.15 |
| HUD crop marks / P(doom) readout | on / staged | off |
| x264 `-tune` | grain | animation |

Charts and numbers must be **crisp**. Anything that softens text is wrong.

---

## 9. Iconography and imagery

- **Drawn, not pasted.** Icons are simple line drawings (2–3 px strokes, round caps, `bone` or `ash`) made with
  `LineBatch`/Canvas paths: house, card, calendar, coin stack, piggy bank, paycheck, receipt, shield, hourglass.
- **No photos, no stock footage, no AI-generated images, no emoji, no mascots or cartoon people.** People appear as
  **labelled abstractions**: a name card (`SARAH · 25`), a dot on a timeline, a column in a chart.
- **No logos and no imitation of real product UIs** (brokerages, banks, card networks). Company names only as text.
- **Money as objects:** use stylised geometric notes, coins and stacks, never photoreal currency (and never a realistic
  reproduction of real banknotes).
- **Texture:** a subtle engraving or guilloché pattern (`engrave()` / `hatch()` in `glsl/common.ts`) is allowed as an
  occasional premium accent on paper scenes and hero numbers, like security printing. Use it sparingly.

---

## 10. Recurring components (the library, STEPS Part D)

Each is one parameterised `Scene` and follows this guide by default:

| Component | Signature look |
|---|---|
| `BigNumber` | A huge Archivo `tnum` counter, mono unit label beneath, optional `+/−` delta chip in gain/loss |
| `LineChart` | Gold line, riding end-dot plus label, 4–5 gridlines, a source line |
| `StackedBar` | Grey "you put in" plus gold "it grew", building year by year |
| `Timeline` | A horizontal hairline with age/year ticks, and markers that drop in on the spoken cue |
| `Comparison` | Two columns with name cards, the shared axis behind them, and a delta callout between them |
| `ChapterCard` | Chapter number in mono, title in Archivo 900, a gold rule that draws in |
| `KeyTakeaway` | One sentence, ≤ 7 words, bone on ink, with a gold underline |
| `Disclaimer` | `HYPOTHETICAL · …` chip and the closing "Educational only, not financial advice" card |

---

## 11. Sound (for STEPS F2)

- **The voice is king.** Music is a quiet bed (felt piano, soft pulses, minimal electronic) with no lyrics, ducked under the voice.
- **SFX are subtle and paper-like:** soft ticks on counters (thinned out, never one per frame), a pen-scratch for line
  draws, a soft thump for a hero number landing, a low whoosh for transitions. Never game-like and never cartoonish.
- **All audio must be licensed for YouTube monetization.** The master is normalized to about −14 LUFS integrated, −1 dBTP.

---

## 12. Per-batch QA checklist (Claude runs this on every contact sheet)

- [ ] All text inside the 96 px title-safe area. Nothing essential in the bottom 120 px.
- [ ] No text below the minimum sizes (§3). Nothing overlaps or clips.
- [ ] One focal point per frame. Hierarchy reads in under 1 s.
- [ ] Colours only from the tokens. Gain/loss only for gain/loss, and always with a sign or arrow.
- [ ] Every number matches `assumptions.json` or `sources.json`, and the narration's rounding.
- [ ] Hypotheticals labelled. Sources shown where real data appears.
- [ ] Counters don't jitter (tabular figures). Labels track their lines.
- [ ] No frame static for more than ~8 s. Transitions explain a relationship.
- [ ] No P(doom) leftovers (spark, mask, orange, crop marks, grain look).
- [ ] The frame reads on a phone (check the contact sheet thumbnails: are the key number and word legible at 480 px?).

---

## 13. Never

Generic AI imagery · stock-footage aesthetics · crypto-neon or purple/cyan glow · random particles or nebulae ·
lens flares · excessive bloom · cartoon characters or mascots · emoji · meme formats · PowerPoint bullets ·
full-sentence subtitles · dual-axis charts · rainbow palettes · red versus green as the only cue ·
brand logos · fake app UIs · unsourced statistics · "guaranteed" language.
