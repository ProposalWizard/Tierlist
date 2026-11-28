"use client";
/**
 * Marketing → Publish (Mikey, 11 Nov 2026): post a video from Marketing storage to Instagram, Facebook and
 * YouTube now or at a set time, and see how each post is doing. The engine is lib/publish/* (the database timer
 * runs it every 5 minutes); this page only reads and writes the queue through /api/admin/publish.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/admin/broadcast/BroadcastPage";
import { sizeLabel } from "@/lib/marketing/uploadClient";
import type { MediaItem } from "@/lib/marketing/r2";
import { fullCaption, titleFor, type VideoDetails } from "@/lib/publish/library";
import { uploadForPublish } from "./uploadForPublish";
import { SPACES, SPACE_NAMES, spaceOf, type AccountView, type Platform, type PublishPost, type Space } from "@/lib/publish/types";
import "./marketing.css";
import "./suite.css";

type Setup = { tokenKey: boolean; meta: boolean; google: boolean; cron: boolean; agent: boolean; storage: boolean; ownStorage?: boolean };
type Video = MediaItem & { source?: "own" | "kib" };
type Data = { accounts: AccountView[]; posts: PublishPost[]; videos: Video[]; details?: Record<string, VideoDetails>; setup: Setup; error?: string; storage?: string; storageError?: string };

const NAMES: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube" };
const ORDER: Platform[] = ["instagram", "facebook", "youtube"];
const STATUS: Record<PublishPost["status"], string> = { scheduled: "Scheduled", posting: "Posting", done: "Posted", partial: "Partly posted", failed: "Failed", cancelled: "Cancelled" };
const STAGE: Record<string, string> = { pending: "waiting", processing: "Instagram is processing it", done: "posted", failed: "failed" };
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const nameOf = (key: string) => key.split("/").pop()?.replace(/^\d{8}-\d{6}-[a-z0-9]{4}-/, "") ?? key;

export default function PublishPanel({ notice }: { notice: { ok: boolean; text: string } | null }) {
  // Which set of accounts (Mikey, 24 Nov 2026): Football and Content are Mikey's; Knowitball is the team's.
  const [space, setSpaceRaw] = useState<Space>("football");
  // The address (?space=…&video=…) is read once the page is on screen, so the server's page and the browser's first draw match.
  const [urlRead, setUrlRead] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search); const sp = spaceOf(q.get("space"));
    setSpaceRaw(sp); setFbHand(sp === "football"); setVideo(q.get("video") ?? ""); setUrlRead(true);
  }, []);
  const setSpace = (s: Space) => { setSpaceRaw(s); setVideo(""); setData(null); setFbHand(s === "football"); setFilled(null); try { const u = new URL(window.location.href); u.searchParams.set("space", s); u.searchParams.delete("connected"); u.searchParams.delete("problem"); window.history.replaceState(null, "", u.toString()); } catch { /* ignore */ } };
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [video, setVideo] = useState("");
  // Facebook by hand (Mikey): his Facebook is a personal profile, which no app may post to, so the page hands him the video and caption.
  const [fbHand, setFbHand] = useState(true);
  const [filled, setFilled] = useState<string | null>(null);
  const [fromLibrary, setFromLibrary] = useState<boolean | null>(null);
  const [hand, setHand] = useState<{ title: string; caption: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [split, setSplit] = useState(false);
  const [caps, setCaps] = useState<Record<Platform, string>>({ instagram: "", facebook: "", youtube: "" });
  const [picked, setPicked] = useState<Record<Platform, boolean>>({ instagram: true, facebook: true, youtube: true });
  const [later, setLater] = useState(false);
  const [at, setAt] = useState("");
  const [up, setUp] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!urlRead) return;
    // A check that never answers must not freeze the page (the Brain page's "Posting" stuck for exactly this reason): 20 s, then say so.
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20_000);
    try {
      const r = await fetch(`/api/admin/publish?space=${space}`, { cache: "no-store", signal: ctl.signal });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Could not read Publish (${r.status}).`);
      setData(j); setErr(j.error ?? null);
    } catch (e) { setErr((e as Error).name === "AbortError" ? "Checking took too long. Trying again in a moment." : (e as Error).message); }
    finally { clearTimeout(timer); }
  }, [space, urlRead]);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);
  // While a post is on its way, look every 10 seconds instead of every minute.
  const inFlight = !!data?.posts?.some((p) => p.status === "scheduled" || p.status === "posting");
  useEffect(() => { if (!inFlight) return; const t = setInterval(load, 10_000); return () => clearInterval(t); }, [inFlight, load]);
  // The video's saved words (Marketing → Library) fill the title and captions the moment it is picked.
  useEffect(() => {
    if (!video || !data || filled === video) return;
    setFilled(video);
    const d = data.details?.[video];
    setFromLibrary(!!d);
    if (!d) return;
    const t = titleFor(d, "youtube") || d.name;
    const c = { instagram: fullCaption(d, "instagram"), facebook: fullCaption(d, "facebook"), youtube: fullCaption(d, "youtube") };
    setTitle(t);
    if (c.instagram === c.facebook && c.facebook === c.youtube) { setSplit(false); setCaption(c.instagram); setCaps(c); }
    else { setSplit(true); setCaps(c); setCaption(c.instagram || c.facebook || c.youtube); }
  }, [video, data, filled]);

  const connected = useMemo(() => Object.fromEntries((data?.accounts ?? []).map((a) => [a.platform, a])) as Partial<Record<Platform, AccountView>>, [data]);
  const ready = (p: Platform) => !!connected[p]?.connected;

  const act = async (label: string, fn: () => Promise<Response>) => {
    setBusy(label); setErr(null);
    try { const r = await fn(); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Failed (${r.status}).`); await load(); return j; }
    catch (e) { setErr((e as Error).message); return null; } finally { setBusy(null); }
  };
  const upload = async (f: File | undefined) => {
    if (!f) return; setErr(null); setUp(0);
    try { const key = await uploadForPublish(f, space, (x) => setUp(x)); await load(); setVideo(key); }
    catch (e) { setErr((e as Error).message); } finally { setUp(null); }
  };
  const tickNow = () => act("tick", () => fetch("/api/admin/publish/tick?fresh=1", { method: "POST" }));

  const schedule = async () => {
    const platforms = ORDER.filter((p) => picked[p] && ready(p) && !(p === "facebook" && fbHand));
    const handCaption = split ? caps.facebook : caption;
    const body = {
      space, video_key: video, title, platforms,
      captions: split ? caps : { instagram: caption, facebook: caption, youtube: caption },
      scheduled_at: later && at ? new Date(at).toISOString() : new Date().toISOString(),
    };
    const j = await act("schedule", () => fetch("/api/admin/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    if (j) { if (fbHand) setHand({ title, caption: handCaption }); setTitle(""); setCaption(""); setCaps({ instagram: "", facebook: "", youtube: "" }); setFilled(null); setFromLibrary(null); if (!later) tickNow(); }
  };
  const change = (id: string, action: string) => act(action + id, () => fetch(`/api/admin/publish/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })).then((j) => { if (j && (action === "now" || action === "retry")) tickNow(); });
  const forget = (p: Platform) => { if (confirm(`Forget the ${NAMES[p]} login? Posts to it stop until you connect again.`)) act("forget" + p, () => fetch(`/api/admin/publish/accounts?space=${space}&platform=${p}`, { method: "DELETE" })); };

  const s = data?.setup;
  const missing = s ? [
    !s.tokenKey && "PUBLISH_TOKEN_KEY", !s.meta && "META_APP_ID + META_APP_SECRET", !s.google && "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET",
    !s.cron && "PUBLISH_CRON_SECRET", !s.agent && "PUBLISH_AGENT_TOKEN", !s.storage && "video storage (PUBLISH_R2_ settings for your own, or the Marketing R2 settings)",
  ].filter(Boolean) as string[] : [];
  const anyReady = ORDER.some((p) => picked[p] && ready(p) && !(p === "facebook" && fbHand));
  const canPost = !!video && anyReady && (!picked.youtube || !ready("youtube") || !!title.trim()) && (!later || !!at) && busy === null;
  const startAgain = () => { setVideo(""); setTitle(""); setCaption(""); setCaps({ instagram: "", facebook: "", youtube: "" }); setSplit(false); setPicked({ instagram: true, facebook: true, youtube: true }); setLater(false); setAt(""); setFilled(null); setFromLibrary(null); setHand(null); setCopied(null); };
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setCopied(`${what} copied.`); } catch { setCopied("Your browser would not copy. Select the text and copy it by hand."); } };
  const handTitle = hand?.title ?? title, handCaption = hand?.caption ?? (split ? caps.facebook : caption);
  const playHref = video ? `/api/admin/publish/play?space=${space}&key=${encodeURIComponent(video)}` : "";

  return (
    <div className="mk-up">
      <div className="mk-chips" role="tablist" aria-label="Which accounts">
        {SPACES.map((s) => <button key={s} className="bc-pill" role="tab" aria-pressed={space === s} onClick={() => setSpace(s)}>{SPACE_NAMES[s]}</button>)}
      </div>
      <p className="mk-plain">{space === "football" ? "Your football accounts. Only you." : space === "content" ? "Your other content accounts (cutting videos and the like). Only you." : "The Knowitball team accounts. Every admin."}</p>
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
          <a className="bc-btn" data-main="true" href={`/api/admin/publish/connect/meta?space=${space}`}>{ready("facebook") ? "Reconnect Facebook + Instagram" : "Connect Facebook + Instagram"}</a>
          <a className="bc-btn" href={`/api/admin/publish/connect/youtube?space=${space}`}>{ready("youtube") ? "Reconnect YouTube" : "Connect YouTube"}</a>
        </div>
        <p className="mk-plain">If YouTube holds a video as private (the project's YouTube audit), that post says so and you can switch it to Public in YouTube Studio.</p>
      </Panel>

      <Panel title="New post">
        <label className="mk-field"><span>1 · Pick the video</span>
          <select value={video} onChange={(e) => setVideo(e.target.value)}>
            <option value="">{data?.videos.length ? "Pick a video" : "No videos yet: upload one below"}</option>
            {(data?.videos ?? []).map((v) => <option key={v.key} value={v.key}>{v.source === "own" ? "Mine · " : "Knowitball · "}{data?.details?.[v.key]?.name || v.name} · {sizeLabel(v.size)}{v.uploaded ? ` · ${when(v.uploaded)}` : ""}</option>)}
          </select>
        </label>
        <div className="mk-links">
          <label className="bc-btn" aria-disabled={up !== null}>
            {up !== null ? `Uploading… ${Math.round(up * 100)}%` : "⬆ Upload a video"}
            <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" hidden disabled={up !== null} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
        <p className="mk-plain">{s?.ownStorage ? "Uploads go to your own video storage. Knowitball videos from Marketing → Uploads show here too, marked Knowitball." : "Uploads go to the team's Marketing storage until your own storage (PUBLISH_R2_ settings) is set up."}</p>
        {video && fromLibrary === true && <div className="mk-store" data-on="true"><span>Title, captions and hashtags filled in from the Library. Change anything below before you send.</span></div>}
        {video && fromLibrary === false && <div className="mk-problems"><p>This video has no saved words yet. Write them below, or add them once in <a href={`/admin/marketing/library?space=${space}`}>Library</a> so every post starts filled in.</p></div>}
        <p className="mk-plain"><b>2 · Where it goes</b></p>
        <div className="mk-chips">
          {ORDER.map((p) => {
            const hold = p === "facebook" && fbHand;
            return (
              <button key={p} className="bc-pill" aria-pressed={picked[p] && ready(p) && !hold} disabled={!ready(p) || hold} onClick={() => setPicked((x) => ({ ...x, [p]: !x[p] }))}>
                {picked[p] && ready(p) && !hold ? "✓ " : ""}{NAMES[p]}{hold ? " (by hand)" : ready(p) ? "" : " (not connected)"}
              </button>
            );
          })}
          <button className="bc-pill" aria-pressed={fbHand} onClick={() => setFbHand(!fbHand)} title="Meta lets no app post to a personal profile. This gives you the video and caption to post yourself.">{fbHand ? "✓ " : ""}Facebook: I post it by hand</button>
        </div>
        <p className="mk-plain"><b>3 · The words</b></p>
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
        <p className="mk-plain"><b>4 · When</b></p>
        <div className="mk-chips">
          <button className="bc-pill" aria-pressed={!later} onClick={() => setLater(false)}>Post now</button>
          <button className="bc-pill" aria-pressed={later} onClick={() => setLater(true)}>Schedule</button>
          {later && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
        </div>
        <p className="mk-plain"><b>5 · Send</b></p>
        <div className="mk-chips">
          <button className="bc-btn" data-main="true" disabled={!canPost} onClick={schedule}>{busy === "schedule" ? "Saving…" : later ? "Schedule post" : "Post now"}</button>
          <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={startAgain}>Start again</button>
        </div>
        <p className="mk-plain">Posts go out within 5 minutes of their time. Instagram takes a few more minutes to process a Reel. Below, the post updates every 10 seconds while it is on its way.</p>
        {(fbHand && (video || hand)) && (
          <div className="mk-store" data-on="true">
            <b>Facebook is yours</b>
            <span>Open the video, save it, post it as a Reel on your profile and paste the caption.</span>
            <div className="mk-chips">
              <a className="bc-btn" href={playHref} target="_blank" rel="noreferrer">Open the video</a>
              <button className="bc-pill" aria-pressed={false} onClick={() => copy(handCaption, "Caption")}>Copy the caption</button>
              {handTitle && <button className="bc-pill" aria-pressed={false} onClick={() => copy(handTitle, "Title")}>Copy the title</button>}
            </div>
            {copied && <span role="status">{copied}</span>}
          </div>
        )}
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
