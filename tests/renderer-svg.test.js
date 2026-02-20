// tests/renderer-svg.test.js
// SVG renderer tests — pure string output, no DOM needed.

import { makeQr, getModule } from '../qr/qr-core.js';
import { makeQrPath, makeQrPathSplit, makeQrSvgString } from '../renderers/svg.js';
import { computeLayout } from '../utils/layout.js';
import { createRunner } from './helpers.js';

export function runTests() {
  const { test, assert, assertEqual, results } = createRunner();

  const model  = makeQr('https://example.com', { eccLevel: 'L' });
  const model2 = makeQr('hi', { eccLevel: 'L', maxVersion: 1 });

  // ── makeQrPath ──────────────────────────────────────────────────────
  test('makeQrPath: returns non-empty string', () => {
    const d = makeQrPath(model);
    assert(typeof d === 'string' && d.length > 0, 'should return non-empty string');
  });

  test('makeQrPath: contains only valid SVG path commands', () => {
    const d = makeQrPath(model2);
    // Should only contain M, h, v, z and numbers (non-rounded path)
    assert(!/[^Mhvz0-9 \-]/.test(d), `invalid chars in path: ${d.slice(0,100)}`);
  });

  test('makeQrPath: module count matches dark modules in model', () => {
    const d    = makeQrPath(model2, { size: 210, margin: 0 });
    // Count 'M' = number of path segments = number of dark modules
    const segCount  = (d.match(/M/g) || []).length;
    let darkModules = 0;
    for (let i = 0; i < model2.modules.length; i++) if (model2.modules[i]) darkModules++;
    assertEqual(segCount, darkModules, 'path segments should equal dark module count');
  });

  test('makeQrPath: quiet zone shifts modules by margin amount', () => {
    const { quietLeft, quietTop, moduleSize } = computeLayout(model2.size, 210, 10);
    const d = makeQrPath(model2, { size: 210, margin: 10 });
    // First dark module in reading order (top-left finder corner)
    // Finder (0,0) is always dark — find its position
    const firstM = d.match(/M(\d+) (\d+)/);
    assert(firstM, 'should have at least one M command');
    const x = parseInt(firstM[1]), y = parseInt(firstM[2]);
    assertEqual(x, quietLeft, 'first dark module x should equal quietLeft');
    assertEqual(y, quietTop,  'first dark module y should equal quietTop');
  });

  test('makeQrPath: rounded=true returns arc commands', () => {
    const d = makeQrPath(model2, { rounded: true });
    assert(d.includes('a'), 'rounded path should contain arc commands');
  });

  test('makeQrPath: flat uses only rect commands, rounded adds arc commands', () => {
    const dFlat    = makeQrPath(model2, { rounded: false });
    const dRounded = makeQrPath(model2, { rounded: true });
    // Flat: M h v h z only — no arcs
    assert(!dFlat.includes('a'),    'flat path should have no arc commands');
    // Rounded: has arc commands (rounded corners)
    assert(dRounded.includes('a'), 'rounded path should have arc commands');
    // Both produce segments for every dark module
    const flatCount    = (dFlat.match(/M/g)   || []).length;
    const roundedCount = (dRounded.match(/M/g) || []).length;
    assertEqual(flatCount, roundedCount, 'both should have the same module count');
  });

  // ── makeQrPathSplit ─────────────────────────────────────────────────
  test('makeQrPathSplit: returns dataPath and functionPath', () => {
    const { dataPath, functionPath } = makeQrPathSplit(model);
    assert(typeof dataPath     === 'string', 'dataPath should be string');
    assert(typeof functionPath === 'string', 'functionPath should be string');
  });

  test('makeQrPathSplit: combined segment count equals makeQrPath', () => {
    const { dataPath, functionPath } = makeQrPathSplit(model2);
    const total    = (dataPath.match(/M/g)||[]).length + (functionPath.match(/M/g)||[]).length;
    const allPath  = makeQrPath(model2);
    const allCount = (allPath.match(/M/g)||[]).length;
    assertEqual(total, allCount, 'split paths should cover all dark modules');
  });

  test('makeQrPathSplit: functionPath covers finder corners', () => {
    const { moduleSize, quietLeft, quietTop } = computeLayout(model2.size, 210, 0);
    const { functionPath } = makeQrPathSplit(model2, { size: 210, margin: 0 });
    // First module of top-left finder = M0 0 (no margin)
    const expectedFirst = `M${quietLeft} ${quietTop}`;
    assert(functionPath.includes(expectedFirst), 'finder corner should be in functionPath');
  });

  // ── makeQrSvgString ─────────────────────────────────────────────────
  test('makeQrSvgString: returns valid SVG string', () => {
    const svg = makeQrSvgString(model);
    assert(svg.startsWith('<svg'), 'should start with <svg');
    assert(svg.endsWith('</svg>'), 'should end with </svg>');
    assert(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'should have xmlns');
  });

  test('makeQrSvgString: embeds path data', () => {
    const svg = makeQrSvgString(model);
    assert(svg.includes('<path'), 'should contain <path element');
    assert(svg.includes('d="M'), 'path should have d attribute with M commands');
  });

  test('makeQrSvgString: correct width/height attributes', () => {
    const svg = makeQrSvgString(model, { size: 300, margin: 16 });
    const { outer } = computeLayout(model.size, 300, 16);
    assert(svg.includes(`width="${outer}"`), `should have width="${outer}"`);
    assert(svg.includes(`height="${outer}"`), `should have height="${outer}"`);
  });

  test('makeQrSvgString: fg and bg applied', () => {
    const svg = makeQrSvgString(model, { fg: '#ff0000', bg: '#0000ff' });
    assert(svg.includes('fill="#ff0000"'), 'fg colour should be in path fill');
    assert(svg.includes('fill="#0000ff"'), 'bg colour should be in rect fill');
  });

  test('makeQrSvgString: has title and aria-label', () => {
    const svg = makeQrSvgString(model, { title: 'My QR' });
    assert(svg.includes('<title>My QR</title>'), 'should have <title>');
    assert(svg.includes('aria-label="My QR"'),  'should have aria-label');
  });

  test('makeQrSvgString: escapes special chars in title', () => {
    const svg = makeQrSvgString(model, { title: '<script>alert("xss")</script>' });
    assert(!svg.includes('<script>'), 'should escape < in title');
    assert(svg.includes('&lt;script&gt;'), 'should use XML entities');
  });

  // ── Property: path output is deterministic ──────────────────────────
  test('makeQrPath is pure: identical input → identical output', () => {
    const a = makeQrPath(model, { size: 256, margin: 16 });
    const b = makeQrPath(model, { size: 256, margin: 16 });
    assertEqual(a, b, 'path output should be deterministic');
  });

  return results();
}
