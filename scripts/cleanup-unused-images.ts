/**
 * scripts/cleanup-unused-images.ts
 *
 * Deletes images from Supabase Storage that were uploaded but never
 * linked to a tierlist, and are older than 24 hours.
 *
 * Run manually or via a scheduled job:
 *   npx tsx scripts/cleanup-unused-images.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL
 * environment variables.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "tierlist-images";
const MAX_AGE_HOURS = 24;

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

  // Find unused images older than 24 hours
  const { data: stale, error: fetchError } = await supabase
    .from("uploaded_images")
    .select("id, storage_path")
    .eq("is_used", false)
    .lt("uploaded_at", cutoff)
    .limit(200);

  if (fetchError) {
    console.error("Failed to fetch stale images:", fetchError.message);
    process.exit(1);
  }

  if (!stale || stale.length === 0) {
    console.log("No unused images to clean up.");
    return;
  }

  console.log(`Found ${stale.length} unused image(s) older than ${MAX_AGE_HOURS}h.`);

  // Delete from Storage
  const paths = stale.map((r) => r.storage_path);
  const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);

  if (storageError) {
    console.error("Storage deletion error:", storageError.message);
  } else {
    console.log(`Deleted ${paths.length} file(s) from Storage.`);
  }

  // Remove tracking rows
  const ids = stale.map((r) => r.id);
  const { error: dbError } = await supabase
    .from("uploaded_images")
    .delete()
    .in("id", ids);

  if (dbError) {
    console.error("DB cleanup error:", dbError.message);
  } else {
    console.log(`Removed ${ids.length} tracking row(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
