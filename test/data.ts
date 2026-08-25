/**
 * Invariants of the level data and the board generator. Pure — no browser,
 * runs in about a second, and covers the things that silently make a file
 * unwinnable rather than visibly broken.
 */
import { LEVELS, COLS, ROWS, MIN_CAPTURE, TEMPERS, ORIENT_STAGES } from "../src/game/constants";
import { assignMorphs, boardExtras, createBoard } from "../src/game/grid";
import { LADDER, forecast, newlyEarned } from "../src/game/rewards";
import { CATALOG } from "../src/game/catalog";
import { FACTS, FACT_PLAN, factById, factCount, pickFacts } from "../src/game/facts";
import { applyCompletion, counters, emptyProgress, type Progress } from "../src/game/progress";
import { existsSync } from "node:fs";

let bad = 0;
const fail = (m: string) => { bad++; console.log("  FAIL " + m); };
const ok = (m: string) => console.log("  ok   " + m);
const eqIds = (m: string, a: string[], b: string[]) => {
  if (a.join(",") !== b.join(",")) fail(`${m} — ${a.join(",")} vs ${b.join(",")}`);
};

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

// ── the incentive ladder ─────────────────────────────────────────────
// The rescale in docs/REWARDS.md only means anything if every rung is
// actually reachable by playing the game that exists. These tests play it.

