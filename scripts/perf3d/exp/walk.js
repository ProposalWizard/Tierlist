// Walk while measuring: once the scene is up, hold the stick forward with a slow weave,
// so the follow camera moves every frame (the camera's own cost is in the numbers).
// node scripts/perf3d/drive.mjs home '{}' --exp=walk ; also garden, shop, casino.
(() => {
  const t0 = performance.now();
  setInterval(() => {
    const c = window.__M && window.__M.ctrl;
    if (!c || !c.setStick) return;
    const t = (performance.now() - t0) / 1000;
    c.setStick(0.45 * Math.sin(t * 0.7), 0.75);
  }, 100);
})();
