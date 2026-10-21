/**
 * lib/marketing/board.ts — the Marketing production board (Harry, 21 Oct 2026;
 * docs/plans/2026-10-21-marketing-production.md, piece 2).
 *
 * One card per video. The cards live in marketing/board.json in the code.
 * A Claude session moves a card by editing that file and pushing its own
 * branch (skill .claude/skills/video-board). The site reads the file from
 * GitHub on main and on each person's branch about once a minute and merges
 * the cards by id: the newest `updated` wins. Same pattern as the team jobs
 * (lib/teamRoom/jobs.ts, RUL-TEAM-007): no SQL, no deploy.
 *
 * Pure apart from fetchBoard, which takes its fetch as an argument so the
 * tests (tests/star/adminMarketing.mts) never reach the network.
 */
import { TEAM_PEOPLE, TEAM_ROOM, isTeamPerson, type TeamPerson } from "@/lib/teamRoom/config";

/** The seven columns, in order (the plan, piece 2). `key` is what the file says. */
export const STAGES = [
  { key: "idea", name: "Idea", help: "An idea for a video. Nothing written yet." },
  { key: "script", name: "Script", help: "The script is being written." },
  { key: "script-ok", name: "Script OK", help: "The script is locked. Nothing in it changes now." },
  { key: "making", name: "Making", help: "Being filmed, recorded or rendered." },
  { key: "edit", name: "In edit", help: "The cut is being put together." },
  { key: "check", name: "Final check", help: "The finished cut, waiting for a yes." },
  { key: "posted", name: "Posted", help: "Out on the channels." },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
export const isStage = (x: unknown): x is StageKey => STAGES.some((s) => s.key === x);
export const stageName = (k: StageKey) => STAGES.find((s) => s.key === k)!.name;

export const BOARD = {
  repo: TEAM_ROOM.jobs.repo,
  path: "marketing/board.json",
  branches: ["main", "Harry", "Mikey", "Leo"] as readonly string[],
  api: "/api/admin/marketing/board",
  refreshMs: 60_000,
};

export interface BoardLink { label: string; url: string }

export interface VideoCard {
  /** Stable and unique, e.g. v01-patch-0.1-0.3. */
  id: string;
  title: string;
  stage: StageKey;
  /** Who is making it. */
  owner: TeamPerson | "Claude";
  /** When this card last changed (ISO). The newest wins when two branches have the same id. */
  updated: string;
  /** The day it goes out, or went out (YYYY-MM-DD). */
  postOn: string | null;
  /** One line: what the video is. */
  line: string | null;
  /** Paths in the repo (e.g. docs/marketing/videos/v01-…/script.md). */
  script: string | null;
  cover: string | null;
  video: string | null;
  /** Length in seconds. */
  seconds: number | null;
  /** Where it was posted, or anything else worth a link. */
  links: BoardLink[];
  /** What happened at each step, newest last (short lines). */
  log: string[];
}

/** A card plus the branch it was read from (its repo links point there). */
export interface BoardCard extends VideoCard { branch: string }

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const PATH = /^[A-Za-z0-9_][A-Za-z0-9._\/-]{0,300}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);
const repoPath = (x: unknown) => { const s = str(x, 300); return s && PATH.test(s) && !s.includes("..") ? s : null; };
const t = (iso: string) => Date.parse(iso) || 0;
const OWNERS: readonly string[] = [...TEAM_PEOPLE, "Claude"];

/** The cards in a board file, cleaned. Anything malformed is left out (never throws). */
export function parseBoard(raw: unknown): VideoCard[] {
  if (!Array.isArray(raw)) return [];
  const out: VideoCard[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const c = r as Record<string, unknown>;
    const id = str(c.id, 80);
    const title = str(c.title, 160);
    const updated = str(c.updated, 40);
    if (!id || !ID.test(id) || !title || !isStage(c.stage) || !updated || !Number.isFinite(Date.parse(updated))) continue;
    if (typeof c.owner !== "string" || !OWNERS.includes(c.owner)) continue;
    const postOn = str(c.postOn, 10);
    const links = Array.isArray(c.links)
      ? c.links.flatMap((l) => {
          const o = (l ?? {}) as Record<string, unknown>;
          const label = str(o.label, 60);
          const url = str(o.url, 500);
          return label && url && /^https:\/\//.test(url) ? [{ label, url }] : [];
        }).slice(0, 12)
      : [];
    const log = Array.isArray(c.log) ? c.log.flatMap((x) => { const s = str(x, 300); return s ? [s] : []; }).slice(-30) : [];
    const secs = typeof c.seconds === "number" && Number.isFinite(c.seconds) && c.seconds > 0 ? Math.round(c.seconds * 10) / 10 : null;
    out.push({
      id, title, stage: c.stage, owner: c.owner as VideoCard["owner"], updated,
      postOn: postOn && DAY.test(postOn) ? postOn : null,
      line: str(c.line, 300),
      script: repoPath(c.script), cover: repoPath(c.cover), video: repoPath(c.video),
      seconds: secs, links, log,
    });
  }
  return out;
}

