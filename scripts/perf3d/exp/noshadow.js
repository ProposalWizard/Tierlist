// Baked-lighting upper bound: no real-time shadow pass at all.
__M.hook = (r, scene) => { if (!__M.done) { __M.done = 1; r.shadowMap.enabled = false; scene.traverse((o) => { if (o.isLight) o.castShadow = false; if (o.material) [].concat(o.material).forEach((m) => m.needsUpdate = true); }); } };
