/**
 * lib/teamRoom/jobs.ts — jobs that arrive by push (Harry, 20 Oct 2026: "why
 * are we using sql's to put stuff into the team board, just use pushes").
 *
 * A Claude session gives the team a job by editing team/jobs.json and pushing
 * its own branch (team/README.md). The site reads that file from GitHub on
 * main and on each person's branch (TEAM_ROOM.jobs), about once a minute,
 * and merges the lists by id: the newest `added` wins a clash. No SQL, no new
 * table, no deploy.
 *
 * A tick is saved in the existing team_tasks table: the person's own row,
 * titled "[job:<id>] <title>", whose done_at says done or not. Those marker
 * rows never show as jobs of their own (logic.ts hides them).
 *
 * Pure apart from fetchTeamJobs, which takes its fetch as an argument so the
 * tests (tests/star/teamRoomJobs.mts) never reach the network.
 */
import { TEAM_PEOPLE, TEAM_ROOM, isTeamPerson, type TeamPerson } from "./config";
import type { TeamTask } from "./logic";

export type JobOwner = TeamPerson | "all";
export interface TeamJob {
  /** Stable and unique: a tick is saved against it. */
  id: string;
  owner: JobOwner;
  title: string;
  /** Text to paste into your own Claude chat (null = none). */
  prompt: string | null;
  /** Who asked for it. */
  from: TeamPerson;
  /** When (ISO). The newest wins when two branches have the same id. */
  added: string;
}

export const JOB_TITLE_MAX = 200;
export const JOB_PROMPT_MAX = 4000;
const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const t = (iso: string) => Date.parse(iso) || 0;

/** The jobs in a jobs file, cleaned. Anything malformed is left out (never throws). */
export function parseJobs(raw: unknown): TeamJob[] {
  if (!Array.isArray(raw)) return [];
  const out: TeamJob[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const j = r as Record<string, unknown>;
    const id = typeof j.id === "string" ? j.id.trim() : "";
    const owner = j.owner === "all" || isTeamPerson(j.owner) ? (j.owner as JobOwner) : null;
    const title = typeof j.title === "string" ? j.title.trim().slice(0, JOB_TITLE_MAX) : "";
    const added = typeof j.added === "string" ? j.added.trim() : "";
    if (!JOB_ID.test(id) || !owner || !title || !isTeamPerson(j.from) || !Number.isFinite(Date.parse(added))) continue;
    const prompt = typeof j.prompt === "string" && j.prompt.trim() ? j.prompt.slice(0, JOB_PROMPT_MAX) : null;
    out.push({ id, owner, title, prompt, from: j.from, added });
  }
  return out;
}

/** Several lists (main first, then each branch) → one, by id. Newest `added` wins; a tie goes to the later list. Newest first. */
export function mergeJobs(lists: TeamJob[][]): TeamJob[] {
  const byId = new Map<string, TeamJob>();
  for (const list of lists) {
    for (const j of list) {
      const had = byId.get(j.id);
      if (!had || t(j.added) >= t(had.added)) byId.set(j.id, j);
    }
  }
  return Array.from(byId.values()).sort((a, b) => t(b.added) - t(a.added) || a.id.localeCompare(b.id));
}

export const jobOwners = (j: Pick<TeamJob, "owner">): TeamPerson[] => (j.owner === "all" ? [...TEAM_PEOPLE] : [j.owner]);

/* ── Ticks: marker rows in team_tasks ─────────────────────────────────── */

const MARKER = /^\[job:([A-Za-z0-9._-]{1,80})\]/;

/** The team_tasks title that marks a pushed job done or not. */
export const markerTitle = (j: Pick<TeamJob, "id" | "title">) => `[job:${j.id}] ${j.title}`.slice(0, JOB_TITLE_MAX);

/** The pushed job a team_tasks row marks, or null for an ordinary job. A marker is always your own row. */
export function markerJobId(x: Pick<TeamTask, "owner" | "made_by" | "title">): string | null {
  if (x.owner !== x.made_by) return null;
  return MARKER.exec(x.title)?.[1] ?? null;
}
export const isJobMarker = (x: Pick<TeamTask, "owner" | "made_by" | "title">) => markerJobId(x) !== null;

export interface PushedJob extends TeamJob {
  /** When you ticked it (null = still to do). */
  done_at: string | null;
  /** Your marker rows for it (normally one; none until the first tick). */
  markers: number[];
}

/** Every pushed job that is yours ("all" counts), with your tick: done if your newest marker row is. */
function yourJobs(jobs: TeamJob[], tasks: TeamTask[], me: TeamPerson): PushedJob[] {
  const mine = tasks.filter((x) => x.owner === me && x.made_by === me);
  return jobs.filter((j) => jobOwners(j).includes(me)).map((j) => {
    const marks = mine.filter((x) => markerJobId(x) === j.id).sort((a, b) => b.id - a.id);
    return { ...j, done_at: marks[0]?.done_at ?? null, markers: marks.map((x) => x.id) };
  });
}

