/**
 * The Music Dance Experience: the refinement floor, celebrating.
 *
 * The specification asks for "connect 3+ glowing numbers of one temper,
 * release on the beat, fill the dance meter". This game's atom is not a
 * number, it is a *cluster* of four to nine of them, selected with an 80px
 * probe and a marquee — so the instruction keeps its sentence and changes
 * its granularity: clusters light on the beat, and a chain of three
 * same-temper clusters, released in the window, fills a segment.
 *
 * Nothing here can be failed. There is no clock to run out, no lives, no
 * energy, and a miss costs a multiplier and nothing else. The reward has
 * already been earned; this is what earning it bought.
 *
 * Two channels carry temper, never one. Color is on for everyone during
 * the dance — including refiners who play with the assist off, for whom
 * the floor bursting into color *is* the celebration — and every lit
 * cluster also moves in its own temper's language, the same displacement
 * functions the rest of the game teaches.
 *
 * Pure: no DOM, no audio, no React. It is stepped with a delta and read.
 */

import { TEMPERS } from "./constants";
import { applyTemperMotion } from "./motion";
import { mulberry32 } from "./rng";
import type { Cluster, GridNode, Temper } from "./types";

/** The floor is the same 16x28 matrix the terminal always shows. */
export const MDE_COLS = 16;
export const MDE_ROWS = 28;

/** How long a session runs. The specification's forty-five seconds. */
export const MDE_SECONDS = 45;

/** Chain length that scores. The instruction says three; so does this. */
export const MIN_CHAIN = 3;

/** Segments in the Dance Meter. */
export const METER_SEGMENTS = 3;

/**
 * How far from a beat a release still counts, in seconds.
 *
 * Generous on purpose: this is a celebration, and a rhythm window tuned
 * for a rhythm player would turn a reward into an exam.
 */
export const BEAT_WINDOW = 0.22;

export interface Genre {
  readonly id: string;
  readonly name: string;
  /** Beats per minute. */
  readonly bpm: number;
  /**
   * Whether the name is established by the show or written for this
   * branch. Recorded so the two are never silently merged, exactly as the
   * canon audit requires of everything else.
   */
  readonly canon: boolean;
}

/**
 * The genre menu.
 *
 * `DEFIANT JAZZ` is the one name the episode establishes beyond doubt —
 * it is what the episode is called. The rest are written for this branch
 * in the same register and labeled as such. Any further show name goes in
 * here only with a frame check behind it: a misremembered reference is a
 * grin that curdles.
 */
export const GENRES: readonly Genre[] = [
  { id: "defiant-jazz", name: "DEFIANT JAZZ", bpm: 132, canon: true },
  { id: "sanctioned-polka", name: "SANCTIONED POLKA", bpm: 148, canon: false },
  { id: "permitted-swing", name: "PERMITTED SWING", bpm: 120, canon: false },
  { id: "compliant-calypso", name: "COMPLIANT CALYPSO", bpm: 108, canon: false },
];

/** One sanctioned accessory, as the scene allows. */
export const ACCESSORIES: readonly { id: string; name: string }[] = [
  { id: "maraca", name: "MARACA" },
  { id: "tambourine", name: "TAMBOURINE" },
  { id: "egg-shaker", name: "EGG SHAKER" },
];

export interface MdeCluster extends Cluster {
  /** Lit this phrase, and therefore connectable. */
  lit: boolean;
  /** Collapsed into a bloom and out of play until the next phrase. */
  spent: boolean;
}

export interface Bloom {
  x: number;
  y: number;
  /** 1 at the moment of the merge, falling to 0. */
  life: number;
  temper: Temper;
}

export interface MdeSnapshot {
  readonly elapsed: number;
  readonly remaining: number;
  readonly beat: number;
  /** 0..1 through the current beat — drives the pulse. */
  readonly beatPhase: number;
  readonly meter: number;
  readonly score: number;
  readonly multiplier: number;
  readonly merges: number;
  readonly misses: number;
  readonly chain: readonly number[];
  readonly finished: boolean;
}

/**
 * A dance floor.
 *
 * Board geometry is handed in so the session sits exactly where the number
 * field sits: the same rect, the same cell size, the same digits.
 */
export class MdeSession {
  readonly nodes: GridNode[] = [];
  readonly clusters: MdeCluster[] = [];
  readonly blooms: Bloom[] = [];

  private rng: () => number;
  private beatS: number;
  private elapsed = 0;
  /** Wall time of the next phrase change. */
  private nextPhraseAt = 0;
  private chain: number[] = [];
  private chainTemper: Temper | null = null;

