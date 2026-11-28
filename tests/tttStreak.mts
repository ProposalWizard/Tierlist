import assert from "node:assert/strict";
import { currentStreak, bestStreak } from "../lib/ttt/streak";
assert.equal(currentStreak([], "2026-11-27"), 0);
assert.equal(currentStreak(["2026-11-27"], "2026-11-27"), 1);
assert.equal(currentStreak(["2026-11-25", "2026-11-26"], "2026-11-27"), 2, "held until today is missed");
assert.equal(currentStreak(["2026-11-24", "2026-11-25"], "2026-11-27"), 0, "a missed day ends it");
assert.equal(currentStreak(["2026-11-30", "2026-12-01", "2026-11-29"], "2026-12-01"), 3, "across months");
assert.equal(bestStreak(["2026-11-01", "2026-11-02", "2026-11-05", "2026-11-06", "2026-11-07"]), 3);
console.log("tttStreak: ok");
