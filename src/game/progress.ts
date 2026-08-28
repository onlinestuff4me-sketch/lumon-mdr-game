/**
 * The incentive ledger: what has been refined, what has been earned, and
 * what is still waiting to be handed over.
 *
 * Its own key, beside the archive and the runs, and for the same reason:
 * a settings migration must never be able to wipe a player's incentives.
 * Reads and writes are guarded the way the others are — storage throws
 * outright in private windows and with site data blocked, and a lost
 * ledger must never stop the terminal booting.
 *
 * Two rules the rest of the system leans on:
 *
 * 1. **Counters only ever go up, and only on first completion.** A screen
 *    credits its bins once, keyed by level id. Replaying an early file to
 *    farm the bin ladder does nothing, and neither does failing one — a
 *    file that was never completed was never credited.
 * 2. **Earning and claiming are separate.** Crossing a threshold writes
 *    `earned_pending` before anything is drawn. A force quit mid-ceremony
 *    loses the ceremony, never the reward.
 *
 * The ledger is global rather than per-run. It matches the archive next
 * door — a document once read has been read — and it is what the source
 * specification means by monotonic counters: the shelf is a collection of
 * objects the refiner owns, not a scoreboard that resets with the quarter.
 */

import { LEVELS, TEMPERS } from "./constants";
import { pickFacts } from "./facts";
import { newlyEarned, type Counters, type Rung } from "./rewards";
import type { Temper } from "./types";

/**
 * `presenting` is read but never written.
 *
 * The guarantee the reward contract actually needs is that *earned* is in
 * storage before any ceremony begins, and that happens at the boundary,
 * in `applyCompletion`. A second write when the card appears would buy
 * nothing: both states mean the same thing to a save being loaded, which
 * is that the refiner is owed something. It stays in the type because a
 * save written by a version that did write it must still load, and
 * `coerce` turns it back into what it means.
 */
export type RewardState = "earned_pending" | "presenting" | "claimed";

export interface Progress {
  version: number;
  /**
   * Levels credited. Informational now: the ladder counts files.
   *
   * Kept under its old name because it is in every save already, and a
   * key rename in storage buys nothing.
   */
  screensCompleted: number;
  /**
   * Files refined — what the screens lane actually counts.
   *
   * A file may be several levels (the orientation lessons are two or
   * three each), and it is credited once, when its last stage completes.
   * Absent in saves written before files existed; `coerce` derives it
   * from the credited level ids, which is exact rather than a guess.
   */
  filesCompleted: number;
  binsTotal: number;
  binsByTemper: Record<Temper, number>;
  /** Level ids already credited. The whole of the idempotency guarantee. */
  creditedLevelIds: string[];
  perfectScreensTotal: number;
  perfectScreenStreak: number;
  /** Rung id -> where it is in its life. Absent means locked. */
  rewardState: Record<string, RewardState>;
  /** Rung ids earned and not yet presented, oldest first. */
  rewardQueue: string[];
  /** Fact ids already read out, so a card never repeats one. */
  seenFactIds: string[];
  /**
   * The last reward actually shown to the refiner.
   *
   * Two incentives of the same kind back to back read as one repeated
   * event rather than two rewards, so the presenter uses this to space
   * them out across boundaries. Only a reward that was *presented* counts
   * — one filed quietly is not something the refiner just looked at.
   */
  lastShownRewardId: string | null;
  /**
   * The sentences each rung will read, chosen when it was earned.
   *
   * Written before any card opens, which is the whole point: a force quit
   * during a Wellness session must bring back the same facts, not a fresh
   * draw. Kept after claiming too, so the archive can list what was heard.
   */
  factsByRung: Record<string, string[]>;
  /**
   * How often each claimed reward has been opened on the shelf.
   *
   * Harmless on its own, and the counter the "please enjoy all incentives
   * equally" survey will read later. It never changes what a refiner is
   * given.
   */
  inspectCounts: Record<string, number>;
}

/**
 * How many whole files a set of credited level ids amounts to.
 *
 * A file counts only when *every* stage of it has been credited — half of
 * an orientation lesson is not a file refined, and the ladder must not
 * treat it as one.
 */
function filesAmong(levelIds: readonly string[]): number {
  const done = new Set(levelIds);
  const stages = new Map<string, { total: number; have: number }>();
  for (const level of LEVELS) {
    const key = level.fileKey ?? level.id;
    const row = stages.get(key) ?? { total: 0, have: 0 };
    row.total += 1;
    if (done.has(level.id)) row.have += 1;
    stages.set(key, row);
  }
  let files = 0;
  for (const row of stages.values()) if (row.have === row.total) files += 1;
  return files;
}

const KEY = "lumon.mdr.progress.v1";
const VERSION = 1;

