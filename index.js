// index.js — main entry point for qr-kit
//
// Three layers, zero dependencies:
//   Layer 1 — Pure computation (works in Node, Deno, Edge Runtime, browser, Worker)
//   Layer 2 — Rendering adapters (browser or Node with canvas)
//   Layer 3 — Browser actions / integrations (import via deep path for tree-shaking)

// ─── Layer 1: Core QR engine ──────────────────────────────────────────────────
export { makeQr, getModule, isFunctionModule, QrInputTooLongError } from './qr/qr-core.js';
export { computeLayout }                                             from './utils/layout.js';

// ─── Layer 1: URL & link utilities ───────────────────────────────────────────
export { sanitizeUrlForQR, utf8ByteLen } from './utils/url.js';
export { buildQrLink }                   from './utils/link.js';

// ─── Layer 2: Rendering adapters ─────────────────────────────────────────────
export { makeQrPath, makeQrPathSplit, makeQrSvgString } from './renderers/svg.js';
export { renderQrToCanvas, makeQrCanvas }               from './renderers/canvas.js';

// ─── Layer 2: Logo overlay (zero-DOM, works in Node/Worker/browser) ──────────
export {
  makeQrWithLogoSvg,
  getLogoConstraints,
  loadLogoAsDataUrl,
  buildQrWithLogoSvgAsync,
  LOGO_MAX_COVERAGE_ECC_M,
  LOGO_MAX_COVERAGE_ECC_L,
} from './utils/logo.js';

// ─── Layer 2: React component (requires React ≥ 17 as peer dep) ──────────────
export { default }         from './components/QRCodeGenerator.jsx';
export { useQrCode }       from './components/useQrCode.js';
export { useQrWorker }     from './components/useQrWorker.js';

// ─── Layer 3: Browser-only actions (prefer deep imports for tree-shaking) ─────
//   import { downloadQrPng }              from 'qr-kit/utils/raster'
//   import { downloadQrJpeg }             from 'qr-kit/utils/jpegQr'
//   import { buildQrCompositeBlob, downloadQrComposite } from 'qr-kit/utils/poster'
//   import { buildQrPdfBytes, downloadQrPdf }            from 'qr-kit/utils/pdf'
//   import { buildPdfWithTemplateBytes, downloadPdfWithTemplateImage } from 'qr-kit/utils/pdf'
