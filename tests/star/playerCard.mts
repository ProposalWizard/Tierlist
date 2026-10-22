import { makeInitialCareer } from "../../lib/star/careerFlow";
import { computeStarRating, displayOverall } from "../../lib/star/rating";
import { aerialOf } from "../../lib/star/aerial";
import { CARD_STATS, CARD_TIERS, cardData, cardGains, cardStatValues, cardTier } from "../../lib/star/playerCard";
import type { CareerState, StarPlayer, Skills } from "../../lib/star/types";

/**
 * THE PLAYER CARD (Harry, 22 Oct 2026: a FIFA-style card for your player).
 * Checks: the tier lines, the six stats and their labels, the card's overall
 * is the game's own overall, an old save (no Aerial) still shows a card, and
 * the "+2" flash only fires for a stat that went up.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 17, position: "ST",
    club: "Liverpool", nationality: "England", startYear: 2027, skinTone: "light",
    clubBadge: null, ...overrides,
  } as StarPlayer;
}
const CLUBS = ["Liverpool", "Arsenal", "Chelsea", "Everton"];

// 1. Tier lines.
check(cardTier(0) === "bronze" && cardTier(64) === "bronze", "64 and below is bronze");
check(cardTier(65) === "silver" && cardTier(74) === "silver", "65 to 74 is silver");
check(cardTier(75) === "gold" && cardTier(87) === "gold", "75 to 87 is gold");
check(cardTier(88) === "special" && cardTier(99) === "special", "88 and up is special");
check(CARD_TIERS.every((t, i) => i === 0 || t.from < CARD_TIERS[i - 1].from), "tier lines are in one list, highest first");

// 2. The six stats, in order, with their labels.
check(CARD_STATS.map(s => s.label).join(",") === "PAC,POW,TEC,VIS,FK,AIR", "labels are PAC POW TEC VIS FK AIR");
check(CARD_STATS.map(s => s.key).join(",") === "pace,power,technique,vision,freeKick,aerial", "labels map to the six skills");
const sk: Skills = { pace: 71.6, power: 55, technique: 80, vision: 62, freeKick: 49, aerial: 58 };
const v = cardStatValues(sk);
check(v.pace === 72 && v.power === 55 && v.technique === 80 && v.vision === 62 && v.freeKick === 49 && v.aerial === 58,
  `stat values are the skills, rounded (${JSON.stringify(v)})`);
check(cardStatValues({ ...sk, pace: 100 }).pace === 99, "a card never shows 100");

// 3. A new career: the card's overall is the game's own overall, and bronze.
const fresh = makeInitialCareer(player(), CLUBS);
const fd = cardData(fresh);
check(fd.overall === displayOverall(fresh.starRating), `card overall = displayOverall (${fd.overall} vs ${displayOverall(fresh.starRating)})`);
check(fd.tier === "bronze", `a new career is bronze (overall ${fd.overall})`);
check(fd.position === "ST", "position shown");

// The spread the lines were set from: every skill at 50 → silver, 64 → gold, 84 → special.
const at = (n: number): CareerState => {
  const c: CareerState = { ...fresh, skills: { pace: n, power: n, technique: n, vision: n, freeKick: n, aerial: n } };
  return { ...c, starRating: computeStarRating(c) };
};
check(cardData(at(50)).tier === "silver", `skills 50 → silver (overall ${cardData(at(50)).overall})`);
check(cardData(at(64)).tier === "gold", `skills 64 → gold (overall ${cardData(at(64)).overall})`);
check(cardData(at(84)).tier === "special", `skills 84 → special (overall ${cardData(at(84)).overall})`);
check(cardData(at(80)).tier === "gold", `skills 80 → still gold (overall ${cardData(at(80)).overall})`);

// 4. An old save with no Aerial still gets a card, Aerial read the game's way.
const oldSkills = { pace: 60, power: 70, technique: 50, vision: 55, freeKick: 45 } as unknown as Skills;
const old = { ...fresh, skills: oldSkills } as CareerState;
const od = cardData(old);
check(od.stats.aerial === aerialOf(oldSkills), `old save Aerial = aerialOf (${od.stats.aerial} vs ${aerialOf(oldSkills)})`);
check(Number.isFinite(od.overall) && od.overall > 0, "old save still has an overall");
const broken = cardData({ ...fresh, skills: undefined as unknown as Skills, starRating: undefined as unknown as number });
check(Object.values(broken.stats).every(n => Number.isFinite(n)) && Number.isFinite(broken.overall), "a save missing skills or rating still draws");

// 5. The flash: only stats that went up, by how much; nothing on first sight.
check(Object.keys(cardGains(null, v)).length === 0, "first sight: no flash");
const g = cardGains({ ...v, pace: v.pace - 2, vision: v.vision + 1 }, v);
check(g.pace === 2 && g.vision === undefined && Object.keys(g).length === 1, `only a rise flashes, with its size (${JSON.stringify(g)})`);

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`PASS — player card: tiers ${CARD_TIERS.map(t => `${t.tier}≥${t.from}`).join(" ")}; new career ${fd.overall} ${fd.tier}`);
