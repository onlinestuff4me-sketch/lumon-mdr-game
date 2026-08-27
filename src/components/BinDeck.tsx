import { TEMPER_DEFS } from "../game/constants";
import type { BinView } from "../game/engine";
import type { StageLayout } from "../game/layout";

/**
 * The temper bins. One row, always, however many the file shows.
 *
 * Positions come from the same `computeLayout` the engine hit-tests
 * against, so what the refiner sees and what the engine considers a drop
 * target can never drift apart.
 *
 * Each bin is the same shape as the file meter in the header: a name on
 * one line, a meter and a percentage on the next. Stacking those two lines
 * is what buys the horizontal room for four bins across — laid out side by
 * side they need about 140px each and there are 366 to go round.
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
      {/* Pinned to where the bins actually are, not to the bottom of the
          stage: the incentives record has a band under them. */}
      <div
        className="absolute inset-x-0 border-y border-phos-700/70 bg-phos-900/85"
        style={{ top: layout.binsTop, height: layout.binsH }}
      />
      {bins.map((bin) => {
        const def = TEMPER_DEFS[bin.temper];
        const rect = layout.binRects[bin.temper];
        const pct = Math.round(bin.fill * 100);
        const full = bin.fill >= 0.999;
        // The long name is a teaching aid and the first thing to go when
        // there is no room for it: at four across a cell is 84px, and
        // "MALICE" beside "04: MA" does not fit in that.
        const roomForName = rect.w > 118;
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
            className="absolute flex flex-col justify-center gap-1.5 rounded-[3px] border px-2 transition-shadow duration-150"
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
              // the arrows point somewhere that looks like it is waiting
              // rather than at one more piece of chrome.
              animation:
                bin.target && !bin.hover
                  ? "bin-await 1.5s ease-in-out infinite"
                  : undefined,
            }}
          >
            <div className="flex items-baseline gap-1.5 overflow-hidden">
              <span
                className="crt-text-glow shrink-0 text-[11px] font-bold tracking-[0.14em]"
                style={{ color: def.css }}
              >
                {def.code}: {bin.temper}
              </span>
              {roomForName ? (
                <span className="truncate text-[8px] tracking-[0.1em] text-phos-600">
                  {def.name}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <Meter pct={pct} color={def.css} full={full} />
              <span className="shrink-0 text-[9px] tabular-nums text-phos-400">
                {pct}%
              </span>
            </div>
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
}: {
  pct: number;
  color: string;
  full: boolean;
}) {
  return (
    <div className="h-[7px] flex-1 overflow-hidden rounded-[1px] bg-phos-800">
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
