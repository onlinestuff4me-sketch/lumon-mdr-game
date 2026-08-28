import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { categoryProgress } from "../game/held";
import { RECORD_TITLE, keptLabel } from "../game/lexicon";
import { counters, type Progress } from "../game/progress";
import { forecast } from "../game/rewards";

/**
 * What was kept, what it counts toward, and what earns the next one.
 *
 * The beat between accepting an incentive and going back to work. It
 * answers four questions a refiner has at that moment and at no other:
 *
 * 1. **What did I just get?** Named, because "an incentive" is not a thing
 *    anyone remembers owning and a finger trap is.
 * 2. **What does that make in total?** Progress per category, counted in
 *    payouts — ten issued items, ten outie facts, three wellness sessions,
 *    five department events. The counts tick up under the refiner's eye
 *    rather than arriving already changed, which is why this takes both
 *    the ledger before the payout and the ledger after it.
 * 3. **What do I do next?** One instruction, from the nearest lane.
 * 4. **Where does all this live from now on?** It shrinks into the
 *    incentives record in the header on the way out — the same title, the
 *    same meter, in the place it will be for the rest of the game.
 *
 * There is deliberately no paragraph explaining any of that. The screen
 * demonstrates it instead.
 */

/** Long enough that the tick is watched, short enough to feel prompt. */
const TICK_MS = 160;
/** How long the page takes to shrink into the header strip. */
const STOW_MS = 520;

interface Props {
  /** The ledger before this boundary paid out. */
  from: Progress;
  /** The ledger as it stands now. */
  to: Progress;
  /** What was earned here, in the order it was shown. */
  names: readonly string[];
  /** Opens the full record. */
  onOpenRecord: () => void;
  /** Back to the file. Called once the page has been stowed. */
  onResume: () => void;
}

