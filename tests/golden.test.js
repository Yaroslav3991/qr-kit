// tests/golden.test.js
// Golden file tests: generate QR matrices for known inputs and compare against
// saved JSON snapshots. Protects against silent algorithm regressions.
//
// First run (no snapshot file): generates and saves the snapshot.
// Subsequent runs: loads snapshot and diffs against current output.
//
// To regenerate: delete tests/golden-snapshot.json and run again.

import { makeQr } from '../qr/qr-core.js';
import { createRunner } from './helpers.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir      = dirname(fileURLToPath(import.meta.url));
const SNAP_FILE  = join(__dir, 'golden-snapshot.json');

const CASES = [
  { id: 'ascii-short',   text: 'hi',                           eccLevel: 'L', maxVersion: 1  },
  { id: 'ascii-url',     text: 'https://example.com',          eccLevel: 'L', maxVersion: 6  },
  { id: 'ascii-url-m',   text: 'https://example.com',          eccLevel: 'M', maxVersion: 6  },
  { id: 'cyrillic',      text: 'Привет',                        eccLevel: 'L', maxVersion: 6  },
  { id: 'emoji',         text: 'Hello 🌍',                      eccLevel: 'L', maxVersion: 6  },
  { id: 'long-v6-l',     text: 'x'.repeat(120),                eccLevel: 'L', maxVersion: 6  },
  { id: 'boundary-v6-m', text: 'x'.repeat(106),                eccLevel: 'M', maxVersion: 6  },
  { id: 'v10',           text: 'https://example.com/long-path?param=value&other=123',
                                                                 eccLevel: 'L', maxVersion: 12 },
];

function serialize(qr) {
  // Store as compact hex strings rather than giant JSON arrays
  return {
    version: qr.version,
    size:    qr.size,
    eccLevel: qr.eccLevel,
    // Convert Uint8Array to compact bitstring: "00110101..."
    modules:      Array.from(qr.modules).join(''),
    functionMask: Array.from(qr.functionMask).join(''),
  };
}

function diff(expected, actual, id) {
  if (expected.version  !== actual.version)  return `${id}: version ${expected.version} → ${actual.version}`;
  if (expected.size     !== actual.size)     return `${id}: size ${expected.size} → ${actual.size}`;
  if (expected.eccLevel !== actual.eccLevel) return `${id}: eccLevel ${expected.eccLevel} → ${actual.eccLevel}`;
  if (expected.modules  !== actual.modules) {
    // Find first differing position
    for (let i = 0; i < expected.modules.length; i++) {
      if (expected.modules[i] !== actual.modules[i]) {
        const x = i % expected.size, y = Math.floor(i / expected.size);
        return `${id}: modules differ at (${x},${y}) index ${i}`;
      }
    }
  }
  if (expected.functionMask !== actual.functionMask) return `${id}: functionMask differs`;
  return null;
}

export function runTests() {
  const { test, assert, results } = createRunner();

  // Generate current output
  const current = {};
  for (const c of CASES) {
    try { current[c.id] = serialize(makeQr(c.text, { eccLevel: c.eccLevel, maxVersion: c.maxVersion })); }
    catch (e) { current[c.id] = { error: e.message }; }
  }

  if (!existsSync(SNAP_FILE)) {
    // First run — write snapshot
    writeFileSync(SNAP_FILE, JSON.stringify(current, null, 2) + '\n');
    test('golden: snapshot created (first run)', () => {
      // Always passes on first run — acts as documentation
      assert(true);
    });
    return results();
  }

  const snapshot = JSON.parse(readFileSync(SNAP_FILE, 'utf8'));

  for (const c of CASES) {
    test(`golden: ${c.id}`, () => {
      const expected = snapshot[c.id];
      const actual   = current[c.id];
      assert(expected !== undefined, `no snapshot entry for "${c.id}" — delete golden-snapshot.json to regenerate`);
      const problem = diff(expected, actual, c.id);
      assert(problem === null, problem || 'ok');
    });
  }

  return results();
}
