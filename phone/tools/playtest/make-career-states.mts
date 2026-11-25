/**
 * CAREER FRAME STATES FOR BOTH APPS (the screen inventory, inventory/CAREER.md).
 * Like ../look/make-save.mts, but a choice of the career moments that are slow to
 * reach by playing. Prints { packed: {localStorage key: value}, next: {...} }.
 *
 *   npx tsx phone/tools/playtest/make-career-states.mts <state>
 *
 * States:
 *   trial-last   a trialist with four of the five trial stages done; only the free
 *                kick is left, so one strike shows "Next up"… no: it shows the end,
 *                "A scout has spotted you", then the scout's talk.
 *   trial-dribble  four of the five stages done; only "Take him on" (dribbling) is left.
 *   trial-done   all five stages done: both apps open on the scout's talk.
 *   retire-due   an Arsenal career in its last season (CAREER_SEASONS) (retirementCheck
 *                says it must retire at this season's end), every match played: End of Season.
 *   final-next   the season before the last: the Golden Ball night is followed by "your final season".
 *   season-over  Arsenal, every match of season 1 played and the June international
 *                break declined (not called up): Home shows "End of Season".
 *   youth        signed to a club's youth team (placement youth), as a trial that
 *                nobody signed from can end.
 *   free-agent   a finished trial, no club, no offers: the free-agent life.
 *   (round 2 playtest, 21 Nov 2026:)
 *   mid-season   Arsenal, 18 matches played (week ~18 of the league), Home.
 *   injured      mid-season with a 4-week injury and energy 20 (Home, before the next match).
 *   low-energy   mid-season, energy 15, no injury.
 *   intl-due     played up to the first international period that is due, not yet decided:
 *                Home shows the call-up page (or after Continue).
 *   intl-duty    the same period decided as CALLED UP: Home is "on duty".
 *   long-names   mid-season, player "Maximiliano-Alexander Okonkwo" (29 letters), ★1,250,000.
 *   loan         a Premier League offer turned into a loan at a League One club (phase loan-brief).
 * Use with drive.mjs's reload(app, kv) (see inventory/CAREER.md "How the stills were made").
 */
import { makeIdentity, makeInitialCareer, creditMatchResult, simulateMissedFixture, attachClub } from "../../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../../lib/star/clubs";
import { nextFixtureFor } from "../../../lib/star/competitions";
import { periodDue, decide, applyDecision } from "../../../lib/star/intl/career";
import { saveCareer, saveStarPhase, ANON_SCOPE } from "../../../lib/star/storage";
import { startTrial, recordStage, TRIAL_STAGES } from "../../../lib/star/trial";
import { startYouthSpell, startLoanSpell } from "../../../lib/star/youth";
import { CAREER_SEASONS } from "../../../lib/star/retirement";
import { clubsForDivision } from "../../../lib/star/scoutOffers";
import type { CareerState, MatchStats, StarPlayer, StarPhase } from "../../../lib/star/types";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const state = process.argv[2] ?? "trial-last";
const player = {
  firstName: "Look", lastName: "Check", age: 16, skinTone: "light",
  club: "", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  preferredNumber: 9, preferredFoot: "right", hairStyle: "short", hairColour: "brown",
} as unknown as StarPlayer;

function stats(us: number, them: number, home: boolean, goals: number): MatchStats {
  return { chances: 5, goals, assists: 1, passes: 28, rating: 7.2, starMan: goals >= 2, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2, homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90 } as MatchStats;
}
/** Play every fixture but the last `left`, the way make-season-end.mts does. */
function playSeason(c: CareerState, left: number): CareerState {
  for (let i = 0; i < 400; i++) {
    const unplayed = c.fixtures.filter((f) => !f.played).length;
    if (unplayed <= left) break;
    const f = nextFixtureFor(c);
    if (!f) break;
    const r = i % 5;
    const [us, them] = r === 0 ? [1, 1] : r === 1 ? [0, 1] : [2, 0];
    try { c = creditMatchResult(c, f, stats(us, them, f.home !== false, us > 0 ? 1 : 0)).career; }
    catch { c = simulateMissedFixture(c, f).career; }
  }
  return c;
}

