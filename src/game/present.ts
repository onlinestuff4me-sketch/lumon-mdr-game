/**
 * What a boundary owes the refiner, in the order it will be shown — and
 * what it quietly files instead.
 *
 * Pure, and deliberately not React: this was inline in `GameStage` for a
 * long time, where the one thing it could not do was be tested. The rule
 * it exists to enforce is a spacing rule, and a spacing rule is exactly
 * the kind of thing that goes wrong two boundaries later, invisibly, in a
 * way no screenshot of one screen can show.
 *
 * Derived from the ledger every render rather than stored: the queue in
 * the save is the truth, and a second copy in React state is a second
 * thing that can be wrong after a reload.
 */

import { factById, type Fact } from "./facts";
import { presentable, type RewardDef } from "./catalog";
import { rungById, type Rung } from "./rewards";
import type { Progress } from "./progress";

export interface Owed {
  readonly rungId: string;
  readonly rewardId: string;
  /** The rung itself, for the line on the sealed card saying why. */
  readonly rung: Rung;
  readonly reward: RewardDef;
  readonly major: boolean;
  readonly facts: Fact[];
}

export interface Filed {
  readonly rungId: string;
  readonly rewardId: string;
  readonly name: string;
}

/**
 * What a refiner would say they had just looked at.
 *
 * A picture, for anything whose identity *is* its picture. Fact cards and
 * Wellness sessions are the same blank card every time, so they are not
 * given a look at all — see rule 4.
 */
function look(reward: RewardDef): string | null {
  return reward.kind === "fact" || reward.kind === "session"
    ? null
    : reward.poster;
}

/**
 * Five rules, four of them learned from watching someone play screen 9 and
 * be handed the same picture three times:
 *
 * 1. A reward whose presentation is a later milestone stays queued rather
 *    than being claimed unseen.
 * 2. At most one major event per boundary. A second waits for the next
 *    completed file instead of running back to back.
 * 3. Never two rewards showing the *same picture* in a row, nor the same
 *    reward twice in one boundary, nor the same reward that ended the last
 *    boundary.
 * 4. **A card whose payload is a sentence is exempt from rule 3.** Two
 *    fact cards are two different things said; two melon bars are the same
 *    photograph twice. Treating them alike is what produced a FILE REFINED
 *    panel reading INCENTIVE EARNED with nothing behind it: the one thing
 *    owed was a fact, the last thing shown had also been a fact, and the
 *    spacing rule quietly deferred the only card there was.
 * 5. An **object** already on the shelf is not shown again. A second
 *    finger trap is still owed and still counted, but a repeat of the same
 *    photograph is the game repeating itself. It is filed instead, and the
 *    record says so.
 *
 * And the guarantee that holds them together: **a queue that is not empty
 * always hands something over.** Whatever the spacing rules would rather
 * do, a boundary that tells a refiner an incentive was earned has to
 * produce one.
 */
export function selectPresentation(
  progress: Progress,
): { owed: Owed[]; toFile: Filed[] } {
  const queue: Owed[] = [];
  const toFile: Filed[] = [];

  const held = new Set<string>();
  for (const [rungId, state] of Object.entries(progress.rewardState)) {
    if (state !== "claimed") continue;
    const r = rungById(rungId);
    if (r) held.add(r.reward);
  }

  for (const id of progress.rewardQueue) {
    const rung = rungById(id);
    if (!rung) continue;
    const reward = presentable(rung.reward);
    if (!reward) continue;
    // Rule 5: an object the refiner already owns.
    if (reward.kind === "object" && held.has(rung.reward)) {
      toFile.push({ rungId: id, rewardId: rung.reward, name: reward.name });
      continue;
    }
    queue.push({
      rungId: id,
      rewardId: rung.reward,
      rung,
      reward,
      major: rung.size !== "minor",
      // Chosen and stored when the reward was earned; looked up here,
      // never drawn here.
      facts: (progress.factsByRung[id] ?? [])
        .map(factById)
        .filter((f): f is Fact => !!f),
    });
  }

  // Greedy pass: take the first candidate that does not repeat the last
  // one. Anything that cannot be spaced out stays queued for a later
  // boundary rather than being dropped.
  const out: Owed[] = [];
  const usedIds = new Set<string>();
  let majorShown = false;
  let lastLook: string | null = null;
  let lastId: string | null = progress.lastShownRewardId;
  const rest = [...queue];
  for (;;) {
    const i = rest.findIndex((c) => {
      if (c.major && majorShown) return false;
      // Rule 4: a sentence is not a picture. It repeats nothing.
      if (look(c.reward) === null) return true;
      if (usedIds.has(c.rewardId)) return false;
      if (look(c.reward) === lastLook) return false;
      return c.rewardId !== lastId;
    });
    if (i < 0) break;
    const [pick] = rest.splice(i, 1);
    out.push(pick);
    usedIds.add(pick.rewardId);
    if (pick.major) majorShown = true;
    lastLook = look(pick.reward);
    lastId = pick.rewardId;
  }

  // The guarantee. Nothing above may leave a refiner looking at a panel
  // that says an incentive was earned and then hand over nothing.
  if (out.length === 0 && rest.length > 0) out.push(rest[0]);

  return { owed: out, toFile };
}
