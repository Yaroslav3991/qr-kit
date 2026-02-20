# Images needed for viral README

## 1. Hero demo GIF (docs/hero-demo.gif)
**Record:** 
- Open playground/index.html
- Switch to "Logo" tab
- Drag & drop company logo
- Show QR generation
- Export to PNG
**Tool:** ScreenToGif, LICEcap, or QuickTime Screen Recording + ezgif.com
**Size:** 600px wide, ~2-3 MB

## 2. Logo overlay example (docs/logo-overlay-example.png)
**Screenshot of:**
- QR code with recognizable logo (Apple, Nike, etc.)
- 400×400px
- Show that QR still scans
**Tool:** Take screenshot from playground or generate programmatically

## 3. Poster example (docs/poster-example.png)
**Create:**
- Event poster background
- QR positioned in corner
- 600px wide
**Tool:** Canva + playground Poster feature

## Quick generation script:

```bash
# Generate examples programmatically
node scripts/generate-docs-images.js
```

Create this script to auto-generate demo images using headless browser.
