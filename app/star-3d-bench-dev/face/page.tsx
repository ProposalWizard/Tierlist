"use client";
/**
 * THE BENCH'S FACE SHOT — one Style A head close up with its moving face
 * (lib/star/style3d/toon/face.ts), on an eight-second loop that shows each
 * thing it does: a blink, talking, eyes looking round, a smile, a sad face,
 * a frown. Frame-stepped (window.__frameStep) so stills and films are exact.
 *
 *   ?head=h1..h6|m1|m2  ?skin=tan|…  ?t=seconds (hold)
 */
import { useEffect, useRef, useState } from "react";
import { SKIN_TONES, HAIR_COLOURS } from "@/lib/star/playerIdentity";
import { setToonYou, TOON_HEADS, TOON_SUIT_HEADS, type ToonHead } from "@/lib/star/style3d/toon/bodies";

/** The loop: [from, to, what] (the bench's captions). */
const FACE_LOOP: [number, number, string][] = [
  [0, 1.2, "Calm, a blink"], [1.2, 3.4, "Talking"], [3.4, 5.0, "Looking round"], [5.0, 6.2, "A big smile"], [6.2, 7.2, "Sad"], [7.2, 8.0, "A frown"],
];
const DURATION = 8;

export default function BenchFaceShot() {
  const box = useRef<HTMLDivElement>(null);
  const [cap, setCap] = useState("");
  useEffect(() => {
    let dead = false, raf = 0;
    let dispose = () => {};
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const head = ((TOON_HEADS as readonly string[]).includes(q.get("head") ?? "") ? q.get("head") : "h1") as ToonHead;
      const skin = SKIN_TONES.find((s) => s.id === q.get("skin")) ?? SKIN_TONES[3];
      const T = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const { loadToonHead, loadPeople3d, makePerson3d, dressPerson3d, poseClips } = await import("@/lib/star/people3d");
      const { addToonFace, toonFaceFor, blinkAt, wanderGaze } = await import("@/lib/star/style3d/toon/face");
      const { numberTexture } = await import("@/lib/star/style3d/gameplay");
      const { makeStylePost } = await import("@/lib/star/style3d/post");
      const { resolveStyle } = await import("@/lib/star/style3d/styles");
      if (dead || !box.current) return;
      setToonYou({ head: TOON_SUIT_HEADS.includes(head) ? "h1" : head, skin: skin.hex, hair: HAIR_COLOURS[1].hex });
      const el = box.current;
      const renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);
      const scene = new T.Scene();
      scene.background = new T.Color("#e8c9a6");
      // the cut scenes' golden hour (style A): a warm sun, a warm sky fill
      const look = resolveStyle("golden", "cut");
      scene.add(new T.HemisphereLight(look.hemi.sky, look.hemi.ground, look.hemi.intensity));
      const sun = new T.DirectionalLight(look.sun.color, look.sun.intensity);
      sun.position.set(2.2, 3, 3.5);
      scene.add(sun);
      const loader = await withMeshopt(new GLTFLoader());
      const [g, anims] = await Promise.all([loadToonHead(loader, head), loadPeople3d(loader, "anims", "new")]);
      if (dead) { renderer.dispose(); return; }
      const SK = (SkU as unknown as { default?: unknown }).default ?? SkU;
      const p = makePerson3d(T, SK as never, g, anims, { outline: 0.006, toonHead: head, who: "bench-face", suit: TOON_SUIT_HEADS.includes(head) });
      dressPerson3d(T, p, { skin: skin.hex, hair: HAIR_COLOURS[1].hex, kit: { shirt: "#d61f26", trim: "#ffffff" }, number: numberTexture(T, 10) });
      scene.add(p.root);
      const face = addToonFace(T, p);
      const post = makeStylePost(T, renderer);
      const cam = new T.PerspectiveCamera(30, el.clientWidth / el.clientHeight, 0.05, 20);
      poseClips(p, [[p.actions.idle ? "idle" : Object.keys(p.actions)[0], 0, 1]]);
      const hp = new T.Vector3(); p.bones.Head.getWorldPosition(hp);
      const eyes = hp.y + 0.12;
      cam.position.set(0.16, eyes - 0.02, 1.55);
      cam.lookAt(0, eyes - 0.08, 0);
      const idle = p.actions.idle ? "idle" : Object.keys(p.actions)[0];
      const dur = p.actions[idle]?.getClip().duration ?? 1;
      const at = (t: number) => {
        t = ((t % DURATION) + DURATION) % DURATION;
        poseClips(p, [[idle, t % dur, 1]]);
        // what the face does when
        let w: Record<string, number> = { smile: 0.25 }, talk = 0, gaze: [number, number] = wanderGaze(t, 7);
        // blinks: the shown one at 0.55 s, natural ones while he looks round, none over the faces
        let blink = t >= 3.4 && t < 5.0 ? blinkAt(t, 3) : 0;
        if (t < 1.2) blink = t > 0.55 && t < 0.69 ? Math.sin(((t - 0.55) / 0.14) * Math.PI) : 0;
        else if (t < 3.4) { talk = 0.35 + 0.65 * Math.abs(Math.sin(t * 11.3) * Math.sin(t * 4.1 + 1)); w = { smile: 0.3 }; gaze = [0, 0]; }
        else if (t < 5.0) gaze = t < 4.0 ? [-0.9, 0.1] : t < 4.5 ? [0.9, 0.25] : [0.2, -0.6];
        else if (t < 6.2) w = { elated: 1 };
        else if (t < 7.2) w = { sad: 1 };
        else w = { angry: 1 };
        face?.set({ face: toonFaceFor(w), blink, talk, gaze });
        setCap(FACE_LOOP.find(([a, b]) => t >= a && t < b)?.[2] ?? "");
        post.render(scene, cam, { ...look.post, edge: 0, posterMix: 0.15 }, true);
      };
      const hold = q.get("t");
      let t0 = performance.now(), held: number | null = hold !== null ? Number(hold) : null;
      const frame = () => { raf = requestAnimationFrame(frame); at(held ?? (performance.now() - t0) / 1000); };
      raf = requestAnimationFrame(frame);
      (window as unknown as { __frameStep?: unknown }).__frameStep = { duration: DURATION, seek: (s: number) => { cancelAnimationFrame(raf); held = s; at(s); } };
      dispose = () => { cancelAnimationFrame(raf); face?.dispose(); post.dispose(); renderer.dispose(); renderer.domElement.remove(); void t0; t0 = 0; };
    })().catch((e) => console.error("bench face", e));
    return () => { dead = true; cancelAnimationFrame(raf); dispose(); };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }} data-bench-face>
      <div ref={box} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 28, textAlign: "center", color: "#fff", font: "700 15px system-ui", textShadow: "0 1px 3px #000" }}>{cap}</div>
    </div>
  );
}
