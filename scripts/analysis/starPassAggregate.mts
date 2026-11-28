/**
 * Reads the shard files from starPassByAge.mts and prints the printout, then re-prices the
 * SAME careers under retune options (replays each match's recorded total Star Points through
 * a different level curve, then applies the same gate cap). Nothing in the game changes.
 *   npx tsx scripts/analysis/starPassAggregate.mts shard0.json shard1.json ...
 */
import { readFileSync } from "node:fs";
type Row = { prof: string; startAge: number; steps: [number, number, number][]; byAge: Record<string, { level: number; matches: number; total: number }> };
const rows: Row[] = process.argv.slice(2).flatMap(f => JSON.parse(readFileSync(f, "utf8")));
const pct = (xs: number[], q: number) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return NaN; const i = (s.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const f0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : "-");
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "-");

// ── level curves (copy of starPoints.ts levelCosts, parametrised) ──
type Curve = { start: number; grow: number; growTop: number; knee?: number; early?: number[]; /** extra SP added to levels 1..fadeTo-1: flat `extra` to level 9, then fading to 0 at level `fadeTo` */ extra?: number; fadeTo?: number };
const twoFigures = (n: number) => { const p = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };
function thresholds(c: Curve): number[] {
  const knee = c.knee ?? 60, t = [0, 0];
  for (let L = 1; L < 90; L++) {
    let cost = c.early && L <= c.early.length ? c.early[L - 1]
      : twoFigures(c.start * Math.pow(c.grow, Math.min(L, knee) - 4) * Math.pow(c.growTop, Math.max(0, L - knee)));
    if (c.extra && c.fadeTo && L < c.fadeTo) cost = twoFigures(cost + c.extra * (L <= 9 ? 1 : (c.fadeTo - L) / (c.fadeTo - 9)));
    t[L + 1] = t[L] + cost;
  }
  return t;
}
const levelOf = (th: number[], sp: number) => { let L = 90; while (L > 1 && sp < th[L]) L--; return L; };
const TODAY: Curve = { start: 15_000, grow: 1.075, growTop: 1.02 };

/** For each career: the age and match number at which each level is first reached, under a curve. */
function reach(c: Curve, levels = [10, 20, 30, 50, 75, 90]) {
  const th = thresholds(c);
  return rows.map(r => {
    const out: Record<number, { age: number; matches: number }> = {};
    r.steps.forEach(([age, sp, cap], i) => {
      const lv = Math.min(levelOf(th, sp), cap);
      for (const L of levels) if (lv >= L && !out[L]) out[L] = { age, matches: i + 1 };
    });
    return out;
  });
}
function levelAtAge(c: Curve, age: number) {
  const th = thresholds(c);
  return rows.map(r => { let last: number | undefined; r.steps.forEach(([a, sp, cap]) => { if (a === age) last = Math.min(levelOf(th, sp), cap); }); return last; }).filter((x): x is number => x !== undefined);
}
function table(name: string, c: Curve) {
  const rs = reach(c);
  const cells = [10, 20, 30, 50, 75, 90].map(L => {
    const v = rs.map(x => x[L]).filter(Boolean);
    return `L${L}: ${v.length}/${rs.length} reach, age p10/med/p90 ${v.length ? [.1, .5, .9].map(q => f1(pct(v.map(x => x.age), q))).join("/") : "-"}, matches med ${v.length ? f0(pct(v.map(x => x.matches), .5)) : "-"}`;
  });
  console.log(`\n== ${name} (start ${c.start}, grow ${c.grow}, growTop ${c.growTop}${c.knee ? ", knee " + c.knee : ""}) ==`);
  cells.forEach(x => console.log("  " + x));
  const gap = (a: number, b: number) => { const v = rs.filter(x => x[a] && x[b]).map(x => x[b].matches - x[a].matches); return v.length ? f0(pct(v, .5)) : "-"; };
  console.log(`  matches from L10 to L20: ${gap(10, 20)}, L20 to L30: ${gap(20, 30)}, L30 to L50: ${gap(30, 50)}, L50 to L75: ${gap(50, 75)} (median)`);
  console.log("  level at age 16/18/20/22/25/30/35/38 (median): " + [16, 18, 20, 22, 25, 30, 35, 38].map(a => f0(pct(levelAtAge(c, a), .5))).join(" / "));
}

console.log(`CAREERS ${rows.length}; by profile: ` + ["low", "mid", "riser", "star", "elite"].map(p => `${p} ${rows.filter(r => r.prof === p).length}`).join(", "));
const th0 = thresholds(TODAY);
console.log("\nTODAY: level at each age (p10 / median / p90), matches played (median), total SP (median)");

