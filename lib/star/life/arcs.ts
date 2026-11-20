/**
 * ARCS — Events v2's named stories of 3 to 8 beats that run for weeks or
 * seasons (docs/plans/living-world-events-v2-2026-11-20.md, part 2c). Pure, no React.
 *
 *  - A story lives in `career.life.arcs[id]` (ArcRun): its cast, a few values
 *    (your best, the path you took), its clocks, the weeks each beat played
 *    and the beats an ending scheduled. About 0.5 KB.
 *  - `arcMoment` is called at each moment (after a match, arriving at
 *    training, season end …). It expires a "today only" offer (its
 *    ifIgnored ending plays), breaks promises past their date, sends a
 *    reminder, counts a match objective, ticks the clocks at season end, and
 *    returns the beats that want a screen now plus any new offer bubble.
 *  - A beat's talk is played by talk.ts; its ending lands here (`playEnding`):
 *    the v1 outcome (bars, people, memories) through resolve.ts, then the
 *    story's own parts (arc values, next beat, promises, objectives, what you get).
 *  - `questLog` and `bubblesFor` are what the phone and the round menu show:
 *    what is open, what is promised, what comes next (the Zelda lesson).
 */
import type { CareerState } from "../types";
import type { ArcBeat, ArcEvent, ArcNotice, ArcOutcome, ArcRun, ArcVar, LifeArc, LifeChoice, LifeEvent, LifeMoment, LifeState, ObjectiveRun, TalkReply } from "./types";
import { ARCS, arcById, beatOf, mainCount } from "./arcBook";
import { allHold, holds, type CondCtx, type V2Ctx } from "./cond";
import { ctxFor, factsOf, type FactOverride } from "./facts";
import { castEvent, cloneLife, lifeOf, type LiveEvent } from "./director";
import { chooseOption, pickOutcome, type ChoiceResult, type LifeChange } from "./resolve";
import { lifeWeek, personInfo, remember } from "./people";
import { fillLine } from "./text";
import { breakPromise, keepPromise, makePromise, openPromises, promiseDef } from "./promises";

/** lifeWeek counts 50 weeks to a season. */
export const LIFE_SEASON = 50;
/** At most this many stories open at once (the soak checks it). */
export const MAX_OPEN_ARCS = 12;
export const MAX_OBJECTIVES = 2;

// ── The talk on screen (talk.ts moves it; kept out of the save) ─────────────

export interface ActivityResult {
  /** Balls in the corners (0-10), or bar hits, or his corners. */
  score: number;
  /** score × 10: Den counts in tens. */
  tens: number;
  won: boolean;
  abandoned: boolean;
  oppScore?: number;
  /** Played by the dice (a device that cannot run the mode, or a skipped week). */
  byDice?: boolean;
}

export interface BeatLive {
  arc: string;
  beat: string;
  /** The beat's event with its variant applied (the old club's landline). */
  event: ArcEvent;
  cast: Record<string, string>;
  stage: "invite" | "talk" | "card";
  node: string;
  /** The talk's running mood and the notes it keeps ("snapped"). */
  mood: number;
  said: string[];
  /** Arc values a reply set, kept on the arc when the talk ends. */
  tv: Record<string, ArcVar>;
  /** Promises a reply made, kept on the arc when the talk ends. */
  made: string[];
  round: number;
  /** The talk reached its game (keeps a "be there Thursday" promise). */
  played?: boolean;
  activity?: ActivityResult;
  lastReply?: TalkReply;
  /** The line under the story strip: "You asked · he's being straight". */
  note?: string;
  /** "Next morning", "One season later". */
  when: string;
  opened: number;
}

// ── Reading the story ──────────────────────────────────────────────────────

export function arcsOf(c: CareerState): Record<string, ArcRun> {
  return lifeOf(c).arcs ?? {};
}

/** The condition context for a story: the career, the arc's values (with
 *  what this talk has set so far), the talk, the game just played. */
