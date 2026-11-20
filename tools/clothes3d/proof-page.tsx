"use client";
/**
 * CLOTHES PROOF PAGE: copy to app/star-3d-bench-dev/clothes/page.tsx (with ./clothes.ts) to run it; node tools/clothes3d/shoot.mjs OUTDIR <shots> films it.
 * (research, 20 Nov 2026; docs/research/clothes-and-necks-2026-11-20.md). The same body dressed
 * today's way (painted by masks, left / top) and as real cloth (right / bottom, ./clothes.ts), same camera and light.
 *   ?shot=kit-front | kit-side | kit-back | jumper-front | jumper-34 | neck-kit | neck-jumper | edges | patterns
 *   ?kit=liverpool | argentina | austria | samoa (a real nation kit from lib/star/data/nationKits.ts)
 * window.__sheetDone is true when drawn. Nothing here is in the game; nothing saves or commits.
 */
import { useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import type { PersonLook, Person3D } from "@/lib/star/people3d";
import type { ToonHead, ToonBody } from "@/lib/star/style3d/toon/bodies";

type V3 = [number, number, number];
/** The wardrobe by role: a player in kit; press (shirt, trousers, lanyard); kit man (club training jacket + track trousers); fan (replica shirt, jeans, scarf); jumper (smart staff). */
type Outfit = "kit" | "jumper" | "press" | "kitman" | "fan" | "suit" | "polo";
const SHOES: Record<Outfit, string> = { kit: "#141416", jumper: "#2a1d14", press: "#151515", kitman: "#141416", fan: "#ece9e2", suit: "#120f0d", polo: "#3b2a1e" };
interface Kit { shirt: string; trim: string; shorts: string; socks: string; sleeves?: string; words?: string; name: string }

export default function ClothesProofPage() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading…");
  useEffect(() => {
    const w0 = window as unknown as { __clothRun?: boolean; __sheetDone?: boolean; __clothStats?: unknown };
    if (w0.__clothRun) return;           // a dev build runs effects twice: draw once
    w0.__clothRun = true;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const shot = q.get("shot") ?? "kit-front";
      const T = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const P3 = await import("@/lib/star/people3d");
      const PR = await import("@/lib/star/people/presets");
      const HAIR = await import("@/lib/star/style3d/toon/hair");
      const { applyToonFaceId } = await import("@/lib/star/style3d/toon/faceIdApply");
      const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
      const { addToonFace, toonFaceFor } = await import("@/lib/star/style3d/toon/face");
      const { parseKitPattern } = await import("@/lib/star/style3d/toon/kitPattern");
      const { kitsOf } = await import("@/lib/star/kits");
      const { NATION_KIT_PROFILES } = await import("@/lib/star/data/nationKits");
      const C = await import("./clothes");
      const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
      const preset = PR.presetById("prs-reporter")!;
      const L = PR.presetLook(preset, "clothes-proof", "journalist", { exact: true });
      const head = (q.get("head") ?? L.head) as ToonHead, build = (q.get("build") ?? L.build) as ToonBody;
      const loader = await withMeshopt(new GLTFLoader());
      const anims = await P3.loadPeople3d(loader, "anims", "new");
      const all = await P3.loadPeople3d(loader, "player", "new", [head]);

      // kits: one club, three real nation kits (the data drives the clothes, nothing re-authored)
      const nation = (n: string, which: "homeKit" | "awayKit"): Kit => {
        const k = NATION_KIT_PROFILES[n][which];
        return { name: `${n} ${which === "homeKit" ? "home" : "away"}`, shirt: k.shirtHex!, trim: k.trimHex!, shorts: k.shortsHex ?? k.trimHex!, socks: k.socksHex ?? k.shirtHex!, sleeves: k.sleevesHex, words: k.pattern };
      };
      const lfc = kitsOf("Liverpool").home;
      const KITS: Record<string, () => Kit> = {
        liverpool: () => ({ name: "Liverpool home", shirt: lfc.shirt, trim: lfc.trim, shorts: (lfc as { shorts?: string }).shorts ?? lfc.trim, socks: (lfc as { socks?: string }).socks ?? lfc.shirt }),
        argentina: () => nation("Argentina", "homeKit"),
        austria: () => nation("Austria", "homeKit"),
        samoa: () => nation("American Samoa", "awayKit"),
      };

      const W = 780, H = 1688;
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W, H);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setClearColor("#cfd6de");
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight("#dfe8f5", "#5d6b46", 1.25));
      const sun = new T.DirectionalLight("#fff0dc", 2.2); sun.position.set(1.5, 4, 3.5); scene.add(sun);
      setToonRim(T, { color: "#fff1dd", strength: 0.5, from: [-0.35, 0.55, -1] });
      const cam = new T.PerspectiveCamera(24, W / H, 0.05, 40);

      const suitLook = L.dress.suit ?? { coat: "#2f4f86", trousers: "#3a3d44", shirt: "#f4f4f2", tie: "#f4f4f2" };
      const jumperCol = q.get("jumper") ?? "#2d4f8e";
      const stats: Record<string, number>[] = [];

      const make = async (after: boolean, outfit: Outfit, kit: Kit): Promise<Person3D> => {
        const p = P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: head, toonBody: build, who: "clothes-proof" });
        const skin = L.dress.skin;
        const pat = kit.words ? parseKitPattern(kit.words, kit.shirt, kit.trim) : null;
        const look: PersonLook = outfit === "jumper"
          ? { ...L.dress, suit: { ...suitLook, coat: jumperCol } }
          : { skin, hair: L.dress.hair, hairCut: L.dress.hairCut, kit: { shirt: kit.shirt, trim: kit.trim, shorts: kit.shorts, socks: kit.socks, pattern: pat }, accessories: [{ slot: "boots", color: "#141416" }] };
        if (after) {
          // the body under the cloth is deleted; whatever painted kit is left showing is skin, boots stay boots
          look.suit = undefined;
          look.kit = { shirt: skin, trim: skin, shorts: skin, socks: skin, pattern: null };
          look.accessories = [{ slot: "boots", color: SHOES[outfit] }];
        }
        P3.dressPerson3d(T, p, look);
        if (after) for (const k of ["uBadgeOn", "uNumOn", "uNameOn"]) if (p.u[k]) (p.u[k] as { value: number }).value = 0;
        if (after && p.u.uFrontNum) (p.u.uFrontNum as { value: import("three").Vector4 }).value.w = 0;
        applyToonFaceId(T, p, L.faceId, { detail: 1 });
        addToonFace(T, p)?.set({ face: toonFaceFor({}), blink: 0 });
        if (L.hairMesh) await HAIR.wearToonHair(T, loader, p, L.hairMesh, { outline: 0.0045 });
        if (after) {
          dressReal(p, outfit, kit, pat);
          // what is left of the painted kit above the boots is skin of the body's own even tone (no other tone under a hem)
          const mat = p.body.material as import("three").Material;
          const prev = mat.onBeforeCompile.bind(mat);
          mat.onBeforeCompile = (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace("float tnCollar = 0.0", "if (r.y > uLines.z + 0.012 && kit > 0.02) { c = mix(c, uSkinAvg, kit); diffuseColor.rgb = c; skin = min(1.0, skin + kit); kit = 0.0; }\n  float tnCollar = 0.0"); };
          const key = mat.customProgramCacheKey.bind(mat);
          mat.customProgramCacheKey = () => `${key()}-clothes-skin`;
          mat.needsUpdate = true;
        }
        const clip = p.actions.idle ? "idle" : Object.keys(p.actions)[0];
        P3.poseClips(p, [[clip, 1.2, 1]]);
        p.root.updateMatrixWorld(true);
        return p;
      };

      // ── the real clothes: every edge is a cut at a named landmark of this body's own rest pose ──
      const dressReal = (p: Person3D, outfit: Outfit, kit: Kit, pat: ReturnType<typeof parseKitPattern>) => {
        const m = p.meta, j = (n: string) => (m.joints[n] ?? [0, 0, 0]) as V3;
        const rig = C.rigOf(T, p.body, m.joints as Record<string, V3>);
        const neck = j("neck"), hips = j("Hips"), sh = j("LeftArm");
        const mk = m.kit as typeof m.kit & { collarY?: number; shortsLoY?: number; sleeveT?: number };
        const collarY = mk.collarY ?? neck[1] - 0.03;
        const upperArm = Math.hypot(...([0, 1, 2].map((k) => j("LeftForeArm")[k] - sh[k]) as V3));
        // LANDMARKS (rest metres): the cut lines, the same on every head and build
        const LM = {
          sleeveShort: (mk.sleeveT ?? 0.62) + 0.04,          // along the upper arm, 0 shoulder → 1 elbow
          wrist: 1.86,                                        // along the arm, 1 elbow → 2 wrist
          hem: hips[1] - 0.025,                               // jumper hem
          tuck: hips[1] + 0.035 - 0.02,                       // a kit shirt tucks 2 cm under the shorts' waistband
          waist: hips[1] + 0.035,                             // shorts / trouser waist
          shortsEnd: (mk.shortsLoY ?? 0.65) - 0.015,          // mid-thigh
          sockTop: m.kit.sockY + 0.02,                        // below the knee
          sockEnd: m.kit.bootY + 0.006,                       // into the boot
          ankle: m.kit.bootY + 0.03,
          seamX: Math.abs(sh[0]) - 0.035,                     // the shoulder seam (armhole), across
        };
        // the neck opening: a ring round the neck's base (an ellipse, wider at the front), a low line lower at the front,
        // never above the collar line; optionally a V cut. Negative = cloth. Metres, so bands are true widths.
        const neckRing = (pt: import("three").Vector3, rx: number, rzB: number, rzF: number, lift: number, vDepth = 0, vW = 0.07) => {
          const dx = pt.x - neck[0], dz = pt.z - (neck[2] + 0.012);
          const e = Math.hypot(dx / rx, dz / (dz > 0 ? rzF : rzB));
          const ring = (1 - e) * Math.min(rx, rzB);
          const front0 = Math.max(0, Math.min(1, (pt.z - neck[2]) / 0.06));
          const yLow = collarY + lift - 0.035 * front0;
          const top = collarY - 0.004;
          let f = Math.max(Math.min(ring, pt.y - yLow), pt.y - top);
          if (vDepth > 0) {
            const front = Math.max(0, Math.min(1, (pt.z - neck[2]) / 0.05));
            const yV = top - vDepth * front * Math.max(0, 1 - Math.abs(dx) / vW);
            f = Math.max(f, (pt.y - yV) * 0.7);
          }
          return f;
        };
        const fabric = (o: Parameters<typeof C.fabricMaterial>[1]) => C.fabricMaterial(T, o);
        const garments: import("./clothes").GarmentSpec[] = [];
        const chestY = sh[1] - 0.09;
        const NONE = -1;
        if (outfit === "kit") {
          const crest = C.crestTexture(T, kit.trim, kit.shirt, "KB");
          const num = C.numberTexture(T, "9", kit.trim === kit.shirt ? "#ffffff" : kit.trim, kit.shirt);
          const word = C.wordTexture(T, "KNOWITBALL", pat && pat.kind !== "sleeves" ? "#16203a" : kit.trim === kit.shirt ? "#ffffff" : kit.trim);
          const sleeveCol = pat?.kind === "sleeves" ? pat.colour : kit.sleeves && kit.sleeves !== kit.shirt ? kit.sleeves : null;
          const torsoFields = (pt: import("three").Vector3, arm: number, armS: number) => ({
            neck: neckRing(pt, 0.075, 0.066, 0.095, -0.028),
            sleeve: arm > 0.5 ? (armS - LM.sleeveShort) * upperArm : NONE,
            hem: arm > 0.5 ? NONE : LM.tuck - pt.y,
            leg: NONE,
          });
          const torsoPat = pat && (pat.kind === "stripes" || pat.kind === "hoops") ? { kind: pat.kind, color: pat.colour, width: pat.kind === "stripes" ? 0.045 : 0.05, centre: chestY } : undefined;
          if (sleeveCol) {
            // contrast sleeves: two pieces cut on ONE seam (the armhole), two materials: a mesh edge, not a painted line
            garments.push({ name: "shirt", offset: 0.007, lip: 0.004, collar: { h: 0.016, out: 0.010, color: kit.trim },
              fields: (pt, arm, armS) => ({ ...torsoFields(pt, arm, armS), cut: Math.abs(pt.x) - LM.seamX }),
              material: fabric({ kind: "poly", color: kit.shirt, trim: kit.trim, bands: [0.012, 0, 0, 0], pattern: torsoPat,
                crest: { tex: crest, at: [0.085, chestY, 0], size: 0.075 }, number: { tex: num, at: [0, chestY - 0.04, 0], size: 0.24 },
                front: { tex: word, at: [0, chestY - 0.085, 0], size: [0.24, 0.06] } }) });
            garments.push({ name: "sleeves", offset: 0.007, lip: 0.004,
              fields: (pt, arm, armS) => ({ ...torsoFields(pt, arm, armS), cut: LM.seamX - Math.abs(pt.x) }),
              material: fabric({ kind: "poly", color: sleeveCol, trim: kit.shirt === sleeveCol ? kit.trim : kit.shirt, bands: [0, 0.016, 0, 0] }) });
          } else {
            garments.push({ name: "shirt", offset: 0.007, lip: 0.004, collar: { h: 0.016, out: 0.010, color: kit.trim },
              fields: torsoFields,
              material: fabric({ kind: "poly", color: kit.shirt, trim: kit.trim, bands: [0.012, 0.016, 0, 0], pattern: torsoPat,
                crest: { tex: crest, at: [0.085, chestY, 0], size: 0.075 }, number: { tex: num, at: [0, chestY - 0.04, 0], size: 0.24 },
                front: { tex: word, at: [0, chestY - 0.085, 0], size: [0.24, 0.06] } }) });
          }
          garments.push({ name: "shorts", offset: 0.014, lip: 0.005,
            fields: (pt, arm, _a, leg) => ({ neck: arm > 0.5 ? 1 : pt.y - LM.waist, sleeve: NONE, hem: NONE, leg: leg > 0.35 ? LM.shortsEnd - pt.y : NONE }),
            material: fabric({ kind: "poly", color: kit.shorts, trim: "#" + new T.Color(kit.shorts).multiplyScalar(0.82).getHexString(), bands: [0.03, 0, 0, 0] }) });
          garments.push({ name: "socks", offset: 0.004, lip: 0.003,
            fields: (pt, arm, _a, leg) => (leg > 0.5 && arm < 0.5 ? { neck: pt.y - LM.sockTop, sleeve: NONE, hem: LM.sockEnd - pt.y, leg: NONE } : { neck: 1, sleeve: 1, hem: 1, leg: 1 }),
            material: fabric({ kind: "cotton", color: kit.socks, trim: kit.socks === kit.trim ? kit.shirt : kit.trim, bands: [0.022, 0, 0, 0] }), relax: [2, 8] });
        } else if (outfit === "press" || outfit === "kitman" || outfit === "fan") {
          const trousersOf = (name: string, color: string, kind: "cotton" | "poly", waist: number, fold = 0) => garments.push({ name, offset: 0.009, lip: 0.004,
            fields: (pt, arm, _a, leg) => ({ neck: arm > 0.5 ? 1 : pt.y - waist, sleeve: NONE, hem: NONE, leg: leg > 0.35 ? LM.ankle + fold - pt.y : NONE }),
            material: fabric({ kind, color, trim: "#" + new T.Color(color).multiplyScalar(0.8).getHexString(), bands: [0.028, 0, 0, fold ? 0.03 : 0] }), relax: [4, 10], tube: true });
          // shoes: their own piece over the foot, cut at the ankle, a sole band at the ground
          const shoesOf = (color: string, sole: string) => garments.push({ name: "shoes", offset: 0.005, lip: 0.003,
            fields: (pt, arm, _a, leg) => (leg > 0.5 && arm < 0.5 ? { neck: pt.y - (m.kit.bootY + 0.004), sleeve: NONE, hem: NONE, leg: -pt.y - 0.001 } : { neck: 1, sleeve: 1, hem: 1, leg: 1 }),
            material: fabric({ kind: "cotton", color, trim: sole, bands: [0, 0, 0, 0.016] }), relax: [2, 6] });
          shoesOf(SHOES[outfit], outfit === "fan" ? "#bdb7ab" : "#2b2622");
          if (outfit === "press") {
            // a pale shirt with a folded collar, long sleeves, tucked in; charcoal trousers; a lanyard and press pass
            const shirtC = "#cfdcec";
            garments.push({ name: "shirt", offset: 0.006, lip: 0.003, collar: { kind: "shirt", h: 0.022, out: 0.006, fold: 0.014 },
              fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.07, 0.062, 0.08, -0.012), sleeve: arm > 0.5 ? (armS - LM.wrist) * upperArm : NONE, hem: arm > 0.5 ? NONE : LM.tuck - pt.y, leg: NONE }),
              material: fabric({ kind: "cotton", color: shirtC, trim: "#" + new T.Color(shirtC).multiplyScalar(0.85).getHexString(), bands: [0, 0.03, 0, 0],
                front: { tex: C.lanyardTexture(T, "#1d3f8f", "PRESS"), at: [0, chestY - 0.035, 0], size: [0.17, 0.26] } }), relax: [2, 8] });
            trousersOf("trousers", "#3a3d44", "cotton", LM.waist + 0.01);
          } else if (outfit === "kitman") {
            // the club's training jacket: dark club colour, club trim on the stand collar, cuffs and zip; track trousers
            const body = "#" + new T.Color(kit.shirt).multiplyScalar(kit.shirt.toLowerCase() === "#ffffff" ? 0.25 : 0.42).getHexString();
            garments.push({ name: "jacket", offset: 0.013, lip: 0.005, collar: { h: 0.028, out: 0.003, color: kit.trim },
              fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.074, 0.064, 0.085, -0.016), sleeve: arm > 0.5 ? (armS - LM.wrist) * upperArm : NONE, hem: arm > 0.5 ? NONE : LM.hem - pt.y, leg: NONE }),
              material: fabric({ kind: "poly", color: body, trim: kit.shirt, bands: [0, 0.035, 0.03, 0],
                crest: { tex: C.crestTexture(T, kit.trim, kit.shirt, "KB"), at: [0.085, chestY, 0], size: 0.065 },
                front: { tex: C.zipTexture(T, kit.trim), at: [0, (collarY + LM.hem) / 2, 0], size: [0.03, collarY - LM.hem] } }), relax: [3, 10] });
            trousersOf("trousers", body, "poly", LM.waist + 0.01, 0.0);
          } else {
            // a fan: the replica shirt (no number on the front) worn loose over jeans; a club scarf; trainers
            garments.push({ name: "shirt", offset: 0.013, lip: 0.004, collar: { h: 0.016, out: 0.010, color: kit.trim },
              fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.075, 0.066, 0.095, -0.028), sleeve: arm > 0.5 ? (armS - LM.sleeveShort - 0.08) * upperArm : NONE, hem: arm > 0.5 ? NONE : LM.hem - 0.02 - pt.y, leg: NONE }),
              material: fabric({ kind: "poly", color: kit.shirt, trim: kit.trim, bands: [0.012, 0.016, 0, 0], crest: { tex: C.crestTexture(T, kit.trim, kit.shirt, "KB"), at: [0.085, chestY, 0], size: 0.075 } }) });
            trousersOf("jeans", "#3d5a80", "cotton", LM.waist + 0.005);
            // the scarf: a thick ring round the neck's base, hooped in club colours
            garments.push({ name: "scarf", offset: 0.03, lip: 0.012,
              fields: (pt, arm) => {
                if (arm > 0.3) return { neck: 1, sleeve: 1, hem: 1, leg: 1 };
                const r = Math.hypot(pt.x - neck[0], pt.z - neck[2]);
                return { neck: pt.y - (collarY + 0.012), sleeve: NONE, hem: (collarY - 0.045) - pt.y, leg: NONE, cut: r - 0.115 };
              },
              material: fabric({ kind: "wool", color: kit.shirt, trim: kit.shirt, pattern: { kind: "hoops", color: kit.trim, width: 0.012, centre: collarY } }), relax: [4, 10] });
          }
        } else if (outfit === "suit" || outfit === "polo") {
          const trousers = (color: string) => garments.push({ name: "trousers", offset: 0.009, lip: 0.004,
            fields: (pt, arm, _a, leg) => ({ neck: arm > 0.5 ? 1 : pt.y - (LM.waist + 0.01), sleeve: NONE, hem: NONE, leg: leg > 0.35 ? LM.ankle - pt.y : NONE }),
            material: fabric({ kind: "cotton", color, trim: color }), relax: [4, 10], tube: true });
          const shoes = () => garments.push({ name: "shoes", offset: 0.005, lip: 0.003,
            fields: (pt, arm, _a, leg) => (leg > 0.5 && arm < 0.5 ? { neck: pt.y - (m.kit.bootY + 0.004), sleeve: NONE, hem: NONE, leg: -pt.y - 0.001 } : { neck: 1, sleeve: 1, hem: 1, leg: 1 }),
            material: fabric({ kind: "cotton", color: SHOES[outfit], trim: "#2b2622", bands: [0, 0, 0, 0.016] }), relax: [2, 6] });
          if (outfit === "polo") {
            // a club polo (coach, staff): short sleeves, a folded polo collar, the crest; chinos
            garments.push({ name: "polo", offset: 0.013, lip: 0.004, collar: { kind: "polo", h: 0.02, out: 0.006, fold: 0.012 },
              fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.072, 0.064, 0.085, -0.02), sleeve: arm > 0.5 ? (armS - LM.sleeveShort) * upperArm : NONE, hem: arm > 0.5 ? NONE : LM.hem - pt.y, leg: NONE }),
              material: fabric({ kind: "cotton", color: "#" + new T.Color(kit.shirt).multiplyScalar(0.55).getHexString(), trim: kit.trim, bands: [0, 0.012, 0, 0],
                crest: { tex: C.crestTexture(T, kit.trim, kit.shirt, "KB"), at: [0.085, chestY, 0], size: 0.06 } }), relax: [3, 10] });
            trousers("#b8a582");
          } else {
            // a suit: shirt + collar + tie under a coat with lapels; trousers; shoes
            const coat = "#2b3346", shirtC = "#f2f2ee", tieC = "#7a1f2b";
            garments.push({ name: "shirt", offset: 0.004, lip: 0.002, collar: { kind: "shirt", h: 0.022, out: 0.006, fold: 0.014 },
              tie: { top: collarY - 0.035, bottom: LM.waist + 0.02, w: 0.022 },
              fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.07, 0.062, 0.08, -0.012), sleeve: arm > 0.5 ? (armS - LM.wrist - 0.06) * upperArm : NONE, hem: arm > 0.5 ? NONE : LM.tuck - pt.y, leg: NONE }),
              material: fabric({ kind: "cotton", color: shirtC, trim: shirtC, trim2: tieC }), relax: [0, 8] });
            garments.push({ name: "coat", offset: 0.016, lip: 0.005, collar: { kind: "lapel", h: 0.024, out: 0.004, fold: 0.05 },
              fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.085, 0.072, 0.1, -0.03, 0.27, 0.11), sleeve: arm > 0.5 ? (armS - LM.wrist) * upperArm : NONE, hem: arm > 0.5 ? NONE : (hips[1] - 0.12) - pt.y, leg: NONE }),
              material: fabric({ kind: "wool", color: coat, trim: "#" + new T.Color(coat).multiplyScalar(0.8).getHexString() }), relax: [4, 10] });
            trousers(coat);
          }
          shoes();
        } else {
          // the shirt under the jumper: a high neck with a folded collar, cuffs just past the jumper's
          garments.push({ name: "shirt", offset: 0.004, lip: 0.002, collar: { kind: "shirt", h: 0.022, out: 0.006, fold: 0.014 },
            fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.07, 0.062, 0.08, -0.012), sleeve: arm > 0.5 ? (armS - LM.wrist - 0.06) * upperArm : NONE, hem: arm > 0.5 ? NONE : LM.hem + 0.045 - pt.y, leg: NONE }),
            material: fabric({ kind: "cotton", color: suitLook.shirt, trim: suitLook.shirt }), relax: [0, 8] });
          garments.push({ name: "jumper", offset: 0.011, lip: 0.005,
            fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.082, 0.07, 0.1, -0.03, 0.17, 0.1), sleeve: arm > 0.5 ? (armS - LM.wrist) * upperArm : NONE, hem: arm > 0.5 ? NONE : LM.hem + 0.045 - pt.y, leg: NONE }),
            material: fabric({ kind: "wool", color: jumperCol, trim: "#" + new T.Color(jumperCol).multiplyScalar(0.78).getHexString(), bands: [0.012, 0.045, 0.05, 0] }), relax: [4, 10] });
          garments.push({ name: "trousers", offset: 0.009, lip: 0.004,
            fields: (pt, arm, _a, leg) => ({ neck: arm > 0.5 ? 1 : pt.y - (LM.waist + 0.015), sleeve: NONE, hem: NONE, leg: leg > 0.35 ? LM.ankle - pt.y : NONE }),
            material: fabric({ kind: "cotton", color: suitLook.trousers, trim: suitLook.trousers }), relax: [3, 8] });
        }
        const out = C.buildClothes(T, p.body, rig, garments, (w) => P3.people3dOutline(T, w * 1.3));
        p.body.geometry = out.trimmedBody;
        p.outline.geometry = out.trimmedBody;
        stats.push(out.stats);
      };

      const sheet = document.createElement("canvas"); sheet.id = "sheet";
      const g2 = sheet.getContext("2d")!;
      const info = renderer.info;
      const draws: number[] = [], tris: number[] = [];
      const shoot = (p: Person3D, yaw: number, at: (p: Person3D) => { pos: V3; look: V3; fov: number }, w: number, h: number, dx: number, dy: number) => {
        renderer.setSize(w, h); cam.aspect = w / h;
        p.root.rotation.y = yaw; p.root.updateMatrixWorld(true);
        const v = at(p);
        cam.fov = v.fov; cam.updateProjectionMatrix(); cam.position.set(...v.pos); cam.lookAt(...v.look);
        scene.add(p.root); renderer.render(scene, cam); scene.remove(p.root);
        draws.push(info.render.calls); tris.push(info.render.triangles);
        g2.drawImage(renderer.domElement, dx, dy);
      };
      const label = (s: string, x: number, y: number, w: number, size = 30) => {
        g2.fillStyle = "rgba(16,18,22,0.78)"; g2.fillRect(x, y, w, size + 26);
        g2.fillStyle = "#fff"; g2.font = `bold ${size}px system-ui, sans-serif`; g2.fillText(s, x + 16, y + size + 6, w - 24);
      };
      const wp = (p: Person3D, a: string, b?: string, t = 0) => {
        const v = new T.Vector3(); p.bones[a].getWorldPosition(v);
        if (b) { const u = new T.Vector3(); p.bones[b].getWorldPosition(u); v.lerp(u, t); }
        return v;
      };
      const full = () => ({ pos: [0, 1.05, 6.4] as V3, look: [0, 0.98, 0] as V3, fov: 24 });
      const near = (f: (p: Person3D) => import("three").Vector3, d: number, side = 0, fov = 24) => (p: Person3D) => {
        const c = f(p); return { pos: [c.x + side, c.y + 0.03, c.z + d] as V3, look: [c.x, c.y, c.z] as V3, fov };
      };

      if (shot === "edges") {
        // six edges, today (left) and as cloth (right): collar, sleeve end, shirt hem, shorts hem, sock top, cuff
        const tw = 390, th = 420;
        sheet.width = tw * 2; sheet.height = th * 6;
        const kit = KITS[q.get("kit") ?? "liverpool"]();
        const kb = await make(false, "kit", kit), ka = await make(true, "kit", kit);
        const jb = await make(false, "jumper", kit), ja = await make(true, "jumper", kit);
        const rows: [string, Person3D, Person3D, number, (p: Person3D) => { pos: V3; look: V3; fov: number }][] = [
          ["Collar", kb, ka, -0.45, near((p) => wp(p, "neck").add(new T.Vector3(0, -0.03, 0)), 1.05)],
          ["Sleeve end", kb, ka, -1.1, near((p) => wp(p, "LeftArm", "LeftForeArm", 0.7), 0.85)],
          ["Shirt hem", kb, ka, -0.6, near((p) => wp(p, "Hips").add(new T.Vector3(0, -0.04, 0)), 0.95)],
          ["Shorts hem", kb, ka, -0.45, near((p) => wp(p, "LeftUpLeg", "LeftLeg", 0.75), 0.85)],
          ["Sock top", kb, ka, -0.45, near((p) => wp(p, "LeftLeg", "LeftFoot", 0.18), 0.8)],
          ["Cuff (jumper over shirt)", jb, ja, -1.0, near((p) => wp(p, "LeftHand", "LeftForeArm", 0.12), 0.75)],
        ];
        rows.forEach(([name, b, a, yaw, at], i) => {
          shoot(b, yaw, at, tw, th, 0, i * th); shoot(a, yaw, at, tw, th, tw, i * th);
          label(`${name}: today | cloth`, 0, i * th, tw * 2, 22);
        });
        g2.fillStyle = "#000"; g2.fillRect(tw - 1, 0, 2, th * 6); for (let i = 1; i < 6; i++) g2.fillRect(0, i * th - 1, tw * 2, 3);
      } else if (shot === "wardrobe") {
        // the wardrobe by role, all cloth: press, kit man, fan, and a player in kit for comparison
        const tw = 400, th1 = 1000, th2 = 640;
        sheet.width = tw * 6; sheet.height = th1 + th2;
        const kit = KITS[q.get("kit") ?? "liverpool"]();
        const who: [string, Outfit][] = [["Press: shirt, lanyard", "press"], ["Kit man: training jacket", "kitman"], ["Fan: shirt, jeans, scarf", "fan"], ["Manager: suit + tie", "suit"], ["Coach: club polo", "polo"], ["Player: match kit", "kit"]];
        for (let i = 0; i < 6; i++) {
          const a = await make(true, who[i][1], kit);
          shoot(a, -0.25, () => ({ pos: [0, 1.0, 5.6] as V3, look: [0, 0.94, 0] as V3, fov: 24 }), tw, th1, i * tw, 0);
          shoot(a, -0.7, near((p) => wp(p, "Spine01").add(new T.Vector3(0, 0.12, 0)), 2.0), tw, th2, i * tw, th1);
          label(who[i][0], i * tw, 0, tw, 20);
        }
        g2.fillStyle = "#000"; g2.fillRect(0, th1 - 2, tw * 6, 4); for (let i = 1; i < 6; i++) g2.fillRect(i * tw - 1, 0, 3, th1 + th2);
      } else if (shot === "patterns") {
        // real nation kits from the data: stripes, contrast sleeves, hoops. Top today, bottom cloth.
        const tw = 520, th = 844;
        sheet.width = tw * 3; sheet.height = th * 2;
        const names = ["argentina", "austria", "samoa"];
        for (let i = 0; i < 3; i++) {
          const kit = KITS[names[i]]();
          const b = await make(false, "kit", kit), a = await make(true, "kit", kit);
          const at = () => ({ pos: [0, 1.12, 4.4] as V3, look: [0, 1.08, 0] as V3, fov: 24 });
          shoot(b, -0.25, at, tw, th, i * tw, 0); shoot(a, -0.25, at, tw, th, i * tw, th);
          label(`${kit.name}: today`, i * tw, 0, tw, 22); label(`"${kit.words}": cloth`, i * tw, th, tw, 20);
        }
        g2.fillStyle = "#000"; g2.fillRect(0, th - 2, tw * 3, 4); g2.fillRect(tw - 1, 0, 3, th * 2); g2.fillRect(2 * tw - 1, 0, 3, th * 2);
      } else {
        sheet.width = W * 2; sheet.height = H;
        const outfit = shot.includes("jumper") ? "jumper" : "kit";
        const kit = KITS[q.get("kit") ?? "liverpool"]();
        const before = await make(false, outfit, kit), after = await make(true, outfit, kit);
        const V: Record<string, [number, (p: Person3D) => { pos: V3; look: V3; fov: number }]> = {
          "kit-front": [-0.2, full], "kit-side": [-1.35, full], "kit-back": [Math.PI - 0.25, full], "jumper-front": [-0.2, full],
          "jumper-34": [-0.7, () => ({ pos: [0, 1.3, 3.3], look: [0, 1.25, 0], fov: 24 })],
          "neck-kit": [-0.55, near((p) => wp(p, "neck").add(new T.Vector3(0, -0.1, 0)), 2.1)],
          "neck-jumper": [-0.55, near((p) => wp(p, "neck").add(new T.Vector3(0, -0.1, 0)), 2.1)],
        };
        const [yaw, at] = V[shot] ?? V["kit-front"];
        shoot(before, yaw, at, W, H, 0, 0); shoot(after, yaw, at, W, H, W, 0);
        label("TODAY: painted on by masks", 0, 0, W); label("CLOTH: cut at landmarks, shell, hems", W, 0, W);
        g2.fillStyle = "#000"; g2.fillRect(W - 2, 0, 4, H);
      }
      sheet.style.width = "100%"; sheet.style.maxWidth = `${Math.min(sheet.width, 1100)}px`;
      box.current!.appendChild(sheet);
      w0.__clothStats = { stats, draws, tris };
      setStatus(`${shot}: draws ${draws.join(" / ")}, triangles ${tris.join(" / ")}; ${JSON.stringify(stats)}`);
      console.log("CLOTHDBG done", JSON.stringify({ stats, draws, tris }));
      w0.__sheetDone = true;
    })().catch((e) => { console.error(e); setStatus(`failed: ${String(e)}`); w0.__sheetDone = true; });
  }, []);
  return (
    <BroadcastPage title="Clothes proof" sub="Today's painted kit next to real cloth on the same body. Nothing is saved.">
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }} id="sheet-status">{status}</div>
      <div ref={box} />
      <PageGuide page="/star-3d-bench-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
