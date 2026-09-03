import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getAudio } from "../audio/AudioEngine";
import { haptics } from "../audio/haptics";
import { TEMPER_DEFS } from "../game/constants";
import { GlyphAtlas } from "../game/glyphAtlas";
import {
  ACCESSORIES,
  GENRES,
  MDE_ROWS,
  METER_SEGMENTS,
  MdeSession,
  type Genre,
} from "../game/mde";
import type { RewardDef } from "../game/catalog";

/**
 * The Music Dance Experience.
 *
 * The same matrix, the same digits, the same phosphor — the refinement
 * floor with the lights on. It is not a separate machine: the grid is
 * drawn with the game's own glyph atlas at the game's own cell size, and
 * the clusters move in the temper languages the rest of the game teaches.
 *
 * The sequence is the specification's: choose a genre and an accessory,
 * read one line of instruction, play for forty-five seconds, watch the
 * office scene, take the score card. Nothing in it can be failed, and
 * every screen of it can be left.
 */

const BTN =
  "inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.22em] text-phos-200 crt-text-glow active:bg-phos-600/50";
const PICK =
  "w-full rounded-[3px] border border-phos-600/60 px-4 py-2.5 text-[10px] font-bold tracking-[0.2em] text-phos-300 active:bg-phos-600/30";

type Stage = "genre" | "accessory" | "instruction" | "play" | "film" | "score";

interface Props {
  reward: RewardDef;
  /** Same seed for the same rung, so a replayed session is the same floor. */
  seed: number;
  muted: boolean;
  onDone: () => void;
}

