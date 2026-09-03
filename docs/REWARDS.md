# Incentives: the reward ladder, the forecast, and the reveal

> Status: **shipped, all six milestones.** Twenty-eight rungs across four
> lanes, every one of them earnable in a full playthrough and every one of
> them with something to present. The code is `src/game/rewards.ts`,
> `progress.ts`, `catalog.ts`, `facts.ts`, `mde.ts` and the four components
> `IncentiveForecast`, `RewardReveal`, `IncentiveShelf` and `MdeStage`.
>
> This document is the bridge between `product-context/` — the imported
> product specification for MDR rewards, lore and media — and the game that
> actually ships. Where the two disagree, the disagreement is recorded here
> with the decision that resolved it, per the conflict-logging rule in
> `product-context/README.md`.

The product specification was written for a 50-file campaign whose bin counter
reaches 1,000. This game is **23 files across 29 screens, and a complete
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
| Ladder scale | **Rescale to the game we have** | All eleven rewards become earnable on the 23 files that exist. Extending the campaign to 50 files first would put every reward behind a content-authoring project. The lane tables below leave named headroom so a longer campaign extends them rather than renumbering them. |
| Forecast reveal | **After the first reward pops** | Screens 1–2 stay clean. The finger trap arrives with no warning, and the forecast appears immediately behind it carrying the next sealed goal. The system explains itself by having already paid out once. |
| Pacing unit | **Screens**, with named files as landmarks | Files are too coarse here: 18 names, and the first 13 screens share one. Screens give 30 rungs, which is where the density has to live. |
| Canon posture | **Reach for the show's own names first** | Recognition is the point: a refiner who spots something they know grins, and a grin is worth more than an original joke of equal quality. Where the show establishes a name, use it. Where it does not, write in the same register and record it as original. The one line that does not move is the audit's: an item the show only ever *mentions* can be named in text, never given an invented face. |
| Wellness voice | **Nothing is spoken** | The fact bank assumes cached voice recordings; the browser's own speech synthesis stood in for them, and in play it sounded like a robot reading a card rather than a wellness counsellor reading a file. A wrong voice is worse than no voice. The sentence is typeset on the card and captioned, which is what the specification actually requires of it; a recorded performance can be added later without changing anything else. |
| Bin credit | **On file completion, once per file** | A file abandoned or failed credits nothing; replaying a file credits nothing a second time. Counters stay monotonic and cannot be farmed. |

---

## Part 0b — The vocabulary this document uses

Since the flow rework, three words are load-bearing and are defined in
`src/game/lexicon.ts` rather than remembered:

- **Incentive**, never "reward". Nothing a refiner reads says *reward*.
  Lumon issues incentives. The code keeps `RewardId` and `rewards.ts`
  because code is not read by refiners.
- **File** is what the refiner is told they are refining, and what this
  ladder counts. A file is one or more *stages*: the orientation lessons
  are two or three screens each, and the header meter fills across the
  whole lesson rather than resetting inside it. It is not a verb for
  putting something away.
- **Keep** is what a refiner does with an incentive. `KEEP INCENTIVE`,
  `4 KEPT`, `ISSUED AGAIN · KEPT`.

`docs/DESIGN_SYSTEM.md` Part 6 is the full reserved-word list, and the rest
of the system it belongs to.

---

## Part 1 — Definitions

Every counter below means exactly one thing. These definitions are load-bearing;
the forecast copy, the save file and the archive all read from them.

| Term | Definition | In code |
|---|---|---|
| **Screen** | One entry in `LEVELS`. There are 30. | `levelIndex` |
| **File** | One or more adjacent levels sharing a `fileKey`. There are 23: six orientation lessons of one to three stages each, and seventeen named files of one stage. This is the unit the screens lane counts. | `level.fileKey` |
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

### The cadence, measured

Generated from a clean playthrough, and the answer to "am I getting these
often enough". Every row is a screen on which something was earned:

| Screen | File | | Screen | File | | Screen | File |
|---:|---|---|---:|---|---|---:|---|
| 3 | 1 · finger trap | | 13 | 7 · handbook note | | 22 | 16 · remembrance melon |
| 5 | 2 · eraser | | 14 | 8 · MDE + melon bar | | 24 | 18 · Wellness II |
| 7 | 3 · outie fact ×3 | | 16 | 10 · portrait ×3 | | 25 | 19 · portrait |
| 9 | 4 · melon bar | | 17 | 11 · handbook note | | 26 | 20 · MDE |
| 11 | 5 · fact + trap | | 18 | 12 · fact + note | | 27 | 21 · Wellness |
| 12 | 6 · Wellness I | | 20 | 14 · egg bar | | 28 | 22 · Waffle I |
| | | | 21 | 15 · outie fact | | 29 | 23 · Waffle II |

**The longest run of screens paying nothing is two**, and it is screens 1
and 2 — before the first file has been finished at all. After that it is
never more than one. Every one of the six orientation files pays.

A screen-by-screen cadence is the number that matters, not a per-file one:
a refiner counts screens, because a screen is what they just did.

### Two things that make it *feel* less often than it is

1. **A stage is not a file.** The orientation files are two and three
   stages, so the counter can sit still across a screen. The *bar* does
   not: it carries the part-file, so every screen visibly buys something
   even when the number does not move.
2. **A replayed file earns nothing.** Counters are monotonic and credit
   once — correct, and it was being reported as though it were not. A
   refiner who came back to a save and walked back through orientation
   watched `REFINE 2 MORE FILES` sit unchanged for a dozen screens,
   because every one of those files was already in the ledger. The record
   now says `THIS FILE IS ALREADY REFINED` instead of repeating an
   instruction that cannot work.

### Lane A — FILES REFINED

