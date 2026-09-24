/**
 * ONE ENGINE — the test-suite face of scripts/one-engine-guard.mjs.
 *
 * The guard itself lives in that script so the Vercel build can run it with
 * plain `node` (inside package.json "build") — no copy of its rules here, which
 * would be exactly the kind of drift the guard exists to stop. Read the
 * script's header for the rules and why they exist.
 *
 * Run: npx tsx tests/star/oneEngine.mts
 */
// @ts-expect-error — a plain .mjs script with no type declarations.
import { scan, judge, KNOWN_COPIES, CEILING, KNOWN_CANVASES, CANVAS_CEILING, CANARY_EXPECT, CANARY_CLEAN } from "../../scripts/one-engine-guard.mjs";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const findings = scan() as Map<string, Set<string>>;
const { problems, copies } = judge(findings) as { problems: string[]; notes: string[]; copies: string[] };

console.log("\nTHE GUARD PASSES ON THE CODE AS IT STANDS");
for (const p of problems) ok(false, p);
ok(problems.length === 0, "no new copies of the match loop; <CanvasMatch> mounted only by the real match and EnginePlay");

console.log("\nIT IS NOT BLIND");
for (const f of Object.keys(CANARY_EXPECT)) ok(findings.has(f), `sees the planted copy in ${f}`);
console.log("\nIT IS NOT JUMPY");
for (const f of CANARY_CLEAN as string[]) ok(!findings.has(f), `leaves the harmless look-alike in ${f} alone`);

console.log("\nTHE LIST ONLY SHRINKS");
ok(Object.keys(KNOWN_COPIES).length <= CEILING, `${Object.keys(KNOWN_COPIES).length} known copies, ceiling ${CEILING}`);
ok(Object.keys(KNOWN_CANVASES).length <= CANVAS_CEILING, `${Object.keys(KNOWN_CANVASES).length} own canvas loops, ceiling ${CANVAS_CEILING}`);
ok(copies.every((f) => f in KNOWN_COPIES), "every copy found is one already on the list");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
