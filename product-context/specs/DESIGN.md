# Design Specification — Portrait MDR Lore Game

Status: Phase 1 design specification  
Last updated: 2026-08-25  
Product source: `PRD.md`  
Content source: `SEVERANCE_MDR_LORE_AND_PROGRESSION.md`

## Experience vision

The number screen begins as an austere, trustworthy corporate instrument. Over time it becomes less trustworthy while the underlying game rules remain fair. The player should oscillate among competence, amusement, curiosity, and dread.

The supplied portrait game screenshots are the source of truth for the playable interface. New modes must extend their existing CRT number field, top status area, mode controls, handbook affordance, four-bin layout, typography, phosphor treatment, and rounded terminal framing. Narrative environments may feel like another Lumon branch, but no generated UI board may replace or reinterpret the established game screen.

## Information architecture

### Primary surfaces

1. **MDR screen** — number field, selection state, bins, file progress, minimal instruction.
2. **File transition** — score, quota, reward/lore scheduler, next-screen or next-file state.
3. **Archive / Perpetuity Wing** — official texts, recovered texts, unauthorized literature, exhibits, branch records, incident files.
4. **Incentive shelf** — tactile/inspectable rewards and preference tracking.
5. **Incentive Forecast** — visible next-reward goals for files, bins, temper mastery, and perfect play.
6. **Wellness room** — short Outie facts and equal-enjoyment surveys.
7. **Event stage** — MDE, Waffle Party, Break Room echo, Overtime mode, Cold Harbor-style landmark.
8. **Continue screen** — resume-count events and safe restoration.

### Archive hierarchy

```text
ARCHIVE
├── Compliance / Handbook
│   ├── Official text
│   ├── Recovered text
│   └── Appendix material
├── Unauthorized Literature
├── Incentives
├── Perpetuity Wing
├── Branch Records
│   ├── File manifests
│   ├── Incident reports
│   └── Security fragments
└── Unindexed
```

The `Unindexed` section appears only after the first contradiction event. It contains seen-but-unexplained anomalies and lets a player revisit critical content without turning the game into an explicit clue checklist.

## Portrait layout principles

- Keep the active number field in the upper/middle portion where it has the largest uninterrupted area.
- Place the most common bin/confirm actions within comfortable lower-screen reach.
- Preserve generous negative space; do not fill every area with lore indicators.
- Use rare full-screen interruptions rather than permanent HUD clutter.
- During four-bin play, optimize spacing before adding labels or decoration.
- Any visual anomaly that moves a control also retains its original invisible hit target or pauses input.

## Visual language

### Baseline

- Restrained institutional palette.
- CRT/phosphor-inspired number rendering with accessible contrast mode.
- Deliberate typography and slightly archaic corporate diagrams.
- Flat fluorescent lighting for archive/event scenes.
- Motion is precise and sparse.

### Infection levels

| Level | Visual behavior |
|---|---|
| Obedient | Clean grid, stable labels, predictable transitions |
| Peripheral | One-frame reflections, hair, subtle bloom, distant corridor |
| Contradictory | Duplicate cursor, altered copy, mismatched metadata |
| Subfloor | Door flashes, biometrics, five-meter layouts, security overlays |
| Outie-aware | Identity fragments, warmer exterior traces, altered archive typography |

The player never selects an infection level. It follows narrative progression and may briefly regress to create uncertainty.

## Temper cue design

Each temper requires redundant cues so color is never the only signal.

| Temper | Motion language | Audio language | Haptic language | Screen-wide expression |
|---|---|---|---|---|
| Woe | sink, weight, downward ease | low falling tone | slow heavy pulse | UI sags |
| Frolic | bounce, orbit, playful rotation | bright irregular motif | quick light taps | digits swap/dodge |
| Dread | jitter, recoil, anticipation | tremolo/near-whisper | fine nervous buzz | controls appear wary |
| Malice | expansion, charge, attack | clipped distorted hit | hard double impact | borders surge outward |

Players can tune or replace each channel. Story anomalies may suppress one channel only after another reliable channel has been taught.

## Tutorial design

### Screens 1–4: isolated temper learning

Each screen has one anomaly and one destination. The sequence teaches recognition rather than bin-choice complexity. A reward after screens 1 and 2 signals that the tutorial is already “real game.” The first hallway flash on screen 3 is short enough to be deniable. Screen 4 opens the archive and summarizes the temper framework.

### Screens 5–8: discrimination

Two groups and at least two possible bins force comparison. Content alternates comic and strange: melon bar, goat audio, unauthorized literature, fake update. Events occur after scoring so the new two-group task remains readable.

### Screens 9–12: orchestration

