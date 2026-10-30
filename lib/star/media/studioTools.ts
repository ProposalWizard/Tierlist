/**
 * THE SOCIAL STUDIO'S TOOLS (Leo, 30 Oct 2026, /admin/social).
 *
 * Pure helpers for the admin page: editing posts, writing new ones, faking a
 * match or a career moment to see what the media would say, Goal of the Month
 * polls on demand, and reading/writing the media part of a save as a file.
 * The game never imports this file; the game's own hooks are in studio.ts.
 * Tests: tests/star/socialStudio.mts.
 */
import type { CareerState } from "../types";
import type {
  Archetype, CareerRecord, CustomAccount, Facts, FootballEvent, GoalKind, GotmEntry, GraphicKind,
  GraphicSpec, MatchRecord, MediaAccount, MediaState, MediaStudio, StoredPost, Subject, Tag, Trend,
} from "./types";
import { buildRoster, selfAccount } from "./accounts";
import { customAccounts, studioAccount } from "./studio";
import { clockAt } from "./schedule";
import { emptyMedia, mediaOf, previewCycle } from "./feed";
import { detectCareer, detectMatch } from "./detect";
import { absorbEvents, absorbMatch, coolThreads } from "./memory";
import { scoreCareerEvents, scoreMatchEvents } from "./importance";
import { allTemplates, type Template } from "./templates";
import { initialsOf, metricsFor, resolve, rngFor, shortClub, speak } from "./grammar";
import { sortLeague } from "../season";
import { divisionOf, leagueNameFor } from "../calendar";
import { fameOf } from "../fame";
import { describeGoal, fanVotes, goalQuality, synthKindFor, userWeightFor } from "./detect/goalOfMonth";
import { MONTH_NAMES, monthOfCareer } from "../potm";

// ── Small things ────────────────────────────────────────────────────────────

export const youName = (c: CareerState) => `${c.player.firstName} ${c.player.lastName}`;
export const leagueOf = (c: CareerState) => leagueNameFor(divisionOf(c));

/** The feed's clock: season × 10⁶ + week × 10⁴ + minutes (schedule.ts). */
export function splitClock(at: number): { season: number; week: number; minutes: number } {
  return { season: Math.floor(at / 1_000_000), week: Math.floor((at % 1_000_000) / 10_000), minutes: at % 10_000 };
}

/** "Right now" in the feed: the newest moment the Feed shows this week. */
export function nowClock(c: CareerState): number {
  return clockAt(c.season, c.week, 9_999);
}

/** The match you played last (or null before your first). */
export function lastPlayed(c: CareerState) {
  const played = c.fixtures.filter(f => f.played && !f.watch);
  return played.length ? played.reduce((a, b) => (b.week >= a.week ? b : a)) : null;
}

/** The next match you play (or null). */
export function nextFixture(c: CareerState) {
  return c.fixtures.filter(f => !f.played && !f.watch).sort((a, b) => a.week - b.week)[0] ?? null;
}

/** "Arsenal 2-1 Chelsea" for the last match, or "". */
export function lastScore(c: CareerState): string {
  const f = lastPlayed(c);
  if (!f || f.homeScore === undefined || f.awayScore === undefined) return "";
  const home = f.home ? c.player.club : f.opponent, away = f.home ? f.opponent : c.player.club;
  return `${home} ${f.homeScore}-${f.awayScore} ${away}`;
}

// ── Tokens you can drop into a post ─────────────────────────────────────────

export interface Token { token: string; label: string; value: (c: CareerState) => string }

export const TOKENS: Token[] = [
  { token: "{you}", label: "Your name", value: youName },
  { token: "{short}", label: "Your surname", value: c => c.player.lastName },
  { token: "{club}", label: "Your club", value: c => c.player.club },
  { token: "{clubShort}", label: "Club short name", value: c => shortClub(c.player.club) },
  { token: "{league}", label: "Your league", value: leagueOf },
  { token: "{position}", label: "Your position", value: c => c.player.position },
  { token: "{number}", label: "Shirt number", value: c => String(c.squadNumber ?? "") },
  { token: "{manager}", label: "Your manager", value: c => c.manager?.name ?? "the manager" },
  { token: "{lastOpponent}", label: "Last opponent", value: c => lastPlayed(c)?.opponent ?? "" },
  { token: "{nextOpponent}", label: "Next opponent", value: c => nextFixture(c)?.opponent ?? "" },
  { token: "{lastScore}", label: "Last score", value: lastScore },
  { token: "{seasonGoals}", label: "Goals this season", value: c => String(c.seasonStats?.goals ?? 0) },
  { token: "{careerGoals}", label: "Career goals", value: c => String(c.careerStats?.goals ?? 0) },
  { token: "{tablePos}", label: "League place", value: c => ordinalOf(tablePlace(c)) },
  { token: "{season}", label: "Season", value: c => String(c.season) },
  { token: "{week}", label: "Week", value: c => String(c.week) },
];

