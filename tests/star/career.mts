import { makeInitialCareer, creditMatchResult, awardLeagueTrophyIfWon, advanceSeason } from "../../lib/star/careerFlow";
import { saveStarPhase, loadStarPhase } from "../../lib/star/storage";
import { openEuro } from "../../lib/star/euro";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * The season loop, and the dead end at the end of it.
 *
 * The career state has always been saved to localStorage; the PHASE was React
 * state only, so a reload always dropped you on the dashboard. Everywhere else
 * that is harmless — you navigate back. At the end of a season it was a
 * soft-lock: every fixture played, so the dashboard had no match to offer and
 * no route to the Ballon d'Or, and the career could never advance again.
 *
 * The fix has two halves, and this file covers both: the phase is now persisted
 * for the screens you cannot navigate back to, and the dashboard offers the end
 * of the season directly — which means the end of a season can be reached twice,
 * so awarding the title has to be idempotent.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// A localStorage that behaves like the browser's, so storage.ts can be exercised.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const { saveStarPhase, loadStarPhase, saveCareer, loadCareer, clearCareer, ANON_SCOPE } = await import("../../lib/star/storage");
const SCOPE = "test-user";

const PLAYER: StarPlayer = {
  firstName: "Test", lastName: "Player", age: 18, position: "CAM",
  club: "Arsenal", nationality: "England",
} as StarPlayer;

const CLUBS = [
  "Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs",
  "Newcastle", "Aston Villa", "Brighton", "West Ham",
];

const stats = (goals: number, assists: number): MatchStats => ({
  chances: 5, goals, assists, passes: 12, rating: 7.2, starMan: goals > 1,
  bossChange: 1, teamChange: 1, fansChange: 1,
  wage: 1000, goalBonus: 0, sponsorPay: 0, totalCash: 1000,
  homeScore: goals, awayScore: 0,
});

/** Play every fixture, the way the page does. */
function playWholeSeason(start: CareerState): CareerState {
  let c = start;
  let guard = 0;
  while (guard++ < 200) {
    const next = c.fixtures.find(f => !f.played);
    if (!next) break;
    c = creditMatchResult(c, next, stats(guard % 3 === 0 ? 1 : 0, 0)).career;
  }
  check(guard < 200, "a season terminates");
  return c;
}

// ── The dead end ────────────────────────────────────────────────────────────
{
  const done = playWholeSeason(makeInitialCareer(PLAYER, CLUBS));
  check(done.fixtures.length > 0, "a season has fixtures in it");
  check(done.fixtures.every(f => f.played), "playing every fixture marks every fixture played");
  check(!done.fixtures.find(f => !f.played),
    "…and there is no next fixture, which is the state the dashboard used to have no answer for");

  // The route out, taken from the dashboard rather than the post-match screen.
  const after = advanceSeason(awardLeagueTrophyIfWon(done).career, false).career;
  check(after.season === done.season + 1, "the end-of-season route rolls the career over");
  check(after.fixtures.some(f => !f.played), "and the new season has matches to play");
}

// ── Reaching the end of a season twice must not award the title twice ──────
{
  // Force a title: put the player's club top on points.
  const done = playWholeSeason(makeInitialCareer(PLAYER, CLUBS));
  const champions: CareerState = {
    ...done,
    league: done.league.map(t => t.name === PLAYER.club
      ? { ...t, points: 999, goalDifference: 99 }
      : { ...t, points: 1, goalDifference: 0 }),
  };

  const once = awardLeagueTrophyIfWon(champions);
  check(once.wonLeague, "the club that finished top won the league");
  const titles = (c: CareerState) => c.trophies.filter(t => t.season === c.season && t.competition === "Premier League").length;
  check(titles(once.career) === 1, "the title is awarded");

  const twice = awardLeagueTrophyIfWon(once.career);
  check(titles(twice.career) === 1,
    `arriving at the end of the season a second time does not award it again (${titles(twice.career)})`);

  // …and a club that did not win still gets nothing, however many times you ask.
  const alsoRans: CareerState = {
    ...done,
    league: done.league.map(t => t.name === PLAYER.club ? { ...t, points: 0, goalDifference: -50 } : t),
  };
  const a = awardLeagueTrophyIfWon(awardLeagueTrophyIfWon(alsoRans).career);
  check(!a.wonLeague && a.career.trophies.length === alsoRans.trophies.length, "finishing second wins nothing");
}

