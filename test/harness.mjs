/**
 * Shared plumbing for the end-to-end suite.
 *
 * Everything here drives the game the way a thumb does: real pointer events
 * at real speeds, against live glyph positions. Nothing calls an engine
 * method to make progress happen — the engine handle is read-only in these
 * tests, used for assertions and for finding targets, never for cheating
 * past a gesture. A test that reaches into the engine to advance the game
 * cannot catch an input bug, which is the whole reason this file exists.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright";

export const URL = process.env.MDR_URL ?? "http://127.0.0.1:5178/";
export const VIEWPORT = { width: 390, height: 844 };

let failures = 0;
let checks = 0;

export function section(name) {
  console.log(`\n── ${name} ${"─".repeat(Math.max(0, 58 - name.length))}`);
}

export function check(label, ok, detail = "") {
  checks++;
  if (!ok) failures++;
  const mark = ok ? "  ok  " : "  FAIL";
  console.log(`${mark} ${label}${detail ? `  ${detail}` : ""}`);
  return ok;
}

export function eq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  return check(label, ok, ok ? "" : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

export function summary() {
  console.log(
    `\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} checks`,
  );
  return failures;
}

/**
 * Use the sandbox's pre-installed Chromium when it is there, and Playwright's
 * own download otherwise — CI installs one and has no /opt/pw-browsers.
 */
function browserPath() {
  if (process.env.MDR_CHROMIUM) return process.env.MDR_CHROMIUM;
  const sandboxed = "/opt/pw-browsers/chromium";
  return existsSync(sandboxed) ? sandboxed : undefined;
}

export async function open() {
  const exe = browserPath();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/fonts\.g/.test(m.text())) {
      errors.push(`console: ${m.text()}`);
    }
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  const origin = await page.evaluate(() => {
    const r = document.querySelector('[role="application"]').getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  return { browser, page, origin, errors };
}

/** Engine snapshot, plus the few internals the assertions need. */
export const state = (page) =>
  page.evaluate(() => {
    const e = window.__mdr;
    const s = e.getSnapshot();
    return {
      level: s.levelIndex,
      name: s.levelName,
      stage: s.stage,
      phase: s.phase,
      mode: s.mode,
      progress: Math.round(s.progress * 100),
      carrying: s.carrying,
      message: s.message,
      muted: s.muted,
      bins: s.bins.map((b) => `${b.temper}:${Math.round(b.fill * 100)}`),
      // The field whose leak bricked all input once. Every gesture test
      // asserts it is released.
      gestureOpen: e.gesture !== null,
      marqueeActive: e.marquee.active,
      reticleActive: e.reticle.active,
    };
  });

/** Solve the reticle taper: what must the finger touch for the reticle of
 *  `kind` to land on this board point? Uses the engine's own function, so a
 *  change to the offsets moves the tests with it rather than breaking them. */
export const touchFor = (page, pt, kind = "probe") =>
  page.evaluate(
    ({ x, y, k }) => {
      const e = window.__mdr;
      let best = y;
      let err = Infinity;
      for (let t = 0; t <= e.layout.h; t += 0.5) {
        const d = Math.abs(e.reticleFor(x, t, k).y - y);
        if (d < err) {
          err = d;
          best = t;
        }
      }
      return { x, y: best };
    },
    { x: pt.x, y: pt.y, k: kind },
  );

/** A group's live geometry: where its digits are being drawn right now. */
export const findGroup = (page, kind = "real") =>
  page.evaluate((k) => {
    const e = window.__mdr;
    const b = e.board;
    const pick =
      k === "decoy"
        ? (c) => c.decoy
        : k === "fifth"
          ? (c) => c.fifth
          : (c) => !c.refined && !c.decoy && !c.fifth && !b.nodes[c.members[0]].retired;
    const c = b.clusters.filter(pick)[0];
    if (!c) return null;
    const xs = c.members.map((m) => b.nodes[m].hx + b.nodes[m].dx);
    const ys = c.members.map((m) => b.nodes[m].hy + b.nodes[m].dy);
    return {
      id: c.id,
      temper: c.temper,
      size: c.members.length,
      one: { x: xs[0], y: ys[0] },
      min: { x: Math.min(...xs), y: Math.min(...ys) },
      max: { x: Math.max(...xs), y: Math.max(...ys) },
      ctr: {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      },
      bin: e.layout.binRects[c.temper],
    };
  }, kind);

/** Walk a drag along its real path at hand speed, with a settle at each end,
 *  so a gesture costs what a gesture costs. */
export async function drag(page, origin, from, to, speed = 750) {
  await page.mouse.move(origin.x + from.x, origin.y + from.y);
  await page.mouse.down();
  await page.waitForTimeout(50);
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(2, Math.round(d / 14));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(
      origin.x + from.x + (to.x - from.x) * t,
      origin.y + from.y + (to.y - from.y) * t,
    );
    await page.waitForTimeout(((d / speed) * 1000) / steps);
  }
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(80);
}

export async function tap(page, origin, at) {
  await page.mouse.move(origin.x + at.x, origin.y + at.y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(120);
}

/** Load a file. Allowed as *setup* — never to make progress inside a test. */
export const load = async (page, index) => {
  await page.evaluate((i) => window.__mdr.startLevel(i), index);
  await page.waitForTimeout(350);
};

export const setMode = (page, mode) =>
  page.evaluate((m) => window.__mdr.setMode(m), mode);

/** Box a group and carry it to its bin, entirely through pointer events. */
export async function boxAndBin(page, origin, g, pad = 10) {
  await drag(
    page,
    origin,
    await touchFor(page, { x: g.min.x - pad, y: g.min.y - pad }, "marquee"),
    await touchFor(page, { x: g.max.x + pad, y: g.max.y + pad }, "marquee"),
  );
  if (!(await state(page)).carrying) return false;
  return carryToBin(page, origin, g);
}

export async function carryToBin(page, origin, g) {
  const from = await page.evaluate(() => ({
    x: window.__mdr.packet.x,
    y: window.__mdr.packet.y,
  }));
  await drag(
    page,
    origin,
    await touchFor(page, from, "carry"),
    await touchFor(page, { x: g.bin.x + g.bin.w / 2, y: g.bin.y + g.bin.h / 2 }, "carry"),
  );
  return !(await state(page)).carrying;
}
