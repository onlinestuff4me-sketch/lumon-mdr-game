import { CircleHelp } from "lucide-react";
import type { HudSnapshot } from "../game/engine";

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = (s / 60) | 0;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The header: which file this is, and how far through it the refiner is.
 *
 * Two lines and nothing else. It used to carry four things — a version
 * string, the clock, the file name, the meter, the percentage and the
 * incentives record — stacked into a band deep enough to notice, above a
 * coach line, above a control deck. Three bands of chrome before the
 * numbers.
 *
 * What is left is what a refiner reads mid-file: the file's name, the
 * shift clock, and one meter. The meter is the *file's*, not this
 * stage's: a header that names ORIENTATION #0001 and shows a bar that
 * fills and resets three times inside it is measuring something nobody was
 * told about.
 *
 * The handbook sits beside the meter rather than in a deck of its own,
 * because it is a thing you leave the game to read, not a control you use
 * while playing.
 */
export function HUD({
  hud,
  height,
  onHandbook,
}: {
  hud: HudSnapshot;
  height: number;
  onHandbook: () => void;
}) {
  const urgent = !hud.untimed && hud.timeLeft <= 15 && hud.phase !== "complete";
  const pct = Math.round(hud.fileProgress * 100);
  const done = pct >= 100;

  // Above the input surface (z-35) so the handbook takes taps, but
  // transparent to pointers everywhere else: a packet dragged to the very
  // top of the board sits under this header, and a header that ate
  // pointers there would leave the refiner holding something they could
  // not put down.
  return (
    <header
      className="pointer-events-none relative z-40 flex shrink-0 flex-col justify-center gap-1 border-b border-phos-700/70 bg-phos-950/90 px-3"
      style={{ height }}
    >
      <div className="flex items-baseline justify-between gap-2 text-[10px] tracking-[0.16em]">
        <span className="crt-text-glow truncate text-phos-400">
          {hud.levelName} #{hud.fileCode}
          {hud.stage && hud.stage[1] > 1 ? (
            <span className="text-phos-600">
              {" "}
              {hud.stage[0]}/{hud.stage[1]}
            </span>
          ) : null}
        </span>
        <span
          className={
            urgent
              ? "crt-text-glow shrink-0 font-bold text-alarm"
              : "crt-text-glow shrink-0 text-phos-600"
          }
        >
          {hud.untimed ? "--:--" : clock(hud.timeLeft)}
        </span>
      </div>

      <div className="flex items-center gap-2">
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
        <button
          type="button"
          aria-label="Open the Lumon handbook"
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={onHandbook}
          className="pointer-events-auto flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[3px] border border-phos-700 bg-phos-900/60 text-phos-500 active:bg-phos-600/40"
        >
          <CircleHelp size={13} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
}
