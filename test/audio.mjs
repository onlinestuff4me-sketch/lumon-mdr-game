/**
 * The audio bed is measured, not trusted.
 *
 * Twice now a temper's ambient voice has shipped inaudible while every
 * other check was green, because "audio needs ears" was treated as "audio
 * cannot be tested". It can: this file plays the real build, taps into the
 * engine's own AudioContext just behind the limiter, and measures RMS.
 * What it asserts is not taste — taste still needs ears — but existence:
 * every temper's bed must add measurable energy over the bare hum, and a
 * mute must take it all away.
 */
import { chromium } from "playwright";
import { section, check, summary } from "./harness.mjs";

const URL = process.env.MDR_URL ?? "http://127.0.0.1:5178/";

function browserPath() {
  if (process.env.MDR_CHROMIUM) return process.env.MDR_CHROMIUM;
  return "/opt/pw-browsers/chromium";
}

let exe = browserPath();
try {
  const { existsSync } = await import("node:fs");
  if (!existsSync(exe)) exe = undefined;
} catch {
  exe = undefined;
}

const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 } })
).newPage();

// Stash the engine's AudioContext and limiter as they are created, so the
// analyser hears exactly what the player hears.
await page.addInitScript(() => {
  const orig = AudioContext.prototype.createDynamicsCompressor;
  AudioContext.prototype.createDynamicsCompressor = function (...a) {
    const node = orig.apply(this, a);
    window.__actx = this;
    window.__limiter = node;
    return node;
  };
});
await page.goto(URL);
await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
await page.evaluate(() => {
  window.__mdr.pointerDown(1, 50, 300);
  window.__mdr.pointerUp(1, 50, 300);
});
await page.waitForFunction(() => !!window.__limiter, null, { timeout: 5000 });

const rms = () =>
  page.evaluate(async () => {
    const ctx = window.__actx;
    if (!window.__an) {
      window.__an = ctx.createAnalyser();
      window.__an.fftSize = 4096;
      window.__limiter.connect(window.__an);
    }
    const an = window.__an;
    const buf = new Float32Array(an.fftSize);
    let acc = 0;
    for (let i = 0; i < 10; i++) {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (const v of buf) s += v * v;
      acc += Math.sqrt(s / buf.length);
      await new Promise((r) => setTimeout(r, 90));
    }
    return acc / 10;
  });

section("audio bed exists");

// Baseline: the hum alone — no file live, nothing on the board.
await page.waitForTimeout(1500);
const hum = await rms();
check("the hum itself is playing", hum > 0.004, `rms ${hum.toFixed(4)}`);

// Single-temper orientation screens: 0-2 WO, 3-5 FC, 6-8 DR, 9-11 MA.
// Each temper's bed must be measurably more than the bare hum. 1.2x is
// deliberately a floor, not a taste target — the LFO-swept voices (woe's
// sigh) vary between samples, and this check exists to catch silence.
for (const [name, lvl] of [["WO", 1], ["FC", 4], ["DR", 7], ["MA", 10]]) {
  await page.evaluate((i) => window.__mdr.startLevel(i), lvl);
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  await page.waitForTimeout(2500); // the crossfade is deliberately slow
  const v = await rms();
  check(`${name} bed adds energy over the hum`, v > hum * 1.2,
    `${(v / hum).toFixed(2)}x`);
}

// And a mute must take all of it away.
await page.evaluate(() => window.__mdr.setMuted(true));
await page.waitForTimeout(2500);
const mutedRms = await rms();
check("mute silences the bed and the hum", mutedRms < hum * 0.25,
  `rms ${mutedRms.toFixed(4)} vs hum ${hum.toFixed(4)}`);

await browser.close();
process.exit(summary());
