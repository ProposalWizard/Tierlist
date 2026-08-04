import { sanitizeSquad, MAX_SQUAD, MAX_OVERALL, MAX_STARTERS } from "../../lib/squadSanitize";
import { computeTeamStrength } from "../../lib/seasonSimulator";

/**
 * draft_room_players is directly writable by its owner under the current RLS
 * policy, so a squad can reach the shared league without ever passing through
 * /ready. The simulator computes every phase rating from that stored squad, so
 * it is sanitised at the point of USE. These tests pin down what that stops.
 *
 * This is defence in depth, NOT a substitute for
 * security_rls_hardening_jul2026.sql — it cannot tell a legitimately drafted 99
 * from an invented one.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = (over: Partial<Record<string, unknown>> = {}) => ({
  name: "P", overall: 80, positions: "CM", club: "C", clubYear: "C 2024",
  assignedPosition: "CM", isSub: false, age: 26, ...over,
});

// ── Ratings are clamped ─────────────────────────────────────────────────────
const huge = sanitizeSquad([player({ overall: 99999 })]);
check(huge[0]?.overall === MAX_OVERALL, `overall 99999 clamps to ${MAX_OVERALL}`);

const negative = sanitizeSquad([player({ overall: -50 })]);
check(negative[0]?.overall === 1, "a negative overall clamps to 1");

const attrsSquad = sanitizeSquad([player({
  attrs: { pace: 100000, shooting: -20, passing: "nonsense", dribbling: 80 },
})]);
const at = attrsSquad[0]?.attrs as unknown as Record<string, number> | undefined;
check(at?.pace === MAX_OVERALL, "an absurd attribute clamps to the maximum");
check(at?.shooting === 0, "a negative attribute clamps to 0");
check(at?.passing === 0, "a non-numeric attribute becomes 0");
check(at?.dribbling === 80, "a legitimate attribute is untouched");

// ── Junk is dropped, not trusted ────────────────────────────────────────────
check(sanitizeSquad(null).length === 0, "a non-array squad yields nothing");
check(sanitizeSquad("not a squad").length === 0, "a string squad yields nothing");
check(sanitizeSquad([null, 5, "x"]).length === 0, "non-object entries are dropped");
check(sanitizeSquad([player({ name: "" })]).length === 0, "a nameless player is dropped");
check(sanitizeSquad([player({ overall: "abc" })]).length === 0, "an unparseable rating is dropped");

// ── Squad size is bounded ───────────────────────────────────────────────────
const massive = sanitizeSquad(Array.from({ length: 200 }, () => player()));
check(massive.length === MAX_SQUAD, `a 200-man squad is capped at ${MAX_SQUAD}`);

// ── The starting eleven is capped, which is the one that skews a league ─────
// computePhaseRatings averages every non-sub, so twenty "starters" would be
// rated on twenty players' worth of quality against everyone else's eleven.
const allStarters = sanitizeSquad(Array.from({ length: 20 }, () => player({ isSub: false })));
const starters = allStarters.filter(p => !p.isSub).length;
check(starters === MAX_STARTERS, `20 declared starters are reduced to ${MAX_STARTERS} (got ${starters})`);

// A cheated squad must not out-rate an honest one of the same players.
const honest = sanitizeSquad([
  ...Array.from({ length: 11 }, () => player({ overall: 80, isSub: false })),
  ...Array.from({ length: 3 }, () => player({ overall: 80, isSub: true })),
]);
const cheated = sanitizeSquad(
  Array.from({ length: 20 }, () => player({ overall: 99999, isSub: false }))
);
const honestStr = computeTeamStrength(honest).teamStrength;
const cheatedStr = computeTeamStrength(cheated).teamStrength;
check(cheatedStr <= MAX_OVERALL, `a cheated squad cannot exceed ${MAX_OVERALL} strength (got ${cheatedStr})`);
console.log(`honest 80-rated squad: ${honestStr.toFixed(1)}`);
console.log(`"99999-rated, 20 starters" squad: ${cheatedStr.toFixed(1)} — clamped from unbounded`);
console.log(
  "  NB that is still strong. Clamping only removes IMPOSSIBLE squads; it cannot\n" +
  "  tell a legitimately drafted 99 from an invented one. Closing that needs\n" +
  "  security_rls_hardening_jul2026.sql, which stops the row being written at all."
);

// ── Legitimate squads pass through untouched ────────────────────────────────
const legit = sanitizeSquad(honest);
check(legit.length === honest.length, "a valid squad keeps every player");
check(legit.filter(p => !p.isSub).length === 11, "a valid squad keeps its eleven starters");
check(computeTeamStrength(legit).teamStrength === honestStr, "a valid squad's strength is unchanged");

if (problems.length) {
  console.error("\nFAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("\nPASS — impossible squads are clamped, valid ones untouched");
