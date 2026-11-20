/**
 * PLAYING A CHOICE — what happens, and making sure it lands (living world,
 * phase 1). Bars go through dilemmas.ts's applyEffects (the game's own
 * effect code); money is weeks of your own wage; a lost wager is really lost;
 * each named person's numbers move and he remembers; a team-mate's bond moves
 * the team bar (people.ts moveTeamFromPerson).
 */
import type { CareerState } from "../types";
import type { LifeEffects, LifeOutcome, LifeState } from "./types";
import { applyEffects, type DilemmaEffect } from "../dilemmas";
import { happinessOf } from "../relationships";
import { horseRating } from "../horse";
import { actionsLeft } from "../week";
import { formatMoney } from "../money";
import { cloneLife, cantPay, lifeOf, type LiveEvent } from "./director";
import { ctxFor, factsOf, weekOfMoney, type FactOverride } from "./facts";
import { holds } from "./cond";
import { lifeWeek, meet, moveTeamFromPerson, nudge, personInfo, remember } from "./people";
import { fillLine, tagWords } from "./text";

export interface LifeChange {
  kind: "bar" | "money" | "energy" | "person" | "memory" | "item" | "team-rule" | "later";
  label: string;
  delta?: number;
}

export interface ChoiceResult {
  career: CareerState;
  text: string;
  changes: LifeChange[];
  outcome: LifeOutcome;
  minigame?: "won" | "lost";
}

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The chance of winning a phase-1 minigame. */
export function minigameChance(c: CareerState, m: NonNullable<LiveEvent["choices"][number]["choice"]["minigame"]>): number {
  if (m.kind === "horse-race") return c.horse ? Math.max(0.15, Math.min(0.7, horseRating(c.horse) / 130)) : 0;
  const v = c.skills?.[m.stat] ?? 50;
  return Math.max(0.1, Math.min(0.9, 0.5 + (v - m.target) / 40));
}

/** Pick the outcome: conditions first, then the chances, then the fallback. */
export function pickOutcome(outcomes: LifeOutcome[], okIf: (s: string) => boolean, roll: number): LifeOutcome {
  const open = outcomes.filter((o) => !o.if || okIf(o.if));
  const chancy = open.filter((o) => typeof o.chance === "number");
  let acc = 0;
  for (const o of chancy) { acc += o.chance!; if (roll < acc) return o; }
  return open.find((o) => typeof o.chance !== "number") ?? open[open.length - 1] ?? outcomes[outcomes.length - 1];
}

export interface ChooseOpts {
  rng: () => number;
  facts?: FactOverride;
  /** Test page: play this outcome (index in the choice's list). */
  forceOutcome?: number;
  /** Test page: the minigame result. */
  forceMinigame?: "won" | "lost";
}

