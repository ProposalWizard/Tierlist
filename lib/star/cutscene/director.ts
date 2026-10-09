/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE DIRECTOR — plays a CutsceneScript in three.js, from t alone.
 *
 *   const d = await createDirector(el, script, { career, style: "golden" });
 *   d.seek(3.2); d.play(); d.skip(); d.setStyle("ink"); d.dispose();
 *
 * Every frame: each actor is posed from the timeline (clips → root → holds →
 * reaches and traces → hands → look → face), props follow hands or rest,
 * effects are placed from t, the camera is the shot at t (its subject's
 * place measured once when the script loads, at the shot's start), then the
 * style kit draws it in the chosen look and the letterbox / fades go on top.
 *
 * `window.__frameStep = { duration, seek(t) }` lets the frame-by-frame
 * filming tool (scripts/film/frames3d.mjs) step through any cut scene.
 */
import type { CameraTrack, CareerContext, CutsceneActor, CutsceneScript, FxTrack, LightTrack, PoseTrack, PropTrack, ReachTrack, Target, TraceTrack, Vec3, HandTrack, LookTrack, FaceTrack, SpeakTrack } from "./types";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { people3dLook } from "../look3d";
import { createStyleKit, type StyleKit } from "../style3d/kit";
import { resolveStyle, type StyleDef, type StyleId } from "../style3d/styles";
import { applyMood, MOODS } from "./presets/moods";
import { compileScript, rootAt, clipsAt, trackWeight, cameraAt, overlayAt, soundsBetween, type Compiled, type Overlay } from "./timeline";
import { shotPose, mixPose, type Anchor, type ShotPose } from "./presets/camera";
import { resolvePoint } from "./presets/locations";
import { createCutscenePeople } from "./peopleAdapter";
import { castLook, DEFAULT_CLUB } from "./casting";
import { buildSet, type BuiltSet } from "./locations3d";
import { buildProp, type PropObj, type PropText } from "./props3d";
import { createFx, type FxActive } from "./fx3d";
import { applyPose, actorDir, type PoseCtx } from "./perform3d";
import { makeSignature, signatureAt } from "./signature";
import { clamp, lerpAngle, noise1, smooth } from "./math";

export interface DirectorOptions {
  career?: CareerContext;
  style?: StyleId;
  tier?: Quality3d;
  /** Captions, letterbox state, the shot's name — for the page to show. */
  onOverlay?: (o: Overlay & { t: number }) => void;
  onSound?: (cue: string, volume: number) => void;
  onEnd?: () => void;
  /** Start paused at this time. */
  holdAt?: number;
  /** A ready-made style (the Style Testing page passes its own); else `style`. */
  def?: StyleDef;
}

export interface Director {
  readonly duration: number;
  readonly script: CutsceneScript;
  time(): number;
  playing(): boolean;
  seek(t: number): void;
  play(): void;
  pause(): void;
  replay(): void;
  skip(): void;
  setStyle(id: StyleId): void;
  /** A ready-made style (the mood is still laid over it). */
  setStyleDef(def: StyleDef): void;
  /** Frame stepping: stop the real-time loop and draw exactly t. */
  frameSeek(t: number): void;
  dispose(): void;
}

interface Cast { id: string; role: string; body: string; actor: CutsceneActor; clipSet: Set<string> }

const SITS = new Set(["sitidle", "boss-sit", "sitdown", "slot_sit"]);
const IN_PLACE = new Set(["sitdown", "sitidle", "boss-sit", "slump_walk", "jog", "sprint", "dribble_run", "celebrate_safe"]);

export async function createDirector(container: HTMLElement, script: CutsceneScript, o: DirectorOptions = {}): Promise<Director> {
  const tier = o.tier ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const T: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkU: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const loader = await withMeshopt(new GLTFLoader());
  const career = o.career;
  const C: Compiled = compileScript(script, career, script.source?.event);
  const club = career?.club ?? DEFAULT_CLUB;

  const { renderer, release } = acquireRenderer(T, container, prof);
  const scene = new T.Scene();
  const root = new T.Group();
  scene.add(root);
  const camera = new T.PerspectiveCamera(40, 1, 0.03, 600);
  let styleId: StyleId = o.style ?? script.set.look ?? "golden";
  let given: StyleDef | null = o.def ?? null;
  const resolveDef = () => structuredClone(applyMood(given ?? resolveStyle(styleId, "cut"), script.set.mood));
  let def: StyleDef = resolveDef();
  const kit: StyleKit = createStyleKit(T, renderer, scene, tier, def);
  const mood = MOODS[script.set.mood];

  // ── the set ──
  let set: BuiltSet = buildSet(T, kit, tier, script.set.location, { shirt: club.shirt, trim: club.trim, club: club.name, lamps: mood.lamps, seed: script.seed ?? 1, night: script.set.mood.includes("night") });
  root.add(set.group);

  // ── the cast ──
  const people = createCutscenePeople({ T, SkeletonUtils: SkU.default ?? SkU, loader, body: people3dLook() });
  const cast = new Map<string, Cast>();
  await Promise.all(C.cast.map(async (m) => {
    const look = castLook(m, career);
    const actor = await people.create({ id: m.id, role: m.role, look, outline: prof.outlines ? 0.006 : 0, castShadow: prof.shadows });
    root.add(actor.root);
    cast.set(m.id, { id: m.id, role: m.role, body: look.body, actor, clipSet: new Set(actor.clips()) });
  }));
  const persons = () => Array.from(cast.values()).map((c) => c.actor.person).filter(Boolean) as any[];

  // ── props ──
  const txt: PropText = {
    club: club.name, player: career?.player?.name ?? "The New Signing", surname: career?.player?.surname ?? career?.player?.name?.split(" ").slice(-1)[0] ?? "Signing",
    manager: career?.manager?.name ?? "The Manager", number: career?.player?.number ?? 9, shirt: club.shirt, trim: club.trim,
    rows: [["Seasons", String(script.text?.seasons ?? "3")], ["Weekly wage", script.text?.wage ?? "★2,500"], ["Shirt number", String(career?.player?.number ?? 9)]],
  };
  const sig = makeSignature(txt.player);
  const props = new Map<string, PropObj>();
  const buildProps = () => {
    for (const p of Array.from(props.values())) { root.remove(p.group); p.dispose(); }
    props.clear();
    for (const s of script.props ?? []) { const p = buildProp(T, kit, s, txt, sig); props.set(s.id, p); root.add(p.group); }
  };
  buildProps();

  const fx = createFx(T, root, tier, script.seed ?? 1);
  const spot = new T.SpotLight("#fff1dc", 0, 18, 0.3, 0.6, 1.2); root.add(spot, spot.target);

  // overlay: letterbox bars and fades, drawn after the style pass
  const ovScene = new T.Scene();
  const ovCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const barMat = new T.MeshBasicMaterial({ color: "#000000", depthTest: false });
  const fadeMat = new T.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0, depthTest: false });
  const barTop = new T.Mesh(new T.PlaneGeometry(2, 1), barMat), barBot = new T.Mesh(new T.PlaneGeometry(2, 1), barMat);
  const fadeQ = new T.Mesh(new T.PlaneGeometry(2, 2), fadeMat);
  ovScene.add(barTop, barBot, fadeQ);

  // ── posing one moment ──
  const v = (p: Vec3) => new T.Vector3(p[0], p[1], p[2]);
  const actorLocal = (id: string, t: number, l: Vec3) => {
    const r = rootAt(C, id, t);
    const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    return new T.Vector3(r.pos[0] + l[0] * c + l[2] * s, r.pos[1] + l[1], r.pos[2] - l[0] * s + l[2] * c);
  };
  const localDir = (id: string, t: number, d: Vec3) => {
    const r = rootAt(C, id, t);
    const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    return new T.Vector3(d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c).normalize();
  };
  const propWorld = (id: string, handle?: string) => {
    const p = props.get(id);
    if (!p) return null;
    p.group.updateMatrixWorld(true);
    const h = (handle ? p.handles[handle] : undefined) ?? p.handles.grip ?? [0, 0, 0];
    return v(h).applyMatrix4(p.group.matrixWorld);
  };
  /** A target's world point now (after the actors are posed). */
  const targetPoint = (tg: Target, t: number): any => {
    if ("actor" in tg) {
      const a = cast.get(tg.actor);
      if (!a) return new T.Vector3();
      if (tg.local) return actorLocal(tg.actor, t, tg.local);
      return a.actor.point(tg.part ?? "head");
    }
    if ("prop" in tg) return propWorld(tg.prop, tg.handle) ?? new T.Vector3();
    if ("mark" in tg) { const p = resolvePoint(C.loc, tg.mark); return new T.Vector3(p[0], p[1] + (tg.y ?? 0), p[2]); }
    if ("point" in tg) return v(tg.point);
    return camera.position.clone();
  };

  const tracksOf = <K extends string>(id: string, type: K) => (C.byActor.get(id) ?? []).filter((x) => x.type === type) as any[];

  /** Hold the tool's grip point (not the wrist) on `want`: a few passes, each moving the wrist by the miss. */
  const toolTo = (a: CutsceneActor, hand: "L" | "R", grip: any, want: any, along: any, palm: any, pole: any, w: number) => {
    const S = hand === "R" ? "Right" : "Left";
    const bones = [`${S}Shoulder`, `${S}Arm`, `${S}ForeArm`, `${S}Hand`].map((n) => a.bone(n)).filter(Boolean) as any[];
    const saved = bones.map((b) => b.quaternion.clone());
    let wrist = want.clone().add(new T.Vector3(0, 0.08, 0));
    for (let i = 0; i < 4; i++) {
      bones.forEach((b, j) => b.quaternion.copy(saved[j]));
      a.root.updateMatrixWorld(true);
      a.reach(hand, wrist, along, palm, 1, pole);
      a.hand(hand, grip, 1);
      const g = a.gripFrame(hand, grip).pos;
      wrist = wrist.add(want.clone().sub(g));
    }
    if (w < 1) {
      const solved = bones.map((b) => b.quaternion.clone());
      bones.forEach((b, j) => { b.quaternion.copy(saved[j]).slerp(solved[j], w); });
      a.root.updateMatrixWorld(true);
    }
  };

  // prop states from the prop tracks
  const propTracks = C.tracks.filter((x): x is PropTrack => x.type === "prop");
  const propRest = new Map<string, { pos: Vec3; yaw: number; visible: boolean }>();
  for (const s of script.props ?? []) propRest.set(s.id, { pos: s.at !== undefined ? resolvePoint(C.loc, s.at) : [0, -50, 0], yaw: ((s.yaw ?? 0) * Math.PI) / 180, visible: s.at !== undefined });

  const traceProgress = new Map<string, number>();

  const poseActors = (t: number) => {
    traceProgress.clear();
    // 1. bodies: clips, root, holds
    for (const c of Array.from(cast.values())) {
      const a = c.actor;
      a.beginFrame();
      const cs = clipsAt(C, c.id, t, (n) => c.clipSet.has(n), (n) => a.clipDuration(n), c.role, c.body);
      a.poseClips(cs.entries);
      const r = rootAt(C, c.id, t);
      a.setRoot(r.pos, r.yaw);
      const inPlace = cs.entries.reduce((s, e) => s + (IN_PLACE.has(e[0]) ? e[2] : 0), 0);
      if (inPlace > 0 && (a as any).hipsInPlace) (a as any).hipsInPlace(Math.min(1, inPlace));
      const sitW = cs.entries.reduce((s, e) => s + (SITS.has(e[0]) ? e[2] : 0), 0);
      if (sitW < 0.5) a.plantFeet(1 - sitW * 2);
      if (cs.upright > 0) a.lean(-0.2 * cs.upright);
      // getting up, the clip folds him far forward (two men at one desk would meet head to head): keep the back nearer upright
      const riseW = cs.entries.reduce((s, e) => s + (e[0] === "sitdown" ? e[2] : 0), 0);
      if (riseW > 0.05) {
        const nk = a.bone("neck"), hp = a.bone("Hips");
        const f = new T.Vector3(Math.sin(r.yaw), 0, Math.cos(r.yaw));
        for (let i = 0; i < 4 && nk && hp; i++) {
          const d = new T.Vector3().setFromMatrixPosition(nk.matrixWorld).sub(new T.Vector3().setFromMatrixPosition(hp.matrixWorld));
          const bend = Math.atan2(d.dot(f), d.y);
          if (bend <= 0.2) break;
          a.lean(-(bend - 0.2) * Math.min(1, riseW * 1.5));
          a.root.updateMatrixWorld(true);
        }
      }
      const ctx: PoseCtx = { T, t, local: 0, yaw: r.yaw, root: [a.root.position.x, a.root.position.y, a.root.position.z] };
      for (const pt of tracksOf(c.id, "pose") as PoseTrack[]) {
        const w = trackWeight(pt, t, 0.3, 0.35) * (pt.amount ?? 1);
        if (w > 0) applyPose(a, pt.pose, w, { ...ctx, local: t - pt.at });
      }
      if (cs.upright > 0) a.lookAt(actorLocal(c.id, t, [0, 1.62, 6]), 0.8 * cs.upright);
    }
    // 2. props at rest / placed (so reaches for them see where they are)
    placeProps(t, "rest");
    // 3. reaches, traces, hands
    for (const c of Array.from(cast.values())) {
      const a = c.actor;
      for (const rt of tracksOf(c.id, "reach") as ReachTrack[]) {
        const w = trackWeight(rt, t, 0.35, 0.35);
        if (w <= 0) continue;
        let p = targetPoint(rt.target, t);
        if (rt.offset) p = p.clone().add(v(rt.offset));
        if (rt.pump) p = p.clone().add(new T.Vector3(0, Math.sin((t - rt.at) * Math.PI * 2 * rt.pump[1]) * rt.pump[0] * smooth((t - rt.at) / 0.4), 0));
        const along = rt.along ? localDir(c.id, t, rt.along) : null;
        const palm = rt.palm ? localDir(c.id, t, rt.palm) : null;
        const pole = rt.pole ? localDir(c.id, t, rt.pole) : undefined;
        if (rt.grip) a.hand(rt.hand, rt.grip, w);
        if (rt.toolGrip && rt.grip) toolTo(a, rt.hand, rt.grip, p, along, palm, pole, w);
        else a.reach(rt.hand, p, along, palm, w, pole);
      }
      for (const tr of tracksOf(c.id, "trace") as TraceTrack[]) traceOne(c, tr, t);
      for (const ht of tracksOf(c.id, "hand") as HandTrack[]) {
        const w = trackWeight({ ...ht, blendOut: 0.2 }, t, ht.blendIn ?? 0.2, 0.2);
        if (w <= 0) continue;
        if (ht.hand === "both" || ht.hand === "L") a.hand("L", ht.pose, w);
        if (ht.hand === "both" || ht.hand === "R") a.hand("R", ht.pose, w);
      }
    }
    // 4. look, face, talk; blinks
    for (const c of Array.from(cast.values())) {
      const a = c.actor;
      for (const lt of tracksOf(c.id, "look") as LookTrack[]) {
        const w = trackWeight(lt, t, 0.35, 0.35) * (lt.amount ?? 1);
        if (w > 0) a.lookAt(targetPoint(lt.target, t), w);
      }
      for (const ft of tracksOf(c.id, "face") as FaceTrack[]) {
        const w = trackWeight({ at: ft.at, dur: ft.dur ?? 999, blendIn: ft.blendIn ?? 0.25, blendOut: 0.25 }, t);
        if (w > 0) a.setExpression(ft.expression, (ft.amount ?? 1) * w);
      }
      const talking = (tracksOf(c.id, "speak") as SpeakTrack[]).some((s) => t >= s.at && t <= s.at + s.dur);
      a.setMouth(talking ? 0.5 + 0.5 * noise1(t * 9, c.id.length) : 0);
      const bp = (t + c.id.length * 0.77) % 3.6;
      a.setBlink(bp < 0.12 ? Math.sin((bp / 0.12) * Math.PI) : 0);
      a.endFrame();
    }
    // 5. props in hands
    placeProps(t, "held");
  };

  const traceOne = (c: Cast, tr: TraceTrack, t: number) => {
    const a = c.actor;
    const tool = props.get(tr.tool), surf = props.get(tr.along.prop);
    if (!tool || !surf?.surface) return;
    const lead = tr.leadIn ?? 0.45, out = tr.leadOut ?? 0.5;
    const t0 = tr.at, t3 = tr.at + tr.dur, t1 = t0 + lead, t2 = t3 - out;
    if (t < t0 || t > t3 + 0.35) return;
    const s = surf.paths?.[tr.along.path];
    surf.group.updateMatrixWorld(true);
    const onPaper = (px: number, py: number, lift: number) => v(surf.surface!(330 + (px / 300) * 260, 692 + (py / 60) * 70, lift)).applyMatrix4(surf.group.matrixWorld);
    const restP = propRest.get(tr.tool)!;
    const restTip = v(restP.pos).add(new T.Vector3(0, 0.012, 0));
    let want: any;
    let u = 0;
    if (t < t1) {
      const k = smooth((t - t0) / lead);
      const first = s ? onPaper(s.strokes[0][0][0], s.strokes[0][0][1], 0.006) : restTip;
      want = restTip.clone().lerp(first, k).add(new T.Vector3(0, Math.sin(k * Math.PI) * 0.05, 0));
    } else if (t <= t2) {
      u = clamp((t - t1) / Math.max(0.05, t2 - t1));
      if (s) { const p = signatureAt(s, u); want = onPaper(p.x, p.y, p.down ? 0.0005 : 0.004 + (tr.lift ?? 0.012) * p.lift); }
      else want = restTip;
      traceProgress.set(tr.along.prop, u);
    } else {
      u = 1;
      const k = smooth((t - t2) / out);
      const last = s ? s.strokes[s.strokes.length - 1].slice(-1)[0] : [0, 0];
      want = onPaper(last[0], last[1], 0.004).lerp(restTip, k).add(new T.Vector3(0, Math.sin(k * Math.PI) * 0.05, 0));
      traceProgress.set(tr.along.prop, 1);
    }
    const w = t > t3 ? 1 - smooth((t - t3) / 0.35) : smooth((t - t0) / 0.2);
    const along = localDir(c.id, t, tr.handAlong ?? [0.2, -0.7, 0.68]);
    const palm = localDir(c.id, t, tr.handPalm ?? [0.85, -0.5, -0.1]);
    toolTo(a, tr.hand, "pen", want, along, palm, localDir(c.id, t, tr.hand === "R" ? [-0.7, -0.6, -0.2] : [0.7, -0.6, -0.2]), w);
  };

  const placeProps = (t: number, phase: "rest" | "held") => {
    for (const [id, p] of Array.from(props)) {
      let st = { ...propRest.get(id)! };
      let held: { actor: string; hand?: "L" | "R"; part?: string; at: number; dur: number; from?: any } | null = null;
      for (const pt of propTracks) {
        if (pt.prop !== id || pt.at > t) continue;
        if (pt.action === "attach") held = { actor: pt.actor!, hand: pt.hand, part: pt.part, at: pt.at, dur: pt.dur ?? 0.12 };
        else if (pt.action === "detach" || pt.action === "place") {
          held = null;
          if (pt.to !== undefined) {
            const to = resolvePoint(C.loc, pt.to);
            const yaw = pt.yaw !== undefined ? (pt.yaw * Math.PI) / 180 : typeof pt.to === "string" ? (C.loc.marks[pt.to]?.yaw ?? st.yaw) : st.yaw;
            const k = pt.dur ? smooth((t - pt.at) / pt.dur) : 1;
            const kk = pt.arc ? clamp((t - pt.at) / Math.max(0.01, pt.dur ?? 0.01)) : k;
            st = { pos: [st.pos[0] + (to[0] - st.pos[0]) * kk, st.pos[1] + (to[1] - st.pos[1]) * kk + (pt.arc ? Math.sin(kk * Math.PI) * pt.arc : 0), st.pos[2] + (to[2] - st.pos[2]) * kk], yaw: lerpAngle(st.yaw, yaw, k), visible: true };
          }
        } else if (pt.action === "show") st.visible = true;
        else if (pt.action === "hide") st.visible = false;
      }
      // a pose holding it with both hands
      let both: string | null = null;
      for (const c of Array.from(cast.values())) for (const pt of tracksOf(c.id, "pose") as PoseTrack[]) if (pt.prop === id && trackWeight(pt, t) > 0.5) both = c.id;
      if (phase === "rest") {
        if (!held && !both) {
          p.group.visible = st.visible;
          p.group.position.set(...st.pos); p.group.quaternion.setFromAxisAngle(new T.Vector3(0, 1, 0), st.yaw);
        }
      } else if (held || both) {
        p.group.visible = true;
        const restQ = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), st.yaw);
        const restPos = v(st.pos);
        let pos: any, q: any;
        if (both) {
          const a = cast.get(both)!.actor;
          const gl = a.gripFrame("L", "grip").pos, gr = a.gripFrame("R", "grip").pos;
          const hl = v(p.handles.L ?? [0.1, 0, 0]), hr = v(p.handles.R ?? [-0.1, 0, 0]);
          const X = gl.clone().sub(gr).normalize();
          const fwd = actorDir(T, { T, t, local: 0, yaw: rootAt(C, both, t).yaw, root: [0, 0, 0] }, 0, 0, 1);
          const Y = new T.Vector3().crossVectors(fwd, X).normalize();
          const Z = new T.Vector3().crossVectors(X, Y).normalize();
          q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
          const mid = gl.clone().add(gr).multiplyScalar(0.5);
          const hm = hl.clone().add(hr).multiplyScalar(0.5).multiply(p.group.scale).applyQuaternion(q);
          pos = mid.sub(hm);
        } else {
          const a = cast.get(held!.actor)!.actor;
          if (held!.part) { pos = a.point(held!.part as any); q = new T.Quaternion(); a.bone("Spine02")?.getWorldQuaternion(q); }
          else {
            const g = a.gripFrame(held!.hand ?? "R", p.grip === "pen" ? "pen" : "grip");
            const Y = g.axis.clone().normalize();
            const Zr = g.up.clone().sub(Y.clone().multiplyScalar(g.up.dot(Y))).normalize();
            const X = new T.Vector3().crossVectors(Y, Zr).normalize();
            q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Zr));
            const h = v(p.handles.grip ?? [0, 0, 0]).multiply(p.group.scale).applyQuaternion(q);
            pos = g.pos.clone().sub(h);
          }
        }
        // ease from where it lay into the hand
        if (held) {
          const k = smooth((t - held.at) / Math.max(0.01, held.dur));
          if (k < 1) { pos = restPos.lerp(pos, k); q = restQ.slerp(q, k); }
        }
        p.group.position.copy(pos); p.group.quaternion.copy(q);
      }
      p.group.updateMatrixWorld(true);
      p.update?.(t);
      if (p.setInk) {
        const u = traceProgress.get(id);
        if (u !== undefined) p.setInk(u, false);
        else {
          // after the trace: fully inked; before: none
          const tr = C.tracks.find((x): x is TraceTrack => x.type === "trace" && x.along.prop === id);
          if (tr) p.setInk(t > tr.at + tr.dur ? 1 : 0, script.text?.stamp === "yes" && t > tr.at + tr.dur + 0.3);
        }
      }
    }
  };

  // ── anchors for each shot: posed once, at the shot's start ──
  const anchorOf = (tg: Target, t: number): Anchor => {
    if ("actor" in tg && cast.has(tg.actor) && !tg.local) {
      const a = cast.get(tg.actor)!.actor;
      const r = rootAt(C, tg.actor, t);
      const head = a.point("head"), chest = a.point("chest"), hips = a.point("hips");
      const toV = (p: any): Vec3 => [p.x, p.y, p.z];
      if (tg.part && tg.part !== "head" && tg.part !== "chest") {
        const p = toV(a.point(tg.part));
        return { pos: [p[0], r.pos[1], p[2]], yaw: r.yaw, head: p, chest: p, hips: p, height: 0.4, thing: true };
      }
      return { pos: [a.root.position.x, a.root.position.y, a.root.position.z], yaw: r.yaw, head: toV(head), chest: toV(chest), hips: toV(hips), height: head.y - a.root.position.y + 0.1 };
    }
    const p = targetPoint(tg, t);
    const q: Vec3 = [p.x, p.y, p.z];
    const yaw = "actor" in tg ? rootAt(C, tg.actor, t).yaw : 0;
    return { pos: [q[0], 0, q[2]], yaw, head: q, chest: q, hips: q, height: 0.4, thing: true };
  };
  /** Where everyone (but the subject) stands at t: things the camera must not sit inside or behind. */
  const bodiesAt = (t: number, except: Set<string>): Vec3[] => C.cast.filter((m) => !except.has(m.id)).map((m) => { const r = rootAt(C, m.id, t); return [r.pos[0], r.pos[1] + 1.15, r.pos[2]] as Vec3; });
  /** A shot whose camera is inside someone, or has someone right in front of the lens, swings round until it is clear. */
  const clearShot = (spec: CameraTrack["shot"], a: Anchor, b: Anchor | null, t: number): CameraTrack["shot"] => {
    if (spec.fixed || spec.preset === "ots" || spec.preset === "pov" || spec.preset === "insert") return spec;
    const except = new Set<string>();
    for (const tg of [spec.subject, spec.subject2]) if (tg && "actor" in tg) except.add(tg.actor);
    const bodies = bodiesAt(t, except);
    const blocked = (sp: CameraTrack["shot"]) => {
      const p = shotPose(sp, a, b, { aspect: camera.aspect, k: 0.5, t, seed: 0 });
      const cam = v(p.pos), look = v(p.look);
      const seg = look.clone().sub(cam); const L = seg.length(); seg.normalize();
      return bodies.some((q) => {
        const w = v(q).sub(cam); const along = w.dot(seg);
        if (along < -0.3 || along > L * 0.85) return false;
        return w.clone().sub(seg.clone().multiplyScalar(along)).length() < 0.42 + Math.max(0, along) * 0.04;
      });
    };
    if (!blocked(spec)) return spec;
    for (const dy of [28, -28, 55, -55, 85, -85]) { const s2 = { ...spec, yaw: (spec.yaw ?? 0) + dy }; if (!blocked(s2)) return s2; }
    return { ...spec, rise: (spec.rise ?? 0) + 0.8 };
  };
  const anchors = new Map<CameraTrack, { a: Anchor; b: Anchor | null; shot: CameraTrack["shot"] }>();
  const measureAnchors = () => {
    anchors.clear();
    for (const cam of C.cameras) {
      // a subject who travels during the shot: frame where he ends up (he moves into the shot)
      let at = cam.at + 0.02;
      if ("actor" in cam.shot.subject && cam.shot.move !== "follow" && cam.shot.move !== "track") {
        const id = cam.shot.subject.actor;
        const p0 = rootAt(C, id, cam.at).pos, p1 = rootAt(C, id, cam.at + cam.dur * 0.85).pos;
        if (Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 1) at = cam.at + cam.dur * 0.85;
      }
      poseActors(at);
      const a = anchorOf(cam.shot.subject, at), b = cam.shot.subject2 ? anchorOf(cam.shot.subject2, at) : null;
      anchors.set(cam, { a, b, shot: clearShot(cam.shot, a, b, at) });
    }
  };
  measureAnchors();

  const camPose = (cam: CameraTrack, k: number, t: number): ShotPose => {
    const live = cam.shot.move === "follow" || cam.shot.move === "track";
    const st = anchors.get(cam)!;
    if (live) {
      const a = anchorOf(cam.shot.subject, t), b = cam.shot.subject2 ? anchorOf(cam.shot.subject2, t) : null;
      return shotPose(clearShot(cam.shot, a, b, t), a, b, { aspect: camera.aspect, k, t, seed: script.seed ?? 1, bounds: C.loc.bounds });
    }
    const p = shotPose(st.shot, st.a, st.b, { aspect: camera.aspect, k, t, seed: script.seed ?? 1, bounds: C.loc.bounds });
    // the camera stands still; its eye keeps on the subject as he moves a little
    if ("actor" in cam.shot.subject && !cam.shot.fixed && !cam.shot.subject.local) {
      const now = anchorOf(cam.shot.subject, t);
      const d: Vec3 = [now.chest[0] - st.a.chest[0], now.chest[1] - st.a.chest[1], now.chest[2] - st.a.chest[2]];
      p.look = [p.look[0] + d[0] * 0.7, p.look[1] + d[1] * 0.7, p.look[2] + d[2] * 0.7];
    }
    return p;
  };

  // ── one frame at t ──
  let lastT = -1;
  const evaluate = (t: number) => {
    poseActors(t);
    // effects
    const act: FxActive[] = [];
    for (const f of C.tracks) {
      if (f.type !== "fx") continue;
      const x = f as FxTrack;
      const w = trackWeight({ at: x.at, dur: x.dur, blendIn: 0.3, blendOut: 0.6 }, t);
      if (w <= 0) continue;
      const ar = x.around ? targetPoint(x.around, t) : new T.Vector3(...(C.loc.marks.centre?.pos ?? [0, 0, 0]));
      act.push({ fx: x.fx, t, local: t - x.at, w, around: [ar.x, ar.y, ar.z], amount: x.amount ?? 1, colors: x.colors ?? (x.fx === "confetti" || x.fx === "ticker-tape" ? [club.shirt, club.trim, "#f4c542", club.shirt] : undefined) });
    }
    const speed = act.find((a) => a.fx === "speed-lines");
    kit.setBurst(speed ? speed.w : 0);
    // camera
    const cs = cameraAt(C, t);
    if (cs) {
      let p = camPose(cs.cur, cs.k, t);
      if (cs.prev) p = mixPose(camPose(cs.prev.track, cs.prev.k, t), p, cs.prev.mix);
      camera.position.set(...p.pos);
      camera.up.set(Math.sin((p.roll * Math.PI) / 180), Math.cos((p.roll * Math.PI) / 180), 0);
      camera.lookAt(...p.look);
      if (Math.abs(camera.fov - p.fov) > 1e-3) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
    }
    const { flash } = fx.update(act, camera, def.sunDir);
    // lights
    let expo = 1, sunK = 1;
    spot.intensity = 0;
    for (const l of C.tracks) {
      if (l.type !== "light") continue;
      const x = l as LightTrack;
      const w = trackWeight({ at: x.at, dur: x.dur, blendIn: 0.4, blendOut: 0.4 }, t);
      if (w <= 0) continue;
      if (x.exposure) expo *= 1 + (x.exposure - 1) * w;
      if (x.sun) sunK *= 1 + (x.sun - 1) * w;
      if (x.spot) { const p = targetPoint(x.spot.target, t); spot.intensity = x.spot.intensity * w * 40; spot.color.set(x.spot.color ?? "#fff1dc"); spot.position.set(p.x + 1.5, p.y + 5, p.z + 3); spot.target.position.copy(p); }
    }
    def.post.exposure = baseExposure * expo * (1 + flash);
    void sunK;
    // overlay
    const ov = overlayAt(C, t);
    const lb = ov.letterbox;
    barTop.scale.set(1, lb * 0.5 * 2, 1); barTop.position.y = 1 - lb * 0.5;
    barBot.scale.set(1, lb * 0.5 * 2, 1); barBot.position.y = -1 + lb * 0.5;
    barTop.visible = barBot.visible = lb > 0.001;
    fadeMat.opacity = ov.fade; fadeMat.color.set(ov.fadeColor); fadeQ.visible = ov.fade > 0.001;
    o.onOverlay?.({ ...ov, t });
    if (o.onSound && lastT >= 0 && t > lastT && t - lastT < 0.5) for (const s of soundsBetween(C, lastT, t)) o.onSound(s.cue, s.volume ?? 1);
    lastT = t;
    focus.x = camera.position.x; focus.z = camera.position.z;
  };
  const focus = { x: 0, y: 0, z: 0 };
  let baseExposure = def.post.exposure;

  const restyle = () => {
    def = resolveDef();
    baseExposure = def.post.exposure;
    kit.apply(def);
    root.remove(set.group); set.dispose();
    set = buildSet(T, kit, tier, script.set.location, { shirt: club.shirt, trim: club.trim, club: club.name, lamps: mood.lamps, seed: script.seed ?? 1, night: script.set.mood.includes("night") });
    root.add(set.group);
    buildProps();
    kit.stylePeople(persons());
    kit.setBurst(0); kit.setImpact(0);
  };
  kit.stylePeople(persons());

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(container);

  const duration = script.duration;
  let t = o.holdAt ?? 0, held: number | null = o.holdAt ?? null, ended = false;
  let last = performance.now();
  const draw = (tt: number) => {
    evaluate(tt);
    // shadows round the camera's subject, the sky round the camera
    const cs = cameraAt(C, tt);
    if (cs) { const an = anchors.get(cs.cur); if (an) { focus.x = an.a.pos[0]; focus.z = an.a.pos[2]; } }
    kit.update(1 / 30, camera, focus);
    set.update(tt, 1 / 30);
    kit.render(scene, camera);
    if (barTop.visible || fadeQ.visible) {
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.render(ovScene, ovCam);
      renderer.autoClear = ac;
    }
  };
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (held === null) {
      t = Math.min(duration, t + dt);
      if (t >= duration && !ended) { ended = true; o.onEnd?.(); }
    }
    draw(held ?? t);
  };
  renderer.setAnimationLoop(frame);

  const api: Director = {
    duration, script,
    time: () => held ?? t,
    playing: () => held === null && t < duration,
    seek(s) { held = clamp(s, 0, duration); },
    play() { if (held !== null) { t = held; held = null; } if (t >= duration) t = 0; ended = false; last = performance.now(); },
    pause() { held = t; },
    replay() { t = 0; held = null; ended = false; last = performance.now(); },
    skip() { t = duration; held = null; if (!ended) { ended = true; o.onEnd?.(); } },
    setStyle(id) { styleId = id; given = null; restyle(); },
    setStyleDef(d) { given = d; restyle(); },
    frameSeek(s) { renderer.setAnimationLoop(null); held = clamp(s, 0, duration); draw(held); },
    dispose() {
      ro?.disconnect();
      renderer.setAnimationLoop(null);
      fx.dispose(); people.dispose();
      for (const p of Array.from(props.values())) p.dispose();
      set.dispose(); kit.dispose();
      release(root);
      const w = window as any;
      if (w.__frameStep?.owner === api) delete w.__frameStep;
    },
  };
  // the frame-by-frame filming hook: seek(t) draws exactly that moment
  (window as any).__frameStep = { owner: api, duration, seek: (s: number) => api.frameSeek(s) };
  (window as any).__cutscene = api;
  (window as any).__cutsceneDebug = { camera, cast, props, rootAt: (id: string, t: number) => rootAt(C, id, t) };
  return api;
}
