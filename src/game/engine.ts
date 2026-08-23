import { getAudio } from "../audio/AudioEngine";
import { haptics } from "../audio/haptics";
import {
  COLS,
  DOUBLE_TAP_MS,
  PACE,
  TIME_CREDIT,
  LEVELS,
  MIN_CAPTURE,
  PRAISE,
  PROBE_RADIUS,
  REPRIMAND,
  RETICLE_OFFSET_Y,
  MARQUEE_OFFSET_Y,
  TEMPER_DEFS,
  TAP_MAX_MS,
  TAP_SLOP,
  TEMPERS,
} from "./constants";
import {
  assignMorphs,
  boardExtras,
  createBoard,
  layoutBoard,
  type Board,
} from "./grid";
import { loadSettings, saveSettings } from "./settings";
import { computeLayout, pointInRect, type Rect, type StageLayout } from "./layout";
import { GlyphAtlas } from "./glyphAtlas";
import { applyTemperMotion, settleNode } from "./motion";
import { renderGrid, renderOverlay } from "./render";
import type { Pace } from "./constants";
import type {
  BinState,
  Cluster,
  GamePhase,
  InputMode,
  Packet,
  PulseDef,
  Temper,
} from "./types";

export interface BinView {
  temper: Temper;
  fill: number;
  /** 1 accepted, -1 rejected, 0 idle — drives the bin flash. */
  hit: number;
  /** True while a carried packet hovers this bin. */
  hover: boolean;
  /** True while this is the bin the held packet belongs in, on the files
   *  that teach the drag. */
  target: boolean;
}

/**
 * How long a coach line stays true.
 *  - sticky:       until something else is said.
 *  - attempt:      it reports how the last attempt went; the next touch
 *                  supersedes it, so it clears on pointer-down.
 *  - untilPacket:  an instruction to pick something up.
 *  - untilDropped: an instruction about the thing being carried.
 *  - untilAction:  an orientation nudge, retired by any real progress.
 */
type MessageScope =
  | "sticky"
  | "attempt"
  | "untilPacket"
  | "untilDropped"
  | "untilAction";

export interface HudSnapshot {
  phase: GamePhase;
  paused: boolean;
  mode: InputMode;
  levelIndex: number;
  levelName: string;
  fileCode: string;
  timeLeft: number;
  totalTime: number;
  progress: number;
  bins: BinView[];
  carrying: boolean;
  message: string | null;
  messageKind: "praise" | "error" | "info" | null;
  glitch: boolean;
  audioReady: boolean;
  muted: boolean;
  hapticsOn: boolean;
  assist: boolean;
  pace: Pace;
  untimed: boolean;
  ceremony: "none" | "full";
  teaching: boolean;
  activeTempers: readonly Temper[];
  /** [n, of] within a multi-screen sequence, or null. */
  stage: readonly [number, number] | null;
  lore: string;
  isLastLevel: boolean;
}

type Listener = () => void;

/** Structural equality for the HUD snapshot. The displayed clock is whole
 *  seconds, so sub-second drift must not count as a change. */
function sameSnapshot(a: HudSnapshot, b: HudSnapshot): boolean {
  if (
    a.phase !== b.phase ||
    a.paused !== b.paused ||
    a.mode !== b.mode ||
    a.levelIndex !== b.levelIndex ||
    a.carrying !== b.carrying ||
    a.message !== b.message ||
    a.messageKind !== b.messageKind ||
    a.glitch !== b.glitch ||
    a.audioReady !== b.audioReady ||
    a.muted !== b.muted ||
    a.hapticsOn !== b.hapticsOn ||
    a.assist !== b.assist ||
    a.activeTempers !== b.activeTempers ||
    Math.ceil(a.timeLeft) !== Math.ceil(b.timeLeft) ||
    Math.round(a.progress * 100) !== Math.round(b.progress * 100)
  ) {
    return false;
  }
  for (let i = 0; i < a.bins.length; i++) {
    const x = a.bins[i];
    const y = b.bins[i];
    if (x.fill !== y.fill || x.hit !== y.hit || x.hover !== y.hover) return false;
  }
  return true;
}

interface Gesture {
  id: number;
  kind: "probe" | "marquee" | "carry";
  startX: number;
  startY: number;
  startT: number;
  x: number;
  y: number;
  moved: boolean;
  /** Cluster positively identified during *this* gesture, or -1. */
  latchedDuring: number;
  /** Agitation of the nearest group at the instant the finger landed — the
   *  board before this touch changed it. */
  startAgitation: number;
  /** Where the carried packet sat relative to the reticle when this drag
   *  began, so picking it up does not teleport it. */
  grabX: number;
  grabY: number;
  /** The group this gesture started on top of, or -1. */
  startCluster: number;
}

const RISE = 11;
const FALL = 4.2;
const RADIUS_SQ = PROBE_RADIUS * PROBE_RADIUS;
/** Seconds a refined packet takes to dissolve into its bin. */
const ABSORB_SECONDS = 0.45;
/** How long the digits take to fly from the grid into the box. Long
 *  enough to be watched, short enough that a refiner who already knows
 *  where the bin is never has to wait for it. */
const GATHER_SECONDS = 0.34;
/**
 * How far outside the packet frame still counts as touching it. A thumb
 * aiming at the box lands near its edge as often as inside it, and the
 * penalty for guessing wrong is dropping the group you just picked up.
 */
const PACKET_TOUCH_PAD = 16;
/**
 * A gesture open longer than this is not a finger. Nothing clears a
 * gesture but its own pointerup, and iOS drops those on interruptions —
 * after which `pointerDown`'s single-pointer guard refuses every touch and
 * the board is dead until the refiner happens to pause. This lets the next
 * touch take over instead.
 */
const STALE_GESTURE_MS = 4000;
/**
 * The file-change transition, in seconds. A CRT does not cut between
 * pictures: one scan pass takes the old one off and the next paints the
 * new one back on. Erasing is quicker than drawing because that is how it
 * reads — and because this runs between all twenty-nine orientation
 * screens, so every frame of it is a frame the refiner is waiting.
 */
const WIPE_OUT_S = 0.24;
const WIPE_IN_S = 0.44;
/**
 * How long an orientation screen's groups take to come up to full motion.
 *
 * They used to be at full amplitude on the first frame, which gives the
 * refiner nothing to notice — the anomaly is already there when the screen
 * arrives, so it is scenery rather than an event. Easing it in over two
 * seconds means the board is still, and then something on it starts to
 * move, which is the thing the whole sequence is teaching.
 */
const EMERGE_S = 2;
/**
 * Proximity at which a cluster counts as positively identified.
 *
 * The proximity curve is a smoothstep over R = 80px, so this threshold is
 * really a targeting tolerance: 0.9 means landing within ~16px of a member,
 * which on a ~25x16px cell is one specific glyph — aimed blind, 40px above
 * a fingertip. 0.55 widens it to ~37px, about one comfortable thumb
 * landing, without touching R or the 0..1 intensity ramp that feeds the
 * motion, the audio and the haptics.
 */
const LATCH_ENTER = 0.55;
/** Agitation a cluster must already carry before it can be lifted at all,
 *  by box or by tap. Below it the refiner has not identified anything and
 *  is guessing at the shape of the board. */
const ARM_SELECT_MIN_AGITATION = 0.22;
/** How close a touch must land to a glyph to count as being *on* its group,
 *  for both tap-to-lift and press-and-drag. */
const TAP_PAD = 22;
/** How far outside a group's live bounding box still counts as inside it.
 *  Roughly half a cell, so the whole visible footprint is tappable. */
const TAP_INSET = 12;
/** Residual agitation a latched cluster keeps once the finger lifts. */
const LATCH_FLOOR = 0.5;
/** Live proximity required at release for SELECT to auto-arm. */
const ARM_SELECT_AT = 0.5;
/** A probe shorter than this was a sweep, not a study. */
const ARM_SELECT_MIN_MS = 300;

export class GameEngine {
  board: Board;
  layout: StageLayout;
  atlas = new GlyphAtlas();

  phase: GamePhase = "briefing";
  mode: InputMode = "probe";
  levelIndex = 0;
  quota = 5;
  timeLeft = 0;
  totalTime = 0;
  elapsed = 0;

  bins: Record<Temper, BinState>;
  packet: Packet | null = null;
  /** A packet mid-dissolve into its bin. Purely cosmetic; the score is
   *  already banked by the time this exists. */
  absorb: {
    temper: Temper;
    digits: number[];
    x: number;
    y: number;
    tx: number;
    ty: number;
    t: number;
  } | null = null;

  /** `scale` is the lens's own lifecycle: 1 while a finger is down, held
   *  for `lensLingerS` after it lifts, then shrunk to 0 over
   *  `lensShrinkS`. A lens that vanished with the finger was never seen by
   *  the player who summoned it. */
  reticle = { x: 0, y: 0, active: false, scale: 1 };
  private lensHoldUntil = -1;
  marquee = { active: false, x0: 0, y0: 0, x1: 0, y1: 0 };
  hoverBin: Temper | null = null;

  /**
   * The cluster the refiner has positively identified. It keeps moving at a
   * reduced amplitude after the finger lifts, so there is time to switch to
   * SELECT and draw a box. Only ever one — finding is the game, re-finding
   * the same cluster three times is not.
   */
  latchedId = -1;
  /** Elapsed time at which the orientation file re-offers its hint, or -1
   *  when this file has no hint. Cleared once a packet is lifted. */
  private orientHintAt = -1;
  /** Seconds at which the pulse file's next reveal may begin, and when the
   *  current reveal ends. Both -1 when this file has no pulse. */
  private pulseNextAt = -1;
  private pulseUntil = -1;
  /** Elapsed time of the last touch, for the pulse's tap cooldown. */
  private lastTouchAt = -1e9;
  /** The temper the fifth borrows: whichever was last refined. */
  private lastRefined: Temper = "WO";
  /** Elapsed time at which a finished no-ceremony screen advances. */
  private advanceAt = -1;
  /** The player's own audio setting, held while a file redacts it. */
  private mutedBeforeRedaction: boolean | null = null;
  /** Elapsed time the current packet was lifted, so the bin hint can wait
   *  for hesitation rather than nagging a player who already knows. */
  packetHeldAt = 0;

