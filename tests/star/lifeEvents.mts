/**
 * THE LIVING WORLD, phase 1 (Harry, 20 Nov 2026; docs/plans/living-world-design-2026-11-20.md).
 *
 *  1. The book passes the checker: 30 events, 0 problems.
 *  2. The checker rejects weightless and broken events (one per rule).
 *  3. Memory: at most 6 lines, the weakest goes; strength 1 fades, 3 never.
 *  4. The team rule: a team-mate's bond moves the team bar by a fifth; a
 *     fall-out costs the team bar once; teamForMatch reads it.
 *  5. The director: at most 2 a week, 1 heavy; follow-ups first; no repeats.
 *  6. Effects land: a wager lost is money gone; a burnt car is gone; a memory
 *     comes back as a callback line in a later event.
 *  7. Old saves: no life block is fine; a broken one is put back in shape.
 *  8. Off in the real career.
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage;

const { EVENTS, CHATS } = await import("../../lib/star/life/book.ts");
const { validateBook } = await import("../../lib/star/life/validate.ts");
const P = await import("../../lib/star/life/people.ts");
const D = await import("../../lib/star/life/director.ts");
const R = await import("../../lib/star/life/resolve.ts");
const S = await import("../../lib/star/life/social.ts");
const { migrateLife } = await import("../../lib/star/life/migrate.ts");
const { LIFE_IN_CAREER } = await import("../../lib/star/life/flag.ts");
const { makeInitialCareer } = await import("../../lib/star/careerFlow.ts");
const { NATIONAL_LEAGUE_CLUBS } = await import("../../lib/star/clubs.ts");
const { mulberry32 } = await import("../../lib/star/season.ts");
const { LIFESTYLE_ALL_LEVELS } = await import("../../lib/star/shopData.ts");
const { freshItem } = await import("../../lib/star/fame.ts");
import type { CareerState, StarPlayer } from "../../lib/star/types";
import type { LifeEvent } from "../../lib/star/life/types";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.log("FAIL", msg); } };

// 1
const book = validateBook(EVENTS, CHATS);
check(EVENTS.length >= 30, `the book has at least 30 events (has ${EVENTS.length})`);
check(book.length === 0, `the book passes the checker: ${book.slice(0, 5).map((p) => `${p.id}: ${p.problem}`).join(" | ")}`);

// 2: each broken copy must be rejected for the right reason.
const base = JSON.parse(JSON.stringify(EVENTS.find((e) => e.id === "drv-mate-borrow-car"))) as LifeEvent;
const broken = (why: string, edit: (e: LifeEvent) => void, expect: RegExp) => {
  const e = JSON.parse(JSON.stringify(base)) as LifeEvent;
  e.id = `broken-${why}`;
  edit(e);
  const probs = validateBook([...EVENTS, e], CHATS).filter((p) => p.id === e.id).map((p) => p.problem);
  check(probs.some((p) => expect.test(p)), `the checker rejects ${why} (got: ${probs.join(" | ") || "nothing"})`);
};
broken("no-reason", (e) => { e.trigger.requires = []; }, /no reason to fire/);
broken("no-person", (e) => { e.cast = [{ slot: "mate", pick: "stranger" }]; e.trigger.requires = ["fame>=1"]; }, /no named person/);
broken("no-memory", (e) => { for (const c of e.choices) for (const o of c.outcomes) delete o.remember; }, /writes a memory/);
broken("no-callback", (e) => { e.callbacks = []; for (const c of e.choices) for (const o of c.outcomes) delete o.followUp; }, /nothing comes back/);
broken("all-gifts", (e) => { e.choices = [e.choices[2]]; e.choices[0].cost = undefined; }, /every choice is a gift/);
broken("too-big", (e) => { e.choices[1].outcomes[0].effects = { boss: -20 }; }, /too much for a medium/);
broken("bad-chances", (e) => { e.choices[0].outcomes[0].chance = 0.5; }, /chances add up/);
broken("unknown-condition", (e) => { e.trigger.requires = ["moonPhase>=3"]; }, /unknown condition/);
broken("unknown-cast", (e) => { e.cast[0].pick = "lawyer" as never; }, /unknown cast rule/);
broken("missing-follow-up", (e) => { e.choices[0].outcomes[1].followUp = { event: "no-such-event", afterWeeks: [1, 2] }; }, /not in the book/);
broken("unknown-slot", (e) => { e.setup.push("{gaffer.name} watches."); }, /names a slot/);
broken("real-brand", (e) => { e.setup.push("He is wearing Nike boots."); }, /real name or brand/);
broken("long-line", (e) => { e.setup.push("x".repeat(300)); }, /too long/);
broken("unread-tag", (e) => { e.callbacks.push({ ifMemory: "mate:never-written-tag", where: "event:any", line: "x" }); }, /no event writes/);
broken("dominant-choice", (e) => {
  e.choices = [
    { id: "a", label: "A", outcomes: [{ text: "a", effects: { team: 3 }, npc: [{ slot: "mate", bond: 5 }], remember: [{ slot: "mate", tag: "refused-car", strength: 1 }] }] },
    { id: "b", label: "B", outcomes: [{ text: "b", effects: { team: -1 }, npc: [{ slot: "mate", bond: 1 }] }] },
  ];
}, /beats every other choice/);
broken("copy", (e) => { e.id = "broken-copy"; }, /reads like a copy/);

// 3: memory
let mem: [string, number, 1 | 2 | 3][] = [];
for (let i = 0; i < 9; i++) mem = P.remember(mem, `tag-${i}`, i, i === 2 ? 3 : 1);
check(mem.length === 6, `memory holds at most 6 lines (has ${mem.length})`);
check(mem.some(([t]) => t === "tag-2"), "a strength-3 memory is never the one dropped");
check(!mem.some(([t]) => t === "tag-0"), "the weakest oldest memory is dropped first");
check(P.fade([["a", 0, 1], ["b", 0, 3]], 100).map(([t]) => t).join() === "b", "strength 1 fades after a season, strength 3 never");

// A test career.
function career(seed = 7): CareerState {
  const player = { firstName: "Test", lastName: "Player", age: 22, skinTone: "light", club: NATIONAL_LEAGUE_CLUBS[2], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c = makeInitialCareer(player, [...NATIONAL_LEAGUE_CLUBS], "national_league");
  const car = LIFESTYLE_ALL_LEVELS.find((i) => i.category === "vehicle" && (i.level ?? 1) >= 2)!;
  void seed;
  return { ...c, season: 3, week: 10, fame: 40, money: 200_000, energy: 70, weekActions: 3, contract: { ...c.contract, wage: 1000 }, ownedItems: [freshItem(car)] };
}

// 4: the team rule
{
  const life = P.freshLife();
  const id = career().squad[0].id;
  P.meet(life, id, 1);
  const p = life.people[id];
  const before = p.b;
  const db = P.nudge(p, "b", -10);
  const tm = P.moveTeamFromPerson(life, id, db);
  check(db < 0 && tm.team === Math.ceil(db * P.TEAM_SHARE), `a bond change moves the team bar by a fifth (bond ${before}→${p.b}, team ${tm.team})`);
  const db2 = P.nudge(p, "b", -40);
  const tm2 = P.moveTeamFromPerson(life, id, db2);
  check(tm2.fellOut && tm2.team <= -P.FALL_OUT_HIT, `a fall-out costs the team bar ${P.FALL_OUT_HIT} once (team ${tm2.team})`);
  const tm3 = P.moveTeamFromPerson(life, id, 0);
  check(!tm3.fellOut && tm3.team === 0, "a fall-out is only counted once");
  const c = { ...career(), life };
  check(P.teamForMatch(c) === c.relationships.team - P.FALL_OUT_MATCH, "teamForMatch takes a fall-out off the team number");
  check(P.teamForMatch(career()) === career().relationships.team, "with no life block teamForMatch is exactly the team bar");
}

// 5: the director
{
  let c = career();
  const rng = mulberry32(3);
  const a = D.pickEvent(c, "after-match", { rng, force: "tm-dropped-sulks", facts: { lastWon: true } }) ?? D.pickEvent(c, "home:evening", { rng, force: "fam-mum-birthday" });
  check(!!a, "a forced event can be cast");
  // Fill the week's budget by hand: two events this week.
  c = D.startEvent(c, D.pickEvent(c, "home:evening", { rng, force: "fam-mum-birthday" })!);
  c = D.startEvent(c, D.pickEvent(c, "home:evening", { rng, force: "kit-man-signed-shirt" })!);
  let any = 0;
  for (let i = 0; i < 50; i++) if (D.pickEvent(c, "home:evening", { rng: mulberry32(i) })) any++;
  check(any === 0, `no third event in a week (${any} found)`);
  // No repeats: a once event never comes back.
  c = { ...c, week: 30 };
  let again = 0;
  for (let i = 0; i < 200; i++) { const x = D.pickEvent(c, "arrive:training", { rng: mulberry32(i) }); if (x?.id === "kit-man-signed-shirt") again++; }
  check(again === 0, "a once-only event never fires twice");
  // Follow-ups first.
  let f = career();
  const mate = f.squad[0].id;
  const life = P.freshLife();
  P.meet(life, mate, 1).m = [["you-lent-him-money", 1, 3]];
  life.pending = [{ event: "tm-loan-comes-back", due: P.lifeWeek(f), cast: { mate } }];
  f = { ...f, life };
  const fu = D.pickEvent(f, "arrive:training", { rng: mulberry32(1) });
  check(fu?.id === "tm-loan-comes-back" && fu.followUp, `a due follow-up comes first (got ${fu?.id})`);
}

// 6: effects land
{
  // A lost bet is money gone.
  let c = career();
  const mate = c.squad[1].id;
  const life = P.freshLife(); P.meet(life, mate, 1).b = 60; c = { ...c, life };
  const o = S.startOuting(c, mate, "races", mulberry32(5));
  check(!!o && "live" in o, "a day at the races opens its event");
  if (o && "live" in o) {
    const paidTicket = c.money - o.career.money;
    check(paidTicket > 0, `the day out costs real money (${paidTicket})`);
    const r = R.chooseOption(o.career, o.live, "back-tip", { rng: mulberry32(1), forceOutcome: 1 });
    check(!!r && r.career.money < o.career.money, "a lost bet takes the stake");
    check(!!r && (r.career.life?.people[mate]?.m.some(([t]) => t === "you-backed-his-bad-tip") ?? false), "he remembers the bad tip");
  }
  // A burnt car is gone.
  let k = career();
  const lk = P.freshLife(); lk.self = [["reported-the-fixer", 1, 3]]; k = { ...k, life: lk };
  const ev = D.pickEvent(k, "home:evening", { rng: mulberry32(2), force: "scn-match-fix-return" });
  check(!!ev, "the fixer comes back");
  if (ev) {
    const r = R.chooseOption(k, ev, "hang-up", { rng: mulberry32(2), forceOutcome: 1 });
    check(!!r && !r.career.ownedItems.some((i) => i.category === "vehicle"), "the burnt car is gone for good");
  }
  // A memory comes back as a callback line in a later event.
  let m = career();
  const id = m.squad[2].id;
  const lm = P.freshLife(); P.meet(lm, id, 1).b = 50; lm.people[id].m = [["drove-him-to-mums-60th", 1, 3]]; m = { ...m, life: lm };
  const later = D.pickEvent(m, "social:drive", { rng: mulberry32(4), socialTarget: id, force: "soc-drive-long-way" });
  check(!!later && later.callbacks.some((cb) => /Mum still asks/.test(cb.line)), "the memory comes back as a line in a later event");
  // A chat lands a callback first.
  const lc = P.freshLife(); P.meet(lc, id, 1).m = [["refused-car", 1, 2]];
  const ch = S.chat({ ...career(), life: lc }, id, mulberry32(9));
  check(!!ch && ch.callback && /car/.test(ch.line), `a chat brings up what he remembers (${ch?.line})`);
  check(!!ch && S.chat(ch.career, id, mulberry32(10)) === null, "one chat per person a week");
  // The physio who was lied to takes the choice away.
  let ph = career();
  const lp = P.freshLife(); P.meet(lp, P.ROLE_ID.physio, 1).m = [["made-her-lie-and-it-tore", 1, 3]]; ph = { ...ph, energy: 20, life: lp };
  const inj = D.pickEvent(ph, "arrive:training", { rng: mulberry32(1), force: "inj-tight-hamstring" });
  check(!!inj && !inj.choices.some((x) => x.id === "play"), "a choice you abused is gone next time");
}

// 7: old saves
check(JSON.stringify(migrateLife(undefined)) === JSON.stringify(P.freshLife()), "no life block reads as a fresh one");
const fixed = migrateLife({ people: { a: { r: 900, b: "x", g: -5, m: [["t", 1, 9], "junk", ["u", 2, 1], ["v", 3, 2], ["w", 4, 2], ["x", 5, 1], ["y", 6, 1], ["z", 7, 1]] } }, wk: "bad", flags: [1, "ok"] });
check(fixed.people.a.r === 100 && fixed.people.a.b === 30 && fixed.people.a.g === 0, "a broken person is clamped back to 0-100");
check(fixed.people.a.m.length === 6 && fixed.people.a.m.every((x) => [1, 2, 3].includes(x[2])), "a broken memory log is trimmed to 6 good lines");
check(fixed.flags.join() === "ok" && fixed.wk.length === 3, "broken fields are put back in shape");

// 8
check(LIFE_IN_CAREER === false, "the living world is off in the real career until Harry says");

if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log(`living world: all held (${EVENTS.length} events, ${CHATS.length} chats)`);
