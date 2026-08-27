# Design system

The rules this terminal is built from: what it is made of, how it moves,
and what it is allowed to say. It exists so that a decision taken once —
which green, how a panel arrives, whether it is a *file* or an *incentive*
— does not have to be taken again differently three screens later.

Two companion documents. `docs/REWARDS.md` is the incentive ladder: what is
earned, when, and by whom. This one is everything else, plus the words that
ladder is described in.

Where a rule is enforced in code, the module is named. Prefer changing the
module to changing a string in a component.

---

## Part 1 — The fiction, in one paragraph

This is a Lumon Industries terminal in the Macrodata Refinement department,
in about 1983, seen through a CRT. It is an *institutional* interface, not
a consumer one: it addresses the refiner in the passive voice, it withholds
more than it explains, and it is unfailingly polite about things that
should alarm anyone. It is never cute, it never uses an exclamation mark,
and it never celebrates in the register of a mobile game. When it is funny
it is funny because it is deadpan.

Everything below is downstream of that.

---

## Part 2 — Color

One family, nine steps, defined in `src/index.css` under `@theme` and used
through Tailwind (`text-phos-400`, `bg-phos-950`, …). Nothing in the
interface introduces a color outside this list.

### Phosphor

| Token | Hex | What it is for |
| --- | --- | --- |
| `phos-950` | `#010604` | The tube when it is off. Page and panel grounds. |
| `phos-900` | `#041a10` | Raised surfaces — a card, a bin, the header. |
| `phos-800` | `#06301d` | Meter tracks, hairline dividers inside a surface. |
| `phos-700` | `#0a4a2c` | Borders at rest. |
| `phos-600` | `#0f7045` | De-emphasized text: eyebrows, captions, units. |
| `phos-500` | `#17a866` | Secondary text. |
| `phos-400` | `#2fd68a` | Body text, active borders, meter fills. The workhorse. |
| `phos-300` | `#7bf3bb` | Emphasis inside a paragraph; a live label. |
| `phos-200` | `#c3fddf` | Headlines and the one number on a screen that matters. |

Contrast climbs with the number. If a thing is more important, it is
*lighter*, never a different hue.

### Temper accents

Four, and they belong to the four tempers alone. They appear on bins, on
agitated clusters when color assist is on, and on the dance floor. They are
never used for status, emphasis, or decoration.

| Temper | Token | Hex |
| --- | --- | --- |
| Woe | `woe` | `#4a8cd6` |
| Frolic | `frolic` | `#f0c548` |
| Dread | `dread` | `#9b6cf0` |
| Malice | `malice` | `#ff5a4d` |

**Color is never the only channel.** A temper is always carried by motion
as well as by hue — see `src/game/motion.ts` and `src/game/mde.ts`. A
refiner playing with color assist off must be able to finish the game.

### Alarm

`alarm` (`#ff3b30`) is for one thing: something has gone wrong and the
refiner needs to know. A rejected drop, an expired shift, a closed record.
It is never used for urgency-as-decoration.

---

## Part 3 — Type

One family: `--font-mono`, Courier before anything else. There is no second
typeface and there is no weight below bold or above it — `font-bold` or
nothing.

The scale is small and tracked wide, because that is what a terminal looks
like. Sizes are in px through Tailwind's arbitrary syntax so they do not
scale with a user's root font size on a canvas game that cannot reflow.

| Role | Size | Tracking | Case |
| --- | --- | --- | --- |
| Screen headline | `13px` bold | `0.16–0.22em` | UPPER |
| Section heading | `10px` bold | `0.2em` | UPPER |
| Body / caption | `10px` | normal | Sentence case |
| Label, eyebrow, unit | `8–9px` | `0.18–0.3em` | UPPER |
| The one number | `13px` bold, tabular | — | — |

Two rules that are not negotiable:

1. **Numbers are `tabular-nums`.** A percentage that jitters as it counts
   is the single most obvious way to make an instrument look fake.
2. **Sentences are sentence case; labels are upper.** A caption in caps is
   a caption nobody reads. `Your refinement has been recognized.` is a
   sentence. `NEXT INCENTIVE` is a label.

Headlines and live values carry `crt-text-glow` (a two-stop text-shadow in
`currentColor`). Body text does not — glow on everything is glow on
nothing.

---

## Part 4 — Elements

### Surface

