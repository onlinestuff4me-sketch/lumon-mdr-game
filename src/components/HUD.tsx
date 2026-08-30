import { CircleHelp, Settings } from "lucide-react";
import type { HudSnapshot } from "../game/engine";

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = (s / 60) | 0;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The file card: which file this is, how far through it the refiner is,
 * and the two doors out of the game.
 *
 * Two lines and nothing else. It used to carry a version string, the
 * clock, the file name, the meter, the percentage and the incentives
 * record, stacked into a band deep enough to notice, above a coach line,
 * above a control deck — three bands of chrome before the numbers.
 *
 * The meter is the *file's*, not this stage's: a card that names
 * ORIENTATION #0001 and shows a bar that fills and resets three times
 * inside it is measuring something nobody was told about.
 *
 * The handbook and the settings sit on the meter's line rather than in a
 * deck of their own. They are things you leave the game to read, not
 * controls you use while playing, and the meter can spare the width more
 * cheaply than the board can spare a band.
 *
 * **It is a footer, not a header.** A refiner drags a packet into a bin
 * and their eyes are on the bin; the bin's meter moves, and so does this
 * one, and so does the incentives record under it — three readings of the
 * same act at increasing grain, stacked where the hand and the eye already
 * are. At the top of the screen this meter moved where nobody was looking.
 * It also gives the first-run animation somewhere to land: the file card
 * shown on the way in is *this* card, shrunk into place.
 */
export function HUD({
  hud,
  height,
  card = false,
  onHandbook,
  onSettings,
}: {
  hud: HudSnapshot;
  height: number;
  /** Footer card with a border of its own, rather than a full-bleed header. */
  card?: boolean;
  onHandbook: () => void;
  onSettings: () => void;
}) {
  const urgent = !hud.untimed && hud.timeLeft <= 15 && hud.phase !== "complete";
  const pct = Math.round(hud.fileProgress * 100);
  const done = pct >= 100;

  // Above the input surface (z-35) so the two buttons take taps, but
  // transparent to pointers everywhere else: a packet dragged to the very
  // top of the board sits under this header, and a header that ate
  // pointers there would leave the refiner holding something they could
  // not put down.
  return (
    <header
      data-file-card
      className={`pointer-events-none relative z-40 flex shrink-0 flex-col justify-center gap-1 ${
        card
          ? "w-full rounded-[3px] border border-phos-700 bg-phos-900/40 px-2.5"
          : "border-b border-phos-700/70 bg-phos-950/90 px-3"
      }`}
      style={{ height }}
    >
      <div className="flex items-baseline justify-between gap-2 text-[10px] tracking-[0.16em]">
        <span className="crt-text-glow truncate text-phos-400">
          <span className="text-phos-600">FILE: </span>
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

      <div className="flex items-center gap-1.5">
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
          className={`crt-text-glow w-[32px] shrink-0 text-right text-[12px] font-bold tabular-nums ${
            done ? "text-phos-200" : "text-phos-300"
          }`}
        >
          {pct}%
        </span>

        {/* Labelled, because a lone question mark is a guess. */}
        <button
          type="button"
          data-handbook
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={onHandbook}
          className="pointer-events-auto inline-flex h-[26px] shrink-0 items-center gap-1 rounded-[3px] border border-phos-700 bg-phos-900/60 px-1.5 text-[8px] tracking-[0.06em] text-phos-400 active:bg-phos-600/40"
        >
          HANDBOOK
          <CircleHelp size={10} strokeWidth={2.2} aria-hidden />
        </button>
        <button
          type="button"
          data-settings
          aria-label="Terminal settings"
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={onSettings}
          className="pointer-events-auto flex h-[26px] w-[24px] shrink-0 items-center justify-center rounded-[3px] border border-phos-700 bg-phos-900/60 text-phos-500 active:bg-phos-600/40"
        >
          <Settings size={12} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
}
