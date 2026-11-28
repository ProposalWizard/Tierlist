/**
 * THE KIT MAN'S DRILL v4 (Den's hundred): ten varied, missable balls on the real engine.
 *
 * Harry, 20 Nov 2026: "the drill is boring and continuous, no one's doing 100 of those shots and
 * also no one's missing"; then "the worst thing of the kit man is the drill, I think it's a chance
 * to be creative, also make sure it's the main engine."
 *
 *  1. Ten balls, at least five different kinds, the same night for the same seed.
 *  2. Each ball is the match's own chance: volleys and headers are the engine's own volley and
 *     header kinds; the cut-back's seed rolls the ball on the strike screen; the dummy is one of
 *     the engine's own defenders, standing still.
 *  3. Den is on the pitch (a "man" marker, painted by the match's own figure painter) on every
 *     ball he is not in goal, and inside the camera's frame.
 *  4. Misses happen, on the engine's own physics: a low drive into the dummy is blocked, a driven
 *     ball never drops into the skip, the judge has a miss for every target.
 *  5. The target card names whoever is in goal (it said "BEAT DEN" whoever was there).
 */
import { launch, stepBall, stepDefenders, stepKeeper, stepReactions } from "../../lib/star/canvasEngine";
import { challenge, feedsFor, HUNDRED_FEEDS, judge, promptOf, rollHundred, SKIP_H, type Feed } from "../../lib/star/life/drill";
import { feederSpot, hundredMarkers, hundredScenario, seedFor } from "../../lib/star/life/drillScene";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";

let fails = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails++; };

// 1. Ten balls, five kinds or more, seeded.
{
  const f = HUNDRED_FEEDS;
  check(f.length === 10, `ten balls (${f.length})`);
  const kinds = new Set(f.map((x) => x.round));
  check(kinds.size >= 5, `at least five kinds of ball (${kinds.size}: ${[...kinds].join(", ")})`);
  const looks = new Set(f.map((x) => x.target.kind));
  check(looks.size >= 5, `at least five kinds of target (${[...looks].join(", ")})`);
  check(JSON.stringify(feedsFor(0, 41)) === JSON.stringify(feedsFor(0, 41)), "the same seed, the same night");
  const sides = new Set(Array.from({ length: 30 }, (_, s) => (feedsFor(0, s).find((x) => x.round === "cutback")!.target as { side: string }).side));
  check(sides.size === 2, "the cut-back comes from either byline, night to night");
  check(f[9].double === true && f.filter((x) => x.keeper).length === 3, "Den in goal for the last three, the last double or nowt");
  // A further-out night moves the balls back but a header stays a header.
  const far = feedsFor(8, 1);
  check(far.find((x) => x.round === "header")!.dist <= 10 && far.find((x) => x.round === "skip")!.dist === 23, "twenty yards: the skip moves back, the header does not");
}

// 2. The match's own balls.
{
  const sc = (f: Feed, s = 7) => hundredScenario(f, mulberry32(s));
  const by = (k: string) => HUNDRED_FEEDS.find((x) => x.round === k)!;
  check(sc(by("volley")).kind === "volley" && sc(by("half-volley")).kind === "volley", "the volley and the half-volley are the match's own volley");
  check(sc(by("header")).kind === "header", "the header is the match's own header");
  const cut = by("cutback");
  const s = seedFor(cut, 12345);
  check(((Math.imul(s, 2654435761) >>> 0) % 100) < 35 && seedFor(by("skip"), 12345) === 12345, "the cut-back's seed rolls the ball on the strike screen; other balls keep theirs");
  const dummy = sc(by("chip"));
  check(dummy.defenders.length === 1 && dummy.defenders[0].baseRole === "hold" && dummy.defenders[0].y < by("chip").dist, "the dummy is one engine defender, a hold man, between you and goal");
  check(HUNDRED_FEEDS.filter((x) => !x.dummy).every((x) => sc(x).defenders.length === 0), "nobody else in the way");
}

// 3. Den on the pitch, in the picture, at the match's own figure size (a "man" marker).
{
  for (const f of HUNDRED_FEEDS) {
    const m = hundredMarkers(f, "Den") ?? [];
    const man = m.find((x) => x.shape === "man");
    if (f.keeper) { check(!man && !feederSpot(f), `${f.label}: Den is in goal (the match's keeper), not a marker`); continue; }
    const vp = hundredScenario(f, mulberry32(7)).viewport;
    const inFrame = !!man && man.x > vp.x1 + 0.4 && man.x < vp.x2 - 0.4 && man.y > vp.y1 && man.y < vp.y2;
    check(inFrame && man!.label === "Den", `${f.label}: Den stands in the frame (${man ? `${man.x.toFixed(1)}, ${man.y.toFixed(1)}` : "missing"})`);
  }
}

