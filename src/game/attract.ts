/**
 * The attract loop behind the start screen.
 *
 * A board nobody is playing, refining itself. It exists so the terminal is
 * already doing the thing before anyone is told what the thing is: numbers
 * on a sheet, one group at a time coming loose and settling back.
 *
 * Deliberately **not** the real board. The briefing used to sit over the
 * engine's level-0 grid at six percent visibility, which meant the first
 * screen both showed nothing legible *and* quietly spoiled where the first
 * file's clusters are. This is its own sheet, seeded from its own number,
 * with no bearing on any file.
 *
 * It is not its own motion vocabulary, though. The displacement comes from
 * `applyTemperMotion` — the same function the game plays through — so a
 * refiner who watches the start screen for ten seconds has already seen
 * woe sag and frolic hop before the handbook names either. A second
 * hand-written "looks about right" animation here would teach the wrong
 * thing very convincingly.
 *
 * Pure: no DOM, no canvas, no React. `attractDraw.ts` paints it, and a
 * test can run the whole loop and assert on what stirs when.
 */

import { applyTemperMotion } from "./motion";
import { mulberry32 } from "./rng";
import type { Cluster, GridNode, Temper } from "./types";

/** Nominal spacing between digit centres, CSS px. */
export const CELL = 26;

/** How many groups are seeded, and so how long the loop runs before it
 *  repeats. Five at eight seconds apiece is forty seconds of start
 *  screen, which is longer than anyone looks at one. */
const GROUPS = 5;

/**
 * The cycle, in seconds.
 *
 * `LEAD` is a deliberate two seconds of nothing. The first pass started
 * the first group almost immediately, which put a bright thing on screen
 * in the same instant as the mark and the title and made the refiner
 * choose what to read. The sheet is at rest when the screen arrives, and
 * something comes loose in it a moment later — which is a terminal being
 * watched rather than a page loading.
 *
 * `RISE` and `FALL` are long, and longer than they first were by a second
 * apiece. A group that comes up in a second reads as a blink; over two
 * and a bit it reads as something surfacing.
 */
export const LEAD = 2.0;
export const RISE = 2.3;
export const HOLD = 1.1;
export const FALL = 2.6;
export const GAP = 2.0;
/** How long a group is anything other than at rest. */
export const LIT = RISE + HOLD + FALL;
/** One group's whole turn, agitation and silence together. */
export const SPAN = LIT + GAP;
/** When the loop starts over. */
export const LOOP = GROUPS * SPAN;

const TEMPERS: readonly Temper[] = ["WO", "FC", "DR", "MA"];

