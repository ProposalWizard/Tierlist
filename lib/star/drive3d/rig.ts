/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A DRIVE CAR'S PARTS (driving phase 1-2, 28 Nov 2026): a cut-wheel car (tools/cars/cut_wheels.py,
 * public/star/drive3d/car-<id>.glb) split into its body (under a tilt group: roll, pitch) and its four
 * wheels (on the root: they stay on the road; the fronts steer). Used by the drive (./scene.ts) and the
 * arrival at the real compound (lib/star/world3d/testScene.ts, ./arrival.ts).
 */
/** Your car's parts: the body under a tilt group (roll, pitch), the wheels on the root (they stay on the road). */
export function rigCar(T: any, root: any) {
  const out = new T.Group();
  const tilt = new T.Group();
  out.add(tilt);
  const wheels: { node: any; front: boolean }[] = [];
  const kids = [...root.children];
  let body: any = null;
  for (const k of kids) {
    if (/^wheel_/.test(k.name)) { k.rotation.order = "YXZ"; out.add(k); wheels.push({ node: k, front: /^wheel_F/.test(k.name) }); }
    else { tilt.add(k); if (!body) body = k; }
  }
  const box = new T.Box3().setFromObject(tilt);
  const fz = wheels.filter((w) => w.front).map((w) => w.node.position.z), rz = wheels.filter((w) => !w.front).map((w) => w.node.position.z);
  const wheelbase = fz.length && rz.length ? Math.abs(fz.reduce((a, b) => a + b, 0) / fz.length - rz.reduce((a, b) => a + b, 0) / rz.length) : 2.6;
  const wheelR = wheels.length ? wheels.reduce((a, w) => a + w.node.position.y, 0) / wheels.length : 0.4;
  return { root: out, tilt, body: tilt, wheels, wheelbase, wheelR, width: box.max.x - box.min.x, length: box.max.z - box.min.z };
}

