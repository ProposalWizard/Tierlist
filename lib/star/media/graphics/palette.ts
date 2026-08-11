/**
 * A CLUB'S COLOURS, TURNED INTO A USABLE PALETTE.
 *
 * Every template reads semantic roles — ground, ink, accent — and never a
 * literal colour, so one template dresses itself in whatever club the career is
 * at. `CareerState` already carries `kitPrimary` and `kitSecondary`, which have
 * sat there unused since the game was written; this is what they are for.
 *
 * The hard part is that a kit colour is chosen to look good on a shirt, not to
 * be legible behind white type. Newcastle's black and Tottenham's white both
 * break a naive "just use the kit colour" approach. So the primary is pushed
 * into a usable band for backgrounds, and the accent is derived to be bright
 * enough to read against it.
 */

export interface Palette {
  /** Deep background. Always dark enough for white type. */
  ground: string;
  /** A lift of the same hue, for gradients and light shafts. */
  groundLift: string;
  /** The club colour at full strength. Badges, rules, fills. */
  primary: string;
  /** The one bright note. Used once per graphic. */
  accent: string;
  /** Duotone shadow end. */
  duoDark: string;
  /** Duotone highlight end. */
  duoLight: string;
}

interface HSL { h: number; s: number; l: number }

function hexToHsl(hex: string): HSL {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0)
      : max === g ? (b - r) / d + 2
        : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

const css = ({ h, s, l }: HSL) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;

export function paletteFor(kitPrimary: string, kitSecondary?: string): Palette {
  const p = hexToHsl(kitPrimary || "#dc2626");

  // ── A kit colour is not a background colour ──
  //
  // A white kit gives l=100 and a black one l=0, and white type needs a dark
  // ground either way. Saturation is floored too: a greyscale kit would
  // otherwise produce a greyscale poster, which reads as an error rather than
  // as a choice.
  const hue = p.s < 8 ? 220 : p.h;          // colourless kit borrows a night blue
  const sat = Math.max(38, Math.min(88, p.s));

  const ground: HSL = { h: hue, s: sat * 0.85, l: 12 };
  const groundLift: HSL = { h: hue, s: sat * 0.9, l: 30 };
  const primary: HSL = { h: hue, s: sat, l: Math.max(38, Math.min(56, p.l)) };

  // The accent is the secondary kit colour when it is bright enough to be seen,
  // and otherwise a lift of the primary hue. Either way it has to survive being
  // set at 14 pixels on a dark ground.
  const sec = kitSecondary ? hexToHsl(kitSecondary) : null;
  const accent: HSL = sec && sec.l > 45 && sec.s > 12
    ? { h: sec.h, s: Math.max(55, sec.s), l: Math.max(62, Math.min(78, sec.l)) }
    : { h: hue, s: Math.min(92, sat + 18), l: 66 };

  return {
    ground: css(ground),
    groundLift: css(groundLift),
    primary: css(primary),
    accent: css(accent),
    // The two ends of the duotone. Shadows take the club's hue; highlights go
    // almost white so the figure still reads as lit rather than as a flat tint.
    duoDark: css({ h: hue, s: Math.min(70, sat), l: 16 }),
    duoLight: css({ h: hue, s: 22, l: 94 }),
  };
}

/** Two or three letters for a procedural crest, when there is no badge file. */
export function crestInitials(club: string): string {
  const skip = new Set(["fc", "afc", "united", "city", "town", "the", "and", "&"]);
  const words = club.split(/\s+/).filter(w => !skip.has(w.toLowerCase()));
  if (words.length >= 2) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return club.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
