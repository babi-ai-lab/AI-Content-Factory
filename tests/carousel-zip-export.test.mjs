import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("carousel studio exports composed Persian slides together as a ZIP", async () => {
  const source = await readFile(new URL("../components/media-studio.tsx", import.meta.url), "utf8");
  assert.match(source, /createZipStore/);
  assert.match(source, /downloadCarouselZip/);
  assert.match(source, /application\/zip/);
  assert.match(source, /دانلود همه .*اسلاید \(ZIP\)/);
  assert.match(source, /document\.fonts\.ready/);
  assert.match(source, /renderCarouselSlidePng/);
  assert.match(source, /new Uint8Array\(await blob\.arrayBuffer\(\)\)/);
});
