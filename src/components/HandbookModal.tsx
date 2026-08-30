import { Vibrate, Volume2, X } from "lucide-react";
import type { ReactNode } from "react";
import { TemperSample } from "./TemperSample";
import type { Pace } from "../game/constants";
import { LEVELS, PACE } from "../game/constants";
import { useEffect, useRef, useState } from "react";
import { MIN_CAPTURE, PROBE_RADIUS, TEMPERS, TEMPER_DEFS } from "../game/constants";
import type { Progress } from "../game/progress";
import type { RewardId } from "../game/rewards";
import { IncentiveForecast } from "./IncentiveForecast";
import { IncentiveShelf, WellnessRecord } from "./IncentiveShelf";

/**
 * The handbook is long — five sections and a full incentive record — and
 * it opens scrolled to whichever one the refiner asked for. Without a way
 * across it, every other section is a blind scroll away.
 */
const SECTIONS = [
  { id: "refine", label: "REFINE" },
  { id: "tempers", label: "TEMPERS" },
  { id: "incentives", label: "INCENTIVES" },
  { id: "archive", label: "ARCHIVE" },
  { id: "settings", label: "SETTINGS" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** Height of the pinned header and tab row, which anchors have to clear. */
const NAV_H = 88;

interface Props {
  onClose: () => void;
  assist: boolean;
  /** The incentive ledger: the forecast, the shelf and the Wellness record. */
  progress: Progress;
  onInspect: (rewardId: RewardId) => void;
  /**
   * Where to land. The record block on the file screen opens this drawer
   * *at the shelf* — a refiner who tapped the thing their incentive was
   * filed into should arrive at their incentives, not at Section IV.
   */
  startAt?: "top" | "shelf" | "settings";
  onAssist: (on: boolean) => void;
  muted: boolean;
  onMuted: (on: boolean) => void;
  hapticsOn: boolean;
  onHaptics: (on: boolean) => void;
  hapticsSupported: boolean;
  pace: Pace;
  onPace: (pace: Pace) => void;
  /** Ids of files completed on this device, ever. */
  archive: ReadonlySet<string>;
  levelIndex: number;
}

function Toggle({
  on,
  onChange,
  label,
  hint,
  icon,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
  icon?: ReactNode;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-1.5">
      <span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] text-phos-300">
          {icon}
          {label}
        </span>
        <span className="mt-0.5 block text-[9px] leading-snug text-phos-600">
          {hint}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          on ? "border-phos-400 bg-phos-600" : "border-phos-700 bg-phos-950"
        }`}
      >
        <span
          className={`block h-3.5 w-3.5 rounded-full bg-phos-200 transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </label>
  );
}

