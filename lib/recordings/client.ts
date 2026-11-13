/**
 * lib/recordings/client.ts — BROWSER. Admin → Videos saves a recording to
 * team storage (Cloudflare R2): ask the site for a signed link, PUT the file
 * straight to R2 with progress, then tell the site it arrived and get the
 * link for Claude back. No Google involved. Also the list and the Keep switch.
 *
 * The body is sent with no Content-Type header on purpose (same as
 * lib/marketing/uploadClient.ts): the bucket's CORS rule only has to allow
 * the PUT itself.
 */
import type { RecordingRow } from "./store";

export type { RecordingRow };
/** `status` 503 = team storage is not connected on this site. */
export class RecordingSaveError extends Error { constructor(message: string, public status = 0) { super(message); } }

export async function saveRecording(file: Blob, meta: { who: string; about: string; seconds: number; ext: string },
  onProgress: (share: number) => void = () => {}): Promise<{ key: string; link: string; title: string }> {
  const ask = await fetch("/api/dev-recordings/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...meta, size: file.size }),
  });
  const a = await ask.json().catch(() => ({}));
  if (!ask.ok) throw new RecordingSaveError(a.error || `The site said no (${ask.status}).`, ask.status);

  const plain = file.slice(0, file.size, "");
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", a.url);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new RecordingSaveError(`Storage refused the recording (${x.status}).`, x.status)));
    x.onerror = () => reject(new RecordingSaveError("The connection dropped while saving. Tap Save again."));
    x.send(plain);
  });
  onProgress(1);

  const done = await fetch("/api/dev-recordings/upload/done", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: a.key }) });
  const d = await done.json().catch(() => ({}));
  if (!done.ok || !d.link) throw new RecordingSaveError(d.error || "The recording did not arrive.", done.status);
  return { key: a.key, link: d.link, title: d.title ?? "" };
}

export interface RecordingList { connected: boolean; keptDays: number; recordings: RecordingRow[] }
export async function listRecordings(): Promise<RecordingList> {
  const r = await fetch("/api/dev-recordings", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `The list did not load (${r.status}).`);
  return { connected: !!j.connected, keptDays: j.keptDays ?? 30, recordings: Array.isArray(j.recordings) ? j.recordings : [] };
}

export async function setKeep(key: string, keep: boolean): Promise<void> {
  const r = await fetch("/api/dev-recordings/keep", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, keep }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Keep did not save.");
}