  /** Cluster ids currently pulsing from a rejected drop. */
  glitchUntil = 0;
  message: { text: string; kind: "praise" | "error" | "info" } | null = null;
  private messageScope: MessageScope = "sticky";
  /** Per-cluster agitation as it stood the instant the finger landed. */
  private agitationAtDown: number[] = [];
  /** The scan pass between two files: "out" erases, "in" paints. */
  wipe: { phase: "out" | "in"; t: number } | null = null;
  private pendingLevel = -1;
  /** Elapsed time at which this file's groups begin to move. */
  private emergeAt = 0;

  private gesture: Gesture | null = null;
  private lastTapAt = 0;
  private lastTapX = 0;
  private lastTapY = 0;

  private gridCanvas: HTMLCanvasElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private gridCtx: CanvasRenderingContext2D | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private lastFrame = 0;
  /** Device pixel ratio the canvases are sized at; read by the renderer. */
  dpr = 1;
  private running = false;
  private disposed = false;
  /** False until a real measurement has sized the canvases. */
  private sized = false;

  private listeners = new Set<Listener>();
  private snapshot: HudSnapshot;
  private snapshotDirty = true;
  /** Reused each frame so the hot loop allocates nothing. */
  private peak: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  /** The tempers this file uses — one, two or all four. */
  get activeTempers(): readonly Temper[] {
    return LEVELS[this.levelIndex].tempers;
  }
  private snapshotAt = 0;
  private nextTockAt = 0;

  /** True while a modal owns the screen. The shift clock stops, the drones
   *  stop, and input is ignored — reading the handbook must not cost you
   *  the file. */
  paused = false;
  private pausedSilenced = false;
  muted = false;
  hapticsOn = true;
  /** Accessibility aid: paint agitated clusters in their temper colour. */
  assist = false;
  /** Shift length. See PACE — the brief's 90-120s is `standard`. */
  pace: Pace = "extended";

  constructor() {
    this.layout = computeLayout(360, 640);
    this.board = createBoard(
      LEVELS[0].seed,
      LEVELS[0].tempers,
      LEVELS[0].quota + LEVELS[0].spare,
      LEVELS[0].spacing,
    );
    this.bins = this.freshBins();

    const saved = loadSettings();
    this.pace = saved.pace;
    this.muted = saved.muted;
    this.hapticsOn = saved.hapticsOn;
    this.assist = saved.assist;
    haptics.setEnabled(saved.hapticsOn);
    // Push the restored mute into the audio singleton now: it only creates
    // an AudioContext on unlock, so this is just a flag, but without it a
    // restored mute would not apply until the player toggled something.
    getAudio().setMuted(saved.muted);

    this.snapshot = this.buildSnapshot();
  }

  /** The player's own audio setting, which is not the same thing as whether
   *  audio is on right now: a redacted file forces mute for its duration. */
  private get preferredMuted(): boolean {
    return this.mutedBeforeRedaction ?? this.muted;
  }

  private persist(): void {
    saveSettings({
      pace: this.pace,
      // Never `this.muted`: changing any other setting during a redacted
      // file would otherwise write that file's forced mute to storage, and
      // the restore afterwards is in memory only — the terminal would come
      // back silent on the next visit with nothing to explain it.
      muted: this.preferredMuted,
      hapticsOn: this.hapticsOn,
      assist: this.assist,
    });
  }

  // ── lifecycle ───────────────────────────────────────────────────────

  attach(grid: HTMLCanvasElement, overlay: HTMLCanvasElement): void {
    // React StrictMode mounts, unmounts and remounts in development, so
    // attach must be able to revive an engine that dispose() shut down.
    this.disposed = false;
    this.gridCanvas = grid;
    this.overlayCanvas = overlay;
    this.gridCtx = grid.getContext("2d", { alpha: false });
    this.overlayCtx = overlay.getContext("2d");
    this.start();
  }

  detach(): void {
    this.stop();
    // A re-attach may hand us fresh canvas elements with default backing
    // stores, so the next resize must not be short-circuited.
    this.sized = false;
    this.gridCanvas = null;
    this.overlayCanvas = null;
    this.gridCtx = null;
    this.overlayCtx = null;
  }

  private start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Called by the host when the tab is hidden/shown. */
  setPageVisible(visible: boolean): void {
    if (visible) {
      this.lastFrame = performance.now();
      this.start();
    } else {
      this.stop();
      this.releaseGesture();
      getAudio().silenceAll();
      haptics.cancel();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.listeners.clear();
    // The AudioEngine is a page-lifetime singleton whose gains are only
    // ever moved from inside the loop. Stopping the loop with a drone at
    // full gain would leave it sounding forever.
    getAudio().hardStop();
    haptics.cancel();
  }

  // ── React bridge ────────────────────────────────────────────────────

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): HudSnapshot => this.snapshot;

  private emit(force = false): void {
    const now = performance.now();
    // The HUD only needs ~11 Hz; the canvas carries the 60 Hz information.
    if (!force && !this.snapshotDirty && now - this.snapshotAt < 90) return;
    this.snapshotAt = now;
    this.snapshotDirty = false;
    const next = this.buildSnapshot();
    // useSyncExternalStore compares by reference, so handing it a fresh
    // object every 90ms would re-render the whole chrome forever — on the
    // briefing screen, on the fail screen, on the completion screen, where
    // nothing is moving at all. Keep the old object when nothing changed.
    if (!force && sameSnapshot(this.snapshot, next)) return;
    this.snapshot = next;
    for (const fn of this.listeners) fn();
  }

  private buildSnapshot(): HudSnapshot {
    const level = LEVELS[this.levelIndex];
    const bins: BinView[] = level.tempers.map((t) => {
      const b = this.bins[t];
      const fresh = this.elapsed - b.lastHitAt < 0.5;
      return {
        temper: t,
        fill: b.fill,
        // Where this packet is meant to go. Only on the files that already
        // show the arrows — a single bin on the deck, so it points at the
        // one place a packet can land and gives nothing away.
        target: level.binHint === true && this.packet?.temper === t,
        hit: fresh ? (b.lastHitOk ? 1 : -1) : 0,
        hover: this.hoverBin === t,
      };
    });
    const progress =
      bins.reduce((sum, b) => sum + Math.min(1, b.fill), 0) /
      Math.max(1, bins.length);
    return {
      phase: this.phase,
      paused: this.paused,
      mode: this.mode,
      levelIndex: this.levelIndex,
      levelName: level.name,
      fileCode: level.fileCode,
      timeLeft: Math.max(0, this.timeLeft),
      totalTime: this.totalTime,
      progress,
      bins,
      carrying: this.packet !== null,
      message: this.message?.text ?? null,
      messageKind: this.message?.kind ?? null,
      glitch: this.elapsed < this.glitchUntil,
      audioReady: getAudio().isReady,
      muted: this.muted,
      hapticsOn: this.hapticsOn && haptics.supported,
      assist: this.assist,
      pace: this.pace,
      untimed: level.untimed === true,
      // The overlay needs this: `checkCompletion` sets phase "complete" for
      // the auto-advance window too, and without it the orientation screens
      // each flash a 100% banner, an addendum and a NEXT FILE button for
      // 900ms — the twenty-one interruptions the sequence exists to avoid.
      ceremony: level.ceremony ?? "full",
      teaching: level.teaches === true,
      activeTempers: level.tempers,
      stage: level.stage ?? null,
      lore: level.lore,
      isLastLevel: this.levelIndex >= LEVELS.length - 1,
    };
  }

  private freshBins(): Record<Temper, BinState> {
    const bins = {} as Record<Temper, BinState>;
    for (const t of TEMPERS) {
      bins[t] = { temper: t, fill: 0, lastHitAt: -10, lastHitOk: true };
    }
    return bins;
  }

  // ── level control ───────────────────────────────────────────────────

