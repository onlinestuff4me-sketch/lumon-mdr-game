import { TEMPER_DEFS } from "../game/constants";
import type { BinView } from "../game/engine";
import type { StageLayout } from "../game/layout";

/**
 * The four temper bins. Positions come from the same `computeLayout` the
 * engine hit-tests against, so what the refiner sees and what the engine
 * considers a drop target can never drift apart.
 */
export function BinDeck({
  bins,
  layout,
}: {
  bins: BinView[];
  layout: StageLayout;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      aria-label="Temper bins"
    >
      <div
        className="absolute inset-x-0 bottom-0 border-t border-phos-700/70 bg-phos-900/85"
        style={{ height: layout.binsH }}
      />
      {bins.map((bin) => {
        const def = TEMPER_DEFS[bin.temper];
        const rect = layout.binRects[bin.temper];
        // A lone bin spans the whole deck, and stacking a label above a
        // full-width meter leaves a band of dead space. Keyed on aspect
        // rather than on the deck's temper count: a two-bin row comes out
        // the same shape as a 2x2 cell and wants the same stacked layout.
        const wide = rect.w > rect.h * 5;
        const pct = Math.round(bin.fill * 100);
        const full = bin.fill >= 0.999;
        const flash =
          bin.hit === 1
            ? "0 0 18px 2px rgba(47,214,138,0.75)"
            : bin.hit === -1
              ? "0 0 18px 2px rgba(255,59,48,0.8)"
              : bin.hover
                ? `0 0 14px 1px ${def.css}`
                : bin.target
                  ? `0 0 16px 2px ${def.css}`
                  : "none";
        return (
          <div
            key={bin.temper}
            className={`absolute rounded-[3px] border transition-shadow duration-150 ${
              wide
                ? "flex items-center gap-2.5 px-3"
                : "flex flex-col justify-between px-1.5 py-1"
            }`}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              borderColor:
                bin.hover || bin.target || full ? def.css : "rgba(15,112,69,0.85)",
              background: bin.hover
                ? `color-mix(in srgb, ${def.css} 14%, #010604)`
                : bin.target
                  ? `color-mix(in srgb, ${def.css} 9%, #010604)`
                  : "#020a06",
              boxShadow: flash,
              // The destination reads as live while a packet is in hand, so
              // the arrows are pointing somewhere that looks like it is
              // waiting rather than at one more piece of chrome.
              animation: bin.target && !bin.hover ? "bin-await 1.5s ease-in-out infinite" : undefined,
            }}
          >
            {wide ? (
              <>
                <span
                  className="crt-text-glow shrink-0 text-[10px] font-bold tracking-[0.16em]"
                  style={{ color: def.css }}
                >
                  {def.code}: {bin.temper}
                </span>
                <span className="shrink-0 text-[8px] tracking-[0.1em] text-phos-600">
                  {def.name}
                </span>
                <Meter pct={pct} color={def.css} full={full} className="h-[6px] flex-1" />
                <span className="shrink-0 text-[9px] tabular-nums text-phos-400">
                  {pct}%
                </span>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <span
                    className="crt-text-glow text-[10px] font-bold tracking-[0.16em]"
                    style={{ color: def.css }}
                  >
                    {def.code}: {bin.temper}
                  </span>
                  <span className="text-[9px] tabular-nums text-phos-400">
                    {pct}%
                  </span>
                </div>
                <div className="text-[7px] leading-tight tracking-[0.1em] text-phos-600">
                  {def.name}
                </div>
                <Meter pct={pct} color={def.css} full={full} className="h-[5px] w-full" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A bin's fill.
 *
 * The pulse on `full` is the file's only acknowledgment that this
 * particular bin is done, and the engine holds the finished board for
 * 600ms before anything is drawn over it — so the meter is guaranteed to
 * be seen reaching its end rather than being covered on the way there.
 */
function Meter({
  pct,
  color,
  full,
  className,
}: {
  pct: number;
  color: string;
  full: boolean;
  className: string;
}) {
  return (
    <div className={`overflow-hidden rounded-[1px] bg-phos-800 ${className}`}>
      <div
        className="h-full transition-[width] duration-300 ease-out"
        style={{
          width: `${pct}%`,
          background: color,
          boxShadow: full ? `0 0 10px 1px ${color}` : `0 0 6px ${color}`,
          // Fires on the transition from not-full to full, and again the
          // next time a fresh bin fills, because the property is removed
          // in between.
          animation: full ? "meter-full 520ms ease-out 260ms 1" : undefined,
        }}
      />
    </div>
  );
}
