# Architecture Decisions

This document records the *why* behind key technical choices.
Updated when a significant decision is made or reconsidered.

---

## 001 — Flat Uint8Array instead of nested arrays for modules

**Date:** v2.0.0  
**Status:** Active

**Decision:** `model.modules` is a flat `Uint8Array` of `size²` elements.  
Access: `modules[y * size + x]`. Use `getModule(model, x, y)` for readability.

**Why:**
- `Uint8Array` is ~5–8× faster to iterate than `(number[][])` in V8 hot loops
- Single contiguous allocation — no GC pressure from `size` inner arrays
- Transferable via `postMessage` to a Web Worker without copying (`transfer`)
- Pattern matches WebGL/WebGPU texture data expectations

**Tradeoff:** `model.modules[y][x]` no longer works. Migration is `modules[y * size + x]`  
or the `getModule()` helper.

---

## 002 — functionMask exported from makeQr

**Date:** v2.0.0  
**Status:** Active

**Decision:** `model.functionMask` is a flat `Uint8Array` that marks which modules
belong to function patterns (finder, separator, timing, alignment, format/version info).

**Why:**
- Custom renderers need to distinguish data modules from function modules to apply
  separate styles (branded colour for finder patterns, inverted timing, etc.)
- Previously, renderers had to reconstruct this information themselves
- Returning it from `makeQr` costs ~800 bytes RAM and 0 extra algorithm work
  (we already compute it internally for mask selection)

**Alternative considered:** A separate `makeFunctionMask(model)` utility.  
Rejected because it would be called 100% of the time by renderers and adds a
function call + redundant computation.

---

## 003 — Single `<path>` instead of many `<rect>` in SVG renderer

**Date:** v2.0.0  
**Status:** Active

**Decision:** `makeQrPath()` builds one SVG path `d` attribute covering all dark modules.
The React component renders `<path fill={fg} d={d} />` — one DOM node for the whole QR.

**Why:**
- A v6 QR has ~300–500 dark modules → 300–500 `<rect>` elements in DOM
- One `<path>` means one DOM node, one paint call, one CSS selector target
- Easier to animate: a single `<path>` can be transitioned via CSS opacity,
  clipped, or morphed via GSAP/Framer Motion
- ~30% faster initial render in Chrome benchmarks for v6+

**Tradeoff:** The `d` string is longer than equivalent `rect` markup, but gzip
makes this a wash.

**Note:** `makeQrPathSplit()` provides separate data/function paths for styled rendering.

---

## 004 — Byte mode only (no Numeric / Alphanumeric / Kanji)

**Date:** v1.0.0  
**Status:** Active

**Decision:** Only QR Byte mode is implemented. URLs are always encoded in Byte/UTF-8.

**Why:**
- Numeric mode saves space for digit-only strings (phone numbers, IDs). Our use
  case is URLs, which contain `/`, `.`, `?`, `=`, `&` — none of these are in
  Numeric or Alphanumeric character sets.
- Alphanumeric mode supports uppercase A–Z, 0–9, and ` $%*+-./:`. Most URLs
  need lowercase letters and `_`, `&`, `#` — not supported.
- Kanji mode would add ~3 kB of mapping tables to the bundle for a very narrow
  use case (Japanese-language apps can use UTF-8 Byte mode instead).

**Tradeoff:** QR codes for purely numeric strings (e.g. `tel:+79991234567`) are
slightly larger than optimal. Acceptable given the target use case.

---

## 005 — ECC levels L and M only (no Q, H)

**Date:** v1.0.0  
**Status:** Active

**Decision:** Only ECC L (~7% recovery) and ECC M (~15%) are supported.

**Why:**
- ECC Q (25%) and H (30%) are designed for tiny QR codes in harsh physical
  conditions, or for QR codes with a large logo overlay (which requires H).
- Our primary use case is screen display and print-on-demand at ≥ 2 cm size —
  where L and M are universally sufficient.
- Each ECC level adds ~1 kB of table data. Omitting Q and H saves 2 kB.

**If you need logo overlay support:** Use ECC M with `makeQrPathSplit()` to
identify data vs function modules. The logo should cover only data modules.
A proper logo-overlay implementation would require H — open an issue if this
is a priority.

---

## 006 — Three-layer architecture

**Date:** v2.0.0  
**Status:** Active

**Decision:**  
- **Layer 1** — Pure computation (`qr-core`, `layout`, `url`, `link`). No DOM, no React, no side effects. Works anywhere JS runs.  
- **Layer 2** — Rendering adapters (`renderers/svg`, `renderers/canvas`, React component). Return data or draw on an existing canvas. No downloads.  
- **Layer 3** — Browser actions (`utils/raster`, `jpegQr`, `poster`, `pdf`). Trigger downloads, create Blobs. Browser-only.

**Why:**
- Layer 1 can be used in Node.js CLIs, Cloudflare Workers, Deno, test runners
  without any mocking.
- Layer 2 separates "how to render" from "what to do with the result".
  `buildQrPdfBytes()` returns a `Uint8Array` — the caller decides whether to
  download it, upload it, or put it in a test assertion.
