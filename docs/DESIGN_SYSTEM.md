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

**A bar reads full only when its numbers do.** The incentives record adds
the part-file the refiner is currently working on, so every screen visibly
buys something — but that hint must never finish the last whole step, and
it must be zero once the file is credited or the same file is counted twice.
A meter at 100% beside the words `0/1` is the terminal contradicting itself,
and the refiner believes the bar.

**A bar measures the stretch being walked, not the whole game.** Every
incentive meter — the header strip, the summary, the full record — draws
`(current − from) / (target − from)`, where `from` is the last threshold
already passed. Drawn as `current / target` against a target that *moves*,
a bar falls at the exact instant a threshold is crossed: three quarters of
the way to one file became one of the two files the next rung wants, and
the meter shrank on the frame the refiner succeeded. Two consequences
follow, and both are load-bearing:

- **The number beside it is the same quantity as the instruction.** `1/2`
  next to REFINE 1 MORE FILE is one thing said twice; `4/5` next to it is
  two different things on one line, and that is what made these rows
  unreadable. A lifetime total is a *different* measurement and gets its
  own line where there is room for one.
- **A meter resets only after it has filled.** Reaching a threshold holds
  the row at 100% until the thing it paid for has actually been collected —
  the strip keeps showing the earned rung while the payout ceremony runs —
  so the reset happens behind the ceremony and reads as a fresh goal rather
  than as lost progress.

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

Minimum touch target is 44pt. Nothing tappable may be smaller.

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
| `crt-caret` | A block cursor blinking under the character being written | Text being typed over |
| `count-bump` | A number rising off the row it changed and fading | `+1` on a fed meter |
| `meter-full` | One brightness pulse on arrival at 100% | Every meter |
| `meter-take` | Brighten and bloom outward — a meter being *fed* | The category bar an incentive just moved |
| `record-dock` | A single bright bloom on a box that has just caught something | The incentives record |
| `bin-await` | Slow brightness breath on something waiting | Target bins, a sealed card |
| `glitch-shift` | Hard 4px jitter, steps(2) | Errors only |
| `boot-sweep` | The tube warming up | First load |

**Every keyframe has a `prefers-reduced-motion` variant** that flattens it
to its end state. That block is at the bottom of the keyframe section; a
new animation without an entry there is an incomplete animation.

### A screen reveals itself in beats, not all at once

Where several pieces of new information arrive together, they arrive in
order, and each one gets the space it needs at the moment it needs it. The
incentive card opens in two beats: the lid retracts while the headline is
typed over with the name, and only then does the caption band open —
sliding the control down — with the line under the plate written into the
space as the space appears.

Two rules make that work. **Nothing above the growing thing may move**: the
card is centred, so the band's height is paid for by a tail below the
control that gives up exactly what the band takes, and the card's total
height never changes. And **the control stays live through every beat** —
during the opening it lands the whole thing at once, so watching is never
the price of continuing.

Reserving the space up front is what this replaces, and it was worse: a
hand's width of nothing under the plate, held for text that had not been
written yet.

### Text that changes meaning is typed over, never swapped, and is heard

A terminal does not cross-fade a headline. Where a line genuinely becomes a
*different statement* — "YOU'VE EARNED AN INCENTIVE" becoming the name of
the thing — it is backspaced over and retyped a character at a time, with
`crt-caret` blinking under the cursor while the machine works
(`src/hooks/useTypeOver.ts`). The erase is faster than the type: deleting
is not the part anyone is reading.

**And it clicks.** One keystroke per character *typed* — never per
character erased, which would double the sounds for the half nobody reads,
and never on a space. The click is the same shape as the office keyboards
in the ambient bed but quieter and on the effects bus, so it reads as *this
terminal* writing rather than as the room. This is for meaning, not decoration —
a label that is merely *updating* still just updates.

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

### A teaching animation is a sequence of statements

