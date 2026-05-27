import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Run in Node environment (no DOM needed for most Next.js unit tests)
    environment: 'node',

    // Only pick up test files under src/
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/app/layout.tsx',  // Next.js root layout — not unit-testable
        'src/app/providers.tsx', // Provider wrappers — tested via integration
      ],
      // Thresholds start at 0; raise as test suite matures
      thresholds: {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      },
    },

    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,

    // Set a generous timeout for tests that do async work
    testTimeout: 10000,
  },

  resolve: {
    alias: {
      // Match the path aliases defined in apps/web/tsconfig.json
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@ui-kit': path.resolve(__dirname, '../../packages/ui-kit/src'),
    },
  },
});
