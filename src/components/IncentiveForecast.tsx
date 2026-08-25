import { LANE_LABEL, forecast, type LaneForecast } from "../game/rewards";
import { counters, type Progress } from "../game/progress";

/**
 * The incentive forecast: what the next reward costs, and nothing about
 * what it is.
 *
 * The contract this component exists to keep is a negative one. It may
 * show the counter, the target, the remainder and the exact action. It may
 * never show a name, an image, a silhouette, a category, a colour theme or
 * the threshold after this one — so nothing here takes a reward id, and
 * the only string it prints about the prize itself is that the prize is
 * classified.
 *
 * It renders in two places, and in neither of them does it belong on the
 * board: the completion panel between files, and the handbook. During play
 * the number field keeps the screen to itself.
 */

function Lane({ lane }: { lane: LaneForecast }) {
  const pct = Math.min(100, Math.round((lane.current / lane.target) * 100));
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2 text-[8px] tracking-[0.2em] text-phos-600">
        <span>{LANE_LABEL[lane.lane]}</span>
        <span className="tabular-nums text-phos-400">
          {lane.current} / {lane.target}
        </span>
      </div>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-sm bg-phos-800">
        <div
          className="h-full bg-phos-400 transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            boxShadow: "0 0 6px var(--color-phos-400)",
          }}
        />
      </div>
      <p className="mt-1 text-[9px] leading-snug text-phos-400">{lane.action}</p>
      {/* A compound reward is the one case where two counters show at once.
          Both numbers, and the sentence that stops the second one reading
          as a second reward. */}
      {lane.also ? (
        <>
          <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[8px] tracking-[0.2em] text-phos-600">
            <span>{LANE_LABEL[lane.also.lane]}</span>
            <span className="tabular-nums text-phos-400">
              {lane.also.current} / {lane.also.target}
            </span>
          </div>
          <p className="mt-1 text-[8px] tracking-[0.18em] text-phos-600">
            BOTH CONDITIONS REQUIRED
          </p>
        </>
      ) : null}
    </div>
  );
}

interface Props {
  progress: Progress;
  /** Let the card fill its column. The handbook has the width; a panel
   *  over the board does not, and a 280px card is what fits there. */
  wide?: boolean;
}

export function IncentiveForecast({ progress, wide = false }: Props) {
  const lanes = forecast(counters(progress));
  // Before the first screen is refined there is no forecast: the eraser and
  // the finger trap arrive unannounced, and the ladder introduces itself
  // once it has already paid out. A ladder with nothing left to give also
  // says nothing rather than showing an empty counter.
  if (progress.screensCompleted < 1 || lanes.length === 0) return null;

  const owed = progress.rewardQueue.length;

  return (
    <div
      className={`w-full rounded-[3px] border border-phos-700 bg-phos-900/40 px-3 py-2.5 text-left ${
        wide ? "" : "max-w-[280px]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[8px] tracking-[0.24em] text-phos-600">
          NEXT INCENTIVE
        </span>
        {owed > 0 ? (
          <span className="text-[8px] tracking-[0.18em] text-phos-300">
            {owed === 1 ? "EARNED · PENDING" : `EARNED · ${owed} PENDING`}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-col gap-3">
        {lanes.map((lane) => (
          <Lane key={lane.lane} lane={lane} />
        ))}
      </div>
      <p className="mt-2.5 border-t border-phos-800 pt-2 text-[8px] tracking-[0.18em] text-phos-600">
        INCENTIVE DETAILS: CLASSIFIED
      </p>
    </div>
  );
}
