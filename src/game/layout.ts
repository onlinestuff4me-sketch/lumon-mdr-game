import { TEMPERS } from "./constants";
import type { Temper } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The three orders the playing screen has been tried in.
 *
 * `a` and `b` are the two proposals as written; `c` is the compact
 * reading of the same idea. All three drop the mode deck — probe and
 * select are decided by what the refiner does, not by a switch — and all
 * three put the handbook beside the meter instead of giving it a third
 * of a band of its own.
 *
 * - `a` ticker · grid · bins · file card · record
 * - `b` header · record · ticker · grid · bins
 * - `c` header · grid (ticker overlaid on its top edge) · bins · record
 *
 * `a` ships, and its file card is a *footer*, not a header. Everything a
 * refiner's action moves is now in one stack under their thumb: the bin
 * they just dropped into, the file that bin advanced, and the incentive
 * that file advanced — three meters at increasing grain, in the place the
 * eye already is at the moment they all move. A file meter at the top of
 * the screen moved where nobody was looking.
 */
export type LayoutVariant = "a" | "b" | "c";

export interface StageLayout {
  /** The tempers this file actually uses, in deck order. */
  activeTempers: readonly Temper[];
  variant: LayoutVariant;
  w: number;
  h: number;
  hudH: number;
  /** Top edge of the file card, in stage coordinates. */
  hudTop: number;
  /** Header at the top of the screen, or a card in the footer stack. */
  hudAt: "top" | "footer";
  tickerH: number;
  /** True when the ticker is drawn over the grid rather than above it. */
  tickerOverGrid: boolean;
  recordH: number;
  /** Top edge of the incentives record band, in stage coordinates. */
  recordTop: number;
  /** Where the incentives record sits relative to the board. */
  recordAt: "top" | "bottom";
  binsH: number;
  /** Top edge of the bin deck, in stage coordinates. */
  binsTop: number;
  /** The uniform space between the board, the bins and the record. */
  gap: number;
  /** Grid canvas region in stage coordinates. */
  grid: Rect;
  binRects: Record<Temper, Rect>;
  /** Font size for a matrix glyph, derived from cell height. */
  fontPx: number;
}

/**
 * Chrome heights as a fraction of stage height — the single source of
 * truth shared by the DOM chrome and the canvas hit-testing.
 *
 * The header is two lines now: the file's name and clock, then the
 * refinement meter with the handbook beside it. The mode deck is gone
 * (0.086 of the screen for two switches the game can decide for itself)
 * and so is the record's berth inside the header — it has a band of its
 * own, above or below the board depending on the variant.
 */
export const HUD_FRAC = 0.072;
/** Two lines of 11px plus the meter, at any stage height. */
export const HUD_MIN = 56;
/** Band reserved for the coach line. Reserved permanently rather than
 *  only while a message shows, so the matrix never reflows and never sits
 *  underneath the text describing it. */
export const TICKER_FRAC = 0.042;
/** The incentives record: a title line and a meter line. */
export const RECORD_FRAC = 0.063;
export const RECORD_MIN = 44;
/**
 * The bin deck. One row, always, however many bins are on it.
 *
 * A file that adds a bin used to add a *row* — one bin became a strip, two
 * became a wider strip, four became a 2x2 block twice as deep. Three
 * different shapes for one idea, and the board lost a fifth of its height
 * the moment the fourth temper arrived. One row means adding a bin narrows
 * the existing ones and changes nothing else.
 *
 * Each bin carries two lines of its own — its name above, its meter and
 * percentage below, the same shape as the file meter in the header — which
 * is what buys back the horizontal room four across needs.
 */
export const BINS_FRAC = 0.1;
export const BINS_MIN = 66;

/**
 * The space between the board, the bins and the record.
 *
 * One number, used everywhere, because the complaint that started this was
 * that the gaps were uneven and the bins were sitting on top of the
 * record. Also the margin under the record, so nothing is flush against
 * the bezel.
 */
export const GAP_FRAC = 0.014;
export const GAP_MIN = 9;

/**
 * Which order ships.
 *
 * `a` — the board sits directly under the coach line, and the record is a
 * footer under the bins where a thumb already is. Two meters never stack:
 * the refinement meter is at the top with the file's name, the incentive
 * meter is at the bottom with the things it counts. Overridable with
 * `?layout=b` or `?layout=c` for comparison.
 */
export const DEFAULT_VARIANT: LayoutVariant = "a";

