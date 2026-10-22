/**
 * REAL MOMENT HIGHLIGHTS (lib/star/fhr/realMomentHighlights.ts) — real moments
 * served as the real game's chances (Harry, 20 Oct 2026: "try the real moments
 * feeding the real game's chances … how do we keep track of it, and how do we
 * edit it").
 *
 *   1. Off changes nothing: the switch is Off on a new phone, needs the
 *      rebuild On to count, and Off draws no random number.
 *   2. The share: about 1 in REAL_MOMENT_SHARE_IN of the open-play chances of a
 *      kind the real moments have is real, over whole matches through the real
 *      unseen match and the real chance maker.
 *   3. The kind the match asked for is the kind served, and the picture is the
 *      real one (the real ball, the real keeper held where he stood).
 *   4. The picks: "Don't use" is never served, "Use in game" lets a moment in
 *      that a check left out, and the committed file merges cleanly.
 *   5. The build-up is the real 4 s, ends exactly on the chance, and only for a
 *      fresh chance that really is a real moment.
 *   6. Every data credit line is LICENCES.md's.
 *
 * Run: npx tsx tests/star/realMomentHighlights.mts
 */
import { readFileSync } from "node:fs";
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { forceRealMomentsMode, realMomentsMode, realMomentsOn, REAL_MOMENTS_DEFAULT } from "../../lib/star/fhr/realMomentToggle";
import {
  buildRealMomentPool, setRealMomentPool, serveRealMoment, realMomentIdOf, realMomentLeadIn, servable, inGameIds,
  autoCheck, resetRealMomentMemory, REAL_MOMENT_SHARE, REAL_MOMENT_KINDS, type RealMomentPool,
} from "../../lib/star/fhr/realMomentHighlights";
import { setPicksOverlay, mergePicksFile, pickOf, cleanPicks } from "../../lib/star/realMoments/picks";
import { peopleOf, type TrackedFile, type TrackFile, type RealShot } from "../../lib/star/realMoments";
import { newMatch, advanceUntilInvolved, resolveScenario } from "../../lib/star/hiddenMatch";
import { makeChance, PictureMemory } from "../../lib/star/chanceMaker";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { mulberry32, standInResult, RULER_INPUTS } from "../../lib/star/fhr/ruler";
import { careerBuildUp } from "../../lib/star/leadInGen";
import { leadInEntities } from "../../lib/star/leadIn";
import { DATA_CREDITS } from "../../lib/star/dataCredits";
import { isAirKind, airWaitZ, type AirHeighted } from "../../lib/star/airDrawings";
import type { ScenarioKind } from "../../lib/star/canvasEngine";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const share = (n: number, of: number) => `${n}/${of} (${((100 * n) / Math.max(1, of)).toFixed(1)}%)`;
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const tracked = JSON.parse(readFileSync("data/realmoments/tracked.json", "utf8")) as TrackedFile;
const tracks = JSON.parse(readFileSync("data/realmoments/tracks.json", "utf8")) as TrackFile;
const pool: RealMomentPool = buildRealMomentPool(tracked, tracks);
const clear = () => { forceFhrMode(null); forceRealMomentsMode(null); setPicksOverlay({}); resetRealMomentMemory(); };

/** Count the random numbers a call draws. */
const counting = (seed: number) => { const r = mulberry32(seed); let n = 0; return { rng: () => { n++; return r(); }, n: () => n }; };

console.log("\n1. OFF CHANGES NOTHING");
{
  clear();
  ok(REAL_MOMENTS_DEFAULT === "off" && realMomentsMode() === "off", "a new phone reads Off");
  forceFhrMode("off"); forceRealMomentsMode("on"); // the rebuild is On by default since 22 Oct 2026, so switch it Off here
  ok(!realMomentsOn(), "On does nothing while the Full highlights rebuild is Off");
  forceFhrMode("on");
  ok(realMomentsOn(), "On counts once the rebuild is On");
  forceRealMomentsMode("off");
  setRealMomentPool(pool);
  const c = counting(3);
  let served = 0;
  for (let i = 0; i < 200; i++) if (serveRealMoment("one_on_one", c.rng)) served++;
  ok(served === 0 && c.n() === 0, `Off: nothing served and no random number drawn (${served} served, ${c.n()} draws)`);
  clear();
}

