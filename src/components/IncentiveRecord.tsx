import { ChevronRight } from "lucide-react";
import { heldRewards } from "../game/held";
import type { Progress } from "../game/progress";
import { IncentiveForecast } from "./IncentiveForecast";

/**
 * The incentive record: where a reward goes, and where to go to find it.
 *
 * The block sits at the foot of every completed file. An incentive that
 * has just been accepted visibly shrinks into it, which is the whole
 * point — a refiner who has watched something be filed knows where the
 * filing cabinet is, and does not have to be told to open the handbook.
 *
 * It carries three things and no more: how many items are held, what the
 * next one costs, and the fact that it can be opened.
 */

interface Props {
  progress: Progress;
  /** Opens the full record — the shelf, the facts, the forecast. */
  onOpen: () => void;
  /** Objects issued again this file, filed without a ceremony. */
  filed?: readonly string[];
  /** True while an incentive is landing in it, for the pulse. */
  landing?: boolean;
}

export function IncentiveRecord({
  progress,
  onOpen,
  filed = [],
  landing = false,
}: Props) {
  const held = heldRewards(progress).length;
  if (held === 0 && progress.screensCompleted < 1) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-incentive-record
      className={`w-full max-w-[280px] rounded-[3px] border bg-phos-900/40 px-3 py-2.5 text-left transition-colors ${
        landing ? "border-phos-400 bg-phos-600/25" : "border-phos-700"
      }`}
      style={landing ? { animation: "bin-await 700ms ease-out 1" } : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="crt-text-glow text-[8px] tracking-[0.24em] text-phos-400">
          INCENTIVE RECORD
        </span>
        <span className="inline-flex items-center gap-1 text-[8px] tracking-[0.18em] text-phos-600">
          {held === 1 ? "1 ITEM HELD" : `${held} ITEMS HELD`}
          <ChevronRight size={9} strokeWidth={2.4} aria-hidden />
        </span>
      </div>

      {filed.length > 0 ? (
        <p className="mt-1.5 text-[8px] leading-snug tracking-[0.14em] text-phos-300">
          {filed.map((n) => `${n} ISSUED AGAIN`).join(" · ")} · FILED
        </p>
      ) : null}

      <div className="mt-2 border-t border-phos-800 pt-2">
        <IncentiveForecast progress={progress} variant="panel" />
      </div>
    </button>
  );
}
