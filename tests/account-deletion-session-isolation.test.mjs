import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../components/account-deletion-form.tsx", import.meta.url),
  "utf8"
);

test("account deletion uses an isolated Supabase auth client", () => {
  assert.match(source, /createClient\(/);
  assert.match(source, /persistSession:\s*false/);
  assert.match(source, /autoRefreshToken:\s*false/);
  assert.match(source, /detectSessionInUrl:\s*false/);
  assert.match(source, /deletionSupabase\.auth\.signInWithPassword/);
  assert.match(source, /deletionSupabase\.functions\.invoke\("delete-account"/);
});

test("account deletion never signs out the shared application client", () => {
  assert.doesNotMatch(source, /import\s*\{\s*supabase\s*\}\s*from\s*["']@\/lib\/supabase["']/);
  assert.match(source, /deletionSupabase\.auth\.signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.doesNotMatch(source, /supabase\.auth\.signOut/);
});
