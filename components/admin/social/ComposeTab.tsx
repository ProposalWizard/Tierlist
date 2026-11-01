"use client";
/** Composer: a new post from scratch — any account, any words, any picture, any time. */
import { useMemo, useRef, useState } from "react";
import type { Archetype, GraphicKind, GraphicSpec, StoredPost } from "@/lib/star/media/types";
import { clockAt } from "@/lib/star/media/schedule";
import { metricsFor, rngFor } from "@/lib/star/media/grammar";
import {
  ARCHETYPES, GRAPHIC_KINDS, TOKENS, addPosts, authorOf, defaultGraphic, fillTokens, makePost, newCustomAccount,
  nowClock, openGotmPoll, splitClock, studioPostId, withStudio,
} from "@/lib/star/media/studioTools";
import PostCard from "@/components/star/media/PostCard";
import { Btn } from "@/components/admin/broadcast/BroadcastPage";
import GraphicForm from "./GraphicForm";
import { Check, Field, Num, Select, Text, useStudio } from "./kit";

export default function ComposeTab() {
  const { career, media, apply, rows, flash } = useStudio();
  const [who, setWho] = useState<string>(() => rows.find(r => r.account.archetype === "club" && r.account.allegiance?.club === career.player.club)?.key ?? rows[0]?.key ?? "");
  const [newAcc, setNewAcc] = useState<{ on: boolean; name: string; handle: string; archetype: Archetype }>({ on: false, name: "", handle: "", archetype: "fan" });
  const [text, setText] = useState("What a performance from {you} today 🔥 {lastScore}");
  const [gType, setGType] = useState<GraphicKind | "">("");
  const [graphic, setGraphic] = useState<GraphicSpec | undefined>();
  const [when, setWhen] = useState<"now" | "set">("now");
  const now = splitClock(nowClock(career));
  const [at, setAt] = useState(now);
  const [scope, setScope] = useState<"club" | "league">("club");
  const [manual, setManual] = useState(false);
  const [metrics, setMetrics] = useState({ likes: 1200, reposts: 140, replies: 60 });
  const [pin, setPin] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  const row = rows.find(r => r.key === who);
  const account = newAcc.on ? null : row?.account;
  const author: StoredPost["author"] = account ? authorOf(account) : {
    ...authorOf({ ...newCustomAccount(newAcc.name || "New account", newAcc.archetype, newAcc.handle || undefined), id: "", voice: rows[0].account.voice, interests: {} }),
  };
  const time = when === "now" ? nowClock(career) : clockAt(at.season, at.week, at.minutes);
  const filled = fillTokens(text, career);
  const auto = useMemo(() => metricsFor(account?.followers ?? 5_000, 60, rngFor("compose", text.length, who)), [account?.followers, text.length, who]);
  const post = makePost({ id: "preview", author, text: filled, at: time, graphic, scope, metrics: manual ? metrics : auto });

  const insert = (tok: string) => {
    const el = ta.current;
    if (!el) { setText(t => t + tok); return; }
    const s = el.selectionStart ?? text.length, e = el.selectionEnd ?? text.length;
    const next = text.slice(0, s) + tok + text.slice(e);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + tok.length; });
  };

  const publish = () => {
    if (!filled.trim()) { flash("Write something first."); return; }
    apply("Publish post", m => {
      let out = m;
      if (newAcc.on) {
        const acc = newCustomAccount(newAcc.name || "New account", newAcc.archetype, newAcc.handle || undefined);
        out = withStudio(out, st => ({ ...st, customAccounts: [...(st.customAccounts ?? []).filter(a => a.handle !== acc.handle), acc] }));
      }
      if (graphic?.type === "gotmPoll") {
        // A real poll: filed with the game's polls so it closes after your next match.
        return openGotmPoll({ ...career, media: out }, graphic.entries, author, filled, graphic.monthName);
      }
      const p = makePost({ id: studioPostId(out, "compose"), author, text: filled, at: time, graphic, scope, metrics: post.metrics });
      return addPosts(out, [{ ...p, ...(pin ? { pinned: true } : {}) }]);
    });
    flash(time > nowClock(career) ? `Scheduled for Season ${splitClock(time).season} Week ${splitClock(time).week}.` : "Published — it's at the top of the phone.");
  };

  return (
    <div className="ss-layout" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,390px)" }}>
      <div className="ss-col">
        <div className="ss-grid2">
          <Field label="Posted by">
            <select className="ss-select" value={newAcc.on ? "__new" : who} onChange={e => { if (e.target.value === "__new") setNewAcc(n => ({ ...n, on: true })); else { setNewAcc(n => ({ ...n, on: false })); setWho(e.target.value); } }}>
              {ARCHETYPES.map(k => {
                const list = rows.filter(r => r.account.archetype === k);
                return list.length ? <optgroup key={k} label={k}>{list.map(r => <option key={r.key} value={r.key}>{r.account.name} ({r.account.handle})</option>)}</optgroup> : null;
              })}
              <option value="__new">+ A new account…</option>
            </select>
          </Field>
          <Field label="Phone tab">
            <Select value={scope} onChange={setScope} options={[{ value: "club", label: "Club (and All)" }, { value: "league", label: "England (and All)" }]} />
          </Field>
        </div>
        {newAcc.on && (
          <div className="ss-grid3">
            <Field label="New account's name"><Text value={newAcc.name} onChange={name => setNewAcc(n => ({ ...n, name }))} placeholder="Leo's Football Takes" /></Field>
            <Field label="Handle"><Text value={newAcc.handle} onChange={handle => setNewAcc(n => ({ ...n, handle }))} placeholder="@leotakes" /></Field>
            <Field label="Kind"><Select value={newAcc.archetype} onChange={archetype => setNewAcc(n => ({ ...n, archetype }))} options={ARCHETYPES.map(a => ({ value: a, label: a }))} /></Field>
            <div className="ss-sub" style={{ gridColumn: "1 / -1" }}>Saved with the post. Change its picture and colours in Accounts.</div>
          </div>
        )}
        <Field label="Words">
          <textarea ref={ta} className="ss-text" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 110 }} />
        </Field>
        <div className="ss-row" style={{ gap: 4 }}>
          <span className="ss-sub">Insert:</span>
          {TOKENS.map(t => (
            <button key={t.token} type="button" className="ss-chip ss-chip-btn" title={`${t.label}: ${t.value(career) || "(none yet)"}`} onClick={() => insert(t.token)}>{t.label}</button>
          ))}
        </div>
        <div className="ss-grid2">
          <Field label="Picture">
            <Select value={gType} onChange={v => { setGType(v); setGraphic(v ? defaultGraphic(v, career) : undefined); }}
              options={[{ value: "", label: "None (words only)" }, ...GRAPHIC_KINDS.map(g => ({ value: g.type, label: g.label }))]} />
          </Field>
          <Field label="When">
            <Select value={when} onChange={setWhen} options={[{ value: "now", label: `Now (Season ${now.season}, Week ${now.week})` }, { value: "set", label: "A set week and time" }]} />
          </Field>
        </div>
        {graphic && (
          <div className="ss-col" style={{ padding: 10, border: "1px solid var(--bc-line)", borderRadius: 6 }}>
            <div className="ss-row" style={{ justifyContent: "space-between" }}>
              <b style={{ fontSize: 13 }}>{GRAPHIC_KINDS.find(g => g.type === graphic.type)?.label}</b>
              <Btn onClick={() => setGraphic(defaultGraphic(graphic.type, career))}>Reset to the sample</Btn>
            </div>
            <GraphicForm spec={graphic} onChange={setGraphic} />
            {graphic.type === "gotmPoll" && <div className="ss-sub">Published as a real poll: the game closes it after your next match and posts the winner. Poll posts only show when Leo&apos;s update &quot;Goal of the Month&quot; is on.</div>}
          </div>
        )}
        {when === "set" && (
          <div className="ss-grid3">
            <Field label="Season"><Num value={at.season} min={1} onChange={season => setAt({ ...at, season })} /></Field>
            <Field label="Week"><Num value={at.week} min={0} max={99} onChange={week => setAt({ ...at, week })} /></Field>
            <Field label="Minutes after kick-off (0–9999)"><Num value={at.minutes} min={0} max={9999} onChange={minutes => setAt({ ...at, minutes })} /></Field>
            {time > nowClock(career) && <div className="ss-sub" style={{ gridColumn: "1 / -1", color: "#ffd98a" }}>In the future: it waits in the save and appears in the Feed when the career reaches Season {at.season}, Week {at.week}.</div>}
            {time < nowClock(career) - 40_000 && <div className="ss-sub" style={{ gridColumn: "1 / -1", color: "#ffd98a" }}>More than 4 weeks ago: the Feed only shows the last 4 weeks, so pin it or it won&apos;t show.</div>}
          </div>
        )}
        <div className="ss-row">
          <Check value={manual} onChange={setManual} label="Set the likes by hand" />
          <Check value={pin} onChange={setPin} label="📌 Pin to top" />
        </div>
        {manual && (
          <div className="ss-grid3">
            <Field label="Likes"><Num value={metrics.likes} min={0} onChange={likes => setMetrics({ ...metrics, likes })} /></Field>
            <Field label="Reposts"><Num value={metrics.reposts} min={0} onChange={reposts => setMetrics({ ...metrics, reposts })} /></Field>
            <Field label="Replies"><Num value={metrics.replies} min={0} onChange={replies => setMetrics({ ...metrics, replies })} /></Field>
          </div>
        )}
        <div className="ss-row">
          <Btn main onClick={publish}>Publish to the feed</Btn>
          <Btn onClick={() => { setText(""); setGType(""); setGraphic(undefined); }}>Start again</Btn>
        </div>
        <div className="ss-sub">{media.posts.length} posts in the save now.</div>
      </div>
      <div className="ss-col">
        <span className="ss-sub">How it will look</span>
        <div className="ss-card-preview"><PostCard post={post} now={Math.max(nowClock(career), time)} /></div>
      </div>
    </div>
  );
}
