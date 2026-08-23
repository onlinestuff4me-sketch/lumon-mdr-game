import { LEVELS, TEMPER_DEFS } from "./constants";
import type { GameEngine } from "./engine";
import type { PaletteKey } from "./glyphAtlas";
import type { GridNode, Packet, Temper } from "./types";

/** Scratch list of flashing nodes, reused so the render pass allocates
 *  nothing. Malice flashes a whole cluster at once, and toggling
 *  globalCompositeOperation per glyph can force a layer flush each time. */
const flashing: GridNode[] = [];

/** Agitation above which a glyph starts burning through additively. Below
 *  this an anomaly is still something you have to look for, which is the
 *  game; above it, you have found it and it should be unmistakable. */
const CORE_AT = 0.5;

/** Digits sitting on the scan edge, lit additively. Scratch, reused. */
const edging: GridNode[] = [];
const edgingA: number[] = [];

/**
 * The file-change transition, as a CRT does it.
 *
 * One scan pass travels down the board: ahead of it the old picture is
 * still there, behind it the picture is gone — and then, on the new file,
 * the same pass paints the digits back on. The glyphs on the edge itself
 * bloom as they are written, which is the phosphor being struck.
 *
 * Deliberately alpha only. Squashing or rolling the picture would move the
 * digits away from where the engine hit-tests them, and a transition that
 * makes the board briefly un-tappable is the exact bug this game has spent
 * two rounds getting rid of. Input stays live the whole way through, and
 * every digit stays exactly where it is drawn.
 */
function scanEdge(e: GameEngine): number {
  // Overshoot both ends so the pass clears the board completely rather
  // than stopping on the last row of digits.
  return (e.wipe as { t: number }).t * 1.2 - 0.1;
}

/** How lit a digit at `y` is, given where the scan pass has reached. */
function scanAlpha(e: GameEngine, y: number, edge: number): number {
  const g = e.layout.grid;
  const p = (y - g.y) / (g.h || 1);
  // A short ramp rather than a hard line: a CRT's beam has width, and a
  // hard cut reads as a mask sliding over the picture instead.
  const d = (p - edge) * 7;
  const lit = e.wipe?.phase === "out" ? d : -d;
  return lit <= 0 ? 0 : lit >= 1 ? 1 : lit;
}

/** How close a digit at `y` is to the beam, 0..1 — its bloom. */
function scanGlow(e: GameEngine, y: number, edge: number): number {
  const g = e.layout.grid;
  const p = (y - g.y) / (g.h || 1);
  const d = (p - edge) * 9;
  const k = 1 - d * d;
  return k <= 0 ? 0 : k;
}

