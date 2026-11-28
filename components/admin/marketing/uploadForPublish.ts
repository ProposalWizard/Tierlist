/**
 * Upload one video straight into a space's storage (Mikey's own bucket for football and content, the team's Cloudflare
 * bucket for kib): ask the site for a signed link, then send the file to it. Shared by Marketing → Publish and
 * Marketing → Library. Resolves to the key the posting queue uses for the video.
 */
import type { Space } from "@/lib/publish/types";

export function uploadForPublish(file: File, space: Space, onProgress: (share: number) => void): Promise<string> {
  return fetch("/api/admin/publish/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, space }) })
    .then(async (r) => { const a = await r.json().catch(() => ({})); if (!r.ok) throw new Error(a.error || `The site said no (${r.status}).`); return a as { key: string; url: string }; })
    .then((a) => new Promise<string>((resolve, reject) => {
      const x = new XMLHttpRequest(); x.open("PUT", a.url);
      x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = () => (x.status >= 200 && x.status < 300 ? resolve(a.key) : reject(new Error(`Storage refused the file (${x.status}). If this is your own bucket, check its CORS rule.`)));
      x.onerror = () => reject(new Error("The upload was blocked or dropped. If this is your own bucket, check its CORS rule (setup step), then try again."));
      x.send(file.slice(0, file.size, ""));
    }));
}
