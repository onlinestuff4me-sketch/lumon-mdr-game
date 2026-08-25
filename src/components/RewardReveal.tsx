import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { RewardDef } from "../game/catalog";

/**
 * The incentive pop: sealed, then opened.
 *
 * Three rules this component exists to keep, all of them from
 * `docs/REWARDS.md` Part 5:
 *
 * 1. **The name and the picture arrive together, and not before.** Until
 *    the seal opens there is nothing on screen that could identify what is
 *    inside — no silhouette, no colour, no category, no filename in the
 *    markup.
 * 2. **Nothing is ever non-skippable.** The accept control is live from the
 *    first frame; pressing it during the seal opens it early, and pressing
 *    it after takes the reward.
 * 3. **One card at a time.** Two rewards never share a frame. The stack is
 *    the caller's business; this draws whichever one it is handed, and says
 *    how many are behind it.
 */

/** Seconds the sealed card holds before it opens itself. */
const SEAL_MS = 900;

interface Props {
  reward: RewardDef;
  /** 1-based position in this boundary's stack, and its length. */
  index: number;
  total: number;
  onAccept: () => void;
}

export function RewardReveal({ reward, index, total, onAccept }: Props) {
  const [open, setOpen] = useState(false);
  // Read once, at mount: this decides between a clip and a still, and a
  // preference that changed mid-celebration would swap the media under the
  // refiner's eyes.
  const [reduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  // Media is never load-bearing: a clip that will not play falls back to
  // the poster, and the reward is claimable either way.
  const [clipFailed, setClipFailed] = useState(false);

  // Every card starts sealed and opens itself. The caller remounts this
  // component per incentive, so there is no stale state to reset here.
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), SEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const showVideo = open && !reduced && !!reward.video && !clipFailed;

  return (
    <div className="absolute inset-0 z-70 flex flex-col items-center justify-center bg-phos-950/97 px-7 text-center">
      <p className="text-[9px] tracking-[0.3em] text-phos-600">
        {total > 1 ? `INCENTIVE ${index} OF ${total}` : "INCENTIVE"}
      </p>

      {open ? (
        <>
          <h1 className="crt-text-glow mt-2 max-w-[280px] text-[13px] font-bold leading-tight tracking-[0.18em] text-phos-200">
            {reward.name}
          </h1>
          <div className="mt-3 h-px w-24 bg-phos-600" />

          {/* The clip plays once rather than looping: an object that turns
              forever is scenery. It settles on its last frame and waits. */}
          <div className="mt-4 w-full max-w-[240px] overflow-hidden rounded-[3px] border border-phos-600 bg-black">
            {showVideo ? (
              <video
                className="block h-auto w-full"
                src={reward.video}
                poster={reward.poster}
                autoPlay
                muted
                playsInline
                onError={() => setClipFailed(true)}
              />
            ) : (
              <img
                className="block h-auto w-full"
                src={reduced && reward.still ? reward.still : reward.poster}
                alt={reward.name}
              />
            )}
          </div>

          <p className="mt-3 max-w-[260px] text-[10px] italic leading-relaxed text-phos-400">
            {reward.line}
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
          skippable: while the card is sealed it opens it, and after that it
          takes the reward. Nothing here ever makes the refiner wait. */}
      <button
        type="button"
        onClick={() => (open ? onAccept() : setOpen(true))}
        className="mt-5 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.22em] text-phos-200 crt-text-glow active:bg-phos-600/50"
      >
        {!open ? "OPEN" : index < total ? "ACCEPT · NEXT" : "ACCEPT INCENTIVE"}
        <ChevronRight size={12} strokeWidth={2.6} />
      </button>
    </div>
  );
}
