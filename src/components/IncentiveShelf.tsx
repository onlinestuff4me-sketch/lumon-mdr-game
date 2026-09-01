import { useState } from "react";
import { Lock } from "lucide-react";
import { factById } from "../game/facts";
import { categoryProgress } from "../game/held";
import { RECORD_TITLE } from "../game/lexicon";
import type { RewardId } from "../game/rewards";
import type { Progress } from "../game/progress";
import { RewardPlate } from "./RewardPlate";

/**
 * The full incentives record: every category, what is kept in each, and
 * how many are still to come.
 *
 * This is the one screen in the game that admits there is more coming. It
 * says how *many* and never what they are — a concealed slot is a slot,
 * with no name, no silhouette, no plate and no hint of category beyond the
 * section it sits in. That is the whole of the compromise: a refiner is
 * allowed to know how far through they are, and is never allowed to know
 * what is next.
 *
 * Four sections, in the show's own vocabulary: issued items, outie facts,
 * wellness sessions, department events. Each carries a meter, because a
 * category with a number and no bar is a fact and a category with a bar is
 * a goal.
 *
 * A kept incentive opens to show its plate and its line. A concealed one
 * does nothing at all when tapped, because it is not a button.
 */

export function IncentiveShelf({
  progress,
  onInspect,
}: {
  progress: Progress;
  onInspect: (rewardId: RewardId) => void;
}) {
  const [open, setOpen] = useState<RewardId | null>(null);
  const cats = categoryProgress(progress);
  const total = cats.reduce((n, c) => n + c.have, 0);

  return (
    <>
      <h3 className="crt-text-glow mb-1 mt-4 text-[10px] font-bold tracking-[0.2em] text-phos-300">
        {RECORD_TITLE}
      </h3>
      <p className="mb-3 text-[9px] leading-snug text-phos-600">
        {total === 0
          ? "Nothing has been issued to you yet."
          : total === 1
            ? "One incentive is yours."
            : `${total} incentives are yours.`}{" "}
        Please enjoy them equally.
      </p>

      {cats.map((c) => {
        // One row per payout, not per distinct object: the ladder issues
        // the fact card ten times, and ten sentences is ten incentives.
        const rows = c.kept.flatMap(({ rewardId, def, times }) =>
          Array.from({ length: times }, (_, i) => ({ rewardId, def, i })),
        );
        const concealed = Math.max(0, c.total - rows.length);
        return (
          <section key={c.category} className="mb-4">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-[9px] font-bold tracking-[0.2em] text-phos-400">
                {c.label}
              </h4>
              <span className="text-[8px] tabular-nums tracking-[0.16em] text-phos-600">
                {c.have} OF {c.total}
              </span>
            </div>
            <div className="mb-1.5 mt-1 h-[3px] w-full overflow-hidden rounded-sm bg-phos-800">
              <div
                className="h-full bg-phos-400 transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.round((c.have / c.total) * 100)}%`,
                  boxShadow: "0 0 6px var(--color-phos-400)",
                }}
              />
            </div>

            <ul className="space-y-1">
              {rows.map(({ rewardId, def, i }) => {
                const key = `${rewardId}-${i}`;
                const isOpen = open === key;
                return (
                  <li
                    key={key}
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
                        const next = isOpen ? null : key;
                        setOpen(next as RewardId | null);
                        // Counted on the way open only. Closing a drawer
                        // is not an act of appreciation.
                        if (next) onInspect(rewardId);
                      }}
                    >
                      <span
                        className={`text-[9px] font-bold tracking-[0.18em] ${
                          isOpen ? "text-phos-300" : "text-phos-500"
                        }`}
                      >
                        {def.name}
                      </span>
                      <span className="shrink-0 text-[8px] tracking-[0.16em] text-phos-700">
                        {isOpen ? "IN HAND" : "KEPT"}
                      </span>
                    </button>
                    {isOpen ? (
                      <div className="px-2.5 pb-2.5">
                        {/* The same plate the card opened on, so the
                            thing on the shelf is the thing they were
                            given. A doctrine page is drawn, not
                            photographed, and would be a broken image
                            here if this reached for `poster` itself. */}
                        <RewardPlate
                          reward={def}
                          className="mx-auto block aspect-[9/16] w-full max-w-[150px] overflow-hidden rounded-[2px] border border-phos-700"
                        />
                        <p className="mx-auto mt-1.5 max-w-[280px] text-center text-[9px] italic leading-relaxed text-phos-400">
                          {def.line}
                        </p>
                      </div>
                    ) : null}
                  </li>
                );
              })}

              {/* The ones still to come. Not buttons, and carrying nothing
                  a refiner could work backwards from. */}
              {Array.from({ length: concealed }, (_, i) => (
                <li
                  key={`locked-${i}`}
                  className="flex items-center justify-between gap-2 rounded-[3px] border-l-2 border-phos-800 bg-phos-950/40 px-2.5 py-1.5"
                >
                  <span className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.18em] text-phos-700">
                    <Lock size={9} strokeWidth={2.2} aria-hidden />
                    CLASSIFIED
                  </span>
                  <span className="shrink-0 text-[8px] tracking-[0.16em] text-phos-800">
                    NOT YET ISSUED
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
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
