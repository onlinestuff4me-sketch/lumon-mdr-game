import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { RewardDef } from "../game/catalog";
import type { Fact } from "../game/facts";
import { keepLabel } from "../game/lexicon";
import { plateIsPale } from "../game/catalog";
import { reasonFor, type Rung } from "../game/rewards";
import { RewardPlate } from "./RewardPlate";
import { useTypeOver } from "../hooks/useTypeOver";
import { FileGlyph } from "./FileGlyph";

/**
 * One incentive: sealed, then opened.
 *
 * Six rules this component exists to keep, from `docs/REWARDS.md` Part 5
 * and the fact bank's playback specification:
 *
 * 1. **The name and the picture arrive together, and not before.** Until
 *    the seal parts there is nothing on screen — and nothing in the markup
 *    or the accessibility tree — that could identify what is inside. The
 *    plate is fetched early so it can be shown instantly, but it is
 *    fetched into the browser's cache, not into the document.
 * 2. **The cause may be stated; the effect may not.** The sealed card says
 *    exactly *why* it was issued — the milestone, and the number reached —
 *    because the refiner did that and knows they did. What is inside stays
 *    classified until they tap.
 * 3. **Nothing is ever non-skippable.** The control is live from the first
 *    frame; while the card is sealed it opens it, and after that it moves
 *    on. Tapping through the seal animation is allowed.
 * 4. **One card at a time.** Two incentives never share a frame. The stack
 *    is the caller's business; this draws whichever one it is handed, and
 *    says how many are behind it.
 * 5. **The seal waits for a hand.** It opened itself after 900ms once, and
 *    a refiner who looked away missed the only moment the card existed.
 *    Nothing here moves until it is tapped.
 * 6. **Nothing on the card may move when the seal opens.** Every band of
 *    the card is a fixed height and the plate frame is a fixed aspect, so
 *    what changes between sealed and open is what is drawn inside those
 *    boxes and never where the boxes are. A card that re-centers itself on
 *    the frame the picture appears is a card that jitters at exactly the
 *    moment the refiner is looking hardest.
 *
 * Where the incentive *goes* is no longer this component's business. The
 * last card of a stack hands over to the summary screen, which is where
 * keeping is shown and explained. The card used to shrink into a block
 * drawn over its own photograph, which read as clutter on top of the one
 * picture the refiner had just earned the right to look at.
 */

/**
 * How long the lid takes to clear the plate.
 *
 * Slow enough to watch. This is the payoff frame of the whole loop and it
 * used to be over before a refiner had finished registering that they had
 * tapped; the headline types itself over in roughly the same span, so the
 * name lands as the picture does.
 */
const PART_MS = 700;

/**
 * How long the card takes to fold itself into a file on the way out.
 *
 * KEEP INCENTIVE used to simply cut to the summary, which left the refiner
 * to infer that the thing they had just been shown had gone anywhere at
 * all. It shrinks into a file instead, and the summary catches that same
 * file and walks it into the meter it counted toward.
 *
 * Slow enough to be a beat rather than a cut. This is the first of three
 * statements the filing sequence makes — it went into a folder — and none
 * of them survives being played in a third of a second.
 */
const KEEP_MS = 460;

/**
 * The headline's typing speed, and the beat between erasing and writing.
 *
 * Exported as constants because the rest of the card's choreography is
 * timed off them: the caption band opens when the headline stops.
 */
const ERASE_MS = 14;
const TYPE_MS = 30;
const HEAD_GAP_MS = 140;

/** How long the caption band takes to open, sliding the control down. */
const BAND_MS = 320;

/**
 * The height the caption band opens to, and the height the tail gives up
 * to pay for it.
 *
 * The card is centred, so growing anything would otherwise drag everything
 * above it upward — including the plate, on the exact frame the refiner is
 * looking at it. The band and the tail trade the same 56px in opposite
 * directions, so the card's total height never changes and nothing above
 * the control moves.
 */
const BAND_H = 56;

/** The block a terminal leaves under the character it is about to write. */
function Caret({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      aria-hidden
      className="ml-[2px] inline-block h-[1em] w-[5px] translate-y-[0.12em] bg-phos-300"
      style={{ animation: "crt-caret 760ms steps(1, end) infinite" }}
    />
  );
}

