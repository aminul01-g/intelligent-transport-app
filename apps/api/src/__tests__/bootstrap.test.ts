/**
 * Health check route smoke test.
 *
 * This is a placeholder test that validates the Jest + ts-jest setup works
 * correctly in CI. Replace / extend with real unit tests as the API grows.
 *
 * To run:  npm test -w @transport/api
 */

describe('API bootstrap', () => {
  it('confirms the test environment is configured correctly', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('can perform basic assertions', () => {
    const result = 1 + 1;
    expect(result).toBe(2);
  });

  it('handles async operations', async () => {
    const resolved = await Promise.resolve('ok');
    expect(resolved).toBe('ok');
  });
});
