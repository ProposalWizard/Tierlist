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
 * people; the life block under LIFE_BLOCK_LIMIT (50 KB); every follow-up fired or dropped; and it
 * lists any event that never fired (a broken trigger).
 *
 * The stories' part of the save is printed too: open records (life.arcs) and the finished
 * stories packed one word each (life.fin, arcPack.ts).
 *
 * The kit room door (b4-the-door) needs a best of 90 from the dice at Thursday drills, all in
 * season one at technique ~40: about 1 career in 200 gets there, so whether it fires in these
 * 200 careers was luck (red in 3 of 8 runs). When it does not fire here, the soak takes real
 * careers from this run, sitting at a Thursday with two nights done, re-rolls that Thursday's
 * dice (own seeds) until a 90 comes up, and checks the door then opens and plays from that real
 * state. Same thing checked (the door opens in real play), without the luck.
 *
 * STORY STAGES (28 Nov 2026). The careers now move like careers: they start at 17 to 20, about one
 * in four seasons ends in a move (a new club, up or down a level, clubApps back to 0), injuries come
 * in spells, some players get the armband from 24, the good ones win caps, and a Premier League
 * club is in Europe some seasons. The soak prints, per career stage (by age) and per level, how
 * often a story beat comes, every story's reach (careers, the age and season it starts), the share
 * of careers that meet each rarity tier, every chain's reach (parent ending → child start), and
 * how often two big stories were open at once (never, in a tiered book).
 *
 * THE REACH PASS. A legendary story is in about 1 career in 40, so 200 careers meet it a handful of
 * times, too few to see all its endings. After the main run, for every ending not yet seen, the
 * soak picks player names whose once-per-career roll puts that story (and every story it waits on)
 * in the career, and plays those careers for real, the same way. The check is the same (every
 * ending seen in real play); the reach pass only chooses which careers to play. Its careers are
 * counted apart and never in the stage tables. This also makes the two endings that were flaky
 * last round (free-kick-duty "your-penalties", the-penalty-taker "shared") robust.
 *
 *   SOAK_JSON=out.json npx tsx scripts/soak/lifeSoak.mts 200 15   also write the report as data
 *   REACH=0 ...                                                     skip the reach pass
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
import type { LifeArc, LifeMoment } from "../../lib/star/life/types";
import { PERSON_MEMORY_CAP, PEOPLE_CAP } from "../../lib/star/life/types";
// Events v2: the arcs (the kit man), played alongside, every reply and game by the dice.
import { arcMoment, arcsOf, bubblesFor, inCareer, MAX_OPEN_ARCS } from "../../lib/star/life/arcs";
import { autoBeat } from "../../lib/star/life/talk";
import { openPromises, MAX_OPEN_PROMISES } from "../../lib/star/life/promises";
import { ARCS, arcById } from "../../lib/star/life/arcBook";
import { POOL } from "../../lib/star/life/pool";
import { endedIn } from "../../lib/star/life/cond";
import { writeFileSync } from "node:fs";
import { UNLOCKS, grantUnlocks } from "../../lib/star/life/unlocks";
import { SCRAPBOOK, MAX_SCRAPBOOK, MAX_ECHOES } from "../../lib/star/life/scrapbook";
import { freshLife as freshLifeBlock } from "../../lib/star/life/people";

/**
 * The most the living world (career.life: people, memories, promises, stories) may take in one
 * save, in bytes. Was 25 KB; Harry raised it on 27 Nov 2026 ("lift that limit, 50 to 100 KB").
 * Why 50 and not 100: a whole save is 180-550 KB today, and each phone keeps up to 3 of them in
 * the browser's storage (about 5 MB for the whole site), and sends the whole save to the online
 * copy, gzipped, many times a session. 50 KB is at most ~9% on a big save and needs no other
 * change. With finished stories packed at ~13 bytes each (arcPack.ts), the stories part of the
 * biggest soak save is 1-2 KB, so 50 KB is room for thousands more finished stories, far more
 * than a career can meet (one new story at most every 3 weeks). Going to 100 KB would buy
 * nothing the book needs and costs every upload.
 */
const LIFE_BLOCK_LIMIT = 50_000;
/**
 * The story world's new parts (job B, 28 Nov 2026; plan part 4b/4c), each with its own budget in
 * bytes (as JSON in the save). Together ≤ 1.2 KB. The soak prints the biggest seen in real play and a
 * worst case built by hand (every unlock, a full scrapbook, every milestone at once, six echoes),
 * and fails if either passes its budget.
 */
