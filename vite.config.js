import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/junro/',
  server: {
    // Same-origin proxy to the R2 places bucket in dev, so local dev doesn't
    // depend on the bucket's CORS allowlist (which is per-origin/port). Prod is
    // static — it hits the R2 URL directly (github.io is CORS-whitelisted).
    proxy: {
      '/r2': {
        target: 'https://pub-e2d74adde0e44b6dbb3904fb4616f8b5.r2.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/r2/, ''),
      },
    },
  },
  test: {
    dir: 'src', // don't scan .claude/worktrees (agent checkouts live there)
  },
})
