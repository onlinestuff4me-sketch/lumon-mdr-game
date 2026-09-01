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
 *    payouts.
 * 4. **What earns the next one?** Last, loudest, and bordered — the only
 *    forward-looking object on a screen that is otherwise a receipt.
 *
 * ## The two animations, and why they are slow
 *
 * Both ends of this screen are teaching, and a teaching animation that
 * plays in a third of a second has taught nobody. Each one is a sequence
 * of separated beats rather than one blur, and each beat is one statement:
 *
 * **Coming in** — the incentive is put away. The card has already folded
 * itself into a file; this screen catches *that same file*, holds it long
 * enough to be seen, walks it into the row it counts toward, and the row
 * then takes it: `+1`, the number ticks, the bar grows, the whole row
 * lights. Three statements — it went into a folder, the folder went into
 * this shelf, the shelf is now one fuller.
 *
 * **Going out** — the record is put away. The page packs itself down to
 * its title, flies into the strip in the header, and that strip lights up
 * with the new count. The one thing left bright while it flies is the
 * words INCENTIVES RECORD, which are also the first words on the box it
 * lands in: the whole point of the animation is that a refiner learns
 * where this screen lives and that they may open it whenever they like.
 */

/** How long the arriving file is held, on the page, before it is filed. */
const HOLD_MS = 300;
/** How long it takes to reach the row it counts toward. */
const FLY_MS = 720;
/**
 * How long the fed row stays lit once it has it.
 *
 * Long enough for the `+1` to finish rising off the row before anything
 * else appears: what earns the next incentive is a different subject, and
 * putting it on screen while the count is still ticking asks the refiner
 * to read two things at once and lets them read neither.
 */
