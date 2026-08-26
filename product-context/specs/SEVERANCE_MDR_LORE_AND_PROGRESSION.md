# Severance MDR Lore, Rewards, and Easter-Egg Progression

Status: Phase 1 product/design reference  
Audience: product, narrative, design, engineering, audio, and generative-media teams  
Spoiler scope: full Seasons 1 and 2, plus *The Lexington Letter*  
Last updated: 2026-08-25

## 1. Product thesis

The game should not feel like an MDR-inspired number sorter decorated with references. It should gradually behave as though Lumon itself published the app.

The central emotional promise is:

> Something strange could happen almost any time, and the app may know more about the player than it admits.

The tutorial is part of the fiction, not a delay before the fiction. The first twelve screens must teach the tempers and controls while also delivering several recognizable rewards, one recurring mystery, one comic corporate intrusion, and one genuinely unsettling anomaly. The best-known material should be spent aggressively during the first 25–30% of play. Only a few events need to remain exclusive to the late game.

## 2. Lore-labeling rules

Every narrative asset must carry one internal label. The label does not have to be shown to the player, but it must be visible in the content database and review tools.

| Label | Meaning | Usage rule |
|---|---|---|
| `CANON_SHOWN` | Directly depicted in the aired show | Generated representations may use only visually evidenced objects/events; do not invent explanatory details |
| `CANON_DIALOGUE_ONLY` | Stated or offered in dialogue but not visually established | May be mentioned in text; may not receive active generated hero art |
| `OFFICIAL_COMPANION` | Established in official supplementary material such as *The Lexington Letter* | Treat as part of the world while preserving any ambiguity in the source |
| `CANON_UNEXPLAINED` | Its existence is canonical, but its purpose or nature remains unresolved | Show the clue; do not solve it |
| `ORIGINAL_APOCRYPHA` | New game material written in a Lumon/Kier/Ricken-like register | Clearly track internally as an invention; avoid fabricated “quotes” attributed to the show |
| `FAN_THEORY` | A community interpretation not confirmed on screen | Use only as implication, optional clue, or contradictory evidence; never state it as fact |

Examples:

- Four Tempers, the shown MDR rewards, the Music Dance Experience, the Waffle Party, Overtime Contingency, the Testing Floor, Gemma’s multiple innies, and Cold Harbor’s connection to MDR: `CANON_SHOWN`.
- Paintball, coffee cozies, and handbook totes: `CANON_DIALOGUE_ONLY`; their visual appearance remains unspecified.
- The Lexington file, Peg/Peggy K., Puglish, and the apparent temporal proximity between refinement and the Dorner truck explosion: `OFFICIAL_COMPANION`. Causation remains unconfirmed.
- The purpose of the goats, the true nature of the Board, and the meaning of “the Revolving”: `CANON_UNEXPLAINED`.
- New “lost” Kier passages for Frolic, Dread, and Malice: `ORIGINAL_APOCRYPHA`.
- Goats as test subjects for Gemma, the Board as an AI or Eagan hive mind, or the Revolving as literal consciousness transfer: `FAN_THEORY`.

## 3. Hidden narrative arc: Lumon infects the app

The progression is divided into five invisible phases. Players never see phase numbers.

### Phase 1 — The obedient employee

The app behaves exactly as its instructions claim. The player refines numbers, earns childish incentives, and receives stiff praise. Small anomalies are deniable.

### Phase 2 — Peripheral anomalies

Brief events appear without acknowledgement: a distant goat bleat, a hallway for three frames, an unfamiliar reflection in the CRT, a file name the player did not select, or a single white hair caught at the display edge.

### Phase 3 — Contradictory instructions

The handbook and interface disagree. A message says “DO NOT REFINE THESE NUMBERS” and vanishes. A second cursor moves independently. A fake software update claims to have removed a hallway that “did not exist.”

### Phase 4 — The floor beneath the floor

Testing Floor doors, Cold Harbor-adjacent readouts, Security protocol names, Eagan records, Board interventions, exports, and branch records connect the MDR work to people and events beyond the number screen.

### Phase 5 — The app recognizes an Outie

The phone becomes part of the fiction. Inside the game—not as deceptive operating-system impersonation—the app reports Outie facts, comments on time away, produces identity fragments, and briefly enters an Overtime Contingency presentation.

Privacy and trust guardrail: use only ordinary, clearly disclosed game state and coarse device facts already needed by the game, such as resume count and local time. Do not read contacts, photos, microphone recordings, location, notifications, or unrelated device data for a scare. Do not imitate a real emergency, security alert, or OS permission dialog.

## 4. Core progression structure

### Fixed onboarding: screens 1–12

The first twelve screens are hand-authored. This plan resolves the described overlap at screen 4 by treating it as the transition screen; if the current build already places the two-group lesson at screen 4, keep that implementation and shift the first four-row table’s content one screen earlier.

| Screens | Mechanical lesson | Content objective |
|---|---|---|
| 1–4 | One strange group, one relevant temper/bin; introduce one temper at a time | A reward or secret every one to two screens; establish Lumon’s friendly control |
| 5–8 | Two simultaneous groups associated with different tempers; two-bin decisions | Start recurring mysteries; let comic rewards and unease coexist |
| 9–12 | Four temper groups and four-bin sorting | End onboarding with a dense run of payoffs and one major event |
| 13+ | More groups, subtler visual/audio tells, decoys, mixed signals, and eventually multiple screens per file | Shift from tutorials to variable-density progression and systemic lore triggers |

Tutorial protection rules:

