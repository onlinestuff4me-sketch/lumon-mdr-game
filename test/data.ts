/**
 * Invariants of the level data and the board generator. Pure — no browser,
 * runs in about a second, and covers the things that silently make a file
 * unwinnable rather than visibly broken.
 */
import { LEVELS, COLS, ROWS, MIN_CAPTURE, TEMPERS } from "../src/game/constants";
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
  if (lv.binHint && lv.tempers.length !== 1) {
    fail(`${lv.id}: binHint on a multi-bin file would point at the answer`);
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
  const centre = mean(rs.slice(0, 4)), mid = mean(rs.slice(4, 12)), edge = mean(rs.slice(12));
  console.log(`  centre ${centre.toFixed(2)}   mid ${mid.toFixed(2)}   edge ${edge.toFixed(2)}`);
  if (!(centre < mid && mid < edge)) fail("groups do not move outwards across orientation");
  if (centre > 0.3) fail(`the first screens are not central enough (${centre.toFixed(2)})`);
  if (edge < 0.6) fail(`the last screens are not peripheral enough (${edge.toFixed(2)})`);
  ok("groups start centred and work outwards");
}

console.log(`\n── the shape of the queue ${"─".repeat(34)}`);
{
  const orient = LEVELS.filter((l) => l.id.startsWith("orientation-"));
  if (orient.length !== 29) fail(`want 29 orientation screens, got ${orient.length}`);
  if (orient.slice(0, -1).some((l) => l.ceremony !== "none")) {
    fail("every orientation screen but the last must advance itself");
  }
  if (orient.filter((l) => l.archived !== false).length !== 1) {
    fail("orientation must hold exactly one archive row");
  }
  if (!orient.every((l) => l.tapToSelect && l.minCapture === 1 && l.selfAgitate)) {
    fail("an orientation screen is misconfigured");
  }
  // Stage A — three screens of each temper, in numbered order.
  for (let t = 0; t < 4; t++) {
    const three = orient.slice(t * 3, t * 3 + 3);
    const names = three.map((l) => l.tempers[0]);
    if (new Set(names).size !== 1 || names[0] !== TEMPERS[t]) {
      fail(`stage A block ${t + 1} is ${names.join(",")}, want three of ${TEMPERS[t]}`);
    }
    if (three.some((l) => l.tempers.length !== 1 || l.quota !== 1)) {
      fail(`stage A block ${t + 1} is not one group of one temper`);
    }
  }
  // Stage B — eight screens of two groups of a single temper, opening on
  // the temper stage A just finished with and cycling.
  const b = orient.slice(12, 20);
  if (b.length !== 8) fail(`stage B should be 8 screens, got ${b.length}`);
  if (b.some((l) => l.tempers.length !== 1 || l.quota !== 2)) {
    fail("stage B screens must be two groups of one temper");
  }
  if (b[0].tempers[0] !== orient[11].tempers[0]) {
    fail(`stage B opens on ${b[0].tempers[0]}, but stage A ended on ${orient[11].tempers[0]}`);
  }
  const bSeen: Record<string, number> = {};
  for (const l of b) bSeen[l.tempers[0]] = (bSeen[l.tempers[0]] ?? 0) + 1;
  for (const t of TEMPERS) {
    if (bSeen[t] !== 2) fail(`stage B shows ${t} ${bSeen[t] ?? 0} times, want 2`);
  }
  // Stage C — the first discrimination. It must open on the two tempers the
  // player has just seen, and every screen must keep one temper from the
  // screen before it, so there is always something familiar to anchor on.
  const c = orient.slice(20, 24);
  if (c.length !== 4) fail(`stage C should be 4 screens, got ${c.length}`);
  if (c.some((l) => l.tempers.length !== 2)) fail("stage C screens must carry two tempers");
  const recent = [orient[19].tempers[0], orient[18].tempers[0]];
  if (!recent.every((t) => c[0].tempers.includes(t))) {
    fail(`stage C opens on ${c[0].tempers.join("+")}, want the two most recent ${recent.join("+")}`);
  }
  for (let i = 1; i < c.length; i++) {
    if (!c[i].tempers.some((t) => c[i - 1].tempers.includes(t))) {
      fail(`stage C screen ${i + 1} (${c[i].tempers.join("+")}) shares nothing with ${c[i - 1].tempers.join("+")}`);
    }
  }
  const cSeen: Record<string, number> = {};
  for (const l of c) for (const t of l.tempers) cSeen[t] = (cSeen[t] ?? 0) + 1;
  for (const t of TEMPERS) {
    if (cSeen[t] !== 2) fail(`stage C shows ${t} ${cSeen[t] ?? 0} times, want 2`);
  }
  // Stage D — the full deck.
  if (orient.slice(24).some((l) => l.tempers.length !== 4)) {
    fail("stage D screens must carry all four tempers");
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
  ok("29 orientation screens in four stages, each anchored on the last");
}

console.log(bad ? `\nFAILED — ${bad} problems` : "\nPASSED");
process.exit(bad ? 1 : 0);
