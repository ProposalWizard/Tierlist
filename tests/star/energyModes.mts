// tuningStore.ts needs a headless localStorage.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import {
  energyPerMinute, energyFactorFor, restDaysBetween, dailyRecovery,
  ENERGY_FULL_MATCH_HIGH, ENERGY_FULL_MATCH_MEDIUM, ENERGY_FULL_MATCH_LOW,
  DIVISION_ENERGY_FACTOR, CHAMPIONS_ENERGY_FACTOR, EUROPA_ENERGY_FACTOR,
} from "../../lib/star/energy";
import { MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB } from "../../lib/star/selection";
import { projectedEnergy } from "../../lib/star/week";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * THE ENERGY MASTER PLAN (22 Sep 2026).
 *
 * Premier League, full 90: Low 30 · Medium 60 · High 95. Every competition
 * scales that by its own factor. Rest days between fixtures give energy
 * back; unused weekly actions no longer do.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) < eps;

// ── Per-minute rates add up to the agreed full-match totals ──
{
  check(ENERGY_FULL_MATCH_HIGH === 95 && ENERGY_FULL_MATCH_MEDIUM === 60 && ENERGY_FULL_MATCH_LOW === 30,
    "Premier League full 90: High 95, Medium 60, Low 30");
  check(near(energyPerMinute("high") * 90, 95), "High per minute x 90 = 95");
  check(near(energyPerMinute("medium") * 90, 60), "Medium per minute x 90 = 60");
  check(near(energyPerMinute("low") * 90, 30), "Low per minute x 90 = 30");
  check(near(energyPerMinute("low"), energyPerMinute("medium") * 0.5), "Low is half of Medium");

  // A mixed match: 10 High, 4 Medium, 2 Low, 72 High — the example asked about.
  const mixed = 10 * energyPerMinute("high") + 4 * energyPerMinute("medium")
    + 2 * energyPerMinute("low") + 72 * energyPerMinute("high");
  check(mixed > 88 && mixed < 90, `a mixed match costs what its minutes add up to (${mixed.toFixed(1)})`);
}

// ── Competition factors ──
{
  const player = { firstName: "T", lastName: "P", age: 22, skinTone: "light", club: "Liverpool", clubBadge: null,
    position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
  const withLadder: CareerState = {
    ...c,
    divisions: { ...(c.divisions ?? {}), championship: ["Stoke City"], nationalLeague: ["Barnet"] } as CareerState["divisions"],
  };
  check(energyFactorFor(withLadder, { kind: "league", opponent: "Arsenal" }) === 1, "a Premier League match is x1");
  check(energyFactorFor(withLadder, { kind: "cup", competition: "FA Cup", opponent: "Stoke City" }) === DIVISION_ENERGY_FACTOR.championship,
    "an FA Cup tie vs a Championship side costs a Championship match");
  check(energyFactorFor(withLadder, { kind: "cup", competition: "League Cup", opponent: "Barnet" }) === DIVISION_ENERGY_FACTOR.national_league,
    "a League Cup tie vs a National League side costs a National League match");
  check(energyFactorFor(withLadder, { kind: "cup", competition: "FA Cup", opponent: "Arsenal" }) === 1,
    "an FA Cup tie vs a Premier League side costs a Premier League match");
  check(energyFactorFor(withLadder, { kind: "europe", competition: "Champions League", opponent: "Real Madrid" }) === CHAMPIONS_ENERGY_FACTOR,
    "the Champions League is the dearest");
  check(energyFactorFor(withLadder, { kind: "cup", competition: "Super Cup", opponent: "Real Madrid" }) === CHAMPIONS_ENERGY_FACTOR,
    "the Super Cup costs the same as the Champions League");
  check(energyFactorFor(withLadder, { kind: "europe", competition: "Europa League", opponent: "Roma" }) === EUROPA_ENERGY_FACTOR,
    "the Europa League sits between");
  check(DIVISION_ENERGY_FACTOR.national_league < DIVISION_ENERGY_FACTOR.championship
    && DIVISION_ENERGY_FACTOR.championship < DIVISION_ENERGY_FACTOR.premier, "bigger leagues are harder on the legs");
}

// ── Rest days ──
{
  const sat = Date.UTC(2026, 8, 5); // a Saturday
  const day = 24 * 60 * 60 * 1000;
  check(restDaysBetween(sat, sat + 7 * day) === 6, "Saturday to Saturday is 6 rest days");
  check(restDaysBetween(sat, sat + 4 * day) === 3, "Saturday to Wednesday is 3 rest days");
  check(restDaysBetween(sat, sat + 1 * day) === 0, "back-to-back days is no rest");
  check(restDaysBetween(sat, sat + 60 * day) === 14, "a long break is capped");
  check(dailyRecovery(false, 1) === 8, "a plain rest day is +8");
  check(dailyRecovery(true, 3) > dailyRecovery(false, 1), "a property and a top training ground recover you faster");
}

// ── Thresholds and the removed credit ──
{
  check(MIN_ENERGY_TO_START === 65, "below 65 you start on the bench");
  check(MIN_ENERGY_TO_SUB === 40, "below 40 you are left out of the squad");
  const player = { firstName: "T", lastName: "P", age: 22, skinTone: "light", club: "Liverpool", clubBadge: null,
    position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier"), energy: 50, weekActions: 3 };
  check(projectedEnergy(c) === 50, "unused weekly actions no longer add energy");
}

// ── After the match: half-time cans come off, rest days go on ──
{
  const player = { firstName: "T", lastName: "P", age: 22, skinTone: "light", club: "Liverpool", clubBadge: null,
    position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier"), kibCans: { basic: 5, premium: 0, elite: 0 } };
  const f = nextFixtureFor(c)!;
  const stats = { chances: 3, goals: 0, assists: 0, passes: 8, rating: 7, starMan: false, bossChange: 0, teamChange: 0,
    fansChange: 0, wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0, minutes: 90,
    endEnergy: 20, kibCansUsed: 2 };
  const after = creditMatchResult(c, f, stats).career;
  check(after.kibCans.basic === 3, `two cans drunk at half time come off your stock (5 -> ${after.kibCans.basic})`);
  check(after.energy > 20, `rest days until the next fixture are added on top of full-time energy (20 -> ${after.energy})`);
  const again = creditMatchResult(after, after.fixtures.find(x => x.week === f.week && x.played)!, stats).career;
  check(again.kibCans.basic === 3, "a replayed match does not take the cans twice");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — energy drains per minute by mode and competition, rest days recover it, and the thresholds are 65 / 40");
