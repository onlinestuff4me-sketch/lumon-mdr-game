import type { LevelDef, Temper } from "./types";

/** Matrix dimensions — the Lumon standard refinement window. */
export const COLS = 16;
export const ROWS = 28;
export const CELL_COUNT = COLS * ROWS;

/** Radial threshold at which a cluster begins to agitate (CSS px). */
export const PROBE_RADIUS = 80;
/** The reticle floats above the fingertip so the thumb never occludes it. */
export const RETICLE_OFFSET_Y = -40;
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

export const LEVELS: readonly LevelDef[] = [
  {
    id: "calibration",
    name: "CALIBRATION",
    fileCode: "0000",
    seconds: 0,
    untimed: true,
    teaches: true,
    seed: 0x1e55,
    quota: 1,
    spare: 0,
    subtlety: 1.15,
  },
  {
    id: "tumwater",
    name: "TUMWATER",
    fileCode: "0414",
    seconds: 120,
    seed: 0x7a1c,
    quota: 5,
    spare: 2,
    subtlety: 1,
  },
  {
    id: "allentown",
    name: "ALLENTOWN",
    fileCode: "0219",
    seconds: 110,
    seed: 0x31f9,
    quota: 5,
    spare: 2,
    subtlety: 0.86,
  },
  {
    id: "siena",
    name: "SIENA",
    fileCode: "1107",
    seconds: 100,
    seed: 0x5bd4,
    quota: 5,
    spare: 2,
    subtlety: 0.72,
  },
  {
    id: "cold-harbor",
    name: "COLD HARBOR",
    fileCode: "0001",
    seconds: 90,
    seed: 0x0c14,
    quota: 5,
    spare: 2,
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
