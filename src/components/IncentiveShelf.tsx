import { useState } from "react";
import { CATALOG, type RewardDef } from "../game/catalog";
import { factById } from "../game/facts";
import { rungById, type RewardId } from "../game/rewards";
import type { Progress } from "../game/progress";

/**
 * The incentive shelf, and the Wellness record beside it.
 *
 * What a refiner has been given, kept where they can go back and look at
 * it. Only claimed rewards ever appear: an incentive that has not been
 * earned has no slot here, no silhouette and no greyed-out placeholder —
 * the shelf is a record of possession, not a checklist of what is coming.
 *
 * Objects go on the shelf. Sentences go in the Wellness record, because a
 * fact is not a thing you own; it is something Lumon has told you about a
 * person you cannot remember.
 */

interface Held {
  readonly rewardId: RewardId;
  readonly def: RewardDef;
  /** How many times this object has been awarded. */
  readonly times: number;
}

function held(progress: Progress): Held[] {
  const counts = new Map<RewardId, number>();
  for (const [rungId, state] of Object.entries(progress.rewardState)) {
    if (state !== "claimed") continue;
    const rung = rungById(rungId);
    if (!rung) continue;
    const def = CATALOG[rung.reward];
    if (!def || def.kind !== "object") continue;
    counts.set(rung.reward, (counts.get(rung.reward) ?? 0) + 1);
  }
  // Catalog order, which is ladder order: the shelf reads as the sequence
  // the refiner lived through rather than as a leaderboard.
  return (Object.keys(CATALOG) as RewardId[])
    .filter((id) => counts.has(id))
    .map((id) => ({ rewardId: id, def: CATALOG[id]!, times: counts.get(id)! }));
}

export function IncentiveShelf({
  progress,
  onInspect,
}: {
  progress: Progress;
  onInspect: (rewardId: RewardId) => void;
}) {
  const [open, setOpen] = useState<RewardId | null>(null);
  const items = held(progress);
  if (items.length === 0) return null;

  return (
    <>
      <h3 className="crt-text-glow mb-1 mt-4 text-[10px] font-bold tracking-[0.2em] text-phos-300">
        INCENTIVE SHELF
      </h3>
      <p className="mb-2 text-[9px] leading-snug text-phos-600">
        {items.length === 1
          ? "One incentive is yours."
          : `${items.length} incentives are yours.`}{" "}
        Please enjoy them equally.
      </p>
      <ul className="space-y-1">
        {items.map(({ rewardId, def, times }) => {
          const isOpen = open === rewardId;
          return (
            <li
              key={rewardId}
              className={`overflow-hidden rounded-[3px] border-l-2 ${
                isOpen
                  ? "border-phos-400 bg-phos-900/50"
                  : "border-phos-700 bg-phos-950/60"
              }`}
            >
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-2 px-2.5 py-1.5 text-left"
                onClick={() => {
                  const next = isOpen ? null : rewardId;
                  setOpen(next);
                  // Counted on the way open only. Closing a drawer is not
                  // an act of appreciation.
                  if (next) onInspect(rewardId);
                }}
              >
                <span
                  className={`text-[9px] font-bold tracking-[0.18em] ${
                    isOpen ? "text-phos-300" : "text-phos-500"
                  }`}
                >
                  {def.name}
                  {times > 1 ? ` ×${times}` : ""}
                </span>
                <span className="shrink-0 text-[8px] tracking-[0.16em] text-phos-700">
                  {isOpen ? "IN HAND" : "SHELVED"}
                </span>
              </button>
              {isOpen ? (
                <div className="px-2.5 pb-2.5">
                  <img
                    className="mx-auto block w-full max-w-[150px] rounded-[2px] border border-phos-700"
                    src={def.poster}
                    alt={def.name}
                  />
                  <p className="mx-auto mt-1.5 max-w-[280px] text-center text-[9px] italic leading-relaxed text-phos-400">
                    {def.line}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * Every sentence Wellness has read out, in the order it was heard.
 *
 * The canon label is deliberately not shown: inside the fiction these are
 * all simply things Lumon has said. The distinction between a claim
 * adapted from the show and one written for this branch lives in the
 * content database and in `facts.ts`, where the people making the game can
 * see it.
 */
export function WellnessRecord({ progress }: { progress: Progress }) {
  const heard = progress.seenFactIds.map(factById).filter((f) => !!f);
  if (heard.length === 0) return null;
  return (
    <>
      <h3 className="crt-text-glow mb-1 mt-4 text-[10px] font-bold tracking-[0.2em] text-phos-300">
        WELLNESS · YOUR OUTIE
      </h3>
      <p className="mb-2 text-[9px] leading-snug text-phos-600">
        {heard.length === 1
          ? "One fact has been shared with you."
          : `${heard.length} facts have been shared with you.`}{" "}
        They are not a matter for discussion.
      </p>
      <ul className="space-y-1">
        {heard.map((f) => (
          <li
            key={f.id}
            className="rounded-[3px] border-l-2 border-phos-700 bg-phos-950/60 px-2.5 py-1.5 text-[9px] italic leading-relaxed text-phos-400"
          >
            {f.text}
          </li>
        ))}
      </ul>
    </>
  );
}
