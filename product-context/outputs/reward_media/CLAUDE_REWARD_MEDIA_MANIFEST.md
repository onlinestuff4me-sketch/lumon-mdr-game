# Claude Reward Media Implementation Manifest

Status: implementation handoff  
Last updated: 2026-08-25

## 1. Folder contract

```text
reward_media/
├── images/                # 11 active reward poster/hero plates
├── videos/                # 9 H.264 portrait celebration clips
├── reduced_motion/        # 9 720x1280 video fallbacks
├── implementation_refs/   # 3 MDE UI references derived from supplied screenshots
├── CLAUDE_REWARD_MEDIA_MANIFEST.md
├── CANON_REWARD_AUDIT.md
├── OUTIE_FACT_BANK.md
└── REVISED_MEDIA_PROMPTS.md
```

All media paths in this manifest are relative to `product-context/outputs/reward_media/`. Only the files named here are active. No retired media is included in this package, and files outside the active list are not implementation alternatives.

## 2. Locked, earned, and claimed behavior

Before unlock, each visible lane exposes only `NEXT INCENTIVE`, current/target values, remaining work, and `INCENTIVE DETAILS: CLASSIFIED`. Never expose the name, image, silhouette, category, color theme, alt text, file name, or future threshold.

At a safe boundary:

1. persist `earned_pending` before playback;
2. queue collisions rather than merging or dropping rewards;
3. present a sealed card for 0.5–1.5 seconds;
4. reveal the reward name and media together for the first time;
5. play a short audio/haptic flourish and the reward clip when available;
6. fall back to the poster, then reduced-motion still, without blocking claim;
7. persist `claimed`, archive it, and immediately show the next classified threshold.

Suggested priority: file/campaign reward → experiential reward → bin reward → precision reward → return reward. Present at most one celebration at a time.

## 3. Persistent state

```text
filesCompleted
binsTotal
binsByTemper: { woe, frolic, dread, malice }
wrongBinsTotal
resumeCount
perfectScreensTotal
perfectScreenStreak
rewardStatusById: locked | earned_pending | presenting | claimed
rewardQueue
seenFactIds
wellnessSessionsCompleted
mdeSessionsCompleted
mdeBestScoreByGenre
seenEasterEggIds
```

All counters except streaks are monotonic. Migrate newly satisfied thresholds into `earned_pending` after a version update.

## 4. Active reward records

| ID | Trigger(s) | Reveal/display | Active media | Canon status |
|---|---|---|---|---|
| R01 | file 1 | Open desk drawer; eraser enters shelf after 4–6 seconds | `images/r01_eraser.png` | `CANON_SHOWN` / official handbook incentive |
| R02 | file 2; perfect streak 3 variant | Product turntable; later award reuses family with runtime variant label | `images/r02_finger_trap.png`; `videos/r02_finger_trap.mp4`; `reduced_motion/r02_finger_trap_still.png` | `CANON_SHOWN` |
| R03 | file 3; bins 10,25,60,300; first perfect; resumes 2,4,8; file 13 | Blank card settles; runtime sentence typesets; identical sentence is spoken/captioned | `images/r03_outie_fact_card.png`; `OUTIE_FACT_BANK.md` | `CANON_WELLNESS_CLAIM` or labeled `ORIGINAL_APOCRYPHA` per fact |
| R05 | file 5; bin 40; perfect streak 5 | Deadpan food scene; new arrangement on encore | `images/r05_melon_bar.png`; `videos/r05_melon_bar.mp4`; `reduced_motion/r05_melon_bar_still.png` | `CANON_SHOWN` |
| R06 | file 9; file 18; bin 250; all tempers 25 | Enter Wellness surface; play 3/4/5 facts per event; no actor imitation | `images/r06_wellness_session.png`; `videos/r06_wellness_session.mp4`; `reduced_motion/r06_wellness_session_still.png` | `CANON_SHOWN` format; governed fact mix |
| R07 | files 10, 24, and 26; bin 100; perfect streak 10; Frolic 50 expands genre selection | Reward pop → genre/accessory choice → instruction → 45-second no-fail mini-game → office-scene film → score card; later file events use documented escalation variants | `images/r07_mde_office_scene.png`; `videos/r07_mde_office_scene.mp4`; `reduced_motion/r07_mde_office_scene_still.png`; `implementation_refs/r07_mde_game_ready.png`; `implementation_refs/r07_mde_game_combo.png`; `implementation_refs/r07_mde_game_release.png` | `CANON_SHOWN` experience; original gameplay |
| R08 | file 12; bin 150 variant | Rotate illuminated crystal slowly; runtime engraving/title only | `images/r08_crystal_portrait_gift.png`; `videos/r08_crystal_portrait_gift.mp4`; `reduced_motion/r08_crystal_portrait_gift_still.png` | `CANON_SHOWN` unusual gift, not standard tier prize |
| R12 | file 16; bin 500 encore | Deadpan egg-bar scene; no token or recipe-card prop | `images/r12_egg_bar.png`; `videos/r12_egg_bar.mp4`; `reduced_motion/r12_egg_bar_still.png` | `CANON_SHOWN` |
| R13 | file 17 | Solemn remembrance pop; image must retain rind cap/hair and deeply carved red flesh | `images/r13_watermelon_remembrance.png`; `videos/r13_watermelon_remembrance.mp4`; `reduced_motion/r13_watermelon_remembrance_still.png` | `CANON_SHOWN` memorial imagery |
| R19 | files 34 + bins 200 | Tier I Waffle Party; both counters required; meal/room only | `images/r19_waffle_party_i.png`; `videos/r19_waffle_party_i.mp4`; `reduced_motion/r19_waffle_party_i_still.png` | `CANON_SHOWN` reward, staged reveal |
| R22 | files 50 + bins 750 + R19 claimed | Tier II Waffle Party; mask/shadow escalation; do not copy choreography | `images/r22_waffle_party_ii.png`; `videos/r22_waffle_party_ii.mp4`; `reduced_motion/r22_waffle_party_ii_still.png` | `CANON_SHOWN` ritual elements |

