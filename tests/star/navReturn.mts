import { openFrom, backFrom, type NavEntry, type NavSpot } from "../../lib/star/navReturn";

/** Back goes back (navigation round 1): a screen returns to where it was opened from. */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const PHONE: NavSpot = { phase: "media", nav: "media" };
const RELATIONS: NavSpot = { phase: "skills", nav: "life", trainingTab: "life" };
const STATS: NavSpot = { phase: "dashboard", nav: "home", homePage: 0 };

// Phone → Owner → Back = the Phone.
let s: NavEntry[] = openFrom([], PHONE, "ownership");
let b = backFrom(s, "ownership");
check(b.spot?.phase === "media", "Phone → Owner → Back should land on the Phone");
check(b.rest.length === 0, "the stack is empty after going back");

// Owner → Reputation is inside Ownership: Back from Reputation's own screen is
// Ownership's job; Back from Ownership still knows the Phone.
check(backFrom(s, "reputation").spot?.phase === "media", "Ownership's inner screens share its way out");

// Phone → Shop → Store (the rail) → Back = Shop → Back = Phone.
s = openFrom([], PHONE, "shop-kib");
s = openFrom(s, { phase: "shop-kib", nav: "home" }, "store");
b = backFrom(s, "store");
check(b.spot?.phase === "shop-kib", "Store opened from the Shop rail goes back to the Shop");
b = backFrom(b.rest, "shop-boots");
check(b.spot?.phase === "media", "the Shop (any tab) opened from the Phone goes back to the Phone");

// Relations → Sponsors → negotiation: Back from either = Relations.
s = openFrom([], RELATIONS, "sponsors");
check(backFrom(s, "sponsor-negotiation").spot?.trainingTab === "life", "Sponsors from Relations go back to Relations");

// Stats → Trophies → Back = Stats.
s = openFrom([], STATS, "trophies");
check(backFrom(s, "trophies").spot?.homePage === 0, "Trophies from Stats go back to Stats");

// A screen nobody pushed (League's own Back) still goes Home and clears stale entries.
s = openFrom([], PHONE, "casino-menu");
b = backFrom(s, "league");
check(b.spot === null && b.rest.length === 0, "an unrelated Back goes Home and drops stale entries");

// Moving between tabs of one family does not stack.
s = openFrom([], PHONE, "shop-kib");
s = openFrom(s, { phase: "shop-kib" }, "shop-boots");
check(s.length === 1, "switching shop tabs does not add a way back");

// Opening the same screen again from elsewhere replaces the old way back.
s = openFrom([], PHONE, "settings");
s = openFrom(s, RELATIONS, "settings");
check(s.length === 1 && backFrom(s, "settings").spot?.phase === "skills", "the newest way back wins");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — Back returns to the Phone, Relations, Stats or the Shop it was opened from");
