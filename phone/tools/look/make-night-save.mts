/**
 * A CAREER WITH A BALLON D'OR LIST AND MADE-UP SEASON AWARDS (the look check of the two 3D nights). Prints JSON:
 *   { next: {localStorage key: value}, entries: n, rank: n, awards: n }
 * Built the way the website's test pages build theirs: lib/star/retirementPreview.ts `previewCareer` (a played-out
 * career with a real league and squads), then the awards of app/star-awards-night-dev/page.tsx (you win the Golden
 * Boot and Player of the Season, three others win the rest; made-up names, nothing real).
 *
 *   npx tsx phone/tools/look/make-night-save.mts
 */
import { previewCareer } from "../../../lib/star/retirementPreview";
import { computeBallonDorShortlist } from "../../../lib/star/ballonDor";
import { computeSeasonAwardStats, type AwardWinner, type SeasonAwardStats } from "../../../lib/star/seasonAwards";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const NAMES = ["Marco Velasco", "Tomas Ferreira", "Jonas Albrecht", "Luca Moretti", "Kenji Arai", "Adrien Lacroix", "Rui Saldanha", "Emre Kaya", "Diego Rios", "Sam Okafor", "Theo Lindqvist", "Ollie Brennan"];
const seed = 1;
const base = previewCareer("legend", seed, { upTo: 6 });
const real = computeSeasonAwardStats(base);
const me = `${base.player.firstName} ${base.player.lastName}`;
const clubs = (base.league ?? []).map((t) => t.name).filter((n) => n !== base.player.club);
const club = (i: number) => clubs[(i + seed) % Math.max(1, clubs.length)] ?? "Arsenal";
const you = (value: number): AwardWinner => ({ name: me, club: base.player.club, isYou: true, value, image: base.player.portrait });
const them = (i: number, value: number): AwardWinner => ({ name: NAMES[(i + seed) % NAMES.length], club: club(i), isYou: false, value });
const nominees: NonNullable<SeasonAwardStats["nominees"]> = {
  goldenBoot: [you(27), them(0, 23), them(1, 19)],
  assistKing: [them(2, 15), you(12), them(3, 11)],
  goldenGlove: [them(4, 17), them(5, 15), them(6, 13)],
  youngPlayerOfSeason: [them(7, 88), you(85), them(8, 80)],
  playerOfSeason: [you(112), them(0, 104), them(9, 99)],
};
const stats: SeasonAwardStats = {
  ...real,
  goldenBoot: nominees.goldenBoot![0], assistKing: nominees.assistKing![0], goldenGlove: nominees.goldenGlove![0],
  youngPlayerOfSeason: nominees.youngPlayerOfSeason![0], playerOfSeason: nominees.playerOfSeason![0], nominees,
};
const career = { ...base, lastSeasonAwardStats: stats, energy: 100, unlocks: undefined };
const r = computeBallonDorShortlist(career);
console.log(JSON.stringify({
  next: { "knowitball-career\\career-v2": JSON.stringify(career) },
  entries: r.entries.length, rank: r.playerNominated ? r.playerRank : 0, awards: Object.keys(nominees).length,
}));
