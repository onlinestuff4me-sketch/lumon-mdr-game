import { useEffect, useRef, useState } from "react";

/**
 * One line of text being replaced by another, a character at a time.
 *
 * A terminal does not cross-fade a headline. It backspaces over what is
 * there and types the new thing, and the incentive card is the one place
 * in this game where a line genuinely *changes meaning* — "YOU'VE EARNED
 * AN INCENTIVE" becomes the name of the thing, at the same moment the
 * seal parts and the plate appears behind it.
 *
 * Two phases: erase what is on screen, then type what replaces it. The
 * erase is faster than the type, because deleting is not the part anyone
 * is reading.
 *
 * What gets erased is whatever is *currently drawn*, not a fixed `from`
 * string — so a caption that changes again while the card is open (a
 * Wellness session walks three sentences) backspaces over the sentence
 * the refiner was reading rather than over something they never saw.
 *
 * Returns the text to draw and whether the machine is still working, so a
 * caller can blink a caret while it is and stop when it is not.
 */

interface Options {
  /** Start the transition. While false, `initial` is held. */
  go: boolean;
  /** What sits on the line before `go` — the text that gets typed over. */
  initial?: string;
  /** Milliseconds per character removed. */
  eraseMs?: number;
  /** Milliseconds per character typed. */
  typeMs?: number;
  /**
   * A beat between the last character erased and the first one typed.
   * With nothing to erase this is simply the lead-in, which is how the
   * caption waits its turn behind the headline.
   */
  gapMs?: number;
  /** Skip the animation entirely — reduced motion, or nothing to reveal. */
  instant?: boolean;
}

export function useTypeOver(
  to: string,
  {
    go,
    initial = "",
    eraseMs = 12,
    typeMs = 26,
    gapMs = 90,
    instant = false,
  }: Options,
): { text: string; typing: boolean } {
  const [text, setText] = useState(initial);
  // The two states that are not animation — held before `go`, and skipped
  // outright — are derived rather than stored. Pushing them into `text`
  // from an effect would be a render spent saying what this line already
  // says, and it is what the machine is *doing* that the caret reports.
  const display = !go ? initial : instant ? to : text;
  const typing = go && !instant && display !== to;
  /** What is on screen right now, which is what an erase has to consume. */
  const shown = useRef(display);
  // The timer chain, so a component that unmounts mid-word does not go on
  // setting state into nothing.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Declared first so it has committed before the run below reads it: on
  // the commit that flips `go`, the line on screen is still the old one.
  useEffect(() => {
    shown.current = display;
  }, [display]);

  useEffect(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    if (!go || instant) return;
    const from = shown.current;
    if (from === to) return;
    let at = 0;
    // Erase the old line...
    for (let n = from.length - 1; n >= 0; n--) {
      const slice = from.slice(0, n);
      at += eraseMs;
      timers.current.push(setTimeout(() => setText(slice), at));
    }
    at += gapMs;
    // ...then type the new one.
    for (let n = 1; n <= to.length; n++) {
      const slice = to.slice(0, n);
      at += typeMs;
      timers.current.push(setTimeout(() => setText(slice), at));
    }
    return () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    };
  }, [to, go, eraseMs, typeMs, gapMs, instant]);

  return { text: display, typing };
}
