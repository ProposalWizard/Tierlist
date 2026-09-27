import { dailySpecials, dateKeyFor, msUntilReset, formatCountdown, specialPool, SPECIAL_DISCOUNTS } from "../../lib/star/store/daily";
import { findItem } from "../../lib/star/store/catalogue";

/** DAILY SPECIALS — same for everyone on a day, new every day. */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 8, 27, 10, 30);
check(dateKeyFor(t0) === "2026-09-27", `date key (${dateKeyFor(t0)})`);
check(dateKeyFor(t0, 1) === "2026-09-28", "skip a day moves the key on one day");
check(dateKeyFor(Date.UTC(2026, 8, 27, 23, 59)) === "2026-09-27", "late the same day is still the same day");
check(msUntilReset(t0) === 13.5 * 3_600_000, `countdown to midnight (${msUntilReset(t0)})`);
check(formatCountdown(13.5 * 3_600_000) === "13h 30m", formatCountdown(13.5 * 3_600_000));
check(formatCountdown(65_000) === "1m 05s", formatCountdown(65_000));

// Same key → identical list, every time (deterministic, not the clock).
const a = JSON.stringify(dailySpecials("2026-09-27"));
check(a === JSON.stringify(dailySpecials("2026-09-27")), "same day, same specials");

const pool = specialPool();
let changed = 0, prev = "";
const seenIds = new Set<string>();
for (let i = 0; i < 365; i++) {
  const key = dateKeyFor(t0, i);
  const s = dailySpecials(key);
  check(s.length === 3 || s.length === 4, `${key}: 3 or 4 specials (${s.length})`);
  check(new Set(s.map((x) => x.itemId)).size === s.length, `${key}: no item twice`);
  check(!!s[0].featured && s.filter((x) => x.featured).length === 1, `${key}: exactly one headline, first`);
  const head = findItem(s[0].itemId);
  check(!!head && (head.kind === "animation" || head.kind === "accessory") && head.rarity !== "common", `${key}: headline is a rare+ cosmetic`);
  for (const x of s) {
    check(pool.all.includes(x.itemId), `${key}: ${x.itemId} is in the pool`);
    check((SPECIAL_DISCOUNTS as readonly number[]).includes(x.percentOff), `${key}: discount ${x.percentOff}% is a real step`);
    check(x.itemId !== "standard" && x.itemId !== "fk_standard", `${key}: a free run-up is never a special`);
    seenIds.add(x.itemId);
  }
  const sig = s.map((x) => x.itemId).join(",");
  if (sig !== prev) changed++;
  prev = sig;
}
check(changed >= 360, `specials change almost every day (${changed}/365)`);
check(seenIds.size >= pool.all.length * 0.9, `a year covers the pool (${seenIds.size}/${pool.all.length})`);

if (problems.length) { console.error("storeDaily FAILED:\n  " + problems.slice(0, 20).join("\n  ")); process.exit(1); }
console.log(`storeDaily: all passed (${changed}/365 days changed, ${seenIds.size}/${pool.all.length} items seen)`);
