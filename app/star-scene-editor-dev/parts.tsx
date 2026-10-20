"use client";
/** Pieces shared by every place in the 3D Scene Editor (director, signing, office). */
import { useRef, type ReactNode } from "react";
import type { Vec3 } from "@/lib/star/cutscene/types";

export type Tag = "code" | "part" | "new";
const TAG: Record<Tag, string> = { code: "IN CODE", part: "PART", new: "NEW" };
export const T = ({ k }: { k: Tag }) => <span className={`se-tag se-${k}`}>{TAG[k]}</span>;

export type PlaceId = "signing" | "office" | "shop" | "garden" | "house" | "director";
export const PLACES: { id: PlaceId; name: string; live: boolean }[] = [
  { id: "signing", name: "3D Signing", live: true }, { id: "office", name: "Manager's Office", live: true }, { id: "shop", name: "3D Shop", live: false },
  { id: "garden", name: "3D Garden", live: false }, { id: "house", name: "3D House", live: false }, { id: "director", name: "Cut-scene Director", live: true },
];

/** The place picker: live places are buttons; the rest say "coming next". */
export function PlaceTabs({ place, onPick }: { place: PlaceId; onPick: (p: PlaceId) => void }) {
  return (
    <div className="se-places">
      {PLACES.map((p) => p.live
        ? <button key={p.id} data-place={p.id} className={`se-place${place === p.id ? "" : " se-idle"}`} aria-pressed={place === p.id} onClick={() => onPick(p.id)}>{p.name}</button>
        : <span key={p.id} className="se-place se-off" title="coming next">{p.name} <em>coming next</em></span>)}
    </div>
  );
}

/** Orbit / tilt a camera round its look point and dolly in or out. */
export function orbitPose(f: { pos: Vec3; look: Vec3 }, dx: number, dy: number, dolly: number): { pos: Vec3; look: Vec3 } {
  const [px, py, pz] = f.pos, [lx, ly, lz] = f.look;
  let ox = px - lx, oy = py - ly, oz = pz - lz;
  let r = Math.hypot(ox, oy, oz) || 1;
  let yaw = Math.atan2(ox, oz), pitch = Math.asin(Math.max(-1, Math.min(1, oy / r)));
  yaw -= dx * 0.008; pitch = Math.max(-1.2, Math.min(1.45, pitch + dy * 0.006));
  r = Math.max(0.3, Math.min(80, r * dolly));
  ox = r * Math.cos(pitch) * Math.sin(yaw); oz = r * Math.cos(pitch) * Math.cos(yaw); oy = r * Math.sin(pitch);
  return { pos: [lx + ox, ly + oy, lz + oz], look: f.look };
}

/** Pointer handlers for the preview: one finger / mouse orbits, wheel or two fingers dolly. */
export function useOrbit(orbit: (dx: number, dy: number, dolly: number) => void) {
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch0 = useRef(0);
  return {
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
}

export function Row({ label, tag, help, greyed, children }: { label: string; tag: Tag; help: string; greyed?: boolean; children?: ReactNode }) {
  return (
    <div className={`se-row${greyed ? " se-grey" : ""}`}>
      <div className="se-rl"><span>{label}</span> <T k={tag} />{greyed && <span className="se-next">coming next</span>}</div>
      {children && <div className="se-rc">{children}</div>}
      {help && <div className="se-help">{help}</div>}
    </div>
  );
}

/** Three number boxes for a point in metres. */
export function Vec({ v, onSet, data }: { v?: Vec3; onSet: (v: Vec3) => void; data: string }) {
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
export function MiniMap({ layout, pose, free, onCam, onLook, onSun }: {
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
