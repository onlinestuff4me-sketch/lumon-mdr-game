/**
 * The words this game uses for its own reward system, in one place.
 *
 * Two decisions are enforced here rather than remembered:
 *
 * **1. "Incentive", never "reward".** Lumon does not give people rewards;
 * it issues incentives. The colder word is funnier, it is what a company
 * that severs its staff would actually print on a terminal, and one word
 * cannot read as two competing systems the way "incentive reward" can. It
 * is also half the characters, which matters on a 0.22em-tracked button at
 * 390px. Nothing in the interface says "reward" — the identifier
 * `RewardId` and the `rewards.ts` module keep the old name because they are
 * code, and code is not read by refiners.
 *
 * **2. "File" is a thing you refine; "keep" is what you do with an
 * incentive.** The word "file" was carrying both meanings and neither
 * survived it. A refiner refines files. An incentive is *kept*. The button
 * says KEEP INCENTIVE, the record says KEPT, and no incentive is ever
 * filed anywhere.
 *
 * `docs/DESIGN_SYSTEM.md` is the prose version of this; this module is the
 * enforceable one.
 */

import type { RewardDef } from "./catalog";

/**
 * The four kinds of thing Lumon issues, in the show's own vocabulary.
 *
 * Categories are a *presentation* grouping, separate from `RewardDef.kind`
 * — which says how a card is drawn, not what shelf it belongs on. A waffle
 * party and the dance experience are both department events; only one of
 * them takes over the floor.
 */
export type Category =
  | "items"
  | "facts"
  | "notes"
  | "wellness"
  | "events";

export const CATEGORY_ORDER: readonly Category[] = [
  "items",
  "facts",
  "notes",
  "wellness",
  "events",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  items: "ISSUED ITEMS",
  facts: "OUTIE FACTS",
  notes: "HANDBOOK NOTES",
  wellness: "WELLNESS SESSIONS",
  events: "DEPARTMENT EVENTS",
};

/** Singular, for a sentence rather than a section heading. */
export const CATEGORY_ONE: Record<Category, string> = {
  items: "ISSUED ITEM",
  facts: "OUTIE FACT",
  notes: "HANDBOOK NOTE",
  wellness: "WELLNESS SESSION",
  events: "DEPARTMENT EVENT",
};

/**
 * What the incentive record is called, everywhere it appears: the strip in
 * the header, the summary after a payout, and the section of the handbook
 * it opens. One name, so a refiner who reads it in one place recognizes it
 * in the next.
 */
export const RECORD_TITLE = "INCENTIVES RECORD";

/**
 * The control at the bottom of an opened incentive.
 *
 * Mid-stack it promises the next one; at the end of the stack it keeps
 * what was shown, singular or plural to match how many there were.
 */
export function keepLabel(index: number, total: number): string {
  if (index < total) return "SEE NEXT INCENTIVE";
  return total > 1 ? "KEEP INCENTIVES" : "KEEP INCENTIVE";
}

/** "2 INCENTIVES KEPT" — the header of the summary. */
export function keptLabel(n: number): string {
  return n === 1 ? "INCENTIVE KEPT" : `${n} INCENTIVES KEPT`;
}

/** "4 KEPT" — the count on the record strip, which has very little room. */
export function heldLabel(n: number): string {
  return n === 0 ? "NONE KEPT" : `${n} KEPT`;
}

/** The category a reward is shelved under. */
export function categoryOf(def: RewardDef): Category {
  // Both ride the blank card, and they are not the same thing: an Outie
  // fact is news about the person you are outside, a handbook note is
  // Lumon on the subject of the work. Shelving them together was what let
  // a passage about Kier be announced as a fact about your outie.
  if (def.doctrine) return "notes";
  if (def.kind === "fact") return "facts";
  if (def.kind === "session") return "wellness";
  return def.event ? "events" : "items";
}
