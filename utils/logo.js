// utils/logo.js
// Embeds a logo image inside a QR code using the error-correction recovery budget.
//
// Design:
//   - makeQrWithLogoSvg(model, logoDataUrl, opts)  — zero-DOM, works in Node/Worker/browser
//   - loadLogoAsDataUrl(src)                        — browser helper: URL → data URL
//   - buildQrWithLogoSvgAsync(model, src, opts)     — browser convenience wrapper
//
// How it works:
//   ECC M corrects up to ~15% of damaged codewords. We use at most `maxCoverage`
//   (default 11%) of the total module area for the logo, leaving the remaining
//   4% as a safety buffer for real-world damage (dirty scanner, low contrast, etc.)
//
//   Finder patterns + timing strips + alignment patterns are NEVER obscured —
//   they are drawn on a separate layer that composites above the logo.
//
// Why zero-DOM:
//   The SVG renderer works in Node.js, Deno, Cloudflare Workers, and any environment
//   with no `document`. The logo must be provided as a data URL (base64-encoded).
//   For browser use, call `buildQrWithLogoSvgAsync(model, '/logo.png')` which
//   fetches and encodes the image for you.

import { computeLayout } from './layout.js';
import { makeQrPathSplit } from '../renderers/svg.js';

// ─── Public constants ──────────────────────────────────────────────────────────

/** Maximum fraction of QR area safe to cover with ECC M (~15% budget, 4% safety margin). */
export const LOGO_MAX_COVERAGE_ECC_M = 0.06;

/** Maximum fraction of QR area safe to cover with ECC L (~7% budget, 3% safety margin). */
export const LOGO_MAX_COVERAGE_ECC_L = 0.04;

// ─── Core: zero-DOM SVG builder ───────────────────────────────────────────────

/**
 * Builds a complete SVG string with a logo embedded in the centre.
 * The logo sits above data modules; function modules (finder, timing) are
 * rendered on a separate layer above the logo to remain scannable.
 *
 * @param {import('../qr/qr-core.js').QRModel} model  - Output of makeQr().
 * @param {string} logoDataUrl  - base64 data URL of the logo (any image format).
 *                                Use loadLogoAsDataUrl() in the browser to obtain this.
 * @param {object} [opts]
 * @param {number}  [opts.size=256]           - Outer SVG size in px.
 * @param {number}  [opts.margin=16]          - Quiet-zone padding in px.
 * @param {string}  [opts.fg='#000']          - Data module colour.
 * @param {string}  [opts.fnFg='#000']        - Function module colour (finder/timing).
 * @param {string}  [opts.bg='#fff']          - Background colour.
 * @param {number}  [opts.maxCoverage]        - Max fraction of QR area to cover.
 *                                              Default: 0.11 for ECC M, 0.04 for ECC L.
 * @param {number}  [opts.logoPadding=4]      - White padding around logo in px.
 * @param {string}  [opts.logoBg='#fff']      - Colour of logo background pad.
 * @param {number}  [opts.logoRadius=6]       - Border-radius of logo bg rect in px.
 * @param {string}  [opts.title='QR Code']
 * @returns {string} Complete SVG markup.
 */
