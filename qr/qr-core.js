// qr/qr-core.js
// QR code generator: Byte mode, versions 1–12, ECC L/M.
// Implements interleaving, remainder bits and the dark module per the QR standard.
//
// Key design decisions — see DECISIONS.md for full rationale:
//  • modules is a flat Uint8Array (size²) — ~8× faster iteration than nested arrays
//  • functionMask is exported so renderers can style finder/timing differently
//  • QrInputTooLongError is a typed class — catch-by-type instead of string parsing
// Flat Uint8Array with correct function mask built on the fly.

// ─── Typed error ──────────────────────────────────────────────────────────────


export class QrInputTooLongError extends Error {
  constructor(byteLength, maxBytes, maxVersion, eccLevel) {
    super(`Input is ${byteLength} bytes but max for v1–${maxVersion} at EC level ${eccLevel} is ${maxBytes} bytes.`);
    this.name = 'QrInputTooLongError';
    this.byteLength = byteLength;
    this.maxBytes = maxBytes;
    this.maxVersion = maxVersion;
    this.eccLevel = eccLevel;
  }
}

export function makeQr(text, opts = {}) {
  const { eccLevel = 'M', maxVersion = 6 } = opts;
  const bytes = utf8Encode(text);
  const spec = pickVersion(bytes.length, eccLevel, maxVersion);
  const { version, size, dataCodewords, ecPerBlock, blocks } = spec;

  // --- Build bit stream ---
  const bits = [];
  const ccb = ccBitsByte(version);
  pushBits(bits, 0x4, 4);
  pushBits(bits, bytes.length, ccb);
  for (const b of bytes) pushBits(bits, b, 8);

  const maxDataBits = dataCodewords * 8;
  const remain = maxDataBits - bits.length;
  if (remain < 0) {
    throw new QrInputTooLongError(bytes.length, Math.floor((maxDataBits - 4 - ccb) / 8), maxVersion, eccLevel);
  }
  pushBits(bits, 0, Math.min(4, Math.max(remain, 0)));
  while (bits.length % 8 !== 0) pushBits(bits, 0, 1);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bitSliceToByte(bits, i));
  const pad = [0xec, 0x11];
  for (let i = 0; data.length < dataCodewords; i++) data.push(pad[i & 1]);

  // --- Split into blocks and compute RS ---
  const blocksArr = [];
  let p = 0;
  for (const g of blocks) {
    for (let k = 0; k < g.count; k++) {
      const chunk = data.slice(p, p + g.data);
      p += g.data;
      blocksArr.push({ data: chunk, ec: rsCompute(chunk, ecPerBlock) });
    }
  }

  // --- Interleave data and EC codewords ---
  const interleaved = [];
  const maxLen = Math.max(...blocksArr.map(b => b.data.length));
  for (let i = 0; i < maxLen; i++) {
    for (const b of blocksArr) if (i < b.data.length) interleaved.push(b.data[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const b of blocksArr) interleaved.push(b.ec[i]);
  }

  const finalBits = bytesToBits(interleaved);
  const rem = remainderBits(version);
  for (let i = 0; i < rem; i++) finalBits.push(0);

  // --- Place modules (flat Uint8Array, 0xFF = empty) ---
  const modules = new Uint8Array(size * size).fill(0xFF);
  placeFunctionPatterns(modules, size, version);

  // --- Build function mask (based on placed function patterns) ---
  const functionMask = buildFunctionMask(size, version);

  placeDataBits(modules, size, finalBits);

  // --- Mask evaluation ---
  let bestMask = 0, bestScore = Infinity, best = null;
  for (let mask = 0; mask < 8; mask++) {
    const clone = modules.slice();
    applyMask(clone, size, mask, version);
    const score = penaltyScore(clone, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      best = clone;
    }
  }

  writeFormatInfo(best, size, eccLevelBits(eccLevel), bestMask);
  writeVersionInfo(best, size, version);

  // Replace any remaining sentinels (just in case)
  for (let i = 0; i < best.length; i++) if (best[i] === 0xFF) best[i] = 0;

  return { version, size, modules: best, functionMask, eccLevel };
}

export function getModule(model, x, y) {
  return model.modules[y * model.size + x];
}

export function isFunctionModule(model, x, y) {
  return model.functionMask[y * model.size + x] === 1;
}

// ---------- Version tables ----------

