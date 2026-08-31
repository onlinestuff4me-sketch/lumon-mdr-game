import { useEffect, useRef, useState } from "react";
import { ChevronRight, CircleHelp, Settings } from "lucide-react";
import { LEVELS } from "../game/constants";

/**
 * The file being assigned, shown once and then put where it lives.
 *
 * Tapping CONTINUE used to cut straight to a wall of digits, and the
 * refiner arrived on a screen without having been told what the screen
 * *was*. Two beats fix that, and they are the same two the incentive
 * summary uses on its way out:
 *
 * 1. **This is your file.** Its name, its stage, and a meter reading how
 *    far through it you are — with the briefing that goes with it, on a
 *    scrim with nothing else on it, waiting for a hand.
 * 2. **And this is where it lives.** That same card shrinks into the file
 *    card in the footer of the board. A refiner who watches it land knows
 *    what the strip under the bins is for, and never has to be told.
 *
 * Beat one **waits**, like every other card in this game. It used to
 * advance itself after 950ms, which is long enough to notice a screen and
 * not long enough to read one — and this is the one screen that explains
 * the job.
 *
 * The board loads *underneath* at the start of beat two, so the card is
 * flying at a real destination rather than at a placeholder, and the scrim
 * lifts as it goes — flying at an opaque wall is a card that vanishes.
 */

/** How long it takes to reach the footer of the board. */
const FLY_MS = 780;

interface Props {
  /** The level about to be loaded. */
  index: number;
  /** Start beat two: load the board behind the card. */
  onDock: () => void;
  /** The card has landed; the overlay may go. */
  onDone: () => void;
}

