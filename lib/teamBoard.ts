/**
 * lib/teamBoard.ts — what the team board (/admin/team) shows.
 *
 * Harry, 18 Oct 2026: "the team board has to be its own full page with fully
 * made UI … link the appropriate patch notes with the correct pushes, like
 * when you click into it you can link straight to it."
 *
 * Everything comes from GitHub (no table, no secret beyond the GITHUB_TOKEN
 * Vercel already has): each person's branch, the pull requests (named by who
 * opened them, because every commit's author is "Claude"), and whether main
 * deployed. The live progress bars (a Stop hook posting to a table) are the
 * second half of docs/plans/2026-10-15/teamboard.md and are not built yet.
 *
 * The pure parts (who a PR belongs to, which patch note a push went out in)
 * are exported for tests/star/teamBoard.mts. fetchTeamBoard takes its fetch
 * as an argument so the test never reaches the network.
 */

import type { PatchNote } from "./patchNotes";
import type { DevStatus } from "./devStatus";

export type Person = "Harry" | "Mikey" | "Leo";
export const PEOPLE: Person[] = ["Harry", "Mikey", "Leo"];

/** GitHub login → person. Every commit is authored "Claude", so the PR opener is the only name on GitHub. */
export const LOGIN_PERSON: Record<string, Person> = {
  "harryv2157-dev": "Harry",
  ProposalWizard: "Mikey",
  LeoVassiliou: "Leo",
};

export interface PatchLink {
  version: string;
  title: string;
  artifactUrl: string | null;
  /** "named" = the push names the version; "time" = it is the person's next note after the push. */
  how: "named" | "time";
}

export interface Push {
  sha: string;
  /** First line of the message. */
  title: string;
  /** The rest of the message, attribution lines removed. */
  body: string;
  at: string;
  branch: string;
  person: Person | null;
  url: string;
  /** The claude.ai session that made it, when the message carries one. */
  session: string | null;
  patch: PatchLink | null;
}

export interface PullRequest {
  number: number;
  title: string;
  person: Person | null;
  login: string;
  branch: string;
  state: "open" | "merged" | "closed";
  at: string;
  url: string;
}

export interface Deploy {
  state: "success" | "pending" | "failure" | "unknown";
  at: string | null;
  sha: string | null;
  title: string | null;
  url: string | null;
}

/**
 * One person's pushes, from GitHub's push log (B13, 20 Oct 2026).
 *
 * "N pushes this week" used to count the newest 20 commits on the person's
 * branch, so it could never pass 20 (Harry made about 120 that week), and it
 * counted other people's work that came in when main was merged into the
 * branch. Now it is the number of times the person pushed to GitHub in the
 * last 7 days, on any branch, read from GitHub's own push log, which names
 * who pushed.
 */
export interface PushCount {
  /** Pushes in the last 7 days. */
  week: number;
  /** Pushes a day for 14 days, oldest first; null = before the log starts. */
  days: (number | null)[];
  /** False when the log does not reach back 7 days (then `week` is "at least"). */
  weekComplete: boolean;
  /** The newest push, any branch. */
  last: string | null;
}

export interface TeamBoardData {
  fetchedAt: string;
  deploy: Deploy;
  people: { person: Person; branch: string; pushes: Push[]; status?: DevStatus | null; count?: PushCount | null }[];
  /** How far back GitHub's push log reaches (null = it could not be read). */
  pushLogFrom?: string | null;
  /** Live bars switched on (the dev_status table is there). */
  statusOn?: boolean;
  pulls: PullRequest[];
  /** Plain-English problems (GitHub down, rate limit). Empty when all is well. */
  problems: string[];
}

/* ── Pure helpers ─────────────────────────────────────────────────────── */

