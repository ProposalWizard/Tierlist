/**
 * PROMISES — Events v2 part 2e. A promise is made only by a reply the player
 * picks, sits in the phone with what, who and when from the day it is made
 * (Football Manager's lesson: never a surprise), and ends kept or broken.
 *
 *  - Kept: its `kept` outcome plays (a memory, his numbers) and a notice says so.
 *  - Broken: by its date passing, or by the ending that breaks it (the empty
 *    chair). Its `broken` outcome plays.
 *  - At most 6 open at once; the last 20 kept or broken are kept for the list.
 */
import type { CareerState } from "../types";
import type { ArcOutcome, ArcPromiseDef, LifeEvent, PromiseRun } from "./types";
import { arcById } from "./arcBook";
import { runIn } from "./arcPack";
import { cloneLife, lifeOf, type LiveEvent } from "./director";
import { chooseOption, type LifeChange } from "./resolve";
import { ctxFor, factsOf } from "./facts";
import { lifeWeek } from "./people";
import { fillLine } from "./text";

export const MAX_OPEN_PROMISES = 6;
const KEEP_CLOSED = 20;

export const promiseDef = (arcId: string, id: string): ArcPromiseDef | undefined => arcById(arcId)?.promises[id];
export const openPromises = (c: CareerState): PromiseRun[] => (lifeOf(c).promises ?? []).filter((p) => p.st === "open");
export const promiseCount = (c: CareerState): number => openPromises(c).length;

/** Make a promise (a reply or an ending made it). Null when it is already
 *  made, or six are open ("You have a lot on"). */
export function makePromise(c: CareerState, arcId: string, id: string, cast: Record<string, string>): { career: CareerState; promise: PromiseRun } | null {
  const def = promiseDef(arcId, id);
  if (!def) return null;
  const life = cloneLife(lifeOf(c));
  const list = life.promises ?? [];
  if (list.some((p) => p.id === id && p.arc === arcId && p.st === "open")) return null;
  if (list.filter((p) => p.st === "open").length >= MAX_OPEN_PROMISES) return null;
  const now = lifeWeek(c);
  const ctx = ctxFor(c, life, cast, factsOf(c));
  const p: PromiseRun = {
    id, arc: arcId, to: cast[def.to] ?? def.to, text: fillLine(def.text, c, cast, ctx), made: now,
    due: def.due.weeks ? now + def.due.weeks[1] : -1, st: "open",
  };
  life.promises = [...list, p];
  return { career: { ...c, life }, promise: p };
}

/** Play a kept or broken outcome on the promise's people. */
function play(c: CareerState, arcId: string, o: ArcOutcome | undefined, rng: () => number): { career: CareerState; text: string; changes: LifeChange[] } {
  if (!o || (!o.npc?.length && !o.remember?.length && !o.effects)) return { career: c, text: o?.text ?? "", changes: [] };
  const cast = runIn(lifeOf(c), arcId)?.cast ?? {};
  const live: LiveEvent = {
    id: `${arcId}-promise`, event: { id: `${arcId}-promise`, title: "", category: "promise", place: "home", size: "small", rarity: "follow-up", template: "text-thread", trigger: { when: ["followUp"] }, cast: [], setup: [], choices: [], callbacks: [] } as LifeEvent,
    moment: "followUp", cast, lines: [], callbacks: [], followUp: true, social: false,
    choices: [{ id: "p", label: "", costText: [], locked: null, choice: { id: "p", label: "", outcomes: [{ ...o, text: o.text ?? "" }] } }],
  };
  const r = chooseOption(c, live, "p", { rng, forceOutcome: 0 });
  return r ? { career: r.career, text: r.text, changes: r.changes } : { career: c, text: o.text, changes: [] };
}

function close(c: CareerState, arcId: string, id: string, st: "kept" | "broken"): CareerState {
  const life = cloneLife(lifeOf(c));
  const now = lifeWeek(c);
  let done = false;
  life.promises = (life.promises ?? []).map((p) => (!done && p.id === id && p.arc === arcId && p.st === "open" ? ((done = true), { ...p, st, end: now }) : p));
  const open = life.promises.filter((p) => p.st === "open");
  const closed = life.promises.filter((p) => p.st !== "open").slice(-KEEP_CLOSED);
  life.promises = [...open, ...closed];
  return { ...c, life };
}

export function keepPromise(c: CareerState, arcId: string, id: string, rng: () => number) {
  const r = play(close(c, arcId, id, "kept"), arcId, promiseDef(arcId, id)?.kept, rng);
  return r;
}

/** `quiet`: the ending that broke it already says what happened (no second outcome). */
export function breakPromise(c: CareerState, arcId: string, id: string, rng: () => number, quiet = false) {
  const closed = close(c, arcId, id, "broken");
  if (quiet) return { career: closed, text: "", changes: [] as LifeChange[] };
  return play(closed, arcId, promiseDef(arcId, id)?.broken, rng);
}

/** The phone list: open first (soonest due), then the last kept or broken. */
export function promiseList(c: CareerState): (PromiseRun & { dueText: string; weeksLeft: number | null })[] {
  const now = lifeWeek(c);
  const all = (lifeOf(c).promises ?? []).map((p) => ({ ...p, dueText: promiseDef(p.arc, p.id)?.dueText ?? "", weeksLeft: p.due >= 0 ? p.due - now : null }));
  const open = all.filter((p) => p.st === "open").sort((a, b) => (a.weeksLeft ?? 999) - (b.weeksLeft ?? 999));
  const shut = all.filter((p) => p.st !== "open").sort((a, b) => (b.end ?? 0) - (a.end ?? 0));
  return [...open, ...shut];
}
