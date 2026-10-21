import { needsYou, barBadges, type NeedsInput } from "../../lib/star/needsYou";

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

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — Needs you: most urgent first, every badge from a real source, nothing for locked features");
