/**
 * PLAY N MORE MATCHES ON A REAL CAREER, HEADLESS (round 2 playtest, 21 Nov 2026).
 * Reads a career JSON (a bare CareerState, or a localStorage dump of either app holding one),
 * credits the next N fixtures the way make-career-states.mts does (a goal in each win, an
 * assist, a 7.2 rating) and prints the career JSON. Feed it to save-from.mts to load both apps.
 * The unlocks and story fields are kept, so Home shows what a player would see after N games
 * (the beats that come from the match screens themselves are not raised).
 *
 *   npx tsx phone/tools/playtest/advance.mts career-or-dump.json N [--lose] [--seen training,candeal] [--trained] > career.json
 * --seen: story beats to mark as seen (unlocks.seen gets beat-<name>); --trained: the training day's two drills done.
 */
import fs from "node:fs";
import { creditMatchResult, simulateMissedFixture } from "../../../lib/star/careerFlow";
import { nextFixtureFor } from "../../../lib/star/competitions";
import type { CareerState, MatchStats } from "../../../lib/star/types";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; },
} as Storage;

const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let c: CareerState | null = null;
if (raw && raw.player && raw.fixtures) c = raw;
else if (raw && raw.career) c = typeof raw.career === "string" ? JSON.parse(raw.career) : raw.career;
else for (const [k, v] of Object.entries(raw)) if (/career-v2/.test(k)) { const o = JSON.parse(v as string); c = o.player ? o : (o.career ?? o.data ?? null); if (typeof c === "string") c = JSON.parse(c); }
if (!c) throw new Error("no career in " + process.argv[2]);
const n = Number(process.argv[3] ?? 1);
const lose = process.argv.includes("--lose");
for (let i = 0; i < n; i++) {
  const f = nextFixtureFor(c);
  if (!f) break;
  const home = f.home !== false;
  const [us, them] = lose ? [0, 2] : i % 3 === 2 ? [1, 1] : [2, 1];
  const goals = us > 0 ? 1 : 0;
  const st = { chances: 5, goals, assists: us > 1 ? 1 : 0, passes: 28, rating: 7.2, starMan: false, bossChange: 1, teamChange: 1, fansChange: 1,
    wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2, homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90 } as MatchStats;
  try { c = creditMatchResult(c, f, st).career; } catch { c = simulateMissedFixture(c, f).career; }
}
const sa = process.argv.indexOf("--seen");
// what each beat opens (lib/star/story.ts OPENS)
const OPENS: Record<string, string[]> = { training: ["training"], phone: ["phone", "relations"], shop: ["shop"], stats: ["stats", "achievements"], sponsor: ["sponsors"] };
if (c.unlocks && sa > 0) {
  const bs = process.argv[sa + 1].split(",");
  c = { ...c, unlocks: { ...c.unlocks, seen: [...new Set([...(c.unlocks.seen ?? []), ...bs.map((b) => `beat-${b}`)])],
    open: [...new Set([...(c.unlocks.open ?? []), ...bs.flatMap((b) => OPENS[b] ?? [])])] as typeof c.unlocks.open } };
}
if (c.unlocks && process.argv.includes("--trained")) c = { ...c, unlocks: { ...c.unlocks, trainingDay: ["power", "technique"] } };
console.log(JSON.stringify(c));
