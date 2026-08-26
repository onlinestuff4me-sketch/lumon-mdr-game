import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getAudio } from "../audio/AudioEngine";
import { haptics } from "../audio/haptics";
import { LEVELS } from "../game/constants";
import { loadArchive, recordCompletion } from "../game/archive";
import {
  claim,
  creditScreen,
  inspect,
  loadProgress,
  type Progress,
} from "../game/progress";
import { presentable } from "../game/catalog";
import { factById, type Fact } from "../game/facts";
import { rungById } from "../game/rewards";
import { RewardReveal } from "./RewardReveal";
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
import { ControlDeck } from "./ControlDeck";
import { CRTOverlay } from "./CRTOverlay";
import { HandbookModal } from "./HandbookModal";
import { HUD } from "./HUD";
import { PhaseOverlay } from "./PhaseOverlay";
import { Viewport } from "./Viewport";

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

  /**
   * What this boundary owes the refiner, in the order it will be shown.
   *
   * Derived from the ledger rather than stored: the queue in the save is
   * the truth, and a second copy in React state is a second thing that can
   * be wrong after a reload.
   *
   * Two rules shape it. A reward whose presentation is a later milestone —
   * the fact cards, the Wellness sessions, the dance experience, the Waffle
   * tiers — stays in the queue untouched rather than being claimed unseen.
   * And at most one major event presents per boundary: a second one waits
   * for the next completed screen instead of running back to back.
   */
  const owed = (() => {
    const out: {
      rungId: string;
      reward: NonNullable<ReturnType<typeof presentable>>;
      facts: Fact[];
    }[] = [];
    let majorShown = false;
    for (const id of progress.rewardQueue) {
      const rung = rungById(id);
      if (!rung) continue;
      const reward = presentable(rung.reward);
      if (!reward) continue;
      if (rung.size !== "minor") {
        if (majorShown) continue;
        majorShown = true;
      }
      // Chosen and stored when the reward was earned; looked up here, never
      // drawn here.
      const facts = (progress.factsByRung[id] ?? [])
        .map(factById)
        .filter((f): f is Fact => !!f);
      out.push({ rungId: id, reward, facts });
    }
    return out;
  })();

  // Only between files, never over a live board.
  const revealing = hud.phase === "complete" && owed.length > 0;

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
  const boundary = `${hud.levelIndex}:${progress.screensCompleted}`;
  const [accepted, setAccepted] = useState({ boundary: "", n: 0 });
  const acceptedHere = accepted.boundary === boundary ? accepted.n : 0;
  const stackTotal = owed.length + acceptedHere;
  const stackIndex = acceptedHere + 1;

  const openHandbook = useCallback(() => {
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
  }, [engine]);

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
    engine.setPaused(handbook || revealing);
  }, [engine, handbook, revealing]);

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
      setProgress(
        creditScreen({
          levelId: level.id,
          tempers: level.tempers,
          quota: level.quota,
          perfect: engine.perfect,
          countsForPerfect: (level.showBins ?? level.tempers).length > 1,
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
  const layout = computeLayout(size.w, size.h, hud.activeTempers);
  const live =
    hud.phase === "probe" || hud.phase === "select" || hud.phase === "carry";

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

        <div className="relative flex h-full w-full flex-col">
          <HUD hud={hud} height={layout.hudH} />
          {/* The coach line sits directly under the HUD, not above the
              control deck. At the bottom of the screen it was underneath
              the hand that was holding the phone — unreadable exactly while
              the player was doing the thing it describes. */}
          <StatusTicker hud={hud} height={layout.tickerH} />
          {/* Above the board, not below it: down between the matrix and the
              bins the deck sat across the path every packet is dragged
              along. Nothing here is pressed during play. */}
          <ControlDeck
            hud={hud}
            height={layout.deckH}
            onMode={(m) => {
              void getAudio().unlock();
              engine.setMode(m);
            }}
            onHandbook={openHandbook}
          />
          <div className="flex-1" />
          <div className="shrink-0" style={{ height: layout.binsH }} />
        </div>

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
          onHandbook={openHandbook}
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
              setProgress((p) => claim(p, id));
              setAccepted((a) =>
                a.boundary === boundary
                  ? { boundary, n: a.n + 1 }
                  : { boundary, n: 1 },
              );
            }}
          />
        ) : revealing ? (
          <RewardReveal
            // Remount per card: a new incentive starts sealed, and a key is
            // how React is told these are different cards rather than the
            // same card with different contents.
            key={owed[0].rungId}
            reward={owed[0].reward}
            facts={owed[0].facts}
            index={stackIndex}
            total={stackTotal}
            muted={hud.muted}
            onAccept={() => {
              const id = owed[0].rungId;
              setProgress((p) => claim(p, id));
              setAccepted((a) =>
                a.boundary === boundary
                  ? { boundary, n: a.n + 1 }
                  : { boundary, n: 1 },
              );
            }}
          />
        ) : null}

        {/* Below the coach band, not inside it: at hudH + 6 this badge sat
            on top of the ticker and clipped the line telling the player what
            to do — which is exactly the line a first-time player needs. */}
        {live && !hud.audioReady ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
            style={{ top: layout.grid.y + 4 }}
          >
            <span className="rounded-[2px] border border-phos-700 bg-phos-950/85 px-2 py-0.5 text-[8px] tracking-[0.16em] text-phos-600">
              TAP TO ENABLE TERMINAL AUDIO
            </span>
          </div>
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
