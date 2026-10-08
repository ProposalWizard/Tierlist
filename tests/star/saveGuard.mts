// A tiny localStorage so tuningStore.ts (reached through shopData.ts) can run
// headless — same pattern as tests/star/economy.mts.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import { makeInitialCareer, creditMatchResult, advanceSeason, awardLeagueTrophyIfWon, SPONSOR_CATEGORIES } from "../../lib/star/careerFlow";
import { finaliseMatch } from "../../lib/star/matchStats";
import { applyLevelResult, highestUnlocked, starsOf } from "../../lib/star/trainingLevels";
import { computeStarRating } from "../../lib/star/rating";
import { spendTrainingSession, trainingLeft } from "../../lib/star/week";
import { BOOTS_CATALOGUE, KIB_CANS, LIFESTYLE_ITEMS, kibCanPrice } from "../../lib/star/shopData";
import { freshItem } from "../../lib/star/fame";
import { sponsorEligible, signSponsor } from "../../lib/star/sponsors";
import { signOffer } from "../../lib/star/sponsorDeals";
import { generateOffers, acceptOffer } from "../../lib/star/transfers";
import { entrantsFor, oddsFor, canPlaceCompetitionBet } from "../../lib/star/competitionBetting";
import { mulberry32 } from "../../lib/star/season";
import { pickDilemma, applyEffects } from "../../lib/star/dilemmas";
import { buyStake, sellStake, clubValuation } from "../../lib/star/investments";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
} from "../../lib/star/clubs";
import type { CareerDivision } from "../../lib/star/calendar";
import { weeklyWageFor, STARTER_STANDING, goalBonusFor, assistBonusFor } from "../../lib/star/economy";
import type { CareerState, StarPlayer, Skills } from "../../lib/star/types";
import {
  checkSave, guardModeFrom, LUCK_CAP,
  type GuardFinding, type GuardMode, type LuckState,
} from "../../lib/star/saveGuard";

/**
 * THE SAVE GUARD (lib/star/saveGuard.ts).
 *
 * The most important part is the first: honest play must never be flagged.
 * Five careers, one per division, are played for three seasons each through
 * the real game code — every match credited with real match money, two
 * training sessions a week, the shop, sponsors and brand deals, transfer
 * offers taken, competition bets placed and settled, and a casino night at
 * the biggest stake the bank allows. After EVERY action the save is sent
 * through `checkSave` exactly as the server would, against the last one it
 * stored. Not one "cheat" finding is allowed. A "watch" finding is allowed
 * only straight after a casino win (that is what it is for).
 *
 * Then the edits a cheater makes in the browser's developer tools, each of
 * which must be caught, and what enforce mode does with them.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(club: string): StarPlayer {
  return {
    firstName: "Honest", lastName: "Player", age: 17, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

const SKILLS: (keyof Skills)[] = ["pace", "power", "technique", "vision", "freeKick"];

interface Server {
  stored: unknown | null;
  savedAt: number | null;
  luck: LuckState | null;
  /** The server casino's rows (star_casino_plays), when it is switched on. */
  ledger?: { at: number; net: number }[];
}

/** What the career route passes: the casino net since the last trusted save. */
function netSince(server: Server, now: number): number | null {
  if (!server.ledger) return null;
  return server.ledger.filter(e => (server.savedAt == null || e.at > server.savedAt) && e.at <= now).reduce((t, e) => t + e.net, 0);
}

interface Tally {
  posts: number;
  cheat: GuardFinding[];
  watch: GuardFinding[];
  watchAfterCasino: number;
  watchOther: GuardFinding[];
  last?: CareerState;
}

/** One POST, as the route does it. */
function post(server: Server, c: CareerState, now: number, tally: Tally, mode: GuardMode, casinoJustWon: boolean): CareerState {
  const sent = JSON.parse(JSON.stringify(c));
  const r = checkSave(server.stored, sent, { mode, now, prevSavedAt: server.savedAt, luck: server.luck, casinoNet: netSince(server, now) });
  tally.posts++;
  for (const f of r.findings) {
    if (f.level === "cheat") tally.cheat.push(f);
    else {
      tally.watch.push(f);
      if (casinoJustWon && f.field === "money") tally.watchAfterCasino++;
      else tally.watchOther.push(f);
    }
  }
  server.stored = r.clamped;
  server.savedAt = now;
  server.luck = r.guard.luck;
  return c;
}