const EC_TABLE = {
  L: {
    1: { ecPerBlock: 7, blocks: [{ count: 1, data: 19 }] },
    2: { ecPerBlock: 10, blocks: [{ count: 1, data: 34 }] },
    3: { ecPerBlock: 15, blocks: [{ count: 1, data: 55 }] },
    4: { ecPerBlock: 20, blocks: [{ count: 1, data: 80 }] },
    5: { ecPerBlock: 26, blocks: [{ count: 1, data: 108 }] },
    6: { ecPerBlock: 18, blocks: [{ count: 2, data: 68 }] },
    7: { ecPerBlock: 20, blocks: [{ count: 2, data: 78 }] },
    8: { ecPerBlock: 24, blocks: [{ count: 2, data: 97 }] },
    9: { ecPerBlock: 30, blocks: [{ count: 2, data: 116 }] },
    10: { ecPerBlock: 18, blocks: [{ count: 2, data: 68 }, { count: 2, data: 69 }] },
    11: { ecPerBlock: 20, blocks: [{ count: 4, data: 81 }] },
    12: { ecPerBlock: 24, blocks: [{ count: 2, data: 92 }, { count: 2, data: 93 }] },
  },
  M: {
    1: { ecPerBlock: 10, blocks: [{ count: 1, data: 16 }] },
    2: { ecPerBlock: 16, blocks: [{ count: 1, data: 28 }] },
    3: { ecPerBlock: 26, blocks: [{ count: 1, data: 44 }] },
    4: { ecPerBlock: 18, blocks: [{ count: 2, data: 32 }] },
    5: { ecPerBlock: 24, blocks: [{ count: 2, data: 43 }] },
    6: { ecPerBlock: 16, blocks: [{ count: 4, data: 27 }] },
    7: { ecPerBlock: 18, blocks: [{ count: 4, data: 31 }] },
    8: { ecPerBlock: 22, blocks: [{ count: 2, data: 38 }, { count: 2, data: 39 }] },
    9: { ecPerBlock: 22, blocks: [{ count: 3, data: 36 }, { count: 2, data: 37 }] },
    10: { ecPerBlock: 26, blocks: [{ count: 4, data: 43 }, { count: 1, data: 44 }] },
    11: { ecPerBlock: 30, blocks: [{ count: 1, data: 50 }, { count: 4, data: 51 }] },
    12: { ecPerBlock: 22, blocks: [{ count: 6, data: 36 }, { count: 2, data: 37 }] },
  },
};

function remainderBits(v) {
  if (v === 1) return 0;
  if (v >= 2 && v <= 6) return 7;
  if (v >= 7 && v <= 13) return 0;
  if (v >= 14 && v <= 20) return 3;
  if (v >= 21 && v <= 27) return 4;
  if (v >= 28 && v <= 34) return 3;
  return 0;
}

function pickVersion(byteLen, eccLevel, maxVersion) {
  let maxCap = 0;
  for (let v = 1; v <= maxVersion; v++) {
    const row = EC_TABLE[eccLevel]?.[v];
    if (!row) continue;
    const dataCW = row.blocks.reduce((s, g) => s + g.count * g.data, 0);
    const header = 4 + ccBitsByte(v);
    const cap = Math.floor((dataCW * 8 - header - 4) / 8);
    maxCap = Math.max(maxCap, cap);
    if (header + byteLen * 8 + 4 <= dataCW * 8) {
      return {
        version: v,
        size: 17 + 4 * v,
        dataCodewords: dataCW,
        ecPerBlock: row.ecPerBlock,
        blocks: row.blocks,
      };
    }
  }
  throw new QrInputTooLongError(byteLen, maxCap, maxVersion, eccLevel);
}

function ccBitsByte(version) { return version <= 9 ? 8 : 16; }

// ---------- Matrix helpers ----------

function setMod(M, size, x, y, dark) {
  if (x >= 0 && x < size && y >= 0 && y < size) M[y * size + x] = dark ? 1 : 0;
}

function setReserve(M, size, x, y) {
  if (x >= 0 && x < size && y >= 0 && y < size && M[y * size + x] === 0xFF)
    M[y * size + x] = 0;
}

function placeFinder(M, size, x, y) {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const outer = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const inner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      setMod(M, size, x + dx, y + dy, outer || inner);
    }
  }
  for (let i = -1; i <= 7; i++) {
    setReserve(M, size, x - 1, y + i);
    setReserve(M, size, x + 7, y + i);
    setReserve(M, size, x + i, y - 1);
    setReserve(M, size, x + i, y + 7);
  }
}

