import { stillIn } from "../../lib/star/cups";
import { scoutedOfferForTrial, scoutedPlacement, finalPenScoredOf } from "../../lib/star/scoutedPlacement.ts";
import { clubsForDivision } from "../../lib/star/scoutOffers.ts";
import { makeIdentity, attachClub } from "../../lib/star/careerFlow.ts";
import { startTrial } from "../../lib/star/trial.ts";
import { mulberry32 } from "../../lib/star/season.ts";
import { LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS } from "../../lib/star/clubs.ts";
import { campaignFor, cleanPlayerName, CAMPAIGNS, NAME_MAX } from "../../lib/campaigns.ts";
import { campaignPlayer, campaignDivision, withPlayerName } from "../../lib/guest/campaignCareer.ts";
import { pickGuestPrompt, guestAgeDays, localDayKey, DAILY_FROM_DAY } from "../../lib/guest/promptSchedule.ts";

/**
 * GUEST ACCOUNTS, the game side (Harry, 25 Oct 2026).
 *
 * 1. Custom start point: the league-two-striker ad's trial always offers a
 *    League Two club; every League Two club can come up; a reload lands at the
 *    same club; the career that follows is a real League Two season. Every
 *    trial WITHOUT a start point lands at exactly the club it did before.
 * 2. Names: the typed name is used, tidied; blank keeps the ad's name; a
 *    locked campaign keeps its own name.
 * 3. The "Save your career" card: the two moments before day 7, then once a
 *    day from day 7.
 */

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };

// ── 1. Custom start point ─────────────────────────────────────────────────
const l2 = campaignFor("league-two-striker")!;
const wk = campaignFor("wonderkid")!;
check(l2.startLeague === "league_two" && campaignDivision(l2) === "league_two", "league-two-striker starts in League Two");
check(!wk.startLeague && campaignDivision(wk) === "premier", "wonderkid has no start point (normal roll)");

const l2Clubs = new Set(LEAGUE_TWO_CLUBS);
const seen = new Set<string>();
let allL2 = true;
for (let seed = 1; seed <= 3000; seed++) {
  const trial = { ...startTrial(seed), startDivision: l2.startLeague, finalPenScored: seed % 2 === 0 };
  const o = scoutedOfferForTrial(trial);
  if (o.division !== "league_two" || !l2Clubs.has(o.club)) allL2 = false;
  seen.add(o.club);
}
check(allL2, "every League Two ad trial is offered a League Two club (3,000 trials)");
check(seen.size === l2Clubs.size, `every League Two club can be offered (${seen.size}/${l2Clubs.size})`);
{
  const t = { ...startTrial(77), startDivision: l2.startLeague };
  const a = scoutedOfferForTrial(t), b = scoutedOfferForTrial(t);
  check(a.club === b.club && a.wage === b.wage && a.wage > 0, `a reload lands at the same League Two club (${a.club}, ★${a.wage}/wk)`);
}

// Without a start point: exactly the old roll, club for club.
const nonLeague = new Set([...NATIONAL_LEAGUE_CLUBS, ...NATIONAL_LEAGUE_NORTH_CLUBS, ...NATIONAL_LEAGUE_SOUTH_CLUBS]);
let same = true, inNonLeague = true;
for (let seed = 1; seed <= 3000; seed++) {
  const t = { seed, finalPenScored: seed % 3 === 0 };
  const o = scoutedOfferForTrial(t);
  const old = scoutedPlacement(finalPenScoredOf(t), mulberry32(seed ^ 0x5c0a7));
  if (o.club !== old.club || o.division !== old.division) same = false;
  if (!nonLeague.has(o.club)) inNonLeague = false;
}
check(same, "no start point = the same club as before, for 3,000 trials");
check(inNonLeague, "no start point = still National League / North / South");

