/**
 * MONEY ACROSS A WHOLE CAREER — a headless, seeded 20-season simulator.
 *
 * STAR_ROADMAP.md #3: "Money balance after Sponsors. Wages were set on 21 Sep,
 * before weekly sponsor fees and the new shop prices. Check money across a
 * whole career."
 *
 * It drives the REAL career code — makeIdentity/attachClub, finaliseMatch,
 * creditMatchResult, simulateMissedFixture, advanceSeason, the real sponsor
 * deals (sponsorDeals.ts: offers arrive, the player signs them), the real
 * transfer wage (offerWageFor) and signing-on fee, real renewals, the real
 * shop catalogue and can prices. What it decides for itself is only what a
 * person decides: where the career goes (three fixed shapes), how well he
 * plays, and what he buys. No casino, no investments.
 *
 *   npx tsx scripts/money-sim/sim.mts            all three shapes, tables
 *   npx tsx scripts/money-sim/sim.mts --json     the raw rows
 *
 * Deterministic: every random draw is seeded.
 */
import {
  makeIdentity, attachClub, creditMatchResult, advanceSeason, simulateMissedFixture,
  checkForContractOffer, markContractOfferUsed,
} from "../../lib/star/careerFlow";
import { finaliseMatch } from "../../lib/star/matchStats";
import { wageForFixture } from "../../lib/star/wages";
import { appearanceMoney, offerClauses } from "../../lib/star/contracts";
import { offerWageFor, weeklyWageFor, goalBonusFor, assistBonusFor, renewalWage, renewalMultiplier } from "../../lib/star/economy";
import { reputation } from "../../lib/star/transfers";
import { membershipOf, estimateClubStrength } from "../../lib/star/promotion";
import { clubReputation } from "../../lib/star/clubReputation";
import { divisionOf, type CareerDivision } from "../../lib/star/calendar";
import { brandsOf, signOffer, sponsorPayFor, weeklySponsorTotal, bootPrice } from "../../lib/star/sponsorDeals";
import { BOOTS_ALL_LEVELS, LIFESTYLE_ALL_LEVELS, KIB_CANS, kibCanPrice } from "../../lib/star/shopData";
import { freshItem, isWornOut, fameOf } from "../../lib/star/fame";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, Fixture, OwnedItem, StarPlayer, Boot } from "../../lib/star/types";

// ── The three career shapes ────────────────────────────────────────────────

type Tier = "premier" | "championship" | "leagueOne" | "leagueTwo" | "nationalLeague";
const TIER_OF: Record<string, Tier> = {
  premier: "premier", championship: "championship", league_one: "leagueOne",
  league_two: "leagueTwo", national_league: "nationalLeague",
};
const RANK: Record<string, number> = { national_league: 0, league_two: 1, league_one: 2, championship: 3, premier: 4 };

interface Stint {
  from: number; division: CareerDivision;
  /** A named club, or a place in the division's reputation order (0 smallest, 1 biggest). */
  club?: string; pct?: number;
}
export interface Shape {
  id: "average" | "good" | "star";
  label: string;
  stints: Stint[];
  goalsPerMatch: number; assistsPerMatch: number; rating: number;
  /** Share of fixtures he actually plays; the rest he watches. */
  plays: number;
  /** Skills at season 1 and season 20 (training is not simulated). */
  skills: [number, number];
  ballonDor: number[];
  /** How much of what is spare a typical player spends on lifestyle. */
  spendShare: number;
}