console.log(`\n── incentive ladder ${"─".repeat(41)}`);
{
  /** Refine every screen in order, crediting the ledger as the game does. */
  const playthrough = (perfect = true) => {
    let p: Progress = emptyProgress();
    const earnedAt: Record<string, number> = {};
    LEVELS.forEach((lv, i) => {
      const step = applyCompletion(p, {
        levelId: lv.id,
        tempers: lv.tempers,
        quota: lv.quota,
        perfect,
      });
      p = step.progress;
      for (const rung of step.earned) {
        if (earnedAt[rung.id] !== undefined) fail(`${rung.id} earned twice`);
        earnedAt[rung.id] = i + 1;
        // Claiming is what M2 will do at the boundary; the ledger only has
        // to hold the promise until then. Claim here so prerequisites
        // (Waffle II waits for Waffle I) are exercised the way they ship.
        p.rewardState[rung.id] = "claimed";
      }
      p.rewardQueue = [];
    });
    return { p, earnedAt };
  };

  const { p, earnedAt } = playthrough();

  if (p.screensCompleted !== LEVELS.length) {
    fail(`credited ${p.screensCompleted} screens, not ${LEVELS.length}`);
  }
  const handBins = LEVELS.reduce((n, l) => n + l.quota * l.tempers.length, 0);
  if (p.binsTotal !== handBins) fail(`credited ${p.binsTotal} bins, not ${handBins}`);
  const byTemper = TEMPERS.reduce((n, t) => n + p.binsByTemper[t], 0);
  if (byTemper !== p.binsTotal) fail("per-temper bins do not sum to the total");

  // The finding that started all of this: no reward may sit past the end.
  for (const rung of LADDER) {
    if (earnedAt[rung.id] === undefined) {
      fail(`${rung.id} (${rung.reward}) is never earned in a full playthrough`);
    }
  }
  ok(`all ${LADDER.length} rungs earned in ${LEVELS.length} screens / ${p.binsTotal} bins`);

  // Front-loading, measured rather than asserted in prose: the first three
  // screens each pay, and no two consecutive screens after that go by
  // without something.
  for (const at of [1, 2, 3]) {
    if (!Object.values(earnedAt).includes(at)) fail(`screen ${at} pays nothing`);
  }
  {
    let gap = 0;
    let worst = 0;
    for (let i = 1; i <= LEVELS.length; i++) {
      gap = Object.values(earnedAt).includes(i) ? 0 : gap + 1;
      worst = Math.max(worst, gap);
    }
    if (worst > 2) fail(`${worst} screens in a row with no incentive`);
    ok(`longest gap between incentives is ${worst} screens`);
  }

  // Boundaries: one below earns nothing, exactly at earns it, and a rung
  // is never earned twice however far the counter runs past it.
  for (const rung of LADDER) {
    const lane = rung.lane;
    const below = { screens: 0, bins: 0, [lane]: rung.at - 1 } as unknown as {
      screens: number;
      bins: number;
    };
    const at = { screens: 1e4, bins: 1e4 };
    const justBelow = newlyEarned({ screens: 0, bins: 0 }, below, new Set());
    if (justBelow.some((r) => r.id === rung.id)) {
      fail(`${rung.id} earned one short of its threshold`);
    }
    if (!newlyEarned({ screens: 0, bins: 0 }, at, new Set()).some((r) => r.id === rung.id)) {
      // Compound and prerequisite rungs are the exception only when their
      // second condition is unmet, and `at` satisfies every counter.
      if (!rung.after) fail(`${rung.id} not earned when both counters are past it`);
    }
    if (newlyEarned(at, at, new Set()).length !== 0) fail("a still counter earned something");
  }
  ok("every rung earns at its threshold and never one short");

  // Idempotency: the completion effect can run more than once per screen.
  {
    const first = applyCompletion(emptyProgress(), {
      levelId: LEVELS[0].id,
      tempers: LEVELS[0].tempers,
      quota: LEVELS[0].quota,
      perfect: true,
    });
    const again = applyCompletion(first.progress, {
      levelId: LEVELS[0].id,
      tempers: LEVELS[0].tempers,
      quota: LEVELS[0].quota,
      perfect: true,
    });
    if (again.progress !== first.progress) fail("re-crediting a screen changed the ledger");
    if (again.earned.length !== 0) fail("re-crediting a screen earned a reward again");
    ok("a screen credits once, however often the boundary fires");
  }

  // The forecast shows the next threshold and never the one after it.
  {
    let p2: Progress = emptyProgress();
    for (const lv of LEVELS) {
      const lanes = forecast(counters(p2));
      for (const lane of lanes) {
        if (lane.target <= lane.current && lane.remaining !== 0) {
          fail(`${lane.lane} forecast points behind the counter`);
        }
        const rungs = LADDER.filter((r) => r.lane === lane.lane).map((r) => r.at);
        const next = rungs.filter((n) => n > lane.current).sort((a, b) => a - b)[0];
        // A compound rung whose other counter is unmet stays put, which is
        // the only case where the target is not strictly ahead.
        if (next !== undefined && lane.target > next && !lane.also) {
          fail(`${lane.lane} forecast skipped ${next} to show ${lane.target}`);
        }
      }
      p2 = applyCompletion(p2, {
        levelId: lv.id,
        tempers: lv.tempers,
        quota: lv.quota,
        perfect: true,
      }).progress;
    }
    if (forecast(counters(p2)).length !== 0) fail("the forecast still promises something after the last file");
    ok("the forecast shows one threshold per lane, and stops when the ladder does");
  }

  // Perfect play, and its opposite.
  {
    const mixed = playthrough(false).p;
    if (mixed.perfectScreensTotal !== 0) fail("an imperfect run counted perfect screens");
    if (mixed.perfectScreenStreak !== 0) fail("an imperfect run kept a streak");
    if (p.perfectScreensTotal !== LEVELS.length) fail("a clean run lost a perfect screen");
    ok("perfect screens and streaks track the drops");
  }

  // Waffle II is compound and waits for Waffle I.
  {
    const waffleII = LADDER.find((r) => r.id === "S30");
    if (!waffleII?.after?.length || !waffleII.also) fail("S30 lost its compound conditions");
    const withoutFirst = newlyEarned(
      { screens: 29, bins: 100 },
      { screens: 30, bins: 105 },
      new Set(),
    );
    if (withoutFirst.some((r) => r.id === "S30")) fail("Waffle II arrived without Waffle I");
    ok("the Waffle tiers need both counters, in order");
  }
}

// ── reward media ─────────────────────────────────────────────────────
// The manifest's own first validation rule, applied to what we derived
// from it: every path a reward promises has to exist. A reveal that 404s
// is the one failure a player cannot work around.

console.log(`\n── reward media ${"─".repeat(45)}`);
{
  let files = 0;
  for (const [id, def] of Object.entries(CATALOG)) {
    for (const [kind, url] of Object.entries(def)) {
      if (kind === "name" || kind === "line" || kind === "kind") continue;
      const path = `public/${String(url).replace(/^\.?\//, "")}`;
      files++;
      if (!existsSync(path)) fail(`${id}: ${kind} is missing — ${path}`);
    }
    if (!def.video !== !def.still) {
      fail(`${id}: a clip needs a reduced-motion still, and a still needs a clip`);
    }
    if (!def.name || !def.line) fail(`${id}: a reward needs a name and a line`);
  }
  ok(`${files} media files, all present, every clip with a still`);

  // Rewards with no record here are later milestones and stay queued. The
  // list is explicit so that a typo in a rung's reward id fails loudly
  // rather than silently becoming "a milestone for later".
  const LATER = new Set(["R03", "R06", "R07", "R19", "R22"]);
  for (const rung of LADDER) {
    const known = rung.reward in CATALOG || LATER.has(rung.reward);
    if (!known) fail(`${rung.id} awards ${rung.reward}, which is neither built nor deferred`);
  }
  const presentable = LADDER.filter((r) => r.reward in CATALOG).length;
  ok(`${presentable} of ${LADDER.length} rungs can present today; the rest wait their milestone`);
}

