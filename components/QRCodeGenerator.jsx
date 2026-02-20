// components/QRCodeGenerator.jsx
// React SVG component that renders a QR code using a single <path>.
// Uses React.forwardRef — pass ref={svgRef} to access the <svg> element
// for PNG/JPEG/PDF export via utils/raster or utils/poster.

import * as React from 'react';
import { useQrCode }   from './useQrCode.js';
import { makeQrPath }  from '../renderers/svg.js';
import { computeLayout } from '../utils/layout.js';

const DEFAULTS = { size: 256, margin: 16, fg: '#000', bg: '#fff', ecc: 'M', maxV: 6 };

/**
 * Renders a QR code as an inline SVG.
 *
 * Uses a single <path> element instead of hundreds of <rect> elements:
 *  - Fewer DOM nodes, faster rendering
 *  - Single fill target — style with one CSS rule
 *  - Animatable
 *
 * @example
 * const ref = useRef(null);
 * <QRCodeGenerator ref={ref} value="https://example.com" rounded />
 * await downloadQrPng(ref.current);
 */
const QRCodeGenerator = React.forwardRef(function QRCodeGenerator(props, ref) {
  const {
    value,
    size          = DEFAULTS.size,
    margin        = DEFAULTS.margin,
    title         = 'QR Code',
    ariaLabel     = 'QR code',
    fg            = DEFAULTS.fg,
    bg            = DEFAULTS.bg,
    eccLevel      = DEFAULTS.ecc,
    maxVersion    = DEFAULTS.maxV,
    rounded       = false,
    onEccFallback,
    className,
  } = props;

  const { model, error } = useQrCode(value, {
    eccLevel, maxVersion, fallbackToL: true, onEccFallback,
  });

  if (error) {
    return (
      <div
        role="alert"
        style={{
          color: '#b91c1c', fontFamily: 'monospace',
          border: '1px solid #fecaca', borderRadius: 8, padding: 12,
        }}
      >
        QR error: {error.message}
      </div>
    );
  }

  if (!model) return null;

  const { outer } = computeLayout(model.size, size, margin);
  const d         = makeQrPath(model, { size, margin, rounded });

  return (
    <svg
      ref={ref}
      className={className}
      width={outer}
      height={outer}
      viewBox={`0 0 ${outer} ${outer}`}
      role="img"
      aria-label={ariaLabel}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      data-version={model.version}
      data-modules={model.size}
      data-ecc={model.eccLevel}
    >
      <title>{title}</title>
      <rect width="100%" height="100%" fill={bg} />
      <path fill={fg} d={d} />
    </svg>
  );
});

QRCodeGenerator.displayName = 'QRCodeGenerator';
export default QRCodeGenerator;
