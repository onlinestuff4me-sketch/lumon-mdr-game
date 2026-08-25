# Canon-Grounded Reward Visual and Prompt Catalog

Status: Phase 1 production reference  
Last updated: 2026-08-25  
Audience: product, narrative, art, motion, audio, and implementation teams

## 1. Canon rule

The active catalog contains only rewards whose object, room, or event is shown on screen or documented in Apple’s official companion material. A generated image is a `SHOW_GROUNDED_REPRESENTATION`, never canon by itself.

The following are not active visual rewards:

- paintball and coffee cozies: `CANON_DIALOGUE_ONLY`; Milchick offers them in S1E9, but the show does not establish their appearance;
- handbook totes: `CANON_DIALOGUE_ONLY`; mentioned in S1E4, visually unspecified;
- caricature portraits: canonical handbook incentive, intentionally excluded by product direction;
- shelf keys, food tokens, MDE vouchers, scripture folios, certificates, badges, passes, stamps, branch memos, Temper Storm access: `ORIGINAL_APOCRYPHA`, not shown Lumon rewards;
- pineapple bobbing: shown only inside Lumon’s S2 reform presentation; the retired photorealistic room extrapolated beyond that evidence.

## 2. Reward-system contract

Rewards are deterministic and telegraphed. Before unlock, show only:

```text
NEXT INCENTIVE
8 / 10 FILES COMPLETE
Complete 2 more files.
INCENTIVE DETAILS: CLASSIFIED
```

Never show an unearned reward’s name, image, silhouette, category, rarity, color theme, or later threshold. At a safe boundary after earning it:

1. persist `earned_pending`;
2. show a sealed `INCENTIVE EARNED` card for 0.5–1.5 seconds;
3. reveal the name and media together;
4. play the reward-specific 3–10 second celebration;
5. add the reward to the archive/shelf;
6. immediately show progress toward the next unknown incentive.

Easter eggs use a separate hidden scheduler and never appear in the forecast.

## 3. Canon-grounded milestone ladders

Repeated rewards are intentional. The game changes a fact, genre choice, duration, engraving, food arrangement, or ritual tier instead of inventing an unseen Lumon prop.

### File ladder

| Trigger | Internal reward | Locked forecast |
|---:|---|---|
| File 1 | R01 Eraser | `NEXT FILE INCENTIVE · 0 / 1` |
| File 2 | R02 Finger Trap | `NEXT FILE INCENTIVE · 1 / 2` |
| File 3 | R03 Outie Fact | `NEXT FILE INCENTIVE · 2 / 3` |
| File 5 | R05 Melon Bar | `NEXT FILE INCENTIVE · 3 / 5` |
| File 9 | R06 Wellness I | `NEXT FILE INCENTIVE · 5 / 9` |
| File 10 | R07 MDE I | `NEXT FILE INCENTIVE · 9 / 10` |
| File 12 | R08 Crystal Portrait Gift | `NEXT FILE INCENTIVE · 10 / 12` |
| File 13 | R03 Outie Fact encore | `NEXT FILE INCENTIVE · 12 / 13` |
| File 16 | R12 Egg Bar | `NEXT FILE INCENTIVE · 13 / 16` |
| File 17 | R13 Watermelon Remembrance | `NEXT FILE INCENTIVE · 16 / 17` |
| File 18 | R06 Wellness II | `NEXT FILE INCENTIVE · 17 / 18` |
| File 24 | R07 MDE II | `NEXT FILE INCENTIVE · 18 / 24` |
| File 26 | R07 MDE encore | `NEXT FILE INCENTIVE · 24 / 26` |
| File 34 and 200 bins | R19 Waffle Party I | show both exact counters; both required |
| File 50 and 750 bins | R22 Waffle Party II | show both exact counters; both required |

### Total-bin ladder