  startLevel(index: number): void {
    // Also a revival point: the tap self-heal lives on the input surface,
    // which a full-screen overlay covers, so BEGIN SHIFT / RETRY FILE must
    // be able to restart a loop that died while an overlay was up.
    if (!this.running && !this.disposed) this.start();
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, index));
    const level = LEVELS[clamped];
    this.levelIndex = clamped;
    this.board = createBoard(
      level.seed,
      level.tempers,
      level.quota + level.spare,
      level.spacing,
      boardExtras(level),
      level.focus ?? null,
    );

    // If the board saturated before every cluster was placed, lower the
    // quota to what actually exists so a file is always completable.
    const counts: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
    // Decoys and the fifth temper occupy the board but fill no bin, so they
    // must never count towards a temper having enough clusters.
    const tally = () => {
      for (const t of TEMPERS) counts[t] = 0;
      for (const c of this.board.clusters) {
        if (!c.decoy && !c.fifth) counts[c.temper]++;
      }
    };
    tally();
    const active = level.tempers;
    // A temper with no clusters means a bin that can never fill, so a
    // saturated board is re-seeded rather than clamped. Flooring the quota
    // at 1 would ship exactly the uncompletable file this guard exists to
    // prevent, so the loop keeps trying fresh seeds instead.
    let scarcest = Math.min(...active.map((t) => counts[t]));
    for (let attempt = 1; scarcest <= 0 && attempt <= 8; attempt++) {
      this.board = createBoard(
        (level.seed + attempt * 0x9e37) >>> 0,
        level.tempers,
        level.quota + level.spare,
        level.spacing,
        boardExtras(level),
        level.focus ?? null,
      );
      tally();
      scarcest = Math.min(...active.map((t) => counts[t]));
    }
    this.quota = Math.max(1, Math.min(level.quota, scarcest));
    // Every temper must be able to reach 100%: if the board saturated
    // badly enough that some temper has fewer clusters than the quota, the
    // quota drops for all four rather than leaving one bin unfillable.

    this.bins = this.freshBins();
    this.packet = null;
    this.absorb = null;
    this.marquee.active = false;
    this.hoverBin = null;
    this.mode = level.startMode ?? "probe";
    this.paused = false;
    this.pausedSilenced = false;
    const seconds = level.untimed
      ? Infinity
      : level.seconds * PACE[this.pace].scale;
    this.totalTime = seconds;
    this.timeLeft = seconds;
    this.elapsed = 0;
    this.latchedId = -1;
    this.glitchUntil = 0;
    this.nextTockAt = level.untimed ? -1 : 10;
    this.phase = "probe";
    this.releaseGesture();
    this.refreshLayout();
    this.orientHintAt = level.selfAgitate === true ? 13 : -1;
    this.advanceAt = -1;
    this.lensHoldUntil = -1;
    this.reticle.scale = 1;
    this.lastTouchAt = -1e9;
    this.lastTapAt = 0;
    // The pulse starts hidden: the first thing the file does is nothing,
    // which is the point — the group has to be missed before it surfaces.
    this.pulseNextAt = level.pulse ? level.pulse.hiddenS : -1;
    this.pulseUntil = -1;
    this.applyRedaction(level.redact === "audio");
    this.lastRefined = level.tempers[0];
    assignMorphs(this.board, level);
    if (level.selfAgitate) {
      // The generic "FILE LOADED" line teaches nothing to someone who does
      // not yet know the matrix hides anything.
      this.say("ONE GROUP IS ALREADY MOVING. BOX IT.", "info", "untilAction");
    } else {
      this.say(`FILE ${level.name} #${level.fileCode} LOADED`, "info");
    }
    getAudio().fileLoaded();
    // The new picture is painted on by the same scan pass that took the old
    // one off, and the groups only start moving once it has finished — a
    // group that emerges while the screen is still arriving is lost in it.
    this.wipe = { phase: "in", t: 0 };
    this.emergeAt = WIPE_IN_S;
    this.emit(true);
  }

  /**
   * How far into its motion this file's groups are, 0..1.
   *
   * Only orientation uses it: those screens have no probe, so the motion is
   * the entire signal and it needs a moment where the board is plainly
   * still first. Everywhere else agitation answers to a finger.
   */
  get emergence(): number {
    const t = (this.elapsed - this.emergeAt) / EMERGE_S;
    return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  }

  /**
   * Whether the file has finished arriving and is fully in play — the scan
   * pass is done and, on a teaching screen, the groups are up to speed.
   * The tests wait on this rather than on a fixed delay, so a change to
   * either timing moves them with it.
   */
  get settled(): boolean {
    if (this.wipe) return false;
    if (LEVELS[this.levelIndex].selfAgitate !== true) return true;
    return this.emergence >= 0.999;
  }

  nextLevel(): void {
    // Deferred: the old file has to be taken off the screen before the new
    // one can be put on it. `startLevel` runs when the erasing pass ends.
    if (this.wipe?.phase === "out") return;
    this.pendingLevel = this.levelIndex + 1;
    this.wipe = { phase: "out", t: 0 };
  }

  restart(): void {
    this.startLevel(this.levelIndex);
  }

  /** Back to the first file of a fresh quarter. */
  restartQuarter(): void {
    this.startLevel(0);
  }

  setMode(mode: InputMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    // Abandon any gesture in flight. Clearing only `marquee.active` left the
    // gesture alive as kind "marquee", so a box made invisible by a
    // second-finger tap on the mode switch still resolved into a packet on
    // release — a selection the player could not see.
    this.releaseGesture();
    getAudio().click();
    // Release first: a second finger tapping the deck mid-probe otherwise
    // leaves an ambient owner set, and the next frame's cancel() kills this
    // click's haptic.
    haptics.releaseProximity();
    haptics.tap();
    this.snapshotDirty = true;
    this.emit(true);
  }

  toggleMode(): void {
    this.setMode(this.mode === "probe" ? "select" : "probe");
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    // A deliberate choice made during a redacted file wins: there is now
    // nothing to restore, or restoring would overwrite what the player just
    // asked for.
    this.mutedBeforeRedaction = null;
    getAudio().setMuted(muted);
    this.persist();
    this.snapshotDirty = true;
    this.emit(true);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.releaseGesture();
      getAudio().silenceAll();
      haptics.releaseProximity();
      haptics.cancel();
    }
    this.snapshotDirty = true;
    this.emit(true);
  }

  setPace(pace: Pace): void {
    if (this.pace === pace) return;
    this.pace = pace;
    // Applies from the next file; rescaling a clock mid-shift would either
    // gift or steal time depending on which way it moved.
    getAudio().click();
    this.say(`SHIFT LENGTH: ${PACE[pace].label} — FROM THE NEXT FILE`, "info");
    this.persist();
    this.snapshotDirty = true;
    this.emit(true);
  }

  setAssist(on: boolean): void {
    this.assist = on;
    this.persist();
    this.snapshotDirty = true;
    this.emit(true);
  }

  setHaptics(on: boolean): void {
    this.hapticsOn = on;
    haptics.setEnabled(on);
    this.persist();
    this.snapshotDirty = true;
    this.emit(true);
  }

  /**
   * A file that takes the voices away, and gives them back. The player's own
   * setting is stashed and restored: a teaching file must never silently
   * change a preference the refiner set for themselves.
   */
  /**
   * The reveal/hide cycle of the file that introduces the probe, as a 0..1
   * envelope on cluster agitation.
   *
   * The next reveal is gated on *both* the quiet gap since the last one and
   * a cooldown since the refiner last touched the board, so a group never
   * surfaces underneath a finger that is already down — which would teach
   * exactly the wrong lesson about what the finger is for.
   */
  private pulseEnvelope(p: PulseDef): number {
    if (this.elapsed >= this.pulseUntil) {
      // Not revealing. Should the next one start?
      const ready = Math.max(this.pulseNextAt, this.lastTouchAt + p.tapCooldownS);
      if (this.elapsed >= ready) {
        this.pulseUntil = this.elapsed + p.revealS;
        this.pulseNextAt = this.pulseUntil + p.hiddenS;
      } else {
        return 0;
      }
    }
    const into = this.elapsed - (this.pulseUntil - p.revealS);
    const left = this.pulseUntil - this.elapsed;
    // Ramped at both ends: a hard cut reads as a rendering glitch rather
    // than as something surfacing.
    const ramp = p.rampS > 0 ? Math.min(1, into / p.rampS, left / p.rampS) : 1;
    return Math.max(0, Math.min(1, ramp)) * p.subtlety;
  }

  private applyRedaction(on: boolean): void {
    if (on) {
      if (this.mutedBeforeRedaction === null) {
        this.mutedBeforeRedaction = this.muted;
      }
      this.muted = true;
    } else if (this.mutedBeforeRedaction !== null) {
      this.muted = this.mutedBeforeRedaction;
      this.mutedBeforeRedaction = null;
    }
    getAudio().setMuted(this.muted);
  }

  /**
   * The coach line does not tick away. A message stays on screen until
   * something replaces it, because a line that vanishes on a timer is a
   * line the refiner has to have been looking at. What it may not do is
   * outlive its own subject: "DROP INTO A BIN" is a lie once nothing is
   * held. Each message therefore carries the state it describes, and the
   * band goes blank — not stale — when that state ends.
   */
  private say(
    text: string,
    kind: "praise" | "error" | "info",
    scope: MessageScope = "sticky",
  ): void {
    this.message = { text, kind };
    this.messageScope = scope;
    this.snapshotDirty = true;
  }

  /** True once the message on screen is describing something that is over. */
  private messageIsStale(): boolean {
    switch (this.messageScope) {
      case "untilPacket":
        return this.packet !== null;
      case "untilDropped":
        return this.packet === null;
      case "untilAction":
        return (
          this.packet !== null || this.board.clusters.some((c) => c.refined)
        );
      default:
        return false;
    }
  }

  private clearMessage(): void {
    if (!this.message) return;
    this.message = null;
    this.messageScope = "sticky";
    this.snapshotDirty = true;
  }

  // ── sizing ──────────────────────────────────────────────────────────

  resize(w: number, h: number, dpr: number): void {
    if (w <= 0 || h <= 0) return;
    const nextDpr = Math.min(dpr || 1, 2.5);
    // iOS fires visualViewport scroll whenever the URL bar settles, which
    // is routinely just after a touch. Without this guard every such event
    // ran a full relayout and cancelled any dissolve or scatter in flight,
    // for a viewport change that never happened.
    //
    // `sized` is what stops the constructor's placeholder layout from
    // satisfying that comparison: a stage measuring exactly 360x640 at DPR
    // 1 — which is exact 9:16, and a stock device preset — would otherwise
    // match on the very first call and leave both canvases on the 300x150
    // HTML default, stretched over the stage.
    if (
      this.sized &&
      w === this.layout.w &&
      h === this.layout.h &&
      nextDpr === this.dpr
    ) {
      return;
    }
    this.sized = true;
    this.dpr = nextDpr;
    this.layout = computeLayout(w, h, this.activeTempers);
    this.relayout();

    for (const canvas of [this.gridCanvas, this.overlayCanvas]) {
      if (!canvas) continue;
      const pw = Math.round(w * this.dpr);
      const ph = Math.round(h * this.dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
    }
    // setTransform (not scale) so repeated resizes never compound.
    this.gridCtx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.overlayCtx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Both animations are anchored to absolute stage coordinates that
    // relayout has just invalidated. Finish them rather than send them to
    // a point that no longer means anything.
    this.absorb = null;
    for (const n of this.board.nodes) {
      if (n.scatter > 0) n.scatter = 0;
    }
    if (this.packet) {
      this.packet.x = Math.min(this.layout.w, Math.max(0, this.packet.x));
      this.packet.y = Math.min(this.layout.h, Math.max(0, this.packet.y));
    }
  }

  /** Rebuild stage geometry. Must run on a level change as well as a
   *  resize: the number of bins is a property of the file, not the screen. */
  private refreshLayout(): void {
    this.layout = computeLayout(this.layout.w, this.layout.h, this.activeTempers);
    this.relayout();
  }

  private relayout(): void {
    const g = this.layout.grid;
    const padX = Math.max(6, g.w * 0.035);
    const padY = Math.max(6, g.h * 0.022);
    const { cellH } = layoutBoard(this.board, g, padX, padY);
    this.layout.fontPx = Math.max(9, Math.min(cellH * 0.82, (g.w / COLS) * 0.9));
    this.atlas.build(Math.round(this.layout.fontPx), this.dpr);
  }

  // ── input ───────────────────────────────────────────────────────────

  /**
   * The reticle sits ~40px above the contact point so the thumb never hides
   * it while probing the matrix, and the offset tapers to zero as the
   * finger nears the bottom of the grid.
   *
   * The taper has to finish *at the grid's own bottom edge*, not lower down
   * at the bins. The control deck sits above the input surface so it can
   * take its own taps, which means a touch on the deck never reaches the
   * board at all — so if the offset were still -40px at the last row of the
   * matrix, the bottom 40px of the grid (two whole rows) could not be
   * probed or boxed by any touch the game can receive. Below the grid the
   * offset stays zero, which is what keeps every bin reachable.
   *
   * Monotonic in y throughout, so dragging downward always moves the
   * reticle downward.
   */
  private reticleFor(
    x: number,
    y: number,
    kind: Gesture["kind"] = "probe",
  ): { x: number; y: number } {
    const l = this.layout;
    // The 68px lift exists so a 36px lens clears the thumb. A marquee
    // corner is a hairline with nothing to hide behind it, and lifting it
    // that far put the box well above the finger drawing it — so selection
    // gets its own, much smaller offset.
    // Only the lens needs the big lift, because the lens is the thing being
    // looked at. A marquee corner and a carried packet both want to sit
    // just clear of the contact patch: lifting the packet a lens-height put
    // it well above the thumb dragging it, which reads as the box escaping
    // the hand.
    const base = kind === "probe" ? RETICLE_OFFSET_Y : MARQUEE_OFFSET_Y;
    const taperEnd = l.grid.y + l.grid.h;
    const band = Math.max(l.deckH, Math.abs(base) + 16);
    const taperStart = taperEnd - band;
    let offset = base;
    if (y >= taperEnd) {
      offset = 0;
    } else if (y > taperStart) {
      offset = base * (1 - (y - taperStart) / band);
    }
    return {
      x: Math.max(0, Math.min(l.w, x)),
      y: Math.max(0, Math.min(l.h, y + offset)),
    };
  }

  /**
   * Marquee corners are pinned to the board. Dragging past an edge should
   * sweep the edge, the way it does in every drawing tool — not stop short
   * of the outermost digits or wander off over the chrome.
   */
  private clampToBoard(p: { x: number; y: number }): { x: number; y: number } {
    const g = this.layout.grid;
    const m = 16; // generous enough to enclose a drooping or bursting glyph
    return {
      x: Math.max(g.x - m, Math.min(g.x + g.w + m, p.x)),
      y: Math.max(g.y - m, Math.min(g.y + g.h + m, p.y)),
    };
  }

  /** Put a carried packet's digits back on the grid, unrefined. */
  private returnPacketToGrid(): void {
    const packet = this.packet;
    if (!packet) return;
    const cluster = this.board.clusters[packet.clusterId];
    for (const i of cluster.members) {
      const n = this.board.nodes[i];
      n.lifted = false;
      n.scatter = 1;
      n.sx = packet.x + (this.board.rng() - 0.5) * 60;
      n.sy = packet.y + (this.board.rng() - 0.5) * 60;
    }
    cluster.agitation = 0;
    if (this.latchedId === cluster.id) this.latchedId = -1;
    this.packet = null;
  }

  /**
   * Whether a tap on a group lifts it.
   *
   * On by default. It was an orientation-only affordance, which meant the
   * gesture the first twenty-nine screens spend their whole length
   * teaching stopped working the moment training ended, silently. The
   * agitation gate is what protects the probe mechanic — a tap on a group
   * nobody has found yet is refused and says so — not the absence of the
   * gesture.
   */
  private get tapToSelect(): boolean {
    return LEVELS[this.levelIndex].tapToSelect ?? true;
  }

  private isLive(): boolean {
    if (this.paused) return false;
    return (
      this.phase === "probe" || this.phase === "select" || this.phase === "carry"
    );
  }

  /**
   * Whether a touch should be accepted at all.
   *
   * An orientation screen that finished holds phase "complete" for the
   * 900ms auto-advance, and deliberately draws no scrim — so for nearly a
   * second the board looks completely live and every pointer event was
   * thrown away. A refiner tapping briskly through orientation lost one
   * tap per screen, which is exactly the "sometimes I have to tap twice"
   * report. There is nothing on that board left to break, so let the touch
   * through: it can only start a gesture that the level change releases.
   */
  private acceptsInput(): boolean {
    if (this.paused) return false;
    return this.isLive() || this.advanceAt >= 0 || this.wipe !== null;
  }

  pointerDown(id: number, x: number, y: number): void {
    void getAudio().unlock();
    haptics.markActivated();
    // A tap always revives the terminal. bfcache restores do not reliably
    // fire visibilitychange on iOS, and a frozen loop with no way back is
    // indistinguishable from a crash.
    if (!this.running && !this.disposed) this.start();
    if (!this.acceptsInput()) return;
    // Strictly single-pointer: a second finger is ignored outright rather
    // than being allowed to hijack the in-flight gesture. A gesture that
    // has been open impossibly long is not a finger, though — it is one
    // that leaked, and refusing every touch behind it bricks the board.
    if (this.gesture) {
      // ...unless the one in flight is doing nothing. A thumb resting on
      // the bezel of a phone held one-handed opens a gesture and never
      // uses it, and every tap behind it was being discarded in silence.
      //
      // Doing nothing means all three: it has not moved, so it is not a
      // drag; it did not land on a group, so it is not a press about to
      // become one; and nothing is being carried, so it is not a hand on
      // the box. Anything else is a real gesture and is never interrupted
      // — only the four-second staleness rule can take one of those, and
      // by then no finger is still down.
      const g = this.gesture;
      const stale = performance.now() - g.startT >= STALE_GESTURE_MS;
      const idle = !g.moved && g.startCluster < 0 && !this.packet;
      if (!stale && !idle) return;
      this.releaseGesture();
    }

    // A line that reports how the last attempt went stops being true the
    // moment a new attempt begins. Nothing takes its place yet — the band
    // simply goes quiet until this touch produces its own outcome.
    if (this.messageScope === "attempt") this.clearMessage();

    // What every group was doing before this finger landed. A tap is its
    // own probe — 60ms of contact is enough to agitate a cluster past the
    // lift threshold — so judging a tap by the agitation it caused would
    // let blind tapping lift a group the refiner never found. Recorded per
    // cluster rather than for one guessed cluster, because the group the
    // touch turns out to be on is not always the one nearest at the start.
    this.agitationAtDown.length = 0;
    for (const c of this.board.clusters) this.agitationAtDown[c.id] = c.agitation;

    let kind: Gesture["kind"] = this.packet
      ? "carry"
      : this.mode === "select"
        ? "marquee"
        : "probe";

    // ── a held packet decides what this touch is ──────────────────────
    let recentre = false;
    if (this.packet) {
      const b = this.packetBounds(this.packet);
      const m = PACKET_TOUCH_PAD;
      const onBox =
        x >= b.x - m && x <= b.x + b.w + m && y >= b.y - m && y <= b.y + b.h + m;
      if (onBox) {
        // Touching the box does not put it down. It takes hold of it
        // again, squarely, and waits to be dragged.
        recentre = true;
      } else if (!this.binAt(x, y)) {
        // Touching anywhere else on the board lets the numbers go. They
        // fly back to the cells they came from and can be taken again.
        // A bin is the exception: dropping into one is the whole point.
        this.releasePacket();
        kind = this.mode === "select" ? "marquee" : "probe";
      }
    }

    const r = this.reticleFor(x, y, kind);
    const start = this.tapTarget(x, y, r);
    this.lastTouchAt = this.elapsed;
    this.lensHoldUntil = -1;
    this.reticle.scale = 1;

    this.gesture = {
      id,
      kind,
      startX: x,
      startY: y,
      startT: performance.now(),
      x,
      y,
      moved: false,
      latchedDuring: -1,
      startAgitation: start?.cluster.agitation ?? 0,
      startCluster: start && start.dist <= TAP_PAD ? start.cluster.id : -1,
      ...(recentre ? { grabX: 0, grabY: 0 } : this.grabOffset(r)),
    };

    this.reticle.x = r.x;
    this.reticle.y = r.y;
    this.reticle.active = true;

    if (kind === "marquee") {
      const b = this.clampToBoard(r);
      this.marquee.active = true;
      this.marquee.x0 = b.x;
      this.marquee.y0 = b.y;
      this.marquee.x1 = b.x;
      this.marquee.y1 = b.y;
    } else if (kind === "carry" && this.packet) {
      // Only when the box was actually grabbed, or when the touch is over a
      // bin and is therefore a drop. Snapping it unconditionally moved the
      // box before the finger did — the leap this offset exists to prevent.
      if (recentre || this.binAt(x, y)) {
        this.packet.x = r.x;
        this.packet.y = r.y;
      }
    }
    this.snapshotDirty = true;
  }

  pointerMove(id: number, x: number, y: number): void {
    const g = this.gesture;
    if (!g || g.id !== id) return;
    if (Math.hypot(x - g.startX, y - g.startY) > TAP_SLOP) g.moved = true;
    g.x = x;
    g.y = y;

    // The gesture in flight decides the offset. Defaulting to "probe" here
    // anchored a marquee's first corner at -22 and dragged its second at
    // -68, skewing every box by 46px and collapsing most selections.
    const r = this.reticleFor(x, y, g.kind);
    this.reticle.x = r.x;
    this.reticle.y = r.y;

    // Press on a group and drag, and you are carrying it — no box, no
    // second gesture. Starting on empty board still draws a marquee, which
    // is the same rule every selection surface uses and leaves boxing
    // available for the groups a single grab cannot take.
    if (
      g.kind !== "carry" &&
      g.moved &&
      !this.packet &&
      g.startCluster >= 0 &&
      g.startAgitation >= ARM_SELECT_MIN_AGITATION &&
      this.tapToSelect
    ) {
      const c = this.board.clusters[g.startCluster];
      if (c && !c.refined && !c.decoy) {
        this.marquee.active = false;
        const held = this.liftCluster(c, r.x, r.y);
        g.kind = "carry";
        // Derived from the reticle the *next* move will use, not assumed to
        // be zero: the gesture changes kind mid-drag, and if the two kinds
        // ever carry different offsets again the packet would jump by the
        // difference on the very next frame.
        const carried = this.reticleFor(x, y, "carry");
        g.grabX = held.x - carried.x;
        g.grabY = held.y - carried.y;
      }
    }

    if (g.kind === "marquee") {
      const b = this.clampToBoard(r);
      this.marquee.x1 = b.x;
      this.marquee.y1 = b.y;
    } else if (g.kind === "carry" && this.packet) {
      this.packet.x = r.x + g.grabX;
      this.packet.y = r.y + g.grabY;
      // The drop lands where the packet is, not where the reticle is —
      // otherwise the box and the thing it is being tested against are in
      // two different places.
      const bin = this.binAt(this.packet.x, this.packet.y);
      if (bin !== this.hoverBin) {
        this.hoverBin = bin;
        if (bin) haptics.tap();
        this.snapshotDirty = true;
      }
    }
  }

  pointerUp(id: number, x: number, y: number): void {
    const g = this.gesture;
    if (!g || g.id !== id) return;
    const dt = performance.now() - g.startT;
    // A tap is a finger that came down and went up in the same place. Not
    // a *fast* finger: a considered press — thumb down, "is this the
    // group?", lift — routinely runs past 250ms, and a still hand on a
    // phone drifts 15px and comes back. Both used to resolve to nothing at
    // all. Duration and the sticky moved flag still gate the double-tap
    // toggle, which genuinely is a quick gesture.
    const net = Math.hypot(x - g.startX, y - g.startY);
    const isTap = net <= TAP_SLOP;
    const isQuickTap = isTap && !g.moved && dt < TAP_MAX_MS;
    // Captured before the dispatch below, because resolveDrop can empty the
    // hand — after which the tap-lift branch would see no packet and try to
    // lift whatever sits under the drop point.
    const hadPacket = this.packet !== null;

    if (g.kind === "marquee") {
      // A tap is the mode-toggle gesture, not a zero-area selection: without
      // this, double-tapping back to PROBE resolves an empty marquee twice
      // and buzzes at you on the way out.
      if (!isTap) this.resolveMarquee();
    } else if (g.kind === "carry" && this.packet) {
      this.resolveDrop({ x: this.packet.x, y: this.packet.y });
    } else if (g.kind === "probe") {
      this.armSelectIfIdentified(g, dt);
    }

    // A tap on a group takes the whole group. Drag-to-box is not a
    // discoverable gesture on its own — playtesting found people tapping
    // the digits and nothing happening — so on the teaching screens the
    // instinct is simply honoured. Tried before registerTap, since a
    // successful lift is not a mode toggle.
    //
    // It must NOT return early: everything below releases the gesture, and
    // `pointerDown` ignores a new pointer while one is in flight. Returning
    // here left the gesture open forever, so the very next touch — the one
    // dragging the packet you just lifted — was discarded as a second
    // finger and the board went dead.
    let tapHandled = false;
    const aim = isTap ? this.tapTarget(x, y, this.reticleFor(x, y, g.kind)) : null;
    if (isTap && !hadPacket && this.tapToSelect) {
      tapHandled = this.tapLift(aim);
      // The group is moving, and the finger is not. Woe droops, frolic
      // skips, malice lunges — and a group can walk out of its own tap pad
      // while a thumb rests on it deciding. Measured: a tap 10px above a
      // group fails 2.8% of the time at 60ms and 11.7% at 1200ms, silently,
      // because by the time the finger lifts the digits are elsewhere.
      //
      // The gesture already recorded what it landed on. What you touched is
      // what you meant, whatever it did in the meantime.
      if (!tapHandled) tapHandled = this.tapLiftStart(g);
    }

    // The mode toggle only ever listens to taps on open board. Two taps
    // that missed a group used to flip an orientation screen — which has
    // no probe at all — into PROBE mode, where the offset jumps another
    // 46px and the press-drag conversion stops working. Two near misses
    // and the file was unplayable. The near-miss guard is wider than the
    // tap pad because a tap that missed by 26px was still aimed at the
    // group, not at the board.
    const onGroup = aim !== null && aim.dist <= TAP_PAD + TAP_INSET;
    if (isQuickTap && !tapHandled && !onGroup) {
      this.registerTap(g.startX, g.startY);
    }

    this.gesture = null;
    this.lastTouchAt = this.elapsed;
    // On the file that introduces the lens, it does not vanish with the
    // finger: it holds, then shrinks. A tool the player never got to look
    // at cannot teach them it is a tool.
    const linger = LEVELS[this.levelIndex].lensLingerS ?? 0;
    if (g.kind === "probe" && linger > 0 && !this.packet) {
      this.lensHoldUntil = this.elapsed + linger;
    } else {
      this.reticle.active = false;
    }
    this.marquee.active = false;
    this.hoverBin = null;
    getAudio().silenceAll();
    haptics.releaseProximity();
    this.snapshotDirty = true;
  }

  /** `id` of -1 cancels whatever is in flight, whatever its pointer id —
   *  for the ways a gesture ends that carry no pointer with them. */
  pointerCancel(id: number): void {
    const g = this.gesture;
    if (!g || (id !== -1 && g.id !== id)) return;
    // A cancelled gesture is still a finger that was on the board. Without
    // this the pulse's tap cooldown stays un-rearmed and a reveal can fire
    // straight into the touch that was just interrupted.
    this.lastTouchAt = this.elapsed;
    // Cancelled mid-drag (system gesture, call, notch swipe): abandon the
    // selection but never lose the packet — it stays carried.
    this.gesture = null;
    this.lensHoldUntil = -1;
    this.reticle.active = false;
    this.marquee.active = false;
    this.hoverBin = null;
    getAudio().silenceAll();
    haptics.cancel();
    this.snapshotDirty = true;
  }

  /**
   * Lifting a finger off a cluster you have just identified arms SELECT.
   *
   * The three-phase loop otherwise costs a whole extra deliberate gesture
   * per packet, twenty times a file, against a 90-120s clock. Double-tap
   * and the SELECT switch both still work — this only removes the need to
   * use one on the fast path. Gated on *live* proximity rather than the
   * latch, so lifting a finger somewhere empty never arms anything.
   */
  private armSelectIfIdentified(g: Gesture, durationMs: number): void {
    if (this.packet || this.mode === "select") return;
    // Only a deliberate study arms the box: the cluster must have been
    // identified during this very gesture, the finger must still be on it
    // at release, and the probe must have lasted long enough to actually
    // read the motion. Brushing past a cluster mid-sweep does not count.
    if (g.latchedDuring < 0 || g.latchedDuring !== this.latchedId) return;
    if (durationMs < ARM_SELECT_MIN_MS) return;
    const cluster = this.board.clusters[this.latchedId];
    if (!cluster || cluster.refined) return;
    if (cluster.probe < ARM_SELECT_AT) return;
    this.mode = "select";
    getAudio().click();
    haptics.tap();
    this.say("TEMPER DETECTED — DRAW A SELECTION", "info", "untilPacket");
    this.snapshotDirty = true;
  }

  private releaseGesture(): void {
    this.gesture = null;
    this.lensHoldUntil = -1;
    this.reticle.active = false;
    this.marquee.active = false;
    this.hoverBin = null;
  }

  private registerTap(x: number, y: number): void {
    // On a file whose groups move by themselves there is nothing for the
    // lens to find, so PROBE is a mode that does nothing — and switching
    // into it also moves the aim another 46px and stops press-and-drag
    // working. Two taps that missed a group by a hair were enough to put
    // an orientation screen there, silently, and it read as the board
    // having died. A shortcut to a mode with no purpose is not a shortcut.
    if (LEVELS[this.levelIndex].selfAgitate === true) return;
    const now = performance.now();
    const near = Math.hypot(x - this.lastTapX, y - this.lastTapY) < TAP_SLOP * 3;
    if (now - this.lastTapAt < DOUBLE_TAP_MS && near) {
      this.lastTapAt = 0;
      if (!this.packet) this.toggleMode();
      return;
    }
    this.lastTapAt = now;
    this.lastTapX = x;
    this.lastTapY = y;
  }

  private binAt(x: number, y: number): Temper | null {
    for (const t of this.activeTempers) {
      if (pointInRect(x, y, this.layout.binRects[t])) return t;
    }
    return null;
  }

  // ── selection & scoring ─────────────────────────────────────────────

  marqueeRect(): Rect {
    const m = this.marquee;
    return {
      x: Math.min(m.x0, m.x1),
      y: Math.min(m.y0, m.y1),
      w: Math.abs(m.x1 - m.x0),
      h: Math.abs(m.y1 - m.y0),
    };
  }

  private resolveMarquee(): void {
    const box = this.marqueeRect();
    if (box.w < 8 || box.h < 8) {
      // A flat swipe straight across a group is 60px by 3px, and refusing
      // it as "too small" is pedantry: the refiner drew a line through the
      // digits they meant. Take it as a tap on the middle of that line.
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      if (this.tapToSelect && this.tapLift(this.nearestCluster({ x: cx, y: cy }))) {
        return;
      }
      this.say("SELECTION TOO SMALL", "error", "attempt");
      getAudio().click();
      return;
    }

    const tally = new Map<number, number>();
    for (const n of this.board.nodes) {
      if (n.cluster < 0 || n.lifted || n.retired) continue;
      // AABB test against the glyph's live position, not its home cell —
      // an agitated digit is selected where the refiner can see it.
      const px = n.hx + n.dx;
      const py = n.hy + n.dy;
      if (px < box.x || px > box.x + box.w) continue;
      if (py < box.y || py > box.y + box.h) continue;
      tally.set(n.cluster, (tally.get(n.cluster) ?? 0) + 1);
    }

    // Clusters are seeded a cell apart, but selection tests *live*
    // positions and an agitated cluster can drift over its neighbour. A
    // raw plurality vote therefore let a calm bystander with one more node
    // in the box hijack — and, worse, silently lift the wrong temper.
    // Weight the vote by agitation, and let the latched cluster win ties.
    let bestId = -1;
    let bestCount = 0;
    let bestScore = 0;
    for (const [id, count] of tally) {
      const cluster = this.board.clusters[id];
      const score =
        count * (0.35 + cluster.agitation) * (id === this.latchedId ? 1.6 : 1);
      if (score > bestScore) {
        bestScore = score;
        bestCount = count;
        bestId = id;
      }
    }

    if (bestId < 0) {
      this.say("NO DATA IN SELECTION", "error", "attempt");
      getAudio().buzz();
      haptics.reject();
      return;
    }
    const minCapture = LEVELS[this.levelIndex].minCapture ?? MIN_CAPTURE;
    if (bestCount < minCapture) {
      this.say(`INSUFFICIENT CAPTURE — ${minCapture} MINIMUM`, "error", "attempt");
      getAudio().buzz();
      haptics.reject();
      return;
    }

    const cluster = this.board.clusters[bestId];
    // A decoy never reaches the agitation a real group does, so the generic
    // guard below would fire on it and tell the refiner to probe harder —
    // advice that cannot work, on a site they did probe. It gets the honest
    // answer instead, and gets it before the guard can lie.
    if (cluster.decoy) {
      this.say("NO TEMPER DETECTED", "error", "attempt");
      getAudio().buzz();
      haptics.reject();
      this.glitchUntil = this.elapsed + 0.25;
      return;
    }
    if (cluster.agitation < ARM_SELECT_MIN_AGITATION) {
      this.say("NO TEMPER DETECTED — PROBE FIRST", "error", "attempt");
      getAudio().buzz();
      haptics.reject();
      this.glitchUntil = this.elapsed + 0.35;
      return;
    }

    this.liftCluster(cluster, box.x + box.w / 2, box.y + box.h / 2);
  }

  /**
   * Lifts whichever unrefined group the tap landed on, if any.
   *
   * Hit-tested against *live* glyph positions with a generous pad, the same
   * way the marquee is, so an agitated digit can be tapped where it is seen
   * rather than where its cell is. Decoys and the fifth are eligible: a tap
   * must not quietly reveal what a box would not.
   */
  /**
   * How far the packet is from the reticle as a drag begins.
   *
   * A packet used to snap to the reticle on the first move, which threw it
   * a lens-height up the screen the instant a finger touched it — the
   * player taps the digits, the box appears where they are, and then it
   * jumps away from the thumb that is about to drag it. Holding the offset
   * means the packet simply follows the finger from wherever it already is.
   *
   * Clamped, so pressing far from the packet pulls it towards the finger
   * instead of dragging it from across the board.
   */
  private grabOffset(r: { x: number; y: number }): { grabX: number; grabY: number } {
    const p = this.packet;
    if (!p) return { grabX: 0, grabY: 0 };
    const dx = p.x - r.x;
    const dy = p.y - r.y;
    const d = Math.hypot(dx, dy);
    const max = 56;
    if (d <= max) return { grabX: dx, grabY: dy };
    return { grabX: (dx / d) * max, grabY: (dy / d) * max };
  }

  /** The unrefined group nearest a board point, hit-tested against live
   *  glyph positions the way the marquee is. */
  private nearestCluster(
    at: { x: number; y: number },
  ): { cluster: Cluster; dist: number } | null {
    // Distance to the nearest glyph of each group, and separately whether
    // the point falls inside the group's live footprint. A five-digit group
    // spread over two rows has gaps wider than the tap pad in the middle of
    // it, so a tap that is plainly *on* the group can be more than a pad
    // away from every single digit — which is what made tapping the
    // floating numbers miss.
    const near = new Map<number, number>();
    const box = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();
    let best: Cluster | null = null;
    let bestD = Infinity;
    for (const n of this.board.nodes) {
      if (n.cluster < 0 || n.lifted || n.retired) continue;
      const c = this.board.clusters[n.cluster];
      if (c.refined) continue;
      const px = n.hx + n.dx;
      const py = n.hy + n.dy;
      const d = Math.hypot(at.x - px, at.y - py);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
      const prev = near.get(c.id);
      if (prev === undefined || d < prev) near.set(c.id, d);
      const b = box.get(c.id);
      if (!b) box.set(c.id, { x0: px, y0: py, x1: px, y1: py });
      else {
        b.x0 = Math.min(b.x0, px);
        b.y0 = Math.min(b.y0, py);
        b.x1 = Math.max(b.x1, px);
        b.y1 = Math.max(b.y1, py);
      }
    }
    if (!best) return null;
    // A point inside a group's footprint is on that group, however far the
    // nearest digit happens to be. Padded footprints overlap on the tight
    // files, and returning whichever happened to be first in map order sent
    // a tap dead-centre on one group to its neighbour — often a decoy. The
    // group with the nearer digit wins.
    let hit: Cluster | null = null;
    let hitD = Infinity;
    for (const [id, b] of box) {
      const m = TAP_INSET;
      const within =
        at.x >= b.x0 - m && at.x <= b.x1 + m && at.y >= b.y0 - m && at.y <= b.y1 + m;
      if (!within) continue;
      const d = near.get(id) ?? Infinity;
      if (d < hitD) {
        hitD = d;
        hit = this.board.clusters[id];
      }
    }
    if (hit) return { cluster: hit, dist: 0 };
    return { cluster: best, dist: bestD };
  }

  /**
   * Which group a touch is aimed at.
   *
   * The reticle floats above the finger so the lens is not underneath the
   * thumb — but the *target* must not float with it. Hit-testing at the
   * reticle put the tappable region of every group 22px (SELECT) or 68px
   * (PROBE) below its own digits: a one-row group could not be tapped at
   * all, a two-row group only on its bottom half, and tapping empty board
   * below the numbers worked when tapping the numbers did not. That is the
   * whole of "I have to tap it several times".
   *
   * The contact point is tried first, because it is what the refiner
   * believes they are pointing at. The reticle is kept as a fallback so
   * every aim that worked before still works.
   */
  private tapTarget(
    x: number,
    y: number,
    r: { x: number; y: number },
  ): { cluster: Cluster; dist: number } | null {
    const direct = this.nearestCluster({ x, y });
    if (direct && direct.dist <= TAP_PAD) return direct;
    const aimed = this.nearestCluster(r);
    if (aimed && aimed.dist <= TAP_PAD) return aimed;
    return direct ?? aimed;
  }

  /**
   * The packet frame in stage coordinates, sized exactly as the renderer
   * draws it, so what can be touched is what can be seen.
   */
  packetBounds(p: Packet): Rect {
    const n = p.digits.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cell = Math.max(14, this.layout.fontPx * 1.25);
    const label = this.assist
      ? `UNASSIGNED / ${p.temper} / ${n}`
      : `UNASSIGNED / ${n} DIGITS`;
    const w = Math.max(cols * cell + 18, label.length * 8 * 0.62 + 16);
    const h = rows * cell + 26;
    return { x: p.x - w / 2, y: p.y - h / 2, w, h };
  }

  /**
   * Lift whatever the gesture landed on when the finger first went down,
   * for the taps whose target has moved out from under them since.
   */
  private tapLiftStart(g: Gesture): boolean {
    if (g.startCluster < 0) return false;
    const c = this.board.clusters[g.startCluster];
    // It may have been binned by something else in the meantime, and
    // `nearestCluster` — which every other caller goes through — would
    // never have offered a refined group.
    if (!c || c.refined || this.board.nodes[c.members[0]]?.retired) return false;
    return this.tapLift({ cluster: c, dist: 0 });
  }

  private tapLift(near: { cluster: Cluster; dist: number } | null): boolean {
    if (!near || near.dist > TAP_PAD) return false;
    const best = near.cluster;
    // The group's own state before the finger landed — not the state of
    // whichever group happened to be nearest when it did. On a dense board
    // those are different clusters, and an agitated group was being
    // refused on a calm neighbour's reading.
    const wasAgitated = this.agitationAtDown[best.id] ?? best.agitation;
    if (best.decoy) {
      this.say("NO TEMPER DETECTED", "error", "attempt");
      getAudio().buzz();
      haptics.reject();
      this.glitchUntil = this.elapsed + 0.25;
      return true;
    }
    // The same gate the marquee applies. Without it a tap lifts a cluster a
    // box would refuse — and on the file that introduces the probe, where
    // the group is hidden for five seconds out of seven, blind-tapping the
    // board would lift it with no probing at all and take the whole lesson
    // with it.
    if (wasAgitated < ARM_SELECT_MIN_AGITATION) {
      this.say("NO TEMPER DETECTED — PROBE FIRST", "error", "attempt");
      getAudio().buzz();
      haptics.reject();
      return true;
    }
    this.liftCluster(best, best.cx, best.cy);
    this.marquee.active = false;
    return true;
  }

  /** Lifts a whole cluster into a carried packet. The one path a packet is
   *  ever created by, whether a box or a tap asked for it. */
  private liftCluster(cluster: Cluster, x: number, y: number): Packet {
    const digits: number[] = [];
    const origins: { x: number; y: number }[] = [];
    for (const i of cluster.members) {
      const n = this.board.nodes[i];
      // Read the live position before clearing the node, so the gather
      // starts from exactly the pixel the digit was last drawn at.
      origins.push({ x: n.hx + n.dx - x, y: n.hy + n.dy - y });
      n.lifted = true;
      n.scatter = 0;
      digits.push(n.digit);
    }

    const packet: Packet = {
      temper: cluster.temper,
      clusterId: cluster.id,
      digits,
      x,
      y,
      birth: 0,
      origins,
    };
    this.packet = packet;
    this.packetHeldAt = this.elapsed;
    this.latchedId = -1;
    this.phase = "carry";
    // Back to whatever mode this file lives in. On the orientation screens
    // that is SELECT: they have no probe, and dropping the refiner into
    // PROBE after their first lift left them holding a tool that does
    // nothing for the remaining three groups.
    this.mode = LEVELS[this.levelIndex].startMode ?? "probe";
    getAudio().lift();
    haptics.lift();
    this.say("PACKET LIFTED — ASSIGN A TEMPER", "info", "untilDropped");
    this.snapshotDirty = true;
    return packet;
  }

  /**
   * Let a held packet go without binning it. The digits fly back to the
   * cells they came from and stay found — this is a change of mind, not a
   * mistake, and re-probing a group you had already identified would be a
   * penalty for tapping the wrong part of the screen.
   */
  private releasePacket(): void {
    const packet = this.packet;
    if (!packet) return;
    const cluster = this.board.clusters[packet.clusterId];
    if (cluster) this.scatterBack(cluster, packet, true);
    this.packet = null;
    this.phase = this.mode === "select" ? "select" : "probe";
    this.hoverBin = null;
    getAudio().release();
    haptics.tap();
    this.clearMessage();
    this.snapshotDirty = true;
  }

  private resolveDrop(at: { x: number; y: number }): void {
    const packet = this.packet;
    if (!packet) return;
    const target = this.binAt(at.x, at.y);
    const cluster = this.board.clusters[packet.clusterId];

    if (!target) {
      // Released over open board: the packet stays in hand.
      this.say("PACKET HELD — DROP INTO A BIN", "info", "untilDropped");
      return;
    }

    if (cluster.fifth) {
      // Every bin refuses it, and it fills no quota. Nothing in the game
      // says what it is, and nothing ever will. Leaving it alone costs
      // nothing; this is what trying costs.
      const bin = this.bins[target];
      bin.lastHitAt = this.elapsed;
      bin.lastHitOk = false;
      this.scatterBack(cluster, packet);
      getAudio().buzz();
      haptics.reject();
      this.glitchUntil = this.elapsed + 0.6;
      this.say("NO TEMPER DETECTED", "error", "attempt");
      this.packet = null;
      this.phase = "probe";
      this.hoverBin = null;
      this.snapshotDirty = true;
      return;
    }

    if (target === packet.temper) {
      const bin = this.bins[target];
      bin.fill = Math.min(1, bin.fill + 1 / this.quota);
      bin.lastHitAt = this.elapsed;
      bin.lastHitOk = true;
      cluster.refined = true;
      this.lastRefined = target;
      for (const i of cluster.members) {
        const n = this.board.nodes[i];
        n.retired = true;
        n.lifted = false;
      }
      const rect = this.layout.binRects[target];
      this.absorb = {
        temper: target,
        digits: packet.digits,
        x: packet.x,
        y: packet.y,
        tx: rect.x + rect.w / 2,
        ty: rect.y + rect.h / 2,
        t: 0,
      };
      getAudio().chime();
      haptics.success();
      if (Number.isFinite(this.timeLeft)) {
        // Competence buys time. The clock still bites, but it bites the
        // player who is guessing rather than the one who is learning.
        this.timeLeft += TIME_CREDIT;
        this.nextTockAt = Math.min(10, Math.floor(this.timeLeft) - 1);
        this.say(
          `${PRAISE[(this.elapsed | 0) % PRAISE.length]}  +${TIME_CREDIT}s`,
          "praise",
        );
      } else {
        this.say(PRAISE[(this.elapsed | 0) % PRAISE.length], "praise");
      }
      this.packet = null;
      this.phase = "probe";
      this.checkCompletion();
    } else {
      const bin = this.bins[target];
      bin.lastHitAt = this.elapsed;
      bin.lastHitOk = false;
      this.scatterBack(cluster, packet);
      getAudio().buzz();
      haptics.reject();
      this.glitchUntil = this.elapsed + 0.5;
      this.say(REPRIMAND[(this.elapsed | 0) % REPRIMAND.length], "error");
      this.packet = null;
      this.phase = "probe";
    }
    this.hoverBin = null;
    this.snapshotDirty = true;
  }

  /**
   * Unrefined data returns to the grid, still agitated and still waiting.
   * Nothing is lost but time — which is what keeps a mis-binned cluster
   * from being able to make a file uncompletable.
   */
  private scatterBack(
    cluster: Cluster,
    packet: Packet,
    keepAgitation = false,
  ): void {
    for (const i of cluster.members) {
      const n = this.board.nodes[i];
      n.lifted = false;
      n.scatter = 1;
      n.sx = packet.x + (this.board.rng() - 0.5) * 60;
      n.sy = packet.y + (this.board.rng() - 0.5) * 60;
    }
    if (!keepAgitation) cluster.agitation = 0;
    if (this.latchedId === cluster.id) this.latchedId = -1;
  }

  private checkCompletion(): void {
    for (const t of this.activeTempers) {
      if (this.bins[t].fill < 0.999) return;
    }
    const level = LEVELS[this.levelIndex];
    this.phase = "complete";
    this.releaseGesture();
    getAudio().silenceAll();
    haptics.releaseProximity();
    haptics.complete();

    if (level.ceremony === "none" && this.levelIndex < LEVELS.length - 1) {
      // One continuous sequence, not a run of interruptions: a short flash
      // on the cleared board, then the next screen. No banner, no addendum,
      // no button. The phase still goes to "complete" so input stops.
      getAudio().chime();
      this.advanceAt = this.elapsed + (level.autoAdvanceMs ?? 900) / 1000;
      this.say("REFINED", "praise");
    } else {
      getAudio().fanfare();
      this.say("FILE REFINED. PLEASE ENJOY EACH NUMBER EQUALLY.", "praise");
    }
    this.snapshotDirty = true;
  }

  // ── simulation ──────────────────────────────────────────────────────

  private frame = (now: number): void => {
    // Clear first: `stop()` must never be left cancelling an id that has
    // already fired, and a re-entrant start/stop must not be able to leave
    // two loops running at once (which would halve dt and drain the shift
    // clock at double speed while looking perfectly smooth).
    this.raf = 0;
    if (!this.running) return;
    const raw = Math.max(0, (now - this.lastFrame) / 1000);
    // Physics is clamped so a backgrounded tab or a long GC pause cannot
    // teleport the simulation forward...
    const dt = Math.min(0.05, raw);
    this.lastFrame = now;
    this.update(dt, raw);
    this.render();
    this.emit();
    if (this.running) this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number, wall: number): void {
    if (this.paused) {
      // Before the clock, before message expiry, before the glitch and
      // bin-flash windows: all of those are measured against `elapsed`, so
      // advancing it would expire behind the drawer the very feedback the
      // player opened the handbook to go and look up.
      if (!this.pausedSilenced) {
        getAudio().silenceAll();
        // The bed too: a paused terminal is a quiet one, and the handbook
        // is not a place to sit and listen to the file you left open.
        getAudio().setAmbient(null);
        this.pausedSilenced = true;
      }
      return;
    }
    this.pausedSilenced = false;
    this.elapsed += dt;
    const live = this.isLive();

    if (live && Number.isFinite(this.timeLeft)) {
      // ...but the shift clock runs on unclamped wall time. Otherwise a
      // janky device silently gifts the player the difference: at 15 fps a
      // "90 second" file would last about two minutes.
      this.timeLeft -= wall;
      if (this.nextTockAt >= 0 && this.timeLeft <= this.nextTockAt) {
        getAudio().tock(this.nextTockAt <= 5);
        this.nextTockAt -= 1;
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.phase = "failed";
        this.releaseGesture();
        // Never strand a carried packet: its digits go back to the grid so
        // no node is left `lifted` with nothing holding it.
        this.returnPacketToGrid();
        getAudio().silenceAll();
        getAudio().alarm();
        haptics.releaseProximity();
        haptics.reject();
        this.say("SHIFT EXPIRED — FILE RETURNED TO QUEUE", "error");
        this.snapshotDirty = true;
      }
    }

    // ── the lens's own lifecycle ─────────────────────────────────────
    if (this.lensHoldUntil >= 0 && !this.gesture) {
      const shrink = LEVELS[this.levelIndex].lensShrinkS ?? 0.4;
      const over = this.elapsed - this.lensHoldUntil;
      if (over <= 0) {
        this.reticle.scale = 1;
      } else {
        this.reticle.scale = Math.max(0, 1 - over / Math.max(0.05, shrink));
        if (this.reticle.scale <= 0) {
          this.reticle.active = false;
          this.lensHoldUntil = -1;
          this.reticle.scale = 1;
        }
      }
    }

    // ── the scan pass between files ──────────────────────────────────
    if (this.wipe) {
      const dur = this.wipe.phase === "out" ? WIPE_OUT_S : WIPE_IN_S;
      this.wipe.t += dt / dur;
      if (this.wipe.t >= 1) {
        if (this.wipe.phase === "out") {
          const to = this.pendingLevel;
          this.pendingLevel = -1;
          this.wipe = null;
          // Sets its own "in" wipe, and resets `elapsed`, so nothing below
          // should run against the half-swapped state.
          this.startLevel(to);
          return;
        }
        this.wipe = null;
      }
    }

    // ── a finished screen with no ceremony advances itself ───────────
    if (this.advanceAt >= 0 && this.elapsed >= this.advanceAt) {
      this.advanceAt = -1;
      this.nextLevel();
      return;
    }

    if (this.message && this.messageIsStale()) this.clearMessage();

    // Orientation offers its hint a second time, once, for a player who
    // read the first line, did nothing, and watched it disappear. Cancelled
    // the moment anything is lifted, so it can never talk over a refiner
    // who has already understood.
    if (this.orientHintAt >= 0 && live) {
      if (this.packet || this.board.clusters.some((c) => c.refined)) {
        this.orientHintAt = -1;
      } else if (this.elapsed >= this.orientHintAt) {
        this.orientHintAt = -1;
        this.say("BOX THE MOVING DIGITS. DRAG THEM TO THE BIN.", "info", "untilAction");
      }
    }

    this.updateAgitation(dt, live);
    this.updateNodes(dt);

    if (this.packet) {
      this.packet.birth = Math.min(1, this.packet.birth + dt / GATHER_SECONDS);
    }
    if (this.absorb) {
      this.absorb.t += dt / ABSORB_SECONDS;
      if (this.absorb.t >= 1) this.absorb = null;
    }

    getAudio().tick();
  }

  /**
   * Which temper the board is giving off underneath everything.
   *
   * One group and it is that group's. Several and it is whichever sits
   * nearest the middle of the board — the one the eye is already on —
   * until the refiner takes hold of one, at which point the room is about
   * the thing in their hand. A decoy gives off nothing, and the fifth is
   * never named by anything, least of all by the sound of the room.
   */
  private ambientTemper(): Temper | null {
    const held = this.packet;
    if (held) {
      const c = this.board.clusters[held.clusterId];
      return c && !c.decoy && !c.fifth ? held.temper : null;
    }
    const g = this.layout.grid;
    const cx = g.x + g.w / 2;
    const cy = g.y + g.h / 2;
    let best: Cluster | null = null;
    let bestD = Infinity;
    for (const c of this.board.clusters) {
      if (c.refined || c.decoy || c.fifth) continue;
      if (this.board.nodes[c.members[0]]?.retired) continue;
      // A group under the lens is the group being considered, wherever it
      // happens to sit.
      const d =
        c.id === this.latchedId ? -1 : Math.hypot(c.cx - cx, c.cy - cy);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best?.temper ?? null;
  }

  private updateAgitation(dt: number, live: boolean): void {
    const level = LEVELS[this.levelIndex];
    // Only a *probe* gesture probes. Letting a marquee drag agitate the
    // board meant the box you were drawing could steal the latch from the
    // cluster you were drawing it around, and then reject your own correct
    // selection with NO TEMPER DETECTED.
    const probing =
      live && this.gesture?.kind === "probe" && this.reticle.active && !this.packet;
    const selfAgitate = level.selfAgitate === true && live;
    // The pulse file's groups surface and sink on their own schedule. The
    // envelope is computed once per frame and applied like self-agitation,
    // so the same "moves without a finger" path carries both.
    const pulse = level.pulse && live ? this.pulseEnvelope(level.pulse) : 0;
    const rx = this.reticle.x;
    const ry = this.reticle.y;

    // Latch selection is resolved after the loop, by strongest proximity.
    // Taking the first cluster to cross the threshold means taking the
    // highest *id*, which at a 37px tolerance is the wrong cluster on a
    // quarter of the board: the drone would report the nearest cluster
    // while a different one stayed agitated for the player to box.
    let latchCandidate = -1;
    let latchBest = LATCH_ENTER;
    const peak = this.peak;
    peak.WO = 0;
    peak.FC = 0;
    peak.DR = 0;
    peak.MA = 0;
    let dominant: Temper | null = null;
    let dominantValue = 0;
    const decoyAgitation = level.decoys?.[1] ?? 0.35;

    for (const cluster of this.board.clusters) {
      let target = 0;
      if (probing && !cluster.refined) {
        // Squared distances throughout — Math.hypot is variadic and does
        // overflow-safe scaling that nothing here needs, and this runs up
        // to ~140 times a frame.
        const gx = rx - cluster.cx;
        const gy = ry - cluster.cy;
        const reach = cluster.radius + PROBE_RADIUS;
        if (gx * gx + gy * gy < reach * reach) {
          let nearestSq = Infinity;
          for (const i of cluster.members) {
            const n = this.board.nodes[i];
            const ddx = rx - n.hx;
            const ddy = ry - n.hy;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < nearestSq) nearestSq = d2;
          }
          if (nearestSq < RADIUS_SQ) {
            target = 1 - Math.sqrt(nearestSq) / PROBE_RADIUS;
            target = target * target * (3 - 2 * target);
          }
        }
      }
      // Audio and haptics answer to the live probe only; the latch is a
      // visual affordance, not a sound that follows you around the board.
      const kp = target > cluster.probe ? RISE : FALL * 1.7;
      cluster.probe += (target - cluster.probe) * (1 - Math.exp(-kp * dt));
      if (cluster.probe < 0.002) cluster.probe = 0;

      if (probing && target >= latchBest) {
        latchBest = target;
        latchCandidate = cluster.id;
      }
      if (this.latchedId === cluster.id && !cluster.refined && live) {
        target = Math.max(target, LATCH_FLOOR);
      }
      // Orientation's clusters move with no probe at all. Raised on the
      // agitation target only, never on `probe`, so the drone and the
      // buzzing still answer to a live finger — the file shows the player
      // that groups move, and leaves the probe as something to discover
      // one file later.
      if (selfAgitate && !cluster.refined) {
        target = Math.max(target, this.emergence);
      }
      if (pulse > 0 && !cluster.refined) target = Math.max(target, pulse);

      // A morphing cluster changes temper in front of the refiner, once,
      // after it has been agitated long enough to have been read. Keyed off
      // agitated time rather than wall-clock so it cannot happen while
      // nobody is looking at it.
      if (cluster.morphTo && !cluster.morphed && cluster.clock >= cluster.morphAfter) {
        cluster.temper = cluster.morphTo;
        cluster.morphed = true;
        this.glitchUntil = this.elapsed + 0.2;
      }
      // The fifth borrows whatever was last refined, so it always looks
      // like something the refiner knows, and is always wrong.
      if (cluster.fifth) cluster.temper = this.lastRefined;
      if (cluster.decoy) target *= decoyAgitation;
      const k = target > cluster.agitation ? RISE : FALL;
      cluster.agitation += (target - cluster.agitation) * (1 - Math.exp(-k * dt));
      if (cluster.agitation < 0.002) cluster.agitation = 0;

      if (cluster.agitation > 0) {
        cluster.clock += dt;
        applyTemperMotion(cluster, this.board.nodes, level.subtlety);
      }
      // A decoy is a lie told to the eye only. It never reaches the audio
      // peaks or the haptic cadence, so the drone and the buzz stay honest
      // and a refiner who listens is never fooled by one.
      if (!cluster.decoy) {
        if (cluster.probe > peak[cluster.temper]) {
          peak[cluster.temper] = cluster.probe;
        }
        if (cluster.probe > dominantValue) {
          dominantValue = cluster.probe;
          dominant = cluster.temper;
        }
      }
      if (cluster.agitation === 0) {
        cluster.clock = 0;
      }
    }

    if (latchCandidate >= 0) {
      const found = this.board.clusters[latchCandidate];
      // A teaching file names what you have found — but a decoy is not a
      // temper and the fifth has no name, and having the terminal announce
      // one as woe would teach the exact lie the mechanic exists to expose.
      const teaching =
        LEVELS[this.levelIndex].teaches === true && !found.decoy && !found.fifth;
      if (teaching && latchCandidate !== this.latchedId) {
        // The calibration file names what you have found the moment you
        // find it. Four tempers learned by feeling them, not by reading a
        // description and hoping.
        const def = TEMPER_DEFS[found.temper];
        this.say(
          `${def.code} ${def.name} — ${def.signature.toUpperCase()}`,
          "info",
        );
      }
      this.latchedId = latchCandidate;
      // Recorded unconditionally, not only when the latch changes: re-probing
      // an already-latched cluster is the same gesture from the player's side
      // and must arm SELECT the same way.
      if (this.gesture) this.gesture.latchedDuring = latchCandidate;
    }

    const audio = getAudio();
    for (const t of TEMPERS) audio.setProximity(t, peak[t]);
    audio.setAmbient(live ? this.ambientTemper() : null);
    // The ambient cadence answers to a live probe only. Driving it from a
    // decaying probe after release re-fires one pulse a frame later, which
    // replaces (and so destroys) the lift or rejection pattern that the
    // same pointerup just played.
    haptics.proximity(
      probing ? dominant : null,
      probing ? dominantValue : 0,
      performance.now(),
    );
  }

  private updateNodes(dt: number): void {
    const t = this.elapsed;
    for (const n of this.board.nodes) {
      if (n.retired || n.lifted) continue;
      const owner = n.cluster >= 0 ? this.board.clusters[n.cluster] : null;
      if (n.scatter > 0 && !(owner && owner.agitation > 0)) {
        n.scatter = Math.max(0, n.scatter - dt * 1.6);
        const e = n.scatter * n.scatter;
        n.dx = (n.sx - n.hx) * e;
        n.dy = (n.sy - n.hy) * e;
        n.rot = e * 2.4;
        n.scale = 1 + e * 0.3;
        n.flash = e * 0.5;
        continue;
      }
      if (owner && owner.agitation > 0) {
        // Motion already written by applyTemperMotion. Re-probing a cluster
        // you just mis-binned must show its temper, not the tumble — but
        // blended out of the tumble rather than snapped, since the scatter
        // offset can be tens of pixels.
        if (n.scatter > 0) {
          n.scatter = Math.max(0, n.scatter - dt * 4);
          const e = n.scatter * n.scatter;
          // Every channel the scatter branch writes, or the digits glide
          // home while snapping upright in a single frame.
          n.dx += (n.sx - n.hx - n.dx) * e;
          n.dy += (n.sy - n.hy - n.dy) * e;
          n.rot += (e * 2.4 - n.rot) * e;
          n.scale += (1 + e * 0.3 - n.scale) * e;
          n.flash += (e * 0.5 - n.flash) * e;
        }
        continue;
      }
      settleNode(n, t, dt);
    }
  }

  // ── drawing ─────────────────────────────────────────────────────────

  private render(): void {
    if (this.gridCtx) renderGrid(this.gridCtx, this);
    if (this.overlayCtx) renderOverlay(this.overlayCtx, this);
  }

}
