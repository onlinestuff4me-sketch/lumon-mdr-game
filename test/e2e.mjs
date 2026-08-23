/**
 * End-to-end regression suite, driven entirely by pointer events.
 *
 * THE RULE THIS SUITE EXISTS TO ENFORCE: never assert a state transition
 * without completing the interaction that follows it. The regression that
 * prompted this file was a leaked gesture — tap-to-select worked perfectly,
 * and every touch after it was silently discarded. A test that stopped at
 * "the packet lifted" passed while the game was unplayable.
 *
 * So every gesture test below ends by checking the engine is ready for the
 * NEXT gesture, and the playthroughs run a whole file to 100%.
 */
import {
  open, state, findGroup, touchFor, drag, tap, load, setMode,
  boxAndBin, carryToBin, section, check, eq, summary,
} from "./harness.mjs";

const { browser, page, origin, errors } = await open();

// ═══ 1. the gesture never leaks ══════════════════════════════════════
section("gesture lifecycle");
{
  await load(page, 0);
  const g = await findGroup(page);
  await tap(page, origin, await touchFor(page, g.one, "marquee"));
  const afterTap = await state(page);
  check("tap lifts the group", afterTap.carrying);
  check("gesture released after tap-lift", !afterTap.gestureOpen);
  check("marquee cleared after tap-lift", !afterTap.marqueeActive);

  // THE REGRESSION. The packet is in hand; the next drag must reach the bin.
  const binned = await carryToBin(page, origin, g);
  check("packet can still be dragged to the bin after a tap-lift", binned);
  const after = await state(page);
  check("bin filled", after.progress === 100 || after.bins[0].endsWith(":100"),
    after.bins.join(" "));
  check("gesture released after the carry", !after.gestureOpen);
}

{
  // Every terminating path must release the gesture, not just the happy one.
  await load(page, 0);
  const g = await findGroup(page);
  const cases = [
    ["tap on empty board", async () => tap(page, origin, { x: 14, y: 200 })],
    ["zero-length drag", async () => drag(page, origin, { x: 40, y: 300 }, { x: 41, y: 301 })],
    ["box containing nothing", async () => drag(page, origin, { x: 20, y: 250 }, { x: 60, y: 290 })],
    ["drag off the top edge", async () => drag(page, origin, g.ctr, { x: g.ctr.x, y: -40 })],
    ["cancelled pointer", async () => {
      await page.mouse.move(origin.x + g.ctr.x, origin.y + g.ctr.y);
      await page.mouse.down();
      await page.waitForTimeout(80);
      await page.evaluate(() => window.__mdr.pointerCancel(1));
      await page.mouse.up().catch(() => {});
      await page.waitForTimeout(80);
    }],
  ];
  for (const [label, run] of cases) {
    await run();
    const s = await state(page);
    check(`gesture released: ${label}`, !s.gestureOpen);
    // And input still works afterwards — the real proof.
    const g2 = await findGroup(page);
    if (g2) {
      await tap(page, origin, await touchFor(page, g2.one, "marquee"));
      const s2 = await state(page);
      check(`  input still live after: ${label}`, s2.carrying);
      if (s2.carrying) await carryToBin(page, origin, g2);
      await load(page, 0);
    }
  }
}

// ═══ 2. reachability: every part of the board and deck ═══════════════
section("reachability");
{
  await load(page, 22);            // calibration: four tempers, probe mode
  const reach = await page.evaluate(() => {
    const e = window.__mdr;
    const L = e.layout;
    const out = { deadRowsBottom: 0, binsReachable: 0, bins: 0 };
    // Can a touch put the reticle on the last board row?
    const lastRow = L.grid.y + L.grid.h - 6;
    for (const kind of ["probe", "marquee"]) {
      let best = Infinity;
      for (let t = 0; t <= L.h; t += 0.5) {
        best = Math.min(best, Math.abs(e.reticleFor(200, t, kind).y - lastRow));
      }
      if (best > 4) out.deadRowsBottom++;
    }
    // Can a touch land inside every bin?
    for (const t of e.getSnapshot().activeTempers) {
      const r = L.binRects[t];
      out.bins++;
      let hit = false;
      for (let ty = 0; ty <= L.h && !hit; ty += 0.5) {
        const p = e.reticleFor(r.x + r.w / 2, ty, "carry");
        hit = p.y >= r.y && p.y <= r.y + r.h;
      }
      if (hit) out.binsReachable++;
    }
    return out;
  });
  eq("bottom board row reachable by probe and marquee", reach.deadRowsBottom, 0);
  eq("every bin reachable while carrying", reach.binsReachable, reach.bins);
}