function ordinalOf(n: number): string {
  if (!n) return "";
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function tablePlace(c: CareerState): number {
  const i = sortLeague(c.league).findIndex(t => t.name === c.player.club);
  return i + 1;
}

/** Every {token} replaced with its value from the save. Unknown ones stay. */
export function fillTokens(text: string, c: CareerState): string {
  let out = text;
  for (const t of TOKENS) out = out.split(t.token).join(t.value(c));
  return out;
}

// ── Accounts ────────────────────────────────────────────────────────────────

export interface AccountRow {
  /** The game's handle (the key overrides are saved under). */
  key: string;
  /** As it looks now, with the studio's changes. */
  account: MediaAccount;
  /** The game's own version. */
  original: MediaAccount;
  custom: boolean;
  /** How many posts in the save it wrote. */
  posts: number;
}

/** Every account the feed uses: the game's cast, you, the studio's own, and any author in the save. */
export function accountRows(c: CareerState): AccountRow[] {
  const media = mediaOf(c);
  const st = media.studio;
  const count = new Map<string, number>();
  for (const p of media.posts) count.set(p.author.handle, (count.get(p.author.handle) ?? 0) + 1);
  const rows: AccountRow[] = [];
  const seen = new Set<string>();
  for (const a of [...buildRoster(c), selfAccount(c)]) {
    if (seen.has(a.handle)) continue;
    seen.add(a.handle);
    const now = studioAccount(a, st);
    rows.push({ key: a.handle, account: now, original: a, custom: false, posts: (count.get(a.handle) ?? 0) + (now.handle !== a.handle ? count.get(now.handle) ?? 0 : 0) });
  }
  for (const a of customAccounts(st)) {
    if (seen.has(a.handle)) continue;
    seen.add(a.handle);
    rows.push({ key: a.handle, account: a, original: a, custom: true, posts: count.get(a.handle) ?? 0 });
  }
  // Authors in the save the cast no longer has (an old club, a national side).
  for (const p of media.posts) {
    const h = p.author.handle;
    if (seen.has(h) || Object.values(st?.accountOverrides ?? {}).some(o => o.handle === h)) continue;
    seen.add(h);
    const a: MediaAccount = {
      id: h, handle: h, name: p.author.name, archetype: p.author.archetype, platform: p.author.platform,
      verified: p.author.verified, followers: 0,
      avatar: { initials: p.author.initials, tint: p.author.tint, tint2: p.author.tint2, glyph: p.author.glyph },
      voice: buildRoster(c)[0]?.voice ?? selfAccount(c).voice, interests: {},
    };
    rows.push({ key: h, account: studioAccount(a, st), original: a, custom: false, posts: count.get(h) ?? 0 });
  }
  return rows;
}

/** A post author from an account. */
export function authorOf(a: MediaAccount): StoredPost["author"] {
  return {
    handle: a.handle, name: a.name, archetype: a.archetype, platform: a.platform, verified: a.verified,
    initials: a.avatar.initials, tint: a.avatar.tint,
    ...(a.avatar.tint2 ? { tint2: a.avatar.tint2 } : {}),
    ...(a.avatar.glyph ? { glyph: a.avatar.glyph } : {}),
  };
}

/** A fresh custom account with sensible defaults. */
export function newCustomAccount(name: string, archetype: Archetype, handle?: string): CustomAccount {
  const clean = name.trim() || "New account";
  return {
    handle: handle?.trim() || "@" + clean.replace(/[^A-Za-z0-9_]/g, "").slice(0, 15) || "@new",
    name: clean, archetype, platform: "x", verified: false, followers: 5_000,
    avatar: { initials: initialsOf(clean), tint: "#2563eb", tint2: "#60a5fa", glyph: undefined },
  };
}

// ── The studio's settings ───────────────────────────────────────────────────

/** The media with the studio changed. A studio left with nothing in it is removed. */
export function withStudio(media: MediaState, f: (st: MediaStudio) => MediaStudio): MediaState {
  const next = f({ ...(media.studio ?? {}) });
  const clean: MediaStudio = {};
  for (const [k, v] of Object.entries(next) as [keyof MediaStudio, unknown][]) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    (clean as Record<string, unknown>)[k] = v;
  }
  const { studio: _old, ...rest } = media;
  return Object.keys(clean).length ? { ...rest, studio: clean } : rest;
}

export function careerWithMedia(c: CareerState, media: MediaState): CareerState {
  return { ...c, media };
}

// ── Posts ───────────────────────────────────────────────────────────────────

export type PostPatch = Partial<Omit<StoredPost, "id">>;

const sortPosts = (posts: StoredPost[]) => [...posts].sort((a, b) => a.at - b.at);

export function updatePosts(media: MediaState, ids: Set<string> | string[], patch: PostPatch | ((p: StoredPost) => StoredPost)): MediaState {
  const set = ids instanceof Set ? ids : new Set(ids);
  const f = typeof patch === "function" ? patch : (p: StoredPost) => ({ ...p, ...patch });
  return { ...media, posts: sortPosts(media.posts.map(p => (set.has(p.id) ? f(p) : p))) };
}

