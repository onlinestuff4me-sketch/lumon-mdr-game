/**
 * The incentive ladder, and the arithmetic behind the forecast.
 *
 * Pure data and pure functions: no storage, no React, no engine. What a
 * reward *is* lives elsewhere (and, until it is earned, deliberately
 * nowhere the forecast can reach) — this module knows only which counter
 * has to reach what number, which is everything the forecast is allowed
 * to say out loud.
 *
 * The thresholds are `docs/REWARDS.md` in executable form. They are not the
 * numbers in `product-context/`: those were written for a fifty-file
 * campaign whose bin counter reaches a thousand, and this game is thirty
 * screens and a hundred and five bins. Part 10 of that document records
 * every rescaling.
 */

import { TEMPERS } from "./constants";
import type { Temper } from "./types";

export type Lane = "screens" | "bins" | "temper" | "perfect";

/** Reward identity. Never rendered before the reward is earned. */
export type RewardId =
  | "R01" // eraser
  | "R02" // finger trap
  | "R03" // fact about your outie
  | "R05" // melon bar
  | "R06" // wellness session
  | "R07" // music dance experience
  | "R08" // crystal portrait gift
  | "R12" // egg bar
  | "R13" // watermelon remembrance
  | "R19" // waffle party i
  | "R22"; // waffle party ii

export interface Rung {
  /**
   * Unique per rung, because one reward appears on several.
   *
   * The number in an id is historical — it was the threshold when the
   * lane counted levels rather than files, and the ids are in every save
   * on every phone, so they do not move. `at` is the threshold; the id is
   * only a name.
   */
  readonly id: string;
  readonly lane: Lane;
  /** The counter value that earns it. */
  readonly at: number;
  readonly reward: RewardId;
  /** Which temper's bins this rung counts. Temper lane only. */
  readonly temper?: Temper;
  /**
   * A temper rung that wants *every* temper past its threshold rather than
   * any one of them — the balanced session, and the one place the four
   * counters are read together.
   */
  readonly allTempers?: true;
  /**
   * A second counter that must also be satisfied. The Waffle tiers are the
   * only compound rewards, and the forecast shows both numbers for them —
   * which is the one place it may show two counters at once.
   */
  readonly also?: { readonly lane: Lane; readonly at: number };
  /** Rung ids that must already be claimed. Waffle II waits for Waffle I. */
  readonly after?: readonly string[];
  /**
   * MAJOR events take over the screen (Wellness, the dance experience, a
   * Waffle tier); MINOR ones are an object on a plate. Two majors never
   * present on the same boundary — the second waits for the next one.
   */
  readonly size: "minor" | "major" | "landmark";
}

/**
 * Lane A — screens completed.
 *
 * One per level, which the interface calls a file — the header has always
 * numbered them that way ("FILE 16 OF 30"), including the thirteen
 * orientation levels that share a file *name*. The lane keeps the internal
 * name `screens` because that is what the save has always called it; every
 * string a refiner reads says "file". The first three land back to back to back, because a refiner
 * who has been paid twice before the third screen understands the system
 * without being told about it.
 */
const SCREEN_LADDER: readonly Rung[] = [
  { id: "S01", lane: "screens", at: 1, reward: "R02", size: "minor" },
  { id: "S02", lane: "screens", at: 2, reward: "R01", size: "minor" },
  { id: "S03", lane: "screens", at: 3, reward: "R03", size: "minor" },
  { id: "S05", lane: "screens", at: 4, reward: "R05", size: "minor" },
  { id: "S09", lane: "screens", at: 6, reward: "R06", size: "major" },
  // Screen 13 is the first screen carrying all four tempers and the last
  // of orientation: the field the refiner has just mastered becomes the
  // dance floor.
  { id: "S13", lane: "screens", at: 8, reward: "R07", size: "major" },
  // CALIBRATION names the four. The commendation belongs here rather than
  // on 13, so that two major events never share a boundary.
  { id: "S15", lane: "screens", at: 10, reward: "R08", size: "major" },
  { id: "S17", lane: "screens", at: 12, reward: "R03", size: "minor" },
  { id: "S20", lane: "screens", at: 14, reward: "R12", size: "minor" },
  { id: "S23", lane: "screens", at: 16, reward: "R13", size: "minor" },
  { id: "S24", lane: "screens", at: 18, reward: "R06", size: "major" },
  { id: "S26", lane: "screens", at: 20, reward: "R07", size: "major" },
  {
    id: "S28",
    lane: "screens",
    at: 22,
    reward: "R19",
    also: { lane: "bins", at: 90 },
    size: "major",
  },
  {
    id: "S30",
    lane: "screens",
    at: 23,
    reward: "R22",
    also: { lane: "bins", at: 104 },
    after: ["S28"],
    size: "landmark",
  },
];

/**
 * Lane B — bins refined.
 *
 * Sized to the 105 a complete playthrough actually yields, and placed in
 * the gaps Lane A leaves. Bin 95 rather than a round 100: 100 falls inside
 * the final file and would present at the same boundary as Waffle II,
 * where 95 lands on YAKIMA — the file that takes the sound away, which is
 * the better place to be handed a music reward.
 */
