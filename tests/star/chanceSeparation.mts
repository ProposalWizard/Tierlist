/**
 * tests/star/chanceSeparation.mts — the New chances stay out of the gallery.
 *
 * Harry, 3 Oct 2026: "these new scenarios need to be separate to the scenario
 * gallery for now please - just in case they suck."
 *
 *  1. The pin (lib/star/chanceSet.ts): the game always serves the drawn
 *     chances (decided 12 Oct 2026); only a test page's "new" pin serves the
 *     library, and lifting it goes straight back to the drawn chances.
 *  2. The mark (lib/star/libraryMark.ts): makeChance stamps every New-set
 *     chance, the stamp survives the match's structuredClone snapshot, and a
 *     Classic chance carries none.
 *  3. Save/Commit (lib/star/liveEdit.ts): a stamped chance is refused with the
 *     plain message; a Classic one still saves.
 *  4. The gallery never reads the library or the New drawings file.
 */
import { readFileSync } from "node:fs";
import { mulberry32 } from "@/lib/star/season";
import type { ScenarioKind } from "@/lib/star/canvasEngine";
import { chanceSet, chanceSetChoice, chanceSetPin, pinChanceSet } from "@/lib/star/chanceSet";
import { makeChance } from "@/lib/star/chanceMaker";
import { ChanceDeck, libraryFor } from "@/lib/star/chanceLibrary";
import { newChanceMark, NEW_CHANCE_REFUSAL, isNewChanceRefused } from "@/lib/star/libraryMark";
import { liveMatchScenario, liveSaveRefusal } from "@/lib/star/liveEdit";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

// ── 1. The pin ── (12 Oct 2026: no in-game choice any more; drawn chances only)
console.log("\nTHE PIN");
ok(chanceSetChoice() === "classic", "the game's own choice is always the drawn chances");
ok(chanceSet() === "classic" && chanceSetPin() === null, "no pin: serves the drawn chances");
const liftNew = pinChanceSet("new");
ok(chanceSet() === "new", "the New Chances test page's pin serves the library");
const liftC = pinChanceSet("classic");
ok(chanceSet() === "classic", "a newer Classic pin wins");
liftC();
ok(chanceSet() === "new", "lifting the newer pin goes back to the older one");
liftNew();
ok(chanceSet() === "classic" && chanceSetPin() === null, "lifted: back to the drawn chances");
liftNew();
ok(chanceSet() === "classic", "lifting twice is harmless");
// React mounts an effect twice in development: pin, lift, pin.
const a = pinChanceSet("new"); a(); const b = pinChanceSet("new");
ok(chanceSet() === "new", "pin, lift, pin (a double-mounted effect) leaves exactly one pin");
b();
ok(chanceSetPin() === null, "and lifting it leaves none");

// What the match actually serves under each — CanvasMatch passes `chanceSet()`.
const kinds = (["one_on_one", "cutback", "through_ball", "corner", "free_kick", "long_range"] as ScenarioKind[])
  .filter((k) => libraryFor(k).length > 0);
ok(kinds.length >= 4, `the library has pictures of ${kinds.length} of the kinds checked`);
const serve = (k: ScenarioKind, i: number) => makeChance({
  source: { from: "kind", kind: k }, rng: mulberry32(9_000 + i), memory: null,
  set: chanceSet(), deck: new ChanceDeck(`sep-${i}`, false),
});
let pinnedMarked = 0, freeMarked = 0, n = 0;
kinds.forEach((k, ki) => { for (let i = 0; i < 20; i++) { n++; if (newChanceMark(serve(k, ki * 100 + i).sc)) pinnedMarked++; } });
const unpin = pinChanceSet("new");
kinds.forEach((k, ki) => { for (let i = 0; i < 20; i++) { if (newChanceMark(serve(k, ki * 100 + i).sc)) freeMarked++; } });
unpin();
ok(pinnedMarked === 0, `the match (no pin): 0 of ${n} served chances are New (got ${pinnedMarked})`);
ok(freeMarked === n, `the New Chances test page's pin: ${freeMarked} of ${n} served chances are New`);

