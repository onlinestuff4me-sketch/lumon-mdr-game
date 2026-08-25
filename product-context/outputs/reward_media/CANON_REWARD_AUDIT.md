# Canon Reward and Media Audit

Audit date: 2026-08-25  
Spoiler scope: Seasons 1–2 and Apple’s official *The Lexington Letter* companion

## Decision rule

- `CANON_SHOWN`: object/event is visible on screen. Generated art may provide a clearly labeled show-grounded representation.
- `CANON_DIALOGUE_ONLY`: named in dialogue but no visual appearance is established. Keep as text lore only; do not generate hero art.
- `OFFICIAL_COMPANION`: established by Apple’s official companion material.
- `CANON_UNEXPLAINED`: existence is shown, but purpose/history remains unresolved.
- `ORIGINAL_APOCRYPHA`: game-created. It may exist as explicitly labeled game fiction, but not as a canon reward.

Generated images are not official stills and are never themselves canon.

## Active reward audit

| Active ID | Representation | Status | Evidence and constraint | Decision |
|---|---|---|---|---|
| R01 | Pencil eraser | `CANON_SHOWN` / official handbook | Listed at 10% in the official MDR incentive chart; erasers are part of the shown incentive culture | Keep |
| R02 | Finger trap | `CANON_SHOWN` | Seen on MDR desks and listed at 25% | Keep |
| R03 | Outie-fact card | `CANON_SHOWN` format | Wellness facts are spoken on screen; treat them as Lumon claims, not independently verified biography | Keep blank card; runtime text only |
| R05 | Melon Bar | `CANON_SHOWN` | Shown as an MDR celebration | Keep |
| R06 | Wellness room/session | `CANON_SHOWN` | Shown repeatedly | Keep; original voice only |
| R07 | Music Dance Experience | `CANON_SHOWN` | S1E7 shows genre/accessory choice, maraca, metal music cart/record player, MDR office, and colored ceiling lights | Rebuilt UI refs from supplied screenshots; replaced arcade art with office scene |
| R08 | Laser-etched crystal portrait gift | `CANON_SHOWN` | Mark’s Allentown crystal and Dylan’s group crystal are shown; Mark’s is unusual rather than a standard incentive tier | Rebuilt as one crystal on light base; removed invented booklet |
| R12 | Egg Bar | `CANON_SHOWN` | Shown before the Waffle Party in S1E8 | Keep |
| R13 | Watermelon remembrance head | `CANON_SHOWN` | Shown in S2E5 | Keep corrected rind cap/hair plus deeply exposed red flesh |
| R19 | Waffle Party I | `CANON_SHOWN` | Meal and founder-bedroom/ritual setting shown | Keep staged first tier |
| R22 | Waffle Party II | `CANON_SHOWN` | Masked Four Tempers ritual shown | Keep restrained second tier; no copied choreography/likenesses |

## Removed or reclassified material

| Retired ID/material | Status | Why it is not active |
|---|---|---|
| Caricature portraits and altered portrait rewards | `CANON_SHOWN`, product-excluded | Canon incentive, but the user explicitly removed this visual family; no actor/player portrait replacement |
| Handbook tote | `CANON_DIALOGUE_ONLY` | “Pre-release handbook totes” are mentioned in S1E4; appearance is not established |
| Paintball Experience | `CANON_DIALOGUE_ONLY` | Milchick offers paintball in S1E9; appearance/rules are not established |
| Coffee cozy, including glass-dome presentation | `CANON_DIALOGUE_ONLY` | Milchick offers coffee cozies in S1E9; the mug, knit sleeve, and bell jar were invented |
| Pineapple-bobbing photorealistic room | `CANON_SHOWN_IN_LUMON_PROMO_ONLY` | S2 reform media depicts the idea, but the retired live-room arrangement extrapolated beyond the shown presentation |
| Orientation-completion booklet | `ORIGINAL_APOCRYPHA` | Not a shown part of the crystal gift |
| Four Temper folio and four scripture folios | `ORIGINAL_APOCRYPHA` | Doctrine is canon; these illustrated reward objects were not shown |
| Incentive-shelf key | `ORIGINAL_APOCRYPHA` | Invented prop |
| Melon and egg tokens | `ORIGINAL_APOCRYPHA` | Invented props |
| MDE voucher | `ORIGINAL_APOCRYPHA` | Invented prop; bonus MDE now unlocks directly |
| Waffle eligibility card | `ORIGINAL_APOCRYPHA` | Invented prop; forecast shows compound progress directly |
| Perpetuity after-hours pass | `ORIGINAL_APOCRYPHA` | Invented reward and visual |
| Commendation stamp, certificates, badge, branch memo | `ORIGINAL_APOCRYPHA` | Invented reward objects |
| Temper Storm access terminals/videos | `ORIGINAL_APOCRYPHA` | Useful game-mechanic concept, not a shown reward; retired from active reward media |
| Fabricated MDE arcade terminals/explosions | `ORIGINAL_APOCRYPHA` | Did not use the supplied UI and did not depict the actual MDE scene |

## Department paintings

The paintings are easter eggs, never scheduled rewards.

- `CANON_SHOWN`: *The Grim Barbarity of Optics and Design* depicts O&D attacking MDR.
- `CANON_SHOWN`: *The Macrodata Refinement Calamity* reverses culpability and depicts MDR attacking O&D.
- `CANON_UNEXPLAINED`: the show does not establish that either massacre happened or designate a historically true version.

Implementation may randomize when the two images appear, but cannot invent a third true version, provenance, or factual department war. Before public release, use licensed episode imagery or a rights-cleared interpretation.

## Outie-fact audit

`OUTIE_FACT_BANK.md` now contains 25 show-derived Wellness claims from S1E2, S1E8, and S2E5, plus 24 game-original facts. Show-derived rows are `CANON_WELLNESS_CLAIM`; original rows are `ORIGINAL_APOCRYPHA`. The same approved sentence must be typed on the card, captioned, and spoken. No fact may use private device or player data.

## Source anchors

- [Apple TV press page for the series](https://www.apple.com/tv-pr/originals/severance/)
- [Apple Books official companion, *The Lexington Letter*](https://books.apple.com/us/book/severance/id1613220757)
- [S1E9 script containing the paintball/coffee-cozy offers](https://tvwriting.co.uk/tv_scripts/Collections/Drama/Severance/Severance_1x09_-_The_We_We_Are.pdf)
- [*Defiant Jazz* episode page](https://tv.apple.com/us/episode/defiant-jazz/umc.cmc.18x6l3djbw7lajdvor7ku60dp)
- [Watermelon-head production discussion and canon context](https://www.eater.com/24365548/severance-season-2-office-food-fruit-melon-trojans-horse)
- [S2E5 recovered Wellness statements recap](https://www.destructoid.com/severance-season-2-episode-5-trojans-horse-ending-explained/)

Frame/timecode and rights review remain required before shipping any direct franchise reference publicly.