export function deletePosts(media: MediaState, ids: Set<string> | string[]): MediaState {
  const set = ids instanceof Set ? ids : new Set(ids);
  return { ...media, posts: media.posts.filter(p => !set.has(p.id)) };
}

/** Unique post id for something made in the studio. */
export function studioPostId(media: MediaState, hint = "post"): string {
  const used = new Set(media.posts.map(p => p.id));
  let i = media.posts.length + 1;
  let id = `studio:${hint}:${i}`;
  while (used.has(id)) id = `studio:${hint}:${++i}`;
  return id;
}

export function duplicatePosts(media: MediaState, ids: string[]): MediaState {
  let m = media;
  for (const id of ids) {
    const p = m.posts.find(x => x.id === id);
    if (!p) continue;
    m = { ...m, posts: sortPosts([...m.posts, { ...p, id: studioPostId(m, "copy"), at: p.at + 1, studio: true }]) };
  }
  return m;
}

export function addPosts(media: MediaState, posts: StoredPost[]): MediaState {
  let m = media;
  const out = [...m.posts];
  for (const p of posts) {
    const id = out.some(x => x.id === p.id) ? studioPostId({ ...m, posts: out }, "add") : p.id;
    out.push({ ...p, id, studio: true });
  }
  m = { ...m, posts: sortPosts(out) };
  return m;
}

/**
 * Move a post one place up or down the feed (newest first, as the phone
 * shows it), by giving it a time just past its neighbour's.
 */
export function nudgePost(media: MediaState, id: string, dir: "up" | "down"): MediaState {
  const newestFirst = [...media.posts].sort((a, b) => b.at - a.at);
  const i = newestFirst.findIndex(p => p.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= newestFirst.length) return media;
  const other = newestFirst[j];
  const at = dir === "up" ? other.at + 1 : other.at - 1;
  return updatePosts(media, [id], { at });
}

export interface PostFilter {
  text?: string;
  handle?: string;
  archetype?: Archetype | "";
  graphic?: GraphicKind | "none" | "";
  scope?: "club" | "league" | "none" | "";
  video?: boolean;
  week?: number;
  season?: number;
  flag?: "pinned" | "hidden" | "studio" | "liked" | "";
}

export function hasVideo(p: StoredPost): boolean {
  const g = p.graphic as { type?: string; clips?: unknown[]; synth?: unknown[] } | undefined;
  return !!g && (g.type === "goalVideo" || (g.type === "thumbnail" && ((g.clips?.length ?? 0) + (g.synth?.length ?? 0)) > 0));
}

export function filterPosts(posts: StoredPost[], f: PostFilter): StoredPost[] {
  const q = f.text?.trim().toLowerCase();
  return posts.filter(p => {
    if (q && !(`${p.text} ${p.author.name} ${p.author.handle} ${p.eventId}`.toLowerCase().includes(q))) return false;
    if (f.handle && p.author.handle !== f.handle) return false;
    if (f.archetype && p.author.archetype !== f.archetype) return false;
    if (f.graphic === "none" && p.graphic) return false;
    if (f.graphic && f.graphic !== "none" && p.graphic?.type !== f.graphic) return false;
    if (f.scope === "none" && p.scope) return false;
    if (f.scope && f.scope !== "none" && p.scope !== f.scope) return false;
    if (f.video && !hasVideo(p)) return false;
    const c = splitClock(p.at);
    if (f.week !== undefined && c.week !== f.week) return false;
    if (f.season !== undefined && c.season !== f.season) return false;
    if (f.flag && !p[f.flag]) return false;
    return true;
  });
}

/** A post written by hand. */
export function makePost(opts: {
  id: string; author: StoredPost["author"]; text: string; at: number; graphic?: GraphicSpec;
  scope?: "club" | "league"; metrics?: StoredPost["metrics"]; followers?: number; tags?: Tag[]; eventId?: string;
}): StoredPost {
  const rng = rngFor("studio", opts.id);
  return {
    id: opts.id, at: opts.at, author: opts.author, text: opts.text,
    ...(opts.graphic ? { graphic: opts.graphic } : {}),
    metrics: opts.metrics ?? metricsFor(opts.followers ?? 50_000, 60, rng),
    eventId: opts.eventId ?? "studio", tags: opts.tags ?? [],
    scope: opts.scope ?? "club", studio: true,
  };
}

// ── Pictures: a sensible starting point for each kind ──────────────────────

export const GRAPHIC_KINDS: { type: GraphicKind; label: string }[] = [
  { type: "scoreline", label: "Scoreline" },
  { type: "breaking", label: "Breaking news" },
  { type: "playerCard", label: "Player card" },
  { type: "statLine", label: "Stat line" },
  { type: "tableSnippet", label: "League table" },
  { type: "topScorers", label: "Top scorers" },
  { type: "teamOfTheWeek", label: "Team of the week" },
  { type: "hatTrick", label: "Hat-trick" },
  { type: "transfer", label: "Transfer" },
  { type: "trophy", label: "Trophy" },
  { type: "poll", label: "Poll" },
  { type: "potmNominees", label: "Player of the Month shortlist" },
  { type: "potmWinner", label: "Player of the Month winner" },
  { type: "goalVideo", label: "Goal video" },
  { type: "thumbnail", label: "Video thumbnail" },
  { type: "gotmPoll", label: "Goal of the Month poll" },
];

