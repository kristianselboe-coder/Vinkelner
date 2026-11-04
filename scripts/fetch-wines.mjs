#!/usr/bin/env node
/**
 * Henter varedata fra Vinmonopolets åpne API og skriver data/wines.json.
 *
 * Første kjøring (69 209 produkter, HTTP 200) forkastet alt med reason "type":
 * classification.mainProductTypeName / subProductTypeName var tomme eller
 * het noe annet. Derfor leses type, pris, utvalg og matparing fra flere
 * kandidatstier, og første side logges alltid (rå JSON + nøkkeltre).
 * Nøkkelen logges aldri.
 *
 * VINMONOPOLET_DEBUG=1 henter bare første side, logger og avslutter 0
 * uten å skrive fil.
 */
import { writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://apis.vinmonopolet.no/products/v0/details-normal";
const PAGE = 100;
const FAIL_FAST_AFTER = 1000;
const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "wines.json");

const GONE = /utgatt|expired|withdrawn|slettet|discontinued/;
const NOT_WINE = /fruktvin|fruit wine|\bol\b|\bbeer\b|brennevin|\bspirit|\bsider\b|\bcider\b|alkoholfri|alkoholsvak|alcohol.free|aromatisert|aromatized/;

const TYPE_PATHS = [
  "classification.mainProductTypeName",
  "classification.mainProductType",
  "classification.subProductTypeName",
  "classification.subProductType",
  "classification.productTypeName",
  "classification.productType",
  "classification.productGroupName",
  "classification.productGroup",
  "classification.mainCategory.name",
  "classification.mainCategory.code",
  "classification.mainCategory",
  "classification.categoryName",
  "classification.category",
  "basic.mainProductTypeName",
  "basic.mainProductType",
  "basic.productTypeName",
  "basic.productType",
  "basic.mainCategory",
  "basic.categoryName",
  "basic.category",
  "basic.varetype",
  "productTypeName",
  "productType",
  "mainProductType",
  "mainCategory.name",
  "mainCategory.code",
  "mainCategory",
  "category.name",
  "category.code",
  "category",
  "main_category.name",
  "main_category.code",
  "main_category",
  "varetype"
];

const PRICE_LIST_PATHS = ["prices", "priceElements", "basic.prices"];
const ASSORT_PATHS = [
  "assortment.assortment",
  "assortment.name",
  "assortment.assortmentName",
  "assortment.description",
  "basic.assortment",
  "basic.productSelection",
  "basic.selection",
  "productSelection",
  "product_selection",
  "storeCategory"
];
const PAIR_PATHS = [
  "description.recommendedFood",
  "description.foodPairing",
  "description.suitableFor",
  "description.pairing",
  "recommendedFood",
  "foodPairing",
  "pairing",
  "basic.recommendedFood"
];
const GRAPE_PATHS = ["ingredients.grapes", "grapes", "basic.grapes", "description.grapes"];
const LABEL_KEY = /type|category|kategori|group|gruppe|varetype|sortiment|assort|selection|utvalg/i;

/** Nettstedets kategorikoder og engelske navn. Tallkoder logges, men gjettes ikke. */
const TYPE_CODES = {
  rodvin: "Rødvin",
  "rødvin": "Rødvin",
  hvitvin: "Hvitvin",
  rosevin: "Rosévin",
  "rosévin": "Rosévin",
  musserende: "Musserende vin",
  musserende_vin: "Musserende vin",
  "musserende-vin": "Musserende vin",
  perlende: "Perlende vin",
  perlende_vin: "Perlende vin",
  sterkvin: "Sterkvin",
  sotvin: "Søtvin",
  "søtvin": "Søtvin",
  fruktvin: "Fruktvin",
  "red wine": "Rødvin",
  "white wine": "Hvitvin",
  "rose wine": "Rosévin",
  "sparkling wine": "Musserende vin",
  "fortified wine": "Sterkvin",
  "dessert wine": "Søtvin",
  "sweet wine": "Søtvin",
  "fruit wine": "Fruktvin"
};

