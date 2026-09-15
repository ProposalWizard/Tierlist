import { makeInitialCareer, willingToRenegotiate } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { StarPlayer } from "../../lib/star/types";

/**
 * CONTRACT RENEWAL — ASK ANY TIME, BUT ONLY A REAL PERFORMANCE EARNS A
 * CONVERSATION.
 *
 * Requested directly: the old "come back in your final year" gate is gone —
 * a renewal can be proposed any time — but the club now has to actually be
 * keen: a real star-rating level or a genuine hot streak of recent form,
 * the same two signals `checkForContractOffer`'s own unsolicited early
 * offer already judges by, reused here rather than a second standard.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

// ── A fresh career (2.5★, no form history) isn't good enough yet ─────────
{
  const career = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  check(career.starRating < 3, "fixture assumption: a fresh career starts below the 3★ bar");
  check(!willingToRenegotiate(career), "a fresh career with nothing behind it yet doesn't earn a renewal conversation");
}

// ── A real star-rating level is enough on its own ─────────────────────────
{
  const career = { ...makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]), starRating: 3.2 };
  check(willingToRenegotiate(career), "a genuine 3★+ level earns a real conversation, regardless of recent form");
}

// ── Genuinely hot recent form is enough on its own, even at low rating ────
{
  const career = { ...makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]), starRating: 2.5, form: [8.2, 7.9, 8.5, 7.6, 8.0] };
  check(willingToRenegotiate(career), "a genuine hot streak of recent form earns it too, even below 3★");
}

// ── A short or lukewarm run of form doesn't clear the bar ─────────────────
{
  const tooFew = { ...makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]), starRating: 2.5, form: [9, 9, 9] };
  check(!willingToRenegotiate(tooFew), "fewer than a real window of matches doesn't count, however good they were");

  const lukewarm = { ...makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]), starRating: 2.5, form: [6.8, 7.0, 6.5, 7.1, 6.9] };
  check(!willingToRenegotiate(lukewarm), "an ordinary run of form, not a genuinely hot one, isn't enough either");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a renewal can be asked for any time, but only a real star-rating level or genuinely hot recent form earns the club's actual interest");
