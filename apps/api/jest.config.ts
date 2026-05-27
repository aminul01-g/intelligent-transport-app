import type { Config } from 'jest';

const config: Config = {
  // Use ts-jest preset so TypeScript files are compiled on the fly
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root relative to this file (apps/api/)
  rootDir: '.',

  // Only pick up test files under src/
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.spec.ts'],

  // Module name mapper for workspace alias resolution
  moduleNameMapper: {
    '^@transport/shared-types(.*)$':
      '<rootDir>/../../packages/shared-types/src$1',
  },

  // Collect coverage from source files only
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts', // entry-point bootstrapping — not unit-testable
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],

  // TypeScript transformation via ts-jest
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },

  // Fail the suite if coverage drops below these thresholds
  coverageThreshold: {
    global: {
      lines: 0,    // start at 0; raise as test suite matures
      branches: 0,
      functions: 0,
      statements: 0,
    },
  },

  // Set a sensible timeout for tests that spin up DB connections
  testTimeout: 15000,

  // Clear mocks between every test automatically
  clearMocks: true,
};

export default config;
