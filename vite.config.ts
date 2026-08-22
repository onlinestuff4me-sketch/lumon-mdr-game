import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves a project site from /<repo>/, so the production
// bundle needs that prefix on its asset URLs. The dev server stays at /.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/lumon-mdr-game/" : "/",
  plugins: [react(), tailwindcss()],
}))