export function defaultGraphic(type: GraphicKind, c: CareerState): GraphicSpec {
  const you = youName(c), club = c.player.club;
  const last = lastPlayed(c);
  const opp = last?.opponent ?? nextFixture(c)?.opponent ?? "Opponents";
  const home = last ? (last.home ? club : opp) : club, away = last ? (last.home ? opp : club) : opp;
  const table = sortLeague(c.league);
  const mates = c.squad.filter(p => p.name !== you).slice(0, 10);
  switch (type) {
    case "scoreline": return { type, home, away, hs: last?.homeScore ?? 2, as: last?.awayScore ?? 1, competition: leagueOf(c), homeScorers: [`${c.player.lastName} 23'`], awayScorers: [] };
    case "breaking": return { type, strapline: "BREAKING", headline: `${c.player.lastName.toUpperCase()} SENDS ${shortClub(club).toUpperCase()} WILD` };
    case "playerCard": return { type, name: you, number: c.squadNumber ?? 9, position: c.player.position, rating: 8.4, rows: [{ label: "Goals", value: "2", highlight: true }, { label: "Assists", value: "1" }, { label: "Shots", value: "5" }], context: `v ${opp}` };
    case "statLine": return { type, title: `${c.player.lastName} — this season`, rows: [{ label: "Goals", value: String(c.seasonStats?.goals ?? 0), highlight: true }, { label: "Assists", value: String(c.seasonStats?.assists ?? 0) }, { label: "Apps", value: String(c.seasonStats?.appearances ?? 0) }], context: leagueOf(c) };
    case "tableSnippet": {
      const i = Math.max(0, table.findIndex(t => t.name === club));
      const from = Math.max(0, Math.min(table.length - 5, i - 2));
      return { type, highlight: club, rows: table.slice(from, from + 5).map((t, k) => ({ pos: from + k + 1, name: t.name, played: t.played, gd: t.goalsFor - t.goalsAgainst, points: t.points })) };
    }
    case "topScorers": return { type, title: `${leagueOf(c)} top scorers`, highlight: you, rows: [{ label: you, value: String(c.seasonStats?.goals ?? 0), highlight: true }, ...mates.slice(0, 3).map((m, k) => ({ label: m.name, value: String(Math.max(0, 6 - k * 2)) }))] };
    case "teamOfTheWeek": return { type, formation: "4-3-3", players: [{ name: you, position: c.player.position, note: "2 goals", isYou: true }, ...mates.slice(0, 10).map(m => ({ name: m.name, position: m.position, note: "", isYou: false }))] };
    case "hatTrick": return { type, name: you, minutes: [12, 44, 81] };
    case "transfer": return { type, player: you, from: club, to: table.find(t => t.name !== club)?.name ?? "Somewhere", fee: "£40m" };
    case "trophy": return { type, competition: leagueOf(c), club, season: c.season };
    case "poll": return { type, question: `Man of the match v ${shortClub(opp)}?`, options: [c.player.lastName, ...mates.slice(0, 2).map(m => m.name.split(" ").slice(-1)[0])], votes: [62, 25, 13] };
    case "potmNominees": return { type, month: MONTH_NAMES[monthOfCareer(c, c.week)] ?? "August", league: leagueOf(c), nominees: [{ name: you, club, goals: 5, assists: 2, isYou: true, number: c.squadNumber ?? 9, id: "you" }, ...table.filter(t => t.name !== club).slice(0, 5).map((t, k) => ({ name: `${t.name.split(" ")[0]} striker`, club: t.name, goals: 4 - (k % 3), assists: k % 2, isYou: false }))] };
    case "potmWinner": return { type, month: MONTH_NAMES[monthOfCareer(c, c.week)] ?? "August", firstName: c.player.firstName, lastName: c.player.lastName, club, goals: 6, assists: 2, isYou: true, number: c.squadNumber ?? 9 };
    case "goalVideo": return { type, title: `${c.player.lastName.toUpperCase()} | GOAL`, clips: [], synth: [madeUpGoal(c, { seed: `studio-${c.season}-${c.week}` })] };
    case "thumbnail": return { type, title: `${c.player.lastName} v ${shortClub(opp)}`, badge: "HIGHLIGHTS" };
    case "gotmPoll": return { type, pollId: `studio-gotm-${c.season}-${c.week}`, monthName: MONTH_NAMES[monthOfCareer(c, c.week)] ?? "August", entries: gotmEntriesFromLog(c, 3), fanVotes: [40, 30, 20], userWeight: 10 };
  }
}

