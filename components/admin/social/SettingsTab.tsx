"use client";
/** Settings and power tools: how the game makes posts, plus reset, re-make, files and clean-up. */
import { useMemo, useState } from "react";
import type { Archetype, MediaStudio, Tag } from "@/lib/star/media/types";
import { emptyMedia } from "@/lib/star/media/feed";
import { emptyMemory } from "@/lib/star/media/memory";
import {
  ALL_TAGS, ARCHETYPES, GRAPHIC_KINDS, addPosts, deletePosts, eventKinds, exportMedia, hasVideo, lastMatchForm,
  lastMatchPostIds, matchIdea, parseMedia, updatePosts, withStudio,
} from "@/lib/star/media/studioTools";
import { Btn } from "@/components/admin/broadcast/BroadcastPage";
import { Field, Text, download, pickFile, useStudio } from "./kit";

function wipeDb(name: string): Promise<boolean> {
  return new Promise(res => {
    try {
      const r = indexedDB.deleteDatabase(name);
      r.onsuccess = () => res(true); r.onerror = () => res(false); r.onblocked = () => res(false);
    } catch { res(false); }
  });
}

export default function SettingsTab() {
  const { media, career, apply, confirm, flash } = useStudio();
  const st: MediaStudio = media.studio ?? {};
  const setSt = (label: string, f: (s: MediaStudio) => MediaStudio) => apply(label, m => withStudio(m, f));
  const kinds = useMemo(() => eventKinds(), []);
  const [q, setQ] = useState("");
  const off = new Set(st.disabledEvents ?? []);
  const offTags = new Set(st.disabledTags ?? []);
  const offPics = new Set(st.disabledGraphics ?? []);
  const count = (f: (p: (typeof media.posts)[number]) => boolean) => media.posts.filter(f).length;
  const lastIds = lastMatchPostIds(media);
  const form = lastMatchForm(career);

  return (
    <div className="ss-col" style={{ gap: 16 }}>
      <div className="ss-grid3">
        <div className="ss-stat"><b>{media.posts.length}</b><span>posts in the save</span></div>
        <div className="ss-stat"><b>{count(hasVideo)}</b><span>with a video</span></div>
        <div className="ss-stat"><b>{count(p => !!p.studio)}</b><span>made here</span></div>
        <div className="ss-stat"><b>{count(p => !!p.pinned)}</b><span>pinned</span></div>
        <div className="ss-stat"><b>{count(p => !!p.hidden)}</b><span>hidden</span></div>
        <div className="ss-stat"><b>{media.trends.length}</b><span>trends</span></div>
      </div>

      <section className="ss-col">
        <b>How many posts</b>
        <Field label={`Posts a match: ${st.volume === undefined ? "as the game decides" : `×${st.volume}`}`}>
          <span className="ss-row" style={{ flexWrap: "nowrap" }}>
            <input type="range" min={0.25} max={3} step={0.25} value={st.volume ?? 1} onChange={e => setSt("Posts a match", s => ({ ...s, volume: Number(e.target.value) }))} style={{ flex: 1 }} />
            <Btn onClick={() => setSt("Posts a match: game", s => ({ ...s, volume: undefined }))}>As the game</Btn>
          </span>
        </Field>
        <Field label={`Feed size (posts the save keeps): ${st.postCap ?? "150, the game's own"}`}>
          <span className="ss-row" style={{ flexWrap: "nowrap" }}>
            <input type="range" min={30} max={400} step={10} value={st.postCap ?? 150} onChange={e => setSt("Feed size", s => ({ ...s, postCap: Number(e.target.value) }))} style={{ flex: 1 }} />
            <Btn onClick={() => setSt("Feed size: game", s => ({ ...s, postCap: undefined }))}>150 (game)</Btn>
          </span>
        </Field>
        <div className="ss-sub">A bigger feed makes the save bigger (each post is about 1 KB). The oldest posts go first once it is full.</div>
      </section>

      <section className="ss-col">
        <b>How often each kind of account posts</b>
        <div className="ss-grid2">
          {ARCHETYPES.map(a => {
            const w = st.archetypeWeights?.[a];
            return (
              <Field key={a} label={`${a}: ${w === undefined ? "as the game" : w === 0 ? "never" : `×${w}`}`}>
                <span className="ss-row" style={{ flexWrap: "nowrap" }}>
                  <input type="range" min={0} max={3} step={0.25} value={w ?? 1} style={{ flex: 1 }}
                    onChange={e => setSt(`${a} posts`, s => ({ ...s, archetypeWeights: { ...(s.archetypeWeights ?? {}), [a]: Number(e.target.value) } }))} />
                  {w !== undefined && <button className="ss-x" title="As the game" onClick={() => setSt(`${a} posts: game`, s => { const x = { ...(s.archetypeWeights ?? {}) } as Partial<Record<Archetype, number>>; delete x[a]; return { ...s, archetypeWeights: x }; })}>↺</button>}
                </span>
              </Field>
            );
          })}
        </div>
        <div className="ss-sub">Single accounts: Accounts → an account → How often it posts.</div>
      </section>

      <section className="ss-col">
        <b>Subjects (tap to turn off — nobody posts about them)</b>
        <div className="ss-row" style={{ gap: 4 }}>
          {ALL_TAGS.map(t => <button key={t} className="ss-chip ss-chip-btn" data-off={offTags.has(t)} onClick={() => setSt(`${offTags.has(t) ? "On" : "Off"}: ${t}`, s => ({ ...s, disabledTags: offTags.has(t) ? (s.disabledTags ?? []).filter(x => x !== t) : [...(s.disabledTags ?? []), t as Tag] }))}>{t}</button>)}
        </div>
        <b>Pictures (tap to turn off — the post keeps its words)</b>
        <div className="ss-row" style={{ gap: 4 }}>
          {GRAPHIC_KINDS.map(g => <button key={g.type} className="ss-chip ss-chip-btn" data-off={offPics.has(g.type)} onClick={() => setSt(`${offPics.has(g.type) ? "On" : "Off"}: ${g.label}`, s => ({ ...s, disabledGraphics: offPics.has(g.type) ? (s.disabledGraphics ?? []).filter(x => x !== g.type) : [...(s.disabledGraphics ?? []), g.type] }))}>{g.label}</button>)}
        </div>
        <b>Kinds of post ({off.size} off of {kinds.length})</b>
        <Text value={q} onChange={setQ} placeholder="Search kinds: hat-trick, derby, rumour…" />
        <div className="ss-row" style={{ gap: 4, maxHeight: 220, overflowY: "auto" }}>
          {kinds.filter(k => !q || k.includes(q.toLowerCase())).map(k => (
            <button key={k} className="ss-chip ss-chip-btn" data-off={off.has(k)} onClick={() => setSt(`${off.has(k) ? "On" : "Off"}: ${k}`, s => ({ ...s, disabledEvents: off.has(k) ? (s.disabledEvents ?? []).filter(x => x !== k) : [...(s.disabledEvents ?? []), k] }))}>{k}</button>
          ))}
        </div>
        <div className="ss-sub">These change what the game makes from the next match on; posts already in the feed stay (hide or delete them in Feed).</div>
      </section>

      <section className="ss-col">
        <b>Power tools</b>
        <div className="ss-row">
          <Btn disabled={!form} onClick={() => confirm("Re-make the last match's posts?", `The ${lastIds.length} posts from your last match (${form?.us ?? 0}-${form?.them ?? 0} v ${form?.opponent ?? "?"}) are replaced with a fresh set, written from what the save remembers about it (score, your goals, rating).`, () => {
            const fresh = matchIdea(career, form!, `remake${Date.now() % 100000}`);
            apply("Re-make last match", m => addPosts(deletePosts(m, lastIds), fresh.posts));
          })}>🔁 Re-make last match&apos;s posts</Btn>
          <Btn onClick={() => apply("Show all hidden", m => updatePosts(m, m.posts.filter(p => p.hidden).map(p => p.id), { hidden: undefined }))}>Show all hidden</Btn>
          <Btn onClick={() => apply("Unpin all", m => updatePosts(m, m.posts.filter(p => p.pinned).map(p => p.id), { pinned: undefined }))}>Unpin all</Btn>
          <Btn onClick={() => confirm("Delete everything made here?", `${count(p => !!p.studio)} posts written or added in the studio leave the save.`, () => apply("Delete studio posts", m => deletePosts(m, m.posts.filter(p => p.studio).map(p => p.id))))}>Delete posts made here</Btn>
          <Btn onClick={() => confirm("Clear every studio setting?", "Account changes, new accounts, weights, things turned off, feed size and pinned trends all go. Posts stay.", () => apply("Clear studio settings", m => withStudio(m, () => ({}))))}>Clear studio settings</Btn>
          <button className="bc-btn ss-danger" onClick={() => confirm("Reset the whole feed?", "Every post, the trends and the media's memory of your story go. Studio settings stay. The game starts posting again from your next match.", () => apply("Reset feed", m => ({ ...emptyMedia(), memory: emptyMemory(), ...(m.studio ? { studio: m.studio } : {}), ...(m.gotm ? { gotm: m.gotm } : {}), seenCycleIds: m.seenCycleIds ?? [], lastCycleId: m.lastCycleId, lastLeagueCycleId: m.lastLeagueCycleId })))}>Reset feed</button>
        </div>
        <div className="ss-row">
          <Btn onClick={() => download(`knowitball-media-s${career.season}-w${career.week}.json`, exportMedia(career))}>⬇ Export media (posts, accounts, settings)</Btn>
          <Btn onClick={async () => {
            const text = await pickFile();
            if (!text) return;
            const m = parseMedia(text);
            if (!m) { flash("That file isn't a media export."); return; }
            confirm("Load this media file?", `This save's feed is replaced with the file's: ${m.posts.length} posts.`, () => apply("Import media", () => m));
          }}>⬆ Import media</Btn>
        </div>
        <div className="ss-row">
          <Btn onClick={() => confirm("Wipe kept goal videos?", "The finished video files on this device are deleted. They are made again from the recordings when watched (a few seconds each). Nothing in the save changes.", async () => { flash((await wipeDb("star-goal-videos")) ? "Kept videos wiped." : "Couldn't wipe — close the game in other tabs and try again."); })}>Wipe kept goal videos</Btn>
          <button className="bc-btn ss-danger" onClick={() => confirm("Wipe goal recordings?", "Every recorded goal on this device is deleted. Their posts then show made-up goals or no video. This can't be undone, not even with Undo.", async () => { flash((await wipeDb("star-goal-clips")) ? "Recordings wiped." : "Couldn't wipe — close the game in other tabs and try again."); })}>Wipe goal recordings</button>
        </div>
      </section>
    </div>
  );
}
