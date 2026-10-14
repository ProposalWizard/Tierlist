import { existsSync } from "node:fs";
import { TEXTURE_PACKS, TEXTURE_PACK_NAMES, TEXTURE_PACK_LINES, TEXTURE_PACK_PREVIEW, parseTexturePack } from "../../lib/star/style3d/texturePack";
import { PACK_SPECS, packGrade, packGrass } from "../../lib/star/style3d/real/packSpecs";
import { TODS } from "../../lib/star/style3d/real/tod";

/**
 * Texture packs (Harry, 14 Oct 2026: "go to like 8, 9, 10, 11, 12 texture packs"):
 * twelve, each with a name, one line and a preview still on disk; the eight data
 * packs keep the men readable (no picture too dark, too washed out or grey) and
 * keep a green pitch.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

check(TEXTURE_PACKS.length === 12, `twelve packs (got ${TEXTURE_PACKS.length})`);
check(TEXTURE_PACKS[0] === "real", "Realism + cartoon stays first (the default)");
for (const id of TEXTURE_PACKS) {
  check(!!TEXTURE_PACK_NAMES[id], `${id} has a name`);
  const line = TEXTURE_PACK_LINES[id];
  check(!!line && line.length <= 60, `${id} has a one-line description (<= 60 letters)`);
  const src = TEXTURE_PACK_PREVIEW[id];
  check(!!src && existsSync(`public${src}`), `${id} has a preview still on disk (${src})`);
  check(parseTexturePack(id) === id, `${id} parses`);
}
check(new Set(Object.values(TEXTURE_PACK_NAMES)).size === 12, "every name is different");
const extra = Object.keys(PACK_SPECS);
check(extra.length === 8 && extra.every((k) => (TEXTURE_PACKS as string[]).includes(k)), "the eight data packs are all listed");
check(!["real", "light", "cartoon", "bright"].some((k) => k in PACK_SPECS), "the first four keep their own code");

// the grade with nothing asked of it changes nothing
const g0 = { exposure: 1, bloom: 0.3, bloomThresh: 1, contrast: 1.1, sat: 1.05, tint: [1.02, 1, 0.98] as [number, number, number], lift: [0.01, 0.01, 0.01] as [number, number, number], vignette: 0.3, lutAmt: 0.8, sharpen: 1 };
check(JSON.stringify(packGrade(g0, {})) === JSON.stringify(g0), "an empty grade recipe is the look's own grade");

const luma = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
for (const [id, s] of Object.entries(PACK_SPECS)) {
  const g = packGrade(g0, s.grade);
  // the men are lit by the same light and seen through this grade: keep it in a readable band
  check(g.exposure >= 0.95 && g.exposure <= 1.15, `${id}: exposure ${g.exposure.toFixed(2)} keeps the men neither black nor washed out`);
  check(g.sat >= 0.7 * g0.sat, `${id}: colour kept (sat × ${(g.sat / g0.sat).toFixed(2)})`);
  check(g.contrast >= 0.85 && g.contrast <= 1.3, `${id}: contrast ${g.contrast.toFixed(2)} in range`);
  check(g.lift.every((l) => l <= 0.05), `${id}: darks not lifted to grey`);
  check(s.hemi >= 0.9 && s.env >= 0.7 && (s.sun ?? 1) >= 0.5, `${id}: enough light on the men`);
  // the pitch stays a green a player stands out on
  for (const tod of ["day", "golden", "night"] as const) {
    const shades = s.flatGrass ?? (s.grass ? TODS[tod].grass.map((h) => packGrass(h, s.grass!)) : TODS[tod].grass);
    for (const h of shades) {
      const n = parseInt(h.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
      check(gg > r && gg > b, `${id} ${tod}: grass ${h} is green`);
      check(luma(h) > 35 && luma(h) < 215, `${id} ${tod}: grass ${h} neither black nor white`);
    }
  }
}

if (problems.length) { console.error(`texturePacks: ${problems.length} problem(s)\n - ` + problems.join("\n - ")); process.exit(1); }
console.log("texturePacks: all checks passed");
