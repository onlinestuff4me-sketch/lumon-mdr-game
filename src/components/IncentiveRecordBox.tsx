import { ChevronRight } from "lucide-react";
import { heldRewards } from "../game/held";
import { RECORD_TITLE, heldLabel } from "../game/lexicon";
import { counters, type Progress } from "../game/progress";
import { forecast, type LaneForecast } from "../game/rewards";

/**
 * The incentives record: how much is kept, what the next one costs, and a
 * way in.
 *
 * One component, two shapes, because it has to be recognizable as the same
 * object in both places it appears — the strip that lives in the header
 * for the whole game, and the card the end-of-file panel and the summary
 * screen draw. A refiner watches the summary shrink into the header strip
 * and then finds the same title and the same meter waiting there; if those
 * were two different components they would drift, and the whole teaching
 * depends on them being the same thing.
 *
 * What it may show: the counter, the target, the remainder, and the exact
 * action. What it may never show: a name, an image, a category of the
 * thing coming, or the threshold after this one. `IncentiveForecast` keeps
 * that contract for the numbers; this keeps it for the frame.
 */

/** "REFINE 1 MORE FILE" — the action, shouted, without its full stop. */
const shout = (lane: LaneForecast) => lane.action.replace(/\.$/, "").toUpperCase();

const pctOf = (lane: LaneForecast) =>
  Math.min(100, Math.round((lane.current / lane.target) * 100));

interface Props {
  progress: Progress;
  /** Opens the full record. */
  onOpen: () => void;
  /**
   * `hud` is the permanent strip in the header: two dense lines, sized to
   * a band that the board cannot afford to give much of.
   *
   * `panel` is the card on a screen that has room — the end-of-file panel
   * and the summary after a payout.
   */
  variant: "hud" | "panel";
  /** True just after an incentive has been kept, for the pulse. */
  landing?: boolean;
}

export function IncentiveRecordBox({
  progress,
  onOpen,
  variant,
  landing = false,
}: Props) {
  const kept = heldRewards(progress).length;
  // The nearest goal, because one instruction is worth more than two. The
  // rest are one tap away in the full record.
  const lanes = forecast(counters(progress));
  const lane = lanes.length
    ? [...lanes].sort((a, b) => a.remaining - b.remaining)[0]
    : null;
  const hud = variant === "hud";

  return (
    <button
      type="button"
      onClick={onOpen}
      data-record-box={variant}
      // `pointer-events-auto` because the header that carries the strip is
      // `pointer-events-none`, so a packet dragged under it stays grabbable.
      className={`pointer-events-auto w-full text-left transition-colors ${
        hud
          ? "rounded-[2px] border px-2 py-1"
          : "max-w-[280px] rounded-[3px] border px-3 py-2.5"
      } ${
        landing
          ? "border-phos-400 bg-phos-600/25"
          : "border-phos-700 bg-phos-900/40"
      }`}
      style={landing ? { animation: "bin-await 700ms ease-out 1" } : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`crt-text-glow tracking-[0.22em] text-phos-300 ${
            hud ? "text-[9px]" : "text-[8px] text-phos-400 tracking-[0.24em]"
          }`}
        >
          {RECORD_TITLE}
        </span>
        <span
          className={`inline-flex items-center gap-1 tracking-[0.18em] text-phos-500 ${
            hud ? "text-[9px]" : "text-[8px]"
          }`}
        >
          {heldLabel(kept)}
          <ChevronRight size={hud ? 10 : 9} strokeWidth={2.4} aria-hidden />
        </span>
      </div>

      {/* Before the first file is refined there is no forecast at all: the
          first two incentives arrive unannounced, and the ladder
          introduces itself only once it has already paid out. The strip
          still exists — it is furniture, and furniture that appears
          halfway through a game reads as a bug — it simply has nothing to
          promise yet. */}
      {lane ? (
        <div className={hud ? "mt-0.5" : "mt-2 border-t border-phos-800 pt-2"}>
          {hud ? null : (
            <div className="flex items-baseline justify-between gap-2 text-[8px] tracking-[0.22em] text-phos-600">
              <span>NEXT INCENTIVE</span>
              <span>CLASSIFIED</span>
            </div>
          )}
          <div
            className={`flex items-center gap-2 ${hud ? "" : "mt-1.5"}`}
          >
            <span
              className={`crt-text-glow shrink-0 font-bold tracking-[0.14em] text-phos-300 ${
                hud ? "text-[8px]" : "text-[10px]"
              }`}
            >
              {shout(lane)}
            </span>
            <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-phos-800">
              <div
                className="h-full bg-phos-400 transition-[width] duration-500 ease-out"
                style={{
                  width: `${pctOf(lane)}%`,
                  boxShadow: "0 0 6px var(--color-phos-400)",
                }}
              />
            </div>
            <span
              className={`shrink-0 tabular-nums tracking-[0.14em] text-phos-600 ${
                hud ? "text-[8px]" : "text-[8px]"
              }`}
            >
              {lane.current}/{lane.target}
            </span>
          </div>
          {lane.also && !hud ? (
            <p className="mt-1.5 text-[8px] tracking-[0.16em] text-phos-600">
              {`ALSO ${lane.also.current}/${lane.also.target} ${lane.also.label} · BOTH REQUIRED`}
            </p>
          ) : null}
        </div>
      ) : (
        <div className={hud ? "mt-0.5" : "mt-2 border-t border-phos-800 pt-2"}>
          <span
            className={`tracking-[0.14em] text-phos-700 ${
              hud ? "text-[8px]" : "text-[9px]"
            }`}
          >
            NO ENTRIES
          </span>
        </div>
      )}
    </button>
  );
}