export function HandbookModal({
  onClose,
  assist,
  progress,
  onInspect,
  startAt = "top",
  onAssist,
  muted,
  onMuted,
  hapticsOn,
  onHaptics,
  hapticsSupported,
  pace,
  onPace,
  archive,
  levelIndex,
}: Props) {
  const scroller = useRef<HTMLDivElement | null>(null);
  /**
   * Which tab is lit. Seeded from wherever the drawer was asked to open
   * and followed from the scroll thereafter, never set by the tap.
   */
  const [at, setAt] = useState<SectionId>(
    startAt === "shelf"
      ? "incentives"
      : startAt === "settings"
        ? "settings"
        : "refine",
  );

  const go = (id: SectionId) => {
    scroller.current
      ?.querySelector(`[data-section="${id}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // One scroll, on open. The drawer is unmounted between openings, so
  // there is no stale position to correct later.
  //
  // The settings live at the foot of the handbook rather than in a sheet
  // of their own, and the gear in the header scrolls to them. One place
  // for the toggles beats two that can disagree, and a refiner who taps
  // the gear lands on them either way.
  useEffect(() => {
    const id =
      startAt === "shelf" ? "incentives" : startAt === "settings" ? "settings" : null;
    if (!id) return;
    scroller.current
      ?.querySelector(`[data-section="${id}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [startAt]);

  /**
   * Which section the refiner is looking at.
   *
   * Read off the scroll position rather than tracked by the taps, so the
   * row stays honest when they scroll by hand — a nav that only updates
   * when you use it is a nav you stop trusting.
   */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const top = el.getBoundingClientRect().top + NAV_H;
      let seen: SectionId = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const node = el.querySelector(`[data-section="${s.id}"]`);
        if (!node) continue;
        if (node.getBoundingClientRect().top - 8 <= top) seen = s.id;
      }
      setAt(seen);
    };
    // A frame later, so the open-at scroll above has landed and this reads
    // where the drawer actually is rather than where it started.
    const id = requestAnimationFrame(onScroll);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // The orientation screens are one sequence, not 21 files: only the last
  // of them carries an archive row, so the list stays a set of secrets
  // rather than a progress bar.
  const files = LEVELS.filter((l) => l.archived !== false);
  const recovered = files.filter((l) => archive.has(l.id)).length;
  // A screen inside a sequence belongs to the row that closes it, so
  // playing orientation screen 5 marks the ORIENTATION row IN PROGRESS
  // rather than marking nothing at all.
  const currentRow =
    LEVELS.slice(levelIndex).find((l) => l.archived !== false)?.id ?? null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lumon employee handbook"
      className="absolute inset-0 z-80 flex flex-col justify-end bg-black/70 backdrop-blur-[1px]"
      onPointerDown={(ev) => {
        ev.stopPropagation();
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        ref={scroller}
        style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
        // Nearly the full screen. At 82% a third of the page was scrim
        // above a drawer whose own content ran off the bottom, which is
        // dead space paid for twice. The strip that is left is what makes
        // it read as a drawer, and tapping it still closes.
        className="h-[94%] overflow-y-auto rounded-t-[6px] border-t-2 border-phos-500 bg-phos-950/97 px-4 pb-5 shadow-[0_-8px_40px_rgba(23,168,102,0.25)]"
      >
        {/* Pinned, because the drawer opens scrolled: VIEW ALL INCENTIVES
            lands the refiner on the shelf, three screens down, with the
            only way out somewhere above them. A way back has to be on the
            screen it is needed on. */}
        <div className="sticky top-0 z-10 -mx-4 flex items-start justify-between gap-3 bg-phos-950 px-4 pb-2.5 pt-3">
          <div>
            <h2 className="crt-text-glow text-[13px] font-bold tracking-[0.2em] text-phos-200">
              MACRODATA REFINEMENT
            </h2>
            <p className="text-[9px] tracking-[0.16em] text-phos-600">
              EMPLOYEE HANDBOOK · SECTION IV
            </p>
          </div>
          <button
            type="button"
            aria-label="Close handbook"
            data-close-handbook
            onClick={onClose}
            className="crt-text-glow inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-phos-500 bg-phos-900/60 px-2 py-1.5 text-[9px] font-bold tracking-[0.2em] text-phos-200 active:bg-phos-600/40"
          >
            <X size={12} strokeWidth={2.6} />
            CLOSE
          </button>
        </div>

        {/* Pinned directly under the header, so every section of a long
            document is one tap away from every other. Lit from the scroll
            position rather than from the tap: a nav that only updates when
            you use it is a nav you stop trusting. */}
        <div
          className="sticky top-[52px] z-10 -mx-4 mb-3 flex gap-1 overflow-x-auto border-b border-phos-800 bg-phos-950 px-4 pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              data-section-tab={sec.id}
              aria-current={at === sec.id ? "true" : undefined}
              onClick={() => go(sec.id)}
              className={`shrink-0 rounded-[3px] border px-2 py-1 text-[8px] font-bold tracking-[0.18em] transition-colors ${
                at === sec.id
                  ? "crt-text-glow border-phos-400 bg-phos-600/30 text-phos-200"
                  : "border-phos-800 text-phos-500"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-[10px] leading-relaxed text-phos-400">
          The numbers on your screen are frightening, and you are the only one
          who can feel it. Probe the file, find the clusters that stir, and
          consign each to the temper it evokes. Please enjoy each number
          equally.
        </p>

        <h3
          data-section="refine"
          className="crt-text-glow mb-2 scroll-mt-[88px] text-[10px] font-bold tracking-[0.2em] text-phos-300"
        >
          HOW TO REFINE MACRODATA
        </h3>
        <p className="mb-3 text-[10px] leading-relaxed text-phos-400">
          You begin on <span className="text-phos-200">ORIENTATION</span>:
          one group, already moving, on a screen of digits that only look
          like it. Press it and drag it to the bin. Later screens put two
          groups up, then two tempers, then all four.{" "}
          <span className="text-phos-200">BELLINGHAM</span> takes the
          visibility away — the group surfaces and sinks, and your first
          touch summons the lens instead of the box.{" "}
          <span className="text-phos-200">CALIBRATION</span> then names each
          temper as you feel it, and the shift starts.
        </p>

        <ol className="mb-4 space-y-1.5 text-[10px] leading-relaxed text-phos-400">
          <li>
            <span className="text-phos-300">01 · PROBE.</span> Hold a finger to
            the matrix. The reticle floats above your fingertip. Within{" "}
            {PROBE_RADIUS}px of a cluster the digits begin to move, sound, and
            buzz.
          </li>
          <li>
            <span className="text-phos-300">02 · SELECT.</span> Double-tap the
            screen, or use the SELECT switch, then drag a box around the
            agitated digits. {MIN_CAPTURE} or more lifts the cluster into a data
            packet.
          </li>
          <li>
            <span className="text-phos-300">03 · REFINE.</span> Drag the packet
            into the matching temper bin. A correct assignment fills that bin.
            A mistake scatters the data back to the grid.
          </li>
        </ol>

        <h3
          data-section="tempers"
          className="crt-text-glow mb-2 scroll-mt-[88px] text-[10px] font-bold tracking-[0.2em] text-phos-300"
        >
          THE FOUR TEMPERS
        </h3>
        <ul className="space-y-2">
          {TEMPERS.map((t) => {
            const def = TEMPER_DEFS[t];
            return (
              <li
                className="flex items-center gap-2.5 rounded-[3px] border-l-2 bg-phos-900/50 py-1.5 pl-2.5 pr-2"
                key={t}
                style={{ borderColor: def.css }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[10px] font-bold tracking-[0.18em]"
                    style={{ color: def.css }}
                  >
                    {def.code} · {def.name} ({t})
                  </div>
                  <div className="text-[9px] leading-snug text-phos-400">
                    {def.blurb}
                  </div>
                  <div className="text-[9px] italic leading-snug text-phos-600">
                    {def.signature}
                  </div>
                </div>
                <TemperSample temper={t} />
              </li>
            );
          })}
        </ul>

        {/* The forecast is reachable mid-file from here — the clock is
            paused while the drawer is open, so checking how far the next
            incentive is costs nothing but the reading. */}
        <div data-section="incentives" className="scroll-mt-[88px]" />
        {progress.filesCompleted > 0 ? (
          <>
            <h3 className="crt-text-glow mb-1 mt-4 text-[10px] font-bold tracking-[0.2em] text-phos-300">
              INCENTIVE FORECAST
            </h3>
            <p className="mb-2 text-[9px] leading-snug text-phos-600">
              Incentives are awarded on schedule. The schedule is not yours
              to know beyond its next entry.
            </p>
            <IncentiveForecast progress={progress} />
            <p className="mt-2 text-[9px] leading-snug text-phos-600">
              {progress.binsTotal} groups refined ·{" "}
              {progress.perfectScreensTotal} screens without error
              {progress.perfectScreenStreak > 1
                ? ` · ${progress.perfectScreenStreak} in a row`
                : ""}
            </p>
          </>
        ) : null}

        <IncentiveShelf progress={progress} onInspect={onInspect} />
        <WellnessRecord progress={progress} />

        <h3
          data-section="archive"
          className="crt-text-glow mb-1 mt-4 scroll-mt-[88px] text-[10px] font-bold tracking-[0.2em] text-phos-300"
        >
          PERPETUITY WING · ARCHIVE
        </h3>
        <p className="mb-2 text-[9px] leading-snug text-phos-600">
          One addendum is declassified per refined file. {recovered} of{" "}
          {files.length} recovered. The remainder are not yours yet.
        </p>
        <ol className="space-y-1">
          {files.map((level) => {
            const open = archive.has(level.id);
            const current = level.id === currentRow && !open;
            return (
              <li
                key={level.id}
                className={`rounded-[3px] border-l-2 py-1.5 pl-2.5 pr-2 ${
                  open
                    ? "border-phos-400 bg-phos-900/50"
                    : current
                      ? "border-phos-600 bg-phos-900/30"
                      : "border-phos-800 bg-phos-950/60"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-[9px] font-bold tracking-[0.18em] ${
                      open ? "text-phos-300" : "text-phos-700"
                    }`}
                  >
                    {open || current ? (
                      <>
                        {level.fileCode} · {level.name}
                      </>
                    ) : (
                      <>████ · {redact(level.name)}</>
                    )}
                  </span>
                  <span className="shrink-0 text-[8px] tracking-[0.16em] text-phos-700">
                    {open ? "DECLASSIFIED" : current ? "IN PROGRESS" : "SEALED"}
                  </span>
                </div>
                <p
                  className={`mt-0.5 text-[9px] leading-snug ${
                    open ? "italic text-phos-400" : "text-phos-800"
                  }`}
                >
                  {open ? level.lore : redact(level.lore, 11)}
                </p>
              </li>
            );
          })}
        </ol>

        <h3
          data-section="settings"
          className="crt-text-glow mb-2 mt-4 scroll-mt-[88px] text-[10px] font-bold tracking-[0.2em] text-phos-300"
        >
          TERMINAL SETTINGS
        </h3>
        <div className="mb-2 rounded-[3px] border border-phos-700 bg-phos-900/40 px-2.5 py-2">
          <div className="text-[10px] font-bold tracking-[0.16em] text-phos-300">
            SHIFT LENGTH
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {(Object.keys(PACE) as Pace[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={pace === key}
                onClick={() => onPace(key)}
                className={`flex-1 rounded-[3px] border px-2 py-1.5 text-[9px] font-bold tracking-[0.14em] transition-colors ${
                  pace === key
                    ? "crt-text-glow border-phos-400 bg-phos-600/40 text-phos-200"
                    : "border-phos-700 text-phos-500"
                }`}
              >
                {PACE[key].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] leading-snug text-phos-600">
            {PACE[pace].hint} Applies from the next file. Every correct
            assignment also credits {5} seconds back to the clock.
          </p>
        </div>

        <div className="divide-y divide-phos-800 rounded-[3px] border border-phos-700 bg-phos-900/40 px-2.5 py-1">
          <Toggle
            on={!muted}
            onChange={(on) => onMuted(!on)}
            label="TERMINAL AUDIO"
            hint="The temper voices. Strongly advised: the sound is half the tell."
            icon={<Volume2 size={11} aria-hidden />}
          />
          {hapticsSupported ? (
            <Toggle
              on={hapticsOn}
              onChange={onHaptics}
              label="HAPTIC FEEDBACK"
              hint="Each temper buzzes to its own cadence."
              icon={<Vibrate size={11} aria-hidden />}
            />
          ) : null}
          <Toggle
            on={assist}
            onChange={onAssist}
            label="COLOR ASSIST"
            hint="Tint agitated clusters with their temper's color. Kier considers this a crutch."
          />
        </div>

        <p className="mt-4 text-center text-[8px] tracking-[0.22em] text-phos-700">
          THE WORK IS MYSTERIOUS AND IMPORTANT
        </p>
      </div>
    </div>
  );
}

/**
 * Censors a line the way Lumon would: word shapes survive, words do not.
 * A row of identical bars would read as a placeholder; preserving the
 * lengths makes a sealed addendum look like a document that exists and is
 * being kept from you, which is the point.
 */
function redact(text: string, maxWords = Infinity): string {
  const words = text.split(/\s+/);
  const shown = words
    .slice(0, maxWords === Infinity ? words.length : maxWords)
    .map((w) => "\u2588".repeat(Math.min(9, w.replace(/[^\w]/g, "").length) || 1))
    .join(" ");
  return words.length > maxWords ? `${shown} \u2026` : shown;
}
