/**
 * Painting the attract sheet.
 *
 * A trimmed `renderGrid`: the same atlas, the same after-image, the same
 * swell and cross-fade, without the scan beam, the marquee, the probe ring
 * or anything else that answers to a finger. Nothing here is interactive,
 * so nothing here draws feedback.
 *
 * Groups are lit in `stir` rather than in their temper's colour. Colour
 * assist is off by default, so `stir` is what a refiner actually sees on
 * the board — and the start screen has one job, which is to look like the
 * game.
 */

import type { GlyphAtlas } from "./glyphAtlas";
import type { AttractBoard } from "./attract";

/**
 * Resting brightness of an unstirred digit.
 *
 * Far under the board's 0.82. The first pass ran at 0.5 and the sheet
 * read as a second headline — every digit as loud as the wordmark, and
 * the eye with nowhere to land. This is a backdrop: it has to say
 * "numbers, a lot of them, alive" and then stop talking.
 */
const IDLE_ALPHA = 0.22;

/** Above this the digit starts burning through, as on the real board. */
const CORE_AT = 0.55;

export function drawAttract(
  ctx: CanvasRenderingContext2D,
  atlas: GlyphAtlas,
  board: AttractBoard,
  t: number,
): void {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#010604";
  ctx.fillRect(0, 0, board.w, board.h);

  const hot: { x: number; y: number; d: number; a: number; s: number }[] = [];

  for (const n of board.nodes) {
    const x = n.hx + n.dx;
    const y = n.hy + n.dy;
    const a = n.agitation;

    // The shimmer: each digit riding its own slow brightness wave, plus a
    // shallower one the whole sheet shares. Two frequencies rather than
    // one, because a single wave across 500 glyphs reads as the page
    // fading in and out rather than as phosphor.
    const shimmer =
      1 +
      0.16 * Math.sin(t * 1.9 + n.seed * 3.1) +
      0.05 * Math.sin(t * 0.41);

    if (a <= 0.04) {
      atlas.draw(ctx, "idle", n.digit, x, y, IDLE_ALPHA * shimmer, n.rot, n.scale);
      continue;
    }

    // The after-image, once the glyph has actually left its cell: the eye
    // gets the vacancy and the displacement at the same time.
    if (n.dx * n.dx + n.dy * n.dy > 0.4) {
      atlas.draw(ctx, "idle", n.digit, n.hx, n.hy, 0.26 * a, 0, n.scale * 0.94);
    }

    const swell = n.scale * (1 + 0.26 * a);
    atlas.draw(ctx, "idle", n.digit, x, y, IDLE_ALPHA * (1 - a) * shimmer, n.rot, swell);
    atlas.draw(ctx, "stir", n.digit, x, y, Math.min(1, a * 1.15), n.rot, swell);

    if (n.flash > 0.02 || a > CORE_AT) {
      const core = a > CORE_AT ? ((a - CORE_AT) / (1 - CORE_AT)) * 0.5 : 0;
      hot.push({
        x,
        y,
        d: n.digit,
        a: Math.min(1, n.flash * 0.9 + core),
        s: n.scale * (1.1 + 0.2 * a),
      });
    }
  }

  // One composite-mode switch for every burning core on the sheet.
  if (hot.length) {
    ctx.globalCompositeOperation = "lighter";
    for (const g of hot) atlas.draw(ctx, "hot", g.d, g.x, g.y, g.a, 0, g.s);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;
}
