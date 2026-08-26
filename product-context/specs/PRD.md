# Product Requirements Document — Portrait MDR Lore Game

Status: Phase 1 specification  
Last updated: 2026-08-25  
Source of truth for implementation: this PRD plus `DESIGN.md`  
Detailed content schedule: `SEVERANCE_MDR_LORE_AND_PROGRESSION.md`

## Product summary

A portrait-oriented mobile game asks the player to perform Macrodata Refinement: identify number groups that feel strange and sort them into bins associated with Woe, Frolic, Dread, and Malice. The game teaches the four tempers organically, then increases difficulty by adding groups, obscuring cues, introducing decoys and mixed signals, and eventually requiring several number screens to finish a file.

The distinguishing experience is that Lumon fiction progressively infects the interface. Rewards, strange interstitials, archive discoveries, corporate jokes, contradictory instructions, and behavior-reactive events make the app feel observant and narratively alive. Scheduled rewards and surprise easter eggs are separate delivery systems: rewards are predictable goals; easter eggs are hidden discoveries.

## Product goals

1. Teach the full core loop within twelve screens without a separate conventional tutorial.
2. Make the tutorial itself dense with rewards, lore, secrets, and humor.
3. Front-load recognizable *Severance* material before the 30% completion point.
4. Create a coherent mystery arc rather than a disconnected gallery of references.
5. Reward multiple kinds of play: progression, mastery, persistence, curiosity, and natural return behavior.
6. Preserve clear internal distinctions among canon, official companion material, unresolved canon, original game apocrypha, and fan theory.
7. Reserve a small number of premium late-game revelations without starving the early and middle game.

## Non-goals

- Reproducing complete scenes, scripts, performances, music, costumes, or screens from the show.
- Confirming mysteries the show leaves unresolved, including the Board, goats, or the Revolving.
- Using invasive device data or deceptive OS impersonation for horror effects.
- Punishing ordinary mistakes with long, repetitive sequences.
- Making lore essential to understanding basic controls.

## Target player

Primary: fans of *Severance* who recognize the show’s rewards, rituals, corporate language, and Season 1/2 mysteries.

Secondary: puzzle players who can enjoy a strange corporate mystery without recognizing every reference.

The default content plan contains full Season 1 and Season 2 spoilers plus *The Lexington Letter*. A spoiler-filter decision remains open for Phase 2.

## Core gameplay loop

1. Open a named file or continue an in-progress file.
2. Scan a field of numbers for anomalous groups.
3. Identify each group’s temper through visual, audio, and/or haptic cues.
4. Select the group and assign it to the correct bin.
5. Complete all required bins on the screen.
6. Receive score/progress and an eligible reward, lore beat, anomaly, or corporate response.
7. Continue to the next screen; later files require multiple screens.

## Tutorial and difficulty requirements

### Screens 1–4

- Present one strange group per screen.
- Present only the relevant destination bin.
- Introduce the four tempers one at a time.
- Deliver at least two incentives, one Outie fact, one archive unlock, and one ambient anomaly across the segment.

### Screens 5–8

- Present two anomalous groups associated with different tempers.
- Require discrimination between at least two destination bins.
- Begin goat, unauthorized-literature, and corporate-software mystery threads.

### Screens 9–12

- Present all four tempers and four-bin sorting.
- Confirm that the player can distinguish each temper.
- Deliver the first Wellness event, Music Dance Experience, Testing Floor flash, and onboarding commendation.

### Screen 13 onward

- Increase group count and reduce cue obviousness gradually.
- Add fair decoys, cue overlap, temper bleed, suppressed cues, contagion, and Temper Storms only after prerequisites are learned.
- Transition from one screen per file to multiple screens per file.
- Never make a cosmetically deceptive glitch invalidate deterministic scoring.

## Functional requirements

### Progression

- Track files completed, screens completed, total bins, per-temper bins, mistakes, resumes, perfect screens/streaks, archive interactions, reward interactions, file abandonment/return, and special hidden interactions.
- Support fixed absolute milestones and normalized milestones that scale with final campaign length.
- Keep screens/files 1–12 hand-authored and invariant under scaling.

### Content scheduler

- Evaluate eligible content after each score event and on safe menu/resume events.
- Prioritize tutorial-critical events and named-file landmarks.
- Show at most one major, one minor, and one ambient event at a time.
- Queue displaced deterministic events.
- Apply content cooldowns and a first-30% pity timer.
- Record `eligible`, `shown`, `skipped`, and `revisited` states separately.
- Place critical skipped lore in the archive.

### Archive

