/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LAG: join every still piece of a 3D scene into as few draws as possible
 * (the 3D garden and the 3D shop). Every mesh that never moves is joined with
 * the others of the same material in the same group, so a stable built of
 * thirty little boxes draws in two or three calls. The picture is exactly
 * the same; a phone's cost per draw call is what goes.
 *
 * `keep`: things that move or change on their own (people, the fountain's
 * fading top, ...) and everything under them are left alone. Pieces that are
 * hidden, skinned, instanced or multi-material are left alone too.
 * Returns how many meshes went and how many came back.
 */
export function freezeStatic(THREE: any, mergeGeometries: (g: any[]) => any, root: any, keep: Set<any>): { before: number; after: number } {
  const groups = new Map<string, any[]>();
  const skip = (o: any) => { for (let p = o; p; p = p.parent) if (keep.has(p)) return true; return false; };
  let next = 0;
  const ids = new Map<any, number>();
  const idOf = (x: any) => { if (!ids.has(x)) ids.set(x, next++); return ids.get(x)!; };
  // Two materials made separately but set the same (the garden makes a new
  // one for every little box) count as one, so their pieces join too.
  const sameAs = new Map<string, any>();
  const matKey = (m: any): any => {
    if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || m.userData?.keep) return m;
    const c = (x: any) => (x?.getHexString ? x.getHexString() : "");
    const k = [m.type, c(m.color), c(m.emissive), m.emissiveIntensity, m.roughness, m.metalness, m.map?.uuid, m.normalMap?.uuid, m.transparent, m.opacity,
      m.side, m.depthWrite, m.depthTest, m.flatShading, m.vertexColors, m.toneMapped, m.fog, m.envMapIntensity, m.alphaTest, m.blending, m.polygonOffset].join(",");
    if (!sameAs.has(k)) sameAs.set(k, m);
    return sameAs.get(k);
  };
  root.updateMatrixWorld(true);
  root.traverse((o: any) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.visible || Array.isArray(o.material) || o.morphTargetInfluences || skip(o)) return;
    if (!o.parent || o.children.length || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    const key = [idOf(o.parent), idOf(matKey(o.material)), o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.renderOrder, o.layers.mask, o.frustumCulled ? 1 : 0].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  });
  let before = 0, after = 0;
  groups.forEach((list) => {
    if (list.length < 2) return;
    const hasUv = list.every((o) => !!o.geometry.attributes.uv);
    const geos = list.map((o) => {
      o.updateMatrix();
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!(k === "position" || k === "normal" || (k === "uv" && hasUv))) g.deleteAttribute(k);
      for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
      if (!g.attributes.normal) g.computeVertexNormals();
      g.clearGroups();
      return g.applyMatrix4(o.matrix);
    });
    const merged = mergeGeometries(geos);
    if (!merged) return;
    const f = list[0];
    const me = new THREE.Mesh(merged, matKey(f.material));
    me.castShadow = f.castShadow; me.receiveShadow = f.receiveShadow; me.renderOrder = f.renderOrder; me.layers.mask = f.layers.mask;
    me.frustumCulled = f.frustumCulled;
    f.parent.add(me);
    // the originals' geometry may be shared with pieces still in use: not disposed
    for (const o of list) o.parent.remove(o);
    for (const g of geos) g.dispose();
    before += list.length; after++;
  });
  return { before, after };
}
