/**
 * THE HOME PLAYER'S LITTLE SET (B5, 20 Oct 2026): a soft shadow under his
 * boots so he stands on the grass instead of floating over the stadium
 * picture, and his own ball — at rest by his right foot, kept up on his feet
 * in the keepy-uppies along the clip's own measured touches (football.glb
 * juggle `touches`), flicked up and dropped back as the move starts and ends.
 * Two small draws (the shadows share one picture) and a ball of seven.
 */
import type * as THREE from "three";
import type { Person3D } from "./people3d";
import type { ClipInfo } from "./three3d/footballAnims";
import { HOME_BALL_REST } from "./homeIdle";

type Three = typeof import("three");
type V3 = [number, number, number];

/** Where his ball is in the keepy-uppies at time t of the loop (his frame: x his left, y up, z ahead), or null. */
export function juggleSpot(info: ClipInfo | null | undefined, t: number): V3 | null {
  const tch = (info as { touches?: [number, string, V3][] } | null | undefined)?.touches;
  if (!info || !tch || tch.length < 2) return null;
  const per = info.duration;
  const tm = ((t % per) + per) % per;
  let i = tch.length - 1;
  for (let k = 0; k < tch.length; k++) if (tm >= tch[k][0]) i = k;
  const a = tch[i], b = tch[(i + 1) % tch.length];
  const ta = a[0], tb = b[0] + (b[0] <= ta ? per : 0);
  const tt = tm < ta ? tm + per : tm;
  const u = (tt - ta) / (tb - ta), T = tb - ta;
  const pa = a[2], pb = b[2];
  return [pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u + ((9.8 * T * T) / 2) * u * (1 - u), pa[2] + (pb[2] - pa[2]) * u];
}

export function makeHomeSet(T: Three, scene: THREE.Scene) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.55, "rgba(0,0,0,0.26)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tex = new T.CanvasTexture(c);
  const blob = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const shadow = new T.Mesh(new T.PlaneGeometry(0.95, 0.62), blob);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.003; shadow.renderOrder = -1;
  const ballShadow = new T.Mesh(new T.PlaneGeometry(0.3, 0.3), blob);
  ballShadow.rotation.x = -Math.PI / 2; ballShadow.position.y = 0.004; ballShadow.renderOrder = -1;
  const ball = new T.Group();
  const bm = new T.MeshStandardMaterial({ color: "#fbfbf8", roughness: 0.45 });
  const pm = new T.MeshStandardMaterial({ color: "#1d1f24", roughness: 0.5 });
  ball.add(new T.Mesh(new T.SphereGeometry(0.11, 20, 14), bm));
  for (const [a, b] of [[0, 0], [1.2, 0.9], [2.4, -0.7], [3.6, 1.1], [4.8, -0.2], [0.6, -1.3]]) {
    const m = new T.Mesh(new T.CircleGeometry(0.038, 5), pm);
    const v = new T.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
    m.position.copy(v.clone().multiplyScalar(0.1105)); m.lookAt(v.multiplyScalar(2));
    ball.add(m);
  }
  scene.add(shadow, ballShadow, ball);
  const hp = new T.Vector3();
  return {
    /** Each frame, after he is posed: his shadow under his hips, the ball `juggle` (0 rest … 1 kept up) of the way to `up`. */
    place(p: Person3D, yaw: number, juggle: number, up: V3, t: number) {
      const r = HOME_BALL_REST, k = Math.max(0, Math.min(1, juggle));
      // the flick up and the drop: an arc between the ground and the touches
      const arc = k > 0 && k < 1 ? Math.sin(k * Math.PI) * 0.25 : 0;
      const lx = r[0] + (up[0] - r[0]) * k, ly = r[1] + (up[1] - r[1]) * k + arc, lz = r[2] + (up[2] - r[2]) * k;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      ball.position.set(p.root.position.x + lx * cy + lz * sy, Math.max(0.11, ly), p.root.position.z - lx * sy + lz * cy);
      ball.rotation.x = t * (1.5 + 7 * k);
      ballShadow.position.set(ball.position.x, 0.004, ball.position.z);
      ballShadow.scale.setScalar(Math.max(0.45, 1.1 - (ball.position.y - 0.11) * 0.8));
      p.bones.Hips?.getWorldPosition(hp);
      shadow.position.set(hp.x, 0.003, hp.z);
    },
    dispose() {
      scene.remove(shadow, ballShadow, ball);
      shadow.geometry.dispose(); ballShadow.geometry.dispose(); blob.dispose(); tex.dispose(); bm.dispose(); pm.dispose();
      ball.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    },
  };
}
