#!/usr/bin/env python3
"""Generate the first N hex digits of pi's fractional part.

Uses Chudnovsky binary-splitting to compute floor(pi * 2^bits) as a big
integer. Because the scaling factor is a power of two, the hex digits fall
straight out of format(P, 'x') with no decimal->hex base conversion.
"""
import math
import sys
import time

C = 640320
C3_OVER_24 = C ** 3 // 24


def bs(a, b):
    if b - a == 1:
        if a == 0:
            Pab = Qab = 1
        else:
            Pab = (6 * a - 5) * (2 * a - 1) * (6 * a - 1)
            Qab = a * a * a * C3_OVER_24
        Tab = Pab * (13591409 + 545140134 * a)
        if a & 1:
            Tab = -Tab
        return Pab, Qab, Tab
    m = (a + b) // 2
    Pam, Qam, Tam = bs(a, m)
    Pmb, Qmb, Tmb = bs(m, b)
    Pab = Pam * Pmb
    Qab = Qam * Qmb
    Tab = Qmb * Tam + Pam * Tmb
    return Pab, Qab, Tab


def pi_hex_digits(n_hex, guard_hex=64):
    bits = 4 * (n_hex + guard_hex)
    digits_per_term = math.log10(C3_OVER_24 / 6 / 2 / 6)  # ~14.18
    decimal_digits = bits * 0.301029995664  # log10(2)
    n_terms = int(decimal_digits / digits_per_term) + 1

    t0 = time.time()
    P, Q, T = bs(0, n_terms)
    one = 1 << bits
    sqrtC = math.isqrt(10005 * one * one)  # floor(sqrt(10005) * 2^bits)
    pi = (Q * 426880 * sqrtC) // T  # floor(pi * 2^bits)
    h = format(pi, 'x')  # '3' followed by fractional hex digits
    frac = h[1:1 + n_hex]
    print(f"computed {n_terms} terms, {bits} bits in {time.time()-t0:.1f}s",
          file=sys.stderr)
    return frac


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1_000_000
    out = sys.argv[2] if len(sys.argv) > 2 else "pi-hex.txt"
    frac = pi_hex_digits(n)
    assert frac[:13] == "243f6a8885a30", f"sanity check failed: {frac[:13]}"
    with open(out, "w") as f:
        f.write(frac)
    print(f"wrote {len(frac)} hex digits to {out}", file=sys.stderr)