console.log("\n2. THE SHARE (whole matches, the real unseen match and the real chance maker)");
const runMatches = (matches: number) => {
  const memory = new PictureMemory("rmh-test", false);
  let open = 0, eligible = 0, real = 0, kindOk = 0, ballOk = 0, keeperOk = 0, keepers = 0, setPieceReal = 0;
  for (let m = 0; m < matches; m++) {
    const seed = 101 + m * 7919;
    const rng = mulberry32(seed), engineRng = mulberry32(seed ^ 0x5eed);
    const state = newMatch(rng);
    const selection = newSelectionMemory();
    for (;;) {
      const step = advanceUntilInvolved(state, RULER_INPUTS, rng, 90);
      if (!step.request) break;
      const req = step.request;
      if (!req.dribble) {
        const made = makeChance({ source: { from: "request", request: req, position: "ST" }, rng: engineRng, memory, selection });
        const setPiece = req.pattern === "set_piece";
        if (!setPiece) {
          open++;
          if ((REAL_MOMENT_KINDS as readonly string[]).includes(made.sc.kind)) eligible++;
        }
        if (made.how === "real") {
          real++;
          if (setPiece) setPieceReal++;
          const id = realMomentIdOf(made.sc);
          const mo = tracked.moments.find((x) => x.id === id) as RealShot | undefined;
          if (mo && made.sourceId === id) {
            if (made.sc.kind === kindOfPool(id!)) kindOk++;
            if (d(made.sc.ball, { x: mo.ball[0], y: mo.ball[1] }) < 0.01) ballOk++;
            const k = peopleOf(mo).keeper;
            if (k) { keepers++; if (made.sc.keeperHoldsStart && d(made.sc.keeper, k) < 1.5) keeperOk++; }
          }
        }
      }
      resolveScenario(state, standInResult(req.zone, rng));
    }
  }
  return { open, eligible, real, kindOk, ballOk, keeperOk, keepers, setPieceReal };
};
const kindOfPool = (id: string): ScenarioKind | undefined => {
  for (const [k, list] of Array.from(pool.byKind.entries())) if (list.some((m) => m.id === id)) return k;
  return undefined;
};
let r2: ReturnType<typeof runMatches>;
{
  clear();
  forceFhrMode("on");
  const offRun = runMatches(30);
  ok(offRun.real === 0, `rebuild On, Real moment highlights Off: no real moment in 30 matches (${offRun.real})`);
  forceRealMomentsMode("on");
  setRealMomentPool(null);
  const noPool = runMatches(5);
  ok(noPool.real === 0, `On but the moments not loaded yet: every chance is the game's own (${noPool.real})`);
  setRealMomentPool(pool);
  r2 = runMatches(120);
  const frac = r2.real / Math.max(1, r2.eligible);
  console.log(`  ${r2.open} open-play chances, ${r2.eligible} of a real-moment kind, ${r2.real} real`);
  ok(Math.abs(frac - REAL_MOMENT_SHARE) < 0.06, `about 1 in ${Math.round(1 / REAL_MOMENT_SHARE)} of the chances of those kinds is real: ${share(r2.real, r2.eligible)}`);
  ok(r2.real / Math.max(1, r2.open) > 0.05, `some of all open-play chances are real: ${share(r2.real, r2.open)}`);
  ok(r2.setPieceReal === 0, `never a set piece (${r2.setPieceReal})`);
  clear();
}

console.log("\n3. THE KIND ASKED FOR, AND THE REAL PICTURE");
{
  ok(r2!.kindOk === r2!.real, `the kind served is the kind the match asked for: ${share(r2!.kindOk, r2!.real)}`);
  ok(r2!.ballOk === r2!.real, `the real ball where it was struck: ${share(r2!.ballOk, r2!.real)}`);
  ok(r2!.keeperOk === r2!.keepers, `the real keeper held where he stood: ${share(r2!.keeperOk, r2!.keepers)}`);
  // Directly, kind by kind.
  forceFhrMode("on"); forceRealMomentsMode("on"); setRealMomentPool(pool);
  for (const k of REAL_MOMENT_KINDS) {
    const rng = mulberry32(77);
    let n = 0, same = 0;
    for (let i = 0; i < 60; i++) { const s = serveRealMoment(k, rng, { force: true }); if (s) { n++; if (kindOfPool(s.id) === k) same++; } }
    ok(n > 0 && same === n, `${k}: ${same}/${n} served are ${k} moments (${servable(pool, k).length} in the game)`);
  }
  const rng = mulberry32(5);
  ok(serveRealMoment("corner", rng, { force: true }) === null && serveRealMoment("cutback", rng, { force: true }) === null, "a kind with no real moments is never served one");
  clear();
}

