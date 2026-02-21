<div align="center">

# 🎯 qr-kit

**Complete QR code toolkit. Zero dependencies. 5.4 kB core.**

[![npm version](https://img.shields.io/npm/v/qr-kit?color=success)](https://www.npmjs.com/package/qr-kit)
[![bundle size](https://img.shields.io/bundlephobia/minzip/qr-kit?label=gzip&color=success)](https://bundlephobia.com/package/qr-kit)
[![tests](https://img.shields.io/badge/tests-109%20passing-success)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Yaroslav3991/qr-kit/blob/main/LICENSE)

**[🛝 Live Playground](playground/index.html)** · **[📖 Docs](#installation)** · **[🎨 Examples](#quick-start)**

<img src="docs/hero-demo.gif" width="600" alt="QR code with logo overlay demo" />

*Generate QR codes with logos, export to PDF, optimize URLs — all in the browser, zero dependencies.*

</div>

---

## ✨ Why this library?

Every QR library on npm either:
- 📦 Pulls in 10+ dependencies
- 🐌 Bundles 150+ kB of minified code
- 🔨 Requires a build step (TypeScript, Babel, Webpack)
- 🌐 Works only in Node.js OR only in browser

**This library:**
- ✅ Zero dependencies — literally `"dependencies": {}`
- ✅ 5.4 kB gzipped core — smaller than most images on your page
- ✅ Ships as ES modules — use directly, no build step
- ✅ Works everywhere — Node, Deno, Cloudflare Workers, browser, Web Worker
- ✅ Logo overlay with ECC budget enforcement
- ✅ PDF export, poster generation, link optimization

---

## 🚀 Quick start

### Install

```bash
npm install qr-kit
```

### Basic QR in React (3 lines)

```jsx
import QRCodeGenerator from 'qr-kit';

export default () => <QRCodeGenerator value="https://example.com" />;
```

**Output:** Crisp SVG, single `<path>` element (not 500 `<rect>`), accessible, scales infinitely.

---

## 🎨 Logo overlay — the killer feature

```jsx
import { makeQr } from 'qr-kit';
import { buildQrWithLogoSvgAsync } from 'qr-kit/utils/logo';

const model = makeQr('https://example.com', { eccLevel: 'M' });
const svg = await buildQrWithLogoSvgAsync(model, '/logo.svg', {
  size: 400,
  maxCoverage: 0.11, // 11% of QR area — safe for ECC M
});

document.body.innerHTML = svg; // self-contained SVG string
```

**How it works:**
- QR rendered in 3 layers: data → logo → finder patterns (always on top)
- ECC M budget: 11% coverage leaves 4% safety margin
- Zero-DOM implementation — works in Node.js, Cloudflare Workers, anywhere

<div align="center">
<img src="docs/logo-overlay-example.png" width="300" alt="QR with company logo" />
</div>

---

## 📦 Tiny bundle, huge features

| Feature | Size (gzip) | Description |
|---------|-------------|-------------|
| **qr-core** | 4.7 kB | Pure QR engine — works everywhere |
| **React component** | +1.1 kB | SVG component with `forwardRef` |
| **Logo overlay** | +3.0 kB | Embed logos with ECC enforcement |
| **PDF export** | +4.4 kB | Generate PDFs in browser |
| **Link optimizer** | +2.1 kB | Fit URLs in QR byte budget |
| **Web Worker** | +0.8 kB | Off-thread for v10-12 |

**Total library:** 26.7 kB gzip  
**Core only:** 5.4 kB gzip (qr-core + layout + url utilities)

Tree-shake what you don't need. Import only what you use.

---

## 🔥 More examples

### Export to PNG/JPEG/PDF

```js
import { downloadQrPng } from 'qr-kit/utils/raster';
import { downloadQrJpeg } from 'qr-kit/utils/jpegQr';
import { downloadQrPdf } from 'qr-kit/utils/pdf';

// PNG at 3× scale
await downloadQrPng(svgRef.current, { scale: 3 });

// JPEG (direct from canvas, no SVG round-trip)
await downloadQrJpeg({ value: 'https://example.com', size: 300 });

// PDF with title and metadata
await downloadQrPdf({
  svgEl: svgRef.current,
  title: 'Event QR Code',
  org: 'Your Company',
  url: 'https://example.com',
});
```

### Optimize URLs for QR (Link Builder)

```js
import { buildQrLink } from 'qr-kit/utils/link';

const { qrUrl, fullUrl, trimmed } = buildQrLink({
  baseUrl: 'https://example.com/app',
  payload: { userId: 'abc123', campaign: 'summer2024promo' },
  budget: 120, // target bytes
  strategy: 'trim', // shorten campaign if needed
  trimKey: 'campaign',
  removeProtocol: true, // saves 8 bytes
});

// qrUrl: "example.com/app?d={...shortened...}"
// fullUrl: "https://example.com/app?d={...full payload...}"
```

**Use case:** Generate short QR codes, redirect to full URLs on server.

### Composite QR onto background image (Poster)

```js
import { downloadQrComposite } from 'qr-kit/utils/poster';

await downloadQrComposite({
  svgEl: qrRef.current,
  templateSrc: '/event-poster.jpg',
  qr: { x: 50, y: 400, size: 200 }, // position in px
  scale: 2, // 2× for print
  fileName: 'poster.jpg',
});
```

<div align="center">
<img src="docs/poster-example.png" width="400" alt="QR on event poster" />
</div>

### Branded QR (custom colors for finder patterns)

```js
import { makeQrSvgString } from 'qr-kit/renderers/svg';

const svg = makeQrSvgString(model, {
  fg: '#000',        // data modules
  fnColor: '#f97316', // finder patterns (3 corners)
  bg: '#fff',
});
```

### Web Worker (no jank on v10-12)

```jsx
import { useQrWorker } from 'qr-kit';

function MyQr({ url }) {
  const { model, error, pending } = useQrWorker(url, { maxVersion: 10 });
  
  if (pending) return <Spinner />;
  return <canvas ref={useQrCanvas(model)} />;
}
```

**When to use:**
- `useQrCode` (sync) — fast, zero overhead, v1-6
- `useQrWorker` (async) — prevents jank on v7-12 or real-time input

---

## 🎮 Interactive playground

Open [`playground/index.html`](playground/index.html) in your browser — no build, no server.

**Features:**
- 4 render modes: Basic, Rounded, Branded, Logo
- Link Builder with real-time byte counting
- PDF Export with metadata
- All export formats (SVG, PNG, JPEG)
- Live code examples

**Works offline.** Single HTML file, 53 kB.

---

## 🏗️ Architecture

Three layers, zero coupling:

**Layer 1 — Pure computation** (Node, Deno, Workers, browser)
```js
import { makeQr } from 'qr-kit/qr/qr-core';
// → { modules: Uint8Array, functionMask: Uint8Array, version, size, eccLevel }
```

**Layer 2 — Rendering adapters** (return data, no side effects)
```js
import { makeQrSvgString } from 'qr-kit/renderers/svg';
import { renderQrToCanvas } from 'qr-kit/renderers/canvas';
```

**Layer 3 — Browser actions** (downloads, side effects)
```js
import { downloadQrPng } from 'qr-kit/utils/raster';
// Internally calls Layer 2 → triggers download
```

**Design principle:** Functions return data, not perform actions.  
Every `download*` function has a `build*Bytes` / `build*Blob` primitive.

---

## 📊 Bundle size comparison

| Library | Size (gzip) | Dependencies | Logo overlay |
|---------|-------------|--------------|--------------|
| **qr-kit** | **5.4 kB** | **0** | ✅ |
| qrcode | 29.8 kB | 4 | ❌ |
| qr-code-generator | 7.2 kB | 0 | ❌ |
| node-qrcode | 52.1 kB | 6 | ❌ |

*Core bundle size. Full library with all utilities: 26.7 kB gzip.*

---

## 🧪 Testing

```bash
npm test        # Run 109 tests
npm run size    # Bundle size report
```

**Test coverage:**
- ✅ 20 unit tests (qr-core, layout, svg, url, link, logo)
- ✅ 23 logo overlay tests (ECC budget, constraints, rendering)
- ✅ 8 property-based tests (500-10K random inputs)
- ✅ 8 golden file tests (regression against known outputs)

---

## 📚 API Reference

Full API docs: [`types/index.d.ts`](types/index.d.ts)

**Core:**
- `makeQr(text, opts)` — Generate QR model
- `getModule(model, x, y)` — Read module at position
- `isFunctionModule(model, x, y)` — Check if module is functional

**Renderers:**
- `makeQrPath(model, opts)` — SVG `<path>` d-attribute
- `makeQrPathSplit(model, opts)` — Separate data/function paths
- `makeQrSvgString(model, opts)` — Complete SVG markup
- `renderQrToCanvas(model, canvas, opts)` — Draw on canvas

**Logo overlay:**
- `makeQrWithLogoSvg(model, logoDataUrl, opts)` — SVG with logo
- `getLogoConstraints(model, size, margin)` — Max safe logo size
- `buildQrWithLogoSvgAsync(model, logoSrc, opts)` — Browser helper

**Exports:**
- `downloadQrPng(svgEl, opts)` — PNG export
- `downloadQrJpeg(opts)` — JPEG export (canvas-based)
- `downloadQrPdf(opts)` — PDF with QR + metadata
- `downloadQrComposite(opts)` — QR on background image

**Utilities:**
- `buildQrLink(opts)` — Optimize URL for QR byte budget
- `sanitizeUrlForQR(url, opts)` — Strip tracking params
- `utf8ByteLen(str)` — Count UTF-8 bytes

---

## 🤝 Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md)

**Philosophy:**
- Zero dependencies, always
- No build step — ship source as ES modules
- Browser-only features are opt-in (deep imports)
- Every function is testable in Node.js

---

## 📝 License

MIT © [Yaroslav3991](https://github.com/Yaroslav3991)

---

## 🌟 Show your support

If this library saved you time, give it a ⭐ on [GitHub](https://github.com/Yaroslav3991/qr-kit)!

**Built with ❤️ to prove that npm packages don't need dependencies to be powerful.**

