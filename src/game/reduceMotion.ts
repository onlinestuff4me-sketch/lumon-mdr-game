/**
 * Whether this refiner asked for less motion.
 *
 * One copy, because two components now branch on it and a predicate that
 * disagrees with itself is the whole shape of the green-screen bug: a
 * device setting handled in one place and forgotten in another.
 *
 * Guarded: `matchMedia` is absent in a few embedded webviews and throws in
 * at least one, and a start screen that cannot decide how much to animate
 * should animate rather than fail to render.
 */
export function prefersReduce(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}