export function MdeStage({ reward, seed, muted, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("genre");
  const [genre, setGenre] = useState<Genre>(GENRES[0]);
  const [accessory, setAccessory] = useState(ACCESSORIES[0].name);
  const [hud, setHud] = useState({
    meter: 0,
    score: 0,
    multiplier: 1,
    merges: 0,
    remaining: 45,
    chain: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<MdeSession | null>(null);
  const atlasRef = useRef(new GlyphAtlas());
  const rafRef = useRef(0);

  // ── the floor ───────────────────────────────────────────────────────

  useLayoutEffect(() => {
    if (stage !== "play") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(120, rect.width);
    const h = Math.max(160, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const session = sessionRef.current ?? new MdeSession(genre, seed, w, h);
    session.resize(w, h);
    sessionRef.current = session;

    const atlas = atlasRef.current;
    atlas.build(Math.max(9, (h / MDE_ROWS) * 0.62), dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let last = performance.now();
    let lastBeat = -1;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { beatFired, beat } = session.step(dt);

      if (beatFired && beat !== lastBeat) {
        lastBeat = beat;
        // One clock: the bed, the pulse and the release window are the
        // same beat, which is what makes the floor feel like it is on the
        // music rather than beside it.
        if (!muted) getAudio().mdeBeat(beat, genre.bpm);
      }

      draw(ctx, session, atlas, w, h);
      const s = session.snapshot();
      setHud({
        meter: s.meter,
        score: s.score,
        multiplier: s.multiplier,
        merges: s.merges,
        remaining: Math.ceil(s.remaining),
        chain: s.chain.length,
      });

      if (s.finished) {
        setStage("film");
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stage, genre, seed, muted]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // The same read-only handle the engine offers, for the same reason: the
  // suite drives the floor through real pointer events and needs to know
  // where the lit groups actually are. Absent from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV && !import.meta.env.VITE_MDR_TEST) return;
    (window as unknown as { __mde?: unknown }).__mde = {
      get session() {
        return sessionRef.current;
      },
      get stage() {
        return stage;
      },
    };
    return () => {
      delete (window as unknown as { __mde?: unknown }).__mde;
    };
  }, [stage]);

  // ── the chain ───────────────────────────────────────────────────────

  const at = (ev: React.PointerEvent) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { x: ev.clientX - r.left, y: ev.clientY - r.top } : { x: 0, y: 0 };
  };

  const onDown = (ev: React.PointerEvent) => {
    const s = sessionRef.current;
    if (!s) return;
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    const p = at(ev);
    s.touch(p.x, p.y);
    if (s.snapshot().chain.length) haptics.tap();
  };

  const onMove = (ev: React.PointerEvent) => {
    const s = sessionRef.current;
    if (!s || s.snapshot().chain.length === 0) return;
    const before = s.snapshot().chain.length;
    const p = at(ev);
    s.touch(p.x, p.y);
    if (s.snapshot().chain.length > before) haptics.tap();
  };

  const onUp = () => {
    const s = sessionRef.current;
    if (!s) return;
    // Length before the release: releasing empties the chain, and the
    // stab is pitched by how long it was.
    const length = s.snapshot().chain.length;
    const result = s.release();
    if (result === "merge") {
      if (!muted) getAudio().mdeMerge(length);
      haptics.success();
    } else if (result === "miss") {
      if (!muted) getAudio().mdeMiss();
      haptics.reject();
    }
  };

  // ── screens ─────────────────────────────────────────────────────────

  if (stage === "genre") {
    return (
      <Frame title="MUSIC DANCE EXPERIENCE" caption="Select a genre. Your selection is recorded.">
        <div className="flex w-full max-w-[260px] flex-col gap-2">
          {GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              className={PICK}
              onClick={() => {
                setGenre(g);
                setStage("accessory");
              }}
            >
              {g.name}
            </button>
          ))}
        </div>
      </Frame>
    );
  }

  if (stage === "accessory") {
    return (
      <Frame title={genre.name} caption="Select one accessory. One is the permitted number.">
        <div className="flex w-full max-w-[260px] flex-col gap-2">
          {ACCESSORIES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={PICK}
              onClick={() => {
                setAccessory(a.name);
                setStage("instruction");
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
      </Frame>
    );
  }

  if (stage === "instruction") {
    return (
      <Frame title={genre.name} caption={`${accessory} ISSUED`}>
        <p className="crt-text-glow max-w-[260px] text-[11px] font-bold leading-relaxed tracking-[0.14em] text-phos-300">
          CONNECT 3+ GLOWING GROUPS OF ONE TEMPER. RELEASE ON THE BEAT. FILL THE
          DANCE METER.
        </p>
        <p className="mt-3 max-w-[260px] text-[9px] leading-relaxed text-phos-600">
          There is no way to fail this. A missed beat costs a multiplier and
          nothing else.
        </p>
        <button type="button" className={`${BTN} mt-5`} onClick={() => setStage("play")}>
          BEGIN
          <ChevronRight size={12} strokeWidth={2.6} />
        </button>
      </Frame>
    );
  }

  if (stage === "play") {
    return (
      <div className="absolute inset-0 z-70 flex flex-col bg-phos-950">
        <div className="flex items-baseline justify-between px-4 pb-1 pt-3 text-[9px] tracking-[0.2em] text-phos-600">
          <span className="crt-text-glow text-phos-400">{genre.name}</span>
          <span className="tabular-nums">{hud.remaining}s</span>
        </div>
        <p className="px-4 pb-2 text-[8px] leading-snug tracking-[0.14em] text-phos-600">
          CONNECT 3+ GLOWING GROUPS OF ONE TEMPER · RELEASE ON THE BEAT
        </p>

        <div ref={wrapRef} className="relative min-h-0 flex-1">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-label="Dance floor"
          />
        </div>

        {/* The Dance Meter: three segments, and a score that only ever
            goes up. Nothing here can empty. */}
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: METER_SEGMENTS }, (_, i) => (
              <div
                key={i}
                className="h-[6px] flex-1 overflow-hidden rounded-sm bg-phos-800"
              >
                <div
                  className="h-full bg-phos-400 transition-[width] duration-300"
                  style={{
                    width: hud.meter > i ? "100%" : "0%",
                    boxShadow: "0 0 8px var(--color-phos-400)",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-baseline justify-between text-[9px] tracking-[0.16em] text-phos-600">
            <span className="tabular-nums text-phos-400">{hud.score}</span>
            <span>
              {hud.chain > 0 ? `CHAIN ${hud.chain}` : `x${hud.multiplier}`}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "film") {
    return (
      <Frame title="THE FLOOR AT ITS PEAK" caption={`${genre.name} · ${accessory}`}>
        <div className="w-full max-w-[240px] overflow-hidden rounded-[3px] border border-phos-600 bg-black">
          <img className="block h-auto w-full" src={reward.poster} alt="The MDR office" />
        </div>
        <button type="button" className={`${BTN} mt-5`} onClick={() => setStage("score")}>
          CONTINUE
          <ChevronRight size={12} strokeWidth={2.6} />
        </button>
      </Frame>
    );
  }

  return (
    <Frame title="MUSIC DANCE EXPERIENCE COMPLETE" caption={`${genre.name} · ${accessory}`}>
      <dl className="w-full max-w-[240px] text-[10px] tracking-[0.14em] text-phos-400">
        {[
          ["SCORE", String(hud.score)],
          ["COMBINATIONS", String(hud.merges)],
          ["DANCE METER", `${hud.meter} / ${METER_SEGMENTS}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-phos-800 py-1.5">
            <dt className="text-phos-600">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-[260px] text-[9px] italic leading-relaxed text-phos-600">
        The music has been logged. Please return to your terminal in a
        celebratory frame of mind.
      </p>
      <button type="button" className={`${BTN} mt-5`} onClick={onDone}>
        ACCEPT INCENTIVE
        <ChevronRight size={12} strokeWidth={2.6} />
      </button>
    </Frame>
  );
}

function Frame({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    // Opaque, unlike a reward card: the dance experience takes the whole
    // terminal, and the completion panel showing through it read as a
    // double exposure.
    <div className="absolute inset-0 z-70 flex flex-col items-center justify-center bg-phos-950 px-7 text-center">
      <p className="text-[9px] tracking-[0.3em] text-phos-600">INCENTIVE</p>
      <h1 className="crt-text-glow mt-2 max-w-[280px] text-[13px] font-bold leading-tight tracking-[0.18em] text-phos-200">
        {title}
      </h1>
      <div className="mt-3 h-px w-24 bg-phos-600" />
      <p className="mb-4 mt-3 max-w-[260px] text-[9px] tracking-[0.16em] text-phos-600">
        {caption}
      </p>
      {children}
    </div>
  );
}

/**
 * One frame of the floor.
 *
 * Idle digits sit dim in the same grid the terminal uses. A lit cluster
 * takes its temper's color *and* its temper's motion — two channels, so
 * a refiner who plays with the color assist off is not suddenly reading
 * hue alone. A chained cluster is ringed, which is a third.
 */
function draw(
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

  // Rings on everything in hand, so the chain reads without color.
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const id of s.chain) {
    const c = session.clusters[id];
    ctx.strokeStyle = "rgba(214,255,236,0.55)";
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
  }
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