function train(c: CareerState, i: number): CareerState {
  const skill = SKILLS[i % SKILLS.length];
  const level = highestUnlocked(starsOf(c, skill));
  const banked = applyLevelResult(c, skill, level, 3).career;
  const out = { ...banked, lastTrainedWeek: { ...c.lastTrainedWeek, [skill]: c.week } };
  out.starRating = computeStarRating(out);
  return spendTrainingSession(out);
}

function shop(c: CareerState, rng: () => number): CareerState {
  // A can now and then, the next pair of boots once affordable, and the
  // cheapest lifestyle item not yet owned.
  if (rng() < 0.3) {
    const can = KIB_CANS[0];
    const price = kibCanPrice(can, c.contract.wage);
    if (c.money >= price) c = { ...c, money: c.money - price, kibCans: { ...c.kibCans, basic: c.kibCans.basic + 1 } };
  }
  const boot = BOOTS_CATALOGUE.find(b => b.price <= c.money * 0.5 && b.id !== c.currentBoot.id);
  if (boot && rng() < 0.3) {
    c = { ...c, money: c.money - boot.price, currentBoot: { ...boot } };
  } else if (rng() < 0.2 && c.money >= c.currentBoot.price && c.currentBoot.price > 0) {
    c = { ...c, money: c.money - c.currentBoot.price, currentBoot: { ...c.currentBoot, matches: c.currentBoot.matches + (BOOTS_CATALOGUE.find(b => b.id === c.currentBoot.id)?.matches ?? 1) } };
  }
  const item = [...LIFESTYLE_ITEMS].sort((a, b) => a.price - b.price)
    .find(it => it.price <= c.money * 0.6 && !c.ownedItems.some(o => (o.baseId ?? o.id) === (it.baseId ?? it.id)));
  if (item && rng() < 0.3) {
    const base = item.baseId ?? item.id;
    c = { ...c, money: c.money - item.price, ownedItems: [...c.ownedItems.filter(o => (o.baseId ?? o.id) !== base), freshItem(item)] };
  }
  return c;
}

function sponsors(c: CareerState): CareerState {
  for (const cat of SPONSOR_CATEGORIES) {
    if (sponsorEligible(cat, c)) c = signSponsor(c, cat);
  }
  const offer = c.brands?.offers?.[0];
  if (offer) {
    const r = signOffer(c, offer.id);
    if (r.ok) c = r.career;
  }
  return c;
}

/** The wage a trial's scout offer really pays at this club (economy.ts), in
 *  place of makeInitialCareer's default Premier League starter wage. */
function signed(c: CareerState, div: CareerDivision): CareerState {
  const wage = weeklyWageFor(c.player.club, div, STARTER_STANDING, c);
  return { ...c, contract: { ...c.contract, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage) } };
}

const DIVS: { div: CareerDivision; clubs: readonly string[] }[] = [
  { div: "premier", clubs: PREMIER_LEAGUE_CLUBS },
  { div: "championship", clubs: CHAMPIONSHIP_CLUBS },
  { div: "league_one", clubs: LEAGUE_ONE_CLUBS },
  { div: "league_two", clubs: LEAGUE_TWO_CLUBS },
  { div: "national_league", clubs: NATIONAL_LEAGUE_CLUBS },
];

/** Plays one honest career. `every` posts only every Nth action (an offline
 *  stretch), `secondsPerAction` is how fast the player taps through. */
