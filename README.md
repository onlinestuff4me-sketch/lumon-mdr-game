# LUMON OS — Macrodata Refinement

A mobile-first browser recreation of the Macrodata Refinement terminal from
*Severance*. Probe a grid of numbers for the ones that feel wrong, read the
temper from how they move, and bin them before the shift clock runs out.

Built to run at 60 FPS on a phone, in a 9:16 portrait frame, with every
sound synthesised at runtime — there are no audio files in this repository.

## Play

```bash
npm install
npm run dev      # http://localhost:5173
```

Best on a phone with the sound on and haptics enabled. On a desktop the
terminal letterboxes to a centred 9:16 slab and works with a mouse.

## The loop

1. **PROBE** — hold a finger on the matrix. A reticle floats ~40px above
   your fingertip so your thumb never covers it. Within 80px of a hidden
   cluster the digits stir: they move, they make a noise, the phone buzzes.
   Intensity scales with distance. Once you have positively identified a
   cluster it stays stirred for a while, so you have time for step 2.
2. **SELECT** — double-tap anywhere, or hit the SELECT switch, then drag a
   dashed box around the agitated digits. Capture four or more and the
   cluster lifts off the grid as a data packet.
3. **REFINE** — drag the packet into one of the four temper bins. Correct
   assignments fill that bin by 20%; a mistake buzzes, glitches red and
   scatters the digits back to the grid. Fill all four bins to 100% to
   complete the file.

Four files, each tighter than the last: **Tumwater** (120s), **Allentown**
(110s), **Siena** (100s), **Cold Harbor** (90s). Later files damp the
cluster motion, so the tells get subtler.

## The four tempers

Each temper has one distinct displacement function, one synth voice and one
vibration pattern. Nothing about a cluster's colour tells you which it is —
by default agitated digits glow in neutral phosphor, and you read the
feeling from the motion, the sound and the buzz. (A colour assist is in the
handbook if you want it.)

| | Motion | Sound | Haptics |
|---|---|---|---|
| **01 WO** Woe | droops downward under its own weight | 60 Hz drone + minor third | slow deep pulse `[120]` |
| **02 FC** Frolic | bounces, spinning ±15° | 880 Hz arpeggiated chime | rapid double tap `[20,40,20]` |
| **03 DR** Dread | shivers on the X axis at 30 Hz | 150 Hz against 212 Hz — a tritone | continuous buzz `[30,15,30]` |
| **04 MA** Malice | pulses outward radially, flashing | distorted sawtooth with a kick | one heavy kick `[220]` |

## How it is put together

```
src/
  game/
    engine.ts      the only mutable state and the only rAF loop
    grid.ts        16x28 matrix, contiguous cluster seeding
    motion.ts      one displacement function per temper
    render.ts      canvas draw passes (grid layer, packet overlay)
    glyphAtlas.ts  pre-baked phosphor glyph strips
    layout.ts      stage geometry shared by the DOM and the engine
  audio/
    AudioEngine.ts four persistent synth voices + one-shot terminal SFX
    haptics.ts     navigator.vibrate patterns and cadence control
  components/      CRT shell, HUD, control deck, bins, handbook, overlays
```

Three decisions carry most of the performance:

- **One loop, one owner.** `GameEngine` holds all mutable state and runs the
  single `requestAnimationFrame` loop. React subscribes through
  `useSyncExternalStore` and re-renders the HUD at about 11 Hz; the 60 Hz
  information lives on the canvas, so no component re-renders per frame.
- **Baked bloom.** Drawing 448 glyphs a frame with a live `shadowBlur` is
  the most expensive thing this game could do on a phone. `glyphAtlas.ts`
  rasterises the phosphor halo once per palette, and every frame is
  `drawImage`.
- **No allocation while probing.** The four temper voices are built once
  when the AudioContext unlocks and live for the session; proximity only
  moves `AudioParam`s. The arpeggio and the malice kick are scheduled onto
  persistent oscillators rather than spawning a node per note.

`layout.ts` is the single source of truth for chrome geometry: the bins the
player sees and the drop targets the engine hit-tests come from the same
function, so they cannot drift apart.

## Two deliberate departures from the brief

Both were found by playing the thing, and both are documented here rather
than quietly applied.

- **A positively identified cluster latches.** Agitation is proportional to
  reticle distance, except that once a cluster has been probed to near-full
  strength it keeps moving at 55% after the finger lifts, until you refine
  it or identify another one. Without this you cannot switch to SELECT and
  draw a box before the cluster goes still — the three-phase loop simply
  does not close. Audio and haptics still answer to live proximity only, so
  the latch is a visual affordance and never a sound that follows you.
- **The reticle offset tapers over the control deck.** The 40px lift holds
  across the whole matrix, then decays to zero before the bins. At a
  constant 40px the bottom row of bins would require a touch below the last
  pixel of the screen — unreachable — and the top row would only respond to
  a press that looks plainly wrong.

## Notes on the browser

- `touch-action: none` across the input surface, with pointer capture, so a
  drag survives leaving the stage; a second finger is ignored rather than
  allowed to hijack the gesture in flight.
- The AudioContext is created and resumed inside a real user gesture, and
  suspends when the tab is hidden. Haptics stay quiet until the frame has
  been tapped, which is what browsers require anyway.
- The reticle's 40px offset tapers to zero across the control deck, so the
  bins sit exactly under your finger; at full strength the bottom row would
  need a touch below the edge of the screen.
- `prefers-reduced-motion` disables the CRT flicker and roll.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, `lucide-react`, HTML5 canvas,
Web Audio API, Vibration API. No runtime dependencies beyond those.
