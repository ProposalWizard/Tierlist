/**
 * Can this browser make a WebGL context right now? (Mikey, 27 Nov 2026.)
 *
 * His computer's Chrome had switched graphics acceleration off (chrome://gpu
 * said "WebGL: Disabled"), so every 3D screen fell back to the flat drawn one
 * with no word of why. This is the plain yes/no that ThreeDNotice shows the
 * reason from. It makes one tiny context, asks it to let go, and keeps the
 * answer for the page's life: fixing the browser means reopening it anyway.
 */
let answer: boolean | undefined;

export function webglAvailable(): boolean {
  if (answer !== undefined) return answer;
  if (typeof document === "undefined") return true; // server render: no answer, claim none
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    answer = !!gl;
    try { gl?.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* fine */ }
  } catch {
    answer = false;
  }
  return answer;
}
