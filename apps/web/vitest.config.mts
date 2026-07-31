import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts', 'tests/int/**/*.int.spec.tsx'],
    server: {
      deps: {
        // payload-puck ships CSS imports (e.g. dist/fields/richtext); when the
        // package is externalized Node's ESM loader rejects them, so let Vite
        // transform it like application code.
        inline: ['@delmaredigital/payload-puck'],
      },
    },
  },
})
