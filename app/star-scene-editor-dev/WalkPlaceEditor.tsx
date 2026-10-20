"use client";
/**
 * 3D SCENE EDITOR — step 3b (Harry, 20 Oct 2026: "3B first"): the 3D Shop,
 * Garden and House, live, like Signing and the Office in step 3a.
 *
 * These places have no fixed shots: a camera follows you about, and a card
 * that opens frames its item. So each VIEW (walking about, and each card)
 * gets turn / rise / distance / lens on top of the camera the scene works
 * out, plus the key light and the exposure (lib/star/sceneEdits/walkEdit.ts,
 * through each scene's optional `edit` / setEdit hook; none = as before).
 * Saves under "shop" / "garden" / "house" (store.ts). The game uses an edit
 * only once it is APPROVED (UsePanel.tsx).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Panel, Pill } from "@/components/admin/broadcast/BroadcastPage";
import { WALK_VIEWS, GARDEN_STANDS, fovToLens, type WalkSceneEdit, type ViewEdit } from "@/lib/star/sceneEdits/walkEdit";
import { emptyWalk, fetchShared, loadPlaceLocal, pushShared, saveLocal, sharedPlace, type WalkSaved } from "./store";
import { MiniMap, Row, T, useOrbit } from "./parts";
import UsePanel from "./UsePanel";
import { sampleCareer } from "./sampleCareer";

type Place = WalkSaved["place"];
type Tab = "camera" | "lighting";
type Layout = { people: { id: string; x: number; z: number }[]; sunDir: [number, number, number]; bounds: { min: [number, number, number]; max: [number, number, number] } };
/** What the editor needs from any of the three scenes' controllers. */
interface WalkHandle {
  setEdit?: (e: WalkSceneEdit | null) => void;
  showView?: (id: string) => boolean | void;
  cameraPose?: () => { pos: [number, number, number]; look: [number, number, number]; fov: number };
  layout?: () => Layout;
  rooms?: () => { id: string; label: string }[];
  room?: () => string;
  goToRoom?: (id: never) => Promise<boolean>;
  dispose: () => void;
}

const SKIES = ["day", "sunset", "night"] as const;
const TIERS = ["starter", "flat", "penthouse", "house", "villa", "estate"] as const;
const NAME: Record<Place, string> = { shop: "3D Shop", garden: "3D Garden", house: "3D House" };
const GAME_NOTE: Record<Place, string> = {
  shop: "In a career: Shop → Walk the 3D shop, and the shop's doors in the 3D garden.",
  garden: "In a career: Home → Garden (the time of day follows your next match).",
  house: "In a career: Your house (the home you own), and the garden's house door.",
};

const toEdit = (s: WalkSaved): WalkSceneEdit => ({ views: s.views, ...(s.scene ?? {}) });