/** A made-up goal for a video (goalClip/synth.ts): your club's next or last game. */
export function madeUpGoal(c: CareerState, o: { seed: string; kind?: "run_in" | "header" | "long_range" | "tap_in" | "penalty"; minute?: number; scorer?: string; youHome?: boolean; opponent?: string }) {
  const f = lastPlayed(c) ?? nextFixture(c);
  const opponent = o.opponent ?? f?.opponent ?? "Opponents";
  const youHome = o.youHome ?? f?.home ?? true;
  const scorer = o.scorer ?? youName(c);
  return {
    home: youHome ? c.player.club : opponent, away: youHome ? opponent : c.player.club,
    scorer, scorerShort: scorer.split(" ").slice(-1)[0], scorerHome: youHome,
    minute: o.minute ?? 67, scoreAfter: (youHome ? [1, 0] : [0, 1]) as [number, number],
    competition: leagueOf(c), season: c.season, week: c.week, seed: o.seed, ...(o.kind ? { kind: o.kind } : {}),
  };
}

// ── Goal of the Month on demand ────────────────────────────────────────────

/** Your best goals this season from the save's goal log, as poll entries. */
export function gotmEntriesFromLog(c: CareerState, n = 3): GotmEntry[] {
  const log = (c.goalLog ?? []).filter(g => g.season === c.season);
  const you = youName(c);
  return log
    .map(g => {
      const judged = { how: g.how, distance: g.distance, finish: g.finish };
      const e: GotmEntry = {
        scorer: you, scorerShort: c.player.lastName, club: g.club, isYou: true,
        detail: describeGoal(judged, shortClub(g.opponent)), quality: goalQuality(judged),
        ...(g.clipId ? { clipId: g.clipId } : {
          synth: {
            home: g.home ? g.club : g.opponent, away: g.home ? g.opponent : g.club, scorerHome: g.home,
            minute: g.minute, seed: `studio-gotm-${g.id}`, kind: synthKindFor(g.how),
          },
        }),
      };
      return e;
    })
    .sort((a, b) => b.quality - a.quality)
    .slice(0, n);
}

/** A rival's goal for a poll, made up. */
export function rivalEntry(name: string, club: string, detail: string, quality: number, seed: string): GotmEntry {
  return {
    scorer: name, scorerShort: name.split(" ").slice(-1)[0], club, isYou: false, detail, quality,
    synth: { home: club, away: "Opponents", scorerHome: true, minute: 55, seed, kind: "long_range" },
  };
}

/**
 * Open a Goal of the Month poll now: the post goes in the feed, and the poll
 * is filed with the game's own polls so it closes (and names a winner) after
 * your next match, exactly like one the game opened.
 */
export function openGotmPoll(c: CareerState, entries: GotmEntry[], author: StoredPost["author"], text: string, monthName: string): MediaState {
  const media = mediaOf(c);
  const at = nowClock(c);
  const id = `gotm-studio-${c.season}-${c.week}-${media.posts.length}`;
  const votes = fanVotes(entries, fameOf(c), id);
  const userWeight = userWeightFor(votes);
  const postId = `${id}:poll`;
  const g0 = media.gotm ?? { goals: [], rivals: {}, polls: [] };
  const post: StoredPost = {
    id: postId, at, author, text,
    graphic: { type: "gotmPoll", pollId: id, monthName, entries, fanVotes: votes, userWeight },
    metrics: metricsFor(400_000, 70, rngFor("gotm-poll", id)), eventId: "gotm-poll", tags: ["goal", "award"], scope: "club", studio: true,
  };
  return {
    ...media,
    posts: sortPosts([...media.posts, post]),
    gotm: { ...g0, polls: [...g0.polls, { id, season: c.season, month: monthOfCareer(c, c.week), monthName, postId, openedAt: clockAt(c.season, c.week, 0) - 1, entries, fanVotes: votes, userWeight }] },
  };
}

// ── Ideas: fake a match or a moment, see what the media says ───────────────

export interface MatchForm {
  opponent: string;
  home: boolean;
  competition: string;
  kind: "league" | "cup" | "europe";
  round?: string;
  us: number;
  them: number;
  yourGoals: number;
  yourAssists: number;
  rating: number;
  /** Minute of your last goal (the others spread before it). */
  lastGoalMinute: number;
  how: GoalKind;
  distance: number;
  derby: boolean;
  captain: boolean;
  starMan: boolean;
  hooked: "" | "form" | "legs";
  week: number;
}

export function defaultMatchForm(c: CareerState): MatchForm {
  const f = nextFixture(c) ?? lastPlayed(c);
  return {
    opponent: f?.opponent ?? c.league.find(t => t.name !== c.player.club)?.name ?? "Opponents",
    home: f?.home ?? true, competition: leagueOf(c), kind: "league",
    us: 2, them: 1, yourGoals: 1, yourAssists: 0, rating: 7.6, lastGoalMinute: 67,
    how: "one_on_one", distance: 12, derby: !!f?.derby, captain: false, starMan: true, hooked: "", week: c.week,
  };
}

