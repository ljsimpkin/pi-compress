// BBP (Bailey-Borwein-Plouffe) hex-digit extraction for pi.
//
// Computes hex digits of pi's fractional part directly at an arbitrary
// position, without needing the preceding digits. Powers unbounded
// decompression even when an index falls outside the precomputed buffer.
//
// Accuracy note (same caveat as the C reference piqpr8.c): uses IEEE
// double arithmetic, reliable up to position ~1.18e7. Plenty for this demo.

// 16^p mod ak, via left-to-right binary exponentiation.
function expm(p, ak) {
  if (ak === 1) return 0;
  // largest power of two <= p
  let pt = 1;
  while (pt * 2 <= p) pt *= 2;
  let r = 1;
  let pp = p;
  while (true) {
    if (pp >= pt) {
      r = (16 * r) % ak;
      pp -= pt;
    }
    pt /= 2;
    if (pt < 1) break;
    r = (r * r) % ak;
  }
  return r;
}

// Sum_k 16^(d-k) / (8k + m), fractional part. (Standard BBP series term.)
function series(m, d) {
  let s = 0;
  for (let k = 0; k < d; k++) {
    const ak = 8 * k + m;
    const t = expm(d - k, ak);
    s += t / ak;
    s -= Math.floor(s);
  }
  for (let k = d; k <= d + 100; k++) {
    const ak = 8 * k + m;
    const term = Math.pow(16, d - k) / ak;
    if (term < 1e-17) break;
    s += term;
    s -= Math.floor(s);
  }
  return s;
}

// Return `count` hex digits of pi's fractional part starting at position
// `start` (0 = the first fractional digit, '2' in 3.243f6...).
function piHexDigits(start, count) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const id = start + i; // 0-based position into fractional hex stream
    let pid = 4 * series(1, id) - 2 * series(4, id) - series(5, id) - series(6, id);
    pid = pid - Math.floor(pid);
    if (pid < 0) pid += 1;
    const digit = Math.floor(pid * 16);
    out += digit.toString(16);
  }
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { piHexDigits, series, expm };
}
