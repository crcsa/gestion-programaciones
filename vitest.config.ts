import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        // Schema/seed files are pure type definitions — no logic to test
        'src/lib/db/schema/**',
        'src/lib/db/seed/**',
        'src/lib/db/migrations/**',
        // Next.js infrastructure
        'src/app/**',
        'src/middleware.ts',
        // UI components managed by shadcn (generated code)
        'src/components/ui/**',
        // Config files
        '**/*.config.*',
        '**/node_modules/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
