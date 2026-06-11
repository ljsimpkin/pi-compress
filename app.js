// πfs UI — compress text into a position inside π, decompress it back out.
//
// Model: π's fractional part is an infinite hex stream (a byte = 2 hex digits).
//   compress: find the text's hex inside the precomputed buffer.
//     - whole-string hit  -> single token  index:len
//     - not found          -> per-byte fallback (always succeeds): one token/byte
//   decompress: read len*2 hex digits at index (from buffer, or via BBP if
//     the index lands beyond the buffer), then hex -> UTF-8 text.

let PI = "";            // precomputed fractional hex digits of π
let PI_READY = false;

const enc = new TextEncoder();
const dec = new TextDecoder();

const $ = (id) => document.getElementById(id);

function textToHex(text) {
  return [...enc.encode(text)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToText(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return dec.decode(bytes);
}

// hex digits of π at [start, start+count): buffer if in range, else BBP.
function piSlice(start, count) {
  if (PI_READY && start + count <= PI.length) return PI.substr(start, count);
  return piHexDigits(start, count); // from bbp.js — unbounded
}

// ---- compress ---------------------------------------------------------------

function compress(text) {
  const hex = textToHex(text);
  const nBytes = hex.length / 2;
  if (nBytes === 0) return { kind: "empty" };

  const idx = PI_READY ? PI.indexOf(hex) : -1;
  if (idx >= 0) {
    return { kind: "single", hex, tokens: [{ index: idx, len: nBytes }] };
  }

  // per-byte fallback — every byte value appears early in π, so always hits
  const tokens = [];
  for (let i = 0; i < nBytes; i++) {
    const bh = hex.substr(i * 2, 2);
    let at = PI_READY ? PI.indexOf(bh) : -1;
    if (at < 0) at = bruteFindByte(bh); // safety: scan via BBP
    tokens.push({ index: at, len: 1 });
  }
  return { kind: "perbyte", hex, tokens };
}

function bruteFindByte(bh) {
  for (let i = 0; i < 100000; i++) if (piHexDigits(i, 2) === bh) return i;
  return 0;
}

function tokenString(tokens) {
  return tokens.map((t) => `${t.index}:${t.len}`).join(",");
}

// rough stored size: bytes needed for each (index, len) pair
function storedBytes(tokens) {
  let bits = 0;
  for (const t of tokens) {
    bits += Math.max(8, Math.ceil(Math.log2(t.index + 1)));
    bits += Math.max(8, Math.ceil(Math.log2(t.len + 1)));
  }
  return Math.ceil(bits / 8);
}

function renderCompress(text) {
  const r = compress(text);
  const out = $("cout");
  if (r.kind === "empty") { out.innerHTML = '<span class="meta">Type something first.</span>'; return; }

  const orig = enc.encode(text).length;
  const stored = storedBytes(r.tokens);
  const ratio = (1 - stored / orig) * 100;
  const ratioCls = ratio >= 0 ? "ratio-good" : "ratio-bad";
  const ratioTxt = `${ratio >= 0 ? "" : "+"}${(-ratio).toFixed(0)}% size`;
  const tok = tokenString(r.tokens);

  let html = `<span class="token" title="click to copy" data-tok="${tok}">π:${tok}</span>`;
  html += `<div class="meta">original <b>${orig}</b> B → stored ~<b>${stored}</b> B · ` +
          `<span class="${ratioCls}">${ratio >= 0 ? "−" : ""}${Math.abs(ratio).toFixed(0)}% ` +
          `${ratio >= 0 ? "smaller 🎉" : "bigger 😅"}</span></div>`;

  if (r.kind === "single") {
    html += `<div class="note">Whole string located at hex offset ` +
            `<code>${r.tokens[0].index.toLocaleString()}</code> in π — a single index reconstructs it.</div>`;
    highlight(r.tokens[0].index, r.tokens[0].len * 2);
  } else {
    html += `<div class="note">Not found as one sequence in the first ${PI.length.toLocaleString()} digits — ` +
            `that's expected: an <i>n</i>-byte string first appears around offset 256<sup>n</sup>. ` +
            `Fell back to locating each byte individually.</div>`;
    html += `<div class="bytelist">` + r.tokens.map((t, i) =>
      `<span style="color:var(--pi)">${text[i] ?? "·"}</span>=π:${t.index}:1`).join(" &nbsp; ") + `</div>`;
    highlight(r.tokens[0].index, 2);
  }
  out.innerHTML = html;

  // sync the decompress side for an easy round-trip
  $("dtoken").value = `π:${tok}`;
}

// ---- decompress -------------------------------------------------------------

function parseTokens(str) {
  str = str.trim().replace(/^π:/i, "");
  const parts = str.split(/[,\s]+/).filter(Boolean);
  const toks = [];
  for (const p of parts) {
    const m = p.replace(/^π:/i, "").match(/^(\d+):(\d+)$/);
    if (!m) return null;
    toks.push({ index: +m[1], len: +m[2] });
  }
  return toks.length ? toks : null;
}

function decompress(tokens) {
  let hex = "";
  for (const t of tokens) hex += piSlice(t.index, t.len * 2);
  return hexToText(hex);
}

function renderDecompress() {
  const out = $("dout");
  let tokens = parseTokens($("dtoken").value);
  if (!tokens) {
    const i = parseInt($("dindex").value, 10);
    const l = parseInt($("dlen").value, 10);
    if (Number.isFinite(i) && Number.isFinite(l)) tokens = [{ index: i, len: l }];
  }
  if (!tokens) { out.innerHTML = '<span class="meta">Enter a token like <code>π:5:2</code>.</span>'; return; }

  try {
    const text = decompress(tokens);
    out.innerHTML = `<div class="result-text">${escapeHtml(text)}</div>` +
      `<div class="meta">${tokens.length} index${tokens.length > 1 ? "es" : ""} · ` +
      `${tokens.reduce((a, t) => a + t.len, 0)} bytes reconstructed from π</div>`;
    highlight(tokens[0].index, tokens[0].len * 2);
  } catch (e) {
    out.innerHTML = `<span class="meta" style="color:var(--bad)">Could not reconstruct: ${e.message}</span>`;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

// ---- π viewer ---------------------------------------------------------------

const VIEW = 240; // digits shown
function highlight(index, lenHex) {
  const stream = $("digitstream");
  // center the window on the hit when possible
  let start = Math.max(0, index - Math.floor((VIEW - lenHex) / 2));
  const before = piSlice(start, index - start);
  const hit = piSlice(index, lenHex);
  const afterStart = index + lenHex;
  const after = piSlice(afterStart, Math.max(0, VIEW - (index - start) - lenHex));
  const prefix = start > 0 ? "…" : "";
  stream.innerHTML = `${prefix}${esc(before)}<mark>${esc(hit)}</mark>${esc(after)}…`;
  $("status").textContent =
    `offset ${index.toLocaleString()} · ${lenHex} hex digits (${lenHex / 2} bytes) highlighted` +
    (afterStart > PI.length ? " · computed live via BBP" : "");
}
function esc(s) { return s.replace(/</g, "&lt;"); }

function showInitial() {
  const stream = $("digitstream");
  stream.textContent = (PI_READY ? PI.substr(0, VIEW) : piHexDigits(0, VIEW)) + "…";
}

// ---- boot -------------------------------------------------------------------

async function loadPi() {
  try {
    const res = await fetch("pi-hex.txt");
    if (!res.ok) throw new Error("buffer not found");
    PI = (await res.text()).trim();
    PI_READY = true;
    $("status").textContent = `π loaded · ${PI.length.toLocaleString()} hex digits in the search buffer`;
  } catch (e) {
    PI_READY = false;
    $("status").innerHTML = `<span style="color:var(--bad)">π buffer missing</span> — ` +
      `compression search disabled; decompression still works live via BBP.`;
  }
  showInitial();
}

$("cbtn").addEventListener("click", () => {
  if (!PI_READY) { $("cout").innerHTML = '<span class="meta" style="color:var(--bad)">π buffer still loading…</span>'; return; }
  renderCompress($("ctext").value);
});
$("dbtn").addEventListener("click", renderDecompress);
$("ctext").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) renderCompress($("ctext").value); });

// copy that works in non-secure contexts too (http:// on the LAN).
// navigator.clipboard is undefined outside HTTPS/localhost, so fall back
// to a hidden textarea + execCommand.
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => legacyCopy(text));
  }
  return Promise.resolve(legacyCopy(text));
}
function legacyCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

// click-to-copy tokens
$("cout").addEventListener("click", (e) => {
  const t = e.target.closest(".token");
  if (!t) return;
  copyText(`π:${t.dataset.tok}`).then((ok) => {
    const old = t.textContent;
    t.textContent = ok ? "copied ✓" : "press ⌘/Ctrl+C";
    setTimeout(() => (t.textContent = old), 1100);
  });
});

loadPi();
