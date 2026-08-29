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
      style={{ width: w, height: size, filter: "drop-shadow(0 0 8px rgba(154,247,201,0.55))" }}
      aria-hidden
    >
      <div
        className="absolute left-0 top-0 rounded-t-[2px] border border-b-0 border-phos-300 bg-phos-600/50"
        style={{ width: Math.round(w * 0.52), height: tab }}
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-[2px] border border-phos-300 bg-phos-700/60"
        style={{ top: tab - 1 }}
      />
    </div>
  );
}
