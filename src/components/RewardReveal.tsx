import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { RewardDef } from "../game/catalog";
import type { Fact } from "../game/facts";
import { keepLabel } from "../game/lexicon";
import { reasonFor, type Rung } from "../game/rewards";

/**
 * One incentive: sealed, then opened.
 *
 * Six rules this component exists to keep, from `docs/REWARDS.md` Part 5
 * and the fact bank's playback specification:
 *
 * 1. **The name and the picture arrive together, and not before.** Until
 *    the seal parts there is nothing on screen — and nothing in the markup
 *    or the accessibility tree — that could identify what is inside. The
 *    plate is fetched early so it can be shown instantly, but it is
 *    fetched into the browser's cache, not into the document.
 * 2. **The cause may be stated; the effect may not.** The sealed card says
 *    exactly *why* it was issued — the milestone, and the number reached —
 *    because the refiner did that and knows they did. What is inside stays
 *    classified until they tap.
 * 3. **Nothing is ever non-skippable.** The control is live from the first
 *    frame; while the card is sealed it opens it, and after that it moves
 *    on. Tapping through the seal animation is allowed.
 * 4. **One card at a time.** Two incentives never share a frame. The stack
 *    is the caller's business; this draws whichever one it is handed, and
 *    says how many are behind it.
 * 5. **The seal waits for a hand.** It opened itself after 900ms once, and
 *    a refiner who looked away missed the only moment the card existed.
 *    Nothing here moves until it is tapped.
 * 6. **Nothing on the card may move when the seal opens.** Every band of
 *    the card is a fixed height and the plate frame is a fixed aspect, so
 *    what changes between sealed and open is what is drawn inside those
 *    boxes and never where the boxes are. A card that re-centers itself on
 *    the frame the picture appears is a card that jitters at exactly the
 *    moment the refiner is looking hardest.
 *
 * Where the incentive *goes* is no longer this component's business. The
 * last card of a stack hands over to the summary screen, which is where
 * keeping is shown and explained. The card used to shrink into a block
 * drawn over its own photograph, which read as clutter on top of the one
 * picture the refiner had just earned the right to look at.
 */

/** How long the lid takes to clear the plate. */
const PART_MS = 420;

interface Props {
  reward: RewardDef;
  /** The rung that issued it, for the line saying why. */
  rung: Rung;
  /**
   * The sentences this incentive reads, already chosen and already stored.
   * One for a fact card, three or four for a Wellness session, none for an
   * object.
   */
  facts: readonly Fact[];
  /** 1-based position in this boundary's stack, and its length. */
  index: number;
  total: number;
  /**
   * Whether this card opens with the seal on. Only the first of a boundary
   * does: the seal announces the whole payout, and re-sealing between
   * cards of one stack makes three incentives feel like three
   * interruptions.
   */
  sealed: boolean;
  onAccept: () => void;
}

export function RewardReveal({
  reward,
  rung,
  facts,
  index,
  total,
  sealed,
  onAccept,
}: Props) {
  const [open, setOpen] = useState(!sealed);
  /** True while the lid is retracting off the plate. */
  const [parting, setParting] = useState(false);
  /** Which sentence of a session is on the card. */
  const [step, setStep] = useState(0);
  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

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

  const fact = facts[step] ?? null;
  const lastStep = step >= facts.length - 1;
  const advances = facts.length > 1 && !lastStep;

  const label = !open ? "OPEN" : advances ? "CONTINUE" : keepLabel(index, total);

  return (
    <div
      className="absolute inset-0 z-70 flex flex-col items-center justify-center overflow-hidden bg-phos-950/97 px-7 text-center"
      style={
        reduced
          ? undefined
          : { animation: "crt-open 340ms cubic-bezier(.2,.7,.3,1) 1" }
      }
    >
      {/* The leading edge of the sweep that drew this panel. One pass, then
          it is gone — a tube redrawing, not a decoration that loops. */}
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

      <div className="flex w-full max-w-[248px] flex-col items-center">
        {/* Rule 6. Every band below is a fixed height. */}
        {/* Letterhead when there is one incentive, position when there is
            a stack. Never "INCENTIVE EARNED" above a headline that already
            says an incentive has been earned. */}
        <p className="flex h-[11px] items-center text-[9px] tracking-[0.3em] text-phos-600">
          {total > 1 ? `INCENTIVE ${index} OF ${total}` : "LUMON INDUSTRIES"}
          {open && facts.length > 1 ? ` · ${step + 1}/${facts.length}` : ""}
        </p>

        <h1 className="crt-text-glow mt-2 flex h-[34px] items-center justify-center text-[12px] font-bold leading-tight tracking-[0.12em] text-phos-200">
          {open
            ? reward.earned
            : total > 1
              ? `YOU'VE EARNED ${total} INCENTIVES`
              : "YOU'VE EARNED AN INCENTIVE"}
        </h1>
        <div className="mt-2 h-px w-24 bg-phos-600" />

        {/* Why. Sealed, this is the whole of what the card is willing to
            say; open, it stays put, so the refiner can still see what they
            did to get it. */}
        <p className="mt-2 flex h-[11px] items-center text-[8px] tracking-[0.2em] text-phos-500">
          {reasonFor(rung)}
        </p>

        {/* The plate. Fixed aspect in both states, so the lid and the
            picture occupy exactly the same box and nothing on the card can
            move when one becomes the other. */}
        <div
          className={`relative mt-3 aspect-[9/16] w-full overflow-hidden rounded-[3px] border border-phos-600 ${
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
              {/* The line the lid parts along, gone by the time it has
                  cleared the frame. */}
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
            line in the catalog. */}
        <p className="mt-3 flex h-[44px] items-center justify-center text-[10px] italic leading-snug text-phos-400">
          {open
            ? fact && reward.kind !== "fact"
              ? fact.text
              : reward.line
            : "The contents of this issue remain classified until it is opened."}
        </p>
      </div>

      {/* Live from the first frame, which is what keeps every part of this
          skippable. It throbs because it is the only thing on the screen
          that does anything, and a refiner who does not know that is a
          refiner sitting in front of a card that appears to have
          stopped. */}
      <button
        type="button"
        data-reward-action
        onClick={() => {
          if (!open) {
            setOpen(true);
            if (!reduced) setParting(true);
            return;
          }
          if (advances) return setStep((n) => n + 1);
          onAccept();
        }}
        className="crt-text-glow relative z-10 mt-4 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-phos-200 active:bg-phos-600/50"
        style={{ animation: "crt-throb 1.9s ease-in-out infinite" }}
      >
        {label}
        <ChevronRight size={12} strokeWidth={2.6} />
      </button>
    </div>
  );
}
