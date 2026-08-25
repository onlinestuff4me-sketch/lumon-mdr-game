# Incentives: the reward ladder, the forecast, and the reveal

> Status: **M1 and M2 shipped; the rest is plan.** The ledger, the ladder,
> the forecast and the reveal are in `src/game/progress.ts`,
> `src/game/rewards.ts`, `src/game/catalog.ts`,
> `src/components/IncentiveForecast.tsx` and
> `src/components/RewardReveal.tsx`. Six objects pop today; the fact cards,
> Wellness, the dance experience and the Waffle tiers wait their milestone
> and stay queued rather than being claimed unseen.
>
> This document is the bridge between `product-context/` — the imported
> product specification for MDR rewards, lore and media — and the game that
> actually ships. Where the two disagree, the disagreement is recorded here
> with the decision that resolved it, per the conflict-logging rule in
> `product-context/README.md`.

The product specification was written for a 50-file campaign whose bin counter
reaches 1,000. This game is **30 screens carrying 18 file names, and a complete
playthrough refines 105 groups**. Every threshold in the source documents has
therefore been rescaled. Nothing else about the proposal changes: rewards stay
deterministic, their requirement stays visible, and their identity stays sealed
until the moment they are earned.

The design rule behind everything here: **the player always knows what to do
next and never knows what they will get.** A refiner who has just finished a
screen should be able to answer "how far to the next incentive?" without opening
a menu, and should be unable to answer "what is it?" until it opens.

---

## Part 0 — Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Ladder scale | **Rescale to the game we have** | All eleven rewards become earnable on the 30 screens that exist. Extending the campaign to 50 files first would put every reward behind a content-authoring project. The lane tables below leave named headroom so a longer campaign extends them rather than renumbering them. |
| Forecast reveal | **After the first reward pops** | Screens 1–2 stay clean. The finger trap arrives with no warning, and the forecast appears immediately behind it carrying the next sealed goal. The system explains itself by having already paid out once. |
| Pacing unit | **Screens**, with named files as landmarks | Files are too coarse here: 18 names, and the first 13 screens share one. Screens give 30 rungs, which is where the density has to live. |
| Canon posture | **Reach for the show's own names first** | Recognition is the point: a refiner who spots something they know grins, and a grin is worth more than an original joke of equal quality. Where the show establishes a name, use it. Where it does not, write in the same register and record it as original. The one line that does not move is the audit's: an item the show only ever *mentions* can be named in text, never given an invented face. |
| Bin credit | **On file completion, once per file** | A file abandoned or failed credits nothing; replaying a file credits nothing a second time. Counters stay monotonic and cannot be farmed. |

---

## Part 1 — Definitions

Every counter below means exactly one thing. These definitions are load-bearing;
the forecast copy, the save file and the archive all read from them.

| Term | Definition | In code |
|---|---|---|
| **Screen** | One entry in `LEVELS`. There are 30. | `levelIndex` |
| **File** | A distinct `name` in `LEVELS`. There are 18; the 13 orientation screens share one. Files are landmark units, not counters. | `level.name` |
| **Bin** | One group correctly refined into its temper's bin. A full playthrough yields 105. Credited on file completion. | `quota × tempers.length` |
| **Perfect screen** | A screen completed with no rejected drop. | new per-screen flag |
| **Claim** | A reward moving from `earned_pending` to `claimed`. Idempotent: a reload mid-celebration re-presents, never re-awards. | new save field |

Screens 1–13 are ORIENTATION, 14 is BELLINGHAM, 15 is CALIBRATION, and 16–30 are
the three acts. Bin totals per screen come from the level table and are fixed:
screen 7 ends at 10 bins, screen 13 at 32, screen 20 at 53, screen 30 at 105.

---

## Part 2 — The launch ladders

Two lanes are visible at launch. Two more are held back (Part 3) so a player
learning to read a temper is never shown four counters at once.

### Lane A — SCREENS COMPLETED

| Screen | File | Reward | Size | Source threshold |
|---:|---|---|---|---|
| 1 | ORIENTATION | **R02 Finger Trap** | Minor | file 2 |
| 2 | ORIENTATION | **R01 Eraser** | Minor | file 1 |
| 3 | ORIENTATION | **R03 Outie Fact** I | Minor | file 3 |
| 5 | ORIENTATION | **R05 Melon Bar** | Minor | file 5 |
| 9 | ORIENTATION | **R06 Wellness I** — 3 facts | Major | file 9 |
| 13 | ORIENTATION (last) | **R07 MDE I** | Major | file 10 |
| 15 | CALIBRATION | **R08 Crystal Portrait Gift** | Major | file 12 |
| 17 | SUNSET PARK | **R03 Outie Fact** encore | Minor | file 13 |
| 20 | KINGSPORT | **R12 Egg Bar** | Minor | file 16 |
| 23 | MOONBEAM | **R13 Watermelon Remembrance** | Minor | file 17 |
| 24 | TUMWATER | **R06 Wellness II** — 4 facts | Major | file 18 |
| 26 | ALLENTOWN | **R07 MDE II** — abnormal | Major | file 24 |
| 28 | SIENA | **R19 Waffle Party I** — with 90 bins | Major | file 34 + 200 bins |
| 30 | COLD HARBOR | **R22 Waffle Party II** — with 105 bins, after R19 | Landmark | file 50 + 750 bins |

