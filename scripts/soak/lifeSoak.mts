/**
 * LIFE SOAK (living world, phase 1): 200 careers x 15 seasons x 46 weeks, with
 * random choices, checking the director's promises. Run:
 *   npx tsx scripts/soak/lifeSoak.mts            (200 careers, 15 seasons)
 *   npx tsx scripts/soak/lifeSoak.mts 40 6       (40 careers, 6 seasons)
 *
 * The careers are real (makeInitialCareer: real squads, real money ladder), but
 * the football is skipped: each week a result and a rating are rolled and the
 * career ages, earns, signs and sells around them. That keeps 138,000 weeks to
 * well under a minute; scripts/soak/careerSoak.mts covers the football itself.
 *
 * It must show: at most 2 events a week and 1 medium-or-big; 6 weeks between
 * big ones; no event over its limit; memory at most 6 lines a person and 60
 * people; the life block under 25 KB; every follow-up fired or dropped; and it
 * lists any event that never fired (a broken trigger).
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import * as C from "../../lib/star/clubs";
import { generateSquad } from "../../lib/star/squadData";
import { mulberry32 } from "../../lib/star/season";
import { LIFESTYLE_ALL_LEVELS, baseIdOf } from "../../lib/star/shopData";
import { freshItem } from "../../lib/star/fame";
import type { CareerState, CareerDivision, StarPlayer } from "../../lib/star/types";
import { EVENTS } from "../../lib/star/life/book";
import { pickEvent, startEvent, dropStale, BIG_GAP_WEEKS, MAX_PER_WEEK, MAX_HEAVY_PER_WEEK } from "../../lib/star/life/director";
import { chooseOption } from "../../lib/star/life/resolve";
import { chat, startOuting, socialBlocked } from "../../lib/star/life/social";
import { lifeWeek } from "../../lib/star/life/people";
import { weekOfMoney } from "../../lib/star/life/facts";
import type { LifeMoment } from "../../lib/star/life/types";
import { PERSON_MEMORY_CAP, PEOPLE_CAP } from "../../lib/star/life/types";
// Events v2: the arcs (the kit man), played alongside, every reply and game by the dice.
import { arcMoment, arcsOf, bubblesFor, MAX_OPEN_ARCS } from "../../lib/star/life/arcs";
import { autoBeat } from "../../lib/star/life/talk";
import { openPromises, MAX_OPEN_PROMISES } from "../../lib/star/life/promises";
import { ARCS } from "../../lib/star/life/arcBook";

const CAREERS = Number(process.argv[2] ?? 200);
const SEASONS = Number(process.argv[3] ?? 15);
const WEEKS = 46;

const problems = new Map<string, number>();
const check = (ok: boolean, what: string) => { if (!ok) problems.set(what, (problems.get(what) ?? 0) + 1); };

const DIVS: [CareerDivision, readonly string[]][] = [
  ["premier", C.PREMIER_LEAGUE_CLUBS], ["championship", C.CHAMPIONSHIP_CLUBS], ["league_one", C.LEAGUE_ONE_CLUBS],
  ["league_two", C.LEAGUE_TWO_CLUBS], ["national_league", C.NATIONAL_LEAGUE_CLUBS],
];
const POS = ["ST", "CM", "LW", "CB", "CAM", "RW"] as const;

const carAt = (lv: number) => LIFESTYLE_ALL_LEVELS.find((i) => i.category === "vehicle" && baseIdOf(i).startsWith("car") && (i.level ?? 1) === lv)
  ?? LIFESTYLE_ALL_LEVELS.find((i) => i.category === "vehicle");

const fireCount = new Map<string, number>();
let weeksTotal = 0, eventsTotal = 0, socialTotal = 0, chatsTotal = 0, followUpsFired = 0, dropped = 0, pendingLeft = 0;
let maxLife = 0, sumLife = 0, maxPeople = 0, maxMem = 0, eventMoney = 0, wageMoney = 0, callbacksShown = 0, carsLost = 0;
const perSeason: number[] = [];
// Events v2 counters.
const arcEnds = new Map<string, number>(), beatFires = new Map<string, number>();
let arcsStarted = 0, arcsUnfinished = 0, promisesOpenAtEnd = 0, promisesKept = 0, promisesBroken = 0, maxOpenArcs = 0, arcBytesMax = 0;
const unfinishedAt = new Map<string, number>();
const t0 = Date.now();

function runCareer(n: number): { events: number; lifeBytes: number } {
  const rng = mulberry32(9001 + n * 7919);
  const [div, clubs] = DIVS[n % DIVS.length];
  const club = clubs[(n * 3) % clubs.length];
  const player = { firstName: "Soak", lastName: `Life${n}`, age: 17, skinTone: "light", club, clubBadge: null, position: POS[n % POS.length], nationality: "England", startYear: 2027 } as StarPlayer;
  let c: CareerState = makeInitialCareer(player, [...clubs], div);
  c = { ...c, contract: { ...c.contract, wage: Math.max(c.contract.wage, 400) }, money: 2000, fame: 5 };
  // A real squad has ages and ratings (a generated one does not): give them, as the database would.
  c = { ...c, squad: c.squad.map((p, i) => ({ ...p, age: p.age ?? 17 + ((i * 7 + n) % 17), overall: p.overall ?? 55 + ((i * 11 + n) % 25) })) };
  let events = 0;
  let lastBig = -999;
  for (let s = 1; s <= SEASONS; s++) {
    let seasonEvents = 0;
    for (let w = 1; w <= WEEKS; w++) {
      weeksTotal++;
      const won = rng() < 0.45, lost = !won && rng() < 0.6;
      const rating = Math.round((5 + rng() * 4) * 10) / 10;
      const facts = { lastRating: rating, lastWon: won, lastLost: lost, lastGoals: rng() < 0.3 ? 1 : 0 };
      // The career moves on around the events.
      const wage = weekOfMoney(c);
      wageMoney += wage; // the whole wage; the soak keeps 30% of it (the rest is spent on living)
      c = {
        ...c, season: s, week: w, money: c.money + Math.round(wage * 0.3), weekActions: 3,
        energy: Math.max(10, Math.min(100, Math.round(c.energy + (rng() - 0.55) * 40))),
        fame: Math.min(100, c.fame + (rng() < 0.3 ? 1 : 0)),
        clubAppearances: (c.clubAppearances ?? 0) + 1,
        seasonStats: { ...c.seasonStats, goals: (w === 1 ? 0 : c.seasonStats.goals) + facts.lastGoals },
      };
      const ds = dropStale(c); c = ds.career; dropped += ds.dropped;
      const now = lifeWeek(c);
      let thisWeek = 0, heavy = 0;
      const moments: LifeMoment[] = ["walkout", "after-match", "arrive:training", "home:evening", "driving"];
      if (rng() < 0.08) moments.push("leave:casino");
      if (w === WEEKS) moments.push("season-end");
      for (const m of moments) {
        if (m === "driving" && !(c.ownedItems ?? []).some((i) => i.category === "vehicle")) continue;
        const live = pickEvent(c, m, { rng, facts });
        if (!live) continue;
        const moneyBefore = c.money;
        c = startEvent(c, live);
        thisWeek++; events++; seasonEvents++; eventsTotal++;
        if (live.followUp) followUpsFired++;
        if (live.callbacks.length) callbacksShown++;
        if (live.event.size !== "small") heavy++;
        if (live.event.size === "big") { check(now - lastBig >= BIG_GAP_WEEKS, `a big event within ${BIG_GAP_WEEKS} weeks of another`); lastBig = now; }
        fireCount.set(live.id, (fireCount.get(live.id) ?? 0) + 1);
        const open = live.choices.filter((x) => !x.locked);
        if (!open.length) { check(false, `${live.id}: no choice you can afford`); continue; }
        const pick = open[Math.floor(rng() * open.length)];
        const carsBefore = (c.ownedItems ?? []).filter((i) => i.category === "vehicle").length;
        const r = chooseOption(c, live, pick.id, { rng, facts });
        check(!!r, `${live.id}: a choice did not resolve`);
        if (r) {
          check(r.changes.length > 0, `${live.id}/${pick.id}: a choice landed nothing`);
          c = r.career;
          eventMoney += Math.abs(c.money - moneyBefore);
          if ((c.ownedItems ?? []).filter((i) => i.category === "vehicle").length < carsBefore) carsLost++;
        }
      }
      // Events v2: the stories at the same moments. Offers taken 6 times in 10, Thursdays half the time.
      const pick = (k: number) => Math.floor(rng() * k);
      for (const m of moments) {
        const r = arcMoment(c, m, { rng, facts });
        c = r.career;
        for (const sc of r.screens) { const a = autoBeat(c, sc.arc, sc.beat, { rng, facts, pick }); check(!!a, `${sc.beat}: a due beat would not open`); if (a) { c = a.career; beatFires.set(sc.beat, (beatFires.get(sc.beat) ?? 0) + 1); } }
        for (const o of r.offers) if (rng() < 0.6) { const a = autoBeat(c, o.arc, o.beat, { rng, facts, pick }); if (a) { c = a.career; beatFires.set(o.beat, (beatFires.get(o.beat) ?? 0) + 1); } }
      }
      for (const [, run] of Object.entries(arcsOf(c))) {
        const den = run.cast.kitman;
        if (!den) continue;
        for (const bb of bubblesFor(c, den, facts)) if (!bb.gold && rng() < 0.5) { const a = autoBeat(c, bb.arc, bb.beat, { rng, facts, pick }); if (a) { c = a.career; beatFires.set(bb.beat, (beatFires.get(bb.beat) ?? 0) + 1); } }
      }
      {
        const open = Object.values(arcsOf(c)).filter((r) => !r.done).length;
        maxOpenArcs = Math.max(maxOpenArcs, open);
        check(open <= MAX_OPEN_ARCS, `more than ${MAX_OPEN_ARCS} stories open at once`);
        check(openPromises(c).length <= MAX_OPEN_PROMISES, `more than ${MAX_OPEN_PROMISES} promises open`);
      }
      check(thisWeek <= MAX_PER_WEEK, `more than ${MAX_PER_WEEK} events in a week`);
      check(heavy <= MAX_HEAVY_PER_WEEK, `more than ${MAX_HEAVY_PER_WEEK} medium-or-big events in a week`);
      // Social actions now and then, with a random team-mate.
      const mate = c.squad[Math.floor(rng() * c.squad.length)];
      if (mate && rng() < 0.35) {
        const r = chat(c, mate.id, rng, facts);
        if (r) { c = r.career; chatsTotal++; socialTotal++; check(r.line.length > 0, "a chat with no line"); }
      }
      const mate2 = c.squad[Math.floor(rng() * c.squad.length)];
      const kind = rng() < 0.12 ? "drive" : rng() < 0.08 ? "races" : null;
      if (mate2 && kind && !socialBlocked(c, mate2.id, kind)) {
        const o = startOuting(c, mate2.id, kind, rng, facts);
        if (o && "live" in o) {
          c = o.career; socialTotal++;
          fireCount.set(o.live.id, (fireCount.get(o.live.id) ?? 0) + 1);
          const open = o.live.choices.filter((x) => !x.locked);
          if (open.length) { const r = chooseOption(c, o.live, open[Math.floor(rng() * open.length)].id, { rng, facts }); if (r) c = r.career; }
        } else if (o) { c = o.career; socialTotal++; }
      }
      // Memory never grows past its caps.
      const life = c.life;
      if (life) {
        const ppl = Object.values(life.people);
        maxPeople = Math.max(maxPeople, ppl.length);
        for (const p of ppl) { maxMem = Math.max(maxMem, p.m.length); check(p.m.length <= PERSON_MEMORY_CAP, "a person holds more than 6 memories"); for (const k of ["r", "b", "g"] as const) check(p[k] >= 0 && p[k] <= 100 && Number.isInteger(p[k]), "a person's number left 0-100"); }
        check(ppl.length <= PEOPLE_CAP, "more than 60 people kept");
        check(life.squad.length <= PERSON_MEMORY_CAP, "squad memory over 6");
      }
      check(Number.isFinite(c.money) && c.money >= 0, "money went bad");
      check(Number.isFinite(c.relationships.team), "team bar went bad");
    }
    perSeason[s - 1] = (perSeason[s - 1] ?? 0) + seasonEvents;
    // Season over: older, a car for the well-off, some of the squad move on.
    const fresh = generateSquad(n * 131 + s * 17).map((p) => ({ ...p, id: `${p.id}-s${s}-${n}`, age: 17 + Math.floor(rng() * 16) }));
    const keep = c.squad.filter(() => rng() < 0.8);
    const squad = [...keep, ...fresh.slice(0, Math.max(0, 22 - keep.length))].map((p) => ({ ...p, age: (p.age ?? 22) + 1, seasonGoals: Math.floor(rng() * 12) }));
    const owned = [...(c.ownedItems ?? [])];
    if (s >= 1 && !owned.some((i) => i.category === "vehicle") && rng() < 0.7) { const car = carAt(Math.min(5, 1 + Math.floor(s / 3))); if (car) owned.push(freshItem(car)); }
    c = {
      ...c, player: { ...c.player, age: c.player.age + 1 }, squad, ownedItems: owned,
      horse: c.horse ?? (s >= 4 && rng() < 0.3 ? { name: "Soak Runner", breed: "Thoroughbred", speed: 70, stamina: 70, energy: 100, racesRun: 0, racesWon: 0, earnings: 0 } : null),
      contract: { ...c.contract, wage: Math.round(c.contract.wage * (1.05 + rng() * 0.2)) },
      // A footballer gets better: the stories' games (rolled here) read his skills.
      skills: { ...c.skills, technique: Math.min(85, (c.skills?.technique ?? 50) + 2), power: Math.min(85, (c.skills?.power ?? 50) + 2), vision: Math.min(85, (c.skills?.vision ?? 50) + 2) },
    };
  }
  for (const [id, run] of Object.entries(arcsOf(c))) {
    arcsStarted++;
    if (run.done) arcEnds.set(`${id}:${run.done}`, (arcEnds.get(`${id}:${run.done}`) ?? 0) + 1);
    else { arcsUnfinished++; const k = `${id} after ${run.last}`; unfinishedAt.set(k, (unfinishedAt.get(k) ?? 0) + 1); }
    arcBytesMax = Math.max(arcBytesMax, JSON.stringify(run).length);
  }
  for (const p of c.life?.promises ?? []) { if (p.st === "open") promisesOpenAtEnd++; else if (p.st === "kept") promisesKept++; else promisesBroken++; }
  const bytes = c.life ? JSON.stringify(c.life).length : 0;
  pendingLeft += c.life?.pending.length ?? 0;
  for (const [id, k] of Object.entries(c.life?.fired ?? {})) {
    const e = EVENTS.find((x) => x.id === id);
    if (!e) continue;
    const limit = e.trigger.once ? 1 : e.trigger.maxPerCareer ?? 1;
    check(k.length <= limit, `${id} fired more than its limit (${limit})`);
  }
  return { events, lifeBytes: bytes };
}

let repeatOk = true;
const first = runCareer(0);
const again = runCareer(0);
repeatOk = first.events === again.events && first.lifeBytes === again.lifeBytes;
check(repeatOk, "the same seed gave a different career (not repeatable)");
// Reset counters after the repeat check, then the real run.
fireCount.clear(); weeksTotal = 0; eventsTotal = 0; socialTotal = 0; chatsTotal = 0; followUpsFired = 0; dropped = 0; pendingLeft = 0;
maxPeople = 0; maxMem = 0; eventMoney = 0; wageMoney = 0; callbacksShown = 0; carsLost = 0; perSeason.length = 0;
arcEnds.clear(); beatFires.clear(); unfinishedAt.clear(); arcsStarted = 0; arcsUnfinished = 0; promisesOpenAtEnd = 0; promisesKept = 0; promisesBroken = 0; maxOpenArcs = 0; arcBytesMax = 0;
for (let n = 0; n < CAREERS; n++) {
  const r = runCareer(n);
  maxLife = Math.max(maxLife, r.lifeBytes); sumLife += r.lifeBytes;
  check(r.lifeBytes < 25_000, "the life block passed 25 KB");
}

const never = EVENTS.filter((e) => !fireCount.has(e.id)).map((e) => e.id);
check(never.length === 0, `events that never fired: ${never.join(", ")}`);
console.log(`${CAREERS} careers x ${SEASONS} seasons = ${weeksTotal} weeks, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`events (director): ${eventsTotal} = ${(eventsTotal / weeksTotal).toFixed(2)} a week; per career ${(eventsTotal / CAREERS).toFixed(1)}`);
console.log(`  by season (avg per career): ${perSeason.map((x) => (x / CAREERS).toFixed(1)).join(" ")}`);
console.log(`social actions: ${socialTotal} (chats ${chatsTotal}); follow-ups fired ${followUpsFired}, dropped ${dropped}, still waiting at the end ${pendingLeft}`);
console.log(`events showing a callback line: ${callbacksShown}; cars lost: ${carsLost}`);
console.log(`life block: max ${(maxLife / 1024).toFixed(1)} KB, mean ${(sumLife / CAREERS / 1024).toFixed(1)} KB; most people ${maxPeople}; most memories on one person ${maxMem}`);
console.log(`money moved by events: ${((eventMoney / wageMoney) * 100).toFixed(1)}% of wages`);
console.log(`repeatable: ${repeatOk ? "yes" : "NO"}`);
const counts = [...fireCount.entries()].sort((a, b) => b[1] - a[1]);
console.log(`most fired: ${counts.slice(0, 5).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`least fired: ${counts.slice(-5).map(([k, v]) => `${k} ${v}`).join(", ")}`);
// Events v2: every arc reaches each of its endings; a beat seasons away fires; nothing left open at the end.
for (const a of ARCS) for (const e of a.ends) check(arcEnds.has(`${a.id}:${e.id}`), `${a.id} never ended "${e.id}"`);
for (const a of ARCS) for (const b of a.beats) check((beatFires.get(b.id) ?? 0) > 0 || b.event.trigger.when.includes("followUp") && b.id.includes("7b"), `${b.id} never fired`);
console.log(`stories: ${arcsStarted} started, ${arcsUnfinished} unfinished at the end (${[...unfinishedAt.entries()].map(([k, v]) => `${k} ×${v}`).join(", ") || "none"}); most open at once ${maxOpenArcs}; largest story in the save ${arcBytesMax} bytes`);
console.log(`  endings: ${[...arcEnds.entries()].map(([k, v]) => `${k.split(":")[1]} ${v}`).join(", ")}`);
console.log(`  beats: ${[...beatFires.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`  promises: kept ${promisesKept}, broken ${promisesBroken}, still open at the end ${promisesOpenAtEnd}`);
for (const [k, n] of problems) console.log(`  ✗ ${k} ×${n}`);
if (!problems.size) console.log("all held");
process.exit(problems.size ? 1 : 0);
