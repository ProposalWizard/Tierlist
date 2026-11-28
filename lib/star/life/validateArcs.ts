/**
 * THE V2 CHECKER — Events v2 (design part 4, validate.ts row). Rejects an arc
 * that could break or strand a player, in a blink, before it ships
 * (tests/star/lifeArcs.mts runs it on the book and on broken copies).
 *
 *  Talks:      every goto, result and end resolves; every node has a way
 *              out; at most one silence per node; every node can reach an
 *              ending (no dead end); labels ≤ 72, lines ≤ 240; conditions parse.
 *  Activities: a known mode; all three results handled (abandoned when you
 *              can stop, a winning or scoring row, and a fallback row).
 *  Promises:   a deadline (weeks or a beat), the words for it, what keeps
 *              it, and both endings; one due at a beat is broken somewhere.
 *  Arcs:       at least two endings, each reachable; every `next`, objective
 *              and ifIgnored names something real; every beat can be reached
 *              from the first; at least one beat a season or more away.
 */
import type { ArcBeat, ArcOutcome, LifeArc, LifeEvent } from "./types";
import { LIFE_MOMENTS } from "./types";
import { endedIn, flagsIn, parseCond, slotsIn, tagsIn } from "./cond";
import type { StoryTier } from "./types";

/** The share of careers (start.careers; none = all) each rarity tier allows (28 Nov 2026). The
 *  start chance is set by how long the story's window is (docs/plans/STORY_BOOK_MAP.md). */
export const STORY_TIERS: Record<StoryTier, [number, number]> = {
  common: [0.85, 1],
  uncommon: [0.45, 0.85],
  rare: [0.18, 0.45],
  "very-rare": [0.06, 0.18],
  legendary: [0.015, 0.06],
};
export const STORY_STAGES = ["first-seasons", "breaking-through", "established", "peak", "veteran", "last-seasons", "any"];
import { BAND, MAX_LINE, MAX_TELLTALE_LINE, PICKS, REAL_NAMES } from "./validate";
import { PLACEHOLDER_KEYS, YOU_KEYS } from "./text";
import { ROUND_LIBRARY, type RoundKind } from "./drill";
import { packProblems } from "./arcPack";
import { SNUB_TAG, SNUB_TWICE_TAG } from "./snubs";

export interface ArcProblem { id: string; problem: string }

const MODES = ["strike-drill", "crossbar", "feed-drill", "challenge"];

function outcomesOf(b: ArcBeat): [string, ArcOutcome[]][] {
  const e = b.event;
  return [...Object.entries(e.talk?.ends ?? {}), ...e.choices.map((c) => [c.id, c.outcomes] as [string, ArcOutcome[]])];
}