const PART_BUDGET = { ul: 200, sb: 600, ms: 100, ech: 300 } as const;
type Part = keyof typeof PART_BUDGET;
const partBytes = (l: Partial<Record<string, unknown>> | undefined): Record<Part, number> => ({
  ul: l?.ul === undefined ? 0 : JSON.stringify(l.ul).length,
  sb: l?.sb === undefined ? 0 : JSON.stringify(l.sb).length,
  ms: (l?.ms === undefined ? 0 : JSON.stringify(l.ms).length) + (l?.msw === undefined ? 0 : JSON.stringify(l.msw).length),
  ech: l?.ech === undefined ? 0 : JSON.stringify(l.ech).length,
});
const partMax: Record<Part, number> = { ul: 0, sb: 0, ms: 0, ech: 0 };
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
/** Levels 1 (Premier League) to 6 (National League North), for moves. */
const LEVELS: [CareerDivision, readonly string[]][] = [...DIVS, ["national_league_north", C.NATIONAL_LEAGUE_NORTH_CLUBS]];
/** The career stages the report is cut by (age), and the levels. */
const STAGE_NAMES = ["17-19 first seasons", "20-22 breaking through", "23-26 established", "27-30 peak", "31-33 veteran", "34+ last seasons"];
const stageOf = (age: number) => (age <= 19 ? 0 : age <= 22 ? 1 : age <= 26 ? 2 : age <= 30 ? 3 : age <= 33 ? 4 : 5);
const LEVEL_NAMES = ["Premier League", "Championship", "League One/Two", "National League and below"];
const levelOf = (lv: number) => (lv <= 1 ? 0 : lv === 2 ? 1 : lv <= 4 ? 2 : 3);
const TIERS = ["common", "uncommon", "rare", "very-rare", "legendary"];

// The stage report (main careers only; the reach pass is counted apart).
let mode: "main" | "repeat" | "reach" = "repeat";
const stageWeeks = new Array(6).fill(0), stageBeats = new Array(6).fill(0), stageStarts = new Array(6).fill(0), stageBigBeats = new Array(6).fill(0);
const levelWeeks = new Array(4).fill(0), levelBeats = new Array(4).fill(0), levelStarts = new Array(4).fill(0);
const stageQuiet: number[][] = [[], [], [], [], [], []]; // the longest gap with no beat, per career and stage
let bigOverlapWeeks = 0, twoBigBeatWeeks = 0, situWeeks = { injured: 0, newClub: 0, captain: 0, europe: 0, caps: 0 }, situStarts = { injured: 0, newClub: 0, captain: 0, europe: 0, caps: 0 };
const arcStat = new Map<string, { careers: number; ages: number[]; seasons: number[]; levels: number[] }>();
const tierCareers = new Map<string, number>();
const reachEnds = new Map<string, number>();

const carAt = (lv: number) => LIFESTYLE_ALL_LEVELS.find((i) => i.category === "vehicle" && baseIdOf(i).startsWith("car") && (i.level ?? 1) === lv)
  ?? LIFESTYLE_ALL_LEVELS.find((i) => i.category === "vehicle");

const fireCount = new Map<string, number>();
let weeksTotal = 0, eventsTotal = 0, socialTotal = 0, chatsTotal = 0, followUpsFired = 0, dropped = 0, pendingLeft = 0;
let maxLife = 0, sumLife = 0, maxPeople = 0, maxMem = 0, eventMoney = 0, wageMoney = 0, callbacksShown = 0, carsLost = 0;
const perSeason: number[] = [];
// Events v2 counters.
const arcEnds = new Map<string, number>(), beatFires = new Map<string, number>();
let storyBytesMax = 0, packedMax = 0, finChars = 0, finWords = 0;
const DOOR = "b4-the-door";
const doorSnaps: { c: CareerState; facts: Record<string, unknown>; arc: string; beat: string }[] = [];
let arcsStarted = 0, arcsUnfinished = 0, promisesOpenAtEnd = 0, promisesKept = 0, promisesBroken = 0, maxOpenArcs = 0, arcBytesMax = 0;
const unfinishedAt = new Map<string, number>();
const t0 = Date.now();
let beatTotal = 0, kitTotal = 0;
const stageKit = new Array(6).fill(0);
const weekBigBeats = new Set<string>();
// The kit man starts by chance until 21 (Harry, 28 Nov): careers that meet him, by the age they start at.
const kitByAge = [0, 0, 0, 0];
let clubPinBytesMax = 0, clubPins = 0, kitMenMet = 0;
function fired(arc: string, beat: string) {
  beatFires.set(beat, (beatFires.get(beat) ?? 0) + 1);
  beatTotal++;
  if (arc === "arc-hundred-balls") kitTotal++;
  if (arcById(arc)?.size === "big") weekBigBeats.add(arc);
}

