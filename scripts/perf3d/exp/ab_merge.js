let __n = 0; const __ab = () => { const blk = Math.floor(__n / 3) % 2; __M.tag = (blk ? 'B' : 'A') + (__n % 3 === 0 ? '*' : ''); __n++; return blk === 1; };
__M.hook = (r, scene) => {
  if (!__M.mg) { scene.updateMatrixWorld(true); const groups = new Map(); const orig = [];
    scene.traverse((m) => { if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || Array.isArray(m.material) || !m.visible) return;
      for (let p = m; p; p = p.parent) if (p.isBone || p.isSkinnedMesh) return;
      const key = m.material.uuid + '|' + Object.keys(m.geometry.attributes).sort().join(',') + (m.geometry.index ? 'i' : 'n') + (m.castShadow ? 1 : 0);
      (groups.get(key) || groups.set(key, []).get(key)).push(m); });
    const merged = [];
    for (const list of groups.values()) { if (list.length < 2) continue;
      const g = mergeGeometries(list.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld)), false); if (!g) continue;
      const one = new THREE.Mesh(g, list[0].material); one.castShadow = list[0].castShadow; one.receiveShadow = list[0].receiveShadow; one.visible = false; one.matrixAutoUpdate = false; scene.add(one); merged.push(one); orig.push(...list); }
    __M.mg = { merged, orig }; __M.extra = { merged: merged.length, from: orig.length }; }
  const b = __ab(); for (const m of __M.mg.orig) m.visible = !b; for (const m of __M.mg.merged) m.visible = b;
};
