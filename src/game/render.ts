import { TEMPER_DEFS } from "./constants";
import type { GameEngine } from "./engine";
import type { PaletteKey } from "./glyphAtlas";
import type { GridNode, Temper } from "./types";

/** Scratch list of flashing nodes, reused so the render pass allocates
 *  nothing. Malice flashes a whole cluster at once, and toggling
 *  globalCompositeOperation per glyph can force a layer flush each time. */
const flashing: GridNode[] = [];

/** Board layer: the matrix, the reticle, the marquee. */
export function renderGrid(ctx: CanvasRenderingContext2D, e: GameEngine): void {
  const { w, h, grid } = e.layout;
  const atlas = e.atlas;

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#010604";
  ctx.fillRect(0, 0, w, h);

  // Faint refinement well behind the digits.
  ctx.fillStyle = "rgba(6,48,29,0.28)";
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h);

  // ── digits ──────────────────────────────────────────────────────────
  for (const n of e.board.nodes) {
    if (n.retired || n.lifted) continue;
    const x = n.hx + n.dx;
    const y = n.hy + n.dy;
    if (y < grid.y - 24 || y > grid.y + grid.h + 24) continue;

    const a = n.agitation;
    if (a <= 0.04 && n.flash <= 0.02) {
      atlas.draw(ctx, "idle", n.digit, x, y, 0.82, n.rot, n.scale);
      continue;
    }

    const temper = e.board.clusters[n.cluster]?.temper;
    const key: PaletteKey = e.assist && temper ? temper : "stir";
    // Cross-fade phosphor green into the temper's colour as it agitates.
    // Both alphas are driven by `a` alone so a barely-stirred cluster reads
    // as green, not as a permanently tinted giveaway.
    atlas.draw(ctx, "idle", n.digit, x, y, 0.82 * (1 - a), n.rot, n.scale);
    atlas.draw(ctx, key, n.digit, x, y, Math.min(1, a * 1.15), n.rot, n.scale);

    if (n.flash > 0.02) flashing.push(n);
  }

  // One composite-mode switch for every flash on the board.
  if (flashing.length > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (const n of flashing) {
      atlas.draw(
        ctx,
        "hot",
        n.digit,
        n.hx + n.dx,
        n.hy + n.dy,
        n.flash * 0.9,
        n.rot,
        n.scale * 1.1,
      );
    }
    ctx.globalCompositeOperation = "source-over";
    flashing.length = 0;
  }
  ctx.globalAlpha = 1;

  if (e.marquee.active) drawMarquee(ctx, e);
  // The marquee's own corner ticks mark the drag point; a probe ring on top
  // of them is just clutter.
  if (e.reticle.active && !e.packet && !e.marquee.active) drawReticle(ctx, e);
}

/** Lens radius and magnification for the probe reticle. */
const LENS_R = 36;
const LENS_ZOOM = 1.75;

/**
 * Curvature falloff for the glass, cached.
 *
 * `createRadialGradient` in a per-frame path is expensive enough to show
 * up in a frame budget, but the sheen cannot simply be baked into a tile
 * and blitted: it both darkens (at the rim) and lightens (the specular),
 * and a source-over tile would lay that darkening flatly over the
 * magnified digits instead of letting the highlight add to them. So the
 * gradient object is built once in lens-local coordinates and painted
 * through a translate, which keeps the compositing live and the
 * allocation out of the loop.
 */
let bulge: CanvasGradient | null = null;

function lensBulge(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (bulge) return bulge;
  const g = ctx.createRadialGradient(
    -LENS_R * 0.3,
    -LENS_R * 0.35,
    LENS_R * 0.1,
    0,
    0,
    LENS_R,
  );
  g.addColorStop(0, "rgba(214,255,236,0.16)");
  g.addColorStop(0.55, "rgba(214,255,236,0.03)");
  g.addColorStop(1, "rgba(0,0,0,0.34)");
  bulge = g;
  return g;
}

/**
 * The probe reticle is a lens: a piece of ground glass held over the
 * matrix.
 *
 * The magnified digits are *re-drawn from the atlas* at the larger size
 * rather than sampled from the canvas and upscaled — a lens that blurs
 * what it magnifies is a smudge, not glass, and this way the glyphs stay
 * as crisp under the lens as outside it. Only the nodes that fall inside
 * the lens are touched, so this costs a couple of dozen extra blits and
 * only while a finger is down.
 */
