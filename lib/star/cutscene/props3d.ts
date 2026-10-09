/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PROPS — the things people hold, modelled in code in the style kit's
 * materials (so they take look A's bands and lines like the set does).
 *
 * Every prop is a group whose ORIGIN is its grip: a one-handed prop sits in
 * the hand with its local +y along the handle's axis; the pen's origin is its
 * nib. Two-handed props name a handle for each hand ("L", "R"). The contract
 * is a surface the pen writes on: `surface(px, py)` is a point on the paper
 * (contract pixels) in the prop's own frame, `setInk(u)` draws the signature
 * that far.
 */
import type { PropKind, PropSpec } from "./types";
import type { StyleKit } from "../style3d/kit";
import type { Signature } from "./signature";
import { signatureAt } from "./signature";
import { rng, hashStr } from "./math";

export interface PropObj {
  spec: PropSpec;
  group: any;
  /** Hand shape that holds it. */
  grip: "pen" | "grip" | "flat" | "pinch";
  /** Named points in the prop's own frame (two-handed props: "L", "R"). */
  handles: Record<string, [number, number, number]>;
  /** The contract: a paper point (px, py) in the prop's frame. */
  surface?: (px: number, py: number, lift?: number) => [number, number, number];
  paths?: Record<string, Signature>;
  /** The contract: how much of the signature is inked (0..1), and the stamp. */
  setInk?: (u: number, stamped?: boolean) => void;
  /** Animate (a flag waving, a bottle's spray) from t. */
  update?: (t: number) => void;
  dispose(): void;
}

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

export interface PropText { club: string; player: string; surname: string; manager: string; number: number; rows: [string, string][]; shirt: string; trim: string }

export function buildProp(T: any, kit: StyleKit, spec: PropSpec, txt: PropText, sig?: Signature): PropObj {
  const g = new T.Group();
  g.name = `prop:${spec.id}`;
  const disp: any[] = [];
  const mat = (c: string, o: any = {}) => { const m = kit.mat(c, o); disp.push(m); return m; };
  const mesh = (geo: any, m: any, x = 0, y = 0, z = 0) => { const me = new T.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); disp.push(geo); return me; };
  const tex = (c: HTMLCanvasElement) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; disp.push(t); return t; };
  const gold = () => mat("#e0b23a", { metal: 0.9, rough: 0.22, emissive: "#3a2600", emissiveIntensity: 0.25 });
  const silver = () => mat("#d6dbe2", { metal: 0.9, rough: 0.2, emissive: "#202428", emissiveIntensity: 0.2 });
  const base: PropObj = { spec, group: g, grip: "grip", handles: {}, dispose() { for (const d of disp) d.dispose?.(); } };
  const k = spec.kind as PropKind;
  const shirt = spec.color ?? txt.shirt, trim = spec.color2 ?? txt.trim;

  if (k === "pen") {
    // the live signing's pen: lacquer barrel, brass grip, nib; origin at the nib, +y up the barrel
    const lac = mat("#0b0d12", { rough: 0.18, metal: 0.4 }), brass = mat("#c8942f", { metal: 0.85, rough: 0.28 });
    mesh(new T.CylinderGeometry(0.0052, 0.0046, 0.118, 16), lac, 0, 0.073, 0);
    mesh(new T.CylinderGeometry(0.0046, 0.0036, 0.02, 16), brass, 0, 0.0155, 0);
    const nib = mesh(new T.ConeGeometry(0.0034, 0.008, 12), brass, 0, 0.004, 0); nib.rotation.x = Math.PI;
    mesh(new T.CylinderGeometry(0.0055, 0.0055, 0.006, 16), brass, 0, 0.1, 0);
    mesh(new T.BoxGeometry(0.0018, 0.04, 0.003), brass, 0, 0.105, 0.0058);
    g.scale.setScalar(1.35 * (spec.scale ?? 1));
    return { ...base, grip: "pen", handles: { grip: [0, 0, 0], tip: [0, 0, 0] } };
  }

  if (k === "contract") {
    const CW = 640, CH = 886, PW = 0.26, PH = 0.36;
    const c = canvas(CW, CH);
    const t = tex(c);
    const SIG = { x: 330, y: 692, w: 260, h: 70 };
    const draw = (ink: number, stamped: boolean) => drawContract(c, txt, sig, ink, stamped, SIG);
    draw(0, false);
    // a leather folder under the paper
    const folder = mesh(new T.BoxGeometry(PW + 0.05, 0.006, PH + 0.04), mat("#2a1a12", { rough: 0.5 }), 0, -0.003, 0);
    folder.castShadow = false;
    const paper = new T.Mesh(new T.PlaneGeometry(PW, PH), mat("#ffffff", { map: t, rough: 0.85 }));
    paper.rotation.x = -Math.PI / 2; paper.position.y = 0.0012; paper.receiveShadow = true; g.add(paper); disp.push(paper.geometry);
    let lastInk = -1, lastSt = false;
    return {
      ...base, grip: "flat",
      handles: { grip: [0, 0, 0], hold: [-0.09, 0.004, 0.06] },
      surface: (px, py, lift = 0) => [(px / CW - 0.5) * PW, 0.0012 + lift, (py / CH - 0.5) * PH],
      paths: sig ? { signature: sig } : {},
      setInk(u, st = false) {
        const q = Math.round(u * 120) / 120;
        if (q === lastInk && st === lastSt) return;
        lastInk = q; lastSt = st;
        draw(q, st); t.needsUpdate = true;
      },
    };
  }

  if (k === "shirt") {
    // a flat shirt, its BACK to +z (the name and number to the camera when held up)
    const W = 0.56, H = 0.7;
    const c = canvas(512, 640);
    drawShirt(c, shirt, trim, spec.number ?? txt.number, (spec.label ?? txt.surname).toUpperCase());
    const s = new T.Shape();
    const p = (x: number, y: number) => [(x - 0.5) * W, (0.5 - y) * H] as [number, number];
    const pts: [number, number][] = [[0.33, 0], [0.42, 0.05], [0.58, 0.05], [0.67, 0], [0.98, 0.12], [1.0, 0.32], [0.81, 0.33], [0.79, 1], [0.21, 1], [0.19, 0.33], [0.0, 0.32], [0.02, 0.12]];
    pts.forEach(([x, y], i) => { const [a, b] = p(x, y); if (i) s.lineTo(a, b); else s.moveTo(a, b); });
    s.closePath();
    const geo = new T.ShapeGeometry(s, 4);
    // UVs from position
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / H + 0.5);
    const front = new T.Mesh(geo, mat("#ffffff", { map: tex(c), side: T.DoubleSide, rough: 0.8 }));
    front.castShadow = true; g.add(front); disp.push(geo);
    // a gentle hang: the bottom sways back (bend by vertex)
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, -Math.max(0, -y) * 0.08 + Math.cos(pos.getX(i) * 6) * 0.006); }
    pos.needsUpdate = true; geo.computeVertexNormals();
    return { ...base, grip: "pinch", handles: { L: [W * 0.29, H * 0.42, 0], R: [-W * 0.29, H * 0.42, 0], grip: [0, H * 0.42, 0] } };
  }

  if (k === "trophy-cup" || k === "trophy-league" || k === "award-statue") {
    // origin between the hands; the cup stands on +y
    if (k === "award-statue") {
      const m = gold();
      mesh(new T.CylinderGeometry(0.05, 0.06, 0.08, 24), mat("#1b1b1f", { rough: 0.3 }), 0, -0.02, 0);
      mesh(new T.CylinderGeometry(0.018, 0.03, 0.12, 16), m, 0, 0.08, 0);
      mesh(new T.SphereGeometry(0.075, 24, 16), m, 0, 0.21, 0);
      return { ...base, grip: "grip", handles: { L: [0.05, -0.02, 0], R: [-0.05, -0.02, 0], grip: [0, 0, 0] } };
    }
    const m = k === "trophy-league" ? silver() : silver();
    const accent = gold();
    const prof = k === "trophy-cup"
      ? [[0.001, -0.17], [0.075, -0.17], [0.075, -0.14], [0.05, -0.12], [0.03, -0.06], [0.03, 0.0], [0.06, 0.04], [0.12, 0.12], [0.15, 0.24], [0.155, 0.31], [0.14, 0.33], [0.001, 0.33]]
      : [[0.001, -0.2], [0.11, -0.2], [0.11, -0.13], [0.07, -0.1], [0.05, 0.02], [0.08, 0.12], [0.09, 0.24], [0.06, 0.3], [0.001, 0.3]];
    const lathe = new T.LatheGeometry(prof.map(([x, y]) => new T.Vector2(x, y)), 36);
    mesh(lathe, m, 0, 0, 0);
    if (k === "trophy-cup") {
      for (const s of [-1, 1]) {
        const h = new T.Mesh(new T.TorusGeometry(0.075, 0.012, 10, 24, Math.PI * 1.25), m);
        h.position.set(s * 0.16, 0.17, 0); h.rotation.z = s > 0 ? -Math.PI * 0.62 : Math.PI * 0.38;
        h.castShadow = true; g.add(h); disp.push(h.geometry);
      }
      mesh(new T.CylinderGeometry(0.157, 0.157, 0.02, 36), accent, 0, 0.3, 0);
      mesh(new T.CylinderGeometry(0.078, 0.078, 0.025, 36), accent, 0, -0.135, 0);
      // ribbons in the club's colours
      for (const [s, col] of [[-1, shirt], [1, trim]] as const) {
        const r = new T.Mesh(new T.BoxGeometry(0.03, 0.22, 0.004), mat(col, { side: T.DoubleSide }));
        r.position.set(s * 0.21, 0.04, 0.02); r.rotation.z = s * 0.15; g.add(r); disp.push(r.geometry);
      }
      return { ...base, grip: "grip", handles: { L: [0.235, 0.17, 0], R: [-0.235, 0.17, 0], grip: [0, 0, 0] } };
    }
    // league: a crown on top
    const crown = gold();
    mesh(new T.CylinderGeometry(0.075, 0.06, 0.07, 24, 1, true), crown, 0, 0.34, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; mesh(new T.ConeGeometry(0.014, 0.05, 6), crown, Math.sin(a) * 0.07, 0.4, Math.cos(a) * 0.07); }
    mesh(new T.SphereGeometry(0.02, 12, 8), crown, 0, 0.3, 0);
    return { ...base, grip: "grip", handles: { L: [0.1, -0.08, 0], R: [-0.1, -0.08, 0], grip: [0, 0, 0] } };
  }

  if (k === "mic" || k === "mic-stand") {
    const black = mat("#141414", { rough: 0.4, metal: 0.3 });
    if (k === "mic") {
      mesh(new T.CylinderGeometry(0.016, 0.012, 0.18, 14), black, 0, 0.05, 0);
      mesh(new T.SphereGeometry(0.027, 16, 12), mat("#3a3a3a", { rough: 0.6, metal: 0.5 }), 0, 0.16, 0);
      const fc = canvas(128, 64); const fg = fc.getContext("2d")!;
      fg.fillStyle = shirt; fg.fillRect(0, 0, 128, 64); fg.fillStyle = trim; fg.fillRect(0, 44, 128, 20);
      mesh(new T.BoxGeometry(0.055, 0.045, 0.055), mat("#ffffff", { map: tex(fc) }), 0, 0.12, 0);
      return { ...base, grip: "grip", handles: { grip: [0, 0, 0], tip: [0, 0.16, 0] } };
    }
    mesh(new T.CylinderGeometry(0.04, 0.05, 0.015, 18), black, 0, 0.007, 0);
    const neck = mesh(new T.CylinderGeometry(0.004, 0.004, 0.24, 8), black, 0, 0.12, 0.03); neck.rotation.x = -0.35;
    mesh(new T.SphereGeometry(0.02, 12, 8), black, 0, 0.23, 0.07);
    return { ...base, handles: { grip: [0, 0, 0] } };
  }

  if (k === "phone") {
    mesh(new T.BoxGeometry(0.072, 0.15, 0.008), mat("#111214", { rough: 0.25, metal: 0.4 }), 0, 0.06, 0);
    mesh(new T.PlaneGeometry(0.066, 0.142), new T.MeshBasicMaterial({ color: "#7aa7e0" }), 0, 0.06, 0.0045);
    return { ...base, grip: "grip", handles: { grip: [0, 0, 0] } };
  }

  if (k === "scarf") {
    const c = canvas(512, 64); const sg = c.getContext("2d")!;
    for (let i = 0; i < 16; i++) { sg.fillStyle = i % 2 ? trim : shirt; sg.fillRect(i * 32, 0, 32, 64); }
    sg.fillStyle = trim; sg.font = "900 34px system-ui"; sg.textAlign = "center"; sg.fillStyle = "rgba(255,255,255,0.9)";
    const L = 1.3;
    const geo = new T.PlaneGeometry(L, 0.17, 24, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setY(i, pos.getY(i) - (1 - (2 * x / L) ** 2) * 0.12); }
    geo.computeVertexNormals();
    const me = new T.Mesh(geo, mat("#ffffff", { map: tex(c), side: T.DoubleSide })); me.castShadow = true; g.add(me); disp.push(geo);
    return { ...base, grip: "grip", handles: { L: [L * 0.46, 0, 0], R: [-L * 0.46, 0, 0], grip: [0, 0, 0] } };
  }

  if (k === "ball") {
    const s = mesh(new T.SphereGeometry(0.11, 24, 16), mat("#fbfbf8", { rough: 0.45 }), 0, 0, 0); void s;
    const patch = mat("#1d1f24", { rough: 0.5 });
    for (const [a, b] of [[0, 0], [1.2, 0.9], [2.4, -0.7], [3.6, 1.1], [4.8, -0.2], [0.6, -1.3], [3.0, -1.2], [1.8, 0.2]]) {
      const p = new T.Mesh(new T.CircleGeometry(0.036, 5), patch);
      const v = new T.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
      p.position.copy(v.multiplyScalar(0.1105)); p.lookAt(v.clone().multiplyScalar(2)); g.add(p); disp.push(p.geometry);
    }
    return { ...base, grip: "grip", handles: { grip: [0, 0, 0] } };
  }

  if (k === "champagne") {
    const glass = mat("#174d2a", { rough: 0.15, metal: 0.2 });
    const prof = [[0.001, -0.05], [0.04, -0.05], [0.042, 0.12], [0.03, 0.17], [0.014, 0.21], [0.014, 0.27], [0.001, 0.27]];
    mesh(new T.LatheGeometry(prof.map(([x, y]) => new T.Vector2(x, y)), 20), glass);
    mesh(new T.CylinderGeometry(0.0155, 0.02, 0.07, 16), gold(), 0, 0.24, 0);
    mesh(new T.CylinderGeometry(0.0425, 0.0425, 0.06, 20), mat("#f3ead2"), 0, 0.06, 0);
    return { ...base, grip: "grip", handles: { grip: [0, 0, 0], tip: [0, 0.28, 0] } };
  }

  if (k === "camera") {
    mesh(new T.BoxGeometry(0.14, 0.1, 0.08), mat("#18191c", { rough: 0.5 }), 0, 0.03, 0);
    const lens = mesh(new T.CylinderGeometry(0.035, 0.04, 0.12, 16), mat("#0e0e10", { rough: 0.3 }), 0, 0.02, 0.09); lens.rotation.x = Math.PI / 2;
    return { ...base, grip: "grip", handles: { grip: [0, 0, 0], L: [0.07, 0, 0], R: [-0.07, 0, 0] } };
  }

  if (k === "medal") {
    mesh(new T.CylinderGeometry(0.035, 0.035, 0.006, 24), gold(), 0, 0, 0).rotation.x = Math.PI / 2;
    mesh(new T.BoxGeometry(0.025, 0.25, 0.003), mat(shirt), 0, 0.13, -0.01);
    return { ...base, handles: { grip: [0, 0, 0] } };
  }

  if (k === "flag" || k === "corner-flag") {
    const pole = k === "flag" ? 1.6 : 1.5;
    mesh(new T.CylinderGeometry(0.012, 0.012, pole, 8), mat("#f4f4f4"), 0, pole / 2, 0);
    const geo = new T.PlaneGeometry(k === "flag" ? 0.9 : 0.42, k === "flag" ? 0.6 : 0.32, 12, 4);
    const cloth = new T.Mesh(geo, mat(k === "flag" ? shirt : "#e63946", { side: T.DoubleSide }));
    const w = k === "flag" ? 0.9 : 0.42;
    cloth.position.set(w / 2, pole - (k === "flag" ? 0.3 : 0.16), 0); g.add(cloth); disp.push(geo);
    const p0 = Float32Array.from(geo.attributes.position.array as Float32Array);
    return {
      ...base, grip: "grip", handles: { grip: [0, 0.6, 0] },
      update(t) {
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++) { const x = p0[i * 3] + w / 2; pa.setZ(i, Math.sin(x * 7 - t * 6) * 0.05 * x / w); }
        pa.needsUpdate = true;
      },
    };
  }

  if (k === "clipboard") {
    mesh(new T.BoxGeometry(0.23, 0.31, 0.01), mat("#7a5230"), 0, 0.12, 0);
    mesh(new T.PlaneGeometry(0.2, 0.26), mat("#f7f3ea"), 0, 0.11, 0.0055);
    return { ...base, grip: "grip", handles: { grip: [0, 0, 0] } };
  }
  if (k === "water-bottle") {
    mesh(new T.CylinderGeometry(0.035, 0.035, 0.2, 16), mat(shirt), 0, 0.06, 0);
    mesh(new T.CylinderGeometry(0.015, 0.025, 0.04, 12), mat("#f4f4f4"), 0, 0.18, 0);
    return { ...base, grip: "grip", handles: { grip: [0, 0, 0] } };
  }
  if (k === "boots") {
    for (const s of [-1, 1]) mesh(new T.BoxGeometry(0.09, 0.08, 0.27), mat(spec.color ?? "#e8e8e8", { rough: 0.35 }), s * 0.06, 0.04, 0);
    return { ...base, handles: { grip: [0, 0.08, 0] } };
  }
  if (k === "bag") {
    mesh(new T.BoxGeometry(0.5, 0.26, 0.24), mat(spec.color ?? "#1f2433", { rough: 0.6 }), 0, -0.2, 0);
    return { ...base, grip: "grip", handles: { grip: [0, 0, 0] } };
  }
  if (k === "armband") {
    const r = new T.Mesh(new T.TorusGeometry(0.055, 0.02, 8, 18), mat("#fbbf24")); g.add(r); disp.push(r.geometry);
    return { ...base, handles: { grip: [0, 0, 0] } };
  }
  // anything else: a small box so a missing prop is visible, not invisible
  mesh(new T.BoxGeometry(0.1, 0.1, 0.1), mat("#ff00ff"));
  return base;
}

