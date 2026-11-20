/**
 * TALKS OF SEVERAL ROUNDS — Events v2 part 2a. Pure, no React.
 *
 * A talk is a small map of nodes. A node is one person speaking and 2 to 4
 * replies; a reply goes to another node or ends the talk. A node can instead
 * be an ACTIVITY: a real game mode opens (components/star/life/ActivityHost),
 * and its result (won, lost, abandoned, a score) picks the next node.
 *
 *  - The talk's mood goes up and down with your replies; later lines read it.
 *  - `set` remembers one thing you said in this talk ("snapped").
 *  - Silence is a reply, and walking away is an ending with its own result.
 *  - Nothing about a talk in progress is saved: a talk closed half-way starts again.
 *
 * The screens: each node is shown as a v1 LiveEvent (`nodeLive`), so the
 * Telltale screen and the tone dial play it unchanged.
 */
import type { CareerState } from "../types";
import type { LifeActivity, LifeChoice, LifeEvent, TalkNode, TalkReply } from "./types";
import { arcCtx, openBeat, playEnding, startNode, type ActivityResult, type BeatLive, type PlayOpts } from "./arcs";
import { allHold, holds } from "./cond";
import { cantPay, costText, lifeOf, type LiveEvent } from "./director";
import { weekOfMoney, type FactOverride } from "./facts";
import { fillLine } from "./text";
import { actionsLeft } from "../week";
import { promiseCount, MAX_OPEN_PROMISES } from "./promises";
import { rollHundred } from "./drill";

export const talkNode = (b: BeatLive): TalkNode | undefined => b.event.talk?.nodes[b.node];

/** The node as the decision screens read it: his line, your replies. */
export function nodeLive(c: CareerState, b: BeatLive, facts?: FactOverride): LiveEvent {
  const node = talkNode(b) ?? {};
  const ctx = arcCtx(c, b.arc, b, facts);
  const fill = (s: string) => fillLine(s, c, b.cast, ctx);
  // Round 1 opens with the scene (unless the round menu already showed it).
  const scene = b.round === 1 && b.event.entry?.kind !== "offer" ? b.event.setup.map(fill).filter(Boolean) : [];
  // Two lines in a row from him read as one speech: "…them." "I've…" → "…them. I've…".
  const said = (node.say ?? []).map(fill).filter(Boolean).join(" ").replace(/([.?!,])" "/g, "$1 ");
  const replies = (node.replies ?? []).filter((r) => allHold(r.requires, ctx));
  const lots = promiseCount(c) >= MAX_OPEN_PROMISES;
  const choices = replies.map((r) => {
    const ch: LifeChoice = { id: r.id, label: fill(r.label), tone: r.tone, silent: r.silent, cost: r.cost, outcomes: [] };
    const chips = costText(c, r.cost);
    if (r.promise || endMakesPromise(b, r)) chips.push(lots ? "You have a lot on" : "A promise");
    if (r.goto && b.event.talk?.nodes[r.goto]?.activity) chips.push("Plays the drill");
    return { id: r.id, label: ch.label, costText: chips, locked: cantPay(c, r.cost), choice: ch };
  });
  const event: LifeEvent = {
    ...(b.event as unknown as LifeEvent),
    id: `${b.event.id}--${b.node}`,
    speaker: node.who ?? b.event.speaker,
    screen: node.screen ?? b.event.screen,
    setup: [...scene, said].filter(Boolean),
    choices: choices.map((x) => x.choice),
    callbacks: [],
  };
  return { id: event.id, event, moment: "followUp", cast: b.cast, lines: event.setup, callbacks: [], choices, followUp: true, social: false };
}

/** Does picking this reply end the talk with a promise made? (its chip says "A promise") */
function endMakesPromise(b: BeatLive, r: TalkReply): boolean {
  if (!r.end) return false;
  return (b.event.talk?.ends[r.end] ?? []).some((o) => !!o.promise);
}

export type TalkStep =
  | { kind: "node"; live: BeatLive }
  | { kind: "activity"; live: BeatLive; activity: LifeActivity }
  | { kind: "end"; live: BeatLive; end: string };

