/**
 * Made-up footballers' names that sound like the nation they play for — for
 * the gaps in a national squad the save has no real players to fill (Egypt
 * with seven real players the game knows, say: the other sixteen are made up).
 *
 * THE BANKS (Mikey, 13 Oct 2026: "for each nationality … a very large bank
 * of names … common Kenyan names … common English names … common Egyptian
 * names"). data/names/nation-names.json holds, for each of the game's 211
 * nations, up to 100 first names and 160 surnames, most common first. They
 * are the real names of that country's male footballers on Wikidata (every
 * player whose citizenship or sporting nationality is that country; England,
 * Scotland, Wales and Northern Ireland by sporting nationality), split into
 * first name and surname: surname first for China, Korea, Vietnam and the
 * like; "van", "de", "El" kept with the surname; a Spanish-speaking player's
 * first surname. A nation with few players on record is topped up from its
 * neighbours (see `from` in the file). Made by scripts/names/ (read its README).
 *
 * A name is a first name and a surname drawn separately, the common ones
 * more often (weight 1 / (rank + 4)^0.7: the top name about 8 times as
 * likely as the 100th), so a full name is never a real player's on purpose.
 * Surnames in one squad are all different while the bank has enough.
 * Seeded off the nation, so a nation always gets the same men.
 */
import { mulberry32 } from "./season";
import { clubNameSeed, FIRST_NAMES, LAST_NAMES } from "./squadData";
import banks from "../../data/names/nation-names.json";

interface NamePool { first: string[]; last: string[] }

const BANKS = banks as unknown as Record<string, { f: string[]; l: string[] }>;

/** Older spellings a save may still carry. */
const SAME: Record<string, string> = {
  USA: "United States", "Cote d'Ivoire": "Ivory Coast", "Côte d'Ivoire": "Ivory Coast", "Türkiye": "Turkey",
  Czechia: "Czech Republic", Ireland: "Republic of Ireland", "South Korea": "Korea Republic", "North Korea": "Korea DPR",
  China: "China PR", "IR Iran": "Iran", "Cabo Verde": "Cape Verde", Curaçao: "Curacao",
};

/** The name bank a nation draws its made-up players from. */
export function namePoolFor(nation: string): NamePool {
  const b = BANKS[nation] ?? BANKS[SAME[nation] ?? ""];
  return b && b.f.length && b.l.length ? { first: b.f, last: b.l } : { first: FIRST_NAMES, last: LAST_NAMES };
}

const weight = (rank: number) => 1 / Math.pow(rank + 4, 0.7);

/** A weighted pick from a most-common-first list. */
function pick(list: string[], rng: () => number): string {
  let total = 0;
  for (let i = 0; i < list.length; i++) total += weight(i);
  let r = rng() * total;
  for (let i = 0; i < list.length; i++) { r -= weight(i); if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

/** The list in a weighted random order (common ones tend to come first). */
function weightedDeck(list: string[], rng: () => number): string[] {
  return list
    .map((x, i) => ({ x, k: Math.pow(rng(), 1 / weight(i)) }))
    .sort((a, b) => b.k - a.k)
    .map((e) => e.x);
}

/**
 * `count` distinct made-up names for `nation`, the same every time for the
 * same nation (seeded off its name).
 */
export function madeUpNames(nation: string, count: number): string[] {
  const pool = namePoolFor(nation);
  const rng = mulberry32(clubNameSeed(`names|${nation}`));
  const used = new Set<string>();
  // A team sheet shows surnames only, so no two men share one while the bank
  // has surnames left: surnames are dealt from a weighted deck.
  const deck = weightedDeck(pool.last, rng);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let name = "";
    for (let tries = 0; tries < 50 && (!name || used.has(name)); tries++) {
      const last = i < deck.length && tries === 0 ? deck[i] : pick(pool.last, rng);
      name = `${pick(pool.first, rng)} ${last}`;
    }
    if (used.has(name)) name = `${name} ${i + 1}`;
    used.add(name);
    out.push(name);
  }
  return out;
}
