import { ChevronRight } from "lucide-react";

/**
 * The notice that a run of clean files has ended, and where the incentive
 * it was earning has gone.
 *
 * It holds the board the way an incentive does, because it is the same
 * kind of news in the other direction — but it is deliberately not only
 * bad news. A refiner who is told an incentive has been missed and left
 * there has been punished for a slip; a refiner who is told it has been
 * *rescheduled*, to a file count they can reach by refining files, has
 * been told the truth and given the way back in the same breath.
 *
 * This never fires during orientation. A wrong bin there gets the red
 * line at the top of the board and nothing else: the precision lane does
 * not run while the refiner is still being taught which bin is which.
 *
 * Most of the game past orientation ends a file on a panel, but the
 * notice still takes its own beat rather than riding on one — it is the
 * one screen that has to be acknowledged before anything else is said.
 *
 * The copy stays inside Lumon's vocabulary. The refiner has a *record*,
 * it was *unblemished*, and what it earns is an *incentive*: nothing here
 * is a scoreboard and nothing here is a streak.
 */

interface Props {
  /** How many clean files the run reached before it closed. */
  at: number;
  /** Files still to refine before the rescheduled incentive is issued. */
  due: number;
  onAcknowledge: () => void;
}

export function RecordNotice({ at, due, onAcknowledge }: Props) {
  return (
    <div
      className="absolute inset-0 z-70 flex flex-col items-center justify-center overflow-hidden bg-phos-950/97 px-7 text-center"
      style={{ animation: "crt-open 300ms cubic-bezier(.2,.7,.3,1) 1" }}
    >
      <p className="text-[9px] tracking-[0.3em] text-phos-600">NOTICE</p>
      <h1 className="mt-2 max-w-[280px] text-[13px] font-bold leading-tight tracking-[0.18em] text-alarm">
        AN INCENTIVE
        <br />
        HAS BEEN MISSED
      </h1>
      <div className="mt-3 h-px w-24 bg-alarm/60" />

      <p className="mt-4 max-w-[262px] text-[10px] leading-relaxed text-phos-400">
        A temper was consigned to a bin that did not want it. Your
        unblemished record stood at {at} {at === 1 ? "file" : "files"} and
        now stands at none, and the incentive it was earning could not be
        issued for this file.
      </p>
      {/* The point of the screen. Said in the words the refiner will
          actually be able to act on — files refined, not files refined
          without error, because the rescheduled incentive no longer asks
          for a clean one. */}
      <p className="mt-3 max-w-[262px] text-[10px] leading-relaxed text-phos-300">
        It has not been withdrawn. It has been rescheduled, and will be
        issued when {due} more {due === 1 ? "file has" : "files have"} been
        refined.
      </p>
      <p className="mt-3 max-w-[262px] text-[9px] leading-relaxed text-phos-600">
        No incentive already kept has been withdrawn. Lumon does not take
        things back.
      </p>

      <button
        type="button"
        data-record-notice
        onClick={onAcknowledge}
        className="mt-5 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.22em] text-phos-200 crt-text-glow active:bg-phos-600/50"
        style={{ animation: "crt-throb 1.9s ease-in-out infinite" }}
      >
        ACKNOWLEDGE
        <ChevronRight size={12} strokeWidth={2.6} />
      </button>
    </div>
  );
}