The first two swap the order the source documents give them. The finger trap
is the funnier object and the better hook: a thing that spins and traps a
finger says "this game gives you toys" in a way that a rubber eraser does
not, and the eraser lands harder second, as the joke about what Lumon
thinks a reward is.

Two further placements move against the source ordering, and both are
mechanical:

- **MDE I sits on screen 13**, the first screen carrying all four tempers, because
  the mini-game asks the player to tell tempers apart at speed. It is also the
  orientation graduation screen, which already runs a full ceremony — the number
  field the player has just mastered becoming a dance floor is the payoff that
  beat wants.
- **The crystal moves to screen 15**, where CALIBRATION names the four tempers and
  the player becomes a refiner proper. It reads as the commendation the source
  document intends without stacking a second major event onto screen 13.

### Lane B — BINS REFINED

| Bins | Lands on | Reward | Size | Source threshold |
|---:|---|---|---|---|
| 10 | screen 7 | **R03 Outie Fact** | Minor | bin 10 |
| 25 | screen 11 | **R03 Outie Fact** | Minor | bin 25 |
| 40 | DRANESVILLE (16) | **R05 Melon Bar** encore | Minor | bin 40 |
| 60 | LE MANS (21) | **R03 Outie Fact** | Minor | bin 60 |
| 75 | JESUP (25) | **R08 Crystal** variant — new engraving | Minor | bin 150 |
| 90 | SIENA (28) | satisfies the Waffle I bin condition | Micro | bin 200 |
| 95 | YAKIMA (29) | **R07 MDE** encore — bonus short session | Major | bin 100 |
| 105 | COLD HARBOR (30) | satisfies the Waffle II bin condition | Micro | bin 750 |

Bin 95 rather than 100: 100 would fall *inside* the final file and present at the
same boundary as Waffle Party II. At 95 it lands on YAKIMA, the file that redacts
audio — a music reward immediately after the silent file is the better joke.

### Density

Beats land on screens 1, 2, 3, 5, 7, 9, 11, 13, 15, 16, 17, 20, 21, 23, 24, 25,
26, 28, 29, 30. **The longest gap is two screens**, which is the cadence the
source specification asks for across the first 30% — held here across the whole
campaign. No two majors are ever adjacent.

The dropped encores — Wellness III, the egg-bar encore, the deeper bin rungs — are
the headroom. If the campaign grows past 30 screens, they slot back in above
105 bins without renumbering anything below.

---

## Part 3 — The held-back lanes

### Lane C — TEMPER MASTERY, revealed after screen 15

Per-temper ceilings are WO 27, FC 26, DR 27, MA 25, so the source document's
"25 of each" is only reachable on the final screen. Rescaled:

| Threshold | Reward |
|---|---|
| 10 bins of one temper | Doctrine card — runtime text on the R03 card plate, no new media |
| 20 bins of one temper | That temper's UI event (Woe's labels sag, Frolic's digits swap) |
| 20 bins of all four | **R06** balanced Wellness session — 4 facts |

These are minor and ambient by design, so they may share a boundary with a major
from Lane A or B without breaking the one-major rule.

### Lane D — PERFECT PLAY, revealed after the first perfect screen

| Threshold | Reward |
|---|---|
| First perfect screen | **R03 Outie Fact** — this is what reveals the lane |
| 3 perfect in a row | **R02 Finger Trap** variant |
| 5 perfect in a row | **R05 Melon Bar** encore |

### Lane E — RETURN, phase 2

The source document's resume lane needs a force-quit that a browser does not
have. The workable equivalent: a stored last-seen timestamp, incremented when
the terminal reopens after a gap of 10 minutes or more. Rewards at resumes 2, 4
and 8 are fact cards. Deferred until the four lanes above are shipped.

---

## Part 4 — The forecast

**Where it lives.** The file-completion panel already shows 100%, a praise line
and the declassified addendum. The forecast is one block beneath that, plus a
mirrored view in the handbook under the archive. No new HUD furniture: nothing
new competes with the number field during play.

**What it says**, computed at runtime, never authored per reward:

```text
NEXT INCENTIVE
17 / 20 SCREENS REFINED
Complete 3 more screens.
INCENTIVE DETAILS: CLASSIFIED
```

