let __n = 0; const __ab = () => { const blk = Math.floor(__n / 3) % 2; __M.tag = (blk ? 'B' : 'A') + (__n % 3 === 0 ? '*' : ''); __n++; return blk === 1; };
// stand by the bench looking at the team-mates; B hides every body but yours (impostor upper bound)
__M.hook = (r, scene, cam) => {
  if (!__M.placed) { if (!__M.ctrl) return; __M.ctrl.place(6.0, 2.2, Math.PI / 2); __M.placed = performance.now(); return; }
  if (performance.now() - __M.placed < 1500) return;
  if (!__M.roots) { const roots = new Map(); scene.traverse((o) => { if (o.isSkinnedMesh) { let p = o; while (p.parent && p.parent !== scene) p = p.parent; roots.set(p, 1); } });
    const list = [...roots.keys()].map((p) => { const v = new THREE.Vector3(); p.getWorldPosition(v); return [p, v.distanceTo(cam.position)]; }).sort((a, b) => a[1] - b[1]);
    __M.roots = list.slice(1).map(([p]) => p); __M.extra = { bodies: list.length, hidden: list.length - 1 }; }
  const b = __ab(); for (const p of __M.roots) p.traverse((o) => o.layers.set(b ? 5 : 0));
};
