// utils/raster.js
// Browser-side raster helpers: SVG → PNG, PNG → JPEG, image loading.
// No external dependencies.

/**
 * Serialises an SVG element to a PNG data URL at the given pixel scale.
 * @param {SVGSVGElement} svgEl
 * @param {number} [scale=2]
 * @returns {Promise<string>} PNG data URL
 */
export async function svgToPngDataURL(svgEl, scale = 2) {
  const serializer = new XMLSerializer();
  let svg = serializer.serializeToString(svgEl);

  // Ensure xmlns attribute is present (required for img.src rendering)
  if (!svg.match(/^<svg[^>]+xmlns=/)) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const vbox = svgEl.viewBox?.baseVal;
  const w = Math.floor((vbox?.width  || svgEl.width.baseVal.value)  * scale);
  const h = Math.floor((vbox?.height || svgEl.height.baseVal.value) * scale);

  const img = new Image();
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL('image/png');
}

/**
 * Converts a base64 data URL to a Uint8Array of raw bytes.
 * @param {string} dataUrl
 * @returns {Uint8Array}
 */
export function dataURLToBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/**
 * Re-encodes a PNG data URL as JPEG bytes.
 * @param {string} pngDataURL
 * @param {number} [quality=0.92]
 * @returns {Promise<Uint8Array>}
 */
export async function pngDataURLtoJpegBytes(pngDataURL, quality = 0.92) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = pngDataURL; });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);

  const jpg = canvas.toDataURL('image/jpeg', quality);
  return dataURLToBytes(jpg);
}

/**
 * Loads an image via a URL with crossOrigin="anonymous".
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    if (signal) {
      signal.addEventListener('abort', () => {
        img.src = '';
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }
    img.src = src;
  });
}

/**
 * Loads an image from a URL and returns it as JPEG bytes.
 * @param {string} src
 * @param {number} [quality=0.9]
 * @returns {Promise<Uint8Array>}
 */
export async function imageURLtoJpegBytes(src, quality = 0.9) {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  const jpg = canvas.toDataURL('image/jpeg', quality);
  return dataURLToBytes(jpg);
}

/**
 * Resolves a data URL string into an HTMLImageElement.
 * @param {string} dataUrl
 * @returns {Promise<HTMLImageElement>}
 */
export function dataURLToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Downloads the QR SVG element as a PNG file.
 * @param {SVGSVGElement} svgEl
 * @param {object} [opts]
 * @param {number} [opts.scale=3]
 * @param {string} [opts.fileName='qr.png']
 * @returns {Promise<void>}
 */
export async function downloadQrPng(svgEl, { scale = 3, fileName = 'qr.png' } = {}) {
  if (!svgEl) throw new Error('downloadQrPng: svgEl is required');
  const dataUrl = await svgToPngDataURL(svgEl, scale);
  const a = document.createElement('a');
  a.href     = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