| Trigger | Internal reward |
|---:|---|
| 10 | R03 Outie Fact |
| 25 | R03 Outie Fact |
| 40 | R05 Melon Bar encore |
| 60 | R03 Outie Fact |
| 100 | R07 MDE encore; no voucher prop |
| 150 | R08 Crystal Gift variant; reuse the same grounded visual family |
| 250 | R06 Wellness III |
| 300 | R03 Outie Fact |
| 500 | R12 Egg Bar encore |
| 750 | satisfies the bin condition for R22 |

### Precision, temper, and return ladders

| Trigger | Internal reward |
|---|---|
| First perfect screen | R03 Outie Fact; reveals the precision lane |
| 3 perfect screens in a row | R02 Finger Trap variant |
| 5 perfect screens in a row | R05 Melon Bar encore |
| 10 perfect screens in a row | R07 MDE encore |
| 10 bins of one temper | short runtime-rendered doctrine card using verified/paraphrased canon; reuse R03’s blank card plate |
| 25 bins of all four tempers | R06 balanced Wellness session |
| 50 Frolic bins | additional verified MDE genre selection; no voucher prop |
| Resume 2, 4, and 8 | R03 Outie Fact, alternating show-derived and clearly labeled original pools |

Wrong-bin milestones unlock surprise eligibility, not rewards. The exact appearance is randomized within a bounded window and has no visible progress bar.

## 4. Shared visual requirements

- portrait 9:16 delivery, normalized to 720 × 1280 or larger;
- restrained institutional lighting and late-1970s office materials;
- no actor likenesses, copied frames, show logos, or essential generated text;
- no object or room whose visual appearance is only implied by dialogue;
- runtime typography supplies all required names and facts;
- reduced-motion still for every video;
- source episode and canon status recorded in the canon audit and implementation handoff.

## 5. Active reward media and prompts

All media paths in this section are relative to `product-context/outputs/reward_media/`. The prompts document the provenance of supplied assets and are available for explicitly authorized regeneration; they are not an instruction to replace active media during implementation.

### R01 — Standard Refiner Eraser

**Trigger:** file 1.  
**Canon basis:** the official handbook incentive chart lists a pencil eraser at 10%; erasers are part of MDR’s incentive culture.  
**Media:** `images/r01_eraser.png`.

**Prompt:**

```text
Use case: product-mockup
Asset type: portrait mobile reward image
Primary request: one pristine blue-green rectangular rubber pencil eraser centered in a shallow beige steel desk drawer lined with cream felt
Style/medium: photorealistic late-1970s corporate prop photography
Lighting/mood: pale fluorescent light with faint green CRT reflection; solemn, restrained, slightly absurd
Composition/framing: centered portrait 9:16 with empty space above for runtime copy
Constraints: no people, hands, logos, readable text, extra reward objects, or watermark
```

### R02 — Finger Trap

**Triggers:** file 2; precision streak 3 as a later variant.  
**Canon basis:** shown on MDR desks and listed at 25% in the official handbook incentive chart.  
**Media:** `images/r02_finger_trap.png`, `videos/r02_finger_trap.mp4`, `reduced_motion/r02_finger_trap_still.png`.

**Prompt:**

```text
Use case: product-mockup
Asset type: six-second portrait reward video
Primary request: one small blue-and-ivory woven paper finger trap rotates slowly on a cream laminate pedestal in a sparse institutional office
Lighting/mood: flat pale fluorescence and faint green monitor glow
Composition/framing: locked centered 9:16 shot; one slow 180-degree rotation; clean title space
Constraints: no hands, people, logos, readable text, extra objects, fast cuts, flashing, or watermark
```

### R03 — Fact About Your Outie

**Triggers:** files 3 and 13; bins 10, 25, 60, and 300; first perfect screen; resumes 2, 4, and 8.  
**Canon basis:** Wellness sessions present oddly specific Outie facts on screen. The approved text bank distinguishes `CANON_WELLNESS_CLAIM` from `ORIGINAL_APOCRYPHA`.  
**Media:** `images/r03_outie_fact_card.png`; runtime-render the approved sentence from `OUTIE_FACT_BANK.md` and use the identical sentence for TTS/captions.

