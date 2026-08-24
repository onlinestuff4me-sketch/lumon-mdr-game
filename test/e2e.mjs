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
  open, state, findGroup, touchFor, drag, tap, touchTap, load, setMode,
  boxAndBin, carryToBin, section, check, eq, summary,
} from "./harness.mjs";

const { browser, page, origin, errors, cdp } = await open();

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
    // And input still works afterwards — the real proof. A case that ends
    // holding a packet (pressing a group and dragging is a carry now)
    // proves it by binning that packet; the rest by lifting a new one.
    if (s.carrying) {
      check(`  input still live after: ${label}`, await carryToBin(page, origin, g));
    } else {
      const g2 = await findGroup(page);
      if (g2) {
        await tap(page, origin, await touchFor(page, g2.one, "marquee"));
        const s2 = await state(page);
        check(`  input still live after: ${label}`, s2.carrying);
        if (s2.carrying) await carryToBin(page, origin, g2);
      }
    }
    await load(page, 0);
  }
}

// ═══ 2. reachability: every part of the board and deck ═══════════════
section("reachability");
{
  await load(page, 30);            // calibration: four tempers, probe mode
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

  // The control deck must sit above the board, so it never crosses the path
  // a packet is dragged along.
  const deck = await page.evaluate(() => {
    const L = window.__mdr.layout;
    const el = [...document.querySelectorAll("*")].find((n) =>
      n.textContent?.trim().startsWith("MODE:"));
    const st = document.querySelector('[role="application"]').getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    return r
      ? { deckBottom: Math.round(r.bottom - st.top), gridTop: Math.round(L.grid.y),
          gridBottom: Math.round(L.grid.y + L.grid.h), binsTop: Math.round(L.h - L.binsH) }
      : null;
  });
  check("the control deck is above the board", !!deck && deck.deckBottom <= deck.gridTop + 2,
    JSON.stringify(deck));
  check("and nothing sits between the board and the bins",
    !!deck && deck.binsTop - deck.gridBottom < 4, JSON.stringify(deck));
}

