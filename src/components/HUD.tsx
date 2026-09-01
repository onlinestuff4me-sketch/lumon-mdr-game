import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, CircleHelp, Settings } from "lucide-react";
import type { HudSnapshot } from "../game/engine";
import { categoryProgress } from "../game/held";
import { counters, type Progress } from "../game/progress";
import { forecast } from "../game/rewards";

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = (s / 60) | 0;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The file card: which file this is, how far through it the refiner is,
 * what that progress is buying, and the two doors out of the game.
 *
 * **One meter, not two.** The incentives record used to be a bordered box
 * of its own directly under this one, with a second bar and a second set
 * of numbers — two progress widgets stacked, competing, and only one of
 * them describing anything the refiner was doing right then. It is a line
 * *inside* this card now: the file meter is the bar to watch, and the line
 * under it says what reaching 100% will buy. The full record is one tap
 * away on the link beside it.
 *
 * **And it is not there until it means something.** A refiner who has
 * never been issued an incentive is not told one is coming — the first two
 * arrive unannounced, and the ladder introduces itself once it has already
 * paid out. Until then this is a file card and nothing else, which is also
 * what gives the launch animation a simple object to land on.
 *
 * **It is a footer, not a header.** A refiner drags a packet into a bin
 * and their eyes are on the bin; the bin's meter moves, and so does this
 * one. At the top of the screen this meter moved where nobody was looking.
 *
 * **A file leaves and then the next one arrives.** Finishing a file used
 * to mean watching every bar on the screen snap back to zero at once. It
 * is three separated beats now, and they do not overlap:
 *
 * 1. **It is finished.** REFINED, the border blooming, the meter full —
 *    held on the board for `FILE_SETTLE_S` before any overlay may cover
 *    it, which is the only window this mark has.
 * 2. **It leaves.** The finished card slides out to the left, alone.
 * 3. **The next one arrives.** After a beat of empty card, the new file
 *    slides in from the right at 0%.
 *
 * Overlapped, the two slides read as one shuffle and neither is watched.
 * The gap between them is what makes each a thing that happened.
 */

/** How long the finished file takes to leave. */
const OUT_MS = 620;
/** The empty beat between the two, so they are not one motion. */
const GAP_MS = 220;
/** How long the next file takes to arrive. */
const IN_MS = 660;

/** Everything the card draws about one file, frozen so a leaving file can
 *  keep showing what it was when it left. */
interface Face {
  id: string;
  name: string;
  code: string;
  /** Stages of this file *finished*, and how many there are. */
  done: readonly [number, number] | null;
  pct: number;
  clockText: string;
  urgent: boolean;
}

