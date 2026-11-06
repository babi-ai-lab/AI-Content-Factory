import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("account deletion removes only the user's private media before deleting the auth user", async () => {
  const source = await readFile(new URL("../supabase/functions/delete-account/index.ts", import.meta.url), "utf8");

  assert.match(source, /for \(const bucket of \["generated-media", "instagram-media"\]\)/);
  assert.match(source, /await walk\(userId\)/);
  assert.match(source, /\.list\(prefix/);
  assert.match(source, /if \(entry\.id !== null\) paths\.push\(path\)/);
  assert.match(source, /else await walk\(path\)/);
  assert.match(source, /paths\.slice\(offset, offset \+ 100\)/);
  assert.match(source, /\.remove\(paths\.slice/);
  assert.ok(source.indexOf("removeUserStorageFiles(adminClient, user.id)") < source.indexOf("auth.admin.deleteUser(user.id)"));
  assert.match(source, /Account files could not be fully removed/);
});