All four tempers appear. Wellness, MDE, Testing imagery, and the commendation reward form a miniature season finale. Screen 12 unlocks the persistent metagame surfaces.

### Post-onboarding

Difficulty grows on separate axes:

- number of anomalous groups;
- number of candidate bins;
- cue amplitude;
- cue overlap;
- distractor density;
- time pressure, if used;
- multi-screen file length;
- anomaly mechanics such as bleed or contagion.

Never increase more than two axes on the same first-exposure screen.

## Reward interaction design

### Incentive Forecast

Rewards are never random. The forecast gives the player a compact contract:

- a generic `NEXT INCENTIVE` label with a sealed/redacted marker that contains no identifying silhouette;
- exact trigger, such as `Complete 2 more files` or `Refine 18 more bins`;
- numeric progress and remaining amount;
- only the next threshold in each active ladder;
- a `CLAIMED`, `EARNED`, or `IN PROGRESS` state;
- no story explanation for why Lumon selected the reward.

The forecast never names, depicts, categorizes, or hints at an unearned reward. The player understands the system and goal while the object itself remains a surprise.

The file and total-bin ladders are visible from the end of screen 1. Temper ladders appear after all four tempers are taught. Perfect-play rewards appear after the first perfect screen so the tutorial does not present too many counters at once.

If two rewards are earned simultaneously, show the highest-priority reward first and mark the other `EARNED — PRESENTATION PENDING`. Never hide or reroll an earned reward.

### Reward pop and celebration

Every newly earned reward gets a deliberate celebratory beat at the next safe boundary:

1. **Anticipation, 0.5–1.5 seconds** — gameplay clears, fluorescent hum ducks, and a sealed `INCENTIVE EARNED` card enters.
2. **Reveal, 1–3 seconds** — the seal opens and the reward’s name and visual are shown for the first time.
3. **Celebration, 3–10 seconds** — reward-specific animation, musical sting, and restrained haptic flourish. Major experiential rewards may run longer and remain skippable.
4. **Possession** — the reward moves to the incentive shelf or event archive with a clear `ACQUIRED` state.
5. **Renewed anticipation** — the next unknown threshold appears immediately: `NEXT FILE INCENTIVE: 0 / 3 FILES` or `NEXT BIN INCENTIVE: 0 / 25 BINS`.

The reveal should feel significantly more expressive than ordinary file completion while remaining deadpan and institutionally controlled. Reduced-motion mode uses a clean fade, still hero image, short sound, and optional haptic instead of object movement.

### Incentive shelf

Objects appear as sparse, inspectable items. Interaction is tactile but brief: rotate, tap, open a drawer, examine a serial number. Rewards are not currencies and do not grant combat-like upgrades.

### MDE

- Start on a completed MDR screen so the same numbers and grid visibly become the dance floor.
- First-time sequence: sealed reward reveal → genre selection → five-second instruction → 45-second mini-game → eight-second generated finale film → result card.
- Core instruction: `CONNECT 3+ GLOWING NUMBERS OF ONE TEMPER. RELEASE ON THE BEAT. FILL THE DANCE METER.`
- Lit numbers pulse on the beat. The player taps or drags across three or more same-temper numbers; releasing inside the generous beat window merges the group into a geometric phosphor burst.
- Each successful merge fills one third of the Dance Meter. Once filled, further combinations raise a purely celebratory score and multiplier.
- Missing a beat breaks the multiplier only. There is no fail state, life counter, energy cost, or reward forfeiture.
- Each temper keeps its established motion, sound, and haptic language. Color is redundant rather than required.
- Initial genre menu may include `DEFIANT JAZZ` plus other verified genre labels from the on-screen MDE card. Do not describe a game-original genre as show-derived. Repeat MDE milestones unlock another selection or longer duration directly; there is no invented voucher prop.
- Music must be beat-mapped. Number illumination, valid release windows, combination bursts, Dance Meter fill, and haptics all derive from the same beat clock.
- Use an original or licensed recording. The first reference brief is angular, upbeat, defiant-jazz-inspired instrumental music with walking bass, brushed drums, and unruly horn accents; do not copy the show recording without clearance.
- First MDE remains wholly celebratory. Later MDEs may introduce post-music movement, reflection, elevator flash, and footsteps.
- Reduced-motion mode removes digit travel and camera motion, retaining rhythm-responsive opacity, outlines, captions, and optional spatial audio.
- Archive replay offers `PLAY MINI-GAME` and `WATCH FINALE`; replay does not re-award progression.

The MDE has two separate visual deliverables:

