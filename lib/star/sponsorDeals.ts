import type { CareerState, Fixture, MatchStats } from "./types";
import { fameOf, fameLevel, isWornOut } from "./fame";
import { divisionOf } from "./calendar";
import { clubExpectation } from "./expectations";
import { wageShareFor } from "./wages";
import { WAGE_FLOOR } from "./economy";
import { mulberry32 } from "./season";
import { starLevel } from "./starPoints";

/**
 * SPONSORS, REBUILT — brands come to you (Mikey, 30 Sep 2026).
 *
 * What it replaces: ten category rows you signed from a list, paid once a
 * season (lib/star/sponsors.ts — left in place but no longer reachable from
 * any screen, and its per-match "image rights" pay is gone from the match).
 *
 * How it works now:
 *  - Deal SLOTS grow with your fame level: Local Name 1 … Icon 5.
 *  - OFFERS arrive on your phone when you are performing and a brand fits
 *    you, and expire after two weeks. One deal per category.
 *  - A DEAL is a brand, a WEEKLY fee (paid with your wage on the Saturday
 *    match), a length of 1-3 seasons, one or two TARGETS and sometimes a
 *    clause. Two weeks' fee is paid on signing.
 *  - Targets only ever add: hitting one pays a bonus and pleases the brand;
 *    missing one costs nothing but a little of the brand's happiness.
 *  - HAPPINESS decides what happens when the deal runs out: a renewal with a
 *    raise, a take-it-or-leave-it wheel, or the brand walks.
 *  - Things happen: two brands bid for you, a rival tries to buy you out of a
 *    deal, a scandal ends a deal with a behaviour clause, and one-off
 *    milestone deals pay cash for big moments.
 *  - Walking away early costs the deal's whole guaranteed value.
 *  - A boots deal takes 25% off every pair in the shop.
 *
 * Everything here is pure: state in, state out. `career.brands` holds it.
 */

// ── What the state looks like ───────────────────────────────────────────────

export type TargetKind =
  | "goals" | "assists" | "involvements" | "appearances" | "starMan" | "rating"
  | "goalStreak" | "potm" | "promotion" | "trophy";

export interface BrandTarget {
  kind: TargetKind;
  target: number;
  progress: number;
  /** "season": starts again each season. "deal": any time before it ends. */
  period: "season" | "deal";
  bonus: number;
  done: boolean;
  /** For goalStreak: the run you are on right now. */
  run?: number;
}

export type BrandClause = "exclusive" | "behaviour";

export interface BrandDeal {
  id: string;
  brand: string;
  category: string;
  color: string;
  weekly: number;
  seasonsLeft: number;
  seasonsTotal: number;
  /** What walking away early costs: every week the deal promised. */
  guaranteed: number;
  /** 0-100. Decides the renewal. */
  happiness: number;
  targets: BrandTarget[];
  clause?: BrandClause;
}

export type OfferKind = "new" | "bid" | "poach" | "renewal" | "milestone";

export interface BrandOffer {
  id: string;
  kind: OfferKind;
  brand: string;
  category: string;
  color: string;
  weekly: number;
  seasons: number;
  targets: BrandTarget[];
  clause?: BrandClause;
  /** Paid the moment you sign (two weeks' fee), or the whole of a milestone deal. */
  signingOn: number;
  /** Gone after this week of this season. */
  expires: { season: number; week: number };
  /** The other brand in a bidding war: signing one withdraws the other. */
  rival?: string;
  /** A poach or a renewal: the deal this one replaces. */
  replaces?: string;
  note: string;
  /** Each can be asked for once. */
  askedLonger?: boolean;
  askedEasier?: boolean;
  negotiated?: boolean;
}

export interface BrandsState {
  deals: BrandDeal[];
  offers: BrandOffer[];
  /** Newest first, for the Sponsors screen. */
  news: string[];
  /** One-off milestone deals already paid. */
  paid: string[];
  seq: number;
}

export const emptyBrands = (): BrandsState => ({ deals: [], offers: [], news: [], paid: [], seq: 0 });
export const brandsOf = (career: Pick<CareerState, "brands">): BrandsState => career.brands ?? emptyBrands();

// ── The brands ──────────────────────────────────────────────────────────────

export interface BrandCategory {
  category: string;
  icon: string;
  /** Fame needed before this kind of brand looks at you. */
  fame: number;
  /** Weekly fee as a share of your wage, before the fine print. */
  share: number;
  fits: (c: CareerState) => boolean;
  wants: string;
  /** Invented names. Two or more, so two can bid against each other. */
  brands: [string, string][]; // [name, colour]
  clause?: BrandClause;
  targets: TargetKind[];
}

const ownsWorking = (c: CareerState, category: "vehicle" | "property") =>
  (c.ownedItems ?? []).some(i => i.category === category && !isWornOut(i));

