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

export type Lane = "screens" | "bins";

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
  /** Unique per rung, because one reward appears on several. */
  readonly id: string;
  readonly lane: Lane;
  /** The counter value that earns it. */
  readonly at: number;
  readonly reward: RewardId;
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
 * Screens, not files: the thirteen orientation screens share one file name,
 * so a file-based counter cannot see the part of the game where the rewards
 * matter most. The first three land back to back to back, because a refiner
 * who has been paid twice before the third screen understands the system
 * without being told about it.
 */
const SCREEN_LADDER: readonly Rung[] = [
  { id: "S01", lane: "screens", at: 1, reward: "R02", size: "minor" },
  { id: "S02", lane: "screens", at: 2, reward: "R01", size: "minor" },
  { id: "S03", lane: "screens", at: 3, reward: "R03", size: "minor" },
  { id: "S05", lane: "screens", at: 5, reward: "R05", size: "minor" },
  { id: "S09", lane: "screens", at: 9, reward: "R06", size: "major" },
  // Screen 13 is the first screen carrying all four tempers and the last
  // of orientation: the field the refiner has just mastered becomes the
  // dance floor.
  { id: "S13", lane: "screens", at: 13, reward: "R07", size: "major" },
  // CALIBRATION names the four. The commendation belongs here rather than
  // on 13, so that two major events never share a boundary.
  { id: "S15", lane: "screens", at: 15, reward: "R08", size: "major" },
  { id: "S17", lane: "screens", at: 17, reward: "R03", size: "minor" },
  { id: "S20", lane: "screens", at: 20, reward: "R12", size: "minor" },
  { id: "S23", lane: "screens", at: 23, reward: "R13", size: "minor" },
  { id: "S24", lane: "screens", at: 24, reward: "R06", size: "major" },
  { id: "S26", lane: "screens", at: 26, reward: "R07", size: "major" },
  {
    id: "S28",
    lane: "screens",
    at: 28,
    reward: "R19",
    also: { lane: "bins", at: 90 },
    size: "major",
  },
  {
    id: "S30",
    lane: "screens",
    at: 30,
    reward: "R22",
    also: { lane: "bins", at: 105 },
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

export const LADDER: readonly Rung[] = [...SCREEN_LADDER, ...BIN_LADDER];

const BY_ID = new Map(LADDER.map((r) => [r.id, r]));

/** The rung a queued id refers to. Unknown ids are dropped, so a save
 *  written by a future version cannot crash an older one. */
export function rungById(id: string): Rung | undefined {
  return BY_ID.get(id);
}

export const LANE_LABEL: Record<Lane, string> = {
  screens: "SCREENS COMPLETED",
  bins: "BINS REFINED",
};

/** "Complete 3 more screens." — the exact action, in the game's words. */
export function actionFor(lane: Lane, remaining: number): string {
  const n = Math.max(1, remaining);
  if (lane === "screens") {
    return `Complete ${n} more screen${n === 1 ? "" : "s"}.`;
  }
  return `Refine ${n} more bin${n === 1 ? "" : "s"}.`;
}

/** The counters the ladder reads. Everything else in the save is noise. */
export interface Counters {
  readonly screens: number;
  readonly bins: number;
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
  const value = (c: Counters, lane: Lane) =>
    lane === "screens" ? c.screens : c.bins;
  return LADDER.filter((rung) => {
    if (claimed.has(rung.id)) return false;
    // Already satisfied before this boundary: it was earned then, not now.
    // (Nothing is lost — an earned rung stays in the queue until presented.)
    const wasMet =
      value(before, rung.lane) >= rung.at &&
      (!rung.also || value(before, rung.also.lane) >= rung.also.at);
    if (wasMet) return false;
    if (value(after, rung.lane) < rung.at) return false;
    if (rung.also && value(after, rung.also.lane) < rung.also.at) return false;
    if (rung.after?.some((id) => !claimed.has(id))) return false;
    return true;
  });
}

export interface LaneForecast {
  readonly lane: Lane;
  readonly current: number;
  readonly target: number;
  readonly remaining: number;
  readonly action: string;
  /** The second counter of a compound reward, when there is one. */
  readonly also?: {
    readonly lane: Lane;
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
export function forecast(counters: Counters): LaneForecast[] {
  const value = (lane: Lane) =>
    lane === "screens" ? counters.screens : counters.bins;
  const out: LaneForecast[] = [];
  for (const lane of ["screens", "bins"] as const) {
    const rung = LADDER.filter((r) => r.lane === lane)
      .filter((r) => value(r.lane) < r.at || (r.also && value(r.also.lane) < r.also.at))
      .sort((a, b) => a.at - b.at)[0];
    if (!rung) continue;
    const current = value(lane);
    const remaining = Math.max(0, rung.at - current);
    out.push({
      lane,
      current,
      target: rung.at,
      remaining,
      action: actionFor(lane, remaining),
      ...(rung.also
        ? {
            also: {
              lane: rung.also.lane,
              current: value(rung.also.lane),
              target: rung.also.at,
            },
          }
        : {}),
    });
  }
  return out;
}
