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
  "0.62": "mikey/v0.18.html",
  "0.103": "mikey/v0.20.html",
  "0.63": "mikey/v0.19.html",
  // VERSION KEYS MUST BE UNIQUE ACROSS HARRY, LEO AND MIKEY. Site versions
  // 0.60 to 0.63 are Leo's and Mikey's live pages (main). Harry's four pages
  // that were also numbered 0.60 to 0.63 (written on his branch before main
  // had them) keep their number with an "h" for Harry: 0.60h to 0.63h.
  // 21 Oct 2026: Harry's notes 0.95h on (round_1021.py). 19-20 Oct 2026: the last two days, one kept page per build (Harry: acknowledge every tab).
  "0.102h": "pages/0.102h/index.html",
  "0.101h": "pages/0.101h/index.html",
  "0.100h": "pages/0.100h/index.html",
  "0.99h": "pages/0.99h/index.html",
  "0.98h": "pages/0.98h/index.html",
  "0.97h": "pages/0.97h/index.html",
  "0.96h": "pages/0.96h/index.html",
  "0.95h": "pages/0.95h/index.html",
  "0.94": "pages/0.94/index.html",
  "0.93": "pages/0.93/index.html",
  "0.92": "pages/0.92/index.html",
  "0.91": "pages/0.91/index.html",
  "0.90": "pages/0.90/index.html",
  "0.89": "pages/0.89/index.html",
  "0.88": "pages/0.88/index.html",
  "0.87": "pages/0.87/index.html",
  "0.86": "pages/0.86/index.html",
  "0.85": "pages/0.85/index.html",
  "0.84": "pages/0.84/index.html",
  "0.83": "pages/0.83/index.html",
  "0.82": "pages/0.82/index.html",
  "0.81": "pages/0.81/index.html",
  "0.80": "pages/0.80/index.html",
  "0.79": "pages/0.79/index.html",
  "0.78": "pages/0.78/index.html",
  "0.77": "pages/0.77/index.html",
  "0.76": "pages/0.76/index.html",
  "0.75": "pages/0.75/index.html",
  "0.74": "pages/0.74/index.html",
  "0.73": "pages/0.73/index.html",
  "0.72": "pages/0.72/index.html",
  "0.71": "pages/0.71/index.html",
  "0.70": "pages/0.70/index.html",
  "0.69": "pages/0.69/index.html",
  "0.68": "pages/0.68/index.html",
  "0.67": "pages/0.67/index.html",
  "0.66": "pages/0.66/index.html",
  "0.65": "pages/0.65/index.html",
  "0.64": "pages/0.64/index.html",
  "0.63h": "pages/0.63h/index.html",
  "0.62h": "pages/0.62h/index.html",
  "0.61h": "pages/0.61h/index.html",
  "0.60h": "pages/0.60h/index.html",
  "0.59": "mikey/v0.17.html",
  "0.57": "pages/0.57/index.html",
  "0.56": "pages/0.56/index.html",
  "0.55": "pages/0.55/index.html",
  "0.54": "pages/0.54/index.html",
  "0.53": "pages/0.53/index.html",
  "0.50": "mikey/v0.16.html",
  "0.49": "mikey/v0.15.html",
  "1.1": "pages/1.1/index.html",
  "0.44": "pages/0.44/index.html",
  "0.43": "mikey/v0.14.html",
  "0.42": "pages/0.42/index.html",
  "0.41": "mikey/v0.13.html",
  "0.40": "mikey/v0.12.html",
  "0.39": "pages/0.39/index.html",
  "0.38": "pages/0.38/index.html",
  "0.37": "mikey/v0.11.html",
  "0.36": "pages/0.36/index.html",
  "0.35": "pages/0.35/index.html",
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