const BIN_LADDER: readonly Rung[] = [
  { id: "B010", lane: "bins", at: 10, reward: "R03", size: "minor" },
  { id: "B025", lane: "bins", at: 25, reward: "R03", size: "minor" },
  { id: "B040", lane: "bins", at: 40, reward: "R05", size: "minor" },
  { id: "B060", lane: "bins", at: 60, reward: "R03", size: "minor" },
  { id: "B075", lane: "bins", at: 75, reward: "R08", size: "minor" },
  { id: "B095", lane: "bins", at: 95, reward: "R07", size: "major" },
];

/**
 * Lane C — temper mastery, revealed once all four are in play.
 *
 * Per-temper ceilings in this campaign are WO 27, FC 26, DR 27 and MA 25,
 * so the source document's "25 of each" is only reachable on the final
 * screen. Ten and twenty, and a balanced session at twenty of all four.
 */
const TEMPER_LADDER: readonly Rung[] = TEMPERS.map((t) => ({
  id: `T${t}10`,
  lane: "temper" as const,
  at: 10,
  temper: t,
  reward: "R03" as const,
  size: "minor" as const,
}));

const BALANCED: Rung = {
  id: "TALL20",
  lane: "temper",
  at: 20,
  allTempers: true,
  reward: "R06",
  size: "major",
};

/**
 * Lane D — perfect play, revealed by the first clean screen.
 *
 * A streak, not a total: the first rung is what tells the refiner the lane
 * exists, and the rest reward keeping it up. Losing a streak loses nothing
 * already claimed.
 */
const PERFECT_LADDER: readonly Rung[] = [
  { id: "P01", lane: "perfect", at: 1, reward: "R03", size: "minor" },
  { id: "P03", lane: "perfect", at: 3, reward: "R02", size: "minor" },
  { id: "P05", lane: "perfect", at: 5, reward: "R05", size: "minor" },
];

export const LADDER: readonly Rung[] = [
  ...SCREEN_LADDER,
  ...BIN_LADDER,
  ...TEMPER_LADDER,
  BALANCED,
  ...PERFECT_LADDER,
];

const BY_ID = new Map(LADDER.map((r) => [r.id, r]));

/** The rung a queued id refers to. Unknown ids are dropped, so a save
 *  written by a future version cannot crash an older one. */
export function rungById(id: string): Rung | undefined {
  return BY_ID.get(id);
}

/**
 * What each lane is called in front of a refiner.
 *
 * "Files", not "screens". The counter really is one-per-level and the
 * header has always numbered levels as files ("FILE 16 OF 30"), so
 * "screens" was an internal word leaking into the interface. It is also
 * the word `docs/DESIGN_SYSTEM.md` reserves for the data a refiner
 * refines — nothing else in this game may be called a file.
 *
 * The counter is `filesCompleted`, credited when a file's last stage
 * finishes. The lane keeps the internal name `screens` because that is
 * what the save has always called it; every string a refiner reads says
 * "file".
 */
export const LANE_LABEL: Record<Lane, string> = {
  screens: "FILES REFINED",
  bins: "BINS REFINED",
  temper: "TEMPER MASTERY",
  perfect: "FILES WITHOUT ERROR",
};

/**
 * Why this incentive was issued, for the sealed card to say before it is
 * opened.
 *
 * The sealed card may explain the *cause* in as much detail as it likes —
 * the refiner earned it and knows what they did. What it may never do is
 * hint at the effect. Nothing here touches the catalog.
 */
export function reasonFor(rung: Rung): string {
  const n = rung.at;
  const files = `${n} ${n === 1 ? "FILE" : "FILES"}`;
  const bins = `${n} ${n === 1 ? "BIN" : "BINS"}`;
  if (rung.lane === "screens") return `REFINEMENT MILESTONE · ${files} REFINED`;
  if (rung.lane === "bins") return `BIN QUOTA · ${bins} REFINED`;
  if (rung.lane === "perfect") {
    return `UNBLEMISHED RECORD · ${files} WITHOUT ERROR`;
  }
  return rung.allTempers
    ? `TEMPER MASTERY · ${n} OF EVERY TEMPER`
    : `TEMPER MASTERY · ${n} ${rung.temper} ${n === 1 ? "BIN" : "BINS"}`;
}

/** The label a temper rung shows: the temper's own name, not the lane's. */
export function laneLabel(rung: Rung): string {
  if (rung.lane !== "temper") return LANE_LABEL[rung.lane];
  return rung.allTempers ? "ALL FOUR TEMPERS" : `${rung.temper} BINS REFINED`;
}

/** "Refine 3 more files." — the exact action, in the game's words. */
export function actionFor(lane: Lane, remaining: number, temper?: string): string {
  const n = Math.max(1, remaining);
  const s = n === 1 ? "" : "s";
  if (lane === "screens") return `Refine ${n} more file${s}.`;
  if (lane === "perfect") return `Refine ${n} more file${s} without error.`;
  if (lane === "temper") {
    return temper
      ? `Refine ${n} more ${temper} bin${s}.`
      : `Refine ${n} more of every temper.`;
  }
  return `Refine ${n} more bin${s}.`;
}

