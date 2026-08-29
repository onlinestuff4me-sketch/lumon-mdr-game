/**
 * Save runs: separate attempts at the quarter, kept across sittings.
 *
 * A run is a bookmark, not a snapshot — it records how far an attempt has
 * got (the furthest file completed), never the state of a half-played
 * board, because a file is short enough to replay and a mid-file save
 * would have to be invalidated by every tuning change we ship. The
 * archive (declassified addenda) deliberately stays global and is not
 * part of a run: a document once read has been read, whichever attempt
 * read it.
 *
 * Reads and writes are guarded like the other stores: localStorage throws
 * outright in private windows and with site data blocked, and a lost save
 * must never stop the terminal booting.
 */

export interface RunMeta {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Furthest level index completed in this run; -1 before the first. */
  furthest: number;
}

export interface RunStore {
  active: string | null;
  runs: RunMeta[];
}

import { ARCHIVE_KEY } from "./archive";
import { PROGRESS_KEY } from "./progress";
import { adopt, setRunScope } from "./runScope";

const KEY = "lumon.mdr.runs.v1";
/** Old saves are dropped beyond this many — a list of every attempt ever
 *  made stops being a list anyone can choose from. Newest kept. */
const MAX_RUNS = 10;

function empty(): RunStore {
  scopeTo(null);
  return { active: null, runs: [] };
}

function write(store: RunStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* Storage unavailable — the run lasts only this session. */
  }
}

/**
 * Point the archive and the ledger at a run, and let the first one adopt
 * whatever a pre-slots build left behind.
 *
 * Called from every function here that can change which run is active, so
 * no caller has to remember to do it and no read can happen against the
 * wrong slot.
 */
function scopeTo(id: string | null): void {
  setRunScope(id);
  if (id === null) return;
  adopt(ARCHIVE_KEY, id);
  adopt(PROGRESS_KEY, id);
}

export function loadRuns(): RunStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<RunStore>;
    const runs = Array.isArray(parsed.runs)
      ? parsed.runs.filter(
          (r): r is RunMeta =>
            !!r &&
            typeof r.id === "string" &&
            typeof r.createdAt === "number" &&
            typeof r.updatedAt === "number" &&
            typeof r.furthest === "number",
        )
      : [];
    const active =
      typeof parsed.active === "string" && runs.some((r) => r.id === parsed.active)
        ? parsed.active
        : null;
    scopeTo(active);
    return { active, runs };
  } catch {
    return empty();
  }
}

export function activeRun(store: RunStore): RunMeta | null {
  return store.runs.find((r) => r.id === store.active) ?? null;
}

/** Where a run picks back up: one past its furthest completed file. */
export function continueIndex(run: RunMeta, levelCount: number): number {
  return Math.max(0, Math.min(levelCount - 1, run.furthest + 1));
}

/**
 * Record that the active run completed this file. Creates a run if none is
 * active — which is also the migration path for a terminal that has an old
 * global archive but no runs: its first completion after this ships simply
 * becomes its first run, already at the right file.
 */
export function recordRunProgress(levelIndex: number): RunStore {
  const store = loadRuns();
  let run = activeRun(store);
  if (!run) {
    run = {
      id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      furthest: -1,
    };
    store.runs.push(run);
    store.active = run.id;
  }
  // Furthest, not latest: replaying an early file must not move the
  // bookmark backwards.
  run.furthest = Math.max(run.furthest, levelIndex);
  run.updatedAt = Date.now();
  write(store);
  return store;
}

/** A fresh attempt from the very beginning, made active. */
export function startNewRun(): RunStore {
  const store = loadRuns();
  const run: RunMeta = {
    id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    furthest: -1,
  };
  store.runs.push(run);
  store.active = run.id;
  // A fresh slot, before anything can read from it. Nothing is adopted
  // into a run that did not exist a moment ago — only the *first* run a
  // legacy save meets takes that data, and this one is not it unless it
  // is also the first.
  scopeTo(run.id);
  // Trim the oldest once over the cap — by last touch, not creation, so an
  // attempt someone keeps returning to is never the one that falls off.
  if (store.runs.length > MAX_RUNS) {
    store.runs.sort((a, b) => b.updatedAt - a.updatedAt);
    store.runs.length = MAX_RUNS;
  }
  write(store);
  return store;
}

/** Make a previous attempt the active one. */
export function selectRun(id: string): RunStore {
  const store = loadRuns();
  if (store.runs.some((r) => r.id === id)) {
    store.active = id;
    scopeTo(id);
    const run = activeRun(store);
    if (run) run.updatedAt = Date.now();
    write(store);
  }
  return store;
}
