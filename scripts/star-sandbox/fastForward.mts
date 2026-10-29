/**
 * scripts/star-sandbox/fastForward.mts — play the middle of a season with no
 * screens, so a browser playtest can jump from "game 10" to "the last games
 * of the season" and play the season end for real (seasons.mjs).
 *
 *   npx tsx scripts/star-sandbox/fastForward.mts <in.json> <out.json> [--leave 2]
 *
 * <in.json>/<out.json>: { career, phase } as seasons.mjs writes them.
 * Plays every fixture of the current season except the last --leave ones,
 * the same way scripts/robot/careerRobot.mts does: the game's own
 * creditMatchResult and finaliseMatch, an average player (0-3 goals a game).
 * Nothing else is changed: story flags, unlocks, money and phone stay as the
 * browser left them.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { creditMatchResult } from "../../lib/star/careerFlow";
import { finaliseMatch } from "../../lib/star/matchStats";
import { nextFixtureFor } from "../../lib/star/competitions";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, Fixture, MatchStats } from "../../lib/star/types";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, get length() { return store.size; },
} as Storage;

const [IN, OUT] = process.argv.slice(2);
const li = process.argv.indexOf("--leave");
const LEAVE = li > 0 ? Number(process.argv[li + 1]) : 2;
const rng = mulberry32(4242);
const save = JSON.parse(readFileSync(IN, "utf8"));
let c: CareerState = save.career;

function matchFor(career: CareerState, fixture: Fixture): MatchStats {
  const r = rng();
  const goals = r < 0.45 ? 0 : r < 0.85 ? 1 : r < 0.97 ? 2 : 3;
  const assists = rng() < 0.3 ? 1 : 0;
  const us = goals + (rng() < 0.55 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
  const them = rng() < 0.35 ? 0 : rng() < 0.75 ? 1 : 2;
  return finaliseMatch(4 + goals + Math.floor(rng() * 3), goals, assists, 20 + Math.floor(rng() * 15), 90, us, them, career, [], null, [], fixture);
}

/** How many of this season's fixtures are still to play (cups can add more). */
const left = (x: CareerState) => x.fixtures.filter((f) => !f.played).length;
const season = c.season;
let n = 0;
while (left(c) > LEAVE && n < 200) {
  const next = nextFixtureFor(c);
  if (!next) break;
  c = creditMatchResult(c, next, matchFor(c, next)).career;
  n++;
  if (c.season !== season) break;
}
writeFileSync(OUT, JSON.stringify({ career: c, phase: "dashboard" }));
console.log(`played ${n} matches · season ${c.season} · ${left(c)} fixtures left · goals ${c.seasonStats.goals} · apps ${c.seasonStats.appearances} · club ${c.player.club}`);
