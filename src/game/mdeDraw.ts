/**
 * Painting the dance floor.
 *
 * Lifted out of `MdeStage` so the demonstration that opens the session can
 * draw the *same* floor. A rehearsal painted by a second, similar routine
 * teaches the rehearsal — the whole point of showing a refiner what to do
 * is that the thing shown is the thing they are about to touch.
 */

import { TEMPER_DEFS } from "./constants";
import type { GlyphAtlas } from "./glyphAtlas";
import { MIN_CHAIN, type MdeSession } from "./mde";

/**
 * One frame of the floor.
 *
 * Idle digits sit dim in the same grid the terminal uses. A lit cluster
 * takes its temper's color *and* its temper's motion — two channels, so
 * a refiner who plays with the color assist off is not suddenly reading
 * hue alone. A chained cluster is ringed, which is a third.
 */
export function drawFloor(
  ctx: CanvasRenderingContext2D,
  session: MdeSession,
  atlas: GlyphAtlas,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);
  const s = session.snapshot();
  const chain = new Set(s.chain);
  // A slow breath on the beat, so the whole floor moves as one thing.
  const pulse = 0.5 + 0.5 * Math.cos(s.beatPhase * Math.PI * 2);

  // The shove a merge gives the floor. Small — this is a celebration in a
  // basement, not an earthquake — and it decays inside a third of a
  // second, so the next chain is drawn on a still board.
  ctx.save();
  if (s.shake > 0) {
    const k = s.shake * s.shake * 5;
    ctx.translate(
      (Math.random() * 2 - 1) * k,
      (Math.random() * 2 - 1) * k,
    );
  }

  for (const n of session.nodes) {
    const c = n.cluster >= 0 ? session.clusters[n.cluster] : null;
    const lit = !!c && c.lit && !c.spent;
    const inChain = !!c && chain.has(c.id);
    const key = lit ? c!.temper : "idle";
    const alpha = lit ? 0.65 + 0.35 * pulse : 0.16;
    const scale = lit ? 1 + 0.08 * pulse : 1;
    atlas.draw(
      ctx,
      inChain ? "hot" : key,
      n.digit,
      n.hx + n.dx,
      n.hy + n.dy,
      alpha,
      n.rot,
      scale * (n.scale || 1),
    );
  }

  // The chain, drawn as the thin phosphor trail the reference images show.
  if (s.chain.length > 1) {
    ctx.save();
    ctx.strokeStyle = "rgba(214,255,236,0.75)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(214,255,236,0.9)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    s.chain.forEach((id, i) => {
      const c = session.clusters[id];
      if (i === 0) ctx.moveTo(c.cx, c.cy);
      else ctx.lineTo(c.cx, c.cy);
    });
    ctx.stroke();
    ctx.restore();
  }

  // Where the chain can still go.
  //
  // The instruction says three groups; until a refiner has held three,
  // the floor says which three. Every lit cluster of the chain's own
  // temper gets a dashed ring that breathes on the beat — the same mark
  // the game uses for "this, next", and the answer to a new player
  // looking at twenty glowing clumps and guessing.
  if (s.chain.length > 0 && s.chain.length < MIN_CHAIN) {
    const want = session.clusters[s.chain[0]].temper;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = TEMPER_DEFS[want].css;
    ctx.shadowColor = TEMPER_DEFS[want].css;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.4 + 0.35 * pulse;
    for (const c of session.clusters) {
      if (!c.lit || c.spent || c.temper !== want || chain.has(c.id)) continue;
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, c.radius + 14 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Rings on everything in hand, so the chain reads without color — and
  // the position in the chain written beside each one. A refiner holding
  // two groups can see that they are holding two, on the floor, without
  // looking away from their finger.
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  s.chain.forEach((id, i) => {
    const c = session.clusters[id];
    ctx.strokeStyle = "rgba(214,255,236,0.55)";
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#eafff4";
    ctx.shadowColor = "rgba(214,255,236,0.9)";
    ctx.shadowBlur = 6;
    ctx.fillText(`${i + 1}`, c.cx, c.cy - c.radius - 21);
    ctx.shadowBlur = 0;
  });
  ctx.restore();

  // A chain the phrase ended under, coming apart. The links stay where
  // they were and fall away from each other, so what a refiner sees is
  // the thing they were holding breaking rather than the floor forgetting
  // their finger.
  for (const k of session.snaps) {
    const t = 1 - k.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, k.life) * 0.9;
    ctx.strokeStyle = "rgba(255,90,77,0.95)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(255,90,77,0.8)";
    ctx.shadowBlur = 8;
    ctx.setLineDash([5, 5 + t * 26]);
    ctx.beginPath();
    k.pts.forEach((p, i) => {
      // Each link drifts a little further from the last as it goes.
      const drop = t * 16 * (i % 2 ? 1 : -1);
      if (i === 0) ctx.moveTo(p.x, p.y + drop);
      else ctx.lineTo(p.x, p.y + drop);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of k.pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 + t * 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Blooms: a compact geometric burst, not an explosion. The one drawn
  // over the whole chain is bigger and carries a ring, because it is
  // celebrating the chain rather than one cluster of it.
  for (const b of session.blooms) {
    const big = b.size > 1;
    const reach = big ? 40 + b.size * 26 : 46;
    const r = (1 - b.life) * reach + 6;
    ctx.save();
    ctx.globalAlpha = Math.max(0, b.life);
    ctx.strokeStyle = TEMPER_DEFS[b.temper].css;
    ctx.lineWidth = big ? 3 : 2;
    ctx.shadowColor = TEMPER_DEFS[b.temper].css;
    ctx.shadowBlur = big ? 26 : 14;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = b.x + Math.cos(a) * r;
      const y = b.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    if (big) {
      // A second ring, running ahead of the first, and spokes out of the
      // middle — the difference between "that worked" and "that was good".
      ctx.globalAlpha = Math.max(0, b.life) * 0.55;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * r * 0.5, b.y + Math.sin(a) * r * 0.5);
        ctx.lineTo(b.x + Math.cos(a) * r * 1.25, b.y + Math.sin(a) * r * 1.25);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // The floor lighting up, over everything, unshaken — a flash that moved
  // with the shake would read as a fault in the tube.
  if (s.flash > 0) {
    ctx.save();
    ctx.globalAlpha = s.flash * 0.22;
    ctx.fillStyle = "#d6ffec";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