export function arcCtx(c: CareerState, arcId: string, b?: BeatLive | null, facts?: FactOverride): CondCtx {
  const life = lifeOf(c);
  const run = life.arcs?.[arcId];
  const cast = b?.cast ?? run?.cast ?? {};
  return ctxFor(c, life, cast, factsOf(c, facts), { v2: v2Of(c, life, run, b) });
}

export function v2Of(c: CareerState, life: LifeState, run: ArcRun | undefined, b?: BeatLive | null): V2Ctx {
  return {
    arc: run ? { v: { ...run.v, ...(b?.tv ?? {}) }, k: run.k, club: run.club } : undefined,
    talk: b ? { mood: b.mood, said: b.said } : undefined,
    activity: b?.activity,
    promise: (id) => (life.promises ?? []).some((p) => p.id === id && p.st !== "broken") || !!b?.made.includes(id),
    club: c.player.club,
  };
}

/** A small seeded number for "after 1 to 3 weeks", so the same career always gets the same answer. */
function pickIn(range: [number, number], key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return range[0] + (h % (range[1] - range[0] + 1));
}

/** The week a beat can play from, or null when it is not open yet. */
export function beatFrom(arc: LifeArc, run: ArcRun, beat: ArcBeat): number | null {
  if (beat.id in run.s) return run.s[beat.id];
  const a = beat.after;
  if (!a) return run.at;
  if (a.objective) return null;
  if (a.clock) {
    const cl = arc.clocks.find((x) => x.id === a.clock);
    return cl && (run.k[cl.id] ?? -1) >= cl.segments ? run.at : null;
  }
  if (a.beat) {
    const base = run.f[a.beat]?.[0];
    if (base === undefined) return null;
    const gap = a.weeks ? pickIn(a.weeks, `${arc.id}|${beat.id}|${run.at}`) : a.seasons ? pickIn(a.seasons, `${arc.id}|${beat.id}|${run.at}`) * LIFE_SEASON : 0;
    return base + gap;
  }
  return run.at;
}

/** Can this beat play now? `moment` null = any moment (the round menu's standing bubble). */
export function beatOpen(c: CareerState, arc: LifeArc, run: ArcRun, beat: ArcBeat, moment: LifeMoment | null, facts?: FactOverride): boolean {
  const now = lifeWeek(c);
  // After the story ends only a beat it scheduled can still play (the letter after the empty chair).
  if (run.done && !(beat.id in run.s)) return false;
  const fired = run.f[beat.id] ?? [];
  if (beat.repeat) {
    if (fired.length >= beat.repeat.max) return false;
    if (fired.length && now - fired[fired.length - 1] < beat.repeat.everyWeeks) return false;
  } else if (fired.length) return false;
  const from = beatFrom(arc, run, beat);
  if (from === null || now < from) return false;
  const t = beat.event.trigger;
  if (moment && !(t.when.includes(moment) || t.when.includes("followUp"))) return false;
  const ctx = arcCtx(c, arc.id, null, facts);
  // A beat that brings in somebody new (the kid, years on) needs him to exist.
  if (!castFor(c, arc, run, beat)) return false;
  return allHold(beat.requires, ctx) && allHold(t.requires, ctx);
}

/** The beat's people: the story's own, plus anyone it brings in (bound once, then kept). */
function castFor(c: CareerState, arc: LifeArc, run: ArcRun, beat: ArcBeat): Record<string, string> | null {
  const life = lifeOf(c);
  const need = beat.event.cast.filter((s) => !(s.slot in run.cast) || (run.cast[s.slot] === "" && !s.optional));
  if (!need.length) return run.cast;
  const extra = castEvent(c, life, { ...(beat.event as unknown as LifeEvent), cast: need.map((s) => (s.pick === "carried" ? { ...s, pick: "memory", tags: [] } : s)) }, { rng: () => 0.5 }, null, lifeWeek(c));
  if (!extra) return null;
  return { ...run.cast, ...extra };
}

function applyVariant(c: CareerState, arcId: string, e: ArcEvent): ArcEvent {
  const v = (e.variants ?? []).find((x) => holds(x.if, arcCtx(c, arcId)));
  if (!v) return e;
  return { ...e, template: v.template ?? e.template, place: v.place ?? e.place, setup: v.setupSwap ? [v.setupSwap, ...e.setup.slice(1)] : e.setup };
}