// The career a League Two ad starts: the same steps the game takes
// (makeIdentity in the campaign's division, the trial's offer, attachClub).
{
  const player = campaignPlayer(l2);
  const trial = { ...startTrial(4242), startDivision: l2.startLeague };
  const offer = scoutedOfferForTrial(trial);
  const c = attachClub(makeIdentity({ ...player, club: offer.club }, campaignDivision(l2)), offer.club, clubsForDivision(offer.division), offer.division, offer.wage);
  const league = c.fixtures.filter(f => (f.kind ?? "league") === "league");
  check(c.division === "league_two" && c.player.club === offer.club, `first club ${offer.club}, in ${c.division}`);
  check(c.league.length === 24 && league.length === 46, `a real League Two season (${c.league.length} clubs, ${league.length} league games)`);
  const fa = c.cupState?.find(st => st.competition === "FA Cup");
  check(!!fa && stillIn(fa, c.player.club), "in the FA Cup");
}

// ── 2. Names ──────────────────────────────────────────────────────────────
check(JSON.stringify(cleanPlayerName("  Sam ", " de  Jong ")) === JSON.stringify({ firstName: "Sam", lastName: "de Jong" }), "a typed name is tidied");
check(cleanPlayerName("", "Jones") === null && cleanPlayerName("Sam", "   ") === null, "a blank half is refused");
check(cleanPlayerName("A".repeat(40), "B").firstName.length === NAME_MAX, `a long name is cut to ${NAME_MAX}`);
check(withPlayerName(l2, { firstName: "Sam", lastName: "Jones" }).player.lastName === "Jones", "the typed name is used");
check(withPlayerName(l2, { firstName: "", lastName: "" }).player.firstName === l2.player.firstName, "a blank name keeps the ad's name");
check(withPlayerName({ ...l2, lockName: true }, { firstName: "Sam", lastName: "Jones" }).player.lastName === l2.player.lastName, "a locked campaign keeps its name");
check(CAMPAIGNS.every(c => !c.lockName), "neither example campaign locks the name");
check(campaignPlayer(withPlayerName(l2, { firstName: "Sam", lastName: "Jones" })).firstName === "Sam", "the career's player carries the typed name");

// ── 3. The card's schedule ───────────────────────────────────────────────
const base = { seen: [] as string[], lastDaily: null as string | null, today: "2026-11-02" };
check(pickGuestPrompt({ ...base, milestone: null, ageDays: 0 }) === null, "day 0, no match yet: nothing");
check(pickGuestPrompt({ ...base, milestone: "first-match", ageDays: 2 })?.kind === "milestone", "day 2 after the first match: the first-match card");
check(pickGuestPrompt({ ...base, milestone: "first-match", ageDays: 2, seen: ["first-match"] }) === null, "closed with Later: not again");
check(pickGuestPrompt({ ...base, milestone: "first-season", ageDays: 6, seen: ["first-match"] })?.kind === "milestone", "day 6 after season one: the season card");
const d7 = pickGuestPrompt({ ...base, milestone: null, ageDays: DAILY_FROM_DAY });
check(d7?.kind === "daily" && d7.day === 7, "day 7: the daily card, 'day 7'");
check(pickGuestPrompt({ ...base, milestone: "first-season", seen: ["first-match", "first-season"], ageDays: 12 })?.kind === "daily", "day 12, every moment seen: still daily");
check(pickGuestPrompt({ ...base, milestone: null, ageDays: 9, lastDaily: "2026-11-02" }) === null, "already shown today: not again today");
check(pickGuestPrompt({ ...base, milestone: null, ageDays: 10, lastDaily: "2026-11-02", today: "2026-11-03" })?.kind === "daily", "the next day: again");
const now = Date.parse("2026-11-10T12:00:00Z");
check(guestAgeDays("2026-11-03T13:00:00Z", now) === 6 && guestAgeDays("2026-11-03T11:00:00Z", now) === 7, "whole days since the account was made");
check(guestAgeDays(undefined, now) === null && guestAgeDays("nonsense", now) === null, "unknown age reads as null");
check(/^\d{4}-\d{2}-\d{2}$/.test(localDayKey(now)), "local day key");

if (fail) { console.log(`FAIL (${fail})`); process.exit(1); }
console.log("PASS — League Two ad starts at a League Two club (others unchanged), typed names, daily card from day 7");
