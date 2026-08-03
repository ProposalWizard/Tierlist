import { makeFakeDb, buildRows } from "./fakeSupabase.mjs";
import {
  fetchRoundPlayers, fetchMixedRoundPlayers, AM_POSITION_SEQUENCE,
  americanPicksToSquad, pickedPlayerKeys, makeReplacementState,
  participantsForRound, goalkeepersNeeded, playerNameKey,
} from "../../lib/americanDraft";
import type { SquadPick } from "../../lib/americanDraft";

const db = makeFakeDb({ rows: buildRows() });
const USERS = ["alice", "bob"];
const picks: Record<string, SquadPick[]> = { alice: [], bob: [] };
const problems: string[] = [];

// ── Full 14-round initial draft ──
for (let round = 0; round < AM_POSITION_SEQUENCE.length; round++) {
  const pos = AM_POSITION_SEQUENCE[round];
  const pool = await fetchRoundPlayers(db as never, pos, pickedPlayerKeys(picks), {});

  if (pool.length !== 10) problems.push(`round ${round + 1}: pool had ${pool.length}, expected 10`);
  const ids = pool.map(p => p.sofifa_id);
  if (new Set(ids).size !== ids.length) problems.push(`round ${round + 1}: duplicate player in pool`);
  const names = pool.map(p => playerNameKey(p.name));
  if (new Set(names).size !== names.length) problems.push(`round ${round + 1}: duplicate NAME in pool`);
  for (const p of pool) {
    if (!p.fifa_year) problems.push(`round ${round + 1}: ${p.name} has no fifa_year (attributes would be lost)`);
    if (!p.season) problems.push(`round ${round + 1}: ${p.name} has no season label`);
  }
  // each manager takes one
  USERS.forEach((u, i) => {
    picks[u].push({ round, position: pos, player: pool[i] });
  });
}

// ── Nobody may hold the same footballer ──
const all = USERS.flatMap(u => picks[u].map(p => p.player.sofifa_id));
if (new Set(all).size !== all.length) problems.push("a footballer was drafted by more than one manager");
for (const u of USERS) {
  const squad = americanPicksToSquad(picks[u]);
  const starters = squad.filter(p => !p.isSub).length;
  const subs = squad.filter(p => p.isSub).length;
  if (squad.length !== 14) problems.push(`${u}: squad has ${squad.length}, expected 14`);
  if (starters !== 11) problems.push(`${u}: ${starters} starters, expected 11`);
  if (subs !== 3) problems.push(`${u}: ${subs} subs, expected 3`);
  // everyone must be eligible for the slot they were drafted into
  for (const pick of picks[u]) {
    if (pick.position === "ANY") continue;
    const nat = pick.player.positions.toUpperCase().split(",").map(s => s.trim());
    const ok = nat.includes(pick.position) ||
      (pick.position === "CM" && (nat.includes("CDM") || nat.includes("CAM"))) ||
      (pick.position === "RB" && nat.includes("RWB")) ||
      (pick.position === "LB" && nat.includes("LWB")) ||
      (pick.position === "RW" && nat.includes("RM")) ||
      (pick.position === "LW" && nat.includes("LM")) ||
      (pick.position === "ST" && nat.includes("CF"));
    if (!ok) problems.push(`${u}: ${pick.player.name} (${pick.player.positions}) drafted at ${pick.position}`);
  }
}

// ── Between-season replacement draft ──
const owned = new Set<string>();
USERS.forEach(u => picks[u].forEach(p => {
  owned.add(`id:${p.player.sofifa_id}`);
  owned.add(`name:${playerNameKey(p.player.name)}`);
}));
const vacancies = { alice: 3, bob: 1 };
const needsGk = { alice: true, bob: false };
const order = ["alice", "bob"];
let parts = participantsForRound(vacancies, order);
const first = await fetchMixedRoundPlayers(db as never, owned, {}, goalkeepersNeeded(parts, needsGk));
const state = makeReplacementState(vacancies, needsGk, order, first);

if (state.position_sequence.length !== 3) problems.push(`replacement rounds = ${state.position_sequence.length}, expected 3`);
if (first.length !== 10) problems.push(`replacement pool = ${first.length}, expected 10`);
const gks = first.filter(p => p.positions.toUpperCase().includes("GK")).length;
if (gks < 1) problems.push(`replacement pool had ${gks} keepers, alice needed one guaranteed`);
for (const p of first) {
  if (owned.has(`id:${p.sofifa_id}`)) problems.push(`replacement pool offered an already-owned player: ${p.name}`);
}
const repl = americanPicksToSquad([{ round: 0, position: "ANY", player: first[0] }], false);
if (repl[0].isSub) problems.push("replacement was marked a substitute");

console.log(problems.length === 0
  ? `PASS — full 14-round draft + replacement draft, no issues found`
  : `FOUND ${problems.length} PROBLEM(S):\n` + problems.map(p => "  - " + p).join("\n"));
console.log(`  guaranteed keepers in replacement pool: ${gks}`);
console.log(`  replacement rounds: ${state.position_sequence.length} (alice 3, bob 1)`);