export const SHAPES: Shape[] = [
  {
    id: "average", label: "Average (ends mid Championship)",
    stints: [
      { from: 1, division: "national_league", pct: 0.5 },
      { from: 4, division: "league_two", pct: 0.5 },
      { from: 9, division: "league_one", pct: 0.5 },
      { from: 14, division: "championship", pct: 0.45 },
    ],
    goalsPerMatch: 0.25, assistsPerMatch: 0.15, rating: 6.7, plays: 0.85,
    skills: [42, 66], ballonDor: [], spendShare: 0.5,
  },
  {
    id: "good", label: "Good (reaches mid Premier League)",
    stints: [
      { from: 1, division: "league_two", pct: 0.5 },
      { from: 3, division: "league_one", pct: 0.6 },
      { from: 6, division: "championship", pct: 0.6 },
      { from: 9, division: "premier", club: "Brentford" },
    ],
    goalsPerMatch: 0.4, assistsPerMatch: 0.25, rating: 7.1, plays: 0.93,
    skills: [48, 78], ballonDor: [], spendShare: 0.5,
  },
  {
    id: "star", label: "Star (top Premier League, Ballon d'Or contender)",
    stints: [
      { from: 1, division: "league_one", pct: 0.7 },
      { from: 2, division: "championship", pct: 0.8 },
      { from: 4, division: "premier", club: "Aston Villa" },
      { from: 7, division: "premier", club: "Liverpool" },
    ],
    goalsPerMatch: 0.75, assistsPerMatch: 0.35, rating: 7.8, plays: 0.97,
    skills: [55, 92], ballonDor: [10, 12, 14, 16, 18], spendShare: 0.5,
  },
];

function stintFor(shape: Shape, season: number): Stint {
  return [...shape.stints].reverse().find(s => season >= s.from)!;
}

// ── The money book ─────────────────────────────────────────────────────────

export interface SeasonRow {
  season: number; division: string; club: string; wage: number; fame: number; deals: number;
  sponsorWeekly: number;
  income: { wages: number; bonuses: number; sponsors: number; other: number };
  spend: { boots: number; cans: number; lifestyle: number };
  bank: number;
  /** Shop items (boots + lifestyle) priced at or under this season's income / this bank. */
  affordSeason: number; affordBank: number;
  affordByLevel: number[]; // share of each level 1-5 priced <= this season's income
}

const SHOP: { price: number; level: number }[] = [
  ...BOOTS_ALL_LEVELS.map(b => ({ price: b.price, level: b.level ?? 1 })),
  ...LIFESTYLE_ALL_LEVELS.map(i => ({ price: i.price, level: i.level ?? 1 })),
];

