import test from "node:test";
import assert from "node:assert/strict";
import { createZipStore } from "../lib/zip-store.mjs";

test("creates a valid uncompressed ZIP archive with UTF-8 filenames", () => {
  const filename = "اسلاید-۱.png";
  const payload = new Uint8Array([1, 2, 3]);
  const archive = createZipStore([{ name: filename, data: payload }]);
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();

  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(6, true), 0x0800);
  assert.equal(view.getUint16(8, true), 0);
  assert.equal(view.getUint32(14, true), 0x55bc801d);
  assert.equal(view.getUint32(18, true), payload.byteLength);

  const nameLength = view.getUint16(26, true);
  assert.equal(decoder.decode(archive.slice(30, 30 + nameLength)), filename);
  assert.deepEqual([...archive.slice(30 + nameLength, 30 + nameLength + payload.length)], [...payload]);

  const endOffset = archive.length - 22;
  assert.equal(view.getUint32(endOffset, true), 0x06054b50);
  assert.equal(view.getUint16(endOffset + 8, true), 1);
  assert.equal(view.getUint16(endOffset + 10, true), 1);
});

test("rejects empty archives and duplicate file names", () => {
  assert.throws(() => createZipStore([]), /at least one file/);
  assert.throws(() => createZipStore([
    { name: "slide.png", data: new Uint8Array([1]) },
    { name: "slide.png", data: new Uint8Array([2]) },
  ]), /unique/);
});