export function validateArc(arc: LifeArc): string[] {
  const out: string[] = [];
  const bad = (where: string, p: string) => out.push(`${where}: ${p}`);
  const beats = new Map(arc.beats.map((b) => [b.id, b]));
  const endIds = new Set(arc.ends.map((e) => e.id));
  const usedEnds = new Set<string>();
  const cond = (where: string, c: string) => { if (!c) return; const p = parseCond(c); if (typeof p === "string") bad(where, p); };
  if (arc.ends.length < 2) bad(arc.id, "an arc needs at least two endings");
  if (!arc.beats.length) { bad(arc.id, "no beats"); return out; }
  const edges = new Map<string, Set<string>>(arc.beats.map((b) => [b.id, new Set<string>()]));
  const link = (from: string, to: string, where: string) => { if (!beats.has(to)) bad(where, `names a beat "${to}" that is not in the arc`); else edges.get(from)?.add(to); };

  for (const b of arc.beats) {
    const w = `${arc.id}/${b.id}`;
    const e = b.event;
    if (!b.hint) bad(w, "no quest-log hint (the player must always see what comes next)");
    for (const r of [...(b.requires ?? []), ...(e.trigger.requires ?? [])]) cond(w, r);
    if (b.after?.beat) link(b.after.beat, b.id, w);
    if (b.after?.clock && !arc.clocks.some((c) => c.id === b.after!.clock)) bad(w, `waits for a clock "${b.after.clock}" that is not in the arc`);
    if (!b.after && b !== arc.beats[0]) for (const x of arc.beats) if (x !== b) edges.get(x.id)?.add(b.id); // condition-gated: reachable once the story runs
    if (b.after?.clock) { const cl = arc.clocks.find((c) => c.id === b.after!.clock); if (cl) link(cl.startsAt, b.id, w); }
    const ends = e.talk?.ends ?? {};
    // The entry.
    if (e.entry?.ifIgnored && !ends[e.entry.ifIgnored]) bad(w, `ifIgnored "${e.entry.ifIgnored}" is not one of its endings`);
    if (e.entry?.kind === "invite") for (const ch of e.entry.choices ?? []) if (ch !== "attend" && !ends[`@${ch}`]) bad(w, `the invite answer "${ch}" has no ending "@${ch}"`);
    if (e.entry?.kind === "offer" && !e.entry.ifIgnored) bad(w, "an offer must say what happens if you walk past it");
    // The talk.
    if (e.talk) {
      const nodes = e.talk.nodes;
      const st = e.talk.start;
      const starts = typeof st === "string" ? [st] : [st.then, st.else];
      if (typeof st !== "string") cond(w, st.if);
      for (const s of starts) if (!nodes[s]) bad(w, `the talk starts at "${s}", which is not a node`);
      const next = new Map<string, string[]>();
      for (const [id, n] of Object.entries(nodes)) {
        const nw = `${w}/${id}`;
        const to: string[] = [];
        if (n.activity) {
          const a = n.activity;
          if (!MODES.includes(a.mode) && a.mode !== arc.needsActivity) bad(nw, `unknown game mode "${a.mode}"`);
          const rows = n.result ?? [];
          for (const [c, t] of rows) { cond(nw, c); if (!nodes[t]) bad(nw, `a result goes to "${t}", which is not a node`); to.push(t); }
          if (a.canAbandon && !rows.some(([c]) => c === "activity.abandoned")) bad(nw, "you can stop this game, but stopping goes nowhere of its own");
          if (!rows.some(([c]) => c === "")) bad(nw, "the game has no fallback result");
          if (!rows.some(([c]) => /activity\.(won|score|tens)/.test(c))) bad(nw, "no result for doing well");
          if (typeof a.dials.from === "object") cond(nw, a.dials.from.if);
          // A challenge (drill.ts's round library): known rounds, ten balls at most, a double only last,
          // and whoever goes in goal is someone the story has.
          if (a.mode === "challenge") {
            const rs = a.dials.rounds ?? [];
            if (!rs.length) bad(nw, "a challenge with no rounds");
            let balls = 0;
            rs.forEach((r, i) => {
              const lib = ROUND_LIBRARY[r.kind as RoundKind];
              if (!lib) { bad(nw, `unknown round "${r.kind}" (the rounds are: ${Object.keys(ROUND_LIBRARY).join(", ")})`); return; }
              balls += r.kind === "double" ? 1 : r.balls ?? lib.balls;
              if (r.kind === "double" && i !== rs.length - 1) bad(nw, "double or nothing must be the last round");
            });
            if (balls > 10) bad(nw, `a challenge has ${balls} balls; ten at most (each counts ten)`);
            const keeperSlot = a.dials.keeperSlot;
            if (keeperSlot && !arc.cast.some((c) => c.slot === keeperSlot)) bad(nw, `"${keeperSlot}" goes in goal but the story has no such person`);
            if (!a.caller?.slot) bad(nw, "a challenge needs a caller (the person who feeds and reacts)");
          }
        } else {
          const rs = n.replies ?? [];
          if (!rs.length) bad(nw, "a node with no replies and no game");
          if (rs.filter((r) => r.silent).length > 1) bad(nw, "more than one silence");
          if (rs.filter((r) => !r.requires?.length).length > 4) bad(nw, "more than 4 replies always on screen");
          for (const r of rs) {
            if (r.label.length > MAX_TELLTALE_LINE) bad(nw, `reply "${r.id}" is too long (${r.label.length} > ${MAX_TELLTALE_LINE})`);
            for (const c of r.requires ?? []) cond(nw, c);
            if (r.goto) { if (!nodes[r.goto]) bad(nw, `reply "${r.id}" goes to "${r.goto}", which is not a node`); to.push(r.goto); }
            else if (r.end) { if (!ends[r.end]) bad(nw, `reply "${r.id}" ends "${r.end}", which is not an ending`); to.push(`#end`); }
            else bad(nw, `reply "${r.id}" goes nowhere`);
            if (r.promise && !arc.promises[r.promise]) bad(nw, `reply "${r.id}" makes an unknown promise "${r.promise}"`);
          }
          if (rs.length && rs.every((r) => r.requires?.length)) bad(nw, "every reply has a condition: a player could be left with none");
        }
        for (const l of n.say ?? []) {
          if (l.length > MAX_LINE) bad(nw, `a line is too long (${l.length} > ${MAX_LINE})`);
          for (const m of Array.from(l.matchAll(/\{if ([^}]+)\}/g))) if (!/^!?[a-z]+$/.test(m[1].trim())) cond(nw, m[1].trim());
        }
        next.set(id, to);
      }
      // No dead ends: from every node a path reaches an ending.
      const canEnd = new Set<string>(["#end"]);
      for (let pass = 0; pass < 30; pass++) for (const [id, to] of Array.from(next)) if (to.some((t) => canEnd.has(t))) canEnd.add(id);
      for (const id of Object.keys(nodes)) if (!canEnd.has(id)) bad(`${w}/${id}`, "a dead end: no way from here to an ending");
    }
    // The endings.
    for (const [eid, outs] of outcomesOf(b)) {
      if (!outs.length) bad(w, `ending "${eid}" has no outcome`);
      for (const o of outs) {
        if (o.if) cond(`${w}/${eid}`, o.if);
        if (!o.text) bad(`${w}/${eid}`, "an outcome with no words");
        if (o.text.length > MAX_LINE) bad(`${w}/${eid}`, `outcome too long (${o.text.length})`);
        const a = o.arc;
        if (a?.next) link(b.id, a.next, `${w}/${eid}`);
        if (a?.retry && !beats.has(a.retry)) bad(`${w}/${eid}`, `retries an unknown beat "${a.retry}"`);
        if (a?.reopen) link(b.id, a.reopen, `${w}/${eid}`);
        if (a?.end) { if (!endIds.has(a.end)) bad(`${w}/${eid}`, `ends the arc "${a.end}", which is not one of its endings`); usedEnds.add(a.end); }
        if (o.objective) { link(b.id, o.objective.onMet, `${w}/${eid}`); link(b.id, o.objective.onMiss, `${w}/${eid}`); cond(`${w}/${eid}`, o.objective.met); }
        if (o.promise && !arc.promises[o.promise]) bad(`${w}/${eid}`, `makes an unknown promise "${o.promise}"`);
        for (const p of o.promiseBroken ?? []) if (!arc.promises[p]) bad(`${w}/${eid}`, `breaks an unknown promise "${p}"`);
      }
    }
  }
  for (const e of arc.ends) if (!usedEnds.has(e.id)) bad(arc.id, `the ending "${e.id}" is never reached`);
  // Every beat can be reached from the first.
  const seen = new Set<string>([arc.beats[0].id]);
  for (let pass = 0; pass < 30; pass++) for (const [from, to] of Array.from(edges)) if (seen.has(from)) for (const t of Array.from(to)) seen.add(t);
  for (const b of arc.beats) if (!seen.has(b.id)) bad(`${arc.id}/${b.id}`, "no way to reach this beat");
  if (!arc.beats.some((b) => b.after?.seasons || b.after?.clock)) bad(arc.id, "no beat is a season or more away (a story must come back)");
  // Promises.
  for (const [id, p] of Object.entries(arc.promises)) {
    const w = `${arc.id}/promise ${id}`;
    if (!p.due?.weeks && !p.due?.beat) bad(w, "no deadline");
    if (!p.dueText) bad(w, "no words for when it is due");
    if (!p.keptBy?.beat || !beats.has(p.keptBy.beat)) bad(w, "nothing keeps it");
    if (!p.kept || !p.broken) bad(w, "needs both endings, kept and broken");
    if (p.due?.beat && !arc.beats.some((b) => outcomesOf(b).some(([, outs]) => outs.some((o) => o.promiseBroken?.includes(id))))) bad(w, "due at a beat, but no ending ever breaks it");
    if (p.keptBy?.ends) { const kb = beats.get(p.keptBy.beat); for (const e of p.keptBy.ends) if (kb && !outcomesOf(kb).some(([k]) => k === e)) bad(w, `kept by an ending "${e}" its beat does not have`); }
  }
  return out;
}

