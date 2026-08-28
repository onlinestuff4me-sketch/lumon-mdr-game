import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getAudio } from "../audio/AudioEngine";
import { haptics } from "../audio/haptics";
import { LEVELS } from "../game/constants";
import { loadArchive, recordCompletion } from "../game/archive";
import {
  claim,
  creditScreen,
  fileCredited,
  inspect,
  loadProgress,
  type Progress,
} from "../game/progress";
import { presentable } from "../game/catalog";
import { factById, type Fact } from "../game/facts";
import { LADDER, rungById } from "../game/rewards";
import { RewardReveal } from "./RewardReveal";
import { RecordNotice } from "./RecordNotice";
import { IncentiveSummary } from "./IncentiveSummary";
import { MdeStage } from "./MdeStage";
import {
  loadRuns,
  recordRunProgress,
  startNewRun,
  selectRun,
  continueIndex,
  type RunStore,
} from "../game/runs";
import { computeLayout } from "../game/layout";
import { useEngine } from "../hooks/useEngine";
import { BinDeck } from "./BinDeck";
import { CRTOverlay } from "./CRTOverlay";
import { HandbookModal } from "./HandbookModal";
import { HUD } from "./HUD";
import { IncentiveRecordBox } from "./IncentiveRecordBox";
import { PhaseOverlay } from "./PhaseOverlay";
import { Viewport } from "./Viewport";

/**
 * The next rung of the precision lane above a given run of clean files.
 *
 * Used only to tell a refiner who has just broken one what the next
 * commendation costs, in files rather than in jargon.
 */
function nextPerfectTarget(from: number): number | null {
  const targets = LADDER.filter((r) => r.lane === "perfect")
    .map((r) => r.at)
    .sort((a, b) => a - b);
  return targets.find((n) => n > from) ?? targets[0] ?? null;
}