/** A match record made from the form (record.ts's shape, without playing it). */
export function studioMatchRecord(c: CareerState, f: MatchForm, id: string): MatchRecord {
  const you = youName(c);
  const sorted = sortLeague(c.league);
  const i = sorted.findIndex(t => t.name === c.player.club);
  const me = sorted[i];
  const snap = { position: i + 1, points: me?.points ?? 0, gd: me ? me.goalsFor - me.goalsAgainst : 0 };
  const win = f.us > f.them ? 3 : f.us === f.them ? 1 : 0;
  const after = { position: snap.position, points: snap.points + win, gd: snap.gd + f.us - f.them };
  const mine = Math.min(f.yourGoals, f.us);
  const mates = c.squad.filter(p => p.name !== you).map(p => p.name);
  // Goals in time order: theirs first, then ours, yours last (a late winner reads late).
  const goals: MatchRecord["goals"] = [];
  const ourOthers = f.us - mine;
  let us = 0, them = 0;
  const timeline: { m: number; side: "us" | "them"; you: boolean }[] = [];
  for (let k = 0; k < f.them; k++) timeline.push({ m: 10 + k * 17, side: "them", you: false });
  for (let k = 0; k < ourOthers; k++) timeline.push({ m: 15 + k * 13, side: "us", you: false });
  for (let k = 0; k < mine; k++) timeline.push({ m: Math.max(1, f.lastGoalMinute - (mine - 1 - k) * 9), side: "us", you: true });
  timeline.sort((a, b) => a.m - b.m);
  const oppGoals: { minute: number; scorer: string }[] = [];
  let assistsLeft = f.yourAssists;
  for (const t of timeline) {
    if (t.side === "them") { them++; oppGoals.push({ minute: t.m, scorer: `${shortClub(f.opponent)} forward` }); continue; }
    us++;
    if (t.you) goals.push({ minute: t.m, scorer: you, isUser: true, how: f.how, distance: f.distance, scoreAfter: { us, them } });
    else {
      const scorer = mates[(goals.length * 3) % Math.max(1, mates.length)] ?? "A team-mate";
      goals.push({ minute: t.m, scorer, isUser: false, ...(assistsLeft-- > 0 ? { assist: you } : {}), scoreAfter: { us, them } });
    }
  }
  const ss = c.seasonStats ?? { goals: 0, assists: 0, appearances: 0 };
  const cs = c.careerStats ?? { goals: 0, assists: 0, appearances: 0 };
  const leader = sorted[0];
  const down = sorted[Math.max(0, sorted.length - 3)];
  return {
    id, season: c.season, week: f.week, competition: f.competition, kind: f.kind, round: f.round || undefined,
    derby: f.derby, home: f.home, neutral: false,
    club: c.player.club, opponent: f.opponent,
    clubStrength: me?.strength ?? 70, opponentStrength: c.league.find(t => t.name === f.opponent)?.strength ?? 68,
    score: { us: f.us, them: f.them }, result: f.us > f.them ? "win" : f.us === f.them ? "draw" : "loss",
    you: {
      name: you, shortName: c.player.lastName, goals: mine, assists: f.yourAssists, rating: f.rating,
      starMan: f.starMan, minutes: f.hooked ? 60 : 90, chances: mine + 2, passes: 30,
      hooked: f.hooked || null, captain: f.captain, squadNumber: c.squadNumber ?? 9, position: c.player.position,
      seasonGoals: ss.goals + mine, seasonAssists: ss.assists + f.yourAssists,
      careerGoals: cs.goals + mine, careerAssists: cs.assists + f.yourAssists,
      careerAppearances: cs.appearances + 1, clubAppearances: (c.clubAppearances ?? 0) + 1,
    },
    goals, oppGoals,
    table: {
      before: snap, after,
      leaderGap: (leader?.points ?? 0) - after.points,
      relegationGap: after.points - (down?.points ?? 0),
      matchesLeft: Math.max(0, (sorted.length - 1) * 2 - (me?.played ?? 0) - 1),
      clubs: sorted.length, relegationPlaces: 3,
    },
    context: {
      managerName: c.manager?.name ?? "The manager", conditions: "dry", fansStanding: c.relationships?.fans ?? 50,
      fame: fameOf(c), starRating: c.starRating,
    },
  };
}

export interface IdeaResult { posts: StoredPost[]; trends: Trend[]; events: FootballEvent[] }

/** What the media would post about this made-up match (every real detector runs). */
export function matchIdea(c: CareerState, f: MatchForm, seed: string): IdeaResult {
  const id = `studio-s${c.season}-w${f.week}-${seed}`;
  const record = studioMatchRecord(c, f, id);
  const media = mediaOf(c);
  const withMatch = absorbMatch(coolThreads(media.memory), record);
  const scored = scoreMatchEvents(detectMatch(record, withMatch), record, withMatch);
  const { events } = absorbEvents(withMatch, scored, { season: record.season, week: record.week });
  const out = previewCycle({ ...c, media: { ...media, memory: withMatch } }, events, record, id, "club");
  return { ...out, events };
}

export type MomentKind = CareerRecord["moment"]["kind"];

