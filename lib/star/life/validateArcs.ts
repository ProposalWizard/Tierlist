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
import type { ArcBeat, ArcOutcome, LifeArc } from "./types";
import { parseCond } from "./cond";
import { MAX_LINE, MAX_TELLTALE_LINE } from "./validate";

export interface ArcProblem { id: string; problem: string }

const MODES = ["strike-drill", "crossbar", "feed-drill"];

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
          if (!MODES.includes(a.mode)) bad(nw, `unknown game mode "${a.mode}"`);
          const rows = n.result ?? [];
          for (const [c, t] of rows) { cond(nw, c); if (!nodes[t]) bad(nw, `a result goes to "${t}", which is not a node`); to.push(t); }
          if (a.canAbandon && !rows.some(([c]) => c === "activity.abandoned")) bad(nw, "you can stop this game, but stopping goes nowhere of its own");
          if (!rows.some(([c]) => c === "")) bad(nw, "the game has no fallback result");
          if (!rows.some(([c]) => /activity\.(won|score|tens)/.test(c))) bad(nw, "no result for doing well");
          if (typeof a.dials.from === "object") cond(nw, a.dials.from.if);
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
