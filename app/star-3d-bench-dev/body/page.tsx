"use client";
/**
 * THE BENCH'S BODY PAGE (B5b, 20 Oct 2026; Harry: "make the bodies not look
 * badly proportioned"). One person standing on a plain floor, drawn flat
 * (an orthographic camera: no lens bulge, sizes true) at phone size, with the
 * body guide over him (lib/star/bodyGuide.ts: a real 1.86 m footballer's
 * outline and marks) and his own measures beside the guide's
 * (lib/star/bodyMeasure.ts). Frame-stepped (window.__frameStep) for clips.
 *
 *   ?kind=toon|human     the Style A body (default) or the MakeHuman body
 *   ?head=h1..h6|m1|m2   which Style A head      ?file=/star/…glb  another Style A body file
 *   ?view=front|side|34  ?pose=rest|idle|walk    ?t=seconds (hold)   ?follow=1  the camera walks with him
 *   ?guide=0             no guide                ?nums=0  no numbers
 *   ?prop=b|c            (lib/star/style3d/toon/proportions.ts)
 *   ?clip=name&ct=s&ry=deg  any clip held at a moment, him turned   ?pcam=x,y,z,lx,ly,lz,fov  a lens camera
 *   ?hs= ?ns= ?ks=       head / neck / hand scale (default: the file's own, else TOON_LOOK_DEFAULT)
 */
import { useEffect, useRef, useState } from "react";
import { SKIN_TONES, HAIR_COLOURS } from "@/lib/star/playerIdentity";
import { setToonYou, TOON_HEADS, type ToonHead } from "@/lib/star/style3d/toon/bodies";
import { guideFront, guideSide, guideMarks, guideMeasure, type BodyMeasure } from "@/lib/star/bodyGuide";

const VIEW_H = 2.12; // metres of height in view
const W = 390, H = 844;