interface Props {
  reward: RewardDef;
  /** The rung that issued it, for the line saying why. */
  rung: Rung;
  /**
   * The file count that issued it, when this incentive was missed once and
   * rescheduled onto a file milestone. Absent for every ordinary payout.
   */
  rescheduledAt?: number;
  /**
   * The sentences this incentive reads, already chosen and already stored.
   * One for a fact card, three or four for a Wellness session, none for an
   * object.
   */
  facts: readonly Fact[];
  /** 1-based position in this boundary's stack, and its length. */
  index: number;
  total: number;
  /**
   * Whether this card opens with the seal on. Only the first of a boundary
   * does: the seal announces the whole payout, and re-sealing between
   * cards of one stack makes three incentives feel like three
   * interruptions.
   */
  sealed: boolean;
  onAccept: () => void;
}

export function RewardReveal({
  reward,
  rung,
  rescheduledAt,
  facts,
  index,
  total,
  sealed,
  onAccept,
}: Props) {
  const [open, setOpen] = useState(!sealed);
  /** True while the lid is retracting off the plate. */
  const [parting, setParting] = useState(false);
  /** Which sentence of a session is on the card. */
  const [step, setStep] = useState(0);
  /** True while the card is folding itself into a file. */
  const [keeping, setKeeping] = useState(false);
  /**
   * True once the opening has finished playing out: the seal is off, the
   * name has finished being typed, and the card is ready to say the rest.
   *
   * A card that opens without a seal has nothing to play, so it starts
   * here. This is what the caption band and the control's label wait on —
   * the second beat of the reveal, after the first has landed.
   */
  const [revealed, setRevealed] = useState(!sealed);
  /** True when a refiner tapped through the opening rather than watching. */
  const [skipped, setSkipped] = useState(false);
  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  /**
   * Warm the plate before it is ever asked for.
   *
   * A 30KB WebP decoded on the frame the seal parts is a dropped frame at
   * exactly the moment the refiner is looking hardest. Fetching it into
   * the cache costs nothing while the card sits sealed, and puts nothing
   * in the document — rule 1 is about what can be seen and read, and an
   * `Image` that never enters the DOM is neither.
   */
  useEffect(() => {
    const img = new Image();
    img.src = reward.poster;
    void img.decode?.().catch(() => {});
  }, [reward.poster]);

  /** The lid is cosmetic: it retracts, then it stops existing. */
  useEffect(() => {
    if (!parting) return;
    const t = setTimeout(() => setParting(false), PART_MS);
    return () => clearTimeout(t);
  }, [parting]);

  const fact = facts[step] ?? null;
  const lastStep = step >= facts.length - 1;
  const advances = facts.length > 1 && !lastStep;

  /**
   * The two lines the seal rewrites.
   *
   * The headline is the whole point: the card announces that *something*
   * was earned, and then that sentence is typed over, in place, with the
   * name of the thing. The caption under the plate does the same from
   * empty — while sealed it says nothing, because what it used to say now
   * lives on the lid where the refiner is already looking.
   *
   * A card that opens without a seal (the second and third of a stack) has
   * no "before" to type over, so its headline is simply the name.
   */
  const sealedHead =
    total > 1 ? `YOU'VE EARNED ${total} INCENTIVES` : "YOU'VE EARNED AN INCENTIVE";
  /**
   * What goes under the plate.
   *
   * A plate that carries the sentence gets the reward's own line here
   * instead, because the sentence is already the thing being read. That
   * now includes a Wellness session: it used to show a stock photograph of
   * an empty chair with the fact in small green italics beneath it, which
   * put the interesting half of the incentive in the caption.
   */
  const onPlate =
    reward.kind === "fact" ||
    reward.kind === "session" ||
    reward.doctrine === true;
  const caption = fact && !onPlate ? fact.text : reward.line;

  const head = useTypeOver(reward.earned, {
    go: open,
    initial: sealedHead,
    eraseMs: ERASE_MS,
    typeMs: TYPE_MS,
    gapMs: HEAD_GAP_MS,
    instant: !sealed || reduced || skipped,
    // The headline is the line the refiner is reading; the terminal is
    // heard writing it.
    audible: true,
  });
  // Behind the headline, and quicker per character because it is a
  // sentence rather than a title. It waits for the band to start opening,
  // so the words are written into a space that is making room for them.
  const body = useTypeOver(caption, {
    go: revealed,
    eraseMs: 9,
    typeMs: 17,
    gapMs: 110,
    instant: reduced || skipped,
    audible: true,
  });

  /**
   * The opening plays in two beats, and the second waits for the first.
   *
   * One: the lid retracts and the headline is typed over with the name.
   * Two: the caption band opens, sliding the control down, and the line
   * under the plate is written into the space that just appeared.
   *
   * Doing both at once put three animations and a photograph on screen
   * together and reserved a hand's width of nothing under the plate to
   * hold text that was not there yet. Sequenced, each piece arrives as the
   * information it carries becomes available.
   */
  const headMs =
    sealedHead.length * ERASE_MS + HEAD_GAP_MS + reward.earned.length * TYPE_MS;
  useEffect(() => {
    if (!open || revealed) return;
    const t = setTimeout(() => setRevealed(true), reduced ? 0 : headMs + 140);
    return () => clearTimeout(t);
  }, [open, revealed, reduced, headMs]);

  const label = !open || !revealed
    ? "OPEN"
    : advances
      ? "CONTINUE"
      : keepLabel(index, total);

  return (
    <div
      className="absolute inset-0 z-70 flex flex-col items-center justify-center overflow-hidden bg-phos-950/97 px-7 text-center"
      style={
        reduced
          ? undefined
          : { animation: "crt-open 340ms cubic-bezier(.2,.7,.3,1) 1" }
      }
    >
      {/* The leading edge of the sweep that drew this panel. One pass, then
          it is gone — a tube redrawing, not a decoration that loops. */}
      {reduced ? null : (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[14%]"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(154,247,201,0.16) 55%, rgba(217,255,236,0.5) 88%, transparent)",
            animation: "crt-band 560ms ease-out 1 forwards",
          }}
        />
      )}

      <div
        className="flex w-full max-w-[248px] flex-col items-center"
        style={
          keeping
            ? {
                transition: `transform ${KEEP_MS}ms cubic-bezier(.5,0,.3,1), opacity ${KEEP_MS}ms ease-in`,
                transform: "scale(0.08)",
                opacity: 0,
              }
            : undefined
        }
      >
        {/* Rule 6. Every band below is a fixed height. */}
        {/* Letterhead when there is one incentive, position when there is
            a stack. Never "INCENTIVE EARNED" above a headline that already
            says an incentive has been earned. */}
        <p className="flex h-[11px] items-center text-[9px] tracking-[0.3em] text-phos-600">
          {total > 1 ? `INCENTIVE ${index} OF ${total}` : "LUMON INDUSTRIES"}
          {open && facts.length > 1 ? ` · ${step + 1}/${facts.length}` : ""}
        </p>

        <h1 className="crt-text-glow mt-2 flex h-[32px] items-center justify-center text-[12px] font-bold leading-tight tracking-[0.12em] text-phos-200">
          <span>
            {head.text}
            <Caret on={head.typing} />
          </span>
        </h1>
        <div className="mt-3 h-px w-24 bg-phos-600" />

        {/* Why. Sealed, this is the whole of what the card is willing to
            say; open, it stays put, so the refiner can still see what they
            did to get it. */}
        <p className="mt-3 flex h-[11px] items-center text-[8px] tracking-[0.2em] text-phos-500">
          {reasonFor(rung, rescheduledAt)}
        </p>

        {/* The plate. Fixed aspect in both states, so the lid and the
            picture occupy exactly the same box and nothing on the card can
            move when one becomes the other. */}
        <div
          className={`relative mt-4 aspect-[9/16] w-full overflow-hidden rounded-[3px] border border-phos-600 ${
            open && plateIsPale(reward) ? "bg-[#e9e5d9]" : "bg-black"
          }`}
        >
          {open ? (
            // Sized rather than positioned: the box around it is already
            // the fixed 9/16 the lid occupies, so the plate simply fills
            // it and keeps its own positioning context for the sentence
            // typeset on top.
            <RewardPlate
              reward={reward}
              text={fact?.text ?? null}
              className="h-full w-full"
            />
          ) : null}

          {/* The lid. Two halves that split on a bright seam and retract,
              which is what this tube would do; nothing cross-fades on a
              CRT. While sealed it is one unbroken face carrying no
              information about what is behind it. */}
          {!open || parting ? (
            <>
              <div
                className="absolute inset-x-0 top-0 flex h-1/2 flex-col items-center justify-end border-b border-phos-800/60 bg-phos-900/95 px-5 pb-3 text-center"
                style={
                  parting && !reduced
                    ? {
                        animation: `seal-part-top ${PART_MS}ms cubic-bezier(.55,0,.35,1) forwards`,
                      }
                    : undefined
                }
              >
                <span className="text-[10px] tracking-[0.3em] text-phos-600">
                  SEALED
                </span>
                {/* The notice belongs on the thing it is describing. Said
                    under the card it was one more line of small print;
                    said on the lid, directly under the word SEALED, it is
                    the lid explaining itself, and it leaves with the lid. */}
                <p className="mt-2 text-[8px] leading-snug tracking-[0.04em] text-phos-700">
                  The contents of this incentive remain classified until it is
                  opened.
                </p>
              </div>
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 border-t border-phos-800/60 bg-phos-900/95"
                style={
                  parting && !reduced
                    ? {
                        animation: `seal-part-bottom ${PART_MS}ms cubic-bezier(.55,0,.35,1) forwards`,
                      }
                    : undefined
                }
              />
              {/* The line the lid parts along, gone by the time it has
                  cleared the frame. */}
              {parting && !reduced ? (
                <div
                  className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-phos-100"
                  style={{
                    boxShadow: "0 0 12px 3px rgba(154,247,201,0.9)",
                    animation: `seal-seam ${PART_MS}ms ease-out forwards`,
                  }}
                />
              ) : null}
              {/* A sealed lid breathes; a retracting one does not. */}
              {!open ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ animation: "bin-await 1.6s ease-in-out infinite" }}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {/* Reserved whether or not there is anything to say, so the button
            below it never moves. Three lines' worth, which is the longest
            line in the catalog. */}
        {/* Closed while sealed — the classified notice moved onto the lid,
            and a hand's width of reserved nothing under the plate was the
            largest gap on the card. It opens on the second beat, and the
            line is typed into the space as the space appears. */}
        <div
          className="w-full overflow-hidden"
          style={{
            height: revealed ? BAND_H : 0,
            transition: reduced ? undefined : `height ${BAND_MS}ms cubic-bezier(.4,0,.2,1)`,
          }}
        >
          <p className="mt-3 flex h-[44px] items-center justify-center text-[10px] italic leading-snug text-phos-400">
            <span>
              {body.text}
              <Caret on={body.typing} />
            </span>
          </p>
        </div>


        {/* Live from the first frame, which is what keeps every part of this
            skippable — while the card is opening it finishes the opening,
            and after that it moves on. It throbs because it is the only
            thing on the screen that does anything, and a refiner who does
            not know that is a refiner sitting in front of a card that
            appears to have stopped. */}
        <button
          type="button"
          data-reward-action
          onClick={() => {
            if (!open) {
              setOpen(true);
              if (!reduced) setParting(true);
              return;
            }
            // Mid-opening: land the whole thing now rather than making the
            // refiner watch a machine type at them.
            if (!revealed) {
              setSkipped(true);
              setRevealed(true);
              return;
            }
            if (advances) return setStep((n) => n + 1);
            // Only the control that actually *keeps* folds the card into a
            // file. SEE NEXT INCENTIVE hands over to the next card of the
            // same stack — nothing has been put away yet, and playing the
            // filing animation between two cards says it has.
            if (index < total) return onAccept();
            if (reduced || keeping) return onAccept();
            setKeeping(true);
            setTimeout(onAccept, KEEP_MS);
          }}
          className="crt-text-glow relative z-10 mt-4 inline-flex items-center gap-2 rounded-[3px] border border-phos-400 bg-phos-600/25 px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-phos-200 active:bg-phos-600/50"
          // Inside the column, so it folds away with everything else; the
          // throb simply stops rather than being animated over.
          style={
            keeping ? undefined : { animation: "crt-throb 1.9s ease-in-out infinite" }
          }
        >
          {label}
          <ChevronRight size={12} strokeWidth={2.6} />
        </button>

        {/* What the band spends. Held while sealed so the control sits
            directly under the plate, and given up as the band opens, so
            the card's height — and therefore everything above it — never
            changes. */}
        <div
          className="w-full shrink-0"
          style={{
            height: revealed ? 0 : BAND_H,
            transition: reduced ? undefined : `height ${BAND_MS}ms cubic-bezier(.4,0,.2,1)`,
          }}
        />
      </div>

      {/* What the card becomes. It fades up in the middle of the screen as
          the card collapses through it, so there is one object leaving
          rather than a page disappearing and a file appearing. A sibling
          of the column, never a child: a child would fold away with it. */}
      {keeping ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          style={{ animation: `crt-resolve ${KEEP_MS}ms ease-out 1 forwards` }}
        >
          {/* Same size, same ground, same place on screen as the one the
              summary catches. Two glyphs that differ by a few pixels read
              as two objects and the handover is lost. */}
          <div
            aria-hidden
            className="absolute h-[190px] w-[190px]"
            style={{
              background:
                "radial-gradient(circle, rgba(1,7,4,0.96) 0%, rgba(1,7,4,0.88) 38%, rgba(1,7,4,0) 72%)",
            }}
          />
          <div className="relative">
            <FileGlyph size={54} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