1. Lore may distract, but must not obscure the new mechanic being taught.
2. A major event occurs only after a successful screen, never during the player’s first attempt at a new control.
3. No mandatory interaction exceeds 12 seconds during screens 1–8.
4. Wrong-bin narrative responses begin only after the wrong-bin concept is clearly explained.
5. By screen 12, the player has seen at least two tangible incentives, one Outie fact, one unauthorized text, one goat clue, one fake corporate notice, one wellness-style event, and one MDE.

### Reference campaign size

The tables below use a 50-file reference campaign so the milestones are concrete and the final active reward can land at file 50. Files 1–12 are fixed. If the final campaign size changes, keep files 1–12 unchanged and map files 13–50 proportionally across the remaining campaign.

| Reference file | Normalized point after onboarding |
|---:|---:|
| 14 | 5% of post-onboarding campaign |
| 16 | 11% |
| 18 | 16% |
| 20 | 21% |
| 24 | 32% |
| 28 | 42% |
| 32 | 53% |
| 36 | 63% |
| 40 | 74% |
| 44 | 84% |
| 48 | 95% |
| 50 | 100% |

## 5. Pacing principles

### Front-load the good stuff

- Deliver the first micro-reward on the first successful screen.
- Deliver a tangible canonical incentive by screen 2.
- Deliver the first anomaly by screen 3.
- Deliver the first recurring mystery by screen 6.
- Deliver the first MDE and Testing Floor flash by screen 12.
- Spend recognizable material throughout the first 30% of expected playtime/screens: eraser, finger trap, melon/egg food imagery, Outie facts, Ricken-style unauthorized literature, goats, Board presence, Security language, abnormal MDE, and a Lexington breadcrumb. Because later files contain multiple screens, “30%” is not the same as 30% of the file count.

### Use multiple counters

Lore must not depend only on file completion. Independent counters make the game seem observant and prevent long dry spells:

- screens and files completed;
- total bins completed;
- bins completed for each temper;
- wrong-bin mistakes;
- continue/resume count;
- perfect screens and perfect streaks;
- archive visits and recovered texts;
- idle behavior and unusual interaction;
- repeat MDE choices;
- file abandonment and return;
- completion time bands and clean recoveries after mistakes.

### Content cadence

- Tutorial: one content beat every 1–2 screens.
- First 30%: no more than two normal screens without a reward, mystery beat, joke, collectible, or meaningful progression notice.
- Middle: one major event every 4–6 screens, with micro-events between.
- Late: fewer but more consequential events; avoid making the ending feel emptier than onboarding.
- Never schedule two major events back-to-back. If triggers collide, queue them.

### Rewards versus easter eggs

These systems must feel different.

| System | Player knowledge | Timing | UI treatment |
|---|---|---|---|
| Scheduled reward | Player knows the exact requirement and progress, but not the reward’s identity | Deterministic | Visible `NEXT INCENTIVE` counter; reward name and visual appear only when earned |
| Easter egg | Player does not know it exists or when it will appear | Weighted surprise window with hidden guarantee | No locked slot, threshold, checklist, or progress bar |
| Story landmark | Player may sense escalation but does not see a reward counter | Hidden deterministic window | Archived after discovery; never described as an incentive |

Rewards are promises whose contents remain sealed. Easter eggs are discoveries. Randomness may change a reward’s harmless cosmetic detail, but it never changes whether or when the player earns it.

The forecast has four visible ladders:

1. Files completed.
2. Total bins refined.
3. Per-temper mastery, revealed after screen 12.
4. Perfect-play mastery, revealed after the first perfect screen.

At all times, the player can answer: “What do I need to do for the next reward, and how close am I?” They cannot answer “What is the reward?” until the reveal.

When a reward is earned, it must **pop** as a celebratory moment rather than silently enter a menu:

1. Clear the normal results UI.
2. Present a sealed `INCENTIVE EARNED` state.
3. Reveal the reward name and visual for the first time.
4. Play a reward-specific animation, sound sting, and restrained haptic flourish.
5. Add the reward to the shelf/archive.
6. Immediately display progress toward the next unknown incentive.

Ordinary object reveals target 5–8 seconds. Major experiences such as an MDE or Waffle Party can run longer, are skippable, and remain replayable. Collision-queued rewards retain their own reveal rather than being reduced to a notification.

### Event budget and priority

At the end of a screen, the scheduler may show:

- at most one `MAJOR` event;
- at most one `MINOR` event;
- at most one `AMBIENT` event;
- no more than 15 seconds of non-skippable content.

Priority order:

1. tutorial-critical lesson;
2. narrative landmark tied to a named file;
3. first-time canonical reward;
4. behavior-reactive event;
5. counter milestone;
6. ambient random anomaly.

All displaced deterministic events remain queued. Random ambient events may be discarded.

## 6. Fixed onboarding schedule

