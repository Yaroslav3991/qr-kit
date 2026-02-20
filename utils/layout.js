// utils/layout.js
// Shared pixel-layout calculation for QR rendering.
// Used by QRCodeGenerator (SVG) and downloadQrJpeg (canvas) to guarantee identical output.

/**
 * Computes the pixel geometry needed to render a QR matrix inside a fixed outer size.
 *
 * Algorithm:
 *  1. Reserve `margin` pixels on each side as the minimum quiet zone.
 *  2. Fit as many whole-pixel modules as possible in the remaining space.
 *  3. Distribute any leftover pixels evenly, centering the grid.
 *
 * @param {number} moduleCount - Matrix side length (model.size = 17 + 4 * version).
 * @param {number} size        - Desired outer size in pixels.
 * @param {number} margin      - Minimum quiet-zone padding in pixels.
 * @returns {{ outer: number, moduleSize: number, quietLeft: number, quietTop: number }}
 */
export function computeLayout(moduleCount, size, margin) {
  const outer      = Math.max(1, Math.floor(size));
  const minQuiet   = Math.max(0, Math.floor(margin));
  const usable     = outer - 2 * minQuiet;
  const moduleSize = Math.max(1, Math.floor(usable / moduleCount));
  const inner      = moduleSize * moduleCount;
  const extra      = Math.max(0, outer - (inner + 2 * minQuiet));

  // Centre the grid; any remaining pixel goes to the right/bottom side implicitly
  const quietLeft  = minQuiet + Math.floor(extra / 2);
  const quietTop   = minQuiet + Math.floor(extra / 2);

  return { outer, moduleSize, quietLeft, quietTop };
}