export function emptyProgress(): Progress {
  return {
    version: VERSION,
    screensCompleted: 0,
    filesCompleted: 0,
    binsTotal: 0,
    binsByTemper: { WO: 0, FC: 0, DR: 0, MA: 0 },
    creditedLevelIds: [],
    perfectScreensTotal: 0,
    perfectScreenStreak: 0,
    rewardState: {},
    rewardQueue: [],
    seenFactIds: [],
    factsByRung: {},
    inspectCounts: {},
    lastShownRewardId: null,
  };
}

export function counters(p: Progress): Counters {
  return {
    screens: p.filesCompleted,
    bins: p.binsTotal,
    byTemper: p.binsByTemper,
    perfectStreak: p.perfectScreenStreak,
    perfectTotal: p.perfectScreensTotal,
  };
}

export function claimedIds(p: Progress): Set<string> {
  return new Set(
    Object.entries(p.rewardState)
      .filter(([, state]) => state === "claimed")
      .map(([id]) => id),
  );
}

/** A completed screen, as the ledger needs to see it. */
export interface Completion {
  readonly levelId: string;
  /** The tempers the file actually used — one bin each. */
  readonly tempers: readonly Temper[];
  /** Groups refined per temper. */
  readonly quota: number;
  /** True when the whole file was finished without a rejected drop. */
  readonly perfect: boolean;
  /**
   * Whether this level was the last stage of its file.
   *
   * Bins are credited per stage — every group binned is a group binned —
   * but the file counter and the precision lane only move when the file
   * itself is done.
   */
  readonly fileComplete: boolean;
  /**
   * Whether a clean screen means anything here.
   *
   * A screen with one bin on the deck cannot be mis-binned, so finishing
   * it without an error is not precision, it is arithmetic. The streak
   * counts only screens where a wrong bin was possible — which is also
   * what stops the precision lane paying out on screen one, before the
   * refiner has been shown a second bin to get it wrong in.
   */
  readonly countsForPerfect: boolean;
}

/**
 * Credit a completed screen. Pure: hand it a ledger, get a new one back
 * plus whatever that crossing just earned.
 *
 * Re-crediting the same level id returns the ledger untouched and no
 * rewards, which is what makes the caller safe to run on every render of
 * the completion phase.
 */
export function applyCompletion(
  p: Progress,
  done: Completion,
): { progress: Progress; earned: Rung[] } {
  if (p.creditedLevelIds.includes(done.levelId)) {
    return { progress: p, earned: [] };
  }

  const before = counters(p);
  const binsByTemper = { ...p.binsByTemper };
  for (const t of done.tempers) binsByTemper[t] += done.quota;

  const counts = done.countsForPerfect && done.fileComplete;
  const next: Progress = {
    ...p,
    screensCompleted: p.screensCompleted + 1,
    filesCompleted: p.filesCompleted + (done.fileComplete ? 1 : 0),
    binsTotal: p.binsTotal + done.quota * done.tempers.length,
    binsByTemper,
    creditedLevelIds: [...p.creditedLevelIds, done.levelId],
    perfectScreensTotal: p.perfectScreensTotal + (counts && done.perfect ? 1 : 0),
    perfectScreenStreak: !counts
      ? p.perfectScreenStreak
      : done.perfect
        ? p.perfectScreenStreak + 1
        : 0,
    rewardState: { ...p.rewardState },
    rewardQueue: [...p.rewardQueue],
    factsByRung: { ...p.factsByRung },
  };

  const earned = newlyEarned(before, counters(next), claimedIds(p));
  const seen = [...p.seenFactIds];
  for (const rung of earned) {
    next.rewardState[rung.id] = "earned_pending";
    next.rewardQueue.push(rung.id);
    // The sentences are drawn here, at the boundary, and stored with the
    // reward. Nothing downstream is allowed to roll for them.
    const facts = pickFacts(rung.id, seen);
    if (facts.length) {
      next.factsByRung[rung.id] = facts;
      seen.push(...facts);
    }
  }
  return { progress: next, earned };
}

/**
 * Claim a reward: it has been seen, and it leaves the queue.
 *
 * Idempotent, because the accept control can be pressed twice before the
 * card has finished leaving. A claim never re-runs and never re-awards.
 */
/**
 * Claim a rung.
 *
 * `shown` is false for a reward that was filed without a card — a second
 * finger trap is still owed to the refiner and still goes on the shelf,
 * but showing the same object twice reads as the game repeating itself
 * rather than rewarding them again.
 */
