import type { MatchScenario } from "./scenarios";
import { mergeAuthoredFile, removeFromAuthoredFile } from "./authoredScenarios";

/**
 * COMMITTING A SCENARIO INTO THE REPOSITORY.
 *
 * The mechanism behind the gallery's "Commit to repo" button: read
 * `lib/star/authoredScenarios.json` off GitHub, merge the scenario into it,
 * and PUT it back as a real commit. Asked for directly — "when something is
 * saved it is permanently changed across the repo" — as the stronger twin of
 * the instant Supabase save, which is live everywhere but exists in exactly
 * one database.
 *
 * ── Why this is a separate module from the route ──
 *
 * Everything here is pure except the one `fetch`, which is injectable. That
 * is what makes the request shaping, the missing-token path and the
 * someone-else-committed-first retry testable (tests/star/commitScenarios.mts)
 * without a server, a token or a network — the same way
 * tests/star/scenarioStore.mts already fakes `fetch`.
 *
 * ── The token ──
 *
 * `GITHUB_TOKEN` is read from the environment and never returned, logged or
 * echoed. It is used for exactly one thing: the Authorization header on the
 * two calls below. A failure message quotes GitHub's own message, which does
 * not contain the token.
 */

export const AUTHORED_PATH = "lib/star/authoredScenarios.json";
const DEFAULT_REPO = "ProposalWizard/Tierlist";
/**
 * WHICH BRANCH A SAVED SCENARIO IS COMMITTED TO.
 *
 * `main`, so a scenario reaches EVERYONE rather than sitting on one
 * person's branch. Asked for directly: "can we get this to just go onto main
 * for everyone?" A scenario is shared data — the whole point of committing it
 * is that the game and every gallery pick it up — so a personal branch was
 * the wrong default for it, whatever the right default is for code.
 *
 * Two things that follow from this, worth knowing rather than discovering:
 *
 *  1. Vercel auto-deploys from main, so every commit here triggers a
 *     PRODUCTION rebuild (a couple of minutes). Fine for a handful of
 *     scenarios; it is not the thing to lean on while iterating quickly.
 *     The instant path is Save, which writes Supabase and reaches every
 *     device with no deploy at all. Commit is the durable copy, not the fast
 *     one.
 *  2. A feature branch that also commits scenarios will diverge from main on
 *     this one file and conflict on merge. The conflict is always a union of
 *     scenarios by id, never a loss — `mergeAuthoredFile` is keyed by id —
 *     but somebody has to resolve it.
 *
 * Overridable per deployment with GITHUB_BRANCH, so a branch that genuinely
 * wants its own pool can still have one without a code change.
 */
const DEFAULT_BRANCH = "main";
const API = "https://api.github.com";

export interface CommitConfig {
  token: string;
  repo: string;
  branch: string;
  /** Which pool file to write. Defaults to the authored one, so every
   *  existing caller is unchanged. */
  path?: string;
}

export interface CommitEnvResult {
  config: CommitConfig | null;
  /** Plain English, naming the env var, when there is no config. */
  message: string | null;
  missing: string[];
}

/**
 * Work out whether committing is even possible, and say plainly what is
 * missing when it is not.
 *
 * The repo and the branch have real defaults, so the ONLY thing that can
 * genuinely be missing is the token — which is also the only one of the
 * three that is a secret and so cannot ship in the code. Naming it exactly,
 * in a sentence, is the difference between "the button is broken" and "an
 * env var needs setting in Vercel."
 */
export function resolveCommitConfig(env: Record<string, string | undefined>): CommitEnvResult {
  const token = (env.GITHUB_TOKEN ?? "").trim();
  if (!token) {
    return {
      config: null,
      missing: ["GITHUB_TOKEN"],
      message:
        "Committing to the repo is switched off — the GITHUB_TOKEN environment variable isn't set on " +
        "this deployment. Add it in Vercel (Project → Settings → Environment Variables) as a " +
        "fine-grained GitHub token with Contents: Read and write on " +
        `${(env.GITHUB_REPO ?? "").trim() || DEFAULT_REPO}, then redeploy. Nothing was committed; the ` +
        "scenario is unchanged.",
    };
  }
  return {
    config: {
      token,
      repo: (env.GITHUB_REPO ?? "").trim() || DEFAULT_REPO,
      branch: (env.GITHUB_BRANCH ?? "").trim() || DEFAULT_BRANCH,
    },
    missing: [],
    message: null,
  };
}

