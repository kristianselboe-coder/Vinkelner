import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../engine.js", import.meta.url), "utf8"), ctx);
const map = ctx.window.VKE.mapProduct;

test("mapper hvitvin til laks og skalldyr", () => {
  const w = map({
    id: "1001",
    name: "Husets Hvit",
    producer: "Testhus",
    country: "Frankrike",
    district: "Loire",
    type: "Hvitvin",
    grapes: ["Sauvignon blanc"],
    volume: 0.75,
    alcohol: 12.5,
    price: 189.9,
    colour: "Lys gul.",
    smell: "Sitrus.",
    taste: "Frisk og tørr.",
    pairing: ["Laks", "Skalldyr"],
    sweetness: 2,
    fullness: 5,
    image: "https://bilder.vinmonopolet.no/cache/300x300-0/1001-1.jpg",
    url: "https://www.vinmonopolet.no/p/1001"
  });
  assert.equal(w.type, "H");
  assert.equal(w.live, true);
  assert.equal(w.quip, "");
  assert.ok(w.tags.includes("laks"));
  assert.ok(w.tags.includes("skalldyr"));
  assert.equal(w.price, 189.9);
  assert.equal(w.region, "Loire");
  assert.equal(w.grape, "Sauvignon blanc");
  assert.ok(w.sweet <= 1);
  assert.ok(w.body >= 1 && w.body <= 3);
});

test("rødvin og storfe blir biff, søtvin får dessert", () => {
  const red = map({ id: "2", name: "Rød", type: "Rødvin", price: 199, pairing: ["Storfe"], fullness: 11, sweetness: 1, grapes: ["Pinot noir"] });
  assert.equal(red.type, "R");
  assert.ok(red.tags.includes("biff"));
  assert.equal(red.body, 5);
  const sweet = map({ id: "3", name: "Søt", type: "Sterkvin", price: 249, colour: "Dyp rød.", sweetness: 12, pairing: [] });
  assert.equal(sweet.type, "R");
  assert.equal(sweet.sweet, 5);
  assert.ok(sweet.tags.includes("dessert"));
});

test("engelsk typenavn fra JSON blir rødvin", () => {
  const w = map({ id: "9", name: "Red", type: "Red wine", price: 150, pairing: [], grapes: [] });
  assert.equal(w.type, "R");
});

test("dropper rad uten pris eller ukjent type", () => {
  assert.equal(map({ id: "x", name: "Øl", type: "Øl", price: 80 }), null);
  assert.equal(map({ id: "x", name: "Vin", type: "Hvitvin" }), null);
});
