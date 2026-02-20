# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] — Logo overlay, Web Worker, AbortSignal

### Added

**Logo overlay** (`utils/logo.js`)
- `makeQrWithLogoSvg(model, logoDataUrl, opts)` — zero-DOM SVG with embedded logo. Works in Node, Deno, Cloudflare Workers, Web Workers, and browser. Function modules always rendered above the logo layer for scan reliability.
- `getLogoConstraints(model, size, margin, maxCoverage)` — returns `maxLogoSize`, `paddedSize`, and `coverageFraction` so you can pre-validate a logo before building the SVG.
- `loadLogoAsDataUrl(src, { signal })` — browser helper: URL → base64 data URL.
- `buildQrWithLogoSvgAsync(model, src, opts)` — browser convenience that loads logo and builds SVG in one call.
- `LOGO_MAX_COVERAGE_ECC_M` (0.11) and `LOGO_MAX_COVERAGE_ECC_L` (0.04) — exported constants for coverage budget.

**Web Worker** (`worker/qr.worker.js`)
- `qr.worker.js` — Worker entry point that runs `makeQr` off the main thread. Transfers `Uint8Array` buffers via `postMessage` to avoid memory copies.
- `useQrWorker(value, opts)` React hook — async QR computation in a shared background Worker. Use for v7–12 or real-time input animations to prevent frame drops.

**AbortSignal support**
- `buildQrCompositeBlob({ signal })` — cancellable poster composition.
- `buildPdfWithTemplateBytes({ signal })` — cancellable PDF generation.
- `loadLogoAsDataUrl(src, { signal })` — cancellable logo fetch.
- `loadImage(src, { signal })` (raster.js) — AbortSignal propagated to image loading.

### Changed
- `package.json` bumped to v2.1.0.
- `scripts/size.js` updated to include new modules.
- `index.js` exports all new public APIs.

---

## [1.0.0] — Initial release

### Added

**Core**
- `makeQr(text, opts)` — pure JS QR engine, Byte mode, versions 1–12, ECC L/M
- Reed-Solomon error correction with GF(256) exp/log tables
- All 8 mask patterns evaluated; lowest-penalty mask selected
- Correct remainder bits, dark module, version info (v7+), format info

**React component**
- `QRCodeGenerator` — renders an inline SVG via `React.forwardRef`
- `onEccFallback` prop — notifies caller when ECC M is silently downgraded to L
- Accessibility: `role="img"`, `aria-label`, `<title>`, `shapeRendering="crispEdges"`

**Layout**
- `computeLayout(moduleCount, size, margin)` — shared pixel geometry for SVG and canvas renderers; guarantees pixel-identical output

**Raster utilities** (`utils/raster.js`)
- `svgToPngDataURL(svgEl, scale)` — SVG → PNG data URL
- `pngDataURLtoJpegBytes(pngDataURL, quality)` — PNG data URL → JPEG bytes
- `dataURLToBytes(dataUrl)` — data URL → Uint8Array
- `dataURLToImage(dataUrl)` — data URL → HTMLImageElement
- `loadImage(src)` — URL → HTMLImageElement (crossOrigin: anonymous)
- `imageURLtoJpegBytes(src, quality)` — URL → JPEG bytes
- `downloadQrPng(svgEl, opts)` — downloads QR as PNG

**JPEG export** (`utils/jpegQr.js`)
- `downloadQrJpeg(opts)` — renders QR to canvas and downloads as JPEG
- `downloadBlob(blob, fileName)` — generic Blob download helper

**Poster / image composite** (`utils/poster.js`)
- `downloadQrComposite(opts)` — composites QR onto a background image and downloads

**PDF export** (`utils/pdf.js`)
- `downloadPdfWithTemplateImage(opts)` — full-page background + QR overlay PDF
- `downloadQrPdf(opts)` — simple A4 PDF with title, text, and QR
- Non-JPEG backgrounds (PNG, WebP, CMYK) auto-converted to RGB JPEG

**URL utilities** (`utils/url.js`)
- `sanitizeUrlForQR(input, opts)` — strips tracking params; optionally removes protocol
- `utf8ByteLen(s)` — UTF-8 byte length of a string

**Link builder** (`utils/link.js`)
- `buildQrLink(opts)` — encodes JSON payload as Base64 in a URL; binary-search trim to fit QR byte budget
- Strategies: `'trim'` | `'drop'` | `'error'`
- Guard for non-string `trimKey` values

**Tests** (zero dependencies, Node.js only)
- 47 tests across `qr-core`, `layout`, `url`, `link`

**TypeScript**
- Full declarations in `types/index.d.ts` for all public APIs