console.log("\n4. THE PICKS (allow / deny)");
{
  forceFhrMode("on"); forceRealMomentsMode("on"); setRealMomentPool(pool);
  const all = servable(pool, "one_on_one");
  const deny = all.slice(0, Math.floor(all.length / 2)).map((m) => m.id);
  setPicksOverlay(Object.fromEntries(deny.map((id) => [id, "dont" as const])));
  const rng = mulberry32(9);
  let hit = 0;
  for (let i = 0; i < 400; i++) { const s = serveRealMoment("one_on_one", rng, { force: true }); if (s && deny.includes(s.id)) hit++; }
  ok(hit === 0, `"Don't use" is never served (${deny.length} marked, ${hit} served in 400)`);
  ok(servable(pool, "one_on_one").length === all.length - deny.length, "a marked moment leaves the game's list");
  // A moment a check left out, marked "Use in game".
  const leftOut = (pool.byKind.get("long_range") ?? []).find((m) => pool.check.get(m.id) !== null);
  if (leftOut) {
    setPicksOverlay({ [leftOut.id]: "use" });
    ok(servable(pool, "long_range").some((m) => m.id === leftOut.id), `"Use in game" lets in one a check left out (${pool.check.get(leftOut.id)})`);
    setPicksOverlay({ [leftOut.id]: null });
    ok(!servable(pool, "long_range").some((m) => m.id === leftOut.id) && pickOf(leftOut.id) === "auto", "Automatic puts it back to the checks");
  } else ok(true, "(no long-range moment is left out by a check)");
  const merged = mergePicksFile(JSON.stringify({ what: "x", picks: { dfl1: "dont" } }), [
    { id: "sc1_2", value: "use" }, { id: "dfl1", value: "auto" }, { id: "../bad", value: "use" },
  ]);
  const back = JSON.parse(merged.text);
  ok(merged.ids.join() === "sc1_2,dfl1" && back.picks.sc1_2 === "use" && !("dfl1" in back.picks) && back.what === "x", "the committed file merges: a mark added, a mark cleared, a bad id refused");
  ok(Object.keys(cleanPicks({ ok1: "use", "no way": "use", ok2: "maybe" })).join() === "ok1", "only real ids and values survive");
  // The checks.
  const fully = tracked.moments.filter((m) => m.what === "shot");
  const pass = fully.filter((m) => autoCheck(m, tracks.tracks[m.id]) === null).length;
  ok(pass > 300, `most fully real open-play shots pass the checks: ${share(pass, fully.length)} of every fully real shot`);
  ok(inGameIds(pool).size === REAL_MOMENT_KINDS.reduce((a, k) => a + servable(pool, k).length, 0), "the page's count is the game's list");
  clear();
}

console.log("\n5. THE REAL BUILD-UP");
{
  forceFhrMode("on"); forceRealMomentsMode("on"); setRealMomentPool(pool);
  const rng = mulberry32(21);
  let n = 0, exact = 0, ballEnd = 0, viaCareer = 0, notFresh = 0;
  for (let i = 0; i < 40; i++) {
    const s = serveRealMoment(REAL_MOMENT_KINDS[i % REAL_MOMENT_KINDS.length], rng, { force: true });
    if (!s) continue;
    n++;
    const moment = { opening: false, fresh: true, seed: i };
    const lead = realMomentLeadIn(s.sc, moment);
    if (lead && leadInEntities(s.sc).every((e) => { const p = lead.posAt(e.key, lead.durS); return !p || d(p, e.get()) < 1e-6; })) exact++;
    if (lead) { const b = lead.ballAt(lead.durS); const wantZ = isAirKind(s.sc.kind) ? airWaitZ(s.sc.kind, 0, s.sc as typeof s.sc & AirHeighted) : 0; if (d(b, s.sc.ball) < 1e-6 && Math.abs(b.z - wantZ) < 1e-9) ballEnd++; }
    if (careerBuildUp(s.sc, moment)?.durS === lead?.durS && lead?.skippable) viaCareer++;
    if (!realMomentLeadIn(s.sc, { ...moment, fresh: false })) notFresh++;
  }
  ok(n > 30, `${n} real moments served`);
  ok(exact === n, `every man ends exactly where the chance has him: ${share(exact, n)}`);
  ok(ballEnd === n, `the ball ends on the chance's ball, on the grass: ${share(ballEnd, n)}`);
  ok(viaCareer === n, `the career's build-up (careerBuildUp) is the real one, skippable: ${share(viaCareer, n)}`);
  ok(notFresh === n, `no real build-up for a move carrying on: ${share(notFresh, n)}`);
  const game = mulberry32(3);
  const own = makeChance({ source: { from: "kind", kind: "one_on_one" }, rng: game });
  ok(realMomentLeadIn(own.sc, { opening: false, fresh: true, seed: 1 }) === null, "the game's own chance gets no real build-up");
  clear();
}

console.log("\n6. THE DATA CREDITS");
{
  const lic = readFileSync("data/opendata/LICENCES.md", "utf8");
  for (const c of DATA_CREDITS) if (["patterns", "roles", "moments"].includes(c.use)) ok(lic.includes(c.line), `${c.id}: Settings shows LICENCES.md's line`);
  ok(new Set(DATA_CREDITS.map((c) => c.id)).size === DATA_CREDITS.length, "every credit id is unique");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
