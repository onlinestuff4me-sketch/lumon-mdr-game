/**
 * What a reward *is* — its name, its copy, and its media.
 *
 * Deliberately a separate module from the ladder. `rewards.ts` knows which
 * counter has to reach what number and is safe for the forecast to import;
 * this file knows names and pictures and is imported only by the reveal,
 * which runs after the thing has been earned. Keeping them apart is what
 * makes "the forecast cannot leak an identity" a property of the code
 * rather than a promise in a comment.
 *
 * Media lives in `public/rewards/`, derived from the reference originals in
 * `product-context/` by `tools/derive-reward-media.mjs`. The originals are
 * never modified and never shipped: they are 1.8 MB plates for a 280px card.
 *
 * Every record here is `CANON_SHOWN` — the object or event appears on
 * screen in the show, and the plate is a show-grounded representation of
 * it rather than a frame from it. Nothing dialogue-only gets a picture.
 */

import type { RewardId } from "./rewards";

/**
 * Where a reward's media lives, relative to wherever the app is mounted.
 *
 * `BASE_URL` is "./" here (see vite.config.ts), which is what lets one
 * build work from a Pages project path and from a domain root alike. The
 * fallback is for the data tests, which import this module in node where
 * there is no Vite environment to read.
 */
const BASE = import.meta.env?.BASE_URL ?? "";
const asset = (file: string) => `${BASE}rewards/${file}`;

export interface RewardDef {
  /** Shown for the first time at the reveal, and never before it. */
  readonly name: string;
  /**
   * One line of Lumon underneath. Deadpan, administratively calm, and
   * never explaining the joke it is making.
   */
  readonly line: string;
  readonly poster: string;
  /** The celebration clip, where the object has one. */
  readonly video?: string;
  /** Reduced motion gets this instead of the clip. */
  readonly still?: string;
}

export const CATALOG: Partial<Record<RewardId, RewardDef>> = {
  R01: {
    name: "STANDARD REFINER ERASER",
    line: "Issued at ten percent, as the handbook provides. There is nothing on this terminal for you to erase.",
    poster: asset("r01_eraser.webp"),
  },
  R02: {
    name: "FINGER TRAP",
    line: "A gift of woven paper. Insert one finger per end. Lumon accepts no responsibility for the consequence.",
    poster: asset("r02_finger_trap.webp"),
    video: asset("r02_finger_trap.mp4"),
    still: asset("r02_finger_trap_still.webp"),
  },
  R05: {
    name: "MELON BAR",
    line: "The melon has been cubed to a tolerance of two millimetres. Please enjoy each cube equally.",
    poster: asset("r05_melon_bar.webp"),
    video: asset("r05_melon_bar.mp4"),
    still: asset("r05_melon_bar_still.webp"),
  },
  R08: {
    name: "CRYSTAL PORTRAIT",
    line: "Your likeness has been approximated and sealed in glass. It is not a window.",
    poster: asset("r08_crystal_portrait_gift.webp"),
    video: asset("r08_crystal_portrait_gift.mp4"),
    still: asset("r08_crystal_portrait_gift_still.webp"),
  },
  R12: {
    name: "EGG BAR",
    line: "Eggs have been prepared in the manner the founder preferred. The manner is not recorded.",
    poster: asset("r12_egg_bar.webp"),
    video: asset("r12_egg_bar.mp4"),
    still: asset("r12_egg_bar_still.webp"),
  },
  R13: {
    name: "REMEMBRANCE MELON",
    line: "Carved in memory of a refiner from this branch. You have not met them, and the archive does not say when they left.",
    poster: asset("r13_watermelon_remembrance.webp"),
    video: asset("r13_watermelon_remembrance.mp4"),
    still: asset("r13_watermelon_remembrance_still.webp"),
  },
};

/**
 * Whether this reward can be presented yet.
 *
 * A rung whose reward has no record here stays in the queue rather than
 * being claimed: the fact cards, the Wellness sessions, the dance
 * experience and the Waffle tiers are later milestones, and a reward
 * quietly marked claimed before it was ever shown is a reward the refiner
 * never gets.
 */
export function presentable(id: RewardId): RewardDef | null {
  return CATALOG[id] ?? null;
}
