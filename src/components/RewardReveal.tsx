import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { speech } from "../audio/speech";
import type { RewardDef } from "../game/catalog";
import type { Fact } from "../game/facts";

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
 * 4. **Written, captioned and spoken are the same sentence.** There is one
 *    string per fact and all three read it, so they cannot drift.
 */

/** How long the sealed card holds before it opens itself. */
const SEAL_MS = 900;

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
  /** The terminal's mute switch. Silence is a supported way to play. */
  muted: boolean;
  onAccept: () => void;
}

export function RewardReveal({
  reward,
  facts,
  index,
  total,
  muted,
  onAccept,
}: Props) {
  const [open, setOpen] = useState(false);
  /** Which sentence of a session is on the card. */
  const [step, setStep] = useState(0);
  // Every card starts sealed and opens itself. The caller remounts this
  // component per incentive, so there is no stale state to reset here.
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), SEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const fact = facts[step] ?? null;

  // The voice follows the sentence on screen, and leaves with the card.
  useEffect(() => {
    if (!open || !fact || muted) return;
    speech.say(fact.text);
    return () => speech.stop();
  }, [open, fact, muted]);

  useEffect(() => () => speech.stop(), []);

  const lastStep = step >= facts.length - 1;
  const advances = facts.length > 1 && !lastStep;

  const label = !open
    ? "OPEN"
    : advances
      ? "CONTINUE"
      : index < total
        ? "ACCEPT · NEXT"
        : "ACCEPT INCENTIVE";

  return (
    <div className="absolute inset-0 z-70 flex flex-col items-center justify-center bg-phos-950/97 px-7 text-center">
      <p className="text-[9px] tracking-[0.3em] text-phos-600">
        {total > 1 ? `INCENTIVE ${index} OF ${total}` : "INCENTIVE"}
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
            INCENTIVE EARNED
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
            Your refinement has been recognised.
          </p>
        </>
      )}

      {/* Live from the first frame, which is what keeps every part of this
          skippable: while the card is sealed it opens it, then it steps
          through the sentences, then it takes the reward. */}
      <button
        type="button"
        onClick={() => {
          if (!open) return setOpen(true);
          if (advances) return setStep((n) => n + 1);
          speech.stop();
          onAccept();
        }}
        className="mt-5 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.22em] text-phos-200 crt-text-glow active:bg-phos-600/50"
      >
        {label}
        <ChevronRight size={12} strokeWidth={2.6} />
      </button>
    </div>
  );
}
