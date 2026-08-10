import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/junro/',
  test: {
    dir: 'src',   // don't scan .claude/worktrees (agent checkouts live there)
  },
})
