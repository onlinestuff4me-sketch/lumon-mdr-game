/**
 * The Wellness voice.
 *
 * Every other sound in this game is synthesised at runtime and there are
 * no audio files in the repository; a bank of forty-nine recorded
 * sentences would be the first, and would be a few megabytes of download
 * for a phone. So the spoken fact uses the browser's own speech synthesis
 * instead — no assets, no network, and no imitation of anyone: it is
 * whatever neutral system voice the device already has, which is exactly
 * the register a Lumon Wellness statement wants.
 *
 * The rules it has to keep:
 *
 * - **Optional.** It follows the terminal's mute switch, and silence never
 *   costs the refiner anything: the card and the caption carry the same
 *   sentence, always.
 * - **Identical.** It speaks the string it is handed and nothing else, so
 *   what is heard is what is written.
 * - **Interruptible.** A card that leaves takes its voice with it.
 *
 * Unsupported browsers get silence, which is a supported way to play.
 */

/** Roughly the 130 words a minute the fact bank asks for. */
const RATE = 0.85;

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis
      : null;
  } catch {
    return null;
  }
}

export const speech = {
  /** Read one approved sentence. Replaces anything already speaking. */
  say(text: string): void {
    const s = synth();
    if (!s) return;
    try {
      s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = RATE;
      u.pitch = 1;
      u.volume = 1;
      s.speak(u);
    } catch {
      /* A voice that will not start is not a reason to stop the game. */
    }
  },

  stop(): void {
    const s = synth();
    if (!s) return;
    try {
      s.cancel();
    } catch {
      /* Nothing to cancel. */
    }
  },

  get supported(): boolean {
    return synth() !== null;
  },
};