**What it must never say:** the reward's name, image, silhouette, category, colour
theme, rarity, file name, or any threshold beyond the next one in each lane. A
compound reward shows both counters and the line `BOTH CONDITIONS REQUIRED`.

**States:** `IN PROGRESS`, `EARNED`, `CLAIMED`. A reward earned while another is
presenting shows `EARNED — PRESENTATION PENDING` and keeps its own full reveal
when its turn comes. Collisions queue; they never merge and never drop.

---

## Part 5 — The reveal, and what happens when two arrive at once

### When a reward may appear

Only at a completion boundary: the screen is refined, the board is cleared,
and the next file has not begun loading. Never mid-file, never over a first
attempt at a new mechanic, never on top of another reward.

The thirteen orientation screens need one addition to make that true. They
carry no ceremony today — the engine holds `complete` for 900 ms and wipes
straight into the next screen. **An owed reward suspends that auto-advance.**
The cleared board stays where it is, the sealed card enters over it, and the
wipe into the next file does not start until the queue is empty. Nothing is
ever loading behind a celebration.

### The sequence, once

1. **Persist `earned_pending`** — before a single frame is drawn, so a force
   quit cannot lose or reroll the reward.
2. **Anticipation, 0.5–1.5 s** — the results clear, the room tone ducks, a
   sealed `INCENTIVE EARNED` card enters.
3. **Reveal** — the seal opens; name and media appear together, for the
   first time.
4. **Celebration, 5–8 s** for an object; longer for the dance experience and
   the Waffle tiers, both skippable after first viewing. Video where one
   exists, poster where it does not, still where motion is reduced — and a
   claim that never waits on media loading.
5. **Possession** — the reward enters the shelf with an `ACQUIRED` state,
   and `claimed` is written.
6. **Renewed anticipation** — the next sealed threshold appears immediately.

Every card carries a dismiss control from its first frame. Reduced motion
substitutes a clean fade, the still image and a short sound.

### When two arrive at once

A screen that also crosses a bin threshold earns two rewards on the same
boundary. This is designed for, not avoided — but it is never allowed to
read as one confused event.

- **They stack; they never merge and never drop.** Each keeps its own full
  reveal. The source specification is explicit about this, and DESIGN's
  worked example that merges two dance-experience rewards is the one place
  it contradicts itself; the queue wins.
- **The count is on the card.** From the first frame the header reads
  `INCENTIVE 1 OF 2`, so a dismissal never reads as the end of the payout.
- **One clears before the next enters.** The first card exits, a beat of
  cleared board, then the second enters — never a crossfade, never two
  rewards sharing a frame.
- **Order is fixed and published:** the screens lane before the bins lane,
  and within a lane, the lower threshold first. Deterministic, so two
  players who earn the same pair see the same order.
- **At most one major per boundary.** If the queue holds two major events,
  the second stays queued for the next completion boundary rather than
  running back to back. It is not lost and not re-rolled: the forecast shows
  `EARNED · PENDING` until it presents.
- **A reload mid-queue re-presents from the front.** `presenting` is not a
  resting state — the ledger reads it back as owed. This is already true in
  the code as of M1.

### What the player is never made to wait for

Non-skippable time is capped at 15 seconds per boundary, and the queue does
not extend that cap by stacking: the second card in a pair is skippable
immediately.

## Part 6 — State and saves

A new store, `lumon.mdr.progress.v1`, beside the existing settings, archive and
runs keys — never inside them, so a settings migration cannot wipe progress.
Reads and writes guarded like the others: storage throws outright in private
windows, and a lost ladder must never stop the terminal booting.

```text
screensCompleted        bins credited per file id (no double-credit on replay)
binsTotal               binsByTemper: { WO, FC, DR, MA }
perfectScreensTotal     perfectScreenStreak
rewardStatusById        locked | earned_pending | presenting | claimed
rewardQueue             seenFactIds
lastSeenAt              resumeCount
```

Rules: every counter except the streak is monotonic; claims are idempotent; a
version bump migrates already-satisfied thresholds into `earned_pending` rather
than silently marking them claimed. An absent store is a valid new player, not
an error.

---

## Part 7 — Media

The originals in `product-context/outputs/reward_media/` are reference material
and are never modified, renamed or recompressed. The build gets derivatives:

- hero plates re-encoded to WebP at two widths (the PNGs are 1.6–2 MB each; the
  site currently ships no binary media at all);
- the nine MP4s used as delivered — already H.264, 720×1280, 30 fps, no audio track;
- each video's reduced-motion still as its poster;
- **only the next classified reward preloaded**, and never in a way that exposes its
  identity in markup, filenames or network timing.

---

## Part 8 — The MDE, and the one open design call