Where an animation exists to teach — where something went, what it counted
toward, where it lives now — it is built as separated beats, each one
carrying a single statement, and it is paced so each beat can be *read*.
Two seconds is not slow for a sequence that says three things. Half a
second is not fast; it is illegible, and an illegible animation has taught
nobody and cost the time anyway.

Two supports for that. **Hold before you move**: an object that arrives on
the same frame as the screen it arrived on needs a beat sitting still
before it travels, because nobody was looking at it yet. And **say the
number as well as drawing it**: a bar growing is the proof, a `+1` rising
off the row is the claim, and a refiner reads a claim faster than a bar.

### One bar to watch

The playing screen has exactly **one** progress widget for the refiner's
own advancement, and it is the file meter. There were two — the file card
and, directly under it, a bordered incentives record with a second bar and
a second set of numbers — and two bars stacked is not twice the
information, it is a question about which one matters.

The incentive is a **line inside the file card** now: bold, one sentence,
saying what reaching 100% will buy, with a link to the full record and a
count beside it.

```text
FILE: ORIENTATION #0001 1/3 REFINED                --:--
▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  33%  [HANDBOOK ?] [⚙]
1 MORE FILE FOR YOUR NEXT INCENTIVE      SEE ALL 3/28 ›
```

**A fraction counts what is done, never where you are.** That line read
`2/3` on the second screen of three — a number that looks like progress and
is not, since two thirds of the file was still ahead. It counts the screens
*behind* the refiner, and it carries the word `REFINED`, because a bare
fraction beside a file name reads as "file 1 of 3".

Three rules hold it:

- **The line is not there until it means something.** A refiner who has
  never been issued an incentive is not told one is coming; the first two
  arrive unannounced and the ladder introduces itself once it has already
  paid out. Until then this is a file card and nothing else — which is also
  what gives the launch animation one simple object to land on.
- **The requirement is a noun phrase, not a sentence.** `1 MORE FILE`, not
  `Refine 1 more file without error.` — a line that truncates mid-word has
  said nothing, and `shortFor()` exists for exactly this one place.
- **An empty track has to look empty.** A `bg-phos-800` track at 5px reads
  as a *filled* bar; an empty one was reported as "the progress bar looked
  complete" beside the words `0/1`. Empty tracks are `bg-phos-950` with a
  `border-phos-800`, like the file meter.

The card is a footer, not a header, and the coach line is the first thing
on the screen instead of the third: it is what the refiner is being asked
to do, and the board under it is the doing of it.

```text
ticker · grid · bins · file card
```

### A file leaves, and *then* the next one arrives

Finishing a file used to mean watching every bar on the screen snap back to
zero at once, which reads as progress being taken away. It is three beats
now, and they do not overlap:

| | Beat | |
| --- | --- | --- |
| 1 | **It is finished.** `REFINED`, the border blooming, the meter full | 1.75s, on the board |
| 2 | **It leaves.** The finished card slides out to the left, alone | 620ms |
| 3 | **The next arrives.** After an empty beat, the new file slides in from the right at 0% | 220ms + 660ms |

Overlapped, the two slides read as one shuffle and neither is watched. **The
gap between them is what makes each a thing that happened** — an empty card
for a fifth of a second is not dead air, it is punctuation.

Beat one needs somewhere to live: a finished file is held for
`FILE_SETTLE_S` (1.75s) before any overlay may cover the board, where a
stage that ends mid-file keeps the old `SETTLE_S` (0.6s). Tapping briskly
through orientation is exactly as brisk as it was; the one mark that has
nowhere else to be seen gets the time.

Two mechanics worth keeping: the outgoing card is a *frozen snapshot* shown
at 100%, so it leaves finished; and the swap is triggered in a **layout**
effect, because a passive one shows the arriving card at rest for one frame
before it jumps off-screen to begin its slide.

### One subject at a time

