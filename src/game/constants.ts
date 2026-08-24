import type { LevelDef, Temper } from "./types";

/** Matrix dimensions — the Lumon standard refinement window. */
export const COLS = 16;
export const ROWS = 28;
export const CELL_COUNT = COLS * ROWS;

/** Radial threshold at which a cluster begins to agitate (CSS px). */
export const PROBE_RADIUS = 80;
/**
 * The lens floats above the fingertip so the thumb never occludes it.
 *
 * The brief said 40px, which was measured against a bare crosshair. Once
 * the reticle became a 36px-radius magnifier, 40px put the *bottom* of the
 * glass level with the contact point and a thumb covered most of it — the
 * one thing you are meant to be reading. This clears the lens above the
 * contact patch entirely.
 */
export const RETICLE_OFFSET_Y = -68;
/**
 * The same lift, for a marquee corner instead of the lens.
 *
 * Much smaller, because the two are hiding from different things. The lens
 * has to clear a thumb because its whole job is to be looked at. A marquee
 * corner is a hairline: it needs to sit just clear of the contact patch so
 * the finger is not covering the corner it is placing, and no further —
 * playtesting the shared 68px found the box starting well above where the
 * finger was pointing.
 */
export const MARQUEE_OFFSET_Y = -22;
/** Minimum captured members for a marquee to resolve into a packet. */
export const MIN_CAPTURE = 4;
/** Double-tap window (ms) and slop (px) for the mode toggle gesture. */
export const DOUBLE_TAP_MS = 300;
/**
 * How far a finger may travel and still have meant to stay put. Raised
 * from 14: a thumb resting on a phone while its owner decides drifts
 * further than that, and a group that is itself drifting invites the
 * finger to follow it.
 */
export const TAP_SLOP = 18;
export const TAP_MAX_MS = 250;

export const TEMPERS: readonly Temper[] = ["WO", "FC", "DR", "MA"] as const;

export interface TemperDef {
  readonly key: Temper;
  readonly code: string;
  readonly name: string;
  readonly blurb: string;
  /** Handbook description of the motion signature. */
  readonly signature: string;
  /** rgb triplet used for canvas tinting. */
  readonly rgb: readonly [number, number, number];
  readonly css: string;
}

export const TEMPER_DEFS: Record<Temper, TemperDef> = {
  WO: {
    key: "WO",
    code: "01",
    name: "WOE",
    blurb: "Melancholy. Heaviness. The sorrow that settles.",
    signature: "Digits droop downward under their own weight.",
    rgb: [74, 140, 214],
    css: "#4a8cd6",
  },
  FC: {
    key: "FC",
    code: "02",
    name: "FROLIC",
    blurb: "Playfulness. Levity. Unearned delight.",
    signature: "Digits bounce and spin, giddy and light.",
    rgb: [240, 197, 72],
    css: "#f0c548",
  },
  DR: {
    key: "DR",
    code: "03",
    name: "DREAD",
    blurb: "Tension. Foreboding. The shiver before the knock.",
    signature: "Digits shiver rapidly on the horizontal.",
    rgb: [155, 108, 240],
    css: "#9b6cf0",
  },
  MA: {
    key: "MA",
    code: "04",
    name: "MALICE",
    blurb: "Aggression. Hostility. Intent to wound.",
    signature: "Digits pulse outward in sharp phosphor bursts.",
    rgb: [255, 90, 77],
    css: "#ff5a4d",
  },
};

/** Idle phosphor colour for inert digits. */
export const IDLE_RGB: readonly [number, number, number] = [47, 214, 138];

/**
 * Shift length. The brief specifies 90-120 seconds, which is STANDARD and
 * is what a refiner who already knows the four tempers plays on. A first
 * pass is spent *learning* the tempers, and a clock that punishes learning
 * is the wrong kind of hard, so EXTENDED is the default until someone
 * chooses otherwise.
 */
export type Pace = "extended" | "standard";

