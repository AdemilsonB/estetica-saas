import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/shared/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 60,
        functions: 70,
        lines: 70,
      },
      exclude: [
        'node_modules/**',
        'src/components/ui/**',
        'src/shared/test/**',
        '**/*.config.*',
        '**/*.d.ts',
        'prisma/**',
        '.next/**',
      ],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
