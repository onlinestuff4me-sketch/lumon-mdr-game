/**
 * The dance, danced for you, before you are asked to dance it.
 *
 * A refiner arriving at the Music Dance Experience has been dragging
 * single clusters into bins for eight files. Nothing in that teaches
 * "hold three of them at once, then let go on a beat" — and a sentence
 * saying so, read once on a title card, is not teaching either. Someone
 * played the whole thing through without ever chaining three and came
 * away thinking the floor was broken.
 *
 * So the instruction screen shows a hand doing it. The floor here is a
 * real `MdeSession`, drawn by the real painter, wearing the real HUD: a
 * ghost fingertip walks onto three lit groups of one temper, the pips
 * count 1, 2, 3, the line turns into RELEASE ON THE BEAT, the chain
 * collapses, and one segment of the Dance Meter fills. Then it does it
 * again, and the meter climbs, because the thing being taught is the loop
 * and not the move.
 *
 * Nothing about it is a video — it is the game, playing itself, at the
 * size and in the colors the refiner is about to be handed — but it is
 * *dressed* as one, in an inset frame with a caption and a playback bar
 * running under it. A live board that a refiner might mistake for their
 * own turn is a board they will try to touch; a board in a video frame is
 * something to watch until it is their turn.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { GlyphAtlas } from "../game/glyphAtlas";
import { drawFloor } from "../game/mdeDraw";
import {
  BEAT_WINDOW,
  MDE_ROWS,
  METER_SEGMENTS,
  MIN_CHAIN,
  MdeSession,
  type Genre,
  type MdeCluster,
} from "../game/mde";
import { ChainPips, DanceMeter } from "./MdeHud";

/**
 * How fast the demonstration's clock runs against the wall clock.
 *
 * Slow motion, and the one honest way to get it. Every timing on the floor
 * — the phrase, the beat, the release window — is measured in the
 * session's own seconds, so a demonstration that merely dawdled between
 * touches would run out of phrase and be seen to fail. Slowing the session
 * itself scales all of it together: the same dance, at a pace a refiner
 * can follow a finger through.
 */
const RATE = 0.42;

// Everything below is in *session* seconds, so it is measured against the
// phrase it has to fit inside. Divide by RATE for wall time: a full
// demonstration runs about eight seconds on screen.

/** How long the ghost takes to travel from one group to the next. */
const REACH_S = 0.55;
/** A pause on each group after landing, so the count can be read. */
const DWELL_S = 0.18;
/** The hold on the third group before letting go — the beat is coming. */
const ARM_S = 0.45;
/**
 * How long the merge is left on screen before the next demonstration.
 *
 * Sized against the half-second the floor takes to re-light after a merge:
 * this plus READY_S lands the next run just inside a *fresh* phrase, which
 * is the only place a run of this length fits. Longer and the run misses
 * its phrase and has to sit out the whole of the next one — eight seconds
 * of a demonstration demonstrating nothing.
 */
const BASK_S = 0.45;
/** The breath before a new run at it. */
const READY_S = 0.25;
/**
 * A phrase this run has to fit inside.
 *
 * The floor re-lights every eight beats and takes any chain in hand apart
 * when it does — correct in play, and a lie in a demonstration, where it
 * would show the move failing. So a run only starts on a phrase with room
 * for the whole of it. Eight beats is 3.24s at the fastest genre on the
 * menu, which is what the timings above are budgeted against.
 */
const RUN_S = (REACH_S + DWELL_S) * MIN_CHAIN + ARM_S + 0.2;

type Beat = "ready" | "reach" | "dwell" | "arm" | "bask";

/**
 * How far through one demonstration each stage is, for the playback bar.
 *
 * Written down rather than measured off a clock: the wait for a usable
 * phrase has no fixed length, and a scrubber that stalls at 4% and then
 * leaps is worse than no scrubber. These reach 1 at the end of every run,
 * every time.
 */
const SPAN: Record<Beat, [number, number]> = {
  ready: [0, 0.06],
  reach: [0.06, 0.66],
  dwell: [0.06, 0.66],
  arm: [0.66, 0.78],
  bask: [0.78, 1],
};