// 4. Misses happen: on the engine's own physics, and in the judge.
{
  const DT = 1 / 60;
  const play = (f: Feed, ang: number, power: number, cy: number, seed = 3) => {
    const sc = hundredScenario(f, mulberry32(7));
    sc.keeper.x = -50; sc.keeper.y = -50; sc.keeper.done = true;
    const rng = mulberry32(seed);
    const ball = launch(sc, { x: Math.sin(ang), y: -Math.cos(ang) }, power, { cx: 0, cy }, { power: 62, technique: 62 }, rng);
    let out: string | null = null, prev = { x: ball.pos.x, y: ball.pos.y, z: ball.z };
    let cross: { x: number; z: number } | null = null, land: { x: number; y: number } | null = null;
    for (let i = 0; i < 900 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball); stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
      const b = { x: ball.pos.x, y: ball.pos.y, z: ball.z };
      if (!cross && prev.y > 0 && b.y <= 0) { const t = prev.y / (prev.y - b.y); cross = { x: prev.x + (b.x - prev.x) * t, z: prev.z + (b.z - prev.z) * t }; }
      if (!land && prev.z > SKIP_H && b.z <= SKIP_H) { const t = (prev.z - SKIP_H) / (prev.z - b.z); land = { x: prev.x + (b.x - prev.x) * t, y: prev.y + (b.y - prev.y) * t }; }
      prev = b;
    }
    return { cross, land, bar: false, outcome: out ?? "none" };
  };
  const chip = HUNDRED_FEEDS.find((x) => x.round === "chip")!;
  // A firm, low drive straight at goal (the dummy is straight in front): through him it is not.
  let blocked = 0;
  for (let k = 0; k < 20; k++) { const r = play(chip, (k - 10) * 0.004, 0.8, 0, 100 + k); if (judge(chip, r) !== "hit") blocked++; }
  check(blocked >= 15, `a low drive at the dummy mostly fails (${blocked} of 20 not in)`);
  const skip = HUNDRED_FEEDS.find((x) => x.round === "skip")!;
  const t = skip.target as { x: number };
  const sc0 = hundredScenario(skip, mulberry32(7));
  const ang = Math.atan2(t.x - sc0.ball.x, sc0.ball.y);
  const driven = play(skip, ang, 0.85, 0);
  check(judge(skip, driven) !== "hit", `a driven ball never drops into the skip (${judge(skip, driven)})`);
  // Some lofted strike does drop in: the skip is hard, not impossible.
  let inSkip = 0;
  for (let p = 0.3; p <= 0.8; p += 0.05) for (let cy = 0.2; cy <= 1.0; cy += 0.1) if (judge(skip, play(skip, ang, p, cy)) === "hit") inSkip++;
  check(inSkip > 0, `some lofted strike lands in the skip (${inSkip} of the grid)`);
  // The judge has a miss for every kind of target.
  const on = (x: number, z: number, o = "goal") => ({ cross: { x, z }, bar: false, outcome: o });
  const half = HUNDRED_FEEDS.find((x) => x.round === "half-volley")!;
  check(judge(half, on(CX, 0.5)) === "central" && judge(half, on(POST_L + 0.6, 1.8)) === "hit", "on the bounce: inside a post counts, the middle does not");
  check(judge(skip, on(CX, 0.5)) === "in-net" && judge(skip, { cross: null, bar: false, outcome: "wide", land: { x: t.x, y: 4.2 } }) === "hit", "the skip: in the net is a miss, down into the skip is a hit");
  const vol = HUNDRED_FEEDS[0];
  check(judge(vol, on(POST_R + 0.5, 0.6, "wide")) === "wide" && judge(vol, on(CX, 2.7, "over")) === "over", "the volley: wide and over are misses");
  check(judge(chip, { cross: null, bar: false, outcome: "blocked" }) === "blocked", "the dummy: blocked is a miss");
  // The dice stand-in: misses at a good player's technique, nobody scores ten every night.
  const r = mulberry32(5);
  const nights = Array.from({ length: 2000 }, () => rollHundred(65, r).score);
  check(nights.filter((x) => x === 10).length < 200 && nights.filter((x) => x <= 5).length > 100, `misses happen (10s: ${nights.filter((x) => x === 10).length}/2000, 5 or fewer: ${nights.filter((x) => x <= 5).length}/2000)`);
}

// 5. The card names whoever is in goal.
{
  const k = HUNDRED_FEEDS.find((x) => x.round === "keeper")!;
  const d = HUNDRED_FEEDS[9];
  check(promptOf(k, "Den") === "BEAT DEN" && promptOf(k, "Gaz") === "BEAT GAZ" && promptOf(d, "Mo").startsWith("BEAT MO"), "the card says BEAT <whoever is in goal>");
  check(promptOf(k, "He") === "BEAT THE KEEPER" && promptOf(k, null) === "BEAT THE KEEPER", "no name: the keeper");
  const story = challenge([{ kind: "keeper" }]).feeds[0];
  check(promptOf(story, "Leanne") === "BEAT LEANNE", "a story's own keeper is named");
  check(POST_R > POST_L, "pitch sane");
}

console.log(fails ? `${fails} FAILED` : "kit man drill: all passed");
process.exit(fails ? 1 : 0);
