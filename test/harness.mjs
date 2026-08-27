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
  // hasTouch, so the suite can dispatch real multi-touch through CDP. The
  // bug that made this necessary — a resting finger silently killing every
  // tap — only exists for touch pointers; a mouse has no second pointer.
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    hasTouch: true,
  });
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
  const cdp = await ctx.newCDPSession(page);
  return { browser, page, origin, errors, cdp };
}

/**
 * A real touch, in stage coordinates, optionally with other fingers already
 * resting on the screen. `page.mouse` cannot express this and it is the only
 * way to reach the multi-touch paths.
 */
export async function touchTap(cdp, origin, at, resting = [], holdMs = 90) {
  const pt = (p, id) => ({ x: origin.x + p.x, y: origin.y + p.y, id });
  const held = resting.map((p, i) => pt(p, i + 1));
  const tapId = held.length + 1;
  for (let i = 0; i < held.length; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: held.slice(0, i + 1),
    });
  }
  await new Promise((r) => setTimeout(r, 120));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [...held, pt(at, tapId)],
  });
  await new Promise((r) => setTimeout(r, holdMs));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [pt(at, tapId)],
  });
  await new Promise((r) => setTimeout(r, 120));
  if (held.length) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: held,
    });
    await new Promise((r) => setTimeout(r, 80));
  }
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
      // False while a finished file's meters are still running out to
      // their ends. Every end-of-file overlay waits on it.
      settled: s.settled,
    };
  });

/**
 * Wait out the beat a finished file gets to itself.
 *
 * The engine holds a completed board for 600ms so the bin meters and the
 * header meter are seen to reach 100% before anything covers them. A test
 * that asserts on an end-of-file overlay has to wait for the same signal
 * the overlays wait for, or it is asserting on a frame the refiner never
 * sees either.
 */
export const settled = (page) =>
  page.waitForFunction(
    () => window.__mdr.getSnapshot().settled,
    null,
    { timeout: 4000 },
  );

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

/**
 * Accept any incentive standing between a completed screen and the next
 * one, and return how many there were.
 *
 * A completed screen may now be holding the board while it hands the
 * refiner something — that is the feature, and it is asserted directly in
 * the incentives section. Everywhere else the reward is beside the point:
 * a test about the wipe, or about a touch during the auto-advance window,
 * wants the transition it was always about, whether or not that particular
 * screen happened to cross a threshold. This clears the way without
 * pretending the cards are not there.
 */
export async function settleIncentives(page) {
  // Three controls carry the sequence: the card's own action (OPEN,
  // CONTINUE, FILE), the landing screen that follows the last card, and
  // the notice a closed record raises. A test that is trying to get back
  // to a board has to clear all of them.
  const action = page.locator(
    "[data-reward-action], [data-record-landing], [data-record-notice]",
  );
  // A finished file holds its meters for 600ms before any overlay may be
  // drawn over them, so "nothing on screen" is not a true answer until
  // that window has passed — counting immediately after the last packet
  // lands reports an empty screen and then leaves a card standing on the
  // board for the rest of the test. Ask the engine rather than guessing a
  // delay: a fixed wait long enough to be safe is also long enough for a
  // screen with nothing owed to advance out from under the caller.
  await page
    .waitForFunction(
      () => {
        const s = window.__mdr?.getSnapshot?.();
        return !s || s.phase !== "complete" || s.settled;
      },
      null,
      { timeout: 3000 },
    )
    .catch(() => {});
  await page.waitForTimeout(120);
  let cleared = 0;
  for (let i = 0; i < 20; i++) {
    if ((await action.count()) === 0) break;
    // The last card of a boundary takes about two thirds of a second to
    // fly into the record; clicking through that is how a test ends up
    // racing an element that is on its way out of the DOM.
    await action.first().click({ timeout: 4000 }).catch(() => {});
    cleared++;
    await page.waitForTimeout(420);
  }
  return cleared;
}

/** Load a file. Allowed as *setup* — never to make progress inside a test. */
/**
 * Load a file and wait for it to be ready to play, not for a fixed time.
 *
 * A file arrives behind a scan pass, and an orientation screen's groups
 * then take two seconds to come up to full motion — so a fixed delay is
 * either a flake or a lie about what the refiner is looking at. The engine
 * says when it has settled, which keeps these waits correct if either
 * timing changes.
 */
export const load = async (page, index) => {
  await page.evaluate((i) => window.__mdr.startLevel(i), index);
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  await page.waitForTimeout(60);
};

/** Level index by file name — the queue reshuffles as the ramp is tuned,
 *  and a test pinned to a number breaks on every reshuffle. */
export const byName = async (page, name) => {
  const i = await page.evaluate(
    (n) => window.__mdr.levels.findIndex((l) => l.name === n),
    name,
  );
  if (i < 0) throw new Error(`no level named ${name}`);
  return i;
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
