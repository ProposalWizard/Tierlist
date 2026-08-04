/**
 * Delete Storage files that no row anywhere still points at.
 *
 * Image URLs are SHARED. "Save as New Tierlist" copies URLs rather than
 * re-uploading, admin "Import from tierlist" copies them into vote tierlists,
 * and "Convert to vote tierlist" copies the cover across. So the same file can
 * be referenced by several tierlists at once, and deleting one of them must not
 * take the file away from the others.
 *
 * The whole-tierlist delete route always checked this. The per-image admin
 * deletes did not — they removed the object unconditionally, which silently
 * broke the image everywhere else it appeared, with no way to recover it.
 *
 * Every failure here is swallowed: an orphaned file costs a little storage,
 * whereas a failed cleanup that blocked the delete would leave the user stuck.
 * The one thing this must never do is delete a file that is still in use, so
 * ANY error while checking references is treated as "still referenced".
 */

const BUCKET = "tierlist-images";
const BUCKET_MARKER = "/object/public/tierlist-images/";

/** Storage path from a public URL, or null if it isn't one of ours. */
export function storagePathFromUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const idx = imageUrl.indexOf(BUCKET_MARKER);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(imageUrl.slice(idx + BUCKET_MARKER.length)) || null;
  } catch {
    return null;
  }
}

/** Where an image URL can be referenced from, and the column holding it. */
const REFERENCE_SOURCES: { table: string; column: string }[] = [
  { table: "tierlist_images", column: "image_url" },
  { table: "vote_tierlist_images", column: "image_url" },
  { table: "tierlists", column: "cover_image_url" },
  { table: "vote_tierlists", column: "cover_image_url" },
  { table: "blind_rankings", column: "cover_image_url" },
];

export interface ExcludeRef {
  /** Table the rows being deleted live in. */
  table: string;
  /** Column to match on — usually "id" or the owning tierlist id column. */
  column: string;
  /** Value to exclude. Rows matching it are the ones going away. */
  value: string;
}

/**
 * Remove any of `urls` that nothing else references.
 *
 * `exclude` names the rows that are being deleted, so they don't count as
 * references to themselves. Pass the row(s) about to disappear.
 */
export async function deleteUnreferencedImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  urls: (string | null | undefined)[],
  exclude?: ExcludeRef,
): Promise<void> {
  const candidates = Array.from(
    new Set(urls.filter((u): u is string => typeof u === "string" && u.length > 0))
  );
  if (candidates.length === 0) return;

  const stillUsed = new Set<string>();

  for (const src of REFERENCE_SOURCES) {
    try {
      let query = service.from(src.table).select(src.column).in(src.column, candidates);
      if (exclude && exclude.table === src.table) {
        query = query.neq(exclude.column, exclude.value);
      }
      const { data, error } = await query;
      if (error) {
        // The table may not exist in this deployment, or the query failed. Either
        // way we cannot prove these files are unused — keep every one of them.
        candidates.forEach(u => stillUsed.add(u));
        continue;
      }
      for (const row of data ?? []) {
        const val = (row as Record<string, unknown>)[src.column];
        if (typeof val === "string") stillUsed.add(val);
      }
    } catch {
      candidates.forEach(u => stillUsed.add(u));
    }
  }

  const paths = candidates
    .filter(u => !stillUsed.has(u))
    .map(storagePathFromUrl)
    .filter((p): p is string => !!p);

  if (paths.length === 0) return;
  try {
    await service.storage.from(BUCKET).remove(paths);
  } catch {
    // Orphaned files are recoverable later; a thrown error here is not.
  }
}