export const BRAND_CATEGORIES: BrandCategory[] = [
  { category: "Boots", icon: "👟", fame: 10, share: 0.16, clause: "exclusive",
    fits: c => c.seasonStats.goals + c.seasonStats.assists >= 3 || c.careerStats.goals + c.careerStats.assists >= 10,
    wants: "3 goals or assists this season (or 10 in your career)",
    brands: [["STRYDE", "#f59e0b"], ["Velo", "#22d3ee"], ["Kestrel", "#ef4444"]],
    targets: ["goals", "goalStreak", "involvements"] },
  { category: "Sports Drink", icon: "⚡", fame: 10, share: 0.12, clause: "exclusive",
    fits: c => c.seasonStats.appearances >= 6 || c.careerStats.appearances >= 20,
    wants: "6 appearances this season",
    brands: [["VOLTA Energy", "#a78bfa"], ["Hydra8", "#38bdf8"], ["Surge", "#84cc16"]],
    targets: ["appearances", "rating", "starMan"] },
  { category: "Food", icon: "🍔", fame: 10, share: 0.10, clause: "behaviour",
    fits: c => c.happiness >= 45, wants: "45 happiness",
    brands: [["Crunchwell", "#fb923c"], ["Big Oven", "#f87171"], ["Fuel Bowl", "#4ade80"]],
    targets: ["appearances", "goals", "assists"] },
  { category: "Headphones", icon: "🎧", fame: 10, share: 0.10,
    fits: c => c.relationships.fans >= 40, wants: "40 with the fans",
    brands: [["Loudline", "#f472b6"], ["Pulse Audio", "#60a5fa"]],
    targets: ["starMan", "assists", "appearances"] },
  { category: "Sports Clothing", icon: "🎽", fame: 25, share: 0.15,
    fits: c => c.relationships.fans >= 45, wants: "45 with the fans",
    brands: [["Kinetic", "#34d399"], ["Arrow Athletic", "#f97316"]],
    targets: ["goals", "involvements", "rating"] },
  { category: "Casual Clothing", icon: "🧥", fame: 25, share: 0.14, clause: "behaviour",
    fits: c => c.relationships.fans >= 55, wants: "55 with the fans",
    brands: [["Northside", "#94a3b8"], ["Harbour & Co", "#fbbf24"]],
    targets: ["starMan", "potm", "appearances"] },
  { category: "Video Game", icon: "🎮", fame: 25, share: 0.15,
    fits: c => c.seasonStats.starMan >= 2 || c.careerStats.starMan >= 5,
    wants: "2 Star Man awards this season (or 5 in your career)",
    brands: [["Kickoff League", "#818cf8"], ["Pixel Pitch", "#2dd4bf"]],
    targets: ["starMan", "goals", "potm"] },
  { category: "Electronics", icon: "📱", fame: 40, share: 0.17,
    fits: c => c.trophies.length >= 1, wants: "a trophy in the cabinet",
    brands: [["Novatek", "#38bdf8"], ["Orbit", "#c084fc"]],
    targets: ["trophy", "rating", "involvements"] },
  { category: "Cosmetics", icon: "🧴", fame: 40, share: 0.15, clause: "behaviour",
    fits: c => c.relationships.fans >= 50, wants: "50 with the fans",
    brands: [["Solace", "#f9a8d4"], ["Clean Cut", "#67e8f9"]],
    targets: ["starMan", "potm", "rating"] },
  { category: "Watch", icon: "⌚", fame: 60, share: 0.20, clause: "exclusive",
    fits: c => ownsWorking(c, "vehicle"), wants: "a car of your own",
    brands: [["Chronos", "#fcd34d"], ["Meridian Time", "#e5e7eb"]],
    targets: ["starMan", "trophy", "goals"] },
  { category: "Jewellery", icon: "💎", fame: 60, share: 0.20,
    fits: c => ownsWorking(c, "property"), wants: "a home of your own",
    brands: [["Aurum", "#fde047"], ["Lustre", "#a5b4fc"]],
    targets: ["trophy", "potm", "involvements"] },
  { category: "Car", icon: "🚗", fame: 80, share: 0.24, clause: "behaviour",
    fits: c => { const a = clubExpectation(c).ambition; return a === "Title" || a === "Europe"; },
    wants: "a club chasing the title or Europe",
    brands: [["Vanta Motors", "#f43f5e"], ["Apex Automotive", "#93c5fd"]],
    targets: ["trophy", "goals", "rating"] },
  { category: "Home Nation", icon: "🏳️", fame: 25, share: 0.15, clause: "behaviour",
    fits: c => (c.caps ?? 0) >= 1, wants: "a cap for your country",
    brands: [["Pride of the Nation", "#f87171"], ["National Rail", "#60a5fa"]],
    targets: ["appearances", "goals", "starMan"] },
];
const categoryOf = (category: string) => BRAND_CATEGORIES.find(c => c.category === category);

