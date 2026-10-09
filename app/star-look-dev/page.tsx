"use client";

/**
 * PLAYER STYLE (Style A) — the Settings "Your look" panel on a made-up player,
 * with a live 3D turntable of him in a club kit, a team-mate (seeded body) and
 * a manager in his suit. ?pstyle=old shows the same three in today's bodies.
 * Nothing is saved; your phone's Settings are not changed.
 *
 * Stills: window.__lookReady; window.__lookStats (draws and triangles per person).
 */
import { useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import YourLookPanel, { type YourLook } from "@/components/star/YourLookPanel";
import type { StarPlayer } from "@/lib/star/types";
import type { Person3D } from "@/lib/star/people3d";
import { skinToneHex, hairColourHex } from "@/lib/star/playerIdentity";
import { setToonYou, resolveToonBody } from "@/lib/star/style3d/toon/bodies";
import { previewPlayerStyleLook, usePlayerStyleLook } from "@/lib/star/style3d/toon/look";

const KIT = { shirt: "#c8102e", trim: "#ffffff" };

export default function StarLookDevPage() {
  const wrap = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState<YourLook>({ body3d: "c1", skinTone: "brown", hairColour: "black" });
  const style = usePlayerStyleLook();
  const [ready, setReady] = useState(false);
  const rebuild = useRef<(() => void) | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("pstyle");
    if (q === "old" || q === "new") previewPlayerStyleLook(q);
    const b = new URLSearchParams(window.location.search).get("body");
    if (b) setLook((l) => ({ ...l, body3d: resolveToonBody(b) }));
  }, []);

  useEffect(() => {
    setToonYou({ body: resolveToonBody(look.body3d), skin: skinToneHex(look.skinTone), hair: hairColourHex(look.hairColour) });
    rebuild.current?.();
  }, [look]);

  useEffect(() => {
    let dead = false;
    let raf = 0;
    const el = wrap.current;
    if (!el) return;
    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const { loadPeople3d, makePerson3d, dressPerson3d, poseClips } = await import("@/lib/star/people3d");
      const { numberTexture } = await import("@/lib/star/style3d/gameplay");
      if (dead) return;
      const W = el.clientWidth, H = el.clientHeight;
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      renderer.setSize(W, H);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.shadowMap.enabled = true;
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#e9c08c");
      scene.fog = new THREE.Fog("#e9c08c", 14, 30);
      // golden hour: a low warm sun and a cool sky (the scenes' own kind of light)
      scene.add(new THREE.HemisphereLight("#9db8e0", "#4a5a2a", 1.1));
      const sun = new THREE.DirectionalLight("#ffd29a", 3.0);
      sun.position.set(4, 4.5, 3);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      scene.add(sun);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ color: "#4f7a33", roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
      // ?cam=close: a close-up of your player (judge the shading and the kit)
      const close = new URLSearchParams(window.location.search).get("cam") === "close";
      camera.position.set(close ? 0.3 : 0, close ? 1.3 : 1.35, close ? 2.6 : 5.2);
      camera.lookAt(0, close ? 1.15 : 0.95, 0);
      const loader = await withMeshopt(new GLTFLoader());
      const SK = (SkeletonUtils as unknown as { default?: unknown }).default ?? SkeletonUtils;
      const [player, manager, anims] = await Promise.all([
        loadPeople3d(loader, "player", "new"), loadPeople3d(loader, "manager", "new"), loadPeople3d(loader, "anims", "new"),
      ]);
      if (dead) return;
      let people: Person3D[] = [];
      const build = () => {
        for (const p of people) scene.remove(p.root);
        people = [];
        const you = makePerson3d(THREE, SK as never, player, anims, { outline: 0.006, castShadow: true, you: true });
        dressPerson3d(THREE, you, { skin: skinToneHex(look.skinTone), hair: hairColourHex(look.hairColour), kit: KIT, number: numberTexture(THREE, 9) });
        const mate = makePerson3d(THREE, SK as never, player, anims, { outline: 0.006, castShadow: true, who: "look-dev-mate-4" });
        dressPerson3d(THREE, mate, { skin: "#eec095", hair: "#b88a4a", kit: KIT, number: numberTexture(THREE, 4) });
        const boss = makePerson3d(THREE, SK as never, manager, anims, { outline: 0.006, castShadow: true, who: "look-dev-manager" });
        dressPerson3d(THREE, boss, { skin: "#a9714b", hair: "#3a2a20", grey: 0.5 });
        you.root.position.set(0, 0, 0);
        mate.root.position.set(-1.25, 0, -0.9); mate.root.rotation.y = Math.PI;
        boss.root.position.set(1.3, 0, -0.8); boss.root.rotation.y = -0.4;
        for (const p of [you, mate, boss]) { poseClips(p, [["idle", 0.4, 1]]); scene.add(p.root); }
        people = [you, mate, boss];
      };
      const measure = () => {
        // one person alone: draws and triangles (shadow pass included when it casts)
        const keep = people.map((p) => p.root.visible);
        people.forEach((p, i) => { p.root.visible = i === 0; });
        ground.visible = false;
        renderer.info.reset(); renderer.info.autoReset = false;
        renderer.render(scene, camera);
        const s = { draws: renderer.info.render.calls, triangles: renderer.info.render.triangles };
        renderer.info.autoReset = true;
        people.forEach((p, i) => { p.root.visible = keep[i]; });
        ground.visible = true;
        return s;
      };
      rebuild.current = () => { build(); (window as unknown as { __lookStats?: unknown }).__lookStats = measure(); };
      rebuild.current();
      let t0 = performance.now();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const t = (performance.now() - t0) / 1000;
        if (people[0]) people[0].root.rotation.y = Math.sin(t * 0.5) * 0.6;
        renderer.render(scene, camera);
      };
      renderer.render(scene, camera);
      (window as unknown as { __lookReady?: boolean }).__lookReady = true;
      setReady(true);
      if (!new URLSearchParams(window.location.search).get("still")) loop();
      t0 = performance.now();
    })();
    return () => { dead = true; cancelAnimationFrame(raf); el.innerHTML = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  const player = { skinTone: look.skinTone ?? "tan", hairColour: look.hairColour, body3d: look.body3d } as StarPlayer;
  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      <div className="px-3 pt-3 text-sm font-black">Player style: {style === "new" ? "New (Style A)" : "Old"}</div>
      <div ref={wrap} className="relative mx-3 mt-2 h-[52vh] overflow-hidden rounded-xl" data-look-ready={ready ? "1" : "0"} />
      <div className="mx-3 my-3 rounded-xl bg-white/5 p-3">
        <div className="text-[13px] font-black">Your look</div>
        <YourLookPanel player={player} onChange={(l) => setLook((o) => ({ ...o, ...l }))} />
      </div>
      <PageGuide page="/star-look-dev" corner="bottom-left" />
    </div>
  );
}