/** A stable seed per rung, so the same session rebuilds the same floor. */
function hashRung(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function GameStage() {
  const { engine, hud } = useEngine();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [handbook, setHandbook] = useState(false);
  const [archive, setArchive] = useState<ReadonlySet<string>>(loadArchive);
  const [runStore, setRunStore] = useState<RunStore>(loadRuns);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  // The completion effect reads the ledger but must not re-run when the
  // ledger changes — it *is* what changes it.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  /**
   * What this boundary owes the refiner, in the order it will be shown —
   * and what it quietly files instead.
   *
   * Derived from the ledger rather than stored: the queue in the save is
   * the truth, and a second copy in React state is a second thing that can
   * be wrong after a reload.
   *
   * Five rules, four of them learned from watching someone play screen 9
   * and be handed the same picture three times:
   *
   * 1. A reward whose presentation is a later milestone stays queued
   *    rather than being claimed unseen.
   * 2. At most one major event per boundary. A second waits for the next
   *    completed screen instead of running back to back.
   * 3. One card per reward *id* per boundary. Two rungs that both award a
   *    fact card are two facts, not two ceremonies.
   * 4. Never two rewards showing the *same picture* in a row, nor the same
   *    reward that ended the last boundary. Every fact card and every
   *    Wellness session is the same plate, so those count as one look —
   *    two of them back to back read as the game stuttering rather than as
   *    two rewards. Two different objects are two different photographs
   *    and sit together fine.
   * 5. An **object** already on the shelf is not shown again. A second
   *    finger trap is still owed and still counted, but a repeat of the
   *    same photograph is the game repeating itself. It is filed instead,
   *    and the record says so.
   */
  const { owed, toFile } = (() => {
    const queue: {
      rungId: string;
      rewardId: string;
      /** The rung itself, for the line on the sealed card saying why. */
      rung: NonNullable<ReturnType<typeof rungById>>;
      reward: NonNullable<ReturnType<typeof presentable>>;
      major: boolean;
      facts: Fact[];
    }[] = [];
    const toFile: { rungId: string; rewardId: string; name: string }[] = [];
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
    // one's kind or id. Anything that cannot be spaced out stays queued for
    // a later boundary rather than being dropped.
    /** What a refiner would say they had just looked at. */
    const look = (r: NonNullable<ReturnType<typeof presentable>>) =>
      r.kind === "fact" || r.kind === "session" ? "WELLNESS" : r.poster;

    const out: typeof queue = [];
    const usedIds = new Set<string>();
    let majorShown = false;
    let lastLook: string | null = null;
    let lastId: string | null = progress.lastShownRewardId;
    const rest = [...queue];
    for (;;) {
      const i = rest.findIndex(
        (c) =>
          !usedIds.has(c.rewardId) &&
          !(c.major && majorShown) &&
          look(c.reward) !== lastLook &&
          c.rewardId !== lastId,
      );
      if (i < 0) break;
      const [pick] = rest.splice(i, 1);
      out.push(pick);
      usedIds.add(pick.rewardId);
      if (pick.major) majorShown = true;
      lastLook = look(pick.reward);
      lastId = pick.rewardId;
    }
    return { owed: out, toFile };
  })();

  /**
   * Only between files, never over a live board — and never over a board
   * whose meters are still filling. The last packet completes the file on
   * the frame it lands, so a card keyed to the phase alone covered four
   * bins and a header still animating to 100%: the refiner did the work
   * and never saw it finish. `hud.settled` is the engine's word for "the
   * meters are done, cover me".
   */
  const revealing = hud.phase === "complete" && hud.settled && owed.length > 0;

  /**
   * Which card of this boundary's stack is on screen — `INCENTIVE 1 OF 2`,
   * then `2 OF 2`.
   *
   * Counted rather than measured, because `owed` shrinks as cards are
   * accepted: reading the length live would relabel the second card of a
   * pair as the only one, and that count is the whole reason a refiner
   * knows not to read the first dismissal as the end of the payout.
   *
   * Keyed by the boundary it belongs to — this screen, this completion —
   * so it resets itself when the next one opens without an effect to clear
   * it.
   */
  /**
   * True when the file on screen has already been credited.
   *
   * Counters are monotonic and credit once, so replaying a file earns
   * nothing — which is correct, and was being reported as though it were
   * not. A refiner who came back to a save and walked back through
   * orientation watched REFINE 2 MORE FILES sit unchanged for a dozen
   * screens, because every one of those files was already in the ledger.
   */
  const [arrived, setArrived] = useState({ level: -1, credited: false });
  useEffect(() => {
    // Asked on arrival, not continuously. By the time the completion panel
    // is drawn the file has just been credited, so a live check would
    // report "already refined" about the file the refiner has this second
    // finished — the question is whether it was done *before* they got
    // here.
    setArrived({
      level: hud.levelIndex,
      credited: fileCredited(hud.levelIndex, progressRef.current),
    });
  }, [hud.levelIndex]);
  const replaying = arrived.level === hud.levelIndex && arrived.credited;

  const boundary = `${hud.levelIndex}:${progress.filesCompleted}`;
  const [accepted, setAccepted] = useState<{
    boundary: string;
    names: string[];
  }>({ boundary: "", names: [] });

  /**
   * The ledger as it stood when this boundary opened, so the landing
   * screen can animate the count and the meter from what the refiner had
   * to what they now have. Captured on the first render of the boundary
   * and never again — `progress` is deliberately not a dependency, since
   * the whole value of this is that it does *not* follow the claims.
   */
  const [before, setBefore] = useState<{ boundary: string; progress: Progress }>({
    boundary: "",
    progress,
  });
  useEffect(() => {
    if (hud.phase !== "complete") return;
    setBefore((b) => (b.boundary === boundary ? b : { boundary, progress }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.phase, boundary]);

  /**
   * The beat after the last card of a boundary has been filed: what was
   * filed, where it went, and what the next incentive costs. It holds the
   * board the way a card does — most of orientation advances itself, and
   * a landing that wipes with the screen teaches nobody where anything
   * is.
   */
  const [landed, setLanded] = useState<{ boundary: string; names: string[] } | null>(
    null,
  );
  const landing = landed?.boundary === boundary ? landed : null;
  const acceptedNames = accepted.boundary === boundary ? accepted.names : [];
  const acceptedHere = acceptedNames.length;
  const stackTotal = owed.length + acceptedHere;
  const stackIndex = acceptedHere + 1;

  /**
   * A second issue of something already on the shelf goes straight into
   * the record — no card, but never silently: the block names it, so the
   * refiner sees that the terminal noticed.
   */
  const [filedNote, setFiledNote] = useState<{ boundary: string; names: string[] }>({
    boundary: "",
    names: [],
  });
  /**
   * A run of clean files that a wrong bin has just closed.
   *
   * Told plainly, because the alternative is a counter that silently went
   * back to nothing: the refiner is owed the fact that a commendation just
   * moved further away, and what it now takes to reach it.
   */
  const [broken, setBroken] = useState<{
    levelId: string;
    at: number;
    needs: number;
  } | null>(null);
  // Keyed by the file it happened on, not by a screen count: the count is
  // what the completion is about to change, so a note keyed to it would
  // never match the panel it was written for.
  const brokenHere =
    broken?.levelId === LEVELS[hud.levelIndex]?.id ? broken : null;
  /**
   * The notice waits its turn behind any incentives: good news first, and
   * one thing on the screen at a time. Like a reward, it holds the board —
   * most of orientation advances itself, and a notice that wipes with the
   * screen is a notice nobody read.
   */
  const noticing =
    hud.phase === "complete" && hud.settled && !revealing && brokenHere !== null;
  const filedHere = filedNote.boundary === boundary ? filedNote.names : [];
  const toFileNames = useRef<string[]>([]);
  toFileNames.current = toFile.map((f) => f.name);
  const fileKey = toFile.map((f) => f.rungId).join(",");
  useEffect(() => {
    if (hud.phase !== "complete" || !fileKey) return;
    const pending = fileKey.split(",");
    setFiledNote({ boundary, names: toFileNames.current });
    for (const rungId of pending) {
      setProgress((p) => claim(p, rungId, { shown: false }));
    }
    // `toFile` is derived from the queue this effect drains, so it is read
    // through a ref rather than depended on: naming it as a dependency
    // would re-run the effect against a list it had just emptied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.phase, fileKey, boundary]);


  const [handbookAt, setHandbookAt] = useState<"top" | "shelf" | "settings">(
    "top",
  );
  const openHandbook = useCallback(
    (at: "top" | "shelf" | "settings" = "top") => {
    setHandbookAt(at);
    // Read the archive here rather than tracking it in an effect: the
    // drawer is the only thing that renders it, and it is unmounted until
    // this runs, so opening it is the one moment the value is needed.
    setArchive(loadArchive());
    // Paused in the same handler that opens the drawer, not in an effect
    // afterwards: the drawer sits above the phase overlay, and a passive
    // effect leaves a frame in which the clock could expire and render the
    // fail screen underneath it.
    engine.setPaused(true);
    setHandbook(true);
    },
    [engine],
  );

  // Closing is the mirror of opening: unpausing here would drain a frame of
  // clock under a drawer that is still on screen, so the resume is left to
  // the effect below, which runs after the drawer has actually gone.
  const closeHandbook = useCallback(() => {
    setHandbook(false);
  }, []);

  // Reconciles every reason the game might be held, and is the sole resume
  // path. The reveal uses the same pause the handbook does, which is what
  // suspends the orientation screens' 900ms auto-advance: the cleared board
  // stays put and the next file does not begin loading behind a
  // celebration.
  useEffect(() => {
    engine.setPaused(handbook || revealing || noticing || landing !== null);
  }, [engine, handbook, revealing, noticing, landing]);

  // ── canvas attach + sizing ──────────────────────────────────────────
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const overlay = overlayRef.current;
    const stage = stageRef.current;
    if (!grid || !overlay || !stage) return;

    engine.attach(grid, overlay);

    let pending = 0;
    const schedule = () => {
      if (pending) return;
      // Coalesce bursts (a window drag, a collapsing toolbar) into one
      // measurement per frame: each one can rebuild the glyph atlas.
      pending = requestAnimationFrame(() => {
        pending = 0;
        measure();
      });
    };

    const measure = () => {
      const rect = stage.getBoundingClientRect();
      rectRef.current = rect;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w <= 0 || h <= 0) return;
      engine.resize(w, h, window.devicePixelRatio || 1);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(stage);
    window.addEventListener("orientationchange", schedule);
    // M11: a pinched visual viewport shifts and scales the rendered pixels
    // while clientX/Y stay in layout-viewport space, which desynchronises
    // the reticle from the finger. Re-measure whenever it moves.
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);

    // devicePixelRatio can change when a window moves between displays.
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDpr);
      dprQuery = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      dprQuery.addEventListener("change", onDpr);
    };
    const onDpr = () => {
      schedule();
      watchDpr();
    };
    watchDpr();

    return () => {
      if (pending) cancelAnimationFrame(pending);
      ro.disconnect();
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      dprQuery?.removeEventListener("change", onDpr);
      engine.detach();
    };
  }, [engine]);

  // ── the archive: one addendum declassified per refined file ─────────
  // Keyed off the completion phase rather than off the NEXT FILE button so
  // the addendum is filed the moment it is earned; a player who closes the
  // tab on the completion screen keeps it. Writing to storage is the whole
  // effect — nothing on screen reads the archive until the handbook opens,
  // and that path loads it fresh.
  useEffect(() => {
    if (hud.phase !== "complete") return;
    const level = LEVELS[hud.levelIndex];
    if (level) recordCompletion(level.id);
    // The run's bookmark moves with the archive, in the same moment and
    // for the same reason: closing the tab on the completion screen must
    // lose nothing.
    setRunStore(recordRunProgress(hud.levelIndex));
    // ── the incentive ledger ─────────────────────────────────────────
    // Same boundary, same reason, and deliberately before anything is
    // drawn: a threshold crossed here is written to storage as owed, so a
    // tab closed on the completion screen loses the ceremony and keeps the
    // reward. The ledger credits a level id once, which is what makes this
    // safe to run on a re-render and safe on a replayed file.
    if (level) {
      // Read before crediting: the ledger is about to reset the run.
      const hadClean = progressRef.current.perfectScreenStreak;
      // The last stage of a file is the one that credits it. Bins are
      // still credited every stage — a group binned is a group binned —
      // but a file is only refined once all of it is.
      const fileComplete = level.stage ? level.stage[0] === level.stage[1] : true;
      const counts = engine.fileCounts && fileComplete;
      if (counts && !engine.filePerfect && hadClean > 0) {
        const needs = nextPerfectTarget(hadClean) ?? 3;
        setBroken({ levelId: level.id, at: hadClean, needs });
      }
      setProgress(
        creditScreen({
          levelId: level.id,
          tempers: level.tempers,
          quota: level.quota,
          perfect: engine.filePerfect,
          countsForPerfect: engine.fileCounts,
          fileComplete,
        }),
      );
    }
  }, [hud.phase, hud.levelIndex, engine]);

  // ── page visibility: stop the loop, the drones and the buzzing ──────
  useEffect(() => {
    const onVis = () => engine.setPageVisible(!document.hidden);
    // A bfcache restore (iOS back-swipe, Android back) does not reliably
    // fire visibilitychange; pageshow does, and without it the terminal
    // comes back frozen on its last painted frame with no way out.
    const onShow = () => engine.setPageVisible(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onVis);
      window.removeEventListener("pageshow", onShow);
    };
  }, [engine]);

  // M11: iOS Safari has ignored `user-scalable=no` since iOS 10, and
  // `touch-action` does not suppress its pinch gesture. Only preventing
  // the gesture events does.
  useEffect(() => {
    const block = (ev: Event) => ev.preventDefault();
    const opts = { passive: false } as const;
    document.addEventListener("gesturestart", block, opts);
    document.addEventListener("gesturechange", block, opts);
    document.addEventListener("gestureend", block, opts);
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
    };
  }, []);

  // ── pointer plumbing ────────────────────────────────────────────────
  const toStage = useCallback((ev: React.PointerEvent) => {
    const rect =
      rectRef.current ?? (rectRef.current = ev.currentTarget.getBoundingClientRect());
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }, []);

  const onPointerDown = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      // A secondary mouse button is not a gesture: letting one open a
      // gesture leaves a pointer id whose pointerup may never arrive.
      //
      // `isPrimary` is deliberately NOT tested. Every touch after the first
      // one still down is non-primary, so refusing them made a thumb
      // resting anywhere on the screen — the bezel of a phone held in one
      // hand — silently kill every tap for as long as it stayed there, with
      // no timeout that could rescue it. What protects the in-flight
      // gesture is the engine's single-gesture guard, which now hands a
      // still gesture over to a deliberate second touch rather than
      // discarding it.
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      // Re-measure once per gesture: cheap, and immune to layout shifts
      // caused by the mobile URL bar collapsing mid-session.
      rectRef.current = ev.currentTarget.getBoundingClientRect();
      const p = toStage(ev);
      try {
        ev.currentTarget.setPointerCapture(ev.pointerId);
      } catch {
        /* capture is best-effort */
      }
      engine.pointerDown(ev.pointerId, p.x, p.y);
    },
    [engine, toStage],
  );

  const onPointerMove = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      const p = toStage(ev);
      engine.pointerMove(ev.pointerId, p.x, p.y);
    },
    [engine, toStage],
  );

  const onPointerUp = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      const p = toStage(ev);
      try {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
      engine.pointerUp(ev.pointerId, p.x, p.y);
    },
    [engine, toStage],
  );

  const onPointerCancel = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      engine.pointerCancel(ev.pointerId);
    },
    [engine],
  );

  /**
   * Every way a gesture can end that is not a pointerup on this element.
   * Nothing but a matching release clears the engine's single in-flight
   * gesture, and while one is open every new touch is discarded as a
   * second finger — so a capture lost to a system gesture, or a window
   * that blurs mid-drag, used to leave the board permanently dead.
   */
  useEffect(() => {
    const cancelAll = () => engine.pointerCancel(-1);
    window.addEventListener("blur", cancelAll);
    return () => window.removeEventListener("blur", cancelAll);
  }, [engine]);

  // Same call the engine makes, with the same active tempers, so the bins
  // the player sees are the rects the engine hit-tests.
  // The band order is resolved once inside `layout.ts` and shared with the
  // engine, so the chrome and the hit-testing can never disagree about
  // where the bins are.
  const layout = computeLayout(size.w, size.h, hud.activeTempers);

  const play = useCallback(
    (index: number) => {
      void getAudio().unlock();
      haptics.markActivated();
      engine.startLevel(index);
    },
    [engine],
  );

  // Handle for the test harness to assert on real state.
  //
  // Present in dev, and in a build made with VITE_MDR_TEST=1 — which is a
  // production build in every other respect, so the end-to-end suite runs
  // against minified, bundled code rather than the dev server. It is absent
  // from the artifact that actually ships.
  useEffect(() => {
    if (!import.meta.env.DEV && !import.meta.env.VITE_MDR_TEST) return;
    (window as unknown as { __mdr?: unknown }).__mdr = engine;
    return () => {
      delete (window as unknown as { __mdr?: unknown }).__mdr;
    };
  }, [engine]);

  return (
    <Viewport>
      <div ref={stageRef} className="relative h-full w-full overflow-hidden">
        <canvas
          ref={gridRef}
          className="absolute inset-0 z-10 h-full w-full"
          aria-hidden
        />

        {/* Only the header and the coach line are laid out by flow. The
            bins and the incentives record are placed from the layout's own
            coordinates, so the chrome sits exactly where the engine
            hit-tests it and the gaps between the three bands are the one
            number `layout.gap` says they are. */}
        <div className="relative flex h-full w-full flex-col">
          <HUD
            hud={hud}
            height={layout.hudH}
            onHandbook={() => openHandbook("top")}
            onSettings={() => openHandbook("settings")}
          />
          {/* Variant `b` reserves a band for the record under the header. */}
          {layout.recordAt === "top" ? (
            <div
              className="shrink-0"
              style={{ height: layout.gap + layout.recordH }}
            />
          ) : null}
          {/* The coach line sits directly under the header. At the bottom
              of the screen it was underneath the hand holding the phone —
              unreadable exactly while the player was doing the thing it
              describes. In variant `c` it is drawn over the board's top
              edge instead of taking a band of its own. */}
          {layout.tickerOverGrid ? null : (
            <StatusTicker hud={hud} height={layout.tickerH} />
          )}
        </div>

        {/* Under the bins in `a` and `c`, where a thumb already is and
            where it sits beside the things it counts; under the header in
            `b`, where it is read on the way in. */}
        <div
          className="absolute inset-x-0 z-40 flex items-center px-3"
          style={{ top: layout.recordTop, height: layout.recordH }}
        >
          <IncentiveRecordBox
            progress={progress}
            onOpen={() => openHandbook("shelf")}
            variant="hud"
            landing={acceptedHere > 0}
            filePartial={hud.fileProgress}
            alreadyRefined={replaying}
          />
        </div>

        {/* Variant `c`: the coach line floats on the board's top edge. The
            band is still reserved, but inside the grid rather than out of
            it — the matrix is drawn with that much clearance at the top,
            so nothing reflows and the board keeps a whole band. */}
        {layout.tickerOverGrid ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-30"
            style={{ top: layout.grid.y }}
          >
            <StatusTicker hud={hud} height={layout.tickerH} />
          </div>
        ) : null}

        <BinDeck bins={hud.bins} layout={layout} />

        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 z-45 h-full w-full"
          aria-hidden
        />

        {/* Single input surface for the whole stage. Sits above the bins so
            a packet can be dragged onto them, below the control deck so the
            tactile switches still take taps. */}
        <div
          className="absolute inset-0 z-35"
          style={{ touchAction: "none" }}
          role="application"
          aria-label="Macrodata refinement grid"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerCancel}
          onContextMenu={(ev) => ev.preventDefault()}
        />

        <CRTOverlay glitch={hud.glitch} />
        {handbook ? (
          <HandbookModal
            onClose={closeHandbook}
            assist={hud.assist}
            onAssist={(on) => engine.setAssist(on)}
            muted={hud.muted}
            onMuted={(on) => {
              void getAudio().unlock();
              engine.setMuted(on);
            }}
            hapticsOn={hud.hapticsOn}
            onHaptics={(on) => engine.setHaptics(on)}
            hapticsSupported={haptics.supported}
            pace={hud.pace}
            onPace={(p) => engine.setPace(p)}
            archive={archive}
            levelIndex={hud.levelIndex}
            progress={progress}
            onInspect={(rewardId) => setProgress((p) => inspect(p, rewardId))}
            startAt={handbookAt}
          />
        ) : null}

        {/* The drawer deliberately sits above this (z-70 vs z-60) so it can
            be opened from the briefing and end-of-file screens. What keeps
            RETRY FILE from being trapped behind its scrim is the pause: the
            clock is stopped and input ignored while the drawer is open, so
            no phase can change underneath it. */}
        <PhaseOverlay
          hud={hud}
          progress={progress}
          filed={filedHere}
          onOpenRecord={() => openHandbook("shelf")}
          recordLanding={acceptedHere > 0}
          alreadyRefined={replaying}
          onStart={() => play(0)}
          onNext={() => engine.nextLevel()}
          onRestart={() => engine.restart()}
          onNewQuarter={() => {
            // Back to the briefing, where the saves are read — so the
            // files refined this sitting have to be visible to them.
            setArchive(loadArchive());
            setRunStore(loadRuns());
            engine.restartQuarter();
          }}
          onHandbook={() => openHandbook("top")}
          runStore={runStore}
          onPlay={play}
          onNewSave={() => {
            setRunStore(startNewRun());
            play(0);
          }}
          onLoadRun={(id) => {
            const st = selectRun(id);
            setRunStore(st);
            const run = st.runs.find((r) => r.id === id);
            play(run ? continueIndex(run, LEVELS.length) : 0);
          }}
        />

        {/* Above the phase overlay and the handbook alike: a celebration
            owns the screen while it runs. */}
        {revealing && owed[0].reward.kind === "experience" ? (
          // The dance experience is not a card: it takes the floor, and
          // the floor is the number field the refiner has just cleared.
          <MdeStage
            key={owed[0].rungId}
            reward={owed[0].reward}
            seed={hashRung(owed[0].rungId)}
            muted={hud.muted}
            onDone={() => {
              const id = owed[0].rungId;
              const rewardId = owed[0].rewardId;
              setProgress((p) => claim(p, id, { shown: true, rewardId }));
              const name = owed[0].reward.name;
              setAccepted((a) =>
                a.boundary === boundary
                  ? { boundary, names: [...a.names, name] }
                  : { boundary, names: [name] },
              );
              if (owed.length === 1) {
                setLanded({ boundary, names: [...acceptedNames, name] });
              }
            }}
          />
        ) : revealing ? (
          <RewardReveal
            // Remount per card: a new incentive starts sealed, and a key is
            // how React is told these are different cards rather than the
            // same card with different contents.
            key={owed[0].rungId}
            reward={owed[0].reward}
            rung={owed[0].rung}
            facts={owed[0].facts}
            index={stackIndex}
            total={stackTotal}
            sealed={stackIndex === 1}
            onAccept={() => {
              const id = owed[0].rungId;
              const rewardId = owed[0].rewardId;
              setProgress((p) => claim(p, id, { shown: true, rewardId }));
              const name = owed[0].reward.name;
              setAccepted((a) =>
                a.boundary === boundary
                  ? { boundary, names: [...a.names, name] }
                  : { boundary, names: [name] },
              );
              // The last card of the stack is the one that was seen to
              // fly into the record, so it is the one the landing screen
              // follows.
              if (owed.length === 1) {
                setLanded({ boundary, names: [...acceptedNames, name] });
              }
            }}
          />
        ) : null}

        {/* After the last card, before the board comes back: what was
            kept, what it counts toward, and what earns the next one. It
            stows itself into the header strip on the way out. */}
        {landing && !revealing ? (
          <IncentiveSummary
            from={before.boundary === boundary ? before.progress : progress}
            to={progress}
            names={landing.names}
            onOpenRecord={() => openHandbook("shelf")}
            onResume={() => setLanded(null)}
          />
        ) : null}

        {noticing && brokenHere ? (
          <RecordNotice
            at={brokenHere.at}
            needs={brokenHere.needs}
            onAcknowledge={() => setBroken(null)}
          />
        ) : null}

      </div>
    </Viewport>
  );
}

function StatusTicker({
  hud,
  height,
}: {
  hud: ReturnType<typeof useEngine>["hud"];
  height: number;
}) {
  // The band is always reserved, so an arriving message never reflows the
  // matrix underneath it.
  if (!hud.message) return <div className="shrink-0" style={{ height }} />;
  const color =
    hud.messageKind === "error"
      ? "text-alarm border-alarm/60"
      : hud.messageKind === "praise"
        ? "text-phos-200 border-phos-400/70"
        : "text-phos-400 border-phos-600/70";
  return (
    <div
      className="pointer-events-none relative z-20 flex shrink-0 items-center justify-center overflow-hidden px-3"
      style={{ height }}
    >
      <span
        className={`crt-text-glow max-w-full rounded-[2px] border bg-phos-950/90 px-2 py-1 text-center text-[9px] leading-snug tracking-[0.14em] ${color}`}
      >
        {hud.message}
      </span>
    </div>
  );
}
