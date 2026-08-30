import { useEffect, useRef, useState } from "react";
import { CircleHelp, Settings } from "lucide-react";
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
 *    far through it you are — held long enough to be read, on a scrim with
 *    nothing else on it.
 * 2. **And this is where it lives.** That same card shrinks into the file
 *    card in the footer of the board, which is now sitting between the
 *    bins and the incentives record. A refiner who watches it land knows
 *    what the strip above the record is for, and never has to be told.
 *
 * The board loads *underneath* at the start of beat two, so the card is
 * flying at a real destination rather than at a placeholder, and the scrim
 * lifts as it goes — flying at an opaque wall is a card that vanishes.
 */

/** How long the assignment is held before it is filed. */
const HOLD_MS = 950;
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

  useEffect(() => {
    if (reduced) {
      onDock();
      const t = setTimeout(onDone, 40);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => {
      natural.current = card.current?.getBoundingClientRect() ?? null;
      onDock();
      setFlying(true);
    }, HOLD_MS);
    const t2 = setTimeout(onDone, HOLD_MS + FLY_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // One assignment, one animation. Re-running it against a board that has
    // already loaded would send a second card at a card already there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        background: flying ? "rgba(1,7,4,0)" : "rgba(1,7,4,0.97)",
        transition: flying ? `background ${FLY_MS}ms ease-in` : undefined,
      }}
    >
      <div
        ref={card}
        data-file-launch
        className="flex w-full max-w-[300px] flex-col items-center"
        style={{
          animation: reduced
            ? undefined
            : "crt-open 320ms cubic-bezier(.2,.7,.3,1) 1",
          transition: flying
            ? `transform ${FLY_MS}ms cubic-bezier(.45,0,.25,1), opacity ${FLY_MS}ms ease-in`
            : undefined,
          transform: flight
            ? `translate(${flight.x}px, ${flight.y}px) scale(${flight.s})`
            : undefined,
          opacity: flight ? 0.15 : 1,
        }}
      >
        <p className="text-[9px] tracking-[0.3em] text-phos-600">
          LUMON INDUSTRIES
        </p>
        <h1 className="crt-text-glow mt-2 text-[13px] font-bold tracking-[0.22em] text-phos-200">
          FILE ASSIGNED
        </h1>
        <div className="mt-2 h-px w-24 bg-phos-600" />

        {/* The same object it is about to become: same border, same two
            lines, same meter, same two doors out. A card that morphed into
            a *different* card on landing would teach the wrong thing. */}
        <div className="mt-4 flex w-full flex-col justify-center gap-2 rounded-[3px] border border-phos-500 bg-phos-900/50 px-3 py-3">
          <div className="flex items-baseline justify-between gap-2 text-[11px] tracking-[0.16em]">
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

        <p className="mt-3 text-[8px] tracking-[0.22em] text-phos-600">
          REFINEMENT AT 0% · PLEASE ENJOY EACH NUMBER EQUALLY
        </p>
      </div>
    </div>
  );
}