export function HUD({
  hud,
  height,
  card = false,
  progress,
  landing = false,
  alreadyRefined = false,
  onOpenRecord,
  onHandbook,
  onSettings,
}: {
  hud: HudSnapshot;
  height: number;
  /** Footer card with a border of its own, rather than a full-bleed header. */
  card?: boolean;
  /** The incentive ledger, for the line under the meter. */
  progress: Progress;
  /** True for a beat after the incentive summary has landed here. */
  landing?: boolean;
  /**
   * True when this file has already been credited and cannot pay again.
   *
   * Counters are monotonic and credit once, so a replayed file earns
   * nothing — and a line that goes on saying 1 MORE FILE FOR YOUR NEXT
   * INCENTIVE while the refiner does exactly that is an instruction that
   * cannot work.
   */
  alreadyRefined?: boolean;
  /** Opens the full record. */
  onOpenRecord: () => void;
  onHandbook: () => void;
  onSettings: () => void;
}) {
  const urgent = !hud.untimed && hud.timeLeft <= 15 && hud.phase !== "complete";
  const pct = Math.round(hud.fileProgress * 100);
  const done = pct >= 100;
  const refined = done && hud.phase === "complete";

  const id = `${hud.levelName}#${hud.fileCode}`;
  /**
   * How many of this file's screens are *done*, not which one is open.
   *
   * `hud.stage` is 1-based and names the screen the refiner is on, so the
   * second of three read `2/3` while two thirds of the file was still
   * ahead of them — a fraction that looks like progress and is not. The
   * count is the screens behind them, plus this one when it is finished.
   */
  const stages = hud.stage ?? null;
  const doneStages: readonly [number, number] | null = stages
    ? [Math.min(stages[1], stages[0] - 1 + (hud.progress >= 1 ? 1 : 0)), stages[1]]
    : null;
  const now: Face = {
    id,
    name: hud.levelName,
    code: hud.fileCode,
    done: doneStages,
    pct,
    clockText: hud.untimed ? "--:--" : clock(hud.timeLeft),
    urgent,
  };

  /**
   * Which beat of the handover is playing.
   *
   * `out` — the finished file is leaving and nothing has arrived.
   * `in` — the new file is coming in from the right.
   */
  const [beat, setBeat] = useState<"idle" | "out" | "in">("idle");
  /** The file that has just left, still showing itself finished. */
  const [out, setOut] = useState<Face | null>(null);
  /** True for the frame either card is still parked off its edge. */
  const [parked, setParked] = useState(false);
  const shown = useRef<Face>(now);

  // Declared *before* the sync below, so on the commit that changes files
  // this still reads the file that is leaving. The order of these two is
  // the whole mechanism.
  //
  // Layout, not passive: it has to run before the browser paints, or the
  // arriving file is shown at rest for one frame and then jumps off to the
  // right to begin its slide.
  useLayoutEffect(() => {
    const last = shown.current;
    if (last.id === id) return;
    setOut({
      ...last,
      pct: 100,
      done: last.done ? [last.done[1], last.done[1]] : null,
      clockText: "REFINED",
      urgent: false,
    });
    setBeat("out");
    setParked(true);
    const raf = requestAnimationFrame(() => setParked(false));
    const timers = [
      // Beat two ends: the finished file is gone and the card is empty.
      setTimeout(() => {
        setOut(null);
        setBeat("in");
        setParked(true);
        requestAnimationFrame(() => setParked(false));
      }, OUT_MS + GAP_MS),
      setTimeout(() => setBeat("idle"), OUT_MS + GAP_MS + IN_MS),
    ];
    return () => {
      cancelAnimationFrame(raf);
      for (const t of timers) clearTimeout(t);
    };
  }, [id]);

  useEffect(() => {
    shown.current = now;
  });

  /**
   * What this file's progress is buying, and where the rest of it lives.
   *
   * Owed-aware like the box it replaces: reaching a threshold holds the
   * line at INCENTIVE EARNED until the thing it paid for has been
   * collected, rather than stepping straight on to the next promise.
   */
  const cats = categoryProgress(progress);
  const kept = cats.reduce((n, c) => n + c.have, 0);
  const allTotal = cats.reduce((n, c) => n + c.total, 0);
  const lanes = forecast(counters(progress), new Set(progress.rewardQueue));
  const lane = lanes.length
    ? [...lanes].sort((a, b) => a.remaining - b.remaining)[0]
    : null;
  // Nothing is promised before the first incentive exists. The ladder
  // introduces itself once it has already paid out.
  const showIncentive = card && kept > 0;

  return (
    <div
      data-file-card
      className={`pointer-events-none relative z-40 flex shrink-0 flex-col justify-center ${
        card
          ? `w-full overflow-hidden rounded-[3px] border bg-phos-900/40 px-2.5 ${
              refined ? "border-phos-300" : "border-phos-700"
            }`
          : "border-b border-phos-700/70 bg-phos-950/90 px-3"
      }`}
      style={{
        height,
        // One bloom when the file is finished, and one when the incentive
        // summary lands in here. Both say "this object just received
        // something", which is the same sentence twice.
        animation: landing
          ? "record-dock 900ms ease-out 1"
          : refined
            ? "record-dock 900ms ease-out 1"
            : undefined,
      }}
    >
      {/* The file that has just been refined, on its way out. It leaves at
          100% and stamped REFINED, so the reset the refiner sees is one
          file being replaced by another rather than their progress being
          taken back. */}
      {out ? (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col justify-center px-2.5"
          style={{
            transform: parked ? "translateX(0)" : "translateX(-112%)",
            opacity: parked ? 1 : 0,
            transition: parked
              ? undefined
              : `transform ${OUT_MS}ms cubic-bezier(.5,0,.3,1), opacity ${OUT_MS}ms ease-in`,
          }}
        >
          <FileLines face={out} refined onHandbook={onHandbook} onSettings={onSettings} inert />
        </div>
      ) : null}

      <div
        className="flex flex-col justify-center gap-1"
        style={
          beat === "out"
            ? // Waiting its turn, off to the right and invisible: the
              // finished file leaves alone, which is what makes its
              // leaving a beat rather than half of a crossfade.
              { transform: "translateX(112%)", opacity: 0 }
            : beat === "in"
              ? {
                  transform: parked ? "translateX(112%)" : "translateX(0)",
                  opacity: parked ? 0 : 1,
                  transition: parked
                    ? undefined
                    : `transform ${IN_MS}ms cubic-bezier(.3,0,.2,1), opacity ${IN_MS}ms ease-out`,
                }
              : undefined
        }
      >
        <FileLines
          face={now}
          refined={refined}
          onHandbook={onHandbook}
          onSettings={onSettings}
        />

        {/* What the meter above is buying. Bold, because it is the reason
            to watch the bar; one line, because two would be a second
            widget again. */}
        {showIncentive ? (
          <div className="mt-0.5 flex items-baseline justify-between gap-2 border-t border-phos-800 pt-1">
            <span className="crt-text-glow truncate text-[8px] font-bold tracking-[0.12em] text-phos-300">
              {alreadyRefined
                ? "THIS FILE HAS ALREADY BEEN REFINED"
                : lane
                  ? lane.remaining === 0
                    ? "INCENTIVE EARNED — COLLECT IT"
                    : `${lane.short} FOR YOUR NEXT INCENTIVE`
                  : "ALL INCENTIVES ISSUED"}
            </span>
            <button
              type="button"
              data-record-box="hud"
              data-view-record
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={onOpenRecord}
              className="pointer-events-auto inline-flex shrink-0 items-center gap-0.5 text-[8px] tracking-[0.12em] text-phos-500 active:text-phos-200"
            >
              SEE ALL
              <span className="tabular-nums text-phos-400">{` ${kept}/${allTotal}`}</span>
              <ChevronRight size={9} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The two lines every file card has, current or leaving. */
function FileLines({
  face,
  refined,
  onHandbook,
  onSettings,
  inert = false,
}: {
  face: Face;
  refined: boolean;
  onHandbook: () => void;
  onSettings: () => void;
  inert?: boolean;
}) {
  const done = face.pct >= 100;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2 text-[10px] tracking-[0.16em]">
        <span className="crt-text-glow truncate text-phos-400">
          <span className="text-phos-600">FILE: </span>
          {face.name} #{face.code}
          {/* Screens *refined*, out of the screens this file has — the
              word is there because a bare fraction beside a file name
              reads as "file 1 of 3". */}
          {face.done && face.done[1] > 1 ? (
            <span className="text-phos-600">
              {` ${face.done[0]}/${face.done[1]} REFINED`}
            </span>
          ) : null}
        </span>
        <span
          className={
            face.urgent
              ? "crt-text-glow shrink-0 font-bold text-alarm"
              : refined
                ? "crt-text-glow shrink-0 font-bold tracking-[0.2em] text-phos-200"
                : "crt-text-glow shrink-0 text-phos-600"
          }
        >
          {refined ? "REFINED" : face.clockText}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="h-[6px] flex-1 overflow-hidden rounded-sm border border-phos-800 bg-phos-950">
          <div
            className="h-full bg-phos-400 transition-[width] duration-300 ease-out"
            style={{
              width: `${face.pct}%`,
              boxShadow: done
                ? "0 0 10px 1px var(--color-phos-200)"
                : "0 0 6px var(--color-phos-400)",
              // One pulse on arrival. The engine holds the finished board
              // for 600ms before any overlay may cover it, so this is
              // always watched rather than covered.
              animation: done ? "meter-full 520ms ease-out 260ms 1" : undefined,
            }}
          />
        </div>
        <span
          className={`crt-text-glow w-[32px] shrink-0 text-right text-[12px] font-bold tabular-nums ${
            done ? "text-phos-200" : "text-phos-300"
          }`}
        >
          {face.pct}%
        </span>

        {/* Labelled, because a lone question mark is a guess. */}
        <button
          type="button"
          data-handbook={inert ? undefined : true}
          aria-hidden={inert || undefined}
          tabIndex={inert ? -1 : undefined}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={inert ? undefined : onHandbook}
          className={`inline-flex h-[26px] shrink-0 items-center gap-1 rounded-[3px] border border-phos-700 bg-phos-900/60 px-1.5 text-[8px] tracking-[0.06em] text-phos-400 active:bg-phos-600/40 ${
            inert ? "" : "pointer-events-auto"
          }`}
        >
          HANDBOOK
          <CircleHelp size={10} strokeWidth={2.2} aria-hidden />
        </button>
        <button
          type="button"
          data-settings={inert ? undefined : true}
          aria-label="Terminal settings"
          aria-hidden={inert || undefined}
          tabIndex={inert ? -1 : undefined}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={inert ? undefined : onSettings}
          className={`flex h-[26px] w-[24px] shrink-0 items-center justify-center rounded-[3px] border border-phos-700 bg-phos-900/60 text-phos-500 active:bg-phos-600/40 ${
            inert ? "" : "pointer-events-auto"
          }`}
        >
          <Settings size={12} strokeWidth={2.2} />
        </button>
      </div>
    </>
  );
}
