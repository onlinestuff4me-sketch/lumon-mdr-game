import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { RewardDef } from "../game/catalog";
import type { Fact } from "../game/facts";
import type { Progress } from "../game/progress";
import { IncentiveRecord } from "./IncentiveRecord";

/**
 * The incentive pop: sealed, then opened.
 *
 * Four rules this component exists to keep, all of them from
 * `docs/REWARDS.md` Part 5 and the fact bank's playback specification:
 *
 * 1. **The name and the picture arrive together, and not before.** Until
 *    the seal opens there is nothing on screen that could identify what is
 *    inside — no silhouette, no colour, no category, no filename in the
 *    markup.
 * 2. **Nothing is ever non-skippable.** The control is live from the first
 *    frame; while the card is sealed it opens it, and after that it moves
 *    on. Speech never gates it.
 * 3. **One card at a time.** Two rewards never share a frame. The stack is
 *    the caller's business; this draws whichever one it is handed, and
 *    says how many are behind it.
 * 4. **The seal waits for a hand.** It opened itself after 900ms once, and
 *    a refiner who looked away missed the only moment the card existed.
 *    Nothing here moves until it is tapped.
 * 5. **What is filed is seen to be filed.** The last card of a boundary
 *    shrinks into the incentive record rather than vanishing, so the
 *    refiner learns where their things go and where to tap to find them.
 */

/** How long the card takes to shrink into the record. */
const FILE_MS = 480;

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
  /** True while the card is shrinking into the record block. */
  const [filing, setFiling] = useState(false);
  /** Which sentence of a session is on the card. */
  const [step, setStep] = useState(0);
  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

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
    <div className="absolute inset-0 z-70 flex flex-col items-center justify-center bg-phos-950/97 px-7 text-center">
      {/* Everything above the control moves as one thing when it is filed,
          so what shrinks into the record is the reward the refiner was
          just looking at rather than an abstract shape. */}
      <div
        className="flex w-full flex-col items-center"
        style={{
          transition: `transform ${FILE_MS}ms cubic-bezier(.4,0,.2,1), opacity ${FILE_MS}ms ease-in`,
          transform: filing ? "translateY(38vh) scale(0.08)" : "none",
          opacity: filing ? 0 : 1,
          transformOrigin: "center bottom",
        }}
      >
      <p className="text-[9px] tracking-[0.3em] text-phos-600">
        {!open ? "INCENTIVE" : total > 1 ? `INCENTIVE ${index} OF ${total}` : "INCENTIVE"}
        {open && facts.length > 1 ? ` · ${step + 1}/${facts.length}` : ""}
      </p>

      {open ? (
        <>
          <h1 className="crt-text-glow mt-2 max-w-[280px] text-[13px] font-bold leading-tight tracking-[0.18em] text-phos-200">
            {reward.name}
          </h1>
          <div className="mt-3 h-px w-24 bg-phos-600" />

          {/* A plate, and — for a fact card — the sentence typeset over
              it at runtime rather than baked into the image: a generated
              picture cannot be trusted to spell. Cream behind that one, so
              the words still have something to be read against if the
              plate never loads. */}
          <div
            className={`relative mt-4 w-full max-w-[240px] overflow-hidden rounded-[3px] border border-phos-600 ${
              reward.kind === "fact" ? "bg-[#e9e5d9]" : "bg-black"
            }`}
          >
            <img className="block h-auto w-full" src={reward.poster} alt={reward.name} />
            {reward.kind === "fact" && fact ? (
              <p
                className="absolute flex items-center justify-center text-center text-[9px] leading-relaxed text-[#2b3a30]"
                style={{ left: "27%", right: "25%", top: "26%", bottom: "34%" }}
              >
                {fact.text}
              </p>
            ) : null}
          </div>

          {/* The caption carries the spoken sentence for a session, where
              the picture is a room and the words are only in the air. A
              fact card has already typeset its sentence on the card, so
              repeating it underneath would be the same words twice; it
              gets Lumon's framing line instead. Either way there is real
              text on screen for every word that is spoken. */}
          <p className="mt-3 max-w-[260px] text-[10px] italic leading-relaxed text-phos-400">
            {fact && reward.kind !== "fact" ? fact.text : reward.line}
          </p>
        </>
      ) : (
        <>
          {/* The sealed card. Nothing here is derived from the reward: same
              box, same words, whatever is inside. */}
          <h1 className="crt-text-glow mt-2 text-[13px] font-bold tracking-[0.22em] text-phos-200">
            {total > 1 ? `${total} INCENTIVES EARNED` : "INCENTIVE EARNED"}
          </h1>
          <div className="mt-3 h-px w-24 bg-phos-600" />
          <div
            className="mt-4 flex aspect-[9/16] w-full max-w-[240px] items-center justify-center rounded-[3px] border border-phos-600 bg-phos-900/60"
            style={{ animation: "bin-await 1.1s ease-in-out infinite" }}
          >
            <span className="text-[10px] tracking-[0.3em] text-phos-600">
              SEALED
            </span>
          </div>
          <p className="mt-3 max-w-[260px] text-[10px] leading-relaxed text-phos-600">
            {total > 1
              ? "Your refinement has been recognised. They will be presented in turn."
              : "Your refinement has been recognised."}
          </p>
        </>
      )}

      </div>

      {/* Live from the first frame, which is what keeps every part of this
          skippable: while the card is sealed it opens it, then it steps
          through the sentences, then it files the reward away. */}
      <button
        type="button"
        data-reward-action
        onClick={() => {
          // A second tap while the card is on its way into the record is
          // an impatient refiner, not a second reward: ignore it rather
          // than disabling the control and making it look broken.
          if (filing) return;
          if (!open) return setOpen(true);
          if (advances) return setStep((n) => n + 1);
          // The last card of a boundary is seen to be filed; the ones
          // before it simply hand over to the next.
          if (index < total || reduced) return onAccept();
          setFiling(true);
          setTimeout(onAccept, FILE_MS);
        }}
        className="mt-5 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.22em] text-phos-200 crt-text-glow active:bg-phos-600/50"
      >
        {label}
        <ChevronRight size={12} strokeWidth={2.6} />
      </button>

      {/* Where it goes — the real block, not a caption of one. It fades in
          under the shrinking card so that filing has a place on the screen,
          and so that the block is something the refiner has watched
          receive an incentive before they are ever asked to tap it. This
          is the only time it appears on a screen that advances itself. */}
      {filing ? (
        <div className="pointer-events-none absolute inset-x-7 bottom-[10vh] flex justify-center">
          <IncentiveRecord progress={progress} onOpen={() => {}} landing />
        </div>
      ) : null}
    </div>
  );
}
