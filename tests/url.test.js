// tests/url.test.js
import { sanitizeUrlForQR, utf8ByteLen } from '../utils/url.js';
import { createRunner } from './helpers.js';

export function runTests() {
  const { test, assert, assertEqual, results } = createRunner();

  // ── utf8ByteLen ──────────────────────────────────────────────────
  test('utf8ByteLen: ASCII string', () => {
    assertEqual(utf8ByteLen('hello'), 5);
  });

  test('utf8ByteLen: empty string', () => {
    assertEqual(utf8ByteLen(''), 0);
  });

  test('utf8ByteLen: Cyrillic is 2 bytes/char', () => {
    assertEqual(utf8ByteLen('Привет'), 12); // 6 chars × 2 bytes
  });

  test('utf8ByteLen: emoji is 4 bytes', () => {
    assertEqual(utf8ByteLen('🌍'), 4);
  });

  // ── sanitizeUrlForQR — aggressive mode (default) ─────────────────
  test('aggressive mode: removes all params except whitelist', () => {
    const url = 'https://example.com/page?id=42&utm_source=x&ref=y';
    const result = sanitizeUrlForQR(url, { whitelist: ['id'] });
    assert(result.includes('id=42'), 'should keep whitelisted param');
    assert(!result.includes('utm_source'), 'should remove utm_source');
    assert(!result.includes('ref='), 'should remove ref');
  });

  test('aggressive mode: removes ALL params when whitelist is empty', () => {
    const url = 'https://example.com/page?utm_source=x&gclid=abc';
    const result = sanitizeUrlForQR(url);
    assert(!result.includes('?'), 'query string should be empty');
    assert(result.endsWith('/page'), 'should keep path');
  });

  // ── sanitizeUrlForQR — non-aggressive mode ────────────────────────
  test('non-aggressive mode: removes only known trackers', () => {
    const url = 'https://example.com/?id=42&utm_source=x&gclid=abc';
    const result = sanitizeUrlForQR(url, { aggressive: false });
    assert(result.includes('id=42'), 'should keep non-tracker param');
    assert(!result.includes('utm_source'), 'should remove utm_source');
    assert(!result.includes('gclid'), 'should remove gclid');
  });

  // ── preserveProtocol ─────────────────────────────────────────────
  test('preserveProtocol: true keeps https://', () => {
    const result = sanitizeUrlForQR('https://example.com/path', { preserveProtocol: true });
    assert(result.startsWith('https://'), 'should keep protocol');
  });

  test('preserveProtocol: false strips https://', () => {
    const result = sanitizeUrlForQR('https://example.com/path', { preserveProtocol: false });
    assert(!result.startsWith('https://'), 'should strip protocol');
    assert(result.startsWith('example.com'), 'should start with host');
  });

  // ── invalid URL fallback ──────────────────────────────────────────
  test('invalid URL: returns input trimmed', () => {
    const result = sanitizeUrlForQR('not a url  ');
    assertEqual(result, 'not a url');
  });

  test('empty string: returns empty string', () => {
    assertEqual(sanitizeUrlForQR(''), '');
  });

  return results();
}
