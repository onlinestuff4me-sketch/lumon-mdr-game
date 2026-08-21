import { CircleHelp, Crosshair, SquareDashed } from "lucide-react";
import type { HudSnapshot } from "../game/engine";
import type { InputMode } from "../game/types";

interface Props {
  hud: HudSnapshot;
  height: number;
  onMode: (mode: InputMode) => void;
  onHandbook: () => void;
}

const TAB =
  "flex h-full flex-1 items-center justify-center gap-1 text-[9px] tracking-[0.14em] transition-colors duration-150";

/** The tactical control deck: mode switch on the left, handbook on the right. */
export function ControlDeck({ hud, height, onMode, onHandbook }: Props) {
  const probe = hud.mode === "probe";
  return (
    <div
      className="relative z-40 flex items-stretch gap-1.5 border-y border-phos-700/70 bg-phos-900/80 px-2 py-1"
      style={{ height }}
    >
      <div className="flex flex-[5] items-stretch overflow-hidden rounded-[3px] border border-phos-600/80 bg-phos-950">
        <span className="flex shrink-0 items-center border-r border-phos-700/70 px-1.5 text-[9px] tracking-[0.12em] text-phos-600">
          MODE:
        </span>
        <button
          type="button"
          aria-pressed={probe}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={() => onMode("probe")}
          className={`${TAB} ${
            probe
              ? "crt-text-glow bg-phos-600/80 font-bold text-phos-200"
              : "text-phos-500"
          }`}
        >
          <Crosshair size={10} strokeWidth={2.4} aria-hidden />
          PROBE
        </button>
        <span className="my-1.5 w-px shrink-0 bg-phos-700/70" />
        <button
          type="button"
          aria-pressed={!probe}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={() => onMode("select")}
          className={`${TAB} ${
            !probe
              ? "crt-text-glow bg-phos-600/80 font-bold text-phos-200"
              : "text-phos-500"
          }`}
        >
          <SquareDashed size={10} strokeWidth={2.4} aria-hidden />
          SELECT
        </button>
      </div>

      <button
        type="button"
        aria-label="Open the Lumon handbook"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={onHandbook}
        className="flex flex-[3] items-center justify-center gap-1 rounded-[3px] border border-phos-600/80 bg-phos-950 text-[9px] tracking-[0.14em] text-phos-400"
      >
        HANDBOOK
        <CircleHelp size={11} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