/** The contract, drawn from the career; the signature as far as the pen has got. */
function drawContract(c: HTMLCanvasElement, t: PropText, sig: Signature | undefined, ink: number, stamped: boolean, SIG: { x: number; y: number; w: number; h: number }) {
  const CW = c.width, CH = c.height;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, "#fbf8f0"); bg.addColorStop(1, "#efe7d4");
  g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
  g.strokeStyle = "rgba(160,120,40,.55)"; g.lineWidth = 6; g.strokeRect(14, 14, CW - 28, CH - 28);
  g.fillStyle = t.shirt; g.fillRect(14, 14, CW - 28, 18); g.fillStyle = t.trim; g.fillRect(14, 32, CW - 28, 6);
  g.textAlign = "center"; g.fillStyle = "#8a6a23"; g.font = "bold 22px Georgia, serif"; g.fillText("PROFESSIONAL CONTRACT", CW / 2, 84);
  g.fillStyle = "#1b140a";
  let size = 56; g.font = `900 ${size}px Georgia, serif`;
  while (g.measureText(t.club).width > CW - 80 && size > 26) { size -= 2; g.font = `900 ${size}px Georgia, serif`; }
  g.fillText(t.club, CW / 2, 150);
  g.font = "italic 22px Georgia, serif"; g.fillStyle = "#4b3b20"; g.fillText(`between the club and ${t.player}`, CW / 2, 188);
  g.textAlign = "left";
  let y = 250;
  for (const [label, value] of t.rows) {
    g.fillStyle = "#6b5630"; g.font = "bold 22px Georgia, serif"; g.fillText(label.toUpperCase(), 60, y);
    g.fillStyle = "#1b140a"; g.font = "900 34px Georgia, serif"; g.textAlign = "right"; g.fillText(value, CW - 60, y + 2); g.textAlign = "left";
    g.strokeStyle = "rgba(59,47,28,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(60, y + 16); g.lineTo(CW - 60, y + 16); g.stroke();
    y += 62;
  }
  g.strokeStyle = "rgba(59,47,28,.8)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(50, 770); g.lineTo(290, 770); g.moveTo(330, 770); g.lineTo(590, 770); g.stroke();
  g.fillStyle = "#5b4a2c"; g.font = "bold 18px Georgia, serif";
  g.fillText(`FOR ${t.club.toUpperCase()}`.slice(0, 24), 50, 796); g.fillText(t.player.toUpperCase().slice(0, 24), 330, 796);
  // the club's signature (already there): a quick scrawl
  const R = rng(hashStr(t.manager));
  g.strokeStyle = "#1e3a8a"; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
  for (let i = 0; i <= 40; i++) { const k = i / 40; const x = 60 + k * 200, yy = 745 - Math.sin(k * 22 + R.next()) * 12 * (1 - k * 0.6) - (i < 6 ? (6 - i) * 4 : 0); if (i) g.lineTo(x, yy); else g.moveTo(x, yy); }
  g.stroke();
  if (sig && ink > 0) {
    // ink along the strokes up to `ink` of the TIME (signatureAt), so the line ends at the nib
    const at = signatureAt(sig, ink);
    let left = at.ink * sig.total;
    g.strokeStyle = "#0b1020"; g.lineWidth = 4.5;
    for (const s of sig.strokes) {
      if (left <= 0) break;
      g.beginPath();
      for (let i = 0; i < s.length; i++) {
        const px = SIG.x + (s[i][0] / 300) * SIG.w, py = SIG.y + (s[i][1] / 60) * SIG.h;
        if (i === 0) { g.moveTo(px, py); continue; }
        const d = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        if (d > left) { const f = left / d; g.lineTo(SIG.x + ((s[i - 1][0] + (s[i][0] - s[i - 1][0]) * f) / 300) * SIG.w, SIG.y + ((s[i - 1][1] + (s[i][1] - s[i - 1][1]) * f) / 60) * SIG.h); left = 0; break; }
        g.lineTo(px, py); left -= d;
      }
      g.stroke();
    }
  } else {
    g.fillStyle = "#b45309"; g.font = "bold 20px system-ui, sans-serif"; g.fillText("✕ sign here", SIG.x + 6, 755);
  }
  if (stamped) {
    g.save(); g.translate(CW / 2 + 70, 560); g.rotate(-0.16);
    g.strokeStyle = "rgba(190,24,40,.85)"; g.lineWidth = 9; g.strokeRect(-150, -48, 300, 96);
    g.fillStyle = "rgba(190,24,40,.85)"; g.textAlign = "center"; g.font = "900 64px system-ui, sans-serif"; g.fillText("SIGNED", 0, 24);
    g.restore();
  }
}