function player(): StarPlayer {
  return {
    firstName: "Sim", lastName: "Player", age: 17, skinTone: "light",
    club: "", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function pickClub(c: CareerState, st: Stint): { club: string; clubs: string[] } {
  const members = membershipOf(c);
  const list = [...members[TIER_OF[st.division]]];
  if (st.club && list.includes(st.club)) return { club: st.club, clubs: list };
  const byRep = [...list].sort((a, b) => clubReputation(a) - clubReputation(b) || a.localeCompare(b));
  const i = Math.min(byRep.length - 1, Math.round((st.pct ?? 0.5) * (byRep.length - 1)));
  return { club: byRep[i], clubs: list };
}

const ofLevel = (x: { level?: number }) => x.level ?? 1;

export interface SimOptions {
  /** Right guesses per renewal (ContractRenewal: +8% each). */
  renewalWins?: number;
  seasons?: number;
  /** Renew the way the game did before 11 Oct 2026: no wage cap. */
  uncappedRenewals?: boolean;
  /** PROPOSAL, not the game: a renewal also stops at the club's own star wage. */
  clubCapRenewals?: boolean;
}

export function runCareer(shape: Shape, opts: SimOptions = {}): SeasonRow[] {
  const SEASONS = opts.seasons ?? 20;
  const wins = opts.renewalWins ?? 2;
  const renew = (w: number) => {
    const r = opts.uncappedRenewals ? Math.round(w * renewalMultiplier(wins, false)) : renewalWage(w, wins, false);
    if (!opts.clubCapRenewals) return r;
    const top = weeklyWageFor(c.player.club, divisionOf(c), 1, c);
    return Math.min(r, Math.max(w, top));
  };
  const rng = mulberry32(shape.id.length * 7919 + 17);

  // The signing, exactly as the trial-offer screen does it (page.tsx).
  const st0 = stintFor(shape, 1);
  let c = makeIdentity(player(), st0.division);
  {
    const { club, clubs } = pickClub(c, st0);
    const wage = offerWageFor(club, st0.division, 30, 0, 0);
    c = attachClub(c, club, clubs, st0.division, wage);
    c = { ...c, contract: { club, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage), seasonsRemaining: 2 } };
  }

  const rows: SeasonRow[] = [];
  let carry = { other: 0 }; // money that arrived during a move, counted into the next season

  for (let season = 1; season <= SEASONS; season++) {
    const income = { wages: 0, bonuses: 0, sponsors: 0, other: carry.other };
    const spend = { boots: 0, cans: 0, lifestyle: 0 };
    carry = { other: 0 };

    // Training is not simulated: skills follow the shape's curve.
    const t = (season - 1) / 19;
    const sk = Math.round(shape.skills[0] + (shape.skills[1] - shape.skills[0]) * t);
    c = { ...c, skills: { pace: sk, power: sk, technique: sk, vision: sk, freeKick: sk }, energy: 100 };

    const nextUp = season < SEASONS && RANK[stintFor(shape, season + 1).division] > RANK[divisionOf(c)];
    const top = shape.id === "star" && c.player.club === "Liverpool";
    let matches = 0;
    let guard = 0;
    while (guard++ < 200) {
      const fx = c.fixtures.find(f => !f.played);
      if (!fx) break;
      const before = c.money;
      const plays = rng() < shape.plays;
      if (plays) {
        matches++;
        const winP = top ? 0.72 : nextUp ? 0.62 : 0.42;
        const r = rng();
        const us = r < winP ? 2 : r < winP + 0.25 ? 1 : 0;
        const them = r < winP ? 0 : r < winP + 0.25 ? 1 : 2;
        const goals = Math.floor(shape.goalsPerMatch + rng());
        const goalsCapped = Math.min(goals, us);
        const assists = Math.min(us - goalsCapped, rng() < shape.assistsPerMatch ? 1 : 0);
        const stats = finaliseMatch(5, goalsCapped, assists, 25, 90, us, them, c, [], null, [], fx);
        const rating = Math.round((shape.rating + (rng() - 0.5) * 1.2) * 10) / 10;
        const s2 = { ...stats, rating, starMan: rating >= 8.5 || goalsCapped >= 2 };
        const appearance = fx.kind === "international" ? 0 : appearanceMoney(c.contract);
        c = creditMatchResult(c, fx, s2).career;
        const delta = c.money - before;
        income.wages += stats.wage;
        income.bonuses += stats.goalBonus;
        income.sponsors += stats.sponsorPay + Math.max(0, delta - stats.totalCash - appearance);
        income.other += appearance;
      } else {
        const wage = wageForFixture(c, fx);
        const sp = sponsorPayFor(c, fx);
        c = simulateMissedFixture(c, fx).career;
        income.wages += wage; income.sponsors += sp;
        income.other += Math.max(0, c.money - before - wage - sp);
      }

      // ── Sponsors: sign whatever arrives (the typical player does) ──
      for (const o of [...brandsOf(c).offers]) {
        const m0 = c.money;
        const r = signOffer(c, o.id);
        if (r.ok) { c = r.career; income.sponsors += c.money - m0; }
      }

      // ── The club offers a better deal mid-season ──
      const early = checkForContractOffer(c);
      if (early) {
        c = markContractOfferUsed(c, early);
        const wage = renew(c.contract.wage);
        c = { ...c, contract: { ...c.contract, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage), seasonsRemaining: 3 } };
      }

      // ── Shopping ──
      // Phone first.
      if (!c.ownedItems.some(i => (i.baseId ?? i.id) === "phone")) {
        const phone = LIFESTYLE_ALL_LEVELS.find(i => i.id === "phone")!;
        if (c.money >= phone.price * 2) {
          c = { ...c, money: c.money - phone.price, ownedItems: [...c.ownedItems, freshItem(phone)] };
          spend.lifestyle += phone.price;
        }
      }
      // Boots: when the pair runs out, the best pair costing at most half the
      // bank and six weeks' wage; failing that the cheapest he can pay for.
      if (c.currentBoot.matches <= 0) {
        const priced = BOOTS_ALL_LEVELS.map(b => ({ b, p: bootPrice(c, b.price) }));
        const cap = Math.min(c.money * 0.5, c.contract.wage * 6);
        const wanted = priced.filter(x => x.p <= cap).sort((a, b) => b.p - a.p)[0]
          ?? priced.filter(x => x.p <= c.money).sort((a, b) => a.p - b.p)[0];
        if (wanted) {
          c = { ...c, money: c.money - wanted.p, currentBoot: { ...(wanted.b as Boot) } };
          spend.boots += wanted.p;
        }
      }
      // A Basic can every fifth match he plays, when it is under a quarter of the bank.
      if (plays && matches % 5 === 0) {
        const p = kibCanPrice(KIB_CANS[0], c.contract.wage);
        if (p <= c.money * 0.25) { c = { ...c, money: c.money - p }; spend.cans += p; }
      }
      // Lifestyle every fourth week: the cheapest next step he can comfortably pay.
      if (c.week % 4 === 0) {
        for (let n = 0; n < 3; n++) {
          const spare = (c.money - c.contract.wage * 4) * shape.spendShare;
          if (spare <= 0) break;
          const owned = new Map(c.ownedItems.map(o => [o.baseId ?? o.id, o]));
          const cands = LIFESTYLE_ALL_LEVELS.filter((it: OwnedItem) => {
            const base = it.baseId ?? it.id;
            const o = owned.get(base);
            if (!o) return ofLevel(it) === 1 || base === "phone" && false;
            if (isWornOut(o)) return ofLevel(it) === ofLevel(o);
            return ofLevel(it) === ofLevel(o) + 1;
          }).filter(it => it.price <= spare).sort((a, b) => a.price - b.price);
          const it = cands[0];
          if (!it) break;
          const base = it.baseId ?? it.id;
          c = {
            ...c, money: c.money - it.price,
            ownedItems: [...c.ownedItems.filter(o => (o.baseId ?? o.id) !== base), freshItem(it)],
            happiness: Math.min(100, c.happiness + Math.floor(it.lifestyleValue / 3)),
          };
          spend.lifestyle += it.price;
        }
      }
    }

    const seasonIncome = income.wages + income.bonuses + income.sponsors + income.other;
    const row: SeasonRow = {
      season, division: divisionOf(c), club: c.player.club, wage: c.contract.wage,
      fame: Math.round(fameOf(c)), deals: brandsOf(c).deals.length, sponsorWeekly: weeklySponsorTotal(c),
      income, spend, bank: 0, affordSeason: 0, affordBank: 0, affordByLevel: [],
    };

    // ── The season ends ──
    const m0 = c.money;
    c = advanceSeason(c, shape.ballonDor.includes(season)).career;
    row.income.other += 0; // split below
    const endDelta = c.money - m0;
    row.income.sponsors += 0;
    row.income.other += endDelta; // loyalty + sponsor season targets
    row.bank = c.money;
    const seasonTotal = seasonIncome + endDelta;
    row.affordSeason = SHOP.filter(x => x.price <= seasonTotal).length / SHOP.length;
    row.affordBank = SHOP.filter(x => x.price <= c.money).length / SHOP.length;
    row.affordByLevel = [1, 2, 3, 4, 5].map(L => {
      const at = SHOP.filter(x => x.level === L);
      return at.filter(x => x.price <= seasonTotal).length / Math.max(1, at.length);
    });
    rows.push(row);
    if (season === SEASONS) break;

    // ── Contract runs out: renew at the club ──
    if (c.contract.seasonsRemaining <= 0) {
      const wage = renew(c.contract.wage);
      c = { ...c, contract: { ...c.contract, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage), seasonsRemaining: 3 } };
    }

    // ── Where the shape says he plays next season ──
    const st = stintFor(shape, season + 1);
    const wantDiv = st.division;
    const named = st.club;
    // A named club the ladder has sent down this year is not available, so
    // he stays where he is if that is already the right division.
    const namedHere = named !== undefined && membershipOf(c)[TIER_OF[wantDiv]].includes(named);
    const misplaced = divisionOf(c) !== wantDiv || (namedHere && c.player.club !== named);
    if (misplaced) {
      const { club, clubs } = pickClub(c, st);
      const mine = c.league.find(t => t.name === c.player.club)?.strength ?? 65;
      const step = estimateClubStrength(c, club) - mine;
      const wage = offerWageFor(club, wantDiv, reputation(c), step, c.contract.wage, c);
      const mBefore = c.money;
      c = attachClub(c, club, clubs, wantDiv, wage);
      carry.other += c.money - mBefore; // the signing-on fee
      c = {
        ...c,
        contract: {
          club, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage), seasonsRemaining: 3,
          ...offerClauses(c, wage, mulberry32(season * 31 + 7)),
        },
      };
    }
  }
  return rows;
}

