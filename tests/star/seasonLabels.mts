/**
 * Season labels on the career overview, Hall of Fame and farewell screens use
 * the calendar's year (bug hunt, 22 Oct 2026): startYear is the FIFA edition,
 * so a career started in the 2027 edition plays 2026/27 first. These screens
 * used to say 2027/28 while the fixtures, Home and the calendar said 2026/27.
 */
import { shortSeason, longSeason } from "../../lib/star/careerOverview";
import { seasonStartYear } from "../../lib/star/calendar";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

ok(seasonStartYear(2027, 1) === 2026, "the calendar: edition 2027, season 1 starts in 2026");
ok(longSeason(2027, 1, true) === "2026/27", `long label, season 1 (got ${longSeason(2027, 1, true)})`);
ok(shortSeason(2027, 1, true) === "26/27", `short label, season 1 (got ${shortSeason(2027, 1, true)})`);
ok(longSeason(2027, 4, true) === "2029/30", `long label, season 4 (got ${longSeason(2027, 4, true)})`);
for (let s = 1; s <= 25; s++) ok(longSeason(2027, s, true).startsWith(String(seasonStartYear(2027, s))), `season ${s} label agrees with the calendar`);

// Switch off (Leo's 24 Oct update, bug fixes): the old labels, one year later.
ok(longSeason(2027, 1) === "2027/28", `switch off: the old label (got ${longSeason(2027, 1)})`);
ok(shortSeason(2027, 1) === "27/28", `switch off: the old short label (got ${shortSeason(2027, 1)})`);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
