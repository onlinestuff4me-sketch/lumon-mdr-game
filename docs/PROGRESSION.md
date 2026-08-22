# The queue

Thirteen files in three acts. The design goal is that a refiner should
never be asked to do two new things at once, and should always leave a file
knowing something they did not know going in — about a temper, or about
Lumon.

Everything below is data, in [`src/game/constants.ts`](../src/game/constants.ts).
Changing the ramp is editing that array; nothing about it is hardcoded in
the engine.

## The table

| # | File | Act | Tempers | Bins | Groups / temper | Groups | Spacing | Per match | Clock | Subtlety |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CALIBRATION | — | 4 | 4 | 1 | 4 | 4 | +100% | none | 1.15 |
| 2 | DRANESVILLE | I | WO | 1 | 3 | 3 | 5 | +33% | none | 1.10 |
| 3 | SUNSET PARK | I | FC | 1 | 3 | 3 | 5 | +33% | none | 1.10 |
| 4 | CAIRNS | I | DR | 1 | 3 | 3 | 5 | +33% | none | 1.10 |
| 5 | EMINENCE | I | MA | 1 | 3 | 3 | 5 | +33% | 180s | 1.10 |
| 6 | KINGSPORT | II | WO FC | 2 | 2 | 4 | 4 | +50% | 150s | 1.00 |
| 7 | LE MANS | II | DR MA | 2 | 2 | 4 | 4 | +50% | 150s | 0.95 |
| 8 | LONGBRANCH | II | WO DR | 2 | 2 | 4 | 4 | +50% | 140s | 0.92 |
| 9 | MOONBEAM | II | FC MA | 2 | 2 | 4 | 4 | +50% | 140s | 0.90 |
| 10 | TUMWATER | III | all four | 4 | 2 | 8 | 3 | +50% | 120s | 1.00 |
| 11 | ALLENTOWN | III | all four | 4 | 2 | 8 | 3 | +50% | 110s | 0.86 |
| 12 | SIENA | III | all four | 4 | 2 | 8 | 3 | +50% | 100s | 0.72 |
| 13 | COLD HARBOR | III | all four | 4 | 2 | 8 | 3 | +50% | 90s | 0.58 |

Clock figures are STANDARD pace; EXTENDED, the default, doubles them. Every
correct assignment also credits 5 seconds back.

## What each act teaches

**CALIBRATION** — the gesture chain, not the tempers. One cluster of each
temper, far apart, no clock, and the ticker *names* the temper the moment
you identify it (`teaches: true`). The player learns probe → select →
refine while the answer is being given to them.

**Act I — one temper, one bin.** Each file contains a single temper, three
groups of it, and the deck carries only that temper's bin. There is no
wrong answer to give, which is the point: attention goes entirely to *what
this one feels like*. Three groups rather than one so the signature is met
three times in three places rather than once, and the bin bar visibly moves
a third at a time — the file has a shape.

The bin spans the full width of the deck at the same height as a normal
bin, so the fill meter is a long bar across the bottom of the screen and
progress is readable at a glance while your eyes are on the matrix.

Four files, in the order the tempers are numbered: woe, frolic, dread,
malice. A first meeting with a signature is not timed — except on the last
of them. **EMINENCE carries a 180s clock**, and it is the only Act I file
that does. Without it the player goes from four untimed files straight into
a two-temper file that is timed, meeting the clock and a second temper in
the same breath. Here the clock arrives while the task is still trivial —
three groups of one temper, no wrong bin to drop into — so it is learned as
a HUD element rather than as a threat.

**Act II — two tempers, two bins.** This is where the actual skill lives:
not *finding* a cluster but *telling one from another*. Two groups of each
of two tempers. The pairings are chosen, not random:

- **KINGSPORT** WO + FC — the two furthest apart. An easy first
  discrimination, and a confidence-builder.
- **LE MANS** DR + MA — both agitated, both fast. The first genuinely hard
  pair: a shiver and a strike read similarly at a glance and are told apart
  by their sound before their motion.
