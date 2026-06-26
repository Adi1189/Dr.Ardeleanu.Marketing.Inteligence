/* =====================================================================
   app.js — gate de parolă + filtrare rapoarte din manifest
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. GATE DE PAROLĂ (client-side, SHA-256)
   Parola NU e stocată în clar. Aici e doar hash-ul ei.
   Parola este:  Ardeleanu123
   Ca să o schimbi: pe localhost deschide consola și rulează
     crypto.subtle.digest('SHA-256', new TextEncoder().encode('PAROLA_NOUA'))
       .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')));
   apoi pune rezultatul în PASSWORD_HASH.
--------------------------------------------------------------------- */
const PASSWORD_HASH =
  "244490295cd315a03972d03d79a81e05bfc581eb76cf3d6ae2f28236446287cd";
const SESSION_KEY = "ai_intel_ok";

async function sha256(text) {
  if (window.crypto && crypto.subtle && window.isSecureContext) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
    } catch (_) {}
  }
  return sha256js(text);
}

function sha256js(ascii) {
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  const mp = Math.pow, maxWord = mp(2, 32);
  let result = "";
  const words = [];
  const bitLen = ascii.length * 8;
  let hash = sha256js.h = sha256js.h || [];
  const k = sha256js.k = sha256js.k || [];
  let pc = k.length;
  const composite = {};
  for (let cand = 2; pc < 64; cand++) {
    if (!composite[cand]) {
      for (let i = 0; i < 313; i += cand) composite[i] = cand;
      hash[pc] = (mp(cand, 0.5) * maxWord) | 0;
      k[pc++] = (mp(cand, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while (ascii.length % 64 - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return "";
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (bitLen / maxWord) | 0;
  words[words.length] = bitLen;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const t1 = hash[7]
        + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))
          ) | 0);
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash);
      hash[4] = (hash[4] + t1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : "") + b.toString(16);
    }
  }
  return result;
}

function unlock() {
  document.getElementById("gate").hidden = true;
  document.getElementById("app").hidden = false;
  initApp();
}

function setupGate() {
  if (sessionStorage.getItem(SESSION_KEY) === "1") { unlock(); return; }
  const input = document.getElementById("gate-input");
  const btn = document.getElementById("gate-btn");
  const err = document.getElementById("gate-error");
  async function tryUnlock() {
    try {
      const hash = await sha256(input.value);
      if (hash === PASSWORD_HASH) {
        sessionStorage.setItem(SESSION_KEY, "1");
        unlock();
      } else {
        err.textContent = "Parolă greșită.";
        err.hidden = false; input.value = ""; input.focus();
      }
    } catch (e) {
      err.textContent = "Eroare la verificare. Deschide pagina prin localhost / server.";
      err.hidden = false; console.error(e);
    }
  }
  btn.addEventListener("click", tryUnlock);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
  input.focus();
}

/* ---------------------------------------------------------------------
   2. APLICAȚIA
   Datele vin din data/data.js (window.__CONFIG__ / window.__REPORTS__),
   ca să funcționeze și pe file://. Dacă lipsesc, încearcă fetch (server).
--------------------------------------------------------------------- */
let CONFIG = null;
let REPORTS = [];
const state = { brand: "", cadence: "", channel: "", search: "", month: "" };

async function initApp() {
  try {
    let manifest;
    if (window.__CONFIG__ && window.__REPORTS__) {
      CONFIG = window.__CONFIG__;
      manifest = window.__REPORTS__;
    } else {
      const [cfg, man] = await Promise.all([
        fetch("data/config.json").then((r) => r.json()),
        fetch("data/reports.json").then((r) => r.json()),
      ]);
      CONFIG = cfg; manifest = man;
    }
    REPORTS = (manifest && manifest.reports) || [];
    document.getElementById("manifest-date").textContent =
      manifest && manifest.generated_at
        ? "Actualizat " + new Date(manifest.generated_at).toLocaleDateString("ro-RO")
        : "";
    buildBrandFilter();
    buildChannelFilter();
    wireFilters();
    render();
  } catch (e) {
    document.getElementById("grid").innerHTML =
      '<p class="empty">Nu am putut încărca rapoartele. Rulează <code>node scripts/build-manifest.mjs</code> și reîncarcă.</p>';
    console.error(e);
  }
}

