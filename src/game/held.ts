import { CATALOG, type RewardDef } from "./catalog";
import { LADDER, rungById, type RewardId } from "./rewards";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  categoryOf,
  type Category,
} from "./lexicon";
import type { Progress } from "./progress";

/**
 * What the refiner actually holds.
 *
 * One entry per reward, however many rungs awarded it — a second finger
 * trap is the same finger trap, counted twice. Shared by the shelf, which
 * lists them, and by the record block, which counts them.
 */
export interface Held {
  readonly rewardId: RewardId;
  readonly def: RewardDef;
  /** How many times it has been awarded. */
  readonly times: number;
}

export function heldRewards(progress: Progress): Held[] {
  const counts = new Map<RewardId, number>();
  for (const [rungId, state] of Object.entries(progress.rewardState)) {
    if (state !== "claimed") continue;
    const rung = rungById(rungId);
    if (!rung) continue;
    const def = CATALOG[rung.reward];
    if (!def) continue;
    counts.set(rung.reward, (counts.get(rung.reward) ?? 0) + 1);
  }
  // Catalog order, which is ladder order: the shelf reads as the sequence
  // the refiner lived through rather than as a leaderboard.
  return (Object.keys(CATALOG) as RewardId[])
    .filter((id) => counts.has(id))
    .map((id) => ({ rewardId: id, def: CATALOG[id]!, times: counts.get(id)! }));
}

/** Objects only — the things that sit on a shelf. */
export function heldObjects(progress: Progress): Held[] {
  return heldRewards(progress).filter((h) => h.def.kind === "object");
}

export interface CategoryProgress {
  readonly category: Category;
  readonly label: string;
  /** How many of this category's incentives have been kept. */
  readonly have: number;
  /** How many there are to keep, ever. */
  readonly total: number;
  /** The rewards kept in this category, in ladder order. */
  readonly kept: Held[];
}

/**
 * Progress through each category, counted in *rungs* rather than in
 * catalog entries.
 *
 * A rung is one payout, and the ladder hands out the fact card ten times
 * with ten different sentences — so counting catalog entries would report
 * "1 of 1 OUTIE FACTS" to a refiner who has nine more coming. Counting
 * rungs gives the denominators a refiner can actually work toward: ten
 * items, ten outie facts, three wellness sessions, five department events.
 *
 * This is the one place in the system that says how much is left. It says
 * how *many*, never what they are.
 */
export function categoryProgress(progress: Progress): CategoryProgress[] {
  const total = new Map<Category, number>();
  const have = new Map<Category, number>();
  for (const rung of LADDER) {
    const def = CATALOG[rung.reward];
    if (!def) continue;
    const c = categoryOf(def);
    total.set(c, (total.get(c) ?? 0) + 1);
    if (progress.rewardState[rung.id] === "claimed") {
      have.set(c, (have.get(c) ?? 0) + 1);
    }
  }
  const kept = heldRewards(progress);
  return CATEGORY_ORDER.filter((c) => (total.get(c) ?? 0) > 0).map((c) => ({
    category: c,
    label: CATEGORY_LABEL[c],
    have: have.get(c) ?? 0,
    total: total.get(c)!,
    kept: kept.filter((h) => categoryOf(h.def) === c),
  }));
}
