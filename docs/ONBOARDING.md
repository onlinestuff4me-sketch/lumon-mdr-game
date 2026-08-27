# Onboarding and the phased introduction of mechanics

> Status: implemented. Orientation is generated from the six-rung ramp
> table `ORIENT_STAGES` in `src/game/constants.ts` — one group alone, two
> of the same, two tempers told apart, doubled, the full bin deck arriving
> before the full temper deck, then everything. Screens per rung are tuned
> on the Orientation Ramp Planner artifact; the acts after orientation are
> unchanged.

The design rule behind everything here: **a player is never asked to do two
new things at once, and never meets a new rule for the first time under a
clock.** Every mechanic gets shown in isolation, then used once in a real
file, then becomes part of the world.

This document is the specification. Every number in it is a lever, and
every lever has a name used consistently here, in the tuning artifact, and
(once built) in `src/game/constants.ts`. **Built and shipped at the defaults below.** Where an implementation detail
diverged from the plan, it is marked ▸.

---

## Part 1 — ORIENTATION: reading the tempers by eye

Twenty-nine screens in four stages, before the probe exists. No clock, no
hiding: every group is **already moving**, and all the player does is see
it, box it, and bin it. What is being taught is not a gesture — it is *what
each temper looks like*, learned by doing rather than by reading.

### Stage 1 · one temper, one group (12 screens)

Three screens per temper, in temper order, each with a single group and a
single full-width bin.

| Lever | Default | What it does |
|---|---|---|
| `stage1.screensPerTemper` | 3 | Screens spent on each temper before moving to the next. Lower = faster onboarding, less recognition drilled in. |
| `stage1.groupsPerScreen` | 1 | Groups on the board. Above 1 the screen stops being "here is one thing, look at it". |
| `stage1.temperOrder` | WO, FC, DR, MA | Sequence. Woe first because its droop is the slowest and most legible. |
| `stage1.subtlety` | 1.35 | Motion amplitude multiplier. Deliberately louder than any real file — this motion must be noticeable to someone who does not yet know to look for motion. |

Three screens per temper rather than one because recognition is the whole
product of this stage, and recognition needs repetition in different places
on the board. Three is also short enough that a repeat player is not
punished — twelve screens at roughly 6–8 seconds each is about 90 seconds.

### Stage B · two groups, still one temper (8 screens)

Two things to find, before two things to tell apart. Each screen carries two
groups of a single temper and a single bin, so the fill meter moves in
halves. It opens on **malice** — the temper stage A has just finished with —
and cycles backwards through the four twice: MA, DR, FC, WO, MA, DR, FC, WO.

| Lever | Default | What it does |
|---|---|---|
| `stageB.screens` | 8 | Two full cycles of the four tempers. |
| `stageB.groupsPerScreen` | 2 | Both of the same temper; `quota: 2`. |
| `stageB.opensOn` | most recent | The temper the previous stage ended on, so the first new demand lands on something just seen. |

### Stage C · two tempers, two groups (4 screens)

The first discrimination: two bins on the deck, one group of each, and a
wrong answer is now possible for the first time.

| Lever | Default | What it does |
|---|---|---|
| `stage2.screens` | 4 | Screens in this stage. |
| `stage2.groupsPerScreen` | 2 | One group per temper on the deck. |
| `stageC.pairings` | derived | **Chained on recall, not fixed.** The first screen carries the two tempers the player has most recently seen; every screen after it keeps one temper from the screen before and introduces one new one. Every temper still appears exactly twice. At the current stage-B ordering that resolves to WO+FC → FC+DR → DR+MA → MA+WO. |
| `stage2.subtlety` | 1.25 | Slightly quieter than stage 1. |
| `stage2.spacing` | 6 | Minimum clear cells between groups, so each is read on its own. |

### Stage D · four tempers, four groups (5 screens)

The full deck, one group per temper, still all visible, still no clock.