The mini-game is the largest single piece of work here and gets its own milestone.
The source specification asks the player to "connect 3+ glowing numbers of one
temper and release on the beat" — but this game's atom is a *cluster* of four to
nine digits, selected with an 80 px probe and a marquee box. Connecting individual
digits would mean a new input model and ~20 px touch targets, against the 44 pt
minimum the same specification imposes.

**Proposal:** keep the specification's sentence and change its granularity. During
the MDE, whole clusters light on the beat; the player boxes three or more
same-temper clusters and releases inside a generous window; a valid release
collapses into a phosphor bloom and fills one of three Dance Meter segments. Same
instruction, same feel, zero new gestures, and every touch target stays the size
it already is.

Second constraint: temper colour is off by default in this game — clusters are
read by motion, sound and haptics. The MDE must light clusters by **motion and
brightness first**, with colour as the redundant channel it already is. The
supplied MDE reference images assume colour is always on; they are behaviour
references, not a palette instruction.

### The genre menu

Decided: **the show's names, as many as we can verify, led by `DEFIANT JAZZ`.**
This overrides the lore document's instruction to avoid the show's menu — the
grin of recognition is the reason the menu exists at all.

The list is built in that order of preference:

1. `DEFIANT JAZZ`, which the episode is named for and the scene establishes
   beyond doubt.
2. Every other genre legible on the on-screen MDE card. **Each one needs a
   frame check against the episode before it ships as canon** — a name
   remembered rather than verified is exactly the kind of invention the canon
   audit exists to catch, and a wrong one is a grin that curdles.
3. Original names in the same register to fill the menu out, recorded as
   original in production notes: `SANCTIONED POLKA`, `PERMITTED SWING`,
   `COMPLIANT CALYPSO`, `SUPERVISED DISCO`.

Repeat visits unlock another selection rather than a voucher prop, and picking
the same genre three times earns the `PREFERENCE DETECTED` warning.

---

## Part 9 — Sequencing

Each milestone ends with something a player can see working.

| # | Milestone | Player-visible result |
|---|---|---|
| M1 | Counters, save store, forecast surface — **shipped** | Finishing a screen shows real progress toward a sealed goal |
| M2 | Reveal sequence + the six image/video rewards of Lane A — **shipped** | The eraser, finger trap, melon bar, egg bar, watermelon and crystal all pop, stack when two land together, and hold the board while they do |
| M3 | The incentive shelf | Claimed objects can be found and inspected again, instead of being seen once |
| M4 | Wellness — fact bank, cards, captions, speech | Fact cards typeset at runtime, captioned, with speech optional |
| M5 | MDE I and the office-scene handoff | The number field becomes a dance floor and returns cleanly |
| M6 | Lanes C and D; then Waffle tiers | Mastery counters appear as the game widens; the campaign ends on the ritual |

Easter eggs — the department paintings, goats, Testing Floor flashes, Board
presence, the wrong-bin track, Lexington — are a separate hidden scheduler and a
separate document. They must never appear in the forecast, and no undiscovered
one may occupy a locked slot.

---

## Part 10 — Deviations from `product-context/`, recorded

| Source finding | Resolution here |
|---|---|
| B1, B3 — four rewards past the end of the campaign; bin ladder needs 1,000 | Both ladders rescaled to 30 screens / 105 bins (Parts 2–3) |
| B2 — "file" ambiguous across 13 orientation screens | Screens are the counter; files are landmarks (Part 1) |
| B4 — twelve-screen tutorial is thirteen screens here | Lane A maps to screens, so the shape follows the build; the source's screen 9–12 payload lands on 9–15 |
| B5 — no counters exist | New store and migration rules (Part 6) |
| B6 — the specs have no fail state | Bins credit on completion only; a failed or abandoned file credits nothing (Part 0) |
| B7, B8 — MDE assumes always-on colour and per-digit taps | Cluster granularity, motion-first lighting (Part 8) |
| B10 — the game ships no media files | Derivative pipeline, originals untouched (Part 7) |
| D1 — the 60-bin fact card exists in three documents and not the lore doc | Kept at 60; the lore doc's 64 is a separate hidden beat and stays hidden |
| D2 — DESIGN's collision example merges two MDE rewards | Queue, never merge — the PRD, lore doc and manifest all agree against it (Part 4) |
| D4, D5 — temper lane half-specified, two answers for when it appears | Rungs at 10 and 20 per temper, lane revealed after screen 15 (Part 3) |
| D6 — two save vocabularies | One schema, this one (Part 6) |
| D3 — MDE genre names: the show's menu, or written for this branch | The show's, led by `DEFIANT JAZZ`, verified by frame check; originals fill the rest (Part 8) |

No source conflict is left open. The standing posture in Part 0 settles the
general case: where the show establishes something, this game uses it.
