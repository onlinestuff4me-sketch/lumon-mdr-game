import { getAudio } from "../audio/AudioEngine";
import { haptics } from "../audio/haptics";
import {
  COLS,
  DOUBLE_TAP_MS,
  LEVELS,
  MIN_CAPTURE,
  PRAISE,
  PROBE_RADIUS,
  REPRIMAND,
  RETICLE_OFFSET_Y,
  TAP_MAX_MS,
  TAP_SLOP,
  TEMPERS,
} from "./constants";
import { createBoard, layoutBoard, type Board } from "./grid";
import { computeLayout, pointInRect, type Rect, type StageLayout } from "./layout";
import { GlyphAtlas } from "./glyphAtlas";
import { applyTemperMotion, settleNode } from "./motion";
import { renderGrid, renderOverlay } from "./render";
import type {
  BinState,
  GamePhase,
  InputMode,
  Packet,
  Temper,
} from "./types";

export interface BinView {
  temper: Temper;
  fill: number;
  /** 1 accepted, -1 rejected, 0 idle — drives the bin flash. */
  hit: number;
  /** True while a carried packet hovers this bin. */
  hover: boolean;
}

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
}

const RISE = 11;
const FALL = 4.2;
const RADIUS_SQ = PROBE_RADIUS * PROBE_RADIUS;
/** Seconds a refined packet takes to dissolve into its bin. */
const ABSORB_SECONDS = 0.45;
/** Proximity at which a cluster counts as positively identified. */
const LATCH_ENTER = 0.9;
/** Residual agitation a latched cluster keeps once the finger lifts. */
const LATCH_FLOOR = 0.55;

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

  reticle = { x: 0, y: 0, active: false };
  marquee = { active: false, x0: 0, y0: 0, x1: 0, y1: 0 };
  hoverBin: Temper | null = null;

  /**
   * The cluster the refiner has positively identified. It keeps moving at a
   * reduced amplitude after the finger lifts, so there is time to switch to
   * SELECT and draw a box. Only ever one — finding is the game, re-finding
   * the same cluster three times is not.
   */
  latchedId = -1;

  /** Cluster ids currently pulsing from a rejected drop. */
  glitchUntil = 0;
  message: { text: string; kind: "praise" | "error" | "info" } | null = null;
  private messageUntil = 0;

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
  private dpr = 1;
  private running = false;
  private disposed = false;

  private listeners = new Set<Listener>();
  private snapshot: HudSnapshot;
  private snapshotDirty = true;
  /** Reused each frame so the hot loop allocates nothing. */
  private peak: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  private snapshotAt = 0;
  private nextTockAt = 0;

  /** True while a modal owns the screen. The shift clock stops, the drones
   *  stop, and input is ignored — reading the handbook must not cost you
   *  the file. */
  paused = false;
  muted = false;
  hapticsOn = true;
  /** Accessibility aid: paint agitated clusters in their temper colour. */
  assist = false;

  constructor() {
    this.layout = computeLayout(360, 640);
    this.board = createBoard(LEVELS[0].seed, LEVELS[0].quota + LEVELS[0].spare);
    this.bins = this.freshBins();
    this.snapshot = this.buildSnapshot();
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
    const bins: BinView[] = TEMPERS.map((t) => {
      const b = this.bins[t];
      const fresh = this.elapsed - b.lastHitAt < 0.5;
      return {
        temper: t,
        fill: b.fill,
        hit: fresh ? (b.lastHitOk ? 1 : -1) : 0,
        hover: this.hoverBin === t,
      };
    });
    const progress =
      bins.reduce((sum, b) => sum + Math.min(1, b.fill), 0) / TEMPERS.length;
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
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, index));
    const level = LEVELS[clamped];
    this.levelIndex = clamped;
    this.board = createBoard(level.seed, level.quota + level.spare);

    // If the board saturated before every cluster was placed, lower the
    // quota to what actually exists so a file is always completable.
    const counts: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
    for (const c of this.board.clusters) counts[c.temper]++;
    this.quota = Math.max(
      1,
      Math.min(level.quota, ...TEMPERS.map((t) => counts[t])),
    );
    // Every temper must be able to reach 100%: if the board saturated
    // badly enough that some temper has fewer clusters than the quota, the
    // quota drops for all four rather than leaving one bin unfillable.

    this.bins = this.freshBins();
    this.packet = null;
    this.absorb = null;
    this.marquee.active = false;
    this.hoverBin = null;
    this.mode = "probe";
    this.totalTime = level.seconds;
    this.timeLeft = level.seconds;
    this.elapsed = 0;
    this.latchedId = -1;
    this.glitchUntil = 0;
    this.nextTockAt = 10;
    this.phase = "probe";
    this.releaseGesture();
    this.relayout();
    this.say(`FILE ${level.name} #${level.fileCode} LOADED`, "info", 2.6);
    getAudio().boot();
    this.emit(true);
  }

  nextLevel(): void {
    this.startLevel(this.levelIndex + 1);
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
    this.marquee.active = false;
    getAudio().click();
    haptics.tap();
    this.snapshotDirty = true;
    this.emit(true);
  }

  toggleMode(): void {
    this.setMode(this.mode === "probe" ? "select" : "probe");
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    getAudio().setMuted(muted);
    this.snapshotDirty = true;
    this.emit(true);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.releaseGesture();
      getAudio().silenceAll();
      haptics.cancel();
    }
    this.snapshotDirty = true;
    this.emit(true);
  }

  setAssist(on: boolean): void {
    this.assist = on;
    this.snapshotDirty = true;
    this.emit(true);
  }

  setHaptics(on: boolean): void {
    this.hapticsOn = on;
    haptics.setEnabled(on);
    this.snapshotDirty = true;
    this.emit(true);
  }

  private say(
    text: string,
    kind: "praise" | "error" | "info",
    seconds: number,
  ): void {
    this.message = { text, kind };
    this.messageUntil = this.elapsed + seconds;
    this.snapshotDirty = true;
  }

  // ── sizing ──────────────────────────────────────────────────────────

  resize(w: number, h: number, dpr: number): void {
    if (w <= 0 || h <= 0) return;
    this.dpr = Math.min(dpr || 1, 2.5);
    this.layout = computeLayout(w, h);
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
   * it while probing the matrix. The offset tapers to zero across the
   * control deck, so that over the bins the packet is exactly under the
   * finger: at full strength the bottom row of bins would need a touch 40px
   * below the last pixel of the screen, and even the top row would only be
   * reachable by pressing somewhere that looks wrong. The taper is
   * monotonic in y, so dragging downward always moves the packet downward.
   */
  private reticleFor(x: number, y: number): { x: number; y: number } {
    const l = this.layout;
    const taperEnd = l.h - l.binsH;
    const taperStart = taperEnd - l.deckH;
    let offset = RETICLE_OFFSET_Y;
    if (y >= taperEnd) {
      offset = 0;
    } else if (y > taperStart && l.deckH > 0) {
      offset = RETICLE_OFFSET_Y * (1 - (y - taperStart) / l.deckH);
    }
    return {
      x: Math.max(0, Math.min(l.w, x)),
      y: Math.max(0, Math.min(l.h, y + offset)),
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

  private isLive(): boolean {
    if (this.paused) return false;
    return (
      this.phase === "probe" || this.phase === "select" || this.phase === "carry"
    );
  }

  pointerDown(id: number, x: number, y: number): void {
    void getAudio().unlock();
    haptics.markActivated();
    // A tap always revives the terminal. bfcache restores do not reliably
    // fire visibilitychange on iOS, and a frozen loop with no way back is
    // indistinguishable from a crash.
    if (!this.running && !this.disposed) this.start();
    if (!this.isLive()) return;
    // Strictly single-pointer: a second finger is ignored outright rather
    // than being allowed to hijack the in-flight gesture.
    if (this.gesture) return;

    const r = this.reticleFor(x, y);
    const kind: Gesture["kind"] = this.packet
      ? "carry"
      : this.mode === "select"
        ? "marquee"
        : "probe";

    this.gesture = {
      id,
      kind,
      startX: x,
      startY: y,
      startT: performance.now(),
      x,
      y,
      moved: false,
    };

    this.reticle.x = r.x;
    this.reticle.y = r.y;
    this.reticle.active = true;

    if (kind === "marquee") {
      this.marquee.active = true;
      this.marquee.x0 = r.x;
      this.marquee.y0 = r.y;
      this.marquee.x1 = r.x;
      this.marquee.y1 = r.y;
    } else if (kind === "carry" && this.packet) {
      this.packet.x = r.x;
      this.packet.y = r.y;
    }
    this.snapshotDirty = true;
  }

  pointerMove(id: number, x: number, y: number): void {
    const g = this.gesture;
    if (!g || g.id !== id) return;
    if (Math.hypot(x - g.startX, y - g.startY) > TAP_SLOP) g.moved = true;
    g.x = x;
    g.y = y;

    const r = this.reticleFor(x, y);
    this.reticle.x = r.x;
    this.reticle.y = r.y;

    if (g.kind === "marquee") {
      this.marquee.x1 = r.x;
      this.marquee.y1 = r.y;
    } else if (g.kind === "carry" && this.packet) {
      this.packet.x = r.x;
      this.packet.y = r.y;
      const bin = this.binAt(r.x, r.y);
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
    const isTap = !g.moved && dt < TAP_MAX_MS;

    if (g.kind === "marquee") {
      this.resolveMarquee();
    } else if (g.kind === "carry" && this.packet) {
      this.resolveDrop(this.reticleFor(x, y));
    }

    if (isTap) this.registerTap(g.startX, g.startY);

    this.gesture = null;
    this.reticle.active = false;
    this.marquee.active = false;
    this.hoverBin = null;
    getAudio().silenceAll();
    haptics.releaseProximity();
    this.snapshotDirty = true;
  }

  pointerCancel(id: number): void {
    const g = this.gesture;
    if (!g || g.id !== id) return;
    // Cancelled mid-drag (system gesture, call, notch swipe): abandon the
    // selection but never lose the packet — it stays carried.
    this.gesture = null;
    this.reticle.active = false;
    this.marquee.active = false;
    this.hoverBin = null;
    getAudio().silenceAll();
    haptics.cancel();
    this.snapshotDirty = true;
  }

  private releaseGesture(): void {
    this.gesture = null;
    this.reticle.active = false;
    this.marquee.active = false;
    this.hoverBin = null;
  }

  private registerTap(x: number, y: number): void {
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
    for (const t of TEMPERS) {
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
      this.say("SELECTION TOO SMALL", "error", 1.4);
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
      this.say("NO DATA IN SELECTION", "error", 1.6);
      getAudio().buzz();
      haptics.reject();
      return;
    }
    if (bestCount < MIN_CAPTURE) {
      this.say(`INSUFFICIENT CAPTURE — ${MIN_CAPTURE} MINIMUM`, "error", 1.8);
      getAudio().buzz();
      haptics.reject();
      return;
    }

    const cluster = this.board.clusters[bestId];
    if (cluster.refined) return;
    if (cluster.agitation < 0.22) {
      this.say("NO TEMPER DETECTED — PROBE FIRST", "error", 1.9);
      getAudio().buzz();
      haptics.reject();
      this.glitchUntil = this.elapsed + 0.35;
      return;
    }

    const digits: number[] = [];
    for (const i of cluster.members) {
      const n = this.board.nodes[i];
      n.lifted = true;
      n.scatter = 0;
      digits.push(n.digit);
    }

    this.packet = {
      temper: cluster.temper,
      clusterId: cluster.id,
      digits,
      x: box.x + box.w / 2,
      y: box.y + box.h / 2,
      birth: 0,
    };
    this.latchedId = -1;
    this.phase = "carry";
    this.mode = "probe";
    getAudio().lift();
    haptics.lift();
    this.say("PACKET LIFTED — ASSIGN A TEMPER", "info", 2.2);
    this.snapshotDirty = true;
  }

  private resolveDrop(at: { x: number; y: number }): void {
    const packet = this.packet;
    if (!packet) return;
    const target = this.binAt(at.x, at.y);
    const cluster = this.board.clusters[packet.clusterId];

    if (!target) {
      // Released over open board: the packet stays in hand.
      this.say("PACKET HELD — DROP INTO A BIN", "info", 1.6);
      return;
    }

    if (target === packet.temper) {
      const bin = this.bins[target];
      bin.fill = Math.min(1, bin.fill + 1 / this.quota);
      bin.lastHitAt = this.elapsed;
      bin.lastHitOk = true;
      cluster.refined = true;
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
      this.say(PRAISE[(this.elapsed | 0) % PRAISE.length], "praise", 1.9);
      this.packet = null;
      this.phase = "probe";
      this.checkCompletion();
    } else {
      const bin = this.bins[target];
      bin.lastHitAt = this.elapsed;
      bin.lastHitOk = false;
      // Unrefined data scatters back to the grid, still agitated, still
      // waiting. Nothing is lost but time.
      for (const i of cluster.members) {
        const n = this.board.nodes[i];
        n.lifted = false;
        n.scatter = 1;
        n.sx = packet.x + (this.board.rng() - 0.5) * 60;
        n.sy = packet.y + (this.board.rng() - 0.5) * 60;
      }
      cluster.agitation = 0;
      if (this.latchedId === cluster.id) this.latchedId = -1;
      getAudio().buzz();
      haptics.reject();
      this.glitchUntil = this.elapsed + 0.5;
      this.say(REPRIMAND[(this.elapsed | 0) % REPRIMAND.length], "error", 2.2);
      this.packet = null;
      this.phase = "probe";
    }
    this.hoverBin = null;
    this.snapshotDirty = true;
  }

  private checkCompletion(): void {
    for (const t of TEMPERS) {
      if (this.bins[t].fill < 0.999) return;
    }
    this.phase = "complete";
    this.releaseGesture();
    getAudio().silenceAll();
    getAudio().fanfare();
    haptics.complete();
    this.say("FILE REFINED. PLEASE ENJOY EACH NUMBER EQUALLY.", "praise", 6);
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
    this.elapsed += dt;
    const live = this.isLive();

    if (live) {
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
        haptics.reject();
        this.say("SHIFT EXPIRED — FILE RETURNED TO QUEUE", "error", 6);
        this.snapshotDirty = true;
      }
    }

    if (this.message && this.elapsed > this.messageUntil) {
      this.message = null;
      this.snapshotDirty = true;
    }

    this.updateAgitation(dt, live);
    this.updateNodes(dt);

    if (this.packet) this.packet.birth = Math.min(1, this.packet.birth + dt * 4);
    if (this.absorb) {
      this.absorb.t += dt / ABSORB_SECONDS;
      if (this.absorb.t >= 1) this.absorb = null;
    }

    getAudio().tick();
  }

  private updateAgitation(dt: number, live: boolean): void {
    const level = LEVELS[this.levelIndex];
    // Only a *probe* gesture probes. Letting a marquee drag agitate the
    // board meant the box you were drawing could steal the latch from the
    // cluster you were drawing it around, and then reject your own correct
    // selection with NO TEMPER DETECTED.
    const probing =
      live && this.gesture?.kind === "probe" && this.reticle.active && !this.packet;
    const rx = this.reticle.x;
    const ry = this.reticle.y;

    const peak = this.peak;
    peak.WO = 0;
    peak.FC = 0;
    peak.DR = 0;
    peak.MA = 0;
    let dominant: Temper | null = null;
    let dominantValue = 0;

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

      if (probing && target >= LATCH_ENTER && this.latchedId !== cluster.id) {
        this.latchedId = cluster.id;
      }
      if (this.latchedId === cluster.id && !cluster.refined) {
        target = Math.max(target, LATCH_FLOOR);
      }
      const k = target > cluster.agitation ? RISE : FALL;
      cluster.agitation += (target - cluster.agitation) * (1 - Math.exp(-k * dt));
      if (cluster.agitation < 0.002) cluster.agitation = 0;

      if (cluster.agitation > 0) {
        cluster.clock += dt;
        applyTemperMotion(cluster, this.board.nodes, level.subtlety);
      }
      if (cluster.probe > peak[cluster.temper]) {
        peak[cluster.temper] = cluster.probe;
      }
      if (cluster.probe > dominantValue) {
        dominantValue = cluster.probe;
        dominant = cluster.temper;
      }
      if (cluster.agitation === 0) {
        cluster.clock = 0;
      }
    }

    const audio = getAudio();
    for (const t of TEMPERS) audio.setProximity(t, peak[t]);
    haptics.proximity(dominant, dominantValue, performance.now());
  }

  private updateNodes(dt: number): void {
    const t = this.elapsed;
    for (const n of this.board.nodes) {
      if (n.retired || n.lifted) continue;
      if (n.scatter > 0) {
        n.scatter = Math.max(0, n.scatter - dt * 1.6);
        const e = n.scatter * n.scatter;
        n.dx = (n.sx - n.hx) * e;
        n.dy = (n.sy - n.hy) * e;
        n.rot = e * 2.4;
        n.scale = 1 + e * 0.3;
        n.flash = e * 0.5;
        continue;
      }
      if (n.cluster >= 0 && this.board.clusters[n.cluster].agitation > 0) {
        continue; // motion already written by applyTemperMotion
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