export function fold(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function clip(value, max) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export function num(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function getPath(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function textsOf(value) {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number") {
    const s = String(value).trim();
    return s ? [s] : [];
  }
  if (Array.isArray(value)) return value.flatMap(textsOf).filter(Boolean);
  if (typeof value === "object") {
    const out = [];
    for (const k of ["name", "description", "desc", "value", "text", "label", "code", "id", "foodDesc", "grapeDesc", "assortment"]) {
      if (value[k] != null && typeof value[k] !== "object") {
        const s = String(value[k]).trim();
        if (s) out.push(s);
      }
    }
    return out;
  }
  return [];
}

function canonicalFromFolded(folded) {
  if (!folded || NOT_WINE.test(folded)) return null;
  if (TYPE_CODES[folded]) {
    const label = TYPE_CODES[folded];
    return NOT_WINE.test(fold(label)) ? null : label;
  }
  if (/musserende|perlende|sparkling|champagne|cava|prosecco|cremant/.test(folded)) return "Musserende vin";
  if (/rosevin|rose wine|\brose\b/.test(folded)) return "Rosévin";
  if (/rodvin|red wine/.test(folded)) return "Rødvin";
  if (/hvitvin|white wine/.test(folded)) return "Hvitvin";
  if (/sterkvin|fortified/.test(folded)) return "Sterkvin";
  if (/sotvin|sweet wine|dessert wine|dessertvin/.test(folded)) return "Søtvin";
  return null;
}

function classifyText(text) {
  const folded = fold(text);
  if (!folded) return null;
  if (NOT_WINE.test(folded)) return { keep: false, label: String(text).trim() };
  const canon = canonicalFromFolded(folded);
  if (canon) return { keep: true, label: canon };
  return null;
}

function walkLabeled(value, keyPath, out, depth) {
  if (value == null || depth > 6) return;
  if (typeof value !== "object") {
    if (keyPath && LABEL_KEY.test(keyPath)) {
      const s = String(value).trim();
      if (s) out.push({ path: keyPath, text: s });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 8)) walkLabeled(item, keyPath, out, depth + 1);
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    const next = keyPath ? keyPath + "." + k : k;
    if (k === "basic") {
      if (v && typeof v === "object") {
        for (const [bk, bv] of Object.entries(v)) {
          if (LABEL_KEY.test(bk)) walkLabeled(bv, "basic." + bk, out, depth + 2);
        }
      }
      continue;
    }
    walkLabeled(v, next, out, depth + 1);
  }
}

export function typeCandidates(product) {
  const found = [];
  const seen = new Set();
  const push = (path, value) => {
    for (const text of textsOf(value)) {
      const sig = path + "=" + text;
      if (seen.has(sig)) continue;
      seen.add(sig);
      found.push({ path, text });
    }
  };
  for (const p of TYPE_PATHS) push(p, getPath(product, p));
  if (product?.classification) walkLabeled(product.classification, "classification", found, 0);
  walkLabeled(product, "", found, 0);
  return found;
}

export function detectType(product) {
  const candidates = typeCandidates(product);
  let blocked = null;
  for (const c of candidates) {
    const hit = classifyText(c.text);
    if (!hit) continue;
    if (hit.keep) return { ok: true, label: hit.label, path: c.path, raw: c.text };
    if (!blocked) blocked = { path: c.path, raw: c.text, label: hit.label };
  }
  if (blocked) return { ok: false, path: blocked.path, raw: blocked.raw, label: blocked.label };
  const snapshot = candidates.slice(0, 6).map((c) => c.path + "=" + c.text).join(" | ") || "(ingen typefelt)";
  return { ok: false, path: "", raw: snapshot, label: "" };
}

/** Velg gjeldende salesPrice. Datoer i fremtiden brukes ikke. */
export function pickPrice(prices, today) {
  if (!Array.isArray(prices)) return null;
  const dated = [];
  const undated = [];
  for (const row of prices) {
    if (row == null) continue;
    const n = num(typeof row === "number" ? row : row.salesPrice);
    if (n == null || n <= 0) continue;
    const d = String(row.priceValidFrom || row.validFrom || "");
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) dated.push({ n, d: d.slice(0, 10) });
    else undated.push(n);
  }
  const valid = dated.filter((x) => x.d <= today).sort((a, b) => (a.d < b.d ? 1 : -1));
  if (valid.length) return valid[0].n;
  if (!dated.length && undated.length) return undated[undated.length - 1];
  return null;
}

