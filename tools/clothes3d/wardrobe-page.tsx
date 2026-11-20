"use client";
/**
 * WARDROBE PROOF PAGE (research; copy to app/star-3d-bench-dev/clothes/page.tsx to run; tools/clothes3d/shoot.mjs films it).
 * The real people system (lib/star/style3d/toon/clothes dressCloth) on one body, seven roles:
 *   ?shot=silhouettes   solid black figures, front and side (can you tell suit from hoodie from kit in black?)
 *   ?shot=wardrobe      the same in colour, full body and three-quarter upper body
 *   ?head=h6&build=c3   which body
 * window.__sheetDone is true when drawn. Nothing saves or commits.
 */
import { useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import type { PersonLook, Person3D } from "@/lib/star/people3d";
import type { ToonHead, ToonBody } from "@/lib/star/style3d/toon/bodies";
import type { ClothKind } from "@/lib/star/style3d/toon/clothes";

export default function WardrobeProofPage() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading…");
  useEffect(() => {
    const w0 = window as unknown as { __clothRun?: boolean; __sheetDone?: boolean; __clothStats?: unknown };
    if (w0.__clothRun) return;
    w0.__clothRun = true;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const shot = q.get("shot") ?? "silhouettes";
      const T = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const P3 = await import("@/lib/star/people3d");
      const PR = await import("@/lib/star/people/presets");
      const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
      const { addToonFace, toonFaceFor } = await import("@/lib/star/style3d/toon/face");
      const { applyToonFaceId } = await import("@/lib/star/style3d/toon/faceIdApply");
      const CL = await import("@/lib/star/style3d/toon/clothes");
      const { kitsOf } = await import("@/lib/star/kits");
      const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
      const L = PR.presetLook(PR.presetById("prs-reporter")!, "clothes-proof", "journalist", { exact: true });
      const head = (q.get("head") ?? L.head) as ToonHead, build = (q.get("build") ?? L.build) as ToonBody;
      const loader = await withMeshopt(new GLTFLoader());
      const anims = await P3.loadPeople3d(loader, "anims", "new");
      const all = await P3.loadPeople3d(loader, "player", "new", [head]);
      const kit = kitsOf("Liverpool").home;
      const skin = L.dress.skin, hair = L.dress.hair;
      const dark = "#7a0f1a";
      const roles: [string, ClothKind, PersonLook][] = [
        ["Press", "press", { skin, hair, suit: { coat: "#2b3346", trousers: "#2c2f36", shirt: "#cfdcec", tie: "#cfdcec", shoes: "#151515" } }],
        ["Kit man", "tracksuit", { skin, hair, kit, suit: { coat: dark, trousers: dark, shirt: dark, tie: dark, shoes: "#141416" } }],
        ["Fan", "fan", { skin, hair, kit }],
        ["Manager", "suit", { skin, hair, suit: { coat: "#2b3346", trousers: "#2b3346", shirt: "#f2f2ee", tie: "#7a1f2b", shoes: "#120f0d" } }],
        ["Coach", "polo", { skin, hair, kit }],
        ["Hoodie", "hoodie", { skin, hair, suit: { coat: "#5b6270", trousers: "#1c1e22", shirt: "#5b6270", tie: "#5b6270", shoes: "#ece9e2" } }],
        ["Player", "kit", { skin, hair, kit, accessories: [{ slot: "boots", color: "#141416" }] }],
      ];
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight("#dfe8f5", "#5d6b46", 1.25));
      const sun = new T.DirectionalLight("#fff0dc", 2.2); sun.position.set(1.5, 4, 3.5); scene.add(sun);
      setToonRim(T, { color: "#fff1dd", strength: 0.5, from: [-0.35, 0.55, -1] });
      const cam = new T.PerspectiveCamera(24, 1, 0.05, 40);
      const make = async (kind: ClothKind, look: PersonLook): Promise<Person3D> => {
        const p = P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: head, toonBody: build, who: `ward-${kind}` });
        P3.dressPerson3d(T, p, look);
        CL.dressCloth(T, p, kind, kind);
        applyToonFaceId(T, p, L.faceId, { detail: 1 });
        addToonFace(T, p)?.set({ face: toonFaceFor({}), blink: 0 });
        const clip = p.actions.idle ? "idle" : Object.keys(p.actions)[0];
        P3.poseClips(p, [[clip, 1.2, 1]]);
        p.root.updateMatrixWorld(true);
        return p;
      };
      const people: Person3D[] = [];
      for (const r of roles) people.push(await make(r[1], r[2]));
      const sheet = document.createElement("canvas"); sheet.id = "sheet";
      const g2 = sheet.getContext("2d")!;
      const draws: number[] = [], tris: number[] = [];
      const shootOne = (p: Person3D, yaw: number, w: number, h: number, pos: [number, number, number], look: [number, number, number], dx: number, dy: number) => {
        renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
        cam.position.set(...pos); cam.lookAt(...look);
        p.root.rotation.y = yaw; p.root.updateMatrixWorld(true);
        scene.add(p.root); renderer.render(scene, cam); scene.remove(p.root);
        draws.push(renderer.info.render.calls); tris.push(renderer.info.render.triangles);
        g2.drawImage(renderer.domElement, dx, dy);
      };
      const label = (s: string, x: number, y: number, w: number, dark2: boolean) => { g2.fillStyle = dark2 ? "#111" : "rgba(16,18,22,0.78)"; g2.fillRect(x, y, w, 34); g2.fillStyle = "#fff"; g2.font = "bold 20px system-ui, sans-serif"; g2.fillText(s, x + 10, y + 24, w - 16); };
      const W = 300;
      if (shot === "silhouettes") {
        const H = 700;
        sheet.width = W * roles.length; sheet.height = H * 2;
        scene.overrideMaterial = new T.MeshBasicMaterial({ color: 0x000000 });
        renderer.setClearColor("#ffffff"); renderer.toneMapping = T.NoToneMapping;
        roles.forEach((r, i) => {
          shootOne(people[i], 0, W, H, [0, 0.98, 6.6], [0, 0.93, 0], i * W, 0);
          shootOne(people[i], -Math.PI / 2, W, H, [0, 0.98, 6.6], [0, 0.93, 0], i * W, H);
          label(`${r[0]}: front / side`, i * W, 0, W, true);
        });
      } else {
        const H1 = 760, H2 = 480;
        sheet.width = W * roles.length; sheet.height = H1 + H2;
        renderer.setClearColor("#cfd6de");
        roles.forEach((r, i) => {
          shootOne(people[i], -0.25, W, H1, [0, 0.98, 6.6], [0, 0.93, 0], i * W, 0);
          shootOne(people[i], -0.7, W, H2, [0, 1.3, 2.9], [0, 1.22, 0], i * W, H1);
          label(r[0], i * W, 0, W, false);
        });
        g2.fillStyle = "#000"; g2.fillRect(0, H1 - 2, W * roles.length, 3);
      }
      for (let i = 1; i < roles.length; i++) { g2.fillStyle = "#888"; g2.fillRect(i * W - 1, 0, 2, sheet.height); }
      sheet.style.width = "100%";
      box.current!.appendChild(sheet);
      w0.__clothStats = { draws, tris, build: CL.CLOTH_BUILD_MS, fallbacks: CL.CLOTH_FALLBACKS };
      setStatus(`${shot}: draws ${draws.join("/")} tris ${tris.join("/")} build ${JSON.stringify(CL.CLOTH_BUILD_MS)} fallbacks ${JSON.stringify(CL.CLOTH_FALLBACKS)}`);
      w0.__sheetDone = true;
    })().catch((e) => { console.error(e); setStatus(`failed: ${String(e)}`); w0.__sheetDone = true; });
  }, []);
  return (
    <BroadcastPage title="Wardrobe proof" sub="The people system's real clothes, seven roles. Nothing is saved.">
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }} id="sheet-status">{status}</div>
      <div ref={box} />
      <PageGuide page="/star-3d-bench-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