For every locked lane, compute copy at runtime: `CURRENT / TARGET`, `REMAINING`, and the exact action. Compound Waffle milestones show both counters and `Both conditions required`.

## 5. MDE build contract

The three files under `implementation_refs/` are derived from the user’s supplied game screenshots and are supplementary references for the new MDE interaction states. The seven original files under `product-context/outputs/ui_reference_screenshots/` remain authoritative for the existing game shell. Keep the existing portrait CRT screen, header, mode controls, number grid, and four bottom bins. Do not invent a replacement interface.

Sequence:

1. reveal `MUSIC DANCE EXPERIENCE` only after it is earned;
2. choose a verified genre and one accessory;
3. show runtime instruction: `CONNECT 3+ GLOWING NUMBERS OF ONE TEMPER. RELEASE ON THE BEAT. FILL THE DANCE METER.`;
4. light same-temper digits from a shared beat map;
5. allow tap-drag chains of three or more and a generous release window;
6. valid release produces a compact phosphor bloom and fills one of three meter segments;
7. a miss resets multiplier only—no lives, failure, energy, or reward loss;
8. after 45 seconds, play `videos/r07_mde_office_scene.mp4`;
9. show score and archive replay actions; replay never re-awards progression.

Use original or licensed music. The show’s recording and actor performances are not licensed by this handoff.

## 6. Easter-egg separation

Wrong-bin thresholds, department paintings, goats, second cursors, Testing Floor flashes, Board presence, and contradictory notices are hidden story events. They may become eligible at behavior thresholds, but exact display timing is randomized inside a bounded window and never appears in the Incentive Forecast.

For the paired department paintings, preserve the canon distinction: O&D attacks MDR in *The Grim Barbarity of Optics and Design*; MDR attacks O&D in *The Macrodata Refinement Calamity*. The existence of both is canon; which, if either, is historical truth is unresolved.

## 7. Canon exclusions Claude must enforce

- Do not restore paintball, coffee cozy, handbook tote, caricature, shelf key, tokens, voucher, folios, certificates, badges, pass, stamp, branch memo, or Temper Storm access as active visual rewards.
- Paintball, coffee cozies, and handbook totes may be mentioned only as `CANON_DIALOGUE_ONLY` with no invented visual appearance.
- Caricatures are canon but intentionally excluded.
- Do not describe generated plates as official show stills.

## 8. Playback and accessibility

- preload only the next classified reward’s binary media without exposing its metadata in UI;
- honor reduced-motion and reduced-flicker settings;
- never rely on color alone for temper/MDE input;
- caption all meaningful audio and provide optional haptics;
- persist state before playback and restore to replay/skip after interruption;
- render required text at runtime, not inside generated imagery.

## 9. Validation checklist

- [ ] Every manifest path exists.
- [ ] Every active video is H.264, 720x1280, 30 fps, and playable without audio.
- [ ] Every video has a reduced-motion still.
- [ ] No active reward is `CANON_DIALOGUE_ONLY` or an unlabeled invention.
- [ ] MDE uses the supplied-UI-derived references and separate office-scene media.
- [ ] Reward identity is hidden until earned and next progress appears after claim.
- [ ] Wrong-bin and painting events remain hidden surprises.
- [ ] Fact card, caption, and speech use the same approved sentence.