function runCareer(n: number, lastName = `Life${n}`): { events: number; lifeBytes: number } {
  const rng = mulberry32(9001 + n * 7919);
  // A second generator for the career's moves, so the weekly dice stay as they were.
  const life2 = mulberry32(424242 + n * 104729);
  const [div, clubs] = DIVS[n % DIVS.length];
  const club = clubs[(n * 3) % clubs.length];
  const startAge = 17 + (n % 4);
  const player = { firstName: "Soak", lastName, age: startAge, skinTone: "light", club, clubBadge: null, position: POS[n % POS.length], nationality: "England", startYear: 2027 } as StarPlayer;
  let c: CareerState = makeInitialCareer(player, [...clubs], div);
  c = { ...c, contract: { ...c.contract, wage: Math.max(c.contract.wage, 400) }, money: 2000, fame: 5 };
  let level = DIVS.findIndex(([d]) => d === div) + 1;
  // Some players are good (caps, the armband, moves up), some are not.
  const talent = life2();
  const quiet = new Array(6).fill(0), longest = new Array(6).fill(0), seenStage = new Array(6).fill(false);
  const recorded = new Set<string>(), tiersSeen = new Set<string>();
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
        // Injuries come in spells: about one a season, two to seven weeks.
        injury: c.injury ? (c.injury.weeksRemaining > 1 ? { ...c.injury, weeksRemaining: c.injury.weeksRemaining - 1 } : null)
          : life2() < 0.022 ? { weeksRemaining: 2 + Math.floor(life2() * 6), note: "soak" } : null,
      };
      const beatsBefore = beatTotal, kitBefore = kitTotal;
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
        for (const sc of r.screens) { const a = autoBeat(c, sc.arc, sc.beat, { rng, facts, pick }); check(!!a, `${sc.beat}: a due beat would not open`); if (a) { c = a.career; fired(sc.arc, sc.beat); } }
        for (const o of r.offers) if (rng() < 0.6) { const a = autoBeat(c, o.arc, o.beat, { rng, facts, pick }); if (a) { c = a.career; fired(o.arc, o.beat); } }
      }
      for (const [, run] of Object.entries(arcsOf(c))) {
        const den = run.cast.kitman;
        if (!den) continue;
        for (const bb of bubblesFor(c, den, facts)) if (!bb.gold && rng() < 0.5) {
          const kit = arcsOf(c)[bb.arc];
          if (bb.beat === "b3-thursdays" && doorSnaps.length < 12 && Number(kit?.v.nights ?? 0) >= 2 && !kit?.f[DOOR]?.length) doorSnaps.push({ c, facts, arc: bb.arc, beat: bb.beat });
          const a = autoBeat(c, bb.arc, bb.beat, { rng, facts, pick }); if (a) { c = a.career; fired(bb.arc, bb.beat); } }
      }
      {
        const open = Object.values(arcsOf(c)).filter((r) => !r.done).length;
        maxOpenArcs = Math.max(maxOpenArcs, open);
        check(open <= MAX_OPEN_ARCS, `more than ${MAX_OPEN_ARCS} stories open at once`);
        check(openPromises(c).length <= MAX_OPEN_PROMISES, `more than ${MAX_OPEN_PROMISES} promises open`);
      }
      // The stage report: what this week was, and what the stories did in it.
      if (mode === "main") {
        const f = { age: c.player.age, lv: level, injured: !!c.injury, newClub: s > 1 && (c.clubAppearances ?? 0) <= 12, captain: !!c.captain, europe: !!c.europeanQualification, caps: (c.caps ?? 0) > 0 };
        const st = stageOf(f.age), lv = levelOf(f.lv);
        const beats = beatTotal - beatsBefore;
        stageWeeks[st]++; levelWeeks[lv]++; stageBeats[st] += beats; levelBeats[lv] += beats; seenStage[st] = true; stageKit[st] += kitTotal - kitBefore;
        quiet[st] = beats ? 0 : quiet[st] + 1; longest[st] = Math.max(longest[st], quiet[st]);
        for (const k of Object.keys(situWeeks) as (keyof typeof situWeeks)[]) if (f[k]) situWeeks[k]++;
        const runs = arcsOf(c);
        const openBig = Object.entries(runs).filter(([id, r]) => !r.done && arcById(id)?.size === "big").length;
        if (openBig > 1) bigOverlapWeeks++;
        if (weekBigBeats.size > 1) twoBigBeatWeeks++;
        stageBigBeats[st] += weekBigBeats.size;
        for (const [id, r] of Object.entries(runs)) {
          if (recorded.has(id) || r.at !== now) continue;
          recorded.add(id);
          const a = arcById(id);
          if (!a?.start) continue;
          stageStarts[st]++; levelStarts[lv]++;
          for (const k of Object.keys(situStarts) as (keyof typeof situStarts)[]) if (f[k]) situStarts[k]++;
          const row = arcStat.get(id) ?? { careers: 0, ages: [], seasons: [], levels: [] };
          row.careers++; row.ages.push(f.age); row.seasons.push(s); row.levels.push(f.lv);
          if (id === "arc-hundred-balls") kitByAge[startAge - 17]++;
          arcStat.set(id, row);
          if (a.start.tier) tiersSeen.add(a.start.tier);
        }
      }
      weekBigBeats.clear();
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
      // Half the careers meet somebody by season 2 (the partner stories need one).
      girlfriend: c.girlfriend ?? (s >= 1 && n % 2 === 0 ? { name: "Soak Partner", happiness: 60, gifts: 0 } : null),
      horse: c.horse ?? (s >= 4 && rng() < 0.3 ? { name: "Soak Runner", breed: "Thoroughbred", speed: 70, stamina: 70, energy: 100, racesRun: 0, racesWon: 0, earnings: 0 } : null),
      contract: { ...c.contract, wage: Math.round(c.contract.wage * (1.05 + rng() * 0.2)) },
      // A footballer gets better: the stories' games (rolled here) read his skills.
      skills: { ...c.skills, technique: Math.min(85, (c.skills?.technique ?? 50) + 2), power: Math.min(85, (c.skills?.power ?? 50) + 2), vision: Math.min(85, (c.skills?.vision ?? 50) + 2) },
    };
    // The career moves (story stages): about one season in four ends in a move, a good player tends
    // up and a poor one down; the armband from 24; caps for the good ones; Europe some seasons.
    const age = c.player.age;
    if (life2() < 0.26) {
      const up = life2() < 0.3 + talent * 0.4 - (age >= 31 ? 0.3 : 0);
      level = Math.max(1, Math.min(6, level + (up ? -1 : life2() < 0.5 ? 0 : 1)));
      const [d2, cl2] = LEVELS[level - 1];
      const club2 = cl2[Math.floor(life2() * cl2.length)];
      const squad2 = generateSquad(n * 977 + s * 31).map((p) => ({ ...p, id: `${p.id}-m${s}-${n}`, age: 17 + Math.floor(life2() * 16), overall: 55 + Math.floor(life2() * 25) }));
      c = { ...c, player: { ...c.player, club: club2 }, division: d2, clubAppearances: 0, squad: squad2, captain: false, fame: Math.min(100, c.fame + (up ? 5 : 0)) };
    }
    if (!c.captain && age >= 24 && life2() < 0.08 + talent * 0.12) c = { ...c, captain: true };
    if (talent > 0.55 && level <= 2 && age >= 20 && life2() < 0.6) c = { ...c, caps: (c.caps ?? 0) + 1 + Math.floor(life2() * 6) };
    c = { ...c, europeanQualification: level === 1 && life2() < 0.4 ? ("Champions League" as CareerState["europeanQualification"]) : null };
  }
  if (mode === "main") {
    for (let st = 0; st < 6; st++) if (seenStage[st]) stageQuiet[st].push(longest[st]);
    for (const t of tiersSeen) tierCareers.set(t, (tierCareers.get(t) ?? 0) + 1);
  } else if (mode === "reach") for (const [id, run] of Object.entries(arcsOf(c))) if (run.done) reachEnds.set(`${id}:${run.done}`, (reachEnds.get(`${id}:${run.done}`) ?? 0) + 1);
  for (const [id, run] of Object.entries(mode === "main" ? arcsOf(c) : {})) {
    arcsStarted++;
    if (run.done) arcEnds.set(`${id}:${run.done}`, (arcEnds.get(`${id}:${run.done}`) ?? 0) + 1);
    else { arcsUnfinished++; const k = `${id} after ${run.last}`; unfinishedAt.set(k, (unfinishedAt.get(k) ?? 0) + 1); }
    arcBytesMax = Math.max(arcBytesMax, JSON.stringify(run).length);
  }
  for (const p of c.life?.promises ?? []) { if (p.st === "open") promisesOpenAtEnd++; else if (p.st === "kept") promisesKept++; else promisesBroken++; }
  const bytes = c.life ? JSON.stringify(c.life).length : 0;
  // Club people: the pins for the clubs you moved to, and no two clubs sharing a person.
  if (mode === "main") {
    const cp = c.life?.cpool ?? {};
    clubPinBytesMax = Math.max(clubPinBytesMax, JSON.stringify(cp).length + (c.life?.home?.length ?? 0));
    clubPins += Object.keys(cp).length;
    const byRole = new Map<string, string[]>();
    for (const [k, v] of Object.entries(cp)) { const r = k.split("@")[0]; byRole.set(r, [...(byRole.get(r) ?? []), v]); }
    for (const [r, vs] of byRole) { const home = c.life?.pool?.[r]; const all = home ? [home, ...vs] : vs; check(new Set(all).size === all.length || all.length > (POOL[r]?.length ?? 99), `two clubs share a ${r}`); }
    kitMenMet += new Set(Object.values(arcsOf(c)).map((r) => r.cast.kitman).filter(Boolean)).size;
  }
  storyBytesMax = Math.max(storyBytesMax, JSON.stringify(c.life?.arcs ?? {}).length + (c.life?.fin?.length ?? 0));
  { const pb = partBytes(c.life as unknown as Record<string, unknown>); for (const k of Object.keys(pb) as Part[]) partMax[k] = Math.max(partMax[k], pb[k]); }
  const words = (c.life?.fin ?? "").split(" ").filter(Boolean).length;
  packedMax = Math.max(packedMax, words); finWords += words; finChars += (c.life?.fin ?? "").length;
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
storyBytesMax = 0; packedMax = 0; finChars = 0; finWords = 0; doorSnaps.length = 0;
arcEnds.clear(); beatFires.clear(); unfinishedAt.clear(); arcsStarted = 0; arcsUnfinished = 0; promisesOpenAtEnd = 0; promisesKept = 0; promisesBroken = 0; maxOpenArcs = 0; arcBytesMax = 0;
mode = "main";
for (let n = 0; n < CAREERS; n++) {
  const r = runCareer(n);
  maxLife = Math.max(maxLife, r.lifeBytes); sumLife += r.lifeBytes;
  check(r.lifeBytes < LIFE_BLOCK_LIMIT, `the life block passed ${LIFE_BLOCK_LIMIT / 1000} KB`);
}
const tMain = (Date.now() - t0) / 1000;

