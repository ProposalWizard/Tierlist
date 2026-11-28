/**
 * THE BARBER AND YOUR HAIR (lib/star/barber.ts; plan docs/plans/STAR_PASS_BARBER_FOOD_PLAN.md section 2).
 *
 *  - growth: the beard a step every 2 weeks, the hair every 6, both stop after 3 steps; a style grows
 *    into the next-longer style of the SAME hair type (never a style that hair type does not wear)
 *  - the barber's list follows your hair type (RUL-3D-010), and so does every style it can grow into
 *  - the price: about 2% of a week's wage, 5% for a big change, never under the wage floor's share
 *  - the caps: mood +1 once per gap between matches; fans +1 only before a big match, at most once a month;
 *    nothing on the pitch (no skill, rating or energy moves)
 *  - the clock: 45 minutes a cut, 90 a big change, 10 at the mirror
 *  - the mirror only goes shorter or tidier, and is free
 *  - the save: short (about 15 bytes for the look), and old saves (no field) read as before, not growing
 *  - a season printout (the plan's B1 "Harry sees"): PRINT=1 npx tsx tests/star/barber.mts
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import * as B from "../../lib/star/barber";
import { absOf, clockOf } from "../../lib/star/life/clock";
import { moodOf } from "../../lib/star/life/houseActs";
import { TOON_HAIR_INFO } from "../../lib/star/style3d/toon/hairStyles";
import { loadCareerFromStoredForm } from "../../lib/star/storage";
import type { CareerState, StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "deep", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
const base0: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
const base: CareerState = { ...base0, money: 100_000, contract: { ...base0.contract, wage: 10_000 } };
const HEAD = "h1" as const;

// ── old saves: no field = your own look, as before, not growing ──
{
  const old = { ...base, season: 3, week: 30 };
  delete (old as { hair?: string }).hair;
  const n = B.hairNow(old, "h3");
  check(n.style === "own" && n.hairStep === 0 && n.beard === 3 && n.weeks === 0, `old save on the Buzz & beard head: own cut, its modelled beard, no growth (${JSON.stringify(n)})`);
  const n1 = B.hairNow(old, "h1");
  check(n1.style === "own" && n1.beard === 0, "old save on the Curls head: own cut, clean shaven");
  const later = { ...old, week: 45 };
  check(B.hairNow(later, "h1").beard === 0, "an old save does not grow until the field is written");
  const look = B.yourHairLook3d(old, "h1");
  check(look.head === "h1" && !look.mesh && look.cut.scalp === 0 && look.cut.stubble === 0, `old save: the 3D look is exactly the head as it was (${JSON.stringify(look)})`);
  const lookH3 = B.yourHairLook3d(old, "h3");
  check(lookH3.cut.beard === 0 && lookH3.cut.stubble === 0, "old save on h3: the modelled beard is shown, nothing painted over it");
  // a stored save goes through the game's own loader and keeps its field
  const started = B.withHairStarted(old, "h1");
  check(typeof started.hair === "string" && B.hairNow(started, "h1").style === "own", "withHairStarted: writes the field, your look unchanged");
  check(B.withHairStarted(started, "h1") === started, "withHairStarted: same object once written");
  const round = loadCareerFromStoredForm(JSON.parse(JSON.stringify(started)));
  check(!!round && (round as CareerState).hair === started.hair, "the field survives the game's save loader");
  // broken values fall back
  check(B.hairState({ ...old, hair: "nonsense" }, "h1").style === "own", "a broken field reads as your own look");
  check(B.hairState({ ...old, hair: "locsLong.s.0.1.1" }, "h1").style === "own", "a style that does not suit the saved hair type reads as your own");
}

// ── growth: beard every 2 weeks, hair every 6, 3 steps at most ──
{
  const c = { ...base, season: 1, week: 1, hair: B.packHair({ style: "buzz", texture: "coily", beard0: 0, cutWeek: 1, shaveWeek: 1 }) };
  const at = (w: number) => B.hairNow({ ...c, week: w }, HEAD);
  check(at(1).beard === 0 && at(2).beard === 0 && at(3).beard === 1 && at(5).beard === 2 && at(7).beard === 3 && at(30).beard === 3, `beard steps by week: ${[1, 3, 5, 7, 30].map((w) => at(w).beard).join(",")}`);
  check(at(6).hairStep === 0 && at(7).hairStep === 1 && at(13).hairStep === 2 && at(19).hairStep === 3 && at(40).hairStep === 3, `hair steps by week: ${[6, 7, 13, 19, 40].map((w) => at(w).hairStep).join(",")}`);
  check(at(7).style === "afro" && at(1).style === "buzz", `coily buzz grows into a short afro (${at(7).style})`);
  check(!at(9).untidy && at(11).untidy, "untidy after 10 weeks (a line, never a penalty)");
  // across a season's end: one counter
  const nextSeason = { ...c, season: 2, week: 1 };
  check(B.hairNow(nextSeason, HEAD).weeks === B.SEASON_WEEKS, "the weeks carry across a new season");
  // every style, every hair type it suits: what it grows into suits that hair too (RUL-3D-010)
  for (const s of B.STYLE_IDS) for (const t of B.TEXTURES) {
    if (!B.styleSuits(s, t)) continue;
    for (let k = 1; k <= 3; k++) { const g = B.grown(s, t, k); check(B.styleSuits(g, t), `${s} on ${t} hair grows into ${g}, which ${t} hair does not wear`); }
  }
}

// ── the barber's list follows your hair type (RUL-3D-010) ──
{
  const coily = B.stylesFor("coily"), straight = B.stylesFor("straight");
  for (const s of ["locsShort", "locsLong", "locsBun", "afro", "twists", "braids", "highTop", "waves", "cornrows"] as const) {
    check(coily.includes(s) && !straight.includes(s) && !B.stylesFor("wavy").includes(s) && !B.stylesFor("curly").includes(s), `${s}: coily hair only`);
  }
  for (const s of ["slickBack", "ponytail", "manBun", "mullet"] as const) {
    check(straight.includes(s) && B.stylesFor("wavy").includes(s) && !coily.includes(s) && !B.stylesFor("curly").includes(s), `${s}: straight or wavy only`);
  }
  // each modelled style agrees with the hair system's own list (hairStyles.ts TOON_HAIR_INFO)
  for (const s of B.STYLE_IDS) { const m = B.STYLES[s].mesh; if (m) check(B.STYLES[s].textures.every((t) => TOON_HAIR_INFO[m].textures.includes(t)), `${s}: a texture the modelled hair ${m} is not worn in`); }
  for (const t of B.TEXTURES) check(B.stylesFor(t).length >= 6, `${t}: at least 6 styles (${B.stylesFor(t).length})`);
  // a cut that does not suit the hair is refused
  const r = B.barberCut({ ...base, hair: B.packHair({ style: "own", texture: "straight", beard0: 0, cutWeek: 1, shaveWeek: 1 }) }, "locsLong", "keep", HEAD);
  check(!r.ok, "the barber refuses locs on straight hair");
}

// ── the price: ~2% of a week's wage, ~5% a big change ──
{
  check(B.cutPrice("crew", 10_000) === 200 && B.cutPrice("locsLong", 10_000) === 500, `price on £10k a week: crew ${B.cutPrice("crew", 10_000)}, locs ${B.cutPrice("locsLong", 10_000)}`);
  check(B.cutPrice("crew", 0) >= 1 && B.cutPrice("crew", 5) === B.cutPrice("crew", 0), "a tiny wage pays the wage floor's share, never 0");
  const poor = B.barberCut({ ...base, money: 10 }, "crew", "keep", HEAD);
  check(!poor.ok && poor.career.money === 10, "not enough money: no cut, nothing taken");
  const r = B.barberCut(base, "crew", 0, HEAD, "straight");
  check(r.ok && r.career.money === base.money - 200, `a cut takes its price (${base.money} → ${r.career.money})`);
}

// ── the clock, the caps, nothing on the pitch ──
{
  const c = { ...base, hair: B.packHair({ style: "own", texture: "coily", beard0: 0, cutWeek: 1, shaveWeek: 1 }) };
  const t0 = absOf(clockOf(c));
  const a = B.barberCut(c, "afro", 0, HEAD);
  check(a.ok && absOf(clockOf(a.career)) - t0 === B.CUT_MINS, `a cut takes 45 minutes (${absOf(clockOf(a.career)) - t0})`);
  check(a.mood === 1 && moodOf(a.career) === moodOf(c) + 1, "a fresh cut: mood +1");
  const b = B.barberCut(a.career, "highTop", "keep", HEAD);
  check(b.ok && b.mood === 0, "a second cut in the same gap: no more mood");
  const big = B.barberCut(c, "locsLong", 0, HEAD);
  check(big.ok && absOf(clockOf(big.career)) - t0 === B.BIG_MINS, "a big change takes 90 minutes");
  check(a.career.starRating === c.starRating && a.career.energy === c.energy && JSON.stringify(a.career.skills) === JSON.stringify(c.skills), "nothing on the pitch: star rating, energy and skills unchanged");
  check(a.fans === 0 || B.bigMatchNext(c), "fans only before a big match");
  // a big match next: fans +1, at most once a month
  const fx = c.fixtures.map((f, i) => (i === 0 ? { ...f, derby: true } : f));
  const d = { ...c, fixtures: fx };
  if (B.bigMatchNext(d)) {
    const f1 = B.barberCut(d, "afro", 0, HEAD);
    check(f1.fans === 1 && f1.career.relationships.fans === d.relationships.fans + 1, "a cut before a derby: fans +1");
    const f2 = B.barberCut({ ...f1.career, week: f1.career.week + 2 }, "highTop", "keep", HEAD);
    check(f2.fans === 0, "two weeks later: no fans point again (once a month)");
    const f3 = B.barberCut({ ...f1.career, week: f1.career.week + 4 }, "highTop", "keep", HEAD);
    check(f3.fans === 1, "four weeks later: fans +1 again");
  } else problems.push("the test career's first fixture is not the next match");
}

// ── the mirror: free, 10 minutes, shorter or tidier only ──
{
  const c = { ...base, season: 1, week: 9, hair: B.packHair({ style: "crew", texture: "straight", beard0: 0, cutWeek: 1, shaveWeek: 1 }) };
  const n = B.hairNow(c, HEAD);
  check(n.beard === 3 && n.style === "slickBack", `9 weeks on: beard 3, crew grown to a slick back (${n.beard}, ${n.style})`);
  const trim = B.applyMirror(c, "trimBeard", HEAD);
  check(trim.ok && B.hairNow(trim.career, HEAD).beard === 2 && trim.career.money === c.money, "trim: one step shorter, free");
  check(absOf(clockOf(trim.career)) - absOf(clockOf(c)) === B.MIRROR_MINS, "the mirror takes 10 minutes");
  const shave = B.applyMirror(c, "shave", HEAD);
  check(B.hairNow(shave.career, HEAD).beard === 0, "shave: clean");
  const tidy = B.applyMirror(c, "tidy", HEAD);
  check(B.hairNow(tidy.career, HEAD).style === "crew", "tidy: back to the style as it was cut (never a new one)");
  check(!B.applyMirror(shave.career, "shave", HEAD).ok, "nothing to shave: the mirror says so");
}

// ── the 3D look: modelled style on the close-cut skull, beard steps ──
{
  check(B.hairLook3d("afro", 0, "h1").head === "h9" && B.hairLook3d("afro", 0, "h1").mesh === "afro", "a modelled style on the Curls player: worn on the round-face close-cut head");
  check(B.hairLook3d("own", 0, "h2").head === "h2", "your usual: your own head");
  const b = [0, 1, 2, 3].map((k) => B.hairLook3d("buzz", k, "h3").cut);
  check(b[0].beard >= 1 && b[0].stubble === 0 && b[1].stubble > 0 && b[2].stubble > b[1].stubble && b[3].beard === 0, `beard steps on a beard head: ${JSON.stringify(b)}`);
  check(B.hairLook3d("fade", 0, "h3").cut.scalp === 0.7 && B.hairLook3d("waves", 0, "h3").cut.pattern === 1, "fade and waves are painted on the scalp");
}

// ── the save is small ──
{
  let c = { ...base, season: 7, week: 44 };
  c = B.barberCut({ ...c, fixtures: c.fixtures.map((f, i) => (i === 0 ? { ...f, derby: true } : f)) }, "locsLong", 0, HEAD, "coily").career;
  const s = c.hair!;
  const look = s.split(".").slice(0, 5).join(".");
  check(look.length <= 20, `the look's save is about 15 bytes (${look.length}: "${look}")`);
  check(JSON.stringify({ hair: s }).length <= 48, `the whole field with its effects: ${JSON.stringify({ hair: s }).length} bytes ("${s}")`);
}

// ── the barber's room (lib/star/barber3d/plan.ts): the walk in and out keeps off every solid, the shots stay inside ──
{
  const P = await import("../../lib/star/barber3d/plan");
  const solids = P.barberSolids();
  const clear = (x: number, z: number, r: number) => solids.every(([a, b, c, d]) => !(x > a - r && x < b + r && z > c - r && z < d + r));
  for (const [name, path] of [["in", P.walkIn()], ["out", P.walkOut().slice(0, -1)]] as const) {
    for (let k = 0; k + 1 < path.length; k++) for (let t = 0; t <= 1; t += 0.05) {
      const x = path[k][0] + (path[k + 1][0] - path[k][0]) * t, z = path[k][1] + (path[k + 1][1] - path[k][1]) * t;
      check(clear(x, z, 0.2) && Math.abs(x) < P.HALF_W - 0.2 && z < P.HALF_D + 0.01, `the walk ${name} meets a solid at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
  }
  check(Math.abs(P.walkOut().at(-1)![0] - P.DOOR_X) < P.DOOR_HALF && P.walkOut().at(-1)![1] > P.HALF_D, "the walk out leaves through the door");
  for (const s of ["enter", "chair", "mirror", "cut", "leave"] as const) for (const tall of [true, false]) {
    const [x, y, z] = P.shotOf(s, tall).pos;
    check(Math.abs(x) < P.HALF_W - 0.05 && Math.abs(z) < P.HALF_D - 0.05 && y > 0.3 && y < P.ROOM_H - 0.1, `the ${s} camera is inside the room (${x}, ${y}, ${z})`);
  }
}

// ── the printout ──
if (process.env.PRINT) {
  let c: CareerState = { ...base, season: 1, week: 1, hair: B.packHair({ style: "buzz", texture: "coily", beard0: 0, cutWeek: 1, shaveWeek: 1 }) };
  console.log("week  hair            step  beard");
  for (let w = 1; w <= 38; w++) {
    c = { ...c, week: w };
    if (w === 20) c = B.barberCut(c, "highTop", 1, HEAD).career;
    const n = B.hairNow(c, HEAD);
    console.log(`${String(w).padStart(4)}  ${B.STYLES[n.style].label.padEnd(15)} ${String(n.hairStep).padStart(4)}  ${B.BEARD_LABEL[n.beard]}${w === 20 ? "   ← the barber: a high-top, stubble" : ""}`);
  }
}

if (problems.length) {
  console.log(`barber: ${problems.length} problem(s)`);
  for (const p of problems) console.log("  -", p);
  process.exit(1);
}
console.log("barber: ok (growth, the list by hair type, price, caps, clock, mirror, 3D look, save size, old saves)");