1. **Gameplay references** are edits of the supplied game UI showing ready, connected-chain, and successful-release states. They preserve the existing screen instead of fabricating a terminal.
2. **Reward scene media** is an image and short film of the empty MDR office during the colored ceiling-light reveal, with the workstation island, green partitions/carpet, metal audiovisual cart/record player, and a single accessory. It contains no actors or likenesses and is not a screenshot recreation.

### Waffle Party

Use a reusable stage with additive layers: plate, mask, shadow, silhouettes, institutional film. Each tier remains short and can be replayed from the archive.

### Wellness

The player receives facts one at a time. Every fact has a stable ID, lore label, source note, exact display sentence, spoken sentence, spoiler tier, and reuse rule. The card and caption display the same words that are spoken.

Use two content pools:

- `CANON_WELLNESS_CLAIM`: episode-derived facts rewritten as concise paraphrases, with episode/source recorded internally and treated as Lumon’s claim rather than verified biography;
- `ORIGINAL_APOCRYPHA`: game-written facts in the same soothing, oddly specific register, never presented as show canon.

Selection alternates pools when possible, excludes already-seen IDs, and persists the chosen ID before the card opens. A calm original voice reads at approximately 130 words per minute with a short pause after each fact. Do not clone or imitate an actor. No fact is based on private data.

## Narrative event design

### Ambient event

Duration under two seconds; never blocks input during an active precision gesture. Examples: goat bleat, hair, corridor flash, low Board tone.

### Minor event

Duration two to eight seconds or an optional archive object. Examples: fake update, Outie fact, recovered page.

### Major event

Duration five to thirty seconds, skippable after first viewing, and archived. Examples: MDE, Wellness, Board review, Overtime microburst.

### Landmark

Changes narrative understanding or gameplay rules. Examples: full Overtime event and Cold Harbor-style finale. Always checkpoint before launch and offer replay.

## Scheduler design

### Two delivery systems

**Reward scheduler:** deterministic, visible, and auditable. It responds only to the published trigger. Randomness may vary a cosmetic detail but never eligibility or timing.

**Surprise scheduler:** hidden and probability-driven. It handles easter eggs, anomalies, contradictory records, department propaganda, goat intrusions, and other non-reward secrets.

Important narrative landmarks may use hidden deterministic windows, but they are not advertised as rewards.

### Trigger categories

- fixed screen/file milestone;
- total counter threshold;
- temper-specific threshold;
- behavior threshold;
- compound condition;
- weighted ambient chance;
- narrative dependency.

### Selection algorithm

```text
on safe_event_boundary:
  collect newly earned scheduled rewards
  collect newly eligible deterministic events
  collect eligible ambient candidates
  remove events blocked by tutorial, cooldown, accessibility, or dependency rules
  sort rewards and deterministic events by priority and eligibility age
  choose at most one earned reward presentation
  choose at most one landmark/major
  choose at most one compatible minor/micro
  choose at most one compatible ambient
  queue unshown rewards and deterministic events
  discard unselected random ambient candidates
  persist shown state before playback
```

### Pity timer

During the first 30%, if two completed screens have no content beat, force an eligible micro-event. A standard quota update does not count as a content beat unless it contains new story information or a reward.

### Surprise windows

Each important easter egg defines an eligibility start, eligible surfaces, base weight, cooldown, and hidden guarantee. Example: the first department-conflict painting becomes eligible after the player knows another department exists, has an 8% chance on safe transitions, and is forced on the fifth eligible roll if still unseen. The opposing painting is withheld for at least two completed screens, then guaranteed within twelve eligible screens. The player sees no counter.

### Department-conflict painting sequence

1. A cropped, apparently devotional corporate painting appears in the archive rotation.
2. A later surprise reveals the full scene: one department violently attacks another.
3. Two to twelve eligible screens later, a nearly identical painting appears with aggressor and victim departments reversed.
4. Metadata gives the works different titles and incompatible provenance.
5. The archive may note that both were displayed by Lumon, but it cannot resolve which version—if either—records a real event.

Canon establishes the two opposing depictions and the departments’ distrust. Whether the depicted conflict occurred is unresolved. The game may imply that Lumon distributes contradictory propaganda, but must treat that conclusion as inference rather than confirmed history.

### Collision examples

- File 10 completes and bin 100 is reached: show MDE I once; mark the bin-100 encore as satisfied and queue one extra genre selection for the next MDE. Do not create a voucher prop.
- Wrong-bin 7 and file 12 completion coincide: show orientation graduation; queue the Break Room event until the next safe mistake-related boundary.
- Resume 5 makes an Outie message eligible while a named-file landmark is queued: show the landmark first and preserve the message for next resume.

## State model

Minimum persistent state:

