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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Rebuild `public/lumon.svg` from the workshop file.
 *
 * `tools/lumon-mark.html` is the one place the mark's geometry lives — it
 * opens in a browser, so it can be worked on by looking at it. The asset
 * the site serves is derived from it here rather than maintained beside
 * it, because two copies of a logo is one copy and a thing that is
 * slightly wrong. A data invariant checks they still agree.
 */
export function buildMark() {
  const src = readFileSync(resolve(here, "lumon-mark.html"), "utf8");
  const svg = src
    .slice(src.indexOf('<svg id="lumon-mark"'), src.indexOf("</svg>") + 6)
    // The phosphor is baked in: an <img> cannot inherit `currentColor`
    // from the page that places it.
    .replaceAll("currentColor", "#7bf3bb")
    .replace('<svg id="lumon-mark" viewBox', '<svg xmlns="http://www.w3.org/2000/svg" viewBox');
  return svg;
}

const HEADER = `<!--
  The Lumon mark.

  Generated from tools/lumon-mark.html by tools/og.mjs — edit that, not
  this. Drawn as vector rather than traced from a frame grab, so it stays
  sharp at any size.
-->
`;

writeFileSync(resolve(here, "..", "public", "lumon.svg"), HEADER + buildMark() + "\n");

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

/**
 * And the home-screen icon.
 *
 * Written inline rather than given a workshop file of its own: unlike the
 * card, this is not a composition — it is the mark, centred, on the
 * terminal's own background, and there is nothing in it to sit and look
 * at while adjusting.
 *
 * 180x180 and opaque. iOS masks the icon to its own rounded square and
 * composites transparency against whatever it likes, so the black is
 * baked in and the corners are left square. PNG because iOS will not take
 * an SVG here, which is the only reason this is a second file at all.
 */
const icon = await browser.newPage({
  viewport: { width: 180, height: 180 },
  deviceScaleFactor: 1,
});
await icon.setContent(`<!doctype html><html><body style="margin:0">
  <div style="width:180px;height:180px;background:#010604;display:flex;
              align-items:center;justify-content:center">
    <div style="width:150px;filter:drop-shadow(0 0 9px rgba(47,214,138,0.55))">
      ${buildMark().replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}
    </div>
  </div>
</body></html>`);
await icon.waitForTimeout(120);
const iconOut = resolve(here, "..", "public", "apple-touch-icon.png");
await icon.screenshot({ path: iconOut });

await browser.close();
console.log(`wrote ${out}`);
console.log(`wrote ${iconOut}`);
