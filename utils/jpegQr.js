// utils/jpegQr.js
// Downloads a QR code as a JPEG file directly from the canvas — no fetch, no data: URLs.
// Uses the canvas renderer for pixel-identical output to QRCodeGenerator (SVG).

import { makeQr }           from '../qr/qr-core.js';
import { renderQrToCanvas } from '../renderers/canvas.js';

/**
 * Triggers a file download from a Blob using a temporary object URL.
 * @param {Blob} blob
 * @param {string} fileName
 */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Renders a QR code to canvas and downloads it as a JPEG file.
 * Guaranteed pixel-identical layout to QRCodeGenerator (SVG) via shared computeLayout().
 *
 * @param {object}  opts
 * @param {string}  opts.value
 * @param {string}  [opts.fileName='qr.jpeg']
 * @param {number}  [opts.size=192]      - Outer canvas size in pixels.
 * @param {number}  [opts.margin=12]     - Minimum quiet-zone padding in pixels.
 * @param {string}  [opts.fg='#000']
 * @param {string}  [opts.bg='#fff']
 * @param {'L'|'M'} [opts.eccLevel='L']
 * @param {number}  [opts.maxVersion=12]
 * @returns {Promise<void>}
 */
export async function downloadQrJpeg({
  value,
  fileName   = 'qr.jpeg',
  size       = 192,
  margin     = 12,
  fg         = '#000',
  bg         = '#fff',
  eccLevel   = 'L',
  maxVersion = 12,
}) {
  const model  = makeQr(value, { eccLevel, maxVersion });
  const canvas = document.createElement('canvas');
  renderQrToCanvas(model, canvas, { size, margin, fg, bg });

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/jpeg'),
  );
  downloadBlob(blob, fileName);
}