```text
campaign_version
current_file_id
current_screen_index
file_progress
screens_completed
files_completed
bins_total
bins_by_temper
wrong_bins_total
resume_count
last_suspend_time
perfect_screen_streak
perfect_file_streak
archive_visits
archive_entry_views
incentive_views
mde_choice_counts
abandoned_file_ids
content_eligible_ids
content_shown_ids
content_queued_ids
content_skipped_ids
accessibility_settings
spoiler_settings
```

All counters are monotonic except active streaks and current-file state. Content migration must preserve seen/queued state across campaign updates.

## Content data model

Each entry includes:

- stable ID and content version;
- player title and internal description;
- lore label and source note;
- spoiler tier;
- event size and duration;
- primary and compound triggers;
- prerequisites and conflicts;
- priority, cooldown, repeat policy, and queue policy;
- presentation asset references;
- reduced-motion, caption, haptic, and high-contrast variants;
- archive fallback;
- analytics tags;
- rights/review status.

## Copy design

- Use concise, overly certain corporate language.
- Pair absurd content with administrative calm.
- Avoid reproducing iconic dialogue when original copy can carry the tone.
- Let contradictions stand without a joke explaining them.
- Make “Outie” statements unmistakably fictional within the app.
- Preserve a difference between Kier-like grandiosity and Ricken-like accidental insight.

Example original corporate copy:

> Improved compliance. Reduced unnecessary curiosity. The hallway mentioned in the previous notice was included in error.

Example original unauthorized copy:

> A door is a wall that has admitted uncertainty.

These examples are game-original placeholders, not show quotations.

## Audio and haptics

- Maintain separate buses for gameplay cues, ambience, narrative stingers, and music events.
- Allow gameplay cues to duck narrative ambience.
- Captions identify meaningful sounds without over-explaining their source, e.g. `[distant bleat]`.
- Haptics have distinct temper patterns and can be disabled.
- MDE and Board tones require volume-safe mastering.
- Footstep and corridor effects should be spatially suggestive but not essential.

## Accessibility

- Reduced-motion mode removes screen displacement and substitutes opacity/highlight changes.
- Reduced-flicker mode eliminates rapid CRT flashes and lengthens interstitials into safe fades.
- High-contrast mode avoids low-luminance green-on-black dependence.
- Every temper has at least two enabled cue channels.
- Hidden interactions are optional; required lore enters the archive through alternate triggers.
- Break Room hold duration has a tap alternative.
- No progression requires device rotation, precise multi-touch, rapid tapping, or audio.

## Failure and recovery

- Wrong-bin feedback is immediate and understandable before narrative flavor appears.
- Narrative punishment never compounds a player’s mechanical loss.
- After repeated errors, lower distraction intensity and suppress punitive flavor until a success.
- Checkpoint before every major/landmark event.
- If the app closes during an event, resume at a safe replay/skip screen.
- “Clean Slate” can alter presentation only; it never deletes saves.

## Generative-media direction

Potential generated assets:

- Testing Floor interstitial rooms;
- abstract Four Temper silhouettes;
- show-grounded rooms and objects with documented on-screen visual evidence;
- MDE gameplay states edited from the supplied UI screenshots and separate office-scene keyframes;
- corrupted corporate training stills;
- Waffle Party branch ritual imagery;
- goat micro-interstitials.

Prompt requirements:

- portrait-safe composition with central negative space where needed;
- no invented visual treatment for dialogue-only rewards;
- no additional prop unless its on-screen basis is recorded in the asset audit;
- no actor likenesses or exact show shot recreation;
- restrained institutional lighting and era ambiguity;
- explicit duration, camera motion, loop behavior, and safe flicker constraints for video;
- documented source, model, version, and human review.

## Quality gates for Phase 3

Before a feature milestone is accepted:

1. Core function passes automated and manual checks.
2. The new event cannot interrupt an unlearned mechanic.
3. Scheduler collision cases are tested.
4. Save/resume during the event is tested.
5. Reduced-motion, captions, and non-color cues are verified.
6. Lore label and source note are reviewed.
7. Rights status is recorded.
8. Event is observed on a portrait device size at minimum and maximum supported aspect ratios.

## Phase 2 implementation-checklist requirement

Before any application code is written, the team must reread `PRD.md` and `DESIGN.md`, resolve or explicitly defer the open product decisions, and present a step-by-step implementation checklist to the Executive PM. The checklist should sequence:

1. data/state model;
2. fixed screens 1–12;
3. counter and event scheduler;
4. archive and incentive shelf;
5. behavior-reactive triggers;
6. MDE/Wellness/Board event framework;
7. midgame anomaly mechanics;
8. late-game Overtime and Cold Harbor landmarks;
9. analytics, accessibility, save migration, and QA.

No application code belongs in Phase 1.
