/**
 * A made-up career save for filming the people build in the real game (/star-dev, signed out):
 * everything open (no unlocks block), a flat, a squad. Prints the localStorage JSON.
 * Run: npx tsx scripts/people-save.mts > save.json
 */
import { makeInitialCareer } from "../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../lib/star/clubs";
import { generateSquad } from "../lib/star/squadData";
import { LIFESTYLE_LEVELS, baseIdOf } from "../lib/star/shopDefaults";
import type { CareerState, StarPlayer } from "../lib/star/types";

const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027, hairStyle: "short", hairColour: "brown", preferredFoot: "right" } as unknown as StarPlayer;
const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
c.squad = generateSquad(7);
delete (c as Partial<CareerState>).unlocks;
const home = process.argv[2];
if (home) { const it = LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === home); if (it) c.ownedItems = [...(c.ownedItems ?? []), { ...it }]; }
c.ownedItems = [...(c.ownedItems ?? []), ...LIFESTYLE_LEVELS.filter((l) => baseIdOf(l) === "phone").slice(0, 1).map((x) => ({ ...x }))];
c.energy = 60;
process.stdout.write(JSON.stringify(c));
