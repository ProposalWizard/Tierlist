/**
 * THE 3D FRAME METER (Harry, 9 Oct 2026: "a lot of lag in the 3D areas"). The
 * build machine has no graphics chip, so a phone is the only true measure:
 * this puts a small readout in the corner of every 3D place —
 *   fps · slowest frame in the last 2 s · draw calls · triangles · pixel ratio · tier
 * — for admins and testers (and anyone with ?fps=1; ?fps=0 hides it).
 * Second pass (9 Oct 2026): also shadow-map draws, skinned draws, post passes,
 * JS ms per frame (frameStats.ts) and the governor's rung (governor.ts).
 * The same numbers sit on window.__frame3d for measuring scripts.
 *
 * One file, no scene changes. It counts at the WebGL level (the browser's own
 * drawElements / drawArrays), so every renderer on the page is seen — the
 * shared one in three3d/perf.ts and the garden's, shop's, casino's own. (Three
 * makes `render` per renderer, not on its prototype, so it can't be wrapped
 * there.) Installed from acquireRenderer and withMeshopt, which every 3D scene
 * goes through. Cheap: a counter per draw call; the text changes twice a
 * second. It hides 3 s after the last 3D frame (leaving a 3D place).
 */
import { quality3dTier } from "./quality";
import { currentGovernor } from "./governor";
import { startFrameStats } from "./frameStats";

let installed = false;

function wanted(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const q = new URLSearchParams(window.location.search).get("fps");
  if (q === "1") return Promise.resolve(true);
  if (q === "0") return Promise.resolve(false);
  return import("@/lib/useIsAdmin").then((m) => m.isTesterNow()).catch(() => false);
}

/** Start the meter (once per page). Safe to call from every scene. */
export function installFrameMeter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  void wanted().then((on) => {
    if (!on) return;
    const st = startFrameStats();
    const el = document.createElement("div");
    el.setAttribute("data-frame-meter", "");
    Object.assign(el.style, {
      position: "fixed", left: "4px", bottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)", zIndex: "2147483000",
      pointerEvents: "none", font: "700 10px/1.25 ui-monospace, Menlo, monospace", color: "#d1fae5",
      background: "rgba(0,0,0,0.62)", padding: "3px 5px", borderRadius: "5px", whiteSpace: "pre", display: "none",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    window.setInterval(() => {
      const f = st.summary();
      if (!f) { el.style.display = "none"; return; }
      const g = currentGovernor();
      const gov = g ? `${g.tier} (rung ${g.index}${g.index !== g.startIndex ? ` from ${g.startIndex}` : ""})` : quality3dTier();
      el.textContent = `${f.fps.toFixed(0)} fps  worst ${f.worstMs.toFixed(0)} ms  js ${f.jsMs.toFixed(1)} ms\n${f.draws} draws  ${(f.tris / 1000).toFixed(0)}k tris  shadow ${f.shadowDraws}\nskinned ${f.skinnedDraws}  post ${f.posts}\npx ${f.pixelRatio.toFixed(2)}  ${gov}`;
      el.style.display = "block";
    }, 500);
  });
}