export function MdeDemo({ genre, seed }: { genre: Genre; seed: number }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const atlasRef = useRef(new GlyphAtlas());
  const rafRef = useRef(0);
  // The still frame the reduced-motion path draws is the chain complete,
  // so the pips under it start complete too. Set here rather than from
  // inside the effect: a state write during setup is a second render for
  // a value that was knowable before the first.
  const [hud, setHud] = useState(() => ({
    meter: 0,
    chain: prefersReduce() ? MIN_CHAIN : 0,
    progress: prefersReduce() ? 1 : 0,
  }));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(120, rect.width);
    const h = Math.max(160, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const atlas = atlasRef.current;
    atlas.build(Math.max(9, (h / MDE_ROWS) * 0.62), dpr);

    /**
     * A floor with three lit clusters close enough together to be walked
     * as one gesture — carrying the Dance Meter across from the last one.
     *
     * Rebuilt every cycle rather than played straight through, because the
     * floor re-lights between phrases anyway: a fresh seed is visually the
     * same event, and it is the only way to keep choosing a compact chain
     * rather than accepting whatever the next phrase happens to offer. The
     * meter is carried because the loop is the lesson.
     */
    const build = (meter = 0) => {
      let best: MdeSession | null = null;
      let bestWalk = Infinity;
      const tight = tightEnough(w, h);
      for (let n = 0; n < SEED_TRIES; n++) {
        const s = new MdeSession(genre, (seed + n * 0x9e3779b1) >>> 0, w, h);
        const found = trioOn(s);
        if (!found) continue;
        // The caption is painted over the top of the picture, so a chain
        // that lives up there is a chain demonstrated behind a title. Cost
        // it heavily rather than forbidding it: some floor has to win.
        const clear = found.trio.every((c) => c.cy > h * CAPTION_BAND);
        const score = found.walk + (clear ? 0 : 1e4);
        if (score < bestWalk) {
          bestWalk = score;
          best = s;
        }
        if (clear && found.walk <= tight) break;
      }
      const s = best ?? new MdeSession(genre, seed, w, h);
      // A full meter would end the session on the frame it began. The
      // demonstration starts the ladder again instead.
      s.meter = meter >= METER_SEGMENTS ? 0 : meter;
      return s;
    };
    let session = build();

    // Reduced motion gets the lesson as a still: the chain built, the
    // finger on the last group, the line reading RELEASE ON THE BEAT. It
    // is the frame the animation exists to arrive at, so it is the frame
    // worth holding.
    if (prefersReduce()) {
      const found = trioOn(session);
      if (found) for (const c of found.trio) session.touch(c.cx, c.cy);
      session.step(1 / 60);
      drawFloor(ctx, session, atlas, w, h);
      const t = found?.trio[MIN_CHAIN - 1];
      if (t) ghost(ctx, t.cx, t.cy, 0);
      return;
    }

    let beat: Beat = "ready";
    /** Session seconds spent in the current stage of the script. */
    let held = 0;
    /** Which of the three groups the ghost is walking to. */
    let step = 0;
    let trio: MdeCluster[] = [];
    let from = { x: w / 2, y: h * 0.86 };
    let ptr = { ...from };
    /** 1 on the frame the ghost lands, falling to 0 — the tap ripple. */
    let land = 0;
    let last = performance.now();

    const frame = (now: number) => {
      // Slow motion: one clock for the session and the script alike, so
      // the phrase the run has to fit inside stretches with it.
      const dt = Math.min(0.05, (now - last) / 1000) * RATE;
      last = now;

      session.step(dt);
      held += dt;
      land = Math.max(0, land - dt * 2.2);

      switch (beat) {
        case "ready": {
          // Wait for a phrase with room in it, and for a chain to be on
          // the floor at all.
          if (held < READY_S) break;
          const found = trioOn(session);
          if (!found || session.phraseLeft < RUN_S) break;
          trio = found.trio;
          step = 0;
          from = { ...ptr };
          held = 0;
          beat = "reach";
          break;
        }
        case "reach": {
          const target = trio[step];
          const k = Math.min(1, held / REACH_S);
          // Ease in and out: a hand leaves slowly and arrives slowly, and
          // a linear ghost reads as a cursor being dragged by a script,
          // which it is.
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          ptr = {
            x: from.x + (target.cx - from.x) * e,
            y: from.y + (target.cy - from.y) * e,
          };
          if (k < 1) break;
          session.touch(target.cx, target.cy);
          land = 1;
          step += 1;
          from = { ...ptr };
          held = 0;
          beat = "dwell";
          break;
        }
        case "dwell": {
          // Sit on the group just taken. The count on screen has just
          // changed, and a demonstration that moves on before it can be
          // read has not demonstrated anything.
          if (held < DWELL_S) break;
          held = 0;
          beat = step >= MIN_CHAIN ? "arm" : "reach";
          break;
        }
        case "arm": {
          if (held < ARM_S) break;
          // Let go *on* a beat rather than near one. The window is
          // generous in play; a demonstration that misses it would be
          // teaching the miss.
          const phase = session.snapshot().beatPhase;
          const beatS = 60 / genre.bpm;
          if (Math.min(phase, 1 - phase) * beatS > BEAT_WINDOW) {
            session.step((1 - phase) * beatS);
          }
          session.release();
          land = 1;
          held = 0;
          beat = "bask";
          break;
        }
        case "bask": {
          // Drift the ghost off the floor while the bloom plays, so the
          // next run starts from outside rather than teleporting.
          ptr = { x: ptr.x, y: ptr.y + dt * 34 };
          if (held < BASK_S) break;
          // A new floor, chosen for a compact chain, with the meter it
          // just filled carried over. The floor re-lights between phrases
          // in play too, so this reads as the same event.
          session = build(session.meter);
          held = 0;
          step = 0;
          trio = [];
          beat = "ready";
          break;
        }
      }

      drawFloor(ctx, session, atlas, w, h);
      ghost(ctx, ptr.x, ptr.y, land);
      const s = session.snapshot();
      setHud({
        meter: s.meter,
        chain: s.chain.length,
        progress: progressOf(beat, step, held),
      });
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [genre, seed]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4">
      {/* The frame. A live board sitting flush in the screen is a board a
          refiner will reach for; an inset one with a caption over it and a
          scrubber under it is something to watch. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3px] border border-phos-700 bg-phos-950">
        <div ref={wrapRef} className="relative min-h-0 flex-1">
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            aria-label="A demonstration of the dance"
            role="img"
          />
          {/* The one sentence, big, over the top of the floor it is about.
              Scrimmed rather than boxed, so the board keeps running behind
              it and the caption reads as burned into the picture. */}
          <div
            className="absolute inset-x-0 top-0 px-4 pb-7 pt-4"
            style={{
              background:
                "linear-gradient(180deg, rgba(1,6,4,0.95) 0%, rgba(1,6,4,0.82) 55%, rgba(1,6,4,0) 100%)",
            }}
          >
            <p className="crt-text-glow text-center text-[13px] font-bold leading-[1.45] tracking-[0.12em] text-phos-200">
              CONNECT THREE GROUPS
              <br />
              OF THE SAME COLOR
            </p>
          </div>
        </div>
        {/* The real HUD, inside the frame, because it is part of what is
            being demonstrated. */}
        <ChainPips chain={hud.chain} className="px-3 pb-1.5 pt-1" />
        <DanceMeter meter={hud.meter} className="px-3 pb-2.5" />
      </div>

      {/* The scrubber. Nothing else on this screen says "this is footage,
          it will come round again, you have not missed it". */}
      <div className="mt-2 flex items-center gap-2">
        <Play size={9} strokeWidth={2.6} className="shrink-0 text-phos-500" fill="currentColor" />
        <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-phos-800">
          <div
            className="h-full bg-phos-500"
            style={{ width: `${Math.round(hud.progress * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[8px] tracking-[0.24em] text-phos-600">
          DEMONSTRATION
        </span>
      </div>
    </div>
  );
}

const prefersReduce = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Where the scrubber sits, given what the script is doing. */
function progressOf(beat: Beat, step: number, held: number): number {
  const [a, b] = SPAN[beat];
  if (beat === "reach" || beat === "dwell") {
    // Three groups share this stretch, and each gets a third of it. `step`
    // counts the groups already taken, so it is the travel that moves the
    // bar and the dwell that holds it at the mark.
    const done = beat === "reach" ? step + Math.min(1, held / REACH_S) : step;
    return a + ((b - a) * Math.min(MIN_CHAIN, done)) / MIN_CHAIN;
  }
  const span = beat === "ready" ? READY_S : beat === "arm" ? ARM_S : BASK_S;
  return a + (b - a) * Math.min(1, held / span);
}

const gap = (a: MdeCluster, b: MdeCluster) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

/**
 * Three lit clusters of one temper, as close together as the floor allows,
 * in the order a hand would walk them.
 *
 * It used to take the first three of whichever temper had three, which is
 * how the demonstration came to sweep the whole board corner to corner —
 * a legal chain, and a bad lesson: a refiner watching it learns that this
 * is a big gesture across a big screen rather than a small deliberate one
 * between neighbours. Start from the closest pair, add the cluster nearest
 * what is already picked, and hang it on whichever end it is nearer.
 */
function trioOn(session: MdeSession): { trio: MdeCluster[]; walk: number } | null {
  const byTemper = new Map<string, MdeCluster[]>();
  for (const c of session.clusters) {
    if (!c.lit || c.spent) continue;
    const list = byTemper.get(c.temper) ?? [];
    list.push(c);
    byTemper.set(c.temper, list);
  }

  let best: MdeCluster[] | null = null;
  let bestWalk = Infinity;
  for (const list of byTemper.values()) {
    if (list.length < MIN_CHAIN) continue;

    let a = list[0];
    let b = list[1];
    let closest = Infinity;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = gap(list[i], list[j]);
        if (d < closest) {
          closest = d;
          a = list[i];
          b = list[j];
        }
      }
    }

    const picked = [a, b];
    while (picked.length < MIN_CHAIN) {
      let next: MdeCluster | null = null;
      let nearest = Infinity;
      for (const c of list) {
        if (picked.includes(c)) continue;
        const d = Math.min(...picked.map((p) => gap(p, c)));
        if (d < nearest) {
          nearest = d;
          next = c;
        }
      }
      if (!next) break;
      if (gap(next, picked[0]) <= gap(next, picked[picked.length - 1])) {
        picked.unshift(next);
      } else picked.push(next);
    }
    if (picked.length < MIN_CHAIN) continue;

    let walk = 0;
    for (let i = 1; i < picked.length; i++) walk += gap(picked[i - 1], picked[i]);
    if (walk < bestWalk) {
      bestWalk = walk;
      best = picked;
    }
  }
  return best ? { trio: best, walk: bestWalk } : null;
}

/**
 * How many floors to look at before settling for the best one seen.
 *
 * A demonstration is allowed to choose its floor. Even the closest three
 * lit clusters of one temper are a board-width apart on a median floor —
 * clusters are placed at least three cells from each other and only four
 * of each temper light per phrase — and a gesture that sweeps corner to
 * corner teaches a big movement rather than the small deliberate one this
 * actually is. Sixty seeded floors take a few milliseconds and are looked
 * at during a pause, never in the middle of a run.
 */
const SEED_TRIES = 60;

/** The fraction of the picture the caption is painted over. */
const CAPTION_BAND = 0.16;

/** A walk this short, in pixels, is compact enough to stop looking. */
const tightEnough = (w: number, h: number) => Math.hypot(w, h) * 0.24;

/**
 * The hand.
 *
 * A soft disc with a ring around it, which is what a fingertip looks like
 * from the far side of a touchscreen, plus a ripple on the frame it lands.
 * Deliberately not a mouse cursor: this is played with a thumb.
 */
function ghost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  land: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(214,255,236,0.22)";
  ctx.strokeStyle = "rgba(214,255,236,0.85)";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(214,255,236,0.8)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (land > 0) {
    ctx.globalAlpha = land;
    ctx.beginPath();
    ctx.arc(x, y, 15 + (1 - land) * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
