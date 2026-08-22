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

const KEY = "lumon.mdr.archive.v1";

export function loadArchive(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY);
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
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* Storage unavailable — the archive lasts only this session. */
  }
  return next;
}