function placeAlignment(M, size, x, y) {
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      const dark = (dx === 0 || dx === 4 || dy === 0 || dy === 4) || (dx === 2 && dy === 2);
      setMod(M, size, x + dx, y + dy, dark);
    }
  }
}

const ALIGNMENT = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
  11: [6, 30, 54],
  12: [6, 32, 58],
};

function placeFunctionPatterns(M, size, version) {
  placeFinder(M, size, 0, 0);
  placeFinder(M, size, size - 7, 0);
  placeFinder(M, size, 0, size - 7);

  for (let i = 8; i < size - 8; i++) {
    setMod(M, size, 6, i, i % 2 === 0);
    setMod(M, size, i, 6, i % 2 === 0);
  }

  if (version >= 2) {
    const centers = ALIGNMENT[version] || [];
    for (const cy of centers) {
      for (const cx of centers) {
        if ((cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9)) continue;
        placeAlignment(M, size, cx - 2, cy - 2);
      }
    }
  }

  setMod(M, size, 8, 4 * version + 9, 1);

  // Reserve format areas
  for (let i = 0; i < 9; i++) {
    setReserve(M, size, 8, i);
    setReserve(M, size, i, 8);
  }
  for (let i = 0; i < 8; i++) {
    setReserve(M, size, 8, size - 1 - i);
    setReserve(M, size, size - 1 - i, 8);
  }

  if (version >= 7) {
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 3; x++)
        setReserve(M, size, size - 11 + x, y);
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 6; x++)
        setReserve(M, size, x, size - 11 + y);
  }
}

function placeDataBits(M, size, dataBits) {
  let bitIdx = 0;
  let upward = true;
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x--;
    for (let yOff = 0; yOff < size; yOff++) {
      const y = upward ? size - 1 - yOff : yOff;
      for (let dx = 0; dx < 2; dx++) {
        const xx = x - dx;
        const i = y * size + xx;
        if (M[i] !== 0xFF) continue;
        M[i] = bitIdx < dataBits.length ? (dataBits[bitIdx++] ? 1 : 0) : 0;
      }
    }
    upward = !upward;
  }
}

// Build function mask on the fly (same logic as placeFunctionPatterns, but only marks)
function buildFunctionMask(size, version) {
  const mask = new Uint8Array(size * size).fill(0);
  const mark = (x0, y0, w, h) => {
    for (let y = Math.max(0, y0); y < Math.min(size, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(size, x0 + w); x++)
        mask[y * size + x] = 1;
  };
  // Finder patterns + separators (mark whole 9x9 areas)
  mark(-1, -1, 9, 9);
  mark(size - 8, -1, 9, 9);
  mark(-1, size - 8, 9, 9);
  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    mask[6 * size + i] = 1;
    mask[i * size + 6] = 1;
  }
  // Dark module
  mask[(4 * version + 9) * size + 8] = 1;
  // Alignment patterns (v>=2)
  if (version >= 2) {
    const centers = ALIGNMENT[version] || [];
    for (const cy of centers) {
      for (const cx of centers) {
        if ((cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9)) continue;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            mask[(cy + dy) * size + (cx + dx)] = 1;
      }
    }
  }
  // Format areas
  for (let i = 0; i < 9; i++) {
    mask[8 * size + i] = 1;
    mask[i * size + 8] = 1;
  }
  for (let i = 0; i < 8; i++) {
    mask[8 * size + (size - 1 - i)] = 1;
    mask[(size - 1 - i) * size + 8] = 1;
  }
  // Version info (v>=7)
  if (version >= 7) {
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 3; x++)
        mask[y * size + (size - 11 + x)] = 1;
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 6; x++)
        mask[(size - 11 + y) * size + x] = 1;
  }
  return mask;
}

function applyMask(M, size, maskId, version) {
  const funcMask = buildFunctionMask(size, version);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!funcMask[i] && maskFn(maskId, x, y)) {
        M[i] ^= 1;
      }
    }
  }
}

function maskFn(id, x, y) {
  switch (id) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return false;
  }
}

