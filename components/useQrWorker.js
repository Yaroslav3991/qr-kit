// components/useQrWorker.js
// React hook that computes QR codes in a Web Worker to avoid main-thread jank.
//
// When to use vs useQrCode:
//   - useQrCode: synchronous, zero overhead — use for v1-6 and non-animated UIs
//   - useQrWorker: async, off-thread — use when animating input or targeting v7-12
//     on low-end mobile where 10-15ms CPU time causes dropped frames
//
// @example
//   function MyQr({ url }) {
//     const { model, error, pending } = useQrWorker(url, { eccLevel: 'L', maxVersion: 10 });
//     if (pending) return <Skeleton />;
//     if (error)   return <p>{error.message}</p>;
//     return <canvas ref={canvasRef} />;  // render model in useEffect
//   }

import * as React from 'react';

let _worker = null;
let _callbacks = new Map();
let _nextId = 1;

/** Lazy-initialised shared worker instance. */
function getWorker() {
  if (!_worker) {
    _worker = new Worker(new URL('../worker/qr.worker.js', import.meta.url), { type: 'module' });
    _worker.onmessage = ({ data }) => {
      const cb = _callbacks.get(data.id);
      if (cb) { _callbacks.delete(data.id); cb(data); }
    };
    _worker.onerror = (e) => {
      // Broadcast error to all pending callbacks
      for (const [id, cb] of _callbacks) { _callbacks.delete(id); cb({ id, error: String(e) }); }
    };
  }
  return _worker;
}

/**
 * Computes a QR model off the main thread via a shared Web Worker.
 *
 * @param {string} value
 * @param {object} [opts]
 * @param {'L'|'M'} [opts.eccLevel='M']
 * @param {number}  [opts.maxVersion=6]
 * @returns {{ model: object|null, error: Error|null, pending: boolean }}
 */
export function useQrWorker(value, { eccLevel = 'M', maxVersion = 6 } = {}) {
  const [state, setState] = React.useState({ model: null, error: null, pending: false });

  React.useEffect(() => {
    if (!value) {
      setState({ model: null, error: null, pending: false });
      return;
    }

    let cancelled = false;
    setState(s => ({ ...s, pending: true }));

    const id = _nextId++;
    const worker = getWorker();

    _callbacks.set(id, ({ model, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ model: null, error: new Error(error), pending: false });
      } else {
        setState({ model, error: null, pending: false });
      }
    });

    worker.postMessage({ id, value, eccLevel, maxVersion });

    return () => {
      cancelled = true;
      _callbacks.delete(id);
    };
  }, [value, eccLevel, maxVersion]);

  return state;
}