- Layer 3 download wrappers are intentionally thin: they call Layer 2 primitives
  and then call `downloadBytes()`. Easy to replace the download step.

**Principle:** Functions should return data, not perform actions.

---

## 007 — `buildQr*Bytes` / `buildQrCompositeBlob` as separate primitives

**Date:** v2.0.0  
**Status:** Active

**Decision:** Every Layer 3 utility has a data-returning primitive:
- `buildQrPdfBytes(opts): Promise<Uint8Array>`
- `buildPdfWithTemplateBytes(opts): Promise<Uint8Array>`
- `buildQrCompositeBlob(opts): Promise<Blob>`

The `download*` functions are thin wrappers that call the primitive then trigger a download.

**Why:**
- Unit-testable without triggering actual file downloads
- Usable in server-side rendering (e.g. Next.js API route that returns a PDF)
- Composable: caller can upload the bytes, cache them, display in an `<iframe>`

---

## 008 — No build step: source ships as-is

**Date:** v1.0.0  
**Status:** Active

**Decision:** Source files are plain ES modules (`.js`) and ship directly to npm.
No transpilation, no bundling, no TypeScript compilation.

**Why:**
- Zero-dep positioning: consumers who use a bundler (Vite, webpack, esbuild)
  get optimal tree-shaking automatically.
- Consumers who don't use a bundler get the file directly — no `dist/` confusion.
- TypeScript declarations are handwritten in `types/index.d.ts` — avoids
  requiring `tsc` in the release process.

**Tradeoff:** TypeScript source would catch type errors in the implementation.
We use JSDoc + handwritten `.d.ts` as a pragmatic middle ground.  
If the project grows, consider adding `tsc --checkJs --noEmit` to CI.

---

## 009 — Logo overlay via SVG layering, not canvas compositing

**Date:** v2.1.0  
**Status:** Active

**Decision:** `makeQrWithLogoSvg()` builds a zero-DOM SVG string using three layers:
1. Data modules path (bottom)
2. Logo background rect + `<image href="data:...">` (middle)
3. Function modules path (top — always visible above the logo)

**Why:**
- Zero-DOM: works in Node.js, Deno, Cloudflare Workers without `document` or `canvas`.
- The logo is embedded as a base64 data URL — the SVG is self-contained and can be
  serialised to a file, sent over the wire, or used as `<img src="data:image/svg+xml,...">`.
- Function patterns (finder corners, timing strips) are always composited **above** the logo
  via z-order, ensuring scanner compatibility regardless of logo size or colour.
- ECC budget enforcement is explicit: `getLogoConstraints()` returns the max safe logo size
  before any SVG is built, preventing accidental over-coverage.

**Coverage limits:**
- ECC M: max 11% of QR area (leaves 4% buffer from the 15% correction capacity)
- ECC L: max 4% of QR area (leaves 3% buffer from the 7% correction capacity)

**Alternative considered:** Canvas compositing (draw QR, draw logo, export PNG).  
Rejected for the primary API because it requires `document.createElement('canvas')` which
is unavailable in server-side and edge environments. Canvas compositing is available
via `buildQrWithLogoSvgAsync()` + `svgToPngDataURL()` for browser-only export.

**Note:** For extremely large logos (>15% coverage) or logos covering function patterns,
ECC H would be required. ECC H is not currently implemented (see Decision 005).

---

## 010 — Web Worker via message-passing, shared singleton

**Date:** v2.1.0  
**Status:** Active

**Decision:** `useQrWorker()` uses a single shared Worker instance (lazily created)
with a callback map keyed by message ID. The Worker transfers `Uint8Array` buffers
via the `transfer` option to avoid copying.

**Why:**
- One Worker per app avoids spawning N Workers for N `useQrWorker` hook instances.
- The Uint8Array `transfer` means moving (not copying) `modules` and `functionMask`
  from the Worker's heap to the main thread heap — zero extra allocation.
- `useQrWorker` vs `useQrCode`: the synchronous hook is faster for v1–6; the Worker
  hook avoids jank on v7–12 (15–30ms compute time) or during rapid input change.

**Tradeoff:** The shared Worker is never explicitly terminated. For SPAs this is fine.
Apps with strict resource management can terminate it via `worker.terminate()` if needed.

---

## 011 — AbortSignal on all async Layer-3 utilities

**Date:** v2.1.0  
**Status:** Active

**Decision:** `buildQrCompositeBlob`, `buildPdfWithTemplateBytes`, `buildQrPdfBytes`,
and `loadLogoAsDataUrl` all accept an `AbortSignal` via `{ signal }` in their options.

**Why:**
- React components unmount mid-flight (navigation, rerenders). Without abort support,
  the async operation continues and may call `setState` on an unmounted component.
- Double-click / rapid re-triggering creates multiple in-flight operations. With
  `AbortController`, the caller can cancel the previous operation before starting a new one.
- The pattern `signal?.throwIfAborted?.()` is checked at entry; `fetch()` and `loadImage()`
  propagate the signal to their own abort paths.

**Usage:**
```js
const controller = new AbortController();
const blob = await buildQrCompositeBlob({ svgEl, templateSrc, signal: controller.signal });
// To cancel: controller.abort();
```