/** Whose patch note is this? Titles start "Harry's patch notes", "Leo's patch notes", "Mikey's patch notes". */
export function noteOwner(note: Pick<PatchNote, "title">): Person | null {
  const m = /^(Harry|Mikey|Leo)['’]s patch notes/i.exec(note.title.trim());
  if (!m) return null;
  const n = m[1].toLowerCase();
  return n === "harry" ? "Harry" : n === "mikey" ? "Mikey" : "Leo";
}

/** A branch named after a person, else the PR opener's login. */
export function personFor(branch: string, login?: string | null): Person | null {
  const b = PEOPLE.find((p) => p.toLowerCase() === branch.toLowerCase());
  if (b) return b;
  return (login && LOGIN_PERSON[login]) || null;
}

/** How long after a note's go-live time a push still counts as part of it (late fixes to the same version). */
export const NOTE_GRACE_MS = 2 * 3600_000;
/** A push more than this long before the person's next note is not linked to it. */
export const NOTE_REACH_MS = 4 * 24 * 3600_000;

/**
 * Which patch note did this push go out in?
 *  1. The message names a version ("v0.55", "Patch notes v0.16") that is one
 *     of this person's notes, by site number or by the number in the title.
 *  2. Otherwise: the person's first note that went live after the push (with
 *     2 hours' grace either side of go-live), if it is within 4 days.
 * null = not in any patch notes yet.
 */
export function patchFor(
  push: { person: Person | null; at: string; title: string; body?: string },
  notes: Pick<PatchNote, "version" | "title" | "publishedAt" | "artifactUrl">[],
): PatchLink | null {
  if (!push.person) return null;
  const mine = notes.filter((n) => noteOwner(n) === push.person);
  if (!mine.length) return null;
  const link = (n: (typeof mine)[number], how: PatchLink["how"]): PatchLink =>
    ({ version: n.version, title: n.title, artifactUrl: n.artifactUrl ?? null, how });

  const text = `${push.title}\n${push.body ?? ""}`;
  const named = Array.from(text.matchAll(/\bv(\d+\.\d+)\b/gi), (m) => m[1]);
  for (const v of named) {
    const hit = mine.filter((n) => n.version === v || new RegExp(`\\bv${v.replace(".", "\\.")}\\b`, "i").test(n.title));
    if (hit.length === 1) return link(hit[0], "named");
  }

  const t = Date.parse(push.at);
  if (!Number.isFinite(t)) return null;
  const after = mine
    .filter((n) => n.publishedAt && Date.parse(n.publishedAt) + NOTE_GRACE_MS >= t)
    .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt))[0];
  if (!after) return null;
  if (Date.parse(after.publishedAt) - t > NOTE_REACH_MS) return null;
  return link(after, "time");
}

/** Split a commit message into a headline, a body and its session link, dropping the attribution lines. */
export function splitMessage(message: string): { title: string; body: string; session: string | null } {
  const lines = message.replace(/\r/g, "").split("\n");
  const title = (lines.shift() ?? "").trim();
  let session: string | null = null;
  const body = lines
    .filter((l) => {
      const s = /^Claude-Session:\s*(\S+)/i.exec(l.trim());
      if (s) { session = s[1]; return false; }
      return !/^Co-Authored-By:/i.test(l.trim());
    })
    .join("\n")
    .trim();
  return { title, body, session };
}

/** Pushes per day for the last `days` days, oldest first (the little activity bars on each card). */
export function perDay(pushes: Pick<Push, "at">[], now: number, days = 7): number[] {
  const out = new Array(days).fill(0);
  const dayMs = 24 * 3600_000;
  const today = Math.floor(now / dayMs);
  for (const p of pushes) {
    const d = today - Math.floor(Date.parse(p.at) / dayMs);
    if (d >= 0 && d < days) out[days - 1 - d]++;
  }
  return out;
}

/* ── The push log ─────────────────────────────────────────────────────── */

/** One event from GitHub's repository event log (only what is used). */
export interface GhEvent {
  type: string;
  created_at: string;
  actor?: { login?: string };
  payload?: { ref?: string; head?: string };
}

export interface LoggedPush { person: Person | null; login: string; at: string; branch: string; head: string | null }

export interface PushLog {
  pushes: LoggedPush[];
  /** The oldest event the log holds (null = empty). */
  from: string | null;
  /** True when the log ran out before GitHub's limit, so nothing older is missing. */
  whole: boolean;
}

