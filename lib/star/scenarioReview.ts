/**
 * APPROVED / REJECTED, per scenario version.
 *
 * The gallery's review verdicts. Local-only for now (same localStorage idiom
 * the gallery's own position edits already use), but deliberately shaped as a
 * real record rather than a bare "key -> string" so wiring it to a table later
 * is a swap of the two functions at the bottom, not a redesign: every field a
 * row would need (which cell, which game, which kind, which seed, when) is
 * already carried.
 */

export type ReviewVerdict = "approved" | "rejected";

export interface ReviewRecord {
  /** The gallery cell key this verdict belongs to. */
  key: string;
  game: "eleven" | "five";
  /** The chance kind (11-a-side) or shape group (5-a-side). */
  kind: string;
  /** The fixed seed this version was built from; null for an unseeded shape. */
  seed: number | null;
  verdict: ReviewVerdict;
  /** Epoch ms, so a later sync can resolve two devices disagreeing. */
  at: number;
}

export type ReviewStore = Record<string, ReviewRecord>;

const REVIEW_KEY = "star-gallery-reviews-v1";

export function loadReviews(): ReviewStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REVIEW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ReviewStore) : {};
  } catch {
    return {};
  }
}

export function saveReviews(store: ReviewStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REVIEW_KEY, JSON.stringify(store));
  } catch {
    /* a dev tool is not worth crashing over a full quota */
  }
}

/** How many of these keys carry a verdict of any kind. */
export function reviewedCount(store: ReviewStore, keys: string[]): number {
  let n = 0;
  for (const k of keys) if (store[k]) n++;
  return n;
}