| Screen/file beat | Mechanical state | Guaranteed reward, secret, or lore beat | Size | Lore label |
|---:|---|---|---|---|
| 1 | First temper, one group | First successful refinement produces an **eraser** in the desk drawer; “Your work is mysterious and important” tone without quoting show dialogue | Minor | `CANON_SHOWN` reward, original copy |
| 2 | Second temper | **Finger trap** collectible; rotate it to reveal a tiny branch/serial code | Minor | `CANON_SHOWN` reward, `ORIGINAL_APOCRYPHA` clue |
| 3 | Third temper | First “fact about your Outie,” benign and absurd; corridor-flash surprise pool becomes eligible for screens 3–4 | Minor + ambient eligibility | `CANON_SHOWN` format, original fact |
| 4 | Fourth temper / transition | Official Handbook archive tab unlocks; first short paraphrased entry on the Four Tempers | Minor | `CANON_SHOWN` concept |
| 5 | First two-group screen | A dry **melon bar** interstitial; “Please enjoy each cube equally” survey | Minor | `CANON_SHOWN` incentive, original presentation |
| 6 | Two groups | Goat surprise pool becomes eligible across screens 5–8; first event is a faint bleat with no acknowledgement | Ambient eligibility | `CANON_UNEXPLAINED` |
| 7 | Two groups | First page of **unauthorized literature**, an original Ricken-like aphorism; interface warns of “personality leakage” | Minor | `CANON_SHOWN` corpus, `ORIGINAL_APOCRYPHA` text |
| 8 | Two groups | Fake **Lumon OS update**: “Improved compliance; reduced unnecessary curiosity”; footer exposes a redacted Security protocol field | Minor | `ORIGINAL_APOCRYPHA`; protocol name requires canon review |
| 9 | Four groups | First short **Wellness Session** with three spoken Outie facts; facts mix episode-derived paraphrase and labeled original material | Major | `CANON_SHOWN` format; mixed governed content |
| 10 | Four groups | First playable **Music Dance Experience**; the supplied game UI becomes the dance floor, then a separate office-scene film plays | Major | `CANON_SHOWN` reward, original gameplay implementation |
| 11 | Four groups | Testing/Lexington surprise pool becomes eligible across screens 10–12; one 300–500 ms hallway/door flash is secretly guaranteed by screen 12 | Ambient eligibility | `CANON_SHOWN` Testing Floor language + `OFFICIAL_COMPANION` breadcrumb; no causal claim |
| 12 | Onboarding graduation | **Laser-etched crystal portrait gift** on its illuminated base; archive, incentive shelf, and mystery index unlock; brief Board-presence stinger after dismissal | Major + ambient | `CANON_SHOWN` unusual gift; `CANON_UNEXPLAINED` Board |

The first twelve screens deliberately contain more content than a conventional tutorial. The goal is not randomness; it is a controlled proof that the game will keep rewarding attention.

## 7. File-completion milestone track

Files remain the clearest campaign backbone. After file 12, individual files may span multiple screens.

| Files completed | Guaranteed event | Player-facing effect | Size | Lore handling |
|---:|---|---|---|---|
| 1 | Eraser | Added to incentive shelf | Minor | Canonical incentive |
| 2 | Finger trap | Interactive collectible with serial clue | Minor | Canonical incentive; new clue is apocrypha |
| 3 | First Outie fact | Wellness card | Minor | Original copy in canonical format |
| 4 | Handbook opens | Four Tempers overview | Minor | Paraphrase canon; do not reproduce long source text |
| 5 | Melon bar | Brief fruit tableau and equal-enjoyment prompt | Minor | Canon-inspired branch variant |
| 6 | Goat audio pool opens | Distant bleat may occur at a safe boundary; hidden guarantee by file 8 | Ambient eligibility | Purpose unresolved |
| 7 | Unauthorized text I | Original Ricken-like page | Minor | New text, never represented as a show quote |
| 8 | OS update I | Corporate patch notes | Minor | Game-original |
| 9 | Wellness I | Three spoken Outie facts with synchronized cards and captions | Major | Episode-derived paraphrases plus labeled original facts |
| 10 | MDE I | 45-second no-fail rhythm-combination mini-game followed by generated finale film | Major | Canonical reward, original execution |
| 11 | Testing flash pool opens | Hallway and labeled-door variants enter surprise rotation | Ambient eligibility | No explanation |
| 12 | Orientation complete | Crystal commendation + archive hub | Major | Branch-specific variation |
| 13 | Outie fact encore | A new card uses the next unseen approved fact | Minor | `CANON_WELLNESS_CLAIM` or labeled `ORIGINAL_APOCRYPHA` |
| 14 | **LEXINGTON** breadcrumb I | File name appears in a manifest, then disappears | Minor | Official companion; no causal claim |
| 15 | Goat clue II | A single white hair appears caught against the CRT bezel | Ambient | Purpose unresolved |
| 16 | Egg bar | Deadpan egg interstitial; reuse the shown reward family without an invented token or recipe-card prop | Minor | Canonical incentive reference |
| 17 | Watermelon-head memorial | A carved melon likeness commemorates a “retired” branch refiner the player has never met | Minor | Canonical memorial imagery, original character |
| 18 | Wellness II, then Board presence I | Four approved facts play first; after dismissal, the score panel goes dark and a low tone signals a queued Board review | Major | Canonical Wellness format; never depict or identify the Board |
| 20 | Perpetuity exhibit I | First Eagan wax figure/plaque; one date conflicts with archive metadata | Minor | Canon framework, game-original exhibit |
| 22 | Security protocol fragment I | A protocol name appears in an error log without explanation | Minor | Use confirmed names only where verified; invented ones get apocrypha label |
| 24 | MDE II, abnormal | Figure-like reflection; music ends but footsteps continue briefly | Major | Original escalation |
| 26 | MDE encore | A second verified genre selection and longer Dance Meter sequence; no voucher prop | Major | `CANON_SHOWN` reward, original gameplay implementation |
| 28 | Door/file correspondence | A Testing Floor door bears a previously completed file name | Major | Connection may be suggestive; do not over-explain |
| 30 | Lexington breadcrumb II | Redacted clipping mentions a Dorner vehicle incident after Lexington completion | Minor | Official companion; temporal link only, not confirmed causation |
| 32 | Temper bleed introduced | First cluster emits two conflicting cues; later archive calls it a “calibration variance” | Major/gameplay | Original mechanic grounded in temper fiction |
| 34 | Waffle Party I | When both file 34 and 200 bins are satisfied, show waffles, syrup, and the founder-bedroom setting without dancers; otherwise keep the compound reward pending | Major | Canonical reward, new branch presentation |
| 36 | Overtime precursor | Identity badge flashes for two seconds; archive briefly loses Kier text | Major | Canonical protocol, original teaser |
| 38 | Cold Harbor prelude | Five-meter readout, heartbeat layer, anonymous silhouette | Major | Canon link; exact mechanics remain fictionalized |
| 40 | Cold Harbor-style landmark | Full rule-changing sequence; MDR is explicitly framed as affecting a consciousness in this game’s branch | Landmark | Canon-inspired alternate branch; do not claim it is unseen show canon |
| 50 | Waffle Party II | After R19, file 50 and 750 bins unlock the restrained higher ritual tier; unmet compound conditions remain visibly pending without revealing the reward identity | Landmark | Canonical ritual elements; no copied choreography or likenesses |
| Post-credits/100% | “Revolving eligibility” | Phrase appears once at an incomplete percentage and is never explained | Ambient | `CANON_UNEXPLAINED`; no immortality claim |

