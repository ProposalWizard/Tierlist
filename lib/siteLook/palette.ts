/**
 * lib/siteLook/palette.ts — the site's colours as named settings (Leo, 26 Nov 2026).
 *
 * Every Tailwind colour the public pages use (gray, white, indigo, emerald …)
 * reads a CSS variable. The variables' normal values ARE Tailwind's own
 * colours, so with the preview off nothing on screen changes for anyone.
 *
 * With the New look preview on (lib/siteLook/look.ts sets
 * html[data-look="v2"]), on public pages only (data-scope="page", never the
 * game or admin), the same variables get the new values:
 *   light (the default): the home's cream and green, every scale turned round
 *     so dark-page classes read right on cream (a pale tint becomes a dark
 *     word, a dark card becomes white);
 *   dark (the option): the dark pages kept, but in the home's greens.
 * Purple/indigo/violet become the Play-now green in both.
 *
 * Pure: used by tailwind.config.ts (generates the CSS) and by the tests.
 */
import twColors from "tailwindcss/colors";

export const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
type Shade = (typeof SHADES)[number];
type Scale = Record<Shade, string>;

/** The families a public page uses (counted 26 Nov 2026: white 1,965 uses, gray 1,557, emerald 566 …). */
export const FAMILIES = ["gray", "slate", "emerald", "amber", "red", "indigo", "purple", "yellow", "blue", "green", "orange", "cyan", "sky", "teal", "violet", "rose", "pink", "lime"] as const;
type Family = (typeof FAMILIES)[number];
const BRANDED: readonly Family[] = ["indigo", "purple", "violet"];
const PALE: readonly Family[] = ["amber", "yellow", "lime", "orange", "cyan", "sky", "emerald", "green", "teal"];

/** "#0a7a3d" → "10 122 61" (the form `rgb(var(--x) / a)` needs). */
export function triplet(hex: string): string {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)).join(" ");
}

const tw = (f: Family): Scale => (twColors as unknown as Record<string, Scale>)[f];

/** The Play-now green as a full scale (500/600 are the home's buttons, 700 its top bar). */
export const BRAND: Scale = {
  "50": "#eef7f1", "100": "#d6ecdd", "200": "#aed9bd", "300": "#7cc196", "400": "#3fa265", "500": "#128a46",
  "600": "#0a7a3d", "700": "#0a6a34", "800": "#085a2c", "900": "#064a24", "950": "#03301a",
};

/** Light: the cream greys, by role (950 page, 900 cards, 800 lines …, 50 the darkest words). */
export const CREAM_GRAY: Scale = {
  "950": "#f4efe2", "900": "#ffffff", "800": "#e7e0cf", "700": "#d6ceba", "600": "#a39b88", "500": "#6b6f78",
  "400": "#474f5c", "300": "#3a4350", "200": "#2a2f37", "100": "#1c2027", "50": "#12151a",
};

/** Dark option: the same roles, a green-black instead of navy. */
export const PITCH_GRAY: Scale = {
  "50": "#f6f7f6", "100": "#eef1ef", "200": "#dce2de", "300": "#c1cac4", "400": "#97a39b", "500": "#6c786f",
  "600": "#4c574f", "700": "#36403a", "800": "#222b26", "900": "#151c18", "950": "#0b110e",
};

export const INK = "#12151a";

/**
 * Light: the pale half and the dark half of each scale swap (50↔950 … 400↔600),
 * so `text-emerald-400` (made for a dark page) becomes emerald-600 on cream and
 * `bg-emerald-900/30` becomes a pale tint. 500–700 stay: those are solid
 * buttons and badges, which keep their white words (site-look.css).
 */
export function lightShade(s: Shade): Shade {
  const swap: Partial<Record<Shade, Shade>> = { "50": "950", "100": "900", "200": "800", "300": "700", "400": "600", "800": "200", "900": "100", "950": "50" };
  return swap[s] ?? s;
}

export interface Look { vars: Record<string, string> }

/** The normal values: Tailwind's own, so nothing changes for anyone. */
export function normalVars(): Record<string, string> {
  const v: Record<string, string> = { "--k-white": triplet("#ffffff") };
  for (const f of FAMILIES) for (const s of SHADES) v[`--k-${f}-${s}`] = triplet(tw(f)[s]);
  return v;
}

export function lightVars(): Record<string, string> {
  const v: Record<string, string> = { "--k-white": triplet(INK) };
  for (const f of FAMILIES) {
    for (const s of SHADES) {
      if (f === "gray" || f === "slate") { v[`--k-${f}-${s}`] = triplet(CREAM_GRAY[s]); continue; }
      const src = BRANDED.includes(f) ? BRAND : tw(f);
      // A branded solid (indigo-600 button) is the home's green button, never lightened.
      // Pale families (amber, yellow …) need one step darker on cream to read (contrast check, 26 Nov).
      const shade = PALE.includes(f) && (s === "300" || s === "400") ? (s === "300" ? "800" : "700") : lightShade(s);
      v[`--k-${f}-${s}`] = triplet(src[shade]);
    }
  }
  return v;
}

export function darkVars(): Record<string, string> {
  const v: Record<string, string> = {};
  for (const s of SHADES) { v[`--k-gray-${s}`] = triplet(PITCH_GRAY[s]); v[`--k-slate-${s}`] = triplet(PITCH_GRAY[s]); }
  for (const f of BRANDED) for (const s of SHADES) v[`--k-${f}-${s}`] = triplet(BRAND[s]);
  return v;
}

/** Tailwind `colors` that read the variables. */
export function tailwindColors(): Record<string, string | Record<string, string>> {
  const c: Record<string, string | Record<string, string>> = { white: "rgb(var(--k-white) / <alpha-value>)" };
  for (const f of FAMILIES) {
    const scale: Record<string, string> = {};
    for (const s of SHADES) scale[s] = `rgb(var(--k-${f}-${s}) / <alpha-value>)`;
    c[f] = scale;
  }
  return c;
}

/** Where each look applies. */
export const SEL = {
  normal: ":root",
  light: 'html[data-look="v2"][data-scope="page"][data-theme="light"]',
  dark: 'html[data-look="v2"][data-scope="page"][data-theme="dark"]',
};

/**
 * Light: a solid button or badge (bg-emerald-600, from-indigo-500 …) keeps
 * WHITE words, since inside it `text-white` must stay white, not ink.
 */
export function solidRules(): Record<string, Record<string, string>> {
  const sel: string[] = [];
  for (const f of FAMILIES) for (const s of ["500", "600", "700"]) sel.push(`.bg-${f}-${s}`, `.from-${f}-${s}`);
  const body = { "--k-white": triplet("#ffffff") };
  return { [sel.map((x) => `${SEL.light} ${x}`).join(",")]: body };
}

/** The top bar and footer: green in both themes, drawn with the dark set inside (they were made for it). */
export function chromeVars(): Record<string, string> {
  return keepDarkVars();
}

/**
 * Made-for-dark parts kept dark on a cream page (Leo, 26 Nov 2026): Mikey's
 * Draft art cards, the Hall of Fame boards, the admin panel. Every colour back
 * to its dark-page value (in the dark look's greens), so their words read
 * as designed. components/SiteLook.tsx marks them (data-keep-dark) by
 * measuring: any box whose own background is near-black.
 */
export function keepDarkVars(): Record<string, string> {
  return { ...normalVars(), ...darkVars() };
}
