import type { LevelDef, Temper } from "./types";

/** Matrix dimensions — the Lumon standard refinement window. */
export const COLS = 16;
/**
 * Twenty-six, down from twenty-eight.
 *
 * The bins grew a line each and the bands between them were evened out,
 * which cost the board about sixty pixels. Spent on smaller glyphs that
 * would have been a 12.7px digit; spent on two fewer rows instead, and the
 * digits stay the size they were. The board is a fixed grid scaled to fit
 * its rect, so this is the only dial that trades rows for legibility.
 */
export const ROWS = 26;
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

/** Idle phosphor color for inert digits. */
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
 *  itself just has to be findable once you are looking. One entry per
 *  ramp rung. */
const OR_SUBTLETY = [0.95, 0.92, 0.89, 0.86, 0.83, 0.8] as const;

/**
 * The orientation ramp, as a table.
 *
 * Playtesting called the original twenty-nine screens too slow, and the
 * replacement is a ladder the playtester specified rung by rung: one
 * group alone, two of the same, two tempers told apart, doubled, then
 * the full deck of bins arriving before the full deck of tempers. Each
 * rung is one row here — how many screens it lasts, how many tempers a
 * screen carries, how many groups of each, and how many bins the deck
 * shows. `bins` may exceed `tempers`: that is the rung that teaches
 * some bins are not to be fed.
 *
 * The ramp planner artifact edits `screens` per rung; keep this table in
 * step with it.
 */
export interface OrientStage {
  readonly screens: number;
  readonly tempers: number;
  readonly groupsPerTemper: number;
  readonly bins: number;
}

/**
 * Each rung is also a *file*.
 *
 * A rung is one coherent lesson, so it is the natural unit for the thing
 * the refiner is told they are refining — and it is what makes the header
 * meter honest: `FILE ORIENTATION #0001 2/3` fills a third at a time and
 * pays an incentive when it reaches the end. Thirteen levels under one
 * file code meant a bar that reset twelve times inside a single "file".
 *
 * The first rung is three screens rather than four so that the first
 * incentive lands at the third, which is as early as a file-completion
 * payout can be made to arrive.
 */
export const ORIENT_STAGES: readonly OrientStage[] = [
  { screens: 3, tempers: 1, groupsPerTemper: 1, bins: 1 },
  { screens: 2, tempers: 1, groupsPerTemper: 2, bins: 1 },
  { screens: 2, tempers: 2, groupsPerTemper: 1, bins: 2 },
  { screens: 2, tempers: 2, groupsPerTemper: 2, bins: 2 },
  { screens: 2, tempers: 2, groupsPerTemper: 2, bins: 4 },
  { screens: 1, tempers: 4, groupsPerTemper: 1, bins: 4 },
];

/** Focus and subtlety per rung: groups start centerd and loud, and edge
 *  outwards and quieten as the ladder climbs. */
const OR_FOCUS = ["center", "center", "mid", "mid", "edge", "edge"] as const;

/**
 * One addendum per orientation file, not one for all six.
 *
 * Every completed file releases a line from the Perpetuity Wing, and the
 * six orientation files were releasing the same one — so the screen that
 * marks finishing a file said nothing about the file that had just been
 * finished. Each is about its own lesson, in the wing's own register:
 * grandiose, unhelpful, and perfectly serious.
 */
const OR_LORE = [
  "Everything you will ever refine is already on the screen. Most of it is only pretending to be still.",
  "A second group is not twice the work. Kier held that it is the same work, held twice.",
  "Two tempers on one screen is the first real question this department asks of you.",
  "The wheel turns whether or not you are watching it. Nothing on it waits its turn.",
  "Some bins are not for you. A bin that stays empty has still done its work.",
  "All four at once is not a test. Kier did not believe in tests. It is a Tuesday.",
] as const;

function orientationScreens(): LevelDef[] {
  const out: LevelDef[] = [];
  const total = ORIENT_STAGES.reduce((n, st) => n + st.screens, 0);
  // `k` is the wheel index of the temper most recently shown. A solo
  // screen advances the wheel; a multi-temper screen OPENS on that most
  // recent temper and introduces the next — recall is always anchored on
  // something the player has just seen.
  let k = -1;
  let index = 0;
  ORIENT_STAGES.forEach((st, stage) => {
    for (let sIdx = 0; sIdx < st.screens; sIdx++) {
      const n = Math.min(4, Math.max(1, st.tempers));
      let tempers: Temper[];
      if (n === 4) {
        tempers = [...TEMPERS];
      } else if (n === 1) {
        k += 1;
        tempers = [TEMPERS[((k % 4) + 4) % 4]];
      } else {
        tempers = Array.from(
          { length: n },
          (_, j) => TEMPERS[(((k + j) % 4) + 4) % 4],
        );
        k += n - 1;
      }
      // Bins in canonical deck order: the content tempers, widened with
      // the remaining tempers until the deck is as wide as the rung asks.
      const binCount = Math.min(4, Math.max(n, st.bins));
      const showBins =
        binCount === tempers.length
          ? undefined
          : [
              ...tempers,
              ...TEMPERS.filter((t) => !tempers.includes(t)),
            ].slice(0, binCount).sort(
              (x, y) => TEMPERS.indexOf(x) - TEMPERS.indexOf(y),
            );
      const groups = n * st.groupsPerTemper;
      const i = index++;
      const last = i === total - 1;
      // The last stage of this rung, which is the last stage of this file:
      // where the ceremony, the archive row and the file credit all land.
      const endOfFile = sIdx === st.screens - 1;
      out.push({
        id: `orientation-${String(i + 1).padStart(2, "0")}`,
        name: "ORIENTATION",
        fileCode: String(stage + 1).padStart(4, "0"),
        fileKey: `orientation-file-${stage + 1}`,
        tempers: [...new Set(tempers)],
        ...(showBins ? { showBins } : {}),
        spacing: groups >= 4 ? 5 : 6,
        lore: OR_LORE[stage],
        seconds: 0,
        untimed: true,
        training: true,
        selfAgitate: true,
        startMode: "select",
        // One digit of overlap lifts the whole group. A new refiner is
        // never told that their correct instinct was a wrong box.
        minCapture: 1,
        // No ceremony between the stages of a file: one continuous
        // sequence, not a banner per screen. The end of each orientation
        // file keeps the full one — that is where the meter reaches 100%
        // and an incentive may be owed, and neither should be wiped
        // through by an auto-advance.
        ceremony: endOfFile ? "full" : "none",
        autoAdvanceMs: 900,
        archived: last,
        stage: [sIdx + 1, st.screens],
        focus: OR_FOCUS[stage],
        tapToSelect: true,
        // Every orientation screen, not only the single-bin ones.
        //
        // The arrows do name the right bin on a four-bin deck, and outside
        // orientation that would be the answer handed over. Inside it,
        // nothing is hidden by design: these screens exist to teach the
        // gesture — box it, carry it, drop it — and a refiner who has just
        // lifted their first packet on a wide deck and cannot see where it
        // is meant to go is being tested on a rule nobody has told them.
        // The arrows stop at the end of orientation, which is where the
        // testing starts.
        binHint: true,
        seed: (0x0b1e + i * 0x1d37) >>> 0,
        quota: st.groupsPerTemper,
        spare: 0,
        subtlety: OR_SUBTLETY[stage],
      } satisfies LevelDef);
    }
  });
  return out;
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
    teachProbe: true,
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
    lore: "Sorrow and delight are neighbors on the wheel. Refiners who confuse them are reassigned, kindly.",
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
    lore: "The numbers were people once. That is a rumor, and rumors are a form of frolic.",
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
