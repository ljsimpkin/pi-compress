# πfs web UI

A tiny static web app for the [πfs](https://github.com/philipl/pifs) joke: since π is believed to contain every possible sequence of digits, you don't *store* data — you just remember *where in π it lives*. Type text to "compress" it into a `π:index:length` token (found inside a precomputed buffer of 1,000,000 hex digits of π, with a per-byte fallback when the whole string isn't there), then "decompress" any token back to text — reading from the buffer, or computing digits live via the BBP formula for offsets beyond it. Serve the folder with any static server (`python3 -m http.server 8000`) and open `index.html`.

## Credits

All credit for the original idea and implementation goes to **Philip Langdale** and the **[philipl/pifs](https://github.com/philipl/pifs)** project — this is just a small web UI built on top of that concept. The hex-digit extraction is a JavaScript port of the BBP (Bailey–Borwein–Plouffe) algorithm from David H. Bailey's reference implementation (`piqpr8.c`), as used in the original πfs.
