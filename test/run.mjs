/**
 * `npm test` — runs the data invariants, then boots a preview server on the
 * production build and runs the end-to-end suite against it.
 *
 * The e2e suite runs against `dist`, not the dev server: a regression that
 * only appears in a production build is exactly the kind that reaches a
 * player, and this project ships straight from `dist` to two hosts.
 */
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const step = (name) => console.log(`\n════ ${name} ${"═".repeat(Math.max(0, 56 - name.length))}`);
const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opts }).status ?? 1;

let failed = 0;

step("data invariants");
{
  const bundle = "node_modules/.cache/mdr-test-data.mjs";
  if (run("npx", ["esbuild", "test/data.ts", "--bundle", "--platform=node",
                  "--format=esm", `--outfile=${bundle}`, "--log-level=error"])) {
    console.log("could not bundle the data tests");
    process.exit(1);
  }
  failed += run("node", [bundle]) ? 1 : 0;
}

step("build");
// Two builds. `dist` is exactly what ships and is what the build must be
// able to produce; `dist-test` is the same production pipeline with the
// engine handle compiled in, which is what the suite drives. Testing the
// dev server instead would miss anything that only breaks once bundled.
if (run("npm", ["run", "build"])) {
  console.log("build failed — skipping the end-to-end suite");
  process.exit(1);
}
if (run("npx", ["vite", "build", "--outDir", "dist-test"], {
  env: { ...process.env, VITE_MDR_TEST: "1" },
})) {
  console.log("test build failed");
  process.exit(1);
}

step("end-to-end");
const port = 5273;
const server = spawn("npx", ["vite", "preview", "--outDir", "dist-test",
                             "--port", String(port), "--host", "127.0.0.1"], {
  stdio: "ignore",
});
try {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok) break;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  failed += run("node", ["test/e2e.mjs"], {
    env: { ...process.env, MDR_URL: `http://127.0.0.1:${port}/` },
  }) ? 1 : 0;
} finally {
  server.kill();
}

console.log(failed ? "\n✗ test suite FAILED" : "\n✓ test suite passed");
process.exit(failed ? 1 : 0);
