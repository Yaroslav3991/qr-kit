// renderers/svg.js
// Pure SVG rendering. Returns strings/paths — no DOM, no side effects.
// Works in Node.js, Deno, browser, Edge Runtime.

import { computeLayout } from '../utils/layout.js';

/**
 * Builds a compact SVG <path> d-attribute from a QR model.
 *
 * One <path> instead of hundreds of <rect> elements:
 *  - fewer DOM nodes → faster browser rendering
 *  - single fill/stroke CSS target → easier custom styling
 *  - animatable via CSS clip-path or stroke-dashoffset
 *
 * @param {import('../qr/qr-core.js').QRModel} model
 * @param {object} [opts]
 * @param {number} [opts.size=256]     - Outer SVG size in pixels.
 * @param {number} [opts.margin=16]    - Minimum quiet-zone in pixels.
 * @param {boolean} [opts.rounded=false] - Round module corners (r = 35% of moduleSize).
 * @returns {string} SVG path d-attribute string.
 */
export function makeQrPath(model, { size = 256, margin = 16, rounded = false } = {}) {
  const { moduleSize, quietLeft, quietTop } = computeLayout(model.size, size, margin);
  const { modules, size: n } = model;

  if (!rounded) {
    // Fastest path: one M + h + v + h + z per dark module
    let d = '';
    const ms = moduleSize;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (modules[y * n + x]) {
          const px = quietLeft + x * ms;
          const py = quietTop  + y * ms;
          d += `M${px} ${py}h${ms}v${ms}h-${ms}z`;
        }
      }
    }
    return d;
  }

  // Rounded corners: proper arc commands
  const ms = moduleSize;
  const r  = Math.max(1, Math.round(ms * 0.35));
  let d    = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules[y * n + x]) {
        const px = quietLeft + x * ms;
        const py = quietTop  + y * ms;
        d += `M${px + r},${py}`
          + `h${ms - 2 * r}a${r},${r} 0 0 1 ${r},${r}`
          + `v${ms - 2 * r}a${r},${r} 0 0 1 -${r},${r}`
          + `h-${ms - 2 * r}a${r},${r} 0 0 1 -${r},-${r}`
          + `v-${ms - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
      }
    }
  }
  return d;
}

/**
 * Builds two separate path strings: one for data modules, one for function modules.
 * Lets you style finder patterns differently from data (e.g. branded colour for finders).
 *
 * @param {import('../qr/qr-core.js').QRModel} model
 * @param {object} [opts]
 * @param {number} [opts.size=256]
 * @param {number} [opts.margin=16]
 * @returns {{ dataPath: string, functionPath: string }}
 */
export function makeQrPathSplit(model, { size = 256, margin = 16 } = {}) {
  const { moduleSize: ms, quietLeft: ql, quietTop: qt } = computeLayout(model.size, size, margin);
  const { modules, functionMask, size: n } = model;
  let dataPath = '', functionPath = '';

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i  = y * n + x;
      if (!modules[i]) continue;
      const px = ql + x * ms, py = qt + y * ms;
      const seg = `M${px} ${py}h${ms}v${ms}h-${ms}z`;
      if (functionMask[i]) functionPath += seg;
      else                  dataPath    += seg;
    }
  }
  return { dataPath, functionPath };
}

/**
 * Serialises a QR model to a complete, self-contained SVG string.
 * Ready to write to a .svg file or use as an <img src="data:image/svg+xml,..."> .
 *
 * @param {import('../qr/qr-core.js').QRModel} model
 * @param {object} [opts]
 * @param {number} [opts.size=256]
 * @param {number} [opts.margin=16]
 * @param {string} [opts.fg='#000']
 * @param {string} [opts.bg='#fff']
 * @param {string} [opts.title='QR Code']
 * @param {boolean} [opts.rounded=false]
 * @returns {string} Complete SVG markup.
 */
export function makeQrSvgString(model, {
  size    = 256,
  margin  = 16,
  fg      = '#000',
  bg      = '#fff',
  title   = 'QR Code',
  rounded = false,
} = {}) {
  const { outer } = computeLayout(model.size, size, margin);
  const d = makeQrPath(model, { size, margin, rounded });

  return `<svg xmlns="http://www.w3.org/2000/svg" `
       + `width="${outer}" height="${outer}" viewBox="0 0 ${outer} ${outer}" `
       + `role="img" aria-label="${escapeAttr(title)}" shape-rendering="crispEdges">`
       + `<title>${escapeXml(title)}</title>`
       + `<rect width="100%" height="100%" fill="${escapeAttr(bg)}"/>`
       + `<path fill="${escapeAttr(fg)}" d="${d}"/>`
       + `</svg>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(s) { return escapeXml(s); }
