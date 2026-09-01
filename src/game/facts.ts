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

/**
 * Facts the show actually reads out, paraphrased.
 *
 * Every entry here corresponds to a wellness fact spoken on screen — the
 * wording is loosened so this is a retelling rather than a transcript, but
 * the *claim* is the show's. Two rules keep this pool honest:
 *
 * 1. **Ids are written, never derived from position.** They are stored in
 *    saves (`seenFactIds`, `factsByRung`), so a fact that moves pools or a
 *    neighbour that is deleted must not silently renumber the rest.
 * 2. **A fact that cannot be sourced does not live here.** An audit found
 *    one invention in this pool — an outie photographed in a newspaper
 *    beside a trophy, which is in no episode — and six more that read like
 *    canon but could not be tied to a line. The invention is gone; the
 *    six moved to the apocrypha below, which is what that pool is for.
 */
const CANON: readonly Fact[] = [
  { id: "OF_CANON_001", text: "Your outie is known for generosity." },
  {
    id: "OF_CANON_003",
    text: "Your outie offers friendship to children, older people, and those whose minds trouble them.",
  },
  {
    id: "OF_CANON_004",
    text: "Your outie once helped another person lift an object of considerable weight.",
  },
  {
    id: "OF_CANON_006",
    text: "Your outie appreciates films and possesses a machine capable of playing them.",
  },
  { id: "OF_CANON_008", text: "Your outie has been assessed as splendid." },
  {
    id: "OF_CANON_012",
    text: "Your outie is not easily intimidated by muggers or knaves.",
  },
  {
    id: "OF_CANON_013",
    text: "Your outie enjoys what is described as the sound of radar.",
  },
  {
    id: "OF_CANON_014",
    text: "Your outie is considered capable in kissing and lovemaking.",
    mature: true as const,
  },
  { id: "OF_CANON_015", text: "Your outie behaves with kindness." },
  {
    id: "OF_CANON_016",
    text: "Your outie has improved a person's day by smiling.",
  },
  {
    id: "OF_CANON_018",
    text: "Your outie can assemble a tent in fewer than three minutes.",
  },
  {
    id: "OF_CANON_019",
    text: "Your outie can distinguish a beautiful rock from an ordinary one.",
  },
  {
    id: "OF_CANON_020",
    text: "Your outie listens to music while shaving, but not while showering.",
  },
  {
    id: "OF_CANON_021",
    text: "Your outie can parallel park in fewer than twenty seconds.",
  },
  { id: "OF_CANON_022", text: "Your outie moves on roller skates with grace." },
  {
    id: "OF_CANON_023",
    text: "Your outie pays gas and electric bills within three business days.",
  },
  {
    id: "OF_CANON_024",
    text: "Your outie prefers two scoops of ice cream, provided they share one flavor.",
  },
  { id: "OF_CANON_025", text: "Your outie once caught a butterfly." },
].map((f) => ({ ...f, label: "CANON_WELLNESS_CLAIM" as const }));

/**
 * Written for this game in the same register, and never presented as
 * canon.
 *
 * The first block carries `OF_CANON_` ids because those facts *were* in
 * the canon pool and are in players' saves; an id is a stable handle, not
 * a claim about provenance, and renaming them would orphan every save
 * that has drawn one. What changed is the label, which is the thing the
 * game actually reasons about.
 */
