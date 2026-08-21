import { TEMPER_DEFS } from "./constants";
import type { GameEngine } from "./engine";
import type { PaletteKey } from "./glyphAtlas";
import type { Temper } from "./types";

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

    if (n.flash > 0.02) {
      ctx.globalCompositeOperation = "lighter";
      atlas.draw(ctx, "hot", n.digit, x, y, n.flash * 0.9, n.rot, n.scale * 1.1);
      ctx.globalCompositeOperation = "source-over";
    }
  }
  ctx.globalAlpha = 1;

  if (e.marquee.active) drawMarquee(ctx, e);
  if (e.reticle.active && !e.packet) drawReticle(ctx, e);
}

function drawReticle(ctx: CanvasRenderingContext2D, e: GameEngine): void {
  const { x, y } = e.reticle;
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

  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // Outer probe ring, breathing with proximity.
  ctx.globalAlpha = 0.35 + 0.5 * hotValue;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 26 + hotValue * 6 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // Signal-strength arc.
  if (hotValue > 0.03) {
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x, y, 33, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hotValue);
    ctx.stroke();
  }

  // Crosshair.
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMarquee(ctx: CanvasRenderingContext2D, e: GameEngine): void {
  const r = e.marqueeRect();
  ctx.save();
  ctx.fillStyle = "rgba(47,214,138,0.09)";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = "#2fd68a";
  ctx.shadowColor = "#2fd68a";
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -(e.elapsed * 22) % 11;
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
  ctx.shadowColor = ink;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 1.5;
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 5);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

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
  ctx.shadowColor = def.css;
  ctx.shadowBlur = 14;
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
