// types/index.d.ts
// TypeScript declarations for qr-kit.
// Organised by layer — see DECISIONS.md for architecture overview.

/* ======================================================================== */
/*  Layer 1 — Pure computation (Node / Deno / Edge Runtime / browser)        */
/* ======================================================================== */

/* ── qr/qr-core ─────────────────────────────────────────────────────────── */

/** Error correction level: L = ~7% recovery, M = ~15% recovery. */
export type EccLevel = 'L' | 'M';

/**
 * The result of makeQr(). Immutable — all properties are read-only.
 *
 * `modules` is a flat Uint8Array of size² elements.
 * Access: `modules[y * size + x]` or use `getModule(model, x, y)`.
 */
export interface QRModel {
  readonly version:      number;
  readonly size:         number;
  readonly modules:      Uint8Array; // flat: modules[y * size + x] === 1 → dark
  readonly functionMask: Uint8Array; // flat: 1 = finder/timing/alignment/format
  readonly eccLevel:     EccLevel;
}

/**
 * Thrown when the input string is too long for the requested version and ECC level.
 * Catch by instanceof for typed error handling.
 */
export declare class QrInputTooLongError extends Error {
  readonly name:       'QrInputTooLongError';
  readonly byteLength: number; // actual UTF-8 byte length of the input
  readonly maxBytes:   number; // maximum the version/ECC can carry
  readonly maxVersion: number;
  readonly eccLevel:   EccLevel;
}

export interface MakeQrOptions {
  eccLevel?:   EccLevel;
  maxVersion?: number;
}

/**
 * Generates a QR code matrix for the given text (Byte mode, UTF-8).
 * @throws {QrInputTooLongError} if the input exceeds the requested version/ECC capacity.
 */
export function makeQr(text: string, opts?: MakeQrOptions): QRModel;

/**
 * Reads one module value from a flat QRModel.
 * Equivalent to `model.modules[y * model.size + x]`.
 */
export function getModule(model: QRModel, x: number, y: number): 0 | 1;

/**
 * Returns true if the module at (x, y) is a function pattern module
 * (finder, separator, timing, alignment, format/version info).
 */
export function isFunctionModule(model: QRModel, x: number, y: number): boolean;

/* ── utils/layout ───────────────────────────────────────────────────────── */

export interface LayoutResult {
  outer:      number; // actual outer canvas / SVG size (floored to integer)
  moduleSize: number; // pixels per module (integer)
  quietLeft:  number; // left offset of first module (px)
  quietTop:   number; // top offset of first module (px)
}

/**
 * Computes the pixel geometry for rendering a QR model.
 * Shared by all renderers — guarantees pixel-identical output across SVG, canvas, JPEG.
 */
export function computeLayout(moduleCount: number, size: number, margin: number): LayoutResult;

/* ── utils/url ──────────────────────────────────────────────────────────── */

export interface SanitizeUrlOptions {
  /** Params to always keep (exact match). Default: []. */
  whitelist?: string[];
  /**
   * When true (default), all params NOT in whitelist are removed.
   * When false, only known trackers (utm_*, gclid, fbclid, …) are removed.
   */
  aggressive?: boolean;
  /** Strip https:// or http:// from the result. Saves ~8 bytes in the QR. Default: true. */
  preserveProtocol?: boolean;
}

/** Returns the UTF-8 byte length of a string (equivalent to new TextEncoder().encode(s).length). */
export function utf8ByteLen(s: string): number;

/**
 * Strips tracking parameters from a URL and optionally removes the protocol.
 * Returns the unchanged input (trimmed) if the URL is not parseable.
 */
export function sanitizeUrlForQR(input: string, opts?: SanitizeUrlOptions): string;

/* ── utils/link ─────────────────────────────────────────────────────────── */

export type BuildQrLinkStrategy = 'trim' | 'drop' | 'error';

