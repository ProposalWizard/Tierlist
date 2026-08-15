import {
  line, linesFrom, halfTimeSplit, dwellFor, HALF_TIME_MINUTE, type LogLine,
} from "../../lib/star/matchLog";

/**
 * THE RUNNING COMMENTARY.
 *
 * The model behind the screen a match is now played on. Three things have to
 * hold, and all three are the kind that look fine in one hand-read sample and
 * fall over across ninety minutes.
 *
 * A passage of play has to read as a passage — the minute printed once, not on
 * every line of the same attack. A goal has to be told apart from a throw-in,
 * both in how it is styled and in how long it sits on screen. And the interval
 * has to land in the right place exactly once, because `hiddenMatch` runs 1 to
 * 90 and has never had one.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── A line knows what it is ─────────────────────────────────────────────────
{
  const a = line("They push forward");
  const b = line("They push forward");
  check(a.id !== b.id, `two lines are never the same line (${a.id} vs ${b.id})`);
  check(a.tone === "play", "ordinary play is the default tone");
  check(a.minute === undefined, "and a line has no minute unless it is given one");

  const goal = line("⚽ Vass scores!", "goal", 54);
  check(goal.tone === "goal" && goal.minute === 54, "a goal carries its tone and its minute");
}

// ── The minute is printed once per passage ──────────────────────────────────
//
// The bug this prevents: four events in the sixty-eighth minute are ONE attack.
// Stamping 68 down the left of all four turns it into four unrelated incidents
// that happen to share a number.
{
  const out = linesFrom([
    { minute: 18, text: "Man Utd have a chance to score..." },
    { minute: 18, text: "But the shot goes wide" },
    { minute: 23, text: "⚽ Man Utd score!", isGoal: true, isOpponent: true },
    { minute: 31, text: "Liverpool are taking it easy" },
    { minute: 31, text: "They push forward" },
    { minute: 31, text: "It breaks down" },
  ]);

  check(out.length === 6, `every event becomes a line (${out.length})`);
  check(out[0].minute === 18, "the first line of a passage carries the minute");
  check(out[1].minute === undefined, "…and the second does not");
  check(out[2].minute === 23, "a new minute prints again");
  check(out[3].minute === 31, "…and so does the next");
  check(out[4].minute === undefined && out[5].minute === undefined,
    "…with the rest of that passage silent");

  const printed = out.filter(l => l.minute !== undefined).length;
  check(printed === 3, `three minutes across six lines (${printed})`);

  // Tones survive the mapping, and an opponent goal is not our goal.
  check(out[2].tone === "oppGoal", `their goal reads as theirs (${out[2].tone})`);
  const ours = linesFrom([{ minute: 54, text: "⚽ Vass scores!", isGoal: true }]);
  check(ours[0].tone === "goal", `and ours as ours (${ours[0].tone})`);

  // A passage that continues from the minute already on screen does not
  // reprint it — the streamer hands in where the clock was.
  const continued = linesFrom([{ minute: 31, text: "Still 31" }], 31);
  check(continued[0].minute === undefined, "a passage continuing the current minute stays silent");
}

// ── Half time lands once, in the right place ────────────────────────────────
{
  const firstHalf = linesFrom([
    { minute: 20, text: "a" }, { minute: 31, text: "b" }, { minute: 44, text: "c" },
  ]);
  check(halfTimeSplit(firstHalf, false) === -1, "a run entirely in the first half has no break in it");

  const spanning = linesFrom([
    { minute: 41, text: "a" }, { minute: 44, text: "b" }, { minute: 49, text: "c" }, { minute: 52, text: "d" },
  ]);
  const at = halfTimeSplit(spanning, false);
  check(at === 2, `the break goes before the first line of the second half (index ${at})`);
  check(spanning[at].minute === 49, "…which is the 49th minute here");

  check(halfTimeSplit(spanning, true) === -1, "and never twice in one match");

  // Exactly 45 is still the first half — the interval comes after it.
  const onTheWhistle = linesFrom([{ minute: 45, text: "a" }]);
  check(halfTimeSplit(onTheWhistle, false) === -1,
    `the 45th minute is played before the break, not after it (${halfTimeSplit(onTheWhistle, false)})`);
  check(HALF_TIME_MINUTE === 45, "and the break is at 45");
}

// ── A goal holds longer than a throw-in ─────────────────────────────────────
//
// If every line sits for the same beat, a scoreline changes under you at the
// speed of "they push forward" and you miss it.
{
  const speed = 1;
  const play = dwellFor("play", speed);
  const goal = dwellFor("goal", speed);
  const opp = dwellFor("oppGoal", speed);
  const period = dwellFor("period", speed);
  const chance = dwellFor("chance", speed);

  check(goal > chance && chance > play, `a goal holds longest, then a chance, then play (${goal}/${chance}/${play})`);
  check(goal === opp, "their goal holds as long as ours — it matters just as much");
  check(period > play, `the interval holds longer than ordinary play (${period}/${play})`);

  // Speed divides, and never divides away to nothing — a zero-length timer is
  // a whole half arriving in one frame.
  for (const s of [1, 2, 4]) {
    for (const tone of ["play", "goal", "oppGoal", "period", "chance"] as const) {
      const d = dwellFor(tone, s);
      check(d >= 60, `${tone} at ${s}x still takes time (${d}ms)`);
      check(d <= dwellFor(tone, 1), `${tone} at ${s}x is no slower than at 1x`);
    }
  }
  check(dwellFor("play", 4) < dwellFor("play", 1), "and turning it up genuinely speeds it up");
  // A nonsense speed cannot make it faster than 1x, which is what a divide by
  // zero or a negative would do.
  check(dwellFor("play", 0) === dwellFor("play", 1), "a zero speed is treated as normal, not as instant");
}

// ── A whole match's worth ───────────────────────────────────────────────────
//
// The list is kept for all ninety minutes rather than truncated, so it is worth
// knowing it stays a sane size and every line stays uniquely keyed.
{
  const events = Array.from({ length: 300 }, (_, i) => ({
    minute: Math.floor(i / 3) + 1,
    text: `event ${i}`,
  }));
  const all: LogLine[] = linesFrom(events);
  check(all.length === 300, `three hundred events, three hundred lines (${all.length})`);
  check(new Set(all.map(l => l.id)).size === 300, "every one of them uniquely keyed");
  const withMinutes = all.filter(l => l.minute !== undefined).length;
  check(withMinutes === 100, `one minute printed per group of three (${withMinutes})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — a passage reads as a passage, a goal holds, and the interval lands once");