export const PACE: Record<Pace, { label: string; hint: string; scale: number }> = {
  extended: {
    label: "EXTENDED",
    hint: "Double the shift. Room to learn what each temper feels like.",
    scale: 2,
  },
  standard: {
    label: "STANDARD",
    hint: "The shift as Lumon specifies it. Assumes you know the tempers.",
    scale: 1,
  },
};

/** Seconds credited back to the shift for each correctly refined packet. */
export const TIME_CREDIT = 5;

/**
 * The file queue: an orientation sequence, a file that introduces the
 * probe, and then three acts.
 *
 * The rule behind the order is that a refiner is never asked to do two new
 * things at once, and never meets a new rule for the first time under a
 * clock. ORIENTATION hides nothing and has no probe — every group is
 * already moving, and all that is taught is what each temper looks like.
 * BELLINGHAM then takes that away: the group surfaces and sinks, and the
 * first touch summons the lens rather than the box. CALIBRATION names the
 * four. Act I gives one temper per file, Act II two — which is where the
 * actual skill lives, telling one from another — and Act III is the job,
 * with each of its new mechanics taught in isolation before it is used.
 *
 * See docs/ONBOARDING.md for the levers behind every number here.
 */

/** Orientation motion is a touch louder than the later files: it has to
 *  be noticed by someone who does not yet know to look for motion. But
 *  only a touch — at the original 1.35 the groups jumped around like a
 *  fire alarm, and a thing that obvious is scenery, not a discovery. The
 *  stillness before the emergence does the announcing now; the motion
 *  itself just has to be findable once you are looking. */
const OR_SUBTLETY = [0.95, 0.9, 0.85, 0.8] as const;

/**
 * The orientation sequence: 29 screens in four stages, none of which hides
 * anything. Generated rather than written out, because they differ only in
 * which tempers they carry and which seed they use, and twenty-nine
 * hand-written near-duplicates is twenty-nine chances to get one subtly
 * wrong.
 *
 * The order is built around recall. Each stage opens on the temper the
 * player saw most recently, and every screen in the two-temper stage shares
 * a temper with the screen before it, so there is always something familiar
 * to anchor against while the new thing arrives.
 */
function orientationGroups(): Temper[][] {
  // Stage A — one group, one temper, three screens each, numbered order.
  const a: Temper[][] = TEMPERS.flatMap((t) => [[t], [t], [t]]);

  // Stage B — two groups, still one temper, so "two things to find" is
  // learned before "two things to tell apart". Opens on MALICE, which
  // stage A has just finished on, and cycles backwards through the four
  // twice: MA, DR, FC, WO, MA, DR, FC, WO.
  const cycle: Temper[] = [...TEMPERS].reverse();
  const b: Temper[][] = [];
  for (let i = 0; i < 8; i++) {
    const t = cycle[i % cycle.length];
    b.push([t, t]);
  }

  // Stage C — two tempers, and the first real discrimination. It opens on
  // the two the player has just seen (WO from the screen before, and MA
  // from the one before that), and then each pair keeps one temper from
  // the previous screen while introducing one new one. Every temper
  // appears exactly twice.
  const lastB = b[b.length - 1][0];              // WO
  const prevB = b[b.length - 2][0];              // FC
  const rest = TEMPERS.filter((t) => t !== lastB && t !== prevB);
  const c: Temper[][] = [
    [lastB, prevB],
    [prevB, rest[0]],
    [rest[0], rest[1]],
    [rest[1], lastB],
  ];

  // Stage D — the full deck, one group per temper.
  const d: Temper[][] = Array.from({ length: 5 }, () => [...TEMPERS]);

  return [...a, ...b, ...c, ...d];
}

