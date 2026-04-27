import type { Config } from "tailwindcss";

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
      },
      fontFamily: {
        display: ["var(--font-cinzel)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
