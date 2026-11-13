/**
 * lib/teamRoom/atBotsServer.ts — SERVER ONLY. The hands of "bots you can @"
 * (lib/teamRoom/atBots.ts) and of the AI bots (lib/teamRoom/claudeBot.ts).
 *
 * Asked by:
 *   /api/admin/team/bots { ask: <message id> }   the asker's own browser, the moment an @bot message is sent
 *   /api/cron/patch-bot                          the 15-minute timer, as a sweep for any ask that was missed
 *   /api/admin/team/bots { run: true }           an admin opening an admin page (the same sweep)
 *
 * It reads people's messages of the last 10 minutes, works out the answers
 * still owed, and writes each as ONE row in team_bot_posts with the site's own
 * key. Asking twice answers once: it reads its own rows first, checks again
 * just before writing, and removes a double if two askers landed together.
 * A bot's row is never read as a question, so a bot never answers a bot.
 *
 * The AI bots write nothing but their own reply (and the month's running
 * total). A person's bot never makes a change: a bigger ask becomes a card its
 * owner Accepts or Declines; Accept adds ONE job to the owner's own to-do.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import { BUNDLED_JOBS, TEAM_PEOPLE, isTeamPerson, type TeamPerson } from "./config";
import type { BotRow } from "./channels";
import { channelOf, parentOf } from "./channels";
import { parseMessage } from "./extras";
import type { TeamMessage, TeamTask } from "./logic";
import { bugReports, cleanMark, type BugMark } from "./bugs";
import { fetchTeamJobs, type TeamJob } from "./jobs";
import {
  AT_BOT, alreadyAnswered, asksOwed, bugAnswer, duplicateReplies, healthAnswer, helpLine, jobsAnswer, patchAnswer, replyAsk, replyParent, replyRow, todayAnswer,
  type AskFor, type AskNote, type BotAnswer,
} from "./atBots";
import {
  CLAUDE_BOT, aiBotName, aiSettings, botOwner, brainSearch, buildRequest, canAnswerProposal, canChangeAi, capScope, claudeGate, finishReply, handoffPrompt, handoffTask, handoffTaskFor,
  handoffWhy, isAiBot, isProposal, proposalRow, proposalState, spendThisMonth, tallyRow, threadLink, wantsChange, aiSettingsRow,
  type AiBotSettings, type AiCall, type BrainNote, type Spend,
} from "./claudeBot";
import type { NewBotRow } from "./patchBot";
import BRAIN from "./brainBundle.json";

const COLS = "id, bot, channel, title, body, url, everyone, created_at, meta";
const MSG = "id, person, body, image_url, page, pinned, created_at";

/** Each patch note as the bots read it: its "what changed" lines are the titles of its fixed / added / changed items. */
export function askNotes(): AskNote[] {
  return BUILT_IN_PATCH_NOTES.map((n) => ({
    version: n.version, title: n.title, author: n.author ?? null, publishedAt: n.publishedAt, summary: n.summary,
    lines: (n.sections ?? []).filter((s) => s.kind === "fixed" || s.kind === "added" || s.kind === "changed").flatMap((s) => (s.items ?? []).map((i) => i.title)).filter(Boolean).slice(0, 8),
  }));
}

/** What the server needs from outside. Tests pass pretend ones; nothing here reaches the network by itself. */
export interface AtDeps {
  /** The AI call for a bot (null = no key set, the bot is off) and whether it is the owner's own key. */
  ai: (bot: string) => { call: AiCall | null; own: boolean };
  notes?: AskNote[];
  brain?: BrainNote[];
  jobs?: () => Promise<TeamJob[]>;
  limits?: (sb: SupabaseClient, now: Date) => Promise<{ title: string; body: string; level: string; lines: unknown } | null>;
  /** The site's own address, for links in a handed-on job. */
  origin?: string;
}

export interface AtRun { ok: boolean; answered: number; text: string; error?: string }

