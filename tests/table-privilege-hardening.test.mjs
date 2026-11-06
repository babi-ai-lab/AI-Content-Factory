import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("existing public tables revoke table-wide privileges from end users", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20261106191204_revoke_excess_authenticated_table_privileges.sql", import.meta.url),
    "utf8"
  );

  assert.match(migration, /REVOKE\s+TRUNCATE,\s*REFERENCES,\s*TRIGGER\s+ON ALL TABLES IN SCHEMA public\s+FROM anon, authenticated/i);
});

test("future public tables revoke excess privileges by default", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20261106191212_tighten_default_table_privileges_postgres.sql", import.meta.url),
    "utf8"
  );

  assert.match(migration, /ALTER DEFAULT PRIVILEGES IN SCHEMA public\s+REVOKE\s+TRUNCATE,\s*REFERENCES,\s*TRIGGER\s+ON TABLES\s+FROM anon, authenticated/i);
});
