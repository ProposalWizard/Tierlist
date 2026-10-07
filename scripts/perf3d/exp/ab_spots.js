// The 3D shop's lights, same page: A = the New shop (2 real lights + painted
// pools), B = the six spotlights as they were before 7 Oct 2026 (the pools
// hidden). Run: node drive.mjs shop '{}' --exp=ab_spots --steady=30000
let __n = 0; const __ab = () => { const blk = Math.floor(__n / 3) % 2; __M.tag = (blk ? 'B' : 'A') + (__n % 3 === 0 ? '*' : ''); __n++; return blk === 1; };
__M.hook = (r, scene) => {
  if (!__M.ctrl) return;
  if (!__M.spots) {
    const T = THREE, h = 3.6, CAR = { x: 2.35, z: -1.75 }, PX = -4.55, PH = 0.92, CZ = -6.45;
    const mk = (c, p, x, y, z, tx, ty, tz, a, pen, d) => { const s = new T.SpotLight(c, p, d, a, pen, 2); s.position.set(x, y, z); s.target.position.set(tx, ty, tz); scene.add(s, s.target); s.visible = false; return s; };
    const old = [mk('#d9e8ff', 45, CAR.x + 3.2, h - 0.1, CAR.z + 3.0, CAR.x, 0.6, CAR.z, 0.55, 0.7, 10)];
    for (const z of [-2.2, 0, 2.2]) old.push(mk('#ffdcae', 70, -2.7, h - 0.08, z, PX, PH, z, 0.62, 0.55, 8));
    old.push(mk('#ffe6c2', 70, 0, h - 0.08, -4.4, 0, 1.2, CZ - 0.6, 1.0, 0.6, 9));
    const wide = []; const pools = [];
    scene.traverse((o) => { if (o.isSpotLight && o.intensity === 125) wide.push(o); if (o.isMesh && o.material && o.material.blending === T.AdditiveBlending) pools.push(o); });
    __M.spots = { old, wide, pools };
    __M.extra = { oldAdded: old.length, wide: wide.length, pools: pools.length };
  }
  const b = __ab();
  for (const s of __M.spots.old) s.visible = b;
  for (const s of __M.spots.wide) s.visible = !b;
  for (const p of __M.spots.pools) p.visible = !b;
};
