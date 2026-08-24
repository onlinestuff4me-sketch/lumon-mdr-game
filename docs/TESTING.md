# The test plan

Two suites, one command: `npm test`.

```
npm test        data invariants → production build → end-to-end
npm run test:e2e   just the browser suite, against MDR_URL
```

CI runs the same command on every pull request. A PR builds and tests but
never deploys; only a push to `main` publishes.

---

## The rule this suite exists to enforce

> **Never assert a state transition without completing the interaction that
> follows it.**

This is not a general principle borrowed from somewhere. It is the specific
lesson of the regression that made the game unplayable:

`pointerDown` refuses a new pointer while a gesture is open —
`if (this.gesture) return`. The tap-to-select branch in `pointerUp` returned
early, *before* the cleanup that nulls the gesture. So a tap lifted the
packet perfectly, and then every subsequent touch was discarded as a second
finger. The board was dead with the packet stuck in hand.

The test written alongside that feature asserted the tap lifted the packet
and stopped there. It passed. The game was broken.

So every gesture test below ends by proving the engine is ready for the
*next* gesture, and the playthroughs run a whole file to 100%.

### The second rule, learned the same way

> **Drive the game with the coordinates a thumb would use, not with
> coordinates solved from the engine's own maths.**

Taps were hit-tested at the *reticle*, which floats 22px (SELECT) or 68px
(PROBE) above the contact point — so the tappable region of every group sat
below its own digits. A one-row group could not be tapped at all; a two-row
group only on its bottom half. Players reported having to tap two or three
times, and the suite saw nothing.

It saw nothing because every test aimed through `touchFor()`, a helper that
solves the taper for "what must the finger touch for the reticle to land
here". The tests were faithfully tapping 22px below the numbers. Humans tap
the numbers.

`touchFor` is still right for anything that is genuinely about the lens.
For anything about *where the refiner is pointing*, the section
**taps land where the finger is** uses raw footprint coordinates and nothing
else.

---

## What is covered

### `test/data.ts` — invariants, no browser, ~1s

Runs the real `createBoard`, `boardExtras` and `assignMorphs` — imported, not
reimplemented, because a test that duplicates the code it checks drifts from
it and then agrees with itself. An earlier version of this file did exactly
that and reported three phantom failures.

Across all 46 screens:

- every active temper seeds at least `quota` clusters, and no temper is
  seeded that has no bin
- cluster sizes stay in 4–9, no cell belongs to two clusters, and every pair
  of clusters holds the file's minimum Chebyshev spacing
- decoy and fifth-temper counts match the level definition
- **the softlock guard**: after a morph fires, every bin is still fillable.
  A morph rewrites a cluster's temper; with `spare: 0` everywhere, taking a
  quota cluster leaves the source bin permanently short — and on an untimed
  teaching file that is a softlock with no clock to expire and no RETRY to
  press. This check is why morphing clusters are seeded as extras.
- `binHint` is never set on a multi-bin file, where it would point at the
  answer
- the last screen never auto-advances, which would stall the queue
- orientation is 29 screens in four stages with one archive row: three per temper, then eight of two-groups-one-temper opening on the temper just seen, then four paired screens each sharing a temper with the one before, then five of all four
- every Act III mechanic first appears on its own teaching file, and the
  fifth temper appears only on Cold Harbor and is never taught
- groups move outwards across orientation: measured mean offset from centre
  must increase from stage to stage

### `test/e2e.mjs` — the real game, real pointer events

Driven through `page.mouse` at hand speed along real paths. The engine handle
is used to *read* state and to load a file as setup — never to make progress.
A test that calls an engine method to advance cannot catch an input bug.

It runs against a **production build**, not the dev server: the artifact
ships straight from `dist` to two hosts, and a regression that only appears
once bundled is exactly the kind that reaches a player. `dist-test` is the
same production pipeline with the engine handle compiled in; `dist`, the one
that ships, has no handle.

