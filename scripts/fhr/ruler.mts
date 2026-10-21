// Print the Full Highlights Rebuild's ruler (lib/star/fhr/ruler.ts) in the
// terminal: today's numbers (Chances: Old = the switch Off) and what On turns
// on (Chances: New), over N whole matches, players reacting included.
//
//   npx tsx scripts/fhr/ruler.mts [N=200] [--write]
//
// --write saves the reaction counts to lib/star/fhr/reactSnapshot.json, which
// /star-fhr-dev shows (the page cannot run the engine's physics itself).
import { writeFileSync } from "node:fs";
import { measureRuler, type Ruler } from "../../lib/star/fhr/ruler";
import { reactingAfterStrike, strikeOnce } from "./react";
import { fhrBuildUpFor, fhrWantsBuildUp } from "../../lib/star/fhr/buildUp";
import { fhrBuildUpOn } from "../../lib/star/fhr/builders";
import { servedChances } from "../../lib/star/fhr/servedChances";

const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 200);
const write = args.includes("--write");
const r2 = (v: number | null) => (v === null || !Number.isFinite(v) ? "–" : (Math.round(v * 100) / 100).toString());
const out: Record<string, Ruler> = {};
for (const chances of ["old", "new"] as const) {
  const r = measureRuler({ matches: n, chances, react: reactingAfterStrike });
  out[chances] = r;
  console.log(`\nChances: ${chances === "old" ? "Old (today, Off)" : "New (what On turns on)"} — ${n} matches, ${r.ms} ms`);
  console.log(`  chances a match ${r2(r.chancesPerMatch)} · goals a match ${r2(r.goalsPerMatch)} (you ${r2(r.yourGoalsPerMatch)}, them ${r2(r.oppGoalsPerMatch)})`);
  console.log(`  players reacting a chance ${r2(r.reactingPerChance)} (team-mates ${r2(r.matesReactingPerChance)}; within 1 s ${r2(r.reactingEarlyPerChance)}) · start distance median ${r2(r.startMedianM)} m (mean ${r2(r.startMeanM)})`);
  console.log(`  one-on-ones: start ${r2(r.oneOnOneStartM)} m, reacting ${r2(r.oneOnOneReacting)}`);
  for (const k of r.byKind) console.log(`    ${k.kind.padEnd(14)} ${r2(k.n).padStart(5)} a match · start ${r2(k.startM).padStart(5)} m · reacting ${r2(k.reacting)} (1 s: ${r2(k.reactingEarly)})`);
}
// Phase 2: On with its generated build-ups. They are a replay before the chance,
// so the chances and goals must be exactly the ones above (Chances: New).
{
  const r = measureRuler({ matches: n, chances: "new", buildUp: (sc, m) => (fhrWantsBuildUp(sc.kind, m) ? fhrBuildUpFor(sc, m) : null) });
  const b = r.buildUps!;
  const same = r.chancesPerMatch === out.new.chancesPerMatch && r.goalsPerMatch === out.new.goalsPerMatch && r.startMedianM === out.new.startMedianM;
  console.log(`\nOn with phase 2's build-ups — ${n} matches, ${r.ms} ms`);
  console.log(`  chances a match ${r2(r.chancesPerMatch)} · goals a match ${r2(r.goalsPerMatch)} — ${same ? "the same as without them" : "DIFFERENT from without them"}`);
  console.log(`  build-ups ${b.made} of ${b.of} chances (set pieces get none) · length min ${r2(b.lenS.min)} · p10 ${r2(b.lenS.p10)} · p50 ${r2(b.lenS.p50)} · p90 ${r2(b.lenS.p90)} · max ${r2(b.lenS.max)} s · ${b.distinct} distinct routes`);
}
// B2 (20 Oct 2026): everything On adds — the foul build-ups before set pieces
// (a replay: chances and goals unchanged, as above) and the ONE thing that
// changes a chance: the extra defender who joins it. The same fixed strike,
// with and without him, on every chance that got one.
{
  const r = measureRuler({ matches: n, chances: "new", buildUp: (sc, m) => fhrBuildUpOn(sc, m) });
  console.log(`\nOn with B2's build-ups (fouls, extra defender, players still running) — ${n} matches`);
  console.log(`  chances a match ${r2(r.chancesPerMatch)} · goals a match ${r2(r.goalsPerMatch)} — ${r.chancesPerMatch === out.new.chancesPerMatch && r.goalsPerMatch === out.new.goalsPerMatch ? "the same as without them" : "DIFFERENT from without them"}`);
  const cs = servedChances({ count: n * 6, seed: 3 });
  let open = 0, covered = 0, gNo = 0, gYes = 0, bNo = 0, bYes = 0, reNo = 0, reYes = 0;
  for (const c of cs) {
    if (!fhrWantsBuildUp(c.sc.kind, c.moment)) continue;
    open++;
    const b = fhrBuildUpFor(c.sc, c.moment);
    if (!b.cover) continue;
    covered++;
    const plain = strikeOnce(c.sc, c.moment.seed);
    const withCover: typeof c.sc = JSON.parse(JSON.stringify(c.sc));
    withCover.defenders.push({ x: b.cover.end.x, y: b.cover.end.y });
    const cov = strikeOnce(withCover, c.moment.seed);
    if (plain.result === "goal") gNo++; if (cov.result === "goal") gYes++;
    if (plain.result === "blocked" || plain.result === "tackled") bNo++; if (cov.result === "blocked" || cov.result === "tackled") bYes++;
    reNo += plain.reaction.all; reYes += cov.reaction.all;
  }
  const pc = (v: number) => `${((v / Math.max(1, covered)) * 100).toFixed(1)}%`;
  console.log(`  extra defender on ${covered} of ${open} open-play chances (${((covered / Math.max(1, open)) * 100).toFixed(1)}%)`);
  console.log(`  on those, the fixed strike: goals ${pc(gNo)} → ${pc(gYes)} · blocked or tackled ${pc(bNo)} → ${pc(bYes)} · players reacting ${r2(reNo / Math.max(1, covered))} → ${r2(reYes / Math.max(1, covered))}`);
}
if (write) {
  const pick = (r: Ruler) => ({
    reactingPerChance: r.reactingPerChance, matesReactingPerChance: r.matesReactingPerChance,
    reactingEarlyPerChance: r.reactingEarlyPerChance, oneOnOneReacting: r.oneOnOneReacting,
    byKind: Object.fromEntries(r.byKind.filter((k) => Number.isFinite(k.reacting)).map((k) => [k.kind, { reacting: k.reacting, reactingEarly: k.reactingEarly }])),
  });
  const snap = { measured: new Date().toISOString().slice(0, 10), matches: n, off: pick(out.old), on: pick(out.new) };
  writeFileSync(new URL("../../lib/star/fhr/reactSnapshot.json", import.meta.url), JSON.stringify(snap, null, 2) + "\n");
  console.log("\nwrote lib/star/fhr/reactSnapshot.json");
}