function drawReticle(ctx: CanvasRenderingContext2D, e: GameEngine): void {
  const { x, y } = e.reticle;
  const sc = e.reticle.scale;
  if (sc <= 0.02) return;
  const t = e.elapsed;

  let hot: Temper | null = null;
  let hotValue = 0;
  for (const c of e.board.clusters) {
    if (c.probe > hotValue) {
      hotValue = c.probe;
      hot = c.temper;
    }
  }
  const color = hot && e.assist ? TEMPER_DEFS[hot].css : "#2fd68a";
  const atlas = e.atlas;

  // On the file that teaches the lens it closes down rather than blinking
  // out. Scaling about the lens centre shrinks the glass, the magnified
  // digits, the cached sheen, the bezel and the ticks together. Clipping to
  // a smaller radius instead would leave the highlight and the rim sitting
  // still while the glass moved, so the transform wraps the whole reticle.
  const shrinking = sc < 1;
  if (shrinking) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.translate(-x, -y);
  }

  ctx.save();

  // ── the glass itself ────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(x, y, LENS_R, 0, Math.PI * 2);
  ctx.clip();

  // Ground under the lens: the board colour, lifted a little so the glass
  // reads as holding light rather than as a hole.
  ctx.fillStyle = "#03120b";
  ctx.fillRect(x - LENS_R, y - LENS_R, LENS_R * 2, LENS_R * 2);

  // Magnified content. Everything within LENS_R / ZOOM of the centre maps
  // out to the rim.
  const reach = LENS_R / LENS_ZOOM + 14;
  for (const n of e.board.nodes) {
    if (n.retired || n.lifted) continue;
    const nx = n.hx + n.dx;
    const ny = n.hy + n.dy;
    if (Math.abs(nx - x) > reach || Math.abs(ny - y) > reach) continue;

    const mx = x + (nx - x) * LENS_ZOOM;
    const my = y + (ny - y) * LENS_ZOOM;
    const scale = n.scale * LENS_ZOOM;
    const a = n.agitation;
    if (a <= 0.04 && n.flash <= 0.02) {
      atlas.draw(ctx, "idle", n.digit, mx, my, 0.95, n.rot, scale);
      continue;
    }
    const temper = e.board.clusters[n.cluster]?.temper;
    const key: PaletteKey = e.assist && temper ? temper : "stir";
    atlas.draw(ctx, "idle", n.digit, mx, my, 0.95 * (1 - a), n.rot, scale);
    atlas.draw(ctx, key, n.digit, mx, my, Math.min(1, a * 1.15), n.rot, scale);
  }

  // Curvature, then the specular streak added on top of it.
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 1;
  ctx.fillStyle = lensBulge(ctx);
  ctx.fillRect(-LENS_R, -LENS_R, LENS_R * 2, LENS_R * 2);

  // A hair of drift so the glass feels held rather than pinned.
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(
    -LENS_R * 0.34,
    -LENS_R * 0.46 + Math.sin(t * 0.9) * 0.8,
    LENS_R * 0.42,
    LENS_R * 0.13,
    -0.6,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "rgba(226,255,242,0.5)";
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── rim and reading ─────────────────────────────────────────────────
  ctx.save();
  // Bezel: a dark seat under a bright edge reads as thickness.
  ctx.strokeStyle = "rgba(1,10,6,0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, LENS_R + 1.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.3 + 0.35 * hotValue;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, LENS_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.75 + 0.25 * hotValue;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(x, y, LENS_R, 0, Math.PI * 2);
  ctx.stroke();

  // Signal-strength arc, riding just outside the rim.
  if (hotValue > 0.03) {
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(x, y, LENS_R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hotValue);
    ctx.stroke();
  }

  // Crosshair ticks, kept outside the glass so they never sit over a digit.
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    ctx.moveTo(x + dx * (LENS_R + 3), y + dy * (LENS_R + 3));
    ctx.lineTo(x + dx * (LENS_R + 10), y + dy * (LENS_R + 10));
  }
  ctx.stroke();
  ctx.restore();
  if (shrinking) ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMarquee(ctx: CanvasRenderingContext2D, e: GameEngine): void {
  const r = e.marqueeRect();
  ctx.save();
  ctx.fillStyle = "rgba(47,214,138,0.09)";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = "#2fd68a";
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -(e.elapsed * 22) % 11;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 4.5;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
  ctx.setLineDash([]);

  // Corner ticks, terminal-style.
  const c = 9;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [cx, sx] of [
    [r.x, 1],
    [r.x + r.w, -1],
  ] as const) {
    for (const [cy, sy] of [
      [r.y, 1],
      [r.y + r.h, -1],
    ] as const) {
      ctx.moveTo(cx, cy + sy * c);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * c, cy);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Overlay layer: the carried packet, drawn above the bin chrome. */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  e: GameEngine,
): void {
  const { w, h } = e.layout;
  ctx.clearRect(0, 0, w, h);

  if (e.absorb) drawAbsorb(ctx, e);

  const packet = e.packet;
  if (!packet) return;

  const def = TEMPER_DEFS[packet.temper];
  // Without assist the packet stays anonymous — binning it is the refiner's
  // judgement call, not a colour match.
  const ink = e.assist ? def.css : "#c3fddf";
  const n = packet.digits.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cell = Math.max(14, e.layout.fontPx * 1.25);
  const labelPx = 8;
  const label = e.assist
    ? `UNASSIGNED / ${packet.temper} / ${n}`
    : `UNASSIGNED / ${n} DIGITS`;
  // Keep the caption inside the frame no matter how few digits there are.
  const boxW = Math.max(cols * cell + 18, label.length * labelPx * 0.62 + 16);
  const boxH = rows * cell + 26;
  const x = packet.x;
  const y = packet.y;
  const birth = packet.birth;
  const pop = 1 + (1 - birth) * 0.35;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop, pop);

  // Phosphor bloom on lift-off.
  if (birth < 1) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (1 - birth) * 0.5;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(0, 0, boxW * (0.6 + birth), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(1,6,4,0.88)";
  ctx.strokeStyle = ink;
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 5);
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.round(cell * 0.72)}px "Courier New", Courier, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = (i / cols) | 0;
    const gx = -((cols - 1) * cell) / 2 + col * cell;
    const gy = -((rows - 1) * cell) / 2 + row * cell - 5;
    ctx.fillText(String(packet.digits[i]), gx, gy);
  }

  ctx.font = `600 ${labelPx}px "Courier New", Courier, monospace`;
  ctx.globalAlpha = 0.75;
  ctx.fillText(label, 0, boxH / 2 - 9);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * A correctly binned packet does not simply vanish: it draws in toward the
 * bin, shrinking and dimming, and leaves a phosphor ring behind on arrival.
 */
