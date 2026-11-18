"use client";
/**
 * Marketing → Publish (Mikey, 11 Nov 2026): post a video from Marketing storage to Instagram, Facebook and
 * YouTube now or at a set time, and see how each post is doing. The engine is lib/publish/* (the database timer
 * runs it every 5 minutes); this page only reads and writes the queue through /api/admin/publish.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/admin/broadcast/BroadcastPage";
import { sizeLabel } from "@/lib/marketing/uploadClient";
import type { MediaItem } from "@/lib/marketing/r2";
import type { AccountView, Platform, PublishPost } from "@/lib/publish/types";
import "./marketing.css";
import "./suite.css";

type Setup = { tokenKey: boolean; meta: boolean; google: boolean; cron: boolean; agent: boolean; storage: boolean };
type Data = { accounts: AccountView[]; posts: PublishPost[]; videos: MediaItem[]; setup: Setup; error?: string; storage?: string };

const NAMES: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube" };
const ORDER: Platform[] = ["instagram", "facebook", "youtube"];
const STATUS: Record<PublishPost["status"], string> = { scheduled: "Scheduled", posting: "Posting", done: "Posted", partial: "Partly posted", failed: "Failed", cancelled: "Cancelled" };
const STAGE: Record<string, string> = { pending: "waiting", processing: "Instagram is processing it", done: "posted", failed: "failed" };
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const nameOf = (key: string) => key.split("/").pop()?.replace(/^\d{8}-\d{6}-[a-z0-9]{4}-/, "") ?? key;

export default function PublishPanel({ notice }: { notice: { ok: boolean; text: string } | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [video, setVideo] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [split, setSplit] = useState(false);
  const [caps, setCaps] = useState<Record<Platform, string>>({ instagram: "", facebook: "", youtube: "" });
  const [picked, setPicked] = useState<Record<Platform, boolean>>({ instagram: true, facebook: true, youtube: true });
  const [later, setLater] = useState(false);
  const [at, setAt] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/publish", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Could not read Publish (${r.status}).`);
      setData(j); setErr(j.error ?? null);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const connected = useMemo(() => Object.fromEntries((data?.accounts ?? []).map((a) => [a.platform, a])) as Partial<Record<Platform, AccountView>>, [data]);
  const ready = (p: Platform) => !!connected[p]?.connected;

  const act = async (label: string, fn: () => Promise<Response>) => {
    setBusy(label); setErr(null);
    try { const r = await fn(); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Failed (${r.status}).`); await load(); return j; }
    catch (e) { setErr((e as Error).message); return null; } finally { setBusy(null); }
  };
  const tickNow = () => act("tick", () => fetch("/api/admin/publish/tick", { method: "POST" }));

  const schedule = async () => {
    const platforms = ORDER.filter((p) => picked[p] && ready(p));
    const body = {
      video_key: video, title, platforms,
      captions: split ? caps : { instagram: caption, facebook: caption, youtube: caption },
      scheduled_at: later && at ? new Date(at).toISOString() : new Date().toISOString(),
    };
    const j = await act("schedule", () => fetch("/api/admin/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    if (j) { setTitle(""); setCaption(""); setCaps({ instagram: "", facebook: "", youtube: "" }); if (!later) tickNow(); }
  };
  const change = (id: string, action: string) => act(action + id, () => fetch(`/api/admin/publish/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })).then((j) => { if (j && (action === "now" || action === "retry")) tickNow(); });
  const forget = (p: Platform) => { if (confirm(`Forget the ${NAMES[p]} login? Posts to it stop until you connect again.`)) act("forget" + p, () => fetch(`/api/admin/publish/accounts?platform=${p}`, { method: "DELETE" })); };

  const s = data?.setup;
  const missing = s ? [
    !s.tokenKey && "PUBLISH_TOKEN_KEY", !s.meta && "META_APP_ID + META_APP_SECRET", !s.google && "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET",
    !s.cron && "PUBLISH_CRON_SECRET", !s.agent && "PUBLISH_AGENT_TOKEN", !s.storage && "R2 storage settings",
  ].filter(Boolean) as string[] : [];
  const anyReady = ORDER.some((p) => picked[p] && ready(p));
  const canPost = !!video && anyReady && (!picked.youtube || !ready("youtube") || !!title.trim()) && (!later || !!at) && busy === null;

  return (
    <div className="mk-up">
      {notice && <div className="mk-store" data-on={notice.ok ? "true" : "false"} role="status"><b>{notice.ok ? "● Connected" : "○ Not connected"}</b><span>{notice.text}</span></div>}
      {err && <div className="mk-problems" role="alert"><p>{err}</p></div>}
      {missing.length > 0 && <div className="mk-problems"><p>Still to set up in Vercel: {missing.join(" · ")}.</p></div>}

      <Panel title="Accounts" note="One Meta login connects Facebook and Instagram">
        {ORDER.map((p) => (
          <div key={p} className="mk-file">
            <span className="mk-kind">{ready(p) ? "●" : "○"}</span>
            <span className="mk-file-main"><b>{NAMES[p]}</b><small>{ready(p) ? connected[p]!.name || connected[p]!.id : "Not connected"}</small></span>
            {ready(p) && <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={() => forget(p)}>Forget</button>}
          </div>
        ))}
        <div className="mk-links">
          <a className="bc-btn" data-main="true" href="/api/admin/publish/connect/meta">{ready("facebook") ? "Reconnect Facebook + Instagram" : "Connect Facebook + Instagram"}</a>
          <a className="bc-btn" href="/api/admin/publish/connect/youtube">{ready("youtube") ? "Reconnect YouTube" : "Connect YouTube"}</a>
        </div>
        <p className="mk-plain">Until Google approves our YouTube audit, YouTube keeps videos posted from here private.</p>
      </Panel>

      <Panel title="New post">
        <label className="mk-field"><span>Video</span>
          <select value={video} onChange={(e) => setVideo(e.target.value)}>
            <option value="">{data?.videos.length ? "Pick a video from Uploads" : "No videos in storage yet (Marketing → Uploads)"}</option>
            {(data?.videos ?? []).map((v) => <option key={v.key} value={v.key}>{v.name} · {sizeLabel(v.size)}{v.uploaded ? ` · ${when(v.uploaded)}` : ""}</option>)}
          </select>
        </label>
        <div className="mk-chips">
          {ORDER.map((p) => (
            <button key={p} className="bc-pill" aria-pressed={picked[p] && ready(p)} disabled={!ready(p)} onClick={() => setPicked((x) => ({ ...x, [p]: !x[p] }))}>
              {picked[p] && ready(p) ? "✓ " : ""}{NAMES[p]}{ready(p) ? "" : " (not connected)"}
            </button>
          ))}
        </div>
        <label className="mk-field"><span>Title (YouTube and Facebook)</span>
          <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Mourinho v Guardiola: analysed like chess" />
        </label>
        {!split ? (
          <label className="mk-field"><span>Caption (all platforms)</span>
            <textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption and hashtags" />
          </label>
        ) : ORDER.map((p) => (
          <label key={p} className="mk-field"><span>{NAMES[p]} caption</span>
            <textarea rows={3} value={caps[p]} onChange={(e) => setCaps((c) => ({ ...c, [p]: e.target.value }))} />
          </label>
        ))}
        <button className="bc-pill" aria-pressed={split} onClick={() => { if (!split) setCaps({ instagram: caption, facebook: caption, youtube: caption }); setSplit(!split); }}>
          {split ? "✓ Different caption per platform" : "Different caption per platform"}
        </button>
        <div className="mk-chips">
          <button className="bc-pill" aria-pressed={!later} onClick={() => setLater(false)}>Post now</button>
          <button className="bc-pill" aria-pressed={later} onClick={() => setLater(true)}>Schedule</button>
          {later && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
        </div>
        <button className="bc-btn" data-main="true" disabled={!canPost} onClick={schedule}>{busy === "schedule" ? "Saving…" : later ? "Schedule post" : "Post now"}</button>
        <p className="mk-plain">Posts go out within 5 minutes of their time. Instagram takes a few more minutes to process a Reel.</p>
      </Panel>

      <Panel title="Posts and numbers" note={data ? `${data.posts.length} post${data.posts.length === 1 ? "" : "s"}` : undefined}>
        <div className="mk-status"><span>Numbers refresh every 3 hours for 30 days after posting.</span>
          <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={tickNow}>{busy === "tick" ? "Checking…" : "↻ Check now"}</button></div>
        {data && data.posts.length === 0 && <p className="mk-empty">Nothing posted or scheduled yet.</p>}
        {(data?.posts ?? []).map((post) => (
          <div key={post.id} className="mk-note">
            <b>{post.title || nameOf(post.video_key)}</b>
            <small><span className="mk-chip">{STATUS[post.status]}</span>{when(post.scheduled_at)} · {nameOf(post.video_key)} · by {post.created_by}</small>
            {post.platforms.map((p) => {
              const r = post.results[p];
              const stats = r?.stats ? Object.entries(r.stats).map(([k, v]) => `${v.toLocaleString()} ${k}`).join(" · ") : "";
              return (
                <p key={p}><b>{NAMES[p]}</b>: {STAGE[r?.stage ?? "pending"]}
                  {r?.link && <> · <a href={r.link} target="_blank" rel="noreferrer">open</a></>}
                  {stats && <> · {stats}</>}
                  {r?.error && <> · <span style={{ color: "var(--bc-amber)" }}>{r.error}</span></>}
                </p>
              );
            })}
            <div className="mk-chips">
              {(post.status === "scheduled") && <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={() => change(post.id, "now")}>Post now</button>}
              {post.status === "scheduled" && <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={() => change(post.id, "cancel")}>Cancel</button>}
              {(post.status === "failed" || post.status === "partial") && <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={() => change(post.id, "retry")}>Try again</button>}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
