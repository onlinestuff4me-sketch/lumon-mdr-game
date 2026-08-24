/**
 * Invariants of the level data and the board generator. Pure — no browser,
 * runs in about a second, and covers the things that silently make a file
 * unwinnable rather than visibly broken.
 */
import { LEVELS, COLS, ROWS, MIN_CAPTURE, TEMPERS, ORIENT_STAGES } from "../src/game/constants";
import { assignMorphs, boardExtras, createBoard } from "../src/game/grid";

let bad = 0;
const fail = (m: string) => { bad++; console.log("  FAIL " + m); };
const ok = (m: string) => console.log("  ok   " + m);

console.log(`\n── board invariants, all ${LEVELS.length} screens ${"─".repeat(24)}`);
for (const lv of LEVELS) {
  const b = createBoard(
    lv.seed, lv.tempers, lv.quota + lv.spare, lv.spacing, boardExtras(lv), lv.focus ?? null,
  );
  const real = b.clusters.filter((c) => !c.decoy && !c.fifth);
  const counts: Record<string, number> = {};
  for (const c of real) counts[c.temper] = (counts[c.temper] ?? 0) + 1;

  for (const t of lv.tempers) {
    if ((counts[t] ?? 0) < lv.quota) {
      fail(`${lv.id}: ${t} has ${counts[t] ?? 0} clusters, quota ${lv.quota} — unwinnable`);
    }
  }
  for (const t of Object.keys(counts)) {
    if (!lv.tempers.includes(t as never)) fail(`${lv.id}: seeded ${t}, which has no bin`);
  }
  if (lv.decoys && b.clusters.filter((c) => c.decoy).length !== lv.decoys[0]) {
    fail(`${lv.id}: wrong decoy count`);
  }
  if (!!lv.fifth !== b.clusters.some((c) => c.fifth)) fail(`${lv.id}: fifth mismatch`);

  const cap = Math.max(4, lv.minCapture ?? MIN_CAPTURE);
  const seen = new Set<number>();
  for (const c of b.clusters) {
    if (c.members.length < cap || c.members.length > 9) {
      fail(`${lv.id}: cluster ${c.id} has ${c.members.length} members`);
    }
    for (const m of c.members) {
      if (m < 0 || m >= COLS * ROWS) fail(`${lv.id}: member out of range`);
      if (seen.has(m)) fail(`${lv.id}: cell ${m} belongs to two clusters`);
      seen.add(m);
    }
  }
  for (let i = 0; i < b.clusters.length; i++) {
    for (let j = i + 1; j < b.clusters.length; j++) {
      let min = Infinity;
      for (const m of b.clusters[i].members) {
        for (const n of b.clusters[j].members) {
          min = Math.min(min, Math.max(
            Math.abs((m % COLS) - (n % COLS)),
            Math.abs(((m / COLS) | 0) - ((n / COLS) | 0)),
          ));
        }
      }
      if (min < lv.spacing) fail(`${lv.id}: clusters ${i}/${j} only ${min} apart, want ${lv.spacing}`);
    }
  }
  if (lv.ceremony === "none" && lv === LEVELS[LEVELS.length - 1]) {
    fail(`${lv.id}: the last screen cannot auto-advance — the queue would stall`);
  }
  if (lv.morphs && lv.tempers.length < 2) fail(`${lv.id}: a morph needs somewhere to land`);

  // THE SOFTLOCK GUARD. A morph rewrites a cluster's temper, so the source
  // temper must still be able to fill its bin afterwards. With `spare: 0`
  // everywhere, taking a quota cluster leaves the bin permanently short —
  // and on an untimed file that is a softlock with no RETRY to press.
  if (lv.morphs) {
    assignMorphs(b, lv);
    const morphers = b.clusters.filter((c) => c.morph);
    if (morphers.length !== lv.morphs[0]) {
      fail(`${lv.id}: wanted ${lv.morphs[0]} morphing clusters, got ${morphers.length}`);
    }
    for (const m of morphers) {
      if (!m.morph) continue;
      const to = m.morphTo;
      if (!to) { fail(`${lv.id}: a morph cluster has nowhere to morph to`); continue; }
      const after = { ...counts };
      after[m.temper] = (after[m.temper] ?? 0) - 1;
      after[to] = (after[to] ?? 0) + 1;
      for (const t of lv.tempers) {
        if ((after[t] ?? 0) < lv.quota) {
          fail(`${lv.id}: after a ${m.temper}->${to} morph, ${t} has ${after[t] ?? 0} of ${lv.quota} — UNWINNABLE`);
        }
      }
    }
  }
  if (lv.binHint && (lv.showBins ?? lv.tempers).length !== 1) {
    fail(`${lv.id}: binHint on a multi-bin deck would point at the answer`);
  }
}
ok(`every screen seeds a winnable, well-formed board`);