// ── Slots, money ────────────────────────────────────────────────────────────

/** Deal slots by fame level: Unknown 0, Local Name 1, … Icon 5. */
export function slotsFor(career: CareerState): number {
  const f = fameOf(career);
  return f >= 80 ? 5 : f >= 60 ? 4 : f >= 40 ? 3 : f >= 25 ? 2 : f >= 10 ? 1 : 0;
}

/** Weeks in a season's worth of a deal, for the guaranteed (buy-out) value. */
export const WEEKS_PER_SEASON = 40;
export const SIGNING_ON_WEEKS = 2;
export const BOOT_DEAL_DISCOUNT = 0.25;
/** Past this wage a deal's share of it tapers, so five deals on a ★100k wage
 *  come to ★20-40k a week rather than most of the wage again. */
const TAPER_FROM = 8000, TAPER_POWER = 0.35;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pick = <T,>(xs: readonly T[], rng: () => number): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const roundMoney = (n: number) => (n >= 1000 ? Math.round(n / 50) * 50 : n >= 100 ? Math.round(n / 5) * 5 : Math.max(1, Math.round(n)));

/** What a brand of this kind would pay you a week, right now. */
export function fairWeekly(career: CareerState, category: string, rng: () => number): number {
  const cat = categoryOf(category);
  if (!cat) return 0;
  const wage = Math.max(WAGE_FLOOR, career.contract?.wage ?? 0);
  const taper = wage > TAPER_FROM ? Math.pow(TAPER_FROM / wage, TAPER_POWER) : 1;
  // Fame is what gets you the offer; your star rating nudges the money.
  // (1-100 since 1 Oct 2026; /10 keeps the nudge the size it was on 1-10.)
  const stars = starLevel(career) / 10;
  return roundMoney(wage * cat.share * taper * (0.9 + rng() * 0.3) * (1 + stars * 0.02));
}

export function weeklySponsorTotal(career: Pick<CareerState, "brands">): number {
  return brandsOf(career).deals.reduce((s, d) => s + d.weekly, 0);
}

/** Sponsor money for this fixture: a week's fees, paid with the wage. */
export function sponsorPayFor(career: CareerState, fixture: Fixture | undefined): number {
  const total = weeklySponsorTotal(career);
  if (!total) return 0;
  return Math.round(total * (fixture ? wageShareFor(career, fixture) : 1));
}

export function hasBootDeal(career: Pick<CareerState, "brands">): boolean {
  return brandsOf(career).deals.some(d => d.category === "Boots");
}
/** A boots deal takes 25% off every pair. */
export function bootPrice(career: Pick<CareerState, "brands">, price: number): number {
  return hasBootDeal(career) ? Math.max(1, Math.round((price * (1 - BOOT_DEAL_DISCOUNT)) / 5) * 5) : price;
}

// ── Targets ─────────────────────────────────────────────────────────────────

export function targetLabel(t: BrandTarget): string {
  const when = t.period === "season" ? " this season" : " before the deal ends";
  switch (t.kind) {
    case "goals": return `Score ${t.target} goals${when}`;
    case "assists": return `Get ${t.target} assists${when}`;
    case "involvements": return `${t.target} goals and assists${when}`;
    case "appearances": return `Play ${t.target} matches${when}`;
    case "starMan": return `Win ${t.target} Star Man award${t.target === 1 ? "" : "s"}${when}`;
    case "rating": return `Average ${(t.target / 10).toFixed(1)} or better this season`;
    case "goalStreak": return `Score in ${t.target} appearances in a row`;
    case "potm": return `Win Player of the Month${when}`;
    case "promotion": return "Get promoted";
    case "trophy": return `Win a trophy${when}`;
  }
}

function makeTarget(career: CareerState, kind: TargetKind, weekly: number, rng: () => number): BrandTarget {
  const seasons = Math.max(1, career.season);
  const perSeason = (total: number, floor: number) => Math.max(floor, Math.round(total / seasons));
  const g = Math.max(6, career.seasonStats.goals, perSeason(career.careerStats.goals, 6));
  const a = Math.max(4, career.seasonStats.assists, perSeason(career.careerStats.assists, 4));
  const stretch = 1 + rng() * 0.4;
  const mk = (target: number, period: "season" | "deal", weeks: number): BrandTarget =>
    ({ kind, target, progress: 0, period, bonus: roundMoney(weekly * weeks), done: false });
  switch (kind) {
    case "goals": return mk(Math.round(g * stretch), "season", 8);
    case "assists": return mk(Math.round(a * stretch), "season", 7);
    case "involvements": return mk(Math.round((g + a) * stretch), "season", 9);
    case "appearances": return mk(24 + Math.floor(rng() * 12), "season", 4);
    case "starMan": return mk(3 + Math.floor(rng() * 5), "season", 8);
    case "rating": return mk(68 + Math.floor(rng() * 7), "season", 7);
    case "goalStreak": return mk(3 + Math.floor(rng() * 3), "deal", 10);
    case "potm": return mk(1, "season", 10);
    case "promotion": return mk(1, "deal", 12);
    case "trophy": return mk(1, "deal", 12);
  }
}