/** Several lists (main first, then each branch) → one, by id. Newest `updated` wins; a tie goes to the later list. */
export function mergeBoards(lists: { branch: string; cards: VideoCard[] }[]): BoardCard[] {
  const byId = new Map<string, BoardCard>();
  for (const { branch, cards } of lists) {
    for (const c of cards) {
      const had = byId.get(c.id);
      if (!had || t(c.updated) >= t(had.updated)) byId.set(c.id, { ...c, branch });
    }
  }
  return Array.from(byId.values()).sort((a, b) => t(b.updated) - t(a.updated) || a.id.localeCompare(b.id));
}

/** The cards in one column, newest change first. */
export const inStage = (cards: BoardCard[], k: StageKey) => cards.filter((c) => c.stage === k);

/** A repo file as a link on GitHub, on the branch the card came from. */
export const repoLink = (path: string, branch: string, repo = BOARD.repo) =>
  `https://github.com/${repo}/blob/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
/** A repo picture, served raw (for the cover). */
export const repoRaw = (path: string, branch: string, repo = BOARD.repo) =>
  `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;

export const isOwner = (x: unknown): x is TeamPerson => isTeamPerson(x);

/* ── Reading the board file from GitHub ───────────────────────────────── */

type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface BoardRead {
  cards: BoardCard[];
  /** "github" = read live; "bundled" = GitHub could not be reached, so the copy built into the site. */
  from: "github" | "bundled";
  fetchedAt: string;
  /** Plain-English problems. Empty when all is well. */
  problems: string[];
}

let cache: { at: number; key: string; data: BoardRead } | null = null;

/** Read the board file on every branch and merge. Never throws. Same rules as the team jobs. */
export async function fetchBoard(opts: {
  fetch: Fetch;
  bundled: unknown;
  token?: string | null;
  repo?: string;
  branches?: readonly string[];
  now?: number;
  noCache?: boolean;
}): Promise<BoardRead> {
  const repo = opts.repo || BOARD.repo;
  const branches = opts.branches ?? BOARD.branches;
  const now = opts.now ?? Date.now();
  const key = `${repo}|${branches.join(",")}|${opts.token ? "t" : "-"}`;
  if (!opts.noCache && cache && cache.key === key && now - cache.at < BOARD.refreshMs) return cache.data;

  const headers: Record<string, string> = { Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const problems: string[] = [];
  const where = (b: string) => (b === "main" ? "main" : `${b}'s branch`);
  let keyRefused = false;
  // Rate limits, by branch, so four refused reads make one line, not four.
  const limited: string[] = [];

  const read = async (branch: string): Promise<VideoCard[] | "none" | null> => {
    const url = `https://api.github.com/repos/${repo}/contents/${BOARD.path}?ref=${encodeURIComponent(branch)}`;
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
        else problems.push(`GitHub answered ${r.status} for the board on ${where(branch)}.`);
        return null;
      }
      let raw: unknown;
      try { raw = JSON.parse(await r.text()); } catch {
        problems.push(`The board file on ${where(branch)} is not valid JSON, so its cards are left out until it is fixed.`);
        return null;
      }
      const cards = parseBoard(raw);
      if (!Array.isArray(raw)) problems.push(`The board file on ${where(branch)} should be a list ([ … ]).`);
      else if (raw.length > cards.length) problems.push(`${raw.length - cards.length} card(s) on ${where(branch)} left out: each needs id, title, stage, owner and updated (.claude/skills/video-board).`);
      return cards;
    } catch {
      problems.push(`Could not reach GitHub for the board on ${where(branch)}.`);
      return null;
    }
  };

  const got = await Promise.all(branches.map(read));
  if (limited.length) problems.push(`GitHub is limiting how often we can ask (the board on ${limited.join(", ")}). Try again in a few minutes.`);
  if (keyRefused) problems.unshift("GitHub refused the site's key (GITHUB_TOKEN), so the board was read without it.");
  const bundled = parseBoard(opts.bundled);
  const readAny = got.some((g) => g !== null);
  let data: BoardRead;
  if (!readAny) {
    data = { cards: mergeBoards([{ branch: "main", cards: bundled }]), from: "bundled", fetchedAt: new Date(now).toISOString(), problems: [...problems, "No branch could be read, so the board shows the copy built into the site."] };
  } else {
    const lists = got.map((g, i) => ({ branch: branches[i], cards: g === null || g === "none" ? (branches[i] === "main" ? bundled : []) : g }));
    data = { cards: mergeBoards(lists), from: "github", fetchedAt: new Date(now).toISOString(), problems };
  }
  if (readAny && got.every((g) => g !== null)) cache = { at: now, key, data };
  return data;
}

/** For tests: forget the last read. */
export const clearBoardCache = () => { cache = null; };
