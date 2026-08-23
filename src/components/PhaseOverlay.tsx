import { CircleHelp, Play, RotateCcw, ChevronRight } from "lucide-react";
import { LEVELS, PRAISE } from "../game/constants";
import type { HudSnapshot } from "../game/engine";

interface Props {
  hud: HudSnapshot;
  onStart: () => void;
  onNext: () => void;
  onRestart: () => void;
  onNewQuarter: () => void;
  onHandbook: () => void;
  /** Index of the file to resume at; 0 when nothing has been refined. */
  resumeAt: number;
  onResume: (index: number) => void;
}

/** The first file past the training files — where SKIP lands. Derived
 *  rather than hardcoded, so inserting another training file cannot
 *  silently drop a player into the middle of the tutorial. */
const FIRST_REAL_FILE = Math.max(
  1,
  LEVELS.findIndex((l) => !l.training),
);

const BTN =
  "mt-5 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.22em] text-phos-200 crt-text-glow active:bg-phos-600/50";

export function PhaseOverlay({
  hud,
  onStart,
  onNext,
  onRestart,
  onNewQuarter,
  onHandbook,
  resumeAt,
  onResume,
}: Props) {
  if (hud.phase === "probe" || hud.phase === "select" || hud.phase === "carry") {
    return null;
  }
  // Nor does the scrim: an auto-advancing screen must stay looking like the
  // board it just cleared, not like a dimmed interstitial.
  if (hud.phase === "complete" && hud.ceremony === "none") return null;

  const level = LEVELS[hud.levelIndex];

  return (
    <div className="absolute inset-0 z-60 flex flex-col items-center justify-center bg-phos-950/94 px-7 text-center">
      {hud.phase === "briefing" ? (
        <>
          <p className="text-[9px] tracking-[0.3em] text-phos-600">
            LUMON INDUSTRIES
          </p>
          <h1 className="crt-text-glow mt-2 text-[17px] font-bold leading-tight tracking-[0.16em] text-phos-200">
            MACRODATA
            <br />
            REFINEMENT
          </h1>
          <div className="mt-4 h-px w-24 bg-phos-600" />
          {/* One thought per line. Run together as prose these read as a
              paragraph to be skimmed; stacked, each line is an instruction
              the refiner can hold onto. */}
          <div className="mt-4 flex flex-col gap-1.5 text-[10px] leading-snug text-phos-400">
            <p>Welcome refiner</p>
            <p>Probe files for numbers that feel wrong</p>
            <p>Bin them by the temper they evoke</p>
          </div>
          <div className="mt-4 flex flex-col gap-1.5 text-[9px] leading-snug tracking-[0.1em] text-phos-600">
            <p>THE WORK IS MYSTERIOUS AND IMPORTANT</p>
            <p>HEADPHONES RECOMMENDED</p>
          </div>
          <button type="button" className={BTN} onClick={onStart}>
            <Play size={12} strokeWidth={2.6} />
            BEGIN ORIENTATION
          </button>
          {/* A returning refiner picks up where the story left off rather
              than re-earning addenda they already hold. Falls back to the
              plain skip on a terminal with no history. */}
          <button
            type="button"
            onClick={() => onResume(resumeAt > 0 ? resumeAt : FIRST_REAL_FILE)}
            className="mt-3 text-[9px] tracking-[0.2em] text-phos-600 underline-offset-4"
          >
            {resumeAt > 0
              ? `RESUME AT ${LEVELS[resumeAt].name}`
              : "SKIP THE TRAINING FILES"}
          </button>
        </>
      ) : null}

      {/* A screen that advances itself shows nothing: the engine holds
          phase "complete" for the auto-advance window, and rendering the
          banner there would put a 100% panel and a NEXT FILE button over
          every one of the twenty orientation screens for 900ms apiece. */}
      {hud.phase === "complete" && hud.ceremony !== "none" ? (
        <>
          <p className="text-[9px] tracking-[0.3em] text-phos-600">
            FILE {hud.levelIndex + 1} OF {LEVELS.length} · {level.name}
          </p>
          <h1 className="crt-text-glow mt-2 text-[20px] font-bold tracking-[0.2em] text-phos-200">
            100%
          </h1>
          <p className="crt-text-glow mt-1 text-[11px] font-bold tracking-[0.18em] text-phos-300">
            FILE REFINED
          </p>
          <div className="mt-4 h-px w-24 bg-phos-600" />
          <p className="mt-4 text-[10px] leading-relaxed text-phos-400">
            {PRAISE[hud.levelIndex % PRAISE.length]}
          </p>

          {/* One line of the story, released per completed file. */}
          <div className="mt-4 w-full max-w-[280px] rounded-[3px] border border-phos-700 bg-phos-900/40 px-3 py-2.5">
            <div className="text-[8px] tracking-[0.24em] text-phos-600">
              PERPETUITY WING · ADDENDUM {hud.levelIndex + 1}
            </div>
            <p className="mt-1 text-[10px] italic leading-relaxed text-phos-300">
              {hud.lore}
            </p>
            <p className="mt-1.5 text-[8px] tracking-[0.18em] text-phos-600">
              FILED · HANDBOOK &gt; ARCHIVE
            </p>
          </div>
          {hud.untimed ? null : (
            <p className="mt-2 text-[9px] tracking-[0.14em] text-phos-600">
              TIME REMAINING: {Math.ceil(hud.timeLeft)}s
            </p>
          )}
          {hud.isLastLevel ? (
            <>
              <p className="crt-text-glow mt-4 text-[11px] font-bold leading-relaxed tracking-[0.16em] text-phos-200">
                ALL FILES REFINED.
                <br />
                COLD HARBOR IS COMPLETE.
              </p>
              <button type="button" className={BTN} onClick={onNewQuarter}>
                <RotateCcw size={12} strokeWidth={2.6} />
                NEW QUARTER
              </button>
            </>
          ) : (
            <button type="button" className={BTN} onClick={onNext}>
              NEXT FILE
              <ChevronRight size={12} strokeWidth={2.6} />
            </button>
          )}
        </>
      ) : null}

      {hud.phase === "failed" ? (
        <>
          <p
            className="text-[9px] tracking-[0.3em] text-alarm"
            style={{ animation: "glitch-shift 400ms steps(2,end) infinite" }}
          >
            SHIFT EXPIRED
          </p>
          <h1 className="mt-2 text-[15px] font-bold leading-tight tracking-[0.16em] text-alarm">
            FILE RETURNED
            <br />
            TO THE QUEUE
          </h1>
          <div className="mt-4 h-px w-24 bg-alarm/60" />
          <p className="mt-4 text-[10px] leading-relaxed text-phos-400">
            The numbers remain unrefined. Mr. Milchick has been notified. This
            will not be held against you, probably.
          </p>
          <p className="mt-2 text-[9px] tracking-[0.14em] text-phos-600">
            COMPLETION: {Math.round(hud.progress * 100)}%
          </p>
          <button type="button" className={BTN} onClick={onRestart}>
            <RotateCcw size={12} strokeWidth={2.6} />
            RETRY FILE
          </button>
        </>
      ) : null}

      {/* The handbook has to be reachable from here too: the deck is behind
          this overlay, and the briefing is exactly when a new refiner wants
          to read the rules. It opens above this layer, and the shift clock
          is paused while it is open, so nothing can expire underneath it. */}
      <button
        type="button"
        onClick={onHandbook}
        className="mt-6 inline-flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-phos-600 underline-offset-4 hover:text-phos-400"
      >
        READ THE HANDBOOK
        <CircleHelp size={10} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
