import { makeChance } from "../../lib/star/chanceMaker";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { EVEN_KIND_MIX, EVEN_KINDS, newKindBag, nextEvenKind } from "../../lib/star/kindMix";
import { kindsForZone } from "../../lib/star/hiddenMatch";
import type { ScenarioKind } from "../../lib/star/canvasEngine";

/**
 * AN EVEN MIX OF HIGHLIGHTS (lib/star/kindMix.ts). Harry, 3 Oct 2026: "too
 * many cutbacks … evenly distribute highlights for now."
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
function mulberry32(a: number) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

check(EVEN_KIND_MIX, "the even mix is on");
check(!EVEN_KINDS.includes("volley") && !EVEN_KINDS.includes("header"), "switched-off kinds stay out");

// The bag: each kind once per round, never twice in a row.
const bag = newKindBag(), rng = mulberry32(7);
let prev: ScenarioKind | undefined;
for (let round = 0; round < 500; round++) {
  const seen = new Set<ScenarioKind>();
  for (let i = 0; i < EVEN_KINDS.length; i++) {
    const k = nextEvenKind(bag, rng);
    check(k !== prev, `round ${round}: ${k} twice in a row`);
    seen.add(k); prev = k;
  }
  check(seen.size === EVEN_KINDS.length, `round ${round}: not every kind once`);
}

// Through the real chance maker, with requests that used to favour cutbacks.
const counts: Record<string, number> = {};
const sel = newSelectionMemory();
const r2 = mulberry32(11);
const N = 1600;
for (let i = 0; i < N; i++) {
  const zone = i % 2 ? "box" : "attacking";
  const request = { zone, kinds: kindsForZone(zone as "box", "left"), reason: "test", lane: "left" as const };
  const made = makeChance({ source: { from: "request", request, position: "RW" }, rng: r2, selection: sel });
  counts[made.sc.kind] = (counts[made.sc.kind] ?? 0) + 1;
}
const share = N / EVEN_KINDS.length;
for (const k of EVEN_KINDS) check(Math.abs((counts[k] ?? 0) - share) <= 1, `${k}: ${counts[k] ?? 0} of ${N}, wanted ${share}`);

// A set piece is still a set piece.
const corner = makeChance({
  source: { from: "request", request: { zone: "box", kinds: ["corner"], reason: "corner", pattern: "set_piece" }, position: "ST" },
  rng: mulberry32(3), selection: newSelectionMemory(),
});
check(corner.sc.kind === "corner", "a corner request still gives a corner");

if (problems.length) { console.error(problems.slice(0, 20).join("\n")); process.exit(1); }
console.log("kindMix: " + EVEN_KINDS.map((k) => `${k} ${counts[k]}`).join(", "));
