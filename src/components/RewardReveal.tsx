import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { RewardDef } from "../game/catalog";
import type { Fact } from "../game/facts";
import type { Progress } from "../game/progress";
import { IncentiveRecord } from "./IncentiveRecord";
import { RECORD_DOCK } from "./recordDock";

/**
 * The incentive pop: sealed, then opened, then filed.
 *
 * Six rules this component exists to keep, from `docs/REWARDS.md` Part 5
 * and the fact bank's playback specification:
 *
 * 1. **The name and the picture arrive together, and not before.** Until
 *    the seal parts there is nothing on screen — and nothing in the
 *    markup or the accessibility tree — that could identify what is
 *    inside. The plate is fetched early so it can be shown instantly, but
 *    it is fetched into the browser's cache, not into the document.
 * 2. **Nothing is ever non-skippable.** The control is live from the first
 *    frame; while the card is sealed it opens it, and after that it moves
 *    on. Tapping through the seal animation is allowed.
 * 3. **One card at a time.** Two rewards never share a frame. The stack is
 *    the caller's business; this draws whichever one it is handed, and
 *    says how many are behind it.
 * 4. **The seal waits for a hand.** It opened itself after 900ms once, and
 *    a refiner who looked away missed the only moment the card existed.
 *    Nothing here moves until it is tapped.
 * 5. **Nothing on the card may move when the seal opens.** Every band of
 *    the card is a fixed height and the plate frame is a fixed aspect, so
 *    what changes between sealed and open is what is drawn inside those
 *    boxes and never where the boxes are. A card that re-centres itself
 *    on the frame the picture appears is the jitter this rule forbids.
 * 6. **What is filed is seen to be filed, and seen to land somewhere.**
 *    The last card of a boundary flies into the incentive record — the
 *    real block, measured on screen, not a caption of one — so the
 *    refiner learns where their things go and where to tap to find them.
 */

/** How long the lid takes to clear the plate. */
const PART_MS = 420;
/** How long the card takes to fly into the record. */
const FILE_MS = 620;

interface Props {
  reward: RewardDef;
  /**
   * The sentences this reward reads, already chosen and already stored.
   * One for a fact card, three or four for a Wellness session, none for
   * an object.
   */
  facts: readonly Fact[];
  /** 1-based position in this boundary's stack, and its length. */
  index: number;
  total: number;
  /**
   * Whether this card opens with the seal on. Only the first of a
   * boundary does: the seal announces the whole payout, and re-sealing
   * between cards of one stack makes three rewards feel like three
   * interruptions.
   */
  sealed: boolean;
  /** The ledger, for the record the card is filed into. */
  progress: Progress;
  onAccept: () => void;
}

