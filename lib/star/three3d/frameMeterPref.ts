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
  // ?fps=1 once keeps it on for this phone (27 Nov 2026: Mikey's S20 test; the game's own links drop the query); ?fps=0 turns it off
  if (q === "1") { setFrameMeterOn(true); return true; }
  if (q === "0") { setFrameMeterOn(false); return false; }
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function setFrameMeterOn(on: boolean): void {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}
