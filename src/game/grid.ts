import { COLS, ROWS, CELL_COUNT } from "./constants";
import { mulberry32, randInt, shuffle } from "./rng";
import type { Cluster, GridNode, LevelDef, Temper } from "./types";

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
 * cells of a *different* cluster. At spacing 1 this is the 8-neighborhood:
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
  readonly morph?: boolean;
}

export function createBoard(
  seed: number,
  tempers: readonly Temper[],
  perTemper: number,
  spacing = 1,
  extras: readonly Extra[] = [],
  focus: Focus = null,
): Board {
  const real = tempers.length * perTemper;
  for (let s = Math.max(1, spacing); s > 1; s--) {
    const attempt = seedBoard(seed, tempers, perTemper, s, extras, focus);
    // Decoys are the only clusters allowed to fall off a crowded board:
    // one fewer bystander is a slightly easier file. A missing *real*
    // cluster makes a bin unfillable, and a missing fifth temper silently
    // removes the beat a file was built around — Cold Harbor is the whole
    // point of the fifth, and it lost it the day the board went from 28
    // rows to 26. Both are required; the spacing gives way instead.
    const wantFifth = extras.filter((e) => e.fifth).length;
    const gotFifth = attempt.clusters.filter((c) => c.fifth).length;
    if (
      attempt.clusters.filter((c) => !c.decoy && !c.fifth).length >= real &&
      gotFifth >= wantFifth
    ) {
      return attempt;
    }
  }
  return seedBoard(seed, tempers, perTemper, 1, extras, focus);
}

export type Focus = "center" | "mid" | "edge" | null;

/** Chebyshev radius each focus aims for, 0 at the board's center and 1 at
 *  its border. */
const FOCUS_TARGET: Record<Exclude<Focus, null>, number> = {
  center: 0.1,
  mid: 0.55,
  edge: 0.78,
};

/**
 * Ranks candidate cells so a group lands where the file wants it. Ordering
 * the *candidates* rather than nudging a finished cluster keeps every other
 * guarantee intact — spacing, size, no shared cells — because the grower is
 * still free to refuse any seed it cannot use.
 *
 * The shuffled order is kept as the tie-break and a jitter term is added, so
 * two files with the same focus do not put their group in the same place.
 */
function rankByFocus(
  cells: number[],
  focus: Focus,
  rng: () => number,
): number[] {
  if (!focus) return cells;
  const cx = (COLS - 1) / 2;
  const cy = (ROWS - 1) / 2;
  const score = new Map<number, number>();
  for (const i of cells) {
    const nx = ((i % COLS) - cx) / cx;
    const ny = (((i / COLS) | 0) - cy) / cy;
    // Chebyshev rather than Euclidean: the board is much taller than it is
    // wide, and a radial measure would call the whole top and bottom "edge"
    // while treating most of the width as center.
    const r = Math.max(Math.abs(nx), Math.abs(ny)) + (rng() - 0.5) * 0.22;
    // Each focus aims at a band rather than at an extreme. Maximizing `r`
    // for "edge" produced clusters flush to the border — four cells all in
    // the last row, or all in the last column — which are the hardest
    // targets in the game, sitting on a teaching screen.
    score.set(i, Math.abs(r - FOCUS_TARGET[focus]));
  }
  return [...cells].sort((a, b) => score.get(a)! - score.get(b)!);
}

function seedBoard(
  seed: number,
  tempers: readonly Temper[],
  perTemper: number,
  spacing: number,
  extras: readonly Extra[] = [],
  focus: Focus = null,
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
  const candidates = rankByFocus(
    shuffle(
      rng,
      Array.from({ length: CELL_COUNT }, (_, i) => i),
    ),
    focus,
    rng,
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
      morph: want.morph === true,
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
 * a pincushion: the middle of each row reaches furthest from the center and
 * the corners draw in, so rows bow outward the way they do on real glass.
 * Scaling by r² the other way is the inverse curve and sags the rows
 * inward, which is what this looked like before.
 *
 * Containment is not "f <= 1" — f peaks at 1 + K at the center. It holds
 * because the product is bounded: nx * f(nx, 0) has derivative
 * (1 + 2K - 3K*nx^2)/(1 + K), positive for every |nx| <= 1, so it rises
 * monotonically to exactly 1 at the mid-edge and f falls as |ny| grows.
 * Any lattice with |nx|, |ny| <= 1 stays inside the region, whatever COLS
 * and ROWS are — and the half-cell inset means the lattice never reaches
 * 1 anyway.
 *
 * K trades bow against pitch: the warp necessarily crowds the glyphs
 * somewhere, and this curve puts that crowding at the edges and corners
 * rather than at the center. It is tuned against glyph *ink*, not against
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

/**
 * Clusters a file seeds beyond the ones its bins need: decoy sites, and the
 * unnamed fifth temper. Both occupy the board and answer to a probe; no bin
 * takes either, and neither fills a quota.
 */
export function boardExtras(level: LevelDef): Extra[] {
  const extras: Extra[] = [];
  const [decoyCount] = level.decoys ?? [0, 0];
  for (let i = 0; i < decoyCount; i++) {
    // A decoy borrows a temper so it has some motion to show. Which one is
    // rotated through the file's own tempers, so a decoy never stands out
    // by moving in a way nothing else on the board does.
    extras.push({ temper: level.tempers[i % level.tempers.length], decoy: true });
  }
  const [morphCount] = level.morphs ?? [0, 0];
  for (let i = 0; i < morphCount; i++) {
    // Seeded as an extra, never taken from the quota. Rewriting a quota
    // cluster's temper removes the last cluster of the source temper and
    // the bin can then never fill — on an untimed teaching file that is a
    // softlock with no clock to expire and no RETRY to press.
    extras.push({ temper: level.tempers[i % level.tempers.length], morph: true });
  }
  if (level.fifth) extras.push({ temper: level.tempers[0], fifth: true });
  return extras;
}

/**
 * Marks the clusters that change temper while the refiner watches. Chosen
 * by position rather than at random so a file plays the same way twice —
 * the whole queue is seeded, and a mechanic that moved between plays could
 * not be learned.
 */
export function assignMorphs(board: Board, level: LevelDef): void {
  const [, holdS] = level.morphs ?? [0, 0];
  const real = board.clusters.filter((c) => c.morph);
  for (let i = 0; i < real.length; i++) {
    const c = real[i];
    // It becomes a temper this file actually has a bin for; otherwise the
    // lesson would be "sometimes a group is unbinnable", which is a
    // different mechanic entirely and belongs to the fifth temper.
    const others = level.tempers.filter((t) => t !== c.temper);
    c.morphTo = others[i % others.length];
    c.morphAfter = holdS;
    c.morphed = false;
  }
}