export function extractPrice(product, today) {
  for (const path of PRICE_LIST_PATHS) {
    const raw = getPath(product, path);
    const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : null;
    if (!list) continue;
    if (pickPrice(list, today) != null) return { price: pickPrice(list, today), path: path + "[].salesPrice" };
    const viaPrice = pickPrice(list.map((r) => (r && typeof r === "object" ? { ...r, salesPrice: r.price } : r)), today);
    if (viaPrice != null) return { price: viaPrice, path: path + "[].price" };
    const viaValue = pickPrice(list.map((r) => (r && typeof r === "object" ? { ...r, salesPrice: r.value } : r)), today);
    if (viaValue != null) return { price: viaValue, path: path + "[].value" };
  }
  const singles = [
    ["price.value", product?.price?.value],
    ["price.salesPrice", product?.price?.salesPrice],
    ["price", typeof product?.price === "number" ? product.price : null],
    ["basic.salesPrice", product?.basic?.salesPrice],
    ["salesPrice", product?.salesPrice]
  ];
  for (const [path, raw] of singles) {
    const n = num(raw);
    if (n != null && n > 0) return { price: n, path };
  }
  return null;
}

function firstLabeled(product, paths) {
  for (const p of paths) {
    const texts = textsOf(getPath(product, p));
    if (texts.length) return { path: p, texts };
  }
  return null;
}

function assortmentOf(product) {
  const hit = firstLabeled(product, ASSORT_PATHS);
  if (!hit) return { decision: "unknown", path: "", text: "" };
  const text = hit.texts[0];
  const folded = fold(text);
  if (/basis|bestilling/.test(folded)) return { decision: "keep", path: hit.path, text };
  if (/parti|testutvalg|tillegg|spesial/.test(folded)) return { decision: "drop", path: hit.path, text };
  return { decision: "unknown", path: hit.path, text };
}

function listFrom(product, paths) {
  const hit = firstLabeled(product, paths);
  if (!hit) return { path: "", items: [] };
  return { path: hit.path, items: hit.texts };
}

function producerOf(product) {
  const basic = product?.basic || {};
  const logistics = product?.logistics || {};
  const candidates = [
    basic.producer,
    basic.producerName,
    basic.vendorName,
    logistics.vendorName,
    basic.manufacturerName,
    product?.producer,
    product?.manufacturerName
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return clip(c, 80);
  }
  return "";
}

function sensory(value) {
  const n = num(value);
  if (n == null || n < 0 || n > 12) return null;
  return n;
}

function textField(product, paths) {
  for (const p of paths) {
    const t = textsOf(getPath(product, p))[0];
    if (t) return t;
  }
  return "";
}

function productIdOf(product) {
  const basic = product?.basic || {};
  const raw = basic.productId ?? basic.productID ?? product?.productId ?? product?.code ?? product?.id;
  return String(raw ?? "").trim();
}

function productNameOf(product) {
  const basic = product?.basic || {};
  return clip(basic.productShortName || basic.productLongName || basic.name || product?.name || product?.title, 120);
}

/**
 * @returns {{ok:true, record:object, paths:object}|{ok:false, reason:string, paths:object, raw?:string}}
 */
