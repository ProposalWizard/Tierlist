/**
 * A fingerprint of the keeper as it was before "Keeper pro" (11 Oct 2026):
 * 600 seeded shots through the real engine and keeper brain, every outcome and
 * every number the keeper touched, hashed. With Settings → Keeper pro: Old the
 * game must give exactly this hash (tests/star/keeperPro.mts checks it).
 */
import { shoot } from "./harness.mts";

export function keeperFingerprint(): { hash: string; n: number } {
  const kinds = ["one_on_one", "through_ball", "long_range", "tight_angle", "volley", "header", "corner", "byline_cross", "cutback"] as const;
  let h = 2166136261 >>> 0;
  let n = 0;
  const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const kind of kinds) for (const ks of [55, 85]) for (let s = 1; s <= 34; s++) {
    for (const aim of ["any", "corner"] as const) {
      const r = shoot(kind, s * 104729 + 7, ks, { aim });
      mix([r.outcome, r.save, r.parry, r.goal, r.speed.toFixed(4), r.z.toFixed(4), r.xAt.toFixed(4), r.keeperY.toFixed(4), (r.gap ?? -1).toFixed(4), (r.bodyEnd ?? -1).toFixed(4)].join("|"));
      n++;
    }
  }
  return { hash: h.toString(16), n };
}

/** The hash of the keeper from before Keeper pro. Recorded 11 Oct 2026 as
 *  d8dc5b7d on the New chance library; re-recorded 12 Oct 2026 on the drawn
 *  chances when the library was deleted (the harness now serves drawn ones).
 *  The keeper code it fingerprints did not change. */
export const KEEPER_FINGERPRINT_BEFORE = "c808f663";

if (process.argv[1]?.endsWith("fingerprint.mts")) {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  if (process.env.KEEPER === "old") store.set("star-gameplay-keeperPro", "old");
  console.log(keeperFingerprint());
}