// ═══ 3. full playthroughs ════════════════════════════════════════════
section("playthroughs");
{
  // Orientation, tap-only, all the way through a stage-3 screen.
  await load(page, 16);
  let guard = 0;
  while ((await state(page)).progress < 100 && guard++ < 10) {
    const g = await findGroup(page);
    if (!g) break;
    await tap(page, origin, await touchFor(page, g.one, "marquee"));
    if (!(await state(page)).carrying) break;
    await carryToBin(page, origin, g);
  }
  const s = await state(page);
  check("orientation 17/21 reaches 100% by tapping alone", s.progress === 100,
    `${s.progress}% after ${guard} attempts`);
}
{
  // A real file, boxed and carried — the marquee path must still work.
  await load(page, 23);
  let guard = 0;
  while ((await state(page)).progress < 100 && guard++ < 12) {
    let g = await findGroup(page);
    if (!g) break;
    await setMode(page, "probe");
    const at = await touchFor(page, g.ctr, "probe");
    await page.mouse.move(origin.x + at.x, origin.y + at.y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(120);
    // Re-find: an agitated group is not where an idle one was. Woe droops
    // ~4px under probing, and boxing its pre-probe footprint can miss.
    // The engine hit-tests live positions, so the test must too.
    g = (await findGroup(page)) ?? g;
    await setMode(page, "select");
    if (!(await boxAndBin(page, origin, g))) break;
  }
  const s = await state(page);
  check("DRANESVILLE reaches 100% by probe + box + carry", s.progress === 100,
    `${s.progress}%`);
}

// ═══ 4. teaching mechanics hold their contracts ══════════════════════
section("mechanics");
{
  await load(page, 0);
  const still = await page.evaluate(async () => {
    const b = window.__mdr.board;
    const cl = new Set(b.clusters[0].members);
    const a = b.nodes.map((n) => [n.dx, n.dy]);
    let group = 0, filler = 0;
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      b.nodes.forEach((n, k) => {
        const d = Math.hypot(n.dx - a[k][0], n.dy - a[k][1]);
        if (cl.has(k)) group = Math.max(group, d); else filler = Math.max(filler, d);
      });
    }
    return { group: +group.toFixed(2), filler: +filler.toFixed(2), probe: b.clusters[0].probe };
  });
  check("orientation group moves untouched", still.group > 3 * still.filler,
    `group ${still.group}px vs filler ${still.filler}px`);
  eq("and drives no audio (probe stays 0)", still.probe, 0);
}
{
  await load(page, 32);            // JESUP — decoys
  const d = await findGroup(page, "decoy");
  check("decoy seeded", !!d);
  if (d) {
    // Tap-to-select is a teaching-screen affordance and JESUP is not one, so
    // a tap here must do nothing at all — and must not eat the gesture.
    await setMode(page, "select");
    await tap(page, origin, await touchFor(page, d.one, "marquee"));
    const t = await state(page);
    check("a tap lifts nothing on a file without tapToSelect", !t.carrying);
    check("gesture released after that tap", !t.gestureOpen);

    // Boxing it is the shipped path, and it must refuse with the honest
    // message rather than the generic "probe harder" a decoy can never
    // satisfy.
    await setMode(page, "probe");
    const at = await touchFor(page, d.ctr, "probe");
    await page.mouse.move(origin.x + at.x, origin.y + at.y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    await page.waitForTimeout(100);
    const d2 = (await findGroup(page, "decoy")) ?? d;
    await setMode(page, "select");
    await drag(
      page, origin,
      await touchFor(page, { x: d2.min.x - 10, y: d2.min.y - 10 }, "marquee"),
      await touchFor(page, { x: d2.max.x + 10, y: d2.max.y + 10 }, "marquee"),
    );
    const s = await state(page);
    check("a decoy cannot be boxed into a packet", !s.carrying);
    check("and it says NO TEMPER DETECTED", s.message === "NO TEMPER DETECTED",
      String(s.message));
    check("gesture released after a refused decoy", !s.gestureOpen);
  }
}
{
  await load(page, 37);            // COLD HARBOR — the fifth
  const f = await findGroup(page, "fifth");
  check("fifth temper seeded on cold harbor", !!f);
  if (f) {
    const leak = await page.evaluate(() => {
      const c = window.__mdr.board.clusters.find((k) => k.fifth);
      return { named: c.temper, decoy: c.decoy };
    });
    check("fifth borrows a real temper name (no tell)", !!leak.named);
  }
}
{
  await load(page, 36);            // YAKIMA — redaction
  const red = (await state(page)).muted;
  await load(page, 31);
  const restored = (await state(page)).muted;
  check("redacted file mutes", red);
  check("the next file restores audio", !restored);
}

{
  // BELLINGHAM opens in PROBE and also allows tap-to-select, so the tap must
  // be hit-tested with the offset the lens is actually drawn at. Aiming the
  // lens at the group and tapping has to lift it.
  await load(page, 21);
  const surfaced = await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      if (window.__mdr.board.clusters[0].agitation > 0.4) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  });
  check("bellingham's group surfaces on its own", surfaced);
  const g = await findGroup(page);
  await tap(page, origin, await touchFor(page, g.one, "probe"));
  const s = await state(page);
  check("aiming the lens and tapping lifts the group", s.carrying, String(s.message));
  check("gesture released", !s.gestureOpen);
  if (s.carrying) {
    check("and it can be carried to the bin", await carryToBin(page, origin, g));
  }
}
{
  // A tap must refuse exactly what a box refuses. On the pulse file the
  // group is hidden five seconds out of seven; blind-tapping while it is
  // down would lift it with no probing and take the lesson with it.
  await load(page, 21);
  const sank = await page.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      if (window.__mdr.board.clusters[0].agitation < 0.05) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  });
  check("the group sinks again", sank);
  const g = await findGroup(page);
  await tap(page, origin, await touchFor(page, g.one, "probe"));
  const s = await state(page);
  check("a tap cannot lift an unprobed group", !s.carrying, String(s.message));
  check("and it says why", s.message === "NO TEMPER DETECTED — PROBE FIRST",
    String(s.message));
}
{
  // The morph must not consume a quota cluster — that softlocks NANNING.
  await load(page, 34);
  const supply = await page.evaluate(() => {
    const e = window.__mdr;
    const counts = {};
    for (const c of e.board.clusters) {
      if (c.decoy || c.fifth) continue;
      counts[c.temper] = (counts[c.temper] ?? 0) + 1;
    }
    const m = e.board.clusters.find((c) => c.morph);
    return { counts, quota: e.quota, from: m?.temper, to: m?.morphTo,
             tempers: [...e.getSnapshot().activeTempers] };
  });
  check("a morphing cluster exists and is an extra", !!supply.from && !!supply.to);
  const after = { ...supply.counts };
  after[supply.from]--;
  after[supply.to] = (after[supply.to] ?? 0) + 1;
  check("every bin is still fillable once the morph fires",
    supply.tempers.every((t) => (after[t] ?? 0) >= supply.quota),
    `${JSON.stringify(after)} quota ${supply.quota}`);
}
{
  // A self-advancing screen must not flash a completion banner.
  await load(page, 0);
  const g = await findGroup(page);
  await tap(page, origin, await touchFor(page, g.one, "marquee"));
  await carryToBin(page, origin, g);
  const banner = await page.evaluate(() =>
    [...document.querySelectorAll("h1")].some((h) => h.textContent.trim() === "100%"));
  check("no 100% banner on a screen that advances itself", !banner);
  await page.waitForTimeout(1400);
  eq("and it advanced", (await state(page)).level, 1);
}
{
  // A redacted file's forced mute must never reach saved settings.
  await page.evaluate(() => window.__mdr.setMuted(false));
  await load(page, 36);
  await page.evaluate(() => window.__mdr.setAssist(true));
  const stored = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("lumon.mdr.settings.v1") ?? "{}").muted; }
    catch { return "unreadable"; }
  });
  check("a setting written during a redacted file does not persist its mute",
    stored === false, `stored muted=${JSON.stringify(stored)}`);
  await page.evaluate(() => window.__mdr.setAssist(false));
}