**Prompt:**

```text
Use case: product-mockup
Asset type: blank portrait Wellness fact-card plate
Primary request: one blank ivory index card in a brushed-metal stand on a pale green table, with an empty institutional Wellness room softly out of focus behind it
Style/medium: photorealistic restrained corporate interior
Composition/framing: centered 9:16; large clean card area for runtime typography
Constraints: no generated writing, people, faces, logos, or watermark
```

### R05 — Melon Bar

**Triggers:** file 5; bin 40 and precision streak 5 as encores.  
**Canon basis:** the melon bar is shown as an MDR celebration.  
**Media:** `images/r05_melon_bar.png`, `videos/r05_melon_bar.mp4`, `reduced_motion/r05_melon_bar_still.png`.

**Prompt:**

```text
Use case: photorealistic-natural
Asset type: eight-second portrait food-reward scene
Primary request: an obsessively precise geometric arrangement of honeydew and cantaloupe cubes on white trays in an empty pale-green office conference room
Composition/framing: locked symmetrical 9:16 shot with title space
Lighting/mood: flat fluorescent light; deadpan corporate celebration
Motion: one tray glides forward several centimeters, then stops
Constraints: no people, logos, readable text, extra food, horror, or watermark
```

### R06 — Wellness Session

**Triggers:** files 9 and 18, bin 250, and 25 bins in each temper.  
**Canon basis:** the Wellness room and Outie-fact ritual are shown repeatedly.  
**Media:** `images/r06_wellness_session.png`, `videos/r06_wellness_session.mp4`, `reduced_motion/r06_wellness_session_still.png`.

**Prompt:**

```text
Use case: photorealistic-natural
Asset type: ten-second portrait Wellness-room background
Primary request: a sparse institutional Wellness room with one simple chair, pale green table, small plant, and abstract landscape art
Lighting/mood: soft flat fluorescence, calm and faintly uncanny
Motion: almost imperceptible slow push in; no object moves by itself
Composition/framing: broad clean center for runtime fact cards and captions
Constraints: no people, faces, actor likenesses, logos, generated text, or watermark
```

### R07 — Music Dance Experience

**Triggers:** files 10, 24, and 26; bins 100; precision streak 10; Frolic 50 adds a verified genre selection.  
**Canon basis:** S1E7, *Defiant Jazz*. The MDE uses a genre menu and one accessory; the scene shows the MDR office, metal music cart/record player, maraca selection, green carpet/partitions, and colored ceiling-light reveal. The episode’s recording is not licensed by this specification.  
**Reward media:** `images/r07_mde_office_scene.png`, `videos/r07_mde_office_scene.mp4`, `reduced_motion/r07_mde_office_scene_still.png`.  
**Implementation references:** `implementation_refs/r07_mde_game_ready.png`, `implementation_refs/r07_mde_game_combo.png`, `implementation_refs/r07_mde_game_release.png`.

**Gameplay rule:** preserve the supplied UI. Connect three or more simultaneously lit same-temper numbers and release on the beat. A success collapses into a compact phosphor bloom and fills one of three Dance Meter segments. A miss only resets multiplier; the reward cannot fail.

**Source-UI edit prompt:**

```text
Use case: precise-object-edit
Asset type: portrait MDE implementation reference
Input images: Image 1 is the authoritative existing game screenshot and edit target
Primary request: preserve its portrait crop, rounded terminal bezel, top file header, green phosphor grid, PROBE/SELECT/HANDBOOK controls, four bottom temper bins, typography, scanlines, spacing, and proportions. Add only a narrow in-world instruction strip, a three-segment Dance meter, and the requested ready/connected/release number state.
Constraints: do not redesign the terminal, add a keyboard or arcade controls, replace the number grid, or create a new UI; no people, logos, generated essential text, fireworks, or large destructive explosions
```

