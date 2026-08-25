# Revised Media Prompts

Last updated: 2026-08-25  
Scope: prompts used for the new MDE scene, supplied-UI-derived MDE references, and crystal portrait correction

Status: reference-only generation provenance. The active media already exists. Do not regenerate or replace it during implementation unless the user explicitly authorizes a separate media-generation task.

All output paths below are relative to `product-context/outputs/reward_media/`.

## MDE gameplay references — source-image edit prompt

The original user screenshots are the authoritative source. The final three references were generated with OpenAI’s built-in ImageGen using the four-bin gameplay screenshot as the edit target.

```text
Use case: precise-object-edit
Asset type: portrait mobile Music Dance Experience implementation reference
Input images: Image 1 is the authoritative existing game screenshot and edit target.
Primary request: preserve Image 1's portrait crop, rounded terminal bezel, top file header, green phosphor number grid, PROBE/SELECT/HANDBOOK controls, four bottom temper bins, typography, spacing, scanlines, glow, and all proportions. Add only a narrow in-world instruction strip, a small three-segment Dance meter, and one of these states: (A) ready with a few pulsing same-temper digits; (B) four amber Frolic numbers joined by a thin phosphor trail and a beat ring; (C) the same chain released into one compact geometric phosphor bloom with the middle meter segment filled.
Style/medium: shippable UI mockup made by editing the supplied screenshot, not a new terminal design and not concept art.
Constraints: do not redesign the CRT, add a keyboard, add arcade buttons, create a new computer, replace the grid, move the bins, or obscure the digits; no people, logos, actor likenesses, essential generated text, watermark, fireworks, fire, smoke, or destructive explosion.
```

Outputs:

- `implementation_refs/r07_mde_game_ready.png`
- `implementation_refs/r07_mde_game_combo.png`
- `implementation_refs/r07_mde_game_release.png`

## MDE office-scene image prompt used

```text
Use case: photorealistic-natural
Asset type: portrait mobile reward cinematic keyframe for a Music Dance Experience
Primary request: an empty Macrodata Refinement office at the celebratory peak of a Music Dance Experience, grounded only in visual facts shown in “Defiant Jazz” but composed as an original shot without actors.
Scene/backdrop: cavernous severed-floor office; one central island of four workstations with low muted-green fabric partitions; beige late-1970s CRT terminals and simple office chairs; broad green carpet; a small chrome metal audiovisual cart beside the island holding a record player and one maraca accessory.
Style/medium: photorealistic cinematic production still, austere retro-corporate realism.
Composition/framing: portrait 9:16, symmetrical wide view, desk island centered in the lower-middle frame, ceiling and negative space visible.
Lighting/mood: restrained rainbow bands across the normally white fluorescent ceiling grid and carpet; joyous for one sanctioned minute but still controlled and uncanny.
Constraints: no people, faces, silhouettes, actor likenesses, logos, trademarks, readable text, exact shot recreation, masks, waffles, disco ball, nightclub stage, physical dance-floor tiles, modern computers, or watermark.
```

Output: `images/r07_mde_office_scene.png`.

## MDE native-video prompt

The included MP4 is a motion-assembled preview from three generated lighting keyframes. The following prompt is retained only for an explicitly authorized future native-video replacement:

```text
Generate an eight-second portrait 9:16 cinematic shot of the exact empty MDR office described above. Keep the camera on a very slow forward dolly. The record turns gently on the chrome cart while restrained rainbow fluorescent bands travel once across the ceiling and carpet and converge around the four-desk island. The maraca remains on the cart. End with a subtle green glow appearing on the CRT screens. Preserve office geometry and restrained realism. No people, silhouettes, faces, actor likenesses, text, logos, nightclub equipment, flashing, rapid cuts, or camera shake.
```

Current preview: `videos/r07_mde_office_scene.mp4`.

## Crystal portrait gift prompt used

```text
Use case: product-mockup
Asset type: portrait mobile special MDR commendation
Primary request: one transparent rectangular laser-etched crystal block displayed on a small circular illuminated rotating base, corresponding to the unusual crystal portrait gifts visibly used by MDR employees; the engraving is a generic anonymous featureless head-and-shoulders profile, not a caricature and not any actor.
Scene/backdrop: sparse beige workstation beside an old green-phosphor terminal; no booklet, certificate, key, tote, or other invented reward prop.
Composition/framing: portrait 9:16, centered three-quarter view that clearly reads as a cuboid crystal block on a round light base, generous empty space above for runtime copy.
Lighting/mood: pale fluorescent overhead light plus subtle cool light rising through the crystal base; solemn and slightly absurd.
Constraints: no real person, actor likeness, recognizable employee face, caricature drawing, readable engraving, logos, trademarks, text, extra reward objects, bell jar, or watermark.
```

Outputs: `images/r08_crystal_portrait_gift.png`, `videos/r08_crystal_portrait_gift.mp4`, and its reduced-motion still.

## Full reward prompt catalog

The complete trigger, visual, canon basis, and copy/paste prompt for every active reward is in `../../specs/REWARD_VISUAL_PROMPT_CATALOG.md`. The Claude manifest in this folder is the implementation-facing subset.
