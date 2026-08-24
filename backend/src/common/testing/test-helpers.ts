/**
 * Assertion helpers shared by the ported order-status suite.
 *
 * The original file also carried a hand-rolled test runner - a TestResult
 * class plus runTest/runTestSuite - which Vitest replaced. Those are gone; only
 * the assertions the suite actually calls are kept.
 */

/** Throws when the condition is falsy. */
export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/** Throws when the two values are not strictly equal. */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${String(expected)}, but got ${String(actual)}`);
  }
}

/** Sleep helper for tests that need to let a timer elapse. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
