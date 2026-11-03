"use client";
/** Goal video lab: a recorded goal or a made-up one, cut any way, watched here, saved as a file, posted. */
import { useState } from "react";
import type { SynthGoal } from "@/lib/star/goalClip/synth";
import { addPosts, authorOf, madeUpGoal, makePost, nowClock, studioPostId, youName } from "@/lib/star/media/studioTools";
import GoalVideoSwitch from "@/components/star/media/GoalVideoSwitch";
import PostCard from "@/components/star/media/PostCard";
import { Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import { ClipPicker, SynthEditor } from "./GraphicForm";
import { Check, Field, Num, Select, Text, useStudio } from "./kit";

type Style = "broadcast" | "reverse" | "fan" | "tiktok";
const STYLE_WORDS: Record<Style, string> = { broadcast: "📺 Broadcast", reverse: "🔄 Reverse angle", fan: "📱 Fan in the stand", tiktok: "🎵 TikTok edit" };

export default function VideoTab() {
  const { career, accounts, apply, flash } = useStudio();
  const [source, setSource] = useState<"recorded" | "made">("made");
  const [clips, setClips] = useState<string[]>([]);
  const [synth, setSynth] = useState<SynthGoal[]>(() => [madeUpGoal(career, { seed: "lab1", kind: "long_range" })]);
  const [style, setStyle] = useState<Style>("broadcast");
  const [variant, setVariant] = useState(0);
  const [title, setTitle] = useState(`${career.player.lastName.toUpperCase()} | GOAL`);
  const [badge, setBadge] = useState("GOAL");
  const club = accounts.find(a => a.archetype === "club" && a.allegiance?.club === career.player.club) ?? accounts[0];
  const [who, setWho] = useState(club?.id ?? "");
  const author = accounts.find(a => a.id === who) ?? club;
  const [text, setText] = useState(`${youName(career)} 🚀`);
  const [scope, setScope] = useState<"club" | "league">("club");
  const [play, setPlay] = useState(0);
  const [pin, setPin] = useState(false);

  const ids = source === "recorded" ? clips : [];
  const made = source === "made" ? synth : [];
  const ready = ids.length + made.length > 0;
  const graphic = { type: "goalVideo" as const, title, clips: ids, ...(made.length ? { synth: made } : {}), style, variant };
  const key = JSON.stringify([ids, made, style, variant, title, badge, author?.handle, play]);

  const post = () => {
    if (!ready || !author) return;
    apply("Post a goal video", m => addPosts(m, [{ ...makePost({ id: studioPostId(m, "video"), author: authorOf(author), text, at: nowClock(career), graphic, scope, followers: author.followers, tags: ["goal"], eventId: "studio-video" }), ...(pin ? { pinned: true } : {}) }]));
    flash("Video posted — it's at the top of the phone.");
  };

  return (
    <div className="ss-layout" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,390px)" }}>
      <div className="ss-col">
        <div className="ss-tabs">
          <Pill on={source === "made"} onClick={() => setSource("made")}>Made-up goals</Pill>
          <Pill on={source === "recorded"} onClick={() => setSource("recorded")}>Recorded on this device</Pill>
        </div>
        {source === "recorded"
          ? <Field label="Pick one goal, or several for a highlights reel"><ClipPicker chosen={clips} onChange={setClips} /></Field>
          : (
            <div className="ss-col">
              <SynthEditor goals={synth} onChange={setSynth} />
              <div className="ss-row">
                <Btn onClick={() => setSynth(s => s.map(g => ({ ...g, seed: Math.random().toString(36).slice(2, 8) })))}>🎲 New goals (same scorers)</Btn>
                <Btn onClick={() => setSynth([madeUpGoal(career, { seed: Math.random().toString(36).slice(2, 8) })])}>One goal of yours</Btn>
              </div>
            </div>
          )}
        <Field label="Style">
          <div className="ss-tabs">{(Object.keys(STYLE_WORDS) as Style[]).map(s => <Pill key={s} on={style === s} onClick={() => setStyle(s)}>{STYLE_WORDS[s]}</Pill>)}</div>
        </Field>
        <div className="ss-grid3">
          <Field label="Cut (each number is a different edit)">
            <span className="ss-row" style={{ flexWrap: "nowrap" }}>
              <Btn onClick={() => setVariant(v => Math.max(0, v - 1))}>◀</Btn>
              <span style={{ width: 80, flex: "0 0 auto" }}><Num value={variant} min={0} onChange={setVariant} /></span>
              <Btn onClick={() => setVariant(v => v + 1)}>▶</Btn>
              <Btn onClick={() => setVariant(Math.floor(Math.random() * 1000))}>🎲</Btn>
            </span>
          </Field>
          <Field label="Title (read out, share text)"><Text value={title} onChange={setTitle} /></Field>
          <Field label="Badge on the still"><Text value={badge} onChange={setBadge} /></Field>
          <Field label="Watermark / posted by"><Select value={author?.id ?? ""} onChange={setWho} options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.handle})` }))} /></Field>
        </div>
        <div className="ss-row"><Btn onClick={() => setPlay(p => p + 1)}>↻ Make it again</Btn><span className="ss-sub">The video is made on this device (a few seconds). Use its own &quot;Save video&quot; button to keep the file.</span></div>
        <hr style={{ border: 0, borderTop: "1px solid var(--bc-line)", width: "100%" }} />
        <b>Post it</b>
        <Field label="Words"><textarea className="ss-text" value={text} onChange={e => setText(e.target.value)} /></Field>
        <div className="ss-row">
          <Select value={scope} onChange={setScope} options={[{ value: "club", label: "Club tab" }, { value: "league", label: "England tab" }]} />
          <Check value={pin} onChange={setPin} label="📌 Pin to top" />
          <Btn main disabled={!ready} onClick={post}>Post to the feed</Btn>
        </div>
      </div>
      <div className="ss-col">
        <span className="ss-sub">The video</span>
        <div className="ss-video-box">
          {ready ? (
            <GoalVideoSwitch key={key} clipIds={ids} synth={made} style={style} variant={variant} credit={author ? { handle: author.handle, name: author.name } : undefined}
              title={title} badge={badge} autoStart priority={2} fallback={<div className="ss-sub" style={{ padding: 20 }}>None of these goals are on this device.</div>} />
          ) : <div className="ss-sub" style={{ padding: 20 }}>Pick or make a goal.</div>}
        </div>
        {ready && author && (<>
          <span className="ss-sub">As a post</span>
          <div className="ss-card-preview"><PostCard post={makePost({ id: "video-preview", author: authorOf(author), text, at: nowClock(career), scope, followers: author.followers })} now={nowClock(career)} /></div>
        </>)}
      </div>
    </div>
  );
}
