// Home's sky by kick-off (lib/star/kickoff.ts). Sunset is the base picture
// (Harry, 2 Oct 2026, v0.24 P1-18): day only for a morning kick-off (before
// 13:00), night only for a game played after dark, sunset for everything else.
import { kickoffHour, skyAt, formatKickoff, homeSkyFor, MORNING_BEFORE } from "../../lib/star/kickoff.ts";
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) fail++; };

ok(MORNING_BEFORE === 13, "a morning kick-off is one before 13:00");
// Morning: day, in every month.
for (let m = 0; m < 12; m++) ok(skyAt(m, 12.5) === "day", `month ${m + 1}: 12:30 is day`);
// Afternoon in daylight: sunset now (was day before v0.24).
ok(skyAt(7, 15) === "sunset", "Aug 15:00 is sunset (the base picture), not day");
ok(skyAt(5, 14) === "sunset", "Jun 14:00 is sunset");
ok(skyAt(7, 17.5) === "sunset", "Aug 17:30 is sunset");
ok(skyAt(11, 15) === "sunset", "Dec 15:00 is sunset");
// After dark: night.
ok(skyAt(11, 17.5) === "night", "Dec 17:30 is night");
ok(skyAt(10, 19.75) === "night", "Nov 19:45 is night");
ok(skyAt(0, 20) === "night", "Jan 20:00 is night");
// A summer evening game that is still light: sunset.
ok(skyAt(7, 19.75) === "sunset", "Aug 19:45 is sunset (still light)");
// Nothing afternoon or later is ever day.
let dayAfterNoon = 0;
for (let m = 0; m < 12; m++) for (let h = 13; h <= 21; h += 0.25) if (skyAt(m, h) === "day") dayAfterNoon++;
ok(dayAfterNoon === 0, `no kick-off from 13:00 on is day (${dayAfterNoon} found)`);

// With no next match, Home shows the base picture.
ok(homeSkyFor({} as never, null) === "sunset", "no next match: sunset");

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
// How often each sky shows over a season's worth of Saturday slots in August.
const mix: Record<string, number> = {};
for (let i = 0; i < 400; i++) { const s = skyAt(7, kickoffHour(sat, "m" + i)); mix[s] = (mix[s] ?? 0) + 1; }
console.log(`  Saturday in August, 400 matches: ${JSON.stringify(mix)}`);
ok((mix.day ?? 0) > 0 && (mix.day ?? 0) < (mix.sunset ?? 0), "day only for the 12:30s; sunset is the most common");
if (fail) { console.log("FAIL"); process.exit(1); }
