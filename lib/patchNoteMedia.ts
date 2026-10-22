/**
 * lib/patchNoteMedia.ts — patch-note pictures and clips in Cloudflare R2
 * (Harry, 22 Oct 2026: "is there anywhere else on the site we can use
 * Cloudflare for storage (old patch notes)").
 *
 * Why: patch-notes/ is ~181 MB of stills and clips (2,118 files). The two
 * admin routes that serve it each carried a copy of the whole folder, about
 * 187 MB of Vercel's 250 MB per-route limit. The pictures now live in the
 * Marketing bucket (R2_BUCKET) under one prefix:
 *
 *   patch-notes/<path under the repo's patch-notes/ folder>
 *   e.g. patch-notes/pages/0.95h/img/goal.jpg
 *
 * The file route sends a short-lived signed R2 link when the object is there,
 * and the bundled copy when it is not, so nothing breaks mid-move. The move
 * itself is one button on /admin/patch-notes (runBatch below; it runs on
 * Vercel, the only place with the keys).
 *
 * PURE: no fs, no network, no clock. Everything real is passed in, so
 * tests/star/patchNoteMedia.mts runs it with fakes. The signing is the
 * Marketing round's (lib/marketing/r2.ts), not a second copy.
 */
import { r2Url, type ListedObject, type R2Config } from "./marketing/r2";

/** The R2 folder every patch-note file goes under. */
export const R2_PREFIX = "patch-notes/";

/** The big files: these move. Pages (.html) stay in the code; they are 4.7 MB in all. */
export const MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
};

export const extOfRel = (rel: string) => (/\.[A-Za-z0-9]{1,5}$/.exec(rel)?.[0] ?? "").toLowerCase();
export const isMediaRel = (rel: string) => !!MEDIA_TYPES[extOfRel(rel)];

/** A path under patch-notes/ that is safe to turn into a key: no climbing out, no odd characters. */
export function isSafeRel(rel: string): boolean {
  if (!rel || rel.length > 400 || rel.includes("\0") || rel.includes("\\")) return false;
  if (rel.startsWith("/") || rel.split("/").some((p) => p === "" || p === "." || p === "..")) return false;
  return /^[A-Za-z0-9 ._()+,@'&~-]+(?:\/[A-Za-z0-9 ._()+,@'&~-]+)*$/.test(rel);
}

export const keyOf = (rel: string) => `${R2_PREFIX}${rel}`;
export const relOf = (key: string) => (key.startsWith(R2_PREFIX) ? key.slice(R2_PREFIX.length) : null);

/* ── Serving: a signed link when R2 has it, the bundled file when not ─── */

/** A link works for at least an hour. Signed from the start of the hour, so the
 *  same picture has the same link all hour and the browser can keep its copy. */
export const LINK_SECONDS = 2 * 60 * 60;
export const REDIRECT_CACHE_SECONDS = 30 * 60;

export function signedGet(cfg: R2Config, rel: string, now: Date): string {
  const hour = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
  const file = rel.split("/").pop() ?? "file";
  return r2Url(cfg, "GET", keyOf(rel), hour, LINK_SECONDS, { query: {
    "response-content-type": MEDIA_TYPES[extOfRel(rel)] ?? "application/octet-stream",
    "response-cache-control": "private, max-age=3600",
    "response-content-disposition": `inline; filename="${file.replace(/[^A-Za-z0-9._-]/g, "")}"`,
  } });
}

export interface ServeDeps {
  /** Is this file in R2? null = R2 not connected here. */
  inR2(rel: string): Promise<boolean | null>;
  /** The signed link (only asked for when inR2 said yes). */
  link(rel: string): string;
  /** The copy bundled with the site, or null. */
  readLocal(rel: string): Promise<Buffer | null>;
}
export type ServeDecision =
  | { kind: "redirect"; url: string }
  | { kind: "local"; body: Buffer }
  | { kind: "missing" };

