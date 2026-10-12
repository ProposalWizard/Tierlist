/**
 * THE TROPHY LEVEL BADGE — option C, picked by Harry on 12 Oct 2026 to replace
 * the dark metal shields (public/star/shop2d/rank-1…5.webp: "doesn't match the
 * look of everything in the game"). NOT WIRED IN YET: he also wants to drop the
 * L1–L5 levels, which is an economy question still open. When levels stay, swap
 * `<img src={art(`rank-${lv}`)} />` for `<TrophyBadge level={lv} size={…} />`.
 *
 * A cel-shaded cup in the game's run of colours: bronze → silver → pitch
 * green → deep green with gold → gold. It grows each level: a plain cup, then
 * handles, a star, big ears, and a star on top. Static markup, no user input.
 */
const T = [
  { a: "#c98a5a", b: "#8a5531", hi: "#f0c49a", trim: "#f0c49a" },
  { a: "#d7dde6", b: "#8f9aaa", hi: "#ffffff", trim: "#ffffff" },
  { a: "#2fae5f", b: "#1b7a3e", hi: "#8ff0b3", trim: "#8ff0b3" },
  { a: "#1d6b3d", b: "#0f4626", hi: "#5fd18e", trim: "#f2c14e" },
  { a: "#f6c445", b: "#c88d17", hi: "#fff1b0", trim: "#fff1b0" },
];
const INK = "#0b1222";

function star(cx: number, cy: number, r: number, fill: string): string {
  let p = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    p += `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)} `;
  }
  return `<polygon points="${p}" fill="${fill}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
}

export function trophySvg(level: number): string {
  const l = Math.max(1, Math.min(5, Math.round(level)));
  const t = T[l - 1];
  const k = 0.72 + l * 0.06;
  let s = `<g transform="translate(32 60) scale(${k}) translate(-32 -60)">`;
  s += `<rect x="20" y="51" width="24" height="9" rx="1.5" fill="${l >= 3 ? "#1b3a2a" : "#3a2a20"}" stroke="${INK}" stroke-width="2.6"/>`;
  s += `<rect x="23" y="53.5" width="18" height="3" fill="${t.trim}" opacity=".9"/>`;
  s += `<path d="M27 51 L29 42 H35 L37 51 Z" fill="${t.b}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
  if (l >= 2) {
    const big = l >= 4, y = big ? 14 : 16, o = big ? 4 : 8, w = big ? 7 : 6, w2 = big ? 3.4 : 2.6;
    const left = `M17 ${y} C${o} ${y} ${o} 34 22 34`, right = `M47 ${y} C${64 - o} ${y} ${64 - o} 34 42 34`;
    s += `<path d="${left}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/><path d="${left}" fill="none" stroke="${t.a}" stroke-width="${w2}" stroke-linecap="round"/>`;
    s += `<path d="${right}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/><path d="${right}" fill="none" stroke="${t.b}" stroke-width="${w2}" stroke-linecap="round"/>`;
  }
  const cup = "M16 12 H48 C48 30 42 42 32 42 C22 42 16 30 16 12 Z";
  s += `<path d="${cup}" fill="${t.b}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`;
  s += `<path d="M16 12 H32 V42 C22 42 16 30 16 12 Z" fill="${t.a}"/>`;
  s += `<path d="${cup}" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`;
  s += `<path d="M21 16 C21 26 24 33 27 36" fill="none" stroke="${t.hi}" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>`;
  s += `<rect x="14" y="9" width="36" height="5" rx="2" fill="${t.trim}" stroke="${INK}" stroke-width="2.4"/>`;
  if (l >= 3) s += star(32, 25, 6.5, l === 4 ? "#f2c14e" : "#fff");
  if (l === 5) s += star(32, 4, 4.5, "#fff");
  return `${s}</g>`;
}

export default function TrophyBadge({ level, size = 34, className = "" }: { level: number; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-label={`Level ${level}`}
      dangerouslySetInnerHTML={{ __html: trophySvg(level) }} />
  );
}
