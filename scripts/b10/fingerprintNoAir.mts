/** B10 check: the keeper fingerprint (tests/star/keeperPro/fingerprint.mts)
 *  over every kind EXCEPT header and volley — must be the same on the old
 *  and the new code (only the header/volley pictures it is fed changed). */
import { shoot } from "../../tests/star/keeperPro/harness.mts";
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
store.set("star-gameplay-keeperPro", process.env.KEEPER === "new" ? "new" : "old");
store.set("star-gameplay-keeperFinish", "old"); // as tests/star/keeperPro.mts runs it
const kinds = ["one_on_one", "through_ball", "long_range", "tight_angle", "corner", "byline_cross", "cutback"] as const;
let h = 2166136261 >>> 0, n = 0;
const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
for (const kind of kinds) for (const ks of [55, 85]) for (let s = 1; s <= 34; s++) for (const aim of ["any", "corner"] as const) {
  const r = shoot(kind, s * 104729 + 7, ks, { aim });
  mix([r.outcome, r.save, r.parry, r.goal, r.speed.toFixed(4), r.z.toFixed(4), r.xAt.toFixed(4), r.keeperY.toFixed(4), (r.gap ?? -1).toFixed(4), (r.bodyEnd ?? -1).toFixed(4)].join("|"));
  n++;
}
console.log({ hash: h.toString(16), n });