If the game is much longer than 50 files, do not postpone Lexington, the first abnormal MDE, Board presence, or Testing imagery. Keep these absolute early milestones and add new midgame branches after them.

## 8. Total-bin milestone track

This track rewards mastery and maintains momentum when a file spans multiple screens.

| Total bins completed | Event | Purpose | Size |
|---:|---|---|---|
| 1 | “Bin integrity confirmed” stamp | Immediate acknowledgement | Micro |
| 3 | Tiny founder seal animates once | Early oddity | Ambient |
| 5 | Incentive shelf opens | The earned eraser and finger trap become inspectable; no invented key prop | Minor |
| 10 | Outie fact II | Keeps rewards dense before onboarding ends | Minor |
| 15 | “Please enjoy all incentives equally” survey | Inside joke and compliance counter introduction | Minor |
| 25 | Outie fact | Continues the recurring Wellness reward lane | Minor |
| 40 | Melon bar encore | New food arrangement, same shown reward family | Minor |
| 50 | Temper ratio report I | Shows a suspiciously deliberate WO/FC/DR/MA distribution | Minor |
| 64 | Fifth empty slot flashes in a four-temper report | Cold Harbor foreshadowing without explanation | Ambient |
| 75 | Temper doctrine card | Runtime-rendered verified/paraphrased handbook concept; no invented token | Minor |
| 100 | MDE encore | Player can launch one bonus short MDE directly; no voucher prop | Major |
| 125 | Equal-enjoyment audit | Survey complains if one incentive was inspected more often | Minor |
| 150 | Crystal portrait variant | Reuse the shown laser-etched crystal gift family with a different anonymous engraving | Minor |
| 200 | Waffle Party condition met | Forecast updates the compound file/bin goal without issuing an invented card | Micro |
| 250 | Wellness III, then Board review | Five spoken facts; silent low-tone intervention queues for next safe boundary | Major |
| 300 | Outie fact, then Overtime glyph | Deterministic fact card; one security switch appears later in archive and cannot be activated yet | Minor |
| 400 | Temper Storm story event | First screen-wide temper invasion; hidden gameplay event, not a scheduled reward | Major/gameplay |
| 500 | Egg bar encore | New table arrangement, same shown reward family | Minor |
| 750 | Waffle Party II bin condition met | Forecast updates the compound file-50/bin-750 goal; unlock occurs only after R19 and both counters are satisfied | Major |
| 1,000 | Archive checksum failure | Reveals final set of redacted branch records | Landmark |

Scaling rule: when a normal early screen yields more than four bins, scale the late thresholds upward so that 100 bins still occurs around 20–30% of the campaign. Thresholds 1–25 remain fixed.

## 9. Wrong-bin mistake track

Mistakes should make the app feel watchful, not grant valuable rewards that encourage deliberate failure. Narrative reactions are short, and the sole longer Break Room event happens once.

| Cumulative wrong-bin mistakes | Reaction | Design rule |
|---:|---|---|
| 1 | Polite correction: “The temper did not consent to that bin.” | Only after wrong-bin behavior has been taught |
| 3 | Supervisor note appears in the archive | No loss beyond the existing gameplay consequence |
| 5 | Screen pauses for one beat; “Your error has been witnessed.” | Ominous but brief |
| 7 | One-time Break Room-style event | 8–12 seconds; skippable after first completion; no microphone use |
| 10 | Apology text mutates from “my errors” to “my refinement” | Narrative escalation |
| 13 | A clearly wrong bin is briefly shown as accepted, then the record corrects itself | Never affect actual scoring or teach false rules |
| 17 | “Compunction statement” unlocks in archive | Collectible, not a power-up |
| 23 | Red hallway flash after the correction | Ambient escalation |
| 31 | Error log shows a second employee ID sharing responsibility | Branch mystery |
| 40 | Management stops correcting the player for one full screen | Unsettling absence; normal validation resumes afterward |

Cooldown: at least two completed screens between mistake-track reactions. If the player is struggling, suppress all non-instructional punishment flavor until they successfully complete a screen.

## 10. Continue/resume count track

