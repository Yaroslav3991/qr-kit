// renderers/canvas.js
// Pure canvas rendering adapter. Draws a QR model onto any HTMLCanvasElement.
// No DOM creation, no side effects — the caller owns the canvas.

import { computeLayout } from '../utils/layout.js';

/**
 * Renders a QR model onto an existing canvas element.
 *
 * By separating rendering from canvas creation the caller can:
 *  - reuse an existing canvas (avoids DOM churn in animations)
 *  - use OffscreenCanvas in a Web Worker
 *  - set their own canvas dimensions before calling
 *
 * @param {import('../qr/qr-core.js').QRModel} model
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param {object} [opts]
 * @param {number} [opts.size=256]        - Target outer size in pixels.
 * @param {number} [opts.margin=16]       - Quiet-zone padding in pixels.
 * @param {string} [opts.fg='#000']       - Dark module colour.
 * @param {string} [opts.bg='#fff']       - Background colour.
 * @param {number} [opts.scale=1]         - Device pixel ratio / export scale.
 * @param {string} [opts.fnColor=null]    - Optional separate colour for function modules.
 *                                          If null, fg is used for all dark modules.
 */
export function renderQrToCanvas(model, canvas, {
  size     = 256,
  margin   = 16,
  fg       = '#000',
  bg       = '#fff',
  scale    = 1,
  fnColor  = null,
} = {}) {
  const { outer, moduleSize, quietLeft, quietTop } = computeLayout(model.size, size, margin);
  const { modules, functionMask, size: n } = model;

  const w = Math.round(outer * scale);
  canvas.width  = w;
  canvas.height = w;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outer, outer);

  const ms = moduleSize;

  if (!fnColor) {
    // Fast path: all dark modules same colour
    ctx.fillStyle = fg;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (modules[y * n + x]) {
          ctx.fillRect(quietLeft + x * ms, quietTop + y * ms, ms, ms);
        }
      }
    }
  } else {
    // Two-pass: function modules get fnColor, data modules get fg
    ctx.fillStyle = fg;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (!modules[i] || functionMask[i]) continue;
        ctx.fillRect(quietLeft + x * ms, quietTop + y * ms, ms, ms);
      }
    }
    ctx.fillStyle = fnColor;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (!modules[i] || !functionMask[i]) continue;
        ctx.fillRect(quietLeft + x * ms, quietTop + y * ms, ms, ms);
      }
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale
}

/**
 * Creates a new canvas, renders the QR model onto it, and returns it.
 * Convenience wrapper around renderQrToCanvas.
 *
 * @param {import('../qr/qr-core.js').QRModel} model
 * @param {object} [opts] - Same options as renderQrToCanvas.
 * @returns {HTMLCanvasElement}
 */
export function makeQrCanvas(model, opts = {}) {
  const canvas = document.createElement('canvas');
  renderQrToCanvas(model, canvas, opts);
  return canvas;
}
