import { TEMPERS } from "./constants";
import type { Temper } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StageLayout {
  /** The tempers this file actually uses, in deck order. */
  activeTempers: readonly Temper[];
  w: number;
  h: number;
  hudH: number;
  tickerH: number;
  deckH: number;
  binsH: number;
  /** Grid canvas region in stage coordinates. */
  grid: Rect;
  binRects: Record<Temper, Rect>;
  /** Font size for a matrix glyph, derived from cell height. */
  fontPx: number;
}

/** Chrome heights as a fraction of stage height — the single source of
 *  truth shared by the DOM chrome and the canvas hit-testing. */
export const HUD_FRAC = 0.078;
/** Band under the HUD reserved for the coach line. Reserved permanently
 *  rather than only while a message shows, so the matrix never reflows and
 *  never sits underneath the text describing it. */
export const TICKER_FRAC = 0.042;
/** Sized so the mode switches clear 44pt after padding and borders — iOS
 *  HIG's minimum, and Material's 48dp is within a hair of it. */
export const DECK_FRAC = 0.086;
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

const BIN_GAP_FRAC = 0.022;
const BIN_PAD_FRAC = 0.03;

export function computeLayout(
  w: number,
  h: number,
  activeTempers: readonly Temper[] = TEMPERS,
): StageLayout {
  const cols = activeTempers.length > 2 ? 2 : activeTempers.length || 1;
  const rows = Math.ceil((activeTempers.length || 1) / cols);

  const hudH = Math.round(h * HUD_FRAC);
  const tickerH = Math.round(h * TICKER_FRAC);
  const deckH = Math.round(h * DECK_FRAC);
  const binsH = Math.round(h * (rows > 1 ? BINS_FRAC : BINS_FRAC_ONE_ROW));

  // The control deck sits at the TOP, under the coach line, not between the
  // board and the bins. Down there it cut straight across the path every
  // packet has to travel — the refiner drags a box down the screen and the
  // mode switches are in the way of it. Nothing on the deck is pressed
  // during play, so it belongs out of the working area entirely.
  const grid: Rect = {
    x: 0,
    y: hudH + tickerH + deckH,
    w,
    h: Math.max(40, h - hudH - tickerH - deckH - binsH),
  };

  const binsTop = h - binsH;
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
    w,
    h,
    hudH,
    tickerH,
    deckH,
    binsH,
    grid,
    binRects,
    fontPx: 0,
  };
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
