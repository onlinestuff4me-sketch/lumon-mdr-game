import type { HudSnapshot } from "../game/engine";
import type { Progress } from "../game/progress";
import { IncentiveRecordBox } from "./IncentiveRecordBox";

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = (s / 60) | 0;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The header: what file this is, how far through it the refiner is, and
 * what they are working toward.
 *
 * The refinement meter is the loudest thing on the screen after the
 * numbers themselves. It was a 3px hairline with the percentage tucked
 * into a 10px line beside the file name, which is a poor deal for the
 * single number the whole file is about — so the percentage is now the
 * biggest type in the header and the bar is thick enough to read from
 * across a room.
 *
 * Under it sits the incentives record, permanently. It is where the
 * summary screen shrinks to when a payout ends, and it is the way back
 * into the full record from anywhere in the game. It is furniture: it is
 * there before the first incentive exists, saying nothing, because
 * furniture that materializes halfway through a session reads as a
 * glitch rather than as a place.
 */
export function HUD({
  hud,
  height,
  progress,
  onOpenRecord,
  recordLanding,
}: {
  hud: HudSnapshot;
  height: number;
  progress: Progress;
  onOpenRecord: () => void;
  recordLanding: boolean;
}) {
  const urgent = !hud.untimed && hud.timeLeft <= 15 && hud.phase !== "complete";
  const pct = Math.round(hud.progress * 100);
  const done = pct >= 100;

  // The header sits above the input surface (z-35), like the control deck
  // at z-40, because the record is a live control and at z-20 every tap on
  // it was swallowed by the transparent grid overlay covering the stage.
  //
  // But only the record takes pointer events. A packet dragged to the very
  // top of the board sits *under* this header, and a header that ate
  // pointers there would leave the refiner holding something they could no
  // longer grab. The text is not interactive; the box is.
  return (
    <header
      className="pointer-events-none relative z-40 flex shrink-0 flex-col justify-center gap-1 border-b border-phos-700/70 bg-phos-950/90 px-3 py-1"
      style={{ height }}
    >
      <div className="flex items-baseline justify-between text-[9px] tracking-[0.18em] text-phos-600">
        <span className="crt-text-glow truncate">
          FILE: {hud.levelName} #{hud.fileCode}
          {hud.stage ? ` ${hud.stage[0]}/${hud.stage[1]}` : ""}
        </span>
        <span
          className={
            urgent
              ? "crt-text-glow shrink-0 font-bold text-alarm"
              : "crt-text-glow shrink-0 text-phos-500"
          }
        >
          [SHIFT: {hud.untimed ? "--:--" : clock(hud.timeLeft)}]
        </span>
      </div>

      {/* The one number this file is about. */}
      <div className="flex items-center gap-2">
        <span
          className={`crt-text-glow shrink-0 text-[9px] tracking-[0.2em] ${
            done ? "text-phos-200" : "text-phos-500"
          }`}
        >
          {done ? "REFINED" : "REFINEMENT"}
        </span>
        <div className="h-[6px] flex-1 overflow-hidden rounded-sm border border-phos-800 bg-phos-950">
          <div
            className="h-full bg-phos-400 transition-[width] duration-300 ease-out"
            style={{
              width: `${pct}%`,
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
          className={`crt-text-glow w-[38px] shrink-0 text-right text-[13px] font-bold tabular-nums ${
            done ? "text-phos-200" : "text-phos-300"
          }`}
        >
          {pct}%
        </span>
      </div>

      <IncentiveRecordBox
        progress={progress}
        onOpen={onOpenRecord}
        variant="hud"
        landing={recordLanding}
      />
    </header>
  );
}
