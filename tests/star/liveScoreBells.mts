/**
 * ONE-OFF LIVE-SCORE BELLS (28 Sep 2026, Harry).
 *
 * The match-day Fixtures page puts a bell on each other game. A bell is
 * stored for that season and week only, and reaches the match through the
 * same `followedTeams()` the club ticks do. The club ticks in Settings are
 * untouched by it.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

const P = await import("../../lib/star/matchDayPrefs");
const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

// A club ticked in Settings.
P.toggleFollowedClub("Arsenal");
check(same(P.followedClubs(), ["Arsenal"]), "a Settings tick is a club tick");

// A bell on Everton v Fulham, season 1 week 6.
const game = { season: 1, week: 6, home: "Everton", away: "Fulham" };
check(P.toggleFollowedFixture(game) === true, "ringing a bell turns it on");
check(P.isFixtureFollowed(game), "the bell is stored");

// Not the week being played: the bell does nothing yet.
P.setLiveScoreWeek(1, 5);
check(same(P.followedTeams(), ["Arsenal"]), `week 5: only the club tick pops up (${P.followedTeams()})`);

// Its week: both clubs of that game pop up, beside the club tick.
P.setLiveScoreWeek(1, 6);
check(same(P.followedTeams(), ["Arsenal", "Everton", "Fulham"]), `week 6: the belled game pops up (${P.followedTeams()})`);

// The next season's week 6 is a different week.
P.setLiveScoreWeek(2, 6);
check(same(P.followedTeams(), ["Arsenal"]), "a bell never carries into another season");

// Settings still shows only the club ticks.
P.setLiveScoreWeek(1, 6);
check(same(P.followedClubs(), ["Arsenal"]), "Settings' list is not polluted by bells");

// Unticking Everton inside the match drops the bell rather than adding a tick.
const after = P.toggleFollowedTeam("Everton");
check(!P.isFixtureFollowed(game), "unticking a belled club in the match drops the bell");
check(same(after, ["Arsenal"]), `the match list is back to the club tick (${after})`);
check(same(P.followedClubs(), ["Arsenal"]), "and no stray club tick was added");

// Ticking a new club in the match is an ordinary club tick.
P.toggleFollowedTeam("Chelsea");
check(same(P.followedClubs(), ["Arsenal", "Chelsea"]), "a match tick of a new club is a club tick");

// Ringing the same bell twice turns it off.
P.toggleFollowedFixture(game);
check(P.toggleFollowedFixture(game) === false && !P.isFixtureFollowed(game), "a second ring turns the bell off");

// Corrupt storage never throws.
store.set("star-live-score-fixtures", "{nope");
check(P.followedFixtures().length === 0, "corrupt bell storage reads as none");

if (problems.length) {
  console.log(`FAIL\n${problems.map((x) => `  ✗ ${x}`).join("\n")}`);
  process.exit(1);
}
console.log("liveScoreBells: all checks passed");