/** "Next morning", "Two weeks later", "One season later", counted from the story's start. */
export function whenWords(c: CareerState, run: ArcRun, beat: ArcBeat, first: boolean): string {
  if (beat.look?.chip) return beat.look.chip;
  if (first) return "";
  const gap = lifeWeek(c) - run.at;
  const N = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
  if (gap <= 0) return "Next morning";
  if (gap < LIFE_SEASON - 4) return gap === 1 ? "A week later" : `${N[gap] ?? gap} weeks later`;
  const s = Math.max(1, Math.round(gap / LIFE_SEASON));
  const w = `${N[s] ?? s} season${s === 1 ? "" : "s"} later`;
  return s >= 5 ? `${w} · you are ${c.player.age}` : w;
}

// ── Opening a beat ─────────────────────────────────────────────────────────

/** Start a beat on screen: it is marked played, its clock starts, an offer is used up. */
export function openBeat(c: CareerState, arcId: string, beatId: string): { career: CareerState; live: BeatLive } | null {
  const arc = arcById(arcId);
  const beat = arc && beatOf(arc, beatId);
  const life = cloneLife(lifeOf(c));
  const run = life.arcs?.[arcId];
  if (!arc || !beat || !run) return null;
  const cast = castFor(c, arc, run, beat);
  if (!cast) return null;
  const now = lifeWeek(c);
  const first = beat.id === arc.beats[0].id;
  const when = whenWords(c, run, beat, first);
  run.cast = cast;
  run.f[beat.id] = [...(run.f[beat.id] ?? []), now].slice(-12);
  delete run.s[beat.id];
  run.last = beat.id;
  if (run.o?.[0] === beat.id) delete run.o;
  for (const cl of arc.clocks) if (cl.startsAt === beat.id && run.k[cl.id] === undefined) run.k[cl.id] = 0;
  const career: CareerState = { ...c, life };
  const event = applyVariant(career, arcId, beat.event);
  const stage: BeatLive["stage"] = event.entry?.kind === "invite" ? "invite" : event.talk ? "talk" : "card";
  const live: BeatLive = { arc: arcId, beat: beatId, event, cast, stage, node: "", mood: 0, said: [], tv: {}, made: [], round: 1, when, opened: now };
  if (event.talk) live.node = startNode(career, live);
  return { career, live };
}

export function startNode(c: CareerState, b: BeatLive): string {
  const st = b.event.talk!.start;
  if (typeof st === "string") return st;
  return holds(st.if, arcCtx(c, b.arc, b)) ? st.then : st.else;
}

/** Make a new story's record (its people are cast once, here). */
function startRun(c: CareerState, life: LifeState, arc: LifeArc, beat: ArcBeat): ArcRun | null {
  const slots = arc.cast.filter((s) => !(s as { bindAt?: string }).bindAt);
  const cast = castEvent(c, life, { ...(beat.event as unknown as LifeEvent), cast: slots }, { rng: () => 0.5 }, null, lifeWeek(c));
  if (!cast) return null;
  return { at: lifeWeek(c), club: c.player.club, cast, v: { ...arc.vars }, k: {}, f: {}, s: {} };
}

// ── The moments ────────────────────────────────────────────────────────────

export interface ArcPick { arc: string; beat: string }
export interface MomentResult { career: CareerState; screens: ArcPick[]; offers: { arc: string; beat: string; person: string }[]; notices: ArcNotice[] }

export interface MomentOpts { rng: () => number; facts?: FactOverride; /** Test page: start this arc even if its first beat's trigger says no. */ force?: string }

/**
 * A moment in the week. Ticks the stories along and says what wants a
 * screen. Call it before the v1 director: a due beat goes first.
 */