// ── 2. The mark ──
console.log("\nTHE MARK");
const lib = makeChance({ source: { from: "kind", kind: kinds[0] }, rng: mulberry32(1), memory: null, set: "new", deck: new ChanceDeck("m", false) });
const mark = newChanceMark(lib.sc);
ok(lib.how === "library" && mark?.from === "library" && mark.id === lib.sourceId, `a library chance is stamped with its picture (${mark?.id})`);
ok(newChanceMark(structuredClone(lib.sc))?.id === mark?.id, "the stamp survives the match's structuredClone snapshot");
const classic = makeChance({ source: { from: "kind", kind: kinds[0] }, rng: mulberry32(1), memory: null });
ok(newChanceMark(classic.sc) === null, "a Classic chance carries no stamp");
// A kind the library has no picture of is still served the New way (the rest
// of both teams added) and is stamped too.
const noLib = (["header", "volley", "midfield_pass", "buildup", "tight_angle", "byline_cross", "penalty"] as ScenarioKind[])
  .find((k) => libraryFor(k).length === 0);
if (noLib) {
  const ctx = makeChance({ source: { from: "kind", kind: noLib }, rng: mulberry32(2), memory: null, set: "new" });
  ok(newChanceMark(ctx.sc)?.from === "context" || newChanceMark(ctx.sc)?.from === "library", `a New chance of a kind with no library picture (${noLib}) is stamped too`);
}

// ── 3. Save / Commit ──
console.log("\nSAVE / COMMIT");
ok(liveSaveRefusal(lib.sc) === NEW_CHANCE_REFUSAL, "Save/Commit refuse a library chance with the plain message");
ok(liveSaveRefusal(structuredClone(lib.sc)) === NEW_CHANCE_REFUSAL, "…and the match's snapshot of it");
let threw: unknown = null;
try { liveMatchScenario(structuredClone(lib.sc), 30); } catch (e) { threw = e; }
ok(isNewChanceRefused(threw) && (threw as Error).message === NEW_CHANCE_REFUSAL, "liveMatchScenario throws rather than build a gallery card from it");
ok(liveSaveRefusal(classic.sc) === null, "a Classic chance is not refused");
let saved: { id?: string } | null = null;
try { saved = liveMatchScenario(classic.sc, 30); } catch { saved = null; }
ok(!!saved && !!saved.id?.startsWith(`gallery-v-${classic.sc.kind}-`), "…and still saves as a gallery card");

// The commit route and the shared-list route check the stamp too.
for (const route of ["app/api/star/scenarios/commit/route.ts", "app/api/star/scenarios/route.ts"]) {
  const src = readFileSync(new URL(`../../${route}`, import.meta.url), "utf8");
  ok(src.includes("newChanceMark(") && src.includes("NEW_CHANCE_REFUSAL"), `${route} refuses a stamped chance`);
}

// ── 4. The gallery never reads the New set ──
console.log("\nTHE GALLERY");
for (const file of ["app/star-gallery-dev/page.tsx", "lib/star/gallerySim.ts", "app/star-highlights-dev/page.tsx"]) {
  let src = "";
  try { src = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"); } catch { continue; }
  ok(!/chanceLibrary|authoredScenariosNew|set:\s*"new"/.test(src), `${file} does not read the new library or the New drawings`);
}
// EnginePlay is where the test screens get their pin.
const ep = readFileSync(new URL("../../components/star/EnginePlay.tsx", import.meta.url), "utf8");
ok(/pinChanceSet\(newChances \? "new" : "classic"\)/.test(ep), "EnginePlay pins Classic unless a page asks for the New set");

if (failed) { console.error(`\nFAIL — chanceSeparation (${failed})`); process.exit(1); }
console.log("\nPASS — chanceSeparation");
