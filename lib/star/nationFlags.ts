/**
 * NATIONAL FLAGS, DRAWN — no network.
 *
 * Every screen of the international career (the call-up, Home's next match,
 * the team sheet, the fixture list, the tournament) shows the two nations.
 * The flag pictures used to come from flagcdn.com, which fails when the CDN
 * is blocked or slow and left a globe emoji or a generic club crest. These
 * are simple vector flags on a 30×20 box: bands, a cross, a disc, a star.
 * Close enough to read at 20-60 px; not heraldic artwork.
 *
 * A nation with no drawing here gets two bands in its kit colours
 * (international.ts's nationKits), so nothing is ever blank.
 *
 * Pure: returns SVG markup strings.
 */

type Spec =
  | { v: string[]; w?: number[]; extra?: string }
  | { h: string[]; w?: number[]; extra?: string }
  | { svg: string };

const W = 30, H = 20;

const star = (cx: number, cy: number, r: number, fill: string) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
};
const rect = (x: number, y: number, w: number, h: number, f: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const nordic = (bg: string, cross: string, inner?: string) =>
  rect(0, 0, W, H, bg) + rect(8, 0, 4, H, cross) + rect(0, 8, W, 4, cross)
  + (inner ? rect(9, 0, 2, H, inner) + rect(0, 9, W, 2, inner) : "");
const centreCross = (bg: string, cross: string, t = 4) =>
  rect(0, 0, W, H, bg) + rect(W / 2 - t / 2, 0, t, H, cross) + rect(0, H / 2 - t / 2, W, t, cross);
const saltire = (bg: string, c: string, t = 3) =>
  rect(0, 0, W, H, bg) + `<path d="M0 0L${W} ${H}M${W} 0L0 ${H}" stroke="${c}" stroke-width="${t}"/>`;

const RED = "#c8102e", WHITE = "#ffffff", BLUE = "#0a3d91", GREEN = "#008c45", YELLOW = "#fcd116", BLACK = "#111111";

const FLAGS: Record<string, Spec> = {
  England: { svg: centreCross(WHITE, RED, 4) },
  Scotland: { svg: saltire("#005eb8", WHITE, 3.4) },
  Wales: { svg: rect(0, 0, W, 10, WHITE) + rect(0, 10, W, 10, "#00a651") + `<path d="M9 13 Q13 6 19 9 Q23 7 24 11 L20 12 Q18 15 13 15 Z" fill="${RED}"/>` },
  "Northern Ireland": { svg: centreCross(WHITE, RED, 3.4) + `<circle cx="15" cy="10" r="2.6" fill="${WHITE}" stroke="${RED}" stroke-width=".8"/>` },
  "Republic of Ireland": { v: ["#169b62", WHITE, "#ff883e"] },
  Ireland: { v: ["#169b62", WHITE, "#ff883e"] },
  France: { v: ["#0055a4", WHITE, "#ef4135"] },
  Italy: { v: [GREEN, WHITE, "#cd212a"] },
  Belgium: { v: [BLACK, "#fdda24", "#ef3340"] },
  Romania: { v: ["#002b7f", YELLOW, "#ce1126"] },
  Mexico: { v: ["#006847", WHITE, "#ce1126"], extra: `<circle cx="15" cy="10" r="2.2" fill="#8c5a2b"/>` },
  Nigeria: { v: ["#008751", WHITE, "#008751"] },
  "Cote d'Ivoire": { v: ["#f77f00", WHITE, "#009e60"] },
  "Ivory Coast": { v: ["#f77f00", WHITE, "#009e60"] },
  Peru: { v: ["#d91023", WHITE, "#d91023"] },
  Canada: { v: ["#d52b1e", WHITE, "#d52b1e"], w: [1, 2, 1], extra: star(15, 10, 4.2, "#d52b1e") },
  Senegal: { v: ["#00853f", "#fdef42", "#e31b23"], extra: star(15, 10, 3, "#00853f") },
  Cameroon: { v: ["#007a5e", "#ce1126", "#fcd116"], extra: star(15, 10, 2.8, "#fcd116") },
  Germany: { h: [BLACK, "#dd0000", "#ffce00"] },
  Netherlands: { h: ["#ae1c28", WHITE, "#21468b"] },
  Austria: { h: ["#ed2939", WHITE, "#ed2939"] },
  Hungary: { h: ["#ce2939", WHITE, "#477050"] },
  Russia: { h: [WHITE, "#0039a6", "#d52b1e"] },
  Serbia: { h: ["#c6363c", "#0c4076", WHITE] },
  Bulgaria: { h: [WHITE, "#00966e", "#d62612"] },
  Estonia: { h: ["#0072ce", BLACK, WHITE] },
  Lithuania: { h: ["#fdb913", "#006a44", "#c1272d"] },
  Luxembourg: { h: ["#ed2939", WHITE, "#00a1de"] },
  Armenia: { h: ["#d90012", "#0033a0", "#f2a800"] },
  Gibraltar: { h: [WHITE, RED], w: [2, 1] },
  Poland: { h: [WHITE, "#dc143c"] },
  Ukraine: { h: ["#0057b7", "#ffd700"] },
  Indonesia: { h: [RED, WHITE] },
  Spain: { h: ["#aa151b", "#f1bf00", "#aa151b"], w: [1, 2, 1] },
  Colombia: { h: [YELLOW, "#003893", "#ce1126"], w: [2, 1, 1] },
  Ecuador: { h: ["#ffdd00", "#034ea2", "#ed1c24"], w: [2, 1, 1] },
  Ghana: { h: ["#ce1126", YELLOW, "#006b3f"], extra: star(15, 10, 2.8, BLACK) },
  Egypt: { h: ["#ce1126", WHITE, BLACK], extra: `<circle cx="15" cy="10" r="1.8" fill="#c09300"/>` },
  Iran: { h: ["#239f40", WHITE, "#da0000"] },
  Paraguay: { h: ["#d52b1e", WHITE, "#0038a8"] },
  "Costa Rica": { h: ["#002b7f", WHITE, "#ce1126", WHITE, "#002b7f"], w: [1, 1, 2, 1, 1] },
  Thailand: { h: ["#a51931", WHITE, "#2d2a4a", WHITE, "#a51931"], w: [1, 1, 2, 1, 1] },
  Argentina: { h: ["#74acdf", WHITE, "#74acdf"], extra: `<circle cx="15" cy="10" r="2" fill="#f6b40e"/>` },
  Uruguay: { svg: rect(0, 0, W, H, WHITE) + [2, 6, 10, 14, 18].map(y => rect(0, y, W, 2.2, "#0038a8")).join("") + rect(0, 0, 11, 11, WHITE) + `<circle cx="5.5" cy="5.5" r="3" fill="#fcd116"/>` },
  Greece: { svg: rect(0, 0, W, H, "#0d5eaf") + [2.2, 6.7, 11.1, 15.6].map(y => rect(0, y, W, 2.2, WHITE)).join("") + rect(0, 0, 11, 11, "#0d5eaf") + rect(4.4, 0, 2.2, 11, WHITE) + rect(0, 4.4, 11, 2.2, WHITE) },
  USA: { svg: rect(0, 0, W, H, WHITE) + [0, 3.1, 6.2, 9.2, 12.3, 15.4, 18.5].map(y => rect(0, y, W, 1.55, "#b22234")).join("") + rect(0, 0, 13, 10.8, "#3c3b6e") },
  Denmark: { svg: nordic("#c8102e", WHITE) },
  Norway: { svg: nordic("#ba0c2f", WHITE, "#00205b") },
  Sweden: { svg: nordic("#006aa7", "#fecc00") },
  Finland: { svg: nordic(WHITE, "#002f6c") },
  Iceland: { svg: nordic("#02529c", WHITE, "#dc1e35") },
  "Faroe Islands": { svg: nordic(WHITE, "#0065bd", "#ef303e") },
  Switzerland: { svg: rect(0, 0, W, H, "#da291c") + rect(13, 4, 4, 12, WHITE) + rect(9, 8, 12, 4, WHITE) },
  Georgia: { svg: centreCross(WHITE, "#ff0000", 3) },
  Japan: { svg: rect(0, 0, W, H, WHITE) + `<circle cx="15" cy="10" r="5.6" fill="#bc002d"/>` },
  "Korea Republic": { svg: rect(0, 0, W, H, WHITE) + `<path d="M10 10a5 5 0 0 1 10 0z" fill="#cd2e3a"/><path d="M10 10a5 5 0 0 0 10 0z" fill="#0047a0"/>` },
  Brazil: { svg: rect(0, 0, W, H, "#009c3b") + `<polygon points="15,2.5 27,10 15,17.5 3,10" fill="#ffdf00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/>` },
  Portugal: { svg: rect(0, 0, 12, H, "#006600") + rect(12, 0, 18, H, "#ff0000") + `<circle cx="12" cy="10" r="3.4" fill="#ffcc00"/><circle cx="12" cy="10" r="2" fill="${WHITE}" stroke="#ff0000" stroke-width=".8"/>` },
  Croatia: { svg: rect(0, 0, W, 6.7, "#ff0000") + rect(0, 6.7, W, 6.6, WHITE) + rect(0, 13.3, W, 6.7, "#171796")
    + rect(12, 5, 6, 7, WHITE) + [0, 1, 2].flatMap(r => [0, 1, 2].map(c => ((r + c) % 2 === 0 ? rect(12 + c * 2, 5 + r * 2.33, 2, 2.33, "#ff0000") : ""))).join("") },
  "Türkiye": { svg: rect(0, 0, W, H, "#e30a17") + `<circle cx="11" cy="10" r="5" fill="${WHITE}"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/>` + star(18, 10, 2.4, WHITE) },
  Morocco: { svg: rect(0, 0, W, H, "#c1272d") + `<polygon points="15,5 16.5,13.5 9.5,8.2 20.5,8.2 13.5,13.5" fill="none" stroke="#006233" stroke-width="1"/>` },
  Algeria: { svg: rect(0, 0, 15, H, "#006233") + rect(15, 0, 15, H, WHITE) + `<circle cx="15" cy="10" r="4.6" fill="#d21034"/><circle cx="16.4" cy="10" r="3.8" fill="${WHITE}"/>` + star(17.5, 10, 2, "#d21034") },
  Tunisia: { svg: rect(0, 0, W, H, "#e70013") + `<circle cx="15" cy="10" r="5" fill="${WHITE}"/><circle cx="15" cy="10" r="3.6" fill="#e70013"/><circle cx="16" cy="10" r="3" fill="${WHITE}"/>` + star(16.5, 10, 1.8, "#e70013") },
  Czechia: { svg: rect(0, 0, W, 10, WHITE) + rect(0, 10, W, 10, "#d7141a") + `<polygon points="0,0 15,10 0,20" fill="#11457e"/>` },
  Slovakia: { h: [WHITE, "#0b4ea2", "#ee1c25"], extra: `<path d="M6 5h7v6q0 4-3.5 5.5Q6 15 6 11z" fill="#ee1c25" stroke="${WHITE}" stroke-width=".6"/>` },
  Slovenia: { h: [WHITE, "#0000ff", "#ff0000"], extra: `<path d="M6 3.5h6v5q0 3-3 4.2Q6 11.5 6 8.5z" fill="#0000ff" stroke="#ff0000" stroke-width=".5"/>` },
  Albania: { svg: rect(0, 0, W, H, "#e41e20") + `<path d="M11 7l4 3 4-3-1 6-3 3-3-3z" fill="${BLACK}"/>` },
  "Bosnia and Herzegovina": { svg: rect(0, 0, W, H, "#002395") + `<polygon points="9,0 22,0 22,20" fill="#fecb00"/>` },
  Israel: { svg: rect(0, 0, W, H, WHITE) + rect(0, 2.5, W, 2.6, "#0038b8") + rect(0, 14.9, W, 2.6, "#0038b8") + `<polygon points="15,6.5 18,11.7 12,11.7" fill="none" stroke="#0038b8" stroke-width=".9"/><polygon points="15,13.3 12,8.1 18,8.1" fill="none" stroke="#0038b8" stroke-width=".9"/>` },
  Australia: { svg: rect(0, 0, W, H, "#012169") + rect(0, 0, 13, 10, "#012169") + `<path d="M0 0L13 10M13 0L0 10" stroke="${WHITE}" stroke-width="1.6"/>` + rect(5.7, 0, 1.6, 10, WHITE) + rect(0, 4.2, 13, 1.6, WHITE) + rect(6, 0, 1, 10, RED) + rect(0, 4.5, 13, 1, RED) + star(6.5, 15, 2.2, WHITE) + star(23, 6, 1.4, WHITE) + star(21, 14, 1.4, WHITE) },
  "New Zealand": { svg: rect(0, 0, W, H, "#012169") + `<path d="M0 0L13 10M13 0L0 10" stroke="${WHITE}" stroke-width="1.6"/>` + rect(5.7, 0, 1.6, 10, WHITE) + rect(0, 4.2, 13, 1.6, WHITE) + rect(6, 0, 1, 10, RED) + rect(0, 4.5, 13, 1, RED) + star(23, 6, 1.4, RED) + star(21, 14, 1.4, RED) },
  Jamaica: { svg: rect(0, 0, W, H, "#009b3a") + `<polygon points="0,0 15,10 0,20" fill="${BLACK}"/><polygon points="30,0 15,10 30,20" fill="${BLACK}"/><path d="M0 0L30 20M30 0L0 20" stroke="#fed100" stroke-width="2.6"/>` },
  Chile: { svg: rect(0, 0, W, 10, WHITE) + rect(0, 10, W, 10, "#d52b1e") + rect(0, 0, 10, 10, "#0039a6") + star(5, 5, 2.6, WHITE) },
  Qatar: { svg: rect(0, 0, W, H, "#8a1538") + `<polygon points="0,0 9,0 12,1.1 9,2.2 12,3.3 9,4.4 12,5.5 9,6.6 12,7.7 9,8.8 12,10 9,11.1 12,12.2 9,13.3 12,14.4 9,15.5 12,16.6 9,17.7 12,18.8 9,20 0,20" fill="${WHITE}"/>` },
  "Saudi Arabia": { svg: rect(0, 0, W, H, "#006c35") + rect(8, 12.5, 14, 1, WHITE) + `<path d="M9 8h12" stroke="${WHITE}" stroke-width="1.6" stroke-dasharray="1.2 .8"/>` },
  Kosovo: { svg: rect(0, 0, W, H, "#244aa5") + `<path d="M11 8h8l-1 5h-6z" fill="#d0a650"/>` },
  "North Macedonia": { svg: rect(0, 0, W, H, "#d20000") + `<path d="M15 10L0 0M15 10L30 0M15 10L0 20M15 10L30 20M15 10L15 0M15 10L15 20M15 10L0 10M15 10L30 10" stroke="#ffe600" stroke-width="2"/><circle cx="15" cy="10" r="3" fill="#ffe600" stroke="#d20000" stroke-width=".6"/>` },
  Montenegro: { svg: rect(0, 0, W, H, "#d4af37") + rect(1.2, 1.2, 27.6, 17.6, "#c40308") },
  Malta: { v: [WHITE, "#cf142b"] },
  Cyprus: { svg: rect(0, 0, W, H, WHITE) + `<path d="M8 8q5-3 13 0l-2 4q-5 2-9-1z" fill="#d57800"/>` },
  "San Marino": { h: [WHITE, "#5eb6e4"] },
  Andorra: { v: ["#10069f", "#fedd00", "#d50032"] },
  Liechtenstein: { h: ["#002b7f", "#ce1126"] },
  Moldova: { v: ["#0046ae", "#ffd200", "#cc092f"] },
  Latvia: { h: ["#9e3039", WHITE, "#9e3039"], w: [2, 1, 2] },
  Belarus: { h: ["#c8313e", "#4aa657"], w: [2, 1] },
  Azerbaijan: { h: ["#00b5e2", "#ef3340", "#509e2f"] },
  Kazakhstan: { svg: rect(0, 0, W, H, "#00afca") + `<circle cx="15" cy="9" r="3.4" fill="#fec50c"/>` },
};

/** Flags that are another nation's under a second spelling. */
const SAME: Record<string, string> = {
  "United States": "USA", Turkey: "Türkiye", "Czech Republic": "Czechia",
};

/** A nation this file can draw (or alias), as opposed to a club. */
export function hasDrawnFlag(nation: string): boolean {
  return !!FLAGS[SAME[nation] ?? nation];
}

function bandsSvg(dir: "v" | "h", colours: string[], weights?: number[]): string {
  const ws = weights ?? colours.map(() => 1);
  const total = ws.reduce((s, x) => s + x, 0);
  let at = 0;
  return colours.map((c, i) => {
    const size = ((dir === "v" ? W : H) * ws[i]) / total;
    const r = dir === "v" ? rect(at, 0, size + 0.05, H, c) : rect(0, at, W, size + 0.05, c);
    at += size;
    return r;
  }).join("");
}

/**
 * The flag's inner SVG markup (viewBox 0 0 30 20). `fallback` is two colours
 * (the nation's kit) used when there is no drawing for it.
 */
export function flagMarkup(nation: string, fallback?: [string, string]): string {
  const spec = FLAGS[SAME[nation] ?? nation];
  if (!spec) {
    const [a, b] = fallback ?? ["#e5e7eb", "#374151"];
    return bandsSvg("h", [a, b]);
  }
  if ("svg" in spec) return spec.svg;
  if ("v" in spec) return bandsSvg("v", spec.v, spec.w) + (spec.extra ?? "");
  return bandsSvg("h", spec.h, spec.w) + (spec.extra ?? "");
}

/** A whole standalone SVG document, for an <img> or a data URL. */
export function flagSvgDocument(nation: string, fallback?: [string, string]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${flagMarkup(nation, fallback)}</svg>`;
}

export function flagDataUrl(nation: string, fallback?: [string, string]): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(flagSvgDocument(nation, fallback))}`;
}
