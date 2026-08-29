import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { categoryProgress } from "../game/held";
import { RECORD_TITLE, keptLabel } from "../game/lexicon";
import { counters, type Progress } from "../game/progress";
import { forecast } from "../game/rewards";
import { FileGlyph } from "./FileGlyph";

/**
 * What was kept, what it counts toward, and what earns the next one.
 *
 * The beat between accepting an incentive and going back to work. It
 * answers four questions a refiner has at that moment and at no other, and
 * it answers them in the order they are asked:
 *
 * 1. **What is this screen?** The incentives record — the same title as
 *    the strip in the header, said first, so the rest of the screen has a
 *    name to hang on.
 * 2. **What did I just get?** Named, because "an incentive" is not a thing
 *    anyone remembers owning and a finger trap is.
 * 3. **What does that make in total?** Progress per category, counted in
 *    payouts. The file that was just kept is walked into the bar it moved
 *    and the bar is lit as it takes it: the count does not merely arrive
 *    already changed, it is seen being changed by the thing on screen.
 * 4. **What earns the next one?** Last, loudest, and bordered — the only
 *    forward-looking object on a screen that is otherwise a receipt. A
 *    refiner leaves this page knowing another one is coming and exactly
 *    what it costs.
 *
 * And on the way out: **where does all this live from now on?** The page
 * shrinks into the incentives record in the header — the same title, the
 * same meter, in the place it will be for the rest of the game — and that
 * box glows once it has it.
 *
 * There is deliberately no paragraph explaining any of that. The screen
 * demonstrates it instead.
 */

/** Long enough that the tick is watched, short enough to feel prompt. */
const TICK_MS = 160;
/** How long the kept file takes to reach the meter it counted toward. */
const FLY_MS = 480;
/** How long the fed meter stays lit after it lands. */
const GLOW_MS = 1000;
/** How long the page takes to shrink into the header strip. */
const STOW_MS = 620;

interface Props {
  /** The ledger before this boundary paid out. */
  from: Progress;
  /** The ledger as it stands now. */
  to: Progress;
  /** What was earned here, in the order it was shown. */
  names: readonly string[];
  /** Objects issued again this file and filed without a card. */
  filed?: readonly string[];
  /** Opens the full record. */
  onOpenRecord: () => void;
  /** Back to the file. Called once the page has been stowed. */
  onResume: () => void;
}