async function allRows(sb: SupabaseClient): Promise<BotRow[]> {
  const { data, error } = await sb.from("team_bot_posts").select(COLS).order("id", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as BotRow[];
}

async function write(sb: SupabaseClient, row: NewBotRow): Promise<BotRow> {
  const { data, error } = await sb.from("team_bot_posts").insert(row).select(COLS).single();
  if (error) throw new Error(error.message);
  return data as BotRow;
}

/** Settings and running totals are rows too, and the table keeps only its newest 500: write an old one again before it ages out. */
async function keepFresh(sb: SupabaseClient, rows: readonly BotRow[]) {
  const top = rows.reduce((n, r) => Math.max(n, r.id), 0);
  const newest = new Map<string, BotRow>();
  for (const r of rows) if (r.channel === CLAUDE_BOT.settingsChannel && (!newest.has(r.bot) || newest.get(r.bot)!.id < r.id)) newest.set(r.bot, r);
  for (const r of Array.from(newest.values())) {
    if (top - r.id <= 300) continue;
    const { error } = await sb.from("team_bot_posts").insert({ bot: r.bot, channel: r.channel, title: r.title, body: r.body, url: r.url, everyone: r.everyone, meta: r.meta ?? {} });
    if (!error) await sb.from("team_bot_posts").delete().eq("bot", r.bot).eq("channel", r.channel).lt("id", top);
  }
}

/* ── One answer ──────────────────────────────────────────────────────── */

type Ctx = { sb: SupabaseClient; now: Date; deps: AtDeps; rows: BotRow[]; recent: () => Promise<TeamMessage[]> };

async function ruleAnswer(c: Ctx, a: AskFor): Promise<BotAnswer> {
  const { sb, now } = c;
  if (a.bot === "patch-notes") return patchAnswer(a.words, c.deps.notes ?? askNotes(), now.getTime());
  if (a.bot === "today") {
    const since = new Date(now.getTime() - 36 * 3600_000).toISOString();
    const { data, error } = await sb.from("team_messages").select(MSG).gte("created_at", since).like("body", "[#today]%").order("id", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return todayAnswer(a.words, (data ?? []) as TeamMessage[], now.getTime());
  }
  if (a.bot === "bug") {
    const marks = await sb.from("team_bug_marks").select("*");
    const clean = ((marks.data ?? []) as Record<string, unknown>[]).map(cleanMark).filter((m): m is BugMark => !!m);
    return bugAnswer(a.words, bugReports(c.rows.filter((r) => !replyAsk(r)), clean));
  }
  if (a.bot === "jobs") {
    const { data, error } = await sb.from("team_tasks").select("id, owner, made_by, title, done_at, created_at").order("id", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    const jobs = c.deps.jobs ? await c.deps.jobs().catch(() => [] as TeamJob[]) : [];
    return jobsAnswer(a.words, a.message.person, jobs, (data ?? []) as TeamTask[], now.getTime());
  }
  if (a.bot === "health") {
    const post = c.deps.limits ? await c.deps.limits(sb, now).catch(() => null) : null;
    return healthAnswer(post);
  }
  return { text: helpLine(a.bot) };
}

/** An AI bot's answer: a plain note when it may not call the AI, a proposal card for a bigger ask, else the AI's words. */
async function aiAnswer(c: Ctx, a: AskFor): Promise<{ answer?: BotAnswer; proposal?: NewBotRow }> {
  const { now, deps } = c;
  const { call, own } = deps.ai(a.bot);
  const p = parseMessage(a.message.body);
  const channel = p.channel ?? "general";
  const settings = aiSettings(c.rows, a.bot);
  const gate = claudeGate({ bot: a.bot, rows: c.rows, asker: a.message.person, channel, now: now.getTime(), keySet: !!call, settings, ownKey: own });
  const owner = botOwner(a.bot);
  // A bigger ask is spotted by plain rules and costs nothing, so the money and speed limits do not hold its card back.
  const tier2 = !!owner && settings.handoff === "ask" && wantsChange(a.words);
  if (!gate.ok && !(tier2 && (gate.note === "rate" || gate.note === "day" || gate.note === "cap"))) return { answer: { text: gate.text, meta: { note: gate.note } } };
  if (!a.words) return { answer: { text: helpLine(owner ? "claude" : a.bot, owner ? `I'm ${owner}'s bot.` : "Ask me a question.").replace(/@Claude/g, `@${aiBotName(a.bot)}`) } };
  // Tier 2, decided by plain rules before any AI call: a change to the game, files or database is never attempted.
  if (tier2) return { proposal: proposalRow(a.bot, a.message, "it asks for a change, and a bot may not change anything", a.words) };

  const all = await c.recent();
  const parent = p.replyTo ?? a.message.id;
  const thread = all.filter((m) => m.id === parent || parentOf(m) === parent).sort((x, y) => x.id - y.id);
  const recent = all.filter((m) => channelOf(m.body) === channel && !parentOf(m) && m.id !== a.message.id).sort((x, y) => x.id - y.id);
  const notes = brainSearch(a.words, deps.brain ?? (BRAIN as BrainNote[]));
  const patchNotes = [...(deps.notes ?? askNotes())].sort((x, y) => (Date.parse(y.publishedAt) || 0) - (Date.parse(x.publishedAt) || 0)).slice(0, CLAUDE_BOT.patchNotes);
  const req = buildRequest({ bot: a.bot, question: a.words, asker: a.message.person, channel, thread, recent, notes, patchNotes, instructions: owner ? settings.instructions : "", handoff: settings.handoff });
  let res;
  try { res = await call!(req); } catch (e) {
    const plain = (e as { plain?: string }).plain;
    return { answer: { text: `I could not answer just now: ${plain ?? "the AI service had a problem. Ask again in a minute."}`, meta: { note: "error" } } };
  }
  const scope = capScope(a.bot, own);
  const done = finishReply({ text: res.text, question: a.words, notes, inputTokens: res.inputTokens, outputTokens: res.outputTokens, scope, stop: res.stop });
  const why = owner && settings.handoff === "ask" ? handoffWhy(res.text) : null;
  if (why) { const row = proposalRow(a.bot, a.message, why, a.words); return { proposal: { ...row, meta: { ...row.meta, ...done.meta } } }; }
  if (owner && handoffWhy(res.text)) done.text = `This needs more than a quick answer, and ${owner} has set me never to hand asks on. ${owner} would need to take it up in their own Claude chat.`;
  return { answer: done };
}

/**
 * Answer every @bot still owed (or only message `only`). Never throws.
 * Safe to call from two places at once.
 */
export async function answerOwed(sb: SupabaseClient, deps: AtDeps, opts: { now?: Date; only?: number } = {}): Promise<AtRun> {
  const now = opts.now ?? new Date();
  try {
    const since = new Date(now.getTime() - AT_BOT.maxAgeMs).toISOString();
    let q = sb.from("team_messages").select(MSG).gte("created_at", since);
    if (opts.only) q = q.eq("id", opts.only);
    const { data, error } = await q.order("id", { ascending: true }).limit(100);
    if (error) throw new Error(error.message);
    const messages = (data ?? []) as TeamMessage[];
    let rows = await allRows(sb);
    const owed = asksOwed({ messages, rows, now: now.getTime() });
    if (!owed.length) return { ok: true, answered: 0, text: opts.only && !messages.length ? "Nothing to answer: that message is older than 10 minutes, or gone." : "Nothing to answer: no @bot message of the last 10 minutes is waiting." };

    let cache: TeamMessage[] | null = null;
    const recent = async () => {
      if (cache) return cache;
      const r = await sb.from("team_messages").select(MSG).order("id", { ascending: false }).limit(300);
      cache = ((r.data ?? []) as TeamMessage[]);
      return cache;
    };
    let answered = 0;
    for (const a of owed) {
      const c: Ctx = { sb, now, deps, rows, recent };
      let row: NewBotRow;
      let spent = false;
      if (isAiBot(a.bot)) {
        const r = await aiAnswer(c, a);
        row = r.proposal ?? replyRow(a.bot, a.message, r.answer!);
        spent = row.meta.ai === true;
      } else {
        let ans: BotAnswer;
        try { ans = await ruleAnswer(c, a); } catch { ans = { text: "I could not read that just now. Ask me again in a minute." }; }
        row = replyRow(a.bot, a.message, ans);
      }
      // Someone else may have answered while this one was being worked out: look again, write, then tidy a double.
      rows = await allRows(sb);
      if (!alreadyAnswered(rows, a.bot, a.message.id)) {
        await write(sb, row);
        answered++;
        rows = await allRows(sb);
        const extra = duplicateReplies(rows);
        if (extra.length) { await sb.from("team_bot_posts").delete().in("id", extra); rows = rows.filter((r) => !extra.includes(r.id)); }
      }
      if (spent) {
        const scope = String(row.meta.scope ?? CLAUDE_BOT.bot);
        const s = spendThisMonth(rows, now, scope);
        const t = await write(sb, tallyRow(scope, s));
        await sb.from("team_bot_posts").delete().eq("bot", t.bot).eq("channel", t.channel).lt("id", t.id);
        rows = await allRows(sb);
      }
    }
    await keepFresh(sb, rows).catch(() => { /* next run */ });
    return { ok: true, answered, text: answered ? `Done: ${answered} answer${answered === 1 ? "" : "s"} posted in ${answered === 1 ? "its thread" : "their threads"}.` : "Nothing to answer: already answered." };
  } catch (e) {
    return { ok: false, answered: 0, text: "Could not answer.", error: (e as Error).message };
  }
}

/* ── The AI bots' pages ──────────────────────────────────────────────── */

export interface AiBotView { settings: AiBotSettings; keySet: boolean; ownKey: boolean; spend: Spend; today: number }

export function aiViews(rows: readonly BotRow[], deps: Pick<AtDeps, "ai">, now: Date = new Date()): Record<string, AiBotView> {
  const out: Record<string, AiBotView> = {};
  const day = now.toISOString().slice(0, 10);
  for (const bot of [CLAUDE_BOT.bot, ...TEAM_PEOPLE.map((p) => `${p.toLowerCase()}-bot`)]) {
    const { call, own } = deps.ai(bot);
    out[bot] = {
      settings: aiSettings(rows, bot), keySet: !!call, ownKey: own, spend: spendThisMonth(rows, now, capScope(bot, own)),
      today: rows.filter((r) => r.meta && (r.meta as Record<string, unknown>).ai === true && r.created_at.slice(0, 10) === day).length,
    };
  }
  return out;
}

/** Save an AI bot's settings. Only its owner may (the shared Claude: anyone on the team). */
export async function saveAiSettings(sb: SupabaseClient, bot: string, who: TeamPerson | null, patch: Partial<Pick<AiBotSettings, "enabled" | "instructions" | "channels" | "handoff">>): Promise<{ ok: true; settings: AiBotSettings } | { ok: false; error: string; status: number }> {
  if (!isAiBot(bot)) return { ok: false, error: "Which bot?", status: 400 };
  if (!who) return { ok: false, error: "Pick your name in the Team room first.", status: 403 };
  if (!canChangeAi(bot, who)) return { ok: false, error: `Only ${botOwner(bot)} can change ${aiBotName(bot)}.`, status: 403 };
  const now = aiSettings(await allRows(sb), bot);
  const next = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : now.enabled,
    instructions: typeof patch.instructions === "string" ? patch.instructions : now.instructions,
    channels: patch.channels === null ? null : Array.isArray(patch.channels) ? patch.channels.map(String) : now.channels,
    handoff: patch.handoff === "never" || patch.handoff === "ask" ? patch.handoff : now.handoff,
  };
  const saved = await write(sb, aiSettingsRow(bot, next, who));
  await sb.from("team_bot_posts").delete().eq("bot", bot).eq("channel", CLAUDE_BOT.settingsChannel).lt("id", saved.id);
  return { ok: true, settings: aiSettings([saved], bot) };
}

/* ── Tier 2: the owner's Accept or Decline ───────────────────────────── */

const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The owner pressed Accept or Decline on their bot's card. Accept writes
 * exactly ONE job into the owner's own to-do (made by the owner, never by the
 * bot in anyone else's name) and keeps the text for their Claude chat on the
 * card. Pressed twice, or by anyone but the owner, it does nothing.
 */
export async function answerProposal(sb: SupabaseClient, id: number, who: TeamPerson | null, accept: boolean, origin = ""): Promise<{ ok: true; state: string } | { ok: false; error: string; status: number }> {
  const { data, error } = await sb.from("team_bot_posts").select(COLS).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  const row = data as BotRow | null;
  if (!row || !isProposal(row)) return { ok: false, error: "That card is gone.", status: 404 };
  const owner = botOwner(row.bot);
  if (!owner || who !== owner) return { ok: false, error: `Only ${owner ?? "its owner"} can answer this.`, status: 403 };
  if (!canAnswerProposal(row, who)) return { ok: true, state: proposalState(row) };
  const meta = { ...(row.meta ?? {}) } as Record<string, unknown>;
  if (!accept) {
    await sb.from("team_bot_posts").update({ meta: { ...meta, state: "declined", answered_at: new Date().toISOString() } }).eq("id", id);
    return { ok: true, state: "declined" };
  }
  const question = String(meta.question ?? "");
  const parent = replyParent(row) ?? 0;
  const msgs = await sb.from("team_messages").select(MSG).order("id", { ascending: false }).limit(300);
  const thread = ((msgs.data ?? []) as TeamMessage[]).filter((m) => m.id === parent || parentOf(m) === parent).sort((a, b) => a.id - b.id);
  const prompt = handoffPrompt({ owner, asker: isTeamPerson(meta.by) ? meta.by : owner, question, why: String(meta.why ?? "it needs more than a quick answer"), channel: row.channel, thread, link: threadLink(origin, row.channel, parent) });
  // Mark it first, so a second press finds it answered; then the one job.
  await sb.from("team_bot_posts").update({ meta: { ...meta, state: "accepted", answered_at: new Date().toISOString(), token: token(), prompt } }).eq("id", id);
  const have = await sb.from("team_tasks").select("id, title").eq("owner", owner).order("id", { ascending: false }).limit(200);
  if (!((have.data ?? []) as { title: string }[]).some((t) => handoffTaskFor(t.title) === id)) {
    const ins = await sb.from("team_tasks").insert(handoffTask(owner, question, id));
    if (ins.error) return { ok: false, error: ins.error.message, status: 500 };
  }
  return { ok: true, state: "accepted" };
}

/**
 * A Claude chat's hook takes its owner's accepted jobs (each once): the pipe
 * from the site to a person's own Claude chat, the same way recordings reach
 * it (scripts/hooks/bot-jobs-hook.mjs → /api/dev-bot-jobs/claim).
 */
export async function claimHandoffs(sb: SupabaseClient, person: TeamPerson): Promise<{ id: number; token: string; prompt: string }[]> {
  const rows = (await allRows(sb)).filter((r) => isProposal(r) && botOwner(r.bot) === person && proposalState(r) === "accepted").sort((a, b) => a.id - b.id).slice(0, 3);
  const out: { id: number; token: string; prompt: string }[] = [];
  for (const r of rows) {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    await sb.from("team_bot_posts").update({ meta: { ...meta, state: "picked", picked_at: new Date().toISOString() } }).eq("id", r.id);
    out.push({ id: r.id, token: String(meta.token ?? ""), prompt: String(meta.prompt ?? "") });
  }
  return out;
}

/** The pipe back: the owner's Claude chat says what it did, once, and it lands in the thread under the card. */
export async function finishHandoff(sb: SupabaseClient, id: number, tok: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const { data } = await sb.from("team_bot_posts").select(COLS).eq("id", id).maybeSingle();
  const row = data as BotRow | null;
  const meta = (row?.meta ?? {}) as Record<string, unknown>;
  const owner = row ? botOwner(row.bot) : null;
  if (!row || !owner || !isProposal(row) || !tok || meta.token !== tok) return { ok: false, error: "No such job." };
  const state = proposalState(row);
  if (state !== "picked" && state !== "accepted") return { ok: false, error: "That job is already closed." };
  const words = text.replace(/\r/g, "").trim().slice(0, 1500);
  if (!words) return { ok: false, error: "Say what was done." };
  await sb.from("team_bot_posts").update({ meta: { ...meta, state: "done", done_at: new Date().toISOString() } }).eq("id", id);
  await write(sb, {
    bot: row.bot, channel: row.channel, title: `${owner}'s Claude replied`.slice(0, 200), body: words, url: null, everyone: false,
    meta: { kind: "reply", reply_to: replyParent(row), from_claude: owner, card: id, ...(meta.patch ? { patch: meta.patch } : {}) },
  });
  return { ok: true };
}

/** What the routes pass in on the live site: the real AI, the real jobs file, the real limits. */
export async function liveDeps(origin = ""): Promise<AtDeps> {
  const { keyFor, realAi } = await import("./claudeClient");
  const { readLimits } = await import("./botsServer");
  return {
    ai: (bot) => { const k = keyFor(bot); return { call: k.key ? realAi(k.key) : null, own: k.own }; },
    jobs: async () => (await fetchTeamJobs({ fetch: (u, i) => fetch(u, { ...i, cache: "no-store" }), bundled: BUNDLED_JOBS, token: process.env.GITHUB_TOKEN?.trim() || null })).jobs,
    limits: async (sb, now) => { const { post } = await readLimits(sb, now); return { title: post.title, body: post.body, level: post.level, lines: post.lines }; },
    origin,
  };
}
