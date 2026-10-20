/**
 * lib/liveShareStore.ts — where live share pictures and lines go (server
 * only). On the site: Supabase Storage, bucket tierlist-images (public), folder
 * live/<code>/, written with the service key. No table, no SQL.
 *
 * A local dev copy with no service key (offline dev play, lib/star/devMode.ts)
 * writes to a folder on this machine instead and serves it at
 * /api/admin/live-share/files/…, so the whole loop can be tried without
 * touching the real storage. A production build never takes that path.
 * Server only: imported by the API routes, never by a page.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase/service";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";

export const LIVE_BUCKET = "tierlist-images";
export const LOCAL_DIR = path.join(os.tmpdir(), "kib-live-share");

export interface LiveStore {
  kind: "supabase" | "local";
  put(file: string, body: ArrayBuffer | string, type: string, fresh: boolean): Promise<string | null>;
  remove(files: string[]): Promise<void>;
  list(folder: string): Promise<string[]>;
  /** The address the watcher and viewer read from: <base>/live/<code>/<file>. */
  readBase(origin: string): string;
}

function supabaseStore(): LiveStore {
  const sb = createServiceClient();
  const bucket = sb.storage.from(LIVE_BUCKET);
  return {
    kind: "supabase",
    async put(file, body, type, fresh) {
      const blob = typeof body === "string" ? new Blob([body], { type }) : body;
      const { error } = await bucket.upload(file, blob, { contentType: type, upsert: true, cacheControl: fresh ? "0" : "3600" });
      return error ? error.message : null;
    },
    async remove(files) { if (files.length) await bucket.remove(files); },
    async list(folder) {
      const { data } = await bucket.list(folder, { limit: 1000 });
      return (data ?? []).map((f) => `${folder}/${f.name}`);
    },
    readBase: () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LIVE_BUCKET}`,
  };
}

/** Keeps a file path inside LOCAL_DIR. */
export function localFile(file: string): string | null {
  const full = path.resolve(LOCAL_DIR, file);
  return full.startsWith(LOCAL_DIR + path.sep) ? full : null;
}

function localStore(): LiveStore {
  return {
    kind: "local",
    async put(file, body) {
      const full = localFile(file);
      if (!full) return "bad path";
      await fs.mkdir(path.dirname(full), { recursive: true });
      // Write then rename, so a reader never sees half a file.
      const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, typeof body === "string" ? body : Buffer.from(body));
      await fs.rename(tmp, full);
      return null;
    },
    async remove(files) {
      for (const f of files) { const full = localFile(f); if (full) await fs.rm(full, { force: true }); }
    },
    async list(folder) {
      const full = localFile(folder);
      if (!full) return [];
      try { return (await fs.readdir(full)).map((n) => `${folder}/${n}`); } catch { return []; }
    },
    readBase: (origin) => `${origin}/api/admin/live-share/files`,
  };
}

/** The store to use, or null when this site can't write (no service key). */
export function liveStore(): LiveStore | null {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return supabaseStore();
  if (offlineDevPlayEnabled()) return localStore();
  return null;
}
