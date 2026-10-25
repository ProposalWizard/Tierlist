// BUILD-UP MIX MEASURE (22 Oct 2026; Harry: "shorter build ups shouldn't
// necessarily mean less distance, there should be a mix of sped up kicking,
// sometimes I still want fast long balls and tiki taka").
//
//   npx tsx scripts/fhr/buildup-mix-measure.mts [N=400] [--seed=3] [--json=out.json]
//
// The career's build-ups exactly as the match plays them (builders.ts
// fhrBuildUpOn: the share roll, then the build-up), over the chances the real
// match serves (servedChances). For each one it measures what is ON THE SCREEN:
//   seconds, passes, how far the ball travels (its path, metres), how far the
//   move comes from (first ball to the chance's ball, metres), the style,
//   the ball off the camera's frame (leadInCamera on the chance's phone frame,
//   share of 60 Hz frames), and the fastest man (0.2 s windows, m/s).
import { writeFileSync } from "node:fs";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { fhrBuildUpOn } from "../../lib/star/fhr/builders";
import { leadInCamera, LEAD_MAX_RUN, type LeadIn } from "../../lib/star/leadIn";
import { forceFhrMode } from "../../lib/star/fhr/toggle";

const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 400);
const seed = Number(args.find((a) => a.startsWith("--seed="))?.slice(7) ?? 3);
const jsonOut = args.find((a) => a.startsWith("--json="))?.slice(7);
forceFhrMode("on");

type Row = { kind: string; style: string; durS: number; passes: number; ballM: number; fromM: number; offPct: number; vmax: number; offside: boolean; problems: number; foul: boolean };
const rows: Row[] = [];
const cs = servedChances({ count: n, seed });
const t0 = Date.now();
for (const c of cs) {
  const lead = fhrBuildUpOn(c.sc, c.moment) as (LeadIn & { style?: string; people?: { key: string }[]; problems?: string[]; acts?: unknown[] }) | null;
  if (!lead) continue;
  const foul = !lead.acts;
  const frame = c.moment.frame ?? c.sc.viewport;
  const cam = leadInCamera(lead, []);
  let ballM = 0, off = 0, tot = 0;
  let prev = lead.ballAt(0);
  for (let t = 0; t <= lead.durS + 1e-9; t += 1 / 60) {
    const b = lead.ballAt(t);
    ballM += Math.hypot(b.x - prev.x, b.y - prev.y); prev = b;
    const v = cam.at(t, frame);
    tot++;
    if (b.x < v.x1 || b.x > v.x2 || b.y < v.y1 || b.y > v.y2) off++;
  }
  const b0 = lead.ballAt(0), b1 = lead.ballAt(lead.durS);
  let vmax = 0;
  const keys = lead.people?.map((p) => p.key) ?? [];
  for (const k of keys) {
    const pts: { x: number; y: number }[] = [];
    for (let t = 0; t <= lead.durS + 1e-9; t += 1 / 15) { const p = lead.posAt(k, t); if (p) pts.push(p); }
    for (let i = 3; i < pts.length; i++) vmax = Math.max(vmax, Math.hypot(pts[i].x - pts[i - 3].x, pts[i].y - pts[i - 3].y) / 0.2);
  }
  rows.push({
    kind: c.sc.kind, style: foul ? "foul" : lead.style ?? "cut (old)", durS: lead.durS, passes: lead.passStart?.length ?? 0,
    ballM, fromM: Math.hypot(b1.x - b0.x, b1.y - b0.y), offPct: (100 * off) / tot, vmax,
    offside: !!lead.offside, problems: lead.problems?.length ?? 0, foul,
  });
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
const line = (name: string, rs: Row[]) => {
  if (!rs.length) return;
  console.log(
    `${name.padEnd(12)} n ${String(rs.length).padStart(4)} · ${mean(rs.map((r) => r.durS)).toFixed(2)} s (p10 ${q(rs.map((r) => r.durS), 0.1).toFixed(1)}, p90 ${q(rs.map((r) => r.durS), 0.9).toFixed(1)})` +
    ` · passes ${mean(rs.map((r) => r.passes)).toFixed(2)} · ball travels ${mean(rs.map((r) => r.ballM)).toFixed(1)} m · move from ${mean(rs.map((r) => r.fromM)).toFixed(1)} m` +
    ` · ball off screen ${mean(rs.map((r) => r.offPct)).toFixed(2)}% (worst ${q(rs.map((r) => r.offPct), 1).toFixed(1)}%)` +
    ` · fastest man p50 ${q(rs.map((r) => r.vmax), 0.5).toFixed(1)} p99 ${q(rs.map((r) => r.vmax), 0.99).toFixed(1)} max ${q(rs.map((r) => r.vmax), 1).toFixed(1)} m/s (over ${LEAD_MAX_RUN}: ${rs.filter((r) => r.vmax > LEAD_MAX_RUN + 0.05).length})` +
    ` · offside ${rs.filter((r) => r.offside).length} · with problems ${rs.filter((r) => r.problems).length}`,
  );
};
console.log(`${cs.length} served chances, ${rows.length} with a build-up · ${Date.now() - t0} ms`);
line("ALL", rows);
line("open play", rows.filter((r) => !r.foul));
const styles = Array.from(new Set(rows.map((r) => r.style)));
for (const s of styles) line(s, rows.filter((r) => r.style === s));
const open = rows.filter((r) => !r.foul);
console.log("mix:", styles.filter((s) => s !== "foul").map((s) => `${s} ${((100 * open.filter((r) => r.style === s).length) / Math.max(1, open.length)).toFixed(0)}%`).join(" · "));
const kinds = Array.from(new Set(open.map((r) => r.kind)));
for (const k of kinds) {
  const rs = open.filter((r) => r.kind === k);
  console.log(`  ${k.padEnd(14)} ${String(rs.length).padStart(4)} · ${mean(rs.map((r) => r.durS)).toFixed(2)} s · ${mean(rs.map((r) => r.ballM)).toFixed(1)} m · ` + styles.filter((s) => s !== "foul").map((s) => `${s} ${rs.filter((r) => r.style === s).length}`).join(" "));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows));
if (process.env.PROBLEMS) {
  const probs = new Map<string, number>();
  for (const c of cs) {
    const lead = fhrBuildUpOn(c.sc, c.moment) as (LeadIn & { problems?: string[]; style?: string }) | null;
    for (const p of lead?.problems ?? []) { const k = `${lead?.style}: ` + p.replace(/\d+(\.\d+)?/g, "#").replace(/(extra|def|mate|sec)#/g, "$1"); probs.set(k, (probs.get(k) ?? 0) + 1); }
  }
  for (const [k, v] of [...probs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${v} × ${k}`);
}