**Office-scene image prompt used:**

```text
Use case: photorealistic-natural
Asset type: portrait mobile MDE reward cinematic keyframe
Primary request: an empty MDR office at the celebratory peak of a Music Dance Experience, composed as an original shot without actors
Scene/backdrop: central four-workstation island with low muted-green fabric partitions; beige CRT terminals; green carpet; a small chrome audiovisual cart holding a record player and one maraca
Composition/framing: symmetrical 9:16 wide view with the desk island centered and ceiling visible
Lighting/mood: restrained rainbow bands across the fluorescent ceiling grid and carpet; joyous for one sanctioned minute but still controlled and uncanny
Constraints: no people, faces, silhouettes, likenesses, logos, readable text, exact shot recreation, masks, waffles, disco ball, nightclub stage, modern computers, or watermark
```

**Native-video replacement prompt:**

```text
Generate an eight-second portrait 9:16 cinematic shot of the exact empty MDR office described above. Keep the camera on a very slow forward dolly. The record turns gently on the chrome cart while the rainbow fluorescent bands travel once across the ceiling and carpet and converge around the four-desk island. The maraca remains on the cart. End with a subtle green glow appearing on the CRT screens. Preserve office geometry and restrained realism. No people, silhouettes, faces, likenesses, text, logos, nightclub equipment, flashing, rapid cuts, or camera shake.
```

### R08 — Crystal Portrait Gift

**Triggers:** file 12; bin 150 as a later engraving variant.  
**Canon basis:** laser-etched crystal portraits are shown in MDR. Mark’s Allentown crystal is described as an unusual gift rather than a standard tier prize; Dylan later chooses an MDR group crystal.  
**Media:** `images/r08_crystal_portrait_gift.png`, `videos/r08_crystal_portrait_gift.mp4`, `reduced_motion/r08_crystal_portrait_gift_still.png`.

**Prompt used:**

```text
Use case: product-mockup
Asset type: portrait mobile special-commendation image
Primary request: one transparent rectangular laser-etched crystal block on a small circular illuminated rotating base; the internal engraving is a generic anonymous featureless head-and-shoulders profile, not any actor
Scene/backdrop: sparse beige workstation beside an old green-phosphor terminal; no booklet or other reward prop
Composition/framing: centered 9:16 three-quarter product view with title space
Lighting/mood: pale fluorescence plus subtle cool light through the base
Constraints: no real person, likeness, recognizable face, caricature drawing, readable engraving, logo, other reward object, bell jar, or watermark
```

### R12 — Egg Bar

**Triggers:** file 16; bin 500 as an encore.  
**Canon basis:** the pre-waffle-party egg bar is shown in S1E8.  
**Media:** `images/r12_egg_bar.png`, `videos/r12_egg_bar.mp4`, `reduced_motion/r12_egg_bar_still.png`.

**Prompt:**

```text
Use case: photorealistic-natural
Asset type: eight-second portrait food-reward scene
Primary request: neat rows of deviled eggs on plain white trays at the end of an empty pale-green office conference table
Lighting/mood: flat fluorescent institutional celebration; appetizing enough to recognize, still oddly formal
Composition/framing: symmetrical 9:16 with negative space for runtime copy
Constraints: no people, logos, writing, extra foods, gore, or watermark
```

### R13 — Watermelon Remembrance

**Trigger:** file 17.  
**Canon basis:** S2E5 shows an employee remembrance centered on a carved watermelon head.  
**Media:** `images/r13_watermelon_remembrance.png`, `videos/r13_watermelon_remembrance.mp4`, `reduced_motion/r13_watermelon_remembrance_still.png`.

**Prompt:**