function playHonest(idx: number, seasons: number, opts: { every: number; secondsPerAction: number; casino: boolean; transfers: boolean; ledger?: boolean }): Tally {
  const { div, clubs } = DIVS[idx % DIVS.length];
  const rng = mulberry32(9001 + idx * 77);
  let c = signed(makeInitialCareer(player(clubs[3 % clubs.length]), [...clubs], div), div);
  const server: Server = { stored: null, savedAt: null, luck: null, ...(opts.ledger ? { ledger: [] } : {}) };
  const tally: Tally = { posts: 0, cheat: [], watch: [], watchAfterCasino: 0, watchOther: [] };
  let now = 1_800_000_000_000;
  let action = 0;
  let casinoWon = false;
  const act = (next: CareerState): CareerState => {
    c = next;
    now += opts.secondsPerAction * 1000;
    action++;
    if (action % opts.every === 0) {
      post(server, c, now, tally, "observe", casinoWon);
      casinoWon = false;
    }
    return c;
  };
  post(server, c, now, tally, "observe", false);

  for (let s = 1; s <= seasons; s++) {
    // A competition bet at the start of the season, 10% of the bank.
    if (canPlaceCompetitionBet(c) && c.money > 1000) {
      const field = oddsFor(entrantsFor("league", c), "league");
      const pick = field[Math.floor(rng() * field.length)];
      const stake = Math.floor(c.money * 0.1);
      act({ ...c, money: c.money - stake, competitionBets: [...(c.competitionBets ?? []), { id: `b${s}`, competition: "league", club: pick.name, odds: pick.odds, stake, season: c.season }] });
    }
    let guard = 0;
    while (guard++ < 200) {
      const fx = c.fixtures.find(f => !f.played);
      if (!fx) break;
      while (trainingLeft(c) > 0) act(train(c, action));
      act(shop(c, rng));
      act(sponsors(c));
      // A dilemma now and then, always taking whichever choice pays most.
      if (rng() < 0.15) {
        const d = pickDilemma(c, rng);
        if (d) {
          const best = [...d.choices].sort((a, b) => (b.effects.money ?? 0) - (a.effects.money ?? 0))[0];
          act(applyEffects(c, best.effects));
        }
      }
      // Club stakes: buy 5% of the strongest other club once it is
      // affordable, and sell the lot in the last season.
      if (opts.casino && guard === 20) {
        const club = [...c.league].sort((a, b) => b.strength - a.strength).find(t => t.name !== c.player.club)?.name;
        if (club && !(c.investments ?? []).length && clubValuation(club, c) * 0.05 < c.money * 0.5) act(buyStake(c, club, 5));
        else if (club && s === seasons && (c.investments ?? []).length) act(sellStake(c, c.investments![0].club, c.investments![0].percent));
      }
      // Casino: once a season, the whole bank on one roulette number — and it
      // comes in (×36). The biggest single honest jump the game allows short
      // of a 1-in-4,000 horse.
      if (opts.casino && guard === 10 && c.money >= 2000) {
        casinoWon = true;
        // With the server casino on, the server recorded this win.
        server.ledger?.push({ at: now + 1, net: c.money * 35 });
        act({ ...c, money: c.money * 36 });
      }
      const us = Math.floor(rng() * 4), them = Math.floor(rng() * 3);
      const goals = Math.min(us, Math.floor(rng() * 4));
      const stats = finaliseMatch(6, goals, Math.floor(rng() * 2), 30, 90, us, them, c, [], null, [], fx);
      act(creditMatchResult(c, fx, stats).career);
    }
    const awarded = awardLeagueTrophyIfWon(c).career;
    act(awarded);
    let moved = false;
    if (opts.transfers) {
      const offers = generateOffers(c, mulberry32(s * 31 + idx)).sort((a, b) => b.wage - a.wage);
      if (offers[0]) { act(acceptOffer(c, offers[0])); moved = true; }
    }
    act(advanceSeason(c, s === 2, moved).career);
    // Nobody plays three seasons in one sitting: a couple of days off.
    now += 2 * 24 * 3600 * 1000;
  }
  // Make sure the last state is posted.
  post(server, c, now + 1000, tally, "observe", casinoWon);
  tally.last = c;
  return tally;
}

// ── 1. Honest play: zero findings ─────────────────────────────────────────
{
  let posts = 0, cheat = 0, watchOther = 0, watchCasino = 0;
  const examples: string[] = [];
  const runs = [
    { every: 1, secondsPerAction: 20, casino: false, transfers: false },
    { every: 1, secondsPerAction: 6, casino: true, transfers: true },
    { every: 7, secondsPerAction: 15, casino: true, transfers: true },
    // The casino on the server (star_casino.sql run): no luck allowance, the
    // server's own record of the win instead.
    { every: 1, secondsPerAction: 6, casino: true, transfers: true, ledger: true },
    { every: 7, secondsPerAction: 15, casino: true, transfers: true, ledger: true },
  ];
  for (const opts of runs) {
    for (let i = 0; i < 5; i++) {
      const t = playHonest(i, 3, opts);
      // The same career sent to the cloud for the very first time (played
      // offline, or from before cloud saves): checked against a new career.
      const first = checkSave(null, JSON.parse(JSON.stringify(t.last)), { mode: "observe", now: 1_900_000_000_000 });
      for (const f of first.findings.filter(f => f.level === "cheat")) {
        cheat++;
        examples.push(`first upload of ${DIVS[i].div}: ${f.field} ${f.was}→${f.now} (limit ${f.limit}) — ${f.why}`);
      }
      posts++;
      posts += t.posts; cheat += t.cheat.length; watchOther += t.watchOther.length; watchCasino += t.watchAfterCasino;
      for (const f of [...t.cheat, ...t.watchOther].slice(0, 2)) {
        examples.push(`${DIVS[i].div} ${JSON.stringify(opts)}: ${f.level} ${f.field} ${f.was}→${f.now} (limit ${f.limit}) — ${f.why}`);
      }
    }
  }
  console.log(`honest play: ${posts} saves checked across 25 careers × 3 seasons — ${cheat} cheat findings, ${watchOther} unexplained watch findings, ${watchCasino} casino-luck notes`);
  for (const e of examples.slice(0, 12)) console.log("  " + e);
  check(cheat === 0, `honest play produces no cheat findings (${cheat}/${posts})`);
  check(watchOther === 0, `honest play produces no watch findings except after a casino win (${watchOther})`);
}