| File | Name | Reward | Size | Source threshold |
|---:|---|---|---|---|
| 1 | ORIENTATION (3 stages) | **R02 Finger Trap** | Minor | file 2 |
| 2 | ORIENTATION (2) | **R01 Eraser** | Minor | file 1 |
| 3 | ORIENTATION (2) | **R03 Outie Fact** I | Minor | file 3 |
| 4 | ORIENTATION (2) | **R05 Melon Bar** | Minor | file 5 |
| 5 | ORIENTATION (2) | **R03 Outie Fact** | Minor | — |
| 6 | ORIENTATION (last) | **R06 Wellness I** — 3 facts | Major | file 9 |
| 7 | BELLINGHAM | **R03 Outie Fact** | Minor | — |
| 8 | CALIBRATION | **R07 MDE I** | Major | file 10 |
| 9 | DRANESVILLE | **R03 Outie Fact** | Minor | — |
| 10 | SUNSET PARK | **R08 Crystal Portrait Gift** | Major | file 12 |
| 11 | CAIRNS | **R03 Outie Fact** | Minor | — |
| 12 | EMINENCE | **R03 Outie Fact** encore | Minor | file 13 |
| 13 | KINGSPORT | **R03 Outie Fact** | Minor | — |
| 14 | LE MANS | **R12 Egg Bar** | Minor | file 16 |
| 15 | LONGBRANCH | **R03 Outie Fact** | Minor | — |
| 16 | MOONBEAM | **R13 Watermelon Remembrance** | Minor | file 17 |
| 17 | TUMWATER | **R03 Outie Fact** | Minor | — |
| 18 | JESUP | **R06 Wellness II** — 4 facts | Major | file 18 |
| 19 | ALLENTOWN | **R03 Outie Fact** | Minor | — |
| 20 | NANNING | **R07 MDE II** — abnormal | Major | file 24 |
| 21 | SIENA | **R03 Outie Fact** | Minor | — |
| 22 | YAKIMA | **R19 Waffle Party I** — with 90 bins | Major | file 34 + 200 bins |
| 23 | COLD HARBOR | **R22 Waffle Party II** — with 104 bins, after R19 | Landmark | file 50 + 750 bins |

**Every file pays.** The nine rows marked `—` are not in any source
document; they were added after a refiner finished ORIENTATION #0005, read
`INCENTIVE EARNED` on the panel, and was handed nothing at all. The ladder
stepped 4, 6, 8, 10 and left the odd files empty, and a file that pays
nothing is a file whose ceremony is a shrug.

An Outie fact is the right thing to fill them with. The bank holds
forty-eight sentences and the campaign is twenty-three files, so there is
no scarcity to ration; they are the cheapest thing in the game to give;
and they are the incentive playtesters actually quote back. A data
invariant asserts that no file count between 1 and the last is missing a
rung.

The first incentive is a *file*-completion incentive, which is why the
first orientation lesson is three stages rather than four: each stage
moves the header meter a third, the third one completes the file, and the
finger trap arrives. Three screens is as early as a payout tied to
finishing something can be made to land.

The rung ids (`S01`, `S05`, `S30`) are historical — the number was the
threshold back when the lane counted levels. `at` is the threshold; the id
is only a name, and it is in every save on every phone, so it does not
move.

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
the headroom. If the campaign grows past 23 files, they slot back in above
105 bins without renumbering anything below.

---

## Part 3 — The held-back lanes

### Lane C — TEMPER MASTERY, revealed after screen 15

Per-temper ceilings are WO 27, FC 26, DR 27, MA 25, so the source document's
"25 of each" is only reachable on the final screen. Rescaled:

| Threshold | Reward |
|---|---|
| 10 bins of one temper | Doctrine card — that temper's own line, typeset on the R03 plate, no new media |
| 20 bins of all four | **R06** balanced Wellness session — 4 facts |

