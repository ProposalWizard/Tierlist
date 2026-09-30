// Sponsors, rebuilt (lib/star/sponsorDeals.ts; Mikey, 30 Sep 2026).
import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow.ts";
import { PREMIER_LEAGUE_CLUBS, NATIONAL_LEAGUE_CLUBS } from "../../lib/star/clubs.ts";
import { finaliseMatch } from "../../lib/star/matchStats.ts";
import { applyGettingCaught } from "../../lib/star/corruption.ts";
import {
  brandsOf, slotsFor, signOffer, declineOffer, walkAway, askLonger, askEasier, counterPoach, settleNegotiation,
  brandScandal, brandsAfterMatch, brandsAfterSeason, weeklySponsorTotal, sponsorPayFor, bootPrice, offerChance,
  openCategories, fairWeekly, BRAND_CATEGORIES, HAPPY, WEEKS_PER_SEASON, SIGNING_ON_WEEKS, emptyBrands,
  type BrandOffer, type BrandDeal, type BrandsState,
} from "../../lib/star/sponsorDeals.ts";
import { mulberry32 } from "../../lib/star/season.ts";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };
const P = (club: string): StarPlayer => ({ firstName: "T", lastName: "P", age: 20, skinTone: "light", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 });
const prem = (): CareerState => makeInitialCareer(P(PREMIER_LEAGUE_CLUBS[0]), [...PREMIER_LEAGUE_CLUBS], "premier");
const stats = (o: Partial<MatchStats>): MatchStats => ({ chances: 4, goals: 0, assists: 0, passes: 20, rating: 7, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0, homeScore: 1, awayScore: 0, ...o });
const offer = (o: Partial<BrandOffer>): BrandOffer => ({ id: "o1", kind: "new", brand: "STRYDE", color: "#f59e0b", category: "Boots", weekly: 100, seasons: 2,
  targets: [{ kind: "goals", target: 5, progress: 0, period: "season", bonus: 800, done: false }], signingOn: 200, expires: { season: 1, week: 3 }, note: "", ...o });
const withOffers = (c: CareerState, offers: BrandOffer[], deals: BrandDeal[] = []): CareerState => ({ ...c, brands: { ...emptyBrands(), offers, deals } });
const famous = (c: CareerState, fame: number): CareerState => ({ ...c, fame, ownedItems: [] });

// ── Slots grow with fame ──
{
  const c = prem();
  const at = (f: number) => slotsFor(famous(c, f));
  check(at(0) === 0 && at(10) === 1 && at(25) === 2 && at(40) === 3 && at(60) === 4 && at(80) === 5, "slots: 0 unknown, 1 Local Name … 5 Icon");
  check(new Set(BRAND_CATEGORIES.map(x => x.category)).size === BRAND_CATEGORIES.length && BRAND_CATEGORIES.every(x => x.brands.length >= 2), "every category is unique and has two brands to bid");
  check(["Headphones", "Video Game"].every(n => BRAND_CATEGORIES.some(x => x.category === n)), "headphones and a video game are in");
}

// ── Signing: slot, category, signing-on, guaranteed value ──
{
  const c0 = famous(prem(), 12);
  const r = signOffer(withOffers(c0, [offer({})]), "o1");
  check(r.ok, "an offer signs into a free slot");
  if (r.ok) {
    const d = brandsOf(r.career).deals[0];
    check(r.career.money === c0.money + 200, "the signing-on payment (2 weeks' fee) is paid on signing");
    check(d.guaranteed === 100 * WEEKS_PER_SEASON * 2 && d.happiness === HAPPY.start && SIGNING_ON_WEEKS === 2, "the deal's guaranteed value is every week it promised");
    check(weeklySponsorTotal(r.career) === 100 && brandsOf(r.career).offers.length === 0, "it pays ★100 a week and the offer is gone");
    const second = signOffer(withOffers(r.career, [offer({ id: "o2", category: "Food", brand: "Crunchwell" })], brandsOf(r.career).deals), "o2");
    check(!second.ok, "one slot at Local Name: a second deal is refused");
    const same = signOffer(withOffers(famous(r.career, 30), [offer({ id: "o3", brand: "Velo" })], brandsOf(r.career).deals), "o3");
    check(!same.ok, "one deal per category, whatever the slots");
    // Walking away costs the whole guaranteed value.
    const poor = walkAway({ ...r.career, money: 100 }, d.id);
    check(!poor.ok, "you can't walk away if you can't pay the full guaranteed value");
    const rich = walkAway({ ...r.career, money: 10_000 }, d.id);
    check(rich.ok && rich.career.money === 10_000 - 8000 && brandsOf(rich.career).deals.length === 0, "walking away costs ★8,000 here: all 80 weeks");
    check(bootPrice(r.career, 1000) === 750 && bootPrice(c0, 1000) === 1000, "a boots deal takes 25% off boots");
  }
}

