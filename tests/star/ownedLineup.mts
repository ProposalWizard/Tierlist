import { setOwnedLineup } from "../../lib/star/clubPowers";
import { buyStake } from "../../lib/star/investments";
import { matchdayFor, formationForClub } from "../../lib/star/teamsheet";
import { formationOf } from "../../lib/star/formations";
import { saveLineup, clearLineup, loadLineup } from "../../lib/star/lineupStore";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, Fixture, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

// A tiny localStorage so lineupStore.ts (and matchdayFor's fallback read of
// it) can run headless — same pattern as opponentSavedLineup.mts.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

/**
 * A SAVE-SCOPED LINEUP OVERRIDE — REAL, AND GENUINELY ISOLATED.
 *
 * `career.ownedLineups` (types.ts) is what actually makes an edit in the
 * Boardroom's "Edit Lineup" tool change a club's real matchday XI — but the
 * entire reason it exists, rather than just reusing `lineupStore.ts`'s
 * shared table, is that it must never be visible to, or corrupt, any OTHER
 * save. This file proves both halves: the override genuinely gets used by
 * `teamsheet.ts`'s real match-lineup resolution, and a second, completely
 * separate `CareerState` never sees it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 25, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

const RIVAL = PREMIER_LEAGUE_CLUBS.find(c => c !== "Arsenal")!;

function squadFor(club: string): LeagueSquad {
  const positions: LeaguePlayer["position"][] =
    ["GK", "GK", "CB", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "CAM", "LW", "RW", "ST", "ST", "CM", "CB", "LB", "RW"];
  return {
    club,
    players: positions.map((position, i) => ({
      id: `${club}:${i}`, name: `${club} Player ${i}`, position, positions: [position],
      overall: 90 - i, goals: 0, assists: 0,
    })),
  };
}

function freshCareer(overrides: Partial<CareerState> = {}): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return {
    ...base,
    money: 5_000_000_000,
    leagueSquads: PREMIER_LEAGUE_CLUBS.filter(c => c !== base.player.club).map(c => squadFor(c)),
    ...overrides,
  };
}

const FIXTURE: Fixture = { week: 1, opponent: RIVAL, home: true, played: false, kind: "league" };

// ── Only a majority owner can set one, and only real, current squad ids stick ──
{
  const career = freshCareer();
  const sq = squadFor(RIVAL).players;
  const shape = formationOf("433");
  const gkSlot = shape.slots.findIndex(s => s.role === "GK");
  const chosen = shape.slots.map(() => null as string | null);
  chosen[gkSlot] = sq.find(p => p.position === "GK")!.id;

  const noStake = setOwnedLineup(career, RIVAL, { formation: "433", xi: chosen });
  check(!noStake.ok, "setting a lineup override for a club you don't own at all is rejected");

  const owned = buyStake(career, RIVAL, 60);
  const withStranger = setOwnedLineup(owned, RIVAL, {
    formation: "433",
    xi: shape.slots.map((_, i) => (i === gkSlot ? "not-a-real-player-id" : null)),
  });
  check(withStranger.ok, "a majority owner can set an override");
  check(withStranger.career.ownedLineups![RIVAL].xi[gkSlot] === null,
    "…but an id that isn't in the club's REAL current squad is dropped, not written through");

  const withReal = setOwnedLineup(owned, RIVAL, { formation: "433", xi: chosen });
  check(withReal.ok, "a majority owner can set a real override");
  check(withReal.career.ownedLineups![RIVAL].xi[gkSlot] === chosen[gkSlot],
    "…and a real, current squad id is kept exactly as given");
}

// ── The override is genuinely USED by real match-lineup resolution ─────────
{
  clearLineup(RIVAL);
  const sq = squadFor(RIVAL).players;
  const shape = formationOf("433");
  const auto = matchdayFor(freshCareer(), FIXTURE, false).away;

  // Deliberately the worst-rated keeper and striker — never who autoPick
  // would choose on its own, so this is a provable, real change.
  const keepers = sq.filter(p => p.position === "GK");
  const strikers = sq.filter(p => p.position === "ST");
  const worstKeeper = keepers[keepers.length - 1];
  const worstStriker = strikers[strikers.length - 1];
  const gkSlot = shape.slots.findIndex(s => s.role === "GK");
  const stSlot = shape.slots.findIndex(s => s.role === "ST");
  const chosen = shape.slots.map(() => null as string | null);
  chosen[gkSlot] = worstKeeper.id;
  chosen[stSlot] = worstStriker.id;

  let career = buyStake(freshCareer(), RIVAL, 60);
  const result = setOwnedLineup(career, RIVAL, { formation: "433", xi: chosen });
  check(result.ok, `override sets cleanly (${result.reason ?? ""})`);
  career = result.career;

  const md = matchdayFor(career, FIXTURE, false).away;
  check(md.formation.id === "433", `the override's own formation is used (${md.formation.id})`);
  check(md.xi[gkSlot]?.id === worstKeeper.id,
    `the keeper set in the override is the keeper who plays (${md.xi[gkSlot]?.id}, wanted ${worstKeeper.id})`);
  check(md.xi[stSlot]?.id === worstStriker.id,
    `and so is the striker (${md.xi[stSlot]?.id}, wanted ${worstStriker.id})`);
  check(auto.xi[gkSlot]?.id !== worstKeeper.id,
    "…and this is a real change: auto-picking would not have chosen him");
  check(md.xi.length === 11, `still eleven men (${md.xi.length})`);
}

// ── A club WITHOUT an override falls back to the existing chain, unchanged ──
{
  clearLineup(RIVAL);
  const career = freshCareer();
  const noOverride = matchdayFor(career, FIXTURE, false).away;
  check(noOverride.formation.id === formationForClub(RIVAL).id,
    "with no override and nothing globally saved, the opponent plays their own default shape");
  check(noOverride.xi.length === 11, `and still fields eleven (${noOverride.xi.length})`);

  // The existing global lineupStore.ts fallback still works exactly as
  // before, for a club this save has never touched with an override.
  const sq = squadFor(RIVAL).players;
  const shape = formationOf("442");
  const gkSlot = shape.slots.findIndex(s => s.role === "GK");
  const globalChosen = shape.slots.map(() => null as string | null);
  globalChosen[gkSlot] = sq.find(p => p.position === "GK")!.id;
  saveLineup(RIVAL, { formation: "442", xi: globalChosen });
  const withGlobal = matchdayFor(career, FIXTURE, false).away;
  check(withGlobal.formation.id === "442",
    "with no save-scoped override, the existing global saved lineup is still read exactly as before");
  clearLineup(RIVAL);
}

// ── An override for one club never bleeds onto another club's sheet ────────
{
  clearLineup(RIVAL);
  const OTHER = PREMIER_LEAGUE_CLUBS.find(c => c !== "Arsenal" && c !== RIVAL)!;
  let career = buyStake(freshCareer(), RIVAL, 60);
  const sq = squadFor(RIVAL).players;
  const shape = formationOf("433");
  const gkSlot = shape.slots.findIndex(s => s.role === "GK");
  const chosen = shape.slots.map(() => null as string | null);
  chosen[gkSlot] = sq[gkSlot >= 0 ? 0 : 0].id;
  const result = setOwnedLineup(career, RIVAL, { formation: "433", xi: chosen });
  career = result.career;

  const otherFixture: Fixture = { ...FIXTURE, opponent: OTHER };
  const otherCareerWithOtherSquad: CareerState = {
    ...career,
    leagueSquads: [...(career.leagueSquads ?? []).filter(s => s.club !== OTHER), squadFor(OTHER)],
  };
  const otherMd = matchdayFor(otherCareerWithOtherSquad, otherFixture, false).away;
  check(otherMd.formation.id === formationForClub(OTHER).id,
    "a lineup override set for one club has no effect on a completely different club's sheet");
}

// ── THE WHOLE POINT: genuinely isolated between two separate saves ─────────
//
// `career.ownedLineups` lives on `CareerState` — a plain object, never in
// localStorage/the shared table — so this is provable directly: build two
// independent careers, set an override in only one of them, and confirm the
// other CareerState object has no trace of it at all, and that resolving a
// match for the untouched career never reads it either.
{
  clearLineup(RIVAL);
  const saveA = buyStake(freshCareer(), RIVAL, 60);
  const saveB = buyStake(freshCareer(), RIVAL, 60);

  const sq = squadFor(RIVAL).players;
  const shape = formationOf("352");
  const chosen = shape.slots.map(() => null as string | null);
  chosen[0] = sq[0].id;
  const result = setOwnedLineup(saveA, RIVAL, { formation: "352", xi: chosen });
  const saveAWithOverride = result.career;

  check(result.ok, "override sets cleanly on saveA");
  check(!!saveAWithOverride.ownedLineups?.[RIVAL], "saveA now genuinely carries the override");
  check(!saveB.ownedLineups?.[RIVAL], "saveB — a completely separate CareerState object — has no override at all");

  const mdB = matchdayFor(saveB, FIXTURE, false).away;
  check(mdB.formation.id !== "352" || mdB.formation.id === formationForClub(RIVAL).id,
    "saveB's own match resolution never sees saveA's override");
  check(!loadLineup(RIVAL), "saveA's override was never written to the shared global lineupStore.ts table either");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a Boardroom lineup edit is real (teamsheet.ts genuinely uses it), gated to a majority owner, sanitised against the real current squad, and completely isolated to the one save that set it");
