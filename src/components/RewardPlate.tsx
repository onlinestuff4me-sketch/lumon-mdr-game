import type { RewardDef } from "../game/catalog";

/**
 * The picture on an incentive, wherever it is drawn.
 *
 * One component because there are three kinds of plate and they have to
 * agree in both places a refiner sees them — the card that opens, and the
 * shelf in the handbook. Two similar-looking implementations drift, and
 * the drift shows up as "the thing on my shelf is not the thing I was
 * given".
 *
 * - **A photograph** for anything whose identity is its picture: the
 *   eraser, the finger trap, the melon bar, the office floor.
 * - **The blank card** for a fact about your outie and for a Wellness
 *   session, with the sentence typeset over it at runtime. A generated
 *   picture cannot be trusted to spell, and the sentence is the payload —
 *   the plate is only the thing it is printed on.
 * - **A handbook page** for doctrine, drawn rather than photographed.
 *   The temper milestones read a passage from the handbook, and a passage
 *   from a book should look like a book: warm paper, a serif, a rule under
 *   the running head, a gutter shadow down the bound edge. It shared the
 *   Outie card's plate for a while, which made a note about Woe and a
 *   sentence about the person you are outside the same object.
 */
export function RewardPlate({
  reward,
  text,
  className = "",
}: {
  reward: RewardDef;
  /** The sentence to print, for the plates that carry one. */
  text?: string | null;
  className?: string;
}) {
  if (reward.doctrine) {
    return <HandbookPage text={text ?? reward.line} className={className} />;
  }
  const typeset = reward.kind === "fact" || reward.kind === "session";
  return (
    // `relative` first, so a caller that positions this itself wins the
    // cascade. It has to be positioned *somehow*, or the absolute image
    // inside it measures against an ancestor and the plate paints as a
    // bare rectangle — which is exactly what it did.
    <div className={`relative overflow-hidden ${className}`}>
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src={reward.poster}
        alt={reward.name}
      />
      {/* A generated picture cannot be trusted to spell, so the sentence
          is typeset over the plate at runtime. */}
      {typeset && text ? (
        <p
          className="absolute flex items-center justify-center text-center text-[9px] leading-relaxed text-[#2b3a30]"
          style={{ left: "27%", right: "25%", top: "26%", bottom: "34%" }}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A page of the handbook, drawn.
 *
 * Everything here is doing one job: making this read as *paper*, at a size
 * where a photograph of paper would only read as a grey rectangle. The
 * gutter is on the left, so the page is the right-hand one of an open
 * book; the foxing is two barely-there radial stains rather than a noise
 * texture, because a texture at this size is dirt; and the type is set
 * with a drop cap and a hanging first line, which is the one detail that
 * says "book" before a single word has been read.
 */
function HandbookPage({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const first = text.slice(0, 1);
  const rest = text.slice(1);
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background:
          "linear-gradient(105deg, #d8cdb0 0%, #e7ddc4 18%, #efe7d2 52%, #e3d8bd 100%)",
      }}
    >
      {/* Age. Two soft stains and a darkened outer edge — a page that has
          been in a drawer, not a page that has been in a fire. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 78% 12%, rgba(150,120,60,0.16) 0%, rgba(150,120,60,0) 70%), radial-gradient(45% 30% at 22% 88%, rgba(140,110,55,0.14) 0%, rgba(140,110,55,0) 70%), radial-gradient(120% 90% at 50% 50%, rgba(90,70,30,0) 55%, rgba(90,70,30,0.22) 100%)",
        }}
      />
      {/* The gutter: the page is bound down its left edge, and the paper
          curves away into it. */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[13%]"
        style={{
          background:
            "linear-gradient(90deg, rgba(58,44,18,0.42) 0%, rgba(58,44,18,0.16) 45%, rgba(58,44,18,0) 100%)",
        }}
      />

      <div className="relative flex h-full flex-col px-[15%] py-[9%] text-[#3a2f18]">
        <p
          className="text-center text-[6px] uppercase leading-none tracking-[0.32em] opacity-70"
          style={{ fontFamily: "var(--font-book)" }}
        >
          The Lumon Handbook
        </p>
        <div className="mx-auto mt-[5%] h-px w-2/3 bg-[#3a2f18] opacity-30" />

        <p
          className="mt-[9%] text-[10px] leading-[1.55]"
          style={{
            fontFamily: "var(--font-book)",
            textAlign: "justify",
            hyphens: "auto",
          }}
        >
          <span
            className="float-left mr-[3px] text-[26px] font-bold leading-[0.78]"
            style={{ fontFamily: "var(--font-book)" }}
          >
            {first}
          </span>
          {rest}
        </p>

        <p
          className="mt-auto text-center text-[6px] leading-none opacity-55"
          style={{ fontFamily: "var(--font-book)" }}
        >
          ·&nbsp;&nbsp;xi&nbsp;&nbsp;·
        </p>
      </div>
    </div>
  );
}
