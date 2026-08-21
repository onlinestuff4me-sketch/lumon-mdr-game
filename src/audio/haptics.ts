import type { Temper } from "../game/types";

/**
 * Vibration API wrapper.
 *
 * The API is fire-and-forget and *replaces* any running pattern on each
 * call, so a naive per-frame call produces a solid, battery-burning buzz.
 * We instead re-arm a temper's pattern only when its own cycle has elapsed,
 * with the cycle length scaled by proximity.
 */

const SUPPORTED =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export type HapticPattern = number | number[];

/** Signature patterns, straight from the spec sheet. */
export const TEMPER_HAPTICS: Record<
  Temper,
  { pattern: HapticPattern; nearMs: number; farMs: number }
> = {
  // Slow, deep pulse — sorrow takes its time.
  WO: { pattern: [120], nearMs: 380, farMs: 900 },
  // Rapid double-tap — giddy.
  FC: { pattern: [20, 40, 20], nearMs: 200, farMs: 520 },
  // Continuous shivering buzz.
  DR: { pattern: [30, 15, 30], nearMs: 140, farMs: 420 },
  // One heavy kick.
  MA: { pattern: [220], nearMs: 460, farMs: 1000 },
};

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
      navigator.vibrate(pattern);
    } catch {
      /* Some browsers throw when the document is not user-activated. */
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
    if (!temper || intensity <= 0.12) {
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
    this.fire(def.pattern);
    const period = def.farMs + (def.nearMs - def.farMs) * intensity;
    this.nextAt[temper] = nowMs + period;
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
