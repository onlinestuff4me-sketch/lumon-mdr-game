import { CATALOG, type RewardDef } from "./catalog";
import { rungById, type RewardId } from "./rewards";
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
