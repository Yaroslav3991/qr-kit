// utils/pdf.js
// Zero-dependency browser PDF builder: assembles a PDF with a background image
// and a QR code, both embedded as JPEG XObjects.
//
// IMPORTANT: PDF coordinates originate from the BOTTOM-LEFT corner of the page.

import { svgToPngDataURL, pngDataURLtoJpegBytes, dataURLToImage, dataURLToBytes } from './raster.js';

// -----------------------------
// Internal helpers: image loading
// -----------------------------

// Fetches raw image bytes (JPEG/PNG) without re-encoding
async function fetchBytes(url, { signal } = {}) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

// Loads an <img> element without crossOrigin (we only need width/height)
function loadImgNoCors(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Returns true if bytes start with the JPEG magic number FF D8
function isJpeg(u8) {
  return u8.length > 2 && u8[0] === 0xFF && u8[1] === 0xD8;
}

// Re-encodes any image (PNG, WebP, GIF, CMYK JPEG, …) to RGB JPEG via canvas
async function recodeToRgbJpeg(src, quality = 0.92) {
  const img = await loadImgNoCors(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return dataURLToBytes(canvas.toDataURL('image/jpeg', quality));
}

// Detects the number of colour components in a JPEG (1=Gray, 3=RGB/YCbCr, 4=CMYK)
function jpegComponents(u8) {
  let i = 0;
  if (u8[i++] !== 0xFF || u8[i++] !== 0xD8) return null; // not a JPEG
  while (i + 4 < u8.length) {
    if (u8[i] !== 0xFF) { i++; continue; }
    const marker = u8[i + 1];
    i += 2;
    if (marker === 0xDA) break; // SOS marker — image data starts here
    const len = (u8[i] << 8) | u8[i + 1]; i += 2;
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      // SOF0/1/2: precision(1), H(2), W(2), Nf(1)
      return u8[i + 5] || null;
    } else {
      i += len - 2;
    }
  }
  return null;
}

function colorSpaceDictForJpeg(u8) {
  const nf = jpegComponents(u8);
  if (nf === 1) return { cs: '/DeviceGray', decode: '' };
  if (nf === 4) return { cs: '/DeviceCMYK', decode: ' /Decode [1 0 1 0 1 0 1 0]' };
  return { cs: '/DeviceRGB', decode: '' }; // default
}

// -----------------------------
// Internal helpers: PDF low-level
// -----------------------------

function arrayBufferToLatin1(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return s;
}

function strToBytesLatin1(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
  return out;
}

function concatBytes(...parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Binary stream object (used for image XObjects)
// << >> delimiters and CRLF around stream/endstream are required by PDF spec
function streamObj({ dict, bytes }) {
  const head = `<< ${dict} >>\r\nstream\r\n`;
  const tail  = `\r\nendstream`;
  return head + arrayBufferToLatin1(bytes) + tail;
}

// ASCII content stream (used for page content operators)
function streamRaw(content) {
  const length = content.length;
  return `<< /Length ${length} >>\r\nstream\r\n${content}\r\nendstream`;
}

// Assembles a complete PDF byte sequence from an array of object strings.
// The binary comment after the header tells viewers that the file contains binary streams.
function assemblePDF(objects) {
  const header    = '%PDF-1.7\r\n%\xFF\xFF\xFF\xFF\r\n';
  const bodyParts = objects.map((o, i) => `${i + 1} 0 obj\r\n${o}\r\nendobj\r\n`);
  const body      = bodyParts.join('');

  const offsets = [0];
  let cursor    = header.length;
  for (const part of bodyParts) { offsets.push(cursor); cursor += part.length; }

  const xrefStart = header.length + body.length;
  let xref = `xref\r\n0 ${objects.length + 1}\r\n0000000000 65535 f \r\n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \r\n`;
  }

  const trailer = `trailer\r\n<< /Size ${objects.length + 1} /Root ${objects.length} 0 R >>\r\nstartxref\r\n${xrefStart}\r\n%%EOF`;

  return {
    pdfBytes: concatBytes(
      strToBytesLatin1(header),
      strToBytesLatin1(body),
      strToBytesLatin1(xref),
      strToBytesLatin1(trailer),
    ),
  };
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Escapes a string for use inside a PDF text literal (ASCII only)
function escapePDFText(s) {
  return String(s).replace(/[\\()]/g, m => ({ '\\': '\\\\', '(': '\\(', ')': '\\)' }[m]));
}

// -----------------------------
// PUBLIC API — Data primitives (return bytes, no side effects)
// -----------------------------

/**
 * Builds a simple A4 PDF and returns it as a Uint8Array.
 * Use this to send the PDF to a server, store in state, or test without triggering a download.
 *
 * @param {object} opts - Same options as downloadQrPdf except no `fileName`.
 * @returns {Promise<Uint8Array>}
 */
export async function buildQrPdfBytes({
  svgEl,
  title  = 'Leaflet',
  org,
  url,
  notes  = [],
  images = [],
}) {
  const pageW = 595.276, pageH = 841.890;
  const qrDataUrl   = await svgToPngDataURL(svgEl, 3);
  const qrJpegBytes = await pngDataURLtoJpegBytes(qrDataUrl, 0.92);
  const qrImgEl     = await dataURLToImage(qrDataUrl);

  const extra = [];
  for (const item of images) {
    try {
      const imgEl = await loadImgNoCors(item.src);
      let bytes = await fetchBytes(item.src);
      if (!isJpeg(bytes)) bytes = await recodeToRgbJpeg(item.src, 0.9);
      extra.push({ imgEl, bytes, spec: colorSpaceDictForJpeg(bytes), caption: item.caption });
    } catch (e) { console.warn('Image load failed:', item.src, e); }
  }

  const objs = [], addObj = s => { objs.push(s); return objs.length; };
  const fontId = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  const qrSpec = colorSpaceDictForJpeg(qrJpegBytes);
  const qrId   = addObj(streamObj({ dict: `/Type /XObject /Subtype /Image /Width ${qrImgEl.width} /Height ${qrImgEl.height} /ColorSpace ${qrSpec.cs}${qrSpec.decode} /BitsPerComponent 8 /Filter /DCTDecode /Length ${qrJpegBytes.length}`, bytes: qrJpegBytes }));
  const extraIds = extra.map(e => addObj(streamObj({ dict: `/Type /XObject /Subtype /Image /Width ${e.imgEl.width} /Height ${e.imgEl.height} /ColorSpace ${e.spec.cs}${e.spec.decode} /BitsPerComponent 8 /Filter /DCTDecode /Length ${e.bytes.length}`, bytes: e.bytes })));

  const c = [];
  c.push(`BT /F1 20 Tf 50 ${pageH - 60} Td (${escapePDFText(title)}) Tj ET`);
  const lines = [org && `Org: ${org}`, url && `URL: ${url}`, ...notes].filter(Boolean);
  let y = pageH - 90;
  c.push('BT /F1 11 Tf');
  for (const line of lines) { c.push(`50 ${y} Td (${escapePDFText(line)}) Tj`); y -= 16; }
  c.push('ET');
  const qrSize = 220, qrX = pageW - 50 - qrSize, qrY = pageH - 60 - qrSize;
  c.push(`q ${qrSize} 0 0 ${qrSize} ${qrX} ${qrY} cm /ImQR Do Q`);
  let imgX = 50, imgY = qrY - 30;
  for (let i = 0; i < extraIds.length; i++) {
    if (imgX + 120 > pageW - 50) { imgX = 50; imgY -= 110; }
    c.push(`q 120 0 0 80 ${imgX} ${imgY - 80} cm /Im${i} Do Q`);
    if (extra[i].caption) c.push(`BT /F1 10 Tf ${imgX} ${imgY - 94} Td (${escapePDFText(extra[i].caption)}) Tj ET`);
    imgX += 136;
  }

  const cId  = addObj(streamRaw(c.join('\n')));
  const xObj = [`/ImQR ${qrId} 0 R`, ...extraIds.map((id, i) => `/Im${i} ${id} 0 R`)].join(' ');
  const rId  = addObj(`<< /ProcSet [/PDF /ImageC] /Font << /F1 ${fontId} 0 R >> /XObject << ${xObj} >> >>`);
  const pgId = addObj(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources ${rId} 0 R /Contents ${cId} 0 R >>`);
  const psId = addObj(`<< /Type /Pages /Kids [${pgId} 0 R] /Count 1 >>`);
  objs[pgId - 1] = `<< /Type /Page /Parent ${psId} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources ${rId} 0 R /Contents ${cId} 0 R >>`;
  addObj(`<< /Type /Catalog /Pages ${psId} 0 R >>`);
  return assemblePDF(objs).pdfBytes;
}

/**
 * Builds a PDF with a full-page background image + QR overlay, returns Uint8Array.
 * Use this to upload to a server, test, or create a Blob manually.
 *
 * @param {object} opts - Same as downloadPdfWithTemplateImage except no `fileName`.
 * @returns {Promise<Uint8Array>}
 */
export async function buildPdfWithTemplateBytes({
  svgEl,
  templateSrc,
  page          = { width: 595.276, height: 841.890 },
  qr            = { x: 420, y: 130, size: 160 },
  recodeBgToRgb = false,
  signal,
}) {
  signal?.throwIfAborted?.();
  const pageW = page.width || 595.276, pageH = page.height || 841.890;
  const bgImgEl = await loadImgNoCors(templateSrc);
  let bgBytes   = await fetchBytes(templateSrc, { signal });
  if (recodeBgToRgb || !isJpeg(bgBytes)) bgBytes = await recodeToRgbJpeg(templateSrc, 0.92);
  const bgSpec = colorSpaceDictForJpeg(bgBytes);

  const qrPngUrl = await svgToPngDataURL(svgEl, 3);
  const qrImgEl  = await dataURLToImage(qrPngUrl);
  const qrBytes  = await pngDataURLtoJpegBytes(qrPngUrl, 0.92);
  const qrSpec   = colorSpaceDictForJpeg(qrBytes);

  const objs = [], addObj = s => { objs.push(s); return objs.length; };
  const bgId = addObj(streamObj({ dict: `/Type /XObject /Subtype /Image /Width ${bgImgEl.width} /Height ${bgImgEl.height} /ColorSpace ${bgSpec.cs}${bgSpec.decode} /BitsPerComponent 8 /Filter /DCTDecode /Length ${bgBytes.length}`, bytes: bgBytes }));
  const qrId = addObj(streamObj({ dict: `/Type /XObject /Subtype /Image /Width ${qrImgEl.width} /Height ${qrImgEl.height} /ColorSpace ${qrSpec.cs}${qrSpec.decode} /BitsPerComponent 8 /Filter /DCTDecode /Length ${qrBytes.length}`, bytes: qrBytes }));
  const cId  = addObj(streamRaw(`q ${pageW} 0 0 ${pageH} 0 0 cm /ImBG Do Q\nq ${qr.size} 0 0 ${qr.size} ${qr.x} ${qr.y} cm /ImQR Do Q`));
  const rId  = addObj(`<< /ProcSet [/PDF /ImageC] /XObject << /ImBG ${bgId} 0 R /ImQR ${qrId} 0 R >> >>`);
  const pgId = addObj(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources ${rId} 0 R /Contents ${cId} 0 R >>`);
  const psId = addObj(`<< /Type /Pages /Kids [${pgId} 0 R] /Count 1 >>`);
  objs[pgId - 1] = `<< /Type /Page /Parent ${psId} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources ${rId} 0 R /Contents ${cId} 0 R >>`;
  addObj(`<< /Type /Catalog /Pages ${psId} 0 R >>`);
  return assemblePDF(objs).pdfBytes;
}

// -----------------------------
// PUBLIC API — Download wrappers (browser side-effects)
// -----------------------------

/**
 * Generates a simple A4 PDF (title + optional text + QR code) and triggers a download.
 *
 * Note: text rendering uses the built-in Helvetica font — only ASCII characters
 * are supported in text fields. For Cyrillic/non-Latin, use the image-based
 * variant `downloadPdfWithTemplateImage` with a pre-rendered background.
 *
 * @param {object} opts
 * @param {SVGSVGElement} opts.svgEl
 * @param {string}  [opts.title]
 * @param {string}  [opts.org]
 * @param {string}  [opts.url]
 * @param {string[]} [opts.notes]
 * @param {Array<{src: string, caption?: string}>} [opts.images]
 * @param {string}  [opts.fileName='leaflet.pdf']
 */
export async function downloadQrPdf({
  svgEl, title = 'Leaflet', org, url, notes = [], images = [], fileName = 'leaflet.pdf',
}) {
  const bytes = await buildQrPdfBytes({ svgEl, title, org, url, notes, images });
  downloadBytes(bytes, fileName);
}

/** @deprecated Use `downloadQrPdf` instead. */
export const downloadLeafletPDF = downloadQrPdf;

/**
 * Generates a PDF with a full-page background image and QR overlay, then triggers a download.
 *
 * Background images are auto-converted to RGB JPEG if needed (PNG, WebP, CMYK JPEG).
 * Set `recodeBgToRgb: true` to force this even for regular JPEGs (e.g. CMYK sources).
 *
 * @param {object}  opts
 * @param {SVGSVGElement} opts.svgEl
 * @param {string}  opts.templateSrc
 * @param {{ width: number, height: number }} [opts.page]  - Default: A4
 * @param {{ x: number, y: number, size: number }} [opts.qr] - pt from bottom-left
 * @param {string}  [opts.fileName='leaflet.pdf']
 * @param {boolean} [opts.recodeBgToRgb=false]
 */
export async function downloadPdfWithTemplateImage({
  svgEl, templateSrc,
  page = { width: 595.276, height: 841.890 },
  qr   = { x: 420, y: 130, size: 160 },
  fileName = 'leaflet.pdf',
  recodeBgToRgb = false,
}) {
  const bytes = await buildPdfWithTemplateBytes({ svgEl, templateSrc, page, qr, recodeBgToRgb });
  downloadBytes(bytes, fileName);
}