A “resume” increments when a previously suspended or closed game returns to an existing run, not when the app briefly loses focus. Use a 10-minute minimum gap so ordinary interruptions do not inflate the count.

| Resume count | Event | Notes |
|---:|---|---|
| 1 | Standard “Welcome back, Refiner” | Baseline |
| 2 | Outie fact card | Guaranteed early hook; identity remains classified until reveal |
| 3 | Time-away report is off by exactly one minute, then self-corrects | Fictional glitch, not a deceptive real clock |
| 4 | Outie fact card | Alternates source pool and excludes seen facts |
| 5 | Outie message II: “Your Outie did not write this.” | First impossible statement |
| 7 | A second cursor is visible for two seconds on the continue screen | Never interferes with sorting |
| 8 | Outie fact card | Third return-lane reward |
| 9 | OS update II claims a hallway was removed and never existed | Recurring corporate contradiction |
| 12 | Overtime Contingency microburst: archive changes for three seconds | Teaser only |
| 15 | Employee identity badge appears with most fields redacted | Mystery collectible |
| 20 | Outie message III says the Outie recognizes the current file name | Major implication |
| 25 | Full Overtime Contingency side event becomes eligible | Also requires file 30+ so it cannot be rushed by reopening |

Do not ask the player to close and reopen the app. These events reward natural return behavior and should feel discovered, not farmed.

## 11. Temper-specific bin tracks

Each temper develops a hidden mythology and eventually escapes its assigned bin.

### Woe

| Woe bins | Event |
|---:|---|
| 10 | Archive meditation on weight and descent (`ORIGINAL_APOCRYPHA`) |
| 25 | Appendix IV/Woe fragment paraphrase (`CANON_SHOWN`, carefully reviewed) |
| 50 | Woe UI event: labels sag several pixels |
| 100 | Woe Storm: digits and interface settle toward the bottom |

### Frolic

| Frolic bins | Event |
|---:|---|
| 10 | Original lost-encounter fragment (`ORIGINAL_APOCRYPHA`) |
| 25 | Digits playfully exchange positions after scoring |
| 50 | Bonus MDE genre unlock |
| 100 | Frolic Storm: digits dodge and tease without compromising touch targets |

### Dread

| Dread bins | Event |
|---:|---|
| 10 | Original lost-encounter fragment (`ORIGINAL_APOCRYPHA`) |
| 25 | Audio whispers increase as selection approaches, then stop |
| 50 | A normal cluster recoils once but remains non-sortable |
| 100 | Dread Storm: screen elements subtly evade touch while hit areas remain stable |

### Malice

| Malice bins | Event |
|---:|---|
| 10 | Original lost-encounter fragment (`ORIGINAL_APOCRYPHA`) |
| 25 | Border pulse and CRT bloom after scoring |
| 50 | Selection reticle appears to be charged by a cluster |
| 100 | Malice Storm: digits surge outward while accessibility protections remain intact |

Equal-temper achievement: completing at least 25 of all four tempers unlocks “A Balanced Employee,” immediately followed by a warning not to take pride in balance.

## 12. Mastery and behavior triggers

### Perfect play

| Trigger | Event |
|---|---|
| First perfect screen | Outie fact card; this organically reveals the precision lane |
| 3 perfect screens in a row | Finger trap variant |
| 5 perfect screens in a row | Melon bar encore |
| 10 perfect screens in a row | Music Dance Experience encore |
| Perfect four-temper screen under par time | Hidden Board-presence easter egg becomes eligible within the next three safe transitions |
| Perfect completion of a multi-screen file | One verified/paraphrased handbook doctrine card |

### Recovery and persistence

| Trigger | Event |
|---|---|
| Finish a screen perfectly after 3+ mistakes on the prior screen | “Rehabilitation acknowledged” note |
| Return to an abandoned file and complete it | File’s archive page contains handwriting: “You came back.” |
| Fail the same group twice, then identify it correctly | Temper-specific coaching line becomes subtly personal |

### Archive behavior

| Trigger | Event |
|---|---|
| First archive visit | Normal orientation tour |
| Third archive visit | Unauthorized Literature shelf becomes visible for one second |
| Read all available official texts | New redacted page appears with no unlock notification |
| Alternate between Kier and Ricken texts 5 times | “Personality leakage detected” |
| Inspect a Perpetuity plaque for 10 seconds | Wax figure turns its eyes after the player scrolls away |
| Reopen an already read Lexington record | Puglish-like notation appears in its margin |

### Idle and unusual interaction

| Trigger | Event |
|---|---|
| Idle 30 seconds on a safe menu | Fluorescent hum changes; distant cart wheel |
| Idle 60 seconds on an MDR screen | One normal digit looks toward the cursor, then resets; pause scoring timer |
| Tap founder portrait 9 times | “Please refrain from testing the Founder” |
| Try to rotate device during a locked narrative event | Brief alternate branch logo, then return to portrait mode |
| Choose the same MDE genre three times | “Preference detected” warning |
| Inspect one incentive far more than others | Equal-enjoyment audit |

Accessibility rule: secrets must never require hearing alone, rapid tapping, precise motion, or color discrimination. Every gameplay-relevant audio clue has a visual/haptic equivalent, and every essential visual clue has a nonvisual equivalent.

## 13. Reward catalog

### Active canon-grounded incentives

