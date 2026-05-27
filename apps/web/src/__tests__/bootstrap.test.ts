/**
 * Web app bootstrap smoke test.
 *
 * This is a placeholder test that validates the Vitest setup works correctly
 * in CI. Replace / extend with real component and utility tests as the app grows.
 *
 * To run:  npm test -w @transport/web
 */

import { describe, it, expect } from 'vitest';

describe('Web app bootstrap', () => {
  it('confirms the test environment is configured correctly', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('can perform basic assertions', () => {
    const sum = (a: number, b: number) => a + b;
    expect(sum(2, 3)).toBe(5);
  });

  it('handles async operations', async () => {
    const resolved = await Promise.resolve('vitest-ok');
    expect(resolved).toBe('vitest-ok');
  });
});
