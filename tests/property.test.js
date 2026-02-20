// tests/property.test.js
// Property-based tests: run makeQr on thousands of random inputs
// and verify mathematical invariants — no specific expected values.
// Finds edge cases that hand-written tests would never think of.

import { makeQr, getModule, QrInputTooLongError } from '../qr/qr-core.js';
import { createRunner } from './helpers.js';

// ── Deterministic pseudo-random generator (no Math.random — reproducible) ──
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
}

function randomString(rng, maxLen = 80) {
  const len    = 1 + Math.floor(rng() * maxLen);
  const ranges = [
    [32, 126],    // printable ASCII
    [0x400, 0x4FF], // Cyrillic
    [0x4E00, 0x4EFF], // CJK
  ];
  const [lo, hi] = ranges[Math.floor(rng() * ranges.length)];
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCodePoint(lo + Math.floor(rng() * (hi - lo)));
  return s;
}

export function runTests() {
  const { test, assert, assertEqual, results } = createRunner();
  const RNG_SEED = 42;

  // ── Invariant 1: size = 17 + 4 * version, modules.length = size² ───
  test('PROPERTY: size formula holds for 500 random inputs', () => {
    const rng = lcg(RNG_SEED);
    let checked = 0;
    for (let i = 0; i < 1000; i++) {
      const text = randomString(rng, 60);
      let qr;
      try { qr = makeQr(text, { eccLevel: 'L', maxVersion: 12 }); }
      catch (e) { if (e instanceof QrInputTooLongError) continue; throw e; }
      const expected = 17 + 4 * qr.version;
      assertEqual(qr.size, expected, `v${qr.version}: size should be ${expected}`);
      assertEqual(qr.modules.length, qr.size * qr.size,
        `modules.length should be size²=${qr.size * qr.size}`);
      checked++;
    }
    assert(checked >= 400, `checked ${checked} inputs — too many failed to encode`);
  });

  // ── Invariant 2: all module values are exactly 0 or 1 ───────────────
  test('PROPERTY: all modules are 0 or 1 for 300 random inputs', () => {
    const rng = lcg(RNG_SEED + 1);
    for (let i = 0; i < 500; i++) {
      const text = randomString(rng, 50);
      let qr;
      try { qr = makeQr(text, { eccLevel: 'L', maxVersion: 12 }); }
      catch (e) { if (e instanceof QrInputTooLongError) continue; throw e; }
      for (let j = 0; j < qr.modules.length; j++) {
        const v = qr.modules[j];
        assert(v === 0 || v === 1, `module[${j}]=${v} for input: ${text.slice(0, 20)}`);
      }
    }
  });

  // ── Invariant 3: QrInputTooLongError is always thrown for oversized input ──
  test('PROPERTY: throws QrInputTooLongError (not generic Error) for long inputs', () => {
    const rng = lcg(RNG_SEED + 2);
    const longTexts = [
      'x'.repeat(500),
      '中'.repeat(100),
      'Привет '.repeat(50),
    ];
    for (const text of longTexts) {
      let err = null;
      try { makeQr(text, { eccLevel: 'L', maxVersion: 6 }); }
      catch (e) { err = e; }
      assert(err !== null, 'should throw for oversized input');
      assert(err instanceof QrInputTooLongError,
        `should be QrInputTooLongError, got ${err.constructor.name}: ${err.message}`);
      assert(err.byteLength > err.maxBytes,
        `byteLength(${err.byteLength}) should exceed maxBytes(${err.maxBytes})`);
    }
  });

  // ── Invariant 4: dark module always set at (8, 4v+9) ───────────────
  test('PROPERTY: dark module invariant holds for 200 random inputs', () => {
    const rng = lcg(RNG_SEED + 3);
    for (let i = 0; i < 400; i++) {
      const text = randomString(rng, 40);
      let qr;
      try { qr = makeQr(text, { eccLevel: 'L', maxVersion: 12 }); }
      catch (e) { if (e instanceof QrInputTooLongError) continue; throw e; }
      const darkRow = 4 * qr.version + 9;
      assertEqual(getModule(qr, 8, darkRow), 1,
        `v${qr.version}: dark module at row ${darkRow} should be 1`);
    }
  });

  // ── Invariant 5: ECC L always fits more data than ECC M ─────────────
  test('PROPERTY: ECC L always holds more bytes than ECC M at same version', () => {
    for (let v = 1; v <= 12; v++) {
      // Max for ECC L should always exceed max for ECC M
      let maxL = 0, maxM = 0;
      for (let len = 1; len <= 400; len++) {
        const text = 'A'.repeat(len);
        try {
          makeQr(text, { eccLevel: 'L', maxVersion: v });
          maxL = len;
        } catch (e) { if (!(e instanceof QrInputTooLongError)) throw e; }
        try {
          makeQr(text, { eccLevel: 'M', maxVersion: v });
          maxM = len;
        } catch (e) { if (!(e instanceof QrInputTooLongError)) throw e; }
      }
      assert(maxL > maxM, `v${v}: ECC L max (${maxL}) should exceed ECC M max (${maxM})`);
    }
  });

  // ── Invariant 6: matrix is never all-dark or all-light ──────────────
  test('PROPERTY: QR always has both dark and light modules', () => {
    const rng = lcg(RNG_SEED + 4);
    for (let i = 0; i < 300; i++) {
      const text = randomString(rng, 30);
      let qr;
      try { qr = makeQr(text, { eccLevel: 'L', maxVersion: 10 }); }
      catch (e) { if (e instanceof QrInputTooLongError) continue; throw e; }
      let ones = 0;
      for (let j = 0; j < qr.modules.length; j++) if (qr.modules[j]) ones++;
      assert(ones > 0,                   'should have dark modules');
      assert(ones < qr.modules.length,   'should have light modules');
    }
  });

  // ── Invariant 7: functionMask is a proper subset of all modules ─────
  test('PROPERTY: functionMask indices stay within [0, size²)', () => {
    const rng = lcg(RNG_SEED + 5);
    for (let i = 0; i < 200; i++) {
      const text = randomString(rng, 40);
      let qr;
      try { qr = makeQr(text, { eccLevel: 'L', maxVersion: 12 }); }
      catch (e) { if (e instanceof QrInputTooLongError) continue; throw e; }
      assertEqual(qr.functionMask.length, qr.modules.length,
        'functionMask and modules must be the same length');
      for (let j = 0; j < qr.functionMask.length; j++) {
        const v = qr.functionMask[j];
        assert(v === 0 || v === 1, `functionMask[${j}]=${v}`);
      }
    }
  });

  // ── Invariant 8: smaller version always used when input fits ─────────
  test('PROPERTY: version is minimal for the given input', () => {
    const rng = lcg(RNG_SEED + 6);
    for (let i = 0; i < 100; i++) {
      const text = randomString(rng, 30);
      let qr;
      try { qr = makeQr(text, { eccLevel: 'L', maxVersion: 12 }); }
      catch (e) { if (e instanceof QrInputTooLongError) continue; throw e; }
      // Confirm it doesn't fit in a smaller version
      if (qr.version > 1) {
        let fits = false;
        try { makeQr(text, { eccLevel: 'L', maxVersion: qr.version - 1 }); fits = true; }
        catch (e) { if (!(e instanceof QrInputTooLongError)) throw e; }
        assert(!fits, `v${qr.version}: input should NOT fit in v${qr.version - 1}`);
      }
    }
  });

  return results();
}
