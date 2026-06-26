#!/usr/bin/env node
/**
 * build-manifest.mjs
 * ------------------------------------------------------------------
 * Scaneaza folderul /reports si regenereaza data/reports.json.
 * NU editezi niciodata manifestul de mana — ruleaza acest script.
 *
 *   node scripts/build-manifest.mjs
 *
 * Cum deduce metadatele pentru fiecare raport (in ordinea prioritatii):
 *   1. Tag-uri <meta name="report:..."> din <head>-ul fisierului HTML.
 *      Daca raportul generat de skill le include, ele au prioritate.
 *   2. Fallback din structura: brand = primul folder, channel = al doilea,
 *      data = prefixul YYYY-MM-DD din numele fisierului, cadenta din config.
 *
 * Meta-taguri recunoscute (toate optionale):
 *   <meta name="report:brand"   content="adult|kids">
 *   <meta name="report:channel" content="tiktok|facebook|...">
 *   <meta name="report:cadence" content="weekly|monthly">
 *   <meta name="report:date"    content="2026-06-15">   (data raportarii)
 *   <meta name="report:period"  content="15–21 iun 2026"> (eticheta perioada)
 *   <title>...</title>          (titlul afisat in card)
 * ------------------------------------------------------------------
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REPORTS_DIR = join(ROOT, "reports");
const CONFIG_PATH = join(ROOT, "data", "config.json");
const OUT_PATH = join(ROOT, "data", "reports.json");

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));

// --- helpers -------------------------------------------------------

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.toLowerCase().endsWith(".html")) out.push(full);
  }
  return out;
}

function readMeta(html, name) {
  // <meta name="report:date" content="...">  (toleranta la ordinea atributelor)
  const re = new RegExp(
    `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']` +
      `|<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`,
    "i"
  );
  const m = html.match(re);
  return m ? (m[1] ?? m[2] ?? "").trim() : null;
}

function readTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

function fmtPeriod(dateStr, cadence) {
  // Fallback uman pentru eticheta perioadei daca raportul nu o declara.
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  const luni = ["ian","feb","mar","apr","mai","iun","iul","aug","sep","oct","nov","dec"];
  if (cadence === "monthly") return `${luni[d.getMonth()]} ${d.getFullYear()}`;
  // saptamanal: interval start..+6 zile
  const end = new Date(d); end.setDate(d.getDate() + 6);
  const sameMonth = d.getMonth() === end.getMonth();
  return sameMonth
    ? `${d.getDate()}–${end.getDate()} ${luni[d.getMonth()]} ${d.getFullYear()}`
    : `${d.getDate()} ${luni[d.getMonth()]} – ${end.getDate()} ${luni[end.getMonth()]} ${end.getFullYear()}`;
}

// --- build ---------------------------------------------------------

const files = walk(REPORTS_DIR);
const reports = [];
const warnings = [];

for (const file of files) {
  const rel = relative(ROOT, file).split("\\").join("/"); // normalizeaza Windows
  const parts = rel.split("/"); // reports / brand / channel / file.html
  const fnBrand = parts[1];
  const fnChannel = parts[2];
  const fname = basename(file, ".html");
  const dateFromName = (fname.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || null;

  const html = readFileSync(file, "utf8");

  const brand = readMeta(html, "report:brand") || fnBrand;
  const channel = readMeta(html, "report:channel") || fnChannel;
  const chCfg = config.channels[channel] || {};
  const cadence = readMeta(html, "report:cadence") || chCfg.cadence || "weekly";
  const date = readMeta(html, "report:date") || dateFromName;
  const title =
    readTitle(html) ||
    `${(config.channels[channel] || {}).label || channel} — ${(config.brands[brand] || {}).label || brand}`;

  if (!date) {
    warnings.push(`! ${rel}: lipseste data (nici meta report:date, nici prefix YYYY-MM-DD in nume). Sarit.`);
    continue;
  }
  if (!config.brands[brand]) warnings.push(`? ${rel}: brand necunoscut "${brand}"`);
  if (!config.channels[channel]) warnings.push(`? ${rel}: canal necunoscut "${channel}"`);

  const period = readMeta(html, "report:period") || fmtPeriod(date, cadence);

  reports.push({
    id: `${brand}-${channel}-${date}`,
    brand,
    channel,
    cadence,
    date,
    period_label: period,
    title,
    path: rel,
  });
}

// cele mai noi primele
reports.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const manifest = {
  generated_at: new Date().toISOString(),
  count: reports.length,
  reports,
};

writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

// data.js — varianta incarcata prin <script> ca pagina sa mearga si la dublu-click
// (file://), unde fetch() pe fisiere locale e blocat de browser.
const dataJs =
  "// Generat automat de build-manifest.mjs — NU edita manual.\n" +
  "window.__CONFIG__ = " + JSON.stringify(config) + ";\n" +
  "window.__REPORTS__ = " + JSON.stringify(manifest) + ";\n";
writeFileSync(join(ROOT, "data", "data.js"), dataJs, "utf8");

console.log(`✓ ${reports.length} rapoarte scrise in data/reports.json + data/data.js`);
if (warnings.length) {
  console.log("\nAtentionari:");
  for (const w of warnings) console.log("  " + w);
}
