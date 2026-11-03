/**
 * MULTIPLAYER DRAFT: A WINNER WHO QUALIFIES FROM OUTSIDE THE TOP FIVE
 * (lib/seasonSimulator.ts). Last season's Champions League or Europa League
 * winner plays in the Champions League even if he finished 10th. His club
 * used to be missing from the league phase's pots, so building the table
 * threw "Cannot convert undefined or null to object" and the room's season
 * never simulated (live: 7 crashes on /api/draft/rooms/[code]/simulate,
 * Aug-Oct 2026). Also checks two humans see the same record for each other.
 */
import { simulateSharedSeason, type DraftPlayer } from "../../lib/seasonSimulator";

let fails = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fails++; console.log("  ✗", what); } else console.log("  ✓", what); };

const POS = ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "CAM", "RW", "LW", "ST"];
const squad = (tag: string, ovr: number): DraftPlayer[] => [
  ...POS.map((p, i) => ({ name: `${tag} ${i}`, overall: ovr, positions: p, club: "X", clubYear: "2024", assignedPosition: p, age: 25 })),
  ...[0, 1, 2, 3, 4].map((i) => ({ name: `${tag} sub${i}`, overall: ovr - 5, positions: "CM", club: "X", clubYear: "2024", assignedPosition: "CM", age: 25, isSub: true })),
];
const AI = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Spurs", "Newcastle", "Villa", "Brighton", "West Ham", "Palace", "Fulham", "Wolves", "Everton", "Brentford", "Forest", "Bournemouth", "Leeds", "Burnley"];
const humans = [
  { userId: "u1", displayName: "One", teamName: "Human One", squad: squad("A", 84) },
  { userId: "u2", displayName: "Two", teamName: "Human Two", squad: squad("B", 82) },
];
// Last season: Human One 10th, Human Two 3rd.
const order = [...AI.slice(0, 2), "Human Two", ...AI.slice(2, 9), "Human One", ...AI.slice(9)];
const prev = order.map((name, i) => ({ name, played: 38, won: 20 - Math.floor(i / 2), drawn: 8, lost: 10 + Math.floor(i / 2), gf: 60 - i, ga: 30 + i, points: 68 - i * 2, isPlayer: name.startsWith("Human") }));
const ai = AI.map((name, i) => ({ name, strength: 86 - i }));

for (const [label, won] of [["Champions League", { uclWinner: true, uelWinner: false }], ["Europa League", { uclWinner: false, uelWinner: true }]] as const) {
  let threw: unknown = null;
  let res: ReturnType<typeof simulateSharedSeason> | null = null;
  try {
    res = simulateSharedSeason(humans, ai, 12345, 2, prev, { u1: { ...won, faCupWinner: false }, u2: { uclWinner: false, uelWinner: false, faCupWinner: false } });
  } catch (e) { threw = e; }
  check(!threw, `last season's ${label} winner, 10th in the league: the season simulates (${threw ? String(threw) : "ok"})`);
  if (!res) continue;
  const r1 = res.get("u1") as unknown as { ucl?: { leagueTable?: { name: string; played: number; points: number }[] } };
  const r2 = res.get("u2") as unknown as { ucl?: { leagueTable?: { name: string; played: number; points: number }[] } };
  const t1 = r1?.ucl?.leagueTable, t2 = r2?.ucl?.leagueTable;
  check(!!t1?.some((t) => t.name === "Human One" && t.played > 0), `${label} winner plays the Champions League league phase`);
  const one1 = t1?.find((t) => t.name === "Human One"), one2 = t2?.find((t) => t.name === "Human One");
  const two1 = t1?.find((t) => t.name === "Human Two"), two2 = t2?.find((t) => t.name === "Human Two");
  // The record only: each viewer marks his own row (isPlayer).
  const rec = (r?: Record<string, unknown>) => (r ? JSON.stringify({ ...r, isPlayer: undefined }) : "none");
  check(!!one2 && rec(one1) === rec(one2) && rec(two1) === rec(two2), `${label}: both humans see the same record for each other`);
}

// An FA Cup winner who finished 10th: entered for the Europa League, and now
// he plays it (the phase used to turn away anyone but 6th and 7th).
{
  const res = simulateSharedSeason(humans, ai, 777, 2, prev, { u1: { uclWinner: false, uelWinner: false, faCupWinner: true }, u2: { uclWinner: false, uelWinner: false, faCupWinner: false } });
  const uel = (res.get("u1") as unknown as { uel?: { qualified?: boolean; leagueTable?: { name: string; played: number }[] } }).uel;
  check(!!uel?.qualified && !!uel.leagueTable?.some((t) => t.name === "Human One" && t.played > 0), "FA Cup winner, 10th: plays the Europa League league phase");
}
// 6th in the league still plays it, as before.
{
  const order6 = [...AI.slice(0, 5), "Human One", "Human Two", ...AI.slice(5)];
  const prev6 = order6.map((name, i) => ({ name, played: 38, won: 20, drawn: 8, lost: 10, gf: 60 - i, ga: 30 + i, points: 68 - i * 2 }));
  const res = simulateSharedSeason(humans, ai, 99, 2, prev6, undefined);
  const u1 = (res.get("u1") as unknown as { uel?: { qualified?: boolean; leagueTable?: { name: string; played: number }[] } }).uel;
  const u2 = (res.get("u2") as unknown as { uel?: { qualified?: boolean } }).uel;
  check(!!u1?.qualified && !!u2?.qualified && (u1.leagueTable?.length ?? 0) === 36, `6th and 7th play the Europa League, 36 clubs (${u1?.leagueTable?.length})`);
}

if (fails) { console.log(`FAIL (${fails})`); process.exit(1); }
console.log("PASS — a European winner from outside the top five plays the Champions League without a crash");
