// Keyframed clips on the people3d skeleton. Each clip is a list of POSES, one
// per baked frame. A pose turns bones about the BASE pose's own world axes
// (base = the idle clip's first frame; he faces +z, his left is +x, y is up),
// in degrees, plus hip offsets in metres.
export function installClips(THREE, chars, win) {
  const D = Math.PI / 180;
  let base = null;
  function baseOf(ch) {
    const idle = win.__anims.find((a) => a.name === "idle");
    ch.mixer.stopAllAction(); ch.mixer.uncacheRoot(ch.inner);
    ch.inner.traverse((o) => { if (o.isBone && o.userData.rest) { o.position.copy(o.userData.rest.p); o.quaternion.copy(o.userData.rest.q); } });
    ch.holder.rotation.set(0, 0, 0); ch.inner.scale.set(1, 1, 1); ch.inner.position.set(0, 0, 0); ch.inner.rotation.set(0, 0, 0);
    const act = ch.mixer.clipAction(idle); act.play(); ch.mixer.setTime(0); ch.holder.updateMatrixWorld(true);
    const b = {};
    ch.inner.traverse((o) => { if (o.isBone) b[o.name] = { q: o.quaternion.clone(), w: o.getWorldQuaternion(new THREE.Quaternion()), p: o.position.clone() }; });
    const hips = ch.inner.getObjectByName("Hips");
    b.__hipInv = new THREE.Matrix3().setFromMatrix4(hips.parent.matrixWorld).invert();
    ch.mixer.stopAllAction();
    return b;
  }
  win.makeClip = (name) => {
    const def = win.CLIPS[name];
    if (!def) throw new Error("no clip " + name);
    if (!base) base = baseOf(chars.player);
    const bones = Object.keys(base).filter((k) => !k.startsWith("__"));
    const n = def.poses.length;
    const times = Array.from({ length: n }, (_, i) => i);
    const tracks = [];
    for (const bn of bones) {
      const vals = [];
      for (const ps of def.poses) {
        const r = ps[bn];
        let q = base[bn].q.clone();
        if (r) {
          const R = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * D, (r[1] ?? 0) * D, (r[2] ?? 0) * D, "XYZ"));
          const Wi = base[bn].w.clone().invert();
          q = base[bn].q.clone().multiply(Wi.multiply(R).multiply(base[bn].w.clone()));
        }
        vals.push(q.x, q.y, q.z, q.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(bn + ".quaternion", times, vals));
    }
    const hp = base.Hips.p;
    const hv = [];
    // hip deltas are in world metres; the Hips' parent may be scaled (cm), so convert by its world scale
    for (const p of def.poses) { const h = new THREE.Vector3(...(p.hips ?? [0, 0, 0])).applyMatrix3(base.__hipInv); hv.push(hp.x + h.x, hp.y + h.y, hp.z + h.z); }
    tracks.push(new THREE.VectorKeyframeTrack("Hips.position", times, hv));
    return new THREE.AnimationClip(name, n - 0.5, tracks, THREE.InterpolateLinear);
  };
}
