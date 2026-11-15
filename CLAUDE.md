# CLAUDE.md

Orientation for a session opening this repository for the first time.

## What this is

A browser game: Lumon Industries' Macrodata Refinement terminal, from the
television series *Severance*. You are shown a sheet of numbers, you find
the ones that *feel wrong*, and you bin them by the temper they evoke —
woe, frolic, dread, malice. Each temper has its own motion signature, so
the game is read with the eyes rather than with a rule.

It is a phone game first. Everything is designed for a thumb on a tall
screen, and the desktop layout is the same thing given more room.

## Who you are working with

**Mischa is a non-technical PM.** He directs the work, plays every build,
and sends findings — often a screenshot or a screen recording with a
sentence about what felt wrong. He does not read the diff.

What that means in practice:

- Describe changes in terms of what a player sees, not what the code does.
  "The dance ended before the meter filled" lands; "fixed an off-by-one in
  `MdeSession.finished`" does not.
- He will not catch a regression by reading your work, so the suite has to.
- When a change involves a real design trade-off, say so in a sentence or
  two and recommend one — don't present a menu.
- Ship end-to-end: branch, PR, merge on green, confirm the deploy. He asks
  for the outcome, not the steps.

## Third-party IP — ask before adding show material

This game is built on *Severance*, which is Apple's. **The licensing
posture is undecided.** Treat that as a live constraint, not a footnote:

- Do not add new material drawn from the show — character names, plot
  specifics, dialogue, locations, logos beyond what is already here —
  without asking first.
- Existing assets are what they are; the question is whether to add *more*
  surface area, and that decision is Mischa's.
- The Lumon mark in `public/lumon.svg` is drawn as vector from reference.
  `tools/lumon-mark.html` is the one place its geometry lives, and a data
  invariant fails if the served asset and that file disagree.
- `src/game/facts.ts` carries in-fiction "Outie facts". Several are not
  corroborated against any source — the reference wikis are unreachable
  from this sandbox. Do not present that set as verified.
- Lumon is deliberately **out of the public dev log** while the IP question
  is open.

## Stack

| | |
|---|---|
| Framework | React 19 + TypeScript, built by Vite |
| Styling | Tailwind v4 (CSS-first config, in `src/index.css`) |
| Rendering | Canvas 2D. One rAF loop, owned by `GameEngine` |
| Audio | Web Audio, synthesised at runtime — no audio files ship |
| Lint | oxlint |
| Tests | Node scripts driving Playwright. No test framework |

TypeScript runs with `erasableSyntaxOnly`. Note that `tsc -b` is stricter
than `tsc --noEmit` — build with `tsc -b` or CI will find what you didn't.

### Where things live

- `src/game/` — the model. `engine.ts` is the state machine, `grid.ts`
  builds boards, `motion.ts` holds the four temper motion profiles,
  `render.ts` paints the board, `glyphAtlas.ts` pre-rasterises the digits.
- `src/game/mde.ts` — the Music Dance Experience. **Pure**: no DOM, no
  audio, no React, so a whole session can be simulated in a test.
- `src/game/attract.ts` — the start screen's self-playing loop. Also pure;
  `attractDraw.ts` paints it.
- `src/components/` — React. Chrome, panels, overlays.
- `docs/` — the design record. `DESIGN_SYSTEM.md` is the big one.
- `tools/` — asset generators. `node tools/og.mjs` rebuilds the link card,
  the Lumon SVG and the home-screen icon.

## Running and testing

```bash
npm ci          # after a container rebuild, node_modules will be missing
npm run dev     # Vite dev server
npm test        # the whole gate — see below
npm run lint    # oxlint
npx tsc -b      # typecheck
```

`npm test` runs `test/run.mjs`, which does four things in order:

1. **Data invariants** (`test/data.ts`, bundled by esbuild). Pure checks on
   level data, the board generator, rewards, the MDE, the attract loop and
   the committed assets. About a second, and it catches the things that
   make a file quietly unwinnable.
