import { newWorld } from "../../lib/star/intl/replay";
import { NATIONS, nationFor } from "../../lib/star/intl/nations";
import { UNL_2026, AFCONQ_2027, ASIAN_CUP_2027, CNL_2026, realList } from "../../lib/star/intl/realData";
import { WC_SLOTS } from "../../lib/star/intl/worldCup";
import { worldCupHosts } from "../../lib/star/intl/hosts";
import { played } from "../../lib/star/intl/engine";
import type { NlOutcome } from "../../lib/star/intl/uefa";
import { realLayout, placed, type KnockoutLayout } from "../../lib/star/intl/build";
import type { Row } from "../../lib/star/intl/engine";

/**
 * THE INTERNATIONAL WORLD KEEPS ITS RULES FOR TWENTY YEARS.
 *
 * Replays August 2026 to August 2046 and checks every competition's own rule:
 * field sizes, places per confederation, the World Cup draw limits, the
 * Nations League's leagues, the real starting groups, nobody playing twice
 * on one day, the same replay every time, and your own results changing
 * the world.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const END = Date.UTC(2046, 7, 1);

const t0 = Date.now();
const w = newWorld({ xi: {}, played: {}, firstYear: 2026 });
w.run(END);
const ms = Date.now() - t0;
check(ms < 5000, `twenty years replay in under 5 s (took ${ms} ms)`);
check(w.matches.every(played), "every match before the end date is played");
check(![...w.facts.keys()].some((k) => k.startsWith("warn")), "no field was ever short and topped up");

// Real starting data: every name is a FIFA nation (except CONCACAF's non-members).
for (const [g, t] of Object.entries(UNL_2026)) check(realList(t).length === t.length, `Nations League ${g} names all found`);
for (const [g, t] of Object.entries(AFCONQ_2027)) check(realList(t).length === t.length, `AFCON qualifying ${g} names all found`);
for (const [g, t] of Object.entries(ASIAN_CUP_2027)) check(realList(t).length === t.length, `Asian Cup ${g} names all found`);
check(realList(CNL_2026.A).length === 15, "CONCACAF League A: 15 FIFA nations (Martinique is not one)");
check(realList(CNL_2026.B).length === 12, "CONCACAF League B: 12 FIFA nations");
check(realList(CNL_2026.C).length === 8, "CONCACAF League C: 8 FIFA nations");

// The real knockout tables: every first knockout round is exactly the one
// FIFA's / UEFA's / the AFC's table gives for the thirds that went through.
{
  let checked = 0;
  for (const ed of new Set(w.matches.map((m) => m.edition))) {
    const sample = w.edition(ed)[0];
    const layout: KnockoutLayout | null = sample.comp === "World Cup" ? "wc48" : sample.comp === "European Championship" ? "euro24"
      : sample.comp === "Asian Cup" || sample.comp === "Africa Cup of Nations" ? "afc24" : null;
    const tables = w.facts.get(`${ed}:tables`) as Record<string, Row[]> | undefined;
    if (!layout || !tables || !Object.keys(tables).every((g) => /^[A-L]$/.test(g))) continue;
    const thirds = placed(w, tables, 2).slice(0, layout === "wc48" ? 8 : 4).map((r) => r.name);
    const groupOf = new Map<string, string>();
    for (const [g, rows] of Object.entries(tables)) for (const r of rows) groupOf.set(r.name, g);
    const want = realLayout(tables, layout, thirds, groupOf);
    const firstKo = w.edition(ed).filter((m) => !m.group).sort((a, b) => a.date - b.date).slice(0, layout === "wc48" ? 16 : 8);
    const got = new Set(firstKo.map((m) => [m.home, m.away].sort().join("|")));
    const exp = want ? Array.from({ length: want.length / 2 }, (_, i) => [want[2 * i], want[2 * i + 1]].sort().join("|")) : [];
    check(!!want && exp.every((p) => got.has(p)), `${ed}: first knockout round follows the real table`);
    checked++;
  }
  check(checked >= 10, `real knockout tables checked on ${checked} tournaments`);
  console.log(`Real knockout tables: ${checked} tournaments checked`);
}

// Nobody plays twice on one day.
const seen = new Map<string, string>();
for (const m of w.matches) for (const n of [m.home, m.away]) {
  const k = `${n}|${new Date(m.date).toISOString().slice(0, 10)}`;
  if (seen.has(k)) { check(false, `${n} plays twice on ${k.split("|")[1]} (${seen.get(k)} and ${m.id})`); break; }
  seen.set(k, m.id);
}
check(w.matches.every((m) => m.home !== m.away), "no team plays itself");
check(w.matches.every((m) => nationFor(m.home) && nationFor(m.away)), "every team is a FIFA nation");

// Russia: friendlies only.
check(w.matches.filter((m) => m.home === "Russia" || m.away === "Russia").every((m) => m.comp === "International Friendly"), "Russia plays friendlies only");

// Field sizes.
const sizes: [string, number, number[]][] = [
  ["EURO", 24, [2028, 2032, 2036, 2040, 2044]],
  ["COPA", 16, [2028, 2032, 2036, 2040, 2044]],
  ["AFCON", 24, [2027, 2028, 2032, 2036, 2040, 2044]],
  ["AC", 24, [2027, 2031, 2035, 2039, 2043]],
  ["GOLD", 16, [2027, 2029, 2031, 2033, 2035, 2037, 2039, 2041, 2043, 2045]],
  ["OFCNC", 8, [2028, 2032, 2036, 2040, 2044]],
  ["WC", 48, [2030, 2034, 2038, 2042, 2046]],
];
for (const [ed, n, years] of sizes) for (const y of years) {
  const groups = w.facts.get(`${ed}-${y}:groups`) as Record<string, string[]> | undefined;
  const teams = groups ? Object.values(groups).flat() : [];
  check(teams.length === n && new Set(teams).size === n, `${ed} ${y}: ${n} different teams (got ${teams.length})`);
  check(w.finals.some((f) => f.edition === `${ed}-${y}`), `${ed} ${y} has a final in the Who won list`);
}

// World Cup places per confederation, hosts inside them; draw limits.
for (const y of [2030, 2034, 2038, 2042, 2046]) {
  const q = w.facts.get(`WC-${y}:qualified`) as string[];
  const by: Record<string, number> = {};
  for (const n of q) { const c = nationFor(n)!.confederation; by[c] = (by[c] ?? 0) + 1; }
  for (const [c, s] of Object.entries(WC_SLOTS)) {
    check(by[c] >= s.direct && by[c] <= s.direct + s.ic, `WC ${y}: ${c} has ${by[c]} (places ${s.direct}${s.ic ? `+${s.ic} play-off` : ""})`);
  }
  for (const h of worldCupHosts(y)) check(q.includes(h), `WC ${y}: host ${h} is in`);
  const groups = w.facts.get(`WC-${y}:groups`) as Record<string, string[]>;
  for (const [g, t] of Object.entries(groups)) {
    const cs: Record<string, number> = {};
    for (const n of t) { const c = nationFor(n)!.confederation; cs[c] = (cs[c] ?? 0) + 1; }
    for (const [c, k] of Object.entries(cs)) check(k <= (c === "UEFA" ? 2 : 1), `WC ${y} group ${g}: ${k} from ${c}`);
  }
  check(w.edition(`WC-${y}`).length === 104, `WC ${y}: 104 matches (got ${w.edition(`WC-${y}`).length})`);
}

// Nations League: leagues stay whole; 2026–27 has the real groups.
const nl26 = w.facts.get("NL-2026:groups") as Record<string, Record<string, string[]>>;
check(JSON.stringify(nl26.A.A3) === JSON.stringify(["Spain", "England", "Croatia", "Czech Republic"].map((n) => nationFor(n)!.name)), "Nations League A3 is the real group");
for (const y of [2026, 2028, 2030, 2032]) {
  const o = w.facts.get(`NL-${y}:outcome`) as NlOutcome;
  const sz = Object.values(o.next).map((x) => x.length);
  const all = Object.values(o.next).flat();
  check(sz.length === 3 && sz.every((s) => s === 18), `NL ${y}→${y + 2}: three leagues of 18 (got ${sz.join("/")})`);
  check(new Set(all).size === 54, `NL ${y}→${y + 2}: all 54 once`);
}
check(w.finals.filter((f) => f.comp === "Nations League").length === 10, "ten Nations League finals 2027–2045");

// Asian Cup 2027 and AFCON 2027 dates (mid-season / summer).
const ac = w.edition("AC-2027");
check(new Date(ac[0].date).toISOString().startsWith("2027-01-07"), "Asian Cup 2027 starts 7 January");
const af = w.edition("AFCON-2027");
check(new Date(Math.max(...af.map((m) => m.date))).toISOString().startsWith("2027-07-17"), "AFCON 2027 final on 17 July");
const af32 = w.edition("AFCON-2032");
check(new Date(Math.min(...af32.map((m) => m.date))).getUTCMonth() === 11, "AFCON 2032 in the winter break (December start)");

// Same replay every time.
const w2 = newWorld({ xi: {}, played: {}, firstYear: 2026 });
w2.run(Date.UTC(2031, 0, 1));
const same = w2.matches.filter(played).every((m) => {
  const o = w.byId.get(m.id);
  return o && o.hs === m.hs && o.as === m.as;
});
check(same, "replaying gives the same results");

// Your result changes the world: make Scotland win every 2026 match.
const scot = w.matches.filter((m) => m.date < Date.UTC(2026, 11, 1) && (m.home === "Scotland" || m.away === "Scotland"));
const playedIn: Record<string, { hs: number; as: number }> = {};
for (const m of scot) playedIn[m.id] = m.home === "Scotland" ? { hs: 9, as: 0 } : { hs: 0, as: 9 };
const w3 = newWorld({ xi: {}, played: playedIn, firstYear: 2026 });
w3.run(Date.UTC(2026, 11, 1));
check(scot.every((m) => { const o = w3.byId.get(m.id); return o && (o.home === "Scotland" ? o.hs === 9 : o.as === 9); }), "your results are used as played");
const w5 = newWorld({ xi: {}, played: {}, firstYear: 2026 });
w5.run(Date.UTC(2026, 11, 1));
check((w3.points.get("Scotland") ?? 0) > (w5.points.get("Scotland") ?? 0) + 50, "winning every match lifts the ranking");

// Players adjust strength: give Scotland +8 for 2026/27 and they win more.
const w4 = newWorld({ xi: { 1: { Scotland: 8 } }, played: {}, firstYear: 2026 });
check(w4.strength("Scotland", Date.UTC(2026, 9, 1)) - w.strength("Scotland", Date.UTC(2026, 9, 1)) > 7, "player adjustment moves strength");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 40)) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`PASS — ${w.matches.length} international matches 2026–2046 (${ms} ms), every competition keeps its rules`);