function orientationScreens(): LevelDef[] {
  const groups = orientationGroups();
  const stageOf = (i: number) => (i < 12 ? 0 : i < 20 ? 1 : i < 24 ? 2 : 3);

  return groups.map((tempers, i) => {
    const stage = stageOf(i);
    const last = i === groups.length - 1;
    // The first screens put their group in the middle of the board, where
    // it cannot be missed. Later ones push it outwards, so finding it
    // becomes part of the task before the probe ever arrives.
    const focus = i < 4 ? "centre" : i < 16 ? "mid" : "edge";
    // One bin and two groups means each is half the file; one group per
    // bin means each is the whole of its own.
    const quota = stage === 1 ? 2 : 1;
    return {
      id: `orientation-${String(i + 1).padStart(2, "0")}`,
      name: "ORIENTATION",
      fileCode: "0001",
      tempers: [...new Set(tempers)],
      spacing: stage === 3 ? 5 : 6,
      lore:
        "Everything you will ever refine is already on the screen. Most of it is only pretending to be still.",
      seconds: 0,
      untimed: true,
      training: true,
      selfAgitate: true,
      startMode: "select",
      // One digit of overlap lifts the whole group. A new refiner is never
      // told that their correct instinct was a wrong box.
      minCapture: 1,
      // No ceremony between screens: a completion banner apiece would break
      // one continuous sequence into twenty-nine interruptions. The last
      // screen keeps the full one, so orientation ends properly and
      // releases the single addendum the whole sequence is worth.
      ceremony: last ? "full" : "none",
      autoAdvanceMs: 900,
      archived: last,
      stage: [i + 1, groups.length],
      focus,
      tapToSelect: true,
      // Only where a single bin is on the deck, so the arrows point at the
      // one place a packet can go and give nothing away.
      binHint: new Set(tempers).size === 1,
      seed: (0x0b1e + i * 0x1d37) >>> 0,
      quota,
      spare: 0,
      subtlety: OR_SUBTLETY[stage],
    } satisfies LevelDef;
  });
}

