// tuningStore.ts is reached through careerFlow — give it a headless localStorage.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import {
  clampReputation, changeReputation, migrateReputation, reputationLabel, reputationVoteBias,
  REPUTATION_START, REPUTATION_EVENTS,
} from "../../lib/star/reputation";
import {
  fameOf, fameLevel, FAME_LEVELS, ownedFame, OWNED_FAME_MAX, fadedFame, scandalFame,
  wearItems, freshItem, isWornOut, itemLifeSeasons, FAME_FOR_TROPHY, FAME_FOR_PROMOTION_TO,
} from "../../lib/star/fame";
import { seasonStanding } from "../../lib/star/seasonStanding";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { applyEffects } from "../../lib/star/dilemmas";
import { rollSponsorSeason, sponsorTerm } from "../../lib/star/sponsors";
import { LIFESTYLE_ITEMS } from "../../lib/star/shopData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer, OwnedItem } from "../../lib/star/types";

/**
 * FAME AND REPUTATION, AS REBUILT ON 21 SEP 2026.
 *
 *  Fame        0-100, six levels, earned only from big moments plus what
 *              you own (on a flattening curve), items wear out, scandals
 *              ADD fame, and it fades toward your division's natural level.
 *  Reputation  one number 0-100 (was four bars), old saves become the
 *              average, merging clubs costs 20.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = (club: string): StarPlayer => ({
  firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
  club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer);
const fresh = (): CareerState => makeInitialCareer(player("Liverpool"), [...PREMIER_LEAGUE_CLUBS], "premier");

// ── Reputation: one bounded number ──────────────────────────────────────────
{
  check(clampReputation(140) === 100 && clampReputation(-5) === 0, "reputation clamps to 0-100");
  check(changeReputation(15, REPUTATION_EVENTS.mergedClubs) === 0, "merging clubs costs 20 and floors at 0");
  check(REPUTATION_EVENTS.mergedClubs === -20, "merging clubs is -20, as agreed");
  check(fresh().reputation === REPUTATION_START, `a new career starts at ${REPUTATION_START}`);
  check(typeof fresh().reputation === "number", "reputation is a single number now");
  check(migrateReputation({ world: 40, club: 60, government: 0, shareholders: 20 }) === 30,
    "an old four-bar save becomes the average of the four");
  check(migrateReputation(undefined) === REPUTATION_START, "a missing reputation starts where a new career does");
  check(reputationVoteBias(100) === 1 && reputationVoteBias(0) === -1 && reputationVoteBias(50) === 0, "vote bias spans -1..1");
  check(reputationLabel(95) === "Establishment" && reputationLabel(5) === "Distrusted", "labels read sensibly");
}

// ── Fame: capped, six levels ────────────────────────────────────────────────
{
  check(FAME_LEVELS.length === 6, "six fame levels");
  check(fameLevel(0).name === "Unknown" && fameLevel(80).name === "Icon" && fameLevel(59).name === "National Name", "levels sit where agreed");
  check(fameOf({ fame: 999, ownedItems: [] }) === 100, "fame never exceeds 100");
  check(fresh().fame === 0, "a new career starts unknown");
}

// ── Fame: what you own, on a curve, and it wears out ────────────────────────
{
  const all = LIFESTYLE_ITEMS.map(freshItem);
  const everything = ownedFame(all);
  check(everything > 10, `owning a lot is worth well over the old +10 cap (${everything.toFixed(1)})`);
  check(everything < OWNED_FAME_MAX, `…but owning alone can never reach ${OWNED_FAME_MAX}, let alone 100 (${everything.toFixed(1)})`);
  const phone = LIFESTYLE_ITEMS.find(i => i.id === "phone")!;
  const island = LIFESTYLE_ITEMS.find(i => i.id === "island")!;
  check(ownedFame([freshItem(island)]) > ownedFame([freshItem(phone)]) * 20, "an island is worth vastly more fame than a phone");

  check(itemLifeSeasons(phone) === 2, "a phone lasts 2 seasons");
  check(itemLifeSeasons({ id: "car-1", category: "vehicle" }) === 5, "a car lasts 5 seasons");
  check(itemLifeSeasons(island) === null, "property never wears out");

  let owned: OwnedItem[] = [freshItem(phone)];
  owned = wearItems(owned);
  check(!isWornOut(owned[0]), "a phone still works after one season");
  owned = wearItems(owned);
  check(isWornOut(owned[0]), "…and is worn out after two");
  check(ownedFame(owned) === 0, "a worn-out item gives no fame");
  check(ownedFame(wearItems([freshItem(island)])) > 0, "property keeps giving fame forever");
  const legacy: OwnedItem = { ...phone };
  check(!isWornOut(wearItems([legacy])[0]), "an item bought before wear existed never breaks on an old save");
}

// ── Fame: scandals add, never subtract ──────────────────────────────────────
{
  const all = [0, 0.3, 0.6, 0.99].map(scandalFame);
  check(all.every(n => n >= 1 && n <= 4), `a scandal is always +1 to +4 fame (${all.join(",")})`);
  const c = fresh();
  const after = applyEffects(c, { fame: 3, reputation: -8, scandal: true });
  check(after.fame > c.fame, "a scandal dilemma raises fame");
  check(after.reputation < c.reputation, "…and lowers reputation");
  check(after.lastScandalSeason === c.season, "…and marks the season as not clean");
}

// ── Fame: the fade ──────────────────────────────────────────────────────────
{
  check(fadedFame(60, "national_league") === 60 - (60 - 15) * 0.2, "above your division's level you fade a fifth of the way");
  check(fadedFame(10, "premier") === 10, "you never fade below your division's level");
}

// ── Season rollover: no fame for playing, fame for big moments ──────────────
{
  const noLadder = {
    yourMove: null, promotedToPremier: [], promotedToChampionship: [], promotedToLeagueOne: [],
    promotedToLeagueTwo: [], relegatedFromPremier: [], relegatedFromChampionship: [],
    relegatedFromLeagueOne: [], relegatedFromLeagueTwo: [], relegatedFromNationalLeague: [],
  } as const;
  const busy: CareerState = { ...fresh(), seasonStats: { ...fresh().seasonStats, appearances: 38, goals: 5 } };
  const quiet = seasonStanding(busy, noLadder, "premier", false, false, {});
  check(quiet.fame === busy.fame, `a full season with nothing won earns no fame (${busy.fame} -> ${quiet.fame})`);

  const promoted = seasonStanding(busy, { ...noLadder, yourMove: "promoted" }, "premier", false, false, {});
  check(promoted.fame === busy.fame + FAME_FOR_PROMOTION_TO.premier!, "promotion to the Premier League is +10");

  const champ: CareerState = { ...busy, trophies: [{ season: busy.season, competition: "Premier League", club: "Liverpool" }] };
  const won = seasonStanding(champ, noLadder, "premier", false, false, {});
  check(won.fame >= busy.fame + FAME_FOR_TROPHY["Premier League"], "winning the league is worth its trophy fame");
  check(won.reputation > busy.reputation, "…and some reputation");

  const bdo = seasonStanding(busy, noLadder, "premier", true, false, {});
  check(bdo.fame >= busy.fame + 15, "the Ballon d'Or is +15");

  const benched: CareerState = { ...fresh(), fame: 30, seasonStats: { ...fresh().seasonStats, appearances: 2 } };
  check(seasonStanding(benched, noLadder, "premier", false, false, {}).fame < 30, "a season on the bench costs fame");

  const clean = seasonStanding(busy, noLadder, "premier", false, false, {});
  check(clean.reputation === busy.reputation + REPUTATION_EVENTS.cleanSeason, "a scandal-free season is +1 reputation");
  const dirty = seasonStanding({ ...busy, lastScandalSeason: busy.season }, noLadder, "premier", false, false, {});
  check(dirty.reputation === busy.reputation, "…but not after a scandal");
}

// ── The real advanceSeason path uses it ─────────────────────────────────────
{
  // Already in Europe and a full season played — so nothing here is a moment.
  const f = fresh();
  const c: CareerState = { ...f, fame: 10, europeanQualification: "Champions League",
    seasonStats: { ...f.seasonStats, appearances: 38 } };
  const { career: next } = advanceSeason(c, false, false);
  check(next.fame <= 10, `advancing a season with nothing won does not add fame (${next.fame})`);
  check(Array.isArray(next.fameNews), "the reasons are kept for the Fame & Reputation screen");
}

// ── Sponsors: one season, two for the top three, then re-earn ───────────────
{
  check(sponsorTerm("Boots") === 1 && sponsorTerm("Car") === 2 && sponsorTerm("Watch") === 2, "deal lengths as agreed");
  const base = fresh();
  const withDeal: CareerState = { ...base, sponsors: base.sponsors.map(s => s.category === "Boots" ? { ...s, active: true, termLeft: 1 } : s) };
  const rolled = rollSponsorSeason(withDeal);
  check(!rolled.sponsors.find(s => s.category === "Boots")!.active, "a one-season deal ends at the rollover");
  check(rolled.standingHit === 0, "a deal simply ending costs no sponsor standing");
  const twoYear: CareerState = { ...base, sponsors: base.sponsors.map(s => s.category === "Car" ? { ...s, active: true, termLeft: 2 } : s) };
  const once = rollSponsorSeason(twoYear).sponsors.find(s => s.category === "Car")!;
  check(once.active && once.termLeft === 1, "a two-season deal survives its first rollover");
  const legacy: CareerState = { ...base, sponsors: base.sponsors.map(s => s.category === "Food" ? { ...s, active: true } : s) };
  check(!rollSponsorSeason(legacy).sponsors.find(s => s.category === "Food")!.active, "an old deal with no term ends this season");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — fame is capped and earned from big moments, items wear, reputation is one number");
