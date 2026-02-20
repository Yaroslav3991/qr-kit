// components/useQrCode.js
// React hook for direct access to the QR model.
// Use this when you need to render QR with a custom renderer
// (WebGL, canvas, custom SVG, branded finder patterns, etc.)

import * as React from 'react';
import { makeQr, QrInputTooLongError } from '../qr/qr-core.js';

/**
 * Computes a QR model for the given value and options.
 * Returns the model directly — no rendering, no DOM.
 *
 * @param {string} value
 * @param {object} [opts]
 * @param {'L'|'M'} [opts.eccLevel='M']
 * @param {number}  [opts.maxVersion=6]
 * @param {boolean} [opts.fallbackToL=true] - Auto-retry with ECC L if M is too long.
 * @param {function} [opts.onEccFallback]   - Called when ECC is downgraded.
 * @returns {{ model: QRModel|null, error: Error|null, actualEccLevel: string|null }}
 *
 * @example
 * function MyQr({ url }) {
 *   const { model, error } = useQrCode(url, { eccLevel: 'L' });
 *   if (error) return <p>Error: {error.message}</p>;
 *   if (!model) return null;
 *   // render model.modules however you want
 * }
 */
export function useQrCode(value, {
  eccLevel     = 'M',
  maxVersion   = 6,
  fallbackToL  = true,
  onEccFallback,
} = {}) {
  const onEccFallbackRef = React.useRef(onEccFallback);
  React.useLayoutEffect(() => { onEccFallbackRef.current = onEccFallback; }, [onEccFallback]);

  return React.useMemo(() => {
    if (value == null || value === '') {
      return { model: null, error: new Error('No value provided'), actualEccLevel: null };
    }
    try {
      const model = makeQr(value, { eccLevel, maxVersion });
      return { model, error: null, actualEccLevel: eccLevel };
    } catch (e1) {
      if (fallbackToL && eccLevel === 'M') {
        try {
          const model = makeQr(value, { eccLevel: 'L', maxVersion });
          // Use setTimeout to avoid calling during render
          setTimeout(() => onEccFallbackRef.current?.('M', 'L'), 0);
          return { model, error: null, actualEccLevel: 'L' };
        } catch (e2) {
          return { model: null, error: e2, actualEccLevel: null };
        }
      }
      return { model: null, error: e1, actualEccLevel: null };
    }
  }, [value, eccLevel, maxVersion, fallbackToL]);
}
