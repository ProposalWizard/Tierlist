/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H's BALL — a match ball you can read at phone size:
 *   - its own panel design (white, navy swirls, a red trim; our own, no brand)
 *     on a smooth, slightly glossy sphere
 *   - a soft contact shadow and a faint light ring on the grass under it, so
 *     it never gets lost in the stripes
 *   - a short motion streak behind a hard-struck ball (motion blur, cheaply)
 */
function ballCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f7f7f4"; g.fillRect(0, 0, 512, 256);
  // six swirling panels, each a navy blade with a red edge
  for (let i = 0; i < 6; i++) {
    const cx = (i / 6) * 512 + 40, cy = i % 2 ? 80 : 176;
    for (const dx of [-512, 0, 512]) {
      g.save(); g.translate(cx + dx, cy); g.rotate(i % 2 ? 0.5 : -0.5);
      g.fillStyle = "#1b2a5c";
      g.beginPath(); g.moveTo(-46, -8); g.bezierCurveTo(-20, -40, 30, -36, 52, -6); g.bezierCurveTo(26, -18, -10, -16, -46, 14); g.closePath(); g.fill();
      g.fillStyle = "#d62839";
      g.beginPath(); g.moveTo(-40, 10); g.bezierCurveTo(-10, -10, 22, -14, 46, -4); g.bezierCurveTo(20, -6, -8, 2, -34, 18); g.closePath(); g.fill();
      g.restore();
    }
  }
  // panel seams
  g.strokeStyle = "rgba(40,40,50,0.35)"; g.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo((i / 8) * 512, 0); g.bezierCurveTo((i / 8) * 512 + 30, 90, (i / 8) * 512 - 30, 170, (i / 8) * 512, 256); g.stroke(); }
  g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();
  return c;
}

function softDisc(T: any, inner: string, outer: string) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(0.55, inner.replace(/[\d.]+\)$/, "0.45)")); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  return t;
}

function ringTex(T: any) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 14, 32, 32, 31);
  gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.55, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  return t;
}

export interface HBall {
  /** Call after play3d has placed the ball (its group), each frame. */
  update(dt: number, vel: { x: number; y: number; z: number }): void;
  setNight(on: boolean): void;
  dispose(): void;
}

/** Dress play3d's ball group in look H (its own patches hidden, a textured sphere instead). */
export function dressHBall(T: any, ball: any, root: any): HBall {
  const tex = new T.CanvasTexture(ballCanvas());
  tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new T.MeshPhysicalMaterial({ map: tex, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: new T.Color("#ffffff"), emissiveIntensity: 0.06 });
  const sphere = new T.Mesh(new T.SphereGeometry(0.11, 32, 20), mat);
  sphere.castShadow = true;
  const hidden: any[] = [];
  for (const ch of ball.children) { if (ch.visible) { ch.visible = false; hidden.push(ch); } }
  ball.add(sphere);
  // shadow + light ring on the grass, and the streak
  const shTex = softDisc(T, "rgba(0,0,0,0.8)", "rgba(0,0,0,0)");
  const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.55 }));
  shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 2;
  const rTex = ringTex(T);
  const ring = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: rTex, transparent: true, depthWrite: false, opacity: 0.22, blending: T.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 2;
  const stTex = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 8;
    const g = c.getContext("2d")!; const gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,0.75)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 8);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  })();
  const streak = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: stTex, transparent: true, depthWrite: false, opacity: 0.6 }));
  streak.renderOrder = 3;
  root.add(shadow, ring, streak);
  const tmp = new T.Vector3();
  return {
    update(_dt, vel) {
      const p = ball.getWorldPosition(tmp);
      const s = ball.scale.x;
      const k = Math.max(0.3, 1 - p.y / 5);
      shadow.position.set(p.x, 0.012, p.z); shadow.scale.setScalar(0.42 * s * (1.4 - k * 0.4)); shadow.material.opacity = 0.55 * k;
      ring.position.set(p.x, 0.014, p.z); ring.scale.setScalar(0.62 * s); ring.material.opacity = 0.2 * k;
      const sp = Math.hypot(vel.x, vel.y, vel.z);
      streak.visible = sp > 12;
      if (streak.visible) {
        const len = Math.min(3.5, (sp - 10) * 0.12) * s;
        // a flat card along the flight, facing up-ish (the camera is above)
        streak.position.set(p.x - (vel.x / sp) * len * 0.5, p.y, p.z - (vel.z / sp) * len * 0.5);
        streak.rotation.set(-Math.PI / 2, 0, -Math.atan2(vel.z, vel.x));
        streak.scale.set(len, 0.2 * s, 1);
        streak.material.opacity = Math.min(0.55, (sp - 12) * 0.05);
      }
    },
    setNight(on) { mat.emissiveIntensity = on ? 0.1 : 0.06; },
    dispose() {
      root.remove(shadow, ring, streak);
      ball.remove(sphere);
      for (const h of hidden) h.visible = true;
      for (const m of [shadow, ring, streak, sphere]) { m.geometry.dispose(); m.material.dispose(); }
      tex.dispose(); shTex.dispose(); rTex.dispose(); stTex.dispose();
    },
  };
}
