"use client";
/**
 * Marketing → Results (Mikey, 28 Nov 2026): every post with Instagram, Facebook and YouTube side by side, the totals,
 * a Refresh button that re-reads the numbers now, and "What worked", short lessons the team writes down (table
 * marketing_lessons). The numbers are the ones the posting timer already collects (publish_posts.results).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/admin/broadcast/BroadcastPage";
import { fileLabel, viewsOf } from "@/lib/publish/library";
import { SPACES, SPACE_NAMES, isSpace, type Platform, type PublishPost, type Space } from "@/lib/publish/types";
import "./marketing.css";
import "./suite.css";

type Lesson = { id: string; body: string; created_by: string; created_at: string };
const APPS: { p: Platform; name: string }[] = [{ p: "instagram", name: "Instagram" }, { p: "facebook", name: "Facebook" }, { p: "youtube", name: "YouTube" }];
const N = (n: number | undefined | null) => (n == null ? "–" : n >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k` : n.toLocaleString());
const when = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
const stat = (post: PublishPost, p: Platform, k: string): number | undefined => { const s = post.results[p]?.stats; if (!s) return undefined; const v = s[k]; return typeof v === "number" ? v : undefined; };
const viewsFor = (post: PublishPost, p: Platform) => stat(post, p, "views") ?? (p === "facebook" ? stat(post, p, "plays") : undefined);
const likesFor = (post: PublishPost, p: Platform) => stat(post, p, p === "facebook" ? "reactions" : "likes");

export default function ResultsPanel() {
  const [space, setSpaceRaw] = useState<Space>("kib");
  // The address (?space=…) is read once the page is on screen, so the server's page and the browser's first draw match.
  const [urlRead, setUrlRead] = useState(false);
  useEffect(() => { const sp = new URLSearchParams(window.location.search).get("space"); if (isSpace(sp)) setSpaceRaw(sp); setUrlRead(true); }, []);
  const setSpace = (s: Space) => { setSpaceRaw(s); setPosts(null); setLessons([]); try { const u = new URL(window.location.href); u.searchParams.set("space", s); window.history.replaceState(null, "", u.toString()); } catch { /* ignore */ } };
  const [posts, setPosts] = useState<PublishPost[] | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<"new" | "views">("new");
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");

  const get = async (url: string) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20_000);
    try { const r = await fetch(url, { cache: "no-store", signal: ctl.signal }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Failed (${r.status}).`); return j; }
    catch (e) { throw new Error((e as Error).name === "AbortError" ? "That took too long to answer. Try again." : (e as Error).message); }
    finally { clearTimeout(t); }
  };
  const load = useCallback(async () => {
    if (!urlRead) return;
    try {
      const [a, b] = await Promise.all([get(`/api/admin/publish?space=${space}&lite=1`), get(`/api/admin/marketing/library/lessons?space=${space}`)]);
      setPosts(a.posts ?? []); setLessons(b.lessons ?? []); setErr(a.error ?? b.error ?? null);
    } catch (e) { setErr((e as Error).message); }
  }, [space, urlRead]);
  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setBusy("refresh"); setErr(null);
    try { const r = await fetch("/api/admin/publish/tick?fresh=1", { method: "POST" }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Refresh failed (${r.status}).`); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const addLesson = async () => {
    if (!text.trim()) return; setBusy("lesson");
    try { const r = await fetch("/api/admin/marketing/library/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space, body: text }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Failed (${r.status}).`); setText(""); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const delLesson = async (id: string) => {
    if (!confirm("Remove this lesson?")) return; setBusy("lesson");
    try { const r = await fetch(`/api/admin/marketing/library/lessons?space=${space}&id=${id}`, { method: "DELETE" }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Failed (${r.status}).`); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const live = useMemo(() => (posts ?? []).filter((p) => p.status === "done" || p.status === "partial"), [posts]);
  const rows = useMemo(() => [...live].sort((a, b) => (sort === "views" ? viewsOf(b.results) - viewsOf(a.results) : String(b.scheduled_at).localeCompare(String(a.scheduled_at)))), [live, sort]);
  const totalViews = live.reduce((n, p) => n + viewsOf(p.results), 0);
  const totalLikes = live.reduce((n, p) => n + APPS.reduce((m, a) => m + (likesFor(p, a.p) ?? 0), 0), 0);
  const best = [...live].sort((a, b) => viewsOf(b.results) - viewsOf(a.results))[0];
  const byApp = APPS.map((a) => ({ ...a, views: live.reduce((n, p) => n + (viewsFor(p, a.p) ?? 0), 0) })).sort((x, y) => y.views - x.views);

  return (
    <div className="mk-up">
      <div className="mk-chips" role="tablist" aria-label="Which accounts">
        {SPACES.map((s) => <button key={s} className="bc-pill" role="tab" aria-pressed={space === s} onClick={() => setSpace(s)}>{SPACE_NAMES[s]}</button>)}
      </div>
      {err && <div className="mk-problems" role="alert"><p>{err}</p></div>}

      <Panel title="Totals" note={posts ? `${live.length} posted` : undefined}>
        <div className="res-tiles">
          <div className="res-tile"><b>{N(live.length)}</b><small>posts</small></div>
          <div className="res-tile"><b>{N(totalViews)}</b><small>views, all apps</small></div>
          <div className="res-tile"><b>{N(totalLikes)}</b><small>likes and reactions</small></div>
          <div className="res-tile"><b>{best && viewsOf(best.results) > 0 ? N(viewsOf(best.results)) : "–"}</b><small>{best && viewsOf(best.results) > 0 ? `best: ${best.title || fileLabel(best.video_key)}` : "best post"}</small></div>
        </div>
        {live.length > 0 && totalViews > 0 && <p className="mk-plain">Most views so far: {byApp[0].name} ({N(byApp[0].views)}), then {byApp[1].name} ({N(byApp[1].views)}), then {byApp[2].name} ({N(byApp[2].views)}).</p>}
        <div className="mk-status"><span>Numbers refresh by themselves every 3 hours for 30 days after a post.</span>
          <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={refresh}>{busy === "refresh" ? "Refreshing… (about 20 s)" : "↻ Refresh numbers"}</button></div>
      </Panel>

      <Panel title="Every post, every app" note={posts ? `${rows.length}` : undefined}>
        <div className="mk-chips">
          <button className="bc-pill" aria-pressed={sort === "new"} onClick={() => setSort("new")}>Newest first</button>
          <button className="bc-pill" aria-pressed={sort === "views"} onClick={() => setSort("views")}>Most views first</button>
        </div>
        {!posts && !err && <p className="mk-empty">Loading…</p>}
        {posts && rows.length === 0 && <p className="mk-empty">Nothing posted from {SPACE_NAMES[space]} yet. Once a post is up it appears here with its numbers.</p>}
        {rows.length > 0 && <div className="res-row res-head"><span>Post</span>{APPS.map((a) => <span key={a.p}>{a.name}</span>)}</div>}
        {rows.map((post) => (
          <div key={post.id} className="res-row">
            <span className="res-title"><b>{post.title || fileLabel(post.video_key)}</b><small>{when(post.scheduled_at)} · {fileLabel(post.video_key)} · by {post.created_by}</small></span>
            {APPS.map((a) => {
              const r = post.results[a.p];
              if (!post.platforms.includes(a.p)) return <span key={a.p}><em className="res-app">{a.name}</em><small>not posted</small></span>;
              if (!r || r.stage !== "done") return <span key={a.p}><em className="res-app">{a.name}</em><small>{r?.stage === "failed" ? "failed" : "on its way"}</small></span>;
              return <span key={a.p}><em className="res-app">{a.name}</em><b>{N(viewsFor(post, a.p))}</b> views<small>{N(likesFor(post, a.p))} likes{a.p !== "facebook" ? ` · ${N(stat(post, a.p, "comments"))} comments` : ""}{r.link && <> · <a href={r.link} target="_blank" rel="noreferrer">open</a></>}</small></span>;
            })}
          </div>
        ))}
      </Panel>

      <Panel title="What worked" note={`${lessons.length}`}>
        <p className="mk-plain">Short lines for the team: what got views, what flopped, what to try next.</p>
        <label className="mk-field"><span>Add a lesson</span><textarea rows={2} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Videos that start on a face got twice the views" /></label>
        <div className="mk-chips"><button className="bc-btn" data-main="true" disabled={busy !== null || !text.trim()} onClick={addLesson}>Add</button></div>
        {lessons.length === 0 && <p className="mk-empty">No lessons yet.</p>}
        {lessons.map((l) => (
          <div key={l.id} className="res-lesson">
            <span>{l.body}<small>{l.created_by} · {when(l.created_at)}</small></span>
            <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={() => delLesson(l.id)} title="Remove this lesson">Remove</button>
          </div>
        ))}
      </Panel>
    </div>
  );
}
