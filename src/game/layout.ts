import { TEMPERS } from "./constants";
import type { Temper } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StageLayout {
  w: number;
  h: number;
  hudH: number;
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
/** Sized so the mode switches clear 44pt after padding and borders — iOS
 *  HIG's minimum, and Material's 48dp is within a hair of it. */
export const DECK_FRAC = 0.086;
export const BINS_FRAC = 0.175;

const BIN_GAP_FRAC = 0.022;
const BIN_PAD_FRAC = 0.03;

export function computeLayout(w: number, h: number): StageLayout {
  const hudH = Math.round(h * HUD_FRAC);
  const deckH = Math.round(h * DECK_FRAC);
  const binsH = Math.round(h * BINS_FRAC);

  const grid: Rect = {
    x: 0,
    y: hudH,
    w,
    h: Math.max(40, h - hudH - deckH - binsH),
  };

  const binsTop = h - binsH;
  const padX = Math.round(w * BIN_PAD_FRAC);
  const gap = Math.round(w * BIN_GAP_FRAC);
  const padY = Math.round(binsH * 0.08);
  const cellW = (w - padX * 2 - gap) / 2;
  const cellH = (binsH - padY * 2 - gap) / 2;

  const binRects = {} as Record<Temper, Rect>;
  TEMPERS.forEach((t, i) => {
    const col = i % 2;
    const row = (i / 2) | 0;
    binRects[t] = {
      x: padX + col * (cellW + gap),
      y: binsTop + padY + row * (cellH + gap),
      w: cellW,
      h: cellH,
    };
  });

  return {
    w,
    h,
    hudH,
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
