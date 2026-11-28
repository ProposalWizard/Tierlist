/**
 * FOLLOW-THROUGH CHECK (job G, Harry 28 Nov 2026: "'I'll see you Thursday' and then not coming and
 * seeing him when offered should do something").
 *
 *   npx tsx scripts/life/follow-through-check.mts          the list, then the counts
 *   npx tsx scripts/life/follow-through-check.mts --all    also every reply that passed, and why
 *
 * Reads every story in lib/star/life/book/arcs/*.json and lists:
 *  1. COMMITS: a reply or a card choice where you say you WILL do something later ("I'll be there",
 *     "See you Thursday", "Home by eleven", "Deal"), with no follow-up. It passes when:
 *       a. it makes a promise (the reply, or any outcome of its ending), or
 *       b. its ending schedules a later beat (`arc.next`), or sets a story value a later beat
 *          reads, and that beat can both reward you and cost you (the visit itself), or
 *       c. the act happens in the same talk (the reply leads straight to a game), or
 *       d. it is listed in follow-through-left.json with the reason it needs nothing.
 *  2. TURN-DOWNS: an invitation said no to or ignored (an invite's @send-apologies / @ignore, an
 *     offer's ifIgnored ending, or a "no" reply to someone asking you round). Every outcome of it
 *     must have a line and `snub` (a memory the first time; the second time, with anyone, costs
 *     more: lib/star/life/snubs.ts).
 *  3. PROMISES: every promise's kept outcome gives something (a person's numbers, an item, a bar),
 *     and its broken outcome is felt: a line, a person's numbers down and a memory of strength 2+.
 *     A promise broken by an ending (due at a beat) may carry the cost on that ending instead.
 *
 * Exit 1 when anything is listed without a reason.
 */
