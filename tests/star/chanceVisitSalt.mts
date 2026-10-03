/**
 * tests/star/chanceVisitSalt.mts — the same match started again does not open
 * on the same long shot (v0.25 item 15).
 *
 * Harry: "on one computer the same long-shot highlight comes up every time."
 * A match is seeded by its week, so a restart asks for the same chance with
 * the same random numbers. The picture memory stops a repeat — unless the
 * browser's storage is full or blocked, when it is lost at every reload.
 * chanceMaker's visit salt turns which drawing (and which side) is tried
 * first, per page visit, without drawing any extra random numbers.
 */
const mode = { store: "full" as "ok" | "full" };
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  addEventListener() {}, removeEventListener() {}, location: { pathname: "/star-dev" },
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { if (mode.store !== "ok") throw new Error("QuotaExceededError"); store.set(k, v); },
    removeItem: (k: string) => store.delete(k),
  },
};
const C = await import("@/lib/star/chanceMaker");
const { mulberry32 } = await import("@/lib/star/season");

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const key = (sc: Parameters<typeof C.pictureOf>[0]) => {
  const p = C.pictureOf(sc);
  return `${Math.round(p.ball.x)},${Math.round(p.ball.y)}|${Math.round(p.you.x)},${Math.round(p.you.y)}|${p.defenders.length}`;
};
function restarts(salted: boolean): number {
  store.clear();
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    C.setVisitSalt(salted ? Math.imul(i + 1, 2654435761) >>> 0 : 0);
    const mem = new C.PictureMemory("game", true);   // a page reload: reads storage again
    const m = C.makeChance({ source: { from: "kind", kind: "long_range" }, rng: mulberry32(2005), memory: mem });
    seen.add(key(m.sc));
  }
  return seen.size;
}

console.log("\nTHE SAME MATCH STARTED 50 TIMES, STORAGE FULL");
mode.store = "full";
const before = restarts(false), after = restarts(true);
console.log(`  distinct opening long shots: before ${before}, after ${after}`);
ok(before === 1, "without the salt it was the same long shot every time (the reported bug)");
ok(after >= 10, "with it the opening long shot changes from visit to visit");

console.log("\nSTORAGE WORKING");
mode.store = "ok";
const okBefore = restarts(false), okAfter = restarts(true);
console.log(`  distinct opening long shots: before ${okBefore}, after ${okAfter}`);
ok(okAfter >= okBefore, "no worse where the memory already worked");

// v0.25 item 12, seen on screen: a career match's opening chance was a kind
// with no drawings (the builder / the formula's plan). That path never read
// the salt, so restarting the match put the ball on the same pixel 6 times
// out of 6, salt or no salt.
console.log("\nA KIND WITH NO DRAWINGS (THE BUILDER / THE PLAN)");
for (const kind of ["through_ball"] as const) {
  ok(!C.servesDrawings(kind), `${kind} has no drawings, so it takes this path`);
  const open = (salt: number) => {
    C.setVisitSalt(salt);
    const mem = new C.PictureMemory("game", true);
    return key(C.makeChance({ source: { from: "kind", kind }, rng: mulberry32(2005), memory: mem }).sc);
  };
  const unsalted = new Set<string>(), salted = new Set<string>();
  for (let i = 0; i < 30; i++) { unsalted.add(open(0)); salted.add(open(Math.imul(i + 1, 2654435761) >>> 0)); }
  console.log(`  ${kind}, 30 restarts: distinct opening pictures ${unsalted.size} without the salt, ${salted.size} with it`);
  ok(unsalted.size === 1, "without the salt it is the same picture every restart (what Harry saw)");
  ok(salted.size >= 10, "with it the picture changes from visit to visit");
}
{
  // Same count of random numbers drawn, salt or not (the match plays on).
  let n0 = 0, n1 = 0;
  const counted = (cnt: () => void) => { const r = mulberry32(99); return () => { cnt(); return r(); }; };
  C.setVisitSalt(0);
  C.makeChance({ source: { from: "kind", kind: "through_ball" }, rng: counted(() => n0++), memory: new C.PictureMemory("game", true) });
  C.setVisitSalt(424242);
  C.makeChance({ source: { from: "kind", kind: "through_ball" }, rng: counted(() => n1++), memory: new C.PictureMemory("game", true) });
  ok(n0 > 0 && Math.abs(n0 - n1) <= Math.max(2, n0 * 0.5), `about as many random numbers drawn either way (${n0} vs ${n1})`);
  const r = C.saltedRng(mulberry32(5), 0), base = mulberry32(5);
  ok(r() === base(), "no salt: the stream itself, untouched");
}

console.log("\nNO MEMORY (a gallery cell) IS UNCHANGED");
C.setVisitSalt(123456789);
const a = key(C.makeChance({ source: { from: "kind", kind: "long_range" }, rng: mulberry32(77), memory: null }).sc);
C.setVisitSalt(0);
const b = key(C.makeChance({ source: { from: "kind", kind: "long_range" }, rng: mulberry32(77), memory: null }).sc);
ok(a === b, "the salt is ignored without a memory");

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nAll checks passed.\n");