function drawAbsorb(ctx: CanvasRenderingContext2D, e: GameEngine): void {
  const a = e.absorb;
  if (!a) return;
  const def = TEMPER_DEFS[a.temper];
  const t = Math.min(1, Math.max(0, a.t));
  const ease = t * t * (3 - 2 * t);
  const x = a.x + (a.tx - a.x) * ease;
  const y = a.y + (a.ty - a.y) * ease;
  const scale = 1 - 0.78 * ease;
  const cell = Math.max(14, e.layout.fontPx * 1.25);
  const cols = Math.ceil(Math.sqrt(a.digits.length));
  const rows = Math.ceil(a.digits.length / cols);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 1 - ease;
  ctx.fillStyle = def.css;
  ctx.font = `700 ${Math.round(cell * 0.72)}px "Courier New", Courier, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < a.digits.length; i++) {
    const col = i % cols;
    const row = (i / cols) | 0;
    ctx.fillText(
      String(a.digits[i]),
      -((cols - 1) * cell) / 2 + col * cell,
      -((rows - 1) * cell) / 2 + row * cell,
    );
  }
  ctx.restore();

  // Arrival ring at the bin.
  if (ease > 0.45) {
    const k = (ease - 0.45) / 0.55;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (1 - k) * 0.55;
    ctx.strokeStyle = def.css;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.tx, a.ty, 6 + k * 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