// ═══ 5. offsets and the bin hint ═════════════════════════════════════
section("reticle and hint");
{
  const off = await page.evaluate(() => {
    const e = window.__mdr;
    const y = e.layout.grid.y + 200;
    return {
      probe: Math.round(e.reticleFor(150, y, "probe").y - y),
      marquee: Math.round(e.reticleFor(150, y, "marquee").y - y),
      carry: Math.round(e.reticleFor(150, y, "carry").y - y),
    };
  });
  eq("offsets by gesture", off, { probe: -68, marquee: -22, carry: -68 });

  await load(page, 0);
  const g = await findGroup(page);
  await tap(page, origin, await touchFor(page, g.one, "marquee"));
  const early = await page.evaluate(() => window.__mdr.elapsed - window.__mdr.packetHeldAt);
  check("bin hint is silent immediately after a lift", early < 1.1, `${early.toFixed(2)}s`);
  await page.waitForTimeout(1500);
  const late = await page.evaluate(() => window.__mdr.elapsed - window.__mdr.packetHeldAt);
  check("bin hint appears once the player hesitates", late > 1.1, `${late.toFixed(2)}s`);
  check("and the packet is still draggable while hinting",
    await carryToBin(page, origin, g));
}

// ═══ 6. nothing threw ════════════════════════════════════════════════
section("console");
check("no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
process.exit(summary());