for (let a = 16; a <= 38; a++) {
  const lv = levelAtAge(TODAY, a);
  const mt = rows.map(r => r.byAge[a]?.matches).filter(x => x !== undefined) as number[];
  const sp = rows.map(r => r.byAge[a]?.total).filter(x => x !== undefined) as number[];
  if (lv.length) console.log(`${a} | n=${lv.length} | ${f0(pct(lv, .1))}/${f0(pct(lv, .5))}/${f0(pct(lv, .9))} | ${f0(pct(mt, .5))} | ${f0(pct(sp, .5))}`);
}
table("TODAY (checks against the real game's own level numbers)", TODAY);
// sanity: the game's own recorded level vs re-priced
{ let diff = 0, n = 0; for (const r of rows) for (const k of Object.keys(r.byAge)) { const a = r.byAge[k]; const st = r.steps.filter(s => s[0] === Number(k)); const last = st[st.length - 1]; if (!last) continue; n++; if (Math.min(levelOf(th0, last[1]), last[2]) !== a.level && a.level < 90) diff++; } console.log(`re-price check: ${diff} of ${n} age-ends differ from the game's own level`); }
console.log("\nBY PROFILE, today: median age at L10 / L20 / L50");
for (const p of ["low", "mid", "riser", "star", "elite"]) { const sub = rows.filter(r => r.prof === p); const keep = [...rows]; (rows as Row[]).splice(0, rows.length, ...sub); const rs = reach(TODAY); (rows as Row[]).splice(0, rows.length, ...keep); console.log(p.padEnd(6), [10, 20, 50].map(L => { const v = rs.map(x => x[L]).filter(Boolean); return `L${L} ${v.length ? f1(pct(v.map(x => x.age), .5)) : "-"} (${v.length}/${rs.length})`; }).join("   ")); }

console.log("\nTODAY thresholds (SP to be on level): " + [5, 10, 20, 30, 40, 50, 60, 75, 90].map(L => `L${L} ${f0(th0[L])}`).join(", "));

if (process.env.OPTIONS) {
  const OPTS: [string, Curve][] = [
    ["A. Everything dearer (cost of every level x8)", { start: 120_000, grow: 1.075, growTop: 1.02 }],
    ["B. The game's own 'brutal' curve (one-word switch)", { start: 20_000, grow: 1.085, growTop: 1.02 }],
    ["C. A flat curve, 120,000 a level (shows why flat is wrong)", { start: 120_000, grow: 1.01, growTop: 1.02 }],
    ["F1. First 29 levels dearer, fading out (+130,000, level 30 on as today)", { start: 15_000, grow: 1.075, growTop: 1.02, extra: 130_000, fadeTo: 30 }],
    ["F2. Same, gentler (+100,000)", { start: 15_000, grow: 1.075, growTop: 1.02, extra: 100_000, fadeTo: 30 }],
    ["F3. Same, a little stronger (+160,000)", { start: 15_000, grow: 1.075, growTop: 1.02, extra: 160_000, fadeTo: 30 }],
  ];
  for (const [n, c] of OPTS) table(n, c);
  console.log("\nTHRESHOLDS " + [5, 10, 20, 30, 40, 50, 60, 75, 90].map(L => `L${L}`).join(" ") );
  for (const [n, c] of [["today", TODAY] as [string, Curve], ...OPTS]) { const t = thresholds(c); console.log(n.slice(0, 40).padEnd(40), [5, 10, 20, 30, 40, 50, 60, 75, 90].map(L => f0(t[L])).join(" ")); }
}

if (process.env.OPTIONS) {
  const F2: Curve = { start: 15_000, grow: 1.075, growTop: 1.02, extra: 100_000, fadeTo: 30 };
  console.log("\nEARLY CARDS: median matches played when level 2 / 4 / 6 / 8 / 10 is reached");
  for (const [n, c] of [["today", TODAY], ["F2", F2]] as [string, Curve][]) {
    const rs = reach(c, [2, 4, 6, 8, 10]);
    console.log(n.padEnd(6), [2, 4, 6, 8, 10].map(L => `L${L} ${f0(pct(rs.map(x => x[L]?.matches).filter((v): v is number => v !== undefined), .5))}`).join("  "));
  }
  const tn = thresholds(TODAY), tf = thresholds(F2);
  console.log("F2 cost of each level 1..29 (today -> F2): " + Array.from({ length: 29 }, (_, i) => `${i + 1}:${tn[i + 2] - tn[i + 1]}->${tf[i + 2] - tf[i + 1]}`).join(" "));
  console.log("F2 EARLY_LEVEL_COST = [" + Array.from({ length: 29 }, (_, i) => tf[i + 2] - tf[i + 1]).join(", ") + "]");
}