| Group | What it proves |
|---|---|
| gesture lifecycle | A tap-lift releases the gesture and the packet is still draggable to the bin. Five terminating paths — tap on empty board, zero-length drag, empty box, drag off the top edge, cancelled pointer — each release the gesture **and** leave input live, proven by completing a real lift afterwards. |
| reachability | The bottom board row is reachable by probe and by marquee, and every bin is reachable while carrying. A previous release shipped two unreachable rows. |
| playthroughs | Orientation 17/21 reaches 100% by tapping alone; DRANESVILLE reaches 100% by probe → box → carry. Both paths, end to end. |
| mechanics | The orientation group moves untouched while driving no audio; a decoy cannot be boxed and answers honestly; the fifth is seeded and disguised; a redacted file mutes and the next one restores. |
| tap parity | On BELLINGHAM — `startMode: "probe"` — aiming the lens and tapping lifts the group; and while the group is *sunk*, a tap refuses it, because a tap must never lift what a box would not. Tapping is available on every file now; the agitation gate, not the absence of the gesture, is what stops a blind tap finding an unprobed group. |
| morph supply | After the morph fires, every bin on NANNING is still fillable. |
| ceremony | A self-advancing screen shows no 100% banner, and advances. |
| settings | Changing any setting during a redacted file does not persist that file's forced mute. |
| reticle and hint | Offsets are −68 / −22 / −22 for probe / select / carry; the bin hint and the highlighted target bin are showing the moment the packet lifts; touching the box brings it to the carry reticle and then it moves only with the finger; touching anywhere else releases the digits back to the grid *still found*, and the group can be taken again and binned. |
| taps land where the finger is | A tap lifts with a finger already resting elsewhere on the screen (real CDP multi-touch — a resting thumb makes every later touch `isPrimary: false`, and refusing those killed every tap for as long as it stayed put), while a drag already in flight is never stolen by a stray second finger. A group that drifts out from under a held thumb is still lifted, at 90ms and at 1200ms, on four tempers. No pair of taps can flip a self-agitating screen into PROBE, a mode it has no use for. Eighty raw taps — nine points across each group's footprint plus the centre of its top row, on eight orientation screens — every one lifts. A still press lifts at 60ms and at 1200ms alike. A press that drifts 16px and comes back still lifts. Two taps on a group never toggle the mode. A touch inside the 900ms auto-advance window is not discarded. A gesture left open for nine seconds is taken over by the next touch instead of blocking it. |
| ambient temper | With one group the bed plays that group's temper; with four it plays the most central; taking one into the hand moves the bed to it; the fifth temper gives off nothing. |
| audio bed exists (`test/audio.mjs`) | Measured, not trusted: the hum plays; each of the four temper beds lights up its own signature frequency band (woe 20-60Hz, frolic 250-350Hz, dread 90-120Hz, malice 200-500Hz) by multiples over the hum-only baseline — band-selective because the hum's beating fundamentals swing broadband RMS too much to hear a quiet voice under it; the check exists to catch silence, not taste; a mute takes it all away. |
| bin catch | A packet dropped 40px above a bin's top edge still lands in it; one dropped far above stays in hand. The catch zone exists because the packet's centre is what is tested and the box is a hundred pixels wide — demanding the centre fully inside the bin meant drops released at its top edge fell back into the hand. |
| saves | A fresh terminal offers BEGIN ORIENTATION and no CONTINUE. Completing a file and fully reloading the page offers CONTINUE, a new-save escape hatch, and the attempt listed with its timestamp. CONTINUE resumes one past the furthest completed file; BEGIN A NEW SAVE starts from nothing without destroying the old attempt; loading the older attempt resumes its own bookmark, not the new one's. |
| console | No page errors in any of it. |

---

## What is not covered, and why

- **How the audio *sounds*.** `test/audio.mjs` now measures what is
  actually rendered — an analyser tapped in behind the limiter proves the
  hum plays, every temper's bed adds energy over it, and a mute silences
  everything. That exists because a temper's ambient voice twice shipped
  inaudible while every other check was green. But RMS is existence, not
  taste: whether the mix is *right* still needs ears on a device. Haptics
  remain asserted only through engine state.
- **Real touch.** The suite drives mouse events. Multi-touch, palm rejection
  and iOS gesture interception are not exercised.
- **Visual regression.** No screenshot diffing. Renderer changes — the
  anomaly swell, the after-image, the lens shrink — are checked by eye.
- **The other 43 screens.** Playthroughs cover two. The data suite covers all
  46 structurally, but only two are played.
- **Performance.** The frame budget is measured by hand, not asserted.

---

## Adding to it

Put structural facts in `test/data.ts` — it is fast and runs first.

Put anything a finger does in `test/e2e.mjs`, and hold to the rule at the top
of this document: after asserting the thing you changed, do the next thing a
player would do, and assert that too.
