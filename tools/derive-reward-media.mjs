/**
 * Derive the shippable reward media from the reference originals.
 *
 * `product-context/outputs/reward_media/` is source material and is never
 * modified — the package says so, and a reference you have recompressed is
 * no longer a reference. This script reads from it and writes web-sized
 * copies into `public/rewards/`, which is what the game loads.
 *
 *     node tools/derive-reward-media.mjs            # posters, what ships today
 *     node tools/derive-reward-media.mjs --clips    # posters + encoded clips
 *
 * **The game ships posters only.** The celebration clips are held back by
 * product decision, not by accident, and `--clips` exists so that turning
 * them back on is one command rather than an afternoon. See
 * `docs/REWARDS.md` Part 7 for why, and for what is wrong with the current
 * clips.
 *
 * The hero plates are 941x1672 PNGs of about 1.8 MB each. Shipping those to
 * a phone to fill a 240px card is absurd, so they come out as 720x1280
 * WebP, which is 20-45 kb apiece.
 *
 * The image encoder is Chromium, through the Playwright the test suite
 * already depends on: it costs nothing to install, it is the same encoder
 * that will decode the result, and it keeps a build-time image library out
 * of a project that has managed without one.
 *
 * The clip encoder is ffmpeg, which this project does *not* depend on.
 * Point `MDR_FFMPEG` at a binary, or `npm i ffmpeg-static` somewhere and
 * pass its path. Playwright bundles an ffmpeg of its own, but it is built
 * `--disable-everything` and cannot decode H.264, so it is no use here.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "product-context/outputs/reward_media");
const OUT = join(ROOT, "public/rewards");
const WITH_CLIPS = process.argv.includes("--clips");

/** Long edge of a delivered plate. The videos are 720x1280; match them. */
const WIDTH = 720;
const HEIGHT = 1280;
const QUALITY = 0.82;

/**
 * Seconds trimmed off the head of every clip.
 *
 * Every supplied clip fades up from pure black over about half a second —
 * frame zero is black in all nine. Played behind a poster that is already
 * showing the scene, that reads as the picture blinking out and coming
 * back. Starting a little way in is the fix.
 */
const FADE_IN = 0.55;

/** Everything the game presents, and what exists for each. */
const ASSETS = [
  { id: "r01_eraser", clip: false },
  { id: "r03_outie_fact_card", clip: false },
  { id: "r02_finger_trap", clip: true },
  { id: "r05_melon_bar", clip: true },
  { id: "r06_wellness_session", clip: true },
  { id: "r07_mde_office_scene", clip: true },
  { id: "r08_crystal_portrait_gift", clip: true },
  { id: "r12_egg_bar", clip: true },
  { id: "r13_watermelon_remembrance", clip: true },
  { id: "r19_waffle_party_i", clip: true },
  { id: "r22_waffle_party_ii", clip: true },
];

const kb = (p) => `${Math.round(statSync(p).size / 1024)}kb`;

function ffmpeg() {
  const bin = process.env.MDR_FFMPEG;
  if (bin && existsSync(bin)) return bin;
  for (const guess of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (existsSync(guess)) return guess;
  }
  return null;
}

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
    console.log(`  ${a.id}.webp  ${kb(poster)}`);
    bytes += statSync(poster).size;
  }
  await browser.close();

  if (WITH_CLIPS) {
    const bin = ffmpeg();
    if (!bin) {
      console.log(
        "\n--clips needs ffmpeg. Set MDR_FFMPEG, or `npm i ffmpeg-static`" +
          " somewhere and point at node_modules/ffmpeg-static/ffmpeg.",
      );
    } else {
      console.log("");
      for (const a of ASSETS.filter((x) => x.clip)) {
        const from = join(SRC, "videos", `${a.id}.mp4`);
        // Two siblings, so the page can offer whichever the browser has.
        // H.264 is what every shipping browser decodes; VP9 is what the
        // codec-stripped Chromium the tests run in decodes, which is the
        // only way an automated check can ever watch one play.
        const mp4 = join(OUT, `${a.id}.mp4`);
        const webm = join(OUT, `${a.id}.webm`);
        const common = ["-y", "-loglevel", "error", "-ss", String(FADE_IN), "-i", from, "-an"];
        execFileSync(bin, [...common, "-c:v", "libx264", "-crf", "32", "-preset", "slow",
          "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
        execFileSync(bin, [...common, "-c:v", "libvpx-vp9", "-crf", "40", "-b:v", "0",
          "-row-mt", "1", webm]);
        const was = Math.round(statSync(from).size / 1024);
        console.log(`  ${a.id}  ${was}kb -> ${kb(mp4)} h264 / ${kb(webm)} vp9`);
        bytes += statSync(mp4).size + statSync(webm).size;
      }
    }
  }

  console.log(`\n${Math.round(bytes / 1024)}kb in public/rewards/`);
}

await main();