```text
Use case: product-mockup
Asset type: portrait bereavement-tableau reward image
Primary request: a ceremonial watermelon head on a plain white pedestal in an austere office; its cap and hair remain dark-green rind while the facial planes are carved deeply enough to expose unmistakable red watermelon flesh
Style/medium: photorealistic practical food sculpture; anonymous features, not a real person
Lighting/mood: solemn flat fluorescence with restrained corporate presentation
Constraints: no actor likeness, portrait reference, gore, extra body parts, logos, readable text, or watermark
```

### R19 — Waffle Party I

**Trigger:** file 34 and 200 total bins.  
**Canon basis:** Waffle Party is a shown performance incentive. The first tier uses the shown meal/room vocabulary without revealing the later ritual all at once.  
**Media:** `images/r19_waffle_party_i.png`, `videos/r19_waffle_party_i.mp4`, `reduced_motion/r19_waffle_party_i_still.png`.

**Prompt:**

```text
Use case: photorealistic-natural
Asset type: portrait Waffle Party tier-one scene
Primary request: one plate of waffles with syrup and utensils on a small formal table inside an old-fashioned founder bedroom/exhibit room
Composition/framing: symmetrical 9:16, plate foreground, restrained portrait painting and period lamp in background
Lighting/mood: warm ceremonial pool against cool institutional edges
Constraints: empty room, no dancers, masks, people, likenesses, text, logos, or watermark
```

### R22 — Waffle Party II

**Trigger:** file 50 and 750 total bins, after R19.  
**Canon basis:** the later ritual is shown with a Kier mask and dancers embodying the Four Tempers. This tier may show a mask and approaching shadow but no copied costume or choreography.  
**Media:** `images/r22_waffle_party_ii.png`, `videos/r22_waffle_party_ii.mp4`, `reduced_motion/r22_waffle_party_ii_still.png`.

**Prompt:**

```text
Use case: photorealistic-natural
Asset type: portrait Waffle Party tier-two scene
Primary request: return to the same waffle table and founder-bedroom setting; add one anonymous old-fashioned founder mask beside the plate and one soft human shadow crossing a distant wall
Lighting/mood: restrained warm ceremony turning uncanny
Constraints: no visible person, actor likeness, copied show mask, dancers, explicit sexuality, gore, logos, generated text, or watermark
```

## 6. Department-conflict paintings are easter eggs, not rewards

The show establishes two contradictory works:

- *The Grim Barbarity of Optics and Design* depicts O&D attacking MDR.
- *The Macrodata Refinement Calamity* reverses the departments’ culpability.

Their existence and the departments’ distrust are `CANON_SHOWN`. Whether either painting records a real historical conflict is `CANON_UNEXPLAINED`. Do not add a third “true” version or claim a massacre occurred.

Hidden delivery rule:

1. first painting becomes eligible after another department has been introduced;
2. each safe transition has a small hidden chance, with a guarantee by the fifth eligible roll;
3. the reversed painting becomes eligible only after two more completed screens and is guaranteed within twelve eligible rolls;
4. no locked slot, title preview, progress bar, or reward pop appears;
5. after discovery, both works enter an optional archive comparison view with the unresolved-status note.

For public release, prefer licensed episode imagery or a rights-cleared recreation. A generative interpretation must be clearly labeled as original branch propaganda inspired by the paired canon concept, not as a missing show painting.

## 7. Source anchors

- Apple TV press/episode catalog: https://www.apple.com/tv-pr/originals/severance/
- Apple Books, official *The Lexington Letter* companion: https://books.apple.com/us/book/severance/id1613220757
- S1E9 script evidence for dialogue-only paintball/coffee-cozy offers: https://tvwriting.co.uk/tv_scripts/Collections/Drama/Severance/Severance_1x09_-_The_We_We_Are.pdf
- MDE episode page: https://tv.apple.com/us/episode/defiant-jazz/umc.cmc.18x6l3djbw7ku60dp

Before Phase 3, attach frame/timecode evidence or an approved official source to every `CANON_SHOWN` record and complete IP/licensing review.
