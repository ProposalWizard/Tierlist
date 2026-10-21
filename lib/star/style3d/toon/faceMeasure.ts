/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MEASURING A STYLE A HEAD'S FACE (browser only; the bench's Faces page,
 * /star-3d-bench-dev/faces). The head is drawn flat from the front with its
 * own picture and no light, in its rest pose, then its painted features are
 * found by colour:
 *   eye whites  bright and grey      → each eye opening (a box round white + iris)
 *   irises      dark, inside an eye  → centre and size
 *   brows       dark, over the eyes
 *   lips        redder or darker than the cheeks, under the nose → the mouth line and width
 * Depths (eyes, mouth, nose tip) by a ray from the front onto the head.
 * Everything is in rest-pose metres, his left at +x (as faceLandmarks.ts).
 */
import { TOON_HEADS, type ToonHead } from "./bodies";
import type { ToonFaceLandmarks } from "./faceLandmarks";

export interface ToonFaceMeasure extends ToonFaceLandmarks {
  /** How many pixels each find rests on (a thin find is a doubtful one). */
  px: { white: [number, number]; iris: [number, number]; lips: number };
}

const W = 880, H = 960;
const BOX = { half: 0.11, up: 0.1, down: 0.14 };

/** `file`: measure a body file being judged (bodies.ts TOON_BODY_SETS) worn as `head`. */
export async function measureToonFace(head: ToonHead, file?: string): Promise<{ m: ToonFaceMeasure; pic: string }> {
  const T: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkU: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const { withMeshopt } = await import("../../three3d/meshopt");
  const { loadToonHead, loadPeople3d, makePerson3d } = await import("../../people3d");
  const loader = await withMeshopt(new GLTFLoader());
  const one = async () => { const f = await loader.loadAsync(file); const set: unknown[] = []; set[TOON_HEADS.indexOf(head)] = f; return { ...f, toonBodies: set, toonWhich: "player" }; };
  const [g, anims] = await Promise.all([file ? one() : loadToonHead(loader, head), loadPeople3d(loader, "anims", "new")]);
  const p = makePerson3d(T, SkU.default ?? SkU, g, anims, { toonHead: head, outline: 0, who: "measure" });
  const geo = p.body.geometry;
  const map = (p.body.material as any).map;
  const eyeY: number = p.meta.face.eyeY;

  const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ map }));
  const scene = new T.Scene();
  scene.add(mesh);
  const top = eyeY + BOX.up, bottom = eyeY - BOX.down;
  const cam = new T.OrthographicCamera(-BOX.half, BOX.half, top, bottom, 0.01, 10);
  cam.position.set(0, 0, 3);
  cam.lookAt(0, 0, 0);
  // an ortho camera at y 0 with the box given in world y: a frustum from bottom to top
  cam.top = top; cam.bottom = bottom; cam.updateProjectionMatrix();
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const renderer = new T.WebGLRenderer({ canvas, preserveDrawingBuffer: true, antialias: false, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, cam);
  const c2 = document.createElement("canvas");
  c2.width = W; c2.height = H;
  const x2 = c2.getContext("2d")!;
  x2.drawImage(canvas, 0, 0);
  const img = x2.getImageData(0, 0, W, H).data;
  renderer.dispose();

  const toX = (i: number) => -BOX.half + ((i + 0.5) / W) * BOX.half * 2;
  const toY = (j: number) => top - ((j + 0.5) / H) * (top - bottom);
  const toI = (x: number) => Math.round(((x + BOX.half) / (BOX.half * 2)) * W - 0.5);
  const toJ = (y: number) => Math.round(((top - y) / (top - bottom)) * H - 0.5);
  const at = (i: number, j: number) => { const k = (j * W + i) * 4; return [img[k] / 255, img[k + 1] / 255, img[k + 2] / 255, img[k + 3] / 255]; };
  const L = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const S = (c: number[]) => { const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return mx > 0 ? (mx - mn) / mx : 0; };
  const pct = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))] : NaN; };

  // the cheeks' colour: the skin to compare against
  const cheek: number[][] = [];
  for (const sx of [-1, 1]) for (let x = 0.03; x <= 0.05; x += 0.002) for (let y = eyeY - 0.045; y <= eyeY - 0.025; y += 0.002) { const c = at(toI(sx * x), toJ(y)); if (c[3] > 0.5) cheek.push(c); }
  const skinL = pct(cheek.map(L), 0.5);
  const skinRG = pct(cheek.map((c) => c[0] - c[1]), 0.5);

  // the eyes: white (bright, grey) and dark (iris) pixels in each side's band
  const eye = (side: number) => {
    const wx: number[] = [], wy: number[] = [];
    for (let j = toJ(eyeY + 0.028); j <= toJ(eyeY - 0.03); j++) for (let i = 0; i < W; i++) {
      const x = toX(i) * side;
      if (x < 0.006 || x > 0.07) continue;
      const c = at(i, j);
      if (c[3] < 0.5) continue;
      if (L(c) > Math.max(0.62, skinL + 0.12) && S(c) < 0.28) { wx.push(toX(i)); wy.push(toY(j)); }
    }
    const x0 = pct(wx, 0.03), x1 = pct(wx, 0.97), y0 = pct(wy, 0.03), y1 = pct(wy, 0.97);
    // the iris: dark pixels inside the white's box (a little wider)
    const ix: number[] = [], iy: number[] = [];
    const padX = (x1 - x0) * 0.1, padY = (y1 - y0) * 0.35;
    for (let j = toJ(y1 + padY); j <= toJ(y0 - padY); j++) for (let i = toI(x0 - padX); i <= toI(x1 + padX); i++) {
      const c = at(i, j);
      if (c[3] > 0.5 && L(c) < Math.min(0.32, skinL * 0.55)) { ix.push(toX(i)); iy.push(toY(j)); }
    }
    const icx = pct(ix, 0.5), icy = pct(iy, 0.5);
    const ir = Math.sqrt(ix.length / Math.PI) * ((BOX.half * 2) / W);
    const ex0 = Math.min(x0, pct(ix, 0.05)), ex1 = Math.max(x1, pct(ix, 0.95));
    const ey0 = Math.min(y0, pct(iy, 0.05)), ey1 = Math.max(y1, pct(iy, 0.95));
    return { cx: (ex0 + ex1) / 2, cy: (ey0 + ey1) / 2, hw: (ex1 - ex0) / 2, hh: (ey1 - ey0) / 2, iris: [icx, icy, ir] as [number, number, number], nw: wx.length, ni: ix.length };
  };
  const R = eye(-1), Lf = eye(1);

  // the colours a moving face needs: the eye white, the lid (skin just over the eye) and the lash line
  const hex = (cs: number[][]) => { if (!cs.length) return "#888888"; const ch = [0, 1, 2].map((k) => Math.round(pct(cs.map((c) => c[k]), 0.5) * 255)); return "#" + ch.map((v) => v.toString(16).padStart(2, "0")).join(""); };
  const whites: number[][] = [], lids: number[][] = [], lashes: number[][] = [];
  for (const e of [R, Lf]) {
    for (let j = toJ(e.cy + e.hh * 0.6); j <= toJ(e.cy - e.hh * 0.6); j++) for (let i = toI(e.cx - e.hw * 0.9); i <= toI(e.cx + e.hw * 0.9); i++) { const c = at(i, j); if (c[3] > 0.5 && L(c) > Math.max(0.62, skinL + 0.12) && S(c) < 0.28) whites.push(c); }
    for (let j = toJ(e.cy + e.hh + 0.009); j <= toJ(e.cy + e.hh + 0.0035); j++) for (let i = toI(e.cx - e.hw * 0.6); i <= toI(e.cx + e.hw * 0.6); i++) { const c = at(i, j); if (c[3] > 0.5 && L(c) > skinL * 0.8 && L(c) < skinL * 1.25) lids.push(c); }
    for (let j = toJ(e.cy + e.hh + 0.003); j <= toJ(e.cy + e.hh - 0.001); j++) for (let i = toI(e.cx - e.hw * 0.6); i <= toI(e.cx + e.hw * 0.6); i++) { const c = at(i, j); if (c[3] > 0.5 && L(c) < skinL * 0.5) lashes.push(c); }
  }
  const colors = { white: hex(whites), lid: hex(lids.length ? lids : cheek), lash: hex(lashes) };

  // brows: dark pixels in a band over each eye
  const browYs: number[] = [];
  for (const e of [R, Lf]) for (let j = toJ(e.cy + e.hh + 0.03); j <= toJ(e.cy + e.hh + 0.002); j++) for (let i = toI(e.cx - e.hw); i <= toI(e.cx + e.hw); i++) {
    const c = at(i, j);
    if (c[3] > 0.5 && L(c) < skinL * 0.6) browYs.push(toY(j));
  }
  const browY = pct(browYs, 0.5);

  // depth by a ray from the front
  const ray = new T.Raycaster();
  const zAt = (x: number, y: number) => { ray.set(new T.Vector3(x, y, 1), new T.Vector3(0, 0, -1)); const h = ray.intersectObject(mesh, false)[0]; return h ? h.point.z : NaN; };
  // the nose tip: the furthest-forward point down the middle
  let nose: [number, number, number] = [0, eyeY - 0.03, -1];
  for (let y = eyeY - 0.055; y <= eyeY - 0.012; y += 0.001) for (let x = -0.006; x <= 0.006; x += 0.002) { const z = zAt(x, y); if (z > nose[2]) nose = [x, y, z]; }

  // the lips: redder or darker than the cheeks, under the nose, near the middle
  // red first: a beard is dark too, so only a head with no red lips falls back on dark ones
  const reds = new Map<number, number[]>(), darks = new Map<number, number[]>();
  for (let j = toJ(nose[1] - 0.012); j <= toJ(nose[1] - 0.06); j++) for (let i = toI(-0.035); i <= toI(0.035); i++) {
    const c = at(i, j);
    if (c[3] < 0.5) continue;
    const add = (m: Map<number, number[]>) => { const a = m.get(j) ?? []; a.push(toX(i)); m.set(j, a); };
    if (c[0] - c[1] > skinRG + 0.06) add(reds);
    else if (L(c) < skinL * 0.72) add(darks);
  }
  const nRed = Array.from(reds.values()).reduce((a, x) => a + x.length, 0);
  const rows = nRed > 250 ? reds : darks;
  let bestJ = -1, bestN = 0;
  rows.forEach((xs, j) => { if (xs.length > bestN) { bestN = xs.length; bestJ = j; } });
  // the mouth line: the middle of the rows that are at least half as full as the fullest
  const lipRows = Array.from(rows.entries()).filter(([, xs]) => xs.length > bestN * 0.5).map(([j]) => j);
  const mouthJ = lipRows.length ? lipRows.reduce((a, b) => a + b, 0) / lipRows.length : toJ(nose[1] - 0.035);
  const lx: number[] = [];
  for (const j of lipRows) lx.push(...(rows.get(j) ?? []));
  const mouthY = toY(Math.round(mouthJ));
  const mouthW = lx.length ? (pct(lx, 0.97) - pct(lx, 0.03)) / 2 : 0.022;
  const mouthCx = lx.length ? (pct(lx, 0.97) + pct(lx, 0.03)) / 2 : 0;
  const mouthZ = zAt(mouthCx, mouthY);
  const eyeZ = (zAt(R.iris[0], R.iris[1]) + zAt(Lf.iris[0], Lf.iris[1])) / 2;
  // the chin: down the middle, the last row still on the head before the neck turns back
  let chinY = mouthY - 0.035;
  for (let y = mouthY - 0.01; y > mouthY - 0.08; y -= 0.001) { const z = zAt(0, y); if (!(z > mouthZ - 0.035)) { chinY = y; break; } }

  const r4 = (v: number) => +v.toFixed(4);
  const m: ToonFaceMeasure = {
    eyes: [[r4(R.cx), r4(R.cy), r4(R.hw), r4(R.hh)], [r4(Lf.cx), r4(Lf.cy), r4(Lf.hw), r4(Lf.hh)]],
    iris: [[r4(R.iris[0]), r4(R.iris[1]), r4(R.iris[2])], [r4(Lf.iris[0]), r4(Lf.iris[1]), r4(Lf.iris[2])]],
    eyeZ: r4(eyeZ), browY: r4(browY), nose: [r4(nose[0]), r4(nose[1]), r4(nose[2])],
    mouth: [r4(mouthCx), r4(mouthY), r4(mouthW), r4(mouthZ)], chinY: r4(chinY), colors,
    px: { white: [R.nw, Lf.nw], iris: [R.ni, Lf.ni], lips: lx.length },
  };

  // what was found, drawn over the picture
  x2.lineWidth = 2;
  const ell = (cx: number, cy: number, rx: number, ry: number, col: string) => { x2.strokeStyle = col; x2.beginPath(); x2.ellipse(toI(cx), toJ(cy), Math.max(1, (rx / (BOX.half * 2)) * W), Math.max(1, (ry / (top - bottom)) * H), 0, 0, Math.PI * 2); x2.stroke(); };
  for (const e of m.eyes) ell(e[0], e[1], e[2], e[3], "#ff2a2a");
  for (const e of m.iris) ell(e[0], e[1], e[2], e[2], "#2a7bff");
  ell(m.mouth[0], m.mouth[1], m.mouth[2], 0.002, "#22dd55");
  x2.strokeStyle = "#ffcc00"; x2.beginPath(); x2.moveTo(toI(-0.06), toJ(m.browY)); x2.lineTo(toI(0.06), toJ(m.browY)); x2.stroke();
  x2.fillStyle = "#ff00ff"; x2.fillRect(toI(m.nose[0]) - 3, toJ(m.nose[1]) - 3, 6, 6);
  return { m, pic: c2.toDataURL("image/jpeg", 0.85) };
}