let career: CareerState;
let phase: StarPhase | null = null;
if (state === "trial-last" || state === "trial-dribble" || state === "trial-done" || state === "free-agent") {
  let trial = startTrial(0x5eed1234);
  const skip = state === "trial-last" ? new Set(["freeKicks"]) : state === "trial-dribble" ? new Set(["dribbling"]) : new Set<string>();
  for (const s of TRIAL_STAGES) if (!skip.has(s)) trial = recordStage(trial, s, state === "free-agent" ? 0 : 0.8);
  career = { ...makeIdentity(player, "premier"), trial };
  phase = state === "trial-done" ? "manager-talk" : state === "free-agent" ? "free-agent" : "trial-stages";
} else if (state === "youth") {
  let trial = startTrial(0x5eed1234);
  for (const s of TRIAL_STAGES) trial = recordStage(trial, s, 0.3);
  const id = { ...makeIdentity(player, "premier"), trial };
  const clubs = clubsForDivision("national_league_south");
  const club = clubs[0];
  const signed = attachClub(id, club, clubs, "national_league_south", 20);
  career = { ...signed, contract: { club, wage: 20, goalBonus: 5, assistBonus: 3, seasonsRemaining: 2 }, placement: startYouthSpell(club, "national_league_south", "trial") };
  phase = "youth";
} else if (state === "loan") {
  let trial = startTrial(0x5eed1234);
  for (const s of TRIAL_STAGES) trial = recordStage(trial, s, 0.8);
  const id = { ...makeIdentity(player, "premier"), trial };
  const host = clubsForDivision("league_one");
  const setup = { parentClub: "Arsenal", parentDivision: "premier", hostClub: host[3], hostDivision: "league_one", hostClubs: host, target: 8, wage: 900, seasons: 2 } as Parameters<typeof startLoanSpell>[0];
  const signed = attachClub(id, setup.hostClub, host, "league_one", 900);
  career = { ...signed, contract: { club: "Arsenal", wage: 900, goalBonus: 50, assistBonus: 30, seasonsRemaining: 2 }, placement: startLoanSpell(setup) } as CareerState;
  phase = "loan-brief";
} else if (["mid-season", "injured", "low-energy", "intl-due", "intl-duty", "long-names"].includes(state)) {
  const long = state === "long-names";
  const p = { ...player, club: "Arsenal", age: 18, ...(long ? { firstName: "Maximiliano-Alexander", lastName: "Okonkwo" } : {}) } as StarPlayer;
  career = { ...makeInitialCareer(p, [...PREMIER_LEAGUE_CLUBS]), unlocks: undefined };
  if (state === "intl-due" || state === "intl-duty") {
    for (let i = 0; i < 60; i++) {
      const per = periodDue(career);
      if (per) { if (state === "intl-duty") career = applyDecision(career, { ...decide(career, per), called: true, starter: true }); break; }
      const left = career.fixtures.filter((f) => !f.played).length;
      career = playSeason(career, left - 1);
    }
  } else career = playSeason(career, career.fixtures.filter((f) => !f.played).length - 18);
  if (state === "injured") career = { ...career, injury: { weeksRemaining: 4, note: "Hamstring strain" }, energy: 20 } as CareerState;
  if (state === "low-energy") career = { ...career, energy: 15 } as CareerState;
  if (long) career = { ...career, money: 1250000 } as CareerState;
} else if (state === "season-over") {
  const p = { ...player, club: "Arsenal", age: 18 } as StarPlayer;
  career = { ...makeInitialCareer(p, [...PREMIER_LEAGUE_CLUBS]), unlocks: undefined };
  career = playSeason(career, 0);
  for (let i = 0; i < 6; i++) {
    const per = periodDue(career);
    if (!per) break;
    career = applyDecision(career, { ...decide(career, per), called: false });
    career = playSeason(career, 0);
  }
  career = { ...career, money: Math.max(career.money, 500000) };
} else {
  const p = { ...player, club: "Arsenal", age: state === "retire-due" ? 35 : 34 } as StarPlayer;
  career = { ...makeInitialCareer(p, [...PREMIER_LEAGUE_CLUBS]), unlocks: undefined };
  career = { ...career, season: state === "retire-due" ? (CAREER_SEASONS ?? 20) : (CAREER_SEASONS ?? 20) - 1 };
  career = playSeason(career, 0);
  for (let i = 0; i < 6; i++) {
    const per = periodDue(career);
    if (!per) break;
    career = applyDecision(career, { ...decide(career, per), called: false });
    career = playSeason(career, 0);
  }
}
saveCareer(career, ANON_SCOPE);
if (phase) saveStarPhase(phase, ANON_SCOPE);
const packed = Object.fromEntries(store);
const next = { "knowitball-career\\career-v2": JSON.stringify(career) };
console.log(JSON.stringify({ packed, next }));