// ── Only the phases you cannot navigate back from are resumed ───────────────
{
  saveStarPhase("ballon-dor", SCOPE);
  check(loadStarPhase(SCOPE)?.phase === "ballon-dor", "the awards screen is resumed after a reload");

  saveStarPhase("contract-renewal", SCOPE, "star");
  check(loadStarPhase(SCOPE)?.offerReason === "star", "…and it remembers why the club offered");

  saveStarPhase("dilemma", SCOPE);
  check(loadStarPhase(SCOPE)?.phase === "dilemma", "an unanswered dilemma is resumed");

  // Everything else clears the record rather than leaving a stale one behind —
  // resuming into a match whose state was never saved would be worse than the
  // bug this fixes.
  for (const p of ["dashboard", "match", "post-match", "training", "league", "life", "casino-menu"] as const) {
    saveStarPhase("ballon-dor", SCOPE);
    saveStarPhase(p, SCOPE);
    check(loadStarPhase(SCOPE) === null, `${p} is not resumed, and clears whatever was pending`);
  }

  // A record written by a future version, or by hand, is ignored rather than
  // trusted.
  store.set(`star-career-phase-v1::${SCOPE}`, JSON.stringify({ phase: "match" }));
  check(loadStarPhase(SCOPE) === null, "a phase outside the resumable set is refused even if it is on disk");
  store.set(`star-career-phase-v1::${SCOPE}`, "not json");
  check(loadStarPhase(SCOPE) === null, "a corrupt record is refused rather than thrown");
}

// ── Resetting a career leaves nothing behind ───────────────────────────────
{
  const c = makeInitialCareer(PLAYER, CLUBS);
  saveCareer(c, SCOPE);
  saveStarPhase("ballon-dor", SCOPE);
  clearCareer(SCOPE);
  check(loadCareer(SCOPE) === null, "clearing a career removes the career");
  check(loadStarPhase(SCOPE) === null,
    "…and the pending phase with it — otherwise a new career resumes the old one's awards screen");
}

// ── Two accounts on one device never see each other's save ─────────────────
//
// The actual bug this scoping fix exists for: a save used to live under one
// flat key per browser, not per account, so switching which account was
// logged in on a shared device showed — and then silently uploaded — the
// OTHER account's career. See storage.ts's own note on `scoped()`.
{
  const store2 = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store2.get(k) ?? null,
    setItem: (k: string, v: string) => { store2.set(k, String(v)); },
    removeItem: (k: string) => { store2.delete(k); },
    clear: () => store2.clear(),
  };

  const alice = makeInitialCareer({ ...PLAYER, firstName: "Alice" }, CLUBS);
  const bob = makeInitialCareer({ ...PLAYER, firstName: "Bob" }, CLUBS);
  saveCareer(alice, "user-alice");
  saveCareer(bob, "user-bob");

  check(loadCareer("user-alice")?.player.firstName === "Alice", "account A's own save loads for account A");
  check(loadCareer("user-bob")?.player.firstName === "Bob", "account B's own save loads for account B");
  check(loadCareer(ANON_SCOPE) === null, "a device that has never played signed out has no anonymous save of its own");

  saveStarPhase("dilemma", "user-alice");
  check(loadStarPhase("user-bob") === null, "a pending phase saved for one account is invisible to another on the same device");
  check(loadStarPhase("user-alice")?.phase === "dilemma", "…and still there for the account that actually saved it");

  clearCareer("user-alice");
  check(loadCareer("user-alice") === null, "clearing account A's career doesn't touch account B's");
  check(loadCareer("user-bob")?.player.firstName === "Bob", "account B's save survives account A being cleared");
}

// ── A save made before this fix shipped is claimed once, by whichever scope
// asks for it first, and cannot leak into a second account afterward ───────
{
  const store3 = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store3.get(k) ?? null,
    setItem: (k: string, v: string) => { store3.set(k, String(v)); },
    removeItem: (k: string) => { store3.delete(k); },
    clear: () => store3.clear(),
  };

  // Simulate a real pre-fix save: written straight under the old flat keys,
  // with no account attached to it at all.
  const legacy = makeInitialCareer({ ...PLAYER, firstName: "Legacy" }, CLUBS);
  store3.set("star-career-v2", JSON.stringify(legacy));
  store3.set("star-career-saved-at-v1", String(1700000000000));
  store3.set("star-career-phase-v1", JSON.stringify({ phase: "dilemma" }));

  check(loadCareer("user-alice")?.player.firstName === "Legacy", "the first account to load on this device claims the pre-fix save");
  check(store3.has("star-career-v2") === false, "the flat legacy key is gone once claimed");
  check(loadStarPhase("user-alice")?.phase === "dilemma", "its pending phase comes with it");

  check(loadCareer("user-bob") === null, "a second account on the same device does NOT also inherit the already-claimed legacy save");
}