export function FileLaunch({ index, onDock, onDone }: Props) {
  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  const [flying, setFlying] = useState(false);
  const [flight, setFlight] = useState<{ x: number; y: number; s: number } | null>(
    null,
  );
  const card = useRef<HTMLDivElement | null>(null);
  /** The card's size before anything is done to it, for the flight. */
  const natural = useRef<DOMRect | null>(null);

  const level = LEVELS[index];

  /** Beat two: load the board and send the card at its footer. */
  const begin = () => {
    if (flying) return;
    if (reduced) {
      onDock();
      onDone();
      return;
    }
    natural.current = card.current?.getBoundingClientRect() ?? null;
    onDock();
    setFlying(true);
    setTimeout(onDone, FLY_MS);
  };

  /**
   * Aim at the footer card and let go.
   *
   * Measured, never assumed: the footer's position depends on the
   * viewport, and a hand-tuned offset is correct on exactly one phone. A
   * frame after `flying` is set, so the transform lands on a later paint
   * than the one that started the transition.
   */
  useEffect(() => {
    if (!flying) return;
    const id = requestAnimationFrame(() => {
      const dock = document.querySelector("[data-file-card]");
      const p = natural.current;
      if (!p || !dock) return;
      const d = dock.getBoundingClientRect();
      setFlight({
        x: d.left + d.width / 2 - (p.left + p.width / 2),
        y: d.top + d.height / 2 - (p.top + p.height / 2),
        // Height, not width: the footer card is nearly as wide as this one
        // and a third of its height, so a width ratio barely shrinks it.
        s: Math.min(1, Math.max(0.1, d.height / Math.max(1, p.height))),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [flying]);

  if (!level) return null;
  const stages = level.stage;

  return (
    <div
      className="absolute inset-0 z-70 flex flex-col items-center justify-center overflow-hidden px-6"
      style={{
        background: flying ? "rgba(1,7,4,0)" : "rgba(1,7,4,0.985)",
        transition: flying ? `background ${FLY_MS}ms ease-in` : undefined,
      }}
    >
      <div
        data-file-launch
        className="flex w-full max-w-[300px] flex-col items-center"
        style={{
          animation: reduced
            ? undefined
            : "crt-open 320ms cubic-bezier(.2,.7,.3,1) 1",
        }}
      >
        {/* Everything except the card itself is the *briefing*, and the
            briefing does not travel: it clears out of the way so the one
            object that has a destination is the only thing still moving. */}
        <div
          className="flex w-full flex-col items-center"
          style={{
            opacity: flying ? 0 : 1,
            transition: `opacity ${Math.round(FLY_MS * 0.35)}ms ease-out`,
          }}
        >
          <p className="text-[9px] tracking-[0.3em] text-phos-600">
            LUMON INDUSTRIES
          </p>
          <h1 className="crt-text-glow mt-2 text-[13px] font-bold tracking-[0.22em] text-phos-200">
            FILE ASSIGNED
          </h1>
          <div className="mt-2 h-px w-24 bg-phos-600" />
        </div>

        {/* The same object it is about to become: same border, same two
            lines, same meter, same two doors out. A card that morphed into
            a *different* card on landing would teach the wrong thing.
            Measured and flown on its own, so the scale it lands at is the
            ratio of two file cards rather than of a whole page to one. */}
        <div
          ref={card}
          className="mt-4 flex w-full flex-col justify-center gap-2 rounded-[3px] border border-phos-500 bg-phos-900/50 px-3 py-3"
          style={{
            transition: flying
              ? `transform ${FLY_MS}ms cubic-bezier(.45,0,.25,1), opacity ${FLY_MS}ms ease-in`
              : undefined,
            transform: flight
              ? `translate(${flight.x}px, ${flight.y}px) scale(${flight.s})`
              : undefined,
            opacity: flight ? 0.15 : 1,
          }}
        >
          {/* 10px, like the card it becomes — the two have to be the same
              object, and a line that truncates here and not there is two
              objects. */}
          <div className="flex items-baseline justify-between gap-2 text-[10px] tracking-[0.16em]">
            <span className="crt-text-glow truncate text-phos-300">
              <span className="text-phos-600">FILE: </span>
              {level.name} #{level.fileCode}
              {stages && stages[1] > 1 ? (
                <span className="text-phos-600">{` ${stages[0]}/${stages[1]}`}</span>
              ) : null}
            </span>
            <span className="crt-text-glow shrink-0 text-phos-600">
              {level.untimed ? "--:--" : "--:--"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-[6px] flex-1 overflow-hidden rounded-sm border border-phos-800 bg-phos-950">
              <div className="h-full w-0 bg-phos-400" />
            </div>
            <span className="crt-text-glow w-[32px] shrink-0 text-right text-[12px] font-bold tabular-nums text-phos-300">
              0%
            </span>
            {/* Inert. They are here so the shape matches what it lands on,
                not to be pressed on a screen that is already leaving. */}
            <span
              aria-hidden
              className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-[3px] border border-phos-700 bg-phos-900/60 px-1.5 text-[8px] tracking-[0.06em] text-phos-500"
            >
              HANDBOOK
              <CircleHelp size={10} strokeWidth={2.2} />
            </span>
            <span
              aria-hidden
              className="flex h-[26px] w-[24px] shrink-0 items-center justify-center rounded-[3px] border border-phos-700 bg-phos-900/60 text-phos-600"
            >
              <Settings size={12} strokeWidth={2.2} />
            </span>
          </div>
        </div>

        <div
          className="flex w-full flex-col items-center"
          style={{
            opacity: flying ? 0 : 1,
            transition: `opacity ${Math.round(FLY_MS * 0.35)}ms ease-out`,
          }}
        >
        {/* What the file is for, said the way Lumon would say it. The
            orientation files get the version that explains the job,
            because they are the job being explained. */}
        <p className="mt-4 max-w-[280px] text-[10px] leading-relaxed text-phos-400">
          {level.training
            ? "This file is an orientation to your role as a Macrodata Refiner. Find the numbers that feel wrong and consign each to the temper bin it evokes."
            : "This file has been prepared for you. Find the numbers that feel wrong and consign each to the temper bin it evokes."}
        </p>

        <p className="crt-text-glow mt-3 text-[10px] font-bold tracking-[0.16em] text-phos-300">
          PLEASE ENJOY EACH NUMBER EQUALLY
        </p>

        {/* It waits. This is the one screen that explains the job, and a
            screen that advances itself has explained nothing to anyone who
            blinked. */}
        <button
          type="button"
          data-begin-refining
          onClick={begin}
          className="crt-text-glow mt-5 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-phos-200 active:bg-phos-600/50"
          style={
            flying || reduced
              ? undefined
              : { animation: "crt-throb 1.9s ease-in-out infinite" }
          }
        >
          BEGIN REFINING
          <ChevronRight size={12} strokeWidth={2.6} />
        </button>
        </div>
      </div>
    </div>
  );
}
