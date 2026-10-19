"use client";
/**
 * 3D SCENE EDITOR — step 1 (Harry signed off the drawing, 19 Oct 2026: "all
 * signed off, just go"). Drawing: docs/handoffs/2026-10-19-ui-lookover/scene-editor/.
 *
 * Step 1 works on the Cut-scene Director only. Every dial tagged IN CODE in
 * the drawing drives the real director (lib/star/cutscene/director.ts) through
 * its optional `setEdit` hook: shot preset, lens, turn/rise, move + amount,
 * handheld shake (per shot), mood, exposure, key light, spotlight.
 * Step 2: free camera (drag/wheel/pinch on the preview, Position/Look fields,
 * an overhead mini-map with camera, look point and key-light markers), key
 * light angle + colour, and saving (this device + a shared table, store.ts).
 * The game's own cut scenes do NOT read these edits yet.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Pill } from "@/components/admin/broadcast/BroadcastPage";
import "./editor.css";
import { FIXTURES, FIXTURE_LIST } from "@/lib/star/cutscene/fixtures";
import { MOODS } from "@/lib/star/cutscene/presets/moods";
import { SHOT_PRESETS } from "@/lib/star/cutscene/presets/camera";
import type { CameraMove, CameraTrack, CutsceneScript, MoodId, ShotPreset, Track, Vec3 } from "@/lib/star/cutscene/types";
import { emptySaved, fetchShared, loadLocal, pushShared, saveLocal, type SavedEdits } from "./store";
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
  const [keyAngle, setKeyAngle] = useState(0);
  const [keyColor, setKeyColor] = useState<string | undefined>();
  const [free, setFree] = useState<Record<number, { pos: Vec3; look: Vec3 }>>({});
  const [pose, setPose] = useState<{ pos: Vec3; look: Vec3; fov: number } | null>(null);
  const [layout, setLayout] = useState<ReturnType<Director["layout"]> | null>(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [shared, setShared] = useState<{ missing: boolean; edits: Record<string, SavedEdits> } | null>(null);
  const lastSaved = useRef("");
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch0 = useRef(0);

  // build the director for the chosen script
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    setStatus("loading");
    // reload this script's saved edits (this device first; else the shared copy)
    const saved = loadLocal(fixture) ?? shared?.edits[fixture] ?? emptySaved();
    applySaved(saved);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  function applySaved(sv: SavedEdits) {
    lastSaved.current = JSON.stringify(sv);
    setShots(sv.shots ?? {}); setFree(sv.free ?? {});
    const sc = sv.scene ?? {};
    setMood(sc.mood); setExposure(sc.exposure ?? 1); setKeyLight(sc.keyLight ?? 1); setSpot(sc.spot ?? null);
    setKeyAngle(sc.keyAngle ?? 0); setKeyColor(sc.keyColor);
  }
  const current = (): SavedEdits => ({ shots, free, scene: { mood, exposure, keyLight, keyAngle, keyColor, spot } });

  // the shared copies, once (never blocks the page)
  useEffect(() => {
    fetchShared().then((sh) => {
      setShared(sh);
      // nothing on this device for the open script: take the shared copy
      if (!loadLocal(fixture) && sh.edits[fixture]) applySaved(sh.edits[fixture]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live edits → the director (preview only)
  useEffect(() => {
    dir.current?.setEdit({ shots, mood, exposure, keyLight, spot, free, keyAngle, keyColor });
  }, [shots, mood, exposure, keyLight, spot, free, keyAngle, keyColor, status]);

  // save to this device on every real change (not the reload of a script)
  useEffect(() => {
    if (status !== "ready") return;
    const now = current(), js = JSON.stringify(now);
    if (js === lastSaved.current) return;
    lastSaved.current = js;
    setSaveMsg(saveLocal(fixture, now) ? "Saved on this device." : "Couldn't save on this device (storage blocked).");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, mood, exposure, keyLight, spot, free, keyAngle, keyColor]);

  // keep the play button, the camera fields and the mini-map honest
  useEffect(() => {
    const id = setInterval(() => {
      const dd = dir.current;
      setPlaying(!!dd?.playing());
      if (dd) { setPose(dd.cameraPose()); setLayout(dd.layout()); }
    }, 200);
    return () => clearInterval(id);
  }, []);

  const d = dir.current;
  const dur = d?.duration ?? script.duration;
  const shotIdx = Math.max(0, cams.findIndex((c) => time >= c.at && time < c.at + c.dur));
  const cam = cams[shotIdx];
  const cur: ShotEdit = { ...(cam?.shot ?? {}), ...(shots[shotIdx] ?? {}) } as ShotEdit;
  const lens = cur.lens ?? (cur.preset ? SHOT_PRESETS[cur.preset].lens : 35);
  const editShot = (e: ShotEdit) => setShots((s) => ({ ...s, [shotIdx]: { ...(s[shotIdx] ?? {}), ...e } }));
  const curMood: MoodId = mood ?? script.set.mood;
  const seek = (v: number) => { d?.seek(v); setTime(v); };
  const freeNow = free[shotIdx];
  const camPose = freeNow ? { ...freeNow, fov: pose?.fov ?? 40 } : pose;
  const setFreeNow = (f: { pos: Vec3; look: Vec3 } | null) => setFree((m) => { const n = { ...m }; if (f) n[shotIdx] = f; else delete n[shotIdx]; return n; });
  const startFree = () => freeNow ?? (dir.current ? (({ pos, look }) => ({ pos, look }))(dir.current.cameraPose()) : null);
  const resetShot = () => {
    setShots((m) => { const n = { ...m }; delete n[shotIdx]; return n; });
    setFreeNow(null);
  };
  const resetAll = () => { applySaved(emptySaved()); saveLocal(fixture, emptySaved()); setSaveMsg("All edits cleared for this scene."); };
  const copyEdits = async () => {
    const txt = JSON.stringify({ scriptId: fixture, edits: current() }, null, 2);
    try { await navigator.clipboard.writeText(txt); setSaveMsg("Edits copied (JSON)."); } catch { setSaveMsg("Couldn't copy — clipboard blocked."); }
  };
  const saveShared = async () => {
    setSaveMsg("Saving for everyone…");
    const r = await pushShared(fixture, current());
    setSaveMsg(r.ok ? "Saved for everyone (shared table)." : r.missing ? "Saved on this device only — the shared table isn't switched on yet." : `Saved on this device only — ${r.error}`);
    if (r.missing) setShared((x) => ({ missing: true, edits: x?.edits ?? {} }));
  };
  const moveKind = (m?: CameraMove) => (!m || m === "static" ? "static" : m.startsWith("orbit") ? "orbit-left" : m.startsWith("crane") ? "crane-up" : m === "track" || m === "follow" ? "static" : "push");

  // free camera: one finger / mouse orbits and tilts round the look point, wheel / two fingers dolly
  const orbit = (dx: number, dy: number, dolly: number) => {
    const f = startFree();
    if (!f) return;
    const [px, py, pz] = f.pos, [lx, ly, lz] = f.look;
    let ox = px - lx, oy = py - ly, oz = pz - lz;
    let r = Math.hypot(ox, oy, oz) || 1;
    let yaw = Math.atan2(ox, oz), pitch = Math.asin(Math.max(-1, Math.min(1, oy / r)));
    yaw -= dx * 0.008; pitch = Math.max(-1.2, Math.min(1.45, pitch + dy * 0.006));
    r = Math.max(0.3, Math.min(80, r * dolly));
    ox = r * Math.cos(pitch) * Math.sin(yaw); oz = r * Math.cos(pitch) * Math.cos(yaw); oy = r * Math.sin(pitch);
    setFreeNow({ pos: [lx + ox, ly + oy, lz + oz], look: f.look });
  };
  const orbitHandlers = {
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch0.current = 0; },
    onPointerMove: (e: React.PointerEvent) => {
      const m = ptrs.current, prev = m.get(e.pointerId);
      if (!prev) return;
      m.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (m.size >= 2) {
        const [a, b] = Array.from(m.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0.current) orbit(0, 0, pinch0.current / dist);
        pinch0.current = dist;
      } else orbit(e.clientX - prev.x, e.clientY - prev.y, 1);
    },
    onPointerUp: (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); pinch0.current = 0; },
    onPointerCancel: (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); pinch0.current = 0; },
    onWheel: (e: React.WheelEvent) => orbit(0, 0, Math.exp(e.deltaY * 0.001)),
  };

  const playBar = (
    <div className="se-play">
      <button className="se-big" data-play onClick={() => { if (d?.playing()) d.pause(); else d?.play(); setPlaying(!playing); }}>{playing ? "❚❚ PAUSE" : "▶ PLAY"}</button>
      <T k="code" />
      <button className="se-small" data-replay onClick={() => d?.replay()}>↺ Replay</button>
      <span className="se-time" data-time>{time.toFixed(1)} s / {dur.toFixed(1)} s · scrub = director.seek(t)</span>
      <T k="code" />
      <button className="se-save" data-save-shared onClick={saveShared}>SAVE FOR EVERYONE</button><T k="code" />
      <button className="se-small" data-copy onClick={copyEdits}>Copy edits</button>
      <button className="se-small" data-reset-shot onClick={resetShot}>Reset this shot</button>
      <button className="se-small" data-reset-all onClick={resetAll}>Reset all</button>
      <span className="se-dim" data-savemsg>{saveMsg || "Edits save on this device as you change them."}</span>
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
      <Row label="Position X/Y/Z" tag="code" help={freeNow ? "free camera: where it stands (metres)" : "where the shot stands now — type a number to take over"}>
        <Vec v={camPose?.pos} data="pos" onSet={(v) => { const f = startFree(); if (f) setFreeNow({ ...f, pos: v }); }} />
      </Row>
      <Row label="Look at (target)" tag="code" help="the point it looks at (metres) — or drag the white dot on the map">
        <Vec v={camPose?.look} data="look" onSet={(v) => { const f = startFree(); if (f) setFreeNow({ ...f, look: v }); }} />
      </Row>
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
      <Row label="Free camera (drag to orbit)" tag="code" help="drag the preview to orbit / tilt, wheel or pinch to move in. Lens still works.">
        <span className="se-val" data-free>{freeNow ? "FREE" : "the shot"}</span>
        <button className="se-small" data-back-to-shot disabled={!freeNow} onClick={() => setFreeNow(null)}>Back to the shot</button>
      </Row>
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
      <Row label="Key light angle" tag="code" help="turn the sun / key light round the set">
        <input data-keyangle type="range" min={-180} max={180} step={1} value={keyAngle} onChange={(e) => setKeyAngle(+e.target.value)} /><span className="se-val">{keyAngle > 0 ? "+" : ""}{keyAngle}°</span>
      </Row>
      <Row label="Key light colour" tag="code" help="the sun / key light's colour">
        <input data-keycolor type="color" value={keyColor ?? "#ffffff"} onChange={(e) => setKeyColor(e.target.value)} />
        <button className="se-small" disabled={!keyColor} onClick={() => setKeyColor(undefined)}>As written</button>
      </Row>
      <Row label="Key light marker: drag to move" tag="code" help="the yellow sun on the map" />
    </div>
  );

  const castSec = (
    <div className="se-sec" data-sec="cast">
      <h3>CAST</h3>
      <div className="se-dim">{script.cast.map((c) => `${c.id} (${c.role})`).join(" · ")}</div>
      <Row label="Move a person / swap a clip" tag="new" help="coming next" greyed />
      <Row label="Drag handles: move look point" tag="code" help="the white dot on the map (2D overhead map, not a 3D handle)" />
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
      <div className="se-unsaved" data-unsaved>
        Edits save on this device as you change them{shared?.missing ? " — the shared table isn't switched on yet, so SAVE FOR EVERYONE keeps them on this device only" : ""}.
        {" "}The game&apos;s own cut scenes do not read these edits yet (a later step).
      </div>
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
            <div ref={holder} className="se-canvas" data-editor={status} {...orbitHandlers} style={{ touchAction: "none", cursor: "grab" }} />
            <MiniMap layout={layout} pose={camPose} free={!!freeNow}
              onCam={(x, z) => { const f = startFree(); if (f) setFreeNow({ ...f, pos: [x, f.pos[1], z] }); }}
              onLook={(x, z) => { const f = startFree(); if (f) setFreeNow({ ...f, look: [x, f.look[1], z] }); }}
              onSun={(phi) => { if (!layout) return; const cur = Math.atan2(layout.sunDir[2], layout.sunDir[0]); let a = keyAngle + ((phi - cur) * 180) / Math.PI; a = ((a + 540) % 360) - 180; setKeyAngle(Math.round(a)); }} />
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

/** Three number boxes for a point in metres. */
function Vec({ v, onSet, data }: { v?: Vec3; onSet: (v: Vec3) => void; data: string }) {
  return (
    <span className="se-vec" data-vec={data}>
      {(["X", "Y", "Z"] as const).map((n, i) => (
        <label key={n}>{n}<input type="number" step={0.1} value={v ? +v[i].toFixed(2) : ""} disabled={!v}
          onChange={(e) => { if (!v || e.target.value === "") return; const nv = [...v] as Vec3; nv[i] = +e.target.value; onSet(nv); }} /></label>
      ))}
    </span>
  );
}