export function toRecord(product, today) {
  const paths = { type: "", price: "", assortment: "", pairing: "" };
  const id = productIdOf(product);
  if (!id) return { ok: false, reason: "id", paths };

  const status = textField(product, ["basic.productStatusSaleName", "basic.status", "status"]);
  if (status && GONE.test(fold(status))) return { ok: false, reason: "status", paths };

  const alcohol = num(getPath(product, "basic.alcoholContent") ?? product?.alcohol ?? getPath(product, "basic.abv") ?? product?.abv);
  if (alcohol != null && alcohol < 0.7) return { ok: false, reason: "alcoholFree", paths };

  const type = detectType(product);
  paths.type = type.path || "";
  if (!type.ok) return { ok: false, reason: "type", paths, raw: type.raw || "" };

  const assort = assortmentOf(product);
  paths.assortment = assort.path;
  if (assort.decision === "drop") return { ok: false, reason: "assortment", paths, raw: assort.text };

  const priceHit = extractPrice(product, today);
  if (!priceHit) return { ok: false, reason: "price", paths };
  paths.price = priceHit.path;

  const grapeHit = listFrom(product, GRAPE_PATHS);
  const grapes = [];
  for (const name of grapeHit.items) {
    const g = clip(name, 40);
    if (g && !grapes.includes(g)) grapes.push(g);
    if (grapes.length >= 6) break;
  }

  const pairHit = listFrom(product, PAIR_PATHS);
  paths.pairing = pairHit.path;
  const pairing = [];
  for (const name of pairHit.items) {
    const g = clip(name, 40);
    if (g && !pairing.includes(g)) pairing.push(g);
    if (pairing.length >= 8) break;
  }

  const name = productNameOf(product);
  if (!name) return { ok: false, reason: "name", paths };

  const origin = product?.origins?.origin || product?.origin || {};
  const country = clip(origin.country || product?.country || product?.basic?.country, 40);
  const district = clip(origin.region || origin.subRegion || product?.district || product?.region, 60);
  const desc = product?.description || {};
  const sweet = sensory(desc.sweetness ?? desc.sodme ?? product?.sweetness);
  const full = sensory(desc.fullness ?? desc.fylde ?? product?.fullness);

  return {
    ok: true,
    paths,
    record: {
      id,
      name,
      producer: producerOf(product),
      country,
      district,
      type: type.label,
      grapes,
      volume: num(product?.basic?.volume ?? product?.volume?.value ?? product?.volume),
      alcohol,
      price: priceHit.price,
      colour: clip(textField(product, ["description.characteristics.colour", "description.characteristics.color", "description.characteristics.farge", "description.colour", "colour"]), 180),
      smell: clip(textField(product, ["description.characteristics.odour", "description.characteristics.smell", "description.characteristics.aroma", "description.characteristics.lukt", "description.smell"]), 180),
      taste: clip(textField(product, ["description.characteristics.taste", "description.characteristics.smak", "description.taste"]), 220),
      pairing,
      sweetness: sweet,
      fullness: full,
      image: `https://bilder.vinmonopolet.no/cache/300x300-0/${encodeURIComponent(id)}-1.jpg`,
      url: `https://www.vinmonopolet.no/p/${encodeURIComponent(id)}`
    }
  };
}

export function schemaKeys(products) {
  const keys = new Set();
  const walk = (value, prefix, depth) => {
    if (value == null || depth > 5) return;
    if (Array.isArray(value)) {
      keys.add(prefix + "[]");
      if (value.length) walk(value[0], prefix + "[]", depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    for (const k of Object.keys(value)) {
      const next = prefix ? prefix + "." + k : k;
      keys.add(next);
      walk(value[k], next, depth + 1);
    }
  };
  for (const product of products) walk(product, "", 0);
  return [...keys].sort();
}

export function logSamples(page, key) {
  const n = Math.min(2, page.length);
  console.log(`Første side: ${page.length} produkter. Logger ${n} rå produkter og nøkkeltre.`);
  const redact = (k, v) => (typeof v === "string" && key && v.includes(key) ? "[redacted]" : v);
  for (let i = 0; i < n; i++) {
    console.log(`--- produkt ${i + 1} ---`);
    console.log(JSON.stringify(page[i], redact, 2));
  }
  console.log("--- nøkler ---");
  console.log(schemaKeys(page).join("\n"));
}

function bump(map, path) {
  if (!path) return;
  map[path] = (map[path] || 0) + 1;
}

function logDiagnostics(state) {
  console.log(`Hentet ${state.fetched}. Beholdt ${state.records.length}. Forkastet ${JSON.stringify(state.dropped)}.`);
  console.log(`Felt som traff: ${JSON.stringify(state.hits)}`);
  if (state.typeSamples.size) {
    console.log("Typefelt som ikke ble kjent igjen som vin:");
    for (const line of state.typeSamples) console.log("  " + line);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchPage(start, key, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const attempts = opts.attempts ?? ATTEMPTS;
  const retryPauseMs = opts.retryPauseMs ?? 1000;
  const url = new URL(API);
  url.searchParams.set("maxResults", String(PAGE));
  url.searchParams.set("start", String(start));
  let res;
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      res = await fetch(url, {
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          Accept: "application/json"
        },
        signal: ctrl.signal
      });
    } catch (err) {
      lastErr = err;
      console.error(`Forespørsel feilet start=${start} forsøk ${attempt}/${attempts}: ${err.name || "Error"} ${err.message}`);
      if (attempt === attempts) {
        throw new Error(`Ga opp etter ${attempts} forsøk mot ${url.pathname} (${err.name || "Error"})`);
      }
      await sleep(retryPauseMs * attempt);
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429 || res.status === 503) {
      const wait = Number(res.headers.get("retry-after")) || attempt * 5;
      console.error(`HTTP ${res.status} start=${start} forsøk ${attempt}/${attempts}, venter ${wait}s`);
      if (attempt === attempts) break;
      await sleep(Math.min(wait, 30) * 1000);
      continue;
    }
    break;
  }
  if (!res || !res.ok) {
    const body = res ? await res.text() : "";
    console.error(`HTTP-feil ${res ? res.status : lastErr?.name} fra ${url.pathname}`);
    if (body) console.error(body.slice(0, 500));
    throw new Error(`HTTP ${res ? res.status : "uten svar"} fra details-normal`);
  }
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("Svaret var ikke JSON: " + err.message);
  }
  if (!Array.isArray(data)) {
    throw new Error("Forventet en JSON-array, fikk " + (data && typeof data));
  }
  return data;
}

