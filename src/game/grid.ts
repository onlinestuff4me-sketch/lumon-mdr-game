import { COLS, ROWS, CELL_COUNT, TEMPERS } from "./constants";
import { mulberry32, randInt, shuffle } from "./rng";
import type { Cluster, GridNode, Temper } from "./types";

export interface Board {
  nodes: GridNode[];
  clusters: Cluster[];
  /** clusterId by node index, -1 for filler. */
  ownerOf: Int32Array;
  /** The board's own generator, so in-game jitter stays seeded too. */
  rng: () => number;
}

const MIN_SIZE = 4;
const MAX_SIZE = 9;

function idx(col: number, row: number): number {
  return row * COLS + col;
}

/**
 * True when placing `cell` into `cluster` would leave it touching a
 * *different* cluster (8-neighbourhood). Clusters are kept one cell apart so
 * a marquee can never straddle two of them — the selection rules depend on
 * a box resolving to exactly one temper.
 */
function touchesForeign(
  owner: Int32Array,
  cell: number,
  clusterId: number,
): boolean {
  const col = cell % COLS;
  const row = (cell / COLS) | 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const o = owner[idx(c, r)];
      if (o !== -1 && o !== clusterId) return true;
    }
  }
  return false;
}

/**
 * Grow one contiguous blob of 4..9 cells by orthogonal random walk.
 * Returns the member indices, or null if the seed was unusable.
 */
function growCluster(
  rng: () => number,
  owner: Int32Array,
  seedCell: number,
  clusterId: number,
  target: number,
): number[] | null {
  if (owner[seedCell] !== -1 || touchesForeign(owner, seedCell, clusterId)) {
    return null;
  }
  const members = [seedCell];
  owner[seedCell] = clusterId;

  let guard = 0;
  while (members.length < target && guard++ < 200) {
    const from = members[Math.floor(rng() * members.length)];
    const col = from % COLS;
    const row = (from / COLS) | 0;
    const dirs = shuffle(rng, [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]);
    let placed = false;
    for (const [dc, dr] of dirs) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const cell = idx(c, r);
      if (owner[cell] !== -1) continue;
      if (touchesForeign(owner, cell, clusterId)) continue;
      owner[cell] = clusterId;
      members.push(cell);
      placed = true;
      break;
    }
    if (!placed && members.length >= MIN_SIZE) break;
  }

  if (members.length < MIN_SIZE) {
    for (const m of members) owner[m] = -1;
    return null;
  }
  return members;
}

/**
 * Build a fresh board. `perTemper` clusters of each temper are seeded, so a
 * full file always contains exactly the digits the quota requires.
 */
export function createBoard(seed: number, perTemper: number): Board {
  const rng = mulberry32(seed);
  const owner = new Int32Array(CELL_COUNT).fill(-1);

  const wanted: Temper[] = [];
  for (const t of TEMPERS) {
    for (let i = 0; i < perTemper; i++) wanted.push(t);
  }
  shuffle(rng, wanted);

  const clusters: Cluster[] = [];
  const candidates = shuffle(
    rng,
    Array.from({ length: CELL_COUNT }, (_, i) => i),
  );

  let cursor = 0;
  for (const temper of wanted) {
    const id = clusters.length;
    const target = randInt(rng, MIN_SIZE, MAX_SIZE);
    let members: number[] | null = null;
    let attempts = 0;
    while (!members && cursor < candidates.length && attempts++ < CELL_COUNT) {
      members = growCluster(rng, owner, candidates[cursor++], id, target);
    }
    if (!members) {
      // The board is saturated; the caller gets fewer clusters and the
      // quota is clamped against clusters.length, never against `wanted`.
      break;
    }
    clusters.push({
      id,
      temper,
      members,
      cx: 0,
      cy: 0,
      radius: 0,
      agitation: 0,
      probe: 0,
      clock: 0,
      refined: false,
    });
  }

  const nodes: GridNode[] = new Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    nodes[i] = {
      idx: i,
      col: i % COLS,
      row: (i / COLS) | 0,
      hx: 0,
      hy: 0,
      digit: Math.floor(rng() * 10),
      cluster: owner[i],
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

  return { nodes, clusters, ownerOf: owner, rng };
}

/**
 * Barrel (pincushion-inverse) distortion strength. The matrix is laid out
 * on a flat lattice and then pushed outward as a function of radius, so the
 * rows visibly bow the way they do on a curved tube.
 *
 * This warps the *home positions themselves* rather than being a render
 * pass, which matters: proximity tests, marquee AABB hits and the drawn
 * glyphs all read the same coordinates, so what the refiner boxes is
 * exactly what the engine selects. A post-hoc shader could not promise
 * that without warping the input too.
 */
const BARREL_K = 0.062;

/** Map a point on the flat lattice onto the curved face of the tube. */
function barrel(
  x: number,
  y: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
): { x: number; y: number } {
  const nx = (x - cx) / halfW;
  const ny = (y - cy) / halfH;
  const r2 = nx * nx + ny * ny;
  // Normalised so the corners land exactly back on the region edge: the
  // curvature redistributes the rows without growing the grid's footprint.
  const f = (1 + BARREL_K * r2) / (1 + BARREL_K * 2);
  return { x: cx + nx * f * halfW, y: cy + ny * f * halfH };
}

/** Recompute home positions + cluster centroids for a new canvas size. */
export function layoutBoard(
  board: Board,
  region: { x: number; y: number; w: number; h: number },
  padX: number,
  padY: number,
): { cellW: number; cellH: number } {
  const { x: offX, y: offY, w: width, h: height } = region;
  const cellW = (width - padX * 2) / COLS;
  const cellH = (height - padY * 2) / ROWS;

  const cx = offX + width / 2;
  const cy = offY + height / 2;
  const halfW = Math.max(1, width / 2 - padX);
  const halfH = Math.max(1, height / 2 - padY);

  for (const node of board.nodes) {
    const flatX = offX + padX + cellW * (node.col + 0.5);
    const flatY = offY + padY + cellH * (node.row + 0.5);
    const warped = barrel(flatX, flatY, cx, cy, halfW, halfH);
    node.hx = warped.x;
    node.hy = warped.y;
  }

  for (const cluster of board.clusters) {
    let sx = 0;
    let sy = 0;
    for (const m of cluster.members) {
      sx += board.nodes[m].hx;
      sy += board.nodes[m].hy;
    }
    cluster.cx = sx / cluster.members.length;
    cluster.cy = sy / cluster.members.length;
    let r = 0;
    for (const m of cluster.members) {
      const n = board.nodes[m];
      r = Math.max(r, Math.hypot(n.hx - cluster.cx, n.hy - cluster.cy));
    }
    cluster.radius = r;
  }

  return { cellW, cellH };
}
