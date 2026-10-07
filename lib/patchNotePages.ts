/**
 * lib/patchNotePages.ts — WHERE EACH VERSION'S REAL PAGE IS KEPT.
 *
 * Asked for directly (26 Sep 2026): "I want the artifacts to look EXACTLY
 * the same on the patch notes admin area — rn I think it loses images and
 * stuff right?" It did. lib/patchNotesData.ts keeps each version as plain
 * data — the words, the bars, the toggles — and the archive draws that in
 * the site's own style. Screenshots, before/after pictures, diagrams and the
 * page's own layout were never in it.
 *
 * So the page itself is kept too: the artifact's HTML and its image files,
 * copied into the repo under patch-notes/. The archive shows that copy,
 * byte for byte, and keeps the data view as a "Text" tab (it is still what
 * the site can search and what patch-notes-artifact.mts builds from).
 *
 * Paths are relative to the repo's patch-notes/ folder. Mikey keeps his own
 * pages in patch-notes/mikey/ under HIS numbering (his v0.3 is the site's
 * 0.11), so those are pointed at where they already live rather than copied.
 *
 * A version with no entry here just shows the Text view, as before.
 */
export const PATCH_NOTE_PAGES: Record<string, string> = {
  "0.34": "pages/0.34/index.html",
  "0.33": "pages/0.33/index.html",
  "0.32": "pages/0.32/index.html",
  "0.31": "pages/0.31/index.html",
  "0.30": "pages/0.30/index.html",
  "0.29": "pages/0.29/index.html",
  "0.28": "pages/0.28/index.html",
  "0.27": "mikey/v0.10.html",
  "0.26": "mikey/v0.9.html",
  // Harry's own pages, 22 Sep to 3 Oct 2026 (videos swapped for their stills;
  // each page links its clips on the artifact).
  "0.25": "pages/0.25/index.html",
  "0.24": "pages/0.24/index.html",
  "0.23.1": "pages/0.23.1/index.html",
  "0.23": "pages/0.23/index.html",
  "0.22": "pages/0.22/index.html",
  "0.21": "mikey/v0.8.html",
  "0.20": "mikey/v0.7.html",
  "1.0": "pages/1.0/index.html",
  // Not a version: the App Plan, shown on its own admin page (/admin/app-plan).
  "app-plan": "pages/app-plan/index.html",
  // Not versions: Harry's review pages, shown as the "Harry's notes" tab.
  "review-0.20": "reviews/0.20/index.html",
  "0.19": "mikey/v0.6.html",
  "0.13": "mikey/v0.5.html",
  "0.12": "mikey/v0.4.html",
  "0.11": "mikey/v0.3.html",
  "0.10": "pages/0.10/index.html",
  "0.9": "pages/0.9/index.html",
  "0.8": "pages/0.8/index.html",
  "0.7": "pages/0.7/index.html",
  "0.6": "mikey/v0.2.html",
  "0.5": "pages/0.5/index.html",
  "0.4": "pages/0.4/index.html",
  "0.3.5": "pages/0.3.5/index.html",
  "0.3": "pages/0.3/index.html",
  "0.2": "pages/0.2/index.html",
  "0.1": "pages/0.1/index.html",
};

/** The admin-only URL the archive loads a version's page from. */
export function patchNotePageUrl(version: string): string {
  return `/api/admin/patch-notes/page?v=${encodeURIComponent(version)}`;
}

/** The admin-only URL a page's own images and files are served from. */
export const PATCH_NOTE_FILE_BASE = "/api/admin/patch-notes/file/";
