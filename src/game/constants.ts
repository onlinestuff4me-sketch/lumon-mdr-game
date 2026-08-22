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
/** Minimum captured members for a marquee to resolve into a packet. */
export const MIN_CAPTURE = 4;
/** Double-tap window (ms) and slop (px) for the mode toggle gesture. */
export const DOUBLE_TAP_MS = 300;
export const TAP_SLOP = 14;
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
 * The file queue, in three acts.
 *
 * A refiner is not born knowing what dread feels like. Act I gives one
 * temper per file with only that temper's bin on the deck, so a signature
 * is learned on its own with nothing to confuse it against. Act II puts two
 * tempers in a file, which is where the actual skill lives — telling one
 * from another. Act III is the job as Lumon specifies it.
 *
 * `spacing` opens the board up early and lets it crowd later, and the clock
 * only starts in Act II.
 */
export const LEVELS: readonly LevelDef[] = [
  // ── Orientation ────────────────────────────────────────────────────
  // Before probing, before tempers, before the clock: one group, already
  // moving, on a board of digits that look exactly like it. Playtesting
  // found that a player dropped straight into CALIBRATION has no reason to
  // believe there is anything hidden in the matrix at all, and so no reason
  // to hold a finger on it. This file supplies the reason. It opens in
  // SELECT, so the first gesture a refiner ever makes is a box round
  // something they can already see.
  {
    id: "orientation",
    name: "ORIENTATION",
    fileCode: "0001",
    tempers: ["WO"],
    spacing: 6,
    lore: "Everything you will ever refine is already on the screen. Most of it is only pretending to be still.",
    seconds: 0,
    untimed: true,
    training: true,
    selfAgitate: true,
    startMode: "select",
    // Chosen, not arbitrary: this seed puts the file's only group near the
    // middle of the board (col 8, row 13) with seven digits in it. A first
    // file must not hide its one teaching example in a corner.
    seed: 0x09,
    quota: 1,
    spare: 0,
    // Deliberately louder than any real file: this motion has to be
    // noticeable to someone who does not yet know to look for motion.
    subtlety: 1.35,
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

  // ── Act III: the work itself ───────────────────────────────────────
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
    id: "allentown",
    name: "ALLENTOWN",
    fileCode: "0219",
    tempers: ["WO", "FC", "DR", "MA"],
    spacing: 3,
    lore: "Allentown is refined four times a year and has never been completed twice by the same person.",
    seconds: 110,
    seed: 0x31f9,
    quota: 2,
    spare: 0,
    subtlety: 0.86,
  },
  {
    id: "siena",
    name: "SIENA",
    fileCode: "1107",
    tempers: ["WO", "FC", "DR", "MA"],
    spacing: 3,
    lore: "The tempers are quieter here. Not because there are fewer of them.",
    seconds: 100,
    seed: 0x5bd4,
    quota: 2,
    spare: 0,
    subtlety: 0.72,
  },
  {
    id: "cold-harbor",
    name: "COLD HARBOR",
    fileCode: "0001",
    tempers: ["WO", "FC", "DR", "MA"],
    spacing: 3,
    lore: "Cold Harbor is the last file. You will not be told what it was for.",
    seconds: 90,
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
