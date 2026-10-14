/**
 * tests/star/tuningSession.mts — the Tuning panel's sums (lib/star/tuningSession.ts)
 * and the note shape check (lib/star/tuningNotes.ts).
 */
import { summarise, zoneOf, laneOf, feelOf, type SeenChance } from "@/lib/star/tuningSession";
import { isTuningNote, makeNote } from "@/lib/star/tuningNotes";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("\nTUNING SESSION");
ok(zoneOf({ x: 34, y: 8 }) === "box", "a ball 8 m out, central, is in the box");
ok(zoneOf({ x: 34, y: 30 }) === "final_third", "30 m out is the final third");
ok(zoneOf({ x: 34, y: 45 }) === "middle", "45 m out is midfield");
ok(zoneOf({ x: 34, y: 70 }) === "own_half", "70 m out is your own half");
ok(laneOf({ x: 10, y: 30 }) === "left" && laneOf({ x: 60, y: 30 }) === "right" && laneOf({ x: 34, y: 30 }) === "centre", "lanes: x small is the left wing");

ok(summarise([]).total === 0 && summarise([]).lines.length === 0, "nothing seen: no lines");

const band = { low: 0.5, target: 0.6, high: 0.7, mark: "target" as const };
ok(feelOf(0.6, band, 3) === "too few to tell", "under 5 chances: too few to tell");
ok(feelOf(0.8, band, 10) === "a lot" && feelOf(0.4, band, 10) === "a little" && feelOf(0.6, band, 10) === "about right", "a lot / a little / about right");

// A winger on the right who never gets the ball on his side.
const seen: SeenChance[] = [];
for (let i = 0; i < 10; i++) {
  seen.push({ page: "match", kind: i < 7 ? "cutback" : "corner", ball: { x: 12, y: 20 }, minute: (i + 1) * 9, match: "1", position: "RW", league: "premier", at: i });
}
const s = summarise(seen);
const line = (k: string) => s.lines.find((l) => l.key === k);
ok(s.mix[0].kind === "cutback" && Math.abs(s.mix[0].share - 0.7) < 1e-9, "mix: cutback 70%");
ok(line("mix")?.feel === "too few to tell", "10 chances is too few to judge the mix");
ok(line("ownWing")?.value === 0 && line("ownWing")?.feel === "a little", "right winger, every ball on the left: own wing 0%, a little");
ok(line("finalThird")?.value === 1, "every ball 20 m out: all up the pitch");
ok(Math.abs((line("perMatch")?.value ?? 0) - 10) < 1e-9, "10 chances in 90 minutes: 10 a match");
ok(line("perMatch")?.feel === "a lot", "10 a match is above the draft 5–9");
ok(line("longestWait")?.value === 9 && line("longestWait")?.feel === "about right", "every 9 minutes: longest wait 9, about right");
ok(s.position === "W" && s.level === "premier", "position and league come from the match");

// Gallery-only chances: no clock, so no per-match lines.
const g = summarise([{ page: "gallery", kind: "one_on_one", ball: { x: 34, y: 14 }, at: 1 }]);
ok(!g.lines.some((l) => l.key === "perMatch") && g.byPage.gallery === 1, "gallery chances have no per-match line");

console.log("\nTUNING NOTES");
const n = makeNote({ chips: ["too many cutbacks"], text: "  far too many  ", page: "/star-play-dev", kind: "cutback", seed: 1001, minute: 40 });
ok(isTuningNote(n) && n.text === "far too many", "a made note passes and is trimmed");
ok(!isTuningNote({ ...n, chips: [], text: "" }), "an empty note is refused");
ok(!isTuningNote({ ...n, text: "x".repeat(501) }), "an over-long line is refused");
ok(!isTuningNote({ ...n, id: "bad id!" }), "a strange id is refused");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