- Store official Lumon/Handbook material, unauthorized literature, incentive objects, Perpetuity exhibits, branch records, incident reports, and discovered mysteries.
- Display internal canon labels to the player in credits or an optional lore-source view; at minimum, ensure all production entries retain these labels.
- Allow selected archive entries to change on revisit.

### Rewards

- The scheduled reward catalog may use only show-grounded items or experiences with an auditable source: eraser, finger trap, Outie-fact/Wellness cards, melon bar, Music Dance Experience, the unusual laser-etched crystal portrait gift, egg bar, watermelon-head remembrance, and Waffle Party tiers. A canonical reward may repeat at a later threshold with a new fact, genre, duration, or presentation tier rather than being replaced by an invented prop.
- Paintball, coffee cozies, and handbook totes are dialogue-canon but visually unspecified. They must not receive generated hero art or appear in the active scheduled reward catalog. The Perpetuity pass, incentive-shelf key, food tokens, MDE voucher, scripture folios, commendation stamp, certificates, badges, and branch memo are game inventions and must not be presented as canon rewards.
- Caricature portraits are canonically listed incentives but are intentionally excluded from this game by product direction. No replacement may imply that an invented prop is a shown Lumon reward.
- Make reward triggers deterministic and visible in an **Incentive Forecast** surface.
- Keep every unearned reward’s identity secret. Before unlock, show only `NEXT INCENTIVE`, its governing counter, current progress, remaining amount, and exact action required.
- Show only the next threshold in each active ladder. Do not reveal names, silhouettes, categories, rarity, or subsequent rewards.
- When a threshold is reached, interrupt at the next safe boundary with a distinct anticipation, reveal, and celebration sequence. Reveal the reward’s name and visual only at that moment.
- After the celebration, place the reward on the incentive shelf and immediately show progress toward the next unknown incentive.
- Use separate visible ladders for files completed, total bins completed, temper mastery, and perfect-play mastery.
- When reward triggers collide, queue the later reward without changing its earned status.
- Track reward inspection to power the harmless “enjoy equally” system.
- Never withhold gameplay power based on preference answers.
- Remove caricature and employee-portrait rewards entirely. No active reward may depend on a player portrait, generated employee likeness, framed portrait upgrade, or actor likeness.
- Every active reward record must store a canon status, episode or official-companion source, visual-evidence status, and rights-review status. `CANON_DIALOGUE_ONLY` and `ORIGINAL_APOCRYPHA` entries cannot supply active reward hero art.

### Wellness and Outie facts

- Maintain a reviewed fact bank with `CANON_WELLNESS_CLAIM` episode-derived paraphrases and separately labeled `ORIGINAL_APOCRYPHA` facts.
- Present the exact same approved sentence as card typography, caption text, and spoken audio.
- Never generate a fact from device data, account data, location, contacts, photographs, or inferred player identity.
- Sprinkle fact cards through file, bin, resume, and precision milestones; repeat full Wellness sessions later at deterministic milestones.
- Persist selected fact IDs before presentation so a force-quit cannot reroll a fact.
- Use a calm original performance voice. Do not imitate Ms. Casey or any actor.

### Music Dance Experience

- The first MDE is a playable, no-fail rhythm-combination mini-game rather than a passive film.
- Transform the live MDR number field into the dance floor so the event feels like the core game becoming celebratory.
- Ask the player to connect three or more simultaneously lit numbers of one temper and release on the beat. Successful groups merge with a satisfying phosphor burst and fill a three-segment Dance Meter.
- Use shape, motion, brightness, audio, and haptics in addition to color.
- Run a short instruction, approximately 45 seconds of casual play, then a generated finale video and score card.
- Treat the seven supplied game screenshots as the authoritative UI reference for MDE implementation. The normal portrait crop, CRT number field, top status area, mode controls, and bottom temper bins remain recognizable; generated terminal redesigns are not implementation references.
- Keep the playable UI and the reward cinematic separate. The finale cinematic depicts the MDR office dance environment established in *Defiant Jazz*: the workstation island, green partitions/carpet, metal music cart/record player, one accessory, and colored ceiling-light reveal. It does not depict a newly invented arcade machine.
- Missing a beat may reset a multiplier but never fails the reward or removes progress.
- Music selections may reference the show’s approved genre naming, but shipped recordings must be licensed or newly composed. Do not copy the melody or arrangement of a copyrighted track without rights clearance.

### Easter eggs and surprises

- Do not display easter-egg thresholds or completion bars.
- Select easter eggs from eligibility-gated weighted pools with anti-repeat cooldowns and hidden guarantees.
- Randomize the exact safe boundary within a short window so surprises feel spontaneous while important lore is not permanently missable.
- Keep discovered easter eggs in the archive; undiscovered items remain absent rather than greyed out.
- Treat department-conflict paintings, goat intrusions, contradictory notices, second cursors, hallway flashes, and altered archive records as easter eggs or hidden story beats—not visible rewards.
- Support paired department paintings that depict opposite aggressors while leaving the underlying event unresolved.