export function IncentiveSummary({
  from,
  to,
  names,
  filed = [],
  onOpenRecord,
  onResume,
}: Props) {
  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  const [shown, setShown] = useState(reduced ? to : from);
  /** True while the kept file is on its way to the meter. */
  const [flying, setFlying] = useState(!reduced);
  /** Where that file is headed, measured once the bars are on screen. */
  const [drop, setDrop] = useState<{ x: number; y: number } | null>(null);
  /** True for a beat after it lands, which is when the meter is lit. */
  const [fed, setFed] = useState(false);
  const [flight, setFlight] = useState<{ x: number; y: number; s: number } | null>(
    null,
  );
  const [stowing, setStowing] = useState(false);

  const now = categoryProgress(shown);
  const final = categoryProgress(to);
  const start = categoryProgress(from);
  const live = new Map(now.map((c) => [c.category, c]));
  const had = new Map(start.map((c) => [c.category, c.have]));
  /**
   * Which shelves to draw.
   *
   * Taken from the ledger *after* the payout, not before: the row a refiner
   * needs to watch move is precisely the one that was at zero a second ago,
   * and filtering on the old ledger meant the first incentive of a category
   * had no bar to arrive in. Rows still show the count as it stands, so a
   * new one opens at 0 and ticks to 1 under the eye.
   *
   * Categories with nothing in them either way stay off: a row reading
   * 0 OF 5 DEPARTMENT EVENTS on the first file is a promise this screen
   * has no business making.
   */
  const rows = final.filter((c) => c.have > 0);
  const gained = new Set(
    rows.filter((c) => c.have > (had.get(c.category) ?? 0)).map((c) => c.category),
  );
  const kept = final.reduce((n, c) => n + c.have, 0) -
    start.reduce((n, c) => n + c.have, 0);

  const page = useRef<HTMLDivElement | null>(null);

  /**
   * Aim the kept file at the meter it moved, then let the counts tick.
   *
   * Measured a frame after mount, for the same reason the stow below is:
   * the bars have to exist and be laid out before anything can be sent at
   * one of them. With nothing gained — every category already full, or a
   * boundary that paid nothing — there is no flight and the counts simply
   * tick, which is what this screen has always done.
   */
  useEffect(() => {
    if (reduced) return;
    if (!flying) return;
    const target = rows.find((c) => gained.has(c.category))?.category ?? null;
    const id = requestAnimationFrame(() => {
      const host = page.current;
      const dock = target
        ? host?.querySelector(`[data-cat-meter="${target}"]`)
        : null;
      if (host && dock) {
        const h = host.getBoundingClientRect();
        const d = dock.getBoundingClientRect();
        setDrop({
          x: d.left + d.width / 2 - (h.left + h.width / 2),
          y: d.top + d.height / 2 - (h.top + h.height / 2),
        });
      } else {
        setDrop({ x: 0, y: 0 });
      }
    });
    const land = setTimeout(() => {
      setFlying(false);
      setShown(to);
      setFed(true);
    }, FLY_MS);
    const dim = setTimeout(() => setFed(false), FLY_MS + GLOW_MS);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(land);
      clearTimeout(dim);
    };
    // Runs once for the boundary: the flight belongs to this arrival, and
    // re-running it against a ticked-over ledger would send a second file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reduced motion still gets the count, just without the journey. */
  useEffect(() => {
    if (reduced || flying) return;
    const t = setTimeout(() => setShown(to), TICK_MS);
    return () => clearTimeout(t);
  }, [to, reduced, flying]);

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
      const host = page.current;
      // Whichever record is going to be *visible* when the scrim lifts. On
      // a file that ends without a payout the end-of-file panel is behind
      // this screen and covers the header, and it draws the same box; a
      // file that ended with one skips that panel entirely and the header
      // strip is what is waiting.
      const dock =
        document.querySelector('[data-record-box="panel"]') ??
        document.querySelector('[data-record-box="hud"]');
      if (!host || !dock) return;
      const p = host.getBoundingClientRect();
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
        ref={page}
        data-incentive-summary
        className="relative flex w-full max-w-[286px] flex-col items-center text-center"
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
        {/* 1. The name of the place. Same words as the header strip. */}
        <h1 className="crt-text-glow text-[13px] font-bold tracking-[0.18em] text-phos-200">
          {RECORD_TITLE}
        </h1>
        <div className="mt-2 h-px w-24 bg-phos-600" />

        {/* 2. What was kept, said plainly and named. */}
        <p className="mt-3 text-[9px] tracking-[0.3em] text-phos-600">
          {keptLabel(Math.max(1, kept))}
        </p>
        {names.length > 0 ? (
          <p className="crt-text-glow mt-1.5 text-[11px] leading-relaxed text-phos-200">
            {names.join(" · ")}
          </p>
        ) : null}
        {filed.length > 0 ? (
          <p className="mt-1.5 text-[8px] leading-snug tracking-[0.14em] text-phos-600">
            {filed.map((n) => `${n} ISSUED AGAIN`).join(" · ")} · KEPT
          </p>
        ) : null}

        {/* 3. What each of those counts toward, and the one that just
               moved lit as it takes the file. */}
        <div className="mt-4 w-full space-y-2">
          {rows.map((row) => {
            const c = live.get(row.category) ?? row;
            const lit = fed && gained.has(row.category);
            return (
              <div key={row.category} className="w-full text-left">
                <div className="flex items-baseline justify-between gap-2 text-[8px] tracking-[0.2em]">
                  <span className={lit ? "text-phos-200" : "text-phos-400"}>
                    {row.label}
                  </span>
                  <span className="tabular-nums text-phos-500">
                    {c.have} OF {row.total}
                  </span>
                </div>
                <div
                  data-cat-meter={row.category}
                  className="mt-1 h-[3px] w-full overflow-hidden rounded-sm bg-phos-800"
                  style={
                    lit ? { animation: `meter-take ${GLOW_MS}ms ease-out 1` } : undefined
                  }
                >
                  <div
                    className="h-full bg-phos-400 transition-[width] duration-500 ease-out"
                    style={{
                      width: `${Math.round((c.have / row.total) * 100)}%`,
                      boxShadow: "0 0 6px var(--color-phos-400)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. The way in to everything kept so far. */}
        <button
          type="button"
          data-view-record
          onClick={onOpenRecord}
          className="mt-3 inline-flex items-center gap-1 text-[9px] tracking-[0.2em] text-phos-500 underline-offset-4 active:text-phos-300"
        >
          VIEW ALL INCENTIVES
          <ChevronRight size={10} strokeWidth={2.4} aria-hidden />
        </button>

        {/* 5. What earns the next one — never what it is. Last on the page
               and the brightest thing on it: everything above is a receipt
               for work already done, and this is the only line that is
               about the work still to do. */}
        {lane ? (
          <div className="mt-4 w-full rounded-[3px] border border-phos-500 bg-phos-900/60 px-3 py-3 text-left">
            <p className="crt-text-glow text-[9px] font-bold tracking-[0.22em] text-phos-300">
              ANOTHER INCENTIVE IS COMING
            </p>
            <p className="crt-text-glow mt-2 text-[13px] font-bold leading-tight tracking-[0.14em] text-phos-100">
              {lane.action.replace(/\.$/, "").toUpperCase()}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-[5px] flex-1 overflow-hidden rounded-sm bg-phos-800">
                <div
                  className="h-full bg-phos-300 transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, Math.round((lane.current / lane.target) * 100))}%`,
                    boxShadow: "0 0 8px var(--color-phos-300)",
                  }}
                />
              </div>
              <span className="shrink-0 text-[9px] tabular-nums tracking-[0.14em] text-phos-400">
                {lane.current}/{lane.target}
              </span>
            </div>
            <p className="mt-2 text-[8px] tracking-[0.2em] text-phos-500">
              {`${lane.remaining} TO GO · CONTENTS CLASSIFIED`}
            </p>
            {lane.also ? (
              <p className="mt-1.5 text-[8px] tracking-[0.16em] text-phos-600">
                {`ALSO ${lane.also.current}/${lane.also.target} ${lane.also.label} · BOTH REQUIRED`}
              </p>
            ) : null}
          </div>
        ) : null}

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

        {/* The file the card folded itself into, arriving. It starts in the
            middle of the page — where the card was — and goes into the bar
            it moved, which is the whole of the explanation this screen
            gives for why that bar then changes. */}
        {flying ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            style={{
              transition: drop
                ? `transform ${FLY_MS}ms cubic-bezier(.45,0,.25,1), opacity ${FLY_MS}ms ease-in`
                : undefined,
              transform: drop
                ? `translate(${drop.x}px, ${drop.y}px) scale(0.16)`
                : undefined,
              opacity: drop ? 0.15 : 1,
            }}
          >
            <FileGlyph size={38} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
