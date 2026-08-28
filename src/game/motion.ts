import type { Cluster, GridNode } from "./types";

/**
 * Temper motion profiles.
 *
 * Each temper owns a *distinct mathematical displacement* so that the
 * refiner learns to read feeling from movement alone. `a` is the cluster's
 * smoothed agitation (0..1), `t` its agitation clock in seconds, and
 * `subtlety` the per-file amplitude scalar (later files move less).
 *
 * All four write into node.dx/dy/rot/scale/flash and nothing else, so the
 * renderer stays a pure function of node state.
 */
export function applyTemperMotion(
  cluster: Cluster,
  nodes: GridNode[],
  subtlety: number,
): void {
  const a = cluster.agitation;
  const t = cluster.clock;
  const amp = a * subtlety;

  switch (cluster.temper) {
    // ── WOE ── a slow, heavy sag downward. Nothing recovers.
    case "WO": {
      for (const i of cluster.members) {
        const n = nodes[i];
        const sag = 0.62 + 0.38 * Math.sin(t * 0.75 + n.seed);
        n.dx = amp * 0.9 * Math.sin(t * 0.32 + n.seed * 0.5);
        n.dy = amp * 11 * sag;
        n.rot = amp * 0.05 * Math.sin(t * 0.4 + n.seed);
        n.scale = 1 - amp * 0.06;
        n.flash = 0;
        n.agitation = a;
      }
      break;
    }

    // ── FROLIC ── bounce on Y with a +/-15 degree spin.
    case "FC": {
      const FIFTEEN_DEG = (15 * Math.PI) / 180;
      for (const i of cluster.members) {
        const n = nodes[i];
        const hop = Math.abs(Math.sin(t * 3.6 + n.seed));
        n.dx = amp * 2.2 * Math.sin(t * 2.1 + n.seed * 1.7);
        n.dy = -amp * 9.5 * hop;
        n.rot = amp * FIFTEEN_DEG * Math.sin(t * 4.4 + n.seed);
        n.scale = 1 + amp * 0.08 * hop;
        n.flash = amp * 0.18 * hop;
        n.agitation = a;
      }
      break;
    }

    // ── DREAD ── a 30 Hz horizontal shiver. Small, fast, wrong.
    // Purely on X: the whole point is that dread does not move the digit,
    // it only makes it tremble in place.
    //
    // The specified 30 Hz sits exactly at Nyquist for a 60 fps display, and
    // at 30 fps (low-power mode, thermal throttling, a mid-range phone) it
    // advances a whole period per frame and the cluster freezes solid —
    // dread would become invisible on precisely the devices most likely to
    // run it. A second, much slower component at an incommensurable ratio
    // guarantees a visible tremor at any frame rate while leaving 30 Hz the
    // dominant term where the display can actually show it.
    case "DR": {
      const OMEGA = 2 * Math.PI * 30;
      const OMEGA_SUB = 2 * Math.PI * 11.3;
      for (const i of cluster.members) {
        const n = nodes[i];
        n.dx =
          amp *
          (2.6 * Math.sin(OMEGA * t + n.seed * 11) +
            1.15 * Math.sin(OMEGA_SUB * t + n.seed * 5));
        n.dy = 0;
        n.rot = 0;
        n.scale = 1 + amp * 0.02;
        n.flash = 0;
        n.agitation = a;
      }
      break;
    }

    // ── MALICE ── radial outward pulses with phosphor flash bursts.
    case "MA": {
      const pulse = Math.max(0, Math.sin(t * 4.8));
      // Sharp but not vanishing: pow(_, 7) put the flash inside a couple of
      // frames and it read as nothing at all.
      const burst = Math.pow(pulse, 4);
      for (const i of cluster.members) {
        const n = nodes[i];
        let ux = n.hx - cluster.cx;
        let uy = n.hy - cluster.cy;
        const len = Math.hypot(ux, uy) || 1;
        ux /= len;
        uy /= len;
        const p = Math.pow(pulse, 2.2);
        n.dx = ux * amp * 10 * p;
        n.dy = uy * amp * 10 * p;
        n.rot = amp * 0.09 * Math.sin(t * 9 + n.seed);
        n.scale = 1 + amp * 0.16 * p;
        n.flash = Math.min(1, amp * burst * 1.35);
        n.agitation = a;
      }
      break;
    }
  }
}

/**
 * Idle behavior for every node whose cluster is at rest (and for inert
 * filler). Rather than snapping home, transforms *settle* toward the drift
 * target, so a cluster calming down decays instead of popping.
 */
export function settleNode(n: GridNode, t: number, dt: number): void {
  const k = Math.min(1, dt * 6);
  const driftX = Math.sin(t * 0.55 + n.seed) * 1.15;
  const driftY = Math.cos(t * 0.43 + n.seed * 1.3) * 0.95;
  n.dx += (driftX - n.dx) * k;
  n.dy += (driftY - n.dy) * k;
  // Snap to exactly 0 and 1 rather than decaying asymptotically toward
  // them: the renderer's transform-free fast path requires rot === 0 and
  // scale === 1, and a geometric decay from 0.1 takes some seven thousand
  // frames to reach exact zero. Every glyph ever touched would otherwise
  // pay a save/translate/rotate/restore for the rest of the file.
  n.rot = Math.abs(n.rot) < 1e-3 ? 0 : n.rot + (0 - n.rot) * k;
  n.scale =
    Math.abs(n.scale - 1) < 1e-3 ? 1 : n.scale + (1 - n.scale) * k;
  n.flash = n.flash < 1e-3 ? 0 : n.flash * Math.max(0, 1 - dt * 5);
  n.agitation = 0;
}
