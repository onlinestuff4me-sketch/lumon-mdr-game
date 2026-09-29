import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import {
  buildReport,
  sendReport,
  type ReportContext,
  type SendOutcome,
} from "../game/diagnostics";

/**
 * One tap, and the report is on its way.
 *
 * Deliberately not a form. A tester who has just hit something broken is
 * already annoyed, and every field between them and sending is a field
 * that turns a bug report into a shrug. The button collects everything the
 * device can tell us on its own, opens the share sheet with it, and gets
 * out of the way — what the refiner types, if anything, they type in the
 * message they were going to send us anyway.
 */
export function ReportButton({ context }: { context: ReportContext }) {
  const [sent, setSent] = useState<SendOutcome | null>(null);

  const go = async () => {
    const outcome = await sendReport(buildReport(context));
    setSent(outcome);
    // Back to the resting label, so a second problem can be reported
    // without reloading. Long enough to be read on a phone.
    window.setTimeout(() => setSent(null), 4000);
  };

  const label =
    sent === "shared"
      ? "REPORT FILED"
      : sent === "copied"
        ? "COPIED — PASTE IT TO US"
        : sent === "failed"
          ? "COULD NOT COPY — SCREENSHOT INSTEAD"
          : "REPORT A PROBLEM";

  return (
    <div className="mt-2 rounded-[3px] border border-phos-700 bg-phos-900/40 px-2.5 py-2">
      <button
        type="button"
        onClick={() => void go()}
        className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-3 py-2 text-[10px] font-bold tracking-[0.18em] text-phos-200 crt-text-glow active:bg-phos-600/50"
      >
        <LifeBuoy size={11} aria-hidden />
        {label}
      </button>
      <p className="mt-1.5 text-[9px] leading-snug text-phos-600">
        Sends what this terminal is — its size, its browser, its motion
        settings, how far you have refined, and anything it threw. No part
        of you is included. Nothing is sent until you tap.
      </p>
    </div>
  );
}
