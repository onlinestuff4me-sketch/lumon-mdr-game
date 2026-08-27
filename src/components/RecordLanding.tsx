import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { heldRewards } from "../game/held";
import type { Progress } from "../game/progress";
import { IncentiveRecord } from "./IncentiveRecord";
import { DOCK_FROM_BOTTOM, DOCK_HEIGHT, RECORD_DOCK } from "./recordDock";

/**
 * Where the incentive went, and what the next one costs.
 *
 * This is the beat between accepting an incentive and going back to work,
 * and it exists to answer three questions a refiner has at exactly that
 * moment and at no other:
 *
 * 1. **Where did that go?** The card flew into a block. The block is
 *    still here, in the same place on the screen, holding one more item
 *    than it did a second ago.
 * 2. **What do I have?** The count ticks up rather than simply reading
 *    higher, because a number that changes while you are looking at it is
 *    a number you believe.
 * 3. **What do I do next?** The record carries the forecast — the nearest
 *    lane, its meter, and the one action that advances it. What the next
 *    incentive *is* stays classified; what it costs never is.
 *
 * And one it answers for later: the block is a control, it is tappable
 * here, and it is the same block that sits at the foot of every file
 * screen. A refiner who learns to tap it here has learned where their
 * things live.
 *
 * The meter and the count animate from the ledger as it stood *before*
 * this boundary paid out, which is why both progresses are passed in.
 */

/** Long enough that the tick is watched, short enough to feel prompt. */
const TICK_MS = 140;

interface Props {
  /** The ledger before this boundary's incentives were claimed. */
  from: Progress;
  /** The ledger as it stands now. */
  to: Progress;
  /** What was just filed, for the confirmation line. */
  names: readonly string[];
  /** Opens the full record — shelf, facts, forecast. */
  onOpenRecord: () => void;
  /** Back to the file. */
  onResume: () => void;
}

export function RecordLanding({
  from,
  to,
  names,
  onOpenRecord,
  onResume,
}: Props) {
  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  // Mount showing the old ledger, then swap: the meter's own width
  // transition and the count both move under the refiner's eye rather
  // than arriving already changed.
  const [shown, setShown] = useState(reduced ? to : from);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setShown(to), TICK_MS);
    return () => clearTimeout(t);
  }, [to, reduced]);

  const gained = heldRewards(to).length - heldRewards(from).length;

  return (
    <div
      className="absolute inset-0 z-70 overflow-hidden bg-phos-950/97"
      style={
        reduced
          ? undefined
          : { animation: "crt-open 300ms cubic-bezier(.2,.7,.3,1) 1" }
      }
    >
      {/* The heading sits above the block rather than in flow with it, so
          that the block itself cannot be pushed off the position the card
          was just aimed at. */}
      <div
        className="absolute inset-x-7 top-0 flex flex-col items-center justify-end pb-5 text-center"
        style={{
          // Anchored off the dock rather than given a height of its own:
          // the block's position is fixed by `RECORD_DOCK`, and a header
          // measured from the top of the screen instead overlaps it on
          // any viewport whose height it was not tuned against.
          bottom: `calc(${DOCK_FROM_BOTTOM} + ${DOCK_HEIGHT})`,
          animation: reduced ? undefined : "crt-resolve 460ms ease-out 1",
        }}
      >
        <p className="text-[9px] tracking-[0.3em] text-phos-600">
          {gained > 1 ? `${gained} INCENTIVES FILED` : "INCENTIVE FILED"}
        </p>
        <h1 className="crt-text-glow mt-2 max-w-[280px] text-[13px] font-bold leading-tight tracking-[0.18em] text-phos-200">
          ADDED TO YOUR
          <br />
          INCENTIVE RECORD
        </h1>
        <div className="mt-3 h-px w-24 bg-phos-600" />

        {/* Named, because "an incentive" is not a thing anyone remembers
            owning and a finger trap is. */}
        {names.length > 0 ? (
          <p className="mt-3 max-w-[262px] text-[10px] leading-relaxed text-phos-300">
            {names.join(" · ")}
          </p>
        ) : null}
        <p className="mt-3 max-w-[262px] text-[9px] leading-relaxed text-phos-600">
          Your record is held at this terminal and appears at the foot of
          every file. It may be opened at any time.
        </p>
      </div>

      {/* The block, exactly where the card landed. Live, so the sentence
          above it can be acted on the moment it is read. */}
      <div className={RECORD_DOCK}>
        <IncentiveRecord progress={shown} onOpen={onOpenRecord} landing />
      </div>

      <div className="absolute inset-x-7 bottom-[8vh] flex justify-center">
        <button
          type="button"
          data-record-landing
          onClick={onResume}
          className="crt-text-glow inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.22em] text-phos-200 active:bg-phos-600/50"
          style={
            reduced ? undefined : { animation: "crt-throb 1.9s ease-in-out infinite" }
          }
        >
          RESUME REFINEMENT
          <ChevronRight size={12} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