`rounded-[3px]`, `border`, `bg-phos-900/40`. Three-pixel radii throughout;
nothing in this interface is rounder than that. Two nested surfaces is the
limit — a bordered card inside a bordered card inside a bordered panel
reads as a mistake.

### Meter

The most-used component in the game and the reason most screens exist.

```
track  h-[3px] (h-[6px] for the file meter) rounded-sm bg-phos-800
fill   bg-phos-400, box-shadow 0 0 6px, transition-[width] 300–500ms ease-out
full   box-shadow 0 0 10px 1px phos-200, one `meter-full` pulse
```

Every meter shows its raw numbers beside it (`4 OF 10`, `1/2`). A bar
without its numerator is a mood, not a measurement.

### Control

```
rounded-[3px] border border-phos-400 bg-phos-600/25
px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-phos-200
crt-text-glow, active:bg-phos-600/50
```

Every primary control carries a right chevron. **The primary control on a
screen that is waiting for a tap throbs** (`crt-throb`, 1.9s) — it is
usually the only live thing on that screen, and a refiner who does not know
that is looking at an interface that appears to have stopped.

Minimum touch target is 44pt; `DECK_FRAC` in `src/game/layout.ts` is sized
from that and nothing may be smaller.

### Screen

Full-bleed `absolute inset-0`, `bg-phos-950/97`, content in a column no
wider than `286px`, centered. Entry is always `crt-open` (Part 5).

---

## Part 5 — Motion

**A cathode-ray tube does not fade things in.** It strikes a line across
the middle of the screen and lets the image bloom outward from it, and it
loses signal the same way in reverse. Every panel in this game arrives on
that vocabulary. Nothing cross-fades, nothing slides in from the right,
nothing bounces.

The keyframes live in `src/index.css`:

| Name | What it does | Where |
| --- | --- | --- |
| `crt-open` | Unfurls a panel from a bright horizontal line, 300–340ms | Every full-screen overlay |
| `crt-band` | Runs the leading edge of the sweep down the panel once | The incentive card |
| `crt-resolve` | Content settles a beat behind the beam | Panel contents |
| `crt-throb` | 1.9s breath on a control's glow | The waiting control |
| `seal-part-*` / `seal-seam` | A lid splits on a bright seam and retracts | The sealed incentive |
| `meter-full` | One brightness pulse on arrival at 100% | Every meter |
| `bin-await` | Slow brightness breath on something waiting | Target bins, a sealed card |
| `glitch-shift` | Hard 4px jitter, steps(2) | Errors only |
| `boot-sweep` | The tube warming up | First load |

**Every keyframe has a `prefers-reduced-motion` variant** that flattens it
to its end state. That block is at the bottom of the keyframe section; a
new animation without an entry there is an incomplete animation.

### Two timing rules

1. **The board finishes before anything covers it.** A completed file is
   held for `SETTLE_S` (600ms, `src/game/engine.ts`) so both meters are
   seen reaching 100%. `hud.settled` gates every end-of-file overlay.
2. **Nothing opens itself.** No card, panel, or notice advances on a timer.
   A refiner who looks away has not missed anything.

### Objects that move between screens are measured, not guessed

The incentives summary shrinks into the header strip on the way out. Its
target is read with `getBoundingClientRect` at animation time, never from a
tuned offset — an offset is correct on exactly one phone. Scale is derived
from the *height* ratio when flying into a wide short target, or the page
grows on its way into the thing it is shrinking into.

---

## Part 6 — Language

The register: institutional, passive, unfailingly polite, never explains
the joke. "A temper was consigned to a bin that did not want it." "Lumon
accepts no responsibility for the consequence." Never an exclamation mark.
Never "Nice work!". Never "Oops".

**US spelling throughout** — recognized, color, center, meter.

### The reserved words

Enforced in `src/game/lexicon.ts`. These are the ones that were actively
being confused, and the confusion cost real clarity:

| Word | Means exactly | Never means |
| --- | --- | --- |
| **file** | One level: a screen of data the refiner refines | Putting something away |
| **refine** | Boxing digits and binning them by temper | Anything else |
| **bin** | One of the four temper receptacles | A verb for discarding |
| **incentive** | The thing Lumon gives you for hitting a milestone | — |
| **keep** | What a refiner does with an incentive | — |
| **record** | The collection of incentives kept, and its screens | A high score |
| **temper** | One of Woe, Frolic, Dread, Malice | A mood, an emotion |

