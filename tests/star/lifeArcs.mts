/**
 * EVENTS V2, phase 1: the kit man arc "A hundred balls in the dark" end to end
 * (docs/plans/living-world-events-v2-2026-11-20.md). Pure, no screens.
 *
 *  1. The arc book passes the v2 checker (every goto, every activity result,
 *     every promise's deadline and both endings, no dead ends).
 *  2. Beat 1 is an offer on Den's round menu; ignored, it plays its ending.
 *  3. Say yes: four rounds, the drill (score 8), the van, the promise.
 *  4. Next morning the gaffer (dial) sets an objective; Saturday's goal
 *     brings the note in your boot.
 *  5. Thursdays: the standing bubble; a best over 90 opens the kit room door.
 *  6. The clock: two season ends → "I'm finishing in May"; the third → his night.
 *  7. Kept → the bag and the garden drill; broken → the empty chair and the letter.
 *  8. Years on, the kid; the save stays small; an old save migrates.
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 } as Storage;

const A = await import("../../lib/star/life/arcs.ts");
const T = await import("../../lib/star/life/talk.ts");
const PR = await import("../../lib/star/life/promises.ts");
const { validateArcs } = await import("../../lib/star/life/validateArcs.ts");
const { ARCS } = await import("../../lib/star/life/arcBook.ts");
const { migrateLife } = await import("../../lib/star/life/migrate.ts");
const DR = await import("../../lib/star/life/drill.ts");
const UL = await import("../../lib/star/life/unlocks.ts");
const { makeInitialCareer } = await import("../../lib/star/careerFlow.ts");
const { NATIONAL_LEAGUE_CLUBS } = await import("../../lib/star/clubs.ts");
const { mulberry32 } = await import("../../lib/star/season.ts");
import type { CareerState, StarPlayer } from "../../lib/star/types";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.log("FAIL", msg); } else if (process.env.V) console.log("ok  ", msg); };
const rng = mulberry32(11);
const ARC = "arc-hundred-balls";

function career(): CareerState {
  const player = { firstName: "Sam", lastName: "Carter", age: 19, skinTone: "light", club: NATIONAL_LEAGUE_CLUBS[2], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c = makeInitialCareer(player, [...NATIONAL_LEAGUE_CLUBS], "national_league");
  const squad = c.squad.map((p, i) => ({ ...p, age: [17, 29, 24, 31, 21, 26, 18, 33, 23, 27, 20, 25, 19, 30, 22, 28, 32, 24, 26, 21][i % 20], overall: 60 }));
  return { ...c, squad, season: 1, week: 12, energy: 80, weekActions: 3, money: 50_000, skills: { ...c.skills, technique: 70 } };
}
const bad = { lastRating: 6.1, lastLost: true, lastGoals: 0 };
const run = (c: CareerState) => c.life!.arcs![ARC];

// 1
const probs = validateArcs(ARCS);
check(probs.length === 0, `the arc book passes the v2 checker: ${probs.slice(0, 6).map((p) => `${p.id}: ${p.problem}`).join(" | ")}`);

// 1b: the checker rejects each kind of broken arc (v2 rules).
{
  const base = JSON.stringify(ARCS[0]);
  const broken = (why: string, edit: (a: typeof ARCS[0]) => void, expect: RegExp) => {
    const a = JSON.parse(base) as typeof ARCS[0];
    edit(a);
    const got = validateArcs([a]).map((p) => p.problem);
    check(got.some((p) => expect.test(p)), `the v2 checker rejects ${why} (got: ${got.slice(0, 3).join(" | ") || "nothing"})`);
  };
  const b1 = (a: typeof ARCS[0]) => a.beats[0].event.talk!;
  broken("a dead end", (a) => { b1(a).nodes["n-leave"].replies = [{ id: "x", label: "x", goto: "n-leave" }]; }, /dead end/);
  broken("a goto to nowhere", (a) => { b1(a).nodes.n1.replies![0].goto = "nope"; }, /not a node/);
  broken("an activity that cannot be stopped properly", (a) => { b1(a).nodes.play.result = b1(a).nodes.play.result!.filter(([c]) => c !== "activity.abandoned"); }, /stopping goes nowhere/);
  broken("an activity with no fallback result", (a) => { b1(a).nodes.play.result = b1(a).nodes.play.result!.filter(([c]) => c !== ""); }, /no fallback result/);
  broken("a promise with no deadline", (a) => { a.promises["p-thursday"].due = {}; }, /no deadline/);
  broken("a promise with one ending", (a) => { delete a.promises["p-thursday"].broken; }, /both endings/);
  broken("an ending never reached", (a) => { a.ends.push({ id: "lost-ending", title: "x", text: "x" }); }, /never reached/);
  broken("two silences", (a) => { b1(a).nodes.n1.replies!.push({ id: "q2", label: "…", silent: true, goto: "n2" }); }, /more than one silence/);
}

// 1c: Den's hundred is short, varied and missable (Harry: "no one's missing"). The rolled
// night (the dice stand-in) at a normal player's technique: median 6-7, real 3s and 10s.
{
  check(DR.HUNDRED_FEEDS.length === 10 && new Set(DR.HUNDRED_FEEDS.map((f) => f.label)).size === 10, "ten balls, every one different");
  check(DR.HUNDRED_FEEDS.every((f) => f.label.split(" ").length <= 3) && DR.HUNDRED_FEEDS.some((f) => f.keeper) && DR.HUNDRED_FEEDS[9].double === true, "short labels, Den in goal, the last double or nothing");
  // v4 (Harry: "a chance to be creative"): nine rounds, each a different thing to do, in order.
  check(DR.ROUNDS.length === 9 && DR.ROUNDS.every((r, k) => DR.HUNDRED_FEEDS.some((f) => f.roundNo === k && f.round === r.kind)) && DR.HUNDRED_FEEDS.every((f, i) => i === 0 || f.roundNo >= DR.HUNDRED_FEEDS[i - 1].roundNo), "nine rounds, every one played, in order");
  // Any story's challenge (the round library): the balls come from its rounds, ten at most.
  const ch = DR.challenge([{ kind: "corners", balls: 2 }, { kind: "far" }, { kind: "keeper", balls: 4 }, { kind: "props" }, { kind: "double" }]);
  check(ch.feeds.length === 10 && ch.rounds.length === 5 && ch.feeds[9].double === true && ch.feeds.filter((f) => f.keeper).length === 5, `a story's own challenge: its rounds, ten balls (${ch.feeds.length})`);
  check(DR.challenge([{ kind: "keeper", balls: 9 }, { kind: "far", balls: 5 }]).feeds.length === 10, "a challenge stops at ten balls");
  check(DR.denAfter("saved", 0, 0, DR.challenge([{ kind: "keeper" }]).feeds, { "keeper:saved": "Ha! {name} keeps it out." }) === "Ha! {name} keeps it out.", "a story's own reaction line wins over the default");
  check(new Set(DR.HUNDRED_FEEDS.map((f) => f.target.kind)).size >= 5, "five kinds of target (a called corner, the bar, the tyre, the bucket, past Den)");
  // The one rule that judges a ball on the pitch.
  const T = DR.HUNDRED_FEEDS;
  const on = (x: number, z: number, o = "goal", bar = false) => ({ cross: { x, z }, bar, outcome: o });
  check(DR.judge({ ...T[0], target: { kind: "corner", side: "L" } }, on(30.9, 0.4)) === "hit" && DR.judge({ ...T[0], target: { kind: "corner", side: "L" } }, on(37.0, 0.4)) === "wrong", "call it: the called corner counts, the other one is wrong");
  const R = (k: string) => T.find((f) => f.round === k)!;
  const tyre = DR.challenge([{ kind: "props" }]).feeds[0];
  check(DR.judge(R("crossbar"), { cross: null, bar: true, outcome: "post" }) === "hit" && DR.judge(R("crossbar"), on(34, 1.2)) === "under-bar", "the bar: off the bar counts, a goal under it does not");
  check(DR.judge(tyre, on(31.29, 1.6)) === "hit" && DR.judge(tyre, on(33.5, 0.4)) === "missed-it", "the tyre: through it counts, anywhere else misses it");
  check(DR.judge(R("keeper"), on(31, 0.4, "saved")) === "saved" && DR.judge(R("keeper"), on(36, 1.9)) === "hit", "Den in goal: a save is a save, any goal beats him");
  const dark = DR.challenge([{ kind: "lights-out" }]).feeds[0];
  check(DR.shoutOf(dark) !== null && DR.feedsFor(0, 3).length === 10, "lights out (the library): he shouts the side; ten balls on any night");
  const r = mulberry32(99);
  const at = (t: number) => { const xs: number[] = []; for (let i = 0; i < 4000; i++) xs.push(DR.rollHundred(t, r).score); xs.sort((a, b) => a - b); return xs; };
  const mid = at(62);
  const med = mid[2000];
  check(med >= 6 && med <= 7, `a normal player (technique 62) scores a median 6-7 of 10 (got ${med})`);
  check(mid.filter((x) => x <= 3).length > 20 && at(72).filter((x) => x === 10).length > 20, "real 3s and real 10s");
  check(DR.pointsOf([true, true, true, true, true, true, true, true, true, true]) === 100 && DR.pointsOf(Array(9).fill(false).concat([false])) === 0, "a perfect night is a hundred; a blank one nothing");
  check(DR.denAfter("hit", 2, 3).includes("three"), "Den notices a streak");
}

// 2: the offer, then ignored.
{
  let c = career();
  const m = A.arcMoment(c, "arrive:training", { rng, facts: bad, force: ARC });
  c = m.career;
  check(m.offers.length === 1 && m.offers[0].person === "staff:kitman", `beat 1 is an offer on Den (${JSON.stringify(m.offers)})`);
  const bub = A.bubblesFor(c, "staff:kitman");
  check(bub[0]?.gold && bub[0].label === "Stay out" && bub[0].chip === "Today only", "Den's round menu has the gold \"Stay out\" bubble, today only");
  const e = A.endOfDay(c, rng);
  c = e.career;
  check(e.notices[0]?.kind === "ignored" && /kicking the balls back/.test(e.notices[0].text), `an untaken offer plays its ending (${e.notices[0]?.text})`);
  check(run(c).v.path === "left" && "b3-thursdays" in run(c).s, "…and the story goes on: Thursdays are still open");
  check((c.life!.people["staff:kitman"]?.m ?? []).some(([t]) => t === "walked-past-the-bag"), "Den remembers you walked past");
}

// 3: say yes, the whole first talk.
let c = career();
c = A.arcMoment(c, "arrive:training", { rng, facts: bad, force: ARC }).career;
let o = A.openBeat(c, ARC, "b1-the-offer")!;
c = o.career; let b = o.live;
check(b.stage === "talk" && b.node === "n1", "the offer opens a talk at round 1");
let nl = T.nodeLive(c, b);
check(nl.choices.length === 4 && nl.choices.some((x) => x.choice.silent), "round 1: three lines and silence");
check(/feed you a hundred/.test(nl.lines.join(" ")), "Den's opening line");
let s = T.reply(c, b, "ask"); c = s.career; b = (s.step as { live: typeof b }).live;
check(b.node === "n1-bad" && b.note === "You asked · he's being straight", "round 2: \"Was I that bad?\"");
s = T.reply(c, b, "fix"); c = s.career; b = (s.step as { live: typeof b }).live;
check(b.node === "n2" && b.mood === 1, "round 3: he's warming to you (mood +1)");
s = T.reply(c, b, "spot"); c = s.career; b = (s.step as { live: typeof b }).live;
check(b.tv.drill === "corners", "the drill is from where you missed");
s = T.reply(c, b, "truth"); c = s.career;
check(s.step.kind === "activity" && s.step.activity.mode === "strike-drill", "round 4 → the drill opens");
b = (s.step as { live: typeof b }).live;
s = T.activityDone(c, b, { score: 8, tens: 80, won: true, abandoned: false }); c = s.career; b = (s.step as { live: typeof b }).live;
check(b.node === "r-clean" && /80 out of a hundred/.test(T.nodeLive(c, b).lines.join(" ")), "8 of 10 → \"80 out of a hundred\"");
s = T.reply(c, b, "thanks"); c = s.career; b = (s.step as { live: typeof b }).live;
s = T.reply(c, b, "yes"); c = s.career; b = (s.step as { live: typeof b }).live;
check(b.node === "van", "the van's back step");
check(T.nodeLive(c, b).choices.find((x) => x.id === "promise")?.costText.includes("A promise") ?? false, "the promise reply says it is a promise");
s = T.reply(c, b, "promise"); c = s.career;
check(s.step.kind === "end", "the promise ends the talk");
let end = A.playEnding(c, (s.step as { live: typeof b }).live, (s.step as { end: string }).end, { rng, facts: bad });
c = end.career;
check(end.result.remembered.some((r) => r.tag === "stayed-out-with-him"), "Den will remember that");
check(/^Be at [A-Z][a-z]+'s night when he retires$/.test(end.extras.promiseMade?.text ?? ""), `promise made, with this career's kit man's name: ${end.extras.promiseMade?.text}`);
check(run(c).v.best === 80 && run(c).v.tell === 1 && run(c).v.nights === 1, `the arc keeps best 80, tell 1 (${JSON.stringify(run(c).v)})`);
check(PR.openPromises(c).length === 1, "one open promise in the phone");
check(A.questLog(c)[0]?.next.includes("gaffer"), `quest log: next is the gaffer (${A.questLog(c)[0]?.next})`);

// 4: next morning, the gaffer.
let m = A.arcMoment(c, "arrive:training", { rng, facts: bad });
check(m.screens.some((x) => x.beat === "b2-the-gaffer"), `next morning: the gaffer (${JSON.stringify(m.screens)})`);
o = A.openBeat(m.career, ARC, "b2-the-gaffer")!; c = o.career; b = o.live;
nl = T.nodeLive(c, b);
check(nl.event.screen === "dial" && /hit 80 out of a hundred/.test(nl.lines.join(" ")), "the gaffer quotes your score, on the dial");
check(b.when === "Next morning", `time chip: ${b.when}`);
s = T.reply(c, b, "humble"); c = s.career; b = (s.step as { live: typeof b }).live;
s = T.reply(c, b, "corners"); c = s.career; b = (s.step as { live: typeof b }).live;
s = T.reply(c, b, "yes"); c = s.career;
end = A.playEnding(c, (s.step as { live: typeof b }).live, "objective", { rng, facts: bad }); c = end.career;
check(!!end.extras.objective && c.life!.objs?.length === 1, "a match objective is set");
m = A.arcMoment(c, "after-match", { rng, facts: { lastGoals: 1, lastRating: 7.4 } }); c = m.career;
check(m.screens.some((x) => x.beat === "b2b-ten-fingers"), `Saturday, you scored: the note (${JSON.stringify(m.screens)})`);
o = A.openBeat(c, ARC, "b2b-ten-fingers")!; c = o.career;
const card = T.cardLive(c, o.live);
check(card.choices.length >= 2 && /Corners\. Thursday\?/.test(card.lines.join(" ")), "the note in your left boot");
c = T.playCard(c, o.live, "keep", { rng })!.career;

// 5: Thursdays, then the door.
c = { ...c, week: c.week + 2 };
check(A.bubblesFor(c, "staff:kitman").some((x) => x.label === "The hundred" && !x.gold), "Thursdays: the standing bubble");
for (let i = 0; i < 4; i++) {
  c = { ...c, week: c.week + 2 };
  const r = T.autoBeat(c, ARC, "b3-thursdays", { rng: () => 0.01, pick: () => 0 });
  if (r) c = r.career;
}
check(Number(run(c).v.best) >= 90 && Number(run(c).v.nights) >= 4, `a best over 90 (${run(c).v.best}, nights ${run(c).v.nights})`);
check(PR.openPromises(c).length === 1, "Thursdays kept nothing they should not");
m = A.arcMoment({ ...c, week: c.week + 1 }, "arrive:training", { rng });
check(m.screens.some((x) => x.beat === "b4-the-door"), `the kit room door (${JSON.stringify(m.screens)})`);
c = T.autoBeat(m.career, ARC, "b4-the-door", { rng: () => 0.01, pick: () => 0 })!.career;
check(run(c).v.best === 100 && UL.unlocksOf(c.life).has("kit-room-door"), "a hundred on the door");

// 6: the clock.
const seasonEnd = (x: CareerState) => A.arcMoment({ ...x, week: 46 }, "season-end", { rng });
m = seasonEnd(c); c = { ...m.career, season: m.career.season + 1, week: 2, player: { ...m.career.player, age: m.career.player.age + 1 } };
check(run(c).k["den-retires"] === 1, "season end: the clock ticks");
m = seasonEnd(c); c = { ...m.career, season: m.career.season + 1, week: 2, player: { ...m.career.player, age: m.career.player.age + 1 } };
m = A.arcMoment(c, "arrive:training", { rng });
check(m.screens.some((x) => x.beat === "b5-last-season"), `two seasons on: "I'm finishing in May" (${JSON.stringify(m.screens)})`);
const before = m.career;
// Switch club: he rings from the old club's landline.
const moved = { ...before, player: { ...before.player, club: NATIONAL_LEAGUE_CLUBS[5] } };
o = A.openBeat(moved, ARC, "b5-last-season")!;
check(o.live.event.template === "phone-call" && /landline/.test(o.live.event.setup[0]), "at another club, Den rings from the old landline");
c = T.autoBeat(before, ARC, "b5-last-season", { rng, pick: () => 0 })!.career;
check(PR.openPromises(c).some((p) => p.id === "p-dens-speech"), "you said you'd say a few words");
m = seasonEnd(c);
check(m.screens.some((x) => x.beat === "b6-the-night"), `third season end: his night (${JSON.stringify(m.screens)})`);
const atNight = m.career;

// 7a: kept.
{
  const r = T.autoBeat(atNight, ARC, "b6-the-night", { rng, pick: (n, ids) => Math.max(0, ids.indexOf("take")), answer: "attend" })!;
  const k = r.career;
  check(r.end === "took-the-bag" || r.end === "attend", `you went (end ${r.end})`);
  check(UL.unlocksOf(k.life).has("item-dens-ball-bag") && UL.unlocksOf(k.life).has("hundred-balls-corner"), "his 1994 bag, and the drill for your garden");
  check(PR.promiseList(k).filter((p) => p.st === "kept").length >= 2, "both promises kept");
  // 8: years on.
  let y = { ...k, season: k.season + 6, week: 2, player: { ...k.player, age: 28 } };
  const mm = A.arcMoment(y, "arrive:training", { rng });
  check(mm.offers[0]?.beat === "b7-your-turn", `years on: the kid's offer (${JSON.stringify(mm.offers)})`);
  y = mm.career;
  const kid = mm.offers[0]?.person;
  check(!!kid && A.bubblesFor(y, kid).some((x) => x.label === "Feed him a hundred"), "on the kid's round menu");
  const fin = T.autoBeat(y, ARC, "b7-your-turn", { rng, pick: () => 0 })!;
  check(run(fin.career).done === "the-bag-moves-on", `the bag moves on (${run(fin.career).done})`);
  check(JSON.stringify(fin.career.life!.arcs![ARC]).length < 2500, `the story is small in the save (${JSON.stringify(fin.career.life!.arcs![ARC]).length} bytes)`);
}
// 7b: broken.
{
  const r = T.autoBeat(atNight, ARC, "b6-the-night", { rng, pick: () => 0, answer: "ignore" })!;
  const k = r.career;
  check(run(k).done === "the-empty-chair", "the empty chair");
  check(PR.promiseList(k).filter((p) => p.st === "broken").length >= 2, "both promises broken");
  check((k.life!.squad ?? []).some(([t]) => t === "empty-chair-at-dens-night"), "the squad saw it");
  const later = { ...k, week: k.week + 3 };
  const mm = A.arcMoment(later, "home:evening", { rng });
  check(mm.screens.some((x) => x.beat === "b6b-letter"), `the letter, two or three weeks on (${JSON.stringify(mm.screens)})`);
}

// 8: an old save.
{
  const life = migrateLife({ people: {}, fired: {}, arcs: { [ARC]: { at: 3, club: "X", cast: { kitman: "staff:kitman" }, v: { best: 70, junk: { a: 1 } }, k: { "den-retires": 1 }, f: { "b1-the-offer": [3, "x"] }, s: {} } }, promises: [{ id: "p-thursday", arc: ARC, st: "weird" }, { bad: 1 }] });
  check(life.arcs?.[ARC].v.best === 70 && !("junk" in life.arcs![ARC].v) && life.arcs![ARC].f["b1-the-offer"].length === 1, "a v2 save is put back in shape");
  check(life.promises?.length === 1 && life.promises[0].st === "open", "a broken promise row is fixed or dropped");
  const v1 = migrateLife({ people: {}, fired: {} });
  check(!v1.arcs && !v1.promises, "a v1 save gets no story fields");
}

// 9: THE STORY BOOK (batch 1). Every file passes the deep checks, and every story plays start to
// finish by the dice: each beat plays in some run, each ending is reached in some run.
{
  const { ALL_ARCS, WAITING_ARCS } = await import("../../lib/star/life/arcBook.ts");
  const { validateArcBook } = await import("../../lib/star/life/validateArcs.ts");
  const { EVENTS } = await import("../../lib/star/life/book.ts");
  const { freshLife } = await import("../../lib/star/life/people.ts");
  const fs = await import("node:fs");
  const deep = validateArcBook(ALL_ARCS, EVENTS);
  check(deep.length === 0, `every story file passes the deep checks (${deep.length}): ${deep.slice(0, 12).map((p) => `${p.id}: ${p.problem}`).join(" | ")}`);
  // Every JSON file in the folder is in the book (a file left out would never be checked or played).
  const files = fs.readdirSync(new URL("../../lib/star/life/book/arcs/", import.meta.url)).filter((f: string) => f.endsWith(".json"));
  check(files.length === ALL_ARCS.length, `every story file is in the book (${files.length} files, ${ALL_ARCS.length} in the book)`);
  check(WAITING_ARCS.every((a) => !ARCS.includes(a)), "a story waiting for its game never plays");

  const ONLY = process.env.ARC;
  const SEEDS = Number(process.env.SEEDS ?? 16);
  const stories = ARCS.filter((a) => a.id !== ARC && (!ONLY || a.id === ONLY));
  const moments = ["walkout", "after-match", "arrive:training", "home:evening"] as const;
  let played = 0;
  for (const arc of stories) {
    const ends = new Set<string>(), beats = new Set<string>();
    const dead: string[] = [];
    // SEEDS careers, and up to five times more for a story whose rarest ending or beat has not come yet
    // (the deeper stories have more paths; the check is the same: every ending and beat in real play).
    const allSeen = () => arc.ends.every((e) => ends.has(e.id)) && arc.beats.every((b) => beats.has(b.id));
    let seedsUsed = 0;
    for (let seed = 0; seed < SEEDS || (seed < SEEDS * 6 && !allSeen()); seed++) {
      seedsUsed = seed + 1;
      const r = mulberry32(5000 + seed * 131 + arc.id.length * 7);
      // Pick: always the first reply, always the last, or the dice (all three get every ending in time).
      const pick = (n: number) => (seed % 3 === 0 ? 0 : seed % 3 === 1 ? n - 1 : Math.floor(r() * n));
      let c = career();
      if (seed % 2 === 1) c = { ...c, girlfriend: { name: "Jess Moore", happiness: 60, gifts: 0 } } as CareerState;
      if (seed % 5 === 2) c = { ...c, fame: 45, money: 400_000 };
      // Only this story runs: every other story is already over in this career.
      const life = freshLife();
      life.arcs = Object.fromEntries(ALL_ARCS.filter((a) => a.id !== arc.id).map((a) => [a.id, { at: 0, club: c.player.club, cast: {}, v: {}, k: {}, f: {}, s: {}, done: "x" }]));
      c = { ...c, life };
      const first = arc.beats[0].event.trigger.when.find((m) => m !== "followUp") ?? "arrive:training";
      // The beats it played, read while its record is still full (a finished story is packed small
      // at the next moment and keeps only its main line: arcPack.ts).
      const note = (cc: CareerState) => { for (const [b, f] of Object.entries(cc.life?.arcs?.[arc.id]?.f ?? {})) if (f.length) beats.add(b); return cc; };
      const take = (cc: CareerState, res: { screens: { arc: string; beat: string }[]; offers: { arc: string; beat: string }[] }) => {
        note(cc);
        for (const sc of res.screens) { const a = T.autoBeat(cc, sc.arc, sc.beat, { rng: r, pick }); if (a) cc = note(a.career); else dead.push(`${sc.beat} would not open`); }
        for (const o of res.offers) if (r() < 0.7) { const a = T.autoBeat(cc, o.arc, o.beat, { rng: r, pick }); if (a) cc = note(a.career); }
        return cc;
      };
      const facts = () => ({ lastRating: Math.round((5 + r() * 4) * 10) / 10, lastGoals: r() < 0.35 ? 1 : 0, lastWon: r() < 0.45, lastLost: r() < 0.35 });
      let m = A.arcMoment(c, first as never, { rng: r, facts: facts(), force: arc.id });
      c = take(m.career, m);
      const start = c.season;
      for (let guard = 0; guard < 10 * 46; guard++) {
        const done = A.arcsOf(c)[arc.id];
        if (!done || (done.done && !Object.keys(done.s).length && !done.o)) break;
        let week = c.week + 1, season = c.season;
        if (week > 46) {
          m = A.arcMoment({ ...c, week: 46 }, "season-end", { rng: r, facts: facts() });
          c = take(m.career, m);
          week = 1; season++;
          c = { ...c, player: { ...c.player, age: c.player.age + 1 } };
          // One career in four moves club after a season (the stories have their other-club lines).
          if (seed % 4 === 3 && season === start + 1) c = { ...c, player: { ...c.player, club: NATIONAL_LEAGUE_CLUBS[7] } };
        }
        c = { ...c, week, season, weekActions: 3, energy: 80 };
        const f = facts();
        for (const mo of moments) { m = A.arcMoment(c, mo, { rng: r, facts: f }); c = take(m.career, m); }
        c = note(A.endOfDay(c, r).career);
      }
      const run = A.arcsOf(c)[arc.id];
      if (run?.done) ends.add(run.done);
      for (const [b, f] of Object.entries(run?.f ?? {})) if (f.length) beats.add(b);
      played++;
    }
    for (const e of arc.ends) check(ends.has(e.id), `${arc.id}: the ending "${e.id}" is reached in ${seedsUsed} careers (got ${[...ends].join(", ") || "none"})`);
    for (const b of arc.beats) check(beats.has(b.id), `${arc.id}: the beat "${b.id}" plays in ${seedsUsed} careers`);
    check(!dead.length, `${arc.id}: every due beat opens (${dead.slice(0, 3).join(", ")})`);
  }
  if (process.env.V) console.log(`stories played by the dice: ${played} careers over ${stories.length} stories`);
}

// Story stages, rarity tiers and chains (28 Nov 2026). The checker fails on a chain that can never
// start; ended(...), caps and europe read the career; a stage window holds a story back; a tiered
// book never opens a second big story while one is open.
{
  const { validateArcBook } = await import("../../lib/star/life/validateArcs.ts");
  const { holds } = await import("../../lib/star/life/cond.ts");
  const { ctxFor, factsOf } = await import("../../lib/star/life/facts.ts");
  const { packRun } = await import("../../lib/star/life/arcPack.ts");
  const BOOK = await import("../../lib/star/life/arcBook.ts");
  const { EVENTS } = await import("../../lib/star/life/book.ts");
  type Arc = (typeof BOOK.ALL_ARCS)[number];
  const copy = () => JSON.parse(JSON.stringify(BOOK.ALL_ARCS)) as Arc[];
  const by = (b: Arc[], id: string) => b.find((a) => a.id === id)!;
  const base = validateArcBook(copy(), EVENTS);
  check(base.length === 0, `the whole book passes the checker with tiers, stages and chains (${base.slice(0, 3).map((p) => `${p.id}: ${p.problem}`).join(" | ")})`);
  const broken = (why: string, edit: (b: Arc[]) => void, expect: RegExp) => {
    const b = copy();
    edit(b);
    const got = validateArcBook(b, EVENTS).map((p) => p.problem);
    check(got.some((p) => expect.test(p)), `the checker rejects ${why} (got: ${got.slice(0, 2).join(" | ") || "nothing"})`);
  };
  const CHILD = "arc-the-reporters-patch", PARENT = "arc-the-young-reporter";
  // The chain rules, on a real chain (the young reporter and her patch).
  if (BOOK.arcById(CHILD)) {
  broken("a chain waiting on an ending its parent does not have", (b) => { by(b, CHILD).start!.when = ["ended(arc-the-young-reporter:no-such-ending)"]; }, /does not have/);
  broken("a chain waiting on a story not in the book", (b) => { by(b, CHILD).start!.when = ["ended(arc-no-such-story)"]; }, /not in the book/);
  broken("a chain waiting on a flag nothing sets", (b) => { by(b, CHILD).start!.when = ["flag:set-by-nobody"]; }, /nothing sets/);
  broken("a chain waiting on a memory nothing writes", (b) => { by(b, CHILD).start!.when = ["mem(you,'written-by-nobody')"]; }, /nothing writes/);
  broken("a chain whose parent can never end the way it waits for", (b) => {
    for (const bt of by(b, PARENT).beats) for (const ch of bt.event.choices) for (const o of ch.outcomes) if (o.arc?.end === "her-first") o.arc.end = "the-press-line";
  }, /ever ends it that way/);
  broken("a chain waiting on a story whose game is not built", (b) => { by(b, CHILD).start!.when = ["ended(arc-head-tennis)"]; }, /not built yet/);
  broken("two stories waiting on each other", (b) => { by(b, PARENT).start!.when = ["ended(arc-the-reporters-patch)"]; }, /comes back to itself/);
  }
  broken("a rare story in every career", (b) => { const a = by(b, "arc-the-bins"); delete a.start!.careers; }, /must be in/);
  broken("a story with no tier in a tiered book", (b) => { delete by(b, "arc-the-bins").start!.tier; }, /has none/);
  broken("a stage window that names a person", (b) => { by(b, "arc-the-bins").start!.when = ["tabloid.bond>=5"]; }, /nobody is cast/);

  // ended(...): an open record that is over, and the same story packed small.
  const c0 = career();
  const life0 = c0.life ?? (await import("../../lib/star/life/director.ts")).lifeOf(c0);
  const done = { at: 3, club: "", cast: {}, v: {}, k: {}, f: {}, s: {}, done: "her-first" };
  const lifeA = { ...life0, arcs: { [PARENT]: done } };
  const ctxA = ctxFor(c0, lifeA, {}, factsOf(c0));
  check(holds(`ended(${PARENT})`, ctxA) && holds(`ended(${PARENT}:her-first)`, ctxA) && !holds(`ended(${PARENT}:the-press-line)`, ctxA) && !holds("ended(arc-the-bins)", ctxA), "ended(): any ending, one ending, the wrong ending, a story never met");
  const word = packRun(BOOK.arcById(PARENT)!, done);
  check(!!word, "a finished story packs into one word");
  const lifeB = { ...life0, arcs: {}, fin: word! };
  check(holds(`ended(${PARENT}:her-first)`, ctxFor(c0, lifeB, {}, factsOf(c0))), "ended() reads a story packed small in the save (it keeps its ending for good)");
  const cI = { ...c0, caps: 4, europeanQualification: "Champions League" } as CareerState;
  const ctxI = ctxFor(cI, life0, {}, factsOf(cI));
  check(holds("caps>=3", ctxI) && holds("europe", ctxI) && !holds("europe", ctxFor(c0, life0, {}, factsOf(c0))) && holds("caps<1", ctxFor(c0, life0, {}, factsOf(c0))), "caps and europe read the career");

  // A stage window holds a story back: the statue (a last-seasons story, 32 and over) never starts at 19, even at chance 1.
  const knees = BOOK.arcById("arc-the-statue")!;
  const keep = JSON.stringify(knees.start);
  knees.start = { ...knees.start!, chance: 1 };
  delete knees.start.careers;
  const startsBy = (age: number) => {
    let c = { ...career(), clubAppearances: 20, player: { ...career().player, age } } as CareerState;
    for (let w = 13; w < 13 + 40; w++) {
      c = { ...c, week: w % 46 || 1, weekActions: 3 };
      c = A.arcMoment(c, "arrive:training", { rng, facts: bad }).career;
      if (A.arcsOf(c)["arc-the-statue"]) return w - 13;
    }
    return -1;
  };
  check(startsBy(19) === -1, "a last-seasons story never starts at 19 (its stage window)");
  check(startsBy(33) >= 0, `the same story starts at 33 (week ${startsBy(33)})`);
  // One big story at a time in a tiered book: with the derby open, the call-up (big) never starts.
  const callUp = BOOK.arcById("arc-the-call-up")!;
  const keepCall = JSON.stringify(callUp.start);
  callUp.start = { ...callUp.start!, chance: 1, when: [] };
  delete callUp.start.careers;
  let cb = { ...career(), fame: 60, clubAppearances: 40 } as CareerState;
  cb = A.arcMoment(cb, "arrive:training", { rng, facts: bad, force: "arc-derby-week" }).career;
  let bigTwice = false;
  for (let w = 14; w < 40; w++) {
    cb = { ...cb, week: w, weekActions: 3 };
    cb = A.arcMoment(cb, "home:evening", { rng, facts: bad }).career;
    const open = Object.entries(A.arcsOf(cb)).filter(([id, r]) => !r.done && BOOK.arcById(id)?.size === "big");
    if (open.length > 1) bigTwice = true;
  }
  check(!!A.arcsOf(cb)["arc-derby-week"] && !bigTwice, "a tiered book never has two big stories open at once");
  knees.start = JSON.parse(keep);
  callUp.start = JSON.parse(keepCall);
}

// The people pool (pool.ts; Harry: "surely varying his name/voice across different careers makes
// sense"). For every person in a role's pool, every story that casts the role reads with no slot
// left unfilled and with no other pool person's name; no story hard-codes a pool name.
{
  const { POOL, poolNames } = await import("../../lib/star/life/pool.ts");
  const { fillLine } = await import("../../lib/star/life/text.ts");
  const { ROLE_ID } = await import("../../lib/star/life/people.ts");
  const strings = (o: unknown, out: string[] = []): string[] => {
    if (typeof o === "string") out.push(o);
    else if (Array.isArray(o)) o.forEach((x) => strings(x, out));
    else if (o && typeof o === "object") Object.values(o).forEach((x) => strings(x, out));
    return out;
  };
  const word = (n: string) => new RegExp(`(^|[^A-Za-z])${n}([^A-Za-z]|$)`);
  for (const arc of ARCS) {
    const roles = arc.cast.map((s) => s.pick).filter((r) => POOL[r]);
    const all = strings(arc);
    for (const role of roles) {
      const names = poolNames(role);
      const hard = all.filter((t) => names.some((n) => word(n).test(t)));
      check(!hard.length, `${arc.id}: no ${role}'s name written into the story (${hard[0]?.slice(0, 80) ?? ""})`);
      for (const p of POOL[role]) {
        const base = career();
        const c0 = { ...base, life: { ...(base.life ?? {}), pool: { [role]: p.id } } } as CareerState;
        const cast: Record<string, string> = {};
        for (const s of arc.cast) cast[s.slot] = (ROLE_ID as Record<string, string>)[s.pick] ?? "";
        const ctx = A.arcCtx(c0, arc.id);
        const filled = all.map((t) => fillLine(t, c0, cast, ctx));
        const open = filled.filter((t) => /\{(?!arc\.|activity\.)[a-z]+\.[a-zA-Z]+\}/.test(t));
        const other = names.filter((n) => n !== p.first && n !== (p.short ?? p.first));
        const wrong = filled.filter((t) => other.some((n) => word(n).test(t)));
        check(!open.length, `${arc.id} with ${role} ${p.first}: every slot filled (${open[0]?.slice(0, 80) ?? ""})`);
        check(!wrong.length, `${arc.id} with ${role} ${p.first}: no other ${role}'s name (${wrong[0]?.slice(0, 80) ?? ""})`);
      }
    }
  }
  // The same career keeps its kit man; a different career can get another one.
  const { personInfo } = await import("../../lib/star/life/people.ts");
  const names = new Set<string>();
  for (const first of ["Sam", "Alex", "Jordan", "Leo", "Harry", "Mikey", "Kai", "Theo"]) {
    const b = career();
    const c1 = { ...b, player: { ...b.player, firstName: first } } as CareerState;
    const n1 = personInfo(c1, "staff:kitman")?.short, n2 = personInfo(c1, "staff:kitman")?.short;
    check(n1 === n2, "the same career always has the same kit man");
    names.add(n1 ?? "");
  }
  check(names.size >= 2, `different careers get different kit men (${[...names].join(", ")})`);
  // An old save whose kit man story started before the pool keeps Den.
  const old = migrateLife({ v: 2, people: {}, squad: [], self: [], fired: {}, pending: [], groups: {}, cats: {}, wk: [0, 0, 0], lastBig: -999, soc: [0, {}], flags: [], teamCarry: 0, log: [], arcs: { [ARC]: { at: 1, club: "x", cast: { kitman: "staff:kitman" }, v: {}, k: {}, f: {}, s: {} } } });
  check(old?.pool?.kitman === "den", "an old save keeps Den");
}

// Club people (Harry, 28 Nov 2026: "yes make legends and kit men per club"). The kit man, the
// groundsman, the physio, the canteen, the coach, the chairman and the legend belong to a club.
{
  const P = await import("../../lib/star/life/people.ts");
  const clubs = [NATIONAL_LEAGUE_CLUBS[2], NATIONAL_LEAGUE_CLUBS[5], NATIONAL_LEAGUE_CLUBS[7], NATIONAL_LEAGUE_CLUBS[9]];
  const at = (c: CareerState, club: string) => ({ ...c, player: { ...c.player, club } }) as CareerState;
  const idAt = (c: CareerState, role: "kitman" | "legend" | "canteen") => P.clubRoleId(c, c.life, role);
  const nameOf = (c: CareerState, id: string) => P.personInfo(c, id)?.name ?? "?";
  let c = A.arcMoment(career(), "home:evening", { rng, facts: bad }).career;
  check(c.life?.home === clubs[0] && idAt(c, "kitman") === "staff:kitman", "the first club keeps the plain ids (an old save reads as before)");
  // A story at each club: the kit man it casts is that club's, pinned.
  const kitStories = ["arc-her-song", "arc-the-birthday-card", "arc-the-cup-final-boot", "arc-hundred-balls"];
  const kitIds: string[] = [];
  clubs.forEach((club, i) => {
    c = at(c, club);
    c = A.arcMoment({ ...c, week: c.week + 3 }, "arrive:training", { rng, facts: bad, force: kitStories[i] }).career;
    kitIds.push(A.arcsOf(c)[kitStories[i]]?.cast.kitman ?? "");
  });
  check(kitIds[0] === "staff:kitman" && kitIds.slice(1).every((id, i) => id === `staff:kitman@${P.clubCode(clubs[i + 1])}`), `a story casts the kit man of the club you are at (${kitIds.join(", ")})`);
  const names = kitIds.map((id) => nameOf(c, id));
  check(new Set(names).size === names.length, `a transfer gives you a different kit man, and no two clubs share one (${names.join(", ")})`);
  check(Object.keys(c.life?.cpool ?? {}).filter((k) => k.startsWith("kitman@")).length === 3, `one kit man pin per other club that started a story (${JSON.stringify(c.life?.cpool)}, ${JSON.stringify(c.life?.cpool ?? {}).length} bytes)`);
  // The same career at the same club: the same person, every time; rejoining an old club gets him back.
  const back = at(c, clubs[1]);
  check(idAt(back, "kitman") === kitIds[1] && nameOf(back, idAt(back, "kitman")) === names[1], "back at an old club: the same kit man as before");
  check(idAt(at(c, clubs[0]), "kitman") === "staff:kitman" && nameOf(at(c, clubs[0]), "staff:kitman") === names[0], "back at the first club: the first kit man");
  // A story still open from the old club keeps its man (he can ring you), and he is your old club's.
  const songCast = A.arcsOf(c)["arc-her-song"]?.cast.kitman;
  check(songCast === "staff:kitman" && nameOf(c, songCast) === names[0] && P.fromOldClub(c, songCast) && !P.fromOldClub(c, kitIds[3]), "a story from the old club keeps the old kit man, who is now your old club's");
  // The legend and the canteen too (the canteen has no pool: names from the career and the club).
  const l0 = nameOf(at(c, clubs[0]), idAt(at(c, clubs[0]), "legend")), l1 = nameOf(at(c, clubs[1]), idAt(at(c, clubs[1]), "legend"));
  const k0 = nameOf(at(c, clubs[0]), idAt(at(c, clubs[0]), "canteen")), k1 = nameOf(at(c, clubs[2]), idAt(at(c, clubs[2]), "canteen"));
  check(l0 !== l1 && k0 !== k1, `each club has its own legend and canteen (${l0} / ${l1}; ${k0} / ${k1})`);
  // Your own people do not change with the club.
  check(P.clubRoleId(at(c, clubs[3]), c.life, "mum") === "fam:mum" && P.clubRoleId(at(c, clubs[3]), c.life, "reporter") === "hack:local", "your mum and the local reporter are yours, not the club's");
  // The People page after a transfer: the club you are at now's staff, and the old clubs' people only
  // while they can still ring you (an open story, an open promise, a text still owed).
  {
    const now = at(c, clubs[3]);
    const L = P.clubPeopleLists(now);
    check(L.now.includes(kitIds[3]) && !L.now.includes("staff:kitman") && !L.now.some((id) => P.fromOldClub(now, id)), `the People page lists the new club's kit man, not the first club's (${L.now.join(", ")})`);
    const oldIds = L.old.flatMap((g) => g.ids);
    check(oldIds.every((id) => P.fromOldClub(now, id) && P.canStillRing(now, id)), "every old-club person listed can still ring you");
    // a story still open with the first club's kit man: he is listed, under the first club's name
    const open = { ...now, life: { ...now.life!, people: { ...now.life!.people, "staff:kitman": now.life!.people["staff:kitman"] ?? { r: 45, b: 40, g: 0, m: [] } }, arcs: { ...now.life!.arcs, "arc-test-open": { at: 1, club: clubs[0], cast: { kitman: "staff:kitman" }, v: {}, k: {}, f: {}, s: {} } } } } as CareerState;
    const L2 = P.clubPeopleLists(open);
    check(L2.old.some((g) => g.club === clubs[0] && g.ids.includes("staff:kitman")), `an open story: the first club's kit man is under "Your old clubs" (${JSON.stringify(L2.old)})`);
    // that story ended and nothing else is owed: he drops off the page
    const ended = { ...open, life: { ...open.life!, arcs: Object.fromEntries(Object.entries(open.life!.arcs ?? {}).map(([k, a]) => [k, { ...a, done: "end" }])), promises: [], ech: [] } } as CareerState;
    check(!P.clubPeopleLists(ended).old.length, "nothing open with an old club: no old-club people listed");
  }
  // A save with the club people loads back the same.
  const again = migrateLife(JSON.parse(JSON.stringify(c.life)));
  check(again?.home === c.life?.home && JSON.stringify(again?.cpool) === JSON.stringify(c.life?.cpool), "the first club and the pins survive a save and load");
}

console.log(fails ? `${fails} FAILED` : "life arcs: all passed");
process.exit(fails ? 1 : 0);
