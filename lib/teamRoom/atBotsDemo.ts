/**
 * lib/teamRoom/atBotsDemo.ts — "bots you can @" in a dev build with sample
 * rows (no database, no sign-in, no AI key). The SAME sums as the live site
 * (atBots.ts, claudeBot.ts) run in this browser on the sample rows, and the
 * AI is a pretend one with canned words, so the screens can be seen and
 * clicked. Nothing leaves the browser. Never used on the live site.
 */
import type { TeamPerson } from "./config";
import type { BotRow } from "./channels";
import { channelOf, parentOf } from "./channels";
import { parseMessage } from "./extras";
import type { TeamMessage, TeamTask } from "./logic";
import { bugReports, type BugMark } from "./bugs";
import type { TeamJob } from "./jobs";
import { limitsPost } from "@/lib/backup/plan";
import { ukDay } from "./today";
import { bugAnswer, healthAnswer, helpLine, jobsAnswer, patchAnswer, replyRow, todayAnswer, type AskFor, type AskNote, type BotAnswer } from "./atBots";
import {
  CLAUDE_BOT, aiBotName, aiSettings, botOwner, brainSearch, buildRequest, capScope, claudeGate, finishReply, isAiBot, proposalRow, wantsChange,
  type AiCall, type BrainNote,
} from "./claudeBot";
import type { NewBotRow } from "./patchBot";

export interface DemoRoomBits { messages: TeamMessage[]; rows: BotRow[]; tasks: TeamTask[]; jobs: TeamJob[]; bugMarks: BugMark[] }

/** The pretend AI: canned words built from the notes it was shown. Sample only. */
const pretendAi = (notes: BrainNote[]): AiCall => async (req) => {
  const text = notes.length
    ? `${notes[0].summary} (${notes[0].id})${notes[1] ? `\n\nAlso: ${notes[1].summary} (${notes[1].id})` : ""}\n\n(Sample answer: this dev build has no AI key, so these words come straight from the notes.)`
    : "No note yet on that. I looked in the Brain notes and the 5 newest patch notes and found nothing that answers it. (Sample answer: this dev build has no AI key.)";
  return { text, inputTokens: Math.round((req.system.length + req.user.length) / 3.5), outputTokens: Math.round(text.length / 3.5), stop: "end_turn" };
};

/** One answer for a dev build: the row to add to this browser's rows. `aiOn` = pretend a key is set. */
export async function demoAnswer(room: DemoRoomBits, a: AskFor, now: Date, aiOn: boolean): Promise<NewBotRow> {
  const notes: AskNote[] = (await import("@/lib/patchNotesData")).BUILT_IN_PATCH_NOTES.map((n) => ({
    version: n.version, title: n.title, author: n.author ?? null, publishedAt: n.publishedAt, summary: n.summary,
    lines: (n.sections ?? []).filter((s) => s.kind === "fixed" || s.kind === "added" || s.kind === "changed").flatMap((s) => (s.items ?? []).map((i) => i.title)).filter(Boolean).slice(0, 8),
  }));
  let ans: BotAnswer;
  if (isAiBot(a.bot)) {
    const p = parseMessage(a.message.body);
    const channel = p.channel ?? "general";
    const settings = aiSettings(room.rows, a.bot);
    const gate = claudeGate({ bot: a.bot, rows: room.rows, asker: a.message.person as TeamPerson, channel, now: now.getTime(), keySet: aiOn, settings });
    const owner = botOwner(a.bot);
    const tier2 = !!owner && settings.handoff === "ask" && wantsChange(a.words);
    if (!gate.ok && !(tier2 && (gate.note === "rate" || gate.note === "day" || gate.note === "cap"))) ans = { text: gate.text, meta: { note: gate.note } };
    else if (!a.words) ans = { text: helpLine("claude", owner ? `I'm ${owner}'s bot.` : "Ask me a question.").replace(/@Claude/g, `@${aiBotName(a.bot)}`) };
    else if (tier2) return proposalRow(a.bot, a.message, "it asks for a change, and a bot may not change anything", a.words);
    else {
      const brain = (await import("./brainBundle.json")).default as BrainNote[];
      const found = brainSearch(a.words, brain);
      const parent = p.replyTo ?? a.message.id;
      const req = buildRequest({
        bot: a.bot, question: a.words, asker: a.message.person as TeamPerson, channel,
        thread: room.messages.filter((m) => m.id === parent || parentOf(m) === parent), recent: room.messages.filter((m) => channelOf(m.body) === channel && !parentOf(m)),
        notes: found, patchNotes: notes.slice(0, CLAUDE_BOT.patchNotes), instructions: settings.instructions, handoff: settings.handoff,
      });
      const res = await pretendAi(found)(req);
      ans = finishReply({ text: res.text, question: a.words, notes: found, inputTokens: res.inputTokens, outputTokens: res.outputTokens, scope: capScope(a.bot, false), stop: res.stop });
    }
  } else if (a.bot === "patch-notes") ans = patchAnswer(a.words, notes, now.getTime());
  else if (a.bot === "bug") ans = bugAnswer(a.words, bugReports(room.rows, room.bugMarks));
  else if (a.bot === "today") ans = todayAnswer(a.words, room.messages, now.getTime());
  else if (a.bot === "jobs") ans = jobsAnswer(a.words, a.message.person as TeamPerson, room.jobs, room.tasks, now.getTime());
  else {
    const post = limitsPost({ day: ukDay(now).day, dbBytes: 371 * 1048576, storageBytes: 412 * 1048576, r2: { total: 1.2 * 1073741824, folders: [{ folder: "patch-notes", bytes: 700 * 1048576 }, { folder: "backups", bytes: 320 * 1048576 }] }, backup: null, notes: ["sample numbers: a dev build cannot read the real sizes"] });
    ans = healthAnswer({ title: post.title, body: post.body, level: post.level, lines: post.lines });
  }
  return replyRow(a.bot, a.message, ans);
}
