# LUMON OS — Macrodata Refinement

A mobile-first browser recreation of the Macrodata Refinement terminal from
*Severance*. Probe a grid of numbers for the ones that feel wrong, read the
temper from how they move, and bin them before the shift clock runs out.

Built to run at 60 FPS on a phone, in a 9:16 portrait frame, with every
sound synthesised at runtime — there are no audio files in this repository.

## Play

**https://onlinestuff4me-sketch.github.io/lumon-mdr-game/**

Best on a phone with the sound on and haptics enabled. On a desktop the
terminal letterboxes to a centred 9:16 slab and works with a mouse.

Locally:

```bash
npm install
npm run dev      # http://localhost:5173
```

`.github/workflows/deploy.yml` typechecks, lints, builds and publishes to
GitHub Pages. Pages itself has to be switched on once by hand — Settings ->
Pages -> Source: GitHub Actions — because the Actions token is not permitted
to create a Pages site.

The build uses a **relative base**, so one artifact works wherever it is
mounted: GitHub Pages serves a project site from `/<repo>/`, Vercel serves
the same repo from the root of its own domain. A hardcoded prefix for one
of them 404s every asset on the other.

## The loop

The queue runs in three acts behind a training sequence, so the job is
learned rather than sprung on you. **ORIENTATION** is 21 short screens in
which nothing is hidden: every group is already moving, and all you do is
box it and bin it. Three screens per temper teach what each one looks like,
four put two tempers on the deck, five put up all four. Selecting is generous there —
a tap anywhere on a group takes the whole group, and so does a box touching
any one of its digits — faint arrows point a held packet at the bin if you
hesitate, and the screens advance themselves, so it reads as one continuous
sequence rather than 21 files. The group starts in the middle of the board
and works its way outwards as you go. **BELLINGHAM** then takes the visibility away: the group surfaces for
two seconds and sinks for five, and your first touch summons the lens
instead of the box, which lingers and shrinks so you can see what it is.
**CALIBRATION** then meets all four tempers, one cluster each, spread wide,
no clock, and the terminal names each one as you find it. **Act I** is four
files of a *single* temper — three groups of it, one bin spanning the whole
deck, nothing to confuse it against, and no clock until the last of them. **Act II** puts two
tempers in a file, two groups each, and starts the shift clock; this is
where the real skill lives, telling one from another. **Act III** is the job
as Lumon specifies it, all four at once on a crowded board, with the clock
tightening and the motion damping file by file. Act III now introduces one new
rule per file — decoys, the morph, a redacted channel — each taught on its
own file before it is used, and Cold Harbor carries something the handbook
does not describe. Each refined file hands back a line of the story.

The full table, what each act teaches and why each Act II pairing was chosen
are in [docs/PROGRESSION.md](docs/PROGRESSION.md); the onboarding sequence
and the Act III mechanics are specified in
[docs/ONBOARDING.md](docs/ONBOARDING.md), with a live tuning sheet for every
number served at **`/tool`** next to the game.

Once you have refined anything, the briefing offers **RESUME AT <file>** —
one past the furthest file you have completed — so a returning refiner
picks the story up rather than re-earning addenda they already hold.

1. **PROBE** — hold a finger on the matrix. A lens floats above your
   fingertip, magnifying the digits under it so your thumb never covers the
   thing you are reading. Within 80px of a hidden cluster the digits stir:
   they move, they make a noise, the phone buzzes. Intensity scales with
   distance. Once you have positively identified a cluster it stays stirred
   for a while, so you have time for step 2.
2. **SELECT** — double-tap anywhere, or hit the SELECT switch, then drag a
   dashed box around the agitated digits. Capture four or more and the
   cluster lifts off the grid as a data packet.
3. **REFINE** — drag the packet into a temper bin. A correct assignment
   fills that bin by a share of its quota — a third in Act I, a half after
   it; a mistake buzzes, glitches red and scatters the digits back to the
   grid unrefined, where they can be found again. Fill every bin on the
   deck to 100% to complete the file.

Later files damp the cluster motion, so the tells get subtler, and they let
the clusters crowd: Act I keeps them five clear cells apart, Act II four,
Act III three. A file with fewer tempers also gets a single-row bin deck
and hands the reclaimed height back to the board.

Shift length is a setting, in the handbook. **EXTENDED** is the default and
doubles the clock; **STANDARD** is the 120 / 110 / 100 / 90 seconds the
brief specifies, and assumes you already know the four tempers. Either way
each correct assignment credits five seconds back, so competence buys time
and the clock bites the player who is guessing.