/** A starting point for each kind of career moment. */
export function defaultMoment(c: CareerState, kind: MomentKind): CareerRecord["moment"] {
  const other = sortLeague(c.league).find(t => t.name !== c.player.club)?.name ?? "Another club";
  switch (kind) {
    case "transfer": return { kind, from: c.player.club, to: other, fee: 40_000_000 };
    case "contract": return { kind, club: c.player.club, wage: 120_000, seasons: 4 };
    case "award": return { kind, award: "Young Player of the Year", detail: `${c.seasonStats?.goals ?? 0} goals`, won: true };
    case "ballon-dor": return { kind, won: true, total: 1 };
    case "manager-out": return { kind, name: c.manager?.name ?? "The manager", incoming: "Marco Bellini", reason: "results" };
    case "call-up": return { kind, nation: c.player.nationality || "England", caps: 1 };
    case "captain": return { kind, club: c.player.club };
    case "testimonial": return { kind, club: c.player.club, season: c.season };
    case "retirement": return { kind, goals: c.careerStats?.goals ?? 0, apps: c.careerStats?.appearances ?? 0, trophies: 3 };
    case "hall-record": return { kind, record: "Most goals in a season", holder: youName(c), was: 30, now: 31, unit: "goals" };
    case "casino-scandal": return { kind, story: "spotted", step: 2, bets: 6 };
    case "season-end": return { kind, position: tablePlace(c) || 1, headline: "What a season", detail: `${c.seasonStats?.goals ?? 0} goals` };
  }
}

export const MOMENT_KINDS: { kind: MomentKind; label: string }[] = [
  { kind: "transfer", label: "Transfer" }, { kind: "contract", label: "New contract" },
  { kind: "award", label: "Award" }, { kind: "ballon-dor", label: "Ballon d'Or" },
  { kind: "manager-out", label: "Manager sacked" }, { kind: "call-up", label: "International call-up" },
  { kind: "captain", label: "Made captain" }, { kind: "testimonial", label: "Testimonial" },
  { kind: "retirement", label: "Retirement" }, { kind: "hall-record", label: "Hall of Fame record" },
  { kind: "casino-scandal", label: "Casino scandal" }, { kind: "season-end", label: "Season end" },
];

/** What the media would post about this career moment. */
export function momentIdea(c: CareerState, moment: CareerRecord["moment"], seed: string): IdeaResult {
  const id = `studio-s${c.season}-w${c.week}-${moment.kind}-${seed}`;
  const media = mediaOf(c);
  const record: CareerRecord = {
    id, season: c.season, week: c.week, club: c.player.club,
    you: { name: youName(c), shortName: c.player.lastName, position: c.player.position, squadNumber: c.squadNumber ?? 0 },
    context: { fame: fameOf(c), starRating: c.starRating, fansStanding: c.relationships?.fans ?? 50 },
    moment,
  };
  const cooled = coolThreads(media.memory);
  const scored = scoreCareerEvents(detectCareer(record, cooled), cooled, fameOf(c));
  const { events } = absorbEvents(cooled, scored, { season: c.season, week: c.week });
  const out = previewCycle(c, events, null, id, "club");
  return { ...out, events };
}

/** Facts every post about you can use (detect/kit.ts base(), from the save). */
export function baseFacts(c: CareerState, opponent?: string): Facts {
  const last = lastPlayed(c);
  const opp = opponent ?? last?.opponent ?? nextFixture(c)?.opponent ?? "";
  const us = last ? (last.home ? last.homeScore : last.awayScore) ?? 0 : 0;
  const them = last ? (last.home ? last.awayScore : last.homeScore) ?? 0 : 0;
  const f: Facts = {
    player: youName(c), short: c.player.lastName, club: c.player.club, competition: leagueOf(c),
    us, them, score: `${us}-${them}`, result: us > them ? "win" : us === them ? "draw" : "loss",
    role: c.player.position, number: c.squadNumber ?? 9, season: c.season, week: c.week,
    manager: c.manager?.name ?? "The manager", seasonTotal: c.seasonStats?.goals ?? 0,
    seasonAssistTotal: c.seasonStats?.assists ?? 0, careerTotal: c.careerStats?.goals ?? 0,
    apps: c.careerStats?.appearances ?? 0, points: sortLeague(c.league).find(t => t.name === c.player.club)?.points ?? 0,
  };
  if (opp) f.opponent = opp;
  return f;
}

/** Any event you describe, run through the cast like the game's own. */
export function eventIdea(c: CareerState, e: { id: string; subject: Subject; tags: Tag[]; importance: number; facts: Facts }, seed: string, scope: "club" | "league" = "club"): IdeaResult {
  const id = `studio-s${c.season}-w${c.week}-${e.id}-${seed}`;
  const event: FootballEvent = { id: e.id, subject: e.subject, tags: e.tags, baseImportance: e.importance, importance: e.importance, facts: e.facts, window: "instant" };
  const out = previewCycle(c, [event], null, id, scope);
  return { ...out, events: [event] };
}

// ── One template, one account ──────────────────────────────────────────────