/** GitHub keeps the last 300 events (3 pages of 100). */
export const EVENT_PAGES = 3;
export const EVENTS_PER_PAGE = 100;

/** The push events in GitHub's event log, and who pushed each. */
export function pushLog(events: GhEvent[], whole: boolean): PushLog {
  const pushes: LoggedPush[] = [];
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const login = e.actor?.login ?? "";
    pushes.push({
      person: LOGIN_PERSON[login] ?? null, login, at: e.created_at,
      branch: (e.payload?.ref ?? "").replace(/^refs\/heads\//, ""), head: e.payload?.head ?? null,
    });
  }
  const times = events.map((e) => Date.parse(e.created_at)).filter(Number.isFinite);
  return { pushes, from: times.length ? new Date(Math.min(...times)).toISOString() : null, whole };
}

/** One person's pushes from the log: the last 7 days, and per day for 14. */
export function pushCount(log: PushLog, person: Person, now: number): PushCount {
  const mine = log.pushes.filter((p) => p.person === person);
  const week = mine.filter((p) => now - Date.parse(p.at) < 7 * 86400_000).length;
  const from = log.from ? Date.parse(log.from) : now;
  const dayMs = 86400_000;
  const days: (number | null)[] = perDay(mine, now, 14);
  if (!log.whole) {
    // Days the log does not reach are unknown, not empty.
    const today = Math.floor(now / dayMs);
    for (let i = 0; i < days.length; i++) {
      const day = today - (days.length - 1 - i);
      if ((day + 1) * dayMs <= from) days[i] = null;
    }
  }
  const last = mine.reduce<string | null>((a, p) => (!a || Date.parse(p.at) > Date.parse(a) ? p.at : a), null);
  return { week, days, weekComplete: log.whole || from <= now - 7 * dayMs, last };
}

/**
 * Which person each Claude chat (session) belongs to: the person who pushed
 * the commits it made. Every commit is authored "Claude", so the push log is
 * the one place a name is recorded. Most votes wins.
 */
export function sessionOwners(pushes: LoggedPush[], sessionOf: (sha: string) => string | null): Map<string, Person> {
  const votes = new Map<string, Map<Person, number>>();
  for (const p of pushes) {
    if (!p.person || !p.head) continue;
    const s = sessionOf(p.head);
    if (!s) continue;
    const v = votes.get(s) ?? new Map<Person, number>();
    v.set(p.person, (v.get(p.person) ?? 0) + 1);
    votes.set(s, v);
  }
  const out = new Map<string, Person>();
  votes.forEach((v, s) => out.set(s, Array.from(v.entries()).sort((a, b) => b[1] - a[1])[0][0]));
  return out;
}

/**
 * The commits on a person's branch that are their own work: made in one of
 * their own chats, or (a chat the log does not know) not on main. Leaves out
 * other people's work that came in when main was merged into the branch.
 */
export function ownWork(commits: Push[], person: Person, owners: Map<string, Person>, onMain: Set<string>): Push[] {
  return commits.filter((c) => {
    const owner = c.session ? owners.get(c.session) : undefined;
    if (owner) return owner === person;
    return !onMain.has(c.sha);
  });
}

/* ── GitHub ───────────────────────────────────────────────────────────── */

type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const API = "https://api.github.com";
export const DEFAULT_REPO = "ProposalWizard/Tierlist";
const PUSHES_PER_BRANCH = 100;

interface GhCommit { sha: string; html_url: string; commit: { message: string; committer?: { date?: string }; author?: { date?: string } } }
interface GhPull { number: number; title: string; html_url: string; state: string; merged_at: string | null; created_at: string; updated_at: string; user?: { login?: string }; head?: { ref?: string } }
interface GhStatus { state?: string; statuses?: { context?: string; state?: string; updated_at?: string; target_url?: string }[] }

let cache: { at: number; key: string; data: TeamBoardData } | null = null;
export const CACHE_MS = 60_000;

