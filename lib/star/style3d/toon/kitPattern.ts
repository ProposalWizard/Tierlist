/**
 * STYLE A KIT PATTERNS — stripes, hoops, halves or contrast sleeves on the
 * Style A shirt (Harry, 9 Oct 2026: "have we done the shirt textures?").
 *
 * The club sheets (lib/star/data/clubProfiles.ts) give a pattern in words
 * ("Red and white stripes", "Green and white hoops"). The 3D scenes only get
 * a kit's two colours, not the club, so the pattern is found from the colours:
 * the club whose home kit has exactly that shirt and trim. A colour pair that
 * two clubs share, one patterned and one plain, gets no pattern (never a wrong
 * one). Pure: tested in tests/star/toonPeople.mts.
 */
import { CLUB_KITS } from "../../kits";
import { CLUB_PROFILES, COLOUR_WORDS } from "../../data/clubProfiles";

export type KitPatternKind = "stripes" | "hoops" | "halves" | "sleeves";
export interface KitPattern { kind: KitPatternKind; /** the second colour (the shirt is the first) */ colour: string }

/** Shader code for each kind (uPattern.x in style3d/toon/shader.ts). */
export const KIT_PATTERN_CODE: Record<KitPatternKind, number> = { stripes: 1, hoops: 2, halves: 3, sleeves: 4 };

/** "Red and white stripes" → stripes in white on a red shirt; "Plain"/unknown → none. */
export function parseKitPattern(words: string | undefined, shirt: string, trim: string): KitPattern | null {
  if (!words) return null;
  const w = words.toLowerCase();
  const kind: KitPatternKind | null = /hoop/.test(w) ? "hoops" : /stripe/.test(w) ? "stripes" : /halves|halved/.test(w) ? "halves" : /sleeve/.test(w) ? "sleeves" : null;
  if (!kind) return null;
  // the second colour: a colour word in the words that is not the shirt's, else the trim
  const names = Object.keys(COLOUR_WORDS).sort((a, b) => b.length - a.length);
  const found: string[] = [];
  let rest = w;
  for (const n of names) {
    const i = rest.indexOf(n);
    if (i >= 0) { found.push(COLOUR_WORDS[n]); rest = rest.slice(0, i) + " ".repeat(n.length) + rest.slice(i + n.length); }
  }
  const sh = shirt.toLowerCase();
  const other = found.find((h) => h.toLowerCase() !== sh && !near(h, shirt));
  // the club's own trim when it is that colour (Villa's sky blue sleeves in Villa's own sky blue)
  return { kind, colour: !other || near(other, trim) ? trim : other };
}

function near(a: string, b: string): boolean {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 90;
}

const key = (shirt: string, trim: string) => `${shirt.toLowerCase()}|${trim.toLowerCase()}`;
let byColours: Map<string, KitPattern | null> | null = null;

function table(): Map<string, KitPattern | null> {
  if (byColours) return byColours;
  const m = new Map<string, KitPattern | null>();
  for (const [club, kits] of Object.entries(CLUB_KITS)) {
    const prof = CLUB_PROFILES[club];
    for (const side of ["home", "away"] as const) {
      const k = kits[side];
      const words = side === "home" ? prof?.homeKit?.pattern : prof?.awayKit?.pattern;
      const pat = parseKitPattern(words, k.shirt, k.trim);
      const id = key(k.shirt, k.trim);
      if (!m.has(id)) m.set(id, pat);
      else {
        const was = m.get(id);
        // two clubs with these colours that disagree: no pattern at all
        if (!was || !pat || was.kind !== pat.kind || was.colour !== pat.colour) m.set(id, null);
      }
    }
  }
  byColours = m;
  return m;
}

/** The pattern of the club kit with exactly these colours, or null. */
export function kitPatternFor(shirt: string, trim: string): KitPattern | null {
  return table().get(key(shirt, trim)) ?? null;
}
