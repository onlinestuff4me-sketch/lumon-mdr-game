import { useLayoutEffect, useRef, type RefObject } from "react";
import { createAttract, stepAttract, STILL_AT, type AttractBoard } from "../game/attract";
import { drawAttract } from "../game/attractDraw";
import { GlyphAtlas } from "../game/glyphAtlas";
import { prefersReduce } from "../game/reduceMotion";

/** Digit size on the sheet. Smaller than the board's, because this is a
 *  backdrop and a backdrop that can be read word for word is a foreground. */
const FONT_PX = 15;

interface Props {
  /**
   * The element the groups must keep clear of — the title column.
   *
   * Measured rather than guessed: the column's height depends on how many
   * buttons the terminal is offering, which depends on how many saves
   * exist, so there is no constant that is right for every refiner.
   */
  keepOutRef: RefObject<HTMLElement | null>;
}

/**
 * The start screen's backdrop: a sheet of numbers, refining itself.
 *
 * Owns one canvas and one rAF, both torn down with the component — the
 * briefing is the only place it mounts, so nothing here runs while anyone
 * is actually playing.
 */
export function AttractField({ keepOutRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const atlas = new GlyphAtlas();
    let board: AttractBoard | null = null;
    let frame = 0;
    let start = 0;

    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const measure = (): void => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(80, Math.round(rect.width));
      const h = Math.max(80, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      atlas.build(FONT_PX, dpr);

      const keep = keepOutRef.current?.getBoundingClientRect();
      board = createAttract(
        w,
        h,
        keep
          ? {
              x: keep.left - rect.left,
              y: keep.top - rect.top,
              w: keep.width,
              h: keep.height,
            }
          : { x: w * 0.2, y: h * 0.2, w: w * 0.6, h: h * 0.6 },
      );
    };

    const paint = (t: number): void => {
      if (!board) return;
      stepAttract(board, t);
      drawAttract(ctx, atlas, board, t);
    };

    measure();

    // A refiner who asked for less motion gets the frame the loop exists
    // to arrive at: the sheet at rest with one group come loose in it.
    // Still a picture of the game, and it holds absolutely still.
    if (prefersReduce()) {
      paint(STILL_AT);
      return;
    }

    const tick = (now: number): void => {
      if (!start) start = now;
      paint((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // A backdrop is not worth a frame in a tab nobody is looking at. The
    // loop is a pure function of the clock, so it resumes wherever it
    // would have been rather than where it stopped.
    const visibility = (): void => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) {
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", visibility);

    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      ro.disconnect();
      // Hand the atlas's offscreen canvases back rather than waiting for a
      // collector: they are often GPU-backed, and this component mounts
      // again every time a refiner returns to the start screen.
      atlas.release();
    };
  }, [keepOutRef]);

  return (
    // `pointer-events-none` is load-bearing, not tidiness: this sheet
    // covers the whole start screen, and the start screen has buttons on
    // it that are not inside the title column — READ THE HANDBOOK sits
    // below everything. Without this it swallows their taps and the
    // handbook becomes unreachable from the first screen.
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
