/**
 * THE LOOK'S COLOURS AND GLASS, taken from the website's "Glass stadium" skin
 * (components/star/ui/glassLook.css, the default) and its kit.
 *
 * Glass WITHOUT blur: the website blurs what is behind each panel (backdrop-
 * filter). The phone never blurs (smoothness first). A panel here is a
 * see-through fill a little darker than the website's, a light rim, and a
 * bright top edge; behind it is either a picture that is already blurred
 * (STADIUM_BLUR) or a picture dark enough for white words to read.
 */
export const LOOK = {
  /** Words. */
  ink: "#ffffff",
  inkSoft: "rgba(255,255,255,0.78)",
  inkDim: "rgba(255,255,255,0.6)",
  /** The frosted blue-slate of every panel (glassLook --sk-card). */
  glassTop: "rgba(14,30,52,0.66)",
  glassBottom: "rgba(10,22,40,0.74)",
  /** The top bar and bottom bar (glassLook 4 and 5), a little more solid: no blur behind them. */
  barTop: "rgba(30,56,92,0.94)",
  barBottom: "rgba(16,36,64,0.92)",
  /** The light rim on glass. */
  rim: "rgba(255,255,255,0.30)",
  rimSoft: "rgba(255,255,255,0.16)",
  /** The green of NEW GAME, Continue, PLAY (emerald). */
  green: "#34d399",
  greenDeep: "#059669",
  greenGlow: "#22e36b",
  emerald300: "#6ee7b7",
  emerald500: "#10b981",
  /** Gold (stars, money, Hall of Fame). */
  gold: "#fbbf24",
  goldSoft: "#fde68a",
  amber: "#f59e0b",
  /** The new-career page's green (ProfileSetup: from-emerald-900 to-emerald-950). */
  pageGreenTop: "#064e3b",
  pageGreenBottom: "#022c22",
  /** Navy "Back" buttons and dark tiles (gray-700 / gray-800 in the website's glass). */
  navy: "#283851",
  navyDeep: "#1c2a40",
  red: "#ef4444",
} as const;

/** "#rrggbb" + alpha → "rgba(...)". */
export function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A top-to-bottom gradient as a style value (React Native draws it natively, once). */
export function vgrad(top: string, bottom: string): { backgroundImage: string } {
  return { backgroundImage: `linear-gradient(180deg, ${top}, ${bottom})` };
}

/** The bright top edge and rim every glass panel has (inset shadows, drawn once). */
export const GLASS_EDGE = `inset 0px 1px 0px rgba(255,255,255,0.22), inset 0px 0px 0px 1px ${LOOK.rim}`;

/** Text that must read over a bright sky (glassLook 3). */
export const TEXT_SHADOW = { textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } as const;

/** Switches the soft shadow off for one Text (the rule for every word gives white and amber words one: ui/look/globalText.js). */
export const NO_SHADOW = { textShadowColor: "transparent", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0 } as const;
