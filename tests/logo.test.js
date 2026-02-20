// tests/logo.test.js
import { makeQr }                           from '../qr/qr-core.js';
import {
  makeQrWithLogoSvg,
  getLogoConstraints,
  LOGO_MAX_COVERAGE_ECC_M,
  LOGO_MAX_COVERAGE_ECC_L,
} from '../utils/logo.js';
import { createRunner } from './helpers.js';

// Minimal 1x1 PNG as base64 data URL (valid image, tiny)
const LOGO_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export function runTests() {
  const { test, assert, assertEqual, assertThrows, results } = createRunner();

  const modelL = makeQr('https://example.com', { eccLevel: 'L', maxVersion: 6 });
  const modelM = makeQr('https://example.com', { eccLevel: 'M', maxVersion: 6 });

  // ── makeQrWithLogoSvg: basic output ──────────────────────────────────────
  test('returns a non-empty SVG string', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX);
    assert(typeof svg === 'string' && svg.length > 0, 'should return string');
  });

  test('output starts with <svg', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX);
    assert(svg.startsWith('<svg'), 'must start with <svg');
  });

  test('output ends with </svg>', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX);
    assert(svg.endsWith('</svg>'), 'must end with </svg>');
  });

  test('contains the logo data URL', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX);
    assert(svg.includes(LOGO_1PX), 'should embed the logo data URL');
  });

  test('contains both a data path and a function path', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX);
    // Two <path> elements: data layer + function layer
    const pathCount = (svg.match(/<path /g) || []).length;
    assertEqual(pathCount, 2, 'should have exactly 2 <path> elements');
  });

  test('function path is last (composited above logo)', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX);
    const lastPath = svg.lastIndexOf('<path ');
    const imagePos = svg.indexOf('<image ');
    assert(lastPath > imagePos, 'function path must come after <image> in SVG');
  });

  test('contains a white background rect', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX);
    assert(svg.includes('<rect '), 'should have rect elements');
  });

  test('respects fg colour option', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX, { fg: '#c0392b' });
    assert(svg.includes('#c0392b'), 'fg colour should appear in SVG');
  });

  test('respects bg colour option', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX, { bg: '#f8f9fa' });
    assert(svg.includes('#f8f9fa'), 'bg colour should appear in SVG');
  });

  test('respects custom title', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX, { title: 'My Brand QR' });
    assert(svg.includes('My Brand QR'), 'title should appear in SVG');
  });

  test('escapes special chars in title', () => {
    const svg = makeQrWithLogoSvg(modelM, LOGO_1PX, { title: '<script>alert("xss")</script>' });
    assert(!svg.includes('<script>'), 'raw <script> must not appear');
    assert(svg.includes('&lt;script&gt;'), 'should be escaped');
  });

  test('throws if logoDataUrl is missing', () => {
    assertThrows(() => makeQrWithLogoSvg(modelM, ''), 'logoDataUrl');
  });

  test('throws if logoDataUrl is null/undefined', () => {
    assertThrows(() => makeQrWithLogoSvg(modelM, null), 'logoDataUrl');
  });

  test('works with ECC L model (smaller logo)', () => {
    const svg = makeQrWithLogoSvg(modelL, LOGO_1PX);
    assert(svg.length > 0);
  });

  test('produces deterministic output for identical inputs', () => {
    const svg1 = makeQrWithLogoSvg(modelM, LOGO_1PX, { size: 300, margin: 20 });
    const svg2 = makeQrWithLogoSvg(modelM, LOGO_1PX, { size: 300, margin: 20 });
    assertEqual(svg1, svg2, 'identical inputs must produce identical SVG');
  });

  test('different sizes produce different SVG', () => {
    const svg1 = makeQrWithLogoSvg(modelM, LOGO_1PX, { size: 256 });
    const svg2 = makeQrWithLogoSvg(modelM, LOGO_1PX, { size: 512 });
    assert(svg1 !== svg2, 'different sizes must produce different SVG');
    assert(svg2.includes('width="512"'), 'size=512 should set width=512');
  });

  // ── getLogoConstraints ───────────────────────────────────────────────────
  test('getLogoConstraints: returns positive maxLogoSize', () => {
    const { maxLogoSize } = getLogoConstraints(modelM, 256, 16);
    assert(maxLogoSize > 0, 'maxLogoSize should be positive');
  });

  test('getLogoConstraints: ECC M logo is larger than ECC L logo', () => {
    const cM = getLogoConstraints(modelM, 256, 16);
    const cL = getLogoConstraints(modelL, 256, 16);
    assert(cM.maxLogoSize > cL.maxLogoSize,
      `ECC M max (${cM.maxLogoSize}px) should exceed ECC L max (${cL.maxLogoSize}px)`);
  });

  test('getLogoConstraints: coverage fraction is within expected bounds', () => {
    const { coverageFraction } = getLogoConstraints(modelM, 256, 16);
    assert(coverageFraction <= LOGO_MAX_COVERAGE_ECC_M + 0.001, 'coverage must not exceed ECC M budget');
    assert(coverageFraction > 0, 'coverage must be positive');
  });

  test('getLogoConstraints: custom maxCoverage respected', () => {
    const c1 = getLogoConstraints(modelM, 256, 16, 0.05);
    const c2 = getLogoConstraints(modelM, 256, 16, 0.10);
    assert(c2.maxLogoSize > c1.maxLogoSize, 'larger coverage → larger logo');
  });

  test('getLogoConstraints: larger canvas gives proportionally larger logo', () => {
    const c1 = getLogoConstraints(modelM, 256, 16);
    const c2 = getLogoConstraints(modelM, 512, 16);
    assert(c2.maxLogoSize > c1.maxLogoSize, 'larger canvas → larger logo pixels');
  });

  // ── Coverage constants ───────────────────────────────────────────────────
  test('LOGO_MAX_COVERAGE_ECC_M is in expected range [0.08, 0.14]', () => {
    assert(LOGO_MAX_COVERAGE_ECC_M >= 0.08 && LOGO_MAX_COVERAGE_ECC_M <= 0.14,
      `ECC M coverage ${LOGO_MAX_COVERAGE_ECC_M} out of expected range`);
  });

  test('LOGO_MAX_COVERAGE_ECC_L is less than ECC_M', () => {
    assert(LOGO_MAX_COVERAGE_ECC_L < LOGO_MAX_COVERAGE_ECC_M,
      'L budget must be smaller than M budget');
  });

  return results();
}
