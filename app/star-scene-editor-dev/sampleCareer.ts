/**
 * The made-up career the editor's Shop, Garden and House are built from — the
 * same one their own test pages use (/star-garden3d-dev, /star-home3d-dev):
 * Arsenal, trophies, a horse, cars, a full cabinet. Nothing is saved.
 */
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { LIFESTYLE_LEVELS, BOOT_LEVELS, baseIdOf } from "@/lib/star/shopDefaults";
import type { CareerState, StarPlayer } from "@/lib/star/types";

const TROPHIES = [
  { competition: "Premier League", n: 2 }, { competition: "Champions League", n: 1 }, { competition: "FA Cup", n: 3 },
  { competition: "League Cup", n: 1 }, { competition: "Europa League", n: 1 }, { competition: "Community Shield", n: 2 },
];
const AWARDS = [{ kind: "Golden Boot", n: 2 }, { kind: "Player of the Season", n: 1 }, { kind: "Player of the Month", n: 4 }];

export function sampleCareer(): CareerState {
  const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
  const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
  c.squad = generateSquad(7);
  const own = (base: string, level: number) => {
    const it = LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base && (l.level ?? 1) === level) ?? LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base);
    return it ? [{ ...it }] : [];
  };
  c.ownedItems = [...own("house-2", 3), ...own("stable", 4), ...own("car-3", 5), ...own("suv", 3), ...own("classic", 3), ...own("car-1", 2),
    ...own("rolex", 1), ...own("gold", 1), ...own("tv", 1), ...own("console", 1), ...own("art", 1), ...own("bike", 1)];
  c.kibCans = { basic: 6, premium: 3, elite: 1 };
  const boot = BOOT_LEVELS.find((b) => baseIdOf(b) === "elite" && (b.level ?? 1) === 3);
  if (boot) c.currentBoot = { ...boot };
  c.trophies = TROPHIES.flatMap((t) => Array.from({ length: t.n }, (_, i) => ({ season: i + 1, competition: t.competition, club: "Arsenal" })));
  c.awards = AWARDS.flatMap((a) => Array.from({ length: a.n }, (_, i) => ({ season: i + 1, kind: a.kind, week: a.kind === "Player of the Month" ? 4 + i : undefined, detail: "" })));
  c.ballonDorWins = 1;
  c.horse = { name: "Thunder Bolt", breed: "Thoroughbred", speed: 82, stamina: 74, energy: 90, racesRun: 12, racesWon: 5, earnings: 40000 };
  c.money = 250000;
  return c;
}
