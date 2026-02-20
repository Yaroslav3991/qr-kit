# QR Code Playground

Interactive demo showcasing all features of `@your-org/qr-code` library.

## Features

### Render Modes
- **Basic** — Standard black & white QR with single `<path>` SVG
- **Rounded** — Smooth rounded corners on modules (35% radius)
- **Branded** — Separate colours for data vs function modules (finder patterns)
- **Logo** — Embedded logo overlay with ECC budget enforcement

### Settings
- **Size** (128-512px) — Output canvas size
- **Margin** (0-40px) — Quiet zone padding
- **ECC** (L/M) — Error correction level
- **maxVersion** (v4-v12) — Maximum QR version allowed
- **Colours** — Foreground, background, and function module colours

### Advanced Features

#### Link Builder
Interactive demonstration of `buildQrLink()` — optimize URLs for QR codes:
- **Budget** — Target byte limit for QR URL
- **Strategy** — trim (shorten), drop (remove), or error (fail)
- **Trim Key** — Which JSON field to shorten if over budget
- **Remove Protocol** — Strip https:// to save 8 bytes
- Real-time byte counting and result preview

#### PDF Export
Generate A4 PDFs with QR code + title/org/URL:
- Uses `buildSimplePdf()` inline implementation
- Zero-dependency PDF generation (no libraries)
- Downloads directly from browser

### Export Formats
- **SVG** — Vector format, infinite scaling
- **PNG** — Raster at 3× scale (768px @ size=256)
- **JPEG** — Raster with white background, 92% quality
- **Copy SVG** — Copy source to clipboard

## Usage

1. Open `qr-playground.html` directly in browser (no server needed)
2. Enter URL or text in the input field
3. Switch render modes via tabs
4. Adjust settings with sliders
5. Try Advanced Features (Link Builder, PDF)
6. Export in any format

## Technical Details

All QR generation runs **client-side** with inlined library code:
- `qr-core.js` — QR encoding (minified, ~4.7 kB gzip)
- `layout.js` — Pixel geometry
- `renderers/svg.js` — Path generation
- `utils/link.js` — Link optimization
- `utils/logo.js` — Logo overlay

Zero external dependencies. Works offline. Fully self-contained single HTML file.

## Design

- Dark theme with dot-grid background
- DM Sans + DM Mono typefaces (Google Fonts)
- CSS-only interactions (no React/Vue/Svelte)
- Responsive: adapts to mobile/tablet viewports

Built with ❤️ to showcase what's possible with modern vanilla JS.
