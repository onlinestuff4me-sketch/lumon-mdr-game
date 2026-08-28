import type { Pace } from "./constants";

/**
 * Player settings, persisted per browser.
 *
 * Losing your shift length, your mute state and your color assist on every
 * reload is its own small punishment, and this game is played in short
 * sittings on a phone. Every read and write is guarded: storage throws
 * outright in some contexts (private windows, blocked site data), and a
 * settings failure must never stop the terminal booting.
 */
export interface Settings {
  pace: Pace;
  muted: boolean;
  hapticsOn: boolean;
  assist: boolean;
}

const KEY = "lumon.mdr.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  pace: "extended",
  muted: false,
  hapticsOn: true,
  assist: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      pace: parsed.pace === "standard" ? "standard" : DEFAULT_SETTINGS.pace,
      muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULT_SETTINGS.muted,
      hapticsOn:
        typeof parsed.hapticsOn === "boolean"
          ? parsed.hapticsOn
          : DEFAULT_SETTINGS.hapticsOn,
      assist:
        typeof parsed.assist === "boolean" ? parsed.assist : DEFAULT_SETTINGS.assist,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* Storage unavailable — the session simply does not persist. */
  }
}