export function arcMoment(c0: CareerState, moment: LifeMoment, opts: MomentOpts): MomentResult {
  const notices: ArcNotice[] = [];
  let c = c0;
  const now = lifeWeek(c);

  // 1. An offer nobody took: its ifIgnored ending plays (you went in with the others).
  c = expireOffers(c, (n) => notices.push(n), opts.rng, false);
  // 2. Promises: a reminder a week out, broken once the date is gone.
  c = promiseClock(c, (n) => notices.push(n), opts.rng);
  let life = cloneLife(lifeOf(c));
  // 3. A match objective (after a match): met, or one match fewer to do it in.
  if (moment === "after-match" && life.objs?.length) {
    const keep: ObjectiveRun[] = [];
    for (const o of life.objs) {
      const run = life.arcs?.[o.arc];
      const ctx = ctxFor(c, life, run?.cast ?? {}, factsOf(c, opts.facts), { v2: v2Of(c, life, run) });
      if (holds(o.met, ctx)) { if (run) run.s[o.onMet] = now; notices.push({ kind: "objective", arc: o.arc, title: "Objective met", text: o.text, w: now }); continue; }
      const left = o.left - 1;
      if (left <= 0) { if (run) run.s[o.onMiss] = now; notices.push({ kind: "objective", arc: o.arc, title: "Objective missed", text: o.text, w: now }); continue; }
      keep.push({ ...o, left });
    }
    life.objs = keep;
  }
  // 4. Season end: the clocks move.
  if (moment === "season-end") {
    for (const [id, run] of Object.entries(life.arcs ?? {})) {
      const arc = arcById(id);
      if (!arc || run.done) continue;
      for (const cl of arc.clocks) {
        if (run.k[cl.id] === undefined) continue;
        for (const t of cl.tick) if (t.on === "season-end") run.k[cl.id] = Math.min(cl.segments, run.k[cl.id] + t.by);
      }
    }
  }
  c = { ...c, life };

  // 5. What wants to play now.
  const screens: ArcPick[] = [];
  const offers: MomentResult["offers"] = [];
  for (const arc of ARCS) {
    life = lifeOf(c);
    let run = life.arcs?.[arc.id];
    if (!run) {
      const first = arc.beats[0];
      const open = Object.values(life.arcs ?? {}).filter((r) => !r.done).length;
      if (open >= MAX_OPEN_ARCS) continue;
      const t = first.event.trigger;
      if (opts.force !== arc.id && !t.when.includes(moment)) continue;
      const fresh = startRun(c, life, arc, first);
      if (!fresh) continue;
      const nl = cloneLife(life);
      nl.arcs = { ...(nl.arcs ?? {}), [arc.id]: fresh };
      const trial: CareerState = { ...c, life: nl };
      if (opts.force !== arc.id && !beatOpen(trial, arc, fresh, first, moment, opts.facts)) continue;
      c = trial;
      run = fresh;
    }
    for (const beat of arc.beats) {
      if (!beatOpen(c, arc, run, beat, moment, opts.facts) && !(opts.force === arc.id && beat === arc.beats[0] && !run.f[beat.id])) continue;
      const entry = beat.event.entry;
      if (entry?.kind === "standing") continue;
      if (entry?.kind === "offer") {
        if (run.o) continue;
        const cast = castFor(c, arc, run, beat);
        const person = cast?.[entry.on ?? ""];
        if (!cast || !person) continue;
        const nl = cloneLife(lifeOf(c));
        nl.arcs![arc.id] = { ...nl.arcs![arc.id], cast, o: [beat.id, person, now] };
        c = { ...c, life: nl };
        offers.push({ arc: arc.id, beat: beat.id, person });
        break;
      }
      screens.push({ arc: arc.id, beat: beat.id });
      break;
    }
  }
  return { career: c, screens, offers, notices };
}

/** The day ends: a "today only" offer goes, and its ifIgnored ending plays. */
export function endOfDay(c: CareerState, rng: () => number): { career: CareerState; notices: ArcNotice[] } {
  const notices: ArcNotice[] = [];
  const career = expireOffers(c, (n) => notices.push(n), rng, true);
  return { career, notices };
}

