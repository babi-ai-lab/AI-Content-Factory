import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Instagram publish job state is not writable by end-user sessions", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20261109150000_revoke_client_instagram_job_updates.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.instagram_publish_jobs\s+FROM\s+authenticated/i);
  assert.match(migration, /DROP\s+POLICY\s+IF\s+EXISTS\s+"Users can update their own Instagram publish jobs"/i);
});
