import test from "node:test";
import assert from "node:assert/strict";
import { canAddBrandProfile, createBrandProfileEntry, normalizeBrandProfileEntries } from "../lib/brand-profiles.mjs";

test("migrates legacy single brand into a default profile", () => {
  const legacy = { brandName: "آفتاب", voice: "حرفه‌ای" };
  const entries = normalizeBrandProfileEntries(null, legacy);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "آفتاب");
  assert.deepEqual(entries[0].profile, legacy);
});

test("normalizes, bounds, and de-duplicates brand entries", () => {
  const entries = normalizeBrandProfileEntries([
    { id: "brand-1", name: " اول ", profile: { brandName: "اول" } },
    { id: "brand-1", name: "تکراری", profile: {} },
    { id: "brand-2", name: "دوم", profile: {} },
    null,
  ]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, "اول");
  assert.equal(entries[1].id, "brand-2");
});

test("caps profiles at ten and validates new profile identifiers", () => {
  const profiles = Array.from({ length: 12 }, (_, index) => ({ id: `b-${index}`, name: `B${index}`, profile: {} }));
  assert.equal(normalizeBrandProfileEntries(profiles).length, 10);
  assert.equal(canAddBrandProfile(9), true);
  assert.equal(canAddBrandProfile(10), false);
  assert.equal(createBrandProfileEntry("brand-new", 2, {}).name, "برند جدید 2");
  assert.throws(() => createBrandProfileEntry("bad id", 2, {}));
  assert.throws(() => createBrandProfileEntry("valid", 11, {}));
});
