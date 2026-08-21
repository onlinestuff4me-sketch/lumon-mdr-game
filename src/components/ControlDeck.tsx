import { CircleHelp, Crosshair, SquareDashed, Vibrate, VibrateOff, Volume2, VolumeX } from "lucide-react";
import type { HudSnapshot } from "../game/engine";
import type { InputMode } from "../game/types";

interface Props {
  hud: HudSnapshot;
  height: number;
  onMode: (mode: InputMode) => void;
  onHandbook: () => void;
  onToggleMute: () => void;
  onToggleHaptics: () => void;
  hapticsSupported: boolean;
}

const TAB =
  "flex h-full flex-1 items-center justify-center gap-1.5 text-[10px] tracking-[0.16em] transition-colors duration-150";

export function ControlDeck({
  hud,
  height,
  onMode,
  onHandbook,
  onToggleMute,
  onToggleHaptics,
  hapticsSupported,
}: Props) {
  const probe = hud.mode === "probe";
  return (
    <div
      className="relative z-40 flex items-stretch gap-1.5 border-y border-phos-700/70 bg-phos-900/80 px-2 py-1"
      style={{ height }}
    >
      <div className="flex flex-[3] overflow-hidden rounded-[3px] border border-phos-600/80 bg-phos-950">
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
          <Crosshair size={11} strokeWidth={2.4} aria-hidden />
          PROBE
        </button>
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
          <SquareDashed size={11} strokeWidth={2.4} aria-hidden />
          SELECT
        </button>
      </div>

      <button
        type="button"
        aria-label={hud.muted ? "Enable audio" : "Mute audio"}
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={onToggleMute}
        className="flex aspect-square h-full items-center justify-center rounded-[3px] border border-phos-600/80 bg-phos-950 text-phos-400"
      >
        {hud.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>

      {hapticsSupported ? (
        <button
          type="button"
          aria-label={hud.hapticsOn ? "Disable haptics" : "Enable haptics"}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={onToggleHaptics}
          className="flex aspect-square h-full items-center justify-center rounded-[3px] border border-phos-600/80 bg-phos-950 text-phos-400"
        >
          {hud.hapticsOn ? <Vibrate size={13} /> : <VibrateOff size={13} />}
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Open the Lumon handbook"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={onHandbook}
        className="flex aspect-square h-full items-center justify-center rounded-[3px] border border-phos-600/80 bg-phos-950 text-phos-400"
      >
        <CircleHelp size={13} />
      </button>
    </div>
  );
}