/** The beam itself: a hard line with a soft trail behind it. */
function drawScanBeam(ctx: CanvasRenderingContext2D, e: GameEngine, edge: number): void {
  const g = e.layout.grid;
  const y = g.y + edge * g.h;
  if (y < g.y - 40 || y > g.y + g.h + 40) return;
  const back = e.wipe?.phase === "out" ? 1 : -1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Three stacked bands instead of a gradient: a gradient object per frame
  // is an allocation in the render path, and at this size nobody can tell.
  const bands: [number, number][] = [[2, 0.5], [10, 0.16], [30, 0.06]];
  for (const [hgt, alpha] of bands) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#8ff3c4";
    ctx.fillRect(g.x, y - (back > 0 ? 0 : hgt), g.w, hgt);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

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
  const wiping = e.wipe !== null;
  const edge = wiping ? scanEdge(e) : 0;
  for (const n of e.board.nodes) {
    if (n.retired || n.lifted) continue;
    const x = n.hx + n.dx;
    const y = n.hy + n.dy;
    if (y < grid.y - 24 || y > grid.y + grid.h + 24) continue;

    // Where the scan pass has got to decides whether this digit is on the
    // screen at all yet, and how hard the beam is striking it.
    let wa = 1;
    if (wiping) {
      wa = scanAlpha(e, y, edge);
      const glow = scanGlow(e, y, edge);
      if (glow > 0.02) {
        edging.push(n);
        edgingA.push(glow);
      }
      if (wa <= 0.004) continue;
    }

    const a = n.agitation;
    if (a <= 0.04 && n.flash <= 0.02) {
      atlas.draw(ctx, "idle", n.digit, x, y, 0.82 * wa, n.rot, n.scale);
      continue;
    }

    const temper = e.board.clusters[n.cluster]?.temper;
    const key: PaletteKey = e.assist && temper ? temper : "stir";

    // An anomaly should not read as "a brighter digit". Three things make
    // it read as a digit that has come loose from the sheet instead:
    //
    // The after-image. A faint copy stays behind in the cell the digit
    // belongs to, so the eye sees the vacancy and the displacement at once.
    // Only drawn once the glyph has actually left its cell, so a calm board
    // never doubles up.
    if (n.dx * n.dx + n.dy * n.dy > 0.4) {
      atlas.draw(ctx, "idle", n.digit, n.hx, n.hy, 0.3 * a * wa, 0, n.scale * 0.94);
    }

    // The swell. Size is the strongest pre-attentive cue after motion, and
    // it survives a small phone screen and a thumb better than brightness.
    const swell = n.scale * (1 + 0.26 * a);

    // Cross-fade phosphor green into the temper's colour as it agitates.
    // Both alphas are driven by `a` alone so a barely-stirred cluster reads
    // as green, not as a permanently tinted giveaway.
    atlas.draw(ctx, "idle", n.digit, x, y, 0.82 * (1 - a) * wa, n.rot, swell);
    atlas.draw(ctx, key, n.digit, x, y, Math.min(1, a * 1.15) * wa, n.rot, swell);

    // The core. Above half agitation the glyph starts burning through, the
    // same additive pass the malice flash uses — batched with it so the
    // whole board still costs one composite-mode switch.
    if (n.flash > 0.02 || a > CORE_AT) flashing.push(n);
  }

  // One composite-mode switch for every flash and every burning core.
  if (flashing.length > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (const n of flashing) {
      const core = n.agitation > CORE_AT
        ? ((n.agitation - CORE_AT) / (1 - CORE_AT)) * 0.55
        : 0;
      atlas.draw(
        ctx,
        "hot",
        n.digit,
        n.hx + n.dx,
        n.hy + n.dy,
        Math.min(1, n.flash * 0.9 + core),
        n.rot,
        n.scale * (1.1 + 0.2 * n.agitation),
      );
    }
    ctx.globalCompositeOperation = "source-over";
    flashing.length = 0;
  }

  // Digits the beam is passing over, struck bright as they are written.
  if (edging.length > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < edging.length; i++) {
      const n = edging[i];
      atlas.draw(
        ctx,
        "hot",
        n.digit,
        n.hx + n.dx,
        n.hy + n.dy,
        edgingA[i] * 0.7,
        n.rot,
        n.scale * 1.06,
      );
    }
    ctx.globalCompositeOperation = "source-over";
    edging.length = 0;
    edgingA.length = 0;
  }
  ctx.globalAlpha = 1;

  if (wiping) drawScanBeam(ctx, e, edge);

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

  drawBinHint(ctx, e, packet);

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
  // Sized by the engine, which also hit-tests it: what the refiner can
  // grab has to be exactly what they can see.
  const { w: boxW, h: boxH } = e.packetBounds(packet);
  const x = packet.x;
  const y = packet.y;
  const birth = packet.birth;

  // The box does not appear around digits that were never seen to move
  // into it. Each digit flies from the cell it occupied on the grid to its
  // slot, the frame draws itself closed behind them, and the whole thing
  // reads as the group being collected rather than swapped out for a card.
  const fT = clamp01((birth - FRAME_START) / (1 - FRAME_START));
  const frameIn = easeOutBack(fT);
  const frameScale = 0.72 + 0.28 * frameIn;

  ctx.save();
  ctx.translate(x, y);

  // A ring closing from the group's own footprint down onto the box: the
  // outline of the thing being gathered, tightening as it gathers.
  if (birth < 0.85 && packet.origins.length > 0) {
    let far = 0;
    for (const o of packet.origins) far = Math.max(far, Math.hypot(o.x, o.y));
    const k = smoothstep(clamp01(birth / 0.85));
    const r = (far + 14) * (1 - k) + Math.max(boxW, boxH) * 0.55 * k;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (1 - k) * 0.4;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  // ── the frame, scaled about the packet centre ─────────────────────
  ctx.save();
  ctx.scale(frameScale, frameScale);

  // Phosphor bloom, brightest at the instant the frame snaps shut.
  if (fT < 1) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.sin(Math.PI * fT) * 0.38;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(0, 0, boxW * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.fillStyle = "rgba(1,6,4,0.88)";
  ctx.strokeStyle = ink;
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 5);
  ctx.globalAlpha = 0.9 * fT;
  ctx.fill();
  ctx.globalAlpha = 0.3 * fT;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.globalAlpha = 0.95 * fT;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${labelPx}px "Courier New", Courier, monospace`;
  ctx.globalAlpha = 0.75 * fT;
  ctx.fillText(label, 0, boxH / 2 - 9);
  ctx.restore();

  // ── the digits, flying in at full size ────────────────────────────
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.round(cell * 0.72)}px "Courier New", Courier, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const spread = n > 1 ? STAGGER / (n - 1) : 0;
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = (i / cols) | 0;
    const gx = -((cols - 1) * cell) / 2 + col * cell;
    const gy = -((rows - 1) * cell) / 2 + row * cell - 5;
    const glyph = String(packet.digits[i]);

    const from = packet.origins[i];
    if (!from || birth >= 1) {
      ctx.globalAlpha = 1;
      ctx.fillText(glyph, gx, gy);
      continue;
    }

    // Digits leave in the order they were collected, a few hundredths of a
    // second apart, so the group arrives as a stream rather than a jump.
    const begin = i * spread;
    const t = smoothstep(clamp01((birth - begin) / (GATHER_END - begin)));
    ctx.globalAlpha = 1;
    ctx.fillText(glyph, from.x + (gx - from.x) * t, from.y + (gy - from.y) * t);
    // A dimming after-image left in the cell it came from, so the eye can
    // see where each digit was taken from.
    if (t < 1) {
      ctx.globalAlpha = (1 - t) * 0.3;
      ctx.fillText(glyph, from.x, from.y);
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Birth progress at which the frame begins drawing itself. */
const FRAME_START = 0.26;
/** Birth progress by which the first digit has landed. */
const GATHER_END = 0.78;
/** How far apart, in birth progress, consecutive digits set off. */
const STAGGER = 0.16;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Ease-out with a small overshoot — the frame snaps shut rather than
 *  easing politely into place. */
function easeOutBack(t: number): number {
  const c = 1.9;
  const p = t - 1;
  return 1 + p * p * ((c + 1) * p + c);
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

/**
 * Faint chevrons running from a held packet down to the bin.
 *
 * It is only ever enabled on files with a *single* bin, so it points at the
 * one place a packet can go and gives nothing away. It appears with the
 * packet: waiting for the player to hesitate meant the arrows arrived after
 * the moment they were needed, which is when the box first shows up and the
 * question "where does this go?" is actually being asked.
 */
const HINT_DELAY_S = 0;

function drawBinHint(
  ctx: CanvasRenderingContext2D,
  e: GameEngine,
  packet: Packet,
): void {
  const level = LEVELS[e.levelIndex];
  if (!level.binHint) return;
  const held = e.elapsed - e.packetHeldAt;
  if (held < HINT_DELAY_S) return;

  const rect = e.layout.binRects[packet.temper];
  if (!rect || rect.w <= 0) return;
  const tx = rect.x + rect.w / 2;
  const ty = rect.y + rect.h / 2;
  const dx = tx - packet.x;
  const dy = ty - packet.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 60) return;                       // already there

  const ux = dx / dist;
  const uy = dy / dist;
  const start = 46;                            // clear of the packet frame
  const span = dist - start - 18;
  if (span <= 0) return;

  // Fade in over half a second, and pulse gently so it reads as an
  // instruction rather than as part of the chrome.
  const fade = Math.min(1, (held - HINT_DELAY_S) / 0.5);
  const t = e.elapsed;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#8ff3c4";
  const COUNT = 3;
  for (let i = 0; i < COUNT; i++) {
    // Each chevron slides along the path and wraps, so the row reads as
    // motion towards the bin rather than as three static marks.
    const p = ((t * 0.55 + i / COUNT) % 1);
    const d = start + p * span;
    const cx = packet.x + ux * d;
    const cy = packet.y + uy * d;
    // Brightest in the middle of its travel; nothing pops in or out.
    // Measured against a real board: at 0.5 peak alpha these vanished into
    // the digit field they have to be read over.
    ctx.globalAlpha = fade * 0.8 * Math.sin(Math.PI * p);
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(143,243,196,0.9)";
    ctx.shadowBlur = 8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(2, 0);
    ctx.lineTo(-9, 9);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
