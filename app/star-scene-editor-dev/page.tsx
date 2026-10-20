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
 * Step 3 (part 1): 3D Signing and the Manager's Office are live places too
 * (PlaceEditor.tsx): their fixed shots, each shot's camera and lens, the key
 * light and the exposure, through signing3dScene.ts's optional edit hook.
 * Step 3b (20 Oct 2026, Harry: "3B first"): the 3D Shop, Garden and House
 * (WalkPlaceEditor.tsx): per view turn / rise / distance / lens, key light,
 * exposure, through each scene's optional edit hook (sceneEdits/walkEdit.ts).
 * Approve + where/when + Commit to game (UsePanel.tsx, answers 3D-3, 3D-4):
 * the game uses an edit only once it is approved.
 * Kept scenes from the Scene generator (/admin/scene-generator) open here as
 * director scenes too ("Kept: …" pills).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Pill } from "@/components/admin/broadcast/BroadcastPage";
import "./editor.css";
import { FIXTURES, FIXTURE_LIST } from "@/lib/star/cutscene/fixtures";
import { MOODS } from "@/lib/star/cutscene/presets/moods";
import { SHOT_PRESETS } from "@/lib/star/cutscene/presets/camera";
import type { CameraMove, CameraTrack, CutsceneScript, MoodId, ShotPreset, Track, Vec3 } from "@/lib/star/cutscene/types";
import { directorId, emptySaved, fetchShared, loadDirectorLocal, pushShared, saveLocal, sharedDirector, type SavedEdits } from "./store";
import { MiniMap, PlaceTabs, Row, T, Vec, orbitPose, useOrbit, type PlaceId } from "./parts";
import PlaceEditor from "./PlaceEditor";
import WalkPlaceEditor from "./WalkPlaceEditor";
import UsePanel from "./UsePanel";
import { keptScenes, loadKeptLocal, type KeptScene } from "@/lib/star/sceneEdits/kept";
import type { SceneApproval } from "@/lib/star/sceneEdits/approval";
import type { Director, DirectorEdit } from "@/lib/star/cutscene/director";

const TOP_PRESETS: [ShotPreset, string][] = [["wide", "Wide"], ["ots", "Over the shoulder"], ["close", "Close"], ["two-shot", "Two-shot"], ["low-hero", "Low hero"]];
const MOVES: [CameraMove, string][] = [["static", "Still"], ["push", "Push"], ["orbit-left", "Orbit"], ["crane-up", "Crane"]];
const SHOWN_MOODS: MoodId[] = ["golden-hour", "dawn", "floodlit-night", "overcast", "interior-warm", "interior-cool", "rain-night", "spotlight"];

type ShotEdit = NonNullable<DirectorEdit["shots"]>[number];
type MobTab = "camera" | "lighting" | "cast" | "scene";

export default function SceneEditorPage() {
  const [place, setPlace] = useState<PlaceId>("director");
  // ?place=signing|office|shop|garden|house|director opens that place (links and test stills).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("place");
    if (q === "signing" || q === "office" || q === "shop" || q === "garden" || q === "house" || q === "director") setPlace(q);
  }, []);
  const key = (
    <div className="se-key">
      <span><T k="code" /> the dial already exists in the code; the editor drives it</span>
      <span><T k="part" /> exists in one scene, must be opened up for the others</span>
      <span><T k="new" /> new work — coming next</span>
    </div>
  );
  return (
    <BroadcastPage title="3D Scene Editor" sub="One editor for every 3D scene." width={1500}>
      {key}
      {place === "signing" || place === "office"
        ? <PlaceEditor key={place} place={place} tabs={<PlaceTabs place={place} onPick={setPlace} />} />
        : place === "shop" || place === "garden" || place === "house"
          ? <WalkPlaceEditor key={place} place={place} tabs={<PlaceTabs place={place} onPick={setPlace} />} />
          : <DirectorEditor tabs={<PlaceTabs place={place} onPick={setPlace} />} />}
      <PageGuide page="/star-scene-editor-dev" />
    </BroadcastPage>
  );
}