export function IncentiveSummary({
  from,
  to,
  names,
  onOpenRecord,
  onResume,
}: Props) {
  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  const [shown, setShown] = useState(reduced ? to : from);
  const [flight, setFlight] = useState<{ x: number; y: number; s: number } | null>(
    null,
  );
  const [stowing, setStowing] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setShown(to), TICK_MS);
    return () => clearTimeout(t);
  }, [to, reduced]);

  /**
   * Aim the page at the header strip and let it go.
   *
   * Measured rather than assumed: the strip's position depends on the
   * viewport, and a hand-tuned offset would send the page to the wrong
   * place on any phone it was not tuned against. A frame after `stowing`
   * is set, not in a layout effect — the transform has to land on a
   * *later* paint than the one that started the transition, or the
   * browser has nothing to animate from.
   */
  useEffect(() => {
    if (!stowing) return;
    const id = requestAnimationFrame(() => {
      const page = document.querySelector("[data-incentive-summary]");
      // Whichever record is going to be *visible* when the scrim lifts.
      //
      // On a file that ends with a ceremony, the FILE REFINED panel is
      // already behind this screen and it covers the header — so the page
      // was flying at a strip nobody could see, and landing behind a
      // panel that then appeared over the top of it. The panel draws the
      // same record box; aim at that one when it is there.
      const dock =
        document.querySelector('[data-record-box="panel"]') ??
        document.querySelector('[data-record-box="hud"]');
      if (!page || !dock) return;
      const p = page.getBoundingClientRect();
      const d = dock.getBoundingClientRect();
      setFlight({
        x: d.left + d.width / 2 - (p.left + p.width / 2),
        y: d.top + d.height / 2 - (p.top + p.height / 2),
        // Height, not width. The strip is *wider* than this page and a
        // tenth of its height, so a width ratio makes the page grow on
        // its way into the thing it is supposed to be shrinking into.
        s: Math.min(1, Math.max(0.06, d.height / Math.max(1, p.height))),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [stowing]);

  const lanes = forecast(counters(shown));
  const lane = lanes.length
    ? [...lanes].sort((a, b) => a.remaining - b.remaining)[0]
    : null;
  const cats = categoryProgress(shown);
  const before = categoryProgress(from);
  const gained = cats.reduce((n, c) => n + c.have, 0) -
    before.reduce((n, c) => n + c.have, 0);

  const stow = () => {
    if (stowing) return;
    if (reduced) return onResume();
    setStowing(true);
    setTimeout(onResume, STOW_MS);
  };

  return (
    <div
      className="absolute inset-0 z-70 flex flex-col items-center justify-center overflow-hidden px-7"
      style={{
        // The scrim lifts as the page leaves, so the strip it is flying
        // into is visible before it gets there. Flying at an opaque wall
        // is a page that vanishes; flying at a lit box is a page that
        // lands.
        background: stowing ? "rgba(1,7,4,0)" : "rgba(1,7,4,0.97)",
        transition: stowing ? `background ${STOW_MS}ms ease-in` : undefined,
        animation: reduced
          ? undefined
          : "crt-open 300ms cubic-bezier(.2,.7,.3,1) 1",
      }}
    >
      <div
        data-incentive-summary
        className="flex w-full max-w-[286px] flex-col items-center text-center"
        style={{
          transition: stowing
            ? `transform ${STOW_MS}ms cubic-bezier(.5,0,.25,1), opacity ${STOW_MS}ms ease-in`
            : undefined,
          transform: flight
            ? `translate(${flight.x}px, ${flight.y}px) scale(${flight.s})`
            : undefined,
          opacity: flight ? 0.08 : 1,
        }}
      >
        <p className="text-[9px] tracking-[0.3em] text-phos-600">
          {keptLabel(Math.max(1, gained))}
        </p>
        <h1 className="crt-text-glow mt-2 text-[13px] font-bold tracking-[0.18em] text-phos-200">
          {RECORD_TITLE}
        </h1>
        <div className="mt-2 h-px w-24 bg-phos-600" />

        {names.length > 0 ? (
          <p className="mt-3 text-[10px] leading-relaxed text-phos-300">
            {names.join(" · ")}
          </p>
        ) : null}

        {/* What each of those counts toward. Only categories the refiner
            has opened an account in: a row reading 0 of 5 DEPARTMENT
            EVENTS on the first file is a promise this screen has no
            business making. */}
        <div className="mt-4 w-full space-y-2">
          {cats
            .filter((c) => c.have > 0)
            .map((c) => (
              <div key={c.category} className="w-full text-left">
                <div className="flex items-baseline justify-between gap-2 text-[8px] tracking-[0.2em]">
                  <span className="text-phos-400">{c.label}</span>
                  <span className="tabular-nums text-phos-500">
                    {c.have} OF {c.total}
                  </span>
                </div>
                <div className="mt-1 h-[3px] w-full overflow-hidden rounded-sm bg-phos-800">
                  <div
                    className="h-full bg-phos-400 transition-[width] duration-500 ease-out"
                    style={{
                      width: `${Math.round((c.have / c.total) * 100)}%`,
                      boxShadow: "0 0 6px var(--color-phos-400)",
                    }}
                  />
                </div>
              </div>
            ))}
        </div>

        {/* What earns the next one. Never what it is. */}
        {lane ? (
          <div className="mt-4 w-full rounded-[3px] border border-phos-700 bg-phos-900/40 px-3 py-2.5 text-left">
            <div className="flex items-baseline justify-between gap-2 text-[8px] tracking-[0.22em] text-phos-600">
              <span>NEXT INCENTIVE</span>
              <span>CLASSIFIED</span>
            </div>
            <p className="crt-text-glow mt-1.5 text-[11px] font-bold tracking-[0.14em] text-phos-200">
              {lane.action.replace(/\.$/, "").toUpperCase()}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-phos-800">
                <div
                  className="h-full bg-phos-400 transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, Math.round((lane.current / lane.target) * 100))}%`,
                    boxShadow: "0 0 6px var(--color-phos-400)",
                  }}
                />
              </div>
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
        ) : null}

        <button
          type="button"
          data-view-record
          onClick={onOpenRecord}
          className="mt-3 inline-flex items-center gap-1 text-[9px] tracking-[0.2em] text-phos-500 underline-offset-4 active:text-phos-300"
        >
          VIEW ALL INCENTIVES
          <ChevronRight size={10} strokeWidth={2.4} aria-hidden />
        </button>

        {/* Inside the page it dismisses, so the whole thing leaves as one
            object. Left outside, it sat where it was while everything
            above it flew away, which reads as the page breaking rather
            than as the page being put somewhere. */}
        <button
          type="button"
          data-record-landing
          onClick={stow}
          className="crt-text-glow mt-5 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-phos-200 active:bg-phos-600/50"
          style={
            stowing || reduced
              ? undefined
              : { animation: "crt-throb 1.9s ease-in-out infinite" }
          }
        >
          RESUME REFINEMENT
          <ChevronRight size={12} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
