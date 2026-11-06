import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function removeUserStorageFiles(
  adminClient: SupabaseClient,
  userId: string,
): Promise<void> {
  for (const bucket of ["generated-media", "instagram-media"]) {
    const paths: string[] = [];

    async function walk(prefix: string): Promise<void> {
      let offset = 0;
      while (true) {
        const { data, error } = await adminClient.storage.from(bucket).list(prefix, {
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) throw new Error("Could not enumerate account media.");

        const entries = data || [];
        for (const entry of entries) {
          const path = `${prefix}/${entry.name}`;
          if (entry.id) paths.push(path);
          else await walk(path);
        }

        if (entries.length < 1000) break;
        offset += entries.length;
      }
    }

    await walk(userId);
    for (let offset = 0; offset < paths.length; offset += 100) {
      const { error } = await adminClient.storage.from(bucket).remove(paths.slice(offset, offset + 100));
      if (error) throw new Error("Could not remove all account media.");
    }
  }
}
