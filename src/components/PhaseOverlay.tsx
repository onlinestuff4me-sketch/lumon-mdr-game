import { useState } from "react";
import { CircleHelp, Play, RotateCcw, ChevronRight, FolderOpen } from "lucide-react";
import { LEVELS } from "../game/constants";
import type { HudSnapshot } from "../game/engine";
import { activeRun, continueIndex, type RunStore } from "../game/runs";
import type { Progress } from "../game/progress";
import { IncentiveForecast } from "./IncentiveForecast";

interface Props {
  hud: HudSnapshot;
  /** The incentive ledger, for the forecast under the addendum. */
  progress: Progress;
  onStart: () => void;
  onNext: () => void;
  onRestart: () => void;
  onNewQuarter: () => void;
  onHandbook: () => void;
  /** Every saved attempt, with the active one marked. */
  runStore: RunStore;
  onPlay: (index: number) => void;
  onNewSave: () => void;
  onLoadRun: (id: string) => void;
}

/** "AUG 24 · 14:32" — enough to tell attempts apart, terminal-terse. */
function stamp(t: number): string {
  const d = new Date(t);
  const date = d
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toUpperCase();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} · ${time}`;
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
  progress,
  onStart,
  onNext,
  onRestart,
  onNewQuarter,
  onHandbook,
  runStore,
  onPlay,
  onNewSave,
  onLoadRun,
}: Props) {
  // Collapsed by default: the list of past attempts is a filing cabinet,
  // and a filing cabinet on the front of the terminal stays shut until
  // someone asks for it.
  const [showSaves, setShowSaves] = useState(false);
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
          {(() => {
            const run = activeRun(runStore);
            // A terminal nobody has worked at yet offers exactly what it
            // always did: orientation first, skip if you insist.
            if (!run && runStore.runs.length === 0) {
              return (
                <>
                  <button type="button" className={BTN} onClick={onStart}>
                    <Play size={12} strokeWidth={2.6} />
                    BEGIN ORIENTATION
                  </button>
                  <button
                    type="button"
                    onClick={() => onPlay(FIRST_REAL_FILE)}
                    className="mt-3 text-[9px] tracking-[0.2em] text-phos-600 underline-offset-4"
                  >
                    SKIP THE TRAINING FILES
                  </button>
                </>
              );
            }
            const at = run ? continueIndex(run, LEVELS.length) : 0;
            const saves = [...runStore.runs].sort(
              (a, b) => b.updatedAt - a.updatedAt,
            );
            return (
              <>
                <button type="button" className={BTN} onClick={() => onPlay(at)}>
                  <Play size={12} strokeWidth={2.6} />
                  {`CONTINUE — ${LEVELS[at].name}`}
                </button>
                <button
                  type="button"
                  onClick={onNewSave}
                  className="mt-3 inline-flex items-center gap-2 rounded-[3px] border border-phos-600/60 px-4 py-2 text-[9px] font-bold tracking-[0.22em] text-phos-400 active:bg-phos-600/30"
                >
                  BEGIN A NEW SAVE
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaves((v) => !v)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-phos-600 underline-offset-4"
                >
                  <FolderOpen size={10} strokeWidth={2.2} aria-hidden />
                  {`LOAD A PREVIOUS SAVE (${saves.length})`}
                </button>
                {showSaves ? (
                  <div className="mt-2 flex max-h-40 w-full max-w-70 flex-col gap-1 overflow-y-auto">
                    {saves.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onLoadRun(r.id)}
                        className="flex items-center justify-between rounded-[3px] border border-phos-600/40 px-3 py-1.5 text-[8px] tracking-[0.14em] text-phos-400 active:bg-phos-600/30"
                      >
                        <span>{stamp(r.updatedAt)}</span>
                        <span className="text-phos-600">
                          {`${Math.max(0, r.furthest + 1)}/${LEVELS.length} FILES`}
                          {r.id === runStore.active ? " · ACTIVE" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            );
          })()}
        </>
      ) : null}

      {/* A screen that advances itself shows nothing: the engine holds
          phase "complete" for the auto-advance window, and rendering the
          banner there would put a 100% panel and a NEXT FILE button over
          every one of the twenty orientation screens for 900ms apiece. */}
      {hud.phase === "complete" && hud.ceremony !== "none" ? (
        <>
          {/* Four separate ways of saying "you finished" is three too many.
              The ticker behind this scrim already carries the praise line
              and the HUD already reads 100%, so the panel says it once and
              spends the rest of the screen on what was earned and what is
              next. */}
          <p className="text-[9px] tracking-[0.3em] text-phos-600">
            FILE {hud.levelIndex + 1} OF {LEVELS.length} · {level.name}
          </p>
          <h1 className="crt-text-glow mt-2 text-[13px] font-bold tracking-[0.22em] text-phos-200">
            FILE REFINED
          </h1>
          <div className="mt-3 h-px w-24 bg-phos-600" />

          {/* One line of the story, released per completed file — and, for
              now, the only thing this screen hands over. The reward reveal
              lands in front of this panel rather than inside it. */}
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
          {/* What the next incentive costs. Under the addendum rather than
              over it: the file just refined gets its own moment first, and
              the forecast is the thing that sends the refiner back in. One
              lane, no box — the addendum above is the object on this
              screen, and a second bordered card would compete with it. */}
          <div className="mt-4 flex justify-center">
            <IncentiveForecast progress={progress} variant="panel" />
          </div>
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