// ── Print ──────────────────────────────────────────────────────────────────

const k = (n: number) => {
  const a = Math.abs(n);
  return (n < 0 ? "-" : "") + (a >= 1e6 ? `${(a / 1e6).toFixed(2)}m` : a >= 1e4 ? `${Math.round(a / 1e3)}k` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : `${Math.round(a)}`);
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
const DIV_SHORT: Record<string, string> = { national_league: "NL", league_two: "L2", league_one: "L1", championship: "Ch", premier: "PL" };

export function table(shape: Shape, rows: SeasonRow[]): string {
  const out = [`### ${shape.label}`, "",
    "| S | Div | Club | Wage/wk | Fame | Deals (★/wk) | Wages | Bonuses | Sponsors | Other | Spent (boots/cans/life) | Bank | Shop ≤ season income |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const r of rows) {
    const sp = r.spend.boots + r.spend.cans + r.spend.lifestyle;
    out.push(`| ${r.season} | ${DIV_SHORT[r.division] ?? r.division} | ${r.club} | ${k(r.wage)} | ${r.fame} | ${r.deals} (${k(r.sponsorWeekly)}) | ${k(r.income.wages)} | ${k(r.income.bonuses)} | ${k(r.income.sponsors)} | ${k(r.income.other)} | ${k(sp)} (${k(r.spend.boots)}/${k(r.spend.cans)}/${k(r.spend.lifestyle)}) | ${k(r.bank)} | ${pct(r.affordSeason)} |`);
  }
  return out.join("\n");
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("sim.mts");
if (isMain) {
  const before = process.argv.includes("--before");
  const clubCap = process.argv.includes("--club-cap");
  const all = SHAPES.map(s => ({ shape: s, rows: runCareer(s, { uncappedRenewals: before, clubCapRenewals: clubCap }) }));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(all.map(a => ({ id: a.shape.id, rows: a.rows })), null, 1));
  } else {
    for (const a of all) { console.log(table(a.shape, a.rows)); console.log(""); }
    console.log("| Shape | Career income | Wages | Bonuses | Sponsors | Other | Boots | Cans | Lifestyle | Items out of reach of the whole career's income |");
    console.log("|---|---|---|---|---|---|---|---|---|---|");
    for (const a of all) {
      const sum = (f: (r: SeasonRow) => number) => a.rows.reduce((t, r) => t + f(r), 0);
      const total = sum(r => r.income.wages + r.income.bonuses + r.income.sponsors + r.income.other);
      const out = SHOP.filter(x => x.price > total).length;
      console.log(`| ${a.shape.id} | ${k(total)} | ${pct(sum(r => r.income.wages) / total)} | ${pct(sum(r => r.income.bonuses) / total)} | ${pct(sum(r => r.income.sponsors) / total)} | ${pct(sum(r => r.income.other) / total)} | ${k(sum(r => r.spend.boots))} | ${k(sum(r => r.spend.cans))} | ${k(sum(r => r.spend.lifestyle))} | ${out} of ${SHOP.length} |`);
    }
    console.log("");
    console.log("| Shape | S5 shop ≤ season | S10 | S20 | S5 by level 1-5 | S10 by level | S20 by level |");
    console.log("|---|---|---|---|---|---|---|");
    for (const a of all) {
      const r = (s: number) => a.rows[s - 1];
      const lv = (s: number) => r(s).affordByLevel.map(pct).join(" ");
      console.log(`| ${a.shape.id} | ${pct(r(5).affordSeason)} | ${pct(r(10).affordSeason)} | ${pct(r(20).affordSeason)} | ${lv(5)} | ${lv(10)} | ${lv(20)} |`);
    }
  }
}