### Narrative anomalies

- Support timed visual/audio/haptic interstitials, fake in-game update notices, Board-presence states, secondary cursor, temporary archive variants, Testing Floor flashes, and Overtime mode.
- Keep fake system elements visibly within the app’s fiction.

### Accessibility

- Provide reduced motion and reduced flicker.
- Provide captions and visual/haptic equivalents for audio cues.
- Provide high-contrast and non-color-only temper cues.
- Maintain stable touch targets during screen-wide anomalies.
- Pause performance timers during idle secrets or forced narrative events.

## Lore governance requirements

Every narrative item must specify one of:

- `CANON_SHOWN`
- `CANON_DIALOGUE_ONLY`
- `OFFICIAL_COMPANION`
- `CANON_UNEXPLAINED`
- `ORIGINAL_APOCRYPHA`
- `FAN_THEORY`

Rules:

- Do not present fan theories as confirmed.
- Do not explain unresolved canon mysteries.
- Label original pseudo-Kier and Ricken-style writing as game-created in production records.
- Check every shipped canon claim against an episode or official companion source.
- Generated art is never itself canon. It may be labeled `SHOW_GROUNDED_REPRESENTATION` only when every identifiable object and event in the plate has an on-screen visual basis. Do not invent the appearance of a dialogue-only item.
- Use paraphrase and original branch material rather than lengthy quotation.

## Content requirements by 30% completion

“30%” means expected playtime/screens, not 30% of the file count, because later files contain multiple screens. Every player who reaches that point must have encountered:

- eraser and finger trap;
- at least one food incentive;
- a watermelon-head memorial beat and the unusual crystal portrait gift;
- at least six Outie/Wellness facts, including at least two spoken in a full Wellness session;
- first playable MDE, its generated finale film, and one later genre or abnormal-MDE teaser;
- unauthorized Ricken-style text;
- goat clue;
- Board presence;
- Security or protocol language;
- Testing Floor imagery;
- at least one Lexington breadcrumb;
- fake corporate software update;
- at least one Perpetuity/Eagan artifact;
- one behavior-reactive event from mistakes, resumes, mastery, or archive activity.

## Late-game content requirements

Reserve:

- full Cold Harbor-style consciousness landmark;
- full Overtime Contingency side event;
- higher-tier Waffle Party ritual;
- strongest Testing Floor/file-name connection;
- single unexplained Revolving message.

## UX and performance requirements

- Portrait-first layout with one-handed reach considered for core actions.
- Primary number-field touch targets meet mobile accessibility guidance.
- Non-skippable narrative interruption is no longer than 15 seconds; landmark cinematics are skippable and archived.
- Visual glitches do not reduce frame rate below the established gameplay target.
- Resume restoration returns the player to an unambiguous safe state.
- Offline core play remains possible; remote/generative content must be prepackaged or have a fallback.

## Analytics requirements

Track tutorial funnel, screen/file completion, wrong-bin frequency, return/resume count, reward-forecast views, reward eligibility/claim, easter-egg eligibility/roll/impression, skips, archive use, reward interactions, perfect streaks, content dry spells, and churn following major events.

Initial success criteria:

- By screen 3, every completing player has seen at least one reward and one anomaly.
- By screen 12, every completing player has received the full onboarding content bundle.
- Before 30%, no more than two completed screens pass without a content beat.
- At least 60% of archive-unlocked players open it.
- Canon-vs-theory research comprehension is acceptably high before narrative lock.

## Legal and trust requirements

- Confirm licensing posture before public distribution.
- Perform rights review for title, names, props, visual designs, music, likenesses, and marketing.
- Avoid cast likeness generation without permission.
- Do not collect private device data for narrative personalization.
- Do not imitate emergency or real OS security alerts.
- Never erase player progress as a narrative joke.

## Dependencies and open decisions

1. Final campaign file count.
2. Exact mapping of screens to files during the first twelve screens.
3. Spoiler filter scope.
4. Licensing posture.
5. Temper cue accessibility system.
6. Fixed versus branching ending.

## Acceptance criteria for Phase 1

- `PRD.md`, `DESIGN.md`, and the dedicated lore/progression specification exist under `product-context/specs/`.
- The progression includes concrete milestones for files, bins, mistakes, resumes, and additional behaviors.
- Tutorial milestones are fixed and front-loaded.
- Late-game reserved content is explicitly limited.
- Canon/theory labeling and production guardrails are documented.
- No application code is written during this phase.