export async function collect(key, today = new Date().toISOString().slice(0, 10), opts = {}) {
  const debug = !!opts.debug;
  const failFastAfter = opts.failFastAfter ?? FAIL_FAST_AFTER;
  const seen = new Set();
  const records = [];
  const dropped = { id: 0, status: 0, alcoholFree: 0, type: 0, assortment: 0, price: 0, name: 0 };
  const hits = { type: {}, price: {}, assortment: {}, pairing: {} };
  const typeSamples = new Set();
  let start = 0;
  let fetched = 0;
  let first = true;

  for (;;) {
    const page = await fetchPage(start, key, opts);
    if (first) {
      logSamples(page, key);
      first = false;
    }
    if (!page.length) break;
    let fresh = 0;
    for (const product of page) {
      const id = productIdOf(product);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      fresh++;
      fetched++;
      const result = toRecord(product, today);
      if (!result.ok) {
        dropped[result.reason] = (dropped[result.reason] || 0) + 1;
        if (result.reason === "type" && result.raw && typeSamples.size < 20) typeSamples.add(result.raw);
        if (!debug && fetched >= failFastAfter && records.length === 0) {
          const state = { fetched, records, dropped, hits, typeSamples };
          logDiagnostics(state);
          throw new Error(`Ingen viner blant de første ${fetched} produktene. Avbryter uten resten av katalogen.`);
        }
        continue;
      }
      bump(hits.type, result.paths.type);
      bump(hits.price, result.paths.price);
      bump(hits.assortment, result.paths.assortment);
      bump(hits.pairing, result.paths.pairing);
      records.push(result.record);
    }
    console.log(`start=${start} side=${page.length} nye=${fresh} beholdt=${records.length}`);
    if (debug) {
      console.log("debug: avslutter etter første side uten å skrive fil.");
      logDiagnostics({ fetched, records, dropped, hits, typeSamples });
      break;
    }
    if (!fresh || page.length < PAGE) break;
    start += page.length;
    if (start > 200000) throw new Error("Pagineringen stoppet ikke. Avbryter.");
    await sleep(opts.pauseMs ?? 1100);
  }

  records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!debug) logDiagnostics({ fetched, records, dropped, hits, typeSamples });
  if (!debug && !fetched) throw new Error("API-et returnerte ingen produkter.");
  if (!debug && !records.length) {
    throw new Error("Ingen viner igjen etter filter. Skriver ikke fila.");
  }
  return records;
}

async function main() {
  const key = process.env.VINMONOPOLET_API_KEY;
  if (!key) throw new Error("Mangler miljøvariabelen VINMONOPOLET_API_KEY.");
  const debug = /^(1|true|yes)$/i.test(process.env.VINMONOPOLET_DEBUG || "");
  const records = await collect(key, undefined, { debug });
  if (debug) {
    console.log(`debug: første side ville beholdt ${records.length} vin(er). Skriver ikke fil.`);
    return;
  }
  const body = "[\n" + records.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n";
  await mkdir(path.dirname(OUT), { recursive: true });
  const tmp = OUT + ".tmp";
  await writeFile(tmp, body);
  await rename(tmp, OUT);
  console.log(`Skrev ${records.length} viner til ${path.relative(ROOT, OUT)} (${Buffer.byteLength(body)} byte).`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