function penaltyScore(M, size) {
  let score = 0;
  const lp = (arr) => {
    let s = 0, run = arr[0], len = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === run) len++;
      else {
        if (len >= 5) s += 3 + (len - 5);
        run = arr[i];
        len = 1;
      }
    }
    if (len >= 5) s += 3 + (len - 5);
    return s;
  };
  const row = new Uint8Array(size);
  const col = new Uint8Array(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) row[x] = M[y * size + x];
    score += lp(row);
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) col[y] = M[y * size + x];
    score += lp(col);
  }
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = M[y * size + x] + M[y * size + x + 1] + M[(y + 1) * size + x] + M[(y + 1) * size + x + 1];
      if (c === 0 || c === 4) score += 3;
    }
  }
  const pat = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const hasPat = (arr) => {
    for (let i = 0; i <= arr.length - pat.length; i++) {
      let ok = true;
      for (let j = 0; j < pat.length; j++) if (arr[i + j] !== pat[j]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) row[x] = M[y * size + x];
    if (hasPat(row)) score += 40;
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) col[y] = M[y * size + x];
    if (hasPat(col)) score += 40;
  }
  let black = 0;
  for (let i = 0; i < M.length; i++) if (M[i]) black++;
  const pct = (black * 100) / M.length;
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

function eccLevelBits(l) {
  return l === 'L' ? 1 : l === 'M' ? 0 : l === 'Q' ? 3 : 2;
}

function formatBCH(d) {
  let v = d << 10;
  const gp = 0x537;
  for (let i = 14; i >= 10; i--) if ((v >> i) & 1) v ^= gp << (i - 10);
  return v & 0x3ff;
}

function writeFormatInfo(M, size, ecc2, maskId) {
  const data = (ecc2 << 3) | (maskId & 7);
  const bch = formatBCH(data);
  const val = ((data << 10) | bch) ^ 0x5412;

  const setBit = (x, y, bit) => { M[y * size + x] = bit ? 1 : 0; };

  for (let i = 0; i < 6; i++) {
    setBit(8, i, (val >> i) & 1);
    setBit(i, 8, (val >> i) & 1);
  }
  setBit(8, 7, (val >> 6) & 1);
  setBit(8, 8, (val >> 7) & 1);
  setBit(7, 8, (val >> 8) & 1);
  for (let i = 9; i < 15; i++) {
    setBit(14 - i, 8, (val >> i) & 1);
  }
  for (let i = 0; i < 8; i++) {
    setBit(size - 1 - i, 8, (val >> i) & 1);
  }
  for (let i = 8; i < 15; i++) {
    setBit(8, size - 15 + i, (val >> i) & 1);
  }
}

function versionBCH(ver) {
  let v = (ver & 0x3f) << 12;
  const gp = 0x1f25;
  for (let i = 17; i >= 12; i--) if ((v >> i) & 1) v ^= gp << (i - 12);
  return v & 0xfff;
}

function writeVersionInfo(M, size, version) {
  if (version < 7) return;
  const bits = ((version & 0x3f) << 12) | versionBCH(version & 0x3f);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 6; x++) {
      const idx = y + 3 * x;
      M[(size - 11 + y) * size + x] = (bits >> idx) & 1;
    }
  }
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 3; x++) {
      const idx = y * 3 + x;
      M[y * size + (size - 11 + x)] = (bits >> idx) & 1;
    }
  }
}

// ---------- Bit/byte utilities ----------

function pushBits(bits, val, len) {
  for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
}
function bitSliceToByte(bits, i) {
  let v = 0;
  for (let b = 0; b < 8; b++) v = (v << 1) | (bits[i + b] || 0);
  return v & 0xff;
}
function bytesToBits(arr) {
  const out = [];
  for (const b of arr) pushBits(out, b, 8);
  return out;
}
function utf8Encode(str) {
  const enc = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) enc.push(c);
    else if (c < 0x800) enc.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff) {
      const hi = c, lo = str.charCodeAt(++i);
      const cp = (hi - 0xd800) * 0x400 + (lo - 0xdc00) + 0x10000;
      enc.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      enc.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return enc;
}

// ---------- GF(256) and Reed-Solomon ----------

const GF = (() => {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  return {
    exp,
    log,
    mul: (a, b) => (a && b ? exp[log[a] + log[b]] : 0),
  };
})();

function rsGeneratorPoly(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= GF.mul(poly[j], 1);
      next[j + 1] ^= GF.mul(poly[j], GF.exp[i]);
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Array(ecCount).fill(0);
  for (const d of data) {
    const f = d ^ res[0];
    for (let i = 0; i < ecCount - 1; i++) res[i] = res[i + 1];
    res[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      res[j] ^= GF.mul(gen[j + 1], f);
    }
  }
  return res;
}