#!/usr/bin/env node
/**
 * Henter varedata fra Vinmonopolets åpne API og skriver data/wines.json.
 *
 * Dokumentert skjema (Products API, GET /products/v0/details-normal),
 * lest fra det publiserte OpenAPI-skjemaet. Ikke verifisert mot et levende
 * svar, fordi nøkkelen ikke ligger i dette miljøet.
 *
 * Forutsetninger:
 * - Svaret er en JSON-array. Paginering: maxResults + start (hopp over
 *   produkter sortert på productId).
 * - Pris ligger i details-normal som prices[].salesPrice (number) med
 *   priceValidFrom (yyyy-MM-dd). Eget kall til /price-elements brukes ikke:
 *   det åpne produktet «Open» oppgir details-normal, ikke price-elements.
 * - Utvalg: assortment.assortment (navn). Vi beholder basisutvalg og
 *   bestillingsutvalg. Mangler feltet, beholdes varen.
 * - Vintype: classification.mainProductTypeName / subProductTypeName.
 * - Produsentnavn finnes ikke i det publiserte skjemaet. Vi leser det bare
 *   hvis et av de vanlige, udokumenterte feltene likevel er fylt ut.
 * - Ingen lagerdata. Open-abonnementet har ikke stock.
 *
 * Krever miljøvariabelen VINMONOPOLET_API_KEY.
 */
import { writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://apis.vinmonopolet.no/products/v0/details-normal";
const PAGE = 100;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "wines.json");

const WINE_TYPE = /rødvin|hvitvin|rosé|rosevin|musserende|perlende|sterkvin|søtvin|dessertvin/;
const NOT_WINE = /fruktvin|øl\b|brennevin|sider|cider|alkoholfri|alkoholsvak|aromatisert/;
const KEEP_ASSORTMENT = /basis|bestilling/;
const GONE = /utgått|expired|withdrawn|slettet|utgatt/;

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

/** Velg gjeldende salesPrice. Datoer i fremtiden brukes ikke. */
export function pickPrice(prices, today) {
  if (!Array.isArray(prices)) return null;
  const dated = [];
  const undated = [];
  for (const row of prices) {
    const n = num(row?.salesPrice);
    if (n == null || n <= 0) continue;
    const d = String(row?.priceValidFrom || "");
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) dated.push({ n, d: d.slice(0, 10) });
    else undated.push(n);
  }
  const valid = dated.filter((x) => x.d <= today).sort((a, b) => (a.d < b.d ? 1 : -1));
  if (valid.length) return valid[0].n;
  if (!dated.length && undated.length) return undated[undated.length - 1];
  return null;
}

