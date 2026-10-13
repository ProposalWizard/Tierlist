/**
 * The speed readout's switch (Harry, 13 Oct 2026: "hide the speed lag setting as a toggle in top of
 * settings for testing purposes"). OFF by default for everyone, testers and admins included; turned
 * on per device from the top of Settings (testers only see the switch), or with ?fps=1 for one page.
 * Kept separate from frameMeter.ts so Settings can read it without loading any 3D code.
 */
const KEY = "star-frame-meter";
export function frameMeterOn(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("fps");
  if (q === "1") return true;
  if (q === "0") return false;
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function setFrameMeterOn(on: boolean): void {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}
