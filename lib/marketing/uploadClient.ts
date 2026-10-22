/**
 * lib/marketing/uploadClient.ts — BROWSER. Send one file to the Marketing
 * storage: ask the site for a signed link (the caps are checked there), PUT
 * the file straight to R2 with progress, then tell the site it arrived.
 * Used by the Uploads page and the Videos recorder's "Send to Marketing".
 *
 * The body is sent with no Content-Type header on purpose: the bucket's CORS
 * rule then only has to allow the PUT itself (a play link names the type).
 */
export type UploadProgress = (share: number) => void;
export class UploadError extends Error { constructor(message: string, public status = 0) { super(message); } }

export async function uploadToMarketing(file: Blob, name: string, folder: string | null, onProgress: UploadProgress = () => {}): Promise<{ key: string; size: number }> {
  const ask = await fetch("/api/admin/marketing/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size: file.size, folder: folder || undefined }),
  });
  const a = await ask.json().catch(() => ({}));
  if (!ask.ok) throw new UploadError(a.error || `The site said no (${ask.status}).`, ask.status);

  const plain = file.slice(0, file.size, "");
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", a.url);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new UploadError(`Storage refused the file (${x.status}).`, x.status)));
    x.onerror = () => reject(new UploadError("The connection dropped. Try again on a steadier connection (Wi-Fi)."));
    x.send(plain);
  });
  onProgress(1);

  const done = await fetch("/api/admin/marketing/upload/done", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: a.key }) });
  const d = await done.json().catch(() => ({}));
  if (!done.ok) throw new UploadError(d.error || "The file did not arrive.", done.status);
  return { key: a.key, size: d.size ?? file.size };
}

export const sizeLabel = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const playLink = (key: string) => `/api/admin/marketing/media/play?key=${encodeURIComponent(key)}`;
export const suiteLink = (key: string) => `/admin/marketing/suite?key=${encodeURIComponent(key)}`;