export interface CommitResult {
  ok: boolean;
  /** What to hand back as the HTTP status. Never 500 for a known state. */
  status: number;
  /** Plain English, safe to show on screen. Never contains the token. */
  message: string;
  /** The ids actually written, once GitHub confirmed the commit. */
  committed?: string[];
  /** The new commit's own sha, when GitHub returned one. */
  commitSha?: string;
  /** True when the PUT was rejected for a moved sha and the retry also lost. */
  raced?: boolean;
}

type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  cache?: string;
}) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function headersFor(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function b64encode(text: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64");
  // Edge/browser fallback: btoa is byte-oriented, so UTF-8 encode first.
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(data: string): string {
  // GitHub wraps its base64 at 60 characters; every decoder wants it clean.
  const clean = data.replace(/\s+/g, "");
  if (typeof Buffer !== "undefined") return Buffer.from(clean, "base64").toString("utf8");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

interface FileState { text: string; sha: string | null }

/** The file as GitHub currently has it on this branch. A 404 is a real,
 *  ordinary answer — the file simply isn't on this branch yet — and comes
 *  back as an empty pool with no sha, which is exactly what creating it
 *  needs. */
async function readFile(cfg: CommitConfig, doFetch: FetchLike): Promise<FileState | CommitResult> {
  const path = cfg.path ?? AUTHORED_PATH;
  const url = `${API}/repos/${cfg.repo}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`;
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await doFetch(url, { method: "GET", headers: headersFor(cfg.token), cache: "no-store" });
  } catch {
    return { ok: false, status: 502, message: "Couldn't reach GitHub to read the scenarios file. Nothing was committed." };
  }
  if (res.status === 404) return { text: "", sha: null };
  const body = await res.json().catch(() => null) as
    { content?: string; sha?: string; message?: string } | null;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status === 401 || res.status === 403 ? 403 : 502,
      message:
        res.status === 401 || res.status === 403
          ? `GitHub refused the token (${res.status}). It needs Contents: Read and write on ${cfg.repo}. Nothing was committed.`
          : `GitHub couldn't read ${path} (${res.status}${body?.message ? `: ${body.message}` : ""}). Nothing was committed.`,
    };
  }
  if (typeof body?.content !== "string" || typeof body?.sha !== "string") {
    return { ok: false, status: 502, message: `GitHub returned ${path} in a shape this can't read. Nothing was committed.` };
  }
  return { text: b64decode(body.content), sha: body.sha };
}

function commitMessageFor(scenarios: MatchScenario[]): string {
  if (scenarios.length === 1) {
    return `Scenario: save "${scenarios[0].name}" (${scenarios[0].id}) into the code`;
  }
  return `Scenarios: save ${scenarios.length} scenarios into the code\n\n${scenarios.map(s => `- ${s.name} (${s.id})`).join("\n")}`;
}

/**
 * Read, merge, commit. One retry on a moved sha.
 *
 * A moved sha means someone else (or another tab) committed between the read
 * and the write. Retrying is right because the merge is by id: re-reading
 * picks up their scenario and writes ours on top of it, so both survive. It
 * retries ONCE and then reports plainly rather than looping — a genuinely
 * busy file is something a person should know about, not something to spin
 * on.
 */
