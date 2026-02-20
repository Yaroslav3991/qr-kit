// utils/link.js
// Universal QR link builder with automatic payload fitting.
// No external dependencies. Works in any browser environment.

import { sanitizeUrlForQR, utf8ByteLen } from './url.js';

/**
 * Encodes a string to Base64 preserving full UTF-8.
 * @param {string} str
 * @returns {string}
 */
function b64utf8(str) {
  if (typeof TextEncoder !== 'undefined') {
    const u8 = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  }
  // Fallback for older environments
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Builds a QR-friendly URL with a JSON payload encoded as Base64 in a query parameter.
 *
 * Two URLs are returned:
 *  - `fullUrl`  — complete URL for sharing/copying (includes all params)
 *  - `qrUrl`    — trimmed URL optimised to fit within `qrBudgetBytes` (for the QR code itself)
 *
 * The `payload` object is serialised to JSON and base64-encoded into `paramName`.
 * An optional `trimKey` specifies which string field to shorten (binary search)
 * if the full payload exceeds the byte budget.
 *
 * @param {object} opts
 * @param {string}  opts.baseUrl            - Base URL, e.g. "https://example.com/landing"
 * @param {object}  opts.payload            - Arbitrary JSON payload (will be base64-encoded)
 * @param {string}  [opts.paramName]        - Query parameter name for the encoded payload (default: "data")
 * @param {object}  [opts.extraParams]      - Additional query params added to fullUrl only (e.g. UTM tags)
 * @param {number}  [opts.qrBudgetBytes]    - Max byte length of qrUrl (default: 134, fits QR v6-L)
 * @param {boolean} [opts.removeProtocol]   - Strip https:// from qrUrl to save bytes (default: true)
 * @param {string}  [opts.trimKey]          - Payload key to shorten when budget is exceeded
 * @param {'trim'|'drop'|'error'} [opts.strategy] - Overflow strategy (default: 'trim')
 *
 * @returns {{ fullUrl: string, qrUrl: string, trimmed: boolean, removed: boolean, error?: string }}
 *
 * @example
 * // Basic usage
 * const { fullUrl, qrUrl } = buildQrLink({
 *   baseUrl: 'https://example.com/join',
 *   payload: { userId: '123', plan: 'pro' },
 *   extraParams: { utm_source: 'poster', utm_medium: 'print' },
 * });
 *
 * @example
 * // With promo code trimming
 * const { fullUrl, qrUrl, trimmed } = buildQrLink({
 *   baseUrl: 'https://example.com/promo',
 *   payload: { ref: 'abc', code: 'SUPERSALE2024' },
 *   trimKey: 'code',
 *   strategy: 'trim',
 * });
 */
export function buildQrLink({
  baseUrl,
  payload,
  paramName = 'data',
  extraParams = {},
  qrBudgetBytes = 134,
  removeProtocol = true,
  trimKey = null,
  strategy = 'trim',
}) {
  if (!baseUrl) throw new Error('buildQrLink: baseUrl is required');
  if (!payload || typeof payload !== 'object') throw new Error('buildQrLink: payload must be an object');

  // --- Build fullUrl (all params) ---
  const fullB64 = b64utf8(JSON.stringify(payload));
  const fullUrlObj = new URL(baseUrl);
  fullUrlObj.searchParams.set(paramName, fullB64);
  for (const [k, v] of Object.entries(extraParams)) {
    fullUrlObj.searchParams.set(k, v);
  }
  const fullUrl = fullUrlObj.toString();

  // --- Build qrUrl (minimal params, optional protocol stripping) ---
  const mkQrUrl = (b64) => {
    const raw = `${baseUrl}?${paramName}=${b64}`;
    return sanitizeUrlForQR(raw, {
      whitelist: [paramName],
      aggressive: true,
      preserveProtocol: !removeProtocol,
    });
  };

  // Try full payload first
  let qrUrl = mkQrUrl(fullB64);
  if (utf8ByteLen(qrUrl) <= qrBudgetBytes) {
    return { fullUrl, qrUrl, trimmed: false, removed: false };
  }

  // --- Overflow handling ---
  if (strategy === 'error') {
    return { fullUrl, qrUrl: '', trimmed: false, removed: false, error: 'QR payload too long for budget' };
  }

  if (strategy === 'drop' || !trimKey) {
    const reduced = { ...payload };
    if (trimKey) delete reduced[trimKey];
    const b64 = b64utf8(JSON.stringify(reduced));
    return { fullUrl, qrUrl: mkQrUrl(b64), trimmed: false, removed: !!trimKey };
  }

  // strategy === 'trim': binary-search the shortest trimKey value that still fits
  const rawValue = payload[trimKey];
  if (rawValue != null && typeof rawValue !== 'string') {
    // trimKey points to a non-string field (number, boolean, object) — cannot be trimmed.
    // Fall through to 'drop' behaviour instead of silently corrupting data.
    const reduced = { ...payload };
    delete reduced[trimKey];
    return { fullUrl, qrUrl: mkQrUrl(b64utf8(JSON.stringify(reduced))), trimmed: false, removed: true };
  }
  const originalValue = String(rawValue || '').trim();
  let lo = 0, hi = originalValue.length, best = -1, bestQr = '';

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cut = originalValue.slice(0, mid);
    const candidate = { ...payload };
    if (cut) {
      candidate[trimKey] = cut;
    } else {
      delete candidate[trimKey];
    }
    const b64 = b64utf8(JSON.stringify(candidate));
    const url = mkQrUrl(b64);
    if (utf8ByteLen(url) <= qrBudgetBytes) {
      best = mid;
      bestQr = url;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best >= 0) {
    return { fullUrl, qrUrl: bestQr, trimmed: best < originalValue.length, removed: false };
  }

  // Last resort: drop the trimKey entirely
  const fallback = { ...payload };
  delete fallback[trimKey];
  const b64 = b64utf8(JSON.stringify(fallback));
  return { fullUrl, qrUrl: mkQrUrl(b64), trimmed: false, removed: true };
}