export default function BenchBodyPage() {
  const box = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<BodyMeasure | null>(null);
  const [g, setG] = useState<BodyMeasure | null>(null);
  const [opt, setOpt] = useState({ guide: true, nums: true, view: "front", label: "" });
  const [marks, setMarks] = useState<{ y: number; label: string }[]>([]);
  useEffect(() => {
    let dead = false, raf = 0;
    let dispose = () => {};
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const kind = q.get("kind") === "human" ? "human" : "toon";
      const head = ((TOON_HEADS as readonly string[]).includes(q.get("head") ?? "") ? q.get("head") : "h1") as ToonHead;
      const file = q.get("file");
      const view = q.get("view") === "side" ? "side" : q.get("view") === "34" ? "34" : "front";
      const pose = q.get("pose") === "idle" ? "idle" : q.get("pose") === "walk" ? "walk" : "rest";
      const follow = q.get("follow") === "1";
      const hold = q.get("t") !== null ? Number(q.get("t")) : null;
      const guide = q.get("guide") !== "0", nums = q.get("nums") !== "0";
      setOpt({ guide, nums, view, label: q.get("label") ?? (kind === "human" ? "MakeHuman body" : file ? file.split("/").pop()! : `Style A ${head}`) });
      const skin = SKIN_TONES.find((s) => s.id === q.get("skin")) ?? SKIN_TONES[3];
      setToonYou({ head, skin: skin.hex, hair: HAIR_COLOURS[1].hex });
      const T = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const P3 = await import("@/lib/star/people3d");
      const { loadAnims3d, addClips } = await import("@/lib/star/three3d/footballAnims");
      const { addToonFace, toonFaceFor, blinkAt } = await import("@/lib/star/style3d/toon/face");
      const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
      const { numberTexture } = await import("@/lib/star/style3d/gameplay");
      const { measurePerson, pictureDataUrl } = await import("@/lib/star/bodyMeasure");
      const { TOON_FILES, TOON_HEADS: HEADS } = await import("@/lib/star/style3d/toon/bodies");
      if (dead || !box.current) return;
      const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
      const loader = await withMeshopt(new GLTFLoader());
      const anims = await P3.loadPeople3d(loader, "anims", "new");
      const fb = await loadAnims3d(loader as never, "football").catch(() => null);
      let p: import("@/lib/star/people3d").Person3D;
      if (kind === "human") {
        const { makeHuman, HUMAN3D_FILE } = await import("@/lib/star/human3d/human");
        const hg = (await loader.loadAsync(HUMAN3D_FILE)) as never as import("three/examples/jsm/loaders/GLTFLoader.js").GLTF;
        p = makeHuman(T, SK, { ...hg, humanWhich: "player" } as never, anims, { height: 1.86, hair: "crop", outfit: "kit" }, { outline: 0.006 });
      } else {
        let gl: import("three/examples/jsm/loaders/GLTFLoader.js").GLTF;
        if (file) {
          const one = (await loader.loadAsync(file)) as never as import("three/examples/jsm/loaders/GLTFLoader.js").GLTF;
          const set = HEADS.map((h) => (h === head ? one : undefined));
          gl = { ...one, toonBodies: set, toonWhich: "player" } as never;
        } else gl = await P3.loadToonHead(loader, head);
        void TOON_FILES;
        // ?hs= ?ns= ?ks=: the head, neck and hand scales (TOON_LOOK_DEFAULT's own dials), to judge a body file at 1
        const dial = (k: string, f: string) => (q.get(k) !== null ? { [f]: Number(q.get(k)) } : {});
        const toonLook = { ...dial("hs", "head"), ...dial("ns", "neck"), ...dial("ks", "hands") };
        p = P3.makePerson3d(T, SK, gl, anims, { outline: q.get("ol") !== null ? Number(q.get("ol")) : 0.006, toonHead: head, toonBody: (q.get("body") as never) ?? "c1", who: "bench", toonLook });
      }
      P3.dressPerson3d(T, p, { skin: skin.hex, hair: HAIR_COLOURS[1].hex, kit: { shirt: "#d61f26", trim: "#ffffff" }, number: numberTexture(T, 9) });
      if (fb) addClips(T, p, fb);
      const face = kind === "toon" ? addToonFace(T, p) : null;

      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(W, H);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setClearColor("#cfd6de");
      box.current.appendChild(renderer.domElement);
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight("#dfe8f5", "#5d6b46", 1.25));
      const sun = new T.DirectionalLight("#fff0dc", 2.2); sun.position.set(2.5, 4, 3.5); scene.add(sun);
      setToonRim(T, { color: "#fff1dd", strength: 0.5, from: [-0.35, 0.55, -1] });
      const floor = new T.Mesh(new T.PlaneGeometry(8, 8), new T.MeshStandardMaterial({ color: "#9aa49a", roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);
      scene.add(p.root);
      // the camera: flat, the whole man, his feet near the bottom
      const yaw = view === "front" ? 0 : view === "side" ? Math.PI / 2 : Math.PI / 4;
      const halfH = VIEW_H / 2, halfW = halfH * (W / H);
      const cam = new T.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 30);
      const mid = VIEW_H / 2 - 0.08;
      cam.position.set(Math.sin(yaw) * 8, mid, Math.cos(yaw) * 8);
      cam.lookAt(0, mid, 0);
      // ?pcam=x,y,z,lookX,lookY,lookZ,fov: a lens camera instead (posing him like a reference picture)
      const pc = (q.get("pcam") ?? "").split(",").filter(Boolean).map(Number);
      const pcam = pc.length >= 7 ? new T.PerspectiveCamera(pc[6], W / H, 0.05, 60) : null;
      if (pcam) { pcam.position.set(pc[0], pc[1], pc[2]); pcam.lookAt(pc[3], pc[4], pc[5]); }
      // ?clip=name&ct=seconds: hold any clip at a moment; ?ry=degrees turns him
      const clipQ = q.get("clip"), ct = Number(q.get("ct") ?? 0.5), ry = (Number(q.get("ry") ?? 0) * Math.PI) / 180;
      // the guide: drawn in the plane through him, facing the camera, on top of everything
      const guideMat = new T.LineBasicMaterial({ color: "#00d1ff", depthTest: false, transparent: true, opacity: 0.95 });
      const markMat = new T.LineBasicMaterial({ color: "#ffd400", depthTest: false, transparent: true, opacity: 0.9 });
      const right = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const toWorld = (a: number, b: number) => new T.Vector3().addScaledVector(right, a).setY(b);
      const sideDir = new T.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
      const gl3 = new T.Group(); gl3.renderOrder = 10;
      const HH = 1.86;
      const loop = (pts: [number, number][], mat: InstanceType<typeof T.LineBasicMaterial>, onSide = false) => {
        const g = new T.BufferGeometry().setFromPoints(pts.map(([a, b]) => onSide ? new T.Vector3().addScaledVector(sideDir, -a).setY(b) : toWorld(a, b)));
        const l = new T.LineLoop(g, mat); l.renderOrder = 10; gl3.add(l);
      };
      if (guide) {
        if (view === "front") { const f = guideFront(HH); loop(f.body, guideMat); loop(f.armL, guideMat); loop(f.armR, guideMat); }
        if (view === "side") loop(guideSide(HH), guideMat, true);
        for (const mk of guideMarks(HH)) {
          const g = new T.BufferGeometry().setFromPoints([toWorld(-halfW, mk.y), toWorld(-halfW + 0.12, mk.y)]);
          const l = new T.Line(g, markMat); l.renderOrder = 10; gl3.add(l);
        }
      }
      scene.add(gl3);
      setMarks(guide ? guideMarks(HH).map((mk) => ({ y: H / 2 - ((mk.y - mid) / halfH) * (H / 2), label: mk.label })) : []);

      const has = (c: string) => !!p.actions[c];
      const walkClip = ["walk", "slump_walk", "jog"].find(has) ?? null;
      const idleClip = has("idle") ? "idle" : Object.keys(p.actions)[0];
      const kitLines = (p.meta as { kit?: { shortsLoY?: number; sockY?: number } }).kit ?? null;
      const scaleY = p.root.children[0]?.scale.y ?? 1;
      const drawAt = (t: number) => {
        if (clipQ && p.actions[clipQ]) P3.poseClips(p, [[clipQ, ct + (hold === null ? t : 0), 1]]);
        else if (pose === "rest") P3.poseRest(p);
        else if (pose === "idle" || !walkClip) P3.poseClips(p, [[idleClip, 1 + t, 1]]);
        else {
          // stand 1.2 s, then walk across at the clip's own pace (1.35 m/s)
          const wk = Math.min(1, Math.max(0, (t - 1.2) / 0.35));
          const walked = Math.max(0, t - 1.2 - 0.17) * 1.35;
          P3.poseClips(p, [[idleClip, 1 + t, 1 - wk], [walkClip, (walked / 1.35) % (p.actions[walkClip].getClip().duration), wk]]);
          p.root.position.copy(sideDir.clone().multiplyScalar(follow ? walked : -0.9 + walked));
          p.root.rotation.y = yaw - Math.PI / 2 + Math.PI; // facing across the frame
          // ?follow=1: the camera travels with him (a clip of him walking, not of him leaving)
          if (follow) { cam.position.set(Math.sin(yaw) * 8, mid, Math.cos(yaw) * 8).add(p.root.position); cam.updateMatrixWorld(); }
        }
        if (pose !== "walk") { p.root.position.set(0, 0, 0); p.root.rotation.y = ry; }
        p.root.updateMatrixWorld(true);
        // a held clip that travels (knee slide, handshake step): keep his hips over the spot the camera looks at
        if (clipQ && p.bones.Hips) {
          const hp = new T.Vector3(); p.bones.Hips.getWorldPosition(hp);
          p.root.position.x -= hp.x; p.root.position.z -= hp.z; p.root.updateMatrixWorld(true);
        }
        face?.set({ face: toonFaceFor({}), blink: blinkAt(t, 3) });
        renderer.render(scene, pcam ?? cam);
      };
      drawAt(hold ?? 0);
      // the measures in the bind pose, facing +z
      const kitM = kitLines && (kitLines.shortsLoY !== undefined || kitLines.sockY !== undefined) ? { shortsLoY: (kitLines.shortsLoY ?? 0) * scaleY, sockY: (kitLines.sockY ?? 0) * scaleY } : null;
      P3.poseRest(p); p.root.position.set(0, 0, 0); p.root.rotation.y = 0; p.root.updateMatrixWorld(true);
      // the chin: the head file's own measured chin, carried by the head bone (its scale and place)
      let chinY: number | undefined;
      const fm = (p.meta as { face?: { chinY: number }; joints?: Record<string, [number, number, number]> });
      if (kind === "toon" && fm.face && fm.joints?.Head && p.bones.Head) {
        const hb = p.bones.Head; hb.updateMatrixWorld(true);
        const hw = new T.Vector3().setFromMatrixPosition(hb.matrixWorld), hs = new T.Vector3().setFromMatrixScale(hb.matrixWorld);
        // the bone's world scale carries the armature's cm → m (p.unit), the build and the head's own scale
        chinY = hw.y - (fm.joints.Head[1] - fm.face.chinY) * (hs.y / (p.unit || 0.01));
      }
      const mm = measurePerson(T, p, kitM, chinY);
      setM(mm); setG(guideMeasure(mm.height));
      (window as unknown as { __bodyMeasure?: unknown }).__bodyMeasure = { body: mm, guide: guideMeasure(mm.height) };
      drawAt(hold ?? 0);
      const w = window as unknown as { __frameStep?: unknown };
      w.__frameStep = { duration: 4, seek: (t: number) => drawAt(t) };
      const t0 = performance.now();
      const loopFn = () => { if (dead) return; if (hold === null && pose !== "rest") drawAt((performance.now() - t0) / 1000); raf = requestAnimationFrame(loopFn); };
      if (hold === null && pose !== "rest") raf = requestAnimationFrame(loopFn);
      // tools/bodies/graft.py reads the MakeHuman body through this (its rest mesh, parts and skin picture)
      (window as unknown as { __dumpBody?: () => unknown }).__dumpBody = () => {
        const g = p.body.geometry, a = (n: string) => g.getAttribute(n) as import("three").BufferAttribute | undefined;
        const mats = (Array.isArray(p.body.material) ? p.body.material : [p.body.material]) as import("three").MeshStandardMaterial[];
        const pic = (m: import("three").MeshStandardMaterial) => pictureDataUrl(m.map?.image);
        const meta = p.meta as unknown as { joints: Record<string, number[]>; human?: { parts: string[] } };
        return {
          pos: Array.from(a("position")!.array), uv: a("uv") ? Array.from(a("uv")!.array) : null,
          part: a("_part") ? Array.from(a("_part")!.array) : null, index: Array.from(g.index!.array),
          groups: g.groups.map((gr) => ({ start: gr.start, count: gr.count, mat: gr.materialIndex ?? 0 })),
          maps: mats.map(pic), parts: meta.human?.parts ?? null, joints: meta.joints,
          skinIndex: Array.from(a("skinIndex")!.array), skinWeight: Array.from(a("skinWeight")!.array),
          bones: p.body.skeleton.bones.map((b) => b.name),
          color: a("color") ? Array.from(a("color")!.array) : null,
        };
      };
      (window as unknown as { __clips?: string[] }).__clips = Object.keys(p.actions);
      // the shoulders in the pose shown (Harry, 18:35: "the shoulders always so awkwardly high"):
      // each shoulder joint's height above the neck base, and the collarbone's rise, in degrees
      drawAt(hold ?? 0);
      const wp = (n: string) => { const v = new T.Vector3(); p.bones[n]?.getWorldPosition(v); return v; };
      const shoulders = (["Left", "Right"] as const).map((s) => {
        const c = wp(s + "Shoulder"), a = wp(s + "Arm"), n = wp("neck");
        return { side: s, aboveNeckBase: +(a.y - n.y).toFixed(3), clavicleRiseDeg: +((Math.atan2(a.y - c.y, Math.hypot(a.x - c.x, a.z - c.z)) * 180) / Math.PI).toFixed(1) };
      });
      (window as unknown as { __shoulders?: unknown }).__shoulders = shoulders;
      (window as unknown as { __benchBodyReady?: boolean }).__benchBodyReady = true;
      dispose = () => { cancelAnimationFrame(raf); renderer.dispose(); renderer.domElement.remove(); };
    })().catch((e) => { console.error("bench body", e); (window as unknown as { __benchBodyError?: string }).__benchBodyError = String(e); });
    return () => { dead = true; dispose(); };
  }, []);

  const row = (label: string, k: keyof BodyMeasure, unit: "m" | "x" = "m") => {
    if (!m || !g) return null;
    const a = m[k], b = g[k];
    const off = b ? Math.abs(a - b) / b : 0;
    const col = off < 0.05 ? "#7CFF9B" : off < 0.12 ? "#FFD84D" : "#FF7A7A";
    return (
      <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <span>{label}</span><span style={{ color: col }}>{unit === "m" ? `${a.toFixed(2)} m` : a.toFixed(2)}</span><span style={{ opacity: 0.75 }}>{unit === "m" ? `${b.toFixed(2)}` : b.toFixed(2)}</span>
      </div>
    );
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b1220", overflow: "hidden" }} data-bench-body>
      <div ref={box} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
      <div style={{ position: "absolute", left: 6, top: 6, color: "#fff", font: "700 13px system-ui", textShadow: "0 1px 2px #000" }}>{opt.label} · {opt.view === "34" ? "3/4" : opt.view}</div>
      {marks.map((mk) => (
        <div key={mk.label} style={{ position: "absolute", left: 60, top: mk.y - 7, color: "#ffd400", font: "600 9px system-ui", textShadow: "0 1px 2px #000", pointerEvents: "none" }}>{mk.label}</div>
      ))}
      {opt.nums && m && (
        <div style={{ position: "absolute", right: 4, top: 26, width: 150, padding: 6, background: "rgba(0,0,0,0.62)", color: "#fff", font: "600 10px system-ui", borderRadius: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.8 }}><span>measure</span><span>body</span><span>guide</span></div>
          {row("height", "height")}{row("heads tall", "headsTall", "x")}{row("head", "headH")}{row("neck", "neck")}
          {row("shoulders", "deltoids")}{row("in heads", "headsWide", "x")}{row("chest", "chest")}{row("chest depth", "chestDepth")}{row("chest out", "chestOut")}{row("waist", "waist")}{row("hips", "hips")}
          {row("hip joint", "hipJoint")}{row("crotch", "crotch")}{row("knee", "knee")}{row("arm", "arm")}{row("fingertips", "fingertip")}
          {row("hand", "hand")}{row("foot", "foot")}{row("shorts hem", "shortsHem")}{row("sock top", "sockTop")}
        </div>
      )}
    </div>
  );
}
