// tests/helpers.js
// Tiny assertion helpers shared across test files.

export function createRunner() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓  ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗  ${name}`);
      console.log(`       ${e.message}`);
      failed++;
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error(msg ?? 'Assertion failed');
  }

  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }

  function assertThrows(fn, expectedMsg) {
    let threw = false;
    try { fn(); } catch (e) {
      threw = true;
      if (expectedMsg && !String(e.message).includes(expectedMsg)) {
        throw new Error(`Expected error containing "${expectedMsg}", got: "${e.message}"`);
      }
    }
    if (!threw) throw new Error('Expected function to throw, but it did not');
  }

  function results() { return { passed, failed }; }

  return { test, assert, assertEqual, assertThrows, results };
}