### "Incentive", not "reward"

Nothing a refiner reads says *reward*. Lumon does not give people rewards;
it issues incentives. The colder word is funnier, it is what a company that
severs its staff would print on a terminal, and one word cannot read as two
competing systems the way "incentive reward" can. It is also half the
characters, which decides several buttons at 390px.

The code keeps the older names (`RewardId`, `rewards.ts`, `RewardReveal`)
because code is not read by refiners, and renaming a save key buys nothing.

### The four categories

The incentive record is divided into four, in the show's own vocabulary
(`CATEGORY_LABEL` in `src/game/lexicon.ts`):

| Category | Contains | How many |
| --- | --- | --- |
| `ISSUED ITEMS` | Finger trap, eraser, melon bar, crystal portrait, egg bar, remembrance melon | 10 payouts |
| `OUTIE FACTS` | One approved sentence about the person you are outside | 10 payouts |
| `WELLNESS SESSIONS` | Several sentences, read to you in the room | 3 payouts |
| `DEPARTMENT EVENTS` | Music Dance Experience, both Waffle Party tiers | 5 payouts |

Counted in *payouts* (ladder rungs), not in catalog entries — the fact card
is one picture issued ten times with ten different sentences, and "1 of 1
OUTIE FACTS" would be a lie to a refiner with nine more coming.

### What may and may not be said about an unearned incentive

This is the one hard content rule in the game, and every component that
touches the ladder restates it.

**May be said**: the counter, the target, the remainder, the exact action
that advances it, how many exist in a category, and — on a sealed card —
the milestone that earned this one.

**May never be said**: a name, an image, a silhouette, a category for the
specific thing coming, a color theme, or the threshold after this one. A
concealed slot in the record reads `CLASSIFIED · NOT YET ISSUED` and
carries nothing a refiner could work backward from.

The separation is structural, not a promise: `src/game/rewards.ts` holds
the ladder and knows no names; `src/game/catalog.ts` holds the names and is
imported only by the reveal, which runs after the thing has been earned.

### Canon

Prefer the show's own words wherever they exist — Woe, Frolic, Dread,
Malice; Wellness; Music Dance Experience; Defiant Jazz; the Perpetuity
Wing; "the work is mysterious and important". Invented material is written
in the same register and labeled in the source: `CANON_SHOWN`,
`CANON_DIALOGUE_ONLY`, `ORIGINAL_APOCRYPHA`, `CANON_WELLNESS_CLAIM` (see
`src/game/facts.ts`). The label never appears on screen — inside the
fiction these are all simply things Lumon has said.

---

## Part 7 — Layout

The stage is a fixed-aspect slab (`src/components/Viewport.tsx`) so the CRT
never stretches. Chrome heights are fractions of stage height, defined once
in `src/game/layout.ts` and shared by the DOM chrome and the engine's
hit-testing — the two can never drift.

```
HUD_FRAC       0.112, floored at HUD_MIN (92px)   file line, meter, record
TICKER_FRAC    0.042                              the coach line, always reserved
DECK_FRAC      0.086                              mode switches, ≥44pt
BINS_FRAC      0.175 / 0.08 one-row               the four bins
grid                                              whatever is left
```

The ticker band is reserved permanently, whether or not a message is
showing, so the matrix never reflows underneath the text describing it.

### Stacking

| z | What |
| --- | --- |
| 10 | The canvas |
| 20 | Ticker, bin deck |
| 35 | The input surface — a transparent sheet over the whole stage |
| 40 | Header and control deck. Both sit *above* the input surface, and both are `pointer-events-none` except for their actual controls, so a packet dragged under them stays grabbable |
| 45 | CRT overlay (scanlines, mask, vignette, bezel) |
| 60 | Phase overlays — briefing, end of file, failure |
| 70 | Incentive screens, the handbook, the dance floor |

---

## Part 8 — Accessibility

- **Never color alone.** Temper is carried by motion as well as hue.
- **`prefers-reduced-motion` is honored everywhere**, both in CSS and in
  the components that measure and animate in JS.
- **44pt minimum** on everything tappable.
- **Every spoken word is also on screen.** There is no audio-only content.
- **Nothing is non-skippable.** Every ceremony has a live control from its
  first frame.
- **Sound is never the only tell.** The temper voices help and are strongly
  advised, but the game is completable muted.
