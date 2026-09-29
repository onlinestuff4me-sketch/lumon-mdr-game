/**
 * What a refiner can hand back when something looks wrong.
 *
 * Written because a tester opened the game on their phone, saw a flat
 * mint-green screen, and had no way to tell us anything except that. The
 * cause was `prefers-reduced-motion` — one line of a report would have
 * named it in a second, and instead it took a screenshot, a guess and a
 * reproduction. So the report leads with the facts that differ between one
 * device and another, because those are the ones that cause a bug nobody
 * on the build can see.
 *
 * Two rules about what goes in it:
 *
 * 1. **Nothing here identifies a person.** The user agent, the viewport
 *    and the settings describe a browser, not who is holding it. There is
 *    no name, no email, no location, no save contents beyond counters.
 * 2. **Nothing leaves the device on its own.** Collecting is free;
 *    sending happens only when a refiner taps the button, and it goes
 *    wherever they choose to send it.
 */

import { runScope } from "./runScope";
import { loadSettings } from "./settings";

/** The build, stamped in by Vite. See `vite.config.ts`. */
declare const __BUILD__: string;

/**
 * The last few things that went wrong, oldest first.
 *
 * A bounded ring rather than a growing list: a page that throws in a
 * render loop would otherwise fill memory with its own complaint.
 */
const LOG_LIMIT = 12;
const log: string[] = [];

/** Seconds since the page was opened, to one decimal. */
const since = () => ((performance.now() / 1000).toFixed(1) + "s").padStart(7);

function record(kind: string, detail: string): void {
  log.push(`${since()}  ${kind}: ${detail.slice(0, 300)}`);
  if (log.length > LOG_LIMIT) log.shift();
}

/**
 * Start listening. Called once at boot, before React mounts, so a crash
 * during the first render is still caught.
 *
 * `console.error` is included deliberately: React reports a good deal
 * through it that never reaches `window.onerror`, and a report that says
 * "an effect threw" is worth more than one that says nothing.
 */
export function watchForTrouble(): void {
  window.addEventListener("error", (ev) => {
    const where = ev.filename ? ` (${ev.filename}:${ev.lineno})` : "";
    record("error", `${ev.message}${where}`);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    record("rejected", String((ev.reason as Error)?.message ?? ev.reason));
  });
  const original = console.error;
  console.error = (...args: unknown[]) => {
    record("console", args.map((a) => String(a)).join(" "));
    original(...args);
  };
}

/** A media query's answer, or `?` where the browser will not say. */
function media(query: string): string {
  try {
    return window.matchMedia(query).matches ? "yes" : "no";
  } catch {
    return "?";
  }
}

/** Whether the save is readable at all — a private window is not. */
function storageState(): string {
  try {
    const key = "lumon.mdr.probe";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return "available";
  } catch {
    return "blocked";
  }
}

export interface ReportContext {
  /** Where the refiner was: the file code and stage, if the game knows. */
  readonly screen?: string;
  /** Counters worth having, from the ledger. */
  readonly progress?: Record<string, number | string>;
}

/**
 * The report, as plain text.
 *
 * Plain text rather than JSON because it is going into a message to a
 * person, and a person should be able to read the first three lines and
 * know what they are looking at.
 */
export function buildReport(context: ReportContext = {}): string {
  const s = loadSettings();
  const nav = navigator as Navigator & { standalone?: boolean };
  const lines: string[] = [];

  lines.push("MDR — PROBLEM REPORT");
  lines.push("");
  lines.push("(Add what you were doing and what went wrong above this line.)");
  lines.push("");
  lines.push("── the device ───────────────────────────────");
  // First, and on purpose: this is the block that has already caught one
  // bug nobody on the build could see.
  lines.push(`reduced motion : ${media("(prefers-reduced-motion: reduce)")}`);
  lines.push(`high contrast  : ${media("(prefers-contrast: more)")}`);
  lines.push(`dark scheme    : ${media("(prefers-color-scheme: dark)")}`);
  lines.push(
    `viewport       : ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio ?? 1}x`,
  );
  lines.push(`screen         : ${screen.width}x${screen.height}`);
  lines.push(`touch points   : ${nav.maxTouchPoints ?? 0}`);
  lines.push(`home screen    : ${nav.standalone ? "yes" : "no"}`);
  lines.push(`storage        : ${storageState()}`);
  lines.push(`language       : ${nav.language ?? "?"}`);
  lines.push(`agent          : ${nav.userAgent}`);
  lines.push("");
  lines.push("── the terminal ─────────────────────────────");
  lines.push(`build          : ${__BUILD__}`);
  lines.push(`address        : ${location.href}`);
  if (context.screen) lines.push(`screen         : ${context.screen}`);
  lines.push(`open for       : ${since().trim()}`);
  lines.push(`save slot      : ${runScope() ?? "(none yet)"}`);
  lines.push(
    `settings       : pace=${s.pace} audio=${s.muted ? "off" : "on"} haptics=${
      s.hapticsOn ? "on" : "off"
    } assist=${s.assist ? "on" : "off"}`,
  );
  for (const [k, v] of Object.entries(context.progress ?? {})) {
    lines.push(`${k.padEnd(15)}: ${v}`);
  }
  lines.push("");
  lines.push("── what went wrong by itself ────────────────");
  lines.push(log.length ? log.join("\n") : "(nothing was thrown)");

  return lines.join("\n");
}

export type SendOutcome = "shared" | "copied" | "failed";

/**
 * Hand the report over, in one tap.
 *
 * The share sheet first, because on the phone this game is played on it
 * is one tap to whichever app the refiner already uses to talk to us, and
 * it needs no address written into a public repository. The clipboard is
 * the fallback for a desktop browser that has no sheet.
 *
 * `VITE_BUG_EMAIL`, if the deployment sets it, takes precedence: a report
 * that lands in an inbox beats one that depends on the tester choosing
 * somewhere sensible to put it.
 */
export async function sendReport(text: string): Promise<SendOutcome> {
  const to = import.meta.env.VITE_BUG_EMAIL as string | undefined;
  if (to) {
    const subject = encodeURIComponent("MDR problem report");
    location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(text)}`;
    return "shared";
  }
  // `canShare` rather than `share` alone: some desktop browsers define the
  // method and then reject every call, which would swallow the report.
  if (navigator.share && (!navigator.canShare || navigator.canShare({ text }))) {
    try {
      await navigator.share({ title: "MDR problem report", text });
      return "shared";
    } catch (err) {
      // A refiner who opened the sheet and changed their mind has not hit
      // a bug, and must not be told they have.
      if ((err as Error)?.name === "AbortError") return "shared";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
