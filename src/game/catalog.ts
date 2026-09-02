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
  /**
   * What kind of thing this is to present.
   *
   * `object` is a plate and a line. `fact` typesets one approved sentence
   * on the blank card. `session` is the Wellness room, several sentences
   * at a time, one after another. The sentences themselves are never here
   * — they are drawn from the bank when the reward is earned and stored
   * with it, so a force quit cannot reroll them.
   */
  readonly kind: "object" | "fact" | "session" | "experience";
  /**
   * A department event rather than a thing you take back to your desk.
   *
   * Separate from `kind` on purpose: `kind` says how the card is *drawn*
   * (and `experience` in particular means "this one takes the floor"),
   * while this says which section of the record it is shelved under. The
   * waffle parties are events that present as a plate; the dance
   * experience is an event that presents as a dance floor.
   */
  readonly event?: true;
  /**
   * Lumon on the subject of the work, rather than news about the person
   * you are outside. Rides the same blank card; shelves separately.
   */
  readonly doctrine?: true;
  /** Shown for the first time at the reveal, and never before it. */
  readonly name: string;
  /**
   * The headline the card carries once the seal is open.
   *
   * Written out per reward rather than assembled from the name, because
   * English articles do not survive being generated: "a eraser", "a facts
   * about your outie". Second person, past tense, and it is the first
   * moment the refiner is told what they have.
   */
  readonly earned: string;
  /**
   * One line of Lumon underneath. Deadpan, administratively calm, and
   * never explaining the joke it is making.
   */
  readonly line: string;
  /**
   * The plate. One per reward, and for now the whole of it.
   *
   * The supplied celebration clips are held back by product decision, not
   * lost: `tools/derive-reward-media.mjs --clips` re-encodes them whenever
   * they are wanted, and `docs/REWARDS.md` Part 7 records what is wrong
   * with the ones we have.
   */
  readonly poster: string;
}

export const CATALOG: Partial<Record<RewardId, RewardDef>> = {
  R01: {
    kind: "object",
    name: "STANDARD REFINER ERASER",
    earned: "YOU HAVE BEEN ISSUED AN ERASER",
    line: "Lumon provides. There is nothing for you to erase.",
    poster: asset("r01_eraser.webp"),
  },
  R02: {
    kind: "object",
    name: "FINGER TRAP",
    earned: "YOU HAVE BEEN ISSUED A FINGER TRAP",
    line: "Woven paper. Insert one finger per end. Lumon accepts no responsibility for the consequence.",
    poster: asset("r02_finger_trap.webp"),
  },
  R03: {
    kind: "fact",
    name: "A FACT ABOUT YOUR OUTIE",
    earned: "WELLNESS HAS A FACT ABOUT YOUR OUTIE",
    line: "Wellness has prepared a statement concerning the person you are outside.",
    poster: asset("r03_outie_fact_card.webp"),
  },
  R04: {
    kind: "fact",
    doctrine: true,
    name: "A NOTE FROM THE HANDBOOK",
    earned: "THE HANDBOOK HAS A NOTE ON THE TEMPERS",
    line: "A passage from the handbook. It concerns the work, not the worker.",
    // Doctrine is not photographed at all: `RewardPlate` draws it as a
    // page of the handbook, warm paper and a serif and a rule under the
    // running head. It shared the Outie card's plate for a while, which
    // made a note about Woe and a sentence about the person you are
    // outside the same object — and they are not.
    //
    // The poster stays as the fallback the media check counts.
    poster: asset("r03_outie_fact_card.webp"),
  },
  R05: {
    kind: "object",
    name: "MELON BAR",
    earned: "YOU HAVE BEEN AWARDED A MELON BAR",
    line: "The melon has been cubed to a tolerance of two millimeters. Please enjoy each cube equally.",
    poster: asset("r05_melon_bar.webp"),
  },
  R06: {
    kind: "session",
    name: "WELLNESS SESSION",
    // A session is several Outie facts read out in turn, and it is now
    // presented as exactly that: the same card on the same stand, one
    // sentence at a time. It used to open on a photograph of an empty
    // wellness room with the fact in small italics underneath — which put
    // the whole of what a refiner came for in the caption, under a chair.
    earned: "WELLNESS HAS A FACT ABOUT YOUR OUTIE",
    line: "Please sit while facts about your outie are read to you. Do not attempt to reciprocate.",
    poster: asset("r03_outie_fact_card.webp"),
  },
  R07: {
    kind: "experience",
    event: true,
    name: "MUSIC DANCE EXPERIENCE",
    earned: "A MUSIC DANCE EXPERIENCE IS YOURS",
    line: "One sanctioned minute of music. The floor is yours, and then it is not.",
    poster: asset("r07_mde_office_scene.webp"),
  },
  R08: {
    kind: "object",
    name: "CRYSTAL PORTRAIT",
    earned: "YOU HAVE BEEN AWARDED A CRYSTAL PORTRAIT",
    line: "Your likeness has been approximated and sealed in glass. It is not a window.",
    poster: asset("r08_crystal_portrait_gift.webp"),
  },
  R12: {
    kind: "object",
    name: "EGG BAR",
    earned: "YOU HAVE BEEN AWARDED AN EGG BAR",
    line: "Eggs have been prepared in the manner the founder preferred. The manner is not recorded.",
    poster: asset("r12_egg_bar.webp"),
  },
  R13: {
    kind: "object",
    name: "REMEMBRANCE MELON",
    earned: "YOU HAVE BEEN GIVEN A REMEMBRANCE MELON",
    line: "Carved in memory of a refiner from this branch. The archive does not say when they left.",
    poster: asset("r13_watermelon_remembrance.webp"),
  },
  R19: {
    kind: "object",
    event: true,
    name: "WAFFLE PARTY",
    earned: "A WAFFLE PARTY HAS BEEN LAID FOR YOU",
    line: "A meal has been laid in the founder's own room, for you alone. The room is not usually opened.",
    poster: asset("r19_waffle_party_i.webp"),
  },
  R22: {
    kind: "object",
    event: true,
    name: "WAFFLE PARTY · SECOND TIER",
    earned: "YOUR WAFFLE PARTY HAS A SECOND TIER",
    line: "The table is set again, and a mask has been placed beside the plate. Lumon thanks you.",
    poster: asset("r22_waffle_party_ii.webp"),
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
/**
 * Whether this reward's plate is paper rather than a photograph, so the
 * frame behind it can be pale instead of showing a black rim in the gap
 * before the picture paints.
 */
export function plateIsPale(reward: RewardDef): boolean {
  return (
    reward.doctrine === true ||
    reward.kind === "fact" ||
    reward.kind === "session"
  );
}

export function presentable(id: RewardId): RewardDef | null {
  return CATALOG[id] ?? null;
}