- Erasers and finger traps: early tangible collectibles.
- Music Dance Experience: interactive event where each temper animates differently.
- Waffle Party: multi-tier landmark, not a single badge.
- Egg bar, melon bar, and watermelon-head memorial imagery: comic rewards that can turn eerie.
- Laser-etched crystal portrait: rare special gift; keep it distinct from the standard handbook incentive ladder.
- Messages/facts from the Outie and Wellness Sessions: recurring narrative-reward lane.

Paintball, coffee cozies, and handbook totes remain `CANON_DIALOGUE_ONLY` reference notes because the show does not establish their appearance. Caricature portraits are canonically listed but intentionally excluded. Invented keys, tokens, vouchers, certificates, badges, passes, stamps, and memos are not active rewards.

### “Enjoy equally” meta-system

The game quietly tracks which incentives the player opens. At safe milestones it issues surveys:

- “How much did you enjoy your finger trap?”
- “More than the other incentives” is always an available but noncompliant answer.
- Preference produces a harmless “Wellness Compliance” warning, not reduced rewards or power.
- Repeated preference eventually unlocks an achievement named “Unequal Enjoyment.”

### MDE escalation

1. MDE I: joyful, brief, mechanically readable.
2. MDE II: one cluster continues dancing after the music.
3. MDE III: reflected figure and slowed audio.
4. MDE IV: Testing Floor elevator flash.
5. MDE V: silence, but footsteps remain.

The player chooses among absurd corporate genre names. Avoid copying the show’s full menu verbatim; create branch-specific choices.

### Waffle Party escalation

1. Waffles, syrup, founder portrait.
2. A mask appears beside the plate.
3. A shadow moves behind the viewpoint.
4. Abstract Four Temper silhouettes enter.
5. Optional short institutional-film sequence using original branch costumes and choreography.

Do not reproduce the exact Season 1 costumes, choreography, or room shot-for-shot.

## 14. Lore and mystery catalog

### Handbook, Compliance, and Appendix IV

The archive has three visual strata:

- Official Lumon text: concise paraphrases of established doctrine.
- Recovered text: contradictory or suppressed branch material.
- Appendix material: Woe content anchored to Season 2; new Frolic/Dread/Malice mythology is labeled internally as original apocrypha.

Avoid long quotations from the show or companion books. Original text should echo corporate scripture rhythm without copying recognizable passages.

### *The You You Are*

Unauthorized literature is a parallel progression corpus:

- Kier text represents obedience and control.
- Original Ricken-like text represents individuality and accidental insight.
- Ricken-style passages may reveal gameplay hints that Lumon refuses to state.
- The UI increasingly treats reading as “personality leakage.”

### The Lexington questline

This is an early-to-middle recurring investigation, not a late collectible dump.

1. A manifest briefly lists `LEXINGTON`.
2. Puglish-like encoded marks appear among digits or in archive margins.
3. A redacted branch memo mentions Peg/Peggy K.
4. A clipping mentions a Dorner Therapeutics vehicle incident.
5. A warning says “DO NOT COMPLETE LEXINGTON.”
6. A later record says Lexington was completed.
7. The archive presents competing explanations and never confirms that MDR caused the outside incident.

### MDR filenames as breadcrumbs

Names discussed in the prior brainstorm include Bellingham, Tumwater, Siena, Lexington, Chicxulub, Sunset Blvd, Sunset Park, Vilnius, Bodo, Molde, and Warrnambool. Use them as a breadcrumb vocabulary rather than an undifferentiated list.

- `LEXINGTON` is anchored to the official companion publication.
- `BELLINGHAM` is already part of this game’s branch presentation and should remain a plausible branch file unless a direct canon source is attached.
- The remaining names require an episode-frame/source review before being tagged `CANON_SHOWN`; some may be MDR files, Testing Floor rooms, or other labels rather than interchangeable categories.
- The most powerful reveal is correspondence: a name first seen as a normal MDR file later appears on a physical Testing Floor door.
- Never add exposition saying what the correspondence means. Let the player make the connection.

### Testing Floor interstitial library

Rare 0.25–1.5 second images:

- dentist chair under clinical light;
- aircraft cabin;
- desk of thank-you cards;
- empty holiday room;
- long corridor and single labeled door;
- red EXIT arrow;
- descending dark corridor;
- lone chair under fluorescent light;
- silhouette behind frosted glass;
- biometric plot paired with an anonymous face slot.

Base ambient chance after onboarding: approximately 1 in 15 eligible screens. Raise the chance near named story files. Never fire random images on every level.

### Goat escalation

1. Bleat in headphones with subtitle/haptic equivalent.
2. White hair on CRT edge.
3. 200 ms goat image.
4. Digits briefly form a goat silhouette.
5. “MAMMALIANS NURTU—” flashes.
6. File completion message: “THE KIDS ARE READY.”

No definitive purpose is supplied. Any connection to Gemma/testing remains theory.

### The Board

The Board is indicated only through absence, silence, a speaker glyph, an ellipsis, or a low tone. Never show an avatar or state that it is an AI, dead Eagans, Kier, Jame, or a hive mind.

### Eagan and Perpetuity records

Unlock wax figures, plaques, corporate inventions, mottos, and conflicting dates. Most content is branch-specific original apocrypha. Corruption escalates:

- missing face;
- redacted term of service;
- dates changing on revisit;
- figure’s head/eyes shifting after the player scrolls away;
- one exhibit claiming to commemorate an event that has not happened yet.

### Department paintings and weaponized history

This is a major recurring easter-egg lane.

`CANON_SHOWN`: Season 1 presents two near-identical paintings with reversed culpability. **The Grim Barbarity of Optics and Design** depicts O&D as the aggressors against MDR. **The Macrodata Refinement Calamity** depicts MDR as the aggressors against O&D. The departments also carry fearful rumors and distrust about one another.

