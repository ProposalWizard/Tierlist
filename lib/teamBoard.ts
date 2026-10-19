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

export interface TeamBoardData {
  fetchedAt: string;
  deploy: Deploy;
  people: { person: Person; branch: string; pushes: Push[]; status?: DevStatus | null }[];
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

/* ── GitHub ───────────────────────────────────────────────────────────── */

type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const API = "https://api.github.com";
export const DEFAULT_REPO = "ProposalWizard/Tierlist";
const PUSHES_PER_BRANCH = 20;

interface GhCommit { sha: string; html_url: string; commit: { message: string; committer?: { date?: string }; author?: { date?: string } } }
interface GhPull { number: number; title: string; html_url: string; state: string; merged_at: string | null; created_at: string; updated_at: string; user?: { login?: string }; head?: { ref?: string } }
interface GhStatus { state?: string; statuses?: { context?: string; state?: string; updated_at?: string; target_url?: string }[] }

let cache: { at: number; key: string; data: TeamBoardData } | null = null;
export const CACHE_MS = 60_000;

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
}): Promise<TeamBoardData> {
  const repo = opts.repo || DEFAULT_REPO;
  const now = opts.now ?? Date.now();
  const key = `${repo}|${opts.token ? "t" : "-"}`;
  if (!opts.noCache && cache && cache.key === key && now - cache.at < CACHE_MS) return cache.data;

  const problems: string[] = [];
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const get = async <T,>(path: string, what: string): Promise<T | null> => {
    try {
      const r = await opts.fetch(`${API}${path}`, { headers });
      if (!r.ok) {
        problems.push(r.status === 403 || r.status === 429
          ? `GitHub is limiting how often we can ask (${what}). Try again in a few minutes.`
          : r.status === 401 ? `GitHub refused the site's key (${what}). Check GITHUB_TOKEN in Vercel.`
          : `GitHub answered ${r.status} for ${what}.`);
        return null;
      }
      return (await r.json()) as T;
    } catch {
      problems.push(`Could not reach GitHub for ${what}.`);
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

  const [branchCommits, pullsRaw, status, mainCommits] = await Promise.all([
    Promise.all(PEOPLE.map((p) => get<GhCommit[]>(`/repos/${repo}/commits?sha=${p}&per_page=${PUSHES_PER_BRANCH}`, `${p}'s branch`))),
    get<GhPull[]>(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=20`, "pull requests"),
    get<GhStatus>(`/repos/${repo}/commits/main/status`, "the live deploy"),
    get<GhCommit[]>(`/repos/${repo}/commits?sha=main&per_page=1`, "main"),
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

  const data: TeamBoardData = { fetchedAt: new Date(now).toISOString(), deploy, people, pulls, problems };
  if (!problems.length) cache = { at: now, key, data };
  return data;
}
