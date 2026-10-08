import {
  checkRecordBody, cleanPlayerName, parseScore, careerCap, RECORD_CAPS, MAX_ALL_WINS, type SavedRun, type RecordBody,
} from "../../lib/draftRecordRules";
import { planXpEvent, slotRef, runQualifies, isCappedXp, utcDay } from "../../lib/xpEventKeys";
import { DAILY_XP_CAP } from "../../lib/xp";
import { hallHasRoom, HALL_MAX_ENTRIES, HALL_MAX_ROWS } from "../../lib/star/hallOfFame";
import { shareRequestHallId, LEGEND_MAX_SHARES } from "../../lib/star/legendShare";

/**
 * THE ROUTE LOCKS (8 Oct 2026, Harry: close the cheat holes that reach other
 * players). The pure checks behind /api/draft/records, /api/xp,
 * /api/star/hall-of-fame and /api/star/legend.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── A real season, as the client posts it (DraftResult.tsx) ────────────────
const run: SavedRun = {
  season_number: 3, finish: 1, points: 89, wins: 28, draws: 5, losses: 5,
  goals_for: 84, goals_against: 30, avg_ovr: 82, longest_unbeaten_run: 14,
};
const honest = (): RecordBody & Record<string, unknown> => ({
  eventKey: "s3-f1-p89-g84.30-qabc12",
  seasonNumber: 3,
  pl: {
    wins: { value: 28, teamOvr: 82 },
    unbeaten: { value: 14, teamOvr: 82 },
    goals: { value: 27, playerName: "Erling Haaland", playerOvr: 91 },
    assists: { value: 14, playerName: "Kevin De Bruyne", playerOvr: 90 },
    cleanSheets: { value: 15, playerName: "Ederson Santana de Moraes", playerOvr: 88 },
    goalsConceded: { value: 30, teamOvr: 82 },
    biggestWin: { value: 5, teamOvr: 82, score: "6-1" },
    avgRating: { value: 78, playerName: "Erling Haaland", playerOvr: 91 },
    mostPoints: { value: 89, teamOvr: 82 },
  },
  all: {
    wins: { value: 41, teamOvr: 82 },
    unbeaten: { value: 14, teamOvr: 82 },
    goals: { value: 38, playerName: "Erling Haaland", playerOvr: 91 },
    assists: { value: 19, playerName: "Kevin De Bruyne", playerOvr: 90 },
    cleanSheets: { value: 22, playerName: "Ederson Santana de Moraes", playerOvr: 88 },
    goalsConceded: { value: 44, teamOvr: 82 },
    biggestWin: { value: 6, teamOvr: 82, score: "6-0" },
    avgRating: { value: 77, playerName: "Erling Haaland", playerOvr: 91 },
    squadOvr: { value: 82, teamOvr: 82 },
  },
  career: {
    goals: { value: 90, playerName: "Erling Haaland", playerOvr: 91 },
    assists: { value: 40, playerName: "Kevin De Bruyne", playerOvr: 90 },
    trophies: 6,
    avgRating: { value: 76, playerName: "Erling Haaland", playerOvr: null },
  },
});
const mutate = (f: (b: ReturnType<typeof honest>) => void) => { const b = honest(); f(b); return b; };
const pl = (b: ReturnType<typeof honest>) => b.pl as Record<string, Record<string, unknown>>;
const all = (b: ReturnType<typeof honest>) => b.all as Record<string, Record<string, unknown>>;

{
  const r = checkRecordBody(honest(), run);
  check(r.ok, `an honest season passes (${r.errors.join("; ")})`);
  check(r.candidates.length === 22, `every record goes up (${r.candidates.length} of 22)`);
  check(r.candidates.filter(c => c.needsPlayer).length === 11, "every player record needs a real-player check");
  check(r.candidates.find(c => c.record_type === "biggest_win" && c.competition === "pl")?.player_name === "6-1", "a biggest win keeps its score");

  // Zeroes are just skipped (as before).
  const zero = mutate(b => { pl(b).goals = { value: 0, playerName: null, playerOvr: null }; pl(b).biggestWin = { value: 0, teamOvr: 82 }; });
  check(checkRecordBody(zero, run).ok, "a zero record is skipped, not refused");

  // No saved season, a wrong key, a wrong season number.
  check(!checkRecordBody(honest(), null).ok, "no matching saved season: refused");
  check(!checkRecordBody(mutate(b => { b.eventKey = undefined; }), run).ok, "no season key: refused");
  check(!checkRecordBody(mutate(b => { b.eventKey = "x".repeat(200); }), run).ok, "an over-long season key: refused");
  check(!checkRecordBody(mutate(b => { b.seasonNumber = 6; }), run).ok, "season 6 (a draft has 5): refused");
  check(!checkRecordBody(mutate(b => { b.seasonNumber = 2; }), run).ok, "season number not the saved one: refused");

  // The old loose caps (wins 70) are gone: real limits.
  check(RECORD_CAPS.pl_wins === 38 && RECORD_CAPS.pl_most_points === 114, "league caps are a 38-game season");
  check(MAX_ALL_WINS === 63 && RECORD_CAPS.all_wins === 63, "all-competition wins cap is 63");
  check(!checkRecordBody(mutate(b => { pl(b).wins = { value: 39 }; }), { ...run, wins: 39, points: 39 * 3 + 5 }).ok, "39 league wins: refused even if the history agrees");
  check(!checkRecordBody(mutate(b => { all(b).wins = { value: 64 }; }), run).ok, "64 wins in all competitions: refused");
  check(!checkRecordBody(mutate(b => { pl(b).goals = { value: 999999, playerName: "Erling Haaland" }; }), run).ok, "an absurd top scorer: refused, not clamped");
  check(!checkRecordBody(mutate(b => { pl(b).goals = { value: 12.5, playerName: "Erling Haaland" }; }), run).ok, "a fraction: refused");
  check(!checkRecordBody(mutate(b => { pl(b).goals = { value: -3, playerName: "Erling Haaland" }; }), run).ok, "a negative: refused");
  check(!checkRecordBody(mutate(b => { all(b).squadOvr = { value: 100 }; }), run).ok, "squad rating 100: refused");
  check(!checkRecordBody(mutate(b => { pl(b).goals.playerOvr = 140; }), run).ok, "player rating 140: refused");

  // It must agree with the saved season.
  check(!checkRecordBody(mutate(b => { pl(b).wins = { value: 30 }; }), run).ok, "wins not the saved wins: refused");
  check(!checkRecordBody(mutate(b => { pl(b).mostPoints = { value: 100 }; }), run).ok, "points not the saved points: refused");
  check(!checkRecordBody(mutate(b => { pl(b).goalsConceded = { value: 3 }; }), run).ok, "a fake low goals-against: refused");
  check(!checkRecordBody(mutate(b => { all(b).goalsConceded = { value: 10 }; }), run).ok, "all-comps goals against below the league's: refused");
  check(!checkRecordBody(mutate(b => { pl(b).unbeaten = { value: 30 }; }), run).ok, "unbeaten run not the saved one: refused");
  check(!checkRecordBody(mutate(b => { all(b).squadOvr = { value: 90 }; }), run).ok, "squad rating not the saved one: refused");
  check(!checkRecordBody(mutate(b => { pl(b).goals = { value: 85, playerName: "Erling Haaland" }; }), run).ok, "a top scorer with more goals than the team: refused");
  check(!checkRecordBody(mutate(b => { pl(b).cleanSheets = { value: 34, playerName: "Ederson Santana de Moraes" }; }), run).ok, "more clean sheets than wins + draws: refused");
  check(!checkRecordBody(mutate(b => { all(b).wins = { value: 20 }; }), run).ok, "fewer all-comps wins than league wins: refused");
  check(!checkRecordBody(mutate(b => { all(b).goals = { value: 20, playerName: "Erling Haaland" }; }), run).ok, "all-comps top scorer below the league's: refused");
  check(!checkRecordBody(mutate(b => { b.career = { ...b.career as object, goals: { value: 30, playerName: "Erling Haaland" } }; }), run).ok, "career top scorer below this season's: refused");
  check(!checkRecordBody(honest(), { ...run, points: 95 }).ok, "a saved season whose points don't fit its results: refused");
  check(!checkRecordBody(mutate(b => { pl(b).biggestWin = { value: 5, score: "9-1" }; }), run).ok, "a score that doesn't give the margin: refused");

  // Career caps grow with the seasons played.
  check(careerCap("career_trophies", 1) === 7 && careerCap("career_trophies", 5) === 35, "trophies: 7 a season");
  check(!checkRecordBody(mutate(b => { b.career = { ...b.career as object, trophies: 22 }; }), run).ok, "22 trophies in 3 seasons: refused");

  // Names.
  check(cleanPlayerName("  N'Golo   Kanté ") === "N'Golo Kanté", "a real name, tidied");
  check(cleanPlayerName("Heung-min Son") === "Heung-min Son", "a hyphen");
  check(cleanPlayerName("Martin Ødegaard") === "Martin Ødegaard", "any alphabet");
  check(cleanPlayerName("x".repeat(61)) === null, "61 characters: not a name");
  check(cleanPlayerName("visit evil.com/free") === null, "a link: not a name");
  check(cleanPlayerName("<script>") === null && cleanPlayerName("") === null && cleanPlayerName(42) === null, "markup, empty, a number: not names");
  check(!checkRecordBody(mutate(b => { pl(b).goals.playerName = "buy coins at site dot com 123"; }), run).ok, "free text in a player name: refused");
  check(!checkRecordBody(mutate(b => { pl(b).goals.playerName = null; }), run).ok, "a player record with no player: refused");
  check(parseScore("6-1")?.for === 6 && parseScore("6 - 1") === null && parseScore("100-0") === null, "scores");
}

// ── XP keys ─────────────────────────────────────────────────────────────────
{
  const now = new Date("2026-10-08T14:00:00Z");
  check(utcDay(now) === "2026-10-08", "a UTC day");
  const join = planXpEvent("join", "join-anything-" + Math.random(), now, true);
  check(join.kind === "fixed" && join.ref === "join", "join: one key ever, whatever the phone sends");
  const s7 = planXpEvent("streak_7", "x1", now, true);
  check(s7.kind === "fixed" && s7.ref === "streak_7" && s7.needStreak === 7, "streak_7: once, and the streak must be there");
  const login1 = planXpEvent("daily_login", "a", now, true);
  const login2 = planXpEvent("daily_login", "b", now, true);
  check(login1.kind === "day" && login2.kind === "day" && login1.ref === login2.ref, "daily login: same key all day, whatever the ref");
  const nextDay = planXpEvent("daily_login", "a", new Date("2026-10-09T00:00:01Z"), true);
  check(nextDay.kind === "day" && login1.kind === "day" && nextDay.ref !== login1.ref, "a new day, a new key");
  const tenable = planXpEvent("tenable_perfect", "anything", now, true);
  check(tenable.kind === "slot", "other daily-capped ways: slots");
  if (tenable.kind === "slot") {
    check(slotRef(tenable.base, 0) === "day:2026-10-08:0", "first slot");
    check(slotRef(tenable.base, DAILY_XP_CAP - 1) !== null && slotRef(tenable.base, DAILY_XP_CAP) === null, `${DAILY_XP_CAP} a day, then none`);
  }
  for (const t of ["vote_cast", "tierlist_create", "hall_of_fame_record"]) {
    check(planXpEvent(t, "x", now, true).kind === "reject", `${t}: not claimable from the phone`);
  }
  check(planXpEvent("made_up", "x", now, false).kind === "reject", "an unknown type: refused");

  const win = planXpEvent("draft_win", "s3-f1-p89-g84.30-qabc12", now, true);
  check(win.kind === "run" && win.runKey === "s3-f1-p89-g84.30-qabc12" && win.ref === "s3-f1-p89-g84.30-qabc12" && win.need === "win", "draft win: the saved season's key");
  const comp = planXpEvent("draft_complete", "draft-s5-f2-p80-g70.40-qz", now, true);
  check(comp.kind === "run" && comp.runKey === "s5-f2-p80-g70.40-qz" && comp.ref === "draft-s5-f2-p80-g70.40-qz", "draft complete: same ref as before, run key without draft-");
  check(planXpEvent("draft_win", "", now, true).kind === "reject" && planXpEvent("draft_win", "a b", now, true).kind === "reject", "draft win without a season key: refused");
  check(runQualifies("win", { season_number: 2, finish: 1, losses: 3 }) && !runQualifies("win", { season_number: 2, finish: 2, losses: 0 }), "a win needs 1st");
  check(runQualifies("invincible", { season_number: 2, finish: 4, losses: 0 }) && !runQualifies("invincible", { season_number: 2, finish: 1, losses: 1 }), "invincible needs no losses");
  check(runQualifies("complete", { season_number: 5, finish: 9, losses: 9 }) && !runQualifies("complete", { season_number: 4, finish: 1, losses: 0 }), "complete needs the 5th season");
  check(isCappedXp("draft_invincible") && isCappedXp("bdo_win") && isCappedXp("draft_win"), "invincibles and Ballon d'Or seasons are capped per day too");
  const bdo = planXpEvent("bdo_win", "bdo-s4-erling", now, true);
  check(bdo.kind === "capped-ref" && bdo.ref === "bdo-s4-erling", "Ballon d'Or: its own season key, capped");
  check(planXpEvent("bdo_win", "<x>", now, true).kind === "reject", "Ballon d'Or: a junk key is refused");
}

// ── Hall of Fame and shared careers ─────────────────────────────────────────
{
  check(HALL_MAX_ENTRIES === 30 && LEGEND_MAX_SHARES === 30, "30 careers, 30 shares");
  check(hallHasRoom(29, 50, false) && !hallHasRoom(30, 50, false), "the 31st career is refused");
  check(hallHasRoom(30, 50, true), "re-sending a career already there is never refused");
  check(!hallHasRoom(5, HALL_MAX_ROWS, false), "200 rows with tombstones: full");
  check(shareRequestHallId({ hallId: "hof-abc123" }) === "hof-abc123", "a share names its Hall id");
  check(shareRequestHallId({ entry: { id: "hof-abc123", career: { fake: true } } }) === "hof-abc123", "an older phone's entry: only its id is read");
  check(shareRequestHallId({ hallId: "hof-ABC" }) === null && shareRequestHallId({ hallId: "x".repeat(40) }) === null && shareRequestHallId(null) === null, "a bad id: refused");
}

if (problems.length) { console.error("routeLocks FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("routeLocks: all checks passed");