export async function commitScenarios(opts: {
  config: CommitConfig;
  scenarios: MatchScenario[];
  fetchImpl?: FetchLike;
}): Promise<CommitResult> {
  const { config: cfg, scenarios } = opts;
  const doFetch = (opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike));
  if (!scenarios.length) {
    return { ok: false, status: 400, message: "No scenarios were sent, so nothing was committed." };
  }

  const attempt = async (retriesLeft: number): Promise<CommitResult> => {
    const file = await readFile(cfg, doFetch);
    if ("ok" in file) return file;

    const merged = mergeAuthoredFile(file.text, scenarios);
    const url = `${API}/repos/${cfg.repo}/contents/${cfg.path ?? AUTHORED_PATH}`;
    const payload: Record<string, unknown> = {
      message: commitMessageFor(scenarios),
      content: b64encode(merged.text),
      branch: cfg.branch,
    };
    if (file.sha) payload.sha = file.sha;

    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await doFetch(url, { method: "PUT", headers: headersFor(cfg.token), body: JSON.stringify(payload) });
    } catch {
      return { ok: false, status: 502, message: "Couldn't reach GitHub to write the commit. Nothing was committed." };
    }

    const body = await res.json().catch(() => null) as
      { commit?: { sha?: string; html_url?: string }; message?: string } | null;

    if (res.ok) {
      const ids = [...merged.added, ...merged.replaced];
      return {
        ok: true,
        status: 200,
        message:
          `Committed to ${cfg.repo} on ${cfg.branch} — ${ids.length === 1 ? "this scenario is" : `these ${ids.length} scenarios are`} ` +
          `now part of the code (${cfg.path ?? AUTHORED_PATH}).`,
        committed: ids,
        commitSha: body?.commit?.sha,
      };
    }

    // 409 is GitHub's own "the sha you gave is no longer current"; 422 is what
    // it sends when the sha is outright wrong for this path. Both mean the
    // same thing here: re-read and try again, once.
    const moved = res.status === 409 || res.status === 422;
    if (moved && retriesLeft > 0) return attempt(retriesLeft - 1);
    if (moved) {
      return {
        ok: false,
        status: 409,
        raced: true,
        message:
          "Somebody else committed to the scenarios file at the same moment, twice in a row, so this " +
          "commit was dropped rather than overwriting theirs. Nothing was committed — press Commit again.",
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: 403,
        message: `GitHub refused the token (${res.status}). It needs Contents: Read and write on ${cfg.repo}. Nothing was committed.`,
      };
    }
    return {
      ok: false,
      status: 502,
      message: `GitHub refused the commit (${res.status}${body?.message ? `: ${body.message}` : ""}). Nothing was committed.`,
    };
  };

  return attempt(1);
}

/**
 * Remove scenarios from the committed file. The delete-side twin of
 * `commitScenarios`, same read-modify-write with one retry on a moved sha.
 *
 * The gallery display reads the committed file now, so deleting a committed
 * scenario from the database alone would let it reappear on the next load.
 * This is what makes Delete actually stick.
 */
export async function removeScenariosFromRepo(opts: {
  config: CommitConfig;
  ids: string[];
  fetchImpl?: FetchLike;
}): Promise<CommitResult> {
  const { config: cfg, ids } = opts;
  const doFetch = (opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike));
  if (!ids.length) {
    return { ok: false, status: 400, message: "No ids were sent, so nothing was deleted." };
  }

  const attempt = async (retriesLeft: number): Promise<CommitResult> => {
    const file = await readFile(cfg, doFetch);
    if ("ok" in file) return file;

    const { text, removed } = removeFromAuthoredFile(file.text, ids);
    if (!removed.length) {
      // Nothing in the file matched — not an error. The scenario was only ever
      // in the database (or already gone), and the caller has cleared that.
      return {
        ok: true, status: 200, committed: [],
        message: "Nothing to delete from the code — it wasn't committed there.",
      };
    }

    const url = `${API}/repos/${cfg.repo}/contents/${cfg.path ?? AUTHORED_PATH}`;
    const message = removed.length === 1
      ? `Scenario: delete "${removed[0]}" from the code`
      : `Scenarios: delete ${removed.length} from the code\n\n${removed.map(id => `- ${id}`).join("\n")}`;
    const payload: Record<string, unknown> = {
      message,
      content: b64encode(text),
      branch: cfg.branch,
    };
    if (file.sha) payload.sha = file.sha;

    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await doFetch(url, { method: "PUT", headers: headersFor(cfg.token), body: JSON.stringify(payload) });
    } catch {
      return { ok: false, status: 502, message: "Couldn't reach GitHub to write the delete. Nothing was deleted from the code." };
    }
    const body = await res.json().catch(() => null) as
      { commit?: { sha?: string }; message?: string } | null;

    if (res.ok) {
      return {
        ok: true, status: 200, committed: removed,
        message: `Deleted ${removed.length === 1 ? "this scenario" : `these ${removed.length} scenarios`} from the code (${cfg.repo} on ${cfg.branch}).`,
        commitSha: body?.commit?.sha,
      };
    }
    const moved = res.status === 409 || res.status === 422;
    if (moved && retriesLeft > 0) return attempt(retriesLeft - 1);
    if (moved) {
      return { ok: false, status: 409, raced: true, message: "The scenarios file moved under this delete twice — nothing was deleted. Try again." };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 403, message: `GitHub refused the token (${res.status}). It needs Contents: Read and write on ${cfg.repo}. Nothing was deleted.` };
    }
    return { ok: false, status: 502, message: `GitHub refused the delete (${res.status}${body?.message ? `: ${body.message}` : ""}). Nothing was deleted.` };
  };

  return attempt(1);
}
