import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src'),
      '@shared': resolve('shared'),
      '@foliate': resolve('third-party/foliate-js'),
      '@inkdown/contracts': resolve('packages/contracts/src/index'),
      '@inkdown/reader-core': resolve('packages/reader-core/src/index'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'electron/**/*.test.ts',
      'shared/**/*.test.ts',
      'scripts/**/*.test.ts',
      'packages/**/*.test.ts',
    ],
  },
})
