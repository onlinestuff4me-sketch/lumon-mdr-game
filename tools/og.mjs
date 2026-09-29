/**
 * Render the link card to `public/og.png`.
 *
 * Committed as a file rather than generated at build time: the card is what
 * a scraper fetches, so it has to exist at a stable URL on both hosts, and
 * a build step that needs a browser is a build step that breaks on the host
 * that does not have one. Re-run this by hand when the card changes:
 *
 *   node tools/og.mjs
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const sandboxed = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(
  existsSync(sandboxed) ? { executablePath: sandboxed } : {},
);
// 1200x630 is what every scraper asks for, and deviceScaleFactor 1 keeps it
// exactly that. Doubling it would be sharper and four times the bytes for a
// picture nobody looks at for longer than a glance.
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.goto(`file://${resolve(here, "og.html")}`, { waitUntil: "load" });
await page.waitForTimeout(250);
const out = resolve(here, "..", "public", "og.png");
await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