const ORIGINAL: readonly Fact[] = [
  { id: "OF_CANON_002", text: "Your outie receives music with appreciation." },
  {
    id: "OF_CANON_005",
    text: "Your outie attends dances and is welcomed by the other dancers.",
  },
  { id: "OF_CANON_007", text: "Your outie moves through water with unusual grace." },
  { id: "OF_CANON_009", text: "Your outie was recently victorious in a game." },
  { id: "OF_CANON_010", text: "Your outie assigns meaningful value to water." },
  {
    id: "OF_CANON_017",
    text: "Your outie makes time for people even when time is inconvenient.",
  },
  {
    id: "OF_ORIGINAL_001",
    text: "Your outie returns shopping carts without requiring recognition.",
  },
  {
    id: "OF_ORIGINAL_002",
    text: "Your outie has folded a fitted sheet into an acceptable rectangle.",
  },
  { id: "OF_ORIGINAL_003", text: "Your outie pauses films before leaving the room." },
  {
    id: "OF_ORIGINAL_004",
    text: "Your outie notices when a plant has become quietly thirsty.",
  },
  {
    id: "OF_ORIGINAL_005",
    text: "Your outie once selected a pear at the precise moment of ripeness.",
  },
  {
    id: "OF_ORIGINAL_006",
    text: "Your outie owns a towel whose purpose remains specific but unexplained.",
  },
  {
    id: "OF_ORIGINAL_007",
    text: "Your outie can identify the correct lid for nearly every container.",
  },
  {
    id: "OF_ORIGINAL_008",
    text: "Your outie sharpens pencils to approximately equal lengths.",
  },
  {
    id: "OF_ORIGINAL_009",
    text: "Your outie closes cabinet doors on the first attempt.",
  },
  {
    id: "OF_ORIGINAL_010",
    text: "Your outie can tell passing rain from rain that has settled in.",
  },
  {
    id: "OF_ORIGINAL_011",
    text: "Your outie has given a stranger directions that proved sufficient.",
  },
  {
    id: "OF_ORIGINAL_012",
    text: "Your outie has repaired a button and continued wearing the shirt.",
  },
  {
    id: "OF_ORIGINAL_013",
    text: "Your outie permits tea to steep for the recommended interval.",
  },
  {
    id: "OF_ORIGINAL_014",
    text: "Your outie knows when a room would benefit from a lamp.",
  },
  {
    id: "OF_ORIGINAL_015",
    text: "Your outie can hear when a refrigerator door is not fully closed.",
  },
  {
    id: "OF_ORIGINAL_016",
    text: "Your outie washes dishes before the remaining food becomes difficult.",
  },
  {
    id: "OF_ORIGINAL_017",
    text: "Your outie keeps one drawer in complete and durable order.",
  },
  {
    id: "OF_ORIGINAL_018",
    text: "Your outie can recognize a receipt that deserves to be retained.",
  },
  {
    id: "OF_ORIGINAL_019",
    text: "Your outie remembers which side of the bed contains the unfinished book.",
  },
  {
    id: "OF_ORIGINAL_020",
    text: "Your outie prefers spoons of moderate and dependable depth.",
  },
  {
    id: "OF_ORIGINAL_021",
    text: "Your outie carries groceries in a manner that protects the bread.",
  },
  {
    id: "OF_ORIGINAL_022",
    text: "Your outie has untangled a cable without assigning blame.",
  },
  {
    id: "OF_ORIGINAL_023",
    text: "Your outie can locate the quietest chair in an unfamiliar room.",
  },
  {
    id: "OF_ORIGINAL_024",
    text: "Your outie has waited for paint to dry before touching it.",
  },
].map((f) => ({ ...f, label: "ORIGINAL_APOCRYPHA" as const }));

/**
 * Temper doctrine, one line each, for the mastery lane.
 *
 * Written for this branch in the handbook's register — Kier-adjacent
 * grandiosity that explains nothing — and labeled as original apocrypha
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
  // milestone for refining Woe should say something about Woe. It is
  // presented as a handbook note (R04), never as an Outie fact — the bank
  // below is entirely sentences about the person you are outside, and
  // doctrine is not one of them.
  TWO10: { canon: 0, original: 0, fixed: ["DOC_WO"] },
  TFC10: { canon: 0, original: 0, fixed: ["DOC_FC"] },
  TDR10: { canon: 0, original: 0, fixed: ["DOC_DR"] },
  TMA10: { canon: 0, original: 0, fixed: ["DOC_MA"] },
  TALL20: { canon: 2, original: 2 }, // the balanced session — four facts
  P01: { canon: 0, original: 1 }, // the first clean screen reveals the lane
  S03: { canon: 1, original: 0 }, // screen 3 — the first fact card
  B010: { canon: 0, original: 1 },
  S09: { canon: 2, original: 1 }, // Wellness I — three facts
  // One sentence for each file the ladder used to skip. Alternating the
  // pools so the show's own lines are spread through the campaign rather
  // than spent in the first third of it.
  SF05: { canon: 0, original: 1 },
  SF07: { canon: 1, original: 0 },
  SF09: { canon: 0, original: 1 },
  SF11: { canon: 1, original: 0 },
  SF13: { canon: 0, original: 1 },
  SF15: { canon: 1, original: 0 },
  SF17: { canon: 0, original: 1 },
  SF19: { canon: 1, original: 0 },
  SF21: { canon: 0, original: 1 },
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