// ── the fact bank ────────────────────────────────────────────────────
// The rules here are the fact bank's own: two labelled pools kept apart,
// one sentence used for card, caption and voice alike, a mature entry that
// nothing selects while there is no setting to allow it, and a draw that
// is decided once and cannot be rerolled by closing the app.

console.log(`\n── outie facts ${"─".repeat(46)}`);
{
  const canon = FACTS.filter((f) => f.label === "CANON_WELLNESS_CLAIM");
  const original = FACTS.filter((f) => f.label === "ORIGINAL_APOCRYPHA");
  if (canon.length !== 25) fail(`${canon.length} show-derived facts, not 25`);
  if (original.length !== 24) fail(`${original.length} original facts, not 24`);
  if (new Set(FACTS.map((f) => f.id)).size !== FACTS.length) fail("duplicate fact ids");
  if (new Set(FACTS.map((f) => f.text)).size !== FACTS.length) fail("duplicate fact text");
  for (const f of FACTS) {
    if (!f.text.trim().endsWith(".")) fail(`${f.id} is not a sentence`);
    if (!/^Your outie/.test(f.text)) fail(`${f.id} does not read as a Wellness claim`);
  }
  ok(`${canon.length} show-derived and ${original.length} original facts, all distinct`);

  // Every rung that awards a fact card or a session has a plan, and every
  // plan belongs to such a rung.
  for (const rung of LADDER) {
    const wants = rung.reward === "R03" ? 1 : rung.reward === "R06" ? -1 : 0;
    const planned = factCount(rung.id);
    if (wants === 1 && planned !== 1) fail(`${rung.id} is a fact card but reads ${planned} facts`);
    if (wants === -1 && planned < 3) fail(`${rung.id} is a session but reads only ${planned} facts`);
    if (wants === 0 && planned !== 0) fail(`${rung.id} awards ${rung.reward} but has a fact plan`);
  }
  for (const id of Object.keys(FACT_PLAN)) {
    if (!LADDER.some((r) => r.id === id)) fail(`${id} has a fact plan but is not a rung`);
  }
  ok("every fact card and session has a plan, and every plan has a rung");

  // A draw is deterministic, respects the pools it asked for, never
  // repeats a sentence the refiner has already heard, and never reaches
  // for the mature entry while nothing can allow it.
  {
    const seen: string[] = [];
    let mature = 0;
    for (const rungId of Object.keys(FACT_PLAN)) {
      const first = pickFacts(rungId, seen);
      const again = pickFacts(rungId, seen);
      eqIds(`${rungId} draws the same sentences twice running`, first, again);
      const plan = FACT_PLAN[rungId];
      const drawn = first.map((id) => factById(id)!);
      if (drawn.some((f) => !f)) fail(`${rungId} drew an id that is not in the bank`);
      const gotCanon = drawn.filter((f) => f.label === "CANON_WELLNESS_CLAIM").length;
      const gotOriginal = drawn.filter((f) => f.label === "ORIGINAL_APOCRYPHA").length;
      if (gotCanon !== plan.canon || gotOriginal !== plan.original) {
        fail(`${rungId} wanted ${plan.canon}/${plan.original}, drew ${gotCanon}/${gotOriginal}`);
      }
      for (const id of first) {
        if (seen.includes(id)) fail(`${rungId} repeated ${id}, already heard`);
      }
      mature += drawn.filter((f) => f.mature).length;
      seen.push(...first);
    }
    if (mature > 0) fail(`${mature} mature facts were selected with no setting to allow them`);
    ok(`${seen.length} sentences drawn across the ladder, none repeated, none mature`);
  }
}

console.log(bad ? `\nFAILED — ${bad} problems` : "\nPASSED");
process.exit(bad ? 1 : 0);
