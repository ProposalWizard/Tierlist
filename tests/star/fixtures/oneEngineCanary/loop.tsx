// CANARY — its own animation loop on a 2D canvas, no engine function at all
// (the shape of a screen that writes its own ball physics). See README.md.
export function canaryLoop(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d");
  let y = 0;
  const tick = () => { y += 1; ctx?.fillRect(0, y, 4, 4); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