// ═══ 3. full playthroughs ════════════════════════════════════════════
section("playthroughs");
{
  // Orientation, tap-only, all the way through a stage-3 screen.
  await load(page, 24);
  let guard = 0;
  while ((await state(page)).progress < 100 && guard++ < 10) {
    const g = await findGroup(page);
    if (!g) break;
    await tap(page, origin, await touchFor(page, g.one, "marquee"));
    if (!(await state(page)).carrying) break;
    await carryToBin(page, origin, g);
  }
  const s = await state(page);
  check("orientation 25/29 reaches 100% by tapping alone", s.progress === 100,
    `${s.progress}% after ${guard} attempts`);
}
{
  // A real file, boxed and carried — the marquee path must still work.
  await load(page, 31);
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
  await load(page, 40);            // JESUP — decoys
  const d = await findGroup(page, "decoy");
  check("decoy seeded", !!d);
  if (d) {
    // Tapping is available on every file now, so what has to hold here is
    // that the agitation gate still refuses an unprobed group — blind
    // tapping must never find what probing is for.
    await setMode(page, "select");
    await tap(page, origin, d.ctr);
    const t = await state(page);
    check("a tap lifts nothing unprobed, even on a late file", !t.carrying);
    check("and it says why", (t.message ?? "").includes("NO TEMPER"), t.message);
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
  await load(page, 45);            // COLD HARBOR — the fifth
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
  await load(page, 44);            // YAKIMA — redaction
  const red = (await state(page)).muted;
  await load(page, 38);            // MOONBEAM — not redacted
  const restored = (await state(page)).muted;
  check("redacted file mutes", red);
  check("the next file restores audio", !restored);
}

{
  // BELLINGHAM opens in PROBE and also allows tap-to-select, so the tap must
  // be hit-tested with the offset the lens is actually drawn at. Aiming the
  // lens at the group and tapping has to lift it.
  await load(page, 29);
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
  await load(page, 29);
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
  await load(page, 42);
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
  await load(page, 44);
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
  // Only the lens takes the big lift. A marquee corner and a carried packet
  // both sit just clear of the contact patch, so nothing jumps when a press
  // becomes a drag.
  eq("offsets by gesture", off, { probe: -68, marquee: -22, carry: -22 });

  await load(page, 0);
  const g = await findGroup(page);
  const at = await touchFor(page, g.one, "marquee");
  await tap(page, origin, at);
  const held = await state(page);
  check("the packet lifts", held.carrying);

  // The arrows are for the moment the box appears and the player asks
  // "where does this go?", so they must not wait.
  const hint = await page.evaluate(() => ({
    delay: window.__mdr.elapsed - window.__mdr.packetHeldAt,
    target: window.__mdr.getSnapshot().bins.filter((b) => b.target).map((b) => b.temper),
  }));
  check("the bin hint is showing immediately", hint.delay >= 0, `${hint.delay.toFixed(2)}s held`);
  eq("and exactly one bin is marked as the target", hint.target, [g.temper]);

  // Touching the box takes hold of it again: it comes to the thumb, at the
  // carry offset and nowhere else, and then it must not move again except
  // with the finger.
  const grab = await page.evaluate(async () => {
    const e = window.__mdr;
    const b = e.packetBounds(e.packet);
    const x = b.x + b.w / 2;
    const y = b.y + b.h / 2;
    const want = e.reticleFor(x, y, "carry");
    e.pointerDown(1, x, y);
    e.pointerMove(1, x, y);
    await new Promise((r) => setTimeout(r, 60));
    const settled = { x: e.packet.x, y: e.packet.y };
    e.pointerMove(1, x + 30, y - 25);
    await new Promise((r) => setTimeout(r, 60));
    const moved = { x: e.packet.x, y: e.packet.y };
    e.pointerUp(1, x + 30, y - 25);
    return {
      offBy: Math.round(Math.hypot(settled.x - want.x, settled.y - want.y)),
      drift: Math.round(
        Math.hypot(moved.x - settled.x - 30, moved.y - settled.y + 25),
      ),
      still: e.packet !== null,
    };
  });
  check("touching the box recentres it under the thumb", grab.offBy <= 2,
    `${grab.offBy}px from the carry reticle`);
  check("and it does not slip again while dragging", grab.drift <= 2,
    `${grab.drift}px unexplained`);
  check("touching the box never puts it down", grab.still);

  // Touching anywhere else on the board does put it down — the numbers go
  // back to the cells they came from, still found.
  const let_go = await page.evaluate(async () => {
    const e = window.__mdr;
    const id = e.packet.clusterId;
    const b = e.packetBounds(e.packet);
    const x = Math.min(e.layout.w - 6, b.x + b.w + 90);
    const y = Math.max(e.layout.grid.y + 8, b.y - 90);
    e.pointerDown(1, x, y);
    e.pointerUp(1, x, y);
    await new Promise((r) => setTimeout(r, 80));
    const c = e.board.clusters[id];
    return {
      carrying: e.packet !== null,
      onGrid: c.members.every((m) => !e.board.nodes[m].lifted),
      keptTemper: c.agitation > 0.2,
      open: e.gesture !== null,
    };
  });
  check("tapping outside the box releases the numbers", !let_go.carrying);
  check("and they go back to the grid", let_go.onGrid);
  check("still found, so they need no re-probing", let_go.keptTemper);
  check("gesture released after a release-tap", !let_go.open);

  const again = await findGroup(page);
  await tap(page, origin, again.ctr);
  check("and the released group can be taken again", (await state(page)).carrying);
  check("and it still carries to the bin", await carryToBin(page, origin, again));
}
{
  // Press on a group and drag: one motion, group to bin, no box in between.
  await load(page, 0);
  const g = await findGroup(page);
  const from = await touchFor(page, g.one, "marquee");
  const to = await touchFor(page, { x: g.bin.x + g.bin.w / 2, y: g.bin.y + g.bin.h / 2 }, "carry");
  await drag(page, origin, from, to);
  const s = await state(page);
  check("pressing a group and dragging carries it straight to the bin",
    s.progress === 100, `${s.progress}%  ${s.message}`);
  check("gesture released", !s.gestureOpen);
}
{
  // A tap anywhere over the group counts, not just within a pad of a glyph.
  // A five-digit group spread over two rows has gaps wider than the pad in
  // the middle of it, and taps landing there were being dropped.
  await load(page, 0);
  const g = await findGroup(page);
  const gaps = await page.evaluate(() => {
    const e = window.__mdr, b = e.board, c = b.clusters[0];
    const pts = c.members.map((m) => ({ x: b.nodes[m].hx + b.nodes[m].dx, y: b.nodes[m].hy + b.nodes[m].dy }));
    const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
    const y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
    // Sample the footprint and keep the points furthest from every glyph —
    // the ones a pad-only hit test would miss.
    let worst = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, d: 0 };
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const x = x0 + ((x1 - x0) * i) / 10;
        const y = y0 + ((y1 - y0) * j) / 10;
        const d = Math.min(...pts.map((p) => Math.hypot(p.x - x, p.y - y)));
        if (d > worst.d) worst = { x, y, d };
      }
    }
    return { worst, corners: [{ x: x0, y: y0 }, { x: x1, y: y1 }] };
  });
  check("the group has a gap wider than the 22px pad", gaps.worst.d > 22,
    `${gaps.worst.d.toFixed(0)}px from the nearest digit`);
  await tap(page, origin, await touchFor(page, gaps.worst, "marquee"));
  const inGap = await state(page);
  check("a tap in the middle of the group still lifts it", inGap.carrying,
    String(inGap.message));
  if (inGap.carrying) await carryToBin(page, origin, g);
}
{
  // The frame a press turns into a carry is where the box used to leap: the
  // gesture changed kind, and the two kinds carried different offsets.
  await load(page, 0);
  const g = await findGroup(page);
  const jump = await page.evaluate(async ({ x, y }) => {
    const e = window.__mdr;
    e.setMode("select");
    e.pointerDown(1, x, y);
    let prev = null;
    let worst = 0;
    for (let i = 0; i < 14; i++) {
      e.pointerMove(1, x, y + i * 6);
      await new Promise((r) => requestAnimationFrame(r));
      if (e.packet) {
        // Compare against the expected step, so only movement the finger
        // did not ask for counts.
        if (prev) worst = Math.max(worst, Math.abs(e.packet.y - prev - 6));
        prev = e.packet.y;
      }
    }
    const lifted = !!e.packet;
    e.pointerCancel(1);
    return { worst: Math.round(worst), lifted };
  }, await touchFor(page, g.one, "marquee"));
  check("pressing a group starts a carry", jump.lifted);
  check("and the box never leaps away from the finger", jump.worst <= 6,
    `${jump.worst}px unexplained movement`);
}
{
  // Starting on empty board still draws a box, so boxing stays available.
  await load(page, 24);
  const g = await findGroup(page);
  const pad = 26;
  await drag(
    page, origin,
    await touchFor(page, { x: g.min.x - pad, y: g.min.y - pad }, "marquee"),
    await touchFor(page, { x: g.max.x + pad, y: g.max.y + pad }, "marquee"),
  );
  const s = await state(page);
  check("a drag starting on empty board still boxes", s.carrying, String(s.message));
  if (s.carrying) check("and that packet carries too", await carryToBin(page, origin, g));
}