import fs from "node:fs";
import path from "node:path";
import type { ArcBeat, ArcOutcome, LifeArc } from "../../lib/star/life/types";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const DIR = path.join(ROOT, "lib/star/life/book/arcs");
/** Replies that need nothing, with the reason (follow-through-left.json; any follow-through-left.*.json is read too). */
const LEFT: Record<string, string> = Object.assign({}, ...fs.readdirSync(path.join(ROOT, "scripts/life")).filter((f) => /^follow-through-left(\..+)?\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/life", f), "utf8"))));
const ALL = process.argv.includes("--all");

/** You say you will do something later (or agree to a plan). */
export const COMMIT = new RegExp(
  [
    String.raw`\bI'?ll (be (there|in|at|round|back|ready|over)|come|go\b|go (and|to|round|over|back|in)|see (him|her|them|you)|pop|visit|turn up|bring|ring|call|text|write|sort|get (you|him|her|them|it|a|the|some)|send|drop|post it|do (it|that|the)|pay (him|her|them|the|it|you|for|his)|take (him|her|them)|lend|find|ask|talk to|have a word|put a word|look after|feed|run|coach|ref|hand it in|try|buy|swap|give|show|stand|carry|cover|watch the|make sure|fix|practise|tell (him|her|them)|keep (it|an eye))`,
    String.raw`\bI will\b`, String.raw`\bI'm (coming|in\b|going to)`, String.raw`\bI promise\b`, String.raw`\bPromise\b`, String.raw`\bcount me in\b`,
    String.raw`\bdeal( me in)?\b`, String.raw`\byou're on\b`, String.raw`\bsee you (on|at|then|there|in|tomorrow|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday|after)`,
    String.raw`\bhome by\b`, String.raw`\bnext (time|week)\b`, String.raw`\byou've my word\b`, String.raw`\bwe'?ll (go|do|share|get|keep|paint)`,
    String.raw`\bsay yes\b`, String.raw`\bagree to\b`, String.raw`\bgo and see\b`,
  ].join("|"),
  "i",
);
/** Words that look like a commitment but are not one. */
const NOT_COMMIT = /\b(I'll (leave it|think|pass|see\.|see what|watch\b(?! the)|wait|play music|score|say|have the|call what|stay on|just|only let)|I won't\b(?!\. (I'll|Promise))|can't promise|we'll see|then we'll see|I'm not)\b/i;

/** Somebody asks you round, out, along. */
const INVITE = /\b(come (round|over|to|along|for|and|with|up|in for)|coming (round|over|to|along|on)|you coming|are you coming|fancy (a|coming|it|joining|some)|join (us|me)|pop (round|in|over|by)|will you come|want to come|you're invited|round for (tea|dinner|your)|can you come|would you come|be there\?|you'll come|wondered if you'd)/i;
/** You say no (or nothing). */
const DECLINE = /^"?(no\b|not (this|tonight|today|now|this time|for me)|can't|I can't|another time|maybe (next|another)|I'll pass|next time|busy|too (much|busy)|no thanks|I'd rather not|sorry, (I|can't|no))|\b(can't make it|another time|I'll pass|rain check|not this time|give it a miss)\b/i;

type Hit = { key: string; arc: string; what: string; label: string; why?: string };
const missing: Hit[] = [], passed: Hit[] = [], explained: Hit[] = [];
const turnDowns: Hit[] = [], promiseBad: Hit[] = [];
let commits = 0, invites = 0, promiseCount = 0;

const outcomesOf = (b: ArcBeat): [string, ArcOutcome[]][] => [
  ...Object.entries(b.event.talk?.ends ?? {}),
  ...(b.event.choices ?? []).map((c) => [`choice:${c.id}`, c.outcomes] as [string, ArcOutcome[]]),
];
const costs = (o: ArcOutcome) => (o.npc ?? []).some((d) => (d.bond ?? 0) < 0 || (d.respect ?? 0) < 0 || (d.grudge ?? 0) > 0)
  || Object.entries(o.effects ?? {}).some(([, v]) => typeof v === "number" && v < 0) || !!o.promiseBroken?.length || !!o.snub;
const gives = (o: ArcOutcome) => (o.npc ?? []).some((d) => (d.bond ?? 0) > 0 || (d.respect ?? 0) > 0)
  || Object.entries(o.effects ?? {}).some(([, v]) => typeof v === "number" && v > 0) || !!o.give || !!o.unlock || !!o.train;
const felt = (o: ArcOutcome | undefined) => !!o && !!o.text?.trim() && (o.remember ?? []).some((r) => r.strength >= 2) && costs(o);

/** A beat that can both reward and cost: the follow-up itself. */
function followBeat(arc: LifeArc, id: string): boolean {
  const b = arc.beats.find((x) => x.id === id);
  if (!b) return false;
  const outs = outcomesOf(b).flatMap(([, o]) => o);
  const ign = b.event.entry?.ifIgnored ? (b.event.talk?.ends[b.event.entry.ifIgnored] ?? []) : [];
  return outs.some(gives) && (outs.some(costs) || ign.some(costs));
}
/** Later beats that read a story value. */
function readers(arc: LifeArc, key: string): string[] {
  const re = new RegExp(`arc\\.${key}\\b`);
  return arc.beats.filter((b) => JSON.stringify([b.requires, b.event.trigger.requires, b.event.setup, outcomesOf(b).map(([, o]) => o.map((x) => x.if))]).match(re)).map((b) => b.id);
}
function followedUp(arc: LifeArc, b: ArcBeat, outs: ArcOutcome[], replyVar: Record<string, unknown> | undefined, promise?: string): string | null {
  if (promise || outs.some((o) => o.promise)) return "makes a promise";
  for (const o of outs) if (o.arc?.next && o.arc.next !== b.id && followBeat(arc, o.arc.next)) return `the visit is beat ${o.arc.next}`;
  const keys = [...Object.keys(replyVar ?? {}), ...outs.flatMap((o) => Object.keys(o.arc?.set ?? {}))];
  for (const k of keys) for (const r of readers(arc, k)) if (r !== b.id && followBeat(arc, r)) return `beat ${r} reads arc.${k}`;
  return null;
}

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  const arc: LifeArc = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  for (const b of arc.beats) {
    const ev = b.event;
    const nodes = ev.talk?.nodes ?? {};
    // 1. Talk replies.
    for (const [nid, node] of Object.entries(nodes)) {
      const asked = (node.say ?? []).some((s) => INVITE.test(s));
      for (const r of node.replies ?? []) {
        const key = `${arc.id}/${b.id}/${nid}/${r.id}`;
        const outs = r.end ? (ev.talk?.ends[r.end] ?? []) : [];
        if (asked && (r.silent || DECLINE.test(r.label)) && r.end) {
          invites++;
          if (!outs.length || !outs.every((o) => o.snub && o.text?.trim())) {
            const h = { key, arc: arc.id, what: "turned down, no snub", label: `${(node.say ?? [])[0]?.slice(0, 60)} → ${r.label}` };
            if (LEFT[key]) explained.push({ ...h, why: LEFT[key] }); else turnDowns.push(h);
          }
          continue;
        }
        if (!COMMIT.test(r.label) || NOT_COMMIT.test(r.label)) continue;
        commits++;
        const h: Hit = { key, arc: arc.id, what: "reply", label: r.label };
        let why = followedUp(arc, b, outs, r.var, r.promise);
        if (!why && r.goto) {
          // c. the act in the same talk: the next node is a game, or every way on makes a promise.
          const n = nodes[r.goto];
          if (n?.activity) why = "the game starts in the talk";
          else if (n?.replies?.length && n.replies.every((x) => x.promise || (x.end && (ev.talk?.ends[x.end] ?? []).some((o) => o.promise)))) why = "every reply after it makes a promise";
        }
        if (why) passed.push({ ...h, why });
        else if (LEFT[key]) explained.push({ ...h, why: LEFT[key] });
        else missing.push(h);
      }
    }
    // 1b. Card choices.
    const askedCard = ev.setup.some((s) => INVITE.test(s));
    for (const c of ev.choices ?? []) {
      const key = `${arc.id}/${b.id}/choice/${c.id}`;
      if (askedCard && (c.silent || DECLINE.test(c.label))) {
        invites++;
        if (!c.outcomes.every((o) => o.snub && o.text?.trim())) {
          const h = { key, arc: arc.id, what: "turned down, no snub", label: c.label };
          if (LEFT[key]) explained.push({ ...h, why: LEFT[key] }); else turnDowns.push(h);
        }
        continue;
      }
      if (!COMMIT.test(c.label) || NOT_COMMIT.test(c.label)) continue;
      commits++;
      const h: Hit = { key, arc: arc.id, what: "choice", label: c.label };
      const why = followedUp(arc, b, c.outcomes, undefined);
      if (why) passed.push({ ...h, why });
      else if (LEFT[key]) explained.push({ ...h, why: LEFT[key] });
      else missing.push(h);
    }
    // 2. Invites and offers.
    const e = ev.entry;
    const ends = ev.talk?.ends ?? {};
    const tdKeys = [
      ...(e?.kind === "invite" ? (e.choices ?? []).filter((x) => x !== "attend").map((x) => `@${x}`) : []),
      ...(e?.kind === "offer" && e.ifIgnored ? [e.ifIgnored] : []),
    ];
    for (const k of tdKeys) {
      invites++;
      const outs = ends[k] ?? [];
      const key = `${arc.id}/${b.id}/${k}`;
      if (!outs.length || !outs.every((o) => o.snub && o.text?.trim())) {
        const h = { key, arc: arc.id, what: `${e!.kind} not taken, no snub`, label: e!.bubble ?? e!.text ?? k };
        if (LEFT[key]) explained.push({ ...h, why: LEFT[key] }); else turnDowns.push(h);
      }
    }
  }
  // 3. Promises.
  for (const [id, p] of Object.entries(arc.promises)) {
    promiseCount++;
    const key = `${arc.id}/promise/${id}`;
    const breakers = arc.beats.flatMap((b) => outcomesOf(b).flatMap(([, o]) => o)).filter((o) => o.promiseBroken?.includes(id));
    const brokenOk = felt(p.broken) || (!!p.due.beat && breakers.length > 0 && breakers.every((o) => felt(o)));
    const keptOk = !!p.kept && (gives(p.kept) || !!p.kept.remember?.length);
    if (!brokenOk || !keptOk) {
      const h = { key, arc: arc.id, what: `promise: ${!keptOk ? "keeping gives nothing" : ""}${!keptOk && !brokenOk ? "; " : ""}${!brokenOk ? "breaking is not felt (line + numbers down + memory 2+)" : ""}`, label: p.text };
      if (LEFT[key]) explained.push({ ...h, why: LEFT[key] }); else promiseBad.push(h);
    }
  }
}

const show = (title: string, list: Hit[], withWhy = false) => {
  if (!list.length) return;
  console.log(`\n${title} (${list.length})`);
  for (const h of list) console.log(`  ${h.key}\n      ${h.what}: ${h.label}${withWhy && h.why ? `\n      → ${h.why}` : ""}`);
};
show("COMMITS WITH NO FOLLOW-UP", missing);
show("TURN-DOWNS THAT DO NOTHING", turnDowns);
show("PROMISES THAT ARE NOT FELT", promiseBad);
show("LEFT, WITH A REASON", explained, true);
if (ALL) show("FOLLOWED UP", passed, true);
const stale = Object.keys(LEFT).filter((k) => !explained.some((h) => h.key === k));
if (stale.length) console.log(`\nReasons for replies that no longer need one (tidy follow-through-left.json): ${stale.join(", ")}`);
console.log(`\nCommits: ${commits} (followed up ${passed.length}, with a reason ${explained.filter((h) => h.what === "reply" || h.what === "choice").length}, missing ${missing.length})`);
console.log(`Turn-downs: ${invites} (doing nothing: ${turnDowns.length}) · Promises: ${promiseCount} (not felt: ${promiseBad.length})`);
const bad = missing.length + turnDowns.length + promiseBad.length;
console.log(bad ? `follow-through: ${bad} to fix` : "follow-through: 0 to fix");
process.exit(bad ? 1 : 0);