console.log(`\n── placement gradient ${"─".repeat(38)}`);
{
  const rs: number[] = [];
  for (const lv of LEVELS.filter((l) => l.id.startsWith("orientation-"))) {
    const b = createBoard(lv.seed, lv.tempers, lv.quota, lv.spacing, [], lv.focus ?? null);
    const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;
    const per = b.clusters.map((c) => {
      const cols = c.members.map((m) => m % COLS);
      const rows = c.members.map((m) => (m / COLS) | 0);
      const mx = (Math.min(...cols) + Math.max(...cols)) / 2;
      const my = (Math.min(...rows) + Math.max(...rows)) / 2;
      return Math.max(Math.abs(mx - cx) / cx, Math.abs(my - cy) / cy);
    });
    rs.push(per.reduce((a, v) => a + v, 0) / per.length);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  // Rung boundaries from the ramp table itself, grouped by focus band.
  const bands: Record<string, number[]> = { centre: [], mid: [], edge: [] };
  {
    let i = 0;
    const FOCUS = ["centre", "centre", "mid", "mid", "edge", "edge"];
    ORIENT_STAGES.forEach((st, sIdx) => {
      for (let k = 0; k < st.screens; k++) bands[FOCUS[sIdx]].push(rs[i++]);
    });
  }
  const centre = mean(bands.centre), mid = mean(bands.mid), edge = mean(bands.edge);
  console.log(`  centre ${centre.toFixed(2)}   mid ${mid.toFixed(2)}   edge ${edge.toFixed(2)}`);
  if (!(centre < mid && mid < edge)) fail("groups do not move outwards across orientation");
  if (centre > 0.3) fail(`the first screens are not central enough (${centre.toFixed(2)})`);
  if (edge < 0.6) fail(`the last screens are not peripheral enough (${edge.toFixed(2)})`);
  ok("groups start centred and work outwards");
}

console.log(`\n── the shape of the queue ${"─".repeat(34)}`);
{
  const orient = LEVELS.filter((l) => l.id.startsWith("orientation-"));
  const total = ORIENT_STAGES.reduce((n, st) => n + st.screens, 0);
  if (orient.length !== total) {
    fail(`want ${total} orientation screens (per the ramp table), got ${orient.length}`);
  }
  if (orient.slice(0, -1).some((l) => l.ceremony !== "none")) {
    fail("every orientation screen but the last must advance itself");
  }
  if (orient.filter((l) => l.archived !== false).length !== 1) {
    fail("orientation must hold exactly one archive row");
  }
  if (!orient.every((l) => l.tapToSelect && l.minCapture === 1 && l.selfAgitate)) {
    fail("an orientation screen is misconfigured");
  }
  // Every screen matches its rung: temper count, groups per temper, bins.
  {
    let i = 0;
    ORIENT_STAGES.forEach((st, sIdx) => {
      for (let k = 0; k < st.screens; k++, i++) {
        const l = orient[i];
        const bins = l.showBins ?? l.tempers;
        if (l.tempers.length !== st.tempers) {
          fail(`${l.id}: rung ${sIdx + 1} wants ${st.tempers} tempers, has ${l.tempers.length}`);
        }
        if (l.quota !== st.groupsPerTemper) {
          fail(`${l.id}: rung ${sIdx + 1} wants ${st.groupsPerTemper} groups per temper, quota is ${l.quota}`);
        }
        if (bins.length !== Math.max(st.tempers, st.bins)) {
          fail(`${l.id}: rung ${sIdx + 1} wants ${st.bins} bins shown, deck has ${bins.length}`);
        }
        if (!l.tempers.every((t) => bins.includes(t))) {
          fail(`${l.id}: a content temper has no bin on the deck`);
        }
      }
    });
  }
  // Every temper gets at least one solo screen before any discrimination,
  // and multi-temper screens keep one temper from the screen before, so
  // there is always something familiar to anchor on.
  {
    const soloed = new Set(
      orient.filter((l) => l.tempers.length === 1).map((l) => l.tempers[0]),
    );
    for (const t of TEMPERS) {
      if (!soloed.has(t)) fail(`${t} never gets a solo screen`);
    }
    for (let i = 1; i < orient.length; i++) {
      const cur = orient[i];
      if (cur.tempers.length < 2 || cur.tempers.length === 4) continue;
      if (!cur.tempers.some((t) => orient[i - 1].tempers.includes(t))) {
        fail(`${cur.id} (${cur.tempers.join("+")}) shares nothing with the screen before`);
      }
    }
  }
  // Every Act III mechanic is taught before it is used.
  const first = (pred: (l: (typeof LEVELS)[number]) => boolean, teach: string, what: string) => {
    const i = LEVELS.findIndex(pred);
    if (i < 0) return fail(`${what} is never used`);
    if (LEVELS[i].id !== teach) fail(`${what} first appears on ${LEVELS[i].id}, not ${teach}`);
    if (!LEVELS[i].untimed && LEVELS[i].seconds < 150) fail(`${what}'s teaching file is not generous`);
  };
  first((l) => !!l.decoys, "jesup", "decoys");
  first((l) => !!l.morphs, "nanning", "the morph");
  first((l) => !!l.redact, "yakima", "redaction");
  const fifth = LEVELS.filter((l) => l.fifth);
  if (fifth.length !== 1 || fifth[0].id !== "cold-harbor") fail("the fifth belongs on cold harbor only");
  if (fifth[0]?.teaches) fail("the fifth temper must never be taught");
  ok(`${orient.length} orientation screens matching the ramp table, each anchored on the last`);
}

console.log(bad ? `\nFAILED — ${bad} problems` : "\nPASSED");
process.exit(bad ? 1 : 0);
