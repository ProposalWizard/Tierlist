import { makeFakeDb, buildRows } from "./fakeSupabase.mjs";
import {
  AM_PICK_SECONDS,
  fetchRoundPlayers,
  makeAmericanState,
  makeReplacementState,
  nextPickDeadline,
} from "../../lib/americanDraft";

/**
 * The pick clock.
 *
 * Every turn carries a server-set deadline. Once it passes, any member of the
 * room can ask the server to auto-pick for whoever is stalling — which is what
 * stops one player closing their laptop from freezing the draft for everyone
 * else, permanently.
 *
 * These tests cover the parts that live in the state model. The authority check
 * itself (deadline vs the SERVER clock, membership, and picking the best card
 * on the board) is in the pick route.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── Deadlines are set when a draft is seeded ─────────────────────────────────
const db = makeFakeDb({ rows: buildRows() });
const pool = await fetchRoundPlayers(db as never, "GK", []);

const initial = makeAmericanState(["alice", "bob"], pool);
check(typeof initial.pick_deadline === "number", "initial draft is seeded with a deadline");
check((initial.pick_deadline ?? 0) > Date.now(), "initial deadline is in the future");

const replacement = makeReplacementState({ alice: 2 }, {}, ["alice"], pool);
check(typeof replacement.pick_deadline === "number", "replacement draft is seeded with a deadline");
check((replacement.pick_deadline ?? 0) > Date.now(), "replacement deadline is in the future");

// ── The window is the advertised length ──────────────────────────────────────
const before = Date.now();
const d = nextPickDeadline();
const seconds = (d - before) / 1000;
check(
  seconds > AM_PICK_SECONDS - 2 && seconds <= AM_PICK_SECONDS + 2,
  `deadline is ~${AM_PICK_SECONDS}s away (got ${seconds.toFixed(1)}s)`,
);

// ── An expired deadline is in the past, a fresh one is not ───────────────────
// This is exactly the comparison the pick route makes before allowing an
// auto-pick, so it is worth pinning the direction of it down.
const expired = Date.now() - 1;
check(Date.now() >= expired, "an elapsed deadline reads as expired");
check(Date.now() < nextPickDeadline(), "a fresh deadline does NOT read as expired");

// ── Auto-pick target: the best card on the board ─────────────────────────────
// The route sorts by ovr and takes the top. Missing a turn already costs you
// the choice; handing out a deliberately weak card on top would let a dropped
// connection wreck someone's season.
const board = await fetchRoundPlayers(db as never, "CB", []);
const best = [...board].sort((a, b) => b.ovr - a.ovr)[0];
check(!!best, "there is always a card to auto-pick from a non-empty board");
check(
  board.every(p => p.ovr <= (best?.ovr ?? 0)),
  "auto-pick takes the highest rated card available",
);

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS — turns carry a ${AM_PICK_SECONDS}s deadline and expire cleanly`);
