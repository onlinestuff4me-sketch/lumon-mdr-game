/** The four Lumon tempers. Order is canonical: bins read 01..04. */
export type Temper = "WO" | "FC" | "DR" | "MA";

export type GamePhase =
  | "boot"
  | "briefing"
  | "probe"
  | "select"
  | "carry"
  | "failed"
  | "complete";

/** Interaction mode toggled from the control deck / by double tap. */
export type InputMode = "probe" | "select";

export interface GridNode {
  /** Index into GameState.nodes — equals row * COLS + col. */
  readonly idx: number;
  readonly col: number;
  readonly row: number;
  /** Home position in board space (px), centre of the glyph. */
  hx: number;
  hy: number;
  digit: number;
  /** Cluster id, or -1 when this node is inert filler. */
  cluster: number;
  /** Per-node phase offset so a cluster never moves in lockstep. */
  readonly seed: number;
  /** Live render transform, recomputed each frame. */
  dx: number;
  dy: number;
  rot: number;
  scale: number;
  /** 0..1 agitation applied to this node this frame. */
  agitation: number;
  /** Extra brightness (0..1) for phosphor flash bursts. */
  flash: number;
  /** Lifted into a packet / already refined -> not drawn on the grid. */
  lifted: boolean;
  retired: boolean;
  /** Scatter-return animation progress (1 -> 0). */
  scatter: number;
  sx: number;
  sy: number;
}

export interface Cluster {
  readonly id: number;
  readonly temper: Temper;
  readonly members: number[];
  /** Centroid in board space, px. */
  cx: number;
  cy: number;
  /** Radius of the member bounding circle, px. */
  radius: number;
  /** Smoothed 0..1 agitation for the whole cluster — drives motion, and
   *  may be held up by the latch after the finger lifts. */
  agitation: number;
  /** Smoothed 0..1 *live probe proximity* — drives audio and haptics, and
   *  falls to zero the moment the reticle leaves, latch or no latch. */
  probe: number;
  /** Wall-clock seconds this cluster has been agitated (drives motion). */
  clock: number;
  refined: boolean;
}

export interface Packet {
  temper: Temper;
  clusterId: number;
  digits: number[];
  /** Screen-space centre of the packet while carried. */
  x: number;
  y: number;
  /** 0..1 lift-off bloom progress. */
  birth: number;
}

export interface BinState {
  temper: Temper;
  /** 0..1 */
  fill: number;
  /** Timestamp (engine seconds) of the last hit, for flash feedback. */
  lastHitAt: number;
  lastHitOk: boolean;
}

export interface LevelDef {
  readonly id: string;
  readonly name: string;
  readonly fileCode: string;
  /** Seconds on the shift clock. */
  readonly seconds: number;
  /** Deterministic seed so a level always lays out the same way. */
  readonly seed: number;
  /** Which tempers appear in this file. Early files carry one temper, so
   *  the player learns a single signature at a time; only the bins for
   *  these tempers are shown. */
  readonly tempers: readonly Temper[];
  /** Minimum clear cells between two clusters. Early files space them far
   *  apart so each one can be found and read on its own; later files let
   *  them crowd. */
  readonly spacing: number;
  /** One line of Lumon, released on completing the file. */
  readonly lore: string;
  /** Packets required per bin to reach 100%. */
  readonly quota: number;
  /** Clusters seeded per temper. Kept above the quota so one cluster that
   *  is lost, misread or unreachable cannot make a file uncompletable. */
  readonly spare: number;
  /** Multiplier on cluster motion amplitude — later files are subtler. */
  readonly subtlety: number;
  /** No shift clock. Used by the calibration file, where the point is to
   *  learn the four tempers rather than to race. */
  readonly untimed?: boolean;
  /** Name the temper in the ticker as soon as a cluster is identified.
   *  This is the whole teaching mechanism of the calibration file. */
  readonly teaches?: boolean;
  /** Clusters agitate on their own, with no probe at all. The orientation
   *  file's entire lesson: groups are hidden in plain sight among digits
   *  that only look identical, and the ones that matter move. Probing is
   *  introduced afterwards, once the player knows what they are hunting
   *  for. */
  readonly selfAgitate?: boolean;
  /** Input mode the file opens in. Orientation opens in SELECT, so the
   *  first thing a new refiner ever does is draw a box round something
   *  they can already see moving. */
  readonly startMode?: InputMode;
  /** This file teaches the gesture chain rather than the tempers, and is
   *  what SKIP on the briefing screen skips. Marked explicitly rather than
   *  inferred from `teaches`, which is also set on every Act I file. */
  readonly training?: boolean;
}
