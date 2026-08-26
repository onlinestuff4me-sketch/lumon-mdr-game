/**
 * The Outie fact bank, and how a card chooses its sentence.
 *
 * Two pools, kept apart on purpose:
 *
 * - `CANON_WELLNESS_CLAIM` — adapted from Wellness sessions in S1E2, S1E8
 *   and S2E5. These are paraphrases of what Lumon *claims* about a
 *   refiner's outie, not verified biography, and the show presents them
 *   the same way.
 * - `ORIGINAL_APOCRYPHA` — written for this game in the same register.
 *   Never presented as canon.
 *
 * Every sentence here is displayed, captioned and spoken as the same
 * string. There is one `text` per fact and everything reads it, which is
 * the only way the three can never drift apart.
 *
 * Sourced from `product-context/outputs/reward_media/OUTIE_FACT_BANK.md`.
 * No fact is ever derived from anything about the actual person holding
 * the phone: there is no device data here, and there never will be.
 */

import { mulberry32, shuffle } from "./rng";

export type FactLabel = "CANON_WELLNESS_CLAIM" | "ORIGINAL_APOCRYPHA";

export interface Fact {
  readonly id: string;
  readonly text: string;
  readonly label: FactLabel;
  /**
   * Held back unless a content setting says otherwise. There is no such
   * setting yet, so this fact is simply never selected — which is the
   * right default for a bank whose rating question is still open.
   */
  readonly mature?: true;
}

const CANON: readonly Fact[] = [
  "Your outie is known for generosity.",
  "Your outie receives music with appreciation.",
  "Your outie offers friendship to children, older people, and those whose minds trouble them.",
  "Your outie once helped another person lift an object of considerable weight.",
  "Your outie attends dances and is welcomed by the other dancers.",
  "Your outie appreciates films and possesses a machine capable of playing them.",
  "Your outie moves through water with unusual grace.",
  "Your outie has been assessed as splendid.",
  "Your outie was recently victorious in a game.",
  "Your outie assigns meaningful value to water.",
  "Your outie once appeared in a newspaper beside a trophy.",
  "Your outie is not easily intimidated by muggers or knaves.",
  "Your outie enjoys what is described as the sound of radar.",
  "Your outie is considered capable in kissing and lovemaking.",
  "Your outie behaves with kindness.",
  "Your outie has improved a person's day by smiling.",
  "Your outie makes time for people even when time is inconvenient.",
  "Your outie can assemble a tent in fewer than three minutes.",
  "Your outie can distinguish a beautiful rock from an ordinary one.",
  "Your outie listens to music while shaving, but not while showering.",
  "Your outie can parallel park in fewer than twenty seconds.",
  "Your outie moves on roller skates with grace.",
  "Your outie pays gas and electric bills within three business days.",
  "Your outie prefers two scoops of ice cream, provided they share one flavor.",
  "Your outie once caught a butterfly.",
].map((text, i) => ({
  id: `OF_CANON_${String(i + 1).padStart(3, "0")}`,
  text,
  label: "CANON_WELLNESS_CLAIM" as const,
  // OF_CANON_014 in the bank.
  ...(i === 13 ? { mature: true as const } : {}),
}));

const ORIGINAL: readonly Fact[] = [
  "Your outie returns shopping carts without requiring recognition.",
  "Your outie has folded a fitted sheet into an acceptable rectangle.",
  "Your outie pauses films before leaving the room.",
  "Your outie notices when a plant has become quietly thirsty.",
  "Your outie once selected a pear at the precise moment of ripeness.",
  "Your outie owns a towel whose purpose remains specific but unexplained.",
  "Your outie can identify the correct lid for nearly every container.",
  "Your outie sharpens pencils to approximately equal lengths.",
  "Your outie closes cabinet doors on the first attempt.",
  "Your outie can tell passing rain from rain that has settled in.",
  "Your outie has given a stranger directions that proved sufficient.",
  "Your outie has repaired a button and continued wearing the shirt.",
  "Your outie permits tea to steep for the recommended interval.",
  "Your outie knows when a room would benefit from a lamp.",
  "Your outie can hear when a refrigerator door is not fully closed.",
  "Your outie washes dishes before the remaining food becomes difficult.",
  "Your outie keeps one drawer in complete and durable order.",
  "Your outie can recognize a receipt that deserves to be retained.",
  "Your outie remembers which side of the bed contains the unfinished book.",
  "Your outie prefers spoons of moderate and dependable depth.",
  "Your outie carries groceries in a manner that protects the bread.",
  "Your outie has untangled a cable without assigning blame.",
  "Your outie can locate the quietest chair in an unfamiliar room.",
  "Your outie has waited for paint to dry before touching it.",
].map((text, i) => ({
  id: `OF_ORIGINAL_${String(i + 1).padStart(3, "0")}`,
  text,
  label: "ORIGINAL_APOCRYPHA" as const,
}));