/** Pick a reply. Mood, notes and values move; the next node, game or ending comes back. */
export function reply(c: CareerState, b: BeatLive, replyId: string): { career: CareerState; step: TalkStep } {
  const node = talkNode(b);
  const r = node?.replies?.find((x) => x.id === replyId);
  if (!r) return { career: c, step: { kind: "node", live: b } };
  let career = c;
  if (r.cost?.weekAction) career = { ...career, weekActions: Math.max(0, actionsLeft(career) - r.cost.weekAction) };
  if (r.cost?.moneyWeeks) career = { ...career, money: Math.max(0, career.money - Math.round(r.cost.moneyWeeks * weekOfMoney(career))) };
  const mood = b.mood + (r.mood ?? 0);
  const next: BeatLive = {
    ...b,
    mood,
    said: [...b.said, ...(r.set ?? [])],
    tv: { ...b.tv, ...(r.var ?? {}) },
    made: r.promise && promiseCount(career) < MAX_OPEN_PROMISES ? [...b.made, r.promise] : b.made,
    lastReply: r,
    round: b.round + 1,
    note: r.silent ? "You said nothing" : r.mood && r.mood > 0 ? "He's warming to you ▲" : r.mood && r.mood < 0 ? "He's gone cold on you ▼" : (r as { note?: string }).note,
  };
  if (r.end) return { career, step: { kind: "end", live: next, end: r.end } };
  const to = r.goto ?? "";
  next.node = to;
  const tn = next.event.talk?.nodes[to];
  if (tn?.activity) return { career, step: { kind: "activity", live: { ...next, played: true }, activity: tn.activity } };
  return { career, step: { kind: "node", live: next } };
}

/** The game is over: its result picks the next node. Its energy cost is paid. */
export function activityDone(c: CareerState, b: BeatLive, res: ActivityResult): { career: CareerState; step: TalkStep } {
  const node = talkNode(b);
  const act = node?.activity;
  let career = c;
  if (act?.cost?.energy) career = { ...career, energy: Math.max(0, Math.min(100, career.energy + act.cost.energy)) };
  const withRes: BeatLive = { ...b, activity: res, note: res.abandoned ? "You stopped" : undefined };
  const ctx = arcCtx(career, b.arc, withRes);
  const row = (node?.result ?? []).find(([cond]) => !cond || holds(cond, ctx));
  const to = row?.[1] ?? "";
  if (!to) return { career, step: { kind: "end", live: withRes, end: Object.keys(b.event.talk?.ends ?? {})[0] ?? "" } };
  return { career, step: { kind: "node", live: { ...withRes, node: to, round: b.round + 1 } } };
}

/** The night's invitation (beat 6): go, send your apologies, or don't answer. */
export function inviteAnswer(c: CareerState, b: BeatLive, answer: string, opts: PlayOpts): { career: CareerState; live?: BeatLive; ended?: ReturnType<typeof playEnding> } {
  const e = b.event.entry;
  if (answer === "attend") {
    let career = c;
    const cost = e?.cost;
    if (cost?.weekAction) career = { ...career, weekActions: Math.max(0, actionsLeft(career) - cost.weekAction) };
    const clash = e?.clash && holds(e.clash.if, arcCtx(c, b.arc));
    if (clash && e?.clash?.cost.moneyWeeks) career = { ...career, money: Math.max(0, career.money - Math.round(e.clash.cost.moneyWeeks * weekOfMoney(career))) };
    const live: BeatLive = { ...b, stage: "talk" };
    live.node = startNode(career, live);
    return { career, live };
  }
  const end = answer === "ignore" ? "@ignore" : `@${answer}`;
  return { career: c, ended: playEnding(c, b, end, opts) };
}

/** What the invite's three answers cost, in words. */
export function inviteChips(c: CareerState, b: BeatLive): Record<string, string> {
  const e = b.event.entry;
  const clash = e?.clash && holds(e.clash.if, arcCtx(c, b.arc));
  const go = [...costText(c, e?.cost), ...(clash ? costText(c, e!.clash!.cost) : [])].join(" · ");
  const breaks = (lifeOf(c).promises ?? []).some((p) => p.arc === b.arc && p.st === "open" && (p.id === "p-dens-night" || p.id === "p-dens-speech")) ? "Breaks it" : "";
  return { attend: go, "send-apologies": breaks, ignore: breaks };
}

// ── The dice: a device that cannot run the mode, a skipped week, the soak ──