// ── The reach pass (see the top): careers chosen to hold the stories whose endings are not seen yet ──
const reached = (id: string) => arcEnds.has(id) || reachEnds.has(id);
/** A story and every story its start waits on (ended(...)), the chain to the top. */
function chainOf(a: LifeArc): LifeArc[] {
  const out: LifeArc[] = [], todo = [a];
  while (todo.length) {
    const x = todo.pop()!;
    if (out.includes(x)) continue;
    out.push(x);
    for (const w of x.start?.when ?? []) for (const [pid] of endedIn(w)) { const p = arcById(pid); if (p) todo.push(p); }
  }
  return out;
}
let reachCareers = 0;
const reachTries = new Map<string, number>(), reachFor = new Map<string, number>();
if (process.env.REACH !== "0") {
  mode = "reach";
  const MAX = Number(process.env.REACH_MAX ?? 260);
  let k = 0;
  while (reachCareers < MAX) {
    const need = ARCS.filter((a) => a.start && (reachTries.get(a.id) ?? 0) < 60 && a.ends.some((e) => !reached(`${a.id}:${e.id}`)));
    if (!need.length) break;
    need.sort((a, b) => (reachTries.get(a.id) ?? 0) - (reachTries.get(b.id) ?? 0));
    const target = need[0];
    // The name (from the next 600) that puts the target's whole chain in the career, and as many
    // other unfinished stories as it can.
    let best = "", bestN = -1;
    for (let j = 0; j < 600; j++, k++) {
      const p = { firstName: "Soak", lastName: `Reach${k}`, startYear: 2027 };
      if (!chainOf(target).every((x) => inCareer(x, p))) continue;
      const score = need.filter((x) => chainOf(x).every((y) => inCareer(y, p))).length;
      if (score > bestN) { bestN = score; best = p.lastName; }
    }
    for (const x of need) if (chainOf(x).every((y) => inCareer(y, { firstName: "Soak", lastName: best, startYear: 2027 }))) reachTries.set(x.id, (reachTries.get(x.id) ?? 0) + 1);
    if (!best) { reachTries.set(target.id, 99); continue; }
    const before = new Set([...reachEnds.keys()]);
    // A late-career story gets a player who starts at 20 (career numbers 3, 7, 11 ... start at 20),
    // so its last seasons fit inside the soak's seasons.
    const late = chainOf(target).some((x) => x.start?.stage === "veteran" || x.start?.stage === "last-seasons");
    const r = runCareer(late ? 10_003 + reachCareers * 4 : 10_000 + reachCareers, best);
    check(r.lifeBytes < LIFE_BLOCK_LIMIT, `the life block passed ${LIFE_BLOCK_LIMIT / 1000} KB (reach pass)`);
    maxLife = Math.max(maxLife, r.lifeBytes);
    for (const key of reachEnds.keys()) if (!before.has(key) && !arcEnds.has(key)) reachFor.set(key.split(":")[0], (reachFor.get(key.split(":")[0]) ?? 0) + 1);
    reachCareers++;
  }
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
// The door from real Thursdays when the dice did not give a 90 here (see the top).
function doorFromRealState(): string {
  // Technique is about 40 then: a 90 is about 1 Thursday in 7,000, so up to 60,000 re-rolls.
  for (let seed = 0; doorSnaps.length && seed < 60_000; seed++) {
    const sn = doorSnaps[seed % doorSnaps.length];
    const r = mulberry32(31337 + seed * 101);
    const pick = (k: number) => Math.floor(r() * k);
    const a = autoBeat(sn.c, sn.arc, sn.beat, { rng: r, facts: sn.facts, pick });
    if (!a || Number(arcsOf(a.career)[sn.arc]?.v.best ?? 0) < 90) continue;
    const m = arcMoment({ ...a.career, week: a.career.week + 1 }, "arrive:training", { rng: r, facts: sn.facts });
    const door = m.screens.find((x) => x.beat === DOOR);
    if (!door) return `a best of ${arcsOf(a.career)[sn.arc]?.v.best} after ${arcsOf(a.career)[sn.arc]?.v.nights} nights, but the door did not open`;
    return autoBeat(m.career, door.arc, door.beat, { rng: r, facts: sn.facts, pick }) ? "ok" : "the door opened but would not play";
  }
  return `no 90 in 60,000 re-rolls of ${doorSnaps.length} real Thursdays`;
}
let doorNote = "";
if (!beatFires.get(DOOR)) { const d = doorFromRealState(); doorNote = d === "ok" ? "not by these dice; opens and plays from a real Thursday re-rolled to 90" : d; if (d === "ok") beatFires.set(`${DOOR} (re-rolled)`, 1); check(d === "ok", `${DOOR} never fired, and from a real Thursday: ${d}`); }
// Events v2: every arc reaches each of its endings; a beat seasons away fires; nothing left open at the end.
for (const a of ARCS) for (const e of a.ends) check(reached(`${a.id}:${e.id}`), `${a.id} never ended "${e.id}"`);
for (const a of ARCS) for (const b of a.beats) check((beatFires.get(b.id) ?? 0) > 0 || b.id === DOOR || b.event.trigger.when.includes("followUp") && b.id.includes("7b"), `${b.id} never fired`);
console.log(`stories: ${arcsStarted} started, ${arcsUnfinished} unfinished at the end (${[...unfinishedAt.entries()].map(([k, v]) => `${k} ×${v}`).join(", ") || "none"}); most open at once ${maxOpenArcs}; largest story in the save ${arcBytesMax} bytes`);
console.log(`  endings: ${[...arcEnds.entries()].map(([k, v]) => `${k.split(":")[1]} ${v}`).join(", ")}`);
console.log(`  beats: ${[...beatFires.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`  the kit room door: ${beatFires.get(DOOR) ?? 0} careers by the dice${doorNote ? ` (${doorNote})` : ""}`);
console.log(`stories in the save: max ${(storyBytesMax / 1024).toFixed(1)} KB (open records, and at most ${packedMax} finished stories packed, ${finWords ? (finChars / finWords).toFixed(1) : 0} bytes each on average)`);
console.log(`  promises: kept ${promisesKept}, broken ${promisesBroken}, still open at the end ${promisesOpenAtEnd}`);

// ── The stage report (story stages and tiers, 28 Nov 2026) ──
const tiered = ARCS.some((a) => a.start?.tier);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const stageRows = STAGE_NAMES.map((name, i) => ({
  stage: name, careerSeasons: +(stageWeeks[i] / WEEKS).toFixed(1),
  weeksPerBeat: stageBeats[i] ? +(stageWeeks[i] / stageBeats[i]).toFixed(1) : null,
  weeksPerBeatNoKitMan: stageBeats[i] - stageKit[i] ? +(stageWeeks[i] / (stageBeats[i] - stageKit[i])).toFixed(1) : null,
  startsPerSeason: stageWeeks[i] ? +((stageStarts[i] / stageWeeks[i]) * WEEKS).toFixed(1) : null,
  bigBeatsPerSeason: stageWeeks[i] ? +((stageBigBeats[i] / stageWeeks[i]) * WEEKS).toFixed(2) : null,
  longestQuietMedian: med(stageQuiet[i]), longestQuietMax: Math.max(0, ...stageQuiet[i]),
}));
const levelRows = LEVEL_NAMES.map((name, i) => ({
  level: name, careerSeasons: +(levelWeeks[i] / WEEKS).toFixed(1),
  weeksPerBeat: levelBeats[i] ? +(levelWeeks[i] / levelBeats[i]).toFixed(1) : null,
  startsPerSeason: levelWeeks[i] ? +((levelStarts[i] / levelWeeks[i]) * WEEKS).toFixed(1) : null,
}));
console.log(`\nSTAGES (main ${CAREERS} careers, ${tMain.toFixed(0)} s; by age): weeks between story beats · new stories a season · big-story beats a season · longest quiet spell (median / worst, weeks)`);
for (const r of stageRows) console.log(`  ${r.stage.padEnd(24)} ${String(r.careerSeasons).padStart(6)} career-seasons · a beat every ${r.weeksPerBeat ?? "-"} wk (${r.weeksPerBeatNoKitMan ?? "-"} without the kit man) · ${r.startsPerSeason ?? "-"} new · ${r.bigBeatsPerSeason ?? "-"} big · quiet ${r.longestQuietMedian}/${r.longestQuietMax}`);
console.log("LEVELS:");
for (const r of levelRows) console.log(`  ${r.level.padEnd(26)} ${String(r.careerSeasons).padStart(6)} career-seasons · a beat every ${r.weeksPerBeat ?? "-"} wk · ${r.startsPerSeason ?? "-"} new a season`);
console.log(`SITUATIONS (share of weeks → share of story starts): ${Object.keys(situWeeks).map((k) => `${k} ${pct(situWeeks[k as keyof typeof situWeeks], weeksTotal)} → ${pct(situStarts[k as keyof typeof situStarts], stageStarts.reduce((a, b) => a + b, 0))}`).join(" · ")}`);
console.log(`two big stories open at once: ${bigOverlapWeeks} weeks; two big stories' beats in one week: ${twoBigBeatWeeks}`);
if (tiered) check(bigOverlapWeeks === 0, "two big stories open at once");
const tierRows = TIERS.map((t) => {
  const list = ARCS.filter((a) => a.start?.tier === t);
  return { tier: t, stories: list.length, careersSeeingOne: pct(tierCareers.get(t) ?? 0, CAREERS), storiesPerCareer: +(list.reduce((s, a) => s + (arcStat.get(a.id)?.careers ?? 0), 0) / CAREERS).toFixed(1) };
});
console.log(`TIERS: ${tierRows.map((r) => `${r.tier} ${r.stories} stories, ${r.careersSeeingOne} of careers meet one, ${r.storiesPerCareer} a career`).join(" · ")}`);
const chainRows = ARCS.filter((a) => (a.start?.when ?? []).some((w) => endedIn(w).length)).map((a) => {
  const parents = (a.start!.when ?? []).flatMap((w) => endedIn(w)).map(([p, ends]) => `${p.replace(/^arc-/, "")}${ends.length ? `:${ends.join("|")}` : ""}`);
  return { child: a.id, parents: parents.join(" + "), started: arcStat.get(a.id)?.careers ?? 0, reachEndings: a.ends.filter((e) => reached(`${a.id}:${e.id}`)).length + "/" + a.ends.length };
});
console.log(`CHAINS (${chainRows.length}): ${chainRows.map((r) => `${r.child.replace(/^arc-/, "")} ← ${r.parents}: ${r.started} careers`).join(" · ")}`);
const arcRows = ARCS.filter((a) => a.start).map((a) => {
  const s = arcStat.get(a.id);
  return { id: a.id, tier: a.start?.tier ?? "", stage: a.start?.stage ?? "", size: a.size ?? "", careers: s?.careers ?? 0, age: s ? med(s.ages) : null, ageMin: s ? Math.min(...s.ages) : null, ageMax: s ? Math.max(...s.ages) : null, season: s ? med(s.seasons) : null, levels: s ? [...new Set(s.levels)].sort().join("") : "", ends: a.ends.map((e) => [e.id, arcEnds.get(`${a.id}:${e.id}`) ?? 0, reachEnds.get(`${a.id}:${e.id}`) ?? 0]) };
});
const notMet = arcRows.filter((r) => !r.careers).map((r) => r.id.replace(/^arc-/, ""));
console.log(`club people: ${(clubPins / CAREERS).toFixed(1)} pins a career for clubs moved to (biggest ${clubPinBytesMax} bytes with the first club); kit men met in stories ${(kitMenMet / CAREERS).toFixed(2)} a career`);
console.log(`the kit man (a chance until 21): met in ${kitByAge.map((k, i) => `${pct(k, Math.ceil((CAREERS - i) / 4))} of careers starting at ${17 + i}`).join(", ")}`);
console.log(`never started in the main careers: ${notMet.length} (${notMet.join(", ") || "none"})`);
console.log(`reach pass: ${reachCareers} extra careers; endings first seen there: ${[...reachFor.entries()].map(([k, v]) => `${k.replace(/^arc-/, "")} ${v}`).join(", ") || "none"}`);
if (process.env.SOAK_JSON) writeFileSync(process.env.SOAK_JSON, JSON.stringify({ careers: CAREERS, seasons: SEASONS, stageRows, levelRows, situWeeks, situStarts, bigOverlapWeeks, twoBigBeatWeeks, tierRows, chainRows, arcRows, reachCareers, maxLife, meanLife: sumLife / CAREERS, kitByAge, clubPinBytesMax, clubPinsPerCareer: clubPins / CAREERS, kitMenPerCareer: kitMenMet / CAREERS }, null, 1));
// The story world's parts (job B): the biggest seen in play, and a worst case built by hand.
{
  const worst = freshLifeBlock();
  grantUnlocks(worst, UNLOCKS.map((u) => u.id));
  const codes = Object.values(SCRAPBOOK).map((t) => t.code);
  worst.sb = Array.from({ length: MAX_SCRAPBOOK }, (_, i) => `${codes[i % codes.length]}${""}.${9999 - i}.3`).map((w, i) => (i < codes.length ? w : `x${String(i).padStart(3, "0")}${w.slice(4)}`)).join(" ");
  worst.ms = [40, 100, 99, 99, 25, "zzzz"];
  worst.msw = { bd: 9999, sl: 9999, nc: 9999, fc: 9999, tr: 9999, tn: 99, pr: 9999 };
  worst.ech = Array.from({ length: MAX_ECHOES }, (_, i) => [9999, `staff:kitman@ab1${i}`, "numh", "ab12"] as [number, string, string, string]);
  const wb = partBytes(worst as unknown as Record<string, unknown>);
  console.log(`story world parts (bytes; budget): ${(Object.keys(PART_BUDGET) as Part[]).map((k) => `${k} ${partMax[k]} in play, ${wb[k]} worst case (${PART_BUDGET[k]})`).join(" · ")}; total worst ${Object.values(wb).reduce((a, b) => a + b, 0)} of 1200`);
  for (const k of Object.keys(PART_BUDGET) as Part[]) {
    check(partMax[k] <= PART_BUDGET[k], `the story world's ${k} part passed its budget in play (${partMax[k]} > ${PART_BUDGET[k]} bytes)`);
    check(wb[k] <= PART_BUDGET[k], `the story world's ${k} part passed its budget at worst (${wb[k]} > ${PART_BUDGET[k]} bytes)`);
  }
}
for (const [k, n] of problems) console.log(`  ✗ ${k} ×${n}`);
if (!problems.size) console.log("all held");
process.exit(problems.size ? 1 : 0);