/**
 * Where the site's GitHub key comes from, for the message when GitHub
 * refuses it (B13, 20 Oct 2026). On the live site it is GITHUB_TOKEN in
 * Vercel. A local test build reads GITHUB_TOKEN from the computer running it,
 * which is not the site's key at all, so "Check GITHUB_TOKEN in Vercel" sent
 * people to fix something that was not broken.
 */
export type KeyPlace = "live" | "local";

export function keyRefusedLine(where: KeyPlace): string {
  return where === "live"
    ? "GitHub refused the site's key (GITHUB_TOKEN in Vercel), so the board asked without it. That works, but only about 60 times an hour. Ask Harry to renew the key."
    : "This is a local test build: GitHub refused the GITHUB_TOKEN on this computer, so the board asked without a key. The live site uses its own key from Vercel; this says nothing about that one.";
}

/**
 * Read the board from GitHub. Never throws: anything that fails becomes a
 * line in `problems` and the rest of the board still shows.
 */
export async function fetchTeamBoard(opts: {
  fetch: Fetch;
  notes: Pick<PatchNote, "version" | "title" | "publishedAt" | "artifactUrl">[];
  token?: string | null;
  repo?: string;
  now?: number;
  noCache?: boolean;
  /** Where the key came from (default "live"). See keyRefusedLine. */
  where?: KeyPlace;
}): Promise<TeamBoardData> {
  const repo = opts.repo || DEFAULT_REPO;
  const now = opts.now ?? Date.now();
  const key = `${repo}|${opts.token ? "t" : "-"}`;
  if (!opts.noCache && cache && cache.key === key && now - cache.at < CACHE_MS) return cache.data;

  // Problems by kind, so six failed reads make one line, not six.
  const limited: string[] = [];
  const unreachable: string[] = [];
  const other: string[] = [];
  let keyRefused = false;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const get = async <T,>(path: string, what: string): Promise<T | null> => {
    try {
      const sent = { ...headers };
      let r = await opts.fetch(`${API}${path}`, { headers: sent });
      // A refused key: the repository is public, so ask again without it,
      // and leave it off every read after this one.
      if (r.status === 401 && sent.Authorization) {
        keyRefused = true;
        delete headers.Authorization;
        const bare = { ...sent };
        delete bare.Authorization;
        r = await opts.fetch(`${API}${path}`, { headers: bare });
      }
      if (!r.ok) {
        if (r.status === 403 || r.status === 429) limited.push(what);
        else other.push(`GitHub answered ${r.status} for ${what}.`);
        return null;
      }
      return (await r.json()) as T;
    } catch {
      unreachable.push(what);
      return null;
    }
  };

  const toPush = (c: GhCommit, branch: string, person: Person | null): Push => {
    const m = splitMessage(c.commit.message);
    const at = c.commit.committer?.date ?? c.commit.author?.date ?? "";
    const p: Push = { sha: c.sha, title: m.title, body: m.body, at, branch, person, url: c.html_url, session: m.session, patch: null };
    p.patch = patchFor(p, opts.notes);
    return p;
  };

  // GitHub's push log, newest first, up to 300 events: stop once it reaches
  // back two weeks (the activity chart) or runs out.
  const events: GhEvent[] = [];
  let logRead = true;
  let whole = false;
  const readLog = async () => {
    for (let page = 1; page <= EVENT_PAGES; page++) {
      const got = await get<GhEvent[]>(`/repos/${repo}/events?per_page=${EVENTS_PER_PAGE}&page=${page}`, "the push log");
      if (!got) { logRead = page > 1; return; }
      events.push(...got);
      if (got.length < EVENTS_PER_PAGE) { whole = true; return; }
      const oldest = Math.min(...got.map((e) => Date.parse(e.created_at)).filter(Number.isFinite));
      if (oldest < now - 14 * 86400_000) { whole = true; return; }
    }
  };

  const [branchCommits, pullsRaw, status, mainCommits] = await Promise.all([
    Promise.all(PEOPLE.map((p) => get<GhCommit[]>(`/repos/${repo}/commits?sha=${p}&per_page=${PUSHES_PER_BRANCH}`, `${p}'s branch`))),
    get<GhPull[]>(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=20`, "pull requests"),
    get<GhStatus>(`/repos/${repo}/commits/main/status`, "the live deploy"),
    get<GhCommit[]>(`/repos/${repo}/commits?sha=main&per_page=${PUSHES_PER_BRANCH}`, "main"),
    readLog(),
  ]);

  const pulls: PullRequest[] = (pullsRaw ?? []).map((p) => ({
    number: p.number,
    title: p.title,
    login: p.user?.login ?? "",
    branch: p.head?.ref ?? "",
    person: personFor(p.head?.ref ?? "", p.user?.login),
    state: p.merged_at ? "merged" : p.state === "open" ? "open" : "closed",
    at: p.merged_at ?? p.updated_at ?? p.created_at,
    url: p.html_url,
  }));

  const people = PEOPLE.map((person, i) => ({
    person,
    branch: person,
    pushes: (branchCommits[i] ?? []).map((c) => toPush(c, person, person)),
  }));

  // Work on a branch not named after anyone (Leo's v0.16 came from a claude/… branch):
  // add the commits of their open PRs so it shows before it merges.
  const strays = pulls.filter((p) => p.state === "open" && p.person && !PEOPLE.includes(p.branch as Person)).slice(0, 3);
  const strayCommits = await Promise.all(strays.map((p) => get<GhCommit[]>(`/repos/${repo}/pulls/${p.number}/commits?per_page=20`, `PR #${p.number}`)));
  strays.forEach((p, i) => {
    const card = people.find((x) => x.person === p.person)!;
    const seen = new Set(card.pushes.map((x) => x.sha));
    for (const c of strayCommits[i] ?? []) if (!seen.has(c.sha)) card.pushes.push(toPush(c, p.branch, p.person));
    card.pushes.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  });

  // Each card keeps its own work only (B13): a commit that came in when main
  // was merged into the branch belongs to whoever pushed it first.
  const log = logRead ? pushLog(events, whole) : null;
  const sessionBySha = new Map<string, string | null>();
  for (const c of [...branchCommits.flat(), ...(mainCommits ?? [])]) {
    if (c) sessionBySha.set(c.sha, splitMessage(c.commit.message).session);
  }
  const owners = log ? sessionOwners(log.pushes, (sha) => sessionBySha.get(sha) ?? null) : new Map<string, Person>();
  const onMain = new Set((mainCommits ?? []).map((c) => c.sha));
  const cards = people.map((c) => ({
    ...c,
    pushes: ownWork(c.pushes, c.person, owners, onMain),
    count: log ? pushCount(log, c.person, now) : null,
  }));

  const vercel = status?.statuses?.find((s) => /vercel/i.test(s.context ?? ""));
  const head = mainCommits?.[0];
  const st = vercel?.state ?? status?.state;
  const deploy: Deploy = {
    state: st === "success" ? "success" : st === "pending" ? "pending" : st === "failure" || st === "error" ? "failure" : "unknown",
    at: vercel?.updated_at ?? head?.commit.committer?.date ?? null,
    sha: head?.sha ?? null,
    title: head ? splitMessage(head.commit.message).title : null,
    url: vercel?.target_url ?? null,
  };

  const list = (xs: string[]) => Array.from(new Set(xs)).join(", ");
  const problems: string[] = [
    ...(keyRefused ? [keyRefusedLine(opts.where ?? "live")] : []),
    ...(limited.length ? [`GitHub is limiting how often we can ask (${list(limited)}). Try again in a few minutes.${opts.token && !keyRefused ? "" : " Without a working key GitHub allows about 60 asks an hour."}`] : []),
    ...(unreachable.length ? [`Could not reach GitHub for ${list(unreachable)}.`] : []),
    ...Array.from(new Set(other)),
  ];
  const data: TeamBoardData = {
    fetchedAt: new Date(now).toISOString(), deploy, people: cards, pulls, problems,
    pushLogFrom: log?.from ?? null,
  };
  // A refused key is not a passing fault: keep the answer for a minute anyway.
  if (!limited.length && !unreachable.length && !other.length) cache = { at: now, key, data };
  return data;
}