function expireOffers(c0: CareerState, note: (n: ArcNotice) => void, rng: () => number, allNow: boolean): CareerState {
  let c = c0;
  const now = lifeWeek(c);
  for (const [id, run] of Object.entries(arcsOf(c))) {
    if (!run.o || (!allNow && run.o[2] >= now)) continue;
    const arc = arcById(id);
    const beat = arc && beatOf(arc, run.o[0]);
    const life = cloneLife(lifeOf(c));
    delete life.arcs![id].o;
    c = { ...c, life };
    const end = beat?.event.entry?.ifIgnored;
    if (!arc || !beat || !end) continue;
    const opened = openBeat(c, id, beat.id);
    if (!opened) continue;
    const r = playEnding(opened.career, opened.live, end, { rng });
    c = r.career;
    note({ kind: "ignored", arc: id, title: beat.event.entry?.bubble ? `You didn't stop: ${beat.event.entry.bubble.toLowerCase()}` : "You walked past", text: r.result.text, w: now, who: personInfo(c, run.o[1])?.short });
  }
  return c;
}

function promiseClock(c0: CareerState, note: (n: ArcNotice) => void, rng: () => number): CareerState {
  let c = c0;
  const now = lifeWeek(c);
  for (const p of openPromises(c)) {
    if (p.due < 0) continue;
    const def = promiseDef(p.arc, p.id);
    if (now > p.due) {
      const r = breakPromise(c, p.arc, p.id, rng);
      c = r.career;
      note({ kind: "broken", arc: p.arc, title: "Promise broken", text: r.text || p.text, w: now, who: personInfo(c, p.to)?.short, changes: r.changes });
    } else if (!p.r && p.due - now <= 1 && def?.remind) {
      const life = cloneLife(lifeOf(c));
      const q = life.promises!.find((x) => x.id === p.id && x.st === "open");
      if (q) q.r = 1;
      c = { ...c, life };
      note({ kind: "remind", arc: p.arc, title: p.text, text: fillLine(def.remind, c, arcsOf(c)[p.arc]?.cast ?? {}, arcCtx(c, p.arc)), w: now, who: personInfo(c, p.to)?.short });
    }
  }
  return c;
}

// ── The round menu's bubbles ───────────────────────────────────────────────

export interface ArcBubble { arc: string; beat: string; label: string; icon: string; hint: string; gold: boolean; chip: string }

/** What a person's round menu adds for the stories: the gold offer (today
 *  only) and the standing one ("The hundred", on Thursdays). */
export function bubblesFor(c: CareerState, personId: string, facts?: FactOverride): ArcBubble[] {
  const out: ArcBubble[] = [];
  for (const [id, run] of Object.entries(arcsOf(c))) {
    const arc = arcById(id);
    if (!arc) continue;
    if (run.o && run.o[1] === personId) {
      const beat = beatOf(arc, run.o[0]);
      const e = beat?.event.entry;
      if (beat && e) out.push({ arc: id, beat: beat.id, label: e.bubble ?? beat.title, icon: e.icon === "ball" ? "⚽" : "⭐", hint: e.hint ?? "", gold: true, chip: "Today only" });
    }
    for (const beat of arc.beats) {
      const e = beat.event.entry;
      if (e?.kind !== "standing" || run.cast[e.on ?? ""] !== personId) continue;
      if (!beatOpen(c, arc, run, beat, null, facts)) continue;
      out.push({ arc: id, beat: beat.id, label: e.bubble ?? beat.title, icon: e.icon === "ball" ? "⚽" : "⭐", hint: e.hint ?? "", gold: false, chip: "Thursdays" });
    }
  }
  return out;
}

// ── Endings ────────────────────────────────────────────────────────────────

export interface ArcExtras {
  promiseMade?: { text: string; due: string; who: string };
  promisesKept: { text: string; who: string }[];
  promisesBroken: { text: string; who: string }[];
  objective?: { text: string; window: number; why: string };
  got?: { what: string; text: string };
  /** The story's next step, as the quest log says it. */
  next: string;
  /** The story ended this way. */
  ended?: { title: string; text: string };
  /** The beats as dots for "What happens next". */
  dots: QuestDot[];
}

export interface PlayOpts { rng: () => number; facts?: FactOverride }

