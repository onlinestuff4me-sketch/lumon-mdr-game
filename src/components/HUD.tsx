import type { HudSnapshot } from "../game/engine";

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = (s / 60) | 0;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function HUD({ hud, height }: { hud: HudSnapshot; height: number }) {
  const urgent = hud.timeLeft <= 15 && hud.phase !== "complete";
  const pct = Math.round(hud.progress * 100);

  return (
    <header
      className="relative z-20 flex shrink-0 flex-col justify-center border-b border-phos-700/70 bg-phos-950/90 px-3"
      style={{ height }}
    >
      <div className="flex items-baseline justify-between text-[10px] tracking-[0.18em] text-phos-500">
        <span className="crt-text-glow">LUMON OS v2.4.1</span>
        <span
          className={
            urgent
              ? "crt-text-glow font-bold text-alarm"
              : "crt-text-glow text-phos-300"
          }
        >
          [SHIFT: {clock(hud.timeLeft)}]
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between text-[10px] tracking-[0.14em] text-phos-400">
        <span className="crt-text-glow truncate">
          FILE: {hud.levelName} #{hud.fileCode}
        </span>
        <span className="crt-text-glow tabular-nums">
          PROGRESS: {String(pct).padStart(3, " ")}%
        </span>
      </div>
      {/* Overall refinement meter. */}
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-sm bg-phos-800">
        <div
          className="h-full bg-phos-400 transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            boxShadow: "0 0 6px var(--color-phos-400)",
          }}
        />
      </div>
    </header>
  );
}
