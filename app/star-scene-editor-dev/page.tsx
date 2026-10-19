"use client";
/**
 * 3D SCENE EDITOR — step 1 (Harry signed off the drawing, 19 Oct 2026: "all
 * signed off, just go"). Drawing: docs/handoffs/2026-10-19-ui-lookover/scene-editor/.
 *
 * Step 1 works on the Cut-scene Director only. Every dial tagged IN CODE in
 * the drawing drives the real director (lib/star/cutscene/director.ts) through
 * its optional `setEdit` hook: shot preset, lens, turn/rise, move + amount,
 * handheld shake (per shot), mood, exposure, key light, spotlight. Edits show
 * in the preview only; nothing is saved yet. PART / NEW dials are drawn greyed
 * with "coming next". The other places in the picker are coming next too.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Pill } from "@/components/admin/broadcast/BroadcastPage";
import "./editor.css";
import { FIXTURES, FIXTURE_LIST } from "@/lib/star/cutscene/fixtures";
import { MOODS } from "@/lib/star/cutscene/presets/moods";
import { SHOT_PRESETS } from "@/lib/star/cutscene/presets/camera";
import type { CameraMove, CameraTrack, CutsceneScript, MoodId, ShotPreset, Track } from "@/lib/star/cutscene/types";
import type { Director, DirectorEdit } from "@/lib/star/cutscene/director";

type Tag = "code" | "part" | "new";
const TAG: Record<Tag, string> = { code: "IN CODE", part: "PART", new: "NEW" };
const T = ({ k }: { k: Tag }) => <span className={`se-tag se-${k}`}>{TAG[k]}</span>;

const PLACES = [
  { id: "signing", name: "3D Signing" }, { id: "office", name: "Manager's Office" }, { id: "shop", name: "3D Shop" },
  { id: "garden", name: "3D Garden" }, { id: "house", name: "3D House" }, { id: "director", name: "Cut-scene Director" },
];
const TOP_PRESETS: [ShotPreset, string][] = [["wide", "Wide"], ["ots", "Over the shoulder"], ["close", "Close"], ["two-shot", "Two-shot"], ["low-hero", "Low hero"]];
const MOVES: [CameraMove, string][] = [["static", "Still"], ["push", "Push"], ["orbit-left", "Orbit"], ["crane-up", "Crane"]];
const SHOWN_MOODS: MoodId[] = ["golden-hour", "dawn", "floodlit-night", "overcast", "interior-warm", "interior-cool", "rain-night", "spotlight"];

type ShotEdit = NonNullable<DirectorEdit["shots"]>[number];
type MobTab = "camera" | "lighting" | "cast" | "scene";

export default function SceneEditorPage() {
  const [fixture, setFixture] = useState("signing");
  const script: CutsceneScript = useMemo(() => FIXTURES[fixture](), [fixture]);
  const holder = useRef<HTMLDivElement>(null);
  const dir = useRef<Director | null>(null);
  const building = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shotName, setShotName] = useState("");
  const [cams, setCams] = useState<CameraTrack[]>([]);
  const [shots, setShots] = useState<Record<number, ShotEdit>>({});
  const [mood, setMood] = useState<MoodId | undefined>();
  const [exposure, setExposure] = useState(1);
  const [keyLight, setKeyLight] = useState(1);
  const [spot, setSpot] = useState<{ actor: string; intensity: number } | null>(null);
  const [tab, setTab] = useState<MobTab>("camera");

  // build the director for the chosen script
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    setStatus("loading"); setShots({}); setMood(undefined); setExposure(1); setKeyLight(1); setSpot(null);
    // one director at a time: the renderer is shared (three3d/perf), so a late-finishing build
    // that is thrown away would stop the live one's loop. Each build waits for the last.
    building.current = building.current.then(async () => {
      if (dead) return;
      try {
        const { createDirector } = await import("@/lib/star/cutscene/director");
        const d = await createDirector(el, script, {
          holdAt: 0,
          onOverlay: (o) => { setTime(o.t); setShotName(o.shot ?? ""); },
        });
        if (dead) { d.dispose(); return; }
        dir.current = d;
        setCams(d.cameras());
        setStatus("ready");
        (window as unknown as { __editorReady?: boolean }).__editorReady = true;
      } catch (e) {
        console.error("Scene editor: director failed", e);
        if (!dead) setStatus("off");
      }
    });
    return () => { dead = true; dir.current?.dispose(); dir.current = null; };
  }, [script]);

  // live edits → the director (preview only)
  useEffect(() => {
    dir.current?.setEdit({ shots, mood, exposure, keyLight, spot });
  }, [shots, mood, exposure, keyLight, spot, status]);

  // keep the play button honest
  useEffect(() => { const id = setInterval(() => setPlaying(!!dir.current?.playing()), 200); return () => clearInterval(id); }, []);

  const d = dir.current;
  const dur = d?.duration ?? script.duration;
  const shotIdx = Math.max(0, cams.findIndex((c) => time >= c.at && time < c.at + c.dur));
  const cam = cams[shotIdx];
  const cur: ShotEdit = { ...(cam?.shot ?? {}), ...(shots[shotIdx] ?? {}) } as ShotEdit;
  const lens = cur.lens ?? (cur.preset ? SHOT_PRESETS[cur.preset].lens : 35);
  const editShot = (e: ShotEdit) => setShots((s) => ({ ...s, [shotIdx]: { ...(s[shotIdx] ?? {}), ...e } }));
  const curMood: MoodId = mood ?? script.set.mood;
  const seek = (v: number) => { d?.seek(v); setTime(v); };
  const moveKind = (m?: CameraMove) => (!m || m === "static" ? "static" : m.startsWith("orbit") ? "orbit-left" : m.startsWith("crane") ? "crane-up" : m === "track" || m === "follow" ? "static" : "push");

  const playBar = (
    <div className="se-play">
      <button className="se-big" data-play onClick={() => { if (d?.playing()) d.pause(); else d?.play(); setPlaying(!playing); }}>{playing ? "❚❚ PAUSE" : "▶ PLAY"}</button>
      <T k="code" />
      <button className="se-small" data-replay onClick={() => d?.replay()}>↺ Replay</button>
      <span className="se-time" data-time>{time.toFixed(1)} s / {dur.toFixed(1)} s · scrub = director.seek(t)</span>
      <T k="code" />
      <button className="se-save" disabled title="Saving comes next">SAVE SHOT</button><T k="new" />
      <span className="se-dim">writes back to the script (needs a store) — coming next</span>
    </div>
  );

  const camera = (
    <div className="se-sec" data-sec="camera">
      <h3>CAMERA <span className="se-shot">shot {shotIdx + 1} of {cams.length}{cam?.name ? ` · ${cam.name}` : ""}</span></h3>
      <div className="se-pills">
        {TOP_PRESETS.map(([p, n]) => <Pill key={p} on={cur.preset === p} onClick={() => editShot({ preset: p })}>{n}</Pill>)}
        <select className="se-sel" data-preset value={cur.preset ?? ""} onChange={(e) => editShot({ preset: e.target.value as ShotPreset })}>
          {(Object.keys(SHOT_PRESETS) as ShotPreset[]).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <Row label="Shot preset" tag="code" help="18 framings in presets/camera.ts. Changes the shot under the playhead." />
      <Row label="Position X/Y/Z" tag="part" help="where the camera stands — coming next" greyed><input type="range" disabled /><span className="se-val">—</span></Row>
      <Row label="Look at (target)" tag="part" help="what it points at — coming next" greyed><input type="range" disabled /><span className="se-val">—</span></Row>
      <Row label="Lens (mm)" tag="code" help="zoom: wide 18 ↔ close 120 (ShotSpec.lens)">
        <input data-lens type="range" min={18} max={120} step={1} value={lens} onChange={(e) => editShot({ lens: +e.target.value })} /><span className="se-val">{Math.round(lens)}</span>
      </Row>
      <Row label="Turn" tag="code" help="swing round the subject (yaw, degrees)">
        <input type="range" min={-90} max={90} step={1} value={cur.yaw ?? 0} onChange={(e) => editShot({ yaw: +e.target.value })} /><span className="se-val">{(cur.yaw ?? 0) > 0 ? "+" : ""}{Math.round(cur.yaw ?? 0)}°</span>
      </Row>
      <Row label="Rise" tag="code" help="lift the camera up (metres)">
        <input type="range" min={-1} max={3} step={0.05} value={cur.rise ?? 0} onChange={(e) => editShot({ rise: +e.target.value })} /><span className="se-val">{(cur.rise ?? 0).toFixed(2)}</span>
      </Row>
      <Row label="Move" tag="code" help="how the shot moves while held">
        <div className="se-pills">{MOVES.map(([m, n]) => <Pill key={m} on={moveKind(cur.move) === m} onClick={() => editShot({ move: m })}>{n}</Pill>)}</div>
      </Row>
      <Row label="Move amount" tag="code" help="metres for a push, degrees for an orbit">
        <input type="range" min={0} max={30} step={0.1} value={cur.moveAmount ?? 0} onChange={(e) => editShot({ moveAmount: +e.target.value })} /><span className="se-val">{(cur.moveAmount ?? 0).toFixed(1)}</span>
      </Row>
      <Row label="Handheld shake" tag="code" help="0 still ↔ 1 shaky">
        <input type="range" min={0} max={1} step={0.01} value={cur.shake ?? 0} onChange={(e) => editShot({ shake: +e.target.value })} /><span className="se-val">{(cur.shake ?? 0).toFixed(2)}</span>
      </Row>
      <Row label="Free camera (drag to orbit)" tag="new" help="coming next" greyed />
    </div>
  );

  const lighting = (
    <div className="se-sec" data-sec="lighting">
      <h3>LIGHTING</h3>
      <Row label="Mood / time of day" tag="code" help="sky, sun, colour grade (presets/moods.ts)">
        <div className="se-pills">{SHOWN_MOODS.map((m) => <Pill key={m} on={curMood === m} onClick={() => setMood(m)}>{MOODS[m].name}</Pill>)}</div>
      </Row>
      <Row label="Exposure" tag="code" help="overall brightness">
        <input data-exposure type="range" min={0.3} max={2.5} step={0.05} value={exposure} onChange={(e) => setExposure(+e.target.value)} /><span className="se-val">{exposure.toFixed(2)}</span>
      </Row>
      <Row label="Key light strength" tag="code" help="the sun / key light">
        <input type="range" min={0} max={3} step={0.05} value={keyLight} onChange={(e) => setKeyLight(+e.target.value)} /><span className="se-val">{keyLight.toFixed(2)}</span>
      </Row>
      <Row label="Spotlight on a person" tag="code" help="light track spot">
        <div className="se-pills">
          <Pill on={!spot} onClick={() => setSpot(null)}>Off</Pill>
          {script.cast.map((c) => <Pill key={c.id} on={spot?.actor === c.id} onClick={() => setSpot({ actor: c.id, intensity: spot?.intensity ?? 1 })}>{c.id}</Pill>)}
        </div>
      </Row>
      {spot && (
        <Row label="Spot strength" tag="code" help="">
          <input type="range" min={0} max={3} step={0.05} value={spot.intensity} onChange={(e) => setSpot({ ...spot, intensity: +e.target.value })} /><span className="se-val">{spot.intensity.toFixed(2)}</span>
        </Row>
      )}
      <Row label="Key light angle" tag="new" help="coming next" greyed><input type="range" disabled /><span className="se-val">—</span></Row>
      <Row label="Key light marker: drag to move" tag="new" help="coming next" greyed />
    </div>
  );

  const castSec = (
    <div className="se-sec" data-sec="cast">
      <h3>CAST</h3>
      <div className="se-dim">{script.cast.map((c) => `${c.id} (${c.role})`).join(" · ")}</div>
      <Row label="Move a person / swap a clip" tag="new" help="coming next" greyed />
      <Row label="Drag handles: move look point" tag="new" help="coming next" greyed />
    </div>
  );
  const sceneSec = (
    <div className="se-sec" data-sec="scene">
      <h3>SCENE</h3>
      <div className="se-dim">Place: {script.set.location} · {script.cast.length} people · {script.props?.length ?? 0} props · {cams.length} shots</div>
      <Row label="Props and set dressing" tag="new" help="coming next" greyed />
      <Row label="Drag blocks to retime / add a track" tag="new" help="coming next" greyed />
    </div>
  );

  return (
    <BroadcastPage title="3D Scene Editor" sub="One editor for every 3D scene. Step 1: the Cut-scene Director." back="/star-3d-area-dev" width={1500}>
      <div className="se-key">
        <span><T k="code" /> the dial already exists in the code; the editor drives it</span>
        <span><T k="part" /> exists in one scene, must be opened up for the others</span>
        <span><T k="new" /> new work — coming next</span>
      </div>
      <div className="se-unsaved" data-unsaved>Not saved — edits show in the preview only. Saving comes next.</div>
      <div className="se-grid">
        <Panel title="3D PREVIEW" note="live: the real cut-scene director">
          <div className="se-places">
            {PLACES.map((p) => p.id === "director"
              ? <button key={p.id} className="se-place" aria-pressed="true">{p.name}</button>
              : <span key={p.id} className="se-place se-off" title="coming next">{p.name} <em>coming next</em></span>)}
          </div>
          <div className="se-pills se-scripts">
            {FIXTURE_LIST.map((f) => <Pill key={f.id} on={fixture === f.id} onClick={() => setFixture(f.id)}>{f.name}</Pill>)}
          </div>
          <div className="se-view">
            <div ref={holder} className="se-canvas" data-editor={status} />
            <div className="se-badge" data-shotname>● SHOT {String(shotIdx + 1).padStart(2, "0")} · {shotName || cam?.shot.preset} · {Math.round(lens)} mm</div>
            {status === "loading" && <div className="se-msg">Building the scene…</div>}
            {status === "off" && <div className="se-msg">This device can&apos;t show 3D.</div>}
          </div>
        </Panel>
        <div className="se-side">
          <Panel title="SETTINGS" note="live in the preview">
            <div className="se-tabs">
              {(["camera", "lighting", "cast", "scene"] as MobTab[]).map((k) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k[0].toUpperCase() + k.slice(1)}</button>)}
            </div>
            <div className="se-scroll" data-tab={tab}>
              <div className="se-pc-only">{camera}{lighting}{castSec}{sceneSec}</div>
              <div className="se-phone-only">{tab === "camera" ? camera : tab === "lighting" ? lighting : tab === "cast" ? castSec : sceneSec}</div>
            </div>
          </Panel>
        </div>
      </div>
      <Panel title="TIMELINE" note="the script's real tracks (read-only)">
        {playBar}
        <Timeline script={script} cams={cams} dur={dur} time={time} onSeek={seek} />
      </Panel>
      <PageGuide page="/star-scene-editor-dev" />
    </BroadcastPage>
  );
}

function Row({ label, tag, help, greyed, children }: { label: string; tag: Tag; help: string; greyed?: boolean; children?: ReactNode }) {
  return (
    <div className={`se-row${greyed ? " se-grey" : ""}`}>
      <div className="se-rl"><span>{label}</span> <T k={tag} />{greyed && <span className="se-next">coming next</span>}</div>
      {children && <div className="se-rc">{children}</div>}
      {help && <div className="se-help">{help}</div>}
    </div>
  );
}

/** One lane per kind of track: camera shots, light, each person, speech/captions. */
function Timeline({ script, cams, dur, time, onSeek }: { script: CutsceneScript; cams: CameraTrack[]; dur: number; time: number; onSeek: (t: number) => void }) {
  const lanes: { name: string; blocks: { at: number; dur: number; label: string; kind: string }[] }[] = [];
  lanes.push({ name: "Camera", blocks: cams.map((c) => ({ at: c.at, dur: c.dur, label: c.name ?? c.shot.preset, kind: "cam" })) });
  const len = (t: Track) => ("dur" in t && typeof t.dur === "number" ? t.dur : 0.6);
  const light = script.tracks.filter((t) => t.type === "light" || t.type === "transition" || t.type === "fx");
  lanes.push({ name: "Light / fx", blocks: light.map((t) => ({ at: t.at, dur: len(t), label: t.type === "fx" ? t.fx : t.type === "transition" ? t.kind : "light", kind: "light" })) });
  for (const m of script.cast) {
    const mine = script.tracks.filter((t) => "actor" in t && (t as { actor: string }).actor === m.id && (t.type === "clip" || t.type === "move" || t.type === "pose"));
    lanes.push({ name: m.id, blocks: mine.map((t) => ({ at: t.at, dur: len(t), label: t.type === "clip" ? t.clip : t.type === "pose" ? t.pose : "move", kind: "actor" })) });
  }
  const talk = script.tracks.filter((t) => t.type === "caption" || t.type === "speak");
  lanes.push({ name: "Speech / captions", blocks: talk.map((t) => ({ at: t.at, dur: len(t), label: t.type === "caption" ? t.text : (t.line ?? "speaks"), kind: "talk" })) });
  const pct = (s: number) => `${(Math.max(0, Math.min(dur, s)) / dur) * 100}%`;
  const ticks = Array.from({ length: Math.floor(dur) + 1 }, (_, i) => i);
  return (
    <div className="se-tl">
      <input className="se-scrub" data-scrub type="range" min={0} max={dur} step={0.01} value={time} onChange={(e) => onSeek(+e.target.value)} aria-label="Scrub" />
      <div className="se-lanes se-pc-only">
        <div className="se-lane se-ticks"><span className="se-ln" /><div className="se-track">{ticks.map((i) => <span key={i} style={{ left: pct(i) }}>{i}</span>)}</div></div>
        {lanes.map((l) => (
          <div key={l.name} className="se-lane"><span className="se-ln">{l.name}</span>
            <div className="se-track" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * dur); }}>
              {l.blocks.map((b, i) => <div key={i} className={`se-blk se-${b.kind}`} style={{ left: pct(b.at), width: `max(4px, calc(${pct(b.at + b.dur)} - ${pct(b.at)}))` }} title={b.label}>{b.label}</div>)}
              <div className="se-head" style={{ left: pct(time) }} />
            </div>
          </div>
        ))}
      </div>
      <div className="se-strip se-phone-only">
        {cams.map((c, i) => <button key={i} className="se-blk se-cam" aria-pressed={time >= c.at && time < c.at + c.dur} style={{ flex: c.dur }} onClick={() => onSeek(c.at + 0.01)}>{c.name ?? c.shot.preset}</button>)}
      </div>
      <div className="se-dim se-phone-only">Phone: shot strip only; full track lanes on a computer.</div>
    </div>
  );
}