| Lever | Default | What it does |
|---|---|---|
| `stage3.screens` | 5 | Screens in this stage. |
| `stage3.groupsPerScreen` | 4 | One per temper. |
| `stage3.subtlety` | 1.15 | Quieter again — the last step before motion starts hiding. |
| `stage3.spacing` | 5 | |

### Where the group sits

| Lever | Default | What it does |
|---|---|---|
| `stage1.focus` | `center` → `mid` → `edge` | Screens 1–4 put their group in the middle of the board, where it cannot be missed; 5–12 push it halfway out; 13–21 put it near the edges, so finding it becomes part of the task before the probe ever arrives. Implemented by ranking the board generator's *candidate cells*, not by moving a finished cluster, so spacing, size and no-shared-cells all still hold. Measured mean offset from center: **0.08 → 0.47 → 0.84** on a 0–1 scale. |

### Rules that apply to all of Part 1

| Lever | Default | What it does |
|---|---|---|
| `orientation.tapToSelect` | true | **A tap anywhere on a group lifts the whole group**, and **pressing on one and dragging carries it straight to the bin in one motion** — starting on empty board still draws a box. On by default on *every* file now, not just the teaching ones: the gesture that twenty-nine screens spend their whole length teaching used to stop working the moment training ended, silently. What protects the probe mechanic is the agitation gate, not the absence of the gesture — a tap on a group nobody has found yet is refused and says so. Hit-tested at the **contact point**, and against the group's live *footprint* rather than a radius around each glyph: the reticle floats above the finger so the lens is not under the thumb, and hit-testing there put every group's tappable region below its own digits. A tap on empty board does nothing, and a tap on a decoy answers `NO TEMPER DETECTED` exactly as a box would: a tap must never reveal what a box would not. |
| `orientation.binHint` | on single-bin screens | Faint chevrons run from a held packet down to the bin, **and the destination bin lights up**, so the second half of the gesture is discoverable too. Only ever enabled where a **single bin** is on the deck, so it points at the one place a packet can go and gives nothing away. It appears **with the packet**: an earlier version waited 1.1s for the player to hesitate, which meant the arrows arrived after the moment they were needed — the question "where does this go?" is asked the instant the box shows up. |
| `orientation.minOverlapDigits` | 1 | How many of a group's digits a selection box must touch to lift the **whole** group. At 1, dragging over any part of a group takes all of it. The real game requires 4 (`MIN_CAPTURE`); this is the "generous selection" rule, and it exists so a new player is never told their correct instinct was a wrong box. |
| `orientation.ceremony` | `none` | What happens between screens. `none` = a REFINED flash and auto-advance; `full` = the normal 100% / addendum / NEXT FILE screen. ▸ Screens 1–20 are `none`; screen 21 is `full`, so the sequence ends properly and releases the one addendum it is worth. |
| `orientation.autoAdvanceMs` | 900 | Pause after the last group is binned before the next screen loads. |
| `orientation.startMode` | `select` | These screens open in SELECT. There is nothing to probe. ▸ They also *return* to SELECT after each lift: the engine used to drop back to PROBE, which on these screens handed the refiner a tool that does nothing for the remaining groups. |
| `orientation.wrongBinPenalty` | `scatter` | What a wrong bin does. `scatter` matches the real game; `nudge` would refuse the drop and say so without scattering. |

---

### The reticle offset, per gesture

The 68px lift exists so a 36px lens clears the thumb. A marquee corner is a
hairline with nothing to hide behind it, and lifting it that far started the
box well above the finger drawing it.

| Gesture | Offset | Why |
|---|---|---|
| PROBE | −68px | The lens has to clear the thumb — being looked at is its whole job. |
| **SELECT** | **−22px** | Just clear of the contact patch, so the finger is not covering the corner it is placing. |
| CARRY | **−22px**, plus a grab offset | The packet keeps its position relative to the finger for the whole drag, clamped to 56px, and the drop is tested at the packet rather than at the reticle. Only the lens takes the −68px lift, because the lens is the thing being looked at; a packet lifted that far sat well above the thumb dragging it. The grab offset is derived from the *carry* reticle at the moment a press becomes a drag, so a gesture changing kind mid-drag cannot make the box leap. Measured 0px of unexplained movement across the conversion frame. |