// ── 2. The edits a cheater makes ──────────────────────────────────────────

/** A real mid-career save (league one, a season and a half in) and the
 *  server's copy of it, stored five minutes ago. */
function midCareer(): { prev: CareerState; savedAt: number; now: number } {
  const { clubs, div } = DIVS[2];
  let c = signed(makeInitialCareer(player(clubs[3]), [...clubs], div), div);
  const rng = mulberry32(5);
  for (let k = 0; k < 20; k++) {
    const fx = c.fixtures.find(f => !f.played)!;
    while (trainingLeft(c) > 0) c = train(c, k);
    c = creditMatchResult(c, fx, finaliseMatch(6, 1, 1, 30, 90, 2, 1, c, [], null, [], fx)).career;
    c = shop(c, rng);
  }
  const now = 1_800_000_000_000;
  const stored = checkSave(null, JSON.parse(JSON.stringify(c)), { mode: "observe", now: now - 300_000 }).clamped as unknown as CareerState;
  return { prev: stored, savedAt: now - 300_000, now };
}

function edit(f: (c: CareerState) => CareerState, mode: GuardMode = "observe", luck?: LuckState) {
  const { prev, savedAt, now } = midCareer();
  const next = f(JSON.parse(JSON.stringify(prev)));
  return { prev, r: checkSave(prev, next, { mode, now, prevSavedAt: savedAt, luck: luck ?? { left: LUCK_CAP, at: now } }) };
}
const cheats = (r: ReturnType<typeof checkSave>) => r.findings.filter(f => f.level === "cheat").map(f => f.field);

