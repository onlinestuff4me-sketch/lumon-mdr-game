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
  boxAndBin, carryToBin, byName, section, check, eq, summary, settleIncentives,
  lastTrainingIndex, orientationIndices, refineFile, readLedger, writeLedger,
  carryToWrongBin, findGroupToBin, carryHeldToItsBin, groupById,
  settled, beginRefining,
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
    ["canceled pointer", async () => {
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
  await load(page, await byName(page, "CALIBRATION")); // four tempers, probe mode
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
  // Nothing may sit between the board and the bins: down there it would cut
  // across the path every packet is dragged along. The mode deck used to
  // be the thing this was guarding against; it is gone entirely now — the
  // board decides probe from select by what the refiner does — and the
  // guard still has to hold for whatever is put there next.
  const bands = await page.evaluate(() => {
    const L = window.__mdr.layout;
    const modes = [...document.querySelectorAll("*")].some((n) =>
      n.textContent?.trim().startsWith("MODE:"));
    const record = document.querySelector('[data-record-box="hud"]');
    return {
      recordDrawn: !!record,
      modes,
      gridBottom: Math.round(L.grid.y + L.grid.h),
      binsTop: Math.round(L.binsTop),
      gap: L.gap,
      recordTop: Math.round(L.recordTop),
      binsH: L.binsH,
      recordAt: L.recordAt,
      hudTop: Math.round(L.hudTop),
      hudH: L.hudH,
      hudAt: L.hudAt,
      h: L.h,
    };
  });
  check("there is no mode switch to press", !bands.modes);
  // The two doors out of the game, both in the header, both labelled.
  {
    const hb = page.locator("[data-handbook]");
    check("the handbook is a labelled button, not a lone question mark",
      (await hb.innerText()).includes("HANDBOOK"));
    check("and the settings have a control of their own",
      (await page.locator("[data-settings]").count()) === 1);
    // Audio unlocks on the first touch anywhere; the nudge that used to
    // say so was a line of text sitting on the board, and the toggle it
    // was really about lives in settings.
    check("nothing on the board asks to enable audio",
      !/ENABLE TERMINAL AUDIO/.test(await page.evaluate(() => document.body.innerText)));
    await page.locator("[data-settings]").click();
    await page.waitForTimeout(500);
    check("the gear opens the terminal settings",
      (await page.getByText("TERMINAL SETTINGS").count()) >= 1);
    check("where the audio toggle is",
      (await page.getByText("TERMINAL AUDIO").count()) >= 1);
    await page.locator('[aria-label="Close handbook"]').click();
    await page.waitForTimeout(300);
  }
  // Exactly one gap, the same one that separates every other band. The
  // complaint that produced this was bins sitting on top of the record.
  check("the board and the bins are one gap apart",
    bands.binsTop - bands.gridBottom === bands.gap, JSON.stringify(bands));
  // One row, however many bins. Adding a bin narrows the row; it never
  // deepens it, which is what used to cost the board a fifth of its height
  // the moment the fourth temper arrived.
  {
    const decks = await page.evaluate(async () => {
      const out = [];
      for (const i of [0, window.__mdr.levels.findIndex((l) => l.name === "CALIBRATION")]) {
        window.__mdr.startLevel(i);
        const L = window.__mdr.layout;
        const r = L.activeTempers.map((t) => L.binRects[t]);
        out.push({
          n: r.length,
          tops: [...new Set(r.map((b) => Math.round(b.y)))].length,
          h: Math.round(r[0].h),
          deck: L.binsH,
        });
      }
      return out;
    });
    check("every bin deck is a single row",
      decks.every((d) => d.tops === 1), JSON.stringify(decks));
    check("and one bin is exactly as tall as four",
      new Set(decks.map((d) => d.h)).size === 1, JSON.stringify(decks));
    check("so the deck is the same depth whatever the file shows",
      new Set(decks.map((d) => d.deck)).size === 1, JSON.stringify(decks));
    await load(page, 0);
  }

  // The footer stack, in the order a single act moves it: the bin the
  // packet went into, the file that bin advanced, the incentives record
  // that file advanced. Three readings at increasing grain in the one
  // place a refiner is already looking — and the last two on a tighter
  // gap than the rest, because they are one object at two grains.
  check("and so are the bins and the file card under them",
    bands.recordAt === "top"
      ? bands.recordTop < bands.gridBottom
      : bands.hudAt === "footer"
        ? bands.hudTop - (bands.binsTop + bands.binsH) === bands.gap &&
          bands.hudTop + bands.hudH < bands.h
        : bands.recordTop - (bands.binsTop + bands.binsH) === bands.gap,
    JSON.stringify(bands));
  // The incentives record has no band of its own in the shipping layout:
  // two bordered boxes with two bars was one progress widget too many, so
  // it is a line inside the file card and the band went back to the board.
  check("and the incentives record has no band of its own to compete with",
    bands.hudAt !== "footer" || bands.recordAt === "none",
    JSON.stringify(bands));
  check("with the coach line above the board rather than below the header",
    bands.hudAt !== "footer" || bands.hudTop > bands.gridBottom,
    JSON.stringify(bands));

  // A deck can show more bins than the file can fill (the orientation rung
  // that introduces bins which must NOT be fed). The layout reserves a cell
  // for each shown bin, so if the deck renders only the content tempers the
  // real bins land in scattered cells of a half-empty grid. Reachability
  // alone never caught that: it probes layout rects, not the DOM.
  const wideIdx = await page.evaluate(() =>
    window.__mdr.levels.findIndex((l) => l.showBins && l.showBins.length > l.tempers.length));
  check("a file exists whose deck is wider than its content", wideIdx >= 0);
  if (wideIdx >= 0) {
    await load(page, wideIdx);
    const deckCells = await page.evaluate(() => {
      const e = window.__mdr;
      const L = e.layout;
      const shown = [...e.getSnapshot().activeTempers];
      const st = document.querySelector('[role="application"]').getBoundingClientRect();
      const cells = new Map();
      for (const n of document.querySelectorAll('[aria-label="Temper bins"] > div')) {
        const m = /^\d\d: ([A-Z]+)/.exec(n.textContent?.trim() ?? "");
        if (m) cells.set(m[1], n.getBoundingClientRect());
      }
      let placed = 0;
      for (const t of shown) {
        const r = L.binRects[t];
        const b = cells.get(t);
        if (b && Math.abs(b.left - st.left - r.x) < 2 && Math.abs(b.top - st.top - r.y) < 2) {
          placed++;
        }
      }
      return { shown, rendered: [...cells.keys()], placed,
               content: [...e.levels[e.levelIndex].tempers] };
    });
    eq("the deck renders a bin for every shown temper",
      deckCells.rendered.length, deckCells.shown.length);
    eq("and each sits in the cell the layout reserved for it",
      deckCells.placed, deckCells.shown.length);
    check("including bins this file cannot fill",
      deckCells.shown.length > deckCells.content.length,
      JSON.stringify(deckCells));
  }
  await load(page, 0);
}

// ═══ 3. full playthroughs ════════════════════════════════════════════
section("playthroughs");
{
  // Orientation, tap-only, all the way through the final full-deck screen.
  await load(page, await lastTrainingIndex(page));
  let guard = 0;
  while ((await state(page)).progress < 100 && guard++ < 10) {
    const g = await findGroup(page);
    if (!g) break;
    await tap(page, origin, await touchFor(page, g.one, "marquee"));
    if (!(await state(page)).carrying) break;
    await carryToBin(page, origin, g);
  }
  const s = await state(page);
  check("the last orientation screen reaches 100% by tapping alone", s.progress === 100,
    `${s.progress}% after ${guard} attempts`);
}
{
  // A real file, boxed and carried — the marquee path must still work.
  await load(page, await byName(page, "DRANESVILLE"));
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
  await load(page, await byName(page, "JESUP"));   // decoys
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
  await load(page, await byName(page, "COLD HARBOR")); // the fifth
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
  await load(page, await byName(page, "YAKIMA"));  // redaction
  const red = (await state(page)).muted;
  await load(page, await byName(page, "MOONBEAM")); // not redacted
  const restored = (await state(page)).muted;
  check("redacted file mutes", red);
  check("the next file restores audio", !restored);
}

{
  // BELLINGHAM opens in PROBE and also allows tap-to-select, so the tap must
  // be hit-tested with the offset the lens is actually drawn at. Aiming the
  // lens at the group and tapping has to lift it.
  await load(page, await byName(page, "BELLINGHAM"));
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
  await load(page, await byName(page, "BELLINGHAM"));
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
  await load(page, await byName(page, "NANNING"));
  const supply = await page.evaluate(() => {
    const e = window.__mdr;
    const counts = {};
    for (const c of e.board.clusters) {
      if (c.decoy || c.fifth) continue;
      counts[c.temper] = (counts[c.temper] ?? 0) + 1;
    }
    const m = e.board.clusters.find((c) => c.morph);
    return { counts, quota: e.quota, from: m?.temper, to: m?.morphTo,
             tempers: [...e.levels[e.levelIndex].tempers] };
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
  // An incentive earned here would hold the board deliberately; this test
  // is about what the screen does once nothing is owed.
  await settleIncentives(page);
  await page.waitForTimeout(1400);
  eq("and it advanced", (await state(page)).level, 1);
}
{
  // A redacted file's forced mute must never reach saved settings.
  await page.evaluate(() => window.__mdr.setMuted(false));
  await load(page, await byName(page, "YAKIMA"));
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
  check("touching the box recenters it under the thumb", grab.offBy <= 2,
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
  // Search for the shape this is about rather than assuming cluster zero on
  // screen zero still has it. The board's row count is a tuning dial — it
  // went from 28 to 26 when the bins grew a line — and a fixture pinned to
  // one cluster stops testing the property the moment that dial moves.
  const gaps = await (async () => {
    let best = null;
    // Across a spread of files, because the shape needs a group of five or
    // more spread over two rows and the early screens only ever show one
    // group of four.
    for (const i of [0, 4, 8, await byName(page, "CALIBRATION"), await byName(page, "DRANESVILLE")]) {
      await load(page, i);
      const found = await page.evaluate(() => {
    const e = window.__mdr, b = e.board;
    const hole = (c) => {
      const pts = c.members.map((m) => ({
        x: b.nodes[m].hx + b.nodes[m].dx,
        y: b.nodes[m].hy + b.nodes[m].dy,
      }));
      const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
      const y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
      // Sample the footprint and keep the point furthest from every glyph —
      // the one a pad-only hit test would miss.
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
    };
    const live = b.clusters.filter((c) => !c.refined && c.members.length >= 4);
    return live.map(hole).sort((a, z) => z.worst.d - a.worst.d)[0] ?? hole(b.clusters[0]);
      });
      if (!best || found.worst.d > best.worst.d) best = found;
      if (best.worst.d > 22) break;
    }
    return best;
  })();
  const g = await findGroup(page);
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
  await load(page, await lastTrainingIndex(page));
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
  // Every other orientation screen, derived: the ramp is a table and the
  // count moves when it is tuned.
  const SCREENS = (await orientationIndices(page)).filter((_, i) => i % 2 === 0);
  let attempts = 0;
  const missed = [];
  const stuck = [];
  for (const level of SCREENS) {
    await load(page, level);
    if (!(await findGroup(page))) continue;
    // Nine points across the group's own footprint, corners included, plus
    // the exact center of its topmost digit — the point that was dead.
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
  await settleIncentives(page);
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
  await load(page, await byName(page, "DRANESVILLE"));
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
  // Same as above: the wipe is what is under test, so nothing may be
  // holding the board when it starts.
  await settleIncentives(page);
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

// ═══ 8. the room plays every temper that is on it ════════════════════
section("ambient temper");
{
  await load(page, 0);                       // one group, one temper
  const solo = await page.evaluate(() => {
    const e = window.__mdr;
    const c = e.board.clusters.find((k) => !k.refined && !k.decoy && !k.fifth);
    return { beds: [...e.ambientTempers()], group: c.temper };
  });
  eq("one group on screen: its temper alone plays", solo.beds, [solo.group]);

  await load(page, await lastTrainingIndex(page));                      // the full-deck screen
  const many = await page.evaluate(() => {
    const e = window.__mdr;
    return {
      beds: [...e.ambientTempers()].sort(),
      present: [...new Set(
        e.board.clusters
          .filter((c) => !c.refined && !c.decoy && !c.fifth)
          .map((c) => c.temper),
      )].sort(),
    };
  });
  eq("several groups: every present temper plays, layered",
    many.beds, many.present);

  // Refining a temper's last group dissolves that temper out of the room.
  const g = await findGroup(page);
  await tap(page, origin, g.ctr);
  check("the packet lifted", (await state(page)).carrying);
  check("and it still carries to the bin", await carryToBin(page, origin, g));
  const after = await page.evaluate((t) => {
    const e = window.__mdr;
    const gone = !e.board.clusters.some(
      (c) => c.temper === t && !c.refined && !c.decoy && !c.fifth,
    );
    return { gone, still: e.ambientTempers().has(t) };
  }, g.temper);
  if (after.gone) {
    check("a refined temper leaves the room", !after.still);
  }

  // A decoy has no temper to give off, and the fifth is never named.
  await load(page, await byName(page, "COLD HARBOR")); // carries the fifth
  const quiet = await page.evaluate(() => {
    const e = window.__mdr;
    const f = e.board.clusters.find((k) => k.fifth);
    if (!f) return null;
    e.board.clusters.forEach((c) => { if (c !== f) c.refined = true; });
    return [...e.ambientTempers()];
  });
  eq("the fifth temper gives off nothing", quiet, []);
}

// ═══ 9. the bin catches what is brought near it ══════════════════════
section("bin catch");
{
  // The packet's center is what is tested, and the box is a hundred pixels
  // wide — demanding the center fully inside the bin meant drops released
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
      // Land the packet center itself at the probe point: the drop tests
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
  await beginRefining(page);
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  eq("continue lands on the next file",
    await page.evaluate(() => window.__mdr.levelIndex), 1);

  // A new save starts from nothing — and the old attempt survives it.
  await boot();
  await page.getByText("BEGIN A NEW SAVE").click();
  await beginRefining(page);
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  eq("a new save starts at the beginning",
    await page.evaluate(() => window.__mdr.levelIndex), 0);
  {
    // And the terminal has to *say* so. The "already refined" notice is
    // snapshotted on arrival — it has to be, or it would fire about the
    // file just finished — and the snapshot was keyed on the level alone.
    // A new save begun from the briefing swaps the ledger underneath a
    // level index that was already 0 and stayed 0, so the answer computed
    // against the previous save survived, and a brand-new terminal opened
    // orientation file one reading THIS FILE IS ALREADY REFINED.
    await page.waitForTimeout(300);
    const card = await page.evaluate(
      () => document.querySelector("[data-file-card]")?.innerText ?? "");
    // Nothing is promised before the first incentive exists: a brand-new
    // save is a file card and nothing else, which is also what keeps the
    // launch animation landing on one simple object.
    check("a save that has kept nothing is promised nothing",
      !/ALREADY REFINED/.test(card) && !/NEXT INCENTIVE/.test(card),
      card.replace(/\n/g, " | "));
  }
  await boot();
  check("both attempts are now listed",
    (await page.getByText("LOAD A PREVIOUS SAVE (2)").count()) === 1);

  // Loading the older attempt picks up ITS bookmark, not the new one's.
  await page.getByText("LOAD A PREVIOUS SAVE (2)").click();
  const totalFiles = await page.evaluate(() => window.__mdr.levels.length);
  await page.getByText(`1/${totalFiles} FILES`).click();
  await beginRefining(page);
  await page.waitForFunction(() => window.__mdr.settled, null, { timeout: 15000 });
  eq("loading the older save resumes its own place",
    await page.evaluate(() => window.__mdr.levelIndex), 1);

  // ── and a save is a save: its files and its incentives are its own ──
  //
  // The archive and the ledger used to be global, so a new save opened on
  // a terminal that already knew every file the refiner had ever refined
  // and held every incentive they had ever kept.
  {
    const slots = () =>
      page.evaluate(() => {
        const runs = JSON.parse(localStorage.getItem("lumon.mdr.runs.v1") ?? "null");
        const of = (base, id) =>
          JSON.parse(localStorage.getItem(`${base}.${id}`) ?? "null");
        return {
          active: runs.active,
          ids: runs.runs.map((r) => r.id),
          unscoped: {
            archive: localStorage.getItem("lumon.mdr.archive.v1"),
            progress: localStorage.getItem("lumon.mdr.progress.v1"),
          },
          each: runs.runs.map((r) => ({
            id: r.id,
            archive: (of("lumon.mdr.archive.v1", r.id) ?? []).length,
            files: of("lumon.mdr.progress.v1", r.id)?.filesCompleted ?? null,
          })),
        };
      });
    const st = await slots();
    // Creation order: the first save refined a file, the second is the one
    // begun fresh. A ledger that has never been written is simply absent,
    // which is the same thing as empty and is what a new save looks like.
    const [first, second] = st.each;
    check("two saves, each with a slot of its own",
      st.each.length === 2 && first.id !== second.id, JSON.stringify(st.each));
    check("and nothing is left in the old global slot",
      st.unscoped.archive === null && st.unscoped.progress === null,
      JSON.stringify(st.unscoped));
    check("the save that refined a file remembers it",
      first.archive >= 1, JSON.stringify(first));
    check("and the new one starts from nothing",
      second.archive === 0 && (second.files ?? 0) === 0, JSON.stringify(second));
  }
}

// ═══ 11. the incentive pops, stacks, and holds the queue ═════════════
section("incentives");
{
  const ledger = () => readLedger(page);
  const seed = (p) => writeLedger(page, p);
  /** Finish an orientation screen by tapping its groups into their bins. */
  const finish = async (index) => {
    await load(page, index);
    let guard = 0;
    while ((await state(page)).progress < 100 && guard++ < 10) {
      const g = await findGroup(page);
      if (!g) break;
      await tap(page, origin, await touchFor(page, g.one, "marquee"));
      if (!(await state(page)).carrying) break;
      await carryToBin(page, origin, g);
    }
    await settled(page);
  };
  const seen = (text) => page.getByText(text, { exact: false }).count();
  const action = () => page.locator("[data-reward-action]");
  const landing = () => page.locator("[data-record-landing]");
  /** Clear the landing screen that follows the last card of a stack. */
  const resume = async () => {
    await landing().click({ timeout: 4000 });
    // The page packs itself down and then flies into the record; then the
    // board it uncovers is *held*, finished, before the next file is asked
    // for. The board is not back until all three beats are over.
    await page.waitForTimeout(2600);
  };
  /**
   * Refine a whole file and stop the instant its last stage reads 100%,
   * before the engine has released the board — the window the settle
   * exists to protect.
   */
  const finishUnsettled = async (index) => {
    await refineFile(page, origin, index);
  };

  // ── one incentive: sealed until tapped, then filed ───────────────
  await seed({
    version: 1, filesCompleted: 0, screensCompleted: 0, binsTotal: 0,
    binsByTemper: { WO: 0, FC: 0, DR: 0, MA: 0 },
    creditedLevelIds: [], perfectScreensTotal: 0, perfectScreenStreak: 0,
    rewardState: {}, rewardQueue: [], seenFactIds: [], factsByRung: {},
    inspectCounts: {}, lastShownRewardId: null,
  });
  await finishUnsettled(0);

  // The first incentive is a file-completion incentive, and the first
  // file is three stages: each one moves the header meter a third, and
  // nothing is owed until the third of them lands.
  eq("a file's stages each pay a share of it, not an incentive",
    (await ledger()).rewardQueue.length, 1);
  eq("and the ledger counts one file, not three screens",
    (await ledger()).filesCompleted, 1);

  // The last packet completes the file on the frame it lands, and the bin
  // meters take 300ms to reach their ends. Covering them with a card on
  // that frame means the refiner does the work and never sees it finish.
  {
    const st = await state(page);
    check("a finished file is not settled the instant it completes",
      st.progress === 100 && st.settled === false, JSON.stringify(st.settled));
    check("and nothing is drawn over the meters while they fill",
      (await action().count()) === 0);
  }
  await settled(page);
  await page.waitForTimeout(120);

  check("refining the whole first file seals an incentive",
    (await seen("YOU'VE EARNED AN INCENTIVE")) === 1);
  // The cause may be stated; the effect may not.
  check("and says why it was issued",
    (await seen("REFINEMENT MILESTONE \u00b7 1 FILE REFINED")) === 1);
  check("and says nothing about what it is", (await seen("FINGER TRAP")) === 0);
  // The notice sits on the lid, under the word SEALED — on the thing it is
  // describing, rather than as one more line of small print under the card.
  check("the lid says why it is blank",
    (await seen("contents of this incentive remain classified")) === 1);
  eq("nothing is owed unclaimed in storage yet", (await ledger()).rewardState.S01, "earned_pending");

  // The board must not run on underneath it, and the seal must not open
  // itself: a card that opens on a timer is a card someone can miss.
  await page.waitForTimeout(2000);
  eq("the next file does not load behind the card",
    await page.evaluate(() => window.__mdr.levelIndex), 2);
  check("and the seal is still sealed two seconds later", (await seen("FINGER TRAP")) === 0);

  await action().click();
  await page.waitForTimeout(150);
  check("tapping it puts the plate on screen at once",
    (await page.locator('img[alt="FINGER TRAP"]').count()) === 1);
  // The headline is not swapped, it is typed over: the announcement is
  // backspaced away and the name written in its place. For most of a
  // second the card is mid-word, which is the whole point of it.
  await page.waitForTimeout(2200);
  check("and the name is typed over the announcement",
    (await seen("FINGER TRAP")) === 1);
  check("leaving nothing of what it replaced",
    (await seen("YOU'VE EARNED AN INCENTIVE")) === 0);
  check("and the control now keeps it",
    (await action().innerText()).includes("KEEP INCENTIVE"));

  await action().click();
  // The card folds into a file, the summary catches it, holds it, walks it
  // into the row it counts toward, and lights that row for nearly two
  // seconds before what earns the next incentive is shown at all.
  await page.waitForTimeout(3400);
  eq("filing claims it", (await ledger()).rewardState.S01, "claimed");
  eq("and empties the queue", (await ledger()).rewardQueue.length, 0);

  // Where it went. The card flies into the incentive record and the
  // record stays on screen, holding the board, until it is dismissed —
  // this is the only moment a refiner is taught where their things live.
  check("keeping lands on the summary, not back on the board",
    (await landing().count()) === 1);
  check("which names what was just kept", (await seen("FINGER TRAP")) === 1);
  check("counts it against its category", (await seen("ISSUED ITEMS")) === 1);
  check("with the category's real denominator", (await seen("1 OF 10")) === 1);
  // Last on the page and the loudest thing on it: everything above is a
  // receipt, and this is the only object about work still to do.
  // One instruction and what obeying it buys — and nothing that says the
  // same number again in another notation. The headline, the meter, the
  // fraction and the remainder line were four readings of one fact.
  check("says what earns the next one",
    (await seen("REFINE 1 MORE FILE")) >= 1);
  check("and what obeying it buys",
    (await seen("TO RECEIVE ANOTHER INCENTIVE")) === 1);
  check("without a second notation for the same number",
    (await seen("TO GO")) === 0);
  check("and without saying what the incentive is",
    (await seen("MELON")) === 0 && (await seen("ERASER")) === 0);
  await page.waitForTimeout(700);
  eq("and the board does not advance underneath it",
    await page.evaluate(() => window.__mdr.levelIndex), 2);

  await resume();
  // Out, a beat, and in — three chunky beats rather than one shuffle.
  await page.waitForTimeout(2400);
  // A file that pays out ends on the summary and nowhere else. FILE
  // REFINED says what the summary already said, so showing both made the
  // refiner dismiss two screens in a row for one file.
  check("a file that paid out shows no second end-of-file panel",
    (await page.locator('[data-record-box="panel"]').count()) === 0);
  eq("and resuming goes straight to the next file",
    await page.evaluate(() => window.__mdr.levelIndex), 3);
  check("with the record where it lives, in the header",
    (await page.locator('[data-record-box="hud"]').count()) === 1);

  // ── two at once: announced as two, then shown one at a time ──────
  await seed({
    version: 1, filesCompleted: 1, screensCompleted: 1, binsTotal: 39,
    binsByTemper: { WO: 39, FC: 0, DR: 0, MA: 0 },
    creditedLevelIds: [],
    perfectScreensTotal: 1, perfectScreenStreak: 1,
    rewardState: { S01: "claimed" }, rewardQueue: [], seenFactIds: [],
    factsByRung: {}, inspectCounts: {}, lastShownRewardId: null,
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  // The last orientation file is one stage and can be finished by tapping,
  // so a single refinement crosses both thresholds: the second file
  // completed, and the fortieth bin.
  await finish(await lastTrainingIndex(page));

  check("a file that crosses two thresholds says so up front",
    (await seen("YOU'VE EARNED 2 INCENTIVES")) === 1);
  check("behind one seal, opened once",
    (await action().innerText()).includes("OPEN"));
  await action().click();
  await page.waitForTimeout(2200);
  check("the first is the file-lane incentive",
    (await seen("YOU HAVE BEEN ISSUED AN ERASER")) === 1);
  check("and the second is not on screen with it", (await seen("MELON BAR")) === 0);
  check("whose control promises the next one",
    (await action().innerText()).includes("SEE NEXT INCENTIVE"));
  check("numbered within the stack", (await seen("INCENTIVE 1 OF 2")) === 1);

  await action().click();
  await page.waitForTimeout(400);
  check("accepting the first brings up the second", (await seen("INCENTIVE 2 OF 2")) === 1);
  check("and the last of a stack keeps them all",
    (await action().innerText()).includes("KEEP INCENTIVES"));
  check("with no second seal to open", (await seen("YOU'VE EARNED")) === 0);
  const mid = await ledger();
  eq("the first is claimed", mid.rewardState.S02, "claimed");
  eq("the second is still owed", mid.rewardState.B040, "earned_pending");

  await action().click();
  await page.waitForTimeout(3400);
  const done = await ledger();
  eq("both end up claimed", [done.rewardState.S02, done.rewardState.B040], ["claimed", "claimed"]);
  eq("with nothing left in the queue", done.rewardQueue.length, 0);
  check("a stack lands on one record screen, not two",
    (await landing().count()) === 1);
  // Nothing is behind this screen but the board, because the file that
  // paid out has no FILE REFINED panel — so the header's own strip is
  // uncovered and is exactly the box to fly at. The summary used to shrink
  // into something hidden and then have a panel drawn over where it went.
  {
    const aim = await page.evaluate(() => ({
      panel: !!document.querySelector('[data-record-box="panel"]'),
      hud: !!document.querySelector('[data-record-box="hud"]'),
      summary: !!document.querySelector("[data-incentive-summary]"),
    }));
    check("with the header's own record box uncovered to fly into",
      !aim.panel && aim.hud && aim.summary, JSON.stringify(aim));
  }
  check("and it counts them as two kept", (await seen("2 INCENTIVES KEPT")) === 1);
  await resume();

  // ── an object already held is filed, not shown again ─────────────
  await seed({
    version: 1, filesCompleted: 2, screensCompleted: 2, binsTotal: 2,
    binsByTemper: { WO: 2, FC: 0, DR: 0, MA: 0 },
    creditedLevelIds: [],
    perfectScreensTotal: 0, perfectScreenStreak: 0,
    // The finger trap is already on the shelf, and the queue owes it again.
    rewardState: { S01: "claimed", S02: "claimed", P03: "earned_pending" },
    rewardQueue: ["P03"], seenFactIds: [], factsByRung: {},
    inspectCounts: {}, lastShownRewardId: null,
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  // A named file, because the note lands in the record block and only a
  // file with a ceremony draws one.
  {
    const i = await byName(page, "DRANESVILLE");
    await load(page, i);
    let guard = 0;
    while ((await state(page)).progress < 100 && guard++ < 12) {
      await setMode(page, "probe");
      let g = await findGroup(page);
      if (!g) break;
      const at = await touchFor(page, g.ctr, "probe");
      await page.mouse.move(origin.x + at.x, origin.y + at.y);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      await page.waitForTimeout(150);
      g = (await findGroup(page)) ?? g;
      await setMode(page, "select");
      await boxAndBin(page, origin, g);
      await page.waitForTimeout(150);
    }
    // A finished *file* is now held for 1.75s before any overlay may cover
    // it — the file card's REFINED mark has nowhere else to be seen — so a
    // fixed 800ms lands before the card exists and finds nothing to click.
    await settled(page);
    await page.waitForTimeout(300);
  }
  // Screen three also earns a fact card, so a card is expected here — what
  // must never happen is the finger trap being *presented* a second time.
  // Clear the cards but stop on the summary. The note about a re-issued
  // object used to ride the FILE REFINED panel; a file that pays out no
  // longer has one, so the summary carries it.
  for (let i = 0; i < 8 && (await landing().count()) === 0; i++) {
    if ((await action().count()) === 0) break;
    await action().first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(300);
  const refiled = await ledger();
  check("a second issue of an object is never the card that was shown",
    refiled.lastShownRewardId !== "R02", String(refiled.lastShownRewardId));
  eq("but it is claimed all the same", refiled.rewardState.P03, "claimed");
  check("and the record says it was kept again", (await seen("ISSUED AGAIN")) >= 1);
  check("and the full record can be opened from where the file ended",
    (await page.locator("[data-view-record]").count()) >= 1);
  check("and from the header, at every moment of the game",
    (await page.locator('[data-record-box="hud"]').count()) === 1);
  await settleIncentives(page);

  // ── a stage moves the meter; a replayed file says it will not ────
  await seed({
    version: 1, filesCompleted: 0, screensCompleted: 0, binsTotal: 0,
    binsByTemper: { WO: 0, FC: 0, DR: 0, MA: 0 },
    creditedLevelIds: [], perfectScreensTotal: 0, perfectScreenStreak: 0,
    rewardState: {}, rewardQueue: [], seenFactIds: [], factsByRung: {},
    inspectCounts: {}, lastShownRewardId: null,
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  {
    // One meter, not two. The incentives record used to be a bordered box
    // of its own with a second bar; it is a line inside the file card now,
    // and the *file* meter is the bar to watch.
    const bar = () =>
      page.evaluate(() => {
        const box = document.querySelector("[data-file-card]");
        const fill = box?.querySelector(".bg-phos-400");
        return {
          text: box?.innerText.replace(/\n/g, " | ") ?? "",
          w: fill ? Math.round(fill.getBoundingClientRect().width) : -1,
        };
      });
    await load(page, 0);
    await page.waitForTimeout(300);
    const before = await bar();
    // One stage of a three-stage file. The file counter cannot move — the
    // file is not refined — but the refiner did a screen's work, and a
    // record that shows nothing for it is why "REFINE 2 MORE FILES" sat
    // unchanged for a dozen screens.
    let guard = 0;
    while ((await state(page)).progress < 100 && guard++ < 12) {
      const g = await findGroup(page);
      if (!g) break;
      await tap(page, origin, await touchFor(page, g.one, "marquee"));
      if (!(await state(page)).carrying) break;
      await carryToBin(page, origin, g);
    }
    await page.waitForTimeout(500);
    const after = await bar();
    check("a stage of a file moves the file's meter",
      after.w > before.w, JSON.stringify([before, after]));
    check("and the card names the file it is measuring",
      /ORIENTATION/.test(after.text), after.text);

    // The meter measures the stretch between thresholds, not the running
    // total against a target that moves — so it may never fall while the
    // refiner is succeeding. Drawn the obvious way it did exactly that:
    // 0/1 at 75% became 1/2 at 50% on the frame the file completed.
    const seen = [before.w, after.w];
    for (let n = 0; n < 16; n++) {
      const st = await state(page);
      if (!st.stage) break;
      // Stage cleared: either the file is finished, or the board advances
      // itself to the next screen of it.
      if (st.progress >= 100) {
        if (st.stage[0] >= st.stage[1]) break;
        await page
          .waitForFunction((i) => window.__mdr.levelIndex === i, st.level + 1,
            { timeout: 8000 }).catch(() => {});
        await page.waitForFunction(() => window.__mdr.settled, null,
          { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(150);
        continue;
      }
      const g = await findGroup(page);
      if (!g) break;
      await tap(page, origin, await touchFor(page, g.one, "marquee"));
      if (!(await state(page)).carrying) break;
      await carryToBin(page, origin, g);
      await page.waitForTimeout(250);
      seen.push((await bar()).w);
    }
    await settled(page);
    await page.waitForTimeout(300);
    const done = await bar();
    seen.push(done.w);
    const fell = seen.findIndex((w, i) => i > 0 && w < seen[i - 1]);
    check("and never falls back while the refiner is succeeding",
      fell < 0, JSON.stringify(seen));
    check("reaching the threshold fills it rather than moving the goalposts",
      done.text.includes("100%"), done.text);
  }

  // A save that has already credited these files earns nothing by
  // replaying them, which is correct — and used to be reported as though
  // the instruction on screen could still be followed.
  await seed({
    version: 1, screensCompleted: 12, binsTotal: 30,
    binsByTemper: { WO: 10, FC: 8, DR: 7, MA: 5 },
    creditedLevelIds: await page.evaluate(() =>
      window.__mdr.levels.filter((l) => l.name === "ORIENTATION").map((l) => l.id)),
    perfectScreensTotal: 4, perfectScreenStreak: 4,
    rewardState: { S01: "claimed", S02: "claimed", S03: "claimed" },
    rewardQueue: [], seenFactIds: [], factsByRung: {},
    inspectCounts: {}, lastShownRewardId: null,
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  {
    const p = await ledger();
    eq("a save with no file count derives one from its credited levels",
      p.filesCompleted, undefined);
    await load(page, 0);
    await page.waitForTimeout(300);
    const text = await page.evaluate(
      () => document.querySelector("[data-file-card]")?.innerText ?? "");
    check("a file already in the ledger says it will not count again",
      /ALREADY BEEN REFINED/.test(text), text.replace(/\n/g, " | "));
    // And a fresh file says nothing of the kind.
    await load(page, await byName(page, "DRANESVILLE"));
    await page.waitForTimeout(300);
    const fresh = await page.evaluate(
      () => document.querySelector("[data-file-card]")?.innerText ?? "");
    check("a file that has not been refined does not",
      !/ALREADY BEEN REFINED/.test(fresh), fresh.replace(/\n/g, " | "));
  }

  // ── the full record: categories, counts, and concealed slots ─────
  await seed({
    version: 1, filesCompleted: 8, screensCompleted: 14, binsTotal: 42,
    binsByTemper: { WO: 20, FC: 10, DR: 7, MA: 5 },
    creditedLevelIds: [], perfectScreensTotal: 3, perfectScreenStreak: 1,
    rewardState: {
      S01: "claimed", S02: "claimed", S03: "claimed", S05: "claimed",
      S09: "claimed", B010: "claimed", P01: "claimed",
    },
    rewardQueue: [], seenFactIds: ["OF_CANON_011"],
    factsByRung: { S03: ["OF_CANON_011"] },
    inspectCounts: {}, lastShownRewardId: null,
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  await load(page, 14);
  await page.waitForTimeout(300);

  // The strip is a live control over a live board — it sits above the
  // input surface, and the header around it stays transparent to pointers
  // so a packet dragged to the top edge can still be picked back up.
  await page.locator('[data-record-box="hud"]').click({ timeout: 5000 });
  await page.waitForTimeout(600);
  check("the header strip opens the full record",
    (await seen("INCENTIVES RECORD")) >= 1);
  for (const label of ["ISSUED ITEMS", "OUTIE FACTS", "HANDBOOK NOTES", "WELLNESS SESSIONS", "DEPARTMENT EVENTS"]) {
    check(`  ${label} has a section of its own`, (await seen(label)) >= 1);
  }
  check("earned entries are named", (await seen("FINGER TRAP")) >= 1);
  check("and the ones still to come are not",
    (await seen("CLASSIFIED")) >= 1 && (await seen("NOT YET ISSUED")) >= 1);
  // The record admits how many are left. It never admits what they are.
  check("no unearned name leaks into the record",
    (await seen("WAFFLE PARTY")) === 0 && (await seen("EGG BAR")) === 0);
  await page.locator('[aria-label="Close handbook"]').click();
  await page.waitForTimeout(400);

  // ── a reload during the ceremony keeps the reward ────────────────
  await seed({
    version: 1, filesCompleted: 1, screensCompleted: 4, binsTotal: 6,
    binsByTemper: { WO: 6, FC: 0, DR: 0, MA: 0 },
    creditedLevelIds: ["orientation-01", "orientation-02", "orientation-03", "orientation-04"],
    perfectScreensTotal: 0, perfectScreenStreak: 0,
    rewardState: {}, rewardQueue: [], seenFactIds: [], factsByRung: {},
    inspectCounts: {}, lastShownRewardId: null,
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  await finish(4);
  await page.waitForTimeout(300);
  const owedBefore = (await ledger()).rewardQueue.length;
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  const owedAfter = (await ledger()).rewardQueue.length;
  check("a reload during the ceremony loses the ceremony, not the reward",
    owedBefore === 1 && owedAfter === 1, `${owedBefore} -> ${owedAfter}`);
}

// ═══ 11b. facts are typeset and kept ═════════════════════════════════
section("wellness");
{
  const ledger = () => readLedger(page);
  const seed = (p) => writeLedger(page, p);
  const finish = async (index) => {
    await load(page, index);
    let guard = 0;
    while ((await state(page)).progress < 100 && guard++ < 10) {
      const g = await findGroup(page);
      if (!g) break;
      await tap(page, origin, await touchFor(page, g.one, "marquee"));
      if (!(await state(page)).carrying) break;
      await carryToBin(page, origin, g);
    }
    await settled(page);
  };

  // One file short of the first fact card, and standing on a file that
  // finishes in a single stage — so completing it credits a whole one.
  await seed({
    version: 1, filesCompleted: 2, screensCompleted: 2, binsTotal: 2,
    binsByTemper: { WO: 2, FC: 0, DR: 0, MA: 0 },
    creditedLevelIds: [],
    perfectScreensTotal: 2, perfectScreenStreak: 2,
    rewardState: { S01: "claimed", S02: "claimed" },
    rewardQueue: [], seenFactIds: [], factsByRung: {}, inspectCounts: {},
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  await finish(await lastTrainingIndex(page));

  const chosen = (await ledger()).factsByRung.S03 ?? [];
  check("the sentence is chosen and stored when the card is earned", chosen.length === 1,
    JSON.stringify(chosen));

  // The seal waits for a hand now, so open it.
  await page.locator("[data-reward-action]").click();
  await page.waitForFunction(() => /A FACT ABOUT YOUR OUTIE/.test(document.body.innerText),
    null, { timeout: 5000 });
  // The sentence is typeset on the plate itself — real text over the
  // image, never baked into it — and it appears once: the line underneath
  // is Lumon's framing, not the same words again.
  const shown = await page.evaluate(() =>
    [...document.body.innerText.matchAll(/Your outie[^\n]*/g)].map((m) => m[0]));
  check("the fact is typeset on the card, exactly once",
    shown.length === 1 && shown[0].endsWith("."), JSON.stringify(shown));
  // The caption arrives on the card's second beat — the band under the
  // plate opens and the line is typed into it — so it is not on screen the
  // frame the name is.
  const framed = await page
    .waitForFunction(
      () => /Wellness has prepared a statement/.test(document.body.innerText),
      null,
      { timeout: 6000 },
    )
    .then(() => true)
    .catch(() => false);
  check("and the caption below it is the framing line", framed);

  // The same sentence, after a reload mid-ceremony: never rerolled.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  const after = (await ledger()).factsByRung.S03 ?? [];
  check("and a reload cannot draw a different one", after.join() === chosen.join(),
    `${chosen.join()} -> ${after.join()}`);
}

// ═══ 11c. the dance experience ═══════════════════════════════════════
section("music dance experience");
{
  const seed = (p) => writeLedger(page, p);
  const finish = async (index) => {
    await load(page, index);
    let guard = 0;
    while ((await state(page)).progress < 100 && guard++ < 12) {
      const g = await findGroup(page);
      if (!g) break;
      await tap(page, origin, await touchFor(page, g.one, "marquee"));
      if (!(await state(page)).carrying) break;
      await carryToBin(page, origin, g);
    }
    await settled(page);
  };

  // Seven files in, everything before claimed: the next file refined is
  // the one that turns the floor into a dance floor.
  const done = {};
  for (const id of ["S01", "S02", "S03", "S05", "S09", "B010", "P01", "P03", "P05"]) {
    done[id] = "claimed";
  }
  await seed({
    version: 1, filesCompleted: 7, screensCompleted: 12, binsTotal: 28,
    binsByTemper: { WO: 8, FC: 8, DR: 6, MA: 6 },
    creditedLevelIds: [],
    perfectScreensTotal: 6, perfectScreenStreak: 6,
    rewardState: done, rewardQueue: [], seenFactIds: [], factsByRung: {}, inspectCounts: {},
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });
  await finish(await lastTrainingIndex(page));

  check("the eighth file offers the dance experience",
    (await page.getByText("MUSIC DANCE EXPERIENCE").count()) >= 1);
  check("with the show's own genre at the top of the menu",
    (await page.getByText("DEFIANT JAZZ").count()) === 1);

  await page.getByText("DEFIANT JAZZ").click();
  await page.waitForTimeout(200);
  check("then one accessory, which is the permitted number",
    (await page.getByText("MARACA").count()) === 1);
  await page.getByText("MARACA").click();
  await page.waitForTimeout(200);

  const instruction = await page.evaluate(() => document.body.innerText);
  check("the instruction is the one the specification writes",
    /CONNECT 3\+ GLOWING GROUPS OF ONE TEMPER\. RELEASE ON THE BEAT\. FILL THE\s+DANCE METER\./.test(instruction),
    instruction.slice(0, 120));
  check("and it promises there is no way to fail",
    /no way to fail/.test(instruction));

  await page.getByText("BEGIN").click();
  await page.waitForFunction(() => !!window.__mde?.session, null, { timeout: 5000 });

  // The floor is the same matrix: sixteen by twenty-eight, digits and all.
  const floor = await page.evaluate(() => {
    const s = window.__mde.session;
    return {
      nodes: s.nodes.length,
      clusters: s.clusters.length,
      lit: s.clusters.filter((c) => c.lit).length,
      tempers: [...new Set(s.clusters.map((c) => c.temper))].sort(),
    };
  });
  eq("the dance floor is the number field", floor.nodes, 16 * 28);
  check("with every temper on it", floor.tempers.join() === "DR,FC,MA,WO", JSON.stringify(floor));
  check("and a chain of three always available", floor.lit >= 3, `${floor.lit} lit`);

  // Chain three lit groups of one temper and release on a beat.
  const merged = await page.evaluate(async () => {
    const s = window.__mde.session;
    const canvas = document.querySelector('canvas[aria-label="Dance floor"]');
    const r = canvas.getBoundingClientRect();
    const byTemper = {};
    for (const c of s.clusters) {
      if (!c.lit || c.spent) continue;
      (byTemper[c.temper] ??= []).push(c);
    }
    const group = Object.values(byTemper).find((g) => g.length >= 3);
    if (!group) return { skipped: true };
    for (const c of group.slice(0, 3)) s.touch(c.cx, c.cy);
    const chain = s.snapshot().chain.length;
    // Release on the beat: step the clock to the next one first.
    const beatS = 60 / s.genre.bpm;
    const into = s.snapshot().elapsed % beatS;
    s.step(beatS - into + 0.001);
    const result = s.release();
    return { chain, result, meter: s.snapshot().meter, score: s.snapshot().score, r: r.width > 0 };
  });
  eq("three groups of one temper make a chain", merged.chain, 3);
  eq("released on the beat, they merge", merged.result, "merge");
  eq("and fill a segment of the dance meter", merged.meter, 1);
  check("and score", merged.score > 0, String(merged.score));

  // A miss costs a multiplier and nothing else — no lives, no progress.
  const missed = await page.evaluate(() => {
    const s = window.__mde.session;
    const before = { meter: s.snapshot().meter, score: s.snapshot().score };
    const c = s.clusters.find((k) => k.lit && !k.spent);
    s.touch(c.cx, c.cy);
    const beatS = 60 / s.genre.bpm;
    const into = s.snapshot().elapsed % beatS;
    s.step(beatS / 2 - into > 0 ? beatS / 2 - into : beatS / 2); // off the beat
    const result = s.release();
    const after = s.snapshot();
    return { result, before, meter: after.meter, score: after.score, multiplier: after.multiplier };
  });
  eq("a short release off the beat is a miss", missed.result, "miss");
  eq("it takes nothing off the meter", missed.meter, missed.before.meter);
  eq("and nothing off the score", missed.score, missed.before.score);
  eq("only the multiplier resets", missed.multiplier, 1);
}

// ═══ a mistake, and what it costs ════════════════════════════════════
//
// The precision incentives are never advertised — "REFINE 1 MORE FILE
// WITHOUT ERROR" is a goal a refiner cannot plan around and a single slip
// makes unreachable — so what a wrong bin does is a mechanic that has to
// be checked from the outside: nothing in orientation, and outside it a
// notice plus a reschedule rather than a loss.
section("a wrong bin");
{
  const seed = (p) => writeLedger(page, p);

  // ── inside orientation: the red line and nothing else ─────────────
  await seed({
    version: 1, filesCompleted: 0, screensCompleted: 0, binsTotal: 0,
    binsByTemper: { WO: 0, FC: 0, DR: 0, MA: 0 },
    creditedLevelIds: [], perfectScreensTotal: 0, perfectScreenStreak: 0,
    rewardState: {}, rewardQueue: [], seenFactIds: [], factsByRung: {},
    inspectCounts: {}, lastShownRewardId: null,
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });

  // A late orientation stage, so the deck has more than one bin to get
  // wrong. The first stages have one, and one bin cannot be missed.
  const wide = await page.evaluate(
    () => window.__mdr.levels.findIndex((l) => l.training && (l.showBins?.length ?? l.tempers.length) > 1),
  );
  await load(page, wide);
  {
    const g = await findGroup(page);
    await tap(page, origin, await touchFor(page, g.one, "marquee"));
    check("a packet can be lifted", (await state(page)).carrying);
    await carryToWrongBin(page, origin, g);
    const st = await state(page);
    check("the wrong bin is refused, and says so at the top of the board",
      st.message !== null && st.message.length > 0, JSON.stringify(st.message));
  }
  // Finish the file anyway. Orientation is where mistakes are supposed to
  // happen, and one costs nothing at all.
  {
    let guard = 0;
    while ((await state(page)).progress < 100 && guard++ < 12) {
      const g = await findGroup(page);
      if (!g) break;
      await tap(page, origin, await touchFor(page, g.one, "marquee"));
      if (!(await state(page)).carrying) break;
      await carryToBin(page, origin, g);
    }
    await settled(page);
    await page.waitForTimeout(2200);
    const led = await readLedger(page);
    eq("and nothing is rescheduled for it", Object.keys(led.deferredRungs ?? {}), []);
    check("no notice is raised inside orientation",
      (await page.locator("[data-record-notice]").count()) === 0);
  }

  // ── outside it: the notice, and the incentive moved ────────────────
  await seed({
    version: 1, filesCompleted: 5, screensCompleted: 5, binsTotal: 24,
    binsByTemper: { WO: 8, FC: 6, DR: 5, MA: 5 },
    creditedLevelIds: [],
    // A run of clean files is standing, so there is something to break.
    perfectScreensTotal: 2, perfectScreenStreak: 2,
    rewardState: { S01: "claimed", S02: "claimed", S03: "claimed", S05: "claimed" },
    rewardQueue: [], seenFactIds: [], factsByRung: {}, inspectCounts: {},
    lastShownRewardId: null,
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__mdr, null, { timeout: 15000 });

  // LE MANS: past the teaching, and two bins on the deck. The four files
  // before KINGSPORT carry one temper each, and a deck with one bin on it
  // cannot be mis-binned — those have never counted toward precision and
  // still do not. Its groups hide, so each one has to be probed up before
  // it can be boxed.
  const named = await byName(page, "LE MANS");
  await load(page, named);
  {
    /** Surface the next hidden group its file still has room for. */
    const lift = async () => {
      await setMode(page, "probe");
      const g = await findGroupToBin(page);
      if (!g) return null;
      const at = await touchFor(page, g.ctr, "probe");
      await page.mouse.move(origin.x + at.x, origin.y + at.y);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      await page.waitForTimeout(150);
      await setMode(page, "select");
      // Re-read *this* cluster after the probe: the digits have moved
      // under it, and it is the only one that has been surfaced.
      return (await groupById(page, g.id)) ?? g;
    };
    // The mistake, once.
    const first = await lift();
    check("a packet can be lifted past orientation too", first !== null);
    if (first) {
      await drag(
        page,
        origin,
        await touchFor(page, { x: first.min.x - 10, y: first.min.y - 10 }, "marquee"),
        await touchFor(page, { x: first.max.x + 10, y: first.max.y + 10 }, "marquee"),
      );
      if ((await state(page)).carrying) {
        await carryToWrongBin(page, origin, first);
      }
      await page.waitForTimeout(150);
    }
    // Then the file, finished properly. Generous on retries: a scattered
    // cluster has to be probed up again, and this file has a clock.
    let guard = 0;
    while ((await state(page)).progress < 100 && guard++ < 40) {
      const g = await lift();
      if (!g) {
        await page.waitForTimeout(300);
        continue;
      }
      await drag(
        page,
        origin,
        await touchFor(page, { x: g.min.x - 6, y: g.min.y - 6 }, "marquee"),
        await touchFor(page, { x: g.max.x + 6, y: g.max.y + 6 }, "marquee"),
      );
      // Whatever the marquee actually lifted goes to its own bin, not to
      // the bin of the group the test was aiming at.
      if ((await state(page)).carrying) await carryHeldToItsBin(page, origin);
      await page.waitForTimeout(150);
    }
    eq("the file is refined despite the mistake",
      (await state(page)).progress, 100);
  }
  await settled(page);
  await page.waitForTimeout(2400);
  {
    const led = await readLedger(page);
    const moved = Object.entries(led.deferredRungs ?? {});
    check("the incentive the clean run was earning is not lost",
      moved.length === 1, JSON.stringify(led.deferredRungs));
    if (moved.length === 1) {
      eq("it is placed two files further on, whatever refines them",
        moved[0][1], led.filesCompleted + 2);
    }
    eq("and the run itself is closed", led.perfectScreenStreak, 0);
  }
  // Good news first: the notice waits behind anything owed, so the cards
  // and the summary are cleared before it can be looked at.
  {
    const notice = page.locator("[data-record-notice]");
    for (let i = 0; i < 10 && (await notice.count()) === 0; i++) {
      const card = page.locator("[data-reward-action]");
      const land = page.locator("[data-record-landing]");
      if (await card.count()) await card.click();
      else if (await land.count()) await land.click();
      else await page.waitForTimeout(400);
      await page.waitForTimeout(2400);
    }
    check("the notice waits until the good news is done",
      (await notice.count()) === 1);
  }
  {
    const text = await page.evaluate(() => document.body.innerText);
    check("the refiner is told an incentive was missed",
      /AN INCENTIVE\s+HAS BEEN MISSED/.test(text), text.slice(0, 160));
    check("and told it has been rescheduled rather than withdrawn",
      /rescheduled/.test(text) && /has not been withdrawn/.test(text));
    check("in files refined, not files refined without error",
      /2 more files have been\s+refined/.test(text));
  }
}

// ═══ 11. nothing threw ═══════════════════════════════════════════════
section("console");
check("no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
process.exit(summary());
