/**
 * FUN TARGETS v0 (DRAFT) — does the real unseen match hand each position what
 * Harry's table asks for? lib/star/funTargets.ts holds the table.
 *
 * Plays the real radar (hiddenMatch tick/resolveScenario with the inputs
 * CanvasMatch passes) 1,000 matches for each position × 3 strength gaps.
 * Guardrails (match shots 21-28, Premier League season goals never above 36)
 * FAIL the test. A missed target only prints ✗.
 *
 * The radar has no league input yet (step 2), so each number is shown against
 * the National League and the Premier League target side by side.
 */
import { reportAll, rowsFor, impliedConversion, guardrailProblems, GAPS } from "../../lib/star/funTargetsMeasure";
import { formatBand, formatValue } from "../../lib/star/funTargets";

const MATCHES = Number(process.argv[2] ?? 1000);
const t0 = Date.now();
const reports = reportAll(MATCHES);
const tick = (b: boolean) => (b ? "✓" : "✗");

console.log(`FUN TARGETS v0 (draft) — ${MATCHES} real radar matches per position per gap. Radar has no league input yet — step 2.`);
for (const r of reports) {
  console.log(`\n== ${r.pos}  (even game)`);
  const rows = rowsFor(r.pos, r.gaps.even);
  for (const x of rows) {
    console.log(`  ${x.label.padEnd(26)} ours ${formatValue(x.ours, x.unit).padStart(5)}   National League ${tick(x.okNational)} ${formatBand(x.national, x.unit).padEnd(16)} Premier ${tick(x.okPremier)} ${formatBand(x.premier, x.unit)}`);
  }
  const imp = impliedConversion(r.pos, r.gaps.even.chances).map((i) => `${i.level === "national" ? "NL" : "Prem"} rating ${i.rating}: ${i.goals} goals = ${(i.needs * 100).toFixed(1)}% of chances`).join(" · ");
  console.log(`  Season goals (not judged: the radar cannot play your shots) need: ${imp}`);
  console.log(`  Shots a match (both sides)  ours ${r.gaps.even.shots.toFixed(1)}   guardrail 21–28`);
  console.log("  Health, by gap:");
  for (const g of GAPS) {
    const m = r.gaps[g.id];
    console.log(`    ${g.label.padEnd(6)} chances ${m.chances.toFixed(1)} · fallback ${(m.fallback * 100).toFixed(0)}% · longest wait ${m.longestWait.toFixed(0)}' · nothing by 20' ${(m.nothingBy20 * 100).toFixed(0)}% · final third ${(m.finalThird * 100).toFixed(0)}% · shots ${m.shots.toFixed(1)}`);
  }
}

const problems = guardrailProblems(reports);
const secs = (Date.now() - t0) / 1000;
console.log(`\nRan in ${secs.toFixed(1)}s.`);
if (secs > 60) problems.push(`took ${secs.toFixed(0)}s, over the one-minute budget`);
if (problems.length) { console.log("\nGUARDRAILS BROKEN:"); for (const p of problems) console.log("  FAIL " + p); process.exit(1); }
console.log("funTargets: guardrails hold (missed targets above are reports, not failures)");