export function claimReward(
  p: Progress,
  id: string,
  opts: { shown: boolean; rewardId?: string } = { shown: true },
): Progress {
  if (p.rewardState[id] === "claimed") return p;
  // Whatever was read out is now heard, and will not come round again.
  const heard = p.factsByRung[id] ?? [];
  const seenFactIds = [...p.seenFactIds];
  for (const f of heard) if (!seenFactIds.includes(f)) seenFactIds.push(f);
  return {
    ...p,
    rewardState: { ...p.rewardState, [id]: "claimed" },
    rewardQueue: p.rewardQueue.filter((q) => q !== id),
    seenFactIds,
    lastShownRewardId: opts.shown
      ? (opts.rewardId ?? p.lastShownRewardId)
      : p.lastShownRewardId,
  };
}

/** Someone opened a claimed incentive on the shelf and looked at it. */
export function inspectReward(p: Progress, rewardId: string): Progress {
  return {
    ...p,
    inspectCounts: {
      ...p.inspectCounts,
      [rewardId]: (p.inspectCounts[rewardId] ?? 0) + 1,
    },
  };
}

// ── persistence ──────────────────────────────────────────────────────

function coerce(raw: unknown): Progress {
  const base = emptyProgress();
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Partial<Progress>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  const ids = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const binsByTemper = { ...base.binsByTemper };
  const saved = p.binsByTemper;
  if (saved && typeof saved === "object") {
    for (const t of TEMPERS) binsByTemper[t] = num(saved[t], 0);
  }

  const rewardState: Record<string, RewardState> = {};
  if (p.rewardState && typeof p.rewardState === "object") {
    for (const [id, state] of Object.entries(p.rewardState)) {
      if (
        state === "earned_pending" ||
        state === "presenting" ||
        state === "claimed"
      ) {
        // A reward caught mid-ceremony by a force quit comes back as owed,
        // not as shown: "presenting" is never a resting state.
        rewardState[id] = state === "presenting" ? "earned_pending" : state;
      }
    }
  }

  const queue = ids(p.rewardQueue).filter(
    (id) => rewardState[id] === "earned_pending",
  );
  // Anything owed but missing from the queue is put back on the end of it,
  // so a partial write can lose the order of a celebration but never the
  // celebration itself.
  for (const [id, state] of Object.entries(rewardState)) {
    if (state === "earned_pending" && !queue.includes(id)) queue.push(id);
  }

  const factsByRung: Record<string, string[]> = {};
  if (p.factsByRung && typeof p.factsByRung === "object") {
    for (const [rung, list] of Object.entries(p.factsByRung)) {
      const clean = ids(list);
      if (clean.length) factsByRung[rung] = clean;
    }
  }

  const inspectCounts: Record<string, number> = {};
  if (p.inspectCounts && typeof p.inspectCounts === "object") {
    for (const [id, n] of Object.entries(p.inspectCounts)) {
      inspectCounts[id] = num(n, 0);
    }
  }

  const credited = ids(p.creditedLevelIds);
  return {
    version: VERSION,
    screensCompleted: num(p.screensCompleted, 0),
    // Saves written before files existed have no count. Derived from the
    // credited level ids rather than guessed at: the level table knows
    // which file each id belongs to, so the answer is exact — and a
    // refiner who was mid-orientation does not come back owed six
    // incentives or none.
    filesCompleted:
      p.filesCompleted === undefined
        ? filesAmong(credited)
        : num(p.filesCompleted, 0),
    binsTotal: num(p.binsTotal, 0),
    binsByTemper,
    creditedLevelIds: credited,
    perfectScreensTotal: num(p.perfectScreensTotal, 0),
    perfectScreenStreak: num(p.perfectScreenStreak, 0),
    rewardState,
    rewardQueue: queue,
    seenFactIds: ids(p.seenFactIds),
    factsByRung,
    inspectCounts,
    lastShownRewardId:
      typeof p.lastShownRewardId === "string" ? p.lastShownRewardId : null,
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    return coerce(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* Storage unavailable — the ledger lasts only this session. */
  }
}

/**
 * Credit a completed screen and persist the result in one step.
 *
 * Persistence happens before the caller can draw anything, which is the
 * order the reward contract requires: earned state reaches storage ahead
 * of the ceremony that announces it.
 */
export function creditScreen(done: Completion): Progress {
  const { progress } = applyCompletion(loadProgress(), done);
  saveProgress(progress);
  return progress;
}

/** Persisted `claimed`, the moment the refiner accepts. */
export function claim(
  p: Progress,
  id: string,
  opts: { shown: boolean; rewardId?: string } = { shown: true },
): Progress {
  const next = claimReward(p, id, opts);
  saveProgress(next);
  return next;
}

/** Persisted inspection, so the equal-enjoyment audit has something to
 *  be disappointed about later. */
export function inspect(p: Progress, rewardId: string): Progress {
  const next = inspectReward(p, rewardId);
  saveProgress(next);
  return next;
}