// ── Bidding war, poaching, negotiating ──
{
  const c0 = famous(prem(), 12);
  const war = withOffers(c0, [offer({ id: "a", kind: "bid", rival: "b" }), offer({ id: "b", kind: "bid", brand: "Velo", rival: "a" })]);
  const r = signOffer(war, "a");
  check(r.ok && brandsOf(r.career).offers.length === 0, "signing one side of a bidding war withdraws the other");
  check(brandsOf(declineOffer(war, "a")).offers.length === 1, "declining one leaves the other");

  const deal: BrandDeal = { id: "d1", brand: "STRYDE", category: "Boots", color: "#fff", weekly: 100, seasonsLeft: 2, seasonsTotal: 2, guaranteed: 8000, happiness: 80, targets: [] };
  const poach = withOffers(c0, [offer({ id: "p", kind: "poach", brand: "Velo", weekly: 130, signingOn: 260, replaces: "d1" })], [deal]);
  const moved = signOffer(poach, "p");
  check(moved.ok && brandsOf(moved.career).deals.length === 1 && brandsOf(moved.career).deals[0].brand === "Velo" && moved.career.money === c0.money + 260, "a poach swaps the deal and costs you nothing");
  const matched = counterPoach(poach, "p", 0.1);
  check(matched.matched && brandsOf(matched.career).deals[0].weekly === 130 && brandsOf(matched.career).offers.length === 0, "a happy brand matches the rival's money");
  check(!counterPoach(poach, "p", 0.99).matched, "…and sometimes it won't");

  const o = withOffers(c0, [offer({})]);
  const up = settleNegotiation(o, "o1", 120);
  check(brandsOf(up).offers[0].weekly === 120 && brandsOf(up).offers[0].signingOn === 240, "a negotiated fee carries its signing-on payment with it");
  check(brandsOf(settleNegotiation(o, "o1", null)).offers.length === 0, "push too hard and the brand leaves the table");
  const longer = askLonger(o, "o1", 0.1);
  check(longer.yes && brandsOf(longer.career).offers[0].seasons === 3 && !askLonger(longer.career, "o1", 0.1).yes, "a longer deal can be asked for once");
  const easier = askEasier(o, "o1", 0.1);
  check(easier.yes && brandsOf(easier.career).offers[0].targets[0].target === 4, "an easier target takes a fifth off");
}

// ── Targets only ever add; happiness moves ──
{
  const c0 = famous(prem(), 12);
  const deal: BrandDeal = { id: "d1", brand: "STRYDE", category: "Boots", color: "#fff", weekly: 100, seasonsLeft: 2, seasonsTotal: 2, guaranteed: 8000, happiness: 60,
    targets: [{ kind: "goals", target: 2, progress: 0, period: "season", bonus: 800, done: false }, { kind: "goalStreak", target: 2, progress: 0, period: "deal", bonus: 1000, done: false }] };
  const c = withOffers(c0, [], [deal]);
  const f = c.fixtures.find(x => !x.played)!;
  const a = brandsAfterMatch(c, c, f, stats({ goals: 1 }));
  check(a.bonus === 0 && a.brands.deals[0].targets[0].progress === 1 && a.brands.deals[0].targets[1].run === 1, "a goal moves both targets on");
  const c2 = { ...c, brands: a.brands };
  const b = brandsAfterMatch(c2, c2, f, stats({ goals: 1 }));
  check(b.bonus === 1800 && b.brands.deals[0].targets.every(t => t.done) && b.brands.deals[0].happiness === 60 + 2 * HAPPY.hit, "hitting both pays both bonuses and pleases the brand");
  // A missed season target: no money lost, a little happiness lost, a new target.
  const end = brandsAfterSeason(c, { ...c, season: c.season + 1, week: 1 }, false);
  const d = end.brands.deals[0];
  check(end.bonus === 0 && d.happiness === 60 + HAPPY.miss && d.seasonsLeft === 1 && d.weekly === 100, "a missed target costs no money, only a little happiness");
  check(d.targets[0].kind === "goals" && d.targets[0].progress === 0 && !d.targets[0].done, "a season target starts again next season");
}

// ── The end of a deal: renewal, wheel, or the brand walks ──
{
  const c0 = famous(prem(), 12);
  const mk = (happiness: number): CareerState => withOffers(c0, [], [{ id: "d1", brand: "STRYDE", category: "Boots", color: "#fff", weekly: 100, seasonsLeft: 1, seasonsTotal: 1, guaranteed: 4000, happiness, targets: [] }]);
  const next = (c: CareerState) => brandsAfterSeason(c, { ...c, season: c.season + 1, week: 1 }, false).brands;
  const happy = next(mk(80));
  check(happy.deals.length === 0 && happy.offers.length === 1 && happy.offers[0].kind === "renewal" && happy.offers[0].weekly > 100, `a happy brand offers a renewal with a raise (★${happy.offers[0]?.weekly})`);
  const meh = next(mk(50));
  check(meh.offers.length === 1 && [85, 100, 110].includes(meh.offers[0].weekly), `a lukewarm brand offers a raise, the same or a cut (★${meh.offers[0]?.weekly})`);
  check(next(mk(20)).offers.length === 0, "an unhappy brand walks");
}