/**
 * Temper doctrine, one line each, for the mastery lane.
 *
 * Written for this branch in the handbook's register — Kier-adjacent
 * grandiosity that explains nothing — and labelled as original apocrypha
 * like everything else the show did not say. They ride the same blank
 * card as an Outie fact because that is the plate the game has, and they
 * are the same kind of object: a sentence Lumon has decided you should
 * hear.
 */
const DOCTRINE: readonly Fact[] = [
  {
    id: "DOC_WO",
    text: "Woe is the heaviest temper, and the first Kier carried. He set it down only once, and did not say where.",
    label: "ORIGINAL_APOCRYPHA",
  },
  {
    id: "DOC_FC",
    text: "Frolic is permitted between the hours of nine and five, and is not to be carried outside the building.",
    label: "ORIGINAL_APOCRYPHA",
  },
  {
    id: "DOC_DR",
    text: "Dread is the tremor of a number that knows something you do not. You are asked not to ask it what.",
    label: "ORIGINAL_APOCRYPHA",
  },
  {
    id: "DOC_MA",
    text: "Malice was the last temper to be named and the first to be found. It has been waiting for the other three.",
    label: "ORIGINAL_APOCRYPHA",
  },
];

export const FACTS: readonly Fact[] = [...CANON, ...ORIGINAL, ...DOCTRINE];

const BY_ID = new Map(FACTS.map((f) => [f.id, f]));

export function factById(id: string): Fact | undefined {
  return BY_ID.get(id);
}

/**
 * How many of each pool a given rung's card or session draws.
 *
 * Single cards alternate pools down the ladder so a refiner meets both
 * kinds early; sessions lead with show-derived claims and fill out with
 * original ones, which is the mix the fact bank specifies.
 */
export const FACT_PLAN: Record<
  string,
  { canon: number; original: number; fixed?: readonly string[] }
> = {
  // The temper lane reads doctrine rather than drawing from the bank: a
  // milestone for refining Woe should say something about Woe.
  TWO10: { canon: 0, original: 0, fixed: ["DOC_WO"] },
  TFC10: { canon: 0, original: 0, fixed: ["DOC_FC"] },
  TDR10: { canon: 0, original: 0, fixed: ["DOC_DR"] },
  TMA10: { canon: 0, original: 0, fixed: ["DOC_MA"] },
  TALL20: { canon: 2, original: 2 }, // the balanced session — four facts
  P01: { canon: 0, original: 1 }, // the first clean screen reveals the lane
  S03: { canon: 1, original: 0 }, // screen 3 — the first fact card
  B010: { canon: 0, original: 1 },
  S09: { canon: 2, original: 1 }, // Wellness I — three facts
  S17: { canon: 1, original: 0 },
  B025: { canon: 1, original: 0 },
  S24: { canon: 2, original: 2 }, // Wellness II — four facts
  B060: { canon: 0, original: 1 },
};

/** How many sentences a rung presents, or 0 if it presents none. */
export function factCount(rungId: string): number {
  const plan = FACT_PLAN[rungId];
  if (!plan) return 0;
  return plan.fixed ? plan.fixed.length : plan.canon + plan.original;
}

/**
 * Choose this rung's sentences.
 *
 * Deterministic in the rung id, so the same threshold picks the same fact
 * for the same refiner however many times the code runs — and the result
 * is persisted the moment the reward is earned, well before any card
 * opens, so a force quit mid-ceremony cannot reroll it.
 *
 * Seen ids are excluded until a pool is exhausted, and then it starts
 * over rather than presenting nothing: forty-nine sentences outlast this
 * campaign, but a save carried into a longer one should not run dry.
 */
export function pickFacts(
  rungId: string,
  seen: readonly string[],
  allowMature = false,
): string[] {
  const plan = FACT_PLAN[rungId];
  if (!plan) return [];
  // A doctrine card is not a draw: this rung has always meant this line.
  if (plan.fixed) return [...plan.fixed];

  // A tiny hash of the rung id: same rung, same seed, same draw.
  let h = 0x811c9dc5;
  for (let i = 0; i < rungId.length; i++) {
    h = Math.imul(h ^ rungId.charCodeAt(i), 0x01000193) >>> 0;
  }
  const rng = mulberry32(h);
  const seenSet = new Set(seen);
  const out: string[] = [];

  const draw = (pool: readonly Fact[], want: number) => {
    if (want <= 0) return;
    const eligible = pool.filter(
      (f) => (allowMature || !f.mature) && !seenSet.has(f.id) && !out.includes(f.id),
    );
    const from = eligible.length >= want
      ? eligible
      : pool.filter((f) => (allowMature || !f.mature) && !out.includes(f.id));
    for (const f of shuffle(rng, [...from]).slice(0, want)) out.push(f.id);
  };

  draw(CANON, plan.canon);
  draw(ORIGINAL, plan.original);
  return out;
}