export function chooseOption(c0: CareerState, live: LiveEvent, choiceId: string, opts: ChooseOpts): ChoiceResult | null {
  const lc = live.choices.find((x) => x.id === choiceId);
  if (!lc) return null;
  if (cantPay(c0, lc.choice.cost)) return null;
  const ch = lc.choice;
  const life: LifeState = cloneLife(lifeOf(c0));
  const now = lifeWeek(c0);
  let c: CareerState = { ...c0, life };
  const changes: LifeChange[] = [];
  const week = weekOfMoney(c0);

  // The cost of the choice itself.
  if (ch.cost?.moneyWeeks) { const m = Math.round(ch.cost.moneyWeeks * week); c = { ...c, money: Math.max(0, c.money - m) }; changes.push({ kind: "money", label: `−${formatMoney(m)}`, delta: -m }); }
  if (ch.cost?.weekAction) { c = { ...c, weekActions: Math.max(0, actionsLeft(c) - ch.cost.weekAction) }; changes.push({ kind: "later", label: `${ch.cost.weekAction} day used` }); }
  if (ch.cost?.energy) { c = { ...c, energy: clampInt(c.energy + ch.cost.energy, 0, 100) }; changes.push({ kind: "energy", label: `${ch.cost.energy} energy`, delta: ch.cost.energy }); }

  // The minigame, then the outcome.
  let mini: "won" | "lost" | undefined;
  if (ch.minigame) mini = opts.forceMinigame ?? (opts.rng() < minigameChance(c0, ch.minigame) ? "won" : "lost");
  const ctx = ctxFor(c0, life, live.cast, factsOf(c0, opts.facts), { minigame: mini, roll: opts.rng() });
  const roll = opts.rng();
  const outcome = typeof opts.forceOutcome === "number" && ch.outcomes[opts.forceOutcome]
    ? ch.outcomes[opts.forceOutcome]
    : pickOutcome(ch.outcomes, (s) => holds(s, ctx), roll);

  // Named people: numbers, the team rule, memories.
  let teamFromPeople = 0;
  for (const d of outcome.npc ?? []) {
    const id = live.cast[d.slot];
    if (!id || id.startsWith("oneoff:")) continue;
    const p = meet(life, id, now);
    const info = personInfo(c0, id);
    const nm = info?.short ?? "Someone";
    const db = nudge(p, "b", d.bond ?? 0);
    const dr = nudge(p, "r", d.respect ?? 0);
    const dg = nudge(p, "g", d.grudge ?? 0);
    if (db) changes.push({ kind: "person", label: `${nm} bond`, delta: db });
    if (dr) changes.push({ kind: "person", label: `${nm} respect`, delta: dr });
    if (dg) changes.push({ kind: "person", label: `${nm} grudge`, delta: dg });
    const tm = moveTeamFromPerson(life, id, db);
    teamFromPeople += tm.team;
    if (tm.fellOut) changes.push({ kind: "team-rule", label: `You and ${nm} have fallen out. The dressing room takes sides.` });
    if (tm.madeUp) changes.push({ kind: "team-rule", label: `You and ${nm} are good again.` });
  }
  for (const r of outcome.remember ?? []) {
    if (r.slot === "squad") { life.squad = remember(life.squad, r.tag, now, r.strength); changes.push({ kind: "memory", label: `The squad will remember: ${tagWords(r.tag)}` }); continue; }
    if (r.slot === "you") { life.self = remember(life.self, r.tag, now, r.strength); changes.push({ kind: "memory", label: `Word gets around: ${tagWords(r.tag)}` }); continue; }
    const id = live.cast[r.slot];
    if (!id || id.startsWith("oneoff:")) continue;
    const p = meet(life, id, now);
    p.m = remember(p.m, r.tag, now, r.strength);
    changes.push({ kind: "memory", label: `${personInfo(c0, id)?.short ?? "Someone"} will remember: ${tagWords(r.tag)}` });
  }
  if (outcome.followUp) {
    const [a, b] = outcome.followUp.afterWeeks;
    const due = now + a + Math.floor(opts.rng() * (b - a + 1));
    life.pending = [...life.pending.filter((p) => p.event !== outcome.followUp!.event), { event: outcome.followUp.event, due, cast: live.cast, ...(outcome.followUp.if ? { if: outcome.followUp.if } : {}) }].slice(-20);
  }

  // The bars and things.
  const fx: LifeEffects = outcome.effects ?? {};
  const team = (fx.team ?? 0) + teamFromPeople;
  const de: DilemmaEffect = {
    boss: fx.boss, team: team || undefined, fans: fx.fans, fame: fx.fame, reputation: fx.reputation,
    scandal: fx.scandal, matchFitness: fx.matchFitness,
    money: fx.moneyWeeks ? Math.round(fx.moneyWeeks * week) : undefined,
  };
  const before = c;
  c = applyEffects(c, de);
  for (const k of ["boss", "team", "fans"] as const) {
    const d = c.relationships[k] - before.relationships[k];
    if (d) changes.push({ kind: "bar", label: k === "boss" ? "Boss" : k === "team" ? "Team" : "Fans", delta: d });
  }
  if (c.fame !== before.fame) changes.push({ kind: "bar", label: "Fame", delta: c.fame - before.fame });
  if (c.reputation !== before.reputation) changes.push({ kind: "bar", label: "Reputation", delta: c.reputation - before.reputation });
  if (c.money !== before.money) { const d = c.money - before.money; changes.push({ kind: "money", label: `${d > 0 ? "+" : "−"}${formatMoney(Math.abs(d))}`, delta: d }); }
  if (fx.scandal) changes.push({ kind: "bar", label: "A scandal this season" });
  if (fx.energy) { const e = clampInt(c.energy + fx.energy, 0, 100); changes.push({ kind: "energy", label: "Energy", delta: e - c.energy }); c = { ...c, energy: e }; }
  if (fx.take === "car") {
    const cars = (c.ownedItems ?? []).filter((i) => i.category === "vehicle").sort((a, b) => (b.level ?? 1) - (a.level ?? 1));
    if (cars[0]) { c = { ...c, ownedItems: c.ownedItems.filter((i) => i !== cars[0]) }; changes.push({ kind: "item", label: `Your ${cars[0].name} is gone` }); }
  }
  if (fx.kibCans) {
    const k = { ...c.kibCans };
    for (const [id, n] of Object.entries(fx.kibCans)) k[id as keyof typeof k] = (k[id as keyof typeof k] ?? 0) + (n ?? 0);
    c = { ...c, kibCans: k };
    changes.push({ kind: "item", label: "KIB cans" });
  }
  if (fx.flag && !life.flags.includes(fx.flag)) life.flags = [...life.flags, fx.flag].slice(-12);
  c = { ...c, happiness: happinessOf(c), life };

  const text = fillLine(outcome.text, c0, live.cast, ctx);
  life.log = [...life.log, { w: now, e: live.id, c: ch.id, t: text.slice(0, 140) }].slice(-12);
  return { career: c, text, changes, outcome, minigame: mini };
}
