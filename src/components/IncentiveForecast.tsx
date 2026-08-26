import { forecast, type LaneForecast } from "../game/rewards";
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
 * Two variants, because the two places it renders have different jobs.
 *
 * `panel` is the end of a file, where the refiner has just been handed
 * something and the screen already has a great deal to say. It shows one
 * lane — the nearest — as a footer line under the addendum: a promise, an
 * instruction, a meter. No box, because the addendum is the object on that
 * screen and two bordered cards compete.
 *
 * `handbook` is where someone has gone looking. It shows every lane, in a
 * card of its own, with the counters spelled out.
 */

function Meter({ pct }: { pct: number }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-sm bg-phos-800">
      <div
        className="h-full bg-phos-400 transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, boxShadow: "0 0 6px var(--color-phos-400)" }}
      />
    </div>
  );
}

const pctOf = (lane: LaneForecast) =>
  Math.min(100, Math.round((lane.current / lane.target) * 100));

/** "COMPLETE 1 MORE SCREEN" — the action, without its full stop. */
const shout = (lane: LaneForecast) =>
  lane.action.replace(/\.$/, "").toUpperCase();

function FullLane({ lane }: { lane: LaneForecast }) {
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2 text-[8px] tracking-[0.2em] text-phos-600">
        <span>{lane.label}</span>
        <span className="tabular-nums text-phos-400">
          {lane.current} / {lane.target}
        </span>
      </div>
      <div className="mt-1">
        <Meter pct={pctOf(lane)} />
      </div>
      <p className="mt-1 text-[9px] leading-snug text-phos-400">{lane.action}</p>
      {/* A compound reward is the one case where two counters show at once.
          Both numbers, and the sentence that stops the second one reading
          as a second reward. */}
      {lane.also ? (
        <>
          <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[8px] tracking-[0.2em] text-phos-600">
            <span>{lane.also.label}</span>
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
  variant?: "panel" | "handbook";
}

export function IncentiveForecast({ progress, variant = "handbook" }: Props) {
  const lanes = forecast(counters(progress));
  // Before the first screen is refined there is no forecast: the finger trap
  // and the eraser arrive unannounced, and the ladder introduces itself once
  // it has already paid out. A ladder with nothing left to give also says
  // nothing rather than showing an empty counter.
  if (progress.screensCompleted < 1 || lanes.length === 0) return null;

  if (variant === "panel") {
    // The nearest goal, because one instruction is worth more than two.
    // Both lanes are a handbook away, and the other one is rarely the
    // interesting one: what a refiner wants at the end of a file is the
    // shortest thing they could do next.
    const lane = [...lanes].sort((a, b) => a.remaining - b.remaining)[0];
    return (
      <div className="w-full max-w-[280px] text-left">
        <div className="mb-2 h-px w-full bg-phos-800" />
        <div className="flex items-baseline justify-between gap-2 text-[8px] tracking-[0.22em] text-phos-600">
          <span>NEXT INCENTIVE</span>
          <span>CLASSIFIED</span>
        </div>
        <p className="crt-text-glow mt-1.5 text-[10px] font-bold tracking-[0.14em] text-phos-300">
          {shout(lane)}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <Meter pct={pctOf(lane)} />
          <span className="shrink-0 text-[8px] tabular-nums tracking-[0.14em] text-phos-600">
            {lane.current}/{lane.target}
          </span>
        </div>
        {lane.also ? (
          <p className="mt-1.5 text-[8px] tracking-[0.16em] text-phos-600">
            {`ALSO ${lane.also.current}/${lane.also.target} ${lane.also.label} · BOTH REQUIRED`}
          </p>
        ) : null}
      </div>
    );
  }

  const owed = progress.rewardQueue.length;
  return (
    <div className="w-full rounded-[3px] border border-phos-700 bg-phos-900/40 px-3 py-2.5 text-left">
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
          <FullLane key={lane.lane} lane={lane} />
        ))}
      </div>
      <p className="mt-2.5 border-t border-phos-800 pt-2 text-[8px] tracking-[0.18em] text-phos-600">
        INCENTIVE DETAILS: CLASSIFIED
      </p>
    </div>
  );
}
