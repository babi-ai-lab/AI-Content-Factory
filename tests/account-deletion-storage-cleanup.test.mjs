import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("account deletion removes private user media before deleting the auth user", async () => {
  const source = await readFile(new URL("../supabase/functions/delete-account/index.ts", import.meta.url), "utf8");
  assert.match(source, /removeUserStorageFiles/);
  assert.match(source, /generated-media/);
  assert.match(source, /instagram-media/);
  assert.match(source, /\.list\(prefix/);
  assert.match(source, /\.remove\(paths\.slice/);
  assert.ok(source.indexOf("removeUserStorageFiles(adminClient, user.id)") < source.indexOf("auth.admin.deleteUser(user.id)"));
  assert.match(source, /Account files could not be fully removed/);
});
