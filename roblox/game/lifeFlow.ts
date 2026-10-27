/**
 * Life between matches, on the server: rest (week.ts rest), the shop
 * (page.tsx handleBuyKib, handleUseCan, handleBuyBoot, handleBuyItem; the
 * shop's lists as components/star/Shop.tsx and StyleShop show them).
 *
 * Copied from the website at the commit named in roblox/tools/manifest.json.
 */
import type { CareerState, Boot, OwnedItem } from "../../lib/star/types";
import { rest as restWeek, canAct, actionsLeft, spendAction, REST_ENERGY } from "../../lib/star/week";
import { happinessOf, happinessEnergyFactor, gamePlayedThisWeek } from "../../lib/star/relationships";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS, LIFESTYLE_ALL_LEVELS, type KibCan } from "../../lib/star/shopData";
import { bootPrice } from "../../lib/star/sponsorDeals";
import { ruleBookFor } from "../../lib/star/ruleBook";
import { freshItem, isWornOut } from "../../lib/star/fame";
import { isStory } from "../../lib/star/story";
import { lockHint, isOpen, recordPhoneBought, styleUnlockStar, recordBossMeeting, markAnnounced, gameFirst } from "../../lib/star/unlocks";
import { starsNow } from "../../lib/star/starPoints";
import { applyGameGain } from "../../lib/star/relationshipGame";
import { talkFor, talkGain, talkHits, TALK_ROUNDS, type BossTalk, type Grade } from "../../lib/star/bossTalk";
import { getTuning } from "../../lib/star/tuningStore";
import { brandsOf, signOffer, declineOffer, askLonger, askEasier, counterPoach, walkAway, targetLabel, slotsFor } from "../../lib/star/sponsorDeals";

export { canAct, actionsLeft };

/** What Rest gives now (week.ts rest). */
export function restGain(c: CareerState): number {
  return Math.min(100, Math.round(c.energy + REST_ENERGY * happinessEnergyFactor(happinessOf(c)))) - Math.round(c.energy);
}
export function rest(c: CareerState): CareerState { return restWeek(c); }

// ── the cans ──
export function cans(c: CareerState): { can: KibCan; price: number; owned: number; label: string }[] {
  return KIB_CANS.map((can) => ({ can, price: kibCanPrice(can, c.contract.wage ?? 0), owned: c.kibCans?.[can.id] ?? 0, label: kibCanEffectLabel(can) }));
}
/** handleBuyKib. */
export function buyKib(c: CareerState, id: string): CareerState | null {
  if (!isOpen(c, "shop")) return null;
  const can = KIB_CANS.find((k) => k.id === id);
  if (!can) return null;
  const price = kibCanPrice(can, c.contract.wage ?? 0);
  if (c.money < price) return null;
  return { ...c, money: c.money - price, kibCans: { ...c.kibCans, [can.id]: c.kibCans[can.id] + 1 } };
}
/** handleUseCan. */
export function useCan(c: CareerState, id: string): CareerState | null {
  const can = KIB_CANS.find((k) => k.id === id);
  if (!can || c.kibCans[can.id] === 0) return null;
  if (can.effect && c.kibAbility?.[can.effect]) return null;
  if (!can.effect && c.energy >= 100) return null;
  return {
    ...c,
    kibCans: { ...c.kibCans, [can.id]: c.kibCans[can.id] - 1 },
    ...(can.effect ? { kibAbility: { ...c.kibAbility, [can.effect]: true } } : {}),
    energy: Math.min(100, c.energy + can.restore),
  };
}

// ── the boots ──
/** Shop.tsx's boots: every level, priced off your wage (and a boots sponsor), the banned ones out. */
export function boots(c: CareerState): Boot[] {
  const banned = new Set(ruleBookFor(c, "FA").bannedItems);
  return BOOTS_ALL_LEVELS.filter((b) => !banned.has(b.id) && !banned.has(b.baseId ?? b.id)).map((b) => ({ ...b, price: bootPrice(c, b.price) }));
}
/** handleBuyBoot: the same pair stacks its matches; a different pair replaces it. */
export function buyBoot(c: CareerState, id: string): CareerState | null {
  const boot = boots(c).find((b) => b.id === id);
  if (!isOpen(c, "shop") || !boot || c.money < boot.price) return null;
  const stacking = c.currentBoot.id === boot.id;
  return {
    ...c,
    money: c.money - boot.price,
    currentBoot: stacking ? { ...boot, matches: c.currentBoot.matches + boot.matches } : { ...boot },
  };
}