export interface TemplateInfo { id: string; archetype: Archetype; events: string[]; tags: Tag[]; body: string; slots: string[]; graphic?: GraphicKind }

const POOL = new Set(["late", "winVerb", "lossVerb", "bigWin", "bigLoss", "greatGoal", "ratingWord", "poorWord"]);

export function templateSlots(body: string): string[] {
  const out: string[] = [];
  for (const m of Array.from(body.matchAll(/\{([^}|]+)/g))) {
    const k = m[1].trim();
    if (!POOL.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

export function templateCatalogue(): TemplateInfo[] {
  return allTemplates().map((t: Template) => ({
    id: t.id, archetype: t.archetype, events: t.events ?? [], tags: t.tags ?? [], body: t.body,
    slots: templateSlots(t.body + " " + (t.threadBody ?? "")).filter(s => !s.startsWith("thread.")),
    ...(t.graphic ? { graphic: t.graphic } : {}),
  }));
}

/** Every kind of post (event id) the game's lines are written for, plus the video posts. */
export function eventKinds(): string[] {
  const s = new Set<string>(["match-highlights", "your-highlights", "gotm-poll", "gotm-winner"]);
  for (const t of allTemplates()) for (const e of t.events ?? []) s.add(e);
  return Array.from(s).sort();
}

export const ALL_TAGS: Tag[] = [
  "goal", "assist", "record", "milestone", "derby", "cup", "europe", "table", "title", "relegation", "transfer",
  "contract", "award", "drama", "shame", "keeper", "streak", "form", "debut", "manager", "international",
  "trophy", "stat", "opinion", "rumour",
];

export const ARCHETYPES: Archetype[] = [
  "club", "league", "competition", "broadsheet", "tabloid", "insider", "stats", "aggregator", "pundit", "fan", "rivalFan", "teammate", "meme",
];

/** The line written by one account, from its template and the facts given. */
export function postFromTemplate(templateId: string, account: MediaAccount, facts: Facts, at: number, id: string, scope: "club" | "league" = "club"): StoredPost | null {
  const t = allTemplates().find(x => x.id === templateId);
  if (!t) return null;
  const rng = rngFor("studio-template", id);
  const raw = resolve(t.body, facts, account.voice, rng);
  if (!raw.trim()) return null;
  const text = speak(raw, account.voice, t.tags ?? [], rng);
  return makePost({ id, author: authorOf(account), text, at, scope, followers: account.followers, eventId: t.events?.[0] ?? "studio", tags: t.tags ?? [] });
}

// ── The whole media part of a save, as a file ──────────────────────────────

export function exportMedia(c: CareerState): string {
  return JSON.stringify({ kind: "kib-social-studio", version: 1, savedAt: new Date().toISOString(), media: mediaOf(c) }, null, 1);
}

/** Reads a media file back. Null when it is not one. */
export function parseMedia(text: string): MediaState | null {
  try {
    const j = JSON.parse(text) as { kind?: string; media?: MediaState } | MediaState;
    const m = (j as { kind?: string }).kind === "kib-social-studio" ? (j as { media?: MediaState }).media : (j as MediaState);
    if (!m || typeof m !== "object" || !Array.isArray(m.posts) || !m.memory || !Array.isArray(m.trends)) return null;
    for (const p of m.posts) {
      if (!p || typeof p.id !== "string" || typeof p.at !== "number" || typeof p.text !== "string" || !p.author || !p.metrics) return null;
    }
    return { ...emptyMedia(), ...m };
  } catch {
    return null;
  }
}

/** The posts of the last match you played (its cycle). */
export function lastMatchPostIds(media: MediaState): string[] {
  const id = media.lastMatchCycleId ?? "";
  if (!id) return [];
  return media.posts.filter(p => p.id.startsWith(`${id}:`)).map(p => p.id);
}

/** A form that describes the last match you played, from what the save remembers. */
export function lastMatchForm(c: CareerState): MatchForm | null {
  const f = lastPlayed(c);
  if (!f || f.homeScore === undefined || f.awayScore === undefined) return null;
  const us = f.home ? f.homeScore : f.awayScore, them = f.home ? f.awayScore : f.homeScore;
  const goals = (c.goalLog ?? []).filter(g => g.season === c.season && g.week === f.week);
  const lastGoal = goals[goals.length - 1];
  return {
    ...defaultMatchForm(c),
    opponent: f.opponent, home: f.home, competition: f.competition ?? leagueOf(c),
    kind: f.kind === "cup" || f.kind === "playoff" ? "cup" : f.kind === "europe" ? "europe" : "league",
    round: f.round, us, them, yourGoals: f.userGoals ?? goals.length, yourAssists: f.userAssists ?? 0,
    rating: f.userRating ?? 7, lastGoalMinute: lastGoal?.minute ?? 70,
    how: (lastGoal?.how as GoalKind) ?? "one_on_one", distance: lastGoal?.distance ?? 12,
    derby: !!f.derby, week: f.week, starMan: (f.userRating ?? 0) >= 8,
  };
}
