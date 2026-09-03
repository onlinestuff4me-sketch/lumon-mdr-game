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
 * Nothing about it is a video: it is the game, playing itself, at the
 * size and in the colors the refiner is about to be handed.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GlyphAtlas } from "../game/glyphAtlas";
import { drawFloor } from "../game/mdeDraw";
import {
  BEAT_WINDOW,
  MDE_ROWS,
  MIN_CHAIN,
  MdeSession,
  type Genre,
  type MdeCluster,
} from "../game/mde";
import { ChainPips, DanceMeter } from "./MdeHud";

/** How long the ghost takes to travel from one group to the next. */
const REACH_S = 0.34;
/** A pause on the third group before letting go — the beat is coming. */
const ARM_S = 0.3;
/** How long the merge is left on screen before the next demonstration. */
const BASK_S = 1.5;
/** The breath before a new run at it. */
const READY_S = 0.35;
/**
 * A phrase this run has to fit inside.
 *
 * The floor re-lights every eight beats and takes any chain in hand apart
 * when it does — correct in play, and a lie in a demonstration, where it
 * would show the move failing. So a run only starts on a phrase with room
 * for the whole of it.
 */
const RUN_S = READY_S + REACH_S * MIN_CHAIN + ARM_S + 0.15;

type Beat = "ready" | "reach" | "arm" | "bask";

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

    const build = () => new MdeSession(genre, seed, w, h);
    let session = build();

    /** The lit clusters of the first temper with enough of them. */
    const trioOn = (s: MdeSession): MdeCluster[] | null => {
      const by = new Map<string, MdeCluster[]>();
      for (const c of s.clusters) {
        if (!c.lit || c.spent) continue;
        const list = by.get(c.temper) ?? [];
        list.push(c);
        by.set(c.temper, list);
      }
      for (const list of by.values()) {
        if (list.length >= MIN_CHAIN) return list.slice(0, MIN_CHAIN);
      }
      return null;
    };

    // Reduced motion gets the lesson as a still: the chain built, the
    // finger on the last group, the line reading RELEASE ON THE BEAT. It
    // is the frame the animation exists to arrive at, so it is the frame
    // worth holding.
    if (prefersReduce()) {
      const trio = trioOn(session);
      if (trio) for (const c of trio) session.touch(c.cx, c.cy);
      session.step(1 / 60);
      drawFloor(ctx, session, atlas, w, h);
      const t = trio?.[MIN_CHAIN - 1];
      if (t) ghost(ctx, t.cx, t.cy, 0);
      return;
    }

    let beat: Beat = "ready";
    /** Seconds spent in the current beat of the script. */
    let held = 0;
    /** Which of the three groups the ghost is walking to. */
    let step = 0;
    let trio: MdeCluster[] = [];
    let from = { x: w / 2, y: h * 0.82 };
    let ptr = { ...from };
    /** 1 on the frame the ghost lands, falling to 0 — the tap ripple. */
    let land = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // A demonstration that filled the meter would stop dead, which on
      // an instruction screen reads as a hang. It starts over instead.
      if (session.finished) {
        session = build();
        beat = "ready";
        held = 0;
        step = 0;
        trio = [];
      }

      session.step(dt);
      held += dt;
      land = Math.max(0, land - dt * 3.4);

      switch (beat) {
        case "ready": {
          // Wait for a phrase with room in it, and for a chain to be on
          // the floor at all.
          if (held < READY_S) break;
          const found = trioOn(session);
          if (!found || session.phraseLeft < RUN_S) break;
          trio = found;
          step = 0;
          from = { ...ptr };
          held = 0;
          beat = "reach";
          break;
        }
        case "reach": {
          const target = trio[step];
          const k = Math.min(1, held / REACH_S);
          // Ease out: a hand slows as it arrives, and a linear ghost
          // reads as a cursor being dragged by a script, which it is.
          const e = 1 - (1 - k) * (1 - k) * (1 - k);
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
          const k = Math.min(1, held / BASK_S);
          ptr = { x: ptr.x, y: ptr.y + dt * 40 * k };
          if (held < BASK_S) break;
          held = 0;
          beat = "ready";
          break;
        }
      }

      drawFloor(ctx, session, atlas, w, h);
      ghost(ctx, ptr.x, ptr.y, land);
      const s = session.snapshot();
      setHud({ meter: s.meter, chain: s.chain.length });
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [genre, seed]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChainPips chain={hud.chain} />
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          aria-label="A demonstration of the dance"
          role="img"
        />
      </div>
      <DanceMeter meter={hud.meter} right={<span>DEMONSTRATION</span>} />
    </div>
  );
}

const prefersReduce = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

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
