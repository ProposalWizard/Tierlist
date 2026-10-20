"use client";
/**
 * 3D SCENE EDITOR — step 3, part 1: 3D Signing and the Manager's Office.
 * Both are lib/star/signing3dScene.ts with a fixed table of shots and fixed
 * lights. This page drives its optional edit hook (SigningSceneEdit): pick and
 * play each shot, each shot's camera position / look point / lens, the key
 * light (strength, angle, colour) and the exposure. No edit = today's scene.
 * Saves under script id "signing" / "office" (store.ts). The game's own
 * signing and office use an edit only once it is APPROVED (UsePanel.tsx,
 * Harry 20 Oct 2026), where and when the approval says.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Panel } from "@/components/admin/broadcast/BroadcastPage";
import UsePanel from "./UsePanel";
import { SKIN_TONES } from "@/lib/star/playerIdentity";
import { SAMPLE_TERMS, contractRows } from "@/lib/star/signing3d";
import { managerLook } from "@/lib/star/managerFace";
import { kitsOf } from "@/lib/star/kits";
import { SIGNATURE_D } from "@/components/star/TrialReward";
import {
  SIGNING_CAM_SHOTS, fovToLens, type SigningCamShot, type SigningSceneEdit, type SigningSceneHandle,
} from "@/lib/star/signing3dScene";
import type { Vec3 } from "@/lib/star/cutscene/types";
import { emptyPlace, fetchShared, loadPlaceLocal, pushShared, saveLocal, sharedPlace, type PlaceSaved } from "./store";
import { MiniMap, Row, T, Vec, orbitPose, useOrbit } from "./parts";

type Place = PlaceSaved["place"];
type Defaults = Record<SigningCamShot, { pos: Vec3; look: Vec3; fov: number }>;
type Tab = "camera" | "lighting";

const toEdit = (s: PlaceSaved): SigningSceneEdit => ({ shots: s.shots, ...(s.scene ?? {}) });

export default function PlaceEditor({ place, tabs }: { place: Place; tabs: ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const h = useRef<SigningSceneHandle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [saved, setSaved] = useState<PlaceSaved>(() => emptyPlace(place));
  const [shot, setShot] = useState<SigningCamShot>("talk");
  const [layout, setLayout] = useState<ReturnType<SigningSceneHandle["layout"]> | null>(null);
  const [tab, setTab] = useState<Tab>("camera");
  const [saveMsg, setSaveMsg] = useState("");
  const [missing, setMissing] = useState(false);
  const lastSaved = useRef("");
  const shots = useMemo(() => SIGNING_CAM_SHOTS.filter((s) => place === "signing" || s.office), [place]);
  const name = place === "signing" ? "3D Signing" : "Manager's Office";

  const apply = (sv: PlaceSaved) => { lastSaved.current = JSON.stringify(sv); setSaved(sv); };

  // build the scene once for this place (the parent remounts on a place change)
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    const first = loadPlaceLocal<PlaceSaved>(place) ?? emptyPlace(place);
    apply(first);
    (async () => {
      try {
        const { createSigningScene } = await import("@/lib/star/signing3dScene");
        const kit = kitsOf(SAMPLE_TERMS.club).home;
        const look = managerLook(SAMPLE_TERMS.manager);
        const d = await createSigningScene(el, {
          stage: place,
          you: { skin: SKIN_TONES.find((t) => t.id === "fair")!.hex, face: null, accessories: [], kit, number: SAMPLE_TERMS.number, hair: "#3d2616", hairStyle: "short" },
          manager: { skin: look.skin, hairColour: look.hairColour, grey: look.grey, beard: look.beard !== "none", bald: look.hair === "bald", buzz: look.hair === "buzz" || look.hair === "receding" || look.hair === "ring" },
          contract: {
            club: SAMPLE_TERMS.club, playerName: SAMPLE_TERMS.playerName, managerName: SAMPLE_TERMS.manager,
            rows: place === "signing" ? contractRows({ seasons: SAMPLE_TERMS.seasons, wage: SAMPLE_TERMS.wage, number: SAMPLE_TERMS.number, position: SAMPLE_TERMS.position, season: "2026/27" }) : [],
            shirt: kit.shirt, trim: kit.trim,
          },
          signaturePath: SIGNATURE_D,
          edit: toEdit(first),
        });
        if (dead) { d.dispose(); return; }
        h.current = d;
        setDefaults(d.shotDefaults());
        d.playShot("talk");
        setStatus("ready");
        (window as unknown as { __editorReady?: boolean; __placeScene?: SigningSceneHandle }).__editorReady = true;
        (window as unknown as { __placeScene?: SigningSceneHandle }).__placeScene = d;
      } catch (e) {
        console.error("Scene editor: place failed", e);
        if (!dead) setStatus("off");
      }
    })();
    return () => { dead = true; h.current?.dispose(); h.current = null; (window as unknown as { __editorReady?: boolean }).__editorReady = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the shared copy, once (taken only when this device has none)
  useEffect(() => {
    fetchShared().then((sh) => {
      setMissing(sh.missing);
      const sv = sharedPlace<PlaceSaved>(sh.edits, place);
      if (!loadPlaceLocal<PlaceSaved>(place) && sv) apply(sv);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live edits → the scene (preview only)
  useEffect(() => { h.current?.setEdit(toEdit(saved)); }, [saved, status]);

  // save on this device on every real change
  useEffect(() => {
    if (status !== "ready") return;
    const js = JSON.stringify(saved);
    if (js === lastSaved.current) return;
    lastSaved.current = js;
    setSaveMsg(saveLocal(place, saved) ? "Saved on this device." : "Couldn't save on this device (storage blocked).");
  }, [saved, status, place]);

  // follow the shot on screen (the signing runs on into the handshake), keep the map honest
  useEffect(() => {
    const id = setInterval(() => {
      const d = h.current;
      if (!d) return;
      setShot(d.currentShot());
      setLayout(d.layout());
    }, 200);
    return () => clearInterval(id);
  }, []);

  const def = defaults?.[shot];
  const se = saved.shots?.[shot] ?? {};
  const pos = (se.pos ?? def?.pos) as Vec3 | undefined;
  const lookAt = (se.look ?? def?.look) as Vec3 | undefined;
  const lens = se.lens ?? (def ? fovToLens(def.fov) : 35);
  const sc = saved.scene ?? {};
  const edited = !!(se.pos || se.look || se.lens);

  const editShot = (e: { pos?: Vec3; look?: Vec3; lens?: number }) =>
    setSaved((s) => ({ ...s, shots: { ...(s.shots ?? {}), [shot]: { ...(s.shots?.[shot] ?? {}), ...e } } }));
  const editScene = (e: NonNullable<PlaceSaved["scene"]>) => setSaved((s) => ({ ...s, scene: { ...(s.scene ?? {}), ...e } }));
  const resetShot = () => setSaved((s) => { const n = { ...(s.shots ?? {}) }; delete n[shot]; return { ...s, shots: n }; });
  const resetAll = () => { apply(emptyPlace(place)); saveLocal(place, emptyPlace(place)); setSaveMsg("All edits cleared for this place."); };
  const play = (id: SigningCamShot) => { h.current?.playShot(id); setShot(id); };
  const orbit = (dx: number, dy: number, dolly: number) => { if (pos && lookAt) editShot(orbitPose({ pos, look: lookAt }, dx, dy, dolly)); };
  const orbitHandlers = useOrbit(orbit);
  const copyEdits = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify({ scriptId: place, edits: saved }, null, 2)); setSaveMsg("Edits copied (JSON)."); } catch { setSaveMsg("Couldn't copy — clipboard blocked."); }
  };
  const saveShared = async () => {
    setSaveMsg("Saving for everyone…");
    const r = await pushShared(place, saved);
    setSaveMsg(r.ok ? "Saved for everyone (shared table)." : r.missing ? "Saved on this device only — the shared table isn't switched on yet." : `Saved on this device only — ${r.error}`);
    if (r.missing) setMissing(true);
  };
  const shotName = shots.find((s) => s.id === shot)?.name ?? shot;

  const playBar = (
    <div className="se-play">
      <div className="se-shots" data-shots>
        {shots.map((s, i) => (
          <button key={s.id} data-shot={s.id} className="se-shotbtn" aria-pressed={shot === s.id} onClick={() => play(s.id)}>
            {i + 1}. {s.name}{saved.shots?.[s.id] ? " •" : ""}
          </button>
        ))}
      </div>
      <button className="se-big" data-play onClick={() => play(shot)}>▶ PLAY SHOT</button>
      <button className="se-save" data-save-shared onClick={saveShared}>SAVE FOR EVERYONE</button>
      <button className="se-small" data-copy onClick={copyEdits}>Copy edits</button>
      <button className="se-small" data-reset-shot disabled={!edited} onClick={resetShot}>Reset this shot</button>
      <button className="se-small" data-reset-all onClick={resetAll}>Reset all</button>
      <span className="se-dim" data-savemsg>{saveMsg || "Edits save on this device as you change them."}</span>
    </div>
  );

  const camera = (
    <div className="se-sec" data-sec="camera">
      <h3>CAMERA <span className="se-shot">shot {shots.findIndex((s) => s.id === shot) + 1} of {shots.length} · {shotName}</span></h3>
      <Row label="Position X/Y/Z" tag="code" help="where this shot's camera stands (metres) — or drag the preview / the blue box on the map">
        <Vec v={pos} data="pos" onSet={(v) => editShot({ pos: v })} />
      </Row>
      <Row label="Look at (target)" tag="code" help="the point it looks at (metres) — or drag the white dot on the map">
        <Vec v={lookAt} data="look" onSet={(v) => editShot({ look: v })} />
      </Row>
      <Row label="Lens (mm)" tag="code" help="zoom: wide 18 ↔ close 120">
        <input data-lens type="range" min={18} max={120} step={1} value={Math.round(lens)} onChange={(e) => editShot({ lens: +e.target.value })} /><span className="se-val">{Math.round(lens)}</span>
      </Row>
      <Row label="Drag the preview to orbit" tag="code" help="drag to orbit / tilt round the look point, wheel or pinch to move in">
        <span className="se-val" data-free>{edited ? "EDITED" : "as written"}</span>
        <button className="se-small" data-back-to-shot disabled={!edited} onClick={resetShot}>Back to the shot</button>
      </Row>
    </div>
  );
  const lighting = (
    <div className="se-sec" data-sec="lighting">
      <h3>LIGHTING</h3>
      <Row label="Exposure" tag="code" help="overall brightness">
        <input data-exposure type="range" min={0.3} max={2.5} step={0.05} value={sc.exposure ?? 1} onChange={(e) => editScene({ exposure: +e.target.value })} /><span className="se-val">{(sc.exposure ?? 1).toFixed(2)}</span>
      </Row>
      <Row label="Key light strength" tag="code" help="the low sun through the window">
        <input data-keylight type="range" min={0} max={3} step={0.05} value={sc.keyLight ?? 1} onChange={(e) => editScene({ keyLight: +e.target.value })} /><span className="se-val">{(sc.keyLight ?? 1).toFixed(2)}</span>
      </Row>
      <Row label="Key light angle" tag="code" help="turn the sun round the room — or drag the yellow sun on the map">
        <input data-keyangle type="range" min={-180} max={180} step={1} value={sc.keyAngle ?? 0} onChange={(e) => editScene({ keyAngle: +e.target.value })} /><span className="se-val">{(sc.keyAngle ?? 0) > 0 ? "+" : ""}{sc.keyAngle ?? 0}°</span>
      </Row>
      <Row label="Key light colour" tag="code" help="the sun's colour">
        <input data-keycolor type="color" value={sc.keyColor ?? "#ffc488"} onChange={(e) => editScene({ keyColor: e.target.value })} />
        <button className="se-small" disabled={!sc.keyColor} onClick={() => editScene({ keyColor: undefined })}>As written</button>
      </Row>
      <div className="se-dim">Not in this scene: mood, spotlight, shot presets, turn / rise / move / shake, cast and timeline. Those are Cut-scene Director dials.</div>
    </div>
  );

  return (
    <>
      <div className="se-unsaved" data-unsaved>
        Edits save on this device as you change them{missing ? " — the shared table isn't switched on yet, so SAVE FOR EVERYONE keeps them on this device only" : ""}.
        {" "}The real {place === "signing" ? "signing" : "manager's office"} in a career uses these edits only once you APPROVE them (Use in the game, below); until then it plays exactly as before.
      </div>
      <div className="se-grid">
        <Panel title="3D PREVIEW" note={`live: the real ${name} scene`}>
          {tabs}
          <div className="se-view">
            <div ref={holder} className="se-canvas" data-editor={status} {...orbitHandlers} style={{ touchAction: "none", cursor: "grab" }} />
            <MiniMap layout={layout} pose={pos && lookAt ? { pos, look: lookAt } : null} free={edited}
              onCam={(x, z) => { if (pos) editShot({ pos: [x, pos[1], z] }); }}
              onLook={(x, z) => { if (lookAt) editShot({ look: [x, lookAt[1], z] }); }}
              onSun={(phi) => {
                if (!layout) return;
                const cur = Math.atan2(layout.sunDir[2], layout.sunDir[0]);
                let a = (sc.keyAngle ?? 0) + ((phi - cur) * 180) / Math.PI; a = ((a + 540) % 360) - 180;
                editScene({ keyAngle: Math.round(a) });
              }} />
            <div className="se-badge" data-shotname>● SHOT {String(shots.findIndex((s) => s.id === shot) + 1).padStart(2, "0")} · {shotName} · {Math.round(lens)} mm</div>
            {status === "loading" && <div className="se-msg">Building the scene…</div>}
            {status === "off" && <div className="se-msg">This device can&apos;t show 3D.</div>}
          </div>
          {playBar}
        </Panel>
        <div className="se-side">
          <Panel title="SETTINGS" note="only what this scene has">
            <div className="se-tabs">
              {(["camera", "lighting"] as Tab[]).map((k) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k[0].toUpperCase() + k.slice(1)}</button>)}
            </div>
            <div className="se-scroll" data-tab={tab}>
              <div className="se-pc-only">{camera}{lighting}</div>
              <div className="se-phone-only">{tab === "camera" ? camera : lighting}</div>
            </div>
          </Panel>
        </div>
      </div>
      <UsePanel place={place} scriptId={place} edits={saved} onChange={(e) => { lastSaved.current = JSON.stringify(e); setSaved(e); }}
        gameNote={place === "signing" ? "In a career: the 3D signing after the trial and after every move (Settings → Look → Signing scene: 3D)." : "In a career: every talk with your manager in his office (the office pages, the line-up talk, Manager moments)."} />
      <div className="se-dim">Shots come from signing3dScene.ts&apos;s fixed table ({shots.length} here{place === "office" ? "; the office only uses the talk and reply shots" : ""}). <T k="code" /> every dial here drives the real scene.</div>
    </>
  );
}
