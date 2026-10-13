import { NATIONS } from "../../lib/star/intl/nations";
import { namePoolFor, madeUpNames } from "../../lib/star/nationNames";
import { FIRST_NAMES } from "../../lib/star/squadData";

/**
 * NAME BANKS (Mikey, 13 Oct 2026): every nation in the game has its own bank
 * of first names and surnames (data/names/nation-names.json), big enough for a
 * 26-man squad of made-up players with no surname twice.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

let minF = Infinity, minL = Infinity, sumF = 0, sumL = 0;
for (const n of NATIONS) {
  const p = namePoolFor(n.name);
  check(p.first !== FIRST_NAMES, `${n.name} has its own bank`);
  minF = Math.min(minF, p.first.length); minL = Math.min(minL, p.last.length);
  sumF += p.first.length; sumL += p.last.length;
  const squad = madeUpNames(n.name, 26);
  const surnames = new Set(squad.map((x) => x.split(" ").slice(1).join(" ")));
  check(surnames.size === 26, `${n.name}: 26 made-up players, 26 surnames (${surnames.size})`);
  check(JSON.stringify(squad) === JSON.stringify(madeUpNames(n.name, 26)), `${n.name}: the same names every time`);
}
check(minF >= 30 && minL >= 60, `every bank has at least 30 first names and 60 surnames (${minF} / ${minL})`);
check(namePoolFor("Cote d'Ivoire").last === namePoolFor("Ivory Coast").last, "older spellings find the same bank");
console.log(`${NATIONS.length} nations: first names ${minF}–100 (avg ${Math.round(sumF / NATIONS.length)}), surnames ${minL}–160 (avg ${Math.round(sumL / NATIONS.length)})`);
console.log(`Kenya: ${madeUpNames("Kenya", 5).join(", ")}`);

if (problems.length) { console.error("FAIL\n  - " + problems.slice(0, 20).join("\n  - ")); process.exit(1); }
console.log("PASS — every nation names its made-up players from its own bank, 26 different surnames, the same every time");
