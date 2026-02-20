// utils/poster.js
// Browser-side image compositing: background image + QR code.
// No external dependencies.

import { svgToPngDataURL, dataURLToImage, loadImage } from './raster.js';

// ─── Data primitive ───────────────────────────────────────────────────────────

/**
 * Composites a QR code SVG onto a background image and returns the result as a Blob.
 * Use this when you need the image data without triggering a download
 * (upload to server, put in <img> src, test in Node, etc.)
 *
 * @param {object} opts
 * @param {SVGSVGElement} opts.svgEl
 * @param {string}  opts.templateSrc
 * @param {{ x: number, y: number, size: number }} [opts.qr]
 * @param {string}  [opts.mime='image/jpeg']
 * @param {number}  [opts.quality=0.92]
 * @param {number}  [opts.scale=1]
 * @param {boolean} [opts.debug=false]
 * @returns {Promise<Blob>}
 */
export async function buildQrCompositeBlob({
  svgEl,
  templateSrc,
  qr      = { x: 50, y: 50, size: 260 },
  mime    = 'image/jpeg',
  quality = 0.92,
  scale   = 1,
  debug   = false,
  signal,
}) {
  if (!svgEl)       throw new Error('buildQrCompositeBlob: svgEl is required');
  if (!templateSrc) throw new Error('buildQrCompositeBlob: templateSrc is required');
  signal?.throwIfAborted?.();

  const bg  = await loadImage(templateSrc, { signal });
  const cw  = Math.round(bg.width  * scale);
  const ch  = Math.round(bg.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bg, 0, 0, cw, ch);

  const qrPng = await svgToPngDataURL(svgEl, Math.max(2, Math.ceil(scale * 3)));
  const qrImg = await dataURLToImage(qrPng);
  const qx = Math.round(qr.x * scale);
  const qy = Math.round(qr.y * scale);
  const qs = Math.round(qr.size * scale);
  ctx.drawImage(qrImg, qx, qy, qs, qs);

  if (debug) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = Math.max(1, scale);
    ctx.strokeRect(qx + 0.5, qy + 0.5, qs - 1, qs - 1);
  }

  return new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('canvas.toBlob failed')), mime, quality),
  );
}

// ─── Download wrappers ────────────────────────────────────────────────────────

/**
 * Composites a QR code SVG onto a background image and triggers a file download.
 *
 * Coordinate system: (0, 0) is the TOP-LEFT corner of the background image.
 * Units are pixels of the background image at scale=1.
 *
 * @param {object} opts
 * @param {SVGSVGElement} opts.svgEl       - QR SVG element (ref from QRCodeGenerator).
 * @param {string}  opts.templateSrc       - URL or imported asset path (JPEG or PNG).
 * @param {{ x: number, y: number, size: number }} [opts.qr]
 * @param {string}  [opts.fileName='poster.jpg']
 * @param {string}  [opts.mime='image/jpeg']
 * @param {number}  [opts.quality=0.92]
 * @param {number}  [opts.scale=1]
 * @param {boolean} [opts.debug=false]     - Draw a border around the QR area.
 */
export async function downloadQrComposite({
  svgEl, templateSrc,
  qr       = { x: 50, y: 50, size: 260 },
  fileName = 'poster.jpg',
  mime     = 'image/jpeg',
  quality  = 0.92,
  scale    = 1,
  debug    = false,
}) {
  const blob = await buildQrCompositeBlob({ svgEl, templateSrc, qr, mime, quality, scale, debug });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/** @deprecated Use `downloadQrComposite` instead. */
export const downloadLeafletImage = downloadQrComposite;
