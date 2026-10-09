import { existsSync, readFileSync, statSync } from "node:fs";
import { BOOTS_ALL_LEVELS, LIFESTYLE_ALL_LEVELS, baseIdOf } from "../../lib/star/shopData";
import { styleGroupOf } from "../../lib/star/lifestyleLevels";

/**
 * THE SHOWROOM + FEED SHOP (components/star/shop2d/ShowroomShop.tsx): every
 * boot and style level it can show has a big still in
 * public/star/shop2d/items/ (tools/shop2d/render_big.py), at least 1080 px
 * tall, and every style item sits in one of the five style categories.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function webpSize(path: string): { w: number; h: number } | null {
  const b = readFileSync(path);
  // RIFF....WEBPVP8X: canvas size at 24..29 (24-bit little-endian, minus one)
  if (b.toString("ascii", 12, 16) === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (b.toString("ascii", 12, 16) === "VP8L") { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
  if (b.toString("ascii", 12, 16) === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null;
}

const names = new Set<string>();
for (const b of BOOTS_ALL_LEVELS) names.add(`boot-${baseIdOf(b)}-L${b.level ?? 1}`);
for (const i of LIFESTYLE_ALL_LEVELS) {
  const base = baseIdOf(i);
  names.add(base === "phone" ? "phone-L1" : `${base}-L${i.level ?? 1}`);
  check(["drip", "gadgets", "cars", "homes", "holiday"].includes(styleGroupOf(i)), `${base}: no style category`);
}
let total = 0;
for (const n of names) {
  const p = `public/star/shop2d/items/${n}.webp`;
  if (!existsSync(p)) { problems.push(`missing big still ${p}`); continue; }
  total += statSync(p).size;
  const s = webpSize(p);
  check(!!s && s.h >= 1080, `${n}: not at least 1080 px tall (${s ? `${s.w}x${s.h}` : "unreadable"})`);
}

if (problems.length) {
  console.log(`showroomShop: ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 30)) console.log("  " + p);
  process.exit(1);
}
console.log(`showroomShop: ${names.size} big stills, all ≥1080 px tall, ${(total / 1e6).toFixed(1)} MB`);
