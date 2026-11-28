// npx tsx tests/tenable/daily.mts — today's Ten-A-Ball challenge changes daily and cycles through all.
import { pickDaily, ukToday } from "../../lib/tenable/daily";
let fails = 0; const ok = (c: boolean, m: string) => { console.log(c ? "  ✓" : "  FAIL", m); if (!c) fails++; };
const items = Array.from({ length: 33 }, (_, i) => ({ id: `p${i}`, created_at: `2026-05-${String(1 + (i % 28)).padStart(2, "0")}T00:00:${String(i).padStart(2, "0")}Z`, daily_date: null as string | null }));
const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n)).toISOString().slice(0, 10);
const picks = Array.from({ length: 33 }, (_, n) => pickDaily(items, day(n))!.id);
ok(new Set(picks).size === 33, "33 days in a row give 33 different challenges");
ok(picks.every((p, n) => n === 0 || p !== picks[n - 1]), "never the same two days running");
ok(pickDaily(items, day(0))!.id === pickDaily(items, day(33))!.id, "the cycle starts again after 33 days");
ok(pickDaily([...items].reverse(), day(5))!.id === picks[5], "the database's order does not change the pick");
const dated = items.map((p, i) => (i === 7 ? { ...p, daily_date: day(2) } : p));
ok(pickDaily(dated, day(2))!.id === "p7", "a hand-dated challenge wins on its day");
ok(pickDaily([], day(0)) === null, "no challenges: nothing, no crash");
ok(ukToday(new Date("2026-06-30T23:30:00Z")) === "2026-07-01", "UK date: 23:30 UTC in summer is already tomorrow");
console.log(fails ? `${fails} FAILED` : "All passed"); process.exit(fails ? 1 : 0);
