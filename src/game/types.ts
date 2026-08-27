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

/** The reveal/hide cycle of the file that introduces the probe. */
export interface PulseDef {
  /** Seconds the group stays visibly agitated each time it surfaces. */
  readonly revealS: number;
  /** Seconds between the end of one reveal and the start of the next. */
  readonly hiddenS: number;
  /** Quiet seconds required after the last touch before a reveal may fire,
   *  so a reveal never happens underneath a finger already on the board. */
  readonly tapCooldownS: number;
  /** Motion amplitude of a reveal — a hint, not an announcement. */
  readonly subtlety: number;
  /** Fade in and out of each reveal. A hard cut reads as a glitch. */
  readonly rampS: number;
}

export interface GridNode {
  /** Index into GameState.nodes — equals row * COLS + col. */
  readonly idx: number;
  readonly col: number;
  readonly row: number;
  /** Home position in board space (px), center of the glyph. */
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
  /** Mutable: a morphing cluster changes temper in front of the player. */
  temper: Temper;
  /** Where a morphing cluster ends up, or null if it never morphs. */
  morphTo: Temper | null;
  /** Seconds of agitation before the morph begins. */
  morphAfter: number;
  /** True once the morph has run, so it happens exactly once. */
  morphed: boolean;
  /** A site that stirs when probed and belongs to nothing. No bin takes it,
   *  it fills no quota, and it is silent — the ear stays honest. */
  decoy: boolean;
  /** A spare cluster seeded solely so it can change temper in front of the
   *  player. Kept outside the quota: rewriting a quota cluster's temper
   *  takes the last cluster of the source temper off the board and leaves
   *  its bin permanently unfillable. */
  morph: boolean;
  /** The unnamed fifth temper: it borrows the motion of whichever temper
   *  was last refined, so it always looks like something known and is
   *  always wrong. Nothing in the game explains it. */
  fifth: boolean;
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
  /** Screen-space center of the packet while carried. */
  x: number;
  y: number;
  /** 0..1 lift-off bloom progress. */
  birth: number;
  /**
   * Where each digit was sitting when the group was lifted, as an offset
   * from the packet center. The gather animation flies the digits in from
   * these points, so the box is seen to be assembled out of the numbers
   * that were on the grid rather than to replace them. Stored as offsets,
   * not absolute points, so a press-and-drag lift keeps the digits with
   * the box while it is already moving.
   */
  origins: readonly { x: number; y: number }[];
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
   *  these tempers are shown unless `showBins` widens the deck. */
  readonly tempers: readonly Temper[];
  /** Bins displayed on the deck, when wider than the file's content — the
   *  orientation stage that first shows all four bins over a two-temper
   *  board uses this to introduce bins that must NOT be fed. Completion
   *  only ever requires the content tempers. */
  readonly showBins?: readonly Temper[];
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
  /** Digits of a group a selection box must touch to lift the whole group.
   *  Defaults to MIN_CAPTURE. The orientation screens set it to 1, so
   *  dragging over any part of a group takes all of it — a new player is
   *  never told their correct instinct was a wrong box. */
  readonly minCapture?: number;
  /** What happens on completion. "none" flashes and auto-advances, which
   *  is what turns 21 orientation screens into one sequence rather than 21
   *  interruptions; "full" is the usual 100% / addendum / NEXT FILE. */
  readonly ceremony?: "none" | "full";
  /** Milliseconds held on the completed board before the next screen. */
  readonly autoAdvanceMs?: number;
  /** Whether this file gets its own row in the handbook archive and
   *  releases an addendum. The orientation screens share one row. */
  readonly archived?: boolean;
  /** Position within a multi-screen sequence, for the HUD. */
  readonly stage?: readonly [number, number];
  /** The group surfaces and sinks on a cycle instead of staying visible.
   *  This is how the probe is introduced: motion that hides. */
  readonly pulse?: PulseDef;
  /** Seconds the lens holds at full size after the finger lifts, and then
   *  the seconds it takes to shrink away. Present only where the lens is
   *  being introduced and has to be seen to be understood. */
  readonly lensLingerS?: number;
  readonly lensShrinkS?: number;
  /** Decoy sites: [count, agitation as a fraction of a real group]. */
  readonly decoys?: readonly [number, number];
  /** Morphing groups: [count, seconds held before the change]. */
  readonly morphs?: readonly [number, number];
  /** A channel this file takes away. The player's own setting is restored
   *  when the file ends. */
  readonly redact?: "audio";
  /** Carries the unnamed fifth temper. */
  readonly fifth?: boolean;
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
  /** Where on the board groups prefer to sit. The first orientation screens
   *  put their group in the middle, where it cannot be missed; later ones
   *  push it out toward the edges, where it has to be looked for. */
  readonly focus?: "center" | "mid" | "edge";
  /** A tap anywhere on a group lifts the whole thing, no box required.
   *  Drag-to-box is not a discoverable gesture on its own, and the
   *  orientation screens exist to teach rather than to gate. */
  readonly tapToSelect?: boolean;
  /** Show faint arrows from a held packet toward the bin, after a pause.
   *  Only ever set where a single bin is on the deck, so it gives nothing
   *  away — and only after the player has hesitated, so anyone who already
   *  knows the gesture never sees it. */
  readonly binHint?: boolean;
}
