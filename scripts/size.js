// scripts/size.js — reports file sizes for each module (no bundler needed)
// Usage: node scripts/size.js
import { statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const FILES = [
  'index.js',
  'qr/qr-core.js',
  'utils/layout.js',
  'utils/url.js',
  'utils/link.js',
  'utils/logo.js',
  'renderers/svg.js',
  'renderers/canvas.js',
  'utils/raster.js',
  'utils/jpegQr.js',
  'utils/poster.js',
  'utils/pdf.js',
  'components/QRCodeGenerator.jsx',
  'components/useQrCode.js',
  'components/useQrWorker.js',
  'worker/qr.worker.js',
];

const rows = [];
let totalRaw = 0, totalGz = 0;

for (const f of FILES) {
  const buf = readFileSync(join(root, f));
  const gz  = gzipSync(buf);
  totalRaw += buf.length;
  totalGz  += gz.length;
  rows.push({ file: f, raw: buf.length, gz: gz.length });
}

const fmt = n => (n / 1024).toFixed(1).padStart(6) + ' kB';

console.log('\nModule sizes (gzip reflects what users download)\n');
console.log(' File'.padEnd(40) + '  raw    gzip');
console.log('─'.repeat(56));
for (const r of rows)
  console.log((' ' + r.file).padEnd(40) + fmt(r.raw) + '  ' + fmt(r.gz));
console.log('─'.repeat(56));
console.log(' TOTAL'.padEnd(40) + fmt(totalRaw) + '  ' + fmt(totalGz));
console.log('\n(qr-core + layout + url = framework-agnostic core)\n');