// ── What a refresh has to carry ─────────────────────────────────────────────
//
// The career itself has always been saved. The PHASE was React state only, and
// so was everything each phase needs to draw its screen — which is why these
// two are worth pinning down.
{
  // A tiny localStorage so the storage module can run headless.
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;

  // The Ballon d'Or is decided at the ceremony and not credited until the season
  // rolls over — and both screens in between are resumable. It used to live in
  // React state, so refreshing on either of them lost the win: you watched
  // yourself collect it and then found it had never happened.
  saveStarPhase("retirement", SCOPE, undefined, true);
  check(loadStarPhase(SCOPE)?.wonBallonDor === true, "a Ballon d'Or survives a refresh at the retirement screen");
  saveStarPhase("season-transfer", SCOPE, undefined, true);
  check(loadStarPhase(SCOPE)?.wonBallonDor === true, "…and at the transfer window");
  saveStarPhase("season-transfer", SCOPE, undefined, false);
  check(loadStarPhase(SCOPE)?.wonBallonDor === false, "and a runner-up stays a runner-up");

  // Only the phases that cannot get out of their own way are written. Landing
  // back in a match or a training minigame would resume a game that is not
  // there; every browsing screen you can simply navigate out of.
  for (const p of ["dashboard", "match", "post-match", "training", "life", "press"] as const) {
    saveStarPhase(p, SCOPE);
    check(loadStarPhase(SCOPE) === null, `${p} is not resumed after a refresh`);
  }
  for (const p of ["ballon-dor", "contract-renewal", "dilemma", "retirement", "season-transfer"] as const) {
    saveStarPhase(p, SCOPE);
    check(loadStarPhase(SCOPE)?.phase === p, `${p} is`);
  }
}

// ── A euroState saved before liveTable/matchdaysPlayed existed is backfilled,
// not crashed on ──────────────────────────────────────────────────────────
//
// Reported directly: a real Champions League table filled itself in seven
// matchdays ahead of where the season actually was — fixed by making the
// table real, incrementally-built state (simulateEuroMatchday, euro.ts)
// instead of something recomputed on every render. A save from before that
// fix has a euroState with no liveTable/matchdaysPlayed at all; reading
// either would throw rather than just show an empty table.
{
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;

  const euro = openEuro("Champions League", "Arsenal", 82, 2, mulberry32(4));
  // Two matchdays genuinely played, real scorelines — the rest still ahead.
  const leaguePhase = euro.leaguePhase.map((m, i) =>
    i < 2 ? { ...m, us: i === 0 ? 3 : 1, them: i === 0 ? 1 : 1 } : m);
  const withEuro: CareerState = { ...makeInitialCareer(PLAYER, CLUBS), euroState: { ...euro, leaguePhase } };
  saveCareer(withEuro, SCOPE);

  // Simulate what an OLD save actually looked like: strip the fields that
  // didn't exist yet, the same way a real save from before this fix would
  // never have had them.
  const [key, raw] = [...store.entries()].find(([, v]) => JSON.parse(v).version === 2)!;
  const parsed = JSON.parse(raw);
  delete parsed.euroState.liveTable;
  delete parsed.euroState.matchdaysPlayed;
  store.set(key, JSON.stringify(parsed));

  const loaded = loadCareer(SCOPE);
  const table = loaded?.euroState?.liveTable;
  check(!!table, "loading an old-shaped euroState doesn't throw — it backfills liveTable");
  check(loaded?.euroState?.matchdaysPlayed === 2, `…crediting exactly the two matchdays genuinely played (${loaded?.euroState?.matchdaysPlayed})`);
  const you = table?.find(r => r.isYou);
  check(you?.played === 2 && you?.won === 1 && you?.drawn === 1,
    `your own two real results survive the backfill (${you?.played} played, ${you?.won}W ${you?.drawn}D)`);
  const untouchedOpponent = table?.find(r => r.name === euro.leaguePhase[2].opponent);
  check(untouchedOpponent?.played === 0,
    "a club whose matchday hasn't happened yet is NOT retroactively simulated — it starts blank, same as this whole fix is about");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the season ends, the title is awarded once, and only resumable phases resume");