{
  // An untouched save sent again is fine.
  const { r } = edit(c => c);
  check(r.findings.length === 0, `an unchanged save has no findings (${JSON.stringify(r.findings)})`);

  const cases: { name: string; f: (c: CareerState) => CareerState; field: string }[] = [
    { name: "money ×10,000", f: c => ({ ...c, money: Math.max(1000, c.money) * 10_000 }), field: "money" },
    { name: "money set to a billion", f: c => ({ ...c, money: 1_000_000_000 }), field: "money" },
    { name: "every skill to 99", f: c => ({ ...c, skills: { pace: 99, power: 99, technique: 99, vision: 99, freeKick: 99 } }), field: "skills" },
    { name: "skills and stars both maxed", f: c => ({ ...c, skills: { pace: 99, power: 99, technique: 99, vision: 99, freeKick: 99 }, trainingStars: Object.fromEntries(SKILLS.map(k => [k, Array(30).fill(3)])) }), field: "trainingStars" },
    { name: "five league titles added", f: c => ({ ...c, trophies: [...c.trophies, ...[1, 1, 1, 1, 1].map(() => ({ season: 1, competition: "League One", club: c.player.club }))] }), field: "trophies" },
    { name: "three Ballon d'Ors", f: c => ({ ...c, ballonDorWins: 3 }), field: "ballonDorWins" },
    { name: "star rating to 5", f: c => ({ ...c, starRating: 5 }), field: "starRating" },
    { name: "fame +5,000", f: c => ({ ...c, fame: c.fame + 5000 }), field: "fame" },
    { name: "reputation to 100", f: c => ({ ...c, reputation: 100 }), field: "reputation" },
    { name: "wage to ★100,000 a week", f: c => ({ ...c, contract: { ...c.contract, wage: 100_000 } }), field: "contract.wage" },
    { name: "the most expensive house, no money spent", f: c => {
      const top = [...LIFESTYLE_ITEMS].sort((a, b) => b.price - a.price)[0];
      return { ...c, ownedItems: [...c.ownedItems, freshItem(top)] };
    }, field: "ownedItems" },
    { name: "fifty elite kib cans, no money spent", f: c => ({ ...c, kibCans: { ...c.kibCans, elite: c.kibCans.elite + 50 } }), field: "kibCans" },
    { name: "a bet at a million to one", f: c => ({ ...c, competitionBets: [{ id: "x", competition: "league", club: "Anyone", odds: 1_000_000, stake: 1, season: c.season }] }), field: "competitionBets" },
    { name: "a hundred goals added", f: c => ({ ...c, careerStats: { ...c.careerStats, goals: c.careerStats.goals + 100 } }), field: "careerStats" },
  ];
  for (const k of cases) {
    const { r } = edit(k.f);
    check(cheats(r).includes(k.field), `caught: ${k.name} (findings: ${JSON.stringify(r.findings.map(f => `${f.level}:${f.field} ${f.was}→${f.now} limit ${f.limit}`))})`);
    check(r.corrected.length === 0 && r.ok === false, `observe mode stores ${k.name} as sent, only flagged`);
  }

  // The season rewound: noted (watch), not a cheat — an older copy picked
  // after a save clash looks exactly like this, and real-time pacing already
  // stops a rewind from being replayed for money.
  {
    const { r } = edit(c => ({ ...c, season: 1, week: 1 }));
    check(r.findings.some(f => f.field === "season"), `caught: the calendar going backwards (${JSON.stringify(r.findings)})`);
  }
  // The calendar jumped forward a whole season five minutes after the last
  // save: the extra weeks earn nothing, so a big pay rise with it is a cheat.
  {
    const { r } = edit(c => ({ ...c, season: c.season + 2, money: c.money + 5_000_000 }), "observe", { left: 0, at: 1_800_000_000_000 });
    check(r.findings.some(f => f.field === "week"), "caught: the calendar moving faster than real time allows");
    check(cheats(r).includes("money"), "…and the money claimed for those weeks");
  }
}

// ── 3. Enforce mode puts things back ──────────────────────────────────────
{
  const { prev, r } = edit(c => ({ ...c, money: 1_000_000_000 }), "enforce");
  const m = (r.clamped as unknown as CareerState).money;
  check(r.corrected.includes("money"), "enforce: money is listed as corrected");
  check(m < 1_000_000_000 && m >= prev.money, `enforce: money goes back to at most what play could earn (${prev.money} → ${m})`);
}
{
  const { prev, r } = edit(c => ({ ...c, skills: { pace: 99, power: 99, technique: 99, vision: 99, freeKick: 99 } }), "enforce");
  const s = (r.clamped as unknown as CareerState).skills;
  check(JSON.stringify(s) === JSON.stringify(prev.skills), "enforce: skills go back to the trusted ones");
  check((r.clamped as unknown as CareerState).starRating <= prev.starRating + 0.051, "enforce: the star rating follows them down");
}
{
  const { prev, r } = edit(c => ({ ...c, trophies: [...c.trophies, { season: 1, competition: "League One", club: "x" }, { season: 1, competition: "League One", club: "x" }] }), "enforce");
  check((r.clamped as unknown as CareerState).trophies.length === prev.trophies.length, "enforce: added trophies are taken away");
}
{
  const { prev, r } = edit(c => ({ ...c, kibCans: { ...c.kibCans, elite: c.kibCans.elite + 50 } }), "enforce");
  const out = r.clamped as unknown as CareerState;
  check(out.kibCans.elite === prev.kibCans.elite, `enforce: unpaid-for cans go back (${prev.kibCans.elite} → ${out.kibCans.elite})`);
}
{
  // Enforce leaves an honest save completely alone.
  const { prev, r } = edit(c => ({ ...c }), "enforce");
  check(r.corrected.length === 0 && (r.clamped as unknown as CareerState).money === prev.money, "enforce: an honest save is stored untouched");
}