The handbook shows a live animated sample of each temper beside its
description, and the shift clock stops while it is open — so checking what
dread actually looks like, mid-file, is free. It also carries the
**archive**: the files with their addenda, the ones you have
refined declassified and the rest redacted word by word. It persists, so
the count of recovered addenda is the closest thing here to a save file.

## The four tempers

Each temper has one distinct displacement function, one synth voice and one
vibration pattern. Nothing about a cluster's colour tells you which it is —
by default agitated digits glow in neutral phosphor, and you read the
feeling from the motion, the sound and the buzz. (A colour assist is in the
handbook if you want it.)

| | Motion | Sound | Haptics |
|---|---|---|---|
| **01 WO** Woe | droops downward under its own weight | 60 Hz drone + minor third | slow deep pulse `[120]` |
| **02 FC** Frolic | bounces, spinning ±15° | 880 Hz arpeggiated chime | rapid double tap `[20,40,20]` |
| **03 DR** Dread | shivers on the X axis at 30 Hz | 150 Hz against 212 Hz — a tritone | continuous buzz `[30,15,30]` |
| **04 MA** Malice | pulses outward radially, flashing | distorted sawtooth with a kick | one heavy kick `[220]` |

## How it is put together

```
src/
  game/
    engine.ts      the only mutable state and the only rAF loop
    grid.ts        16x28 matrix, contiguous cluster seeding
    motion.ts      one displacement function per temper
    render.ts      canvas draw passes (grid layer, packet overlay)
    glyphAtlas.ts  pre-baked phosphor glyph strips
    layout.ts      stage geometry shared by the DOM and the engine
  audio/
    AudioEngine.ts four persistent synth voices + one-shot terminal SFX
    haptics.ts     navigator.vibrate patterns and cadence control
  components/      CRT shell, HUD, control deck, bins, handbook, overlays
```

Three decisions carry most of the performance:

- **One loop, one owner.** `GameEngine` holds all mutable state and runs the
  single `requestAnimationFrame` loop. React subscribes through
  `useSyncExternalStore` and re-renders the HUD at about 11 Hz; the 60 Hz
  information lives on the canvas, so no component re-renders per frame.
- **Baked bloom.** Drawing 448 glyphs a frame with a live `shadowBlur` is
  the most expensive thing this game could do on a phone. `glyphAtlas.ts`
  rasterises the phosphor halo once per palette, and every frame is
  `drawImage`.
- **No allocation while probing.** The four temper voices are built once
  when the AudioContext unlocks and live for the session; proximity only
  moves `AudioParam`s. The arpeggio and the malice kick are scheduled onto
  persistent oscillators rather than spawning a node per note.

`layout.ts` is the single source of truth for chrome geometry: the bins the
player sees and the drop targets the engine hit-tests come from the same
function, so they cannot drift apart.

## Deliberate departures from the brief

Each was found by playing or measuring the thing, and each is written down
here rather than quietly applied.

- **A positively identified cluster latches.** Agitation is proportional to
  reticle distance, except that once a cluster has been probed to near-full
  strength it keeps moving at 55% after the finger lifts, until you refine
  it or identify another one. Without this you cannot switch to SELECT and
  draw a box before the cluster goes still — the three-phase loop simply
  does not close. Audio and haptics still answer to live proximity only, so
  the latch is a visual affordance and never a sound that follows you.
- **The reticle offset tapers over the control deck.** The 40px lift holds
  across the whole matrix, then decays to zero before the bins. At a
  constant 40px the bottom row of bins would require a touch below the last
  pixel of the screen — unreachable — and the top row would only respond to
  a press that looks plainly wrong.
- **Dread carries a second, slower component.** The specified 30 Hz shiver
  sits exactly at Nyquist for a 60 Hz display, and at 30 Hz — low-power
  mode, thermal throttling, a mid-range phone — it advances a full period
  per frame and freezes solid, so dread would vanish on precisely the
  devices most likely to run it. An 11.3 Hz term at under half the
  amplitude keeps the tremor visible at any frame rate while 30 Hz stays
  dominant wherever the display can show it.

- **Bin fill is a share of a per-file quota, not a flat +20%.** The brief's
  20% assumes five clusters per bin on every file, which only makes sense
  once all four bins are on the deck. A teaching file with one temper and
  three groups of it fills a third at a time; Act II and Act III fill a half.
  Twenty refinements is the right size for a file that is the job, and much
  too long for a file whose only purpose is to show you what dread feels
  like.