function DirectorEditor({ tabs }: { tabs: React.ReactNode }) {
  const [fixture, setFixture] = useState("signing");
  // kept scenes from the Scene generator (this device + the shared table); ?kept=<id> opens one
  const [kept, setKept] = useState<KeptScene[]>([]);
  const keptHit = kept.find((k) => k.id === fixture);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const script: CutsceneScript = useMemo(() => keptHit?.script ?? (FIXTURES[fixture] ?? FIXTURES.signing)(), [fixture, keptHit?.at]);
  const [approval, setApproval] = useState<SceneApproval | undefined>();
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
  const [shared, setShared] = useState<{ missing: boolean; edits: Record<string, unknown> } | null>(null);
  const lastSaved = useRef("");

  // build the director for the chosen script
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    setStatus("loading");
    // reload this script's saved edits (this device first; else the shared copy)
    const saved = loadDirectorLocal(fixture) ?? (shared ? sharedDirector(shared.edits, fixture) : undefined) ?? emptySaved();
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
    setApproval(sv.approval);
  }
  const current = (): SavedEdits => ({ shots, free, scene: { mood, exposure, keyLight, keyAngle, keyColor, spot }, ...(approval ? { approval } : {}) });

  // the shared copies, once (never blocks the page)
  useEffect(() => {
    const k0 = new URLSearchParams(window.location.search).get("kept");
    const local = loadKeptLocal();
    setKept(local);
    if (k0 && local.some((k) => k.id === k0)) setFixture(k0);
    fetchShared().then((sh) => {
      setShared(sh);
      const all = keptScenes(sh.edits, local);
      setKept(all);
      if (k0 && all.some((k) => k.id === k0)) setFixture(k0);
      // nothing on this device for the open script: take the shared copy
      const sv = sharedDirector(sh.edits, fixture);
      if (!loadDirectorLocal(fixture) && sv) applySaved(sv);
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
    setSaveMsg(saveLocal(directorId(fixture), now) ? "Saved on this device." : "Couldn't save on this device (storage blocked).");
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
  const resetAll = () => { const e = { ...emptySaved(), ...(approval ? { approval } : {}) }; applySaved(e); saveLocal(directorId(fixture), e); setSaveMsg("All edits cleared for this scene (an approval stays)."); };
  const copyEdits = async () => {
    const txt = JSON.stringify({ scriptId: directorId(fixture), edits: current() }, null, 2);
    try { await navigator.clipboard.writeText(txt); setSaveMsg("Edits copied (JSON)."); } catch { setSaveMsg("Couldn't copy — clipboard blocked."); }
  };
  const saveShared = async () => {
    setSaveMsg("Saving for everyone…");
    const r = await pushShared(directorId(fixture), current());
    setSaveMsg(r.ok ? "Saved for everyone (shared table)." : r.missing ? "Saved on this device only — the shared table isn't switched on yet." : `Saved on this device only — ${r.error}`);
    if (r.missing) setShared((x) => ({ missing: true, edits: x?.edits ?? {} }));
  };
  const moveKind = (m?: CameraMove) => (!m || m === "static" ? "static" : m.startsWith("orbit") ? "orbit-left" : m.startsWith("crane") ? "crane-up" : m === "track" || m === "follow" ? "static" : "push");

  // free camera: one finger / mouse orbits and tilts round the look point, wheel / two fingers dolly
  const orbit = (dx: number, dy: number, dolly: number) => {
    const f = startFree();
    if (f) setFreeNow(orbitPose(f, dx, dy, dolly));
  };
  const orbitHandlers = useOrbit(orbit);

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
    <>
      <div className="se-unsaved" data-unsaved>
        Edits save on this device as you change them{shared?.missing ? " — the shared table isn't switched on yet, so SAVE FOR EVERYONE keeps them on this device only" : ""}.
        {" "}Cut scenes do not play in a career yet (see the Scene generator&apos;s &quot;When does this play?&quot;), so an approved edit here is used on the cut-scene test pages for now.
      </div>
      <div className="se-grid">
        <Panel title="3D PREVIEW" note="live: the real cut-scene director">
          {tabs}
          <div className="se-pills se-scripts">
            {FIXTURE_LIST.map((f) => <Pill key={f.id} on={fixture === f.id} onClick={() => setFixture(f.id)}>{f.name}</Pill>)}
            {kept.map((k) => <Pill key={k.id} on={fixture === k.id} onClick={() => setFixture(k.id)} title="Kept from the Scene generator">Kept: {k.name}</Pill>)}
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
          {playBar}
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
        <Timeline script={script} cams={cams} dur={dur} time={time} onSeek={seek} />
      </Panel>
      <UsePanel place="director" scriptId={directorId(fixture)} edits={current()} onChange={(e) => { setApproval(e.approval); lastSaved.current = JSON.stringify(e); }}
        gameNote="Cut scenes play only on test pages today. When the game plays one, it will use the approved edit for that scene, at the moment you pick under When." />
    </>
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