export function validateArcs(arcs: LifeArc[]): ArcProblem[] {
  const out: ArcProblem[] = [];
  const ids = new Set<string>();
  for (const a of arcs) {
    if (ids.has(a.id)) out.push({ id: a.id, problem: "two arcs share an id" });
    ids.add(a.id);
    for (const p of validateArc(a)) out.push({ id: a.id, problem: p });
  }
  return out;
}

// ── The deep pass (story batch 1): every file in the book, and what they read of each other ──

/** Every line a beat can show: the scene, his lines, your replies, the card, the outcomes, the promises. */
function linesOfBeat(b: ArcBeat): string[] {
  const e = b.event;
  const out: string[] = [...e.setup, b.hint];
  for (const n of Object.values(e.talk?.nodes ?? {})) {
    out.push(...(n.say ?? []), ...(n.replies ?? []).map((r) => r.label));
    if (n.activity) out.push(n.activity.name, n.activity.intro ?? "", ...(n.activity.caller?.lines ?? []));
  }
  for (const c of e.choices) out.push(c.label);
  for (const [, outs] of outcomesOf(b)) for (const o of outs) out.push(o.text, o.objective?.text ?? "", o.objective?.why ?? "", ...(o.giveWords ?? []), o.snubTwice ?? "");
  if (e.entry) out.push(e.entry.bubble ?? "", e.entry.hint ?? "", e.entry.text ?? "", ...Object.values(e.entry.labels ?? {}));
  for (const v of e.variants ?? []) out.push(v.setupSwap ?? "");
  return out.filter(Boolean);
}

