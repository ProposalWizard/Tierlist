import { servedChances } from "../../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp } from "../../../lib/star/fhr/buildUp";
import { setVisitSalt } from "../../../lib/star/chanceMaker";
import { planFromLead, liveKindOK } from "../../../lib/star/liveChance";
setVisitSalt(0);
const pool = servedChances({ count: 600, seed: 29 });
const by: Record<string, { n: number; bu: number; live: number }> = {};
for (const c of pool) {
  const k = c.sc.kind; const o = (by[k] ??= { n: 0, bu: 0, live: 0 }); o.n++;
  if (!liveKindOK(k) || !fhrWantsBuildUp(k, c.moment)) continue;
  const sc = JSON.parse(JSON.stringify(c.sc));
  let b; try { b = fhrBuildUpFor(sc, c.moment); } catch { b = null; }
  if (!b) continue; o.bu++;
  if (planFromLead(b, sc.ball)) o.live++;
}
console.log(JSON.stringify(by, null, 0));
// Why a one-on-one / tight angle is not live: the last action and where it ends.
for (const c of pool.filter((c) => c.sc.kind === "one_on_one" || c.sc.kind === "tight_angle").slice(0, 14)) {
  const sc = JSON.parse(JSON.stringify(c.sc)); const b = fhrBuildUpFor(sc, c.moment); if (!b) continue;
  const a = b.acts[b.acts.length - 1], pe = b.passEnd!, ps = b.passStart!;
  const end = b.ballAt(pe[pe.length - 1]);
  console.log(c.sc.kind, planFromLead(b, sc.ball) ? "LIVE" : "no  ", a.type, a.through ? "through" : "", "len", Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y).toFixed(1), "endOff", Math.hypot(end.x - sc.ball.x, end.y - sc.ball.y).toFixed(2), "z", end.z.toFixed(2), "t1", pe[pe.length-1].toFixed(2), "dur", b.durS.toFixed(2), "n", ps.length, b.acts.length);
}
