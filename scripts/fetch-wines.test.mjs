import test from "node:test";
import assert from "node:assert/strict";
import { toRecord, pickPrice } from "./fetch-wines.mjs";

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
