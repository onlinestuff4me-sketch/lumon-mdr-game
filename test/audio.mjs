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

/**
 * Broadband RMS, beat-averaged. The hum's detuned 50Hz pair beats at
 * 0.4Hz, swinging its own RMS by a third over a 2.5 second cycle — a
 * short window reads a random phase of that swell, which once made an
 * audible voice measure *below* the hum-only baseline. Five seconds
 * covers two full beats.
 */
const rms = () =>
  page.evaluate(async () => {
    const ctx = window.__actx;
    if (!window.__an) {
      window.__an = ctx.createAnalyser();
      window.__an.fftSize = 4096;
      window.__an.smoothingTimeConstant = 0.4;
      window.__limiter.connect(window.__an);
    }
    const an = window.__an;
    const buf = new Float32Array(an.fftSize);
    let acc = 0;
    const N = 25;
    for (let i = 0; i < N; i++) {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (const v of buf) s += v * v;
      acc += Math.sqrt(s / buf.length);
      await new Promise((r) => setTimeout(r, 200));
    }
    return acc / N;
  });

/**
 * Power inside one frequency band, averaged the same way. This is the
 * instrument that can hear a quiet voice under a loud hum: each temper
 * owns a band the hum barely reaches, so its energy there is unmistakable
 * however the mix is balanced.
 */
const bandPower = (lo, hi) =>
  page.evaluate(async ({ lo, hi }) => {
    const ctx = window.__actx;
    const an = window.__an;
    const buf = new Float32Array(an.frequencyBinCount);
    const hzPerBin = ctx.sampleRate / an.fftSize;
    const b0 = Math.max(0, Math.floor(lo / hzPerBin));
    const b1 = Math.min(buf.length - 1, Math.ceil(hi / hzPerBin));
    let acc = 0;
    const N = 20;
    for (let i = 0; i < N; i++) {
      an.getFloatFrequencyData(buf);
      let s = 0;
      for (let b = b0; b <= b1; b++) s += Math.pow(10, buf[b] / 10);
      acc += s;
      await new Promise((r) => setTimeout(r, 150));
    }
    return acc / N;
  }, { lo, hi });

section("audio bed exists");

// Baseline: the hum alone — no file live, nothing on the board.
await page.waitForTimeout(1500);
const hum = await rms();
check("the hum itself is playing", hum > 0.004, `rms ${hum.toFixed(4)}`);

// The room's own layers: the buzz lives in its bandpass around 700Hz and
// the keyboards' clicks around 2.8kHz — bands where nothing else plays.
// Both are compared against a reference band (7-9kHz) that only holds
// noise-floor, so "is it there at all" needs no absolute scale.
{
  const ref = await bandPower(7000, 9000);
  const buzzP = await bandPower(550, 900);
  check("the buzz is in the hum", buzzP > 3 * ref,
    `${(buzzP / (ref || 1e-12)).toFixed(1)}x over the noise floor`);

  // The keyboards are counted, not averaged. Typing is bursts with
  // thinking pauses, so a short average reads a random duty cycle — CI
  // once caught a pause-heavy window and called an audible typist quiet.
  // Keystrokes are transients: sample the click band in 100ms windows
  // and count the windows that spike far above the median. Silence has
  // no spikes, however long the window.
  const hits = await page.evaluate(async () => {
    const ctx = window.__actx;
    const an = window.__an;
    const buf = new Float32Array(an.frequencyBinCount);
    const hzPerBin = ctx.sampleRate / an.fftSize;
    const b0 = Math.floor(2200 / hzPerBin);
    const b1 = Math.ceil(3400 / hzPerBin);
    an.smoothingTimeConstant = 0;
    const powers = [];
    for (let i = 0; i < 60; i++) {
      an.getFloatFrequencyData(buf);
      let s = 0;
      for (let b = b0; b <= b1; b++) s += Math.pow(10, buf[b] / 10);
      powers.push(s);
      await new Promise((r) => setTimeout(r, 100));
    }
    an.smoothingTimeConstant = 0.4;
    const sorted = [...powers].sort((a, b) => a - b);
    const median = sorted[(sorted.length / 2) | 0] || 1e-12;
    return powers.filter((v) => v > 4 * median).length;
  });
  check("the keyboards are typing", hits >= 3, `${hits} keystrokes heard in 6s`);
}

// Each temper's signature band, chosen where the hum has little to say:
// woe's weight sits at and below the mains pair, frolic's harmonic at
// 300Hz is far above every hum partial, dread's waver rides the second
// harmonic, and malice's distortion sprays energy above the hum's
// lowpass. The mix is bench-tuned by a human, so no broadband ratio can
// be asserted — but a voice that is playing at all lights its own band
// up by multiples, and one that has gone silent (which has now shipped
// three times) cannot.
const BANDS = { WO: [20, 60], FC: [250, 350], DR: [90, 120], MA: [200, 500] };
const base = {};
for (const t of Object.keys(BANDS)) base[t] = await bandPower(BANDS[t][0], BANDS[t][1]);

// Each temper's first solo orientation screen, found by structure rather
// than by index — the ramp planner reshuffles the queue.
const solos = await page.evaluate(() => {
  const out = {};
  window.__mdr.levels.forEach((l, i) => {
    if (l.selfAgitate && l.tempers.length === 1 && !(l.tempers[0] in out)) {
      out[l.tempers[0]] = i;
    }
  });
  return out;
});
for (const [name, lvl] of Object.entries(solos)) {
  await page.evaluate((i) => window.__mdr.startLevel(i), lvl);
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  await page.waitForTimeout(2500); // the crossfade is deliberately slow
  const p = await bandPower(BANDS[name][0], BANDS[name][1]);
  const gain = p / (base[name] || 1e-12);
  check(`${name} lights up its own band`, gain > 2,
    `${gain.toFixed(1)}x band power`);
}

// And a mute must take all of it away.
await page.evaluate(() => window.__mdr.setMuted(true));
await page.waitForTimeout(2500);
const mutedRms = await rms();
check("mute silences the bed and the hum", mutedRms < hum * 0.25,
  `rms ${mutedRms.toFixed(4)} vs hum ${hum.toFixed(4)}`);

await browser.close();
process.exit(summary());