Where a screen has a receipt and a promise on it, the promise waits. The
incentive summary shows nothing below the shelf rows — not the next goal,
not the way back — until the file has landed, the count has ticked and the
`+1` has finished rising. Then those arrive together, as their own event.

The space they will occupy is **reserved, not collapsed**: what changes is
only whether they are there, so nothing above them jumps when they appear.
A screen that grows while you are reading it has interrupted you twice.

### One object, handed from screen to screen

A kept incentive is followed the whole way. The card folds into a file
(`FileGlyph`, 460ms); the summary catches **that same shape** and walks it
into the category bar it moved, which lights with `meter-take` as it takes
it; the summary itself then shrinks into the incentives record, which
blooms once with `record-dock` *after* it lands.

Two rules hold that chain together. **The same component draws the object
at every stage** — two similar rectangles read as two things, and the
handoff is lost. And **the receiving glow fires after the arrival, never
during it**: a box already glowing while the page is still in flight has
answered a question nobody has asked yet.

**An object in transit gets its own ground.** A small bright rectangle
released over a fully drawn page is lost among a dozen bright rectangles,
and the eye has nothing to follow. Three things fix that, and all three are
needed: the object carries a **radial dark plate** that travels with it and
pushes back whatever it crosses; the page it is crossing is **held down**
until the object lands; and the one thing it is aimed at **stays lit**, so
the flight has a visible destination rather than a fog. Note that opacity
nests — a row set to full inside a container at 0.3 is still at 0.3 — so
the veil goes on each element the object is *not* going to, never on a
wrapper around all of them.

### An arrival is the reverse of a departure

The same two beats that put the incentives record away also bring the file
card in. Tapping CONTINUE used to cut straight to a wall of digits, and the
refiner arrived on a screen without having been told what the screen was:

1. **This is your file** — its name, its stage, its meter, and what the
   file is *for*, on an empty scrim. It waits for a hand, like every other
   card in this game: it used to advance itself after 950ms, which is long
   enough to notice a screen and not long enough to read one, and this is
   the screen that explains the job.
2. **And this is where it lives** — that same card shrinks into the file
   card in the footer (780ms), with the board loading underneath it and the
   scrim lifting as it goes. The briefing around it does *not* travel: it
   clears, so the one object with a destination is the only thing moving,
   and the scale it lands at is the ratio of two file cards rather than of
   a whole page to one.

The card shown is visually the card it becomes: same border, same two
lines, same meter, same two doors out — inert copies included. A card that
morphed into a *different* card on landing would teach the wrong thing.
`FileLaunch` owns both beats, and every way into the board from the
briefing goes through it.

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
| **file** | What the refiner is told they are refining, and what the ladder counts. One or more *stages* | Putting something away |
| **stage** | One screen of a multi-screen file. The orientation lessons are two or three | A phase, a level |
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
| `OUTIE FACTS` | One approved sentence about the person you are outside | 6 payouts |
| `HANDBOOK NOTES` | Lumon on the subject of a temper. About the work, never about the worker | 4 payouts |
| `WELLNESS SESSIONS` | Several sentences, read to you in the room | 3 payouts |
| `DEPARTMENT EVENTS` | Music Dance Experience, both Waffle Party tiers | 5 payouts |

Counted in *payouts* (ladder rungs), not in catalog entries — the fact card
is one picture issued many times with different sentences, and "1 of 1
OUTIE FACTS" would be a lie to a refiner with more coming.