// ── the lifestyle ──
const baseOf = (i: OwnedItem) => i.baseId ?? i.id;
function ownedLevelOf(c: CareerState, base: string): { owned: OwnedItem | undefined; level: number } {
  const owned = c.ownedItems.find((o) => baseOf(o) === base);
  return { owned, level: owned ? (owned.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === owned.id)?.level ?? 0) : 0 };
}
/** StyleShop's list, with the unlock chain's star locks. */
export function lifestyle(c: CareerState): { item: OwnedItem; status: "owned" | "worn" | "lower" | "locked" | "buy"; needStars: number }[] {
  const stars = starsNow(c);
  return LIFESTYLE_ALL_LEVELS.map((item) => {
    const base = baseOf(item);
    const { owned, level } = ownedLevelOf(c, base);
    const need = c.unlocks ? styleUnlockStar(base) : 0;
    let status: "owned" | "worn" | "lower" | "locked" | "buy" = "buy";
    if (stars < need) status = "locked";
    else if (owned && owned.id === item.id) status = isWornOut(owned) ? "worn" : "owned";
    else if (owned && !isWornOut(owned) && (item.level ?? 0) <= level && level > 0) status = "lower";
    return { item, status, needStars: need };
  });
}
/** handleBuyItem (the phone opens the phone, as on the website). */
export function buyItem(c: CareerState, id: string): CareerState | null {
  const item = LIFESTYLE_ALL_LEVELS.find((i) => i.id === id);
  if (!isOpen(c, "shop") || !item || c.money < item.price) return null;
  const row = lifestyle(c).find((r) => r.item.id === id);
  if (!row || row.status === "locked") return null;
  const base = baseOf(item);
  const { owned, level } = ownedLevelOf(c, base);
  if (owned && !isWornOut(owned) && (item.level ?? 0) <= level && level > 0) return null;
  if (owned && !isWornOut(owned) && owned.id === item.id) return null;
  const bought: CareerState = {
    ...c,
    money: c.money - item.price,
    ownedItems: [...c.ownedItems.filter((o) => baseOf(o) !== base), freshItem(item)],
    happiness: Math.min(100, c.happiness + Math.floor(item.lifestyleValue / 3)),
  };
  if (base === "phone" && (isStory(c) || !isOpen(c, "phone"))) return recordPhoneBought(bought);
  return bought;
}

// ── relationships: one game per bar each week (RelationsPage, relgames/) ──

export type RelKind = "boss" | "team" | "fans" | "happiness";
export const REL_GAME_LABEL: Record<RelKind, string> = { boss: "Office talk", team: "Woodwork challenge", fans: "Signing session", happiness: "Day off" };

/** RelationsPage: may this bar's game be played now, and why not. */
export function relGame(c: CareerState, kind: RelKind): { done: boolean; canPlay: boolean; why: string | null } {
  const cost = getTuning("energy.trainingCost");
  const tired = c.energy < cost;
  const left = actionsLeft(c);
  const done = gamePlayedThisWeek(c.relGamesPlayed, c.season, c.week, kind);
  const locked = !isOpen(c, "relations");
  const canPlay = !locked && left > 0 && !tired && !done;
  return { done, canPlay, why: locked ? lockHint(c, "relations") : done ? "Done this week" : left <= 0 ? "No days left this week" : tired ? "Not enough energy" : null };
}