export default function WalkPlaceEditor({ place, tabs }: { place: Place; tabs: ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const h = useRef<WalkHandle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");
  const [saved, setSaved] = useState<WalkSaved>(() => emptyWalk(place));
  const views = WALK_VIEWS[place];
  const [view, setView] = useState("follow");
  const [stand, setStand] = useState("gate");
  const [sky, setSky] = useState<(typeof SKIES)[number]>("day");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("house");
  const [rooms, setRooms] = useState<{ id: string; label: string }[]>([]);
  const [roomNow, setRoomNow] = useState("");
  const [pose, setPose] = useState<{ pos: [number, number, number]; look: [number, number, number]; fov: number } | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [tab, setTab] = useState<Tab>("camera");
  const [saveMsg, setSaveMsg] = useState("");
  const [viewMsg, setViewMsg] = useState("");
  const [missing, setMissing] = useState(false);
  const lastSaved = useRef("");
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const career = useMemo(() => sampleCareer(), []);

  const apply = (sv: WalkSaved) => { lastSaved.current = JSON.stringify(sv); setSaved(sv); };

  // this device's saves first, once
  useEffect(() => { apply(loadPlaceLocal<WalkSaved>(place) ?? emptyWalk(place)); }, [place]);

  // build the scene (again when the garden's time of day or the home changes)
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    setStatus("loading");
    (window as unknown as { __editorReady?: boolean }).__editorReady = false;
    (async () => {
      try {
        const { quality3dTier, parseQuality3d } = await import("@/lib/star/three3d/quality");
        const q = parseQuality3d(new URLSearchParams(window.location.search).get("q")) ?? quality3dTier();
        const edit = toEdit(savedRef.current);
        let c: WalkHandle;
        if (place === "shop") {
          const [{ startShop }, { shopDisplays }, { kitsOf }, { look3dStyle }, { shop3dPlayerLook }, pid] = await Promise.all([
            import("@/lib/star/shop3d/scene"), import("@/lib/star/shop3d/catalogue"), import("@/lib/star/kits"),
            import("@/lib/star/look3dStyle"), import("@/lib/star/signing3d"), import("@/lib/star/playerIdentity"),
          ]);
          c = await startShop(el, { onNear: () => {}, onFps: () => {} }, kitsOf("Arsenal").home, shopDisplays({}, { h: look3dStyle() === "h" }), {
            quality: q, number: 10, edit,
            player: { look: shop3dPlayerLook(), skin: pid.skinToneHex(career.player.skinTone), hair: pid.hairColourHex(career.player.hairColour), hairStyle: pid.resolveHairStyle(career.player.hairStyle) },
          });
        } else if (place === "garden") {
          const [{ startGarden }, { gardenSceneData }] = await Promise.all([import("@/lib/star/garden3d/scene"), import("@/components/star/Garden3D")]);
          c = await startGarden(el, { onNear: () => {}, onFps: () => {}, onShopDoor: () => {} }, gardenSceneData(career, "gate", sky), { quality: q, edit });
        } else {
          const [{ startHome }, { homeSceneData }, { outfitOf }] = await Promise.all([
            import("@/lib/star/home3d/scene"), import("@/components/star/Home3D"), import("@/lib/star/home3d/outfits"),
          ]);
          c = await startHome(el, { onNear: () => {}, onFps: () => {} }, homeSceneData(career, tier, undefined, outfitOf(career)), { quality: q, edit });
        }
        if (dead) { c.dispose(); return; }
        h.current = c;
        setRooms(c.rooms?.() ?? []);
        setStatus("ready");
        (window as unknown as { __editorReady?: boolean; __placeScene?: WalkHandle }).__editorReady = true;
        (window as unknown as { __placeScene?: WalkHandle }).__placeScene = c;
      } catch (e) {
        console.error("Scene editor: place failed", e);
        if (!dead) setStatus("off");
      }
    })();
    return () => { dead = true; h.current?.dispose(); h.current = null; (window as unknown as { __editorReady?: boolean }).__editorReady = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, sky, tier]);

  // the shared copy, once (taken only when this device has none)
  useEffect(() => {
    fetchShared().then((sh) => {
      setMissing(sh.missing);
      const sv = sharedPlace<WalkSaved>(sh.edits, place);
      if (!loadPlaceLocal<WalkSaved>(place) && sv) apply(sv);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live edits → the scene (preview only)
  useEffect(() => { h.current?.setEdit?.(toEdit(saved)); }, [saved, status]);

  // the view on screen: stand him there (the garden: where he stands)
  useEffect(() => {
    if (status !== "ready") return;
    const ok = place === "garden" ? h.current?.showView?.(stand) : h.current?.showView?.(view);
    setViewMsg(ok === false ? "Not in this room: pick the room that has it (Room, above)." : "");
    setRoomNow(h.current?.room?.() ?? "");
  }, [view, stand, status, place, roomNow]);

  // save on this device on every real change
  useEffect(() => {
    if (status !== "ready") return;
    const js = JSON.stringify(saved);
    if (js === lastSaved.current) return;
    lastSaved.current = js;
    setSaveMsg(saveLocal(place, saved) ? "Saved on this device." : "Couldn't save on this device (storage blocked).");
  }, [saved, status, place]);

  // keep the map and the numbers honest
  useEffect(() => {
    const id = setInterval(() => {
      const d = h.current;
      if (!d) return;
      if (d.cameraPose) setPose(d.cameraPose());
      if (d.layout) setLayout(d.layout());
    }, 250);
    return () => clearInterval(id);
  }, []);

  const ve: ViewEdit = saved.views?.[view] ?? {};
  const sc = saved.scene ?? {};
  const edited = !!saved.views?.[view] && Object.keys(saved.views[view]).length > 0;
  const editView = (e: ViewEdit) => setSaved((s) => ({ ...s, views: { ...(s.views ?? {}), [view]: { ...(s.views?.[view] ?? {}), ...e } } }));
  const editScene = (e: NonNullable<WalkSaved["scene"]>) => setSaved((s) => ({ ...s, scene: { ...(s.scene ?? {}), ...e } }));
  const resetView = () => setSaved((s) => { const n = { ...(s.views ?? {}) }; delete n[view]; return { ...s, views: n }; });
  const resetAll = () => { apply({ ...emptyWalk(place), approval: saved.approval }); saveLocal(place, { ...emptyWalk(place), approval: saved.approval }); setSaveMsg("All edits cleared for this place."); };
  const orbit = (dx: number, dy: number, dolly: number) => {
    const cur = savedRef.current.views?.[view] ?? {};
    editView({
      turn: Math.max(-180, Math.min(180, (cur.turn ?? 0) - dx * 0.4)),
      rise: Math.max(-1.5, Math.min(4, (cur.rise ?? 0) + dy * 0.01)),
      dist: Math.max(0.3, Math.min(3, (cur.dist ?? 1) * dolly)),
    });
  };
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
  const viewName = views.find((v) => v.id === view)?.name ?? view;
  const lens = ve.lens ?? (pose ? Math.round(fovToLens(pose.fov)) : 35);

  const playBar = (
    <div className="se-play">
      <div className="se-shots" data-shots>
        {views.map((v, i) => (
          <button key={v.id} data-shot={v.id} className="se-shotbtn" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {i + 1}. {v.name}{saved.views?.[v.id] && Object.keys(saved.views[v.id]).length ? " •" : ""}
          </button>
        ))}
      </div>
      <button className="se-save" data-save-shared onClick={saveShared}>SAVE FOR EVERYONE</button>
      <button className="se-small" data-copy onClick={copyEdits}>Copy edits</button>
      <button className="se-small" data-reset-shot disabled={!edited} onClick={resetView}>Reset this view</button>
      <button className="se-small" data-reset-all onClick={resetAll}>Reset all</button>
      <span className="se-dim" data-savemsg>{saveMsg || "Edits save on this device as you change them."}</span>
    </div>
  );

  const where = (
    <div className="se-stands" data-stands>
      {place === "garden" && <>
        <span className="se-dim">Time of day:</span>
        {SKIES.map((s) => <Pill key={s} on={sky === s} onClick={() => setSky(s)}>{s}</Pill>)}
        <span className="se-dim">Stand:</span>
        {GARDEN_STANDS.map((s) => <Pill key={s.id} on={stand === s.id} onClick={() => setStand(s.id)}>{s.name}</Pill>)}
      </>}
      {place === "house" && <>
        <span className="se-dim">Home:</span>
        {TIERS.map((t) => <Pill key={t} on={tier === t} onClick={() => setTier(t)}>{t}</Pill>)}
        {rooms.length > 1 && <span className="se-dim">Room:</span>}
        {rooms.length > 1 && rooms.map((r) => (
          <Pill key={r.id} on={roomNow === r.id} onClick={() => { void h.current?.goToRoom?.(r.id as never).then(() => setRoomNow(r.id)); }}>{r.label}</Pill>
        ))}
      </>}
    </div>
  );

  const camera = (
    <div className="se-sec" data-sec="camera">
      <h3>CAMERA <span className="se-shot">view {views.findIndex((v) => v.id === view) + 1} of {views.length} · {viewName}</span></h3>
      <Row label="Turn" tag="code" help="swing round what it looks at (degrees) — or drag the preview left / right">
        <input data-turn type="range" min={-180} max={180} step={1} value={ve.turn ?? 0} onChange={(e) => editView({ turn: +e.target.value })} /><span className="se-val">{(ve.turn ?? 0) > 0 ? "+" : ""}{Math.round(ve.turn ?? 0)}°</span>
      </Row>
      <Row label="Rise" tag="code" help="up or down (metres) — or drag the preview up / down">
        <input data-rise type="range" min={-1.5} max={4} step={0.05} value={ve.rise ?? 0} onChange={(e) => editView({ rise: +e.target.value })} /><span className="se-val">{(ve.rise ?? 0).toFixed(2)}</span>
      </Row>
      <Row label="Distance" tag="code" help="closer ↔ further (× as written) — or wheel / pinch on the preview">
        <input data-dist type="range" min={0.3} max={3} step={0.05} value={ve.dist ?? 1} onChange={(e) => editView({ dist: +e.target.value })} /><span className="se-val">×{(ve.dist ?? 1).toFixed(2)}</span>
      </Row>
      <Row label="Lens (mm)" tag="code" help="zoom: wide 18 ↔ close 120">
        <input data-lens type="range" min={18} max={120} step={1} value={Math.round(lens)} onChange={(e) => editView({ lens: +e.target.value })} /><span className="se-val">{Math.round(lens)}</span>
        <button className="se-small" disabled={ve.lens === undefined} onClick={() => setSaved((s) => { const v = { ...(s.views?.[view] ?? {}) }; delete v.lens; return { ...s, views: { ...(s.views ?? {}), [view]: v } }; })}>As written</button>
      </Row>
      <Row label="This view" tag="code" help="the scene still keeps the camera out of walls and trees">
        <span className="se-val" data-free>{edited ? "EDITED" : "as written"}</span>
        <button className="se-small" data-back-to-shot disabled={!edited} onClick={resetView}>Back to as written</button>
      </Row>
      {viewMsg && <div className="se-dim" data-viewmsg>{viewMsg}</div>}
    </div>
  );
  const lighting = (
    <div className="se-sec" data-sec="lighting">
      <h3>LIGHTING</h3>
      <Row label="Exposure" tag="code" help="overall brightness (with the broadcast look on, it scales the lights)">
        <input data-exposure type="range" min={0.3} max={2.5} step={0.05} value={sc.exposure ?? 1} onChange={(e) => editScene({ exposure: +e.target.value })} /><span className="se-val">{(sc.exposure ?? 1).toFixed(2)}</span>
      </Row>
      <Row label="Key light strength" tag="code" help={place === "shop" ? "the warm light from the front doors" : place === "garden" ? "the sun" : "the sun through the drive window"}>
        <input data-keylight type="range" min={0} max={3} step={0.05} value={sc.keyLight ?? 1} onChange={(e) => editScene({ keyLight: +e.target.value })} /><span className="se-val">{(sc.keyLight ?? 1).toFixed(2)}</span>
      </Row>
      <Row label="Key light angle" tag="code" help="turn it round the place — or drag the yellow sun on the map">
        <input data-keyangle type="range" min={-180} max={180} step={1} value={sc.keyAngle ?? 0} onChange={(e) => editScene({ keyAngle: +e.target.value })} /><span className="se-val">{(sc.keyAngle ?? 0) > 0 ? "+" : ""}{sc.keyAngle ?? 0}°</span>
      </Row>
      <Row label="Key light colour" tag="code" help="its colour">
        <input data-keycolor type="color" value={sc.keyColor ?? "#ffe0b0"} onChange={(e) => editScene({ keyColor: e.target.value })} />
        <button className="se-small" disabled={!sc.keyColor} onClick={() => editScene({ keyColor: undefined })}>As written</button>
      </Row>
    </div>
  );

  return (
    <>
      <div className="se-unsaved" data-unsaved>
        Edits save on this device as you change them{missing ? " — the shared table isn't switched on yet, so SAVE FOR EVERYONE keeps them on this device only" : ""}.
        {" "}The real {NAME[place]} in a career uses them only once you APPROVE them (Use in the game, below).
      </div>
      <div className="se-grid">
        <Panel title="3D PREVIEW" note={`live: the real ${NAME[place]}`}>
          {tabs}
          {where}
          <div className="se-view">
            <div ref={holder} className="se-canvas" data-editor={status} {...orbitHandlers} style={{ touchAction: "none", cursor: "grab" }} />
            <MiniMap layout={layout} pose={pose} free={edited} onCam={() => {}} onLook={() => {}}
              onSun={(phi) => {
                if (!layout) return;
                const cur = Math.atan2(layout.sunDir[2], layout.sunDir[0]);
                let a = (sc.keyAngle ?? 0) + ((phi - cur) * 180) / Math.PI; a = ((a + 540) % 360) - 180;
                editScene({ keyAngle: Math.round(a) });
              }} />
            <div className="se-badge" data-shotname>● VIEW {String(views.findIndex((v) => v.id === view) + 1).padStart(2, "0")} · {viewName} · {Math.round(lens)} mm</div>
            {status === "loading" && <div className="se-msg">Building the scene…</div>}
            {status === "off" && <div className="se-msg">This device can&apos;t show 3D.</div>}
          </div>
          {playBar}
        </Panel>
        <div className="se-side">
          <Panel title="SETTINGS" note="only what this place has">
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
      <UsePanel place={place} scriptId={place} edits={saved} onChange={(e) => { lastSaved.current = JSON.stringify(e); setSaved(e); }} gameNote={GAME_NOTE[place]} />
      <div className="se-dim">A view&apos;s edit sits on top of the camera the scene works out as you walk (or as a card opens), so it follows you. <T k="code" /> every dial here drives the real scene.</div>
    </>
  );
}
