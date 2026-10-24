/**
 * lib/patchNoteMediaServer.ts — SERVER ONLY. The real storage behind
 * lib/patchNoteMedia.ts: the bundled patch-notes/ folder on one side, the R2
 * bucket on the other (the Marketing bucket and keys, R2_* in Vercel).
 *
 *   r2    R2_* set (the live site): real signed links, real uploads.
 *   dev   development only, no R2 keys: the "bucket" is a scratch folder
 *         outside the repo, so the move button can be pressed and watched
 *         locally. Serving stays on the bundled files.
 *   off   anything else: the button says "works on the live site only".
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { parseList, r2ConfigFrom, r2Url, type ListedObject, type R2Config } from "@/lib/marketing/r2";
import { PATCH_NOTES_DIR, resolveInside } from "@/lib/patchNotePageServe";
import { R2_PREFIX, isMediaRel, isSafeRel, keyOf, relOf, signedGet, type LocalFile, type MigrateDeps, type ServeDeps } from "@/lib/patchNoteMedia";

export type MediaMode = "r2" | "dev" | "off";
export const DEV_BUCKET = path.join(os.tmpdir(), "kib-patch-notes-r2-dev");

export function mediaMode(): { mode: MediaMode; config: R2Config | null; missing: string[] } {
  const { config, missing } = r2ConfigFrom(process.env);
  if (config) return { mode: "r2", config, missing: [] };
  if (offlineDevPlayEnabled()) return { mode: "dev", config: null, missing };
  return { mode: "off", config: null, missing };
}

/* ── The bundled side ────────────────────────────────────────────────── */
export async function listLocalMedia(): Promise<LocalFile[]> {
  const out: LocalFile[] = [];
  const walk = async (dir: string, rel: string) => {
    let entries: import("node:fs").Dirent[];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), r);
      else if (e.isFile() && isMediaRel(r) && isSafeRel(r)) out.push({ rel: r, size: (await fs.stat(path.join(dir, e.name))).size });
    }
  };
  await walk(PATCH_NOTES_DIR, "");
  return out;
}

export async function readLocal(rel: string): Promise<Buffer | null> {
  const abs = resolveInside(rel);
  if (!abs) return null;
  try { return await fs.readFile(abs); } catch { return null; }
}

/* ── The R2 side ─────────────────────────────────────────────────────── */
async function r2Fetch(cfg: R2Config, method: "GET" | "PUT" | "HEAD", key: string, extra: Parameters<typeof r2Url>[5] = {}, body?: Buffer) {
  const res = await fetch(r2Url(cfg, method, key, new Date(), 300, extra), { method, body: body ? new Uint8Array(body) : undefined, cache: "no-store", headers: extra.headers });
  // Never echo the URL: it carries a signature.
  if (!res.ok && res.status !== 404) throw new Error(`Storage answered ${res.status} to a ${method}.`);
  return res;
}

async function listR2(cfg: R2Config): Promise<ListedObject[]> {
  const out: ListedObject[] = [];
  let token: string | null = null;
  for (let page = 0; page < 30; page++) {
    const query: Record<string, string> = { "list-type": "2", prefix: R2_PREFIX, "max-keys": "1000" };
    if (token) query["continuation-token"] = token;
    const res = await r2Fetch(cfg, "GET", "", { query });
    if (!res.ok) break;
    const got = parseList(await res.text());
    out.push(...got.objects);
    if (!got.next) break;
    token = got.next;
  }
  return out;
}

async function listDev(): Promise<ListedObject[]> {
  const out: ListedObject[] = [];
  const walk = async (dir: string, rel: string) => {
    let entries: import("node:fs").Dirent[];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), r);
      else out.push({ key: keyOf(r), size: (await fs.stat(path.join(dir, e.name))).size, modified: "" });
    }
  };
  await walk(DEV_BUCKET, "");
  return out;
}

export async function listRemote(): Promise<ListedObject[]> {
  const m = mediaMode();
  if (m.mode === "r2" && m.config) return listR2(m.config);
  if (m.mode === "dev") return listDev();
  return [];
}

/** The move's real side, for runBatch. */
export function migrateDeps(): MigrateDeps {
  const m = mediaMode();
  return {
    listLocal: listLocalMedia,
    listRemote,
    readLocal,
    clock: () => Date.now(),
    async put(key, body, type) {
      if (m.mode === "r2" && m.config) {
        // content-length is signed, so R2 takes exactly these bytes (the Marketing round's upload rule).
        await r2Fetch(m.config, "PUT", key, { headers: { "content-length": String(body.length), "content-type": type } }, body);
        return;
      }
      if (m.mode === "dev") {
        const rel = relOf(key);
        if (!rel || !isSafeRel(rel)) throw new Error("bad key");
        const dest = path.join(DEV_BUCKET, ...rel.split("/"));
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, body);
        return;
      }
      throw new Error("Storage not connected here.");
    },
  };
}

/* ── Serving ─────────────────────────────────────────────────────────── */
/** What R2 holds, kept for a few minutes per server so a page of 30 pictures costs one listing, not 30 checks. */
let cache: { at: number; rels: Set<string> } | null = null;
const CACHE_MS = 5 * 60 * 1000;

async function r2Has(cfg: R2Config, rel: string): Promise<boolean> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const rels = new Set<string>();
    for (const o of await listR2(cfg)) { const r = relOf(o.key); if (r) rels.add(r); }
    cache = { at: Date.now(), rels };
  }
  if (cache.rels.has(rel)) return true;
  // Not in the (possibly older) list and not bundled: ask R2 directly once.
  if (!resolveInside(rel) || (await readLocalExists(rel))) return false;
  const res = await r2Fetch(cfg, "HEAD", keyOf(rel));
  if (res.ok) cache.rels.add(rel);
  return res.ok;
}
async function readLocalExists(rel: string) {
  const abs = resolveInside(rel);
  if (!abs) return false;
  try { await fs.access(abs); return true; } catch { return false; }
}

export function serveDeps(now = new Date()): ServeDeps {
  const m = mediaMode();
  return {
    inR2: async (rel) => (m.mode === "r2" && m.config ? r2Has(m.config, rel) : null),
    link: (rel) => signedGet(m.config!, rel, now),
    readLocal,
  };
}
