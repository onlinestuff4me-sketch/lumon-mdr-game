/**
 * Derive the shippable reward media from the reference originals.
 *
 * `product-context/outputs/reward_media/` is source material and is never
 * modified — the package says so, and a reference you have recompressed is
 * no longer a reference. This script reads from it and writes web-sized
 * copies into `public/rewards/`, which is what the game loads.
 *
 * The hero plates are 941x1672 PNGs of about 1.8 MB each. Shipping those to
 * a phone to fill a 280px card is absurd, so they come out as 720x1280
 * WebP — the same frame the videos already use.
 *
 * The encoder is Chromium, through the Playwright the test suite already
 * depends on. It costs nothing to install, it is the same encoder that will
 * decode the result, and it keeps a build-time image library out of a
 * project that has managed without one.
 *
 *     node tools/derive-reward-media.mjs
 *
 * Re-runnable: it overwrites what it wrote last time and touches nothing
 * else. Run it when the manifest gains an asset, not on every build — the
 * output is committed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "product-context/outputs/reward_media");
const OUT = join(ROOT, "public/rewards");

/** Long edge of a delivered plate. The videos are 720x1280; match them. */
const WIDTH = 720;
const HEIGHT = 1280;
const QUALITY = 0.82;

/** Everything the game presents: a poster each, motion where it exists. */
const ASSETS = [
  { id: "r01_eraser", still: false },
  // The blank card plate. Its sentence is typeset at runtime — nothing
  // legible is ever baked into a generated image.
  { id: "r03_outie_fact_card", still: false },
  { id: "r06_wellness_session", still: true },
  { id: "r07_mde_office_scene", still: true },
  { id: "r19_waffle_party_i", still: true },
  { id: "r22_waffle_party_ii", still: true },
  { id: "r02_finger_trap", still: true },
  { id: "r05_melon_bar", still: true },
  { id: "r08_crystal_portrait_gift", still: true },
  { id: "r12_egg_bar", still: true },
  { id: "r13_watermelon_remembrance", still: true },
];

const kb = (p) => `${Math.round(statSync(p).size / 1024)}kb`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(
    existsSync("/opt/pw-browsers/chromium")
      ? { executablePath: "/opt/pw-browsers/chromium" }
      : {},
  );
  const page = await browser.newPage();

  /** PNG in, cover-cropped WebP out, encoded by the browser. */
  const encode = async (from, to) => {
    const data = readFileSync(from).toString("base64");
    const b64 = await page.evaluate(
      async ({ src, w, h, q }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        // Cover, not stretch: the plates are 9:16 to within a rounding
        // error, so this trims a pixel rather than distorting a face.
        const scale = Math.max(w / img.width, h / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return c.toDataURL("image/webp", q).split(",")[1];
      },
      { src: data, w: WIDTH, h: HEIGHT, q: QUALITY },
    );
    writeFileSync(to, Buffer.from(b64, "base64"));
    return to;
  };

  let bytes = 0;
  for (const a of ASSETS) {
    const poster = await encode(
      join(SRC, "images", `${a.id}.png`),
      join(OUT, `${a.id}.webp`),
    );
    console.log(`  ${a.id}.webp        ${kb(poster)}`);
    bytes += statSync(poster).size;

    if (a.still) {
      const still = await encode(
        join(SRC, "reduced_motion", `${a.id}_still.png`),
        join(OUT, `${a.id}_still.webp`),
      );
      console.log(`  ${a.id}_still.webp  ${kb(still)}`);
      bytes += statSync(still).size;

      // The MP4s are already H.264 720x1280 30fps with no audio track:
      // exactly what ships. Re-encoding them would only lose quality.
      const from = join(SRC, "videos", `${a.id}.mp4`);
      const to = join(OUT, `${a.id}.mp4`);
      writeFileSync(to, readFileSync(from));
      console.log(`  ${a.id}.mp4         ${kb(to)}`);
      bytes += statSync(to).size;
    }
  }

  await browser.close();
  console.log(`\n${Math.round(bytes / 1024)}kb of reward media in public/rewards/`);
}

await main();