export interface BuildQrLinkOptions {
  /** Base URL (with or without query string). Required. */
  baseUrl: string;
  /** JSON object to encode as a Base64 parameter. Required. */
  payload: Record<string, unknown>;
  /** Payload key whose value to shorten when the URL is too long. */
  trimKey?: string;
  /**
   * What to do when `qrUrl` would exceed `qrBudgetBytes`:
   *  - 'trim'  — Binary-search shorten the trimKey value.
   *  - 'drop'  — Remove the trimKey from the QR payload.
   *  - 'error' — Return an error string (no URL produced).
   */
  strategy?: BuildQrLinkStrategy;
  /** Max byte length of qrUrl. Default: 134 (v6 ECC-L). */
  qrBudgetBytes?: number;
  /** Extra params added to fullUrl only (e.g. UTM). */
  extraParams?: Record<string, string>;
  /** Parameter name for the encoded payload. Default: 'd'. */
  paramName?: string;
  /** Strip https:// from qrUrl only. Default: false. */
  removeProtocol?: boolean;
}

export interface BuildQrLinkResult {
  fullUrl: string;  // full URL with extra params — for sharing / QR caption
  qrUrl:   string;  // compact URL — encode this as the QR value
  trimmed: boolean; // true if trimKey was shortened to fit
  removed: boolean; // true if trimKey was removed to fit
  error:   string;  // non-empty if strategy='error' and URL is too long
}

export function buildQrLink(opts: BuildQrLinkOptions): BuildQrLinkResult;

/* ======================================================================== */
/*  Layer 2 — Rendering adapters                                             */
/* ======================================================================== */

/* ── renderers/svg ──────────────────────────────────────────────────────── */

export interface MakeQrPathOptions {
  size?:    number;
  margin?:  number;
  rounded?: boolean;
}

/**
 * Returns a compact SVG path `d` attribute string.
 * One `<path>` covers the entire QR — fewer DOM nodes, faster rendering, easier styling.
 */
export function makeQrPath(model: QRModel, opts?: MakeQrPathOptions): string;

/**
 * Returns two separate path strings: one for data modules and one for function modules.
 * Lets you style finder/timing patterns differently from data modules.
 */
export function makeQrPathSplit(
  model: QRModel,
  opts?: { size?: number; margin?: number },
): { dataPath: string; functionPath: string };

export interface MakeQrSvgStringOptions {
  size?:    number;
  margin?:  number;
  fg?:      string;
  bg?:      string;
  title?:   string;
  rounded?: boolean;
}

/**
 * Returns a complete, self-contained SVG string.
 * Write to .svg file or use as `<img src="data:image/svg+xml,...">`.
 */
export function makeQrSvgString(model: QRModel, opts?: MakeQrSvgStringOptions): string;

/* ── renderers/canvas ───────────────────────────────────────────────────── */

export interface RenderQrToCanvasOptions {
  size?:     number;
  margin?:   number;
  fg?:       string;
  bg?:       string;
  /** Device pixel ratio / export scale. Default: 1. */
  scale?:    number;
  /** Optional separate colour for function modules. null = use fg. */
  fnColor?:  string | null;
}

/**
 * Renders a QR model onto an existing canvas (or OffscreenCanvas).
 * The caller owns the canvas — no DOM creation.
 */
export function renderQrToCanvas(
  model: QRModel,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  opts?: RenderQrToCanvasOptions,
): void;

/** Creates a new canvas, renders onto it, and returns it. */
export function makeQrCanvas(model: QRModel, opts?: RenderQrToCanvasOptions): HTMLCanvasElement;

/* ── React component ─────────────────────────────────────────────────────── */

export interface QRCodeGeneratorProps {
  value:           string;
  size?:           number;
  margin?:         number;
  title?:          string;
  ariaLabel?:      string;
  fg?:             string;
  bg?:             string;
  eccLevel?:       EccLevel;
  maxVersion?:     number;
  /** Render with rounded module corners. Default: false. */
  rounded?:        boolean;
  /**
   * Called when ECC M is silently downgraded to ECC L because the input
   * is too long for ECC M at the given maxVersion.
   */
  onEccFallback?:  (from: EccLevel, to: EccLevel) => void;
  className?:      string;
}

declare const QRCodeGenerator: React.ForwardRefExoticComponent<
  QRCodeGeneratorProps & React.RefAttributes<SVGSVGElement>
>;
export default QRCodeGenerator;