`CANON_UNEXPLAINED`: The show does not establish that the depicted massacre truly happened or identify a historically accurate version.

`INFERENCE`: The paired images strongly support the reading that Lumon cultivates departmental fear by distributing contradictory visual history. Treat this as a design interpretation, not a settled lore fact.

Use the paintings as surprises rather than scheduled rewards:

1. **Cropped omen** — after another department is first mentioned, a 5–8% archive-rotation chance shows only a devotional-looking crop.
2. **First full painting** — a later safe transition reveals one department attacking another. No title card appears until the player reopens the archive.
3. **Opposing version** — at least two screens later, the same composition returns with aggressor and victim badges reversed. Secretly guarantee it within twelve eligible screens so the mystery is not missable.
4. **Archive comparison** — after both discoveries, the archive places the two shown titles side by side and labels the underlying event `UNRESOLVED`.
5. **Department rumor** — only verified on-screen rumors may be presented without an `ORIGINAL_APOCRYPHA` production label.

Surprise rules:

- Never list an undiscovered painting as a locked collectible.
- Never fire both opposing versions in the same session.
- Preserve the first version the player saw; the emotional effect depends on their initial allegiance.
- The paired images must use the same composition and camera so the role reversal is unmistakable.
- Do not add a third “true” version, invent provenance, or state that the depicted massacre occurred.
- Keep violence stylized and non-graphic enough for the game’s target rating.
- Do not confirm which department is “really” dangerous.

The asset-generation prompts for the paired paintings live in `REWARD_VISUAL_PROMPT_CATALOG.md` under “Department-painting easter eggs.”

### Security protocols

Confirmed protocol terms can appear as unexplained status messages. New protocol names should be plausible but internally labeled original. Do not turn every protocol into a mechanic; ambiguity is the appeal.

Potential mechanic treatments:

- Overtime Contingency: temporary Outie-view side event.
- Clean Slate: threatened in a memo; never casually used to wipe real player progress.
- Branch Transfer: swaps visual theme and file manifest for one screen.
- “Open House,” “Beehive,” “Goldfish,” or other terms: use only after a canon review of the exact names and current status.

### Outie messages and Wellness

Escalation ladder:

1. “Your Outie is proud of your productivity.”
2. Benign absurd fact.
3. Fact tied to the player’s file name.
4. “Your Outie has asked that you stop looking for them.”
5. “Your Outie did not write this.”
6. “I did.”
7. “Your Outie is currently holding this device.”

These are fictional lines. They are never presented as actual user-authored messages.

### Break Room

Use once as a shock, then only in abbreviated echoes. The first event asks the player to press and hold a button while a short compunction statement appears. It performs no emotion or voice analysis. A later archive version changes “my errors have caused harm” to “my refinement has caused harm.”

### Overtime Contingency

For 20–30 seconds:

- archive text changes;
- file names resemble fragments of external records;
- Kier passages disappear;
- a partial identity badge appears;
- a message allegedly written by “you” waits in the archive;
- colors, spacing, and audio are subtly less institutional.

Then the mode disengages. It is a self-contained secret path, not a permanent alternate campaign on first appearance.

### Cold Harbor-style landmark

This is the largest reserved late-game event. It changes the meaning of refinement:

- a second completion percentage advances elsewhere;
- heartbeat/biometric layers appear;
- binned tempers alter an anonymous human readout;
- a five-meter display contradicts the four-temper model;
- door interstitials correspond to previous files;
- the player is forced to confront that the work affects a consciousness.

Important distinction: Season 2 canonically links Mark’s MDR work, Gemma’s tempers, her multiple innies, and Cold Harbor. The specific branch, subject, meters, and outcomes in this game are original narrative material unless licensed story guidance says otherwise.

### The Revolving

Use the phrase once after the main campaign and never explain it. Theories involving immortality or consciousness transfer remain theories and should not become a confirmed ending.

## 15. Gameplay anomalies tied to tempers

These are progressive mechanics, not only visual jokes.

| Mechanic | Behavior | Introduction |
|---|---|---|
| False Temper | A cluster appears to signal one temper but belongs to another; must have a fair secondary cue | Midgame after mastery |
| Temper Bleed | One cluster alternates between two cue sets | File 32 reference point |
| Suppressed Temper | Primary visual motion is absent; audio/haptic or secondary visual reveals it | After accessibility alternatives are taught |
| Contagion | Selecting one group makes nearby normal digits temporarily inherit a cue | Mid/late |
| Temper Conflict | One cluster contains two tempers and requires a special split action or story choice | Late; never spring without instruction |
| Tamed | A frightening cluster becomes completely still when inspected | Late mystery |
| Temper Storm | One temper affects the full interface while touch targets remain stable | Mastery unlock |

Fairness rule: narrative unreliability may challenge interpretation but never invalidate a correct action without a readable reason. Glitches can lie cosmetically; the underlying scoring model must remain deterministic.

## 16. Content scheduler requirements

Each content item needs metadata:

```text
id
title
lore_label
spoiler_tier
event_size: LANDMARK | MAJOR | MINOR | MICRO | AMBIENT
trigger_type
trigger_threshold
secondary_requirements
cooldown_screens
priority
repeat_policy
queue_policy
accessibility_variants
content_dependencies
conflicts
analytics_event
```

Scheduler behavior:

