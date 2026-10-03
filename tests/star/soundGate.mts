/**
 * tests/star/soundGate.mts — sounds are not repeated on top of each other (v0.25 item 6).
 *
 * Harry and Mikey, live on their phones: "the sound effects are too frequent".
 * Counts what plays through the gate against what was asked for.
 */
import { makeSoundGate, MIN_GAP_MS, MAX_AT_ONCE, WINDOW_MS } from "@/lib/star/soundGate";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("\nTHE SAME SOUND");
{
  const g = makeSoundGate();
  let played = 0;
  for (let i = 0; i < 5; i++) if (g("achievement-pop", 1000 + i * 100)) played++;
  console.log(`  five unlock pops 100 ms apart: asked 5, played ${played}`);
  ok(played === 1, "a burst of the same sound plays once");
  ok(g("achievement-pop", 1000 + MIN_GAP_MS["achievement-pop"] + 1), "it plays again once its gap has passed");
}
{
  const g = makeSoundGate();
  let played = 0;
  for (let t = 0; t < 10_000; t += 50) if (g("whistle", t)) played++;
  console.log(`  a whistle asked for every 50 ms for 10 s: asked 200, played ${played}`);
  ok(played <= Math.ceil(10_000 / MIN_GAP_MS.whistle) + 1, "a whistle never plays more than once per its gap");
}

console.log("\nMANY AT ONCE");
{
  const g = makeSoundGate();
  const names = ["net", "crowd-cheer", "whistle", "save", "post", "kick"];
  const played = names.filter((n) => g(n, 5000)).length;
  console.log(`  six different sounds in the same instant: played ${played}`);
  ok(played === MAX_AT_ONCE, `no more than ${MAX_AT_ONCE} start together`);
  ok(g("level-up", 5000 + WINDOW_MS + 1), "a new sound plays once the moment has passed");
}

console.log("\nA GOAL STILL SOUNDS LIKE A GOAL");
{
  const g = makeSoundGate();
  ok(g("kick", 0) && g("net", 900) && g("crowd-cheer", 900), "kick, then net and the crowd together");
}

console.log("\nEACH PLAYER HAS ITS OWN MEMORY");
{
  const a = makeSoundGate(), b = makeSoundGate();
  ok(a("ui-confirm", 0) && b("ui-confirm", 0), "the UI and the match do not block each other");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nAll checks passed.\n");
