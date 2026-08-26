# Authoritative Game UI Reference Screenshots

These seven screenshots are the original game UI supplied by the product owner. They are the authoritative visual source for the existing portrait-oriented MDR experience.

Do not replace this UI with a newly invented interface. New reward, lore, and mini-game work should feel native to this design: preserve its composition, typography, spacing, CRT/phosphor treatment, restrained palette, controls, number-field behavior, and bin presentation. Generated MDE implementation images are supplementary behavior references; these original screenshots take precedence for the core game shell.

## Screenshot index

| File | Existing state shown | Primary QA use |
|---|---|---|
| `ui_01.png` | Home/continue screen | Overall portrait framing, title treatment, hierarchy, buttons, margins, and CRT atmosphere |
| `ui_02.png` | Bellingham file with a held number packet being placed into a bin | Drag/hold feedback, packet treatment, playfield-to-bin relationship, and active interaction state |
| `ui_03.png` | Orientation file with one strange-number group and one bin | Earliest tutorial composition, instructional restraint, and single-temper readability |
| `ui_04.png` | Two strange-number groups and two bins | Intermediate tutorial density, bin balance, and multi-temper readability |
| `ui_05.png` | Four-tempers/four-bins screen | Mature gameplay density, four-bin layout, HUD protection, and maximum baseline complexity |
| `ui_06.png` | Handbook Section IV overlay | In-world document overlay, type scale, readable modal layering, and return-to-game behavior |
| `ui_07.png` | Four Tempers and Perpetuity Wing archive material | Lore/archive presentation, artifact framing, copy density, and institutional tone |

## Visual acceptance rules

- Use these files for before/after comparison at their native dimensions and at representative modern phone viewports.
- Preserve the original portrait composition. New UI must not obscure the number field, bins, instructions, or active drag targets.
- Match the existing CRT darkness, green phosphor glow, scanline/noise restraint, typography, margins, and institutional austerity.
- Reward forecasting may show progress and the requirement for the next reward, but must not reveal the reward's identity before it is earned.
- Reward unlocks should temporarily become celebratory, focused moments, then return the player cleanly to this UI.
- Easter eggs should appear as surprising intrusions and must not look like permanent HUD furniture.
- For the Music Dance Experience mini-game, the number field itself becomes the dance surface; it must remain recognizably this game's UI rather than becoming a separate fabricated arcade screen.
- Capture and inspect screenshots for clipped text, covered bins, cramped safe areas, illegible glow, inconsistent type, stretched media, and mismatched aspect ratios.

## Supplementary MDE references

The following files describe the intended MDE interaction states while remaining subordinate to the original UI above:

- `../reward_media/implementation_refs/r07_mde_game_ready.png`
- `../reward_media/implementation_refs/r07_mde_game_combo.png`
- `../reward_media/implementation_refs/r07_mde_game_release.png`

The separate office-scene image/video is the post-mini-game celebration, not a replacement gameplay interface:

- `../reward_media/images/r07_mde_office_scene.png`
- `../reward_media/videos/r07_mde_office_scene.mp4`
- `../reward_media/reduced_motion/r07_mde_office_scene_still.png`