/** page.tsx handleRelationshipGameComplete. */
export function relGameComplete(c: CareerState, kind: RelKind, res: { gain: number; cost?: number }): CareerState {
  const p = c.relGamesPlayed;
  const same = p && p.season === c.season && p.week === c.week;
  let updated: CareerState = {
    ...c,
    money: Math.max(0, c.money - (res.cost ?? 0)),
    energy: Math.max(0, c.energy - getTuning("energy.trainingCost")),
    relGamesPlayed: { season: c.season, week: c.week, kinds: [...(same ? p!.kinds : []), kind] },
  };
  if (kind === "happiness") updated.happiness = applyGameGain(c.happiness, res.gain);
  else updated.relationships = { ...c.relationships, [kind]: applyGameGain(c.relationships[kind] as number, res.gain) };
  if (kind === "boss" && c.unlocks && !c.achievements.includes("boss-meeting")) {
    updated = recordBossMeeting(updated);
    if (gameFirst(c)) updated = markAnnounced(updated, ["relations"]);
  }
  return spendAction(updated);
}

/** DayOff's choices. */
export function dayOffOptions(c: Pick<CareerState, "contract" | "ownedItems">) {
  const wage = Math.max(1, c.contract?.wage ?? 0);
  const hasGarden = (c.ownedItems ?? []).some((i) => i.category === "property");
  return [
    { id: "home", icon: hasGarden ? "🏡" : "🛋️", name: hasGarden ? "Chill in the garden" : "Put your feet up", gain: hasGarden ? 7 : 5, cost: 0 },
    { id: "golf", icon: "⛳", name: "A round of golf", gain: 9, cost: Math.round(wage * 0.2) },
    { id: "trip", icon: "✈️", name: "A weekend away", gain: 14, cost: Math.round(wage * 0.6) },
  ];
}
/** DayOff: the gain is capped at what is left of the bar. */
export function dayOff(c: CareerState, id: string): { gain: number; cost: number; line: string } | null {
  const o = dayOffOptions(c).find((x) => x.id === id);
  if (!o || c.money < o.cost) return null;
  return { gain: Math.min(o.gain, 100 - c.happiness), cost: o.cost, line: `${o.name}. Just what you needed.` };
}

/** BossChat: the office talk. `salt` stands in for the website's Date.now() % 100000. */
export interface TalkState { talk: BossTalk; round: number; grades: Grade[]; last: { you: string; him: string } | null }
export function startTalk(c: CareerState, salt: number): TalkState { return { talk: talkFor(c, salt), round: 0, grades: [], last: null }; }
export function talkPick(t: TalkState, i: number): TalkState {
  const r = t.talk.rounds[Math.min(t.round, TALK_ROUNDS - 1)];
  const rep = r.replies[i];
  if (!rep || t.round >= TALK_ROUNDS) return t;
  return { ...t, round: t.round + 1, grades: [...t.grades, rep.grade], last: { you: rep.text, him: rep.answer } };
}
export function talkOver(t: TalkState): boolean { return t.round >= TALK_ROUNDS; }
export function talkResult(t: TalkState): { gain: number; line: string } {
  const hits = talkHits(t.grades);
  return { gain: talkGain(t.grades), line: hits === TALK_ROUNDS ? "He liked every answer." : hits > 0 ? "That went well enough." : "You didn't get through to him." };
}
export { TALK_ROUNDS };

// ── sponsors (lib/star/sponsorDeals.ts; page.tsx sponsorActions) ──
export { brandsOf, targetLabel, slotsFor };
export function sponsorAction(c: CareerState, action: string, id: string, roll: number): { career: CareerState; note: string } {
  if (!isOpen(c, "sponsors")) return { career: c, note: lockHint(c, "sponsors") };
  switch (action) {
    case "sign": { const r = signOffer(c, id); return r.ok ? { career: r.career, note: r.message } : { career: c, note: r.reason }; }
    case "decline": return { career: declineOffer(c, id), note: "Declined." };
    case "longer": { const r = askLonger(c, id, roll); return { career: r.career, note: r.yes ? "They agreed: one more season." : "They said no to a longer deal." }; }
    case "easier": { const r = askEasier(c, id, roll); return { career: r.career, note: r.yes ? "They agreed: easier targets." : "They said no to easier targets." }; }
    case "counter": { const r = counterPoach(c, id, roll); return { career: r.career, note: r.matched ? "Your sponsor matched the offer." : "Your sponsor would not match it." }; }
    case "walk": { const r = walkAway(c, id); return r.ok ? { career: r.career, note: r.message } : { career: c, note: r.reason }; }
  }
  return { career: c, note: "" };
}