## Part 2 — THE PROBE FILE: motion that hides

One screen. One group. One bin. This is where the game stops showing the
player the answer, and the whole file is built to make that transition
legible rather than jarring.

### The pulse

The group is not permanently agitated and not permanently still. It
**breathes**: it surfaces for a moment, then sinks back into the matrix.

```
    reveal        hidden         reveal        hidden
   ┌──2.0s──┐              ┌──2.0s──┐
───┘        └────5.0s──────┘        └────5.0s──────
```

| Lever | Default | What it does |
|---|---|---|
| `probeIntro.revealDurationS` | 2.0 | How long the group stays visibly agitated each time it surfaces. |
| `probeIntro.hiddenWaitS` | 5.0 | Gap between the end of one reveal and the start of the next. |
| `probeIntro.tapCooldownS` | 5.0 | Minimum quiet time after the player's last touch before a reveal is allowed. Stops a reveal firing while a finger is already on the board and stealing the lesson. |
| `probeIntro.revealSubtlety` | 0.80 | Motion amplitude of a reveal. Below Part 1's levels: it should read as a hint, not an announcement. |
| `probeIntro.revealRampS` | 0.35 | Fade in and out of each reveal. A hard cut reads as a rendering glitch. |

The next reveal fires at `max(lastRevealEnd + hiddenWaitS, lastTap + tapCooldownS)`.

### The handover

The player's instinct after Part 1 is to tap the moving digits and box
them. Here that instinct is honored and then redirected:

| Lever | Default | What it does |
|---|---|---|
| `probeIntro.forceProbeOnTap` | true | The first touch on this screen puts the terminal into PROBE, not SELECT — the player reaches for the box and gets the lens instead. This is the moment the mechanic is introduced. ▸ Implemented as `startMode: "probe"`, which is the same thing with less machinery. |
| `probeIntro.lensLingerS` | 1.0 | The lens stays at full size for this long after the finger lifts, instead of vanishing with it. Without the linger the player never sees what they just summoned. |
| `probeIntro.lensShrinkS` | 0.4 | The lens then shrinks to nothing. The shrink is the tell that this is a *tool*, not a glitch — it has a lifecycle. |
| `probeIntro.armSelectAfterProbe` | true | Once the group has been held and identified, SELECT arms itself, as in the real game. |

Once the group is probed, boxed and binned, the file completes and
**CALIBRATION** takes over — which is where the existing progression, and
the four-temper naming ticker, already picks up.

### Why this order

Part 1 teaches *what a temper looks like* with nothing hidden. Part 2
teaches *that tempers hide* and hands over the tool for finding them. Doing
it the other way round is the original bug: the probe is undiscoverable
when the player does not yet know what they are probing for.

---

## Part 3 — ACT III: one new rule at a time

Act III's difficulty currently comes from two continuous dials — the clock
down, the motion damped. Both are "the same task, tighter". The mechanics
below make it *a different task*, and each gets the same three-beat
treatment ORIENTATION uses: **taught in isolation → used once → part of the
world.**

Each teaching file is untimed or generous, carries one or two tempers, and
does nothing except demonstrate its rule. They carry ordinary place names
rather than being labeled TEACH: Lumon does not annotate its own files.

