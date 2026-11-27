/**
 * MONEY + SPONSOR GUIDE CHECK (Mikey, 27 Nov 2026).
 *  1. "Give me money (testing)": the typed amount is added exactly, big numbers work, junk is ignored.
 *  2. The sponsor pointer: shows while the offer waits, never again once it was shown, and never after the
 *     offer is accepted or declined (the Phone is built again with the same params when you come back).
 * Run from the repo root:
 *   npx esbuild phone/tools/money-guide-check.ts --bundle --platform=neutral --main-fields=module,main --format=esm \
 *     --alias:@=. --external:three --outfile=/tmp/mg.mjs && node /tmp/mg.mjs
 */
import { startCareer } from "../src/game/newCareer";
import { giveMoney, parseMoneyInput } from "../src/world/giveMoney";
import { sponsorTourDue } from "../src/world/sponsorTour";
import { signOffer, declineOffer, brandsOf } from "@/lib/star/sponsorDeals";
import { markSeen } from "@/lib/star/unlocks";
import type { CareerState } from "@/lib/star/types";

let fails = 0;
const ok = (name: string, v: boolean) => { if (!v) fails++; console.log(`${v ? "PASS" : "FAIL"}  ${name}`); };

const base = startCareer("Test", "Player");
const withMoney = { ...base, money: 1000 } as CareerState;

// ── 1. money ──
ok("adds exactly 500", giveMoney(withMoney, "500").money === 1500);
ok("accepts commas and a star", giveMoney(withMoney, "★1,000,000").money === 1_001_000);
ok("accepts a big number (50 billion)", giveMoney(withMoney, "50000000000").money === 50_000_001_000);
ok("a huge number does not break the balance", Number.isFinite(giveMoney(withMoney, "9".repeat(40)).money));
for (const junk of ["", "abc", "-5", "0", "12abc", "1e9", "  ", "NaN", "Infinity"]) {
  ok(`ignores junk "${junk}"`, giveMoney(withMoney, junk) === withMoney && parseMoneyInput(junk) === null);
}
ok("marks the save as a tester save", giveMoney(withMoney, "5").usedGodMode === true);
ok("original career untouched", withMoney.money === 1000 && !withMoney.usedGodMode);

// ── 2. the sponsor pointer ──
const offer = {
  id: "o1", kind: "new", brand: "TestBrand", color: "#fff", category: "Boots", weekly: 100, seasons: 1, targets: [],
  signingOn: 500, expires: { season: 99, week: 99 }, note: "",
} as unknown as import("@/lib/star/sponsorDeals").BrandOffer;
const withOffer = { ...withMoney, brands: { ...brandsOf(withMoney), offers: [offer] } } as CareerState;

/** The rule before the fix: the params alone decided. */
const oldRule = (_c: CareerState, p: unknown) => p === "sponsor";

ok("shows while the offer waits (first visit)", sponsorTourDue(withOffer, "sponsor"));
ok("not without the story param", !sponsorTourDue(withOffer, undefined));
// first visit: it is marked as shown the moment it is up
const shown = markSeen(withOffer, "tour-sponsor");
ok("not again once shown, even if the offer still waits", !sponsorTourDue(shown, "sponsor"));
// Mikey's path: accept on the Sponsors page, back to the Phone (same params)
const r = signOffer(shown, "o1");
ok("offer signs", r.ok === true);
const accepted = r.ok ? r.career : shown;
ok("BUG BEFORE FIX: old rule still shows after accepting", oldRule(accepted, "sponsor") === true);
ok("FIXED: no pointer after accepting", !sponsorTourDue(accepted, "sponsor"));
// even if it was never marked shown (app closed mid-tour), accepted/declined/expired = no pointer
const acceptedUnmarked = signOffer(withOffer, "o1");
ok("no pointer after accepting, even when never marked", acceptedUnmarked.ok && !sponsorTourDue(acceptedUnmarked.career, "sponsor"));
ok("no pointer after declining", !sponsorTourDue(declineOffer(withOffer, "o1"), "sponsor"));
ok("no pointer once the offer has expired (gone)", !sponsorTourDue({ ...withOffer, brands: { ...brandsOf(withOffer), offers: [] } } as CareerState, "sponsor"));

console.log(fails ? `\n${fails} FAILED` : "\nAll money + sponsor guide checks passed");
process.exit(fails ? 1 : 0);
