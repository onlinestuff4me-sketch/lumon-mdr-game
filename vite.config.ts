import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative asset URLs, so one build works wherever it is mounted.
//
// GitHub Pages serves a project site from /<repo>/ while Vercel serves the
// same repo from the root of its own domain. Hardcoding the Pages prefix
// made every asset 404 on Vercel; "./" resolves against the document, which
// is correct in both. Safe here because this is a single page with no
// client-side routing, so the document is always at the mount point.
/**
 * GitHub Pages has no rewrites, and answers an unknown path with
 * `404.html`. Shipping a copy of the document under that name is what
 * makes `/dance` work there — the page renders, the status line says 404,
 * and nobody testing a dance floor minds. Vercel does the same job with
 * the rewrite in `vercel.json`.
 *
 * Safe because `base` is relative: from `/<repo>/dance` the assets
 * resolve to `/<repo>/assets/…`, which is where they are.
 */
function pagesFallback(): Plugin {
  let outDir = "dist";
  return {
    name: "pages-404-fallback",
    // Read from the resolved config rather than assumed: the suite builds
    // a second time into `dist-test`, and a fallback written to the wrong
    // directory is a fallback that is never served.
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const index = resolve(outDir, "index.html");
      if (existsSync(index)) copyFileSync(index, resolve(outDir, "404.html"));
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), pagesFallback()],
})
