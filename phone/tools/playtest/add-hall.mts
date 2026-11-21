/**
 * HALL OF FAME CAREERS FOR BOTH APPS (playtest, 21 Nov 2026). Takes a save made by
 * make-save.mts / save-from.mts / make-season-end.mts ({ packed, next }) and adds
 * N retired careers to the Hall of Fame of both apps (the packed app's
 * "star-hall-of-fame-v1::anon", KIB Next's "knowitball-career\hall-of-fame-v1").
 * The careers are copies of the save's own career with other names, clubs and
 * goal totals, so the list, Compare and a career's page have something to show.
 *
 *   npx tsx phone/tools/playtest/add-hall.mts save.json 3 > save-hall3.json
 */
import fs from "node:fs";
import { hallEntryFor, sanitizeHallBook, HALL_KEY } from "../../../lib/star/hallOfFame";
import { ANON_SCOPE } from "../../../lib/star/storage";
import type { CareerState } from "../../../lib/star/types";

const [file, nArg] = process.argv.slice(2);
if (!file) throw new Error("usage: add-hall.mts save.json [n]");
const n = Number(nArg ?? 1);
const sv = JSON.parse(fs.readFileSync(file, "utf8")) as { packed: Record<string, string>; next: Record<string, string> };
const base = JSON.parse(sv.next["knowitball-career\\career-v2"]) as CareerState;
const NAMES = [["Jack", "Lowe", "Arsenal"], ["Maximilian-Alexander", "Oxlade-Chamberlainson", "Wolverhampton Wanderers"], ["Sam", "Ba", "Maidenhead United"], ["Leo", "Grant", "Chelsea"]];
const entries = [];
for (let i = 0; i < n; i++) {
  const [firstName, lastName, club] = NAMES[i % NAMES.length];
  const c = { ...base, player: { ...base.player, firstName, lastName, club },
    careerStats: { ...(base.careerStats as object), goals: 120 + i * 97, assists: 40 + i * 31 } } as CareerState;
  entries.push(hallEntryFor(c, Date.UTC(2026, 10, 1 + i)));
}
const book = sanitizeHallBook({ entries, removed: [] });
const account = ANON_SCOPE.split("#slot")[0];
sv.packed[`${HALL_KEY}::${account}`] = JSON.stringify(book);
sv.next["knowitball-career\\hall-of-fame-v1"] = JSON.stringify(book);
console.log(JSON.stringify(sv));
