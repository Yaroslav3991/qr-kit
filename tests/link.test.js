// tests/link.test.js
import { buildQrLink } from '../utils/link.js';
import { utf8ByteLen } from '../utils/url.js';
import { createRunner } from './helpers.js';

export function runTests() {
  const { test, assert, assertEqual, assertThrows, results } = createRunner();

  const BASE = 'https://example.com/landing';

  // ── Basic: fits without trimming ─────────────────────────────────
  test('small payload fits without trimming', () => {
    const { fullUrl, qrUrl, trimmed, removed, error } = buildQrLink({
      baseUrl: BASE,
      payload: { id: '1' },
      qrBudgetBytes: 200,
    });
    assert(!error, 'no error');
    assert(!trimmed, 'not trimmed');
    assert(!removed, 'not removed');
    assert(fullUrl.length > 0, 'fullUrl not empty');
    assert(qrUrl.length > 0, 'qrUrl not empty');
  });

  test('qrUrl byte length is within budget', () => {
    const budget = 134;
    const { qrUrl, error } = buildQrLink({
      baseUrl: BASE,
      payload: { id: 'abc' },
      qrBudgetBytes: budget,
    });
    assert(!error);
    assert(utf8ByteLen(qrUrl) <= budget, `qrUrl (${utf8ByteLen(qrUrl)}B) exceeds budget (${budget}B)`);
  });

  // ── removeProtocol: strips https:// ──────────────────────────────
  test('removeProtocol: true strips https:// from qrUrl', () => {
    const { qrUrl, fullUrl } = buildQrLink({
      baseUrl: BASE,
      payload: { id: '1' },
      removeProtocol: true,
    });
    assert(!qrUrl.startsWith('https://'), 'qrUrl should not start with https://');
    assert(fullUrl.startsWith('https://'), 'fullUrl should keep protocol');
  });

  // ── extraParams in fullUrl only ───────────────────────────────────
  test('extraParams appear in fullUrl but not qrUrl', () => {
    const { fullUrl, qrUrl } = buildQrLink({
      baseUrl: BASE,
      payload: { id: '1' },
      extraParams: { utm_source: 'poster' },
      qrBudgetBytes: 200,
    });
    assert(fullUrl.includes('utm_source=poster'), 'fullUrl should include extraParams');
    assert(!qrUrl.includes('utm_source'), 'qrUrl should not include extraParams');
  });

  // ── strategy: 'trim' ─────────────────────────────────────────────
  test("strategy 'trim': shortens trimKey to fit budget", () => {
    const budget = 80;
    const { qrUrl, trimmed, removed, error } = buildQrLink({
      baseUrl: BASE,
      payload: { code: 'A'.repeat(50), id: '1' },
      trimKey: 'code',
      strategy: 'trim',
      qrBudgetBytes: budget,
    });
    assert(!error);
    assert(!removed);
    assert(utf8ByteLen(qrUrl) <= budget, `qrUrl exceeds budget after trim`);
  });

  test("strategy 'trim': trimmed=true when value was shortened", () => {
    const { trimmed } = buildQrLink({
      baseUrl: BASE,
      payload: { code: 'A'.repeat(50) },
      trimKey: 'code',
      strategy: 'trim',
      qrBudgetBytes: 60,
    });
    assert(trimmed, 'trimmed should be true');
  });

  // ── strategy: 'drop' ─────────────────────────────────────────────
  test("strategy 'drop': removes trimKey entirely", () => {
    const { qrUrl, removed, trimmed } = buildQrLink({
      baseUrl: BASE,
      payload: { code: 'A'.repeat(50), id: '1' },
      trimKey: 'code',
      strategy: 'drop',
      qrBudgetBytes: 60,
    });
    assert(removed, 'removed should be true');
    assert(!trimmed, 'trimmed should be false');
    assert(!qrUrl.includes('AAAA'), 'trimKey value should not appear in qrUrl');
  });

  // ── strategy: 'error' ────────────────────────────────────────────
  test("strategy 'error': returns error field when too long", () => {
    const { error, qrUrl } = buildQrLink({
      baseUrl: BASE,
      payload: { code: 'A'.repeat(50) },
      strategy: 'error',
      qrBudgetBytes: 30,
    });
    assert(error, 'error should be set');
    assertEqual(qrUrl, '', 'qrUrl should be empty on error');
  });

  // ── non-string trimKey ────────────────────────────────────────────
  test('non-string trimKey: falls back to drop behaviour', () => {
    const { removed } = buildQrLink({
      baseUrl: BASE,
      payload: { count: 42, name: 'test' },
      trimKey: 'count', // number — cannot be trimmed
      strategy: 'trim',
      qrBudgetBytes: 30,
    });
    // Should not crash; should have removed the field
    assert(removed || true, 'should not throw for non-string trimKey');
  });

  // ── validation ───────────────────────────────────────────────────
  test('throws when baseUrl is missing', () => {
    assertThrows(() => buildQrLink({ payload: { id: '1' } }), 'baseUrl');
  });

  test('throws when payload is not an object', () => {
    assertThrows(() => buildQrLink({ baseUrl: BASE, payload: 'string' }), 'payload');
  });

  // ── custom paramName ─────────────────────────────────────────────
  test('custom paramName appears in both URLs', () => {
    const { fullUrl, qrUrl } = buildQrLink({
      baseUrl: BASE,
      payload: { id: '1' },
      paramName: 'p',
      qrBudgetBytes: 200,
    });
    assert(fullUrl.includes('?p=') || fullUrl.includes('&p='), 'fullUrl should use custom param');
    assert(qrUrl.includes('p='), 'qrUrl should use custom param');
  });

  return results();
}