// ── 4. The bookkeeping ────────────────────────────────────────────────────
{
  // The client can never write the server's own record.
  const { r } = edit(c => ({ ...c, serverGuard: { v: 1, luck: { left: 99, at: 0 }, at: 0 } } as CareerState));
  check(r.guard.luck.left <= LUCK_CAP + 1e-9, "a forged luck allowance in the save is ignored");
  // Luck runs out: the same casino jump twice in a row is a cheat the second time.
  const { prev, savedAt, now } = midCareer();
  const base = Math.max(prev.money, 2_000);
  const first = checkSave(prev, { ...prev, money: base * 1000 }, { mode: "observe", now, prevSavedAt: savedAt, luck: { left: LUCK_CAP, at: now } });
  check(first.findings.every(f => f.level === "watch"), `one ×1,000 night is luck (${JSON.stringify(first.findings)})`);
  const second = checkSave(first.clamped, { ...(first.clamped as object), money: base * 1000 * 1000 } as CareerState,
    { mode: "observe", now: now + 60_000, prevSavedAt: now, luck: first.guard.luck });
  check(cheats(second).includes("money"), "a second ×1,000 the next minute is not");
  // Deleting the slot keeps a tombstone; an edited re-upload is still caught.
  const tomb = { tombstone: true, last: prev, serverGuard: (prev as unknown as { serverGuard: unknown }).serverGuard };
  const reup = checkSave(tomb, { ...prev, money: 1_000_000_000 }, { mode: "observe", now, prevSavedAt: savedAt });
  check(cheats(reup).includes("money"), "an edited save re-uploaded after deleting the slot is still caught");
  // A genuinely new career after deleting is checked as a new career.
  const fresh = makeInitialCareer(player(LEAGUE_ONE_CLUBS[3]), [...LEAGUE_ONE_CLUBS], "league_one");
  const neu = checkSave(tomb, { ...fresh, player: { ...fresh.player, firstName: "Second" } }, { mode: "observe", now, prevSavedAt: savedAt });
  check(neu.against === "new-career" && neu.findings.length === 0, `a brand-new career after a delete is accepted (${JSON.stringify(neu.findings)})`);
  const richNew = checkSave(tomb, { ...fresh, player: { ...fresh.player, firstName: "Second" }, money: 50_000_000 }, { mode: "observe", now, prevSavedAt: savedAt });
  check(cheats(richNew).includes("money"), "a brand-new career with millions in the bank is caught");
  // A different, older career copied into the deleted slot (a save clash's
  // "keep both"): judged as a career of its own, and noted.
  const other = { ...prev, player: { ...prev.player, firstName: "Other" }, season: 3 };
  const copied = checkSave(tomb, other, { mode: "observe", now, prevSavedAt: savedAt });
  check(copied.against === "new-career" && cheats(copied).length === 0, `a different career copied into a deleted slot is accepted (${JSON.stringify(copied.findings)})`);
  check(copied.findings.some(f => f.level === "watch" && f.field === "season"), "…and noted for a look");
  // Admins and testers are never checked.
  const ex = checkSave(prev, { ...prev, money: 1e12 }, { mode: "enforce", exempt: true, now, prevSavedAt: savedAt });
  check(ex.findings.length === 0 && (ex.clamped as unknown as CareerState).money === 1e12, "admins and testers are exempt");
  // Off is off.
  check(checkSave(prev, { ...prev, money: 1e12 }, { mode: "off", now }).findings.length === 0, "mode off checks nothing");
  check(guardModeFrom(undefined) === "observe" && guardModeFrom("ENFORCE") === "enforce" && guardModeFrom("nonsense") === "observe", "the mode defaults to observe");
}