/** Your pushed jobs: still to do (newest first), and ticked in the last day (latest first), like typed jobs. */
export function pushedFor(jobs: TeamJob[], tasks: TeamTask[], me: TeamPerson | null, now: number) {
  if (!me) return { open: [] as PushedJob[], done: [] as PushedJob[] };
  const keep = TEAM_ROOM.keepDoneHours * 3600_000;
  const all = yourJobs(jobs, tasks, me);
  return {
    open: all.filter((j) => !j.done_at).sort((a, b) => t(b.added) - t(a.added)),
    done: all.filter((j) => j.done_at && now - t(j.done_at) < keep).sort((a, b) => t(b.done_at!) - t(a.done_at!)),
  };
}

/** Pushed jobs still to do that you have not had on screen yet (the To-do badge, like a new given job). */
export function newPushedJobs(jobs: TeamJob[], tasks: TeamTask[], me: TeamPerson | null, seen: readonly string[]): number {
  if (!me) return 0;
  return yourJobs(jobs, tasks, me).filter((j) => !j.done_at && !seen.includes(j.id)).length;
}

/* ── Reading the jobs file from GitHub ────────────────────────────────── */

type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface JobsRead {
  jobs: TeamJob[];
  /** "github" = read live; "bundled" = GitHub could not be reached, so the copy built into the site. */
  from: "github" | "bundled";
  fetchedAt: string;
  /** Plain-English problems. Empty when all is well. */
  problems: string[];
}

let cache: { at: number; key: string; data: JobsRead } | null = null;

/**
 * Read the jobs file on every branch and merge. Never throws. A branch with
 * no file (or no branch) adds nothing; main with no file, or main unreadable,
 * uses the bundled copy instead; nothing readable at all → the bundled copy.
 */
export async function fetchTeamJobs(opts: {
  fetch: Fetch;
  /** The jobs file as built into the site (BUNDLED_JOBS). */
  bundled: unknown;
  token?: string | null;
  repo?: string;
  path?: string;
  branches?: readonly string[];
  now?: number;
  noCache?: boolean;
}): Promise<JobsRead> {
  const repo = opts.repo || TEAM_ROOM.jobs.repo;
  const path = opts.path || TEAM_ROOM.jobs.path;
  const branches = opts.branches ?? TEAM_ROOM.jobs.branches;
  const now = opts.now ?? Date.now();
  const key = `${repo}|${path}|${branches.join(",")}|${opts.token ? "t" : "-"}`;
  if (!opts.noCache && cache && cache.key === key && now - cache.at < TEAM_ROOM.jobs.refreshMs) return cache.data;

  const headers: Record<string, string> = { Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const problems: string[] = [];
  // Rate limits and "no answer" by branch, so four failed reads make one line, not four.
  const limited: string[] = [];
  const unreachable: string[] = [];
  let keyRefused = false;
  const where = (b: string) => (b === "main" ? "main" : `${b}'s branch`);

  // A list of jobs, [] for no file there, null for "could not read".
  const read = async (branch: string): Promise<TeamJob[] | "none" | null> => {
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
    try {
      const sent = { ...headers };
      let r = await opts.fetch(url, { headers: sent });
      if (r.status === 401 && sent.Authorization) {
        // The repository is public: ask again without the refused key, and leave it off after this.
        keyRefused = true;
        delete headers.Authorization;
        const bare = { ...sent };
        delete bare.Authorization;
        r = await opts.fetch(url, { headers: bare });
      }
      if (r.status === 404) return "none";
      if (!r.ok) {
        if (r.status === 403 || r.status === 429) limited.push(where(branch));
        else problems.push(`GitHub answered ${r.status} for ${path} on ${where(branch)}.`);
        return null;
      }
      let raw: unknown;
      try { raw = JSON.parse(await r.text()); } catch {
        problems.push(`${path} on ${where(branch)} is not valid JSON, so its jobs are left out until it is fixed.`);
        return null;
      }
      const jobs = parseJobs(raw);
      const skipped = Array.isArray(raw) ? raw.length - jobs.length : 0;
      if (!Array.isArray(raw)) problems.push(`${path} on ${where(branch)} should be a list ([ … ]).`);
      else if (skipped > 0) problems.push(`${skipped} job${skipped === 1 ? "" : "s"} in ${path} on ${where(branch)} left out: each needs id, owner, title, from and added (team/README.md).`);
      return jobs;
    } catch {
      unreachable.push(where(branch));
      return null;
    }
  };

  const got = await Promise.all(branches.map(read));
  const bundled = parseJobs(opts.bundled);
  const readAny = got.some((g) => g !== null);
  if (keyRefused) problems.unshift("GitHub refused the site's key (GITHUB_TOKEN), so the jobs were read without it.");
  if (limited.length) problems.push(`GitHub is limiting how often we can ask (${path} on ${limited.join(", ")}). Try again in a few minutes.`);
  if (unreachable.length) problems.push(`Could not reach GitHub for ${path} on ${unreachable.join(", ")}.`);
  let data: JobsRead;
  if (!readAny) {
    data = { jobs: bundled, from: "bundled", fetchedAt: new Date(now).toISOString(), problems: [...problems, "No branch could be read, so the To-do shows the jobs built into the site."] };
  } else {
    const lists = got.map((g, i) => (g === null || g === "none" ? (branches[i] === "main" ? bundled : []) : g));
    data = { jobs: mergeJobs(lists), from: "github", fetchedAt: new Date(now).toISOString(), problems };
  }
  if (readAny && got.every((g) => g !== null)) cache = { at: now, key, data };
  return data;
}

/** For tests: forget the last read. */
export const clearJobsCache = () => { cache = null; };
