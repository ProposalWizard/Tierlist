"use client";
/**
 * The Uploads page (Harry, 22 Oct 2026; plan piece 5): drop a video or a
 * picture, it goes straight into the private video storage (Cloudflare R2),
 * never through the site. Optionally tie it to a video card on the board.
 * The list is read from the bucket itself (no database).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "@/components/admin/broadcast/BroadcastPage";
import { uploadToMarketing, sizeLabel, suiteLink } from "@/lib/marketing/uploadClient";
import type { MediaItem } from "@/lib/marketing/r2";
import "./marketing.css";
import "./suite.css";

type Media = {
  mode: "r2" | "local" | "off"; connected: boolean; message?: string | null; missing?: string[];
  items: MediaItem[]; used?: { files: number; bytes: number }; caps: { maxFileBytes: number; dailyFiles: number; dailyBytes: number };
};
type Card = { id: string; title: string };
type Job = { id: number; name: string; share: number; state: "sending" | "done" | "failed"; why?: string };

export default function UploadsPanel({ cards }: { cards: Card[] }) {
  const [media, setMedia] = useState<Media | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [folder, setFolder] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const jobSeq = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/marketing/media", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Could not read the list (${r.status}).`);
      setMedia(j); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      const id = ++jobSeq.current;
      setJobs((js) => [...js, { id, name: f.name, share: 0, state: "sending" }]);
      const set = (p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));
      try {
        await uploadToMarketing(f, f.name, folder || null, (share) => set({ share }));
        set({ state: "done", share: 1 });
      } catch (e) { set({ state: "failed", why: (e as Error).message }); }
    }
    load();
  };

  const connected = media?.connected === true;
  const titleOf = (id: string) => cards.find((c) => c.id === id)?.title ?? (id === "inbox" ? "Not linked to a card" : id);
  const groups = new Map<string, MediaItem[]>();
  for (const it of media?.items ?? []) groups.set(it.folder, [...(groups.get(it.folder) ?? []), it]);

  return (
    <div className="mk-up">
      <div className="mk-store" data-on={connected ? "true" : "false"} role="status">
        <b>{connected ? "● Storage connected" : "○ Storage not connected here"}</b>
        <span>{connected
          ? `Private video storage (Cloudflare R2). Today you have used ${media?.used?.files ?? 0} of ${media?.caps.dailyFiles} files and ${sizeLabel(media?.used?.bytes ?? 0)} of ${sizeLabel(media?.caps.dailyBytes ?? 0)}.`
          : media?.mode === "local" ? "Uploads only work on the live site. Below: the videos already in the code on this computer (development only)."
          : media ? "Uploads work on the live site once the R2 settings are in Vercel." : err ?? "Checking…"}</span>
      </div>

      <Panel title="Upload" note={media ? `Up to ${sizeLabel(media.caps.maxFileBytes)} a file` : undefined}>
        <label className="mk-field">
          <span>Video card</span>
          <select value={folder} onChange={(e) => setFolder(e.target.value)} disabled={!connected}>
            <option value="">Not linked to a card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <div
          className="mk-drop" data-over={over ? "true" : "false"} data-off={connected ? "false" : "true"}
          onDragOver={(e) => { e.preventDefault(); if (connected) setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (connected && e.dataTransfer.files.length) send(e.dataTransfer.files); }}
        >
          <p>{connected ? "Drop a video or a picture here" : "Storage not connected here"}</p>
          <button className="bc-btn" data-main="true" disabled={!connected} onClick={() => fileRef.current?.click()}>Choose a file</button>
          <small>mp4, mov, webm, jpg, png, webp, gif · it goes straight to storage, never through the site</small>
          <input ref={fileRef} type="file" hidden multiple accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif,.mp4,.mov,.webm,.m4v"
            onChange={(e) => { if (e.target.files?.length) send(e.target.files); e.target.value = ""; }} />
        </div>
        {jobs.map((j) => (
          <div key={j.id} className="mk-job" data-state={j.state}>
            <span className="mk-job-name">{j.name}</span>
            <span className="mk-bar"><i style={{ width: `${Math.round(j.share * 100)}%` }} /></span>
            <b>{j.state === "sending" ? `${Math.round(j.share * 100)}%` : j.state === "done" ? "Uploaded" : j.why}</b>
          </div>
        ))}
      </Panel>

      <Panel title="In storage" note={media ? `${media.items.length} file${media.items.length === 1 ? "" : "s"}` : undefined}>
        <div className="mk-status"><span>{media?.mode === "r2" ? "Read from the bucket just now" : media?.mode === "local" ? "From docs/marketing/videos (this computer)" : "Nothing to show"}</span>
          <button className="bc-pill" aria-pressed={false} onClick={load}>↻ Check now</button></div>
        {media && media.items.length === 0 && <p className="mk-empty">{connected ? "No uploads yet." : "No videos here."}</p>}
        {Array.from(groups.entries()).map(([f, items]) => (
          <div key={f} className="mk-group">
            <h4>{titleOf(f)}</h4>
            {items.map((it) => (
              <div key={it.key} className="mk-file">
                <span className="mk-kind">{it.kind === "video" ? "▶" : "▣"}</span>
                <span className="mk-file-main"><b>{it.name}</b><small>{sizeLabel(it.size)}{it.uploaded ? ` · ${new Date(it.uploaded).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}{it.hasNotes ? " · has notes" : ""}</small></span>
                {it.kind === "video" && <a className="bc-btn" href={suiteLink(it.key)}>Open in Suite</a>}
              </div>
            ))}
          </div>
        ))}
      </Panel>
    </div>
  );
}
