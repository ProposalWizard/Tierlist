/**
 * WHO IS IN YOUR HOUSE TODAY (lib/star/life/dayPlan.ts; plan phase 2): seeded (same day, same plan),
 * a flat is empty on about 6 days in 10 (50-70%), no team-mate on match day or within 4 hours of
 * kick-off, a yes to "come round?" always shows up at the time picked, a no never does, the cleaner
 * only at the House tier and up on Mondays and Thursdays, the chef only at the Villa and Estate,
 * everyone leaves, and it never invents a person (team-mates come from the squad).
 */
import { dayPlan, dayPlanFor, withInvite, houseMates, DROP_IN, NO_VISIT_BEFORE_KO, type DayInput } from "../../lib/star/life/dayPlan";
import { roomsFor, HOME_TIERS } from "../../lib/star/home3d/homes";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { clockOf, nextMatchInfo, dayNumber } from "../../lib/star/life/clock";
import type { CareerState, StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok && problems.length < 40) problems.push(what); };

const mates = [{ id: "m1", name: "Kyle" }, { id: "m2", name: "Den" }, { id: "m3", name: "Rico" }, { id: "m4", name: "Sol" }];
const base = (tier: DayInput["tier"], dayNo: number, extra: Partial<DayInput> = {}): DayInput => ({ tier, rooms: roomsFor(tier, "new", true), mates, dayNo, dow: dayNo % 7, matchKo: null, seed: "Test Player 2027", ...extra });

const DAYS = 2000;
const empty: Record<string, number> = {};
for (const tier of HOME_TIERS) {
  let none = 0;
  for (let d = 0; d < DAYS; d++) {
    const p = dayPlan(base(tier, d));
    if (!p.some((v) => v.who === "mate")) none++;
    // seeded: the same day, the same plan
    if (d % 250 === 0) check(JSON.stringify(dayPlan(base(tier, d))) === JSON.stringify(p), `${tier} day ${d}: not the same twice`);
    for (const v of p) {
      check(v.steps[v.steps.length - 1].kind === "leave", `${tier} day ${d}: ${v.name} never leaves`);
      if (v.who === "mate") check(mates.some((m) => m.id === v.mateId && m.name === v.name), `${tier}: a team-mate who is not in the squad (${v.name})`);
      if (v.who === "cleaner") check(tier === "house" || tier === "villa" || tier === "estate", `${tier}: a cleaner below the House tier`);
      if (v.who === "cleaner") check((d % 7) === 1 || (d % 7) === 4, `${tier}: the cleaner on day-of-week ${d % 7}`);
      if (v.who === "chef") check(tier === "villa" || tier === "estate", `${tier}: a chef below the Villa`);
    }
    if (tier === "villa" || tier === "estate") check(p.filter((v) => v.who === "chef").length === 2, `${tier} day ${d}: the chef, lunch and dinner`);
  }
  empty[tier] = none / DAYS;
  check(Math.abs(none / DAYS - (1 - DROP_IN[tier])) < 0.05, `${tier}: no team-mate on ${(100 * none / DAYS).toFixed(0)}% of days (want ${(100 * (1 - DROP_IN[tier])).toFixed(0)}%)`);
}
check(empty.flat >= 0.5 && empty.flat <= 0.7, `a flat is empty 50-70% of days (${(100 * empty.flat).toFixed(0)}%)`);

// ── match day: no team-mate at all; staff gone before you leave ──
for (let d = 0; d < 500; d++) {
  const ko = [12.5, 15, 17.5, 19.75, 20][d % 5] * 60;
  for (const tier of ["flat", "villa"] as const) {
    const p = dayPlan(base(tier, d, { matchKo: ko }));
    check(!p.some((v) => v.who === "mate"), `${tier} match day ${d}: a team-mate came round`);
    for (const v of p) check(v.to <= ko - 150, `${tier} match day ${d}: ${v.name} still in at time to leave`);
  }
}
// an invite on match day: he can come, but leaves 4 hours before kick-off at the latest
{
  const p = dayPlan(base("flat", 3, { matchKo: 19.75 * 60, invite: { at: 10 * 60, mateId: "m2", yes: true } }));
  const v = p.find((x) => x.mateId === "m2");
  check(!!v && v.to <= 19.75 * 60 - NO_VISIT_BEFORE_KO, "an invite on match day ends 4 hours before kick-off");
}

// ── invites ──
for (let d = 0; d < 200; d++) {
  const yes = dayPlan(base("flat", d, { invite: { at: 18 * 60, mateId: "m3", yes: true } }));
  check(yes.length === 1 && yes[0].mateId === "m3" && yes[0].from === 18 * 60, `day ${d}: a yes comes at 18:00 (${yes.map((v) => `${v.name} ${v.from}`).join(", ")})`);
  const no = dayPlan(base("flat", d, { invite: { at: 18 * 60, mateId: "m3", yes: false } }));
  check(!no.some((v) => v.who === "mate"), `day ${d}: a no never turns up (and nobody else drops in that day)`);
}

// ── off a career: the clock's day, its invite on the save ──
const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
const nx = nextMatchInfo(c)!;
check(dayPlanFor(c, nx.day, roomsFor("flat", "new", true), "flat", mates).every((v) => v.who !== "mate"), "off a career: nobody drops in on match day");
const inv = withInvite(c, 0, "m1", 13 * 60);
check(!!inv.career.clock?.inv && inv.career.clock.inv[0] === dayNumber(c, 0), "an invite is saved on the clock (a few bytes)");
const pl = dayPlanFor(inv.career, 0, roomsFor("flat", "new", true), "flat", mates);
check(inv.yes ? pl.some((v) => v.mateId === "m1" && v.from === inv.at) : !pl.some((v) => v.who === "mate"), `the saved invite plays (${inv.yes ? "yes" : "no"} at ${inv.at})`);
check(JSON.stringify(clockOf(inv.career)).length < 60, `the clock with an invite stays small (${JSON.stringify(clockOf(inv.career)).length} bytes)`);
check(Array.isArray(houseMates(c)), "house mates read off the squad");

if (problems.length) {
  console.error(`dayPlan: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`dayPlan: ok (empty days: ${Object.entries(empty).map(([t, v]) => `${t} ${(100 * v).toFixed(0)}%`).join(", ")}; match days clear; invites keep their word)`);
