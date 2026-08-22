import { useEffect, useRef } from "react";
import { TEMPER_DEFS } from "../game/constants";
import { applyTemperMotion } from "../game/motion";
import type { Cluster, GridNode, Temper } from "../game/types";

/**
 * A live sample of one temper's motion, running the same
 * `applyTemperMotion` the board does.
 *
 * The handbook used to describe the tempers in words — "digits droop
 * downward under their own weight" — which leaves the actual signature to
 * be learned by trial and error against a running clock. A moving sample
 * is a reference you can check mid-file, and the clock is paused while the
 * handbook is open.
 */
export function TemperSample({ temper }: { temper: Temper }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = 74;
    const h = 34;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // A 3x2 stand-in cluster, laid out like the real grid.
    const cols = 3;
    const rows = 2;
    const cellW = 17;
    const cellH = 13;
    const digits = [4, 9, 2, 7, 0, 5];
    const nodes: GridNode[] = digits.map((digit, i) => ({
      idx: i,
      col: i % cols,
      row: (i / cols) | 0,
      hx: w / 2 + ((i % cols) - (cols - 1) / 2) * cellW,
      hy: h / 2 + (((i / cols) | 0) - (rows - 1) / 2) * cellH,
      digit,
      cluster: 0,
      seed: (i * 2.399963) % (Math.PI * 2),
      dx: 0,
      dy: 0,
      rot: 0,
      scale: 1,
      agitation: 1,
      flash: 0,
      lifted: false,
      retired: false,
      scatter: 0,
      sx: 0,
      sy: 0,
    }));

    const cluster: Cluster = {
      id: 0,
      temper,
      members: nodes.map((n) => n.idx),
      cx: w / 2,
      cy: h / 2,
      radius: cellW,
      agitation: 1,
      probe: 1,
      clock: 0,
      refined: false,
    };

    const def = TEMPER_DEFS[temper];
    let raf = 0;
    let last = performance.now();
    let stopped = false;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const frame = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      cluster.clock += reduce ? 0 : dt;
      applyTemperMotion(cluster, nodes, 1);

      ctx.clearRect(0, 0, w, h);
      ctx.font = `700 11px "Courier New", Courier, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const n of nodes) {
        const x = n.hx + n.dx;
        const y = n.hy + n.dy;
        ctx.save();
        ctx.translate(x, y);
        if (n.rot !== 0) ctx.rotate(n.rot);
        if (n.scale !== 1) ctx.scale(n.scale, n.scale);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = def.css;
        ctx.fillText(String(n.digit), 0, 0);
        if (n.flash > 0.02) {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = Math.min(1, n.flash);
          ctx.fillStyle = "#ebfff4";
          ctx.fillText(String(n.digit), 0, 0);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [temper]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="shrink-0 rounded-[2px] bg-phos-950"
      style={{ width: 74, height: 34 }}
    />
  );
}
