/**
 * THE CHECKER — rejects weightless or broken events (living world, design 1.2
 * and 5.2). No AI, runs in a blink. tests/star/lifeEvents.mts runs it on the
 * whole book and on deliberately broken events, so a bad event cannot ship.
 *
 * Weight rules (Harry: "they can't just happen for the sake of it"):
 *  1. A reason to fire: the trigger reads the career (or it is a follow-up / a
 *     social action you chose).
 *  2. A named person or a named thing of yours.
 *  3. Every choice changes something you can see; at least one writes a memory.
 *  4. It comes back: a callback or a follow-up.
 *  5. Something to lose: at least one choice risks something.
 *  6. Sized honestly: small ±3 on a bar, medium ±8, big ±12, and a big event
 *     has something big in it.
 * Plus the structure: known moments, conditions, cast rules, placeholders,
 * slots, follow-up events, memory tags, chances adding up, phone-length lines,
 * no real brands, no near-copies, no "always pick this" choice.
 */
import type { CastSlot, LifeChat, LifeChoice, LifeEvent, LifeOutcome } from "./types";
import { LIFE_MOMENTS } from "./types";
import { parseCond, parsePersonCond, slotsIn, tagsIn } from "./cond";
import { PLACEHOLDER_KEYS, YOU_KEYS } from "./text";

const PICKS: CastSlot["pick"][] = ["squad", "manager", "agent", "dad", "mum", "brother", "physio", "kitman", "tabloid", "broadsheet", "stranger", "social", "memory", "carried"];
const ORDERS = ["bond-desc", "bond-asc", "grudge-desc", "random", "youngest", "best"];
const TEMPLATES = ["phone-call", "text-thread", "feed-post", "talk-scene"];
const SIZES = ["small", "medium", "big"];
const BAND: Record<string, number> = { small: 3, medium: 8, big: 12 };
const BARS = ["boss", "team", "fans", "fame", "reputation"] as const;
/** Lines must fit a phone card. */
export const MAX_LINE = 240;
/** Real brands, clubs' sponsors and people never appear (design 5.2). */
const REAL_NAMES = ["nike", "adidas", "puma", "umbro", "new balance", "under armour", "red bull", "coca-cola", "pepsi", "gatorade", "rolex", "ferrari", "lamborghini", "bentley", "porsche", "the sun", "daily mail", "the times", "guardian", "sky sports", "bbc", "ronaldo", "messi", "beckham", "rooney", "kane", "haaland", "bet365", "william hill", "ladbrokes", "paddy power"];
const LATER_HOOKS = /^(match:|negotiation|media-feed|summer-window|casino:|seasons-later|event:retirement)/;

export interface BookProblem { id: string; problem: string }

const barsOf = (o: LifeOutcome) => BARS.map((k) => o.effects?.[k] ?? 0);

/** Something you can see changes in this outcome. */
function visible(o: LifeOutcome): boolean {
  const e = o.effects ?? {};
  return BARS.some((k) => (e[k] ?? 0) !== 0) || !!e.moneyWeeks || !!e.energy || !!e.matchFitness || !!e.scandal || !!e.take || !!e.kibCans || !!e.flag
    || (o.npc ?? []).some((d) => d.bond || d.respect || d.grudge) || (o.remember ?? []).length > 0;
}

/** Something bad can happen in this outcome. */
function hurts(o: LifeOutcome): boolean {
  const e = o.effects ?? {};
  return BARS.some((k) => (e[k] ?? 0) < 0) || (e.moneyWeeks ?? 0) < 0 || (e.energy ?? 0) < 0 || (e.matchFitness ?? 0) < 0 || !!e.scandal || !!e.take
    || (o.npc ?? []).some((d) => (d.bond ?? 0) < 0 || (d.respect ?? 0) < 0 || (d.grudge ?? 0) > 0);
}

function choiceRisks(ch: LifeChoice): boolean {
  return !!ch.cost?.moneyWeeks || !!ch.cost?.energy || ch.outcomes.some(hurts);
}

