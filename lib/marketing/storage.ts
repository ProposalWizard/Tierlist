/**
 * lib/marketing/storage.ts — SERVER ONLY. The real storage behind the
 * Marketing routes (lib/marketing/mediaApi.ts):
 *   r2     the bucket, when R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *          R2_SECRET_ACCESS_KEY and R2_BUCKET are set (Vercel). Every call
 *          is a short-lived signed link (lib/marketing/r2.ts) fetched here.
 *   local  development only, no R2 settings: the videos already in
 *          docs/marketing/videos, read-only; notes go to a scratch folder
 *          outside the repo. Never on the live site (NODE_ENV is baked in).
 *   off    anything else: the page says "Storage not connected here".
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { isVideoKey, parseList, r2ConfigFrom, r2Url, type ListedObject, type R2Config } from "./r2";
import { LOCAL_KEY_RE, LOCAL_PREFIX, type Storage } from "./mediaApi";

export const LOCAL_DIR = "docs/marketing/videos";
/** Development only: another folder to read instead (e.g. a VP9 copy for a browser with no H.264). */
const localRoot = () => (process.env.MARKETING_LOCAL_DIR?.trim() ? path.resolve(process.env.MARKETING_LOCAL_DIR.trim()) : path.join(process.cwd(), LOCAL_DIR));

export function getStorage(): Storage {
  const { config, missing } = r2ConfigFrom(process.env);
  if (config) return r2Storage(config);
  if (offlineDevPlayEnabled()) return localStorageDev();
  return { mode: "off", missing, list: async () => [], head: async () => null, getText: async () => null, putText: async () => {}, remove: async () => {}, isMediaKey: isVideoKey };
}

function r2Storage(cfg: R2Config): Storage {
  const go = async (method: "GET" | "PUT" | "HEAD" | "DELETE", key: string, extra: Parameters<typeof r2Url>[5] = {}, body?: string) => {
    const url = r2Url(cfg, method, key, new Date(), 120, extra);
    const res = await fetch(url, { method, body, cache: "no-store", headers: extra.headers });
    // Never echo the URL: it carries a signature.
    if (!res.ok && res.status !== 404) throw new Error(`Storage answered ${res.status} to a ${method}.`);
    return res;
  };
  return {
    mode: "r2",
    config: cfg,
    isMediaKey: isVideoKey,
    async list(prefix) {
      const out: ListedObject[] = [];
      let token: string | null = null;
      for (let page = 0; page < 20; page++) {
        const query: Record<string, string> = { "list-type": "2", prefix, "max-keys": "1000" };
        if (token) query["continuation-token"] = token;
        const res = await go("GET", "", { query });
        if (!res.ok) break;
        const got = parseList(await res.text());
        out.push(...got.objects);
        if (!got.next) break;
        token = got.next;
      }
      return out;
    },
    async head(key) {
      const res = await go("HEAD", key);
      if (!res.ok) return null;
      return { size: Number(res.headers.get("content-length") ?? 0) };
    },
    async getText(key) {
      const res = await go("GET", key);
      return res.ok ? await res.text() : null;
    },
    async putText(key, body) {
      const bytes = Buffer.byteLength(body, "utf8");
      await go("PUT", key, { headers: { "content-length": String(bytes) } }, body);
    },
    async remove(key) { await go("DELETE", key); },
  };
}

/* ── Development only ─────────────────────────────────────────────────── */
/** Development only: the suite's files (and any helper files studio-prep.py makes) go here, outside the repo. */
export const DEV_SIDE_DIR = process.env.MARKETING_DEV_NOTES_DIR?.trim() ? path.resolve(process.env.MARKETING_DEV_NOTES_DIR.trim()) : path.join(os.tmpdir(), "kib-marketing-dev-notes");
/** A side file beside a local video: <local key><one of these>. */
const SIDE_RE = /\.(suite\.json|qc\.json|lanes\.json|peaks\.json|strip\.jpg|voice\.mp4|music\.mp4|sfx\.mp4)$/;
export const devSideFile = (key: string) => path.join(DEV_SIDE_DIR, key.replace(/[^A-Za-z0-9._-]/g, "_"));

function localStorageDev(): Storage {
  return {
    mode: "local",
    isMediaKey: (k) => LOCAL_KEY_RE.test(k) && !k.includes(".."),
    async list() {
      const root = localRoot();
      const out: ListedObject[] = [];
      for (const d of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
        if (!d.isDirectory()) continue;
        for (const f of fs.readdirSync(path.join(root, d.name))) {
          const key = `${LOCAL_PREFIX}${d.name}/${f}`;
          if (!LOCAL_KEY_RE.test(key)) continue;
          const st = fs.statSync(path.join(root, d.name, f));
          out.push({ key, size: st.size, modified: st.mtime.toISOString() });
        }
      }
      return out;
    },
    async head(key) {
      const f = SIDE_RE.test(key) ? devSideFile(key) : localFile(key);
      return f && fs.existsSync(f) ? { size: fs.statSync(f).size } : null;
    },
    async getText(key) {
      if (!SIDE_RE.test(key)) return null;
      try { return fs.readFileSync(devSideFile(key), "utf8"); } catch { return null; }
    },
    async putText(key, body) {
      if (!/\.suite\.json$/.test(key)) return;
      fs.mkdirSync(DEV_SIDE_DIR, { recursive: true });
      fs.writeFileSync(devSideFile(key), body);
    },
    async remove() {},
  };
}

/** The file on this computer for a local key, or null. Development only. */
export function localFile(key: string): string | null {
  if (!offlineDevPlayEnabled() || !LOCAL_KEY_RE.test(key) || key.includes("..")) return null;
  const rel = key.slice(LOCAL_PREFIX.length);
  const full = path.join(localRoot(), rel);
  if (!full.startsWith(localRoot() + path.sep) || !fs.existsSync(full)) return null;
  return full;
}
