/**
 * The refiner's archive: which files have been completed, kept across
 * sittings.
 *
 * This is progress, not preference, so it lives under its own key rather
 * than inside `settings` — a settings migration must never wipe a player's
 * collected addenda. Reads and writes are guarded for the same reason they
 * are there: storage throws outright in private windows and with site data
 * blocked, and a lost archive must never stop the terminal booting.
 */

import { scopedKey } from "./runScope";

/**
 * Scoped to the active save, not global.
 *
 * A new save must not know which files a previous one refined. See
 * `runScope.ts`; `BASE` is also the legacy unscoped key, which the first
 * run adopts so a refiner already playing keeps their archive.
 */
export const ARCHIVE_KEY = "lumon.mdr.archive.v1";
const key = () => scopedKey(ARCHIVE_KEY);

export function loadArchive(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

/** Records a completed file. Returns the new archive so callers can render
 *  from the value they just wrote rather than re-reading storage. */
export function recordCompletion(id: string): ReadonlySet<string> {
  const next = new Set(loadArchive());
  next.add(id);
  try {
    localStorage.setItem(key(), JSON.stringify([...next]));
  } catch {
    /* Storage unavailable — the archive lasts only this session. */
  }
  return next;
}

/**
 * The file to resume at: one past the furthest file completed, clamped to
 * the last one. Deliberately "furthest", not "count" — a player who skipped
 * ahead once should not be sent back to re-earn files they already hold,
 * and a player who replays an early file should not lose their place.
 *
 * Returns 0 when nothing has been refined, which is the briefing's normal
 * start-from-the-beginning case.
 */
export function resumeIndex(
  archive: ReadonlySet<string>,
  levelIds: readonly string[],
): number {
  let furthest = -1;
  levelIds.forEach((id, i) => {
    if (archive.has(id)) furthest = i;
  });
  return Math.min(levelIds.length - 1, furthest + 1);
}