export const LEVELS: readonly LevelDef[] = [
  // ── Orientation: nothing is hidden ─────────────────────────────────
  ...orientationScreens(),

  // ── The probe: motion that hides ───────────────────────────────────
  // Playtesting found the probe undiscoverable, and the reason is upstream
  // of the probe: a player who has no evidence the matrix hides anything
  // has no reason to hold a finger on it. Orientation supplies that
  // evidence; this file takes it away again. The group surfaces for two
  // seconds and sinks for five, and the first touch puts the terminal into
  // PROBE — the refiner reaches for the box they have used twenty-one
  // times and gets the lens instead. The lens then lingers and shrinks,
  // which is what makes it read as a tool with a lifecycle rather than as
  // a rendering glitch.
  {
    id: "bellingham",
    name: "BELLINGHAM",
    fileCode: "0002",
    tempers: ["WO"],
    spacing: 6,
    lore: "A number that has stopped moving has not stopped being frightening. It is only waiting.",
    seconds: 0,
    untimed: true,
    training: true,
    startMode: "probe",
    minCapture: 1,
    pulse: {
      revealS: 2,
      hiddenS: 5,
      tapCooldownS: 5,
      subtlety: 0.8,
      rampS: 0.35,
    },
    lensLingerS: 1,
    lensShrinkS: 0.4,
    focus: "mid",
    tapToSelect: true,
    binHint: true,
    seed: 0x2f11,
    quota: 1,
    spare: 0,
    subtlety: 1,
  },

  {
    id: "calibration",
    name: "CALIBRATION",
    fileCode: "0000",
    tempers: ["WO", "FC", "DR", "MA"],
    spacing: 4,
    lore: "You have been selected. The numbers are frightening, and you are the only one who can feel it.",
    seconds: 0,
    untimed: true,
    training: true,
    teaches: true,
    seed: 0x1e55,
    quota: 1,
    spare: 0,
    subtlety: 1.15,
  },

  // ── Act I: one temper per file, one bin ────────────────────────────
  {
    id: "dranesville",
    name: "DRANESVILLE",
    fileCode: "0117",
    tempers: ["WO"],
    spacing: 5,
    lore: "Woe is the first temper because it is the heaviest. Kier bore it so that you would not have to.",
    seconds: 0,
    untimed: true,
    teaches: true,
    seed: 0x2a41,
    quota: 3,
    spare: 0,
    subtlety: 1.1,
  },
  {
    id: "sunset-park",
    name: "SUNSET PARK",
    fileCode: "0308",
    tempers: ["FC"],
    spacing: 5,
    lore: "Frolic is permitted between the hours of nine and five, and is not to be carried outside.",
    seconds: 0,
    untimed: true,
    teaches: true,
    seed: 0x3b7d,
    quota: 3,
    spare: 0,
    subtlety: 1.1,
  },
  {
    id: "cairns",
    name: "CAIRNS",
    fileCode: "0512",
    tempers: ["DR"],
    spacing: 5,
    lore: "Dread is the tremor of a number that knows something you do not. Do not ask it what.",
    seconds: 0,
    untimed: true,
    teaches: true,
    seed: 0x4c19,
    quota: 3,
    spare: 0,
    subtlety: 1.1,
  },
  {
    id: "eminence",
    name: "EMINENCE",
    fileCode: "0704",
    tempers: ["MA"],
    spacing: 5,
    lore: "Malice was the last temper to be named, and the first to be found. The board does not like you.",
    // The last teaching file, and the only Act I file with a clock. Going
    // from four untimed files straight into a two-temper file that is timed
    // meets the player with the clock and a second temper in the same
    // breath; here the clock arrives while the task is still trivial —
    // three groups of one temper, no wrong bin to drop into — so it can be
    // learned as a HUD element rather than as a threat.
    seconds: 180,
    teaches: true,
    seed: 0x5d26,
    quota: 3,
    spare: 0,
    subtlety: 1.1,
  },

  // ── Act II: two tempers per file, two bins, and a clock ────────────
  {
    id: "kingsport",
    name: "KINGSPORT",
    fileCode: "0901",
    tempers: ["WO", "FC"],
    spacing: 4,
    lore: "Sorrow and delight are neighbours on the wheel. Refiners who confuse them are reassigned, kindly.",
    seconds: 150,
    seed: 0x6e33,
    quota: 2,
    spare: 0,
    subtlety: 1,
  },
  {
    id: "le-mans",
    name: "LE MANS",
    fileCode: "1005",
    tempers: ["DR", "MA"],
    spacing: 4,
    lore: "A shiver and a strike are not the same thing. One waits for you. One does not.",
    seconds: 150,
    seed: 0x7f4a,
    quota: 2,
    spare: 0,
    subtlety: 0.95,
  },
  {
    id: "longbranch",
    name: "LONGBRANCH",
    fileCode: "1118",
    tempers: ["WO", "DR"],
    spacing: 4,
    lore: "Some files are heavier than others. This is not recorded anywhere, and you should not record it either.",
    seconds: 140,
    seed: 0x8a57,
    quota: 2,
    spare: 0,
    subtlety: 0.92,
  },
  {
    id: "moonbeam",
    name: "MOONBEAM",
    fileCode: "1203",
    tempers: ["FC", "MA"],
    spacing: 4,
    lore: "The numbers were people once. That is a rumour, and rumours are a form of frolic.",
    seconds: 140,
    seed: 0x9b64,
    quota: 2,
    spare: 0,
    subtlety: 0.9,
  },

  // ── Act III: the work itself, one new rule at a time ───────────────
  // Act III used to escalate on two continuous dials — the clock down, the
  // motion damped — which only makes it the same task, tighter. Each of
  // these mechanics makes it a different task instead, and each gets the
  // same three beats orientation uses: taught in isolation on an untimed
  // file, used once on a real board, then part of the world. The one
  // exception is the fifth temper, which is never taught: its entire value
  // is that nothing explains it.
  {
    id: "tumwater",
    name: "TUMWATER",
    fileCode: "0414",
    tempers: ["WO", "FC", "DR", "MA"],
    spacing: 3,
    lore: "Your first full file. Somewhere above you, a percentage moved, and someone was pleased.",
    seconds: 120,
    seed: 0x7a1c,
    quota: 2,
    spare: 0,
    subtlety: 1,
  },
  {
    // Two tempers, no clock, and two decoy sites next to the real thing so
    // the difference can be read side by side. A decoy stirs when probed,
    // belongs to nothing, and is silent — the ear stays honest, and only
    // the eye can be fooled.
    id: "jesup",
    name: "JESUP",
    fileCode: "0630",
    tempers: ["WO", "DR"],
    spacing: 4,
    lore: "Not everything that moves is data. Some of it is only the file looking back.",
    seconds: 0,
    untimed: true,
    teaches: true,
    decoys: [2, 0.35],
    seed: 0x6c22,
    quota: 1,
    spare: 0,
    subtlety: 1,
  },
  {
    id: "allentown",
    name: "ALLENTOWN",
    fileCode: "0219",
    tempers: ["WO", "FC", "DR", "MA"],
    spacing: 3,
    lore: "Allentown is refined four times a year and has never been completed twice by the same person.",
    seconds: 110,
    decoys: [2, 0.35],
    seed: 0x31f9,
    quota: 2,
    spare: 0,
    subtlety: 0.86,
  },
  {
    // One temper, one group, nothing else on the screen: it reads as woe,
    // and while the refiner watches it becomes something else. The lesson
    // is that a first read is not a read.
    id: "nanning",
    name: "NANNING",
    fileCode: "0905",
    tempers: ["WO", "FC"],
    spacing: 5,
    lore: "A temper is a mood, and a mood is not a promise. Refine what it is, not what it was.",
    seconds: 0,
    untimed: true,
    teaches: true,
    morphs: [1, 2],
    seed: 0x7d33,
    quota: 1,
    spare: 0,
    subtlety: 1.05,
  },
  {
    id: "siena",
    name: "SIENA",
    fileCode: "1107",
    tempers: ["WO", "FC", "DR", "MA"],
    spacing: 3,
    lore: "The tempers are quieter here. Not because there are fewer of them.",
    seconds: 100,
    decoys: [2, 0.35],
    morphs: [1, 2],
    seed: 0x5bd4,
    quota: 2,
    spare: 0,
    subtlety: 0.72,
  },
  {
    // The terminal takes the voices away and says so. Dread and malice are
    // told apart by sound before they are told apart by motion, so this is
    // the file where that crutch is removed — with a generous clock, while
    // there is still room to do it badly.
    id: "yakima",
    name: "YAKIMA",
    fileCode: "0308",
    tempers: ["DR", "MA"],
    spacing: 4,
    lore: "The Board has heard enough. Refine in silence, as Kier did, and do not ask why.",
    seconds: 150,
    teaches: true,
    redact: "audio",
    seed: 0x8e44,
    quota: 2,
    spare: 0,
    subtlety: 0.9,
  },
  {
    id: "cold-harbor",
    name: "COLD HARBOR",
    fileCode: "0001",
    tempers: ["WO", "FC", "DR", "MA"],
    spacing: 3,
    lore: "Cold Harbor is the last file. You will not be told what it was for.",
    seconds: 90,
    decoys: [2, 0.35],
    morphs: [1, 2],
    redact: "audio",
    fifth: true,
    seed: 0x0c14,
    quota: 2,
    spare: 0,
    subtlety: 0.58,
  },
];

/** Lumon's approved encouragements, delivered on a completed file. */
export const PRAISE: readonly string[] = [
  "PLEASE ENJOY EACH NUMBER EQUALLY.",
  "YOUR WORK IS MYSTERIOUS AND IMPORTANT.",
  "THE REFINEMENT IS APPRECIATED BY KIER.",
  "A HANDSOME QUARTERLY RESULT.",
  "YOU HAVE MADE THE COMPANY PROUD.",
];

export const REPRIMAND: readonly string[] = [
  "THAT NUMBER DID NOT FEEL THAT WAY.",
  "REFINEMENT REJECTED. RE-PROBE THE CLUSTER.",
  "YOUR INSTINCT IS UNTRUSTWORTHY TODAY.",
  "PLEASE CONSULT THE HANDBOOK.",
];