function makeTargets(career: CareerState, category: string, weekly: number, rng: () => number): BrandTarget[] {
  const cat = categoryOf(category)!;
  // One target for a small deal, two for a big one.
  const n = cat.share >= 0.15 ? 2 : 1;
  const pool: TargetKind[] = [...cat.targets];
  if (divisionOf(career) !== "premier" && rng() < 0.25) pool.push("promotion");
  const out: BrandTarget[] = [];
  while (out.length < n && pool.length) {
    const k = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    out.push(makeTarget(career, k, weekly, rng));
  }
  return out;
}

// ── Offers ──────────────────────────────────────────────────────────────────

export const OFFER_WEEKS = 2;
const nextId = (s: BrandsState, tag: string) => `${tag}${s.seq + 1}`;

function expiry(career: CareerState, weeks = OFFER_WEEKS) {
  return { season: career.season, week: career.week + weeks };
}
const expired = (o: BrandOffer, career: CareerState) =>
  career.season > o.expires.season || (career.season === o.expires.season && career.week > o.expires.week);

function buildOffer(career: CareerState, s: BrandsState, category: string, brand: [string, string], kind: OfferKind, rng: () => number, weeklyMult = 1): BrandOffer {
  const cat = categoryOf(category)!;
  const weekly = roundMoney(fairWeekly(career, category, rng) * weeklyMult);
  return {
    id: nextId(s, "o"), kind, brand: brand[0], color: brand[1], category,
    weekly, seasons: 1 + Math.floor(rng() * 3), targets: makeTargets(career, category, weekly, rng),
    clause: cat.clause, signingOn: weekly * SIGNING_ON_WEEKS, expires: expiry(career), note: "",
  };
}

/** Categories that could send you a fresh offer right now. */
export function openCategories(career: CareerState): BrandCategory[] {
  const s = brandsOf(career);
  const fame = fameOf(career);
  return BRAND_CATEGORIES.filter(c =>
    fame >= c.fame && c.fits(career)
    && !s.deals.some(d => d.category === c.category)
    && !s.offers.some(o => o.category === c.category && o.kind !== "milestone"));
}

/** Why a category isn't offering, for the Sponsors screen. */
export function categoryStatus(career: CareerState, c: BrandCategory): string {
  if (fameOf(career) < c.fame) return `Needs ${fameLevel(c.fame).name} (${c.fame} fame)`;
  if (!c.fits(career)) return `Wants ${c.wants}`;
  return "Could send an offer";
}

const recentForm = (career: CareerState) => {
  const f = (career.rawForm?.length ? career.rawForm : career.form) ?? [];
  return f.length ? f.reduce((x, y) => x + y, 0) / f.length : 6.5;
};

/**
 * The chance a brand gets in touch this week. Nothing for a player who is
 * out of the side or playing badly; more with fame, form and (a little) stars.
 */
export function offerChance(career: CareerState): number {
  if (career.status === "Squad" || career.status === "Injured") return 0;
  const form = recentForm(career);
  if (form < 6.2 || career.seasonStats.appearances < 1) return 0;
  return clamp(0.06 + fameOf(career) / 500 + (form - 6.2) * 0.12 + (starLevel(career) / 10) * 0.008, 0, 0.45);
}

const push = (s: BrandsState, line: string): string[] => [line, ...s.news].slice(0, 12);