const ITEM_WORDS: Record<string, [string, string]> = {
  "item:dens-ball-bag": ["Den's ball bag", "\"Den's hundred\" is now a drill in your own garden."],
};

/** Play an ending of a beat's talk (or a card's choice): the outcome through
 *  resolve.ts, then the story's own parts. */
export function playEnding(c0: CareerState, b: BeatLive, endId: string, opts: PlayOpts, choiceOuts?: { choice: LifeChoice; outs: ArcOutcome[] }): { career: CareerState; result: ChoiceResult; extras: ArcExtras; outcome: ArcOutcome } {
  const now = lifeWeek(c0);
  // The values this talk set are the arc's now.
  const life0 = cloneLife(lifeOf(c0));
  const run0 = life0.arcs?.[b.arc];
  if (run0) run0.v = { ...run0.v, ...b.tv };
  let c: CareerState = { ...c0, life: life0 };
  const ctx = arcCtx(c, b.arc, { ...b, tv: {} }, opts.facts);
  const outs = choiceOuts?.outs ?? b.event.talk?.ends[endId] ?? [];
  const outcome = (outs.length ? pickOutcome(outs, (s) => holds(s, ctx), opts.rng()) : { text: "" }) as ArcOutcome;
  const choice: LifeChoice = choiceOuts?.choice ?? { id: endId, label: b.lastReply?.label ?? "", tone: b.lastReply?.tone, silent: b.lastReply?.silent, outcomes: [outcome] };
  const live: LiveEvent = {
    id: b.event.id, event: b.event as unknown as LifeEvent, moment: "followUp", cast: b.cast, lines: [], callbacks: [],
    choices: [{ id: choice.id, label: choice.label, costText: [], locked: null, choice: { ...choice, cost: undefined, outcomes: [outcome] } }], followUp: true, social: false,
  };
  const result = chooseOption(c, live, choice.id, { rng: opts.rng, facts: opts.facts, forceOutcome: 0, v2: ctx.v2 })!;
  c = result.career;
  const extras: ArcExtras = { promisesKept: [], promisesBroken: [], next: "", dots: [] };
  c = applyArcOutcome(c, b, outcome, endId, now, opts, extras, result.changes);
  const q = questLog(c).find((x) => x.arc === b.arc);
  extras.next = q?.next ?? "";
  extras.dots = q?.dots ?? [];
  return { career: c, result: { ...result, career: c }, extras, outcome };
}

function resolveVar(x: ArcVar, v: Record<string, ArcVar>, b: BeatLive): ArcVar {
  if (typeof x !== "string") return x;
  if (x === "activity.tens") return b.activity?.tens ?? 0;
  if (x === "activity.score") return b.activity?.score ?? 0;
  const m = /^max\(([a-z]+),activity\.tens\)$/.exec(x);
  if (m) return Math.max(Number(v[m[1]] ?? 0), b.activity?.tens ?? 0);
  return x;
}

