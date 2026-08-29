/**
 * Which save slot the archive and the incentive ledger belong to.
 *
 * Three stores back a session: the run list (`runs.ts`), the archive of
 * files refined (`archive.ts`), and the incentive ledger (`progress.ts`).
 * Only the first was ever per-run — the other two were global, so starting
 * a new save handed the refiner a terminal that already knew every file
 * they had ever refined and every incentive they had ever kept. A new save
 * has to be new.
 *
 * The scope is a module-level id rather than a parameter threaded through
 * every read and write because that is what it is: one active slot at a
 * time, set when the run changes, read by whichever store is asked. It is
 * set in exactly one place — `GameStage`, whenever the run store moves —
 * and the tests set it directly.
 */

let active: string | null = null;

export function setRunScope(id: string | null): void {
  active = id;
}

export function runScope(): string | null {
  return active;
}

/**
 * The storage key for `base` under the active run.
 *
 * With no active run — the very first boot, before anything has been
 * started — reads and writes fall back to the legacy global key, which is
 * also where a save written before slots existed lives. `adopt` below is
 * what moves that data into the first slot rather than leaving it to be
 * shared by every future one.
 */
export function scopedKey(base: string): string {
  return active === null ? base : `${base}.${active}`;
}

/**
 * Move a legacy global store into a run, once.
 *
 * A refiner who has been playing has an archive and a ledger under the old
 * unscoped keys. The first run to ask for them takes them; every run after
 * that starts empty. The legacy key is cleared on adoption so a second run
 * cannot inherit the same history.
 */
export function adopt(base: string, id: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const scoped = `${base}.${id}`;
    if (localStorage.getItem(scoped) !== null) return;
    const legacy = localStorage.getItem(base);
    if (legacy === null) return;
    localStorage.setItem(scoped, legacy);
    localStorage.removeItem(base);
  } catch {
    /* Storage unavailable — nothing to adopt, and nothing to lose. */
  }
}

/** Forget a run's stores entirely. */
export function dropScope(base: string, id: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(`${base}.${id}`);
  } catch {
    /* Storage unavailable. */
  }
}
