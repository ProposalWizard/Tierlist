// Home's sky by kick-off (lib/star/kickoff.ts): weekday nights are under
// lights, a Saturday 15:00 in August is day, the same slot in December is
// sunset, and a 17:30 in December is night.
import { kickoffHour, skyAt, formatKickoff } from "../../lib/star/kickoff.ts";
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) fail++; };
ok(skyAt(7, 15) === "day", "Aug 15:00 is day");
ok(skyAt(11, 15) === "sunset", "Dec 15:00 is sunset");
ok(skyAt(11, 17.5) === "night", "Dec 17:30 is night");
ok(skyAt(7, 19.75) === "sunset" || skyAt(7, 19.75) === "night", "Aug 19:45 is sunset or night");
ok(skyAt(10, 19.75) === "night", "Nov 19:45 is night");
const counts: Record<string, number> = {};
for (let i = 0; i < 200; i++) {
  const wed = new Date(2026, 8, 2); // a Wednesday
  const h = kickoffHour(wed, "k" + i);
  counts[formatKickoff(h)] = (counts[formatKickoff(h)] ?? 0) + 1;
}
ok(Object.keys(counts).every((k) => k === "19:45" || k === "20:00"), `weekday slots only 19:45/20:00 (${JSON.stringify(counts)})`);
const sat = new Date(2026, 7, 29); // Saturday 29 Aug
const satSlots = new Set(Array.from({ length: 200 }, (_, i) => formatKickoff(kickoffHour(sat, "s" + i))));
ok([...satSlots].every((s) => ["12:30", "15:00", "17:30"].includes(s)) && satSlots.has("15:00"), `Saturday slots ${[...satSlots].join(" ")}`);
ok(kickoffHour(sat, "same") === kickoffHour(sat, "same"), "the same match always has the same time");
if (fail) { console.log("FAIL"); process.exit(1); }
