import test from "node:test";
import assert from "node:assert/strict";
import { toRecord, pickPrice, schemaKeys, collect, fetchPage } from "./fetch-wines.mjs";

const today = "2026-11-04";

function wine(over = {}) {
  return {
    basic: {
      productId: "1001",
      productShortName: "Husets Hvit",
      volume: 0.75,
      alcoholContent: 12.5,
      productStatusSaleName: "Aktiv",
      ...(over.basic || {})
    },
    origins: { origin: { country: "Frankrike", region: "Loire" } },
    classification: { mainProductTypeName: "Hvitvin", subProductTypeName: "Hvitvin" },
    ingredients: { grapes: [{ grapeDesc: "Sauvignon blanc", grapePct: "100" }] },
    description: {
      characteristics: { colour: "Lys gul.", odour: "Sitrus.", taste: "Frisk og tørr." },
      fullness: "5",
      sweetness: "2",
      recommendedFood: [{ foodDesc: "Laks" }, { foodDesc: "Skalldyr" }]
    },
    assortment: { assortment: "Basisutvalget" },
    prices: [{ salesPrice: 189.9, priceValidFrom: "2024-01-01" }],
    ...over,
    basic: {
      productId: "1001",
      productShortName: "Husets Hvit",
      volume: 0.75,
      alcoholContent: 12.5,
      productStatusSaleName: "Aktiv",
      ...(over.basic || {})
    }
  };
}

test("beholder hvitvin i basisutvalget med gjeldende pris", () => {
  const rec = toRecord(wine(), today);
  assert.equal(rec.ok, true);
  assert.equal(rec.record.id, "1001");
  assert.equal(rec.record.price, 189.9);
  assert.equal(rec.record.country, "Frankrike");
  assert.equal(rec.record.district, "Loire");
  assert.deepEqual(rec.record.grapes, ["Sauvignon blanc"]);
  assert.deepEqual(rec.record.pairing, ["Laks", "Skalldyr"]);
  assert.equal(rec.record.sweetness, 2);
  assert.equal(rec.record.fullness, 5);
  assert.equal(rec.record.url, "https://www.vinmonopolet.no/p/1001");
  assert.match(rec.record.image, /1001-1\.jpg$/);
  assert.equal(rec.record.producer, "");
});

test("bruker produsentfelt bare når det finnes", () => {
  const rec = toRecord(wine({ basic: { producerName: "Testhus" } }), today);
  assert.equal(rec.record.producer, "Testhus");
});

test("forkaster øl, fruktvin, utgått, annet utvalg og vin uten pris", () => {
  assert.equal(toRecord(wine({ classification: { mainProductTypeName: "Øl", subProductTypeName: "Porter" } }), today).reason, "type");
  assert.equal(toRecord(wine({ classification: { mainProductTypeName: "Fruktvin", subProductTypeName: "Eple" } }), today).reason, "type");
  assert.equal(toRecord(wine({ basic: { productStatusSaleName: "Utgått" } }), today).reason, "status");
  assert.equal(toRecord(wine({ assortment: { assortment: "Tilleggsutvalget" } }), today).reason, "assortment");
  assert.equal(toRecord(wine({ prices: [] }), today).reason, "price");
  assert.equal(toRecord(wine({ basic: { alcoholContent: 0 } }), today).reason, "alcoholFree");
});

test("bestillingsutvalg og musserende beholdes", () => {
  const rec = toRecord(wine({
    assortment: { assortment: "Bestillingsutvalget" },
    classification: { mainProductTypeName: "Musserende vin", subProductTypeName: "Cava" }
  }), today);
  assert.equal(rec.ok, true);
  assert.equal(rec.record.type, "Musserende vin");
});

test("pickPrice ignorerer fremtidig pris", () => {
  assert.equal(pickPrice([
    { salesPrice: 100, priceValidFrom: "2020-01-01" },
    { salesPrice: 250, priceValidFrom: "2027-01-01" }
  ], today), 100);
  assert.equal(pickPrice([{ salesPrice: 80 }], today), 80);
  assert.equal(pickPrice([{ salesPrice: 80, priceValidFrom: "2027-05-01" }], today), null);
});

test("leser engelsk typenavn, kategorikode, pris og paring fra andre stier", () => {
  const rec = toRecord({
    code: "42",
    name: "Alt Navn",
    alcohol: 13,
    main_category: { code: "rodvin" },
    product_selection: "Bestillingsutvalget",
    price: { value: 99 },
    description: { foodPairing: ["Lam"] }
  }, today);
  assert.equal(rec.ok, true);
  assert.equal(rec.record.type, "Rødvin");
  assert.equal(rec.record.price, 99);
  assert.deepEqual(rec.record.pairing, ["Lam"]);
  assert.equal(rec.paths.type, "main_category.code");
  assert.equal(rec.paths.price, "price.value");
  assert.equal(rec.paths.pairing, "description.foodPairing");
  assert.equal(rec.paths.assortment, "product_selection");
});

test("classification.mainProductType uten Name-suffiks", () => {
  const rec = toRecord({
    basic: { productId: "7", productShortName: "Sparkling", alcoholContent: 12 },
    classification: { mainProductType: "Sparkling wine" },
    prices: [{ salesPrice: 220 }]
  }, today);
  assert.equal(rec.ok, true);
  assert.equal(rec.record.type, "Musserende vin");
  assert.equal(rec.paths.type, "classification.mainProductType");
  assert.equal(rec.paths.price, "prices[].salesPrice");
});

test("schemaKeys lister nøstede nøkler", () => {
  const keys = schemaKeys([{ basic: { productId: "1" }, classification: { mainProductType: "Red wine" } }]);
  assert.ok(keys.includes("basic.productId"));
  assert.ok(keys.includes("classification.mainProductType"));
});

test("fail fast etter 1000 produkter uten treff", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const page = Array.from({ length: 100 }, (_, i) => ({
      basic: { productId: String(calls * 1000 + i), productShortName: "Uten type" }
    }));
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => page };
  };
  try {
    await assert.rejects(
      () => collect("secret", today, { pauseMs: 0, failFastAfter: 1000 }),
      /Ingen viner blant de første 1000/
    );
    assert.equal(calls, 10);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("debug henter bare første side og skriver ikke", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [{ basic: { productId: "1", productShortName: "X" } }]
    };
  };
  try {
    const records = await collect("secret", today, { debug: true, pauseMs: 0 });
    assert.equal(calls, 1);
    assert.equal(records.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("tidsavbrudd prøver på nytt og feiler", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (_url, opts) => {
    calls++;
    return new Promise((_resolve, reject) => {
      const abort = () => reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
      if (opts.signal.aborted) abort();
      else opts.signal.addEventListener("abort", abort, { once: true });
    });
  };
  try {
    await assert.rejects(
      () => fetchPage(0, "secret", { timeoutMs: 40, attempts: 2, retryPauseMs: 0 }),
      /Ga opp etter 2 forsøk/
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});
