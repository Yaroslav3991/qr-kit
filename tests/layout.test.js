// tests/layout.test.js
import { computeLayout } from '../utils/layout.js';
import { createRunner } from './helpers.js';

export function runTests() {
  const { test, assert, assertEqual, results } = createRunner();

  // ── Basic geometry ───────────────────────────────────────────────
  test('outer equals floored size', () => {
    const { outer } = computeLayout(21, 256, 16);
    assertEqual(outer, 256);
  });

  test('outer floors non-integer size', () => {
    const { outer } = computeLayout(21, 256.9, 16);
    assertEqual(outer, 256);
  });

  test('moduleSize is a positive integer', () => {
    const { moduleSize } = computeLayout(21, 256, 16);
    assert(Number.isInteger(moduleSize) && moduleSize >= 1);
  });

  test('modules fit inside outer bounds', () => {
    const moduleCount = 21;
    const { outer, moduleSize, quietLeft, quietTop } = computeLayout(moduleCount, 200, 12);
    const rightEdge  = quietLeft + moduleCount * moduleSize;
    const bottomEdge = quietTop  + moduleCount * moduleSize;
    assert(rightEdge  <= outer, `right edge ${rightEdge} overflows outer ${outer}`);
    assert(bottomEdge <= outer, `bottom edge ${bottomEdge} overflows outer ${outer}`);
  });

  // ── Quiet zone ───────────────────────────────────────────────────
  test('quietLeft and quietTop are both >= margin', () => {
    const margin = 16;
    const { quietLeft, quietTop } = computeLayout(21, 256, margin);
    assert(quietLeft >= margin, `quietLeft ${quietLeft} < margin ${margin}`);
    assert(quietTop  >= margin, `quietTop ${quietTop} < margin ${margin}`);
  });

  test('grid is centred: quietLeft equals quietTop', () => {
    const { quietLeft, quietTop } = computeLayout(21, 256, 16);
    assertEqual(quietLeft, quietTop);
  });

  test('margin=0 produces no padding beyond centering', () => {
    const { quietLeft, quietTop } = computeLayout(21, 200, 0);
    assert(quietLeft >= 0 && quietTop >= 0);
  });

  // ── Edge cases ───────────────────────────────────────────────────
  test('very small size: moduleSize is at least 1', () => {
    const { moduleSize } = computeLayout(21, 10, 0);
    assert(moduleSize >= 1);
  });

  test('large margin that exceeds half the outer still works', () => {
    // Even if margin is huge, we should not crash — moduleSize clamps to 1
    const { moduleSize, outer } = computeLayout(21, 50, 100);
    assert(moduleSize >= 1);
    assert(outer >= 1);
  });

  // ── Consistency with known values ────────────────────────────────
  test('v1 (21 modules) at size=256 margin=16: known layout', () => {
    // usable = 256 - 32 = 224; moduleSize = floor(224/21) = 10
    // inner = 210; extra = 256 - (210 + 32) = 14; quietLeft = 16 + 7 = 23
    const { outer, moduleSize, quietLeft, quietTop } = computeLayout(21, 256, 16);
    assertEqual(outer,      256);
    assertEqual(moduleSize, 10);
    assertEqual(quietLeft,  23);
    assertEqual(quietTop,   23);
  });

  test('different versions produce different moduleSizes', () => {
    const v1 = computeLayout(21, 256, 16); // v1 → 21 modules
    const v6 = computeLayout(41, 256, 16); // v6 → 41 modules
    assert(v1.moduleSize > v6.moduleSize, 'smaller matrix should have larger modules');
  });

  return results();
}
