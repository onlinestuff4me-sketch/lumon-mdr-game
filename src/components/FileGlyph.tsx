/**
 * A kept incentive, in transit.
 *
 * Between the card and the record there is a moment where the incentive is
 * neither — it is an object being put somewhere. It is drawn as a file
 * because that is the only physical vocabulary this terminal has: the
 * refiner has spent the whole game refining files, and a page that shrinks
 * into one and slides into a meter is legible without a word of
 * explanation.
 *
 * Deliberately one component used in two places. The card shrinks *into*
 * this shape and the summary catches *this* shape a beat later; if they
 * were two similar rectangles the eye would read them as two things and
 * the handoff would be lost.
 */
export function FileGlyph({ size = 36 }: { size?: number }) {
  const w = Math.round(size * 0.78);
  const tab = Math.max(4, Math.round(size * 0.17));
  return (
    <div
      className="relative"
      style={{
        width: w,
        height: size,
        // Two shadows, not one: a tight bright rim so the outline survives
        // a busy background, and a wide soft one so the object still reads
        // as a single mass when it is small and moving.
        filter:
          "drop-shadow(0 0 3px rgba(217,255,236,0.95)) drop-shadow(0 0 16px rgba(47,214,138,0.6))",
      }}
      aria-hidden
    >
      <div
        className="absolute left-0 top-0 rounded-t-[2px] border-2 border-b-0 border-phos-100 bg-phos-400/70"
        style={{ width: Math.round(w * 0.52), height: tab }}
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-[2px] border-2 border-phos-100 bg-phos-600/75"
        style={{ top: tab - 1 }}
      />
    </div>
  );
}
