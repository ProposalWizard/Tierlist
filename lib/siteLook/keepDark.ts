/**
 * lib/siteLook/keepDark.ts — find the boxes that were drawn for a dark page
 * (Leo, 26 Nov 2026: "Mikey's really cool draft pictures … i rlly want them
 * too"; and the Hall of Fame boards came out unreadable on cream).
 *
 * In the light look, a box whose OWN background is near-black (a hand-picked
 * colour, a dark gradient, Mikey's art cards, the admin panel) gets
 * data-keep-dark, and inside it every colour goes back to its dark-page value
 * (tailwind.config.ts). So it looks exactly as designed, as a dark card on the
 * cream page, like the home's phone picture.
 *
 * Measured, not listed: no page has to be edited, and a new dark card is
 * handled the moment it appears.
 */

/** Parse "rgb(1, 2, 3)" / "rgba(1, 2, 3, 0.5)" / "rgb(1 2 3 / 0.5)". */
export function parseRgb(s: string): [number, number, number, number] | null {
  const m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (m[4]?.endsWith("%")) a = a / 100;
  return [+m[1], +m[2], +m[3], a];
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function luminance(r: number, g: number, b: number): number {
  const c = [r, g, b].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export const DARK_BELOW = 0.05;

/** Is this background (computed background-color + background-image) a dark one? */
export function isDarkBackground(color: string, image: string): boolean {
  const c = parseRgb(color);
  if (c && c[3] >= 0.6 && luminance(c[0], c[1], c[2]) < DARK_BELOW) return true;
  if (image && image.includes("gradient")) {
    const stops = (image.match(/rgba?\([^)]+\)/g) ?? []).map(parseRgb).filter((x): x is [number, number, number, number] => !!x && x[3] >= 0.6);
    if (stops.length && stops.reduce((s, x) => s + luminance(x[0], x[1], x[2]), 0) / stops.length < DARK_BELOW) return true;
  }
  return false;
}

/** Mark every dark-made box under `root` (skips ones already inside a kept-dark box or the frame). */
export function markDarkBoxes(root: ParentNode): number {
  let n = 0;
  const all = root.querySelectorAll<HTMLElement>("body *:not(script):not(style):not(svg *)");
  for (const el of Array.from(all)) {
    if (el.hasAttribute("data-keep-dark") || el.closest("[data-keep-dark],[data-global-chrome],[data-look-pill]")) continue;
    const cs = getComputedStyle(el);
    if (isDarkBackground(cs.backgroundColor, cs.backgroundImage)) { el.setAttribute("data-keep-dark", ""); n++; }
  }
  return n;
}
