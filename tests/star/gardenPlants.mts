import * as T from "three";
import { addTree, addBush, newBin, treeTriangles, TREE_STYLE, type TreeShape } from "../../lib/star/garden3d/lowPolyTrees";
import { buildPlantZones, lodFor, zoneOf, hiddenBehind, LOD_DIST, CARD_LOD_DIST, type TreeAt, type BushAt } from "../../lib/star/garden3d/plantZones";
import { addCardTree, newCardBin, cardTreeTriangles, cardMaterial, CARDS } from "../../lib/star/garden3d/cardTrees";
import { tightCull } from "../../lib/star/three3d/tightCull";
import { GARDEN_BUDGET, GARDEN_MEASURED } from "../../lib/star/garden3d/gardenBudget";

/**
 * THE GARDEN'S LOW-POLY TREES, ZONES AND CULLING (28 Nov 2026) — the parts that need no GPU:
 * triangles per tree and per detail level, one draw per zone, the detail by distance, the
 * "behind the shop" test, the tight frustum check (hidden for the picture, back for the shadow
 * pass and after the frame), and the measured garden numbers against its budget.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── triangles: a few hundred near, ~100 far, never more ──
const LIMIT: [number, number, number] = [520, 260, 110];
for (const style of ["clump", "facet", "leafy"] as const) {
  const t = treeTriangles(T, style);
  for (const shape of Object.keys(t) as TreeShape[]) {
    const [a, b, c] = t[shape];
    check(a > b && b > c, `${style} ${shape}: each detail level is lighter than the last (${a} / ${b} / ${c})`);
    check(b <= LIMIT[1] && c <= LIMIT[2], `${style} ${shape}: middle ≤ ${LIMIT[1]}, far ≤ ${LIMIT[2]} triangles (${b} / ${c})`);
    if (style !== "leafy") check(a <= LIMIT[0], `${style} ${shape}: near ≤ ${LIMIT[0]} triangles (${a})`);
    else check(a <= 760, `leafy ${shape}: near ≤ 760 triangles with its single leaves (${a})`);
  }
}
check(TREE_STYLE === "facet", "the low-poly option (?trees=facet, and the fallback with no tree picture) is the facet style");

// ── sizes never change (RUL-3D-006): the tree fills the box of the tree it stands in for ──
for (const shape of ["round", "wide", "tall", "pine"] as TreeShape[]) {
  const b = newBin();
  addTree(T, b, { h: 1.5, w: 0.8, shape, seed: 3, style: "clump", lod: 0 });
  let top = -Infinity, wide = 0;
  for (let i = 0; i < b.p.length; i += 3) { top = Math.max(top, b.p[i + 1]); wide = Math.max(wide, Math.hypot(b.p[i], b.p[i + 2])); }
  check(Math.abs(top - 1.5) / 1.5 < 0.12, `${shape}: as tall as the tree it replaces (${top.toFixed(2)} vs 1.5)`);
  check(wide < 0.8 * 0.75, `${shape}: no wider than the tree it replaces (radius ${wide.toFixed(2)} vs 0.40 + a little)`);
}

// ── every part's normal is a unit, every colour is in range ──
{
  const b = newBin();
  addTree(T, b, { h: 1.5, w: 0.8, shape: "round", seed: 9, style: "clump", lod: 0 });
  addBush(T, b, { x: 1, z: 1, s: 0.5, seed: 2, style: "clump", lod: 1 });
  let bad = 0;
  for (let i = 0; i < b.n.length; i += 3) if (Math.abs(Math.hypot(b.n[i], b.n[i + 1], b.n[i + 2]) - 1) > 1e-3) bad++;
  check(bad === 0, `every normal is a unit (${bad} not)`);
  check(b.c.every((c) => c >= 0 && c <= 1), "colours stay in 0..1");
  check(b.p.length === b.n.length && b.p.length === b.c.length && b.p.length % 9 === 0, "whole triangles, one normal and colour per corner");
}

// ── zones: one draw each, detail by distance ──
const trees: TreeAt[] = [];
for (let i = 0; i < 83; i++) { const a = (i / 83) * Math.PI * 2, d = i < 6 ? 15 : 23 + (i % 9); trees.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: 5, ry: i, h: 1.4, w: 0.75, shape: (["round", "wide", "tall", "pine"] as TreeShape[])[i % 4], seed: i }); }
const bushes: BushAt[] = Array.from({ length: 45 }, (_, i) => ({ x: -15 + (i % 9) * 3.5, z: -12 + Math.floor(i / 9) * 6, s: 0.6, seed: i }));
const pz = buildPlantZones(T, trees, bushes, { style: "clump", occluders: [{ x0: -6, x1: 6, y0: 0, y1: 6.4, z0: -17.5, z1: -9 }] });
const meshes = pz.group.children as T.Mesh[];
check(meshes.length === pz.zones && pz.zones <= 16, `a few zones (${pz.zones}), each one mesh`);
check(new Set(meshes.map((m) => m.material)).size === 1, "every zone shares ONE material");
check(new Set(trees.map((t) => zoneOf(t.x, t.z))).size + 0 <= 16, "trees fall into at most 16 zones");
const st = pz.stats();
const allFar = st.reduce((s, z) => s + z.tris[2], 0), allMid = st.reduce((s, z) => s + z.tris[1], 0), allNear = st.reduce((s, z) => s + z.tris[0], 0);
check(allMid <= 25_000, `every tree and bush at middle detail: ≤ 25k triangles (${allMid})`);
check(allFar < allMid && allMid < allNear, `far < middle < near (${allFar} / ${allMid} / ${allNear})`);
for (const tier of ["high", "medium", "low"] as const) {
  check(lodFor(0, tier) === 0 && lodFor(LOD_DIST[tier][0] + 0.1, tier) === 1 && lodFor(LOD_DIST[tier][1] + 0.1, tier) === 2, `${tier}: near, then middle, then far`);
}
check(LOD_DIST.low[0] < LOD_DIST.medium[0] && LOD_DIST.medium[0] < LOD_DIST.high[0], "a lower tier drops detail sooner");
{
  const cam = new T.PerspectiveCamera(56, 0.45, 0.1, 160);
  cam.position.set(0, 2.2, 18);
  pz.update(cam, "medium");
  const lods = pz.stats().map((z) => z.lod);
  check(lods.includes(0) || lods.includes(1), "near the camera a zone draws more detail");
  pz.update(cam, "low");
  check(pz.stats().some((z) => z.lod === 2), "on Low the far side of the ring draws its far detail");
  pz.update(cam, "medium");
  // the draw range follows
  const m0 = meshes[0];
  const r = m0.geometry.drawRange;
  check(r.count > 0 && r.count < (m0.geometry.attributes.position as T.BufferAttribute).count, "a zone draws only its detail's part of the buffer");
  // shadows always from the middle detail
  (m0 as any).onBeforeShadow();
  const z0 = pz.stats()[0];
  check(m0.geometry.drawRange.count === z0.tris[1] * 3, "the shadow pass draws the middle detail");
  (m0 as any).onAfterShadow();
  check(m0.geometry.drawRange.count === z0.tris[z0.lod] * 3, "and the picture's own detail comes back after");
}

// ── behind a building ──
{
  const wall = { x0: -6, x1: 6, y0: 0, y1: 6, z0: -17, z1: -9 };
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => [x, y, z])));
  check(hiddenBehind([0, 2, 5], box(-2, 2, 0, 3, -25, -22), wall), "a low thing right behind the shop is hidden");
  check(!hiddenBehind([0, 2, 5], box(-2, 2, 0, 12, -25, -22), wall), "a tree taller than the roof is not");
  check(!hiddenBehind([0, 2, 5], box(8, 12, 0, 3, -25, -22), wall), "a thing beside the shop is not");
  check(!hiddenBehind([0, 2, -30], box(-2, 2, 0, 3, -25, -22), wall), "seen from behind, it is in front of the shop");
}

// ── tight culling: hidden for the picture only ──
{
  const scene = new T.Scene();
  const mk = (x: number, z: number, w: number) => { const m = new T.Mesh(new T.BoxGeometry(w, 1, w), new T.MeshBasicMaterial()); m.position.set(x, 0, z); scene.add(m); return m; };
  const ahead = mk(0, -20, 10), behind = mk(0, 25, 10), small = mk(0, 25, 0.5);
  // a long wall whose ball reaches the camera but whose box is wholly behind it
  const wallBehind = new T.Mesh(new T.BoxGeometry(30, 1, 1), new T.MeshBasicMaterial()); wallBehind.position.set(0, 0, 12); scene.add(wallBehind);
  const hooks: (() => void)[] = [];
  const fakeRenderer: any = { shadowMap: { render: () => hooks.push(() => {}) } };
  const cam = new T.PerspectiveCamera(50, 0.5, 0.1, 200); cam.position.set(0, 2, 10); cam.lookAt(0, 0, -10); cam.updateMatrixWorld();
  const tc = tightCull(T, scene, fakeRenderer, { minRadius: 2 });
  (scene.onBeforeRender as any)(fakeRenderer, scene, cam, null);
  check(ahead.visible && !behind.visible, "a big piece behind the camera is left out of the picture");
  check(!wallBehind.visible, "a long piece whose ball reaches the camera but whose box is behind it is left out too");
  check(small.visible, "a small piece is left to three's own check");
  let seenInShadow = false;
  const realShadow = fakeRenderer.shadowMap.render;
  void realShadow;
  fakeRenderer.shadowMap.render.call(fakeRenderer.shadowMap);
  seenInShadow = behind.visible;
  check(seenInShadow, "back in before the shadow pass (it still casts its shadow)");
  (scene.onBeforeRender as any)(fakeRenderer, scene, cam, null);
  (scene.onAfterRender as any)(fakeRenderer, scene, cam, null);
  check(behind.visible && wallBehind.visible, "back in after the frame");
  behind.position.x = 3; behind.updateMatrixWorld();
  (scene.onBeforeRender as any)(fakeRenderer, scene, cam, null);
  check(behind.visible, "a piece that moves is left to three's own check");
  (scene.onAfterRender as any)(fakeRenderer, scene, cam, null);
  const n = tc.stats().checked;
  tc.dispose();
  check(n === 2, `checks the big still pieces only (${n})`);
}

// ── the textured trees (the game's default since 28 Nov 2026: Harry kept the scanned-leaf look) ──
{
  const ct = cardTreeTriangles(T);
  for (const k of ["broad", "pine"] as const) {
    const [a, b, c] = ct[k];
    check(a > b && b > c, `textured ${k}: each level lighter (${a} / ${b} / ${c})`);
  }
  check(ct.broad[0] <= 520 && ct.broad[0] < 788, `textured broadleaf near: ≤ 520 triangles, the old tree was 788 (${ct.broad[0]})`);
  check(ct.broad[2] <= 130 && ct.pine[2] <= 90, `far trees ~100 triangles (${ct.broad[2]} / ${ct.pine[2]})`);
  check(CARDS.broad[0] < 340 && CARDS.pine[0] < 200, "fewer sprays than the old 340 / 200");
  check(lodFor(0, "low", CARD_LOD_DIST) === 2 && lodFor(100, "low", CARD_LOD_DIST) === 2, "on Low the simplest level everywhere");
  check(lodFor(5, "medium", CARD_LOD_DIST) === 0 && lodFor(20, "medium", CARD_LOD_DIST) === 1 && lodFor(60, "medium", CARD_LOD_DIST) === 2, "Medium: near, middle, far");
  // the crown keeps the old tree's outline: the bigger sprays sit a little further in
  const box = (cards?: number) => {
    const b = newCardBin(); addCardTree(T, b, { h: 1.3, w: 0.75, pine: false, seed: 101, lod: 0, cards });
    let r = 0, top = 0; for (let i = 0; i < b.p.length; i += 3) { r = Math.max(r, Math.hypot(b.p[i], b.p[i + 2])); top = Math.max(top, b.p[i + 1]); }
    return [r, top];
  };
  const [r340, t340] = box(340), [r200, t200] = box();
  check(Math.abs(r200 - r340) / r340 < 0.15 && Math.abs(t200 - t340) / t340 < 0.12, `same outline as the 340-spray crown (radius ${r200.toFixed(2)} vs ${r340.toFixed(2)}, top ${t200.toFixed(2)} vs ${t340.toFixed(2)})`);
  const mat = cardMaterial(T, new T.Texture(), null);
  check(mat.alphaTest > 0 && !mat.transparent && mat.userData.depth && mat.userData.noBake === true, "cut-out (alpha test, not blended), its shadow cut out too, no baked light");
  const cz = buildPlantZones(T, trees, bushes, { style: "cards", cardMaterial: mat });
  const cm = cz.group.children as T.Mesh[];
  check(new Set(cm.map((m) => m.material)).size === 1 && cm.length === cz.zones, `textured zones: one material, one mesh a zone (${cz.zones})`);
  check(cm.every((m) => m.customDepthMaterial === mat.userData.depth), "every zone's shadow cut out by the leaves");
  const z0 = cz.stats()[0];
  (cm[0] as any).onBeforeShadow();
  check(cm[0].geometry.drawRange.count === z0.tris[0] * 3, "textured trees cast their shadow from the near level (the crown shades itself as the old one did)");
  (cm[0] as any).onAfterShadow();
}

// ── the measured garden against its budget ──
for (const m of GARDEN_MEASURED.after.filter((x) => x.tier === "medium")) {
  const b = m.walking ? GARDEN_BUDGET.mediumWalking : GARDEN_BUDGET.medium;
  check(m.draws <= b.draws && m.triangles <= b.triangles, `garden ${m.view}${m.walking ? " walking" : ""} on Medium: ${m.draws} draws / ${m.triangles} triangles (budget ${b.draws} / ${b.triangles})`);
}
check(GARDEN_MEASURED.after.length >= 3, "the after numbers are recorded");
for (const a of GARDEN_MEASURED.after) {
  const b = GARDEN_MEASURED.before.find((x) => x.view === a.view && x.tier === a.tier && x.walking === a.walking);
  if (b) check(a.draws < b.draws && a.triangles < b.triangles, `${a.view}${a.walking ? " walking" : ""}: fewer draws and triangles than before (${b.draws}→${a.draws}, ${b.triangles}→${a.triangles})`);
}

if (problems.length) {
  console.error(`gardenPlants: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log(`gardenPlants: textured trees ${JSON.stringify(cardTreeTriangles(T))}, low-poly option ${JSON.stringify(treeTriangles(T))} triangles (near/middle/far), ${pz.zones} zones, culling, budget — all OK`);