function allOutcomes(arc: LifeArc): { where: string; o: ArcOutcome; size: string }[] {
  const out: { where: string; o: ArcOutcome; size: string }[] = [];
  for (const b of arc.beats) for (const [eid, outs] of outcomesOf(b)) for (const o of outs) out.push({ where: `${arc.id}/${b.id}/${eid}`, o, size: b.event.size });
  for (const [id, p] of Object.entries(arc.promises)) for (const o of [p.kept, p.broken]) if (o) out.push({ where: `${arc.id}/promise ${id}`, o, size: "medium" });
  return out;
}

/**
 * The deep checks for the whole book (tests/star/lifeArcs.mts): no unresolved slot or
 * placeholder, every person rule real, every effect in its size, every node reachable,
 * every promise made somewhere, every memory read written somewhere, ids unique across
 * stories, no real names, and a waiting story really names the game it waits for.
 * `events` is the v1 book, so a story can read a memory a v1 event writes (and back).
 */
export function validateArcBook(arcs: LifeArc[], events: LifeEvent[] = []): ArcProblem[] {
  // Save codes (arcPack.ts): a finished story is stored as its code and its ending's code.
  const out: ArcProblem[] = [...validateArcs(arcs), ...packProblems(arcs)];
  const written = new Set<string>();
  for (const e of events) for (const c of e.choices ?? []) for (const o of c.outcomes ?? []) for (const r of o.remember ?? []) written.add(r.tag);
  for (const a of arcs) for (const { o } of allOutcomes(a)) { for (const r of o.remember ?? []) written.add(r.tag); if (o.noteSquad) written.add(o.noteSquad); }
  // A turned-down ending (snubs.ts) writes these two.
  if (arcs.some((a) => allOutcomes(a).some(({ o }) => o.snub))) { written.add(SNUB_TAG); written.add(SNUB_TWICE_TAG); }
  // Chains (28 Nov 2026): a story that waits on another (ended(...), a flag, a memory) must wait on
  // something that can happen. Flags are set by outcomes; ended() names a real story and endings.
  const flagsSet = new Set<string>();
  for (const e of events) for (const c of e.choices ?? []) for (const o of c.outcomes ?? []) if (o.effects?.flag) flagsSet.add(o.effects.flag);
  for (const a of arcs) for (const { o } of allOutcomes(a)) if (o.effects?.flag) flagsSet.add(o.effects.flag);
  const byId = new Map(arcs.map((a) => [a.id, a]));
  const tiered = arcs.some((a) => a.start?.tier);
  const waitsOn = new Map<string, Set<string>>();
  const bars = ["boss", "team", "fans", "fame", "reputation"] as const;
  for (const arc of arcs) {
    const chainBad = (where: string, c: string) => {
      for (const f of flagsIn(c)) if (!flagsSet.has(f)) out.push({ id: arc.id, problem: `${where}: the condition "${c}" reads the flag "${f}", which nothing sets (a chain whose parent can never start it)` });
      for (const [pid, ends] of endedIn(c)) {
        const p = byId.get(pid);
        if (!p) { out.push({ id: arc.id, problem: `${where}: the condition "${c}" waits on the story "${pid}", which is not in the book` }); continue; }
        if (p.needsActivity) out.push({ id: arc.id, problem: `${where}: waits on "${pid}", which waits for a game not built yet, so it can never end` });
        for (const e of ends) {
          if (!p.ends.some((x) => x.id === e)) out.push({ id: arc.id, problem: `${where}: waits on "${pid}" ending "${e}", which that story does not have` });
          else if (!allOutcomes(p).some(({ o }) => o.arc?.end === e)) out.push({ id: arc.id, problem: `${where}: waits on "${pid}" ending "${e}", but nothing in that story ever ends it that way` });
        }
        if (where.endsWith("start")) (waitsOn.get(arc.id) ?? waitsOn.set(arc.id, new Set()).get(arc.id)!).add(pid);
      }
    };
    for (const c of arc.start?.when ?? []) chainBad(`${arc.id}/start`, c);
    for (const b of arc.beats) {
      for (const c of [...(b.requires ?? []), ...(b.event.trigger.requires ?? [])]) chainBad(`${arc.id}/${b.id}`, c);
      for (const n of Object.values(b.event.talk?.nodes ?? {})) { for (const r of n.replies ?? []) for (const c of r.requires ?? []) chainBad(`${arc.id}/${b.id}`, c); for (const [c] of n.result ?? []) chainBad(`${arc.id}/${b.id}`, c); }
      for (const ch of b.event.choices) for (const c of ch.requires ?? []) chainBad(`${arc.id}/${b.id}`, c);
    }
    for (const { where, o } of allOutcomes(arc)) if (o.if) chainBad(where, o.if);
    // Rarity and stage.
    if (tiered && arc.start && !arc.start.tier) out.push({ id: arc.id, problem: "the book has rarity tiers, but this story has none (start.tier)" });
    if (arc.start?.tier) {
      const band = STORY_TIERS[arc.start.tier];
      const share = arc.start.careers ?? 1;
      if (!band) out.push({ id: arc.id, problem: `unknown tier "${arc.start.tier}"` });
      else if (share < band[0] - 1e-9 || share > band[1] + 1e-9) out.push({ id: arc.id, problem: `a ${arc.start.tier} story must be in ${band[0]} to ${band[1]} of careers (start.careers is ${share})` });
    }
    if (arc.start?.stage && !STORY_STAGES.includes(arc.start.stage)) out.push({ id: arc.id, problem: `unknown stage "${arc.start.stage}"` });
    for (const c of arc.start?.when ?? []) {
      const p = parseCond(c);
      if (typeof p === "string") out.push({ id: arc.id, problem: `start.when: ${p}` });
      for (const sl of slotsIn(c)) if (sl !== "squad" && sl !== "you") out.push({ id: arc.id, problem: `start.when "${c}" names "${sl}": nobody is cast before the story starts` });
      for (const t of tagsIn(c)) if (!written.has(t)) out.push({ id: arc.id, problem: `start.when "${c}" reads the memory "${t}", which nothing writes` });
    }
  }
  // A story cannot wait on itself, or on a story that waits on it.
  for (const id of Array.from(waitsOn.keys())) {
    const seen = new Set<string>(), todo = Array.from(waitsOn.get(id) ?? []);
    while (todo.length) { const x = todo.pop()!; if (x === id) { out.push({ id, problem: "its start waits on a chain that comes back to itself, so it can never start" }); break; } if (seen.has(x)) continue; seen.add(x); todo.push(...Array.from(waitsOn.get(x) ?? [])); }
  }
  const beatIds = new Map<string, string>(), eventIds = new Map<string, string>();
  for (const arc of arcs) {
    const bad = (where: string, p: string) => out.push({ id: arc.id, problem: `${where}: ${p}` });
    const slots = new Set(arc.cast.map((x) => x.slot));
    const special = new Set(["you", "squad"]);
    for (const x of arc.cast) {
      if (!/^[a-z]+$/.test(x.slot)) bad(arc.id, `slot "${x.slot}" must be one lower-case word`);
      if (!PICKS.includes(x.pick) && x.pick !== "legend") bad(arc.id, `slot ${x.slot}: unknown cast rule "${x.pick}"`);
    }
    if (!slots.has(arc.owner)) bad(arc.id, `the owner "${arc.owner}" is not in the cast`);
    if (arc.needsActivity && !arc.beats.some((b) => Object.values(b.event.talk?.nodes ?? {}).some((n) => n.activity?.mode === arc.needsActivity))) bad(arc.id, `waits for "${arc.needsActivity}" but no talk plays it`);
    if (arc.start && !(arc.start.chance > 0 && arc.start.chance <= 1)) bad(arc.id, "a start chance must be above 0 and at most 1");
    if (arc.start?.careers !== undefined && !(arc.start.careers > 0 && arc.start.careers <= 1)) bad(arc.id, "a share of careers must be above 0 and at most 1");
    const checkCond = (where: string, c: string) => {
      if (!c) return;
      for (const sl of slotsIn(c)) if (!slots.has(sl) && !special.has(sl)) bad(where, `the condition "${c}" names "${sl}", who is not in the cast`);
      for (const t of tagsIn(c)) if (!written.has(t)) bad(where, `the condition "${c}" reads the memory "${t}", which nothing writes`);
    };
    for (const b of arc.beats) {
      const w = `${arc.id}/${b.id}`;
      const e = b.event;
      if (beatIds.has(b.id)) bad(w, `the beat id is also used by ${beatIds.get(b.id)} (the soak counts beats by id)`);
      beatIds.set(b.id, arc.id);
      if (eventIds.has(e.id)) bad(w, `the event id "${e.id}" is also used by ${eventIds.get(e.id)}`);
      eventIds.set(e.id, arc.id);
      for (const m of e.trigger.when) if (!LIFE_MOMENTS.includes(m)) bad(w, `unknown moment "${m}"`);
      if (!e.trigger.when.length) bad(w, "the beat has no moment");
      if (!["small", "medium", "big"].includes(e.size)) bad(w, `unknown size "${e.size}"`);
      for (const x of e.cast) if (!slots.has(x.slot)) bad(w, `the beat casts "${x.slot}", who is not in the arc's cast (a story's people are picked once)`);
      if (e.speaker && !slots.has(e.speaker)) bad(w, `the speaker "${e.speaker}" is not in the cast`);
      if (e.entry?.on && !slots.has(e.entry.on)) bad(w, `the bubble is on "${e.entry.on}", who is not in the cast`);
      for (const r of [...(b.requires ?? []), ...(e.trigger.requires ?? [])]) checkCond(w, r);
      for (const v of e.variants ?? []) checkCond(w, v.if);
      const r2 = b.after?.weeks ?? b.after?.seasons;
      if (r2 && !(r2[0] >= 0 && r2[1] >= r2[0])) bad(w, "a wait must be [from, to] with to ≥ from ≥ 0");
      // Talk nodes: reachable from the start; who speaks is in the cast.
      if (e.talk) {
        const nodes = e.talk.nodes;
        const st = e.talk.start;
        const seen = new Set<string>(typeof st === "string" ? [st] : [st.then, st.else]);
        for (let pass = 0; pass < 30; pass++) for (const id of Array.from(seen)) {
          const n = nodes[id];
          if (!n) continue;
          for (const r of n.replies ?? []) if (r.goto) seen.add(r.goto);
          for (const [, t] of n.result ?? []) seen.add(t);
        }
        for (const [id, n] of Object.entries(nodes)) {
          if (!seen.has(id)) bad(`${w}/${id}`, "no reply leads to this node (a line nobody can hear)");
          if (n.who && !slots.has(n.who)) bad(`${w}/${id}`, `"${n.who}" speaks but is not in the cast`);
          for (const r of n.replies ?? []) for (const c of r.requires ?? []) checkCond(`${w}/${id}`, c);
          for (const [c] of n.result ?? []) checkCond(`${w}/${id}`, c);
          const a = n.activity;
          if (a?.dials.opponent && !slots.has(a.dials.opponent.slot)) bad(`${w}/${id}`, `the opponent "${a.dials.opponent.slot}" is not in the cast`);
          if (a?.dials.shooter && !slots.has(a.dials.shooter.slot)) bad(`${w}/${id}`, `the shooter "${a.dials.shooter.slot}" is not in the cast`);
          if (a?.caller && !slots.has(a.caller.slot)) bad(`${w}/${id}`, `the caller "${a.caller.slot}" is not in the cast`);
        }
      }
      if (!e.talk && e.choices.length < 2) bad(w, "a card needs at least two choices");
      for (const c of e.choices) for (const r of c.requires ?? []) checkCond(w, r);
      if (!e.talk && e.choices.length && e.choices.every((c) => c.requires?.length)) bad(w, "every card choice has a condition: a player could be left with none");
      // Lines: every placeholder resolves, no real names, phone length.
      for (const l of linesOfBeat(b)) {
        if (l.length > MAX_LINE) bad(w, `a line is too long (${l.length} > ${MAX_LINE}): "${l.slice(0, 40)}…"`);
        for (const m of Array.from(l.matchAll(/\{if ([^}]+)\}/g))) {
          const k = m[1].trim();
          const word = /^!?([a-z]+)$/.exec(k);
          if (word) { if (!slots.has(word[1])) bad(w, `{if ${k}} names "${word[1]}", who is not in the cast`); }
          else checkCond(w, k);
        }
        const opens = (l.match(/\{if /g) ?? []).length, closes = (l.match(/\{\/if\}/g) ?? []).length;
        if (opens !== closes) bad(w, `an {if} without its {/if}: "${l.slice(0, 50)}…"`);
        for (const m of Array.from(l.matchAll(/\{([a-z]+)\.([a-zA-Z]+)\}/g))) {
          const [, slot, key] = m;
          if (slot === "arc") { if (!(key in arc.vars)) bad(w, `{arc.${key}} is not one of the story's values`); }
          else if (slot === "activity") { if (!["score", "tens", "oppScore"].includes(key)) bad(w, `{activity.${key}} is not something a game reports`); }
          else if (slot === "you") { if (!(YOU_KEYS as readonly string[]).includes(key)) bad(w, `{you.${key}} is not a thing the game knows`); }
          else if (!slots.has(slot)) bad(w, `{${slot}.${key}} names a slot the cast does not fill`);
          else if (!(PLACEHOLDER_KEYS as readonly string[]).includes(key)) bad(w, `{${slot}.${key}} is not a thing the game knows`);
        }
        const low = l.toLowerCase();
        for (const n of REAL_NAMES) if (new RegExp(`\\b${n}\\b`).test(low)) bad(w, `uses a real name or brand: "${n}"`);
      }
    }
    // Outcomes: people in the cast, memory tags well formed, every effect in its size.
    for (const { where, o, size } of allOutcomes(arc)) {
      for (const d of o.npc ?? []) {
        if (!slots.has(d.slot)) bad(where, `moves "${d.slot}", who is not in the cast`);
        for (const k of ["bond", "respect", "grudge"] as const) if (Math.abs(d[k] ?? 0) > 25) bad(where, `${d.slot}'s ${k} moves ${d[k]}: more than 25 at once`);
      }
      for (const r of o.remember ?? []) {
        if (!slots.has(r.slot) && !special.has(r.slot)) bad(where, `a memory for "${r.slot}", who is not in the cast`);
        if (![1, 2, 3].includes(r.strength)) bad(where, "a memory strength must be 1, 2 or 3");
        if (!/^[a-z0-9-]+$/.test(r.tag)) bad(where, `memory tag "${r.tag}" must be lower-case words with dashes`);
      }
      const fx = o.effects ?? {};
      for (const k of bars) if (Math.abs(fx[k] ?? 0) > BAND[size]) bad(where, `${k} moves ${fx[k]}, too much for a ${size} beat (max ${BAND[size]})`);
      if (Math.abs(fx.moneyWeeks ?? 0) > (size === "big" ? 8 : size === "medium" ? 4 : 2)) bad(where, `money moves ${fx.moneyWeeks} weeks of wage, too much for a ${size} beat`);
      if (Math.abs(fx.energy ?? 0) > 20) bad(where, `energy moves ${fx.energy}: more than 20`);
      if (o.if) checkCond(where, o.if);
      for (const [k, v] of Object.entries(o.arc?.set ?? {})) if (!(k in arc.vars)) bad(where, `sets "${k}", which is not one of the story's values (${String(v)})`);
      for (const k of Object.keys(o.arc?.add ?? {})) if (!(k in arc.vars)) bad(where, `adds to "${k}", which is not one of the story's values`);
      for (const [k, n] of Object.entries(o.train ?? {})) if (Math.abs(n ?? 0) > 3) bad(where, `trains ${k} by ${n}: more than 3`);
    }
    // Talk values set by replies are story values too.
    for (const b of arc.beats) for (const n of Object.values(b.event.talk?.nodes ?? {})) for (const r of n.replies ?? []) for (const k of Object.keys(r.var ?? {})) if (!(k in arc.vars)) bad(`${arc.id}/${b.id}`, `reply "${r.id}" sets "${k}", which is not one of the story's values`);
    // Promises: to someone in the cast, and made by something the player picks.
    const made = new Set<string>();
    for (const b of arc.beats) {
      for (const n of Object.values(b.event.talk?.nodes ?? {})) for (const r of n.replies ?? []) if (r.promise) made.add(r.promise);
      for (const [, outs] of outcomesOf(b)) for (const o of outs) if (o.promise) made.add(o.promise);
    }
    for (const { where, o } of allOutcomes(arc)) if (o.snub && !slots.has(o.snub)) bad(where, `turns down "${o.snub}", who is not in the cast`);
    for (const [id, p] of Object.entries(arc.promises)) {
      if (!slots.has(p.to)) bad(`${arc.id}/promise ${id}`, `made to "${p.to}", who is not in the cast`);
      if (!made.has(id)) bad(`${arc.id}/promise ${id}`, "nothing the player picks ever makes it");
      if (p.due.weeks && !(p.due.weeks[0] >= 0 && p.due.weeks[1] >= p.due.weeks[0])) bad(`${arc.id}/promise ${id}`, "a deadline must be [from, to] weeks");
    }
  }
  return out;
}
