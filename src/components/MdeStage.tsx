import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getAudio } from "../audio/AudioEngine";
import { haptics } from "../audio/haptics";
import { GlyphAtlas } from "../game/glyphAtlas";
import {
  ACCESSORIES,
  GENRES,
  MDE_ROWS,
  METER_SEGMENTS,
  MdeSession,
  type Genre,
} from "../game/mde";
import { drawFloor } from "../game/mdeDraw";
import { MdeDemo } from "./MdeDemo";
import { ChainPips, DanceMeter } from "./MdeHud";
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

      drawFloor(ctx, session, atlas, w, h);
      const s = session.snapshot();
      setHud({
        meter: s.meter,
        score: s.score,
        multiplier: s.multiplier,
        merges: s.merges,
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

  // The demonstration. Same floor, same painter, same HUD — a refiner
  // watches the move being made on the screen they are about to be handed,
  // and then makes it. A sentence on a title card was what this had
  // before, and a sentence is not a demonstration.
  if (stage === "instruction") {
    return (
      <div className="absolute inset-0 z-70 flex flex-col bg-phos-950">
        <div className="flex items-baseline justify-between px-4 pb-2 pt-3 text-[9px] tracking-[0.2em] text-phos-600">
          <span className="crt-text-glow text-phos-400">{genre.name}</span>
          <span>{accessory} ISSUED</span>
        </div>
        <MdeDemo genre={genre} seed={seed ^ 0x5f5e} />
        <div className="px-4 pb-5 pt-3 text-center">
          <p className="mx-auto max-w-[280px] text-[9px] leading-relaxed text-phos-600">
            Three groups of the same color, released on the beat, fill one
            segment. There is no way to fail this and no clock to run out.
          </p>
          {/* The one control on the screen, and the screen says so. The
              floor above it is running on its own, which is exactly the
              thing that could be mistaken for a turn already in progress. */}
          <button
            type="button"
            className={`${BTN} mt-4 px-8 py-3`}
            style={{ animation: "crt-throb 1.9s ease-in-out infinite" }}
            onClick={() => setStage("play")}
          >
            BEGIN
            <ChevronRight size={12} strokeWidth={2.6} />
          </button>
          <p className="mt-2 text-[8px] tracking-[0.2em] text-phos-700">
            TAP BEGIN TO TAKE THE FLOOR
          </p>
        </div>
      </div>
    );
  }

  if (stage === "play") {
    return (
      <div className="absolute inset-0 z-70 flex flex-col bg-phos-950">
        <div className="flex items-baseline justify-between px-4 pb-1 pt-3 text-[9px] tracking-[0.2em] text-phos-600">
          <span className="crt-text-glow text-phos-400">{genre.name}</span>
          {/* The accessory, not a countdown. This corner used to hold a
              clock, and that clock used to end the session mid-dance —
              with the Dance Meter at four of eight. Nothing runs out here
              any more, and the meter along the bottom is the only number
              worth watching. */}
          <span>{accessory}</span>
        </div>
        <ChainPips chain={hud.chain} />

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

        {/* The Dance Meter, filling. It is the only thing that ends a
            session, so it is the only thing that counts. */}
        <DanceMeter
          meter={hud.meter}
          right={
            <span className="tabular-nums">
              {hud.score} · x{hud.multiplier}
            </span>
          }
        />
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

