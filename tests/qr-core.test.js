// tests/qr-core.test.js
import { makeQr, getModule, isFunctionModule, QrInputTooLongError } from '../qr/qr-core.js';
import { createRunner } from './helpers.js';

export function runTests() {
  const { test, assert, assertEqual, assertThrows, results } = createRunner();

  // ── Matrix structure ────────────────────────────────────────────────
  test('v1: size is 21, modules is flat Uint8Array of 441 elements', () => {
    const qr = makeQr('hi', { eccLevel: 'L', maxVersion: 1 });
    assertEqual(qr.version, 1);
    assertEqual(qr.size, 21);
    assert(qr.modules instanceof Uint8Array, 'modules should be Uint8Array');
    assertEqual(qr.modules.length, 21 * 21);   // 441 — flat array
    assert(qr.functionMask instanceof Uint8Array, 'functionMask should be Uint8Array');
    assertEqual(qr.functionMask.length, 21 * 21);
  });

  test('matrix size formula holds: size === 17 + 4 * version', () => {
    const inputs = ['hi','x'.repeat(18),'x'.repeat(35),'x'.repeat(56),'x'.repeat(82),'x'.repeat(110)];
    for (const text of inputs) {
      const qr = makeQr(text, { eccLevel: 'L', maxVersion: 12 });
      assertEqual(qr.size, 17 + 4 * qr.version, `size mismatch v${qr.version}`);
      assertEqual(qr.modules.length, qr.size * qr.size, 'flat array length mismatch');
    }
  });

  // ── getModule helper ────────────────────────────────────────────────
  test('getModule(model, x, y) reads flat array correctly', () => {
    const qr = makeQr('https://example.com', { eccLevel: 'L' });
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        const v = getModule(qr, x, y);
        assert(v === 0 || v === 1, `module[${y}][${x}] = ${v}, expected 0 or 1`);
      }
    }
  });

  test('getModule result matches direct flat array access', () => {
    const qr = makeQr('test', { eccLevel: 'L' });
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        assertEqual(getModule(qr, x, y), qr.modules[y * qr.size + x]);
      }
    }
  });

  // ── isFunctionModule ────────────────────────────────────────────────
  test('isFunctionModule: finder corners are function modules', () => {
    const qr = makeQr('hi', { eccLevel: 'L' });
    // Top-left finder pattern — all 7×7 are function modules
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++)
        assert(isFunctionModule(qr, x, y), `finder corner (${x},${y}) should be function`);
  });

  test('isFunctionModule: data area in middle is not function', () => {
    const qr = makeQr('hi', { eccLevel: 'L' });
    // Module (10, 10) is always a data area for v1
    assert(!isFunctionModule(qr, 10, 10), 'middle of QR should be data module');
  });

  // ── All modules are binary ──────────────────────────────────────────
  test('all modules are exactly 0 or 1 (no stray values)', () => {
    const qr = makeQr('https://example.com', { eccLevel: 'L' });
    for (let i = 0; i < qr.modules.length; i++) {
      const m = qr.modules[i];
      assert(m === 0 || m === 1, `modules[${i}] = ${m}`);
    }
  });

  // ── Dark module ─────────────────────────────────────────────────────
  test('dark module is always set at (8, 4*version + 9)', () => {
    const inputs = ['hi','x'.repeat(18),'x'.repeat(35),'x'.repeat(56),'x'.repeat(82),'x'.repeat(110)];
    for (const text of inputs) {
      const qr = makeQr(text, { eccLevel: 'L', maxVersion: 12 });
      const darkRow = 4 * qr.version + 9;
      assertEqual(getModule(qr, 8, darkRow), 1, `v${qr.version}: dark module should be 1`);
    }
  });

  // ── ECC ─────────────────────────────────────────────────────────────
  test('eccLevel is reflected in result', () => {
    assertEqual(makeQr('test', { eccLevel: 'L' }).eccLevel, 'L');
    assertEqual(makeQr('test', { eccLevel: 'M' }).eccLevel, 'M');
  });

  test('ECC L fits more data than ECC M at same version', () => {
    const long = 'x'.repeat(120);
    const qrL  = makeQr(long, { eccLevel: 'L', maxVersion: 6 });
    assert(qrL.version <= 6, 'ECC L: should fit within v6');
    let threw = false;
    try { makeQr(long, { eccLevel: 'M', maxVersion: 6 }); }
    catch (e) { threw = true; assert(e instanceof QrInputTooLongError, 'should throw QrInputTooLongError'); }
    assert(threw, 'ECC M v6 should throw for 120-char string');
  });

  // ── QrInputTooLongError typed error ─────────────────────────────────
  test('throws QrInputTooLongError (typed) when too long', () => {
    let err = null;
    try { makeQr('x'.repeat(200), { eccLevel: 'L', maxVersion: 6 }); }
    catch (e) { err = e; }
    assert(err !== null, 'should throw');
    assert(err instanceof QrInputTooLongError, 'should be QrInputTooLongError');
    assert(typeof err.byteLength === 'number', 'byteLength should be number');
    assert(typeof err.maxBytes === 'number',   'maxBytes should be number');
    assertEqual(err.maxVersion, 6);
    assertEqual(err.eccLevel, 'L');
  });

  test('QrInputTooLongError has meaningful message', () => {
    let err = null;
    try { makeQr('x'.repeat(200), { eccLevel: 'M', maxVersion: 6 }); }
    catch (e) { err = e; }
    assert(err.message.includes('200'), 'message should include byte length');
    assert(err.message.includes('EC level M'), 'message should include ECC level');
  });

  test('QrInputTooLongError can be caught by instanceof', () => {
    let caught = false;
    try { makeQr('x'.repeat(200), { eccLevel: 'L', maxVersion: 6 }); }
    catch (e) {
      if (e instanceof QrInputTooLongError) caught = true;
    }
    assert(caught, 'should be catchable by instanceof');
  });

  // ── Determinism ─────────────────────────────────────────────────────
  test('identical input always produces identical matrix', () => {
    const a = makeQr('https://example.com/path?q=1', { eccLevel: 'L' });
    const b = makeQr('https://example.com/path?q=1', { eccLevel: 'L' });
    assertEqual(a.version, b.version);
    for (let i = 0; i < a.modules.length; i++)
      assertEqual(a.modules[i], b.modules[i], `mismatch at index ${i}`);
  });

  // ── Encoding ────────────────────────────────────────────────────────
  test('encodes ASCII URL', () => {
    const qr = makeQr('https://example.com', { eccLevel: 'L' });
    assert(qr.version >= 1 && qr.version <= 12);
  });

  test('encodes UTF-8 Cyrillic (multi-byte)', () => {
    const qr = makeQr('Привет мир', { eccLevel: 'L' });
    assert(qr.version >= 1);
  });

  test('encodes emoji (4-byte UTF-8)', () => {
    const qr = makeQr('Hello 🌍', { eccLevel: 'L' });
    assert(qr.version >= 1);
  });

  test('short string fits in v1', () => {
    assertEqual(makeQr('hi', { eccLevel: 'L', maxVersion: 1 }).version, 1);
  });

  // ── Property-like checks ─────────────────────────────────────────────
  test('functionMask + data: every module is accounted for', () => {
    const qr = makeQr('https://example.com', { eccLevel: 'L' });
    let fnCount = 0, dataCount = 0;
    for (let i = 0; i < qr.modules.length; i++) {
      if (qr.functionMask[i]) fnCount++;
      else dataCount++;
    }
    // v3 QR has 29×29 = 841 total modules
    assertEqual(fnCount + dataCount, qr.size * qr.size);
    assert(fnCount > 0,   'should have some function modules');
    assert(dataCount > 0, 'should have some data modules');
  });

  test('matrix is not all zeros or all ones', () => {
    const qr = makeQr('https://example.com', { eccLevel: 'L' });
    let ones = 0;
    for (let i = 0; i < qr.modules.length; i++) if (qr.modules[i]) ones++;
    assert(ones > 0, 'should have dark modules');
    assert(ones < qr.modules.length, 'should have light modules');
  });

  return results();
}
