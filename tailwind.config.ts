import type { Config } from "tailwindcss";

/**
 * The Studio (Marketing → Studio, 22 Oct 2026): the editing suite's paint tokens. Every one reads a CSS variable that
 * is set only inside `.studio-skin` (components/admin/studio/studio-skin.css), so nothing else on the site changes.
 * Names checked on 22 Oct 2026: none clashes with a class the site already uses.
 */
const oklch = (v: string) => `oklch(var(${v}) / <alpha-value>)`;
const studioColors = {
  floor: "var(--floor)",
  surface: { DEFAULT: "var(--surface)", raised: "var(--surface-raised)", sunken: "var(--surface-sunken)" },
  ink: { DEFAULT: "var(--ink)", secondary: "var(--ink-secondary)", muted: "var(--ink-muted)", faint: "var(--ink-faint)" },
  hairline: { DEFAULT: "var(--hairline)", strong: "var(--hairline-strong)" },
  outline: "var(--outline)",
  accent: { DEFAULT: oklch("--accent"), hover: oklch("--accent-hover"), ink: oklch("--accent-ink"), wash: "var(--accent-wash)" },
  good: oklch("--good"),
  bad: oklch("--bad"),
  mid: oklch("--mid"),
  // The suite's two modes: review notes (teal) and edits for Claude (violet).
  tonote: oklch("--to-note"),
  toclaude: oklch("--to-claude"),
};

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tier color palette
        tier: {
          s: "#ff7f7f", // red-pink for S tier
          a: "#ffbf7f", // orange for A tier
          b: "#ffdf80", // yellow for B tier
          c: "#bfff7f", // lime for C tier
          d: "#7fbfff", // blue for D tier
        },
        ...studioColors,
      },
      fontFamily: {
        display: ["var(--font-cinzel)", "serif"],
      },
      // Studio type scale (named, so it never clashes with text-sm/base/lg).
      fontSize: {
        title: ["1.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        heading: ["1.125rem", { lineHeight: "1.3" }],
        body: ["1rem", { lineHeight: "1.55" }],
        label: ["0.875rem", { lineHeight: "1.4" }],
        caption: ["0.8125rem", { lineHeight: "1.4" }],
        micro: ["0.75rem", { lineHeight: "1.35", letterSpacing: "0.01em" }],
      },
      boxShadow: { rest: "var(--shadow-rest)", raised: "var(--shadow-raised)", bubble: "var(--shadow-bubble)" },
      transitionDuration: { fast: "150ms", base: "220ms", slow: "320ms" },
    },
  },
  plugins: [],
};

export default config;
