import {
  newLegendCode, parseLegendCode, legendUrl, spacedCode, LEGEND_CODE, LEGEND_ALPHABET, legendProblem,
  compareRows, compareScore,
} from "../../lib/star/legendShare";
import { careerOverview } from "../../lib/star/careerOverview";
import { previewCareer } from "../../lib/star/retirementPreview";
import { mulberry32 } from "../../lib/star/season";

/**
 * SHARE A CAREER BY CODE (Leo, 6 Oct 2026: "Online: share a career, compare
 * with a friend"). See lib/star/legendShare.ts.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── Codes ───────────────────────────────────────────────────────────────────
{
  const rng = mulberry32(42);
  const codes = Array.from({ length: 2000 }, () => newLegendCode(rng));
  check(codes.every(c => LEGEND_CODE.test(c)), "every code is six letters and digits");
  check(codes.every(c => !/[IO01]/.test(c)), "never a look-alike (I, O, 0, 1)");
  check(new Set(codes).size > 1990, `codes are spread out (${new Set(codes).size} different in 2000)`);
  check(LEGEND_ALPHABET.length === 32, "32 symbols: about a billion codes");
  check(newLegendCode(() => 0.999999) === "999999", "the top of the alphabet is reachable");
}

// ── Reading what a friend pasted ────────────────────────────────────────────
{
  check(parseLegendCode("K7Q2XM") === "K7Q2XM", "a code");
  check(parseLegendCode(" k7q 2xm ") === "K7Q2XM", "lower case, spaces");
  check(parseLegendCode("K7Q-2XM") === "K7Q2XM", "a dash");
  check(parseLegendCode("https://knowitball.co.uk/legend/K7Q2XM") === "K7Q2XM", "the whole link");
  check(parseLegendCode("look at mine knowitball.co.uk/legend/k7q2xm !") === "K7Q2XM", "a link in a message");
  check(parseLegendCode("K7Q2X") === null && parseLegendCode("K7Q2XMM") === null, "five or seven: not a code");
  check(parseLegendCode("KIQ2XM") === null && parseLegendCode("K0Q2XM") === null, "a look-alike: not a code");
  check(parseLegendCode("") === null && parseLegendCode(null) === null, "nothing");
  check(legendUrl("K7Q2XM", "https://knowitball.co.uk/") === "https://knowitball.co.uk/legend/K7Q2XM", "the link");
  check(spacedCode("K7Q2XM") === "K7Q 2XM", "spaced to read out");
  check(legendProblem("not-found").length > 0 && legendProblem("bad-code").includes("K7Q2XM"), "plain words when it fails");
}

// ── Comparing two careers ───────────────────────────────────────────────────
{
  const legend = careerOverview(previewCareer("legend", 1));
  const quiet = careerOverview(previewCareer("quiet", 1));
  const rows = compareRows(legend, quiet);
  check(rows.length >= 10, `one bar per number (${rows.length})`);
  const goals = rows.find(r => r.label === "Goals")!;
  check(goals.a === legend.totals.goals && goals.b === quiet.totals.goals, "the numbers are the careers' own");
  const score = compareScore(rows);
  check(score.a > score.b, `the legend wins more numbers (${score.a} v ${score.b})`);
  const same = compareScore(compareRows(legend, legend));
  check(same.a === 0 && same.b === 0, "a career against itself: nobody wins a number");
  check(!rows.find(r => r.label === "Clubs") || compareScore([rows.find(r => r.label === "Clubs")!]).a === 0, "more clubs is not better or worse");
}

if (problems.length) { console.error("legendShare FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("legendShare: all checks passed");