/* ── useQrCode hook ─────────────────────────────────────────────────────── */

export interface UseQrCodeOptions {
  eccLevel?:      EccLevel;
  maxVersion?:    number;
  fallbackToL?:   boolean;
  onEccFallback?: (from: EccLevel, to: EccLevel) => void;
}

export interface UseQrCodeResult {
  model:          QRModel | null;
  error:          Error | null;
  actualEccLevel: EccLevel | null;
}

/**
 * React hook. Returns the raw QRModel — use with your own renderer
 * (custom SVG, WebGL, canvas, branded finder patterns, etc.)
 */
export function useQrCode(value: string, opts?: UseQrCodeOptions): UseQrCodeResult;

/* ======================================================================== */
/*  Layer 3 — Browser-only actions (import via deep path)                   */
/* ======================================================================== */

/* ── utils/raster ───────────────────────────────────────────────────────── */

export function svgToPngDataURL(svgEl: SVGSVGElement, scale?: number): Promise<string>;
export function pngDataURLtoJpegBytes(pngDataURL: string, quality?: number): Promise<Uint8Array>;
export function dataURLToBytes(dataUrl: string): Uint8Array;
export function dataURLToImage(dataUrl: string): Promise<HTMLImageElement>;
export function loadImage(src: string): Promise<HTMLImageElement>;

export interface DownloadQrPngOptions {
  scale?:    number;
  fileName?: string;
}
export function downloadQrPng(svgEl: SVGSVGElement, opts?: DownloadQrPngOptions): Promise<void>;

/* ── utils/jpegQr ───────────────────────────────────────────────────────── */

export function downloadBlob(blob: Blob, fileName: string): void;

export interface DownloadQrJpegOptions {
  value:        string;
  fileName?:    string;
  size?:        number;
  margin?:      number;
  fg?:          string;
  bg?:          string;
  eccLevel?:    EccLevel;
  maxVersion?:  number;
}
export function downloadQrJpeg(opts: DownloadQrJpegOptions): Promise<void>;

/* ── utils/poster ───────────────────────────────────────────────────────── */

export interface QrPosition { x: number; y: number; size: number; }

export interface QrCompositeOptions {
  svgEl:         SVGSVGElement;
  templateSrc:   string;
  qr?:           QrPosition;
  mime?:         string;
  quality?:      number;
  scale?:        number;
  debug?:        boolean;
}

/** Composites QR onto a background image and returns a Blob (no download). */
export function buildQrCompositeBlob(opts: QrCompositeOptions): Promise<Blob>;

/** Composites QR onto a background image and triggers a download. */
export function downloadQrComposite(opts: QrCompositeOptions & { fileName?: string }): Promise<void>;

/** @deprecated Use `downloadQrComposite` instead. */
export const downloadLeafletImage: typeof downloadQrComposite;

/* ── utils/pdf ──────────────────────────────────────────────────────────── */

export interface QrPdfOptions {
  svgEl:    SVGSVGElement;
  title?:   string;
  org?:     string;
  url?:     string;
  notes?:   string[];
  images?:  Array<{ src: string; caption?: string }>;
}

export interface PdfTemplateOptions {
  svgEl:          SVGSVGElement;
  templateSrc:    string;
  page?:          { width: number; height: number };
  qr?:            { x: number; y: number; size: number };
  recodeBgToRgb?: boolean;
}

/** Builds a simple A4 PDF and returns raw bytes. No download. */
export function buildQrPdfBytes(opts: QrPdfOptions): Promise<Uint8Array>;

/** Builds a full-page background + QR PDF and returns raw bytes. No download. */
export function buildPdfWithTemplateBytes(opts: PdfTemplateOptions): Promise<Uint8Array>;

/** Builds and downloads a simple A4 PDF. */
export function downloadQrPdf(opts: QrPdfOptions & { fileName?: string }): Promise<void>;

/** Builds and downloads a full-page background + QR PDF. */
export function downloadPdfWithTemplateImage(opts: PdfTemplateOptions & { fileName?: string }): Promise<void>;

/** @deprecated Use `downloadQrPdf` instead. */
export const downloadLeafletPDF: typeof downloadQrPdf;

