import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// Config for the READ-ONLY live-installation audit (pnpm run audit:puck-data).
// Kept separate from vitest.config.mts so the normal test suite stays
// deterministic on a clean database.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/audit/**/*.live.spec.ts'],
    server: {
      deps: {
        inline: ['@delmaredigital/payload-puck'],
      },
    },
  },
})