The 90-120 second shifts and the 80px probe radius are exactly as
specified. What changed instead is the cost of a
*gesture*. Identifying a cluster at 0.9 proximity meant landing within 16px
of one specific glyph, aimed blind from 40px below; at 0.55 the target is
about 37px, roughly one thumb. Measured over every cluster on the board,
the share of touches inside a cluster's own footprint that succeed went
from 83% to 99.9%. And lifting a finger off a cluster you have just studied
arms SELECT for you, removing one deliberate gesture from each of the
twenty refinements a file needs. Double-tap and the SELECT switch both
still work; they are simply no longer mandatory.

## Measured

On a scripted iPhone-13 viewport in headless Chromium:

- **0.8 ms of JavaScript per frame** against a 16.7 ms budget while probing
  a cluster — 0.1 ms simulation, 0.7 ms canvas, 0.0 ms React. Steady 60 FPS.
- **The HUD re-renders about once per second**, not once per frame: React
  is notified 0 times across three idle seconds and roughly once per tick of
  the shift clock during play.
- **Flat heap** across ~170 probe cycles and six level restarts (12.8 MB →
  13.2 MB), and no Web Audio nodes allocated at all during twelve seconds of
  continuous probing across all four tempers — the voices are built once.
- A full file completes end to end under script with no orphaned nodes.
- **Latch accuracy 780/780 across all fourteen boards.** Every cluster on
  every file probed at its centroid and at ±8px and ±14px on both axes,
  through the real pointer API and the real reticle taper: the cluster that
  latches is the cluster nearest the reticle, every time, including on the
  Act III boards where clusters sit three cells apart.
- **DRANESVILLE plays to 100% with hand-speed gestures** — probe, marquee
  and carry all walked along their real paths at 700px/s — filling its one
  bin 0 → 33 → 67 → 100.
- **ORIENTATION plays to 100% with no probe at all**, which is its whole
  point. Its cluster reaches full agitation untouched (peak displacement
  1.4px per frame against 0.24px for the filler digits around it) while its
  `probe` stays at 0, so the drone and the haptics still wait for a finger.
  CALIBRATION's clusters measure 0.000 agitation until probed — the
  self-agitation does not leak into any other file.
### Is a file actually winnable?

Eight correct assignments against a 90-120 second clock is Act III's
arithmetic, and it deserved more than an assertion. So there is a bot that
plays like a thumb. It sweeps the grid serpentine at a set speed and only
"sees" a cluster when the game agitates one under it — no teleporting to
known centroids. It then stops to read the temper for a set time, and walks
every marquee and carry drag along its real path at 700px/s with a settle
at each end, so a gesture costs what a gesture costs. Two player models,
against the real clock:

| | Tumwater (120s) | Cold Harbor (90s) |
|---|---|---|
| competent — 420px/s sweep, 900ms read, judges the temper right | **won, 56s left** | **won, 15s left** |
| hesitant — 280px/s sweep, 1600ms read, misjudges 1 temper in 5 | **won, 16s left** | **lost at 80%** |

Which is the shape a difficulty curve should have: the first file forgives
you, the last one asks you to be good at it. Two caveats on reading these
numbers. The competent row judges every temper correctly, so it measures
whether the *mechanics* fit in the clock, not whether the puzzle is easy —
the hesitant row is the one that models the actual skill. And the bot boxes
using live node positions, so it never draws a selection that misses; a
human sometimes does, and recovers in a couple of seconds.

The ~0.6s per refinement a scripted harness achieves by calling engine
methods directly is engine-side cost, not player time, and is not the
number to quote.

**These runs predate the three-act ramp** and were played against the older
Act III file, which needed twenty refinements to reach 100%. The current one
needs eight against the same clock, and one serpentine sweep still finds the
board either way — so the search half of the cost is roughly unchanged while
the refinement half drops by 60%. The margins above are therefore a floor,
not a current measurement, and the row that mattered — hesitant, on Cold
Harbor, losing at 80% — is the one the ramp exists to fix.

## Notes on the browser

- `touch-action: none` across the input surface, with pointer capture, so a
  drag survives leaving the stage; a second finger is ignored rather than
  allowed to hijack the gesture in flight.
- The AudioContext is created and resumed inside a real user gesture, and
  suspends when the tab is hidden. Haptics stay quiet until the frame has
  been tapped, which is what browsers require anyway.
- The reticle's 40px offset tapers to zero across the control deck, so the
  bins sit exactly under your finger; at full strength the bottom row would
  need a touch below the edge of the screen.
- `prefers-reduced-motion` disables the CRT flicker and roll.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, `lucide-react`, HTML5 canvas,
Web Audio API, Vibration API. No runtime dependencies beyond those.