function maybeOffer(career: CareerState, s0: BrandsState, rng: () => number): BrandsState {
  let s = s0;
  const chance = offerChance(career);
  if (chance <= 0) return s;
  const free = slotsFor(career) - s.deals.length;
  const pendingNew = s.offers.filter(o => o.kind === "new" || o.kind === "bid").length;

  // A free slot, and a brand that fits: a new offer, sometimes two at once.
  if (free > 0 && pendingNew === 0 && rng() < chance) {
    const open = openCategories(career);
    if (open.length) {
      const cat = pick(open, rng);
      const war = cat.brands.length >= 2 && rng() < 0.25;
      if (war) {
        const i = Math.floor(rng() * cat.brands.length);
        const a = buildOffer(career, s, cat.category, cat.brands[i], "bid", rng);
        s = { ...s, seq: s.seq + 1 };
        const b = buildOffer(career, s, cat.category, cat.brands[(i + 1) % cat.brands.length], "bid", rng, 0.9 + rng() * 0.25);
        s = { ...s, seq: s.seq + 1 };
        a.rival = b.id; b.rival = a.id;
        a.note = b.note = `Two ${cat.category.toLowerCase()} brands want you. Sign one and the other walks.`;
        return { ...s, offers: [...s.offers, a, b], news: push(s, `Bidding war: ${a.brand} and ${b.brand} both want you.`) };
      }
      const o = buildOffer(career, s, cat.category, pick(cat.brands, rng), "new", rng);
      o.note = "A new offer.";
      return { ...s, seq: s.seq + 1, offers: [...s.offers, o], news: push(s, `${o.brand} have made you an offer.`) };
    }
  }

  // A rival tries to buy you out of a deal you already have.
  const poachable = s.deals.filter(d => d.seasonsLeft >= 1 && !s.offers.some(o => o.replaces === d.id));
  if (poachable.length && rng() < chance * 0.15) {
    const d = pick(poachable, rng);
    const cat = categoryOf(d.category);
    const rivals = (cat?.brands ?? []).filter(b => b[0] !== d.brand);
    if (cat && rivals.length) {
      const o = buildOffer(career, s, d.category, pick(rivals, rng), "poach", rng);
      o.weekly = roundMoney(Math.max(o.weekly, d.weekly * (1.2 + rng() * 0.25)));
      o.signingOn = o.weekly * SIGNING_ON_WEEKS;
      o.replaces = d.id;
      o.note = `${o.brand} will buy you out of your ${d.brand} deal. It costs you nothing.`;
      return { ...s, seq: s.seq + 1, offers: [...s.offers, o], news: push(s, `${o.brand} want to take you from ${d.brand}.`) };
    }
  }
  return s;
}

// ── One-off milestone deals ─────────────────────────────────────────────────

interface Milestone { id: string; label: string; weeks: number; hit: (before: CareerState, after: CareerState) => boolean }
const potmCount = (c: CareerState) => (c.awards ?? []).filter(a => a.kind === "Player of the Month").length;
const MILESTONES: Milestone[] = [
  { id: "first-goal", label: "your first goal", weeks: 2, hit: (b, a) => b.careerStats.goals === 0 && a.careerStats.goals > 0 },
  { id: "goals-50", label: "50 career goals", weeks: 5, hit: (b, a) => b.careerStats.goals < 50 && a.careerStats.goals >= 50 },
  { id: "goals-100", label: "100 career goals", weeks: 8, hit: (b, a) => b.careerStats.goals < 100 && a.careerStats.goals >= 100 },
  { id: "first-hat-trick", label: "your first hat-trick", weeks: 4, hit: (b, a) => b.careerStats.hatTricks === 0 && a.careerStats.hatTricks > 0 },
  { id: "first-potm", label: "your first Player of the Month", weeks: 5, hit: (b, a) => potmCount(b) === 0 && potmCount(a) > 0 },
  { id: "first-trophy", label: "your first trophy", weeks: 8, hit: (b, a) => b.trophies.length === 0 && a.trophies.length > 0 },
  { id: "first-cap", label: "your first cap", weeks: 6, hit: (b, a) => (b.caps ?? 0) === 0 && (a.caps ?? 0) > 0 },
];

function milestoneOffers(before: CareerState, after: CareerState, s0: BrandsState, rng: () => number): BrandsState {
  let s = s0;
  if (fameOf(after) < 10) return s; // nobody is watching yet
  for (const m of MILESTONES) {
    if (s.paid.includes(m.id) || s.offers.some(o => o.id === `m-${m.id}`) || !m.hit(before, after)) continue;
    const cat = pick(BRAND_CATEGORIES.filter(c => c.fame <= Math.max(10, fameOf(after))), rng);
    const brand = pick(cat.brands, rng);
    const lump = roundMoney(Math.max(WAGE_FLOOR, after.contract?.wage ?? 0) * 0.15 * m.weeks);
    const o: BrandOffer = {
      id: `m-${m.id}`, kind: "milestone", brand: brand[0], color: brand[1], category: cat.category,
      weekly: 0, seasons: 0, targets: [], signingOn: lump, expires: expiry(after),
      note: `A one-off advert to mark ${m.label}. It doesn't use a deal slot.`,
    };
    s = { ...s, offers: [...s.offers, o], news: push(s, `${o.brand} want a one-off advert for ${m.label}.`) };
  }
  return s;
}

// ── After a match, after a season ───────────────────────────────────────────

export const HAPPY = { start: 60, hit: 15, miss: -8, trophy: 10, scandal: -25, renew: 60, wheel: 40 };