/** The counters the ladder reads. Everything else in the save is noise. */
export interface Counters {
  readonly screens: number;
  readonly bins: number;
  readonly byTemper: Readonly<Record<Temper, number>>;
  /** Consecutive screens finished without a wrong bin. */
  readonly perfectStreak: number;
  /** Clean screens ever, which is what reveals the precision lane. */
  readonly perfectTotal: number;
}

/**
 * What a rung's counter reads right now.
 *
 * A temper rung reads its own temper; the balanced rung reads the lowest
 * of the four, which is what "twenty of all four" means as a single
 * number a forecast can draw a meter for.
 */
export function valueFor(c: Counters, rung: Rung): number {
  if (rung.lane === "temper") {
    if (rung.allTempers) return Math.min(...TEMPERS.map((t) => c.byTemper[t]));
    return c.byTemper[rung.temper!];
  }
  if (rung.lane === "perfect") return c.perfectStreak;
  return rung.lane === "screens" ? c.screens : c.bins;
}

/**
 * Rungs newly satisfied by moving from `before` to `after`.
 *
 * Order matters: a screen that also crosses a bin threshold earns both, and
 * they present one at a time in this order — the lane that caused the
 * boundary first, then the other. Compound rungs are checked against both
 * counters, and a rung whose prerequisite is unclaimed is simply not earned
 * yet; it will be caught by the next crossing, since the check is `>=`
 * rather than `===`.
 */
export function newlyEarned(
  before: Counters,
  after: Counters,
  claimed: ReadonlySet<string>,
): Rung[] {
  const second = (c: Counters, lane: Lane) =>
    lane === "screens" ? c.screens : c.bins;
  return LADDER.filter((rung) => {
    if (claimed.has(rung.id)) return false;
    // Already satisfied before this boundary: it was earned then, not now.
    // (Nothing is lost — an earned rung stays in the queue until presented.)
    const wasMet =
      valueFor(before, rung) >= rung.at &&
      (!rung.also || second(before, rung.also.lane) >= rung.also.at);
    if (wasMet) return false;
    if (valueFor(after, rung) < rung.at) return false;
    if (rung.also && second(after, rung.also.lane) < rung.also.at) return false;
    if (rung.after?.some((id) => !claimed.has(id))) return false;
    return true;
  });
}

export interface LaneForecast {
  readonly lane: Lane;
  /** What this row calls its counter. */
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly remaining: number;
  readonly action: string;
  /** The second counter of a compound reward, when there is one. */
  readonly also?: {
    readonly lane: Lane;
    readonly label: string;
    readonly current: number;
    readonly target: number;
  };
}

/**
 * What each lane shows: the next threshold above the current count, and
 * nothing beyond it.
 *
 * A lane whose rungs are all earned returns nothing and is not rendered —
 * an empty counter is worse than no counter. Claimed state is deliberately
 * not consulted for *which* threshold to show: a reward waiting in the
 * queue has already been earned, so the forecast moves on to the next
 * promise rather than stalling on a celebration that has not run yet.
 */
/**
 * Which lanes a refiner can see yet.
 *
 * Two at launch. Temper mastery appears once CALIBRATION has named all
 * four and every bin is in play, and precision appears the moment a clean
 * screen proves the lane exists — so the tutorial never shows four
 * counters to someone still learning to read one.
 */
export function laneVisible(lane: Lane, c: Counters): boolean {
  if (lane === "temper") return c.screens >= 15;
  if (lane === "perfect") return c.perfectTotal >= 1;
  return true;
}

export function forecast(counters: Counters): LaneForecast[] {
  const out: LaneForecast[] = [];
  for (const lane of ["screens", "bins", "temper", "perfect"] as const) {
    if (!laneVisible(lane, counters)) continue;
    // The nearest unmet rung in this lane. For tempers that means the
    // temper closest to its next threshold, so the forecast shows one row
    // rather than four counters at once.
    const rung = LADDER.filter((r) => r.lane === lane)
      .filter((r) => {
        const met =
          valueFor(counters, r) >= r.at &&
          (!r.also ||
            (r.also.lane === "screens" ? counters.screens : counters.bins) >=
              r.also.at);
        return !met;
      })
      .sort((a, b) => {
        const ra = a.at - valueFor(counters, a);
        const rb = b.at - valueFor(counters, b);
        return ra - rb || a.at - b.at;
      })[0];
    if (!rung) continue;
    const current = valueFor(counters, rung);
    const remaining = Math.max(0, rung.at - current);
    out.push({
      lane,
      label: laneLabel(rung),
      current,
      target: rung.at,
      remaining,
      action: actionFor(rung.lane, remaining, rung.temper),
      ...(rung.also
        ? {
            also: {
              lane: rung.also.lane,
              label: LANE_LABEL[rung.also.lane],
              current:
                rung.also.lane === "screens" ? counters.screens : counters.bins,
              target: rung.also.at,
            },
          }
        : {}),
    });
  }
  return out;
}
