/**
 * The "Pitch" look's display face: Anton — tall, condensed, heavy capitals,
 * the matchday-programme / shirt-number feel (lib/star/uiLook.ts). The site
 * already loads it for the front-page headline (NewspaperHeadline.tsx), so
 * this adds no new build-time download; it exposes it as a CSS variable,
 * --font-pitch, that pitchLook.css reads.
 */
import { Anton } from "next/font/google";

export const pitchFont = Anton({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-pitch" });
