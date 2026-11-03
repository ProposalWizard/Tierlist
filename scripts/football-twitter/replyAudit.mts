/**
 * REPLY AUDIT (Leo, 31 Oct 2026, round 4: "make the replies make sense").
 *
 * Reads every reply under every post and lists the ones that read wrong,
 * worst first. Two kinds of check:
 *  1. TONE: the reply's own tone (stamped by twitter/replies.ts) must fit
 *     its post's tone (twitter/tone.ts postTone + FITS).
 *  2. WORDS: an independent word list, not the one the feed uses: banter
 *     ("violation", "the accuracy", "check on … fans") under praise, praise
 *     ("he's HIM", "ballon d'or") under a bad day, doom ("refund", "has to
 *     go") under a win, the wrong manager line, a club that nobody posting
 *     about the event named, a reply said twice in one thread, video talk
 *     with no video.
 *
 *   npx tsx scripts/football-twitter/replyAudit.mts [seeds=12] [seasons=1]
 * Used by tests/star/footballTwitterReplies.mts.
 */
import { shortClub } from "../../lib/star/media/grammar";
import { primaryRivalOf } from "../../lib/star/rivalries";
import { postTone, replyFits, type Tone } from "../../lib/star/media/twitter/tone";
import { impliesVideo, hasPlayableVideo } from "../../lib/star/media/twitter/videoWords";
import type { PostReply, StoredPost } from "../../lib/star/media/types";

export interface Finding { rule: string; weight: number; post: StoredPost; tone: Tone; reply: PostReply }