/**
 * The space between the file card and the incentives record.
 *
 * Deliberately tighter than `gap`. They are two readings of the same
 * action at two grains and they have to read as one stack, not as two
 * unrelated bands that happen to be adjacent.
 */
const TIGHT_FRAC = 0.55;

/**
 * Resolved once, at first use, and shared.
 *
 * The engine hit-tests against `computeLayout` and the DOM chrome is
 * drawn from it, and the entire value of that arrangement is that the two
 * cannot disagree. A variant passed in by one caller and defaulted by the
 * other would put the bins somewhere the engine did not think they were —
 * so the choice is made in one place and both callers read it.
 */
let resolved: LayoutVariant | null = null;

export function layoutVariant(): LayoutVariant {
  if (resolved !== null) return resolved;
  const search = typeof window === "undefined" ? "" : window.location.search;
  const v = new URLSearchParams(search).get("layout");
  resolved = v === "b" || v === "c" || v === "a" ? v : DEFAULT_VARIANT;
  return resolved;
}

const BIN_GAP_FRAC = 0.022;
const BIN_PAD_FRAC = 0.03;

export function computeLayout(
  w: number,
  h: number,
  activeTempers: readonly Temper[] = TEMPERS,
  variant: LayoutVariant = layoutVariant(),
): StageLayout {
  // One row, always. Adding a bin narrows the row; it never deepens it.
  const cols = Math.max(1, activeTempers.length);

  const hudH = Math.max(HUD_MIN, Math.round(h * HUD_FRAC));
  const recordH = Math.max(RECORD_MIN, Math.round(h * RECORD_FRAC));
  const binsH = Math.max(BINS_MIN, Math.round(h * BINS_FRAC));
  const gap = Math.max(GAP_MIN, Math.round(h * GAP_FRAC));

  const recordAt = variant === "b" ? "top" : "bottom";
  const hudAt = variant === "a" ? "footer" : "top";
  // With the file card in the footer the coach line is the first thing on
  // the screen, so its band carries the margin the header used to.
  const tickerH = Math.round(h * TICKER_FRAC) + (hudAt === "footer" ? gap : 0);
  // In `c` the coach line is drawn over the top edge of the board instead
  // of above it. The band is still reserved — the matrix never reflows —
  // but it is reserved inside the grid rather than out of it, which buys
  // the board a whole band back.
  const tickerOverGrid = variant === "c";
  const above =
    (hudAt === "top" ? hudH : 0) +
    (recordAt === "top" ? gap + recordH : 0) +
    (tickerOverGrid ? 0 : tickerH);
  // Everything below the board, in order from the bottom edge up: a
  // margin, the record, the file card sitting tight against it, a gap,
  // the bins, a gap.
  const recordTop = recordAt === "bottom" ? h - gap - recordH : hudH + gap;
  const tight = Math.max(4, Math.round(gap * TIGHT_FRAC));
  const hudTop = hudAt === "footer" ? recordTop - tight - hudH : 0;
  const binsTop =
    (hudAt === "footer"
      ? hudTop
      : recordAt === "bottom"
        ? recordTop
        : h) -
    gap -
    binsH;
  const below = h - binsTop + gap;

  const grid: Rect = {
    x: 0,
    y: above,
    w,
    h: Math.max(40, h - above - below),
  };

  const padX = Math.round(w * BIN_PAD_FRAC);
  const binGap = Math.round(w * BIN_GAP_FRAC);
  // The whole band, edge to edge, split between however many bins the file
  // shows. A lone bin spanning the deck is a signal in itself — this file
  // has one temper in it and nothing to confuse it with — and four across
  // is the same shape, narrower.
  const wideW = (w - padX * 2 - binGap * (cols - 1)) / cols;

  const binRects = {} as Record<Temper, Rect>;
  // Every temper gets a rect so nothing downstream can read undefined; the
  // inactive ones are parked off-stage where no drop can land on them.
  for (const t of TEMPERS) {
    binRects[t] = { x: -9999, y: -9999, w: 0, h: 0 };
  }
  activeTempers.forEach((t, i) => {
    binRects[t] = {
      x: padX + i * (wideW + binGap),
      y: binsTop,
      w: wideW,
      h: binsH,
    };
  });

  return {
    activeTempers,
    variant,
    w,
    h,
    hudH,
    hudTop,
    hudAt,
    tickerH,
    tickerOverGrid,
    recordH,
    recordTop,
    recordAt,
    binsH,
    binsTop,
    gap,
    grid,
    binRects,
    fontPx: 0,
  };
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
