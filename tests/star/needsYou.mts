import { needsYou, barBadges, transferWindowWeeks, transferWindowLine, type NeedsInput } from "../../lib/star/needsYou";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { divisionOf } from "../../lib/star/calendar";
import { appIsNew, newAppCount, markAppOpened, installApp } from "../../lib/star/unlocks";
import type { StarPlayer } from "../../lib/star/types";

/** "Needs you": the most urgent thing first, and badges only from real sources. */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const quiet: NeedsInput = {
  seasonOver: false, bossTalkDue: false, sponsorOffers: 0, sponsorsOpen: true,
  trainingLeft: 0, trainingOpen: true, phoneUnread: 0, phoneOpen: true, matchInDays: 4, playOpen: true,
};

check(needsYou(quiet).length === 0, "nothing waiting = no chip");
check(Object.keys(barBadges(quiet)).length === 0, "nothing waiting = no badges");

const busy: NeedsInput = { ...quiet, bossTalkDue: true, sponsorOffers: 2, trainingLeft: 2, phoneUnread: 5, matchInDays: 0 };
const order = needsYou(busy).map((n) => n.id).join(",");
check(order === "boss-talk,sponsor-offers,training,phone,match-today", `order is most urgent first (got ${order})`);
check(needsYou({ ...busy, seasonOver: true })[0].id === "season-end", "the season's end beats everything");
check(!needsYou({ ...busy, seasonOver: true }).some((n) => n.id === "training"), "no training nag once the season is over");

const b = barBadges(busy);
check(b.skills === 2 && b.life === "dot" && b.media === 5 && b.play === true, "every bar badge comes from its source");

// Locked things never nag.
const locked: NeedsInput = { ...busy, sponsorsOpen: false, trainingOpen: false, phoneOpen: false, playOpen: false, bossTalkDue: false };
check(needsYou(locked).length === 0, "locked features show no chip");
check(Object.keys(barBadges(locked)).length === 0, "locked features show no badge");

// A match tomorrow is not today.
check(!barBadges({ ...quiet, matchInDays: 1 }).play, "no match-today pulse the day before");

// The transfer window line (Harry's answer 18): counts down to the season's last fixture.
{
  const player = { firstName: "T", lastName: "P", age: 18, skinTone: "light", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]);
  const w0 = transferWindowWeeks(c, divisionOf(c));
  check(w0 !== null && w0 >= 30 && w0 <= 45, `a new season's window is about 9-10 months away (got ${w0} weeks)`);
  const half = { ...c, fixtures: c.fixtures.map((f, i) => (i < c.fixtures.length / 2 ? { ...f, played: true } : f)) };
  const w1 = transferWindowWeeks(half, divisionOf(c));
  check(w1 !== null && w0 !== null && w1 < w0, "the count goes down as the season is played");
  const done = { ...c, fixtures: c.fixtures.map((f) => ({ ...f, played: true })) };
  check(transferWindowWeeks(done, divisionOf(c)) === null, "no line once every fixture is played");
  check(transferWindowLine(0) === "Transfer window opens this week", "0 weeks reads 'this week'");
  check(transferWindowLine(1) === "Transfer window opens in 1 week", "1 week, singular");
  check(transferWindowLine(12) === "Transfer window opens in 12 weeks", "12 weeks");
}

// The Phone: an app added from the App Store wears "NEW" until it is opened.
{
  const player = { firstName: "T", lastName: "P", age: 18, skinTone: "light", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c0 = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]), money: 100000 };
  check(!!c0.unlocks, "a new career has the unlock chain");
  check(!appIsNew(c0, "social") && newAppCount(c0) === 0, "starter apps are not new");
  const c1 = installApp(c0, "casino-menu");
  check(appIsNew(c1, "casino-menu") && newAppCount(c1) === 1, "an installed app is new");
  const c2 = markAppOpened(c1, "casino-menu");
  check(!appIsNew(c2, "casino-menu") && newAppCount(c2) === 0, "opening it clears NEW");
  check(!appIsNew({ unlocks: undefined }, "casino-menu"), "an old save has nothing new");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — Needs you: most urgent first, every badge from a real source, nothing for locked features");
