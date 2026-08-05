import {
  POINTS_BY_RANK,
  computeHallOfFameLeaderboard,
} from "../../lib/hallOfFameLeaderboard";

/**
 * Hall of Fame leaderboard scoring: 5-4-3-2-1 down each record's top five,
 * summed across every board.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const board = (key: string, ...usernames: (string | null)[]) => ({
  key, entries: usernames.map(username => ({ username })),
});

// ── The scale itself ────────────────────────────────────────────────────────
{
  const table = computeHallOfFameLeaderboard([
    board("pl_goals", "ann", "ben", "cat", "dan", "eve"),
  ]);
  check(table[0].username === "ann" && table[0].points === 5, "1st place scores 5");
  check(table[1].username === "ben" && table[1].points === 4, "2nd place scores 4");
  check(table[2].username === "cat" && table[2].points === 3, "3rd place scores 3");
  check(table[3].username === "dan" && table[3].points === 2, "4th place scores 2");
  check(table[4].username === "eve" && table[4].points === 1, "5th place scores 1");
  check(POINTS_BY_RANK.length === 5, "only the top five score");
}

// ── Anything past fifth is worth nothing ────────────────────────────────────
{
  const table = computeHallOfFameLeaderboard([
    board("pl_goals", "ann", "ben", "cat", "dan", "eve", "sixth", "seventh"),
  ]);
  check(!table.some(r => r.username === "sixth"), "sixth place does not score");
  check(table.length === 5, "only five holders came from a five-deep board");
}

// ── Points add up across boards ─────────────────────────────────────────────
{
  const table = computeHallOfFameLeaderboard([
    board("pl_goals", "ann", "ben"),
    board("pl_assists", "ben", "ann"),
    board("all_wins", "ann"),
  ]);
  const ann = table.find(r => r.username === "ann")!;
  const ben = table.find(r => r.username === "ben")!;
  check(ann.points === 5 + 4 + 5, `ann totals 14 across three boards (got ${ann.points})`);
  check(ben.points === 4 + 5, `ben totals 9 (got ${ben.points})`);
  check(table[0].username === "ann", "the higher total leads");
  check(ann.boards === 3, "ann is credited with three distinct boards");
}

// ── Holding several places on ONE board scores each of them ────────────────
{
  const table = computeHallOfFameLeaderboard([
    board("pl_goals", "ann", "ann", "ann", "ben", "cat"),
  ]);
  const ann = table.find(r => r.username === "ann")!;
  check(ann.points === 5 + 4 + 3, `sweeping the podium scores 12 (got ${ann.points})`);
  check(ann.placings[0] === 1 && ann.placings[1] === 1 && ann.placings[2] === 1,
    "the placings breakdown records one of each");
  check(ann.boards === 1, "it is still only one board");
}

// ── Seeded real-world records never score ───────────────────────────────────
// They are landmarks to beat, not a rival, so "Official" must not appear.
{
  const table = computeHallOfFameLeaderboard([
    board("pl_goals", "Official", "ann", "ben"),
  ]);
  check(!table.some(r => r.username === "Official"), "Official is excluded");
  // It still occupies first place, so ann scores 4 rather than being promoted —
  // the board on screen shows Official above her, and the points must match it.
  const ann = table.find(r => r.username === "ann")!;
  check(ann.points === 4, `the holder below Official keeps their own rank (got ${ann.points})`);
}

// ── Ties break on quality, not just quantity ───────────────────────────────
{
  // Both reach 10: one 5+5, the other 4+3+3.
  const table = computeHallOfFameLeaderboard([
    board("a", "big"),
    board("b", "big"),
    board("c", "x", "spread"),
    board("d", "x", "y", "spread"),
    board("e", "x", "y", "spread"),
  ]);
  const big = table.find(r => r.username === "big")!;
  const spread = table.find(r => r.username === "spread")!;
  check(big.points === 10 && spread.points === 10, "both are level on points");
  check(
    table.findIndex(r => r.username === "big") < table.findIndex(r => r.username === "spread"),
    "two firsts outrank a four and two thirds",
  );
}

// ── Ordering is stable, not dependent on board order ────────────────────────
{
  const boards = [board("a", "zoe"), board("b", "amy")];
  const one = computeHallOfFameLeaderboard(boards).map(r => r.username).join();
  const two = computeHallOfFameLeaderboard([...boards].reverse()).map(r => r.username).join();
  check(one === two, `equal totals order the same either way (${one} vs ${two})`);
}

// ── Malformed input cannot throw ────────────────────────────────────────────
{
  const table = computeHallOfFameLeaderboard([
    { key: "x", entries: [{ username: null }, { username: "" }, { username: "  " }] },
    { key: "y", entries: [] },
  ]);
  check(table.length === 0, "blank and missing usernames are ignored");
  check(computeHallOfFameLeaderboard([]).length === 0, "no boards means an empty table");
}

// ── Only the top N come back ────────────────────────────────────────────────
{
  const many = Array.from({ length: 12 }, (_, i) => board(`b${i}`, `user${i}`));
  check(computeHallOfFameLeaderboard(many).length === 5, "the table is capped at five");
  check(computeHallOfFameLeaderboard(many, 3).length === 3, "the cap is adjustable");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — 5-4-3-2-1 scoring, tie-breaks, and exclusions all hold");