function applyArcOutcome(c0: CareerState, b: BeatLive, o: ArcOutcome, endId: string, now: number, opts: PlayOpts, ex: ArcExtras, changes: LifeChange[]): CareerState {
  let c = c0;
  const arc = arcById(b.arc)!;
  let life = cloneLife(lifeOf(c));
  const run = life.arcs![b.arc];
  const ctx = () => arcCtx({ ...c, life }, b.arc, { ...b, tv: {} }, opts.facts);
  const a = o.arc;
  if (a?.set) for (const [k, x] of Object.entries(a.set)) run.v[k] = resolveVar(x, run.v, b);
  if (a?.add) for (const [k, n] of Object.entries(a.add)) run.v[k] = Number(run.v[k] ?? 0) + n;
  if (a?.retry) { delete run.f[a.retry]; delete run.s[a.retry]; }
  if (a?.reopen) { delete run.done; delete run.s[a.reopen]; }
  if (a?.end) {
    run.done = a.end;
    const e = arc.ends.find((x) => x.id === a.end);
    if (e) ex.ended = { title: e.title, text: e.text };
  }
  if (a?.next) {
    const nextIf = (a as { nextIf?: string }).nextIf;
    if (!nextIf || holds(nextIf, ctx())) run.s[a.next] = now + (a.afterWeeks ? pickIn(a.afterWeeks, `${b.arc}|${a.next}|${now}`) : 0);
  }
  if (o.noteSquad) life.squad = remember(life.squad, o.noteSquad, now, 3);
  if (o.give || o.unlock) {
    life.got = Array.from(new Set([...(life.got ?? []), ...(o.give ? [o.give] : []), ...(o.unlock ?? "").split(/[+]/).filter(Boolean).map((u) => (u.includes(":") ? u : `garden:${u}`))])).slice(-20);
    const w = o.give ? ITEM_WORDS[o.give] : undefined;
    if (w) { ex.got = { what: w[0], text: w[1] }; changes.push({ kind: "item", label: w[0] }); }
    else if (o.unlock) changes.push({ kind: "item", label: o.unlock.startsWith("trophy:") ? "On the kit room door" : "Unlocked" });
  }
  if (o.objective && (life.objs ?? []).length < MAX_OBJECTIVES) {
    const t = fillLine(o.objective.text, { ...c, life }, b.cast, ctx());
    life.objs = [...(life.objs ?? []).filter((x) => x.id !== o.objective!.id), { id: o.objective.id, arc: b.arc, text: t, left: o.objective.window.matches, met: o.objective.met, onMet: o.objective.onMet, onMiss: o.objective.onMiss, made: now }];
    ex.objective = { text: t, window: o.objective.window.matches, why: `From ${personInfo(c, b.cast.manager ?? "mgr")?.short ?? "the gaffer"}, because of last night. ${personInfo(c, b.cast.kitman ?? "")?.short ?? "He"} will be in the tunnel.` };
  }
  if (o.train) {
    const sk = { ...c.skills } as unknown as Record<string, number>;
    for (const [k, n] of Object.entries(o.train)) { sk[k] = Math.min(99, (sk[k] ?? 50) + (n ?? 0)); changes.push({ kind: "bar", label: k.charAt(0).toUpperCase() + k.slice(1), delta: n }); }
    c = { ...c, skills: sk as unknown as CareerState["skills"] };
  }
  c = { ...c, life };

  // Promises this ending broke (the empty chair), kept, or made.
  for (const id of o.promiseBroken ?? []) {
    const p = openPromises(c).find((x) => x.id === id);
    if (!p) continue;
    const r = breakPromise(c, b.arc, id, opts.rng, true);
    c = r.career;
    ex.promisesBroken.push({ text: p.text, who: personInfo(c, p.to)?.short ?? "" });
  }
  for (const p of openPromises(c)) {
    const def = promiseDef(p.arc, p.id);
    if (!def || def.keptBy.beat !== b.beat || p.arc !== b.arc) continue;
    if ((def.keptBy.played && b.played) || def.keptBy.ends?.includes(endId)) {
      const r = keepPromise(c, p.arc, p.id, opts.rng);
      c = r.career;
      changes.push(...r.changes);
      ex.promisesKept.push({ text: p.text, who: personInfo(c, p.to)?.short ?? "" });
    }
  }
  for (const id of [...b.made, ...(o.promise ? [o.promise] : [])]) {
    const r = makePromise(c, b.arc, id, b.cast);
    if (!r) continue;
    c = r.career;
    ex.promiseMade = { text: r.promise.text, due: promiseDef(b.arc, id)?.dueText ?? "", who: personInfo(c, r.promise.to)?.short ?? "" };
  }
  life = lifeOf(c);
  return c;
}

// ── The quest log (Breath of the Wild's Adventure Log; Ocarina's trading sequence) ──

export interface QuestDot { id: string; n: number; title: string; state: "done" | "now" | "future" }
export interface QuestRow {
  arc: string;
  title: string;
  owner: string;
  ownerId: string;
  /** The story's next step, in one plain line. */
  next: string;
  /** When: "Today only", "Due now", "In about 3 weeks", "Next season". */
  when: string;
  dots: QuestDot[];
  clock?: { label: string; filled: number; segments: number };
  ended?: { title: string; text: string };
  /** Your best and how many nights, for a story that keeps them. */
  stats: string[];
}

