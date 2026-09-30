import { compactPotmHistory, type MonthAward } from "../../lib/star/potm";

/**
 * Player of the Month history is trimmed at each rollover (and on load for
 * an old save) — lib/star/potm.ts's compactPotmHistory. What must survive:
 * the current and just-finished seasons in full, and every month YOU won,
 * ever, with its name and date, so the Records screen's count and "last two"
 * are exactly what they were.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const MONTHS = ["August", "September", "October", "November", "December", "January", "February", "March", "April", "May"];
function award(season: number, month: number, isYou: boolean): MonthAward {
  const nominees = Array.from({ length: 5 }, (_, i) => ({
    name: i === 0 && isYou ? "You" : `Player ${season}-${month}-${i}`,
    club: "Some Club", goals: 5 - i, assists: i, isYou: i === 0 && isYou,
  }));
  return {
    season, month, monthName: MONTHS[month], winner: nominees[0].name, club: "Some Club",
    goals: 5, assists: 0, isYou, nominees, ...(isYou ? { yourPlace: 1 } : { yourPlace: 3 }),
  };
}

// Ten seasons, ten months each, you win every third month.
const all: MonthAward[] = [];
for (let s = 1; s <= 10; s++) for (let m = 0; m < 10; m++) all.push(award(s, m, (s * 10 + m) % 3 === 0));

// Records screen: count of months won, and the last two named.
const records = (potm: MonthAward[] | undefined) => {
  const won = (potm ?? []).filter(m => m.isYou);
  return `${won.length}|${won.slice(-2).map(m => `${m.monthName} ${m.season}`).join(",")}`;
};

// Rolling over from season 10 into 11: compact everything before season 10.
const kept = compactPotmHistory(all, 10)!;
check(records(kept) === records(all), "the Records screen's count and last two wins are unchanged");
check(kept.filter(a => a.season === 10).length === 10, "the season just finished stays whole (all ten months)");
check(canon(kept.filter(a => a.season === 10)) === canon(all.filter(a => a.season === 10)), "…untouched, shortlists and all");
check(kept.filter(a => a.season < 10).every(a => a.isYou), "older seasons keep only the months you won");
check(kept.filter(a => a.season < 10).every(a => a.nominees.length === 0), "…without their shortlists");
check(kept.filter(a => a.season < 10).every(a => a.winner && a.monthName && a.goals >= 0), "…but with the winner, month and numbers");
const before = JSON.stringify(all).length, after = JSON.stringify(kept).length;
check(after < before * 0.35, `ten seasons of awards shrink a lot (${before} → ${after} bytes)`);

// Idempotent, and a no-op returns the same array (no pointless state churn).
check(compactPotmHistory(kept, 10) === kept, "compacting again changes nothing and returns the same array");
check(compactPotmHistory(undefined, 5) === undefined && compactPotmHistory([], 5)!.length === 0, "empty history stays empty");
const thisSeasonOnly = all.filter(a => a.season === 10);
check(compactPotmHistory(thisSeasonOnly, 10) === thisSeasonOnly, "a history with nothing old is left alone");

function canon(v: unknown): string { return JSON.stringify(v); }

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS — Player of the Month history trimmed ${before} → ${after} bytes over ten seasons with every win, count and the current season intact`);