export function RewardReveal({
  reward,
  facts,
  index,
  total,
  sealed,
  progress,
  onAccept,
}: Props) {
  const [open, setOpen] = useState(!sealed);
  /** True while the lid is retracting off the plate. */
  const [parting, setParting] = useState(false);
  /** True from the moment FILE is tapped until the card has landed. */
  const [filing, setFiling] = useState(false);
  /** Where the record block is, relative to the card, once measured. */
  const [flight, setFlight] = useState<{ x: number; y: number; s: number } | null>(
    null,
  );
  /** Which sentence of a session is on the card. */
  const [step, setStep] = useState(0);
  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  const cardRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  /**
   * Warm the plate before it is ever asked for.
   *
   * A 30KB WebP decoded on the frame the seal parts is a dropped frame at
   * exactly the moment the refiner is looking hardest. Fetching it into
   * the cache costs nothing while the card sits sealed, and puts nothing
   * in the document — rule 1 is about what can be seen and read, and an
   * `Image` that never enters the DOM is neither.
   */
  useEffect(() => {
    const img = new Image();
    img.src = reward.poster;
    void img.decode?.().catch(() => {});
  }, [reward.poster]);

  /** The lid is cosmetic: it retracts, then it stops existing. */
  useEffect(() => {
    if (!parting) return;
    const t = setTimeout(() => setParting(false), PART_MS);
    return () => clearTimeout(t);
  }, [parting]);

  /**
   * Measure the record block and aim the card at it.
   *
   * A frame after the block mounts, not in a layout effect: the transform
   * has to be applied on a *later* paint than the one that mounted the
   * block, or the browser has no previous value to transition from and
   * the card simply teleports.
   */
  useEffect(() => {
    if (!filing) return;
    const id = requestAnimationFrame(() => {
      const card = cardRef.current?.getBoundingClientRect();
      const dock = dockRef.current?.getBoundingClientRect();
      if (!card || !dock || card.width === 0) return;
      setFlight({
        x: dock.left + dock.width / 2 - (card.left + card.width / 2),
        y: dock.top + dock.height / 2 - (card.top + card.height / 2),
        // Small enough to read as "into the block", not so small it
        // vanishes before it arrives.
        s: Math.max(0.06, (dock.width * 0.55) / card.width),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [filing]);

  const fact = facts[step] ?? null;
  const lastStep = step >= facts.length - 1;
  const advances = facts.length > 1 && !lastStep;

  const label = !open
    ? total > 1
      ? `ACCEPT ALL ${total}`
      : "OPEN"
    : advances || index < total
      ? "CONTINUE"
      : "FILE";

  return (
    <div
      className="absolute inset-0 z-70 flex flex-col items-center justify-center overflow-hidden bg-phos-950/97 px-7 text-center"
      style={
        reduced
          ? undefined
          : { animation: "crt-open 340ms cubic-bezier(.2,.7,.3,1) 1" }
      }
    >
      {/* The leading edge of the sweep that drew this panel. One pass,
          then it is gone — a tube redrawing, not a decoration that
          loops. */}
      {reduced ? null : (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[14%]"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(154,247,201,0.16) 55%, rgba(217,255,236,0.5) 88%, transparent)",
            animation: "crt-band 560ms ease-out 1 forwards",
          }}
        />
      )}

      {/* Everything above the control flies as one thing when it is filed,
          so what lands in the record is the reward the refiner was just
          looking at rather than an abstract shape. */}
      <div
        ref={cardRef}
        className="flex w-full max-w-[248px] flex-col items-center"
        style={{
          transition: filing
            ? `transform ${FILE_MS}ms cubic-bezier(.5,0,.25,1), opacity ${FILE_MS}ms ease-in`
            : undefined,
          transform: flight
            ? `translate(${flight.x}px, ${flight.y}px) scale(${flight.s})`
            : undefined,
          // Still legible for most of the flight; gone by the time it is
          // inside the block, where a full-size card would have nowhere
          // to be.
          opacity: flight ? 0.05 : 1,
        }}
      >
        {/* Rule 5. Every band below is a fixed height. */}
        <p className="flex h-[11px] items-center text-[9px] tracking-[0.3em] text-phos-600">
          {!open
            ? "INCENTIVE"
            : total > 1
              ? `INCENTIVE ${index} OF ${total}`
              : "INCENTIVE"}
          {open && facts.length > 1 ? ` · ${step + 1}/${facts.length}` : ""}
        </p>

        <h1 className="crt-text-glow mt-2 flex h-[34px] items-center justify-center text-[13px] font-bold leading-tight tracking-[0.18em] text-phos-200">
          {open
            ? reward.name
            : total > 1
              ? `${total} INCENTIVES EARNED`
              : "INCENTIVE EARNED"}
        </h1>
        <div className="mt-3 h-px w-24 bg-phos-600" />

        {/* The plate. Fixed aspect in both states, so the lid and the
            picture occupy exactly the same box and nothing on the card
            can move when one becomes the other. */}
        <div
          className={`relative mt-4 aspect-[9/16] w-full overflow-hidden rounded-[3px] border border-phos-600 ${
            open && reward.kind === "fact" ? "bg-[#e9e5d9]" : "bg-black"
          }`}
        >
          {open ? (
            <>
              <img
                className="absolute inset-0 h-full w-full object-cover"
                src={reward.poster}
                alt={reward.name}
              />
              {/* A generated picture cannot be trusted to spell, so the
                  sentence is typeset over the plate at runtime. */}
              {reward.kind === "fact" && fact ? (
                <p
                  className="absolute flex items-center justify-center text-center text-[9px] leading-relaxed text-[#2b3a30]"
                  style={{ left: "27%", right: "25%", top: "26%", bottom: "34%" }}
                >
                  {fact.text}
                </p>
              ) : null}
            </>
          ) : null}

          {/* The lid. Two halves that split on a bright seam and retract,
              which is what this tube would do; nothing cross-fades on a
              CRT. While sealed it is one unbroken face carrying no
              information about what is behind it. */}
          {!open || parting ? (
            <>
              <div
                className="absolute inset-x-0 top-0 flex h-1/2 items-end justify-center border-b border-phos-800/60 bg-phos-900/95"
                style={
                  parting && !reduced
                    ? {
                        animation: `seal-part-top ${PART_MS}ms cubic-bezier(.55,0,.35,1) forwards`,
                      }
                    : undefined
                }
              >
                <span className="pb-3 text-[10px] tracking-[0.3em] text-phos-600">
                  SEALED
                </span>
              </div>
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 border-t border-phos-800/60 bg-phos-900/95"
                style={
                  parting && !reduced
                    ? {
                        animation: `seal-part-bottom ${PART_MS}ms cubic-bezier(.55,0,.35,1) forwards`,
                      }
                    : undefined
                }
              />
              {/* The seam only exists while the lid is moving. */}
              {parting && !reduced ? (
                <div
                  className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-phos-100"
                  style={{
                    boxShadow: "0 0 12px 3px rgba(154,247,201,0.9)",
                    animation: `seal-seam ${PART_MS}ms ease-out forwards`,
                  }}
                />
              ) : null}
              {/* A sealed lid breathes; a retracting one does not. */}
              {!open ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ animation: "bin-await 1.6s ease-in-out infinite" }}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {/* Reserved whether or not there is anything to say, so the button
            below it never moves. Three lines' worth, which is the longest
            line in the catalogue. */}
        <p className="mt-3 flex h-[44px] items-center justify-center text-[10px] italic leading-snug text-phos-400">
          {open
            ? fact && reward.kind !== "fact"
              ? fact.text
              : reward.line
            : total > 1
              ? "Your refinement has been recognised. They will be presented in turn."
              : "Your refinement has been recognised."}
        </p>
      </div>

      {/* Live from the first frame, which is what keeps every part of this
          skippable: while the card is sealed it opens it, then it steps
          through the sentences, then it files the reward away. It throbs
          because it is the only thing on the screen that does anything,
          and a refiner who does not know that is a refiner sitting in
          front of a card that appears to have stopped. */}
      <button
        type="button"
        data-reward-action
        onClick={() => {
          // A second tap while the card is in flight is an impatient
          // refiner, not a second reward: ignore it rather than disabling
          // the control and making it look broken.
          if (filing) return;
          if (!open) {
            setOpen(true);
            if (!reduced) setParting(true);
            return;
          }
          if (advances) return setStep((n) => n + 1);
          // The last card of a boundary is seen to be filed; the ones
          // before it simply hand over to the next.
          if (index < total || reduced) return onAccept();
          setFiling(true);
          setTimeout(onAccept, FILE_MS);
        }}
        className="crt-text-glow relative z-10 mt-5 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.22em] text-phos-200 active:bg-phos-600/50"
        style={filing ? undefined : { animation: "crt-throb 1.9s ease-in-out infinite" }}
      >
        {label}
        <ChevronRight size={12} strokeWidth={2.6} />
      </button>

      {/* Where it goes — the real block, not a caption of one, and the
          thing the flight above is measured against. It appears under the
          card at the moment of filing and is still there, in the same
          place, on the landing screen that follows: the refiner watches
          one object receive their incentive and stay put. */}
      {filing ? (
        <div ref={dockRef} className={`pointer-events-none ${RECORD_DOCK}`}>
          <IncentiveRecord progress={progress} onOpen={() => {}} landing />
        </div>
      ) : null}
    </div>
  );
}