export function questLog(c: CareerState): QuestRow[] {
  const out: QuestRow[] = [];
  const now = lifeWeek(c);
  for (const [id, run] of Object.entries(arcsOf(c))) {
    const arc = arcById(id);
    if (!arc) continue;
    const ctx = arcCtx(c, id);
    const owner = run.cast[arc.owner] ?? "";
    const fill = (s: string) => fillLine(s, c, run.cast, ctx);
    const total = mainCount(arc);
    const dots: QuestDot[] = [];
    for (let n = 1; n <= total; n++) {
      const beat = arc.beats.find((x) => x.n === n);
      if (!beat) continue;
      const done = !!run.f[beat.id]?.length;
      dots.push({ id: beat.id, n, title: done ? beat.title : "?", state: done ? "done" : "future" });
    }
    const fut = dots.find((d) => d.state === "future");
    let next = "", when = "";
    const sched = Object.entries(run.s).sort((x, y) => x[1] - y[1])[0];
    if (run.o) { const b = beatOf(arc, run.o[0]); next = fill(b?.hint ?? ""); when = "Today only"; }
    else if (sched) { const b = beatOf(arc, sched[0]); next = fill(b?.hint ?? ""); when = sched[1] <= now ? "Now" : `In about ${sched[1] - now} week${sched[1] - now === 1 ? "" : "s"}`; }
    else if (!run.done) {
      // The next beat on the main line that is not played yet.
      const b = arc.beats.find((x) => x.n && !run.f[x.id]?.length && !(x.after?.objective));
      if (b) {
        next = fill(b.hint);
        const from = beatFrom(arc, run, b);
        when = from === null ? "" : from <= now ? "When the time is right" : from - now >= LIFE_SEASON ? `In about ${Math.round((from - now) / LIFE_SEASON)} season${Math.round((from - now) / LIFE_SEASON) === 1 ? "" : "s"}` : `In about ${from - now} weeks`;
      }
    }
    if (fut && (run.o || sched || !run.done)) {
      const target = run.o?.[0] ?? sched?.[0] ?? arc.beats.find((x) => x.n && !run.f[x.id]?.length)?.id;
      const d = dots.find((x) => x.id === target);
      if (d) d.state = "now";
    }
    const standing = arc.beats.find((x) => x.repeat && x.event.entry?.kind === "standing" && (run.f[x.id]?.length || beatOpen(c, arc, run, x, null)));
    const cl = arc.clocks[0];
    const stats: string[] = [];
    if (typeof run.v.best === "number" && run.v.best > 0) stats.push(`Best ${run.v.best}`);
    if (typeof run.v.nights === "number" && run.v.nights > 0) stats.push(`${run.v.nights} night${run.v.nights === 1 ? "" : "s"} on pitch two`);
    if (standing && !run.done && (run.f[standing.id]?.length ?? 0) < (standing.repeat?.max ?? 0)) stats.push(fill(standing.hint));
    const e = run.done ? arc.ends.find((x) => x.id === run.done) : undefined;
    out.push({
      arc: id, title: arc.title, owner: personInfo(c, owner)?.name ?? "", ownerId: owner, next, when, dots,
      clock: cl && run.k[cl.id] !== undefined ? { label: cl.label, filled: run.k[cl.id], segments: cl.segments } : undefined,
      ended: e && !next ? { title: e.title, text: e.text } : undefined, stats,
    });
  }
  return out;
}

/** "Beat 3 of 7 · Round 2" for the story strip over a screen. */
export function storyStrip(b: BeatLive): { title: string; beat: string } {
  const arc = arcById(b.arc)!;
  const beat = beatOf(arc, b.beat)!;
  const n = beat.n ?? (arc.beats.slice(0, arc.beats.indexOf(beat)).reverse().find((x) => x.n)?.n ?? 1);
  return { title: arc.title, beat: `Beat ${n} of ${mainCount(arc)}` };
}

export const SEASON_LEN_WEEKS = LIFE_SEASON;