- **LONGBRANCH** WO + DR — the two vertical-versus-horizontal tempers, both
  low-energy at reduced subtlety.
- **MOONBEAM** FC + MA — both bouncy, both bright. The mirror of LE MANS.

Every temper appears in exactly two Act II files, so nothing is left
half-learned. The clock starts here, generously (150s, versus 120s for the
first four-temper file).

**Act III — the job.** All four tempers, two groups each, on a board that
lets them crowd (spacing 3). The escalation across the four files is not
in the count but in the two axes that actually make it harder: the clock
drops 120 → 110 → 100 → 90, and `subtlety` damps the motion 1.00 → 0.58,
so by COLD HARBOR you are reading tells at just over half amplitude with
three quarters of the time.

## The knobs

Six fields on `LevelDef` carry the whole ramp:

- **`tempers`** — which tempers seed, and therefore which bins the deck
  shows. `computeLayout` gives a one- or two-bin deck a single row and hands
  the reclaimed ~60-88px back to the matrix, so early files also get a
  taller board. Bins for absent tempers are parked off-stage, so a packet
  cannot be dropped on a temper this file does not contain.
- **`quota`** — packets needed to fill a bin, and therefore the percentage
  per match. Three in Act I, two afterwards.
- **`spare`** — extra clusters seeded beyond the quota. Currently 0
  everywhere: a mis-binned cluster scatters back to the grid unrefined and
  can be found again, so a file cannot be made unwinnable by a mistake.
- **`spacing`** — minimum clear cells between two clusters. 5 in Act I so a
  signature can be read in isolation, 4 in Act II, 3 in Act III. The board
  generator relaxes this if it cannot place everything, and `startLevel`
  re-seeds if any active temper ends up with no clusters at all.
- **`subtlety`** — multiplier on motion amplitude. Above 1.0 in the teaching
  files, down to 0.58 at COLD HARBOR.
- **`untimed` / `teaches`** — no shift clock; name the temper in the ticker
  on identification. Both on for CALIBRATION; `untimed` for the first three
  Act I files, and `teaches` for all four, so EMINENCE still names malice
  while running its clock.

## Lore and the archive

Each file releases one line — an addendum from the Perpetuity Wing — on
completion. The lines are ordered to track the acts: Act I's speak about
the temper that file taught, Act II's about telling feelings apart and
about being watched, Act III's about the files themselves and what they
might be for.

Completions are recorded in `localStorage` (`src/game/archive.ts`, under
its own key so a settings migration cannot wipe it) and the handbook
carries a **PERPETUITY WING · ARCHIVE** section listing all thirteen files:

- **DECLASSIFIED** — completed. Name, file code and the full addendum.
- **IN PROGRESS** — the file you are on. Name and code, addendum still
  sealed.
- **SEALED** — everything ahead. Name and code redacted, addendum redacted
  word by word, preserving word lengths, so it reads as a document that
  exists and is being kept from you rather than as an empty slot.

The counter at the top of the section (`n of 13 recovered`) is the closest
thing the game has to a save file, and survives across sittings.

The briefing screen reads the same archive: with any file refined, its
secondary action becomes **RESUME AT <file>** — one past the *furthest*
file completed, not the count, so skipping ahead once does not send you
back and replaying an early file does not lose your place. With an empty
archive it stays SKIP CALIBRATION.

## Verifying a change to the ramp

The invariants a change has to keep, all of them checkable from the level
data plus `createBoard`:

1. Every active temper seeds at least `quota` clusters, or its bin can
   never fill.
2. No cluster of an inactive temper is ever seeded — there would be no bin
   for it.
3. Every cluster has 4-9 members (4 is `MIN_CAPTURE`; below it a cluster
   cannot be marquee'd at all).
4. No cell belongs to two clusters.
5. Every pair of clusters is at least `spacing` cells apart in Chebyshev
   distance.
6. Act I covers each of the four tempers exactly once; Act II shows each of
   them in exactly two files.