const POSITIVE: Tone[] = ["praise", "award", "milestone", "contract", "farewell", "managerIn", "trophy", "goal", "poll"];
const RULES: { rule: string; weight: number; under: Tone[]; words: RegExp; unless?: RegExp }[] = [
  { rule: "banter under a good post", weight: 5, under: POSITIVE,
    words: /no chill|crying at the replies|check on .* fans|hold this l\b|\bfraud|the accuracy|brutal|rent free|who'?s telling him|deleted\?|\bratio\b|💀|chose violence/i },
  { rule: "'violation' under a post nobody was embarrassed in", weight: 5,
    under: ["praise", "award", "milestone", "contract", "farewell", "managerIn", "managerOut", "trophy", "poll", "news", "transfer", "rumour", "stats"],
    words: /violation|the disrespect/i },
  { rule: "praise under a bad day", weight: 4, under: ["badGame", "clubLoss", "relegation"],
    words: /he'?s him|is him\b|ballon d'?or|🐐|\bgoat\b|sign him|we don'?t deserve|generational|tired of pretending|best we'?ve played/i,
    // Sarcasm: a rival quoting the hype back ("'generational' they said").
    unless: /'[a-z ]+' they said|you lot wanted|they called him/i },
  { rule: "doom under a win", weight: 4, under: ["clubWin", "goal", "praise", "trophy", "award", "skill"],
    words: /refund|has to go|embarrassing|fraud|not even surprised|need to wake up|same mistakes|where was the effort|glad it'?s over|bench him/i,
    unless: /just that guy/i },
  { rule: "arrival words under a sacking", weight: 4, under: ["managerOut"], words: /give him time|welcome|decent appointment|fair go|interesting one|first job/i },
  { rule: "sacking words under an arrival", weight: 4, under: ["managerIn"], words: /about time|board out|sad way for it to end|who'?s the replacement|dressing room won/i },
  { rule: "transfer words under a match post", weight: 3, under: ["goal", "praise", "clubWin", "clubLoss", "badGame", "skill", "draw"],
    words: /what a signing|fee is mad|shirt sales|good business|sad to see him go|have got a player/i },
  { rule: "a manager line under something else", weight: 3, under: ["goal", "praise", "skill", "award", "transfer", "contract", "poll"],
    words: /the manager has to go|board need to wake up|give the next one time/i },
];

/** The old reply banks (before round 4) and every tone each one could fairly sit under. */
const OLD_FITS: Record<string, Tone[]> = {
  goodYou: ["praise", "goal", "skill", "award", "milestone"], goodYouVideo: ["goal", "skill"], badYou: ["badGame"],
  goodClub: ["clubWin", "trophy"], badClub: ["clubLoss", "relegation"], contract: ["contract"], manager: ["managerOut"],
  managerIn: ["managerIn"], transfer: ["transfer", "rumour"], hotTake: ["hotTake", "rumour"], banter: ["mock", "meme", "skill"],
  score: ["clubWin", "clubLoss", "draw", "news"], generic: ["news", "stats", "poll", "meme", "milestone", "scandal"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();

/** Every club of the game a text names (full or short name), lower case. */
function clubsIn(text: string, clubs: string[]): Set<string> {
  const t = ` ${norm(text)} `;
  const out = new Set<string>();
  for (const c of clubs) {
    for (const n of new Set([c, shortClub(c)])) if (t.includes(` ${norm(n)} `)) out.add(c);
  }
  return out;
}

/** All findings over a set of posts (every post ever made, not only the shown ones). */
export function auditReplies(posts: StoredPost[], clubs: string[], yourClub: string): { findings: Finding[]; replies: number; threads: number; toned: number } {
  const findings: Finding[] = [];
  // Clubs named by anybody posting about the same event in the same cycle.
  const named = new Map<string, Set<string>>();
  const key = (p: StoredPost) => `${p.id.split(":")[0]}|${p.eventId}`;
  for (const p of posts) {
    const k = key(p);
    const s = named.get(k) ?? new Set<string>();
    // The words, the quoted words, and who posted (a club's own account names itself).
    for (const c of clubsIn(`${p.text}\n${p.quote?.text ?? ""}\n${p.author.name}\n${p.text.replace(/#/g, " ")}`, clubs)) s.add(c);
    named.set(k, s);
  }
  // ...or anywhere in the same cycle (the match's opponent is named by the score posts).
  const cycle = new Map<string, Set<string>>();
  for (const [k, v] of named) {
    const c = k.split("|")[0];
    cycle.set(c, new Set([...(cycle.get(c) ?? []), ...v]));
  }
  const rival = primaryRivalOf(yourClub);
  let replies = 0, threads = 0, toned = 0;
  for (const p of posts) {
    if (!p.thread?.length) continue;
    threads++;
    const tone = postTone(p);
    const seen = new Set<string>();
    const ok = new Set([...(named.get(key(p)) ?? []), ...(cycle.get(p.id.split(":")[0]) ?? []), yourClub, ...(rival ? [rival] : [])]);
    for (const r of p.thread) {
      replies++;
      const add = (rule: string, weight: number) => findings.push({ rule, weight, post: p, tone, reply: r });
      const rt = (r as PostReply & { tone?: string }).tone;
      if (rt !== undefined) {
        toned++;
        // "old:<mood>": the reply pass before round 4, whose banks fit several tones each.
        const fits = rt.startsWith("old:") ? (OLD_FITS[rt.slice(4)] ?? []).some(t => replyFits(tone, t)) : replyFits(tone, rt);
        if (!fits) add(`tone: a ${rt} reply under a ${tone} post`, 6);
      }
      // An argument (a reply to a reply) is banter between the two of them, not at the post.
      for (const x of RULES) if (x.under.includes(tone) && x.words.test(r.text) && !(r.to && x.rule === "banter under a good post") && !(x.unless?.test(r.text))) add(x.rule, x.weight);
      const n = norm(r.text);
      if (seen.has(n)) add("said twice in one thread", 5);
      seen.add(n);
      for (const c of clubsIn(r.text, clubs)) if (!ok.has(c)) add(`names ${shortClub(c)}, a club nobody posting about this named`, 4);
      if (impliesVideo(r.text) && !hasPlayableVideo(p)) add("talks about a video with none", 6);
    }
  }
  return { findings, replies, threads, toned };
}

/** The audit as text: counts by rule, then the worst N. */
export function auditReport(a: ReturnType<typeof auditReplies>, worst = 30): string {
  const by = new Map<string, number>();
  for (const f of a.findings) {
    const r = f.rule.startsWith("tone:") ? "tone mismatch" : f.rule.startsWith("names ") ? "names the wrong club" : f.rule;
    by.set(r, (by.get(r) ?? 0) + 1);
  }
  const bad = new Set(a.findings.map(f => f.reply));
  const lines = [
    `${a.threads} threads, ${a.replies} replies; ${bad.size} replies flagged (${(100 * bad.size / Math.max(1, a.replies)).toFixed(1)}%)`,
    ...Array.from(by).sort((x, y) => y[1] - x[1]).map(([r, n]) => `  ${String(n).padStart(5)}  ${r}`),
    "", `WORST ${worst}:`,
  ];
  const sorted = [...a.findings].sort((x, y) => y.weight - x.weight || x.post.id.localeCompare(y.post.id));
  // One example per (post line, reply line): the same seeded moment repeats across careers.
  const shown = new Set<string>(), perPost = new Map<string, number>();
  for (const f of sorted) {
    if (shown.size >= worst) break;
    const k = `${f.post.text}|${f.reply.text}`;
    if (shown.has(k) || (perPost.get(f.post.text) ?? 0) >= 2) continue;
    shown.add(k);
    perPost.set(f.post.text, (perPost.get(f.post.text) ?? 0) + 1);
    lines.push(`- [${f.rule}] ${f.post.author.handle} (${f.post.persona ?? f.post.author.archetype}, ${f.post.eventId}, tone ${f.tone}): "${f.post.text.replace(/\n/g, " / ").slice(0, 100)}"`);
    lines.push(`    ↳ ${f.reply.handle}: "${f.reply.text}"`);
  }
  return lines.join("\n");
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const { setMediaUpdate } = await import("../../lib/star/media/updateFlags");
  const { seasonsRun, richRun, CLUBS, PLAYER } = await import("./run.mts");
  const { mediaOf } = await import("../../lib/star/media/feed");
  setMediaUpdate({ footballTwitter: true });
  const [seeds = "12", seasons = "1"] = process.argv.slice(2);
  const total = { findings: [] as Finding[], replies: 0, threads: 0, toned: 0 };
  let n = 0;
  for (let i = 0; i < Number(seeds); i++) {
    const seed = 1000 + i * 37;
    for (const run of [0, 1]) {
      const all = new Map<string, StoredPost>();
      if (run === 0) seasonsRun(Number(seasons), seed, c => { for (const p of mediaOf(c).posts) all.set(p.id, p); });
      else for (const p of mediaOf(richRun(14, seed)).posts) all.set(p.id, p);
      const a = auditReplies(Array.from(all.values()), CLUBS, PLAYER.club);
      n += all.size;
      total.findings.push(...a.findings); total.replies += a.replies; total.threads += a.threads; total.toned += a.toned;
    }
  }
  console.log(`${n} posts over ${seeds} seeded careers (${seasons} season each, plus a rich 14-match run)`);
  const only = process.env.RULE;
  if (only) total.findings = total.findings.filter(f => f.rule.includes(only));
  console.log(auditReport(total, Number(process.env.WORST ?? 40)));
}
