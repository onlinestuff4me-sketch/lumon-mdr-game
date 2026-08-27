import { ChevronRight } from "lucide-react";

/**
 * The notice that a run of clean files has ended.
 *
 * It holds the board the way an incentive does, because it is the same
 * kind of news in the other direction: a commendation the refiner was
 * walking toward has just moved further away, and they are owed both that
 * fact and the number that would earn it back.
 *
 * Most of orientation advances itself, so this cannot live on the file
 * panel — a screen that wipes 900ms after clearing would carry the notice
 * off with it. It takes its own beat and waits to be acknowledged.
 *
 * The copy stays inside Lumon's vocabulary. The refiner has a *record*,
 * it was *unblemished*, and what it earns is a *commendation*: nothing
 * here is a scoreboard and nothing here is a streak.
 */

interface Props {
  /** How many clean files the run reached before it closed. */
  at: number;
  /** Consecutive clean files the next commendation asks for. */
  needs: number;
  onAcknowledge: () => void;
}

export function RecordNotice({ at, needs, onAcknowledge }: Props) {
  return (
    <div
      className="absolute inset-0 z-70 flex flex-col items-center justify-center overflow-hidden bg-phos-950/97 px-7 text-center"
      style={{ animation: "crt-open 300ms cubic-bezier(.2,.7,.3,1) 1" }}
    >
      <p className="text-[9px] tracking-[0.3em] text-phos-600">NOTICE</p>
      <h1 className="mt-2 max-w-[280px] text-[13px] font-bold leading-tight tracking-[0.18em] text-alarm">
        YOUR UNBLEMISHED RECORD
        <br />
        HAS BEEN CLOSED
      </h1>
      <div className="mt-3 h-px w-24 bg-alarm/60" />

      <p className="mt-4 max-w-[262px] text-[10px] leading-relaxed text-phos-400">
        A temper was consigned to a bin that did not want it. The record
        stood at {at} {at === 1 ? "file" : "files"} refined without error.
        It now stands at none.
      </p>
      <p className="mt-3 max-w-[262px] text-[10px] leading-relaxed text-phos-300">
        {needs} consecutive files refined without error are required before
        the next commendation may be issued.
      </p>
      <p className="mt-3 max-w-[262px] text-[9px] leading-relaxed text-phos-600">
        No incentive already held has been withdrawn. Lumon does not take
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