  meter = 0;
  score = 0;
  multiplier = 1;
  merges = 0;
  misses = 0;

  readonly genre: Genre;
  private width: number;
  private height: number;

  constructor(genre: Genre, seed: number, width: number, height: number) {
    this.genre = genre;
    this.width = width;
    this.height = height;
    this.rng = mulberry32(seed >>> 0);
    this.beatS = 60 / genre.bpm;
    this.seed();
    this.phrase();
  }

  // ── geometry ───────────────────────────────────────────────────────

  /** Rebuild positions for a new stage size without losing the session. */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const { cw, ch } = this.cell();
    for (const n of this.nodes) {
      n.hx = (n.col + 0.5) * cw;
      n.hy = (n.row + 0.5) * ch;
    }
    for (const c of this.clusters) this.recenter(c);
  }

  private cell() {
    return { cw: this.width / MDE_COLS, ch: this.height / MDE_ROWS };
  }

  private recenter(c: MdeCluster): void {
    let x = 0;
    let y = 0;
    for (const i of c.members) {
      x += this.nodes[i].hx;
      y += this.nodes[i].hy;
    }
    c.cx = x / c.members.length;
    c.cy = y / c.members.length;
    let r = 0;
    for (const i of c.members) {
      r = Math.max(r, Math.hypot(this.nodes[i].hx - c.cx, this.nodes[i].hy - c.cy));
    }
    c.radius = r;
  }

  // ── board ──────────────────────────────────────────────────────────

  private seed(): void {
    const { cw, ch } = this.cell();
    for (let row = 0; row < MDE_ROWS; row++) {
      for (let col = 0; col < MDE_COLS; col++) {
        this.nodes.push({
          idx: row * MDE_COLS + col,
          col,
          row,
          hx: (col + 0.5) * cw,
          hy: (row + 0.5) * ch,
          digit: Math.floor(this.rng() * 10),
          cluster: -1,
          seed: this.rng() * Math.PI * 2,
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
        });
      }
    }

    // Four of each temper, so every phrase can always offer a chain of
    // three in some temper and the floor is never a dead end.
    const wanted = 4;
    for (const temper of TEMPERS) {
      for (let n = 0; n < wanted; n++) this.placeCluster(temper);
    }
  }

  /** A compact clump of five, on cells nothing else has taken. */
  private placeCluster(temper: Temper): void {
    for (let attempt = 0; attempt < 200; attempt++) {
      const col = 1 + Math.floor(this.rng() * (MDE_COLS - 3));
      const row = 1 + Math.floor(this.rng() * (MDE_ROWS - 3));
      const shape = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
        [this.rng() < 0.5 ? -1 : 2, this.rng() < 0.5 ? 0 : 1],
      ];
      const members: number[] = [];
      let ok = true;
      for (const [dc, dr] of shape) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || c >= MDE_COLS || r < 0 || r >= MDE_ROWS) {
          ok = false;
          break;
        }
        const idx = r * MDE_COLS + c;
        if (this.nodes[idx].cluster !== -1) {
          ok = false;
          break;
        }
        members.push(idx);
      }
      if (!ok) continue;

      // Keep clumps apart so a fingertip cannot mean two of them.
      const cx = members.reduce((s, i) => s + this.nodes[i].hx, 0) / members.length;
      const cy = members.reduce((s, i) => s + this.nodes[i].hy, 0) / members.length;
      const { cw } = this.cell();
      if (this.clusters.some((c) => Math.hypot(c.cx - cx, c.cy - cy) < cw * 3.2)) {
        continue;
      }

      const cluster: MdeCluster = {
        id: this.clusters.length,
        temper,
        morphTo: null,
        morphAfter: 0,
        morphed: false,
        decoy: false,
        morph: false,
        fifth: false,
        members,
        cx,
        cy,
        radius: 0,
        agitation: 0,
        probe: 0,
        clock: 0,
        refined: false,
        lit: false,
        spent: false,
      };
      for (const i of members) this.nodes[i].cluster = cluster.id;
      this.clusters.push(cluster);
      this.recenter(cluster);
      return;
    }
  }

  // ── the phrase ─────────────────────────────────────────────────────

  /**
   * Light a new set.
   *
   * One temper always gets at least three lit, chosen in rotation so the
   * floor works through all four rather than favoring one. A couple of
   * others light as company — they are connectable too, and mixing them
   * into a chain is what the release window is for.
   */
  private phrase(): void {
    for (const c of this.clusters) {
      c.lit = false;
      c.spent = false;
      c.agitation = 0;
    }
    const lead = TEMPERS[Math.floor(this.rng() * 4)];
    const pool = this.clusters.filter((c) => c.temper === lead);
    for (const c of pool.slice(0, 4)) c.lit = true;
    for (const c of this.clusters) {
      if (!c.lit && this.rng() < 0.35) c.lit = true;
    }
    // Four bars of a phrase at any tempo.
    this.nextPhraseAt = this.elapsed + this.beatS * 8;
  }

  // ── input ──────────────────────────────────────────────────────────

  /** The cluster under a point, if it is lit and in play. */
  clusterAt(x: number, y: number): MdeCluster | null {
    let best: MdeCluster | null = null;
    let bestD = Infinity;
    for (const c of this.clusters) {
      if (!c.lit || c.spent) continue;
      const d = Math.hypot(c.cx - x, c.cy - y);
      if (d < c.radius + 34 && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /** Begin, or extend, a chain. Same temper only; a different one is
   *  simply not added, which is a nudge rather than a punishment. */
  touch(x: number, y: number): void {
    const c = this.clusterAt(x, y);
    if (!c) return;
    if (this.chain.length === 0) {
      this.chain = [c.id];
      this.chainTemper = c.temper;
      return;
    }
    if (c.temper !== this.chainTemper) return;
    if (this.chain.includes(c.id)) return;
    this.chain.push(c.id);
  }

  /**
   * Let go.
   *
   * Three or more, inside the window, and the chain collapses into a
   * bloom and a segment. Anything else resets the multiplier and nothing
   * else: no lives, no energy, no progress taken back.
   */
  release(): "merge" | "miss" | "none" {
    if (this.chain.length === 0) return "none";
    const onBeat = this.beatDistance() <= BEAT_WINDOW;
    const long = this.chain.length >= MIN_CHAIN;
    const ids = this.chain;
    this.chain = [];
    this.chainTemper = null;

    if (!long || !onBeat) {
      this.misses += 1;
      this.multiplier = 1;
      return "miss";
    }

    for (const id of ids) {
      const c = this.clusters[id];
      c.spent = true;
      this.blooms.push({ x: c.cx, y: c.cy, life: 1, temper: c.temper });
    }
    this.merges += 1;
    this.score += ids.length * 100 * this.multiplier;
    this.multiplier += 1;
    if (this.meter < METER_SEGMENTS) this.meter += 1;
    return "merge";
  }

  cancel(): void {
    this.chain = [];
    this.chainTemper = null;
  }

  // ── clock ──────────────────────────────────────────────────────────

  /** Seconds to the nearest beat, in either direction. */
  private beatDistance(): number {
    const into = this.elapsed % this.beatS;
    return Math.min(into, this.beatS - into);
  }

  /** True on the frame a beat lands, for the audio to hang a note on. */
  step(dt: number): { beatFired: boolean; beat: number } {
    if (this.finished) return { beatFired: false, beat: this.beatIndex };
    const before = this.beatIndex;
    this.elapsed = Math.min(MDE_SECONDS, this.elapsed + dt);

    if (this.elapsed >= this.nextPhraseAt && !this.finished) this.phrase();

    for (const c of this.clusters) {
      const want = c.lit && !c.spent ? 1 : 0;
      c.agitation += (want - c.agitation) * Math.min(1, dt * 6);
      c.clock += dt;
      applyTemperMotion(c, this.nodes, 1.15);
    }
    for (const b of this.blooms) b.life -= dt * 1.6;
    for (let i = this.blooms.length - 1; i >= 0; i--) {
      if (this.blooms[i].life <= 0) this.blooms.splice(i, 1);
    }

    return { beatFired: this.beatIndex !== before, beat: this.beatIndex };
  }

  private get beatIndex(): number {
    return Math.floor(this.elapsed / this.beatS);
  }

  get finished(): boolean {
    return this.elapsed >= MDE_SECONDS;
  }

  snapshot(): MdeSnapshot {
    return {
      elapsed: this.elapsed,
      remaining: Math.max(0, MDE_SECONDS - this.elapsed),
      beat: this.beatIndex,
      beatPhase: (this.elapsed % this.beatS) / this.beatS,
      meter: this.meter,
      score: this.score,
      multiplier: this.multiplier,
      merges: this.merges,
      misses: this.misses,
      chain: [...this.chain],
      finished: this.finished,
    };
  }
}
