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
 * - `a` header · ticker · grid · bins · record
 * - `b` header · record · ticker · grid · bins
 * - `c` header · grid (ticker overlaid on its top edge) · bins · record
 */
export type LayoutVariant = "a" | "b" | "c";

export interface StageLayout {
  /** The tempers this file actually uses, in deck order. */
  activeTempers: readonly Temper[];
  variant: LayoutVariant;
  w: number;
  h: number;
  hudH: number;
  tickerH: number;
  /** True when the ticker is drawn over the grid rather than above it. */
  tickerOverGrid: boolean;
  recordH: number;
  /** Where the incentives record sits relative to the board. */
  recordAt: "top" | "bottom";
  binsH: number;
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
/** The incentives record: one dense line, or two when it has a meter. */
export const RECORD_FRAC = 0.05;
export const RECORD_MIN = 40;
/** Bin deck height for a two-row (four bin) deck. */
export const BINS_FRAC = 0.175;
/**
 * One-row deck height, tuned so a single-row bin comes out the *same
 * height* as one bin of the 2x2 deck rather than a squat strip — the fill
 * meter has to read at a glance in Act I, where the whole point of the file
 * is watching that one bar climb. It is the two-row height minus one row
 * and one gap, which lands within a pixel of a normal bin at every stage
 * size, and the grid gets the difference: early files want an open board.
 */
export const BINS_FRAC_ONE_ROW = 0.08;

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
  const cols = activeTempers.length > 2 ? 2 : activeTempers.length || 1;
  const rows = Math.ceil((activeTempers.length || 1) / cols);

  const hudH = Math.max(HUD_MIN, Math.round(h * HUD_FRAC));
  const tickerH = Math.round(h * TICKER_FRAC);
  const recordH = Math.max(RECORD_MIN, Math.round(h * RECORD_FRAC));
  const binsH = Math.round(h * (rows > 1 ? BINS_FRAC : BINS_FRAC_ONE_ROW));

  const recordAt = variant === "b" ? "top" : "bottom";
  // In `c` the coach line is drawn over the top edge of the board instead
  // of above it. The band is still reserved — the matrix never reflows —
  // but it is reserved inside the grid rather than out of it, which buys
  // the board a whole band back.
  const tickerOverGrid = variant === "c";
  const above = hudH + (recordAt === "top" ? recordH : 0) +
    (tickerOverGrid ? 0 : tickerH);
  const below = binsH + (recordAt === "bottom" ? recordH : 0);

  const grid: Rect = {
    x: 0,
    y: above,
    w,
    h: Math.max(40, h - above - below),
  };

  const binsTop = h - binsH - (recordAt === "bottom" ? recordH : 0);
  const padX = Math.round(w * BIN_PAD_FRAC);
  const gap = Math.round(w * BIN_GAP_FRAC);
  const padY = Math.round(binsH * 0.08);
  // One or two bins take a single full-height row; four fall back to the
  // 2x2 deck. A lone bin spanning the deck is also a signal in itself —
  // this file has one temper in it and nothing to confuse it with.
  const wideW = (w - padX * 2 - gap * (cols - 1)) / cols;
  const tallH = (binsH - padY * 2 - gap * (rows - 1)) / rows;

  const binRects = {} as Record<Temper, Rect>;
  // Every temper gets a rect so nothing downstream can read undefined; the
  // inactive ones are parked off-stage where no drop can land on them.
  for (const t of TEMPERS) {
    binRects[t] = { x: -9999, y: -9999, w: 0, h: 0 };
  }
  activeTempers.forEach((t, i) => {
    const col = i % cols;
    const row = (i / cols) | 0;
    binRects[t] = {
      x: padX + col * (wideW + gap),
      y: binsTop + padY + row * (tallH + gap),
      w: wideW,
      h: tallH,
    };
  });

  return {
    activeTempers,
    variant,
    w,
    h,
    hudH,
    tickerH,
    tickerOverGrid,
    recordH,
    recordAt,
    binsH,
    grid,
    binRects,
    fontPx: 0,
  };
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
