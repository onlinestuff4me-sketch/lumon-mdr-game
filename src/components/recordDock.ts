/**
 * Where the incentive record sits while an incentive is being filed.
 *
 * Two components draw it at this position: the reward card, which
 * measures it and flies into it, and the landing screen that follows,
 * which leaves it exactly where it landed. The refiner has to see one
 * object receive their incentive and then stay put — if the block moved
 * between those two frames it would read as two different boxes, and the
 * whole point of the animation is that it is one.
 *
 * Anchored to the bottom of the viewport rather than placed by flow, so
 * neither component's other content can shift it.
 */
export const RECORD_DOCK =
  "absolute inset-x-7 bottom-[26vh] flex justify-center";

/**
 * The same offset as a bare value, for content that has to keep clear of
 * the block. It is spelled out twice because Tailwind reads class names
 * out of the source text and cannot follow an interpolation — so the
 * literal above is the one that generates the rule, and this is the one
 * arithmetic can be done with. They must agree.
 */
export const DOCK_FROM_BOTTOM = "26vh";

/**
 * Roughly what the block occupies — a title row, a rule, and the
 * forecast's three lines. Only used to keep other content clear of it, so
 * a few pixels either way costs nothing, and a hard number saves the
 * landing screen from having to measure anything to lay itself out.
 */
export const DOCK_HEIGHT = "96px";