// ═══ 6. every tap on a group forms the box, first time ═══════════════
//
// The bug this section exists for: hit-testing happened at the *reticle*,
// which floats 22px (SELECT) or 68px (PROBE) above the finger, so the
// tappable region of a group sat below its own digits. A one-row group
// could not be tapped at all. Nothing caught it because every test aimed
// through `touchFor()`, which solves for the offset — the tests were
// tapping 22px below the numbers, and humans tap the numbers.
//
// So: no `touchFor` anywhere in this section. Raw coordinates, on the
// glyphs, the way a thumb does it.
section("taps land where the finger is");
{
  const SCREENS = [0, 4, 8, 12, 16, 20, 24, 28];
  let attempts = 0;
  const missed = [];
  const stuck = [];
  for (const level of SCREENS) {
    await load(page, level);
    if (!(await findGroup(page))) continue;
    // Nine points across the group's own footprint, corners included, plus
    // the exact centre of its topmost digit — the point that was dead.
    // Read off the LIVE footprint each time: these groups drift, and a
    // thumb aims at where the digits are now, which is the whole point.
    const frac = [];
    for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) frac.push([fx, fy]);
    frac.push(["top", "top"]);
    for (const [fx, fy] of frac) {
      const live = await findGroup(page);
      if (!live) break;
      const at =
        fx === "top"
          ? { x: live.ctr.x, y: live.min.y }
          : {
              x: live.min.x + (live.max.x - live.min.x) * fx,
              y: live.min.y + (live.max.y - live.min.y) * fy,
            };
      await tap(page, origin, at);
      const st = await state(page);
      attempts++;
      if (!st.carrying) {
        missed.push(`L${level} (${Math.round(at.x)},${Math.round(at.y)}) ${st.message ?? "silence"}`);
      } else {
        // Put it back rather than binning it, so every point in the sweep
        // is tested against the same group in the same place.
        await page.evaluate(() => {
          const e = window.__mdr;
          const b = e.packetBounds(e.packet);
          const x = Math.min(e.layout.w - 6, b.x + b.w + 100);
          const y = Math.max(e.layout.grid.y + 6, b.y - 100);
          e.pointerDown(1, x, y);
          e.pointerUp(1, x, y);
        });
        await page.waitForTimeout(60);
      }
      if ((await state(page)).gestureOpen) {
        stuck.push(`L${level} (${Math.round(at.x)},${Math.round(at.y)})`);
      }
    }
  }
  check("every tap inside a group's footprint lifts it",
    missed.length === 0, `${attempts - missed.length}/${attempts}${missed.length ? " — " + missed.slice(0, 6).join("; ") : ""}`);
  check("and none of them left a gesture open", stuck.length === 0,
    stuck.slice(0, 6).join("; "));
}
{
  // Duration must not decide. A considered press — down, think, up, no
  // movement — is a tap however long it took.
  await load(page, 8);
  const holds = [60, 150, 300, 500, 900];
  const bad = [];
  for (const ms of holds) {
    await load(page, 8);
    const g = await findGroup(page);
    await page.mouse.move(origin.x + g.ctr.x, origin.y + g.ctr.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(90);
    const st = await state(page);
    if (!st.carrying) bad.push(`${ms}ms: ${st.message ?? "nothing"}`);
    check(`  gesture released after a ${ms}ms press`, !st.gestureOpen);
  }
  check("a still press lifts the group however long it is held",
    bad.length === 0, bad.join("; "));
}
{
  // And a hand that wobbles and comes back is still a tap.
  await load(page, 8);
  const g = await findGroup(page);
  const wob = await page.evaluate(async ({ x, y }) => {
    const e = window.__mdr;
    e.pointerDown(1, x, y);
    for (const d of [6, 13, 16, 11, 3, 0]) e.pointerMove(1, x + d, y - d);
    await new Promise((r) => setTimeout(r, 320));
    e.pointerUp(1, x, y);
    await new Promise((r) => setTimeout(r, 80));
    return { carrying: e.packet !== null, open: e.gesture !== null };
  }, { x: g.ctr.x, y: g.ctr.y });
  check("a press that drifts 16px and returns still lifts", wob.carrying);
  check("gesture released after the wobble", !wob.open);
}
{
  // Two taps that miss must not silently flip an orientation screen into
  // PROBE — a mode that does nothing there, and that moves the aim another
  // 46px. Two near-misses used to make the file unplayable.
  await load(page, 8);
  const before = (await state(page)).mode;
  const g = await findGroup(page);
  await tap(page, origin, g.ctr);
  await tap(page, origin, g.ctr);
  const after = await state(page);
  check("tapping a group never toggles the mode", after.mode === before,
    `${before} -> ${after.mode}`);
}
{
  // The 900ms auto-advance window draws no scrim, so the board looks live.
  // A tap there must not be thrown away.
  await load(page, 0);
  let guard = 0;
  while ((await state(page)).progress < 100 && guard++ < 6) {
    const g = await findGroup(page);
    if (!g) break;
    await tap(page, origin, g.ctr);
    if (!(await state(page)).carrying) break;
    await carryToBin(page, origin, g);
  }
  const took = await page.evaluate(() => {
    const e = window.__mdr;
    if (e.getSnapshot().phase !== "complete") return "not in the window";
    e.pointerDown(1, 100, e.layout.grid.y + 40);
    const open = e.gesture !== null;
    e.pointerUp(1, 100, e.layout.grid.y + 40);
    return open ? "accepted" : "discarded";
  });
  check("a touch during the auto-advance window is not discarded",
    took !== "discarded", took);
}
{
  // A THUMB RESTING ON THE SCREEN MUST NOT KILL EVERY TAP.
  //
  // A phone held one-handed puts a finger on the bezel, and every touch
  // after the first one down is `isPrimary: false`. Refusing those meant
  // the tap never reached the engine at all — no message, no sound, no
  // timeout that could rescue it, for as long as the thumb stayed put.
  // Mouse events cannot express this, which is why the suite carries a CDP
  // touch path just for it.
  for (const rest of [{ x: 15, y: 300 }, { x: 370, y: 640 }]) {
    await load(page, 8);
    const g = await findGroup(page);
    await touchTap(cdp, origin, g.ctr, [rest]);
    const s = await state(page);
    check(`a tap lifts with a finger already resting at (${rest.x},${rest.y})`,
      s.carrying, s.message ?? "silence");
    check("  and the gesture is released", !s.gestureOpen);
  }
  {
    // ...but a drag already in flight is not something a stray touch may
    // steal. Only a gesture that has never moved is handed over.
    await load(page, 8);
    const g = await findGroup(page);
    const kept = await page.evaluate(async ({ x, y }) => {
      const e = window.__mdr;
      e.pointerDown(1, x, y);
      e.pointerMove(1, x + 40, y + 40);          // a real drag
      e.pointerDown(2, 20, 300);                 // a stray second finger
      const id = e.gesture?.id ?? null;
      e.pointerUp(1, x + 40, y + 40);
      await new Promise((r) => setTimeout(r, 80));
      return { id, open: e.gesture !== null };
    }, { x: g.ctr.x, y: g.ctr.y });
    check("a drag in flight is not stolen by a second finger", kept.id === 1,
      `gesture id ${kept.id}`);
    check("  and it still released", !kept.open);
  }
}
{
  // A group walks out from under a resting thumb. Woe droops, frolic skips,
  // malice lunges — and a considered press was measured failing 11.7% of
  // the time at 1200ms because the digits had moved on by the time the
  // finger lifted. What you touched is what you meant.
  const slipped = [];
  for (const level of [1, 4, 5, 10]) {
    for (const ms of [90, 400, 1200]) {
      await load(page, level);
      const g = await findGroup(page);
      await page.mouse.move(origin.x + g.ctr.x, origin.y + g.ctr.y - 10);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
      await page.waitForTimeout(90);
      const s = await state(page);
      if (!s.carrying) slipped.push(`L${level}@${ms}ms: ${s.message ?? "silence"}`);
      check(`  gesture released after L${level} ${ms}ms hold`, !s.gestureOpen);
    }
  }
  check("a group that drifts under a held finger is still lifted",
    slipped.length === 0, slipped.join("; "));
}
{
  // On a screen whose groups move by themselves, PROBE does nothing — so
  // no pair of taps, however placed, may put the file there.
  for (const level of [2, 5]) {
    await load(page, level);
    const before = (await state(page)).mode;
    const g = await findGroup(page);
    for (const at of [
      { x: g.ctr.x, y: g.min.y - 26 },        // a near miss above the group
      { x: 12, y: g.ctr.y },                  // and open board, far from it
    ]) {
      await tap(page, origin, at);
      await tap(page, origin, at);
    }
    const s = await state(page);
    check(`no pair of taps flips L${level} into a mode it has no use for`,
      s.mode === before, `${before} -> ${s.mode}`);
  }
}
{
  // A gesture that leaked — no pointerup will ever arrive for it — must not
  // brick the board forever.
  await load(page, 8);
  const revived = await page.evaluate(async () => {
    const e = window.__mdr;
    e.pointerDown(1, 100, e.layout.grid.y + 40);      // never released
    e.gesture.startT -= 9000;                          // as if long ago
    const c = e.board.clusters.find((k) => !k.refined);
    const n = e.board.nodes[c.members[0]];
    e.pointerDown(2, n.hx + n.dx, n.hy + n.dy);
    e.pointerUp(2, n.hx + n.dx, n.hy + n.dy);
    await new Promise((r) => setTimeout(r, 80));
    return { carrying: e.packet !== null, open: e.gesture !== null };
  });
  check("a stale gesture is taken over by the next touch", revived.carrying);
  check("and released again", !revived.open);
}

// ═══ 7. a file arrives, it does not appear ═══════════════════════════
section("arrival");
{
  // The groups emerge over two seconds. On the first frame the board must
  // be plainly still — that stillness is what makes the motion an event.
  await page.evaluate(() => window.__mdr.startLevel(4));
  const curve = await page.evaluate(async () => {
    const e = window.__mdr;
    const c = e.board.clusters.find((k) => !k.refined && !k.decoy);
    const out = [];
    const at = [0, 400, 900, 1500, 2600];
    let last = 0;
    for (const ms of at) {
      await new Promise((r) => setTimeout(r, ms - last));
      last = ms;
      out.push(Math.round(c.agitation * 100) / 100);
    }
    return out;
  });
  check("the board is still when the screen arrives", curve[0] <= 0.02, `${curve[0]}`);
  check("and it has not finished emerging half a second in",
    curve[1] < 0.6, `${curve[1]}`);
  check("motion only grows", curve.every((v, i) => i === 0 || v >= curve[i - 1] - 0.02),
    curve.join(" -> "));
  check("and it is fully up to speed by two and a half seconds",
    curve[4] > 0.95, curve.join(" -> "));

  // A later file has no emergence — its groups answer to a probe, and
  // making the refiner wait two seconds for nothing would be a bug.
  await load(page, 31);
  const settled = await page.evaluate(() => window.__mdr.settled);
  check("a probe file is ready as soon as it has been drawn", settled);
}
{
  // The scan pass between files: one beam down the board, erasing, then a
  // second painting the new file on. It must never take the board away
  // from the refiner — a transition that eats a touch is the bug this
  // game has already spent two rounds removing.
  await load(page, 0);
  let guard = 0;
  while ((await state(page)).progress < 100 && guard++ < 6) {
    const g = await findGroup(page);
    if (!g) break;
    await tap(page, origin, g.ctr);
    if (!(await state(page)).carrying) break;
    await carryToBin(page, origin, g);
  }
  const seen = await page.evaluate(async () => {
    const e = window.__mdr;
    const from = e.levelIndex;
    const phases = new Set();
    let acceptedDuringWipe = null;
    for (let i = 0; i < 120; i++) {
      if (e.wipe) {
        phases.add(e.wipe.phase);
        if (acceptedDuringWipe === null) {
          e.pointerDown(90, 100, e.layout.grid.y + 40);
          acceptedDuringWipe = e.gesture !== null;
          e.pointerUp(90, 100, e.layout.grid.y + 40);
        }
      }
      if (e.levelIndex !== from && !e.wipe) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return {
      phases: [...phases].sort(),
      advanced: e.levelIndex !== from,
      acceptedDuringWipe,
      open: e.gesture !== null,
    };
  });
  eq("the file is erased and then painted back on", seen.phases, ["in", "out"]);
  check("and the next file actually arrives", seen.advanced);
  check("a touch during the transition is not discarded", seen.acceptedDuringWipe);
  check("and it left no gesture open", !seen.open);
}

// ═══ 8. the room plays the temper of what is on it ═══════════════════
section("ambient temper");
{
  await load(page, 0);                       // one group, one temper
  const solo = await page.evaluate(() => {
    const e = window.__mdr;
    const c = e.board.clusters.find((k) => !k.refined && !k.decoy && !k.fifth);
    return { bed: e.ambientTemper(), group: c.temper };
  });
  eq("one group on screen: the bed is that group", solo.bed, solo.group);

  await load(page, 28);                      // four groups, four tempers
  const many = await page.evaluate(() => {
    const e = window.__mdr;
    const g = e.layout.grid;
    const cx = g.x + g.w / 2;
    const cy = g.y + g.h / 2;
    let best = null;
    let bestD = Infinity;
    for (const c of e.board.clusters) {
      if (c.refined || c.decoy || c.fifth) continue;
      const d = Math.hypot(c.cx - cx, c.cy - cy);
      if (d < bestD) { bestD = d; best = c; }
    }
    return { bed: e.ambientTemper(), central: best.temper, n: e.board.clusters.length };
  });
  check("several groups: the bed is the most central one",
    many.bed === many.central, `${many.bed} vs ${many.central} of ${many.n}`);

  const g = await findGroup(page);
  const other = await page.evaluate((id) => {
    const e = window.__mdr;
    const c = e.board.clusters.find((k) => k.id !== id && !k.refined && !k.decoy);
    return c ? c.temper : null;
  }, g.id);
  await tap(page, origin, g.ctr);
  const held = await page.evaluate(() => ({
    carrying: window.__mdr.packet !== null,
    bed: window.__mdr.ambientTemper(),
  }));
  check("the packet lifted", held.carrying);
  check("holding a group: the bed follows it into the hand",
    held.bed === g.temper, `${held.bed} vs ${g.temper}`);
  if (other && other !== g.temper) {
    check("  and it is no longer the other group's", held.bed !== other);
  }
  check("and it still carries to the bin", await carryToBin(page, origin, g));

  // A decoy has no temper to give off, and the fifth is never named.
  await load(page, 45);                      // COLD HARBOR — carries the fifth
  const quiet = await page.evaluate(() => {
    const e = window.__mdr;
    const f = e.board.clusters.find((k) => k.fifth);
    if (!f) return null;
    e.board.clusters.forEach((c) => { if (c !== f) c.refined = true; });
    return e.ambientTemper();
  });
  check("the fifth temper gives off nothing", quiet === null, String(quiet));
}

// ═══ 9. the bin catches what is brought near it ══════════════════════
section("bin catch");
{
  // The packet's centre is what is tested, and the box is a hundred pixels
  // wide — demanding the centre fully inside the bin meant drops released
  // at its top edge fell back into the hand.
  const dropAt = async (dy) => {
    await load(page, 0);
    const g = await findGroup(page);
    await tap(page, origin, g.ctr);
    if (!(await state(page)).carrying) return "no packet";
    return page.evaluate(async (offset) => {
      const e = window.__mdr;
      const r = Object.values(e.layout.binRects).find((b) => b.w > 0);
      const x = r.x + r.w / 2;
      const y = r.y + offset;
      const b = e.packetBounds(e.packet);
      e.pointerDown(1, b.x + b.w / 2, b.y + b.h / 2);
      e.pointerMove(1, x, y + 40);
      // Land the packet centre itself at the probe point: the drop tests
      // where the box is, not where the finger is.
      const want = { x, y };
      const cur = { x: e.packet.x, y: e.packet.y };
      e.pointerMove(1, x + (want.x - cur.x), y + 40 + (want.y - cur.y));
      e.pointerUp(1, x + (want.x - cur.x), y + 40 + (want.y - cur.y));
      await new Promise((res) => setTimeout(res, 150));
      return e.packet === null
        ? (e.getSnapshot().progress > 0.99 ? "binned" : "released")
        : "held";
    }, dy);
  };
  eq("a drop 40px above the bin still lands in it", await dropAt(-40), "binned");
  eq("a drop far above the bin stays in hand", await dropAt(-110), "held");
}

// ═══ 10. saves: continue, new, load ══════════════════════════════════
section("saves");
{
  const boot = async () => {
    await page.reload();
    await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  };
  // A terminal nobody has worked at: the briefing offers orientation, and
  // no continue button exists to mislead.
  await page.evaluate(() => localStorage.removeItem("lumon.mdr.runs.v1"));
  await boot();
  check("fresh terminal offers BEGIN ORIENTATION",
    (await page.getByText("BEGIN ORIENTATION").count()) === 1);
  check("and no CONTINUE", (await page.getByText("CONTINUE —").count()) === 0);

  // Complete one file; the bookmark must survive a full reload.
  await load(page, 0);
  let guard = 0;
  while ((await state(page)).progress < 100 && guard++ < 6) {
    const g = await findGroup(page);
    if (!g) break;
    await tap(page, origin, g.ctr);
    if (!(await state(page)).carrying) break;
    await carryToBin(page, origin, g);
  }
  await page.waitForTimeout(400);
  await boot();
  check("after a completed file, CONTINUE is the offer",
    (await page.getByText("CONTINUE —").count()) === 1);
  check("with a new-save escape hatch",
    (await page.getByText("BEGIN A NEW SAVE").count()) === 1);
  check("and one previous save listed",
    (await page.getByText("LOAD A PREVIOUS SAVE (1)").count()) === 1);

  // Continue resumes one past the furthest completed file.
  await page.getByText("CONTINUE —").click();
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  eq("continue lands on the next file",
    await page.evaluate(() => window.__mdr.levelIndex), 1);

  // A new save starts from nothing — and the old attempt survives it.
  await boot();
  await page.getByText("BEGIN A NEW SAVE").click();
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  eq("a new save starts at the beginning",
    await page.evaluate(() => window.__mdr.levelIndex), 0);
  await boot();
  check("both attempts are now listed",
    (await page.getByText("LOAD A PREVIOUS SAVE (2)").count()) === 1);

  // Loading the older attempt picks up ITS bookmark, not the new one's.
  await page.getByText("LOAD A PREVIOUS SAVE (2)").click();
  await page.getByText("1/46 FILES").click();
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  eq("loading the older save resumes its own place",
    await page.evaluate(() => window.__mdr.levelIndex), 1);
}

// ═══ 11. nothing threw ═══════════════════════════════════════════════
section("console");
check("no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
process.exit(summary());