function progressTargets(d: BrandDeal, before: CareerState, after: CareerState, stats: MatchStats): { deal: BrandDeal; bonus: number; hit: string[] } {
  let bonus = 0; const hit: string[] = [];
  const wonPotm = potmCount(after) > potmCount(before);
  const wonTrophy = after.trophies.length > before.trophies.length;
  const targets = d.targets.map((t) => {
    if (t.done) return t;
    let progress = t.progress, run = t.run;
    switch (t.kind) {
      case "goals": progress += stats.goals; break;
      case "assists": progress += stats.assists; break;
      case "involvements": progress += stats.goals + stats.assists; break;
      case "appearances": progress += 1; break;
      case "starMan": progress += stats.starMan ? 1 : 0; break;
      case "goalStreak": run = stats.goals > 0 ? (run ?? 0) + 1 : 0; progress = Math.max(progress, run); break;
      case "potm": progress += wonPotm ? 1 : 0; break;
      case "trophy": progress += wonTrophy ? 1 : 0; break;
      case "rating": case "promotion": break; // judged at the end of the season
    }
    const done = t.kind !== "rating" && t.kind !== "promotion" && progress >= t.target;
    if (done) { bonus += t.bonus; hit.push(`${d.brand}: ${targetLabel(t)} — bonus ★${t.bonus.toLocaleString("en-GB")}`); }
    return { ...t, progress, run, done };
  });
  const mood = (stats.rating >= 7.5 ? 1 : stats.rating <= 5.5 ? -1 : 0) + (wonTrophy ? HAPPY.trophy : 0) + hit.length * HAPPY.hit;
  return { deal: { ...d, targets, happiness: clamp(d.happiness + mood, 0, 100) }, bonus, hit };
}

/**
 * Everything a played match does to your sponsors. `before` is the career
 * the match was played from, `after` the career it produced. Returns the new
 * brands state and any target bonuses to add to your money.
 */
export function brandsAfterMatch(before: CareerState, after: CareerState, _fixture: Fixture, stats: MatchStats): { brands: BrandsState; bonus: number } {
  let s = brandsOf(before);
  const rng = mulberry32(before.season * 7919 + before.week * 131 + s.seq * 17 + 5);
  let bonus = 0; const lines: string[] = [];
  const deals = s.deals.map((d) => { const r = progressTargets(d, before, after, stats); bonus += r.bonus; lines.push(...r.hit); return r.deal; });
  s = { ...s, deals, offers: s.offers.filter(o => !expired(o, after)) };
  for (const l of lines) s = { ...s, news: push(s, l) };
  s = milestoneOffers(before, after, s, rng);
  s = maybeOffer(after, s, rng);
  return { brands: s, bonus };
}

/**
 * The season rolls over. `before` still holds the season just played (its
 * stats are not wiped yet); `after` is the new season's career.
 */
export function brandsAfterSeason(before: CareerState, after: CareerState, promoted: boolean): { brands: BrandsState; bonus: number } {
  let s = brandsOf(before);
  const rng = mulberry32(before.season * 104729 + s.seq * 31 + 11);
  let bonus = 0;
  const avg10 = before.seasonStats.ratingCount > 0 ? Math.round((before.seasonStats.totalRating / before.seasonStats.ratingCount) * 10) : 0;
  const kept: BrandDeal[] = []; const offers = s.offers.filter(o => !expired(o, after) && o.kind !== "bid" && o.kind !== "new");
  let news = s.news; let seq = s.seq;
  const say = (l: string) => { news = [l, ...news].slice(0, 12); };

  for (const d of s.deals) {
    let happiness = d.happiness;
    const targets: BrandTarget[] = [];
    for (const t0 of d.targets) {
      let t = t0;
      if (!t.done && t.kind === "rating") t = { ...t, progress: avg10, done: avg10 >= t.target };
      if (!t.done && t.kind === "promotion" && promoted) t = { ...t, progress: 1, done: true };
      if (t.done && !t0.done) { bonus += t.bonus; happiness += HAPPY.hit; say(`${d.brand}: ${targetLabel(t)} — bonus ★${t.bonus.toLocaleString("en-GB")}`); }
      const over = t.period === "season" || d.seasonsLeft <= 1;
      if (!t.done && over) { happiness += HAPPY.miss; say(`${d.brand}: you missed "${targetLabel(t)}". No money lost; they are a little less happy.`); }
      targets.push(t);
    }
    happiness = clamp(happiness, 0, 100);
    const left = d.seasonsLeft - 1;
    if (left > 0) {
      // A fresh target for each season one that has run its course.
      const next = targets.map(t => (t.period === "season" ? makeTarget(after, t.kind, d.weekly, rng) : t));
      kept.push({ ...d, seasonsLeft: left, happiness, targets: next });
      continue;
    }
    // The deal is up. What happens next is the brand's mood.
    const cat = categoryOf(d.category);
    if (happiness < HAPPY.wheel || !cat) { say(`${d.brand} have not renewed. The deal is over.`); continue; }
    const roll = rng();
    const mult = happiness >= HAPPY.renew ? 1.15 + rng() * 0.15 : roll < 0.4 ? 1.1 : roll < 0.75 ? 1 : 0.85;
    const weekly = roundMoney(d.weekly * mult);
    seq += 1;
    offers.push({
      id: `o${seq}`, kind: "renewal", brand: d.brand, color: d.color, category: d.category, weekly,
      seasons: 1 + Math.floor(rng() * 3), targets: makeTargets(after, d.category, weekly, rng), clause: d.clause,
      signingOn: weekly * SIGNING_ON_WEEKS, expires: { season: after.season, week: after.week + OFFER_WEEKS + 1 },
      note: happiness >= HAPPY.renew ? `${d.brand} are happy and want to renew, with a raise.`
        : mult > 1 ? `${d.brand} were on the fence. They came back with a small raise.`
          : mult === 1 ? `${d.brand} were on the fence. Same money to stay.` : `${d.brand} were on the fence. They will renew, for less.`,
    });
    say(`Your ${d.brand} deal has ended. A renewal offer is on your phone.`);
  }
  return { brands: { ...s, deals: kept, offers, news, seq }, bonus };
}