// ── A scandal ──
{
  const c0 = famous(prem(), 50);
  const d = (id: string, clause?: "behaviour"): BrandDeal => ({ id, brand: id, category: id, color: "#fff", weekly: 100, seasonsLeft: 2, seasonsTotal: 2, guaranteed: 8000, happiness: 70, targets: [], clause });
  const c = withOffers(c0, [], [d("Food", "behaviour"), d("Boots")]);
  const after = brandsOf(brandScandal(c, "a casino story"));
  check(after.deals.length === 1 && after.deals[0].id === "Boots" && after.deals[0].happiness === 70 + HAPPY.scandal, "a scandal ends a behaviour-clause deal and upsets the rest");
  check(brandsOf(applyGettingCaught(c, "bribery", 1000, "x")).deals.length === 1, "being caught for corruption is a scandal");
}

// ── Money: paid with the wage, and nothing without a deal ──
{
  const c = prem();
  const f = c.fixtures.find(x => !x.played && (x.kind ?? "league") === "league")!;
  const none = finaliseMatch(3, 0, 0, 10, 90, 1, 0, c, f);
  check(none.sponsorPay === 0, `no deals, no sponsor money (${none.sponsorPay})`);
  const paid = withOffers(c, [], [{ id: "d1", brand: "x", category: "Boots", color: "#fff", weekly: 500, seasonsLeft: 1, seasonsTotal: 1, guaranteed: 1, happiness: 60, targets: [] }]);
  const week = c.fixtures.filter(x => x.week === f.week).reduce((t, x) => t + sponsorPayFor(paid, x), 0);
  check(week === 500, `a week pays the fees exactly once, however many matches it has (${week})`);
}

// ── Offers only come to a player who is playing well enough ──
{
  const c = famous(prem(), 30);
  const playing = { ...c, seasonStats: { ...c.seasonStats, appearances: 8 } };
  check(offerChance({ ...playing, form: [5.5, 5.8, 6] }) === 0, "poor form: nobody calls");
  check(offerChance({ ...playing, status: "Squad", form: [8, 8, 8] }) === 0, "out of the squad: nobody calls");
  check(offerChance({ ...playing, form: [7.5, 8, 7.8] }) > offerChance({ ...playing, form: [6.4, 6.5, 6.3] }), "better form, more offers");
  check(offerChance({ ...famous(playing, 80), form: [7, 7, 7] }) > offerChance({ ...famous(playing, 10), form: [7, 7, 7] }), "more fame, more offers");
  const wage = c.contract.wage;
  const w = fairWeekly(c, "Boots", mulberry32(3));
  check(w > wage * 0.1 && w < wage * 0.3, `a boots deal is about a sixth of your wage (★${w} on ★${wage})`);
}

// ── Played through: offers really arrive, and the totals sit against the wage ──
{
  for (const [name, clubs, div] of [["Premier League", PREMIER_LEAGUE_CLUBS, "premier"], ["National League", NATIONAL_LEAGUE_CLUBS, "national_league"]] as const) {
    let c = makeInitialCareer(P(clubs[2]), [...clubs], div);
    const rng = mulberry32(11);
    let seen = 0, signed = 0;
    for (let season = 0; season < 3; season++) {
      let n = 0;
      while (n++ < 120) {
        const f = c.fixtures.find(x => !x.played); if (!f) break;
        const goals = rng() < 0.45 ? 1 : 0;
        c = creditMatchResult(c, f, stats({ goals, assists: rng() < 0.2 ? 1 : 0, rating: 6.8 + rng() * 1.6, starMan: rng() < 0.2, homeScore: 1 + goals, awayScore: 1 })).career;
        for (const o of [...brandsOf(c).offers]) {
          seen++;
          const r = signOffer(c, o.id);
          if (r.ok) { c = r.career; signed++; } else c = declineOffer(c, o.id);
        }
      }
      c = advanceSeason(c, false).career;
    }
    const b: BrandsState = brandsOf(c);
    const total = weeklySponsorTotal(c), wage = c.contract.wage;
    check(seen > 0 && signed > 0, `${name}: offers arrive and get signed over three seasons (${seen} seen, ${signed} signed)`);
    check(b.deals.length <= slotsFor(c) && new Set(b.deals.map(d => d.category)).size === b.deals.length, `${name}: never more deals than slots, never two in a category`);
    check(total <= wage * 1.2, `${name}: sponsors stay a second income, not a bigger one (★${total} a week on a ★${wage} wage)`);
    check(openCategories(c).every(x => !b.deals.some(d => d.category === x.category)), `${name}: a category with a deal never offers again`);
    console.log(`  ${name}: ${b.deals.length}/${slotsFor(c)} slots, ★${total} a week on a ★${wage} wage, ${seen} offers seen in 3 seasons`);
  }
}

console.log(fail ? "FAIL" : "PASS — sponsors: slots by fame, weekly fees with the wage, targets that only add, renewals by happiness, bidding wars, poaching, scandals");
if (fail) process.exit(1);