1. Evaluate deterministic triggers after successful scoring.
2. Suppress events that would interrupt a new-mechanic lesson.
3. Pick the highest-priority major event; queue the rest.
4. Add at most one compatible minor and ambient beat.
5. Honor cooldowns and never repeat one-shot surprises.
6. Use a pity timer: if two full screens pass in the first 30% without any content beat, force an eligible micro-event.
7. Record what the player actually saw, not only what became eligible.
8. If content is skipped, keep critical lore readable in the archive afterward.

## 17. Content density targets

| Campaign segment | Guaranteed landmarks | Major events | Minor/micro/ambient beats | Max dry spell |
|---|---:|---:|---:|---:|
| Screens 1–12 | 1 | 3–4 | 8+ | 1 screen |
| 13–30% | 1–2 | 3–5 | 8–12 | 2 screens |
| 30–70% | 1–2 | 4–6 | 10–14 | 3 screens |
| 70–100% | 2 | 3–5 | 6–10 | 3 screens |

The late game reserves importance, not all novelty. It still needs humor, rewards, and small discoveries.

## 18. Analytics and success criteria

Track:

- tutorial completion by screen;
- first-session exit screen;
- return rate after each major event;
- percentage seeing each deterministic event;
- archive open/read rates;
- MDE choice distribution;
- skip rates and event duration;
- wrong-bin rate before/after narrative reactions;
- content dry-spell length;
- proportion reaching file 12, 20, 30, 40, and 50;
- player reports of confusion between canon and original material in research sessions.

Initial design targets:

- 95% of players who complete screen 3 have seen at least one reward and one anomaly.
- 100% of players who complete screen 12 have seen the required onboarding content bundle.
- No player in the first 30% goes more than two completed screens without a content beat.
- At least 60% of players who unlock the archive open it once.
- The first Break Room-style event does not increase immediate quit rate by more than 5 percentage points relative to adjacent screens.
- Research participants can correctly distinguish “confirmed by the show” from “game invention or theory” for the biggest story claims after viewing the archive labels/credits.

## 19. Production guardrails

### Tone

- Austerity first: white space, fluorescent hum, CRT glow, instructional language.
- Humor and dread share the same deadpan delivery.
- Rare, short anomalies are stronger than constant horror.
- Do not explain mysteries immediately after showing them.

### IP and attribution

- A public commercial release based directly on *Severance* requires appropriate rights and legal review.
- Do not reproduce long passages, full screens, costumes, choreography, music, performances, or dialogue from the show.
- Prefer an original Lumon branch, original employee, original file sequence, new corporate copy, and original ritual variants.
- Keep a source/label field on every asset so licensing and canon review are possible.

### Generative media

- Generate branch-specific imagery rather than actor likenesses or shot recreations.
- Avoid identifiable cast faces unless rights and likeness permissions are secured.
- Maintain prompt, model, seed/version, reference-source, and review records for every shipped asset.
- Interstitials must preserve readability, photosensitivity safety, and portrait composition.

### Accessibility and safety

- Provide reduced motion, reduced flicker, captions, haptic alternatives, and high-contrast cue modes.
- Never require microphone recording or emotional analysis for the Break Room.
- Keep fake system presentation visibly inside the game frame.
- Do not use real personal data for “Outie” scares.
- Never erase real progress as a Clean Slate joke.

## 20. Content reserved for late game

Only a few premium moments stay late:

1. Full Cold Harbor-style consciousness revelation.
2. Full Overtime Contingency side event.
3. Higher-tier Waffle Party ritual with abstract Four Tempers.
4. Strongest Testing Floor/file-name correspondence.
5. One unexplained “Revolving eligibility” message.
6. The clearest evidence that the player’s MDR work affects a person rather than abstract data.

Everything else—goats, Board presence, Security language, Outie facts, Ricken material, incentives, MDE, Testing imagery, and Lexington—begins early and escalates.

## 21. Canon reference notes

Primary/official anchors for review:

- Apple TV Press episode and image guide, including Season 2 episode listings: https://www.apple.com/tv-pr/originals/severance/episodes-images/
- Apple TV episode page for “Woe’s Hollow”: https://tv.apple.com/us/episode/woes-hollow/umc.cmc.39o64vs9jfwkrt6zr653oe0dx
- Apple TV episode page for “Cold Harbor”: https://tv.apple.com/us/episode/cold-harbor/umc.cmc.5065bga2frhqqqkim6g02q46j
- Apple TV episode page for “The Grim Barbarity of Optics and Design”: https://tv.apple.com/us/episode/the-grim-barbarity-of-optics-and-design/umc.cmc.2p44dud00b3x466a7i98sogw3
- Official Apple Books companion publication containing *The Lexington Letter*: https://books.apple.com/us/book/severance/id1613220757
- Secondary frame-level reference for *The Macrodata Refinement Calamity* (S1E5, approximately 39:05): https://content.severance.wiki/the_macrodata_refinement_calamity

Secondary interviews and recaps may be useful during writing, but every shipped “canon” claim should ultimately be checked against the episode or official companion material itself.

## 22. Open product decisions for Phase 2

These are implementation decisions, not blockers to this progression plan:

1. Final campaign file count and expected median screens per file after onboarding.
2. Whether each screen equals one file for all of files 1–12, or screen 4 already begins the overlap transition.
3. Spoiler mode: full S1+S2 only, or optional spoiler filters.
4. Licensing posture: official/licensed project, private prototype, or fan work.
5. Exact accessibility modes and which temper cues are visual, audio, and haptic.
6. Whether the Cold Harbor-style ending is a fixed narrative or one of several branch outcomes.
