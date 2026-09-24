// CANARY — a dynamic import. See README.md; never import this file.
export async function canaryDynamic(b: unknown, sc: unknown) {
  const E = await import("@/lib/star/canvasEngine");
  return E.stepBall(b as never, sc as never, Math.random, 0.01);
}
