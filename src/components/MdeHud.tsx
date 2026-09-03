import { MIN_CHAIN, METER_SEGMENTS } from "../game/mde";

/**
 * The two readouts that say what the dance is asking for.
 *
 * Shared by the floor and by the demonstration that opens it, because the
 * demonstration is only worth running if what it shows is what the refiner
 * is about to be handed. Two similar HUDs would teach a HUD that does not
 * exist.
 */

/**
 * Three pips and a sentence: how many groups are in hand, out of how many.
 *
 * The floor used to carry one small grey line reading CONNECT 3+ GLOWING
 * GROUPS OF ONE TEMPER, and a refiner who did not read it had no second
 * chance to learn the rule — nothing on screen counted anything until the
 * release either worked or did not. This counts out loud, from the first
 * group touched, and the sentence changes underneath it.
 */
export function ChainPips({
  chain,
  className = "px-4 pb-2",
}: {
  chain: number;
  /** Padding from the caller — inside a frame it is tighter. */
  className?: string;
}) {
  const ready = chain >= MIN_CHAIN;
  const line = ready
    ? "RELEASE ON THE BEAT"
    : chain === 0
      ? `CONNECT ${MIN_CHAIN} GROUPS OF ONE TEMPER`
      : chain === MIN_CHAIN - 1
        ? `${chain} OF ${MIN_CHAIN} — ONE MORE GROUP`
        : `${chain} OF ${MIN_CHAIN} — KEEP DRAGGING`;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex shrink-0 items-center gap-1" aria-hidden>
        {Array.from({ length: MIN_CHAIN }, (_, i) => (
          <span
            key={i}
            className={`block h-[7px] w-[7px] rotate-45 border ${
              chain > i
                ? "border-phos-200 bg-phos-300"
                : "border-phos-700 bg-transparent"
            }`}
            style={
              chain > i
                ? { boxShadow: "0 0 6px var(--color-phos-300)" }
                : undefined
            }
          />
        ))}
      </div>
      <p
        className={`text-[8px] leading-snug tracking-[0.16em] ${
          ready ? "crt-text-glow text-phos-200" : "text-phos-500"
        }`}
        style={
          ready ? { animation: "mde-cue 1.1s ease-in-out infinite" } : undefined
        }
        // The one line on this screen that is a live instruction rather
        // than a label: announced, so a refiner using a screen reader is
        // told the chain is ready rather than watching for a glow.
        aria-live="polite"
      >
        {line}
      </p>
    </div>
  );
}

/**
 * The Dance Meter, and what is left of it.
 *
 * Filling it is the only thing that ends a session — there is no clock —
 * so the count beside it is the honest answer to "how much longer".
 */
export function DanceMeter({
  meter,
  right,
  className = "px-4 pb-4 pt-2",
}: {
  meter: number;
  /** The score, or whatever else the screen wants in the corner. */
  right?: React.ReactNode;
  /** Padding from the caller — inside a frame it is tighter. */
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        {Array.from({ length: METER_SEGMENTS }, (_, i) => (
          <div
            key={i}
            className="h-[6px] flex-1 overflow-hidden rounded-sm bg-phos-800"
          >
            <div
              className="h-full bg-phos-400 transition-[width] duration-300"
              style={{
                width: meter > i ? "100%" : "0%",
                boxShadow: "0 0 8px var(--color-phos-400)",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-[9px] tracking-[0.16em] text-phos-600">
        <span className="tabular-nums text-phos-400">
          DANCE METER {meter} / {METER_SEGMENTS}
        </span>
        {right}
      </div>
    </div>
  );
}