| # | File | Clock | What it is |
|---|---|---|---|
| 1 | **TUMWATER** | 120s | Baseline. All four tempers, no new rules. |
| 2 | **JESUP** | none | 2 tempers. Digits that stir faintly when probed and belong to no group. Shown alongside a real group so the difference is visible side by side. |
| 3 | **ALLENTOWN** | 110s | Decoys live, on a real board. |
| 4 | **NANNING** | none | 2 tempers, 1 group each. It reads as one temper, and while the player watches it becomes another. Nothing else happens on the screen. |
| 5 | **SIENA** | 100s | Decoys + morph. |
| 6 | **YAKIMA** | 150s | 2 tempers, audio cut, announced: `TERMINAL AUDIO SUBSYSTEM UNDER MAINTENANCE`. Learning to read dread and malice apart by motion alone, while there is still time to do it badly. |
| 7 | **COLD HARBOR** | 90s | Everything, plus the fifth temper. |

### The levers

| Lever | Default | What it does |
|---|---|---|
| `decoys.perBoard` | 2 | Decoy sites on a board that has them. |
| `decoys.agitation` | 0.35 | How strongly a decoy stirs, as a fraction of a real group. Too high and it is indistinguishable; too low and it is invisible. |
| `decoys.silent` | true | Decoys make no sound and no buzz. The sound is the honest channel; only the eye can be fooled. ▸ Also excluded from the teaching ticker: a file that names what you found must not name a decoy as woe, which is the exact lie the mechanic exists to expose. And boxing one answers `NO TEMPER DETECTED` rather than the generic `PROBE FIRST` — a decoy never reaches full agitation, so the generic guard would have told the refiner to probe harder on a site they had already probed. |
| `morph.holdBeforeS` | 2.0 | How long a morphing group shows its first temper before changing. |
| `morph.transitionS` | 0.6 | How long the change takes. |
| `morph.perBoard` | 1 | Morphing groups per board that has them. |
| `morph.snapshotAtLift` | true | A packet's temper is fixed when it lifts, so a morph after selection cannot invalidate a correct read. Turning this off makes the mechanic much crueller. |
| `redaction.channel` | `audio` | Which channel a redacted file removes: `audio`, `haptics`, or `lens`. |
| `redaction.restoreSetting` | true | The player's own audio setting is restored after the file. A tutorial must never silently change a preference. |
| `fifthTemper.motion` | `borrowed` | What it does. `borrowed` = it takes on the motion of the last temper the player correctly binned, so it always looks like something they know and is always wrong. |
| `fifthTemper.taught` | **false** | Whether it gets a teaching file. Deliberately false — see below. |
| `fifthTemper.appearsOn` | COLD HARBOR | Which files carry it. |

### The one exception to the teaching rule

**The fifth temper is never taught.** Every other mechanic here gets a file
that explains it, because a rule you cannot learn is just an unfair one.
The fifth temper is the opposite case: its entire value is that nothing
explains it. It has no coach line, no handbook entry, and no teaching file.
It costs a scatter to try and nothing to leave alone, so a player who never
works it out loses nothing but the secret.

Its only acknowledgment is a fourteenth row in the handbook archive with
**no file code**, which stays SEALED forever. Probing it once changes its
name from redacted blocks to `05 · ████████` and its status to
**UNRESOLVED**.

---

## Cost, and what was done about it

This added 21 orientation screens, 1 probe file and 3 teaching files to a
queue that had 14. Three consequences, and how each is handled:

1. **No completion ceremony inside Part 1.** Twenty-one screens each ending
   in a 100% banner, an addendum and a NEXT FILE button is twenty-one
   interruptions in what should feel like one continuous sequence. Screens
   1–20 flash REFINED and advance themselves after 900ms.
2. **One archive row, not twenty-one.** Twenty-one redacted rows would swamp
   the real files and make the archive read as a progress bar rather than a
   set of secrets. ORIENTATION holds one row; a screen inside the sequence
   marks that row IN PROGRESS.
3. **All of it is skippable.** ORIENTATION, BELLINGHAM and CALIBRATION are
   all `training`, so SKIP on the briefing lands on DRANESVILLE, and RESUME
   AT drops a returning refiner exactly where they stopped — including
   part-way through orientation.
