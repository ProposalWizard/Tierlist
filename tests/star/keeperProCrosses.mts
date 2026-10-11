/**
 * Crosses and through balls: how often the keeper comes and what he does.
 * Not a test: a report. KEEPER=old for Settings → Keeper pro: Old. N per row.
 *   npx tsx tests/star/keeperProCrosses.mts
 */
import { deliver, pctS } from "./keeperProHarness.mts";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
if (process.env.KEEPER === "old") store.set("star-gameplay-keeperPro", "old");
const N = Number(process.env.N ?? 200);
for (const kind of ["corner", "byline_cross", "through_ball"] as const) for (const ks of [60, 80, 90]) {
  const rs: ReturnType<typeof deliver>[] = [];
  for (let s = 1; s <= N; s++) rs.push(deliver(kind, s * 6151 + 3, ks));
  const box = rs.filter((r) => r.intoBox);
  const c = (f: (r: ReturnType<typeof deliver>) => boolean) => box.filter(f).length;
  const outs: Record<string, number> = {};
  for (const r of box) outs[r.outcome] = (outs[r.outcome] ?? 0) + 1;
  console.log(`${kind.padEnd(13)} ks${ks}: into box ${box.length}; came ${pctS(c((r) => r.came), box.length)}; catch ${c((r) => r.claim === "catch")} punch ${c((r) => r.claim === "punch")} flap ${c((r) => r.claim === "flap")}; goals ${pctS(c((r) => r.goal), box.length)}; ${JSON.stringify(outs)}`);
}
