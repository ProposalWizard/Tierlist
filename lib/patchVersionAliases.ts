/**
 * lib/patchVersionAliases.ts — OLD PATCH-NOTE NUMBERS → NEW ONES.
 *
 * Leo, 26 Oct 2026: every patch note gets its own number. Nine notes shared a
 * number with one of Harry's "h" notes (0.110 and 0.110h, 0.109 and 0.109h …),
 * so they moved to 0.113-0.121, in the order they were made. Harry's notes
 * kept theirs.
 *
 * Read receipts, notes on a version and the "already rung" lists are saved
 * against the version string, so they still carry the old number. Everything
 * that reads them passes the key through `canonicalPatchVersion`, so a tick
 * or a note on "0.110" counts on 0.121. Never reuse an old number here.
 */
export const PATCH_VERSION_ALIASES: Readonly<Record<string, string>> = {
  "0.60": "0.113",
  "0.62": "0.114",
  "0.61": "0.115",
  "0.63": "0.116",
  "0.103": "0.117",
  "0.107": "0.118",
  "0.108": "0.119",
  "0.109": "0.120",
  "0.110": "0.121",
};

/** The old number a note had, if it was renumbered ("0.121" → "0.110"). */
export function formerPatchVersion(v: string): string | null {
  for (const [old, now] of Object.entries(PATCH_VERSION_ALIASES)) if (now === v) return old;
  return null;
}

/**
 * A stored version key in today's numbers. Works on plain keys ("0.110") and
 * read keys ("0.110@2026-10-26T03:42:00Z", lib/teamRoom/extras.ts patchReadKey).
 */
export function canonicalPatchVersion(key: string): string {
  const at = key.indexOf("@");
  const v = at < 0 ? key : key.slice(0, at);
  const now = PATCH_VERSION_ALIASES[v];
  return now ? now + (at < 0 ? "" : key.slice(at)) : key;
}
