import { COLS, ROWS, CELL_COUNT } from "./constants";
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
 * True when placing `cell` into `cluster` would leave it within `spacing`
 * cells of a *different* cluster. At spacing 1 this is the 8-neighbourhood:
 * the minimum that stops a marquee straddling two clusters, since the
 * selection rules depend on a box resolving to exactly one temper. Early
 * files raise it so clusters sit alone in open ground and can be found and
 * read one at a time.
 */
function touchesForeign(
  owner: Int32Array,
  cell: number,
  clusterId: number,
  spacing: number,
): boolean {
  const col = cell % COLS;
  const row = (cell / COLS) | 0;
  for (let dr = -spacing; dr <= spacing; dr++) {
    for (let dc = -spacing; dc <= spacing; dc++) {
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
  spacing: number,
): number[] | null {
  if (
    owner[seedCell] !== -1 ||
    touchesForeign(owner, seedCell, clusterId, spacing)
  ) {
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
      if (touchesForeign(owner, cell, clusterId, spacing)) continue;
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
 * Build a fresh board carrying `perTemper` clusters of each temper in
 * `tempers`, kept at least `spacing` cells apart.
 *
 * If the board cannot fit them all at the requested spacing, the spacing is
 * relaxed a step at a time rather than shipping a file short of clusters —
 * a missing cluster makes a bin unfillable, whereas slightly closer
 * clusters are only slightly harder.
 */
/** What a seeded cluster is for. Decoys and the fifth temper occupy the
 *  board and answer to a probe, but fill no quota and no bin takes them. */
export interface Extra {
  readonly temper: Temper;
  readonly decoy?: boolean;
  readonly fifth?: boolean;
}

export function createBoard(
  seed: number,
  tempers: readonly Temper[],
  perTemper: number,
  spacing = 1,
  extras: readonly Extra[] = [],
): Board {
  const real = tempers.length * perTemper;
  for (let s = Math.max(1, spacing); s > 1; s--) {
    const attempt = seedBoard(seed, tempers, perTemper, s, extras);
    // Only the real clusters have to fit: a board that cannot hold every
    // decoy is still winnable, and a board short a real cluster is not.
    if (attempt.clusters.filter((c) => !c.decoy && !c.fifth).length === real) {
      return attempt;
    }
  }
  return seedBoard(seed, tempers, perTemper, 1, extras);
}

function seedBoard(
  seed: number,
  tempers: readonly Temper[],
  perTemper: number,
  spacing: number,
  extras: readonly Extra[] = [],
): Board {
  const rng = mulberry32(seed);
  const owner = new Int32Array(CELL_COUNT).fill(-1);

  const wanted: Extra[] = [];
  for (const t of tempers) {
    for (let i = 0; i < perTemper; i++) wanted.push({ temper: t });
  }
  shuffle(rng, wanted);
  // Extras are appended after the shuffle, so a saturated board drops a
  // decoy before it drops anything the player needs.
  wanted.push(...extras);

  const clusters: Cluster[] = [];
  const candidates = shuffle(
    rng,
    Array.from({ length: CELL_COUNT }, (_, i) => i),
  );

  let cursor = 0;
  for (const want of wanted) {
    const { temper } = want;
    const id = clusters.length;
    const target = randInt(rng, MIN_SIZE, MAX_SIZE);
    let members: number[] | null = null;
    let attempts = 0;
    while (!members && cursor < candidates.length && attempts++ < CELL_COUNT) {
      members = growCluster(rng, owner, candidates[cursor++], id, target, spacing);
    }
    if (!members) {
      // The board is saturated; the caller gets fewer clusters and the
      // quota is clamped against clusters.length, never against `wanted`.
      break;
    }
    clusters.push({
      id,
      temper,
      morphTo: null,
      morphAfter: 0,
      morphed: false,
      decoy: want.decoy === true,
      fifth: want.fifth === true,
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
const BARREL_K = 0.05;

/**
 * Displacement factor for a point on the flat lattice, mapping it onto the
 * curved face of the tube.
 *
 * The factor *falls* with radius, which is what makes this a barrel and not
 * a pincushion: the middle of each row reaches furthest from the centre and
 * the corners draw in, so rows bow outward the way they do on real glass.
 * Scaling by r² the other way is the inverse curve and sags the rows
 * inward, which is what this looked like before.
 *
 * Containment is not "f <= 1" — f peaks at 1 + K at the centre. It holds
 * because the product is bounded: nx * f(nx, 0) has derivative
 * (1 + 2K - 3K*nx^2)/(1 + K), positive for every |nx| <= 1, so it rises
 * monotonically to exactly 1 at the mid-edge and f falls as |ny| grows.
 * Any lattice with |nx|, |ny| <= 1 stays inside the region, whatever COLS
 * and ROWS are — and the half-cell inset means the lattice never reaches
 * 1 anyway.
 *
 * K trades bow against pitch: the warp necessarily crowds the glyphs
 * somewhere, and this curve puts that crowding at the edges and corners
 * rather than at the centre. It is tuned against glyph *ink*, not against
 * the atlas cell — the cell is 1.8x the font size because it carries the
 * baked phosphor halo, and halos overlapping is the effect, not a defect.
 * At K = 0.05 the worst row pitch still clears the ink by 2.3px on a 320px
 * stage and 3.8px on a 390px one, with the row bow at 7-9px.
 */
const BARREL_MAX = 1 + BARREL_K * 2;
/** Factor at the middle of an edge — the furthest the warp reaches. */
const BARREL_EDGE = (1 + BARREL_K) / BARREL_MAX;

function barrelFactor(nx: number, ny: number): number {
  const r2 = nx * nx + ny * ny;
  // Divided through by the edge factor so the middle of each edge lands
  // exactly on the padding boundary rather than short of it. The corners,
  // which bow furthest inward, still come to 1/(1 + K) of the half-extent,
  // so nothing escapes the grid region.
  return (1 + BARREL_K * (2 - r2)) / BARREL_MAX / BARREL_EDGE;
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
    const nx = (offX + padX + cellW * (node.col + 0.5) - cx) / halfW;
    const ny = (offY + padY + cellH * (node.row + 0.5) - cy) / halfH;
    const f = barrelFactor(nx, ny);
    node.hx = cx + nx * f * halfW;
    node.hy = cy + ny * f * halfH;
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