// ── What the player does ────────────────────────────────────────────────────

export type BrandResult = { ok: true; career: CareerState; message: string } | { ok: false; reason: string };

const withBrands = (career: CareerState, brands: BrandsState, money = career.money): CareerState => ({ ...career, brands, money });

export function signOffer(career: CareerState, offerId: string): BrandResult {
  const s = brandsOf(career);
  const o = s.offers.find(x => x.id === offerId);
  if (!o) return { ok: false, reason: "That offer has gone." };
  const rest = s.offers.filter(x => x.id !== o.id && x.id !== o.rival);

  if (o.kind === "milestone") {
    const brands = { ...s, offers: rest, paid: [...s.paid, o.id.replace(/^m-/, "")], news: push(s, `${o.brand} paid ★${o.signingOn.toLocaleString("en-GB")} for a one-off advert.`) };
    return { ok: true, career: withBrands(career, brands, career.money + o.signingOn), message: `${o.brand} paid you ★${o.signingOn.toLocaleString("en-GB")}.` };
  }

  const replaced = o.replaces ? s.deals.find(d => d.id === o.replaces) : undefined;
  const others = s.deals.filter(d => d.id !== o.replaces);
  if (others.some(d => d.category === o.category)) return { ok: false, reason: `You already have a ${o.category.toLowerCase()} deal.` };
  if (others.length >= slotsFor(career)) return { ok: false, reason: "No free deal slot. More open as your fame grows." };

  const deal: BrandDeal = {
    id: `d${s.seq + 1}`, brand: o.brand, category: o.category, color: o.color, weekly: o.weekly,
    seasonsLeft: o.seasons, seasonsTotal: o.seasons, guaranteed: o.weekly * WEEKS_PER_SEASON * o.seasons,
    happiness: o.kind === "renewal" ? Math.max(HAPPY.start, replaced?.happiness ?? HAPPY.start) : HAPPY.start,
    targets: o.targets.map(t => ({ ...t, progress: 0, done: false, run: 0 })), clause: o.clause,
  };
  let news = push(s, `Signed with ${o.brand}: ★${o.weekly.toLocaleString("en-GB")} a week for ${o.seasons} season${o.seasons === 1 ? "" : "s"}. Signing-on payment ★${o.signingOn.toLocaleString("en-GB")}.`);
  if (replaced && o.kind === "poach") news = [`${o.brand} bought you out of your ${replaced.brand} deal.`, ...news].slice(0, 12);
  const brands: BrandsState = { ...s, seq: s.seq + 1, deals: [...others, deal], offers: rest, news };
  return { ok: true, career: withBrands(career, brands, career.money + o.signingOn), message: `Here's your signing-on payment: ★${o.signingOn.toLocaleString("en-GB")}.` };
}

export function declineOffer(career: CareerState, offerId: string): CareerState {
  const s = brandsOf(career);
  return withBrands(career, { ...s, offers: s.offers.filter(o => o.id !== offerId) });
}

const patchOffer = (career: CareerState, offerId: string, f: (o: BrandOffer) => BrandOffer): CareerState => {
  const s = brandsOf(career);
  return withBrands(career, { ...s, offers: s.offers.map(o => (o.id === offerId ? f(o) : o)) });
};

