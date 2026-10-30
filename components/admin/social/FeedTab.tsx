"use client";
/** Feed editor: every post in the save — find, edit, pin, hide, delete, reorder, in bulk. */
import { useMemo, useState } from "react";
import type { Archetype, GraphicKind, StoredPost } from "@/lib/star/media/types";
import { clockAt } from "@/lib/star/media/schedule";
import { studioAuthor } from "@/lib/star/media/studio";
import {
  ARCHETYPES, GRAPHIC_KINDS, authorOf, defaultGraphic, deletePosts, duplicatePosts, filterPosts, hasVideo,
  nowClock, nudgePost, splitClock, updatePosts, type PostFilter,
} from "@/lib/star/media/studioTools";
import { toggleLike } from "@/lib/star/media/feed";
import PostCard from "@/components/star/media/PostCard";
import Avatar from "@/components/star/media/Avatar";
import { Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import GraphicForm from "./GraphicForm";
import { Check, Field, Num, Select, Text, clockLabel, fmt, useStudio } from "./kit";

const PAGE = 60;

export default function FeedTab() {
  const { media, career, apply, confirm, rows, flash } = useStudio();
  const [f, setF] = useState<PostFilter>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [bulkAuthor, setBulkAuthor] = useState("");

  const newestFirst = useMemo(() => [...media.posts].sort((a, b) => b.at - a.at), [media.posts]);
  const shown = useMemo(() => filterPosts(newestFirst, f), [newestFirst, f]);
  const weeks = useMemo(() => Array.from(new Set(media.posts.map(p => `${splitClock(p.at).season}-${splitClock(p.at).week}`))), [media.posts]);
  const handles = useMemo(() => Array.from(new Set(media.posts.map(p => p.author.handle))).sort(), [media.posts]);
  const ids = Array.from(sel).filter(id => media.posts.some(p => p.id === id));
  const n = ids.length;
  const set = (k: keyof PostFilter, v: unknown) => { setF(x => ({ ...x, [k]: v === "" ? undefined : v })); setLimit(PAGE); };

  const bulk = (label: string, patch: Partial<StoredPost> | ((p: StoredPost) => StoredPost)) => apply(`${label} (${n})`, m => updatePosts(m, ids, patch));

  return (
    <div className="ss-col">
      <div className="ss-grid3">
        <Field label="Search words"><Text value={f.text ?? ""} placeholder="text, account, kind…" onChange={v => set("text", v)} /></Field>
        <Field label="Account">
          <Select value={f.handle ?? ""} onChange={v => set("handle", v)} options={[{ value: "", label: "Every account" }, ...handles.map(h => ({ value: h, label: h }))]} />
        </Field>
        <Field label="Kind of account">
          <Select value={(f.archetype ?? "") as string} onChange={v => set("archetype", v as Archetype)} options={[{ value: "", label: "Any kind" }, ...ARCHETYPES.map(a => ({ value: a, label: a }))]} />
        </Field>
        <Field label="Picture">
          <Select value={(f.graphic ?? "") as string} onChange={v => set("graphic", v as GraphicKind)} options={[{ value: "", label: "Any" }, { value: "none", label: "Words only" }, ...GRAPHIC_KINDS.map(g => ({ value: g.type, label: g.label }))]} />
        </Field>
        <Field label="Phone tab">
          <Select value={(f.scope ?? "") as string} onChange={v => set("scope", v)} options={[{ value: "", label: "Any" }, { value: "club", label: "Club" }, { value: "league", label: "England" }, { value: "none", label: "Neither (old post)" }]} />
        </Field>
        <Field label="Week">
          <Select value={f.week === undefined ? "" : `${f.season}-${f.week}`} onChange={v => { if (!v) { setF(x => ({ ...x, week: undefined, season: undefined })); return; } const [s, w] = v.split("-").map(Number); setF(x => ({ ...x, season: s, week: w })); }}
            options={[{ value: "", label: "Every week" }, ...weeks.map(w => ({ value: w, label: `Season ${w.split("-")[0]} · Week ${w.split("-")[1]}` }))]} />
        </Field>
        <Field label="Marked">
          <Select value={f.flag ?? ""} onChange={v => set("flag", v)} options={[{ value: "", label: "Any" }, { value: "pinned", label: "Pinned" }, { value: "hidden", label: "Hidden" }, { value: "studio", label: "Made here" }, { value: "liked", label: "Liked" }]} />
        </Field>
        <Field label="Video"><Check value={!!f.video} onChange={v => set("video", v || undefined)} label="Only posts with a video" /></Field>
      </div>

      <div className="ss-row" style={{ justifyContent: "space-between" }}>
        <span className="ss-sub">{shown.length} of {media.posts.length} posts · newest first, as the phone shows them</span>
        <span className="ss-row">
          <Btn onClick={() => setSel(new Set(shown.map(p => p.id)))}>Select all shown</Btn>
          {n > 0 && <Btn onClick={() => setSel(new Set())}>Clear selection</Btn>}
        </span>
      </div>

      {n > 0 && (
        <div className="ss-bulk">
          <b style={{ fontSize: 13 }}>{n} picked:</b>
          <Btn onClick={() => bulk("Pin", { pinned: true })}>📌 Pin</Btn>
          <Btn onClick={() => bulk("Unpin", { pinned: undefined })}>Unpin</Btn>
          <Btn onClick={() => bulk("Hide", { hidden: true })}>🙈 Hide</Btn>
          <Btn onClick={() => bulk("Show", { hidden: undefined })}>Show</Btn>
          <Btn onClick={() => bulk("Move to Club", { scope: "club" })}>→ Club tab</Btn>
          <Btn onClick={() => bulk("Move to England", { scope: "league" })}>→ England tab</Btn>
          <Btn onClick={() => bulk("A week later", p => ({ ...p, at: p.at + 10_000 }))}>+1 week</Btn>
          <Btn onClick={() => bulk("A week earlier", p => ({ ...p, at: Math.max(1_000_000, p.at - 10_000) }))}>−1 week</Btn>
          <Btn onClick={() => bulk("Make now", p => ({ ...p, at: nowClock(career) }))}>Make now</Btn>
          <Btn onClick={() => bulk("Double numbers", p => ({ ...p, metrics: { likes: p.metrics.likes * 2, reposts: p.metrics.reposts * 2, replies: p.metrics.replies * 2 } }))}>×2 likes</Btn>
          <Btn onClick={() => bulk("Remove pictures", { graphic: undefined })}>Remove pictures</Btn>
          <Btn onClick={() => { apply(`Duplicate (${n})`, m => duplicatePosts(m, ids)); }}>Duplicate</Btn>
          <span className="ss-row" style={{ flexWrap: "nowrap" }}>
            <select className="ss-select" style={{ width: 180 }} value={bulkAuthor} onChange={e => setBulkAuthor(e.target.value)}>
              <option value="">Change author to…</option>
              {rows.map(r => <option key={r.key} value={r.key}>{r.account.name} ({r.account.handle})</option>)}
            </select>
            <Btn disabled={!bulkAuthor} onClick={() => { const r = rows.find(x => x.key === bulkAuthor); if (r) bulk("Change author", { author: authorOf(r.account) }); }}>Set</Btn>
          </span>
          <button className="bc-btn ss-danger" onClick={() => confirm(`Delete ${n} posts?`, "They leave the save. Undo brings them back while this page is open.", () => { apply(`Delete (${n})`, m => deletePosts(m, ids)); setSel(new Set()); })}>🗑 Delete</button>
        </div>
      )}

      <div className="ss-list">
        {shown.slice(0, limit).map(p => {
          const a = studioAuthor(p.author, media.studio);
          const isOpen = open === p.id;
          return (
            <div key={p.id}>
              <div className="ss-item" data-open={isOpen} data-hidden={!!p.hidden} onClick={() => setOpen(isOpen ? null : p.id)}>
                <input type="checkbox" checked={sel.has(p.id)} onClick={e => e.stopPropagation()} onChange={e => setSel(s => { const x = new Set(s); if (e.target.checked) x.add(p.id); else x.delete(p.id); return x; })} style={{ marginTop: 10, width: 16, height: 16 }} />
                <Avatar initials={a.initials} tint={a.tint} tint2={a.tint2} glyph={a.glyph} size={34} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="ss-row" style={{ gap: 6 }}>
                    <b style={{ fontSize: 13.5 }}>{a.name}</b>
                    <span className="ss-sub">{a.handle} · {clockLabel(p.at)}</span>
                    {p.pinned && <span className="ss-chip" data-tone="amber">📌 pinned</span>}
                    {p.hidden && <span className="ss-chip" data-tone="red">hidden</span>}
                    {p.studio && <span className="ss-chip" data-tone="green">made here</span>}
                    {p.scope && <span className="ss-chip">{p.scope === "league" ? "England" : "Club"}</span>}
                    {p.graphic && <span className="ss-chip">{hasVideo(p) ? "🎥 " : ""}{GRAPHIC_KINDS.find(g => g.type === p.graphic!.type)?.label ?? p.graphic.type}</span>}
                    <span className="ss-sub">♥ {fmt(p.metrics.likes + (p.liked ? 1 : 0))}</span>
                  </div>
                  <div className="ss-body">{p.text}</div>
                </div>
                <span className="ss-col" style={{ gap: 2 }} onClick={e => e.stopPropagation()}>
                  <button className="bc-btn" title="Up the feed" onClick={() => apply("Move up", m => nudgePost(m, p.id, "up"))}>↑</button>
                  <button className="bc-btn" title="Down the feed" onClick={() => apply("Move down", m => nudgePost(m, p.id, "down"))}>↓</button>
                </span>
              </div>
              {isOpen && <PostEditor post={p} onClose={() => setOpen(null)} />}
            </div>
          );
        })}
      </div>
      {shown.length > limit && <div><Btn onClick={() => setLimit(l => l + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</Btn></div>}
      {!shown.length && <div className="ss-sub">No posts match. {media.posts.length ? "Clear a filter." : "This save has no posts yet: play a match, or use Write or Ideas."}</div>}
    </div>
  );
}

function PostEditor({ post, onClose }: { post: StoredPost; onClose: () => void }) {
  const { apply, confirm, rows, career, media } = useStudio();
  const [d, setD] = useState<StoredPost>(post);
  const c = splitClock(d.at);
  const dirty = JSON.stringify(d) !== JSON.stringify(post);
  const setClock = (season: number, week: number, minutes: number) => setD({ ...d, at: clockAt(season, week, minutes) });
  const save = () => apply("Edit post", m => updatePosts(m, [post.id], () => d));
  const future = d.at > nowClock(career);
  return (
    <div className="ss-editor">
      <div className="ss-layout" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0, 390px)" }}>
        <div className="ss-col">
          <Field label="Words"><textarea className="ss-text" value={d.text} onChange={e => setD({ ...d, text: e.target.value })} /></Field>
          <div className="ss-grid2">
            <Field label="Posted by">
              <select className="ss-select" value="" onChange={e => { const r = rows.find(x => x.key === e.target.value); if (r) setD({ ...d, author: { ...authorOf(r.account) } }); }}>
                <option value="">{d.author.name} ({d.author.handle}) — change…</option>
                {rows.map(r => <option key={r.key} value={r.key}>{r.account.name} ({r.account.handle})</option>)}
              </select>
            </Field>
            <Field label="Phone tab">
              <Select value={d.scope ?? ""} onChange={v => setD({ ...d, scope: (v || undefined) as StoredPost["scope"] })} options={[{ value: "club", label: "Club" }, { value: "league", label: "England" }, { value: "", label: "Neither (All only)" }]} />
            </Field>
            <Field label="Name on this post"><Text value={d.author.name} onChange={name => setD({ ...d, author: { ...d.author, name } })} /></Field>
            <Field label="Handle on this post"><Text value={d.author.handle} onChange={handle => setD({ ...d, author: { ...d.author, handle } })} /></Field>
          </div>
          <div className="ss-grid3">
            <Field label="Season"><Num value={c.season} min={1} onChange={v => setClock(v, c.week, c.minutes)} /></Field>
            <Field label="Week"><Num value={c.week} min={0} max={99} onChange={v => setClock(c.season, v, c.minutes)} /></Field>
            <Field label="Minutes after kick-off (0–9999)"><Num value={c.minutes} min={0} max={9999} onChange={v => setClock(c.season, c.week, v)} /></Field>
            <Field label="Likes"><Num value={d.metrics.likes} min={0} onChange={likes => setD({ ...d, metrics: { ...d.metrics, likes } })} /></Field>
            <Field label="Reposts"><Num value={d.metrics.reposts} min={0} onChange={reposts => setD({ ...d, metrics: { ...d.metrics, reposts } })} /></Field>
            <Field label="Replies"><Num value={d.metrics.replies} min={0} onChange={replies => setD({ ...d, metrics: { ...d.metrics, replies } })} /></Field>
          </div>
          {future && <div className="ss-sub" style={{ color: "#ffd98a" }}>This time is after the career&apos;s week now: the post waits and appears when the career gets there.</div>}
          <div className="ss-row">
            <Check value={!!d.author.verified} onChange={verified => setD({ ...d, author: { ...d.author, verified } })} label="Blue tick" />
            <Check value={!!d.liked} onChange={liked => setD({ ...d, liked: liked || undefined })} label="You liked it" />
            <Check value={!!d.pinned} onChange={pinned => setD({ ...d, pinned: pinned || undefined })} label="📌 Pin to top" />
            <Check value={!!d.hidden} onChange={hidden => setD({ ...d, hidden: hidden || undefined })} label="Hide" />
          </div>
          <Field label="Picture">
            <Select value={d.graphic?.type ?? ""} onChange={v => setD({ ...d, graphic: v ? defaultGraphic(v as GraphicKind, career) : undefined })}
              options={[{ value: "", label: "None (words only)" }, ...GRAPHIC_KINDS.map(g => ({ value: g.type, label: g.label }))]} />
          </Field>
          {d.graphic && <GraphicForm spec={d.graphic} onChange={graphic => setD({ ...d, graphic })} />}
          <div className="ss-row">
            <Btn main disabled={!dirty} onClick={save}>Save changes</Btn>
            <Btn disabled={!dirty} onClick={() => setD(post)}>Undo edits</Btn>
            <Btn onClick={() => apply("Duplicate", m => duplicatePosts(m, [post.id]))}>Duplicate</Btn>
            <Btn onClick={() => apply(post.liked ? "Unlike" : "Like", () => toggleLike({ ...career, media }, post.id).media!)}>{post.liked ? "Unlike" : "♥ Like"}</Btn>
            <button className="bc-btn ss-danger" onClick={() => confirm("Delete this post?", "It leaves the save. Undo brings it back while this page is open.", () => { apply("Delete post", m => deletePosts(m, [post.id])); onClose(); })}>🗑 Delete</button>
            <Btn onClick={onClose}>Close</Btn>
          </div>
          <div className="ss-sub ss-mono">id {post.id} · kind {post.eventId}</div>
        </div>
        <div className="ss-col">
          <span className="ss-sub">How it looks{dirty ? " (not saved yet)" : ""}</span>
          <div className="ss-card-preview"><PostCard post={{ ...d, author: studioAuthor(d.author, media.studio) }} now={Math.max(nowClock(career), d.at)} /></div>
        </div>
      </div>
    </div>
  );
}