function buildBrandFilter() {
  const wrap = document.getElementById("f-brand");
  for (const [key, b] of Object.entries(CONFIG.brands)) {
    const btn = document.createElement("button");
    btn.className = "seg-btn";
    btn.dataset.val = key;
    btn.textContent = b.label;
    wrap.appendChild(btn);
  }
}

function buildChannelFilter() {
  const wrap = document.getElementById("f-channel");
  for (const [key, ch] of Object.entries(CONFIG.channels)) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.val = key;
    btn.textContent = ch.label;
    wrap.appendChild(btn);
  }
}

const CADENCE_LABEL = { weekly: "săptămânal", monthly: "lunar", daily: "zilnic" };

function wireFilters() {
  document.querySelectorAll(".seg").forEach((seg) => {
    const key = seg.dataset.key;
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg-btn");
      if (!btn) return;
      seg.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state[key] = btn.dataset.val;
      render();
    });
  });
  const chWrap = document.getElementById("f-channel");
  chWrap.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    chWrap.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.channel = chip.dataset.val;
    render();
  });
  document.getElementById("f-search").addEventListener("input", (e) => {
    state.search = e.target.value.toLowerCase().trim();
    render();
  });
  document.getElementById("f-month").addEventListener("input", (e) => {
    state.month = e.target.value;
    render();
  });
  document.getElementById("f-clear").addEventListener("click", () => {
    Object.assign(state, { brand: "", cadence: "", channel: "", search: "", month: "" });
    document.getElementById("f-search").value = "";
    document.getElementById("f-month").value = "";
    document.querySelectorAll(".seg").forEach((seg) => {
      seg.querySelectorAll(".seg-btn").forEach((b, i) => b.classList.toggle("active", i === 0));
    });
    document.querySelectorAll("#f-channel .chip").forEach((c, i) => c.classList.toggle("active", i === 0));
    render();
  });
}

function matches(r) {
  if (state.brand && r.brand !== state.brand) return false;
  if (state.cadence && r.cadence !== state.cadence) return false;
  if (state.channel && r.channel !== state.channel) return false;
  if (state.month && !(r.date || "").startsWith(state.month)) return false;
  if (state.search) {
    const hay = (r.title + " " + r.period_label).toLowerCase();
    if (!hay.includes(state.search)) return false;
  }
  return true;
}

function render() {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const list = REPORTS.filter(matches);

  document.getElementById("result-count").textContent =
    list.length + (list.length === 1 ? " raport" : " rapoarte");

  grid.innerHTML = "";
  empty.hidden = list.length !== 0;

  for (const r of list) {
    const ch = (CONFIG.channels[r.channel] || {});
    const brandLabel = (CONFIG.brands[r.brand] || {}).label || r.brand;
    const a = document.createElement("a");
    a.className = "card" + (r.brand === "kids" ? " brand-kids" : "");
    a.href = r.path;
    a.innerHTML =
      '<div class="card-top">' +
        '<span class="badge badge-brand">' + brandLabel + '</span>' +
        '<span class="badge badge-cad">' + (CADENCE_LABEL[r.cadence] || r.cadence) + '</span>' +
      '</div>' +
      '<div class="card-channel">' + (ch.label || r.channel) + '</div>' +
      '<h3 class="card-title">' + escapeHtml(r.title) + '</h3>' +
      '<div class="card-period">' + escapeHtml(r.period_label || "") + '</div>' +
      '<div class="card-foot"><span>' + (r.date || "") + '</span><span class="open">Deschide →</span></div>';
    grid.appendChild(a);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.addEventListener("DOMContentLoaded", setupGate);