/* ── utils/logo ─────────────────────────────────────────────────────────── */

/** Max fraction of QR area safe to cover with ECC M logo (11%). */
export const LOGO_MAX_COVERAGE_ECC_M: number;

/** Max fraction of QR area safe to cover with ECC L logo (4%). */
export const LOGO_MAX_COVERAGE_ECC_L: number;

export interface QrLogoSvgOptions {
  /** Outer SVG size in pixels. Default: 256 */
  size?: number;
  /** Quiet-zone padding in pixels. Default: 16 */
  margin?: number;
  /** Data module colour. Default: '#000' */
  fg?: string;
  /** Function module colour (finder/timing). Default: same as fg */
  fnFg?: string;
  /** Background colour. Default: '#fff' */
  bg?: string;
  /**
   * Max fraction of QR area to cover with the logo.
   * Default: LOGO_MAX_COVERAGE_ECC_M for ECC M, LOGO_MAX_COVERAGE_ECC_L for ECC L.
   */
  maxCoverage?: number;
  /** White padding around logo in px. Default: 4 */
  logoPadding?: number;
  /** Colour of logo background. Default: '#fff' */
  logoBg?: string;
  /** Border-radius of logo background rect in px. Default: 6 */
  logoRadius?: number;
  /** SVG title. Default: 'QR Code' */
  title?: string;
}

export interface LogoConstraints {
  /** Maximum safe logo size in pixels. */
  maxLogoSize: number;
  /** maxLogoSize + default padding (8px). Recommended `<image>` container size. */
  paddedSize: number;
  /** Actual coverage fraction (logo pixels² / qr pixels²). */
  coverageFraction: number;
}

/**
 * Builds a complete SVG string with a logo embedded in the centre.
 * Zero-DOM: works in Node, Deno, Cloudflare Workers, and browser.
 * @param model     - Output of makeQr().
 * @param logoDataUrl - Base64 data URL of the logo image.
 */
export function makeQrWithLogoSvg(
  model: QRModel,
  logoDataUrl: string,
  opts?: QrLogoSvgOptions,
): string;

/** Returns the maximum safe logo size (in pixels) for a given model and output size. */
export function getLogoConstraints(
  model: QRModel,
  size: number,
  margin: number,
  maxCoverage?: number,
): LogoConstraints;

/**
 * Fetches an image URL and converts it to a base64 data URL. Browser-only.
 * @param src    - URL of the logo image.
 * @param opts   - Optional AbortSignal.
 */
export function loadLogoAsDataUrl(
  src: string,
  opts?: { signal?: AbortSignal },
): Promise<string>;

/**
 * Browser convenience: loads a logo from a URL and returns a complete QR SVG string.
 * @param model    - Output of makeQr().
 * @param logoSrc  - URL of the logo image.
 * @param opts     - Same options as makeQrWithLogoSvg, plus optional signal.
 */
export function buildQrWithLogoSvgAsync(
  model: QRModel,
  logoSrc: string,
  opts?: QrLogoSvgOptions & { signal?: AbortSignal },
): Promise<string>;

/* ── components/useQrWorker ─────────────────────────────────────────────── */

export interface UseQrWorkerResult {
  model: QRModel | null;
  error: Error | null;
  /** True while the Worker is computing. */
  pending: boolean;
}

/**
 * React hook that computes QR codes in a background Web Worker.
 * Use for v7–12 or real-time input animations to avoid frame drops.
 * Requires a bundler that supports `new URL('./worker/qr.worker.js', import.meta.url)`.
 */
export function useQrWorker(
  value: string,
  opts?: {
    eccLevel?: EccLevel;
    maxVersion?: number;
  },
): UseQrWorkerResult;

/* ── Signal options on async utilities ─────────────────────────────────── */

// Re-declare with signal added (augments the interfaces above)
export function buildQrCompositeBlob(
  opts: QrCompositeOptions & { signal?: AbortSignal },
): Promise<Blob>;

export function buildPdfWithTemplateBytes(
  opts: PdfTemplateOptions & { signal?: AbortSignal },
): Promise<Uint8Array>;