/** A rough score of a choice, used for the "always pick this" test. */
function score(o: LifeOutcome): number[] {
  const e = o.effects ?? {};
  const npc = (o.npc ?? []).reduce((a, d) => a + (d.bond ?? 0) + (d.respect ?? 0) - (d.grudge ?? 0), 0);
  return [...BARS.map((k) => e[k] ?? 0), e.moneyWeeks ?? 0, e.energy ?? 0, e.matchFitness ?? 0, npc, e.scandal ? -10 : 0, e.take ? -10 : 0];
}
function dominates(a: LifeChoice, b: LifeChoice): boolean {
  if (a.cost || a.requires?.length || a.minigame || a.outcomes.length !== 1 || b.outcomes.length !== 1) return false;
  const sa = score(a.outcomes[0]), sb = score(b.outcomes[0]);
  if (b.cost?.moneyWeeks) sb[5] -= b.cost.moneyWeeks;
  return sa.every((x, i) => x >= sb[i]) && sa.some((x, i) => x > sb[i]);
}

function triples(s: string): Set<string> {
  const w = s.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

function linesOf(e: LifeEvent): string[] {
  return [...e.setup, ...e.choices.flatMap((c) => [c.label, ...c.outcomes.map((o) => o.text)]), ...e.callbacks.map((c) => c.line)];
}

export function validateEvent(e: LifeEvent, ids: Set<string>, writtenTags: Set<string>): string[] {
  const out: string[] = [];
  const bad = (p: string) => out.push(p);
  if (!/^[a-z0-9-]+$/.test(e.id ?? "")) bad("id must be lower-case words with dashes");
  if (!e.title) bad("no title");
  if (!SIZES.includes(e.size)) bad(`unknown size "${e.size}"`);
  if (!TEMPLATES.includes(e.template)) bad(`unknown template "${e.template}"`);
  if (!e.trigger?.when?.length) bad("trigger has no moment");
  for (const w of e.trigger?.when ?? []) if (!LIFE_MOMENTS.includes(w)) bad(`unknown moment "${w}"`);
  const slots = new Set((e.cast ?? []).map((s) => s.slot));
  const specialSlots = new Set(["you", "squad"]);

  // Cast.
  for (const s of e.cast ?? []) {
    if (!/^[a-z]+$/.test(s.slot)) bad(`slot "${s.slot}" must be one lower-case word`);
    if (!PICKS.includes(s.pick)) bad(`slot ${s.slot}: unknown cast rule "${s.pick}"`);
    if (s.order && !ORDERS.includes(s.order)) bad(`slot ${s.slot}: unknown order "${s.order}"`);
    for (const w of s.where ?? []) { const p = parsePersonCond(w); if (typeof p === "string") bad(`slot ${s.slot}: ${p}`); }
    if (s.pick === "memory" && !s.tags?.length) bad(`slot ${s.slot}: a memory pick needs tags`);
    for (const t of s.tags ?? []) if (!writtenTags.has(t)) bad(`slot ${s.slot}: no event writes the memory "${t}"`);
  }
  const followUpOnly = e.trigger?.when?.length === 1 && e.trigger.when[0] === "followUp";
  if (followUpOnly && e.cast.every((s) => s.pick === "squad" || s.pick === "social")) bad("a follow-up must carry its people (carried, memory or a role)");

  // Conditions.
  const conds = [...(e.trigger?.requires ?? []), ...e.choices.flatMap((c) => [...(c.requires ?? []), ...c.outcomes.map((o) => o.if ?? "").filter(Boolean), ...c.outcomes.map((o) => o.followUp?.if ?? "").filter(Boolean)])];
  for (const c of conds) {
    const p = parseCond(c);
    if (typeof p === "string") { bad(p); continue; }
    for (const s of slotsIn(c)) if (!slots.has(s) && !specialSlots.has(s)) bad(`condition "${c}" names slot "${s}" that the cast does not fill`);
    for (const t of tagsIn(c)) if (!writtenTags.has(t)) bad(`condition "${c}" reads the memory "${t}" that no event writes`);
  }
  for (const line of linesOf(e)) {
    for (const m of Array.from(line.matchAll(/\{if ([^}]+)\}/g))) {
      const k = m[1].trim();
      if (/^[a-z]+$/.test(k)) { if (!slots.has(k)) bad(`{if ${k}} names a slot the cast does not fill`); }
      else { const p = parseCond(k); if (typeof p === "string") bad(`{if ${k}}: ${p}`); }
    }
    for (const m of Array.from(line.matchAll(/\{([a-z]+)\.([a-z]+)\}/g))) {
      const [, slot, key] = m;
      if (slot === "you") { if (!(YOU_KEYS as readonly string[]).includes(key)) bad(`{you.${key}} is not a thing the game knows`); }
      else if (!slots.has(slot)) bad(`{${slot}.${key}} names a slot the cast does not fill`);
      else if (!(PLACEHOLDER_KEYS as readonly string[]).includes(key)) bad(`{${slot}.${key}} is not a thing the game knows`);
    }
    if (line.length > MAX_LINE) bad(`a line is too long for the phone (${line.length} > ${MAX_LINE})`);
    const low = line.toLowerCase();
    for (const n of REAL_NAMES) if (new RegExp(`\\b${n}\\b`).test(low)) bad(`uses a real name or brand: "${n}"`);
  }

  // Choices and outcomes.
  if (!e.choices?.length) bad("no choices");
  for (const ch of e.choices ?? []) {
    if (!ch.outcomes?.length) { bad(`choice ${ch.id}: no outcomes`); continue; }
    const chances = ch.outcomes.filter((o) => typeof o.chance === "number");
    const plain = ch.outcomes.filter((o) => typeof o.chance !== "number" && !o.if);
    const gated = chances.some((o) => o.if);
    if (chances.length && !gated) {
      const sum = chances.reduce((a, o) => a + (o.chance ?? 0), 0);
      if (Math.abs(sum - 1) > 0.001 && !plain.length) bad(`choice ${ch.id}: chances add up to ${sum.toFixed(2)}, not 1`);
    }
    if (!chances.length && ch.outcomes.every((o) => o.if) && !ch.minigame) bad(`choice ${ch.id}: every outcome has a condition and none is the fallback`);
    if (ch.minigame && !ch.outcomes.some((o) => o.if === "minigame.won") ) bad(`choice ${ch.id}: a minigame needs a minigame.won outcome`);
    if (ch.minigame && !ch.outcomes.some((o) => o.if === "minigame.lost")) bad(`choice ${ch.id}: a minigame needs a minigame.lost outcome`);
    if (!ch.outcomes.some(visible) && !ch.cost) bad(`choice ${ch.id}: changes nothing you can see (rule 3)`);
    for (const o of ch.outcomes) {
      if (!o.text) bad(`choice ${ch.id}: an outcome has no text`);
      for (const d of o.npc ?? []) if (!slots.has(d.slot)) bad(`choice ${ch.id}: npc slot "${d.slot}" is not in the cast`);
      for (const r of o.remember ?? []) {
        if (!slots.has(r.slot) && !specialSlots.has(r.slot)) bad(`choice ${ch.id}: memory slot "${r.slot}" is not in the cast`);
        if (![1, 2, 3].includes(r.strength)) bad(`choice ${ch.id}: memory strength must be 1, 2 or 3`);
        if (!/^[a-z0-9-]+$/.test(r.tag)) bad(`choice ${ch.id}: memory tag "${r.tag}" must be lower-case words with dashes`);
      }
      if (o.followUp) {
        if (!ids.has(o.followUp.event)) bad(`choice ${ch.id}: follow-up "${o.followUp.event}" is not in the book`);
        const [a, b] = o.followUp.afterWeeks ?? [];
        if (!(a >= 1 && b >= a)) bad(`choice ${ch.id}: follow-up weeks must be [at least 1, not less than the first]`);
      }
      // Rule 6: sized honestly.
      const max = Math.max(...barsOf(o).map(Math.abs));
      if (max > BAND[e.size]) bad(`choice ${ch.id}: a bar moves ${max}, too much for a ${e.size} event (max ${BAND[e.size]})`);
    }
  }
  // Rule 1: a reason to fire.
  const chosen = followUpOnly || (e.trigger?.when ?? []).some((w) => w.startsWith("social:"));
  if (!chosen && !(e.trigger?.requires ?? []).length) bad("no reason to fire: the trigger must read the career (rule 1)");
  // Rule 2: a named person or a thing of yours.
  const named = (e.cast ?? []).some((s) => s.pick !== "stranger") || (e.trigger?.requires ?? []).some((r) => r.startsWith("owns:")) || (e.trigger?.requires ?? []).some((r) => r.startsWith("mem(you"));
  if (!named) bad("no named person and nothing of yours (rule 2)");
  // Rule 3: at least one choice writes a memory.
  if (!(e.choices ?? []).some((c) => c.outcomes.some((o) => (o.remember ?? []).length))) bad("no choice writes a memory (rule 3)");
  // Rule 4: it comes back.
  const comesBack = (e.callbacks ?? []).length > 0 || (e.choices ?? []).some((c) => c.outcomes.some((o) => o.followUp));
  if (!comesBack) bad("nothing comes back: needs a callback or a follow-up (rule 4)");
  for (const cb of e.callbacks ?? []) {
    const [holder, tag] = (cb.ifMemory ?? "").split(":");
    if (!holder || !tag) { bad(`callback "${cb.ifMemory}" must be "slot:tag"`); continue; }
    if (!writtenTags.has(tag)) bad(`callback reads the memory "${tag}" that no event writes`);
    const w = cb.where ?? "";
    if (!(w.startsWith("event:") || w === "social:chat" || w === "social:any" || LATER_HOOKS.test(w))) bad(`callback where "${w}" is not a place the game knows`);
    if (w.startsWith("event:") && !LATER_HOOKS.test(w)) for (const x of w.slice(6).split("|").map((s) => s.replace(/^event:/, ""))) {
      if (x !== "any" && !x.endsWith("*") && !x.startsWith("category:") && !ids.has(x)) bad(`callback names event "${x}" that is not in the book`);
    }
  }
  // Rule 5: something to lose.
  if (!(e.choices ?? []).some(choiceRisks)) bad("every choice is a gift: something must be at risk (rule 5)");
  // Rule 6: a big event has something big in it.
  if (e.size === "big") {
    const big = e.choices.some((c) => c.outcomes.some((o) => Math.max(...barsOf(o).map(Math.abs)) >= 8 || o.effects?.scandal || o.effects?.take || Math.abs(o.effects?.moneyWeeks ?? 0) >= 3 || (o.npc ?? []).some((d) => Math.abs(d.grudge ?? 0) >= 20 || Math.abs(d.bond ?? 0) >= 20)));
    if (!big) bad("a big event has nothing big in it (rule 6)");
  }
  // The "always pick this" test.
  for (const a of e.choices ?? []) {
    const rest = e.choices.filter((b) => b !== a);
    if (rest.length && rest.every((b) => dominates(a, b))) bad(`choice ${a.id} beats every other choice on every number: no real choice`);
  }
  return out;
}