export function diceActivity(c: CareerState, b: BeatLive, act: LifeActivity, rng: () => number): ActivityResult {
  if (act.mode === "strike-drill") {
    // Den's hundred: each of the ten balls against its own difficulty (drill.ts), as on the pitch.
    const fw = act.dials.from;
    const from = typeof fw === "object" ? (holds(fw.if, arcCtx(c, b.arc, b)) ? fw.then : fw.else) : fw ?? "12m";
    const r = rollHundred((c.skills as unknown as Record<string, number> | undefined)?.technique ?? 50, rng, (Number.parseFloat(from) || 12) - 12);
    return { score: r.score, tens: r.tens, won: r.score >= 5, abandoned: false, byDice: true };
  }
  const n = act.dials.balls ?? act.dials.shots ?? 10;
  const f = act.fallback ?? { stat: "technique" as const, target: 55 };
  const skill = (c.skills as unknown as Record<string, number> | undefined)?.[f.stat] ?? 50;
  const p = Math.max(0.1, Math.min(0.9, 0.5 + (skill - f.target) / 40));
  let score = 0;
  for (let i = 0; i < n; i++) if (rng() < p) score++;
  if (act.mode === "crossbar") {
    let opp = 0;
    for (let i = 0; i < n; i++) if (rng() < 0.32) opp++;
    return { score, tens: score * 10, won: score > opp, abandoned: false, oppScore: opp, byDice: true };
  }
  void b;
  return { score, tens: score * 10, won: score >= Math.ceil(n / 2), abandoned: false, byDice: true };
}

/**
 * Play a whole beat without a screen: the soak, and the test page's skip
 * (which plays your Thursdays for you). `pick` chooses a reply; the games are
 * rolled. Returns the career after the ending.
 */
export function autoBeat(c0: CareerState, arcId: string, beatId: string, opts: PlayOpts & { pick: (n: number, ids: string[]) => number; answer?: string }): { career: CareerState; end: string } | null {
  const o = openBeat(c0, arcId, beatId);
  if (!o) return null;
  let c = o.career;
  let b = o.live;
  if (b.stage === "invite") {
    const ans = opts.answer ?? ["attend", "send-apologies", "ignore"][opts.pick(3, ["attend", "send-apologies", "ignore"])];
    const r = inviteAnswer(c, b, ans, opts);
    if (r.ended) return { career: r.ended.career, end: ans };
    c = r.career; b = r.live!;
  }
  if (b.stage === "card") {
    const live = cardLive(c, b, opts.facts);
    const open = live.choices.filter((x) => !x.locked);
    if (!open.length) return { career: c, end: "" };
    const ch = open[opts.pick(open.length, open.map((x) => x.id))];
    const r = playCard(c, b, ch.id, opts);
    return r ? { career: r.career, end: ch.id } : null;
  }
  for (let guard = 0; guard < 40; guard++) {
    const node = talkNode(b);
    if (!node) return { career: c, end: "" };
    const live = nodeLive(c, b, opts.facts);
    const open = live.choices.filter((x) => !x.locked);
    if (!open.length) return { career: c, end: "" };
    const pick = open[opts.pick(open.length, open.map((x) => x.id))];
    let s = reply(c, b, pick.id);
    c = s.career;
    while (s.step.kind === "activity") {
      const res = diceActivity(c, s.step.live, s.step.activity, opts.rng);
      s = activityDone(c, s.step.live, res);
      c = s.career;
    }
    if (s.step.kind === "end") {
      const r = playEnding(c, s.step.live, s.step.end, opts);
      return { career: r.career, end: s.step.end };
    }
    b = s.step.live;
  }
  return { career: c, end: "" };
}

// ── A beat on the plain card (the note in your boot, the letter) ───────────

export function cardLive(c: CareerState, b: BeatLive, facts?: FactOverride): LiveEvent {
  const ctx = arcCtx(c, b.arc, b, facts);
  const fill = (s: string) => fillLine(s, c, b.cast, ctx);
  const choices = b.event.choices.filter((ch) => allHold(ch.requires, ctx)).map((ch) => ({
    id: ch.id, label: fill(ch.label), costText: costText(c, ch.cost), locked: cantPay(c, ch.cost), choice: ch as unknown as LifeChoice,
  }));
  const event = { ...(b.event as unknown as LifeEvent), setup: b.event.setup.map(fill).filter(Boolean) };
  return { id: event.id, event, moment: "followUp", cast: b.cast, lines: event.setup, callbacks: [], choices, followUp: true, social: false };
}

export function playCard(c: CareerState, b: BeatLive, choiceId: string, opts: PlayOpts) {
  const ch = b.event.choices.find((x) => x.id === choiceId);
  if (!ch) return null;
  let career = c;
  if (ch.cost?.weekAction) career = { ...career, weekActions: Math.max(0, actionsLeft(career) - ch.cost.weekAction) };
  return playEnding(career, { ...b, lastReply: { id: ch.id, label: ch.label, tone: ch.tone } }, choiceId, opts, { choice: { ...(ch as unknown as LifeChoice), cost: undefined }, outs: ch.outcomes });
}
