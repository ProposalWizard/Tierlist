const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { saveCareer, loadCareer } from "../../lib/star/storage";
import {
  isOpen, recordDrill, drillMessageDue, recordLeagueVisit, recordFirstMatch, recordBossMeeting, recordPhoneBought, markSeen, hasSeen,
  styleUnlockStar, styleLock, appInstalled, installApp, STARTER_APPS, APP_STORE, type Feature,
} from "../../lib/star/unlocks";
import { relationshipGameGain, applyGameGain, GAME_LOSS } from "../../lib/star/relationshipGame";
import { KIB_CANS, kibCanEffectLabel } from "../../lib/star/shopData";
import { selectionStanding } from "../../lib/star/selection";
import { LIFESTYLE_ITEMS } from "../../lib/star/shopData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * THE UNLOCK CHAIN (Harry, 1 Oct 2026, P13-P40), the relationship minigame's
 * new scale (P34), the new starting numbers (P26) and Premium/Elite cans also
 * giving energy (P5).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = { firstName: "T", lastName: "P", age: 18, skinTone: "light", club: "Liverpool", clubBadge: null,
  position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
const fresh = (): CareerState => makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
const ALL: Feature[] = ["league", "stats", "play", "shop", "achievements", "relations", "phone"];

// ── Start values ──
{
  const c = fresh();
  check(c.relationships.boss === 50 && c.relationships.team === 50 && c.relationships.fans === 50, "manager, team-mates and fans start at 50");
  check(c.happiness === 45, "you (happiness) start at 45");
  check(c.reputation === 0, "reputation starts at 0");
  check(c.fame === 1, "fame starts at 1");
  check(c.relationships.sponsors === 0, "sponsors still start at 0");
  // What the manager at 50 (was 60) costs: 4 points of selection standing
  // (boss is 40% of it). Measured 1 Oct 2026: 9 of 20 Premier League and 12 of
  // 24 Championship clubs now start a new player on the bench (was 0). A
  // question for Harry, not changed here.
  const at60 = { ...c, relationships: { ...c.relationships, boss: 60 } };
  check(Math.abs(selectionStanding(at60) - selectionStanding(c) - 4) < 1e-9, "manager 50 instead of 60 is 4 points of selection standing");
}

// ── A new career: only Home and Training ──
{
  const c = fresh();
  check(!!c.unlocks, "a new career carries the unlock chain");
  for (const f of ALL) check(!isOpen(c, f), `a new career starts with ${f} locked`);
  check(!hasSeen(c, "tutorial"), "the Home tutorial has not been seen");
  check(hasSeen(markSeen(c, "tutorial"), "tutorial"), "skipping/finishing the tutorial records it");
}

// ── The order ──
{
  let c = fresh();
  c = recordDrill(c, 100, 2);
  check(!isOpen(c, "league") && !drillMessageDue(c), "one drill opens nothing");
  check(recordLeagueVisit(c) === c, "visiting the League before it opens does nothing");
  c = recordDrill(c, 200, 3);
  check(isOpen(c, "league") && isOpen(c, "stats") && isOpen(c, "play"), "two drills open League, Stats and Play");
  check(!isOpen(c, "shop") && !isOpen(c, "achievements") && !isOpen(c, "relations") && !isOpen(c, "phone"), "…and nothing else");
  check(drillMessageDue(c), "the 'star rating went up' message is due");
  check(c.unlocks!.pointsAtStart === 100 && c.unlocks!.starsAtStart === 2, "the message measures from before the first drill");
  c = markSeen(c, "drills-msg");
  check(!drillMessageDue(c), "…and shows once");

  check(recordBossMeeting({ ...c, unlocks: { ...c.unlocks!, open: [...c.unlocks!.open] } }).unlocks!.open.includes("relations"), "(a boss meeting opens Relations whenever it happens)");
  c = recordLeagueVisit(c);
  check(isOpen(c, "achievements") && !isOpen(c, "shop"), "opening the League opens Achievements — the Shop waits for the first game (P70)");
  check(c.achievements.includes("first-two-sessions"), "…and hands out 'Complete your first two training sessions'");
  const again = recordLeagueVisit(c);
  check(again.achievements.filter(a => a === "first-two-sessions").length === 1, "the achievement is handed out once");
  check(!isOpen(c, "relations"), "Relations still locked");
  c = recordFirstMatch(c);
  check(isOpen(c, "shop"), "playing the first game opens the Shop");
  check(recordFirstMatch(c) === c, "…once");

  c = recordBossMeeting(c);
  check(isOpen(c, "relations") && c.achievements.includes("boss-meeting"), "a boss meeting opens Relations with its achievement");
  check(!isOpen(c, "phone"), "Phone still locked");

  c = recordPhoneBought(c);
  check(isOpen(c, "phone") && c.achievements.includes("buy-phone"), "buying the phone opens the Phone with its achievement");
  for (const f of ALL) check(isOpen(c, f), `at the end of the chain ${f} is open`);
}

// ── Style: only the phone, the rest by star rating ──
{
  const c = fresh();
  check(styleUnlockStar("phone") === 0 && styleLock(c, "phone", 1) === null, "the phone is always open");
  const needs = LIFESTYLE_ITEMS.map(i => styleUnlockStar(i.id));
  check(needs.filter(n => n === 0).length === 1, "only the phone is open at the start");
  check([4, 6, 8, 10, 15, 30].every(n => needs.includes(n)), "his levels 4, 6, 8, 10, 15 and 30 are all used");
  check(Math.max(...needs) === 30, "nothing needs more than 30");
  check(styleLock(c, "jet", 29) === 30 && styleLock(c, "jet", 30) === null, "the private jet opens at 30");
  const old = { ...c, unlocks: undefined };
  check(LIFESTYLE_ITEMS.every(i => styleLock(old, i.id, 1) === null), "an existing career has every item open");
}

// ── The phone ──
{
  let c = fresh();
  check(STARTER_APPS.every(a => appInstalled(c, a)) && ["league", "settings"].every(a => appInstalled(c, a)), "League, Settings and the dock apps start on the phone");
  check(APP_STORE.every(a => !appInstalled(c, a.id)), "Shop, Store, Casino, Sponsors, Owner, Garden, Awards are in the App Store");
  const broke = installApp(c, "casino-menu");
  check(broke === c && !appInstalled(broke, "casino-menu"), "an app you cannot afford does not install (P71: apps cost real money)");
  check(APP_STORE.every(a => a.price >= 1000), "every app costs at least ★1,000");
  c = installApp({ ...c, money: 5000 }, "casino-menu");
  check(appInstalled(c, "casino-menu") && !appInstalled(c, "store"), "getting one app adds only that one");
  check(c.money === 5000 - APP_STORE.find(a => a.id === "casino-menu")!.price, "…and charges its price");
  check(APP_STORE.every(a => appInstalled({ unlocks: undefined }, a.id)), "an existing career has every app");
}

// ── Old saves: everything open, no tutorial ──
{
  const c = fresh();
  const old = { ...c } as CareerState;
  delete (old as { unlocks?: unknown }).unlocks;
  saveCareer(old, "test-old");
  const back = loadCareer("test-old")!;
  check(back.unlocks === undefined, "an old save loads without an unlock chain");
  for (const f of ALL) check(isOpen(back, f), `an old save has ${f} open`);
  check(hasSeen(back, "tutorial") && !drillMessageDue(back), "an old save never sees the tutorial or the drills message");
  check(recordDrill(back) === back && recordLeagueVisit(back) === back && recordBossMeeting(back) === back && recordPhoneBought(back) === back && recordFirstMatch(back) === back, "the chain never touches an old save");
  const ownNumbers = { ...old, relationships: { ...old.relationships, boss: 77 }, happiness: 63, reputation: 20 };
  saveCareer(ownNumbers, "test-old2");
  const back2 = loadCareer("test-old2")!;
  check(back2.relationships.boss === 77 && back2.happiness === 63 && back2.reputation === 20, "an old save keeps its own relationship numbers");
}

// ── The relationship minigame (every kind uses the same scale) ──
{
  const before = { lose: 4, winMin: 14, winMax: 18 };
  check(relationshipGameGain(false, 50) === -4 && GAME_LOSS === -4, "losing costs 4 (was 8, and +4 before that — P69, P98: \"minus eight is too much\")");
  for (const v of [0, 30, 59]) check(relationshipGameGain(true, v) === 2, `a win at ${v} is +2`);
  for (const v of [60, 72, 85]) check(relationshipGameGain(true, v) === 1, `a win at ${v} is +1`);
  check(relationshipGameGain(true, 90, 0.1) === 1 && relationshipGameGain(true, 90, 0.9) === 0, "above 85 a win is only sometimes +1");
  let maxWin = 0;
  for (let v = 0; v <= 100; v++) for (const r of [0, 0.49, 0.5, 0.99]) maxWin = Math.max(maxWin, relationshipGameGain(true, v, r));
  check(maxWin <= 2 && before.winMin > maxWin, "no win is ever worth more than +2 (was +14 to +18)");
  // Higher up, harder: the average win never grows as the number rises.
  const avg = (v: number) => [0.1, 0.3, 0.6, 0.9].reduce((s, r) => s + relationshipGameGain(true, v, r), 0) / 4;
  let prev = Infinity;
  for (let v = 0; v <= 100; v += 5) { check(avg(v) <= prev, `a win at ${v} is worth no more than one lower down`); prev = avg(v); }
  check(applyGameGain(3, -8) === 0 && applyGameGain(99, 2) === 100, "stays between 0 and 100");
}

// ── Cans ──
{
  const can = (id: string) => KIB_CANS.find(c => c.id === id)!;
  check(can("basic").restore === 65, "Basic still +65 energy");
  check(can("premium").restore > 0 && can("premium").restore < can("basic").restore, "Premium gives some energy, less than Basic");
  check(can("elite").restore > can("premium").restore && can("elite").restore < can("basic").restore, "Elite gives more than Premium, less than Basic");
  check(/energy/.test(kibCanEffectLabel(can("premium"))) && /energy/.test(kibCanEffectLabel(can("elite"))), "their labels say so");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — unlock order, old saves fully open, start values 50/50/50/45/0/1, games −8 / ≤+2 shrinking higher up, Premium/Elite cans give energy");