export function makeQrWithLogoSvg(model, logoDataUrl, {
  size        = 256,
  margin      = 16,
  fg          = '#000',
  fnFg        = '#000',
  bg          = '#fff',
  maxCoverage,
  logoPadding = 4,
  logoBg      = '#fff',
  logoRadius  = 6,
  title       = 'QR Code',
} = {}) {
  if (!logoDataUrl) throw new Error('makeQrWithLogoSvg: logoDataUrl is required');

  const ecc = model.eccLevel ?? 'M';
  const maxCov = maxCoverage ?? (ecc === 'M' ? LOGO_MAX_COVERAGE_ECC_M : LOGO_MAX_COVERAGE_ECC_L);

  const { outer, moduleSize, quietLeft, quietTop } = computeLayout(model.size, size, margin);

  // Maximum logo size in pixels based on ECC budget
  const qrPx      = model.size * moduleSize;
  const maxLogoPx = Math.floor(Math.sqrt(maxCov) * qrPx);

  // Logo sits in the centre of the QR grid (not the outer canvas)
  const gridCentreX = quietLeft + qrPx / 2;
  const gridCentreY = quietTop  + qrPx / 2;

  const logoSize   = maxLogoPx;
  const padded     = logoSize + logoPadding * 2;
  const logoX      = gridCentreX - padded / 2;
  const logoY      = gridCentreY - padded / 2;

  // Get separate paths: data modules below the logo, function modules above
  const { dataPath, functionPath } = makeQrPathSplit(model, { size, margin });

  // Escape helpers
  const ea = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const logoImgX  = logoX + logoPadding;
  const logoImgY  = logoY + logoPadding;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`
       + ` width="${outer}" height="${outer}" viewBox="0 0 ${outer} ${outer}"`
       + ` role="img" aria-label="${ea(title)}" shape-rendering="crispEdges">`
       + `<title>${ea(title)}</title>`
       + `<rect width="100%" height="100%" fill="${ea(bg)}"/>`

       // Layer 1: data modules (covered by logo, but scannable due to ECC)
       + `<path fill="${ea(fg)}" d="${dataPath}"/>`

       // Layer 2: logo background + logo image
       + `<rect x="${logoX.toFixed(1)}" y="${logoY.toFixed(1)}"`
       + ` width="${padded.toFixed(1)}" height="${padded.toFixed(1)}"`
       + ` rx="${logoRadius}" ry="${logoRadius}"`
       + ` fill="${ea(logoBg)}"/>`
       + `<image href="${logoDataUrl}"`
       + ` x="${logoImgX.toFixed(1)}" y="${logoImgY.toFixed(1)}"`
       + ` width="${logoSize.toFixed(1)}" height="${logoSize.toFixed(1)}"`
       + ` preserveAspectRatio="xMidYMid meet"/>`

       // Layer 3: function modules — always on top, never obscured
       + `<path fill="${ea(fnFg)}" d="${functionPath}"/>`

       + `</svg>`;
}

/**
 * Returns the maximum safe logo size in pixels for a given QR model and output size.
 * Use this to pre-validate a logo before calling makeQrWithLogoSvg.
 *
 * @param {import('../qr/qr-core.js').QRModel} model
 * @param {number} size         - Outer SVG size in px (same as passed to makeQrWithLogoSvg).
 * @param {number} margin       - Quiet-zone in px.
 * @param {number} [maxCoverage]
 * @returns {{ maxLogoSize: number, paddedSize: number, coverageFraction: number }}
 */
export function getLogoConstraints(model, size, margin, maxCoverage) {
  const ecc    = model.eccLevel ?? 'M';
  const maxCov = maxCoverage ?? (ecc === 'M' ? LOGO_MAX_COVERAGE_ECC_M : LOGO_MAX_COVERAGE_ECC_L);
  const { moduleSize } = computeLayout(model.size, size, margin);
  const qrPx   = model.size * moduleSize;
  const maxLogoPx = Math.floor(Math.sqrt(maxCov) * qrPx);
  return {
    maxLogoSize: maxLogoPx,
    paddedSize: maxLogoPx + 8,   // +8 = default padding (4px each side)
    coverageFraction: (maxLogoPx / qrPx) ** 2,
  };
}

// ─── Browser helpers ───────────────────────────────────────────────────────────

/**
 * Fetches an image URL and converts it to a base64 data URL.
 * Browser-only (requires fetch + FileReader or canvas).
 *
 * @param {string} src    - URL of the image (JPEG, PNG, SVG, WebP…)
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<string>} base64 data URL
 */
export async function loadLogoAsDataUrl(src, { signal } = {}) {
  // Try fetch first (works for remote URLs with CORS, local URLs, data URIs)
  if (src.startsWith('data:')) return src; // already a data URL

  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`loadLogoAsDataUrl: fetch failed ${res.status} for ${src}`);

  const blob     = await res.blob();
  const reader   = new FileReader();
  const dataUrl  = await new Promise((resolve, reject) => {
    reader.onload  = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
  return dataUrl;
}

/**
 * Browser convenience: loads a logo from a URL and returns a complete QR SVG string.
 * Equivalent to `makeQrWithLogoSvg(model, await loadLogoAsDataUrl(src), opts)`.
 *
 * @param {import('../qr/qr-core.js').QRModel} model
 * @param {string} logoSrc   - URL of the logo image.
 * @param {object} [opts]    - Same options as makeQrWithLogoSvg, plus `signal`.
 * @returns {Promise<string>} Complete SVG markup.
 */
export async function buildQrWithLogoSvgAsync(model, logoSrc, opts = {}) {
  const { signal, ...svgOpts } = opts;
  const dataUrl = await loadLogoAsDataUrl(logoSrc, { signal });
  return makeQrWithLogoSvg(model, dataUrl, svgOpts);
}