/** What the file route does with one request. Non-media files (css, fonts, svg) always come from the site. */
export async function decideServe(rel: string, deps: ServeDeps): Promise<ServeDecision> {
  if (isMediaRel(rel) && isSafeRel(rel)) {
    let there: boolean | null = null;
    try { there = await deps.inR2(rel); } catch { there = null; } // R2 down: fall back, never fail the page
    if (there) return { kind: "redirect", url: deps.link(rel) };
  }
  const body = await deps.readLocal(rel);
  return body ? { kind: "local", body } : { kind: "missing" };
}

/* ── The move: copy each bundled file into R2, a batch at a time ──────── */

export interface LocalFile { rel: string; size: number }

/** What still has to go up: every media file R2 does not hold at the same size. */
export function planUploads(local: LocalFile[], remote: ListedObject[]): { todo: LocalFile[]; done: LocalFile[] } {
  const there = new Map<string, number>();
  for (const o of remote) { const r = relOf(o.key); if (r != null) there.set(r, o.size); }
  const todo: LocalFile[] = [], done: LocalFile[] = [];
  for (const f of local) {
    if (!isMediaRel(f.rel) || !isSafeRel(f.rel)) continue;
    (there.get(f.rel) === f.size ? done : todo).push(f);
  }
  todo.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return { todo, done };
}

export interface MigrateDeps {
  listLocal(): Promise<LocalFile[]>;
  listRemote(): Promise<ListedObject[]>;
  readLocal(rel: string): Promise<Buffer | null>;
  put(key: string, body: Buffer, type: string): Promise<void>;
  /** Milliseconds, for the time budget. */
  clock(): number;
}
export interface MigrateOptions { budgetMs: number; maxFiles: number; parallel: number }
export const MIGRATE_DEFAULTS: MigrateOptions = { budgetMs: 20_000, maxFiles: 120, parallel: 6 };

export interface Progress {
  totalFiles: number;
  totalBytes: number;
  doneFiles: number;
  doneBytes: number;
}
export interface BatchResult extends Progress {
  uploaded: number;
  uploadedBytes: number;
  failed: { rel: string; error: string }[];
  /** True when nothing is left to copy. */
  finished: boolean;
}

export function progressOf(plan: { todo: LocalFile[]; done: LocalFile[] }): Progress {
  const sum = (l: LocalFile[]) => l.reduce((s, f) => s + f.size, 0);
  return { totalFiles: plan.todo.length + plan.done.length, totalBytes: sum(plan.todo) + sum(plan.done), doneFiles: plan.done.length, doneBytes: sum(plan.done) };
}

/**
 * One press's worth of work. Reads both sides afresh, so it can stop at any
 * point and the next call carries on (files already in R2 at the same size
 * are skipped). Stops starting new files once the time budget is spent.
 */
export async function runBatch(deps: MigrateDeps, opt: MigrateOptions = MIGRATE_DEFAULTS): Promise<BatchResult> {
  const started = deps.clock();
  const plan = planUploads(await deps.listLocal(), await deps.listRemote());
  const p = progressOf(plan);
  const queue = plan.todo.slice(0, Math.max(0, opt.maxFiles));
  const failed: BatchResult["failed"] = [];
  let uploaded = 0, uploadedBytes = 0;
  const worker = async () => {
    for (;;) {
      if (deps.clock() - started >= opt.budgetMs) return;
      const f = queue.shift();
      if (!f) return;
      try {
        const body = await deps.readLocal(f.rel);
        if (!body) throw new Error("not in this build");
        if (body.length !== f.size) throw new Error("size changed while reading");
        await deps.put(keyOf(f.rel), body, MEDIA_TYPES[extOfRel(f.rel)]);
        uploaded++; uploadedBytes += f.size;
      } catch (e) {
        failed.push({ rel: f.rel, error: e instanceof Error ? e.message.slice(0, 160) : "failed" });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opt.parallel) }, worker));
  return {
    ...p,
    doneFiles: p.doneFiles + uploaded,
    doneBytes: p.doneBytes + uploadedBytes,
    uploaded, uploadedBytes, failed,
    finished: p.doneFiles + uploaded >= p.totalFiles,
  };
}
