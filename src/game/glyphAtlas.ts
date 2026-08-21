import { IDLE_RGB, TEMPER_DEFS } from "./constants";
import type { Temper } from "./types";

export type PaletteKey = Temper | "idle" | "stir" | "hot";

const PALETTES: Record<PaletteKey, readonly [number, number, number]> = {
  idle: IDLE_RGB,
  // Neutral "something is happening here" phosphor. Deliberately not any
  // temper's hue: the refiner reads the *motion*, not a colour key.
  stir: [214, 255, 236],
  WO: TEMPER_DEFS.WO.rgb,
  FC: TEMPER_DEFS.FC.rgb,
  DR: TEMPER_DEFS.DR.rgb,
  MA: TEMPER_DEFS.MA.rgb,
  hot: [235, 255, 244],
};

/**
 * Pre-rasterised digit glyphs, one strip per palette.
 *
 * Rendering 448 `fillText` calls per frame with a live `shadowBlur` is the
 * single most expensive thing this game could do on a phone. Instead the
 * phosphor bloom is baked once into an offscreen strip and every frame is
 * pure `drawImage`.
 */
export class GlyphAtlas {
  private strips = new Map<PaletteKey, HTMLCanvasElement>();
  /** Glyph cell size in CSS px. */
  cellW = 0;
  cellH = 0;
  private dpr = 1;
  private fontPx = 0;

  build(fontPx: number, dpr: number): void {
    if (this.fontPx === fontPx && this.dpr === dpr && this.strips.size) return;
    this.fontPx = fontPx;
    this.dpr = dpr;
    this.cellW = Math.ceil(fontPx * 1.8);
    this.cellH = Math.ceil(fontPx * 2.0);
    this.strips.clear();

    for (const key of Object.keys(PALETTES) as PaletteKey[]) {
      this.strips.set(key, this.renderStrip(PALETTES[key]));
    }
  }

  private renderStrip(rgb: readonly [number, number, number]): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = Math.ceil(this.cellW * 10 * this.dpr);
    c.height = Math.ceil(this.cellH * this.dpr);
    const g = c.getContext("2d");
    if (!g) return c;
    g.scale(this.dpr, this.dpr);
    g.font = `700 ${this.fontPx}px "Courier New", Courier, monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const solid = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

    for (let d = 0; d < 10; d++) {
      const cx = this.cellW * d + this.cellW / 2;
      const cy = this.cellH / 2;
      // Two baked passes: a wide halo, then the crisp phosphor dot.
      g.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.85)`;
      g.shadowBlur = this.fontPx * 0.75;
      g.fillStyle = solid;
      g.fillText(String(d), cx, cy);
      g.shadowBlur = this.fontPx * 0.28;
      g.fillText(String(d), cx, cy);
      g.shadowBlur = 0;
      g.fillStyle = `rgb(${Math.min(255, rgb[0] + 70)},${Math.min(
        255,
        rgb[1] + 70,
      )},${Math.min(255, rgb[2] + 70)})`;
      g.fillText(String(d), cx, cy);
    }
    return c;
  }

  /** Blit one glyph centred on (x, y) in CSS px. */
  draw(
    ctx: CanvasRenderingContext2D,
    key: PaletteKey,
    digit: number,
    x: number,
    y: number,
    alpha: number,
    rot = 0,
    scale = 1,
  ): void {
    const strip = this.strips.get(key);
    if (!strip || alpha <= 0.004) return;
    const sw = this.cellW * this.dpr;
    const sh = this.cellH * this.dpr;
    const sx = digit * sw;
    const dw = this.cellW * scale;
    const dh = this.cellH * scale;

    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    if (rot === 0 && scale === 1) {
      ctx.drawImage(strip, sx, 0, sw, sh, x - dw / 2, y - dh / 2, dw, dh);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    if (rot !== 0) ctx.rotate(rot);
    ctx.drawImage(strip, sx, 0, sw, sh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
}