/** The set from above (2D overhead map, chosen over a 3D gizmo): people (grey), the camera (blue, drag),
 *  its look point (white, drag), the key light (yellow, drag round the ring). */
function MiniMap({ layout, pose, free, onCam, onLook, onSun }: {
  layout: { people: { id: string; x: number; z: number }[]; sunDir: Vec3; bounds?: { min: Vec3; max: Vec3 } } | null;
  pose: { pos: Vec3; look: Vec3 } | null | undefined; free: boolean;
  onCam: (x: number, z: number) => void; onLook: (x: number, z: number) => void; onSun: (phi: number) => void;
}) {
  const drag = useRef<null | "cam" | "look" | "sun">(null);
  const box = useRef<SVGSVGElement>(null);
  if (!layout || !pose) return null;
  const xs = [pose.pos[0], pose.look[0], ...layout.people.map((p) => p.x)], zs = [pose.pos[2], pose.look[2], ...layout.people.map((p) => p.z)];
  if (layout.bounds) { xs.push(layout.bounds.min[0], layout.bounds.max[0]); zs.push(layout.bounds.min[2], layout.bounds.max[2]); }
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const half = Math.max(2, (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2) * 1.25);
  const S = 140, sc = (S / 2 - 14) / half;
  const toS = (x: number, z: number) => [S / 2 + (x - cx) * sc, S / 2 + (z - cz) * sc];
  const toW = (sx: number, sy: number) => [cx + (sx - S / 2) / sc, cz + (sy - S / 2) / sc];
  const sunPhi = Math.atan2(layout.sunDir[2], layout.sunDir[0]);
  const sunR = S / 2 - 7;
  const [px, py] = toS(pose.pos[0], pose.pos[2]), [lx, ly] = toS(pose.look[0], pose.look[2]);
  const local = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * S, ((e.clientY - r.top) / r.height) * S]; };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const [sx, sy] = local(e);
    if (drag.current === "sun") onSun(Math.atan2(sy - S / 2, sx - S / 2));
    else { const [wx, wz] = toW(sx, sy); (drag.current === "cam" ? onCam : onLook)(wx, wz); }
  };
  const grab = (k: "cam" | "look" | "sun") => (e: React.PointerEvent) => { e.stopPropagation(); drag.current = k; box.current?.setPointerCapture(e.pointerId); };
  return (
    <svg ref={box} className="se-map" data-minimap viewBox={`0 0 ${S} ${S}`} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerDown={(e) => e.stopPropagation()}>
      <rect x={0} y={0} width={S} height={S} rx={8} fill="rgba(8,12,20,0.78)" stroke="rgba(255,255,255,0.25)" />
      <circle cx={S / 2} cy={S / 2} r={sunR} fill="none" stroke="rgba(255,210,90,0.25)" strokeDasharray="2 3" />
      {layout.people.map((p) => { const [x, y] = toS(p.x, p.z); return <g key={p.id}><circle cx={x} cy={y} r={4} fill="#9aa4b2" /><text x={x + 5} y={y + 3} fontSize={7} fill="#cbd5e1">{p.id}</text></g>; })}
      <line x1={px} y1={py} x2={lx} y2={ly} stroke={free ? "#38bdf8" : "rgba(56,189,248,0.5)"} strokeWidth={1.5} />
      <circle data-map-look cx={lx} cy={ly} r={5} fill="#fff" stroke="#0f172a" onPointerDown={grab("look")} style={{ cursor: "move" }} />
      <rect data-map-cam x={px - 6} y={py - 5} width={12} height={10} rx={2} fill="#38bdf8" stroke="#0f172a" onPointerDown={grab("cam")} style={{ cursor: "move" }} />
      <circle data-map-sun cx={S / 2 + Math.cos(sunPhi) * sunR} cy={S / 2 + Math.sin(sunPhi) * sunR} r={6} fill="#fcd34d" stroke="#92400e" onPointerDown={grab("sun")} style={{ cursor: "move" }} />
      <text x={6} y={S - 6} fontSize={7} fill="#94a3b8">map: drag camera · look · sun</text>
    </svg>
  );
}