2. **Production build** (`npm run build` → `dist`) — what actually ships.
3. **Test build** — the same pipeline with `VITE_MDR_TEST=1`, into
   `dist-test`. This is the one the suite drives.
4. **`vite preview` on `127.0.0.1:5273`**, then `test/e2e.mjs` and
   `test/audio.mjs` against it, with `MDR_URL` pointing at that port.

The whole run takes about ten minutes, most of it end-to-end.

**`window.__mdr` and `window.__mde`** are the engine handles the suite
drives. They exist only when `import.meta.env.DEV || VITE_MDR_TEST`, so a
`dist` build has no handle and the suite cannot drive it. If you rebuild
`dist-test` by hand, **pass `VITE_MDR_TEST=1`** or every e2e test will hang
waiting for a handle that is never set.

To iterate without the full ten minutes:

```bash
npx esbuild test/data.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/d.mjs --log-level=error && node /tmp/d.mjs
VITE_MDR_TEST=1 npx vite build --outDir dist-test
npx vite preview --outDir dist-test --port 5178 &
node test/e2e.mjs        # harness defaults to :5178 when MDR_URL is unset
```

### The rule the suite exists to enforce

From `docs/TESTING.md`, and it is not a general principle borrowed from
somewhere:

> **Never assert a state transition without completing the interaction that
> follows it.**

It is the specific lesson of a regression that made the game unplayable. A
tap lifted a packet correctly and returned early, before the cleanup that
nulls the gesture — so every later touch was discarded as a second finger.
The board was dead with the packet stuck in hand. The test written
alongside that feature asserted the tap lifted the packet and stopped
there. It passed.

So every gesture test ends by proving the engine is ready for the *next*
gesture, and the playthroughs run a whole file to 100%.

A corollary worth internalising: **a heuristic that passes on the real bug
is worse than no heuristic.** When a flat mint-green screen shipped, the
flatness check written to catch it scored the broken build at 82% and the
fixed one at 75%. Mean stage luma told them apart at 0.84 against 0.15.
If you add a guard, break the thing on purpose and watch the guard fail.

### Playwright in this sandbox

Chromium is pre-installed. Ad-hoc scripts need
`executablePath: "/opt/pw-browsers/chromium"`, and must live **inside the
project directory** or Node will not resolve `playwright`. Delete them
before committing — several have been caught at the last moment.

## Deploying

Two hosts, both from `main`:

- **GitHub Pages** — `.github/workflows/deploy.yml`. The `build` job runs
  the full suite; `deploy` is gated on the event so a PR tests but never
  publishes. About ten minutes.
- **Vercel** — auto-deploys `main`, and builds a preview for every PR.

`SITE_URL` differs per host and is stamped into `index.html` at build time
by the `siteUrl` plugin in `vite.config.ts`: Open Graph needs an **absolute**
image URL and a scraper has no page to resolve a relative one against. The
Pages workflow sets its own `SITE_URL`; Vercel falls back to its production
domain.

Note: this sandbox's egress proxy blocks `github.io` and `vercel.app`, so
you cannot verify a live deploy by fetching it. Check the workflow run's
conclusion, and do visual checks against a local `vite preview`.

## Conventions

- **Comments say why, not what.** The codebase explains decisions and the
  bugs that forced them. Match that register; don't narrate the code.
- **Every CSS animation needs a `prefers-reduced-motion` variant.** A layer
  whose resting appearance lives only in its keyframes paints at full
  strength on any device that declines to animate it — that is exactly how
  the mint-green screen happened. Declare the resting look in the element's
  own styles. See the `.motion-guard` note in `src/index.css`.
- **One source of truth for generated assets.** The Lumon mark, the link
  card and the touch icon all derive from `tools/`, with invariants that
  fail on drift.
- Branch, PR, merge on green, squash. Don't commit to `main` directly —
  it publishes.
- **Delete scratch scripts before committing.** Node scripts written for a
  one-off check have to live in the project root to resolve `playwright`,
  and several have come within a commit of shipping.
