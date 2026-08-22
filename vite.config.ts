import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative asset URLs, so one build works wherever it is mounted.
//
// GitHub Pages serves a project site from /<repo>/ while Vercel serves the
// same repo from the root of its own domain. Hardcoding the Pages prefix
// made every asset 404 on Vercel; "./" resolves against the document, which
// is correct in both. Safe here because this is a single page with no
// client-side routing, so the document is always at the mount point.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
})
