"use client";
/**
 * THE BENCH'S WEARABLES SHEET (Harry, 28 Nov 2026: "buying boots/accessories needs to translate onto your guy").
 * Your player as the house dresses him (lib/star/home3d/wear.ts buildWearer: the cloth outfit, then the watch,
 * chain and the rest, lib/star/style3d/toon/accessories.ts), one card per outfit × build × view, to check by eye
 * that nothing passes through the body or the cloth. Nothing here is saved.
 *
 *   ?outfits=hoodie,tee,shirt,tracksuit,coat,designer,kit   the outfits (rows)
 *   ?builds=c1,c2,c3   ?head=h1..h6                           the builds (columns), your head
 *   ?views=full,neck,neckback,wrist,head,face                  each card's framing (columns within a build)
 *   ?yaw=0.5           ?pose=idle&t=1.2 (a clip moment; absent: the bind pose)
 *   ?wear=gold-l4,silver-l5,shades-l3,cap-l3                   what he wears (shop base id + level; shades and cap are unsold designs)
 *   ?cols=6 ?w=240 ?h=320
 * window.__sheetDone is true when every card is drawn; window.__wearStats has draws and triangles per person.
 */
import { useEffect, useRef, useState } from "react";

export default function WearablesBench() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading…");
  useEffect(() => {
    let dead = false;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      (globalThis as { __noSquash?: boolean }).__noSquash = q.get("squash") === "0";
      (globalThis as { __accDebug?: boolean }).__accDebug = !!q.get("debug");
      const T = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const { buildWearer } = await import("@/lib/star/home3d/wear");
      const { CASUAL_SETS, designerSet } = await import("@/lib/star/home3d/outfits");
      const { accessoryLook, bootLookOf } = await import("@/lib/star/wearables");
      const { setToonYou } = await import("@/lib/star/style3d/toon/bodies");
      const { kitsOf } = await import("@/lib/star/kits");
      const { poseClips, poseRest } = await import("@/lib/star/people3d");
      const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
      const outfits = (q.get("outfits") ?? "hoodie,tee,suit").split(",");
      const builds = (q.get("builds") ?? "c1,c2,c3").split(",");
      const views = (q.get("views") ?? "full,neck,wrist,head").split(",");
      const head = q.get("head") ?? "h2";
      const yaw = Number(q.get("yaw") ?? 0.45);
      const W = Number(q.get("w") ?? 240), H = Number(q.get("h") ?? 320);
      const cols = Number(q.get("cols") ?? builds.length * views.length);
      const extras = (q.get("wear") ?? "gold-l4,silver-l5,shades-l3,cap-l3").split(",").filter(Boolean).map((x) => {
        const m = /^([a-z-]+?)(?:-l([1-5]))?$/.exec(x);
        return m ? accessoryLook(m[1], Number(m[2] ?? 3)) : null;
      }).filter((x): x is NonNullable<typeof x> => !!x);
      const loader = await withMeshopt(new GLTFLoader());
      const kits = { home: kitsOf("Arsenal").home, away: kitsOf("Arsenal").away };
      const cards: { label: string; outfit: string; build: string; view: string }[] = [];
      for (const o of outfits) for (const b of builds) for (const v of views) cards.push({ label: `${o} · ${b} · ${v}`, outfit: o, build: b, view: v });
      const rows = Math.ceil(cards.length / cols);
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W * cols, H * rows);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setScissorTest(true);
      box.current?.querySelectorAll("canvas").forEach((c) => c.remove());
      box.current?.appendChild(renderer.domElement);
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight("#dfe8f5", "#5a5244", 1.25));
      const sun = new T.DirectionalLight("#fff1dd", 2.3); sun.position.set(2.5, 4, 4); scene.add(sun);
      setToonRim(T, { color: "#fff1dd", strength: 0.5, from: [-0.35, 0.55, -1] });
      const stats: Record<string, { draws: number; tris: number; accTris: number }> = {};
      const people: { p: Awaited<ReturnType<typeof buildWearer>>; at: number }[] = [];
      const byKey = new Map<string, number>();
      for (const c of cards) {
        const key = `${c.outfit}|${c.build}`;
        if (byKey.has(key)) continue;
        setStatus(`dressing ${key}…`);
        setToonYou({ head: head as never, body: c.build as never, name: "Player" });
        const set = c.outfit === "designer" ? designerSet(5) : CASUAL_SETS.find((s) => s.id === c.outfit);
        const worn = c.outfit === "kit" || !set
          ? { kind: "kit" as const, kit: "home" as const, boots: "#141416", bootLook: bootLookOf({ id: "maestro-l4" } as never), extras }
          : { kind: "casual" as const, set, extras };
        const p = await buildWearer(T, SkU, loader, { worn, kits, number: null, skin: "#c68642", hair: "#2b1b12", outline: 0.006, castShadow: false });
        if (dead) return;
        const at = people.length * 3;
        p.root.position.set(at, 0, 0);
        p.root.rotation.y = yaw;
        scene.add(p.root);
        if (q.get("pose") && p.actions[q.get("pose")!]) poseClips(p, [[q.get("pose")!, Number(q.get("t") ?? 1), 1]]);
        else if (q.get("bind") === "1") { p.mixer.stopAllAction(); poseRest(p); }
        else { p.mixer.update(0); }
        if (q.get("nobody") === "1") { p.body.visible = false; p.outline.visible = false; }
        p.root.updateMatrixWorld(true);
        byKey.set(key, people.length);
        people.push({ p, at });
        let draws = 0, tris = 0, accTris = 0;
        p.root.traverse((o) => {
          const m = o as import("three").Mesh;
          if (!m.isMesh || !m.visible) return;
          draws++;
          const g = m.geometry, n = g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
          tris += n; if (m.name === "Accessories") accTris += n;
        });
        const accM = p.body.parent?.children.find((o) => o.name === "Accessories");
        stats[key] = { draws, tris: Math.round(tris), accTris: Math.round(accTris), kinds: (accM?.userData.kinds ?? []).join("+") } as never;
        if (q.get("debug") === "front") {
          // the front-most point of the body and of the accessories in bands of height over the brow, along his facing
          const acc = p.body.parent?.children.find((o) => o.name === "Accessories") as import("three").SkinnedMesh | undefined;
          const hb = new T.Vector3(); p.bones.Head.getWorldPosition(hb);
          const fwd = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), side = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
          const scan = (m: import("three").SkinnedMesh) => {
            const out: number[] = new Array(8).fill(-9);
            const pv = new T.Vector3();
            const n = m.geometry.getAttribute("position").count;
            for (let i = 0; i < n; i++) {
              m.getVertexPosition(i, pv); pv.applyMatrix4(m.matrixWorld);
              const dy = pv.y - hb.y, dx = pv.clone().sub(hb).dot(side);
              if (Math.abs(dx) < 0.012 || Math.abs(dx) > 0.07 || dy < -0.04 || dy >= 0.04) continue;
              const k = Math.floor((dy + 0.04) / 0.01);
              out[k] = Math.max(out[k], pv.clone().sub(hb).dot(fwd));
            }
            return out.map((v) => +v.toFixed(4));
          };
          console.log("[wear-debug] front body", JSON.stringify(scan(p.body)), "acc", acc ? JSON.stringify(scan(acc)) : "-");
        }
        if (q.get("debug") === "1") {
          const acc = p.body.parent?.children.find((o) => o.name === "Accessories") as import("three").Mesh | undefined;
          acc?.geometry.computeBoundingBox(); p.body.geometry.computeBoundingBox();
          console.log("[wear-debug]", key, JSON.stringify({ squashed: p.body.geometry.userData?.squashed, left: p.body.geometry.userData?.squashLeft, posType: p.body.geometry.getAttribute("position").array.constructor.name, normalized: (p.body.geometry.getAttribute("position") as import("three").BufferAttribute).normalized, children: p.body.parent?.children.map((o) => o.name), acc: acc?.geometry.boundingBox, body: p.body.geometry.boundingBox, bodyMW: p.body.matrixWorld.elements.map((x) => +x.toFixed(3)), parent: acc?.parent?.name, accVisible: acc?.visible }));
        }
      }
      (window as unknown as { __wearStats?: unknown }).__wearStats = stats;
      const cam = new T.PerspectiveCamera(30, W / H, 0.02, 30);
      const v = new T.Vector3();
      const bw = (p: (typeof people)[number]["p"], n: string) => { p.bones[n]?.getWorldPosition(v); return v.clone(); };
      cards.forEach((c, i) => {
        const { p, at } = people[byKey.get(`${c.outfit}|${c.build}`)!];
        const vw = c.view;
        // head close-ups all round (the cap and the sunglasses from every side): hfront, h34, hside, hback, htop
        const HEAD_AROUND: Record<string, [number, number]> = { hfront: [0, 0.02], h34: [0.8, 0.04], hside: [Math.PI / 2, 0.03], hback: [Math.PI * 0.8, 0.05], htop: [0.5, 0.35] };
        if (HEAD_AROUND[vw]) {
          const [da, up] = HEAD_AROUND[vw];
          const t = bw(p, "Head").add(new T.Vector3(0, 0.05, 0));
          cam.position.set(t.x + Math.sin(yaw + da) * 0.62, t.y + up, t.z + Math.cos(yaw + da) * 0.62);
          cam.lookAt(t);
          const x = (i % cols) * W, y = (rows - 1 - Math.floor(i / cols)) * H;
          renderer.setViewport(x, y, W, H); renderer.setScissor(x, y, W, H);
          renderer.setClearColor(i % 2 ? "#cfd6de" : "#c6ced8");
          renderer.clear();
          renderer.render(scene, cam);
          return;
        }
        const target = vw === "neckback" ? bw(p, "neck").add(new T.Vector3(0, -0.04, 0)) : vw === "face" ? bw(p, "Head").add(new T.Vector3(0, 0.05, 0)) : c.view === "neck" ? bw(p, "neck").add(new T.Vector3(0, -0.06, 0)) : c.view === "wrist" ? bw(p, "LeftHand").lerp(bw(p, "LeftForeArm"), 0.2) : c.view === "head" ? bw(p, "Head").add(new T.Vector3(0, 0.06, 0)) : new T.Vector3(at, 0.92, 0);
        const dist = vw === "neckback" ? 0.75 : vw === "face" ? 0.9 : c.view === "neck" ? 0.75 : c.view === "wrist" ? 0.42 : c.view === "head" ? 0.9 : 4.4;
        // full: from the front-quarter; close-ups: from his left (the watch) or the front
        const a = vw === "neckback" ? yaw + Math.PI + 0.4 : vw === "face" ? yaw : c.view === "wrist" ? yaw + 1.2 : c.view === "head" ? yaw + 1.1 : yaw;
        cam.position.set(target.x + Math.sin(a) * dist, target.y + (c.view === "full" ? 0.1 : 0.05), target.z + Math.cos(a) * dist);
        cam.lookAt(target);
        const x = (i % cols) * W, y = (rows - 1 - Math.floor(i / cols)) * H;
        renderer.setViewport(x, y, W, H); renderer.setScissor(x, y, W, H);
        renderer.setClearColor(i % 2 ? "#cfd6de" : "#c6ced8");
        renderer.clear();
        renderer.render(scene, cam);
      });
      // labels
      const host = box.current!;
      host.querySelectorAll("[data-card-label]").forEach((e) => e.remove());
      cards.forEach((c, i) => {
        const d = document.createElement("div");
        d.dataset.cardLabel = "1";
        d.textContent = c.label;
        Object.assign(d.style, { position: "absolute", left: `${(i % cols) * W + 6}px`, top: `${Math.floor(i / cols) * H + 4}px`, font: "700 11px system-ui", color: "#1f2430", background: "rgba(255,255,255,.7)", padding: "1px 5px", borderRadius: "6px" });
        host.appendChild(d);
      });
      setStatus(`${cards.length} cards · ${Object.entries(stats).map(([k, s]) => `${k}: ${s.draws} draws, ${s.tris} tris (accessories ${s.accTris}: ${(s as { kinds?: string }).kinds})`).join(" · ")}`);
      (window as unknown as { __sheetDone?: boolean }).__sheetDone = true;
    })().catch((e) => { console.error(e); setStatus(`failed: ${String(e)}`); });
    return () => { dead = true; };
  }, []);
  return (
    <div style={{ background: "#11151c", minHeight: "100vh", color: "#e8ecf2", padding: 8 }}>
      <div style={{ font: "600 12px system-ui", marginBottom: 6 }} data-wear-status>{status}</div>
      <div ref={box} style={{ position: "relative" }} />
    </div>
  );
}
