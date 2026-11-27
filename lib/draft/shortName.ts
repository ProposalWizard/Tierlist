/**
 * lib/draft/shortName.ts — the surname shown on Draft cards, pitches and
 * goal lines. Taking only the last word turned "K. De Bruyne" into "Bruyne"
 * and "V. van Dijk" into "Dijk" (seen in a simulated season, 24 Nov 2026).
 * Surname particles that come before the last word are kept.
 */
const PARTICLES = new Set([
  "de", "da", "das", "do", "dos", "di", "du", "del", "della", "der", "den",
  "van", "von", "le", "la", "ten", "ter", "el", "al", "st.", "mac", "dal",
]);

export function shortName(full: string): string {
  const words = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  let i = words.length - 1;
  while (i > 0 && PARTICLES.has(words[i - 1].toLowerCase())) i--;
  // Never hand back an initial ("K.") as the surname.
  if (i === 0 && /\.$/.test(words[0])) i = 1;
  return words.slice(i).join(" ");
}
