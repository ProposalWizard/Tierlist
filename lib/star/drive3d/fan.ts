/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE FAN AT THE CROSSING (driving phase 2, events.ts "fan-crossing"): one of the game's real people (the people3d
 * body, a fan preset from lib/star/people/presets.ts with his own head, face and hair), in off-pitch cloth (a hoodie
 * in the club's colour, dark joggers) with a club scarf, waving on the zebra crossing as your car stops for him;
 * then he walks on to the pavement. Loaded only on a drive that has this event.
 */
import type { Quality3d } from "../three3d/quality";

export interface DriveFan { root: any; update: (dt: number) => void; wave: () => void; walk: (on: boolean) => void; dispose?: () => void }

export async function makeDriveFan(T: any, loader: any, o: { club: string; kit: { shirt: string; trim: string }; tier: Quality3d }): Promise<DriveFan> {
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkeletonUtils.default ?? SkeletonUtils;
  const { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, toonHeadsFor } = await import("../people3d");
  const { people3dLook } = await import("../look3d");
  const { addClips, loadAnims3d } = await import("../three3d/footballAnims");
  const PR = await import("../people/presets");
  const { dressCloth, HOME_WB } = await import("../style3d/toon/clothes");
  const L: any = PR.castScene([{ id: "drive-fan", role: "fan" as const, club: o.club || "Arsenal" }])[0];
  const heads = Array.from(new Set([...toonHeadsFor([]), L.head]));
  const [charG, animG, footG] = await Promise.all([loadPeople3d(loader, "player", people3dLook(), heads), loadPeople3d(loader, "anims", people3dLook()), loadAnims3d(loader, "football")]);
  const p: any = makePerson3d(T, SK, charG, animG, { outline: 0, castShadow: o.tier === "high", who: L.id, toonHead: L.head, toonBody: L.build } as any);
  dressPerson3d(T, p, { ...L.dress, kit: { ...(L.kit ?? {}), shirt: o.kit.shirt, trim: o.kit.trim }, number: null } as any);
  // off-pitch cloth: a hoodie in the club's colour, dark joggers, white trainers
  dressCloth(T, p, "hoodie", L.id, { colours: { top: o.kit.shirt, trousers: "#23262d", shoes: "#e9e6df" }, whiteBalance: HOME_WB } as any);
  try {
    const FI = await import("../style3d/toon/faceIdApply");
    const FACE = await import("../style3d/toon/face");
    FI.applyToonFaceId(T, p, L.faceId, { detail: FI.FACE_DETAIL[o.tier] });
    FACE.addToonFace(T, p)?.set({ face: FACE.toonFaceFor({}), blink: 0 });
  } catch { /* no face: the plain head */ }
  if (L.hairMesh) { try { const HAIR = await import("../style3d/toon/hair"); await HAIR.wearToonHair(T, loader, p, L.hairMesh, { outline: 0 }); } catch { /* bald */ } }
  relaxHands(T, p);
  addClips(T, p, footG);
  // the club scarf: a band round the neck and its two ends down the chest, in the trim with a shirt-colour stripe
  const neck = p.bones.Neck ?? p.bones.Spine2 ?? p.bones.Spine1;
  if (neck) {
    const u = 1 / (p.unit || 1);
    const sc = document.createElement("canvas"); sc.width = 64; sc.height = 16;
    const g = sc.getContext("2d")!; g.fillStyle = o.kit.trim; g.fillRect(0, 0, 64, 16); g.fillStyle = o.kit.shirt; for (let k = 0; k < 64; k += 16) g.fillRect(k, 0, 8, 16);
    const tex = new T.CanvasTexture(sc); tex.colorSpace = T.SRGBColorSpace;
    const m = new T.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const band = new T.Mesh(new T.TorusGeometry(0.085 * u, 0.028 * u, 8, 20), m);
    band.rotation.x = Math.PI / 2; band.position.set(0, 0.02 * u, 0.0);
    neck.add(band);
    for (const sx of [-0.045, 0.05]) { const end = new T.Mesh(new T.BoxGeometry(0.06 * u, 0.32 * u, 0.025 * u), m); end.position.set(sx * u, -0.15 * u, 0.1 * u); end.rotation.z = sx * 1.5; neck.add(end); }
  }
  const acts = p.actions;
  const waveA = acts.wave ?? acts.applause ?? acts.idle;
  const walkA = acts.walk ?? acts.jog ?? acts.idle;
  for (const a of Object.values(acts) as any[]) a.setEffectiveWeight(0);
  waveA?.reset().play(); waveA?.setEffectiveWeight(1);
  let cur = waveA;
  const swap = (a: any) => { if (!a || a === cur) return; a.reset().play(); a.crossFadeFrom(cur, 0.25, false); cur = a; };
  return {
    root: p.root,
    update: (dt) => p.mixer.update(dt),
    wave: () => swap(waveA),
    walk: (on) => swap(on ? walkA : waveA),
  };
}