**An outie fact is about an outie.** Every sentence in that bank begins
"Your outie", and a data invariant fails the build if one does not. Lumon's
own doctrine — a passage about Woe for refining Woe — rides the same blank
card and is a *handbook note*, with its own reward, its own headline and
its own shelf. They were the same thing for a while, which is how a
milestone for refining Woe came to announce "WELLNESS HAS A FACT ABOUT YOUR
OUTIE" and then print a sentence about Kier.

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
HUD_FRAC       0.072, floored at HUD_MIN (56)     file name + clock, meter + doors
TICKER_FRAC    0.042                              the coach line, always reserved
BINS_FRAC      0.1,   floored at BINS_MIN (66)    the bins, one row, always
RECORD_FRAC    0.063, floored at RECORD_MIN (44)  the incentives record
GAP_FRAC       0.014, floored at GAP_MIN (9)      between every band, and under the last
grid                                              whatever is left
```

**One gap, everywhere.** The board, the bins, the record and the bottom
edge are separated by `layout.gap` and nothing else. Bands are placed from
`layout.binsTop` and `layout.recordTop` rather than by flow, so the chrome
sits exactly where the engine hit-tests it.

The ticker band is reserved permanently, whether or not a message is
showing, so the matrix never reflows underneath the text describing it.

### The order of the bands

```
FILE: SUNSET PARK #0308                    --:--
▓▓▓▓▓▓▓▓▓░░░░░░  67%  [HANDBOOK ?] [⚙]    ← header
        coach line, when there is one       ← ticker
┌────────────────────────────────────────┐
│             the numbers                │  ← grid
└────────────────────────────────────────┘
┌────────┐┌────────┐┌────────┐┌────────┐
│ 01: WO ││ 02: FC ││ 03: DR ││ 04: MA │   ← bins, one row
│ ▓▓░ 40%││ ▓░░  0%││ ▓░░  0%││ ▓░░  0%│
└────────┘└────────┘└────────┘└────────┘
┌────────────────────────────────────────┐
│ INCENTIVES RECORD             4 KEPT › │  ← record
│ REFINE 1 MORE FILE  ▓▓▓░░░░░      3/4  │
└────────────────────────────────────────┘
```

**The bins are one row, always.** One bin spans the deck, four split it;
the deck is the same depth either way. Adding a bin used to add a *row* —
three different shapes for one idea, and the board lost a fifth of its
height the moment the fourth temper arrived.

**Every meter box is two lines**: what it is, then the bar and its number.
The file meter, each bin, and the incentives record are the same object at
three sizes, which is what buys the horizontal room for four bins across.

**The header carries the two doors out of the game** — the handbook,
labelled, because a lone question mark is a guess; and the settings, where
the audio toggle lives. Neither is a control used *during* play, so
neither gets a band; the meter can spare the width more cheaply than the
board can spare a row.

Two rules decided this arrangement, both learned by trying the
alternatives (`?layout=b` and `?layout=c` still render them):

1. **Two meters never stack.** The refinement meter belongs at the top
   with the file's name, because it measures that file. The incentive
   meter belongs at the bottom with the bins, because it measures the
   things the bins fill. Putting the record directly under the header —
   proposal `b` — reads as one confused instrument with two bars, and
   costs the board 40px besides.
2. **Nothing floats over the numbers.** Drawing the coach line on the
   board's top edge — proposal `c` — buys a band of grid and spends it on
   a line of text sitting on top of the digits, which is exactly what the
   reserved band existed to prevent.

**The board is 16 x 26.** It is a fixed grid scaled to fit whatever rect
is left over, so the row count is the one dial that trades board area for
legible glyphs. It went from 28 to 26 when the bins grew a line each and
the gaps were evened out: sixty pixels had to come from somewhere, and
two rows cost less than a 12.7px digit.

**There is no mode switch.** Probe and select are decided by what the
refiner does: study a cluster and the box arms itself, bin a packet and it
disarms, draw a box that catches nothing and the board hands itself back
to the probe. A double-tap still toggles for anyone who wants it. The deck
that used to hold those two switches was 8.6% of the screen.

### Stacking

| z | What |
| --- | --- |
| 10 | The canvas |
| 20 | Ticker, bin deck |
| 35 | The input surface — a transparent sheet over the whole stage |
| 40 | Header and incentives record. Both sit *above* the input surface, and the header is `pointer-events-none` except for the handbook button, so a packet dragged to the top edge stays grabbable |
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
