import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getAudio } from "../audio/AudioEngine";
import { haptics } from "../audio/haptics";
import { computeLayout } from "../game/layout";
import { useEngine } from "../hooks/useEngine";
import { BinDeck } from "./BinDeck";
import { ControlDeck } from "./ControlDeck";
import { CRTOverlay } from "./CRTOverlay";
import { HandbookModal } from "./HandbookModal";
import { HUD } from "./HUD";
import { PhaseOverlay } from "./PhaseOverlay";
import { Viewport } from "./Viewport";

export function GameStage() {
  const { engine, hud } = useEngine();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const [size, setSize] = useState({ w: 360, h: 640 });
  const [handbook, setHandbook] = useState(false);

  // The shift clock stops while a modal owns the screen.
  useEffect(() => {
    engine.setPaused(handbook);
  }, [engine, handbook]);

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

  const layout = computeLayout(size.w, size.h);
  const live =
    hud.phase === "probe" || hud.phase === "select" || hud.phase === "carry";

  const start = useCallback(() => {
    void getAudio().unlock();
    haptics.markActivated();
    engine.startLevel(0);
  }, [engine]);

  // Dev-only handle so the play-through harness can assert on real state.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
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
          <div className="flex-1" />
          <StatusTicker hud={hud} />
          <ControlDeck
            hud={hud}
            height={layout.deckH}
            onMode={(m) => {
              void getAudio().unlock();
              engine.setMode(m);
            }}
            onHandbook={() => setHandbook(true)}
          />
          <div style={{ height: layout.binsH }} />
        </div>

        <BinDeck bins={hud.bins} layout={layout} />

        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
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
          onContextMenu={(ev) => ev.preventDefault()}
        />

        <CRTOverlay glitch={hud.glitch} />
        {handbook ? (
          <HandbookModal
            onClose={() => setHandbook(false)}
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
          />
        ) : null}

        {/* Rendered last, and above the handbook: if the shift expires
            while the handbook is open, RETRY FILE must not be trapped
            behind the drawer's scrim. */}
        <PhaseOverlay
          hud={hud}
          onStart={start}
          onNext={() => engine.nextLevel()}
          onRestart={() => engine.restart()}
          onNewQuarter={() => engine.restartQuarter()}
        />

        {live && !hud.audioReady ? (
          <div className="pointer-events-none absolute inset-x-0 z-40 flex justify-center" style={{ top: layout.hudH + 6 }}>
            <span className="rounded-[2px] border border-phos-700 bg-phos-950/85 px-2 py-0.5 text-[8px] tracking-[0.16em] text-phos-600">
              TAP TO ENABLE TERMINAL AUDIO
            </span>
          </div>
        ) : null}
      </div>
    </Viewport>
  );
}

function StatusTicker({ hud }: { hud: ReturnType<typeof useEngine>["hud"] }) {
  if (!hud.message) return null;
  const color =
    hud.messageKind === "error"
      ? "text-alarm border-alarm/60"
      : hud.messageKind === "praise"
        ? "text-phos-200 border-phos-400/70"
        : "text-phos-400 border-phos-600/70";
  return (
    <div className="pointer-events-none relative z-20 flex justify-center px-3 pb-1">
      <span
        className={`crt-text-glow max-w-full truncate rounded-[2px] border bg-phos-950/90 px-2 py-1 text-[9px] tracking-[0.14em] ${color}`}
      >
        {hud.message}
      </span>
    </div>
  );
}
