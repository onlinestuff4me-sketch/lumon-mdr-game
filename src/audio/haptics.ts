import type { Temper } from "../game/types";

/**
 * Vibration API wrapper.
 *
 * The API is fire-and-forget and *replaces* any running pattern on each
 * call, so a naive per-frame call produces a solid, battery-burning buzz.
 * We instead re-arm a temper's pattern only when its own cycle has elapsed,
 * with the cycle length scaled by proximity.
 */

let SUPPORTED =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export type HapticPattern = number | number[];

interface TemperHaptic {
  /** The signature pattern, as felt at full proximity. */
  pattern: number[];
  /** Cadence at intensity 1 and intensity 0 respectively. */
  nearMs: number;
  farMs: number;
  /** Repeat the pattern to fill the whole period (a continuous texture). */
  fill?: boolean;
}

/** Signature patterns, straight from the spec sheet. */
export const TEMPER_HAPTICS: Record<Temper, TemperHaptic> = {
  // Slow, deep pulse — sorrow takes its time.
  WO: { pattern: [120], nearMs: 380, farMs: 900 },
  // Rapid double-tap — giddy.
  FC: { pattern: [20, 40, 20], nearMs: 200, farMs: 520 },
  // Continuous shivering buzz: the pattern repeats to fill its own period,
  // so dread is felt as an unbroken tremor rather than a slow tick.
  DR: { pattern: [30, 15, 30], nearMs: 150, farMs: 330, fill: true },
  // One heavy kick.
  MA: { pattern: [220], nearMs: 460, farMs: 1000 },
};

/** Minimum proximity that registers at all. Deliberately low: the point of
 *  haptics here is to signal *approach*, not just arrival. */
const FLOOR = 0.05;
/** Pattern duration at zero proximity, as a fraction of the full pattern. */
const MIN_SCALE = 0.45;
/** Gap inserted between repeats of a filled pattern. */
const FILL_GAP = 12;

function scalePattern(pattern: number[], scale: number): number[] {
  return pattern.map((ms) => Math.max(8, Math.round(ms * scale)));
}

/** Repeat `pattern` (with a gap between copies) until it spans `periodMs`. */
function repeatToFill(pattern: number[], periodMs: number): number[] {
  const span = pattern.reduce((a, b) => a + b, 0);
  if (span <= 0) return pattern;
  // Round rather than floor: overshooting the period slightly is what makes
  // the tremor unbroken, since the next vibrate() call replaces whatever is
  // still running.
  const copies = Math.max(1, Math.min(8, Math.round(periodMs / (span + FILL_GAP))));
  if (copies === 1) return pattern;
  const out: number[] = [...pattern];
  for (let i = 1; i < copies; i++) out.push(FILL_GAP, ...pattern);
  return out;
}

class Haptics {
  private enabled = true;
  /** Browsers drop (and warn about) vibrate() before the frame is tapped. */
  private activated = false;
  private nextAt: Record<Temper, number> = { WO: 0, FC: 0, DR: 0, MA: 0 };
  private lastOwner: Temper | null = null;

  get supported(): boolean {
    return SUPPORTED;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.cancel();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Call from the first real user gesture. */
  markActivated(): void {
    this.activated = true;
  }

  private fire(pattern: HapticPattern): void {
    if (!SUPPORTED || !this.enabled || !this.activated || document.hidden) return;
    try {
      // vibrate() returns false when the platform silently refuses (system
      // vibration switched off, insufficient engagement). Claiming haptics
      // are on while nothing ever fires is worse than admitting they're not.
      if (navigator.vibrate(pattern) === false) SUPPORTED = false;
    } catch {
      SUPPORTED = false;
    }
  }

  /**
   * Drive the ambient proximity haptic for the dominant temper.
   * @param temper  the temper currently under the reticle, or null
   * @param intensity 0..1 proximity
   * @param nowMs   performance.now()
   */
  proximity(temper: Temper | null, intensity: number, nowMs: number): void {
    if (!SUPPORTED || !this.enabled) return;
    if (!temper || intensity <= FLOOR) {
      if (this.lastOwner) {
        this.cancel();
        this.lastOwner = null;
      }
      return;
    }
    // Switching clusters restarts the cadence immediately: the change of
    // rhythm *is* the information.
    if (temper !== this.lastOwner) {
      this.lastOwner = temper;
      this.nextAt[temper] = 0;
    }
    const def = TEMPER_HAPTICS[temper];
    if (nowMs < this.nextAt[temper]) return;
    // Proximity drives both halves of the sensation: the pulses themselves
    // lengthen toward their signature durations, and the cadence tightens.
    // At intensity 1 the pattern is exactly the one on the spec sheet.
    const period = def.farMs + (def.nearMs - def.farMs) * intensity;
    let pattern = scalePattern(
      def.pattern,
      MIN_SCALE + (1 - MIN_SCALE) * intensity,
    );
    if (def.fill) pattern = repeatToFill(pattern, period);
    this.fire(pattern);
    this.nextAt[temper] = nowMs + period;
  }

  /**
   * Forget which temper owned the ambient cadence, without stopping the
   * vibrator. `cancel()` would call vibrate(0), which replaces — and so
   * kills — a discrete pattern fired microseconds earlier in the same
   * pointerup (the lift confirmation, the rejection buzz, the mode click).
   */
  releaseProximity(): void {
    this.lastOwner = null;
    this.nextAt = { WO: 0, FC: 0, DR: 0, MA: 0 };
  }

  /** Discrete event taps. */
  tap(): void {
    this.fire(12);
  }

  lift(): void {
    this.fire([18, 30, 60]);
  }

  success(): void {
    this.fire([40, 50, 40]);
  }

  reject(): void {
    this.fire([90, 60, 90, 60, 140]);
  }

  complete(): void {
    this.fire([60, 40, 60, 40, 200]);
  }

  cancel(): void {
    if (!SUPPORTED || !this.activated) return;
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
}

export const haptics = new Haptics();