const GLOW_MS = 1800;
/** How long the page takes to pack itself down before it leaves. */
const PACK_MS = 420;
/** How long the packed page takes to reach the header strip. */
const STOW_MS = 780;

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

  /**
   * Where the arriving file has got to.
   *
   * `held` — on the page, where the card left it. `flying` — on its way to
   * the row. `landed` — in, with the row lit and counting. `done` — an
   * ordinary page.
   */
  const [arrival, setArrival] = useState<"held" | "flying" | "landed" | "done">(
    reduced ? "done" : "held",
  );
  const [shown, setShown] = useState(reduced ? to : from);
  /** Where the file is headed, measured once the rows are on screen. */
  const [drop, setDrop] = useState<{ x: number; y: number } | null>(null);

  /** `packing` compresses the page; `flying` sends it at the header strip. */
  const [exit, setExit] = useState<"open" | "packing" | "flying">("open");
  const [flight, setFlight] = useState<{ x: number; y: number; s: number } | null>(
    null,
  );

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
  const gained = new Map(
    rows
      .map((c) => [c.category, c.have - (had.get(c.category) ?? 0)] as const)
      .filter(([, n]) => n > 0),
  );
  /** The row the file is aimed at, and the one that lights when it lands. */
  const target = rows.find((c) => gained.has(c.category))?.category ?? null;
  const kept = final.reduce((n, c) => n + c.have, 0) -
    start.reduce((n, c) => n + c.have, 0);

  const page = useRef<HTMLDivElement | null>(null);
  /**
   * The scrim, which is what the arriving file is positioned against.
   *
   * Not the page: the page plays `crt-open`, and a file parented to it
   * inherited that unfurl — so the object handed over from the reward card
   * jumped in size and position on the frame this screen mounted, which is
   * the flicker that made it impossible to follow. The scrim does not
   * animate, and it is centred on the same point the outgoing file was.
   */
  const scrim = useRef<HTMLDivElement | null>(null);
  /** The page's size before anything was done to it, for the stow. */
  const natural = useRef<DOMRect | null>(null);

  /**
   * Walk the arriving file into the row it counts toward.
   *
   * Held first, because the file arrives on the same frame the page does
   * and a refiner who has just tapped a button is not yet looking at a
   * shelf. Measured a frame later, because the rows have to exist and be
   * laid out before anything can be sent at one of them.
   */
  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let raf = 0;
    timers.push(
      setTimeout(() => {
        raf = requestAnimationFrame(() => {
          const host = scrim.current;
          const dock = target
            ? page.current?.querySelector(`[data-cat-meter="${target}"]`)
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
          setArrival("flying");
        });
      }, HOLD_MS),
    );
    timers.push(
      setTimeout(() => {
        setArrival("landed");
        setShown(to);
      }, HOLD_MS + FLY_MS),
    );
    timers.push(
      setTimeout(() => setArrival("done"), HOLD_MS + FLY_MS + GLOW_MS),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
      cancelAnimationFrame(raf);
    };
    // Runs once for the boundary: the flight belongs to this arrival, and
    // re-running it against a ticked-over ledger would send a second file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Aim the packed page at the header strip and let it go.
   *
   * Measured rather than assumed: the strip's position depends on the
   * viewport, and a hand-tuned offset would send the page to the wrong
   * place on any phone it was not tuned against. A frame after the packing
   * beat ends, not in a layout effect — the transform has to land on a
   * *later* paint than the one that started the transition, or the browser
   * has nothing to animate from.
   */
  useEffect(() => {
    if (exit !== "packing") return;
    const t = setTimeout(() => {
      requestAnimationFrame(() => {
        // Whichever record is going to be *visible* when the scrim lifts. On
        // a file that ends without a payout the end-of-file panel is behind
        // this screen and covers the header, and it draws the same box; a
        // file that ended with one skips that panel entirely and the header
        // strip is what is waiting.
        const dock =
          document.querySelector('[data-record-box="panel"]') ??
          document.querySelector("[data-file-card]");
        const p = natural.current;
        if (!p || !dock) return;
        const d = dock.getBoundingClientRect();
        setFlight({
          x: d.left + d.width / 2 - (p.left + p.width / 2),
          y: d.top + d.height / 2 - (p.top + p.height / 2),
          // Height, not width. The strip is *wider* than this page and a
          // tenth of its height, so a width ratio makes the page grow on
          // its way into the thing it is supposed to be shrinking into.
          s: Math.min(1, Math.max(0.06, d.height / Math.max(1, p.height))),
        });
        setExit("flying");
      });
    }, PACK_MS);
    return () => clearTimeout(t);
  }, [exit]);

  const lanes = forecast(counters(shown));
  const lane = lanes.length
    ? [...lanes].sort((a, b) => a.remaining - b.remaining)[0]
    : null;
  const laneSpan = lane ? Math.max(1, lane.target - lane.from) : 1;
  const laneDone = lane ? Math.max(0, lane.current - lane.from) : 0;

  const stow = () => {
    if (exit !== "open") return;
    if (reduced) return onResume();
    // Taken before anything is scaled: a scaled rect measures the scale,
    // and the flight needs the size the page really is.
    natural.current = page.current?.getBoundingClientRect() ?? null;
    setExit("packing");
    setTimeout(onResume, PACK_MS + STOW_MS);
  };

  const leaving = exit !== "open";
  /**
   * How bright the page is under the arriving file.
   *
   * Held down while the file is in the air. The file used to be released
   * over a fully drawn record page and was immediately lost in it — a
   * small bright rectangle among a dozen bright rectangles, and the eye
   * had nothing to follow. The page comes up as the file lands, which is
   * also the moment there is anything on it worth reading.
   */
  const inFlight = arrival === "held" || arrival === "flying";
  /** True once the incentive has finished being filed and counted. */
  const settled = arrival === "done";
  const bodyDim = leaving ? 0.18 : 1;
  /**
   * Applied per element rather than to the whole body, because opacity
   * nests: a row set to full inside a container at 0.3 is still at 0.3,
   * and the destination has to stay lit or the file is a shape crossing a
   * fog. Everything the file is *not* going to wears this.
   */
  const veil = {
    opacity: inFlight ? 0.26 : 1,
    transition: "opacity 320ms ease-out",
  };

  return (
    <div
      ref={scrim}
      className="absolute inset-0 z-70 flex flex-col items-center justify-center overflow-hidden"
      style={{
        // Opaque from the first frame, and deliberately *not* animated: the
        // scrim used to unfurl along with its contents, so for two frames
        // the board flashed through between the card folding away and this
        // page arriving — which read as a glitch at the exact moment the
        // handover was supposed to be seamless.
        background: exit === "flying" ? "rgba(1,7,4,0)" : "rgba(1,7,4,0.97)",
        transition: exit === "flying" ? `background ${STOW_MS}ms ease-in` : undefined,
      }}
    >
      <div
        ref={page}
        data-incentive-summary
        className="relative flex w-full max-w-[286px] flex-col items-center px-7 text-center"
        style={{
          animation: reduced
            ? undefined
            : "crt-open 300ms cubic-bezier(.2,.7,.3,1) 1",
          transition:
            exit === "packing"
              ? `transform ${PACK_MS}ms cubic-bezier(.3,0,.2,1)`
              : exit === "flying"
                ? `transform ${STOW_MS}ms cubic-bezier(.45,0,.25,1), opacity ${STOW_MS}ms ease-in`
                : undefined,
          transform: flight
            ? `translate(${flight.x}px, ${flight.y}px) scale(${flight.s})`
            : exit === "packing"
              ? "scale(0.62)"
              : undefined,
          opacity: flight ? 0.1 : 1,
        }}
      >
        {/* The frame that makes the page one object rather than a column of
            things. It is drawn only on the way out, which is the moment the
            page has to read as something that can be picked up and put
            somewhere. */}
        <div
          className="pointer-events-none absolute -inset-x-4 -inset-y-3 rounded-[4px] border border-phos-400"
          style={{
            opacity: leaving ? 1 : 0,
            transition: `opacity ${PACK_MS}ms ease-out`,
            boxShadow: leaving ? "0 0 18px rgba(154,247,201,0.35)" : undefined,
          }}
        />

        {/* 1. The name of the place. The same words as the header strip,
               and the one thing that stays lit while the page flies into
               it — a refiner has to see the label leave and see the label
               arrive, or the landing teaches nothing about where it went. */}
        <h1 className="crt-text-glow relative text-[13px] font-bold tracking-[0.18em] text-phos-200">
          {RECORD_TITLE}
        </h1>
        <div className="mt-2 h-px w-24 bg-phos-600" />

        <div
          className="flex w-full flex-col items-center"
          style={{
            opacity: bodyDim,
            transition: `opacity ${PACK_MS}ms ease-out`,
          }}
        >
          {/* The arriving file is held back from nothing above this line:
              INCENTIVES RECORD is the name of the place it is going into,
              and it stays lit for the same reason it stays lit on the way
              out. */}
          {/* 2. What was kept, said plainly and named. */}
          <div className="flex w-full flex-col items-center" style={veil}>
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
          </div>

          {/* 3. What each of those counts toward, and the one that just
                 moved lit as it takes the file. */}
          <div className="mt-4 w-full space-y-2">
            {rows.map((row) => {
              const c = live.get(row.category) ?? row;
              const aimed = target === row.category;
              const lit = aimed && (arrival === "landed" || arrival === "flying");
              const took = aimed && arrival === "landed";
              const bump = gained.get(row.category) ?? 0;
              return (
                <div
                  key={row.category}
                  className="relative w-full text-left"
                  // The shelf it is aimed at stays lit while everything
                  // else is held down: the file has to have a visible
                  // destination or the flight is a shape crossing a fog.
                  style={aimed ? undefined : veil}
                >
                  <div className="flex items-baseline justify-between gap-2 text-[8px] tracking-[0.2em]">
                    <span
                      className="transition-colors duration-300"
                      style={{ color: lit ? "var(--color-phos-200)" : undefined }}
                    >
                      <span className={lit ? "" : "text-phos-400"}>{row.label}</span>
                    </span>
                    <span className="tabular-nums text-phos-500">
                      {c.have} OF {row.total}
                    </span>
                  </div>
                  {/* The increment, said as a number. The bar growing is
                      the proof; this is the claim. */}
                  {/* The claim, said as a number. Big and slow on purpose:
                      this is the payoff of the whole filing sequence, and
                      at 10px in 900ms it was a detail nobody caught. */}
                  {took && bump > 0 ? (
                    <span
                      className="crt-text-glow pointer-events-none absolute right-0 top-0 text-[19px] font-bold tabular-nums text-phos-100"
                      style={{ animation: "count-bump 1600ms cubic-bezier(.2,.8,.3,1) 1 forwards" }}
                    >
                      +{bump}
                    </span>
                  ) : null}
                  <div
                    data-cat-meter={row.category}
                    className="mt-1 h-[3px] w-full overflow-hidden rounded-sm bg-phos-800"
                    style={
                      took
                        ? { animation: `meter-take ${GLOW_MS}ms ease-out 1` }
                        : undefined
                    }
                  >
                    <div
                      className="h-full bg-phos-400 ease-out"
                      style={{
                        width: `${Math.round((c.have / row.total) * 100)}%`,
                        boxShadow: "0 0 6px var(--color-phos-400)",
                        transition: "width 620ms cubic-bezier(.2,.7,.3,1)",
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
            style={veil}
            className="mt-3 inline-flex items-center gap-1 text-[9px] tracking-[0.2em] text-phos-500 underline-offset-4 active:text-phos-300"
          >
            VIEW ALL INCENTIVES
            <ChevronRight size={10} strokeWidth={2.4} aria-hidden />
          </button>

          {/* 5. What earns the next one — never what it is. Last on the
                 page, the brightest thing on it, and *not shown at all*
                 until the incentive has finished being filed.

                 The receipt and the promise are two subjects. Held back,
                 the refiner watches one thing land, and then is handed the
                 next goal as a separate event. The space is reserved
                 rather than collapsed, so nothing above jumps when they
                 arrive — what changes is only whether they are there. */}
          <div
            className="flex w-full flex-col items-center"
            style={{
              opacity: settled ? 1 : 0,
              transform: settled ? "translateY(0)" : "translateY(10px)",
              pointerEvents: settled ? undefined : "none",
              transition: reduced
                ? undefined
                : "opacity 420ms ease-out, transform 420ms cubic-bezier(.2,.7,.3,1)",
            }}
          >
          {lane ? (
            <div
              style={veil}
              className="mt-4 w-full rounded-[3px] border border-phos-500 bg-phos-900/60 px-3 py-3 text-left"
            >
              <p className="crt-text-glow text-[9px] font-bold tracking-[0.22em] text-phos-300">
                ANOTHER INCENTIVE IS COMING
              </p>
              <p className="crt-text-glow mt-2 text-[13px] font-bold leading-tight tracking-[0.14em] text-phos-100">
                {lane.action.replace(/\.$/, "").toUpperCase()}
              </p>
              {/* The stretch from the last incentive to the next, like
                  every other incentive meter in the game — never the
                  running total against a target that moves. */}
              <div className="mt-2 flex items-center gap-2">
                {/* `bg-phos-800` at this weight reads as a *filled* bar:
                    an empty 5px track was reported as "the progress bar
                    looked complete" next to the words 0/1. An empty track
                    has to look empty. */}
                <div className="h-[5px] flex-1 overflow-hidden rounded-sm border border-phos-800 bg-phos-950">
                  <div
                    className="h-full bg-phos-300 transition-[width] duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, Math.round((laneDone / laneSpan) * 100))}%`,
                      boxShadow: "0 0 8px var(--color-phos-300)",
                    }}
                  />
                </div>
                <span className="shrink-0 text-[9px] tabular-nums tracking-[0.14em] text-phos-400">
                  {laneDone}/{laneSpan}
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
              leaving || reduced
                ? veil
                : { ...veil, animation: "crt-throb 1.9s ease-in-out infinite" }
            }
          >
            RESUME REFINEMENT
            <ChevronRight size={12} strokeWidth={2.6} />
          </button>
          </div>
        </div>

        {/* The file the card folded itself into, arriving. It starts in the
            middle of the page — at the size and place the card left it, so
            the handover is one object and not two — is held there long
            enough to be seen, and then goes into the row it moved. */}
      </div>

      {/* The file the card folded itself into, arriving — parented to the
          scrim, not to the page, so it holds the exact size and position
          the reward card left it at instead of inheriting the page's
          unfurl. It is held there long enough to be seen and then walks
          into the row it moved. */}
      {inFlight ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          style={{
            transition:
              arrival === "flying"
                ? `transform ${FLY_MS}ms cubic-bezier(.5,0,.3,1), opacity ${FLY_MS}ms ease-in`
                : undefined,
            transform:
              arrival === "flying" && drop
                ? `translate(${drop.x}px, ${drop.y}px) scale(0.12)`
                : undefined,
            opacity: arrival === "flying" && drop ? 0.1 : 1,
          }}
        >
          {/* Its own dark ground, travelling with it. Whatever the file
              passes over is pushed back under this, so the thing the eye is
              following never has to compete with the page it is crossing. */}
          <div
            aria-hidden
            className="absolute h-[190px] w-[190px]"
            style={{
              background:
                "radial-gradient(circle, rgba(1,7,4,0.96) 0%, rgba(1,7,4,0.88) 38%, rgba(1,7,4,0) 72%)",
            }}
          />
          <div
            className="relative"
            style={{
              animation: reduced ? undefined : "file-lift 1.1s ease-in-out infinite",
            }}
          >
            <FileGlyph size={54} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