/** A shirt's back: the club colours, trim on the collar and cuffs, the name and number. */
function drawShirt(c: HTMLCanvasElement, shirt: string, trim: string, num: number, name: string) {
  const g = c.getContext("2d")!;
  const W = c.width, H = c.height;
  g.fillStyle = shirt; g.fillRect(0, 0, W, H);
  // folds
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, "rgba(0,0,0,0.18)"); gr.addColorStop(0.25, "rgba(255,255,255,0.06)"); gr.addColorStop(0.5, "rgba(0,0,0,0)"); gr.addColorStop(0.78, "rgba(255,255,255,0.05)"); gr.addColorStop(1, "rgba(0,0,0,0.2)");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = trim; g.fillRect(W * 0.38, 0, W * 0.24, H * 0.05);
  g.fillRect(0, H * 0.28, W * 0.2, H * 0.04); g.fillRect(W * 0.8, H * 0.28, W * 0.2, H * 0.04);
  g.textAlign = "center"; g.fillStyle = trim;
  let fs = 52; g.font = `900 ${fs}px system-ui, sans-serif`;
  while (g.measureText(name).width > W * 0.56 && fs > 22) { fs -= 2; g.font = `900 ${fs}px system-ui, sans-serif`; }
  g.fillText(name, W / 2, H * 0.24);
  g.font = "900 230px system-ui, sans-serif"; g.lineWidth = 8; g.strokeStyle = "rgba(0,0,0,0.25)";
  g.strokeText(String(num), W / 2, H * 0.62); g.fillText(String(num), W / 2, H * 0.62);
}