// ── 3. The casino on the server (star_casino.sql run) ─────────────────────
{
  const { prev, savedAt, now } = midCareer();
  const ctx = (casinoNet: number | null, luck: LuckState = { left: LUCK_CAP, at: now }) =>
    ({ mode: "observe" as GuardMode, now, prevSavedAt: savedAt, luck, casinoNet });
  const passes = (money: number, casinoNet: number | null) =>
    checkSave(prev, { ...prev, money }, ctx(casinoNet)).findings.every(f => f.level !== "cheat");

  // How much fake money an edited save gets through, before and after: the
  // largest bank that passes with no cheat finding, five minutes after the
  // last trusted save, with no casino play at all.
  const largest = (casinoNet: number | null) => {
    let lo = prev.money, hi = prev.money * 1e6 + 1e9;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (passes(mid, casinoNet)) lo = mid; else hi = mid; }
    return lo;
  };
  const before = largest(null), after = largest(0);
  console.log(`fake money let through on a ★${Math.round(prev.money)} bank: before (luck) ★${Math.round(before)} (×${(before / prev.money).toFixed(0)}), after (server casino, no play) ★${Math.round(after)} (+★${Math.round(after - prev.money)}, the honest-earnings slack)`);
  check(before > prev.money * 1000, `before: the luck allowance let about ×2,000 through (×${(before / prev.money).toFixed(0)})`);
  check(after < prev.money + (before - prev.money) / 100, `after: an edit gets less than 1% of what luck let through (★${Math.round(after - prev.money)})`);
  {
    // The same on a ★10m bank (a player well into a career).
    const rich = { ...prev, money: 10_000_000 };
    const ok = (money: number, casinoNet: number | null) =>
      checkSave(rich, { ...rich, money }, ctx(casinoNet)).findings.every(f => f.level !== "cheat");
    const top = (casinoNet: number | null) => {
      let lo = rich.money, hi = rich.money * 1e5;
      for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (ok(mid, casinoNet)) lo = mid; else hi = mid; }
      return lo;
    };
    const b = top(null), a = top(0);
    console.log(`  on a ★10m bank: before ★${(b / 1e9).toFixed(1)}bn (×${(b / rich.money).toFixed(0)}), after +★${Math.round(a - rich.money)}`);
    check(a - rich.money < (b - rich.money) / 1000, "after, on a big bank: the edit room no longer grows with the bank");
  }

  // A real server-recorded win passes; an edit on top of it does not.
  const won = 1_000_000;
  check(passes(prev.money + won, won), "a bank up by exactly the server-recorded win passes");
  const w = checkSave(prev, { ...prev, money: prev.money + won }, ctx(won));
  check(w.findings.some(f => f.level === "watch" && f.field === "money") && w.guard.luck.left === LUCK_CAP,
    "…noted as casino winnings, and no luck spent");
  check(!passes(prev.money + 2 * won + (after - prev.money), won), "double the recorded win is caught");
  check(passes(prev.money + won, null), "with the table missing, the old luck allowance still covers a win");
  // Losses recorded never let money through.
  check(!passes(prev.money + won, -won), "a recorded loss gives no allowance");

  // Enforce puts the bank back to what play and the record allow.
  const e = checkSave(prev, { ...prev, money: prev.money + 50 * won }, { ...ctx(won), mode: "enforce" });
  const m = (e.clamped as unknown as CareerState).money;
  check(e.corrected.includes("money") && m <= prev.money + won + (after - prev.money) + 1 && m >= prev.money + won,
    `enforce: money goes back to the recorded win plus honest pay (${m})`);

  // The bank only reaches the save when the player leaves the casino; a horse
  // race or a bet can save in between. The win carries over to that later save.
  const mid1 = checkSave(prev, { ...prev }, ctx(won));
  check(mid1.findings.every(f => f.level !== "cheat") && (mid1.guard.casino?.credit ?? 0) === won, "a save before the win reaches the bank carries the win forward");
  const later = checkSave(mid1.clamped, { ...prev, money: prev.money + won }, { mode: "observe", now: now + 60_000, prevSavedAt: now, luck: mid1.guard.luck, casinoNet: 0 });
  check(later.findings.every(f => f.level !== "cheat") && (later.guard.casino?.credit ?? 0) === 0, "…and the next save uses it up");
  const again = checkSave(later.clamped, { ...prev, money: prev.money + 2 * won }, { mode: "observe", now: now + 120_000, prevSavedAt: now + 60_000, luck: later.guard.luck, casinoNet: 0 });
  check(again.findings.some(f => f.level === "cheat" && f.field === "money"), "the same win cannot be used twice");
  // A carried win runs out after a day.
  const stale = checkSave(mid1.clamped, { ...prev, money: prev.money + won }, { mode: "observe", now: now + 2 * 86_400_000, prevSavedAt: now, luck: mid1.guard.luck, casinoNet: 0 });
  check(stale.findings.some(f => f.level === "cheat" && f.field === "money"), "a win carried for over a day lapses");
  // The client cannot write its own casino credit.
  const forged = checkSave(prev, { ...prev, money: prev.money + won, serverGuard: { v: 1, luck: { left: 0, at: now }, at: now, casino: { credit: 1e12, at: now } } } as unknown as CareerState, ctx(0));
  check(forged.findings.some(f => f.level === "cheat" && f.field === "money"), "a forged casino credit in the sent save is ignored");
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("saveGuard: all checks pass");