/** A rectangle in board px that no group may sit under — the text column. */
export interface KeepOut {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AttractBoard {
  readonly nodes: GridNode[];
  readonly clusters: Cluster[];
  readonly cols: number;
  readonly rows: number;
  readonly w: number;
  readonly h: number;
}

/** Smooth 0..1. Used for both edges of the envelope so a group neither
 *  snaps on nor snaps off — the whole effect is that it *creeps*. */
function smooth(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

/**
 * How agitated group `i` is at time `t`, and how long it has been that way.
 *
 * The clock matters as much as the level: every temper's motion is a
 * function of elapsed agitated seconds, so a group whose clock restarted
 * at zero each frame would shiver in place and never sag or hop.
 */
export function envelope(i: number, t: number): { a: number; clock: number } {
  const start = LEAD + i * SPAN;
  const local = ((t - start) % LOOP + LOOP) % LOOP;
  if (local >= LIT) return { a: 0, clock: 0 };
  if (local < RISE) return { a: smooth(local / RISE), clock: local };
  if (local < RISE + HOLD) return { a: 1, clock: local };
  return { a: 1 - smooth((local - RISE - HOLD) / FALL), clock: local };
}

function node(idx: number, col: number, row: number, rng: () => number): GridNode {
  return {
    idx,
    col,
    row,
    hx: col * CELL + CELL / 2,
    hy: row * CELL + CELL / 2,
    digit: Math.floor(rng() * 10),
    cluster: -1,
    seed: rng() * Math.PI * 2,
    dx: 0,
    dy: 0,
    rot: 0,
    scale: 1,
    agitation: 0,
    flash: 0,
    lifted: false,
    retired: false,
    scatter: 0,
    sx: 0,
    sy: 0,
  };
}

function cluster(id: number, temper: Temper, members: number[]): Cluster {
  return {
    id,
    temper,
    morphTo: null,
    morphAfter: 0,
    morphed: false,
    decoy: false,
    morph: false,
    fifth: false,
    members,
    cx: 0,
    cy: 0,
    radius: 0,
    agitation: 0,
    probe: 0,
    clock: 0,
    refined: false,
  };
}

/**
 * Lay out a sheet for a viewport, with `GROUPS` groups on it.
 *
 * Groups are grown one cell at a time from a seed rather than stamped from
 * a shape table, so no two look alike and none of them reads as a logo.
 */
export function createAttract(
  w: number,
  h: number,
  keepOut: KeepOut,
  seed = 0x5eed,
): AttractBoard {
  const rng = mulberry32(seed);
  const cols = Math.max(4, Math.ceil(w / CELL));
  const rows = Math.max(4, Math.ceil(h / CELL));

  const nodes: GridNode[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      nodes.push(node(nodes.length, col, row, rng));
    }
  }

  const clear = (idx: number): boolean => {
    const n = nodes[idx];
    // Off the rim. A group that straddles the edge of the screen is a
    // group the refiner sees three digits of, and three digits do not
    // read as a shape coming loose from a sheet.
    if (
      n.hx < CELL * 1.5 ||
      n.hx > w - CELL * 1.5 ||
      n.hy < CELL * 1.5 ||
      n.hy > h - CELL * 1.5
    ) {
      return false;
    }
    // A whole cell of margin around the column: a digit that hops is a
    // digit that can hop into the type.
    return !(
      n.hx > keepOut.x - CELL &&
      n.hx < keepOut.x + keepOut.w + CELL &&
      n.hy > keepOut.y - CELL &&
      n.hy < keepOut.y + keepOut.h + CELL
    );
  };

  const clusters: Cluster[] = [];
  const taken = new Set<number>();

  /** No two groups closer than this, so the loop moves the refiner's eye
   *  around the sheet instead of stirring the same corner five times. */
  const APART = CELL * 4.5;

  for (let i = 0; i < GROUPS; i++) {
    const temper = TEMPERS[i % TEMPERS.length];
    const want = 5 + Math.floor(rng() * 3);
    let members: number[] = [];

    // Sixty attempts, then give up on this group rather than loop forever
    // on a viewport too small to hold one clear of the type.
    for (let tries = 0; tries < 60 && members.length < want; tries++) {
      const start = Math.floor(rng() * nodes.length);
      if (taken.has(start) || !clear(start)) continue;
      const s = nodes[start];
      // Separation is relaxed as attempts run out: on a narrow phone the
      // clear area is two thin bands, and an unsatisfiable spacing rule
      // would cost the group altogether. Spread is worth having; a group
      // is worth more.
      const apart = APART * (1 - tries / 60);
      if (clusters.some((c) => Math.hypot(c.cx - s.hx, c.cy - s.hy) < apart)) {
        continue;
      }
      members = [start];
      const frontier = [start];
      while (members.length < want && frontier.length) {
        const from = nodes[frontier[Math.floor(rng() * frontier.length)]];
        const dc = Math.floor(rng() * 3) - 1;
        const dr = Math.floor(rng() * 3) - 1;
        const col = from.col + dc;
        const row = from.row + dr;
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        const idx = row * cols + col;
        if (taken.has(idx) || members.includes(idx) || !clear(idx)) continue;
        members.push(idx);
        frontier.push(idx);
      }
      if (members.length < want) members = [];
    }
    if (!members.length) continue;

    for (const idx of members) taken.add(idx);
    for (const idx of members) nodes[idx].cluster = clusters.length;
    const c = cluster(clusters.length, temper, members);
    c.cx = members.reduce((s, m) => s + nodes[m].hx, 0) / members.length;
    c.cy = members.reduce((s, m) => s + nodes[m].hy, 0) / members.length;
    c.radius = Math.max(
      ...members.map((m) =>
        Math.hypot(nodes[m].hx - c.cx, nodes[m].hy - c.cy),
      ),
    );
    clusters.push(c);
  }

  return { nodes, clusters, cols, rows, w, h };
}

/**
 * Advance every node to absolute time `t`.
 *
 * Absolute rather than incremental: the loop is a pure function of the
 * clock, so a frame dropped to a background tab or a slow phone changes
 * nothing about where the sheet is when it comes back. It also means the
 * reduced-motion still frame is one call with a chosen `t`.
 */
export function stepAttract(board: AttractBoard, t: number): void {
  for (const n of board.nodes) {
    // The whole sheet breathing. Sub-pixel on purpose — at a pixel it
    // stops reading as a live screen and starts reading as a wobble.
    n.dx = 0.5 * Math.sin(t * 0.7 + n.seed);
    n.dy = 0.4 * Math.sin(t * 0.53 + n.seed * 1.3);
    n.rot = 0;
    n.scale = 1;
    n.agitation = 0;
    n.flash = 0;
  }
  for (let i = 0; i < board.clusters.length; i++) {
    const c = board.clusters[i];
    const { a, clock } = envelope(i, t);
    c.agitation = a;
    c.clock = clock;
    if (a <= 0) continue;
    // Full subtlety: this is a display, not a file with a difficulty.
    applyTemperMotion(c, board.nodes, 1);
  }
}

/** A `t` at which exactly one group is at full agitation — the frame a
 *  refiner who declined motion is shown instead of the loop. */
export const STILL_AT = LEAD + RISE + HOLD / 2;
