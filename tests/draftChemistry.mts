import assert from "node:assert/strict";
import { chemistry, withChemistry, neighbours, linkStrength, chemIfPlaced } from "../lib/draft/chemistry";
import { FORMATIONS } from "../components/draft/formations";
const f = FORMATIONS.find((x) => x.name === "4-3-3")!;
const nb = neighbours(f);
// every spot links to someone; no one links to everyone
assert.ok(nb.every((n) => n.length >= 1 && n.length <= 6), JSON.stringify(nb));
const P = (i: number, club: string, yr: string, nat: string, pos?: string) => ({
  name: "p" + i, overall: 80, positions: pos ?? f.slots[i].label, club, clubYear: `X ${yr}`, assignedPosition: f.slots[i].label,
  sofifa_id: String(i), image_url: null, nationality: nat, age: 25, slotIndex: i, attrs: { pace: 80 } as never,
});
const allSame = f.slots.map((_, i) => P(i, "Arsenal", "03/04", "England"));
const mixed = f.slots.map((_, i) => P(i, "Club" + i, "0" + i, "Nation" + i));
assert.equal(chemistry(allSame, "4-3-3").team, 33, "the Invincibles together: full chemistry");
assert.equal(chemistry(mixed, "4-3-3").team, 0, "no links: none");
assert.equal(linkStrength(allSame[0], allSame[1]), 3);
assert.equal(linkStrength(P(0, "Arsenal", "03/04", "E"), P(1, "Arsenal", "10/11", "F")), 2);
assert.equal(linkStrength(P(0, "A", "1", "France"), P(1, "B", "2", "France")), 1);
const boosted = withChemistry(allSame, "4-3-3");
assert.equal(boosted[0].overall, 83); assert.equal((boosted[0].attrs as unknown as { pace: number }).pace, 83);
assert.equal(allSame[0].overall, 80, "the original squad is not changed");
// out of position: no chemistry for him
const oop = allSame.map((p, i) => (i === 0 ? { ...p, positions: "ST" } : p));
assert.equal(chemistry(oop, "4-3-3").perSlot[0], 0);
assert.ok(chemIfPlaced(allSame.slice(1), allSame[0], 0, "4-3-3") > 0);
console.log("draftChemistry: ok", chemistry(allSame.map((p, i) => (i % 2 ? p : { ...p, club: "C" + i, nationality: "N" + i })), "4-3-3").team);
