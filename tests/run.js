// tests/run.js — zero-dependency test runner.
// Usage: node tests/run.js
// Exit code 0 = all tests passed, 1 = failures.

import { runTests as coreTests }     from './qr-core.test.js';
import { runTests as layoutTests }   from './layout.test.js';
import { runTests as svgTests }      from './renderer-svg.test.js';
import { runTests as urlTests }      from './url.test.js';
import { runTests as linkTests }     from './link.test.js';
import { runTests as logoTests }     from './logo.test.js';
import { runTests as propertyTests } from './property.test.js';
import { runTests as goldenTests }   from './golden.test.js';

const suites = [
  ['qr-core › makeQr / getModule / isFunctionModule', coreTests],
  ['utils/layout › computeLayout()',                  layoutTests],
  ['renderers/svg › makeQrPath / makeQrSvgString',   svgTests],
  ['utils/url › sanitizeUrlForQR()',                  urlTests],
  ['utils/link › buildQrLink()',                      linkTests],
  ['utils/logo › makeQrWithLogoSvg / constraints',   logoTests],
  ['property-based invariants',                       propertyTests],
  ['golden file regression',                          goldenTests],
];

let totalPassed = 0, totalFailed = 0;

for (const [name, fn] of suites) {
  console.log(`\n${name}`);
  const { passed, failed } = fn();
  totalPassed += passed;
  totalFailed += failed;
}

const line = '─'.repeat(46);
console.log(`\n${line}`);
console.log(`  ${totalPassed} passed${totalFailed > 0 ? `  ${totalFailed} FAILED` : ''}`);
console.log(`${line}\n`);

process.exit(totalFailed > 0 ? 1 : 0);
