// worker/qr.worker.js
// Web Worker entry point for makeQr.
//
// Why a Worker?
//   makeQr is synchronous and CPU-bound. For v10-12 QR codes on low-end mobile
//   it can take 5-15 ms, which blocks the main thread and causes frame jank during
//   real-time input. Running it in a Worker keeps the UI smooth.
//
//   The flat Uint8Array output (model.modules, model.functionMask) is Transferable —
//   it can be moved to the main thread with zero copying via postMessage transfer.
//
// Usage from main thread:
//
//   const worker = new Worker(new URL('./worker/qr.worker.js', import.meta.url), { type: 'module' });
//
//   worker.postMessage({ id: 1, value: 'https://example.com', eccLevel: 'L', maxVersion: 6 });
//
//   worker.onmessage = ({ data }) => {
//     if (data.error) { console.error(data.error); return; }
//     // data.model is the full QRModel, modules and functionMask are Uint8Arrays
//     renderQrToCanvas(data.model, canvas);
//   };
//
// Message protocol:
//
//   → { id, value, eccLevel?, maxVersion? }
//   ← { id, model: { version, size, modules: Uint8Array, functionMask: Uint8Array, eccLevel } }
//   ← { id, error: string }

import { makeQr } from '../qr/qr-core.js';

self.onmessage = ({ data }) => {
  const { id, value, eccLevel = 'M', maxVersion = 6 } = data;
  try {
    const model = makeQr(value, { eccLevel, maxVersion });

    // Transfer the Uint8Arrays to avoid copying (~size² bytes each)
    self.postMessage(
      { id, model },
      [model.modules.buffer, model.functionMask.buffer],
    );
  } catch (e) {
    self.postMessage({ id, error: String(e) });
  }
};