function producerOf(product) {
  const basic = product.basic || {};
  const candidates = [
    basic.producer,
    basic.producerName,
    basic.vendorName,
    basic.manufacturerName,
    product.producer,
    product.manufacturerName
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

/**
 * @returns {{ok:true, record:object}|{ok:false, reason:string}}
 */
export function toRecord(product, today) {
  const basic = product?.basic || {};
  const id = String(basic.productId || "").trim();
  if (!id) return { ok: false, reason: "id" };

  const status = String(basic.productStatusSaleName || "");
  if (GONE.test(status.toLowerCase())) return { ok: false, reason: "status" };

  const alcohol = num(basic.alcoholContent);
  if (alcohol != null && alcohol < 0.7) return { ok: false, reason: "alcoholFree" };

  const main = String(product.classification?.mainProductTypeName || "");
  const sub = String(product.classification?.subProductTypeName || "");
  const typeBlob = (main + " " + sub).toLowerCase();
  if (NOT_WINE.test(typeBlob) || !WINE_TYPE.test(typeBlob)) return { ok: false, reason: "type" };

  const assortment = String(product.assortment?.assortment || "");
  if (assortment && !KEEP_ASSORTMENT.test(assortment.toLowerCase())) {
    return { ok: false, reason: "assortment" };
  }

  const price = pickPrice(product.prices, today);
  if (price == null) return { ok: false, reason: "price" };

  const grapes = [];
  for (const g of product.ingredients?.grapes || []) {
    const name = clip(g?.grapeDesc, 40);
    if (name && !grapes.includes(name)) grapes.push(name);
    if (grapes.length >= 6) break;
  }

  const pairing = [];
  for (const f of product.description?.recommendedFood || []) {
    const name = clip(f?.foodDesc, 40);
    if (name && !pairing.includes(name)) pairing.push(name);
    if (pairing.length >= 8) break;
  }

  const ch = product.description?.characteristics || {};
  const origin = product.origins?.origin || {};
  const name = clip(basic.productShortName || basic.productLongName, 120);
  if (!name) return { ok: false, reason: "name" };

  return {
    ok: true,
    record: {
      id,
      name,
      producer: producerOf(product),
      country: clip(origin.country, 40),
      district: clip(origin.region || origin.subRegion, 60),
      type: clip(main || sub, 40),
      grapes,
      volume: num(basic.volume),
      alcohol,
      price,
      colour: clip(ch.colour, 180),
      smell: clip(ch.odour, 180),
      taste: clip(ch.taste, 220),
      pairing,
      sweetness: sensory(product.description?.sweetness),
      fullness: sensory(product.description?.fullness),
      image: `https://bilder.vinmonopolet.no/cache/300x300-0/${encodeURIComponent(id)}-1.jpg`,
      url: `https://www.vinmonopolet.no/p/${encodeURIComponent(id)}`
    }
  };
}

async function fetchPage(start, key) {
  const url = new URL(API);
  url.searchParams.set("maxResults", String(PAGE));
  url.searchParams.set("start", String(start));
  let res;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        Accept: "application/json"
      }
    });
    if (res.status !== 429 && res.status !== 503) break;
    const wait = Number(res.headers.get("retry-after")) || 5 * attempt;
    console.error(`HTTP ${res.status} på start=${start}, forsøk ${attempt}/3, venter ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    lastErr = res.status;
  }
  if (!res || !res.ok) {
    const body = res ? await res.text() : "";
    console.error(`HTTP-feil ${res ? res.status : lastErr} fra ${url}`);
    if (body) console.error(body.slice(0, 500));
    process.exit(1);
  }
  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error("Svaret var ikke JSON:", err.message);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error("Forventet en JSON-array, fikk", data && typeof data);
    process.exit(1);
  }
  return data;
}

export async function collect(key, today = new Date().toISOString().slice(0, 10)) {
  const seen = new Set();
  const records = [];
  const dropped = { id: 0, status: 0, alcoholFree: 0, type: 0, assortment: 0, price: 0, name: 0 };
  let start = 0;
  let fetched = 0;

  for (;;) {
    const page = await fetchPage(start, key);
    if (!page.length) break;
    let fresh = 0;
    for (const product of page) {
      const id = String(product?.basic?.productId || "");
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      fresh++;
      fetched++;
      const result = toRecord(product, today);
      if (!result.ok) {
        dropped[result.reason] = (dropped[result.reason] || 0) + 1;
        continue;
      }
      records.push(result.record);
    }
    console.log(`start=${start} side=${page.length} nye=${fresh} beholdt=${records.length}`);
    if (!fresh || page.length < PAGE) break;
    start += page.length;
    if (start > 200000) {
      console.error("Pagineringen stoppet ikke. Avbryter.");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1100));
  }

  records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  console.log(`Hentet ${fetched}. Beholdt ${records.length}. Forkastet ${JSON.stringify(dropped)}.`);
  if (!fetched) {
    console.error("API-et returnerte ingen produkter.");
    process.exit(1);
  }
  if (!records.length) {
    console.error("Ingen viner igjen etter filter. Sjekk typestrenger, utvalgsnavn og prices[].salesPrice. Skriver ikke fila.");
    process.exit(1);
  }
  return records;
}

async function main() {
  const key = process.env.VINMONOPOLET_API_KEY;
  if (!key) {
    console.error("Mangler miljøvariabelen VINMONOPOLET_API_KEY.");
    process.exit(1);
  }
  const records = await collect(key);
  const body = "[\n" + records.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n";
  await mkdir(path.dirname(OUT), { recursive: true });
  const tmp = OUT + ".tmp";
  await writeFile(tmp, body);
  await rename(tmp, OUT);
  console.log(`Skrev ${records.length} viner til ${path.relative(ROOT, OUT)} (${Buffer.byteLength(body)} byte).`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