/** The weekly fee agreed at the negotiating table (or the offer gone, on null). */
export function settleNegotiation(career: CareerState, offerId: string, weekly: number | null): CareerState {
  if (weekly === null) {
    const s = brandsOf(career);
    const o = s.offers.find(x => x.id === offerId);
    return withBrands(career, { ...s, offers: s.offers.filter(x => x.id !== offerId), news: o ? push(s, `${o.brand} walked away from the table.`) : s.news });
  }
  return patchOffer(career, offerId, o => {
    const w = roundMoney(weekly);
    const k = w / Math.max(1, o.weekly);
    return { ...o, weekly: w, signingOn: w * SIGNING_ON_WEEKS, negotiated: true, targets: o.targets.map(t => ({ ...t, bonus: roundMoney(t.bonus * k) })) };
  });
}

/** Ask for a longer deal. One go; they say yes about two times in three. */
export function askLonger(career: CareerState, offerId: string, roll: number): { career: CareerState; yes: boolean } {
  const o = brandsOf(career).offers.find(x => x.id === offerId);
  if (!o || o.askedLonger || o.seasons >= 3 || o.kind === "milestone") return { career, yes: false };
  const yes = roll < 0.65;
  return { yes, career: patchOffer(career, offerId, x => ({ ...x, askedLonger: true, seasons: yes ? x.seasons + 1 : x.seasons })) };
}

/** Ask for easier targets. One go; a yes takes about a fifth off each. */
export function askEasier(career: CareerState, offerId: string, roll: number): { career: CareerState; yes: boolean } {
  const o = brandsOf(career).offers.find(x => x.id === offerId);
  if (!o || o.askedEasier || !o.targets.some(t => t.target > 1) || o.kind === "milestone") return { career, yes: false };
  const yes = roll < 0.55;
  return { yes, career: patchOffer(career, offerId, x => ({
    ...x, askedEasier: true,
    targets: yes ? x.targets.map(t => (t.target > 1 && t.kind !== "rating" ? { ...t, target: Math.max(1, Math.round(t.target * 0.8)) } : t.kind === "rating" ? { ...t, target: t.target - 2 } : t)) : x.targets,
  })) };
}

/** A rival is trying to poach you: tell your current brand. A happy one matches it. */
export function counterPoach(career: CareerState, offerId: string, roll: number): { career: CareerState; matched: boolean } {
  const s = brandsOf(career);
  const o = s.offers.find(x => x.id === offerId);
  const d = o?.replaces ? s.deals.find(x => x.id === o.replaces) : undefined;
  if (!o || !d || o.kind !== "poach") return { career, matched: false };
  const matched = roll < clamp(d.happiness / 100 + 0.1, 0.2, 0.9);
  const deals = s.deals.map(x => (x.id === d.id && matched ? { ...x, weekly: Math.max(x.weekly, o.weekly), guaranteed: Math.max(x.weekly, o.weekly) * WEEKS_PER_SEASON * x.seasonsTotal } : x));
  const news = push(s, matched ? `${d.brand} matched ${o.brand}'s offer: ★${o.weekly.toLocaleString("en-GB")} a week.` : `${d.brand} would not match ${o.brand}'s offer. It is still on the table.`);
  return { matched, career: withBrands(career, { ...s, deals, news, offers: matched ? s.offers.filter(x => x.id !== o.id) : s.offers }) };
}

/** Walk away early: you pay the deal's whole guaranteed value. */
export function walkAway(career: CareerState, dealId: string): BrandResult {
  const s = brandsOf(career);
  const d = s.deals.find(x => x.id === dealId);
  if (!d) return { ok: false, reason: "That deal has gone." };
  if (career.money < d.guaranteed) return { ok: false, reason: `Walking away costs ★${d.guaranteed.toLocaleString("en-GB")}. You can't afford it.` };
  const brands = { ...s, deals: s.deals.filter(x => x.id !== dealId), news: push(s, `You bought yourself out of the ${d.brand} deal for ★${d.guaranteed.toLocaleString("en-GB")}.`) };
  return { ok: true, career: withBrands(career, brands, career.money - d.guaranteed), message: `You paid ★${d.guaranteed.toLocaleString("en-GB")} to leave ${d.brand}.` };
}

/** A scandal (a corruption story, a casino story). Behaviour-clause deals end; the rest are unhappy. */
export function brandScandal(career: CareerState, what: string): CareerState {
  const s = brandsOf(career);
  if (!s.deals.length) return career;
  let news = s.news;
  const deals: BrandDeal[] = [];
  for (const d of s.deals) {
    if (d.clause === "behaviour") { news = [`${d.brand} ended your deal over ${what}.`, ...news].slice(0, 12); continue; }
    deals.push({ ...d, happiness: clamp(d.happiness + HAPPY.scandal, 0, 100) });
  }
  if (deals.length) news = [`Your sponsors are unhappy about ${what}.`, ...news].slice(0, 12);
  return withBrands(career, { ...s, deals, news });
}

export const moodOf = (happiness: number): "happy" | "neutral" | "angry" =>
  happiness >= HAPPY.renew ? "happy" : happiness >= HAPPY.wheel ? "neutral" : "angry";