/** Check the whole book. */
export function validateBook(events: LifeEvent[], chats: LifeChat[] = []): BookProblem[] {
  const problems: BookProblem[] = [];
  const ids = new Set<string>();
  for (const e of events) {
    if (ids.has(e.id)) problems.push({ id: e.id, problem: "the same id twice" });
    ids.add(e.id);
  }
  const written = new Set<string>();
  for (const e of events) for (const c of e.choices ?? []) for (const o of c.outcomes ?? []) for (const r of o.remember ?? []) written.add(r.tag);
  for (const e of events) for (const p of validateEvent(e, ids, written)) problems.push({ id: e.id, problem: p });
  // Near-copies: same place and cast rules, and most of the words shared.
  for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) {
    const a = events[i], b = events[j];
    if (a.place !== b.place) continue;
    const ta = triples(linesOf(a).join(" ")), tb = triples(linesOf(b).join(" "));
    let shared = 0;
    ta.forEach((t) => { if (tb.has(t)) shared++; });
    const share = shared / Math.max(1, Math.min(ta.size, tb.size));
    if (share > 0.6) problems.push({ id: b.id, problem: `reads like a copy of ${a.id} (${Math.round(share * 100)}% shared)` });
  }
  for (const ch of chats) {
    for (const w of ch.where ?? []) { const p = parsePersonCond(w); if (typeof p === "string") problems.push({ id: ch.id, problem: p }); }
    for (const w of ch.when ?? []) { const p = parseCond(w); if (typeof p === "string") problems.push({ id: ch.id, problem: p }); }
    if (!ch.lines?.length) problems.push({ id: ch.id, problem: "a chat with no lines" });
  }
  return problems;
}