The 20-per-temper rung in the source plan was a UI event (Woe's labels sag,
Frolic's digits swap). That is engine work rather than reward work, and it
belongs with the temper storms rather than with the incentives; it is not in
this ladder and is not counted as shipped.

These are minor and ambient by design, so they may share a boundary with a major
from Lane A or B without breaking the one-major rule.

### Lane D — PERFECT PLAY, never announced

| Threshold | Reward |
|---|---|
| First perfect file | **R03 Outie Fact** |
| 3 perfect in a row | **R02 Finger Trap** variant |
| 5 perfect in a row | **R05 Melon Bar** encore |

**This lane is never forecast.** `laneVisible("perfect")` is false, so
nothing on any screen ever reads `REFINE 1 MORE FILE WITHOUT ERROR`. That
instruction failed both tests a goal has to pass: a refiner cannot do it on
purpose — nobody knows which drop will be the wrong one — and a single
mistake makes it unreachable, so the board goes on asking for something
already gone. Clean play pays out unannounced, the way the first two
incentives do.

A file counts toward the run only if it had **more than one bin on the
deck** *and* was past the teaching (`training`). A one-bin file cannot be
mis-binned, so finishing it cleanly is arithmetic rather than precision;
and orientation is where mistakes are supposed to happen, so a wrong bin
there gets the red line at the top of the board and nothing else — it
starts no run, ends none, and costs no incentive. Sixteen files qualify.

**A missed incentive is rescheduled, not lost.** When a run closes, the
next unearned precision rung goes into `deferredRungs` with a file count
two files out. From then on it stops reading the streak entirely and is
issued when that count is reached, however those files are refined. The
card that eventually opens says `RESCHEDULED INCENTIVE · N FILES REFINED`
rather than naming a record the refiner knows they broke.

### Lane E — RETURN, phase 2

The source document's resume lane needs a force-quit that a browser does not
have. The workable equivalent: a stored last-seen timestamp, incremented when
the terminal reopens after a gap of 10 minutes or more. Rewards at resumes 2, 4
and 8 are fact cards. Deferred until the four lanes above are shipped.

---

## Part 4 — The forecast

**Where it lives.** The file-completion panel already shows 100%, a praise line
and the declassified addendum. The forecast is one block beneath that, plus a
mirrored view in the handbook under the archive, and — since the flow
rework — a permanent two-line strip in the header. That strip is the one
piece of furniture the incentive system adds to the playing screen; it is
deliberately dense and dim, and it is the only thing in the header that
takes a tap.

**What it says**, computed at runtime, never authored per reward:

```text
NEXT INCENTIVE                 CLASSIFIED
REFINE 3 MORE FILES
▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  17/20
```

**What it must never say:** the reward's name, image, silhouette, category, color
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

**And never before the file is seen to finish.** The last packet credits
its bin and completes the file on the same frame, while the bin meter and
the header meter still have 300 ms of animation left to run and the absorb
flight has 450 ms. A card keyed to the completion alone lands on top of all
three: the refiner does the work and never watches it land. The engine
therefore holds a completed board for **600 ms** — `SETTLE_S` — and
publishes `settled` on the HUD snapshot. Every end-of-file overlay waits on
it: the card, the file panel, and the closed-record notice alike. Both
meters pulse once as they reach their ends, so the arrival is an event
rather than a value that was already there.

A screen that advances itself waits for `max(SETTLE_S, autoAdvanceMs)`, so
the settle can never be cut short by a wipe and, at today's 900 ms, costs
nothing.

The orientation stages need one addition to make that true. A stage that
is not the end of its file carries no ceremony — the engine holds `complete` for 900 ms and wipes
straight into the next screen. **An owed reward suspends that auto-advance.**
The cleared board stays where it is, the sealed card enters over it, and the
wipe into the next file does not start until the queue is empty. Nothing is
ever loading behind a celebration.

### The sequence, once

1. **Persist `earned_pending`** — before a single frame is drawn, so a force
   quit cannot lose or reroll the reward.
2. **Anticipation, 0.5–1.5 s** — the results clear, the room tone ducks, a
   sealed `INCENTIVE EARNED` card enters.
3. **Reveal** — the seal *parts*: two halves of an opaque lid split on a
   bright seam and retract off the plate over 700 ms, which is slow enough
   to watch. The plate was fetched into the browser's cache while the card
   sat sealed and has never been in the document. Name and media appear
   together, for the first time.

   The headline is *typed over* as the lid retracts. "YOU'VE EARNED AN
   INCENTIVE" is backspaced away and the name of the thing is written in
   its place, a character at a time, with a block caret blinking under the
   cursor. A line that changes meaning is retyped, never swapped — this is
   a terminal, and a terminal has no cross-fade
   (`src/hooks/useTypeOver.ts`).

   Then, and only then, the **second beat**: the caption band under the
   plate opens, sliding the control down with it, and the line is typed
   into the space as the space appears. While sealed that band is closed
   and the control sits directly under the plate — the card used to reserve
   a hand's width of nothing there for text that had not been written yet,
   which was the largest gap on the screen and held the emptiest thing on
   it. The band is paid for by a tail below the control that gives up
   exactly what the band takes, so the card's height never changes.

   Tapping during either beat lands the whole opening at once. Watching is
   never the price of continuing.

   Nothing on the card may move when this happens. Every band — the label,
   the title, the plate, the caption — is a fixed height, and the plate
   frame is a fixed 9:16 in both states, which is the aspect every poster
   is authored at. A card that re-centers itself on the frame the picture
   arrives is a card that jitters at exactly the moment the refiner is
   looking hardest.
4. **Celebration, 5–8 s** for an object; longer for the dance experience and
   the Waffle tiers, both skippable after first viewing. Video where one
   exists, poster where it does not, still where motion is reduced — and a
   claim that never waits on media loading.
5. **Possession** — the reward enters the shelf with an `ACQUIRED` state,
   and `claimed` is written.
6. **Renewed anticipation** — the next sealed threshold appears immediately.

Every card carries a dismiss control from its first frame. Reduced motion
substitutes a clean fade, the still image and a short sound.

### How the terminal draws these

A cathode-ray tube does not fade things in. It strikes a line across the
middle of the screen and lets it bloom outwards, and it loses signal the
same way in reverse. Every overlay in the incentive sequence enters on that
vocabulary — `crt-open` unfurls the panel from a bright horizontal line,
`crt-band` runs the leading edge of the sweep down it once, `crt-resolve`
lets the content settle a beat behind the beam — so a reward that appears
reads as this terminal drawing it rather than as a web page swapping a div.

The sealed lid carries its own notice — `SEALED`, and directly under it
*"The contents of this incentive remain classified until it is opened."*
The notice belongs on the thing it describes: said under the card it was
one more line of small print, and said on the lid it is the lid explaining
itself, and it leaves with the lid.

The one control on each of these screens throbs (`crt-throb`, a 1.9 s
breath on the glow, not a blink). It is the only thing on the screen that
does anything, and a refiner who does not know that is a refiner sitting in
front of a card that appears to have stopped. Every one of these keyframes
has a `prefers-reduced-motion` variant that flattens it to its end state.

### Three kinds of plate

The picture on an incentive is drawn by one component (`RewardPlate`), in
both places a refiner sees it — the card that opens, and the shelf in the
handbook. Two implementations drift, and the drift reads as *the thing on
my shelf is not the thing I was given*.

| Kind | Plate | Why |
|---|---|---|
| Object, experience | A photograph | Its identity **is** its picture: the eraser, the finger trap, the melon bar, the office floor. |
| Outie fact, Wellness session | The blank card, with the sentence typeset over it at runtime | The sentence is the payload; the card is only the thing it is printed on. A generated picture cannot be trusted to spell. |
| Doctrine (R04) | A **handbook page**, drawn rather than photographed | A passage from a book should look like a book. |

**A Wellness session is several Outie facts, so it is drawn as several
Outie facts** — the same card on the same stand, one sentence at a time,
paged `1/3`. It used to open on a photograph of an empty wellness room
with the fact in small green italics underneath, which put the whole of
what a refiner came for in the caption, under a chair.

**Doctrine is not a fact about your outie and no longer looks like one.**
The temper milestones read a passage from the handbook; that page is CSS,
not an asset — warm paper, a serif, a rule under the running head, a drop
cap, and a gutter shadow down the bound edge so it reads as the right-hand
page of an open book. Drawn rather than photographed, the type is crisp at
280px and the sentence can be any length.

**The band under a plate reserves three lines**, and clips in silence past
them. Four catalog lines had drifted over it and were being cut mid-word
on the card. A data invariant now caps every `line` at 96 characters.

### When two arrive at once

A screen that also crosses a bin threshold earns two rewards on the same
boundary. This is designed for, not avoided — but it is never allowed to
read as one confused event.

- **The seal announces the whole payout.** One sealed card per boundary,
  reading `3 INCENTIVES EARNED`, and its control reads `ACCEPT ALL 3`.
  Re-sealing between cards made three rewards feel like three
  interruptions.
- **Nothing opens itself.** The seal waited 900 ms and then opened on a
  timer once; a refiner who looked away missed the only moment the card
  existed. It waits to be tapped, however long that takes.
- **They stack; they never merge and never drop.** Each keeps its own
  reveal, numbered `INCENTIVE 2 OF 3`, and one clears before the next
  arrives — never a crossfade, never two rewards sharing a frame.
- **At most one major per boundary.** A second waits for the next screen
  rather than running back to back, and shows `EARNED · PENDING` until it
  does.
- **A reload mid-queue re-presents from the front.** `presenting` is not a
  resting state — the ledger reads it back as owed.

### What is never shown twice in a row

Watching someone reach screen 9 and be handed the same photograph three
times settled these. All four are enforced where the queue is turned into
a running order, so they hold however the ladder is rearranged later.

1. **A sentence is not a picture.** Anything whose payload is the words on
   it — a fact card, a Wellness session — is exempt from every rule below.
   Two of them in a row are two different things said; two melon bars in a
   row are the same photograph twice.
2. **Never the same picture twice in a row**, nor the same reward twice in
   one boundary, nor the reward that ended the last boundary — so the
   spacing survives across files rather than only within one.
3. **At most one major event per boundary.** A second waits for the next
   file rather than running back to back.
4. **An object already on the shelf is not shown again.** A second finger
   trap is still owed, still counted, and still appears on the shelf as
   `×2` — but a repeat of the same photograph is the game repeating
   itself. It is kept without a card, and the end-of-file panel names it:
   `FINGER TRAP ISSUED AGAIN · KEPT`.

And above all of them, the guarantee: **a queue that is not empty always
hands something over.** Rule 1 exists because rules 2 and 3 did not have
it. A refiner finished a file, the panel said `INCENTIVE EARNED` because
one rung was owed, and the spacing rule deferred it for being the same
*kind of card* as the last one — so the boundary promised an incentive and
produced none. Whatever the spacing rules would rather do, the first thing
in the queue is shown rather than nothing.

All of this lives in `src/game/present.ts` rather than inside the screen
that draws it, because a spacing rule is exactly the sort of thing that
goes wrong two boundaries later, invisibly, in a way no screenshot of one
screen can show. It is tested there.

### Where it goes: the incentives record

An accepted incentive does not vanish, and the record it goes into is not
a thing the refiner has to be told about. It is in the header, on every
screen, for the whole game:

```text
INCENTIVES RECORD                        4 KEPT ›
REFINE 1 MORE FILE   ▓▓▓▓▓▓░░░░░░░░░░      1/2
```

It is not furniture any more, and it is not a box. Two bordered progress
widgets stacked in the footer — the file's and the incentives record's —
was one too many, and the second one was answering a question the refiner
had not asked while they were mid-file. The record is now a **line inside
the file card**: what reaching 100% will buy, and a link to the rest.

It appears only once the first incentive has been kept. A refiner who has
never been issued one is not told one is coming — the first two arrive
unannounced, which was always the design, and the ladder introduces itself
once it has already paid out.

The old box survives as `IncentiveRecordBox`, drawn on the end-of-file
panel and in the comparison layouts, where it is the only progress object
on screen and has nothing to compete with.

(The rest of this section describes that box, which still ships on the
end-of-file panel and in the comparison layouts.) The bar adds the
part-file in progress, so every screen of a multi-stage file visibly buys
something even though the *number* only moves on whole files. Two rules keep that honest: the part-file is zero once the file has
been credited — it is already inside the whole count, and adding it again
filled the bar while the number beside it still said `2/3` — and the bar
may never read 100% unless the count does.

### The meter measures the stretch, and resets only after it fills

Every incentive meter in the game draws `(current − from) / (target −
from)`, where `from` is the last threshold the refiner is already past.

Drawn the obvious way — the running total against the next target — the
bar *falls* at the exact moment of success. Watch the first incentive, due
after one file: three quarters of the way through that file the strip read
`0/1` at 75%; the last packet landed, `filesCompleted` ticked to 1, the
forecast stepped to the two-file rung, and the bar dropped to 50% while
saying `1/2`. The refiner had just succeeded and the meter went backwards.

Measured against the stretch, the same moment reads `0/1 → 1/1`, full.

The second half of the rule is that the strip is **owed-aware**: while a
rung sits earned-but-unkept in the queue, the row shows *that* rung rather
than the next promise, and says `INCENTIVE EARNED`. So the meter fills,
holds at full through the card and the summary, and resets to an empty
stretch only once the page has docked in the record — behind the ceremony,
next to the glow, reading as a fresh goal rather than as lost progress.
`forecast(counters, owed)` takes the queue; the forward-looking pages, which
are about what comes next rather than about this moment, do not pass it.

Both numbers beside the bar are now the same quantity as the instruction:
`1/2` next to REFINE 1 MORE FILE. The lifetime total is a different
measurement and gets its own line in the full record — `44 IN ALL · LAST
INCENTIVE AT 40` — rather than sharing the line with the target. It sits above the input surface
so it can be tapped over a live board, and the header around it is
`pointer-events-none` so a packet dragged to the top edge stays grabbable.

The same component draws the card on the end-of-file panel, which covers
the header — one object, two shapes, so a refiner who learns one has
learned both (`IncentiveRecordBox`).

### The summary, which is where the teaching happens

Keeping is not a transition back to the board. It is its own screen, and it
exists because four questions arrive at that moment and at no other. They
are answered in the order they are asked, top to bottom:

| # | Question | What answers it |
| --- | --- | --- |
| 1 | What is this screen? | `INCENTIVES RECORD` — the same title as the header strip, said first, so the rest of the page has a name to hang on. |
| 2 | What did I just get? | Named. "An incentive" is not a thing anyone remembers owning; a finger trap is. |
| 3 | What does that make in total? | Progress per category — ten issued items, ten outie facts, three wellness sessions, five department events — counted in payouts, ticking up under the refiner's eye. Which is why the screen takes both the ledger before the payout and the ledger after it. |
| 4 | Where is everything else? | `VIEW ALL INCENTIVES`, into the full record. |
| 5 | What earns the next one? | One instruction, from the nearest lane, with its meter and its raw numbers. |

Question 5 is **last, bordered, and the brightest thing on the page**, under
a heading that says plainly that another one is coming and a line saying
how many files are left to it. Everything above it is a receipt for work
already done; this is the only object on the screen that is about work
still to do, and it was previously buried mid-page in the same weight as
the receipt.

Rows are drawn from the ledger *after* the payout, not before. The row a
refiner most needs to watch move is precisely the one that was at zero a
second ago, and filtering on the old ledger left the first incentive of a
category with no bar to arrive in. Rows show the count *as it stands*, so a
new one opens at `0` and ticks to `1` under the eye. Categories empty in
both ledgers stay off entirely: a row reading `0 OF 5 DEPARTMENT EVENTS` on
the first file is a promise this screen has no business making, and the
full record is where the scale of what is left is admitted.

### The incentive is followed the whole way

Both ends of this screen are teaching, and a teaching animation that plays
in a third of a second has taught nobody. Each one is a sequence of
separated beats rather than one blur, and each beat is one statement.

**Coming in — the incentive is put away.** Four beats, about two seconds:

| | Beat | What it says |
| --- | --- | --- |
| 1 | The card folds down into a **file** (460 ms) | It went into a folder |
| 2 | The summary catches that same file and *holds* it (300 ms) | The folder is on this shelf now |
| 3 | The file walks into the category row it moved (720 ms) | This is the shelf it belongs on |
| 4 | `+1` rises off the row, the count ticks, the bar grows, the row lights (`meter-take`) | The shelf is one fuller |
| 5 | *Only then*: the next goal and the way back fade up together | And here is the next one |

Beat five is the point of beats one to four. Until the filing has finished
— the file landed, the count ticked, the `+1` risen — the page shows
nothing below the shelf rows: no `ANOTHER INCENTIVE IS COMING`, no `RESUME
REFINEMENT`. The receipt and the promise are two subjects, and putting them
on screen together asks the refiner to read both and lets them read
neither. Their space is reserved rather than collapsed, so nothing above
jumps when they arrive.

The hold in beat 2 exists because the file arrives on the same frame the
page does, and a refiner who has just tapped a button is not yet looking at
a shelf. The `+1` exists because the bar growing is the *proof* and a
refiner reads a claim faster than they read a bar.

The scrim behind this page is opaque from its first frame and deliberately
not animated. It used to unfurl along with its contents, so for two frames
the board flashed through between the card folding away and the page
arriving — a glitch at the exact moment the handover had to be seamless.

**Going out — the record is put away.** Three beats, about two seconds:

| | Beat | What it says |
| --- | --- | --- |
| 1 | The page packs itself down: a frame draws around it, it compresses, and everything but the title dims (420 ms) | This screen is one object |
| 2 | It flies into the strip in the header and shrinks the rest of the way, scrim lifting as it goes (780 ms) | And it lives *there* |
| 3 | The strip blooms once (`record-dock`) and its kept count ticks up | Which is where you go to open it again |

The one thing left bright while it flies is the words `INCENTIVES RECORD`,
which are also the first words on the box it lands in. That is the whole
teaching: a refiner has to see the label leave and see the label arrive, or
the landing says nothing about where the screen went.

The header strip is held at the **pre-payout** ledger for as long as the
summary is on screen, so its count ticks up on the frame the page lands in
it rather than silently behind the scrim. The box is covered for all of
that time; the one frame it is not is the frame it changes.

The file is one component (`FileGlyph`) drawn at every stage on purpose.
Two similar rectangles read as two objects, and the whole point of the
chain is that it is one.

It is also drawn to be **followable**. Released over a fully drawn record
page it was lost immediately — a small bright rectangle among a dozen
bright rectangles. It now travels on a radial dark plate of its own, at
54px with a doubled rim-and-bloom shadow, breathing; the page behind it is
held at a quarter brightness until it lands; and the two things it concerns
— the words INCENTIVES RECORD and the shelf row it is aimed at — stay lit
while everything else is held down. Opacity nests, so that veil is applied
to each element the file is *not* going to, never to a wrapper around all
of them.

**A file that pays out ends on this screen, and only this screen.** The
`FILE REFINED` panel is suppressed for that boundary and `RESUME
REFINEMENT` goes straight to the next file. The panel says what the summary
already said — what was kept, what it counts toward, what earns the next
one — so showing both made the refiner dismiss two screens in a row, and
gave the summary a panel to land in rather than the record it belongs in.
The panel is for files that ended with nothing to show. The last file keeps
its panel regardless: it says `COLD HARBOR IS COMPLETE` and offers a new
quarter, which is not something a summary page can stand in for.

There is deliberately no paragraph explaining any of this. An earlier
version had one — *"Your record is held at this terminal and appears at the
foot of every file"* — and it was both true and unnecessary, because the
screen demonstrates it.

This matters most on the orientation stages, which carry no
ceremony and wipe 900 ms after clearing. Before the summary existed, an
early incentive shrank into a block that appeared for half a second and
left with the screen, on precisely the files where the ladder pays out
hardest.

### The full record

One tap from the strip, from the summary, or from the handbook. It opens
**above every other overlay** (`z-80`) and its header is pinned: it shared
`z-70` with the summary and lost on document order, so `VIEW ALL
INCENTIVES` opened the record *behind* the page that offered it and
appeared to do nothing at all — and because the drawer opens scrolled to
the shelf, the only way out was three screens above the refiner. A way back
has to be on the screen it is needed on.

Under that header is a pinned row of section tabs — REFINE · TEMPERS ·
INCENTIVES · ARCHIVE · SETTINGS — because the handbook is long, it opens
scrolled to whichever section was asked for, and every other section was
otherwise a blind scroll away. The lit tab follows the *scroll position*
rather than the last tap: a nav that only updates when you use it is a nav
you stop trusting. The sheet itself is 94% of the screen; at 82% a third of
the page was scrim above a drawer whose own content ran off the bottom,
which is dead space paid for twice. Four
sections, one per category, each with its own meter; every payout kept is a
named row, and every payout still to come is a row reading
`CLASSIFIED · NOT YET ISSUED`.

This is the only screen in the game that admits there is more coming. It
says how *many* and never what they are — a concealed slot carries no name,
no silhouette, no plate, and no hint of category beyond the section it sits
in. That is the whole of the compromise: a refiner may know how far through
they are, and may never know what is next.

### When a record closes

A wrong bin that ends a run of clean files takes its own beat — the same
hold an incentive takes, because it is the same news pointing the other
way. It cannot live on the file panel: most of orientation advances itself
900 ms after clearing, and a notice that wipes with the screen is a notice
nobody read.

The copy stays inside Lumon's vocabulary — the refiner has a **record** and
it was **unblemished**, and nothing here is a streak or a scoreboard — but
the screen is deliberately not only bad news. Told an incentive is gone and
left there, a refiner has been punished for a slip. Told it has been
*rescheduled* to a file count they can reach by refining files, they have
been given the truth and the way back in the same breath:

> **AN INCENTIVE HAS BEEN MISSED**
> A temper was consigned to a bin that did not want it. Your unblemished
> record stood at 2 files and now stands at none, and the incentive it was
> earning could not be issued for this file.
> It has not been withdrawn. It has been rescheduled, and will be issued
> when 2 more files have been refined.
> No incentive already kept has been withdrawn. Lumon does not take things
> back.

The number is read from the reschedule the ledger actually wrote, so the
screen cannot promise a milestone the ledger is not holding. And it is said
in **files refined**, not files refined without error: the rescheduled
incentive no longer asks for a clean one, and repeating the condition that
was just broken would be asking for the impossible twice.

This never fires inside orientation.

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
deferredRungs           rung id -> the filesCompleted that will issue it
lastSeenAt              resumeCount
```

Rules: every counter except the streak is monotonic; claims are idempotent; a
version bump migrates already-satisfied thresholds into `earned_pending` rather
than silently marking them claimed. An absent store is a valid new player, not
an error.

### A new save is a new save

The ledger and the archive of refined files are **scoped to the run**, not to
the browser: the real keys are `lumon.mdr.progress.v1.<runId>` and
`lumon.mdr.archive.v1.<runId>`, resolved through `src/game/runScope.ts`. They
were global once, so starting a new save handed the refiner a terminal that
already knew every file they had ever refined and every incentive they had
ever kept — with nothing left to earn and a record that would not move.

The scope is set in one place, whenever the run store moves: on boot, on
`START NEW SAVE`, and on loading a previous one (`scopeTo` in `runs.ts`).
Reading either store before the scope is set gets whatever the legacy
unscoped key holds, which is why `GameStage` initializes the run store
*first* — the ordering is the fix, not an accident.

A save written before slots existed is **adopted** by the first run to ask
for it and the legacy key is then removed, so exactly one save inherits that
history and every later one starts empty. "The first run to ask for it" is
literal: `startNewRun` passes `inherit` only when the slot it is creating is
the terminal's first, because a refiner who asks for a new save and is
handed the old one's history has been given the opposite of what they asked
for.

The "this file is already refined" notice is snapshotted on arrival — it has
to be, or it would fire about the file the refiner has this second finished
— and the snapshot is keyed on **the save as well as the level**. Starting a
new save from the briefing swaps the ledger underneath a `levelIndex` that
was already 0 and stayed 0, so the answer computed against the previous save
survived, and a brand-new terminal opened orientation file one reading THIS
FILE IS ALREADY REFINED.

---

### The Outie fact bank, audited

Two pools, kept apart on purpose: `CANON_WELLNESS_CLAIM` for claims the
show actually makes, paraphrased, and `ORIGINAL_APOCRYPHA` for everything
written here. An audit against the show found the line had blurred:

- **One invention was sitting in the canon pool** — an outie photographed
  in a newspaper beside a trophy, which is in no episode — and is gone.
- **Six more read like canon but could not be tied to a line** (music
  received with appreciation, dances, swimming, a game recently won, the
  value of water, making time for people). They moved to the apocrypha,
  which is what that pool is for. The audit was run against what could be
  corroborated from outside sources; the fan wikis were unreachable, so it
  is a *floor* on the pool's honesty rather than a proof of it, and any
  further line that cannot be sourced should move rather than stay.
- **Eighteen remain**, each corresponding to a wellness fact spoken on
  screen: kindness, brightening a day by smiling, the tent in under three
  minutes, the beautiful rock, parallel parking, roller skates, the gas and
  electric bills, music while shaving, two scoops of one flavor, the
  butterfly, the friend to children and the elderly and the insane,
  generosity, muggers and knaves, the machine that plays films, splendid,
  the heavy object, radar, and the mature one.

Ids are **written, not derived from position**, because they are stored in
saves: a fact that changes pools or a neighbour that is deleted must not
silently renumber the rest. A data invariant checks for collisions.

The Outie card's own caption lost its second sentence. "It is not a matter
for discussion" was Lumon telling the refiner off for something they had
not done.

## Part 7 — Media

The originals in `product-context/outputs/reward_media/` are reference
material and are never modified, renamed or recompressed. The build gets
derivatives, written by `tools/derive-reward-media.mjs`.

### What ships: plates only

Eleven WebP plates at 720×1280, **444 kB in total** — the source PNGs are
1.6–2 MB each and would be absurd behind a 240px card. Every reward, every
fact card and the dance experience's office scene is a still.

**The nine celebration clips are held back by product decision.** They are
not lost and not rejected: `node tools/derive-reward-media.mjs --clips`
re-encodes them from the originals whenever they are wanted, and the game
takes about twenty lines to put them back. What is gone is only the 5.5 MB
of video that was in the build.

### What the clips actually are

They can now be inspected: Playwright's bundled ffmpeg is built
`--disable-everything` and cannot decode H.264, but a full static ffmpeg
(`npm i ffmpeg-static`, then `MDR_FFMPEG=…`) decodes them to contact
sheets. Three things that were invisible before:

- **Every clip fades up from pure black.** Frame zero is black in all nine
  and the picture arrives over about half a second. Played behind a poster
  that is already showing the scene, that reads as the image blinking out
  and coming back — so the encoder trims 0.55 s off the head.
- **They are animated stills, not footage** — slow crossfades and drifts
  assembled from generated keyframes, which the revised-prompts document
  says outright for the office scene. Six seconds of a finger trap turning
  is a still with a rotation on it. Worth knowing before treating them as
  the celebration's main event.
- **The office scene is right.** Empty MDR floor, four-workstation island,
  beige CRTs, green carpet, chrome cart with a record player, rainbow bands
  traveling across the ceiling. No people, no likenesses.

One canon flag, raised rather than acted on: **the watermelon remembrance
clip and plate show a specific human face** — carved with the rind as hair
and deeply exposed red flesh, as the audit requires, but on a shirt-and-tie
plinth beneath a framed portrait of the same face. The prompt asked for
"anonymous features, not a real person" and no portrait reference. It reads
as a portrait of someone. That is a rights-review question before public
release, not a blocker for a private build.

### The encoder, measured

Re-encoding at CRF 32 (H.264) and CRF 40 (VP9), after the head trim:

| | source | H.264 | VP9 |
|---|---:|---:|---:|
| Office scene | 2,125 kB | 305 kB | 301 kB |
| Waffle Party II | 356 kB | 103 kB | 153 kB |
| Finger trap | 466 kB | 91 kB | 51 kB |
| **All nine** | **5,300 kB** | **920 kB** | **1,075 kB** |

About 82% off, with no visible loss at the size these play. Two siblings
rather than one, because they answer different problems: **H.264 is what
every shipping browser decodes**, and **VP9 is what the codec-stripped
Chromium the tests run in decodes** — which is the only way an automated
check can ever watch one play rather than watch the fallback. Verified:
the same clip reports `readyState 4, 720×1280` as WebM in that browser and
`DEMUXER_ERROR_NO_SUPPORTED_STREAMS` as MP4.

### Rules that still hold when clips come back

- reduced motion gets a still rather than the clip;
- a clip that will not decode falls back to the plate, and the claim never
  waits on media;
- only the next classified reward is preloaded, and never in a way that
  exposes its identity in markup, filenames or network timing.

## Part 8 — The MDE, and the one open design call

The mini-game is the largest single piece of work here and gets its own milestone.
The source specification asks the player to "connect 3+ glowing numbers of one
temper and release on the beat" — but this game's atom is a *cluster* of four to
nine digits, selected with an 80 px probe and a marquee box. Connecting individual
digits would mean a new input model and ~20 px touch targets, against the 44 pt
minimum the same specification imposes.

**Built as proposed:** keep the specification's sentence and change its granularity. During
the MDE, whole clusters light on the beat; the player boxes three or more
same-temper clusters and releases inside a generous window; a valid release
collapses into a phosphor bloom and fills a Dance Meter segment. Same
instruction, same feel, zero new gestures, and every touch target stays the size
it already is.

### Six rules the floor keeps

**There is always a chain of three on the floor.** The instruction says
connect three; a floor showing singles and pairs is the game contradicting
its own instruction. A phrase opens with four clusters of one temper lit,
and only a temper that *has* three can lead. What used to break this was a
merge: it spends three of the lead's four, and the floor then sat on
whatever was left until the phrase timer came round — up to three and a
half seconds of a board that could not be played. A merge now re-lights
the floor after half a second, which is long enough for the bloom to be
the thing on screen and short enough that the gap is never a dead end. A
data invariant plays whole sessions and asserts it.

**The meter counts the whole session.** It had three segments, which a
refiner filled in the first fifteen seconds and then danced out the
remaining thirty against a bar that could not move. A meter that stops
counting before the experience does is a decoration. Eight segments is
what a 45-second floor yields at a comfortable pace.

**And the meter is the only ending.** Filling it is the one thing that
finishes a session. There *was* also a clock, and a clock underneath a
meter is a promise quietly broken: the dance cut to the office film with
the Dance Meter at four of eight, which reads as the reward being taken
away rather than finished. `MDE_SECONDS` is now nothing but the nominal
length of the music, for copy that mentions one. Nothing here can be
failed and nothing here can be run out of — the music plays until the
dance is danced. Two data invariants hold the line: eight chains fill the
meter and end it, and ninety seconds of standing still on the floor ends
nothing at all.

**A merge is loud.** One bloom per cluster collapsing, plus one over the
whole chain sized by its length and carrying a second ring and spokes —
three identical puffs said *three things happened*, and the ring says *and
they were one thing*. The floor flashes, and the frame takes a small shove
that decays inside a third of a second, so the next chain is drawn on a
still board.

**A chain that runs out of time is seen to break.** The floor re-lights
every eight beats, and a chain in hand cannot survive it — the clusters it
is made of stop being the ones on the floor. Emptied silently that read as
the game losing the drag, which is to say as a bug. The links now snap on
screen in alarm red, dashing apart and drifting as they fade, which is the
same event told honestly: it was there, the phrase ended, be quicker.

**The floor counts to three out loud.** "Connect 3+ glowing groups of one
temper" lived in one grey line above the board, and a refiner who did not
read it had no second chance to learn the rule: nothing on screen counted
anything until a release either worked or did not. Three pips now sit
under the header and fill as groups are taken — `2 OF 3 — ONE MORE GROUP`,
then `RELEASE ON THE BEAT`, breathing, when the chain is long enough. On
the floor itself each held group is ringed *and numbered*, and every other
lit group of the same temper wears a dashed ring on the beat: the answer
to a new player looking at twenty glowing clumps and guessing which ones
go together.

**The screen before it shows the move being made.** See below.

### The instruction screen is a demonstration

A title card reading `CONNECT 3+ GLOWING GROUPS OF ONE TEMPER. RELEASE ON
THE BEAT.` is a specification, not teaching. A refiner arriving here has
spent eight files dragging *one* cluster at a time into a bin; nothing in
that prepares them to hold three at once and let go on a beat, and someone
played the whole floor through without ever chaining three and came away
thinking it was broken.

So the screen before `BEGIN` runs the dance instead of describing it. It
is not a video and not a mock-up: it is a real `MdeSession`, painted by
the real painter (`src/game/mdeDraw.ts`, lifted out of `MdeStage` for
exactly this reason) and wearing the real HUD. A ghost fingertip walks
onto three lit groups of one temper, the pips count them, the line turns
into `RELEASE ON THE BEAT`, the chain collapses into its bloom, and one
segment of the Dance Meter fills. Then it does it again, and the meter
climbs — the thing being taught is the loop, not the move.

Two constraints on the script:

- It only starts a run on a phrase with room to finish it in, which is
  what `MdeSession.phraseLeft` is for. The floor re-lights every eight
  beats and takes any chain in hand apart when it does — correct in play,
  and the one lesson a demonstration must not teach.
- It steps the clock to the next beat before letting go, so the release
  always lands. The window is generous in play; a demonstration that
  missed it would be teaching the miss.

Under `prefers-reduced-motion` the loop does not run at all. The screen
holds the single frame the animation exists to arrive at: the chain built,
the finger on the third group, the line reading `RELEASE ON THE BEAT`.

### The floor has a door of its own

`/dance` opens the Music Dance Experience directly. Reaching it in the
game costs eight files, which is the right price for a refiner and an
absurd one for judging whether the floor feels good, so the floor gets a
URL and the eight files stay where they are.

It runs the real component with the real reward record and the real
settings — a rehearsal on a different stage tells you about the rehearsal
— and the only thing it adds is another go at the end, on a fresh seed.

Three spellings, because the two hosts disagree about paths: `/dance` (a
rewrite in `vercel.json`; on GitHub Pages, a `404.html` that the build
makes a copy of `index.html`), `#dance` and `?dance`, which need no server
arrangement at all and are the fallback if either of those is ever undone.

Second constraint: temper color is off by default in this game — clusters are
read by motion, sound and haptics. The MDE must light clusters by **motion and
brightness first**, with color as the redundant channel it already is. The
supplied MDE reference images assume color is always on; they are behavior
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

The music is synthesised like every other sound in this game — an original
angular walking-bass-and-brushes figure on the same beat clock that lights
the groups and judges the release. No recording ships, which keeps the
rights question the canon audit left open from ever arriving.

---

## Part 9 — Sequencing

Each milestone ends with something a player can see working.

| # | Milestone | Player-visible result |
|---|---|---|
| M1 | Counters, save store, forecast surface — **shipped** | Finishing a screen shows real progress toward a sealed goal |
| M2 | Reveal sequence + the six image/video rewards of Lane A — **shipped** | The eraser, finger trap, melon bar, egg bar, watermelon and crystal all pop, stack when two land together, and hold the board while they do |
| M3 | The incentive shelf — **shipped** | Claimed objects can be found and opened again in the handbook, and every fact heard is kept in a Wellness record |
| M4 | Wellness — fact bank, cards, captions, speech — **shipped** | Fact cards typeset at runtime on the blank plate, sessions read three or four sentences, and the voice is the browser's own so no audio ships |
| M5 | MDE I and the office-scene handoff — **shipped** | The number field becomes a dance floor and returns cleanly |
| M6 | Lanes C and D; then Waffle tiers — **shipped** | Mastery counters appear as the game widens; the campaign ends on the ritual |

Easter eggs — the department paintings, goats, Testing Floor flashes, Board
presence, the wrong-bin track, Lexington — are a separate hidden scheduler and a
separate document. They must never appear in the forecast, and no undiscovered
one may occupy a locked slot.

---

## Part 10 — Deviations from `product-context/`, recorded

| Source finding | Resolution here |
|---|---|
| B1, B3 — four rewards past the end of the campaign; bin ladder needs 1,000 | Both ladders rescaled to 23 files / 104 bins (Parts 2–3) |
| B2 — "file" ambiguous across 13 orientation screens | Orientation is six files of two or three stages; the file is the counter and the word means one thing (Part 1) |
| B4 — twelve-screen tutorial is thirteen screens here | Lane A maps to screens, so the shape follows the build; the source's screen 9–12 payload lands on 9–15 |
| B5 — no counters exist | New store and migration rules (Part 6) |
| B6 — the specs have no fail state | Bins credit on completion only; a failed or abandoned file credits nothing (Part 0) |
| B7, B8 — MDE assumes always-on color and per-digit taps | Cluster granularity, motion-first lighting (Part 8) |
| B10 — the game ships no media files | Derivative pipeline, originals untouched (Part 7) |
| D1 — the 60-bin fact card exists in three documents and not the lore doc | Kept at 60; the lore doc's 64 is a separate hidden beat and stays hidden |
| D2 — DESIGN's collision example merges two MDE rewards | Queue, never merge — the PRD, lore doc and manifest all agree against it (Part 4) |
| D4, D5 — temper lane half-specified, two answers for when it appears | Rungs at 10 and 20 per temper, lane revealed after screen 15 (Part 3) |
| D6 — two save vocabularies | One schema, this one (Part 6) |
| D3 — MDE genre names: the show's menu, or written for this branch | The show's, led by `DEFIANT JAZZ`, verified by frame check; originals fill the rest (Part 8) |

No source conflict is left open. The standing posture in Part 0 settles the
general case: where the show establishes something, this game uses it.
